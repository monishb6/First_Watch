require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const { getGroq } = require("./lib/groqClient");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const watchlistRouter = require("./routes/watchlist");
const aiRouter = require("./routes/ai");
app.use("/watchlist", watchlistRouter);
app.use("/ai", aiRouter);

const AIBrief = require("./models/AIBrief");
const { getMarketStatusUS, getWatchlistQuotesEnriched, resolveHeadlineArticles, validateTicker } = require("./lib/finnhubData");

app.get("/onboarding", (req, res) => {
  res.render("onboarding");
});

app.get("/api/validate-ticker", async (req, res) => {
  const symbol = (req.query.symbol || "").toString().trim().toUpperCase();
  if (!symbol) return res.json({ valid: false });
  try {
    const result = await validateTicker(symbol);
    res.json(result);
  } catch {
    res.json({ valid: false });
  }
});

app.get("/", async (req, res) => {
  try {
    const latestBrief = await AIBrief.findOne().sort({ generatedAt: -1 });
    res.render("index", { latestBrief });
  } catch (err) {
    console.error(err);
    res.render("index", { latestBrief: null });
  }
});

app.get("/api/prices", async (req, res) => {
  try {
    const prices = await getWatchlistQuotesEnriched();
    res.json(prices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

app.get("/api/market-status", async (req, res) => {
  try {
    const status = await getMarketStatusUS();
    res.json(status);
  } catch (err) {
    console.error(err);
    res.status(500).json({ label: "Unavailable", session: null, holiday: null, isRegularOpen: false });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const { feed, articles } = await resolveHeadlineArticles();
    const list = Array.isArray(articles) ? articles : [];
    const top = list.slice(0, 25);

    if (top.length === 0) {
      return res.json({ feed, items: [] });
    }

    const groq = getGroq();
    if (!groq) {
      return res.status(503).json({ error: "GROQ_API_KEY is not configured.", feed, items: [] });
    }

    const headlineList = top.map((a, i) => `${i + 1}. ${a.headline}`).join("\n");

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a financial sentiment analyst. For each headline below, return a JSON array with objects containing: "sentiment" (exactly one of: bullish, neutral, bearish), "score" (float from -1.0 to 1.0), and "reason" (one short sentence).

Return ONLY a valid JSON array with exactly ${top.length} objects. No markdown, no extra text.

Headlines:
${headlineList}`,
        },
      ],
    });

    const rawText = (completion.choices[0].message.content || "").trim();
    const jsonStr = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let sentiments;
    try {
      sentiments = JSON.parse(jsonStr);
    } catch (parseErr) {
      sentiments = top.map(() => ({ sentiment: "neutral", score: 0, reason: "" }));
    }

    const enriched = top.map((article, i) => ({
      headline: article.headline,
      source: article.source,
      datetime: article.datetime,
      url: article.url,
      sentiment: sentiments[i] ? sentiments[i].sentiment : "neutral",
      score: sentiments[i] ? sentiments[i].score : 0,
      reason: sentiments[i] ? sentiments[i].reason : "",
    }));

    res.json({ feed, items: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`First Watch running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
