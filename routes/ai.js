const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const Anthropic = require("@anthropic-ai/sdk");
const Ticker = require("../models/Ticker");
const AIBrief = require("../models/AIBrief");
const QAHistory = require("../models/QAHistory");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /ai/generate — generate a market brief
router.post("/generate", async (req, res) => {
  // TODO: implement
  // 1. Fetch all saved tickers from MongoDB
  // 2. Fetch prices from Finnhub for each ticker
  // 3. Fetch top 10 headlines from Finnhub
  // 4. Build the market brief prompt (see CLAUDE.md for exact prompt)
  // 5. Call Claude API
  // 6. Save returned brief as new AIBrief document in MongoDB
  // 7. Redirect to /
  res.redirect("/");
});

// POST /ai/ask — answer a user question grounded in current headlines
router.post("/ask", async (req, res) => {
  // TODO: implement
  // 1. Get question from req.body.question
  // 2. Fetch top 10 headlines from Finnhub
  // 3. Build the Q&A prompt (see CLAUDE.md for exact prompt)
  // 4. Call Claude API
  // 5. Save question + answer to QAHistory in MongoDB
  // 6. Return JSON: { answer: "..." }
  res.json({ answer: "" });
});

// GET /ai/history — show all saved briefs
router.get("/history", async (req, res) => {
  // TODO: implement
  // 1. Fetch all AIBrief documents from MongoDB (sorted newest first)
  // 2. Render history.ejs passing the briefs array
  res.render("history", { briefs: [] });
});

module.exports = router;
