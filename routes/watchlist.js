const express = require("express");
const router = express.Router();
const Ticker = require("../models/Ticker");

router.get("/", async (req, res) => {
  try {
    const username = req.session.username;
    const tickers = await Ticker.find({ username }).sort({ addedAt: 1 });
    res.render("watchlist", { tickers, username });
  } catch (err) {
    console.error(err);
    res.render("watchlist", { tickers: [], username: req.session.username });
  }
});

router.post("/", async (req, res) => {
  try {
    const username = req.session.username;
    const raw = (req.body.symbol || "").toString();
    const symbol = raw.trim().toUpperCase();
    if (!symbol) return res.redirect("/watchlist");
    const existing = await Ticker.findOne({ username, symbol });
    if (!existing) {
      await new Ticker({ username, symbol }).save();
    }
    res.redirect("/watchlist");
  } catch (err) {
    console.error(err);
    res.redirect("/watchlist");
  }
});

router.post("/remove", async (req, res) => {
  try {
    const username = req.session.username;
    const raw = (req.body.symbol || "").toString();
    const symbol = raw.trim().toUpperCase();
    if (!symbol) return res.redirect("/watchlist");
    await Ticker.deleteOne({ username, symbol });
    res.redirect("/watchlist");
  } catch (err) {
    console.error(err);
    res.redirect("/watchlist");
  }
});

module.exports = router;
