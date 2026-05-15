const fetch = require("node-fetch");
const cache = require("./finnhubCache");
const Ticker = require("../models/Ticker");

const BASE = "https://finnhub.io/api/v1";

function token() {
  return process.env.FINNHUB_API_KEY || "";
}

async function finnhubGet(path, query, cacheKey, ttlMs) {
  const key = cacheKey || `${path}?${JSON.stringify(query)}`;
  const hit = cache.get(key);
  if (hit !== null) return hit;

  const params = new URLSearchParams({ ...query, token: token() });
  const url = `${BASE}${path}?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && data.error)) {
    const err = new Error((data && data.error) || res.statusText || "Finnhub request failed");
    err.status = res.status;
    err.body = data;
    throw err;
  }
  if (ttlMs > 0) cache.set(key, data, ttlMs);
  return data;
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

/** US equity session hint for the header (cached ~1 min). */
async function getMarketStatusUS() {
  const key = "marketStatus:US";
  const hit = cache.get(key);
  if (hit !== null) return hit;

  try {
    const data = await finnhubGet("/stock/market-status", { exchange: "US" }, null, 0);
    const holiday = data.holiday;
    const session = (data.session || "").toString().toLowerCase();
    const isOpenFlag = data.isOpen === true;
    let label = "US markets";
    let isRegularOpen = false;
    if (holiday) {
      label = `Closed (${holiday})`;
    } else if (session === "open" || (isOpenFlag && !session)) {
      label = "US cash session open";
      isRegularOpen = true;
    } else if (session === "pre_market" || session === "pre-market") {
      label = "Pre-market";
    } else if (session === "after_market" || session === "after-hours" || session === "post_market") {
      label = "After-hours";
    } else if (session === "closed" || session === "holiday") {
      label = "Closed";
    } else if (session) {
      label = session.replace(/_/g, " ");
    } else if (isOpenFlag) {
      label = "Open";
      isRegularOpen = true;
    }
    const out = { label, session: data.session || null, holiday: holiday || null, isRegularOpen, raw: data };
    cache.set(key, out, 60_000);
    return out;
  } catch (e) {
    const out = { label: "Market status unavailable", session: null, holiday: null, isRegularOpen: false, raw: null };
    cache.set(key, out, 60_000);
    return out;
  }
}

async function getProfile2(symbol) {
  const sym = encodeURIComponent(symbol);
  const key = `profile2:${sym}`;
  const hit = cache.get(key);
  if (hit !== null) return hit;
  try {
    const data = await finnhubGet("/stock/profile2", { symbol }, key, 0);
    cache.set(key, data, 3_600_000);
    return data;
  } catch {
    cache.set(key, {}, 300_000);
    return {};
  }
}

async function getNextEarningsDate(symbol) {
  const sym = encodeURIComponent(symbol);
  const key = `earningsNext:${sym}`;
  const hit = cache.get(key);
  if (hit !== null) return hit;

  const today = new Date();
  const from = ymd(today);
  const to = ymd(new Date(today.getTime() + 180 * 86400000));
  try {
    const data = await finnhubGet("/calendar/earnings", { from, to, symbol, international: "false" }, null, 0);
    const rows = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
    const forSym = rows.filter((r) => r.symbol === symbol && r.date >= from);
    forSym.sort((a, b) => a.date.localeCompare(b.date));
    const next = forSym[0]?.date || null;
    cache.set(key, next, 86_400_000);
    return next;
  } catch {
    cache.set(key, null, 3600_000);
    return null;
  }
}

async function getCompanyNews(symbol, days = 4) {
  const toD = new Date();
  const fromD = new Date(toD.getTime() - days * 86400000);
  const from = ymd(fromD);
  const to = ymd(toD);
  const key = `companyNews:${encodeURIComponent(symbol)}:${from}:${to}`;
  const hit = cache.get(key);
  if (hit !== null) return hit;

  try {
    const url = `${BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(token())}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => []);
    const list = Array.isArray(data) ? data : [];
    cache.set(key, list, 120_000);
    return list;
  } catch {
    cache.set(key, [], 60_000);
    return [];
  }
}

