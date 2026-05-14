require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const fetch = require("node-fetch");
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

const Ticker = require("./models/Ticker");
const AIBrief = require("./models/AIBrief");

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
    const tickers = await Ticker.find().sort({ addedAt: 1 });
    const prices = await Promise.all(
      tickers.map(async (ticker) => {
        const url = `https://finnhub.io/api/v1/quote?symbol=${ticker.symbol}&token=${process.env.FINNHUB_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        return {
          symbol: ticker.symbol,
          price: data.c,
          change: data.d,
          percentChange: data.dp,
        };
      })
    );
    res.json(prices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${process.env.FINNHUB_API_KEY}`;
    const response = await fetch(url);
    const articles = await response.json();
    const list = Array.isArray(articles) ? articles : [];
    const top10 = list.slice(0, 10);

    if (top10.length === 0) {
      return res.json([]);
    }

    const groq = getGroq();
    if (!groq) {
      return res.status(503).json({ error: "GROQ_API_KEY is not configured." });
    }

    const headlineList = top10.map((a, i) => `${i + 1}. ${a.headline}`).join("\n");

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a financial sentiment analyst. For each headline below, return a JSON array with objects containing: "sentiment" (exactly one of: bullish, neutral, bearish), "score" (float from -1.0 to 1.0), and "reason" (one short sentence).

Return ONLY a valid JSON array with exactly ${top10.length} objects. No markdown, no extra text.

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
      sentiments = top10.map(() => ({ sentiment: "neutral", score: 0, reason: "" }));
    }

    const enriched = top10.map((article, i) => ({
      headline: article.headline,
      source: article.source,
      datetime: article.datetime,
      url: article.url,
      sentiment: sentiments[i] ? sentiments[i].sentiment : "neutral",
      score: sentiments[i] ? sentiments[i].score : 0,
      reason: sentiments[i] ? sentiments[i].reason : "",
    }));

    res.json(enriched);
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
