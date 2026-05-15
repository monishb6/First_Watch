const { getGroq } = require("./groqClient");
const { getWatchlistQuotesEnriched, resolveHeadlineArticles } = require("./finnhubData");
const AIBrief = require("../models/AIBrief");

async function generateBrief(username) {
  const groq = getGroq();
  if (!groq) throw new Error("GROQ_API_KEY not configured");

  const prices = await getWatchlistQuotesEnriched(username);
  const { feed, articles } = await resolveHeadlineArticles(username);
  const top = (Array.isArray(articles) ? articles : []).slice(0, 15);

  const priceContext = prices
    .map((p) => `${p.symbol}: $${p.price} (${p.percentChange >= 0 ? "+" : ""}${p.percentChange}%)`)
    .join(", ");
  const headlineContext = top.map((a, i) => `${i + 1}. ${a.headline}`).join("\n");
  const feedNote =
    feed === "watchlist"
      ? "Headlines are drawn from Finnhub company news for symbols on the user's saved watchlist (deduplicated)."
      : "Headlines are general market news from Finnhub.";

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are a market analyst writing a brief for active traders. Using the prices and headlines below, write exactly 3 paragraphs:
Paragraph 1: What is moving today and the key drivers behind it.
Paragraph 2: Overall market sentiment direction based on the headlines.
Paragraph 3: One specific catalyst or data point to watch in the next 24-48 hours.

Write plain prose only. No headers, no bullets, no markdown. Separate paragraphs with a blank line.

${feedNote}

Current prices: ${priceContext || "No tickers saved."}

Top headlines:
${headlineContext || "(none available)"}`,
      },
    ],
  });

  const content =
    (completion.choices[0].message.content || "").trim() ||
    "Brief unavailable — the model returned an empty response.";
  return new AIBrief({ username, content }).save();
}

module.exports = { generateBrief };
