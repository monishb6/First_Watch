const express = require("express");
const router = express.Router();
const { getGroq } = require("../lib/groqClient");
const { resolveHeadlineArticles } = require("../lib/finnhubData");
const { generateBrief } = require("../lib/generateBrief");
const AIBrief = require("../models/AIBrief");
const QAHistory = require("../models/QAHistory");

router.post("/generate", async (req, res) => {
  try {
    const groq = getGroq();
    if (!groq) return res.status(503).send("GROQ_API_KEY is not configured.");
    await generateBrief(req.session.username);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

router.post("/ask", async (req, res) => {
  try {
    const username = req.session.username;
    const groq = getGroq();
    if (!groq) return res.status(503).json({ answer: "GROQ_API_KEY is not configured." });

    const question = req.body.question;
    if (!question || !question.trim()) return res.json({ answer: "Please enter a question." });

    const { feed, articles } = await resolveHeadlineArticles(username);
    const list = Array.isArray(articles) ? articles : [];
    const top = list.slice(0, 12);

    if (top.length === 0) {
      return res.json({ answer: "No market headlines are available right now, so I cannot answer from the news feed." });
    }

    const headlineContext = top.map((a, i) => `${i + 1}. ${a.headline}`).join("\n");
    const feedNote =
      feed === "watchlist"
        ? "These headlines are from company news for the user's watchlist symbols."
        : "These headlines are from general market news.";

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `You are a financial assistant. Answer the question using ONLY the headlines provided. If the headlines do not contain enough information to answer, say so explicitly. Keep your answer to 2-3 sentences maximum.

${feedNote}

Current headlines:
${headlineContext}

Question: ${question}`,
        },
      ],
    });

    const answer = (completion.choices[0].message.content || "").trim() || "I could not generate an answer. Please try again.";
    await new QAHistory({ username, question, answer }).save();

    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ answer: "Error generating answer. Please try again." });
  }
});

router.get("/history", async (req, res) => {
  try {
    const username = req.session.username;
    const briefs = await AIBrief.find({ username }).sort({ generatedAt: -1 });
    res.render("history", { briefs, username });
  } catch (err) {
    console.error(err);
    res.render("history", { briefs: [], username: req.session.username });
  }
});

module.exports = router;
