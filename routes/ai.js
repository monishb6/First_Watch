const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const { getGroq } = require("../lib/groqClient");
const Ticker = require("../models/Ticker");
const AIBrief = require("../models/AIBrief");
const QAHistory = require("../models/QAHistory");

router.post("/generate", async (req, res) => {
  try {
    const groq = getGroq();
    if (!groq) {
      return res.status(503).send("GROQ_API_KEY is not configured.");
    }
    const tickers = await Ticker.find().sort({ addedAt: 1 });

    const prices = await Promise.all(
      tickers.map(async (ticker) => {
        const url = `https://finnhub.io/api/v1/quote?symbol=${ticker.symbol}&token=${process.env.FINNHUB_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        return {
          symbol: ticker.symbol,
          price: data.c,
          percentChange: data.dp,
        };
      })
    );

    const newsUrl = `https://finnhub.io/api/v1/news?category=general&token=${process.env.FINNHUB_API_KEY}`;
    const newsResponse = await fetch(newsUrl);
    const articles = await newsResponse.json();
    const list = Array.isArray(articles) ? articles : [];
    const top10 = list.slice(0, 10);

    const priceContext = prices
      .map((p) => `${p.symbol}: $${p.price} (${p.percentChange >= 0 ? "+" : ""}${p.percentChange}%)`)
      .join(", ");

    const headlineContext = top10.map((a, i) => `${i + 1}. ${a.headline}`).join("\n");

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

Current prices: ${priceContext || "No tickers saved."}

Top headlines:
${headlineContext}`,
        },
      ],
    });

    const rawContent = completion.choices[0].message.content;
    const content = (rawContent || "").trim() || "Brief unavailable — the model returned an empty response.";
    const brief = new AIBrief({ content });
    await brief.save();

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

router.post("/ask", async (req, res) => {
  try {
    const groq = getGroq();
    if (!groq) {
      return res.status(503).json({ answer: "GROQ_API_KEY is not configured." });
    }

    const question = req.body.question;
    if (!question || !question.trim()) {
      return res.json({ answer: "Please enter a question." });
    }

    const newsUrl = `https://finnhub.io/api/v1/news?category=general&token=${process.env.FINNHUB_API_KEY}`;
    const newsResponse = await fetch(newsUrl);
    const articles = await newsResponse.json();
    const list = Array.isArray(articles) ? articles : [];
    const top10 = list.slice(0, 10);

    if (top10.length === 0) {
      return res.json({
        answer: "No market headlines are available right now, so I cannot answer from the news feed.",
      });
    }

    const headlineContext = top10.map((a, i) => `${i + 1}. ${a.headline}`).join("\n");

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `You are a financial assistant. Answer the question using ONLY the headlines provided. If the headlines do not contain enough information to answer, say so explicitly. Keep your answer to 2-3 sentences maximum.

Current headlines:
${headlineContext}

Question: ${question}`,
        },
      ],
    });

    const answer =
      (completion.choices[0].message.content || "").trim() ||
      "I could not generate an answer. Please try again.";

    const qa = new QAHistory({ question, answer });
    await qa.save();

    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ answer: "Error generating answer. Please try again." });
  }
});

router.get("/history", async (req, res) => {
  try {
    const briefs = await AIBrief.find().sort({ generatedAt: -1 });
    res.render("history", { briefs });
  } catch (err) {
    console.error(err);
    res.render("history", { briefs: [] });
  }
});

module.exports = router;