async function getGeneralNews() {
  const key = "news:general";
  const hit = cache.get(key);
  if (hit !== null) return hit;
  try {
    const data = await finnhubGet("/news", { category: "general" }, key, 0);
    const list = Array.isArray(data) ? data : [];
    cache.set(key, list, 90_000);
    return list;
  } catch {
    cache.set(key, [], 60_000);
    return [];
  }
}

function dedupeNewsArticles(rows) {
  const seen = new Set();
  const out = [];
  for (const a of rows) {
    const k = `${a.id || ""}|${a.url || ""}|${a.headline || ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  out.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
  return out;
}

/**
 * Picks headline feed: merged company news for saved tickers when possible,
 * otherwise general market news.
 */
async function resolveHeadlineArticles(username) {
  const tickers = await Ticker.find({ username }).sort({ addedAt: 1 });
  const symbols = tickers.map((t) => t.symbol);
  if (symbols.length === 0) {
    const articles = await getGeneralNews();
    return { feed: "general", articles: articles.slice(0, 50) };
  }

  const capped = symbols.slice(0, 8);
  const chunks = await Promise.all(capped.map((s) => getCompanyNews(s, 4)));
  const merged = dedupeNewsArticles(chunks.flat());
  if (merged.length === 0) {
    const articles = await getGeneralNews();
    return { feed: "general", articles: articles.slice(0, 50) };
  }
  return { feed: "watchlist", articles: merged.slice(0, 40) };
}

/** Finnhub profile2 `marketCapitalization` is in millions of USD. */
function formatMarketCap(millionsUsd) {
  if (millionsUsd == null || millionsUsd === undefined || Number.isNaN(Number(millionsUsd))) return null;
  const m = Number(millionsUsd);
  const dollars = m * 1e6;
  if (dollars >= 1e12) return `$${(dollars / 1e12).toFixed(2)}T`;
  if (dollars >= 1e9) return `$${(dollars / 1e9).toFixed(2)}B`;
  if (dollars >= 1e6) return `$${(dollars / 1e6).toFixed(1)}M`;
  if (dollars > 0) return `$${dollars.toFixed(0)}`;
  return null;
}

/**
 * Watchlist rows for /api/prices: quote + profile + next earnings (cached).
 */
async function getWatchlistQuotesEnriched(username) {
  const tickers = await Ticker.find({ username }).sort({ addedAt: 1 });
  const rows = await Promise.all(
    tickers.map(async (ticker, index) => {
      const sym = ticker.symbol;
      const qKey = `quote:${encodeURIComponent(sym)}`;
      let quote = cache.get(qKey);
      if (quote === null) {
        try {
          quote = await finnhubGet("/quote", { symbol: sym }, qKey, 0);
          cache.set(qKey, quote, 30_000);
        } catch {
          quote = {};
        }
      }
      const enrich = index < 8;
      const [profile, nextEarnings] = enrich
        ? await Promise.all([getProfile2(sym), getNextEarningsDate(sym)])
        : [{}, null];
      return {
        symbol: sym,
        price: quote.c,
        change: quote.d,
        percentChange: quote.dp,
        companyName: profile.name || null,
        exchange: profile.exchange || null,
        industry: profile.finnhubIndustry || null,
        marketCapLabel: formatMarketCap(profile.marketCapitalization),
        nextEarningsDate: nextEarnings,
      };
    })
  );
  return rows;
}

async function validateTicker(symbol) {
  const key = `validate:${encodeURIComponent(symbol)}`;
  const hit = cache.get(key);
  if (hit !== null) return hit;
  try {
    const quote = await finnhubGet("/quote", { symbol }, null, 0);
    // pc (previous close) > 0 means it's a real tradeable instrument
    const valid = typeof quote.pc === "number" && quote.pc > 0;
    const result = { valid };
    cache.set(key, result, 3_600_000);
    return result;
  } catch {
    return { valid: false };
  }
}

module.exports = {
  getMarketStatusUS,
  getWatchlistQuotesEnriched,
  resolveHeadlineArticles,
  validateTicker,
};
