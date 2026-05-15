# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start server (requires .env)
npm start

# Smoke test — boots in-memory MongoDB, hits key routes, no browser
npm run test:smoke

# Playwright E2E — boots in-memory MongoDB on port 3999, runs browser tests
npm run test:e2e

# Single Playwright test
npx playwright test --grep "test name here"
```

## Environment

Copy `.env.example` → `.env` and fill in all four keys:
- `MONGODB_URI` — MongoDB Atlas connection string
- `FINNHUB_API_KEY` — free tier works; rate-limited (see cache below)
- `GROQ_API_KEY` — optional at startup; AI routes return 503 without it
- `SESSION_SECRET` — arbitrary string

The Groq client (`lib/groqClient.js`) is lazy: returns `null` if key is missing, so the server boots without it. All AI routes must guard on `getGroq() === null`.

## Architecture

Express + EJS + MongoDB (Mongoose). No build step.

```
server.js          — app setup, auth middleware, root routes, /api/prices, /api/news
routes/watchlist.js — CRUD for saved tickers (GET/POST /watchlist, POST /watchlist/remove)
routes/ai.js       — POST /ai/generate, POST /ai/ask, GET /ai/history
lib/finnhubData.js — all Finnhub API calls; exports: getMarketStatusUS, getWatchlistQuotesEnriched, resolveHeadlineArticles, validateTicker
lib/finnhubCache.js — in-memory TTL cache (Map); used to avoid hitting Finnhub free-tier rate limits
lib/groqClient.js  — lazy singleton Groq client
lib/generateBrief.js — builds market brief via llama-3.3-70b-versatile, saves to AIBrief
models/Ticker.js   — {username, symbol, addedAt}
models/AIBrief.js  — {username, content, generatedAt}
models/QAHistory.js — {username, question, answer, askedAt}
```

**Auth** is username-only (no password). `requireAuth` middleware checks `req.session.username` and redirects to `/login`. Usernames are lowercased and stripped to `[a-z0-9_]`.

**News pipeline**: `resolveHeadlineArticles` fetches company news for up to 8 saved tickers; falls back to general market news if watchlist is empty or returns nothing. `/api/news` then sends up to 25 headlines to Groq (llama-3.1-8b-instant) for per-headline sentiment scoring (`bullish`/`neutral`/`bearish`, score −1.0–1.0).

**Brief generation** (`POST /ai/generate`): pulls watchlist prices + headlines, sends to llama-3.3-70b-versatile for a 3-paragraph plain-prose brief, persists to `AIBrief`.

**Grounded Q&A** (`POST /ai/ask`): answers user questions using only the 12 most recent headlines as context; saves to `QAHistory`.

**Watchlist enrichment**: `getWatchlistQuotesEnriched` fetches quote + profile2 + next earnings date for each ticker. Profile and earnings only run for the first 8 tickers to limit API calls.

## Tests

- `scripts/pw-server.js` — Playwright's `webServer` entry; spins up `MongoMemoryServer` then starts `server.js`
- `scripts/smoke.js` — standalone HTTP smoke test; no browser required
- `tests/dashboard.spec.js` — Playwright suite covering dashboard, watchlist, AI history, and login flows

Onboarding gate (`fw_onboarded` in `localStorage`) is bypassed in tests via `page.evaluate(() => localStorage.setItem("fw_onboarded", "1"))` after login.
