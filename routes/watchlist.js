const express = require("express");
const router = express.Router();
const Ticker = require("../models/Ticker");

router.get("/", async (req, res) => {
  try {
    const tickers = await Ticker.find().sort({ addedAt: 1 });
    res.render("watchlist", { tickers });
  } catch (err) {
    console.error(err);
    res.render("watchlist", { tickers: [] });
  }
});

router.post("/", async (req, res) => {
  try {
    const raw = (req.body.symbol || "").toString();
    const symbol = raw.trim().toUpperCase();
    if (!symbol) {
      return res.redirect("/watchlist");
    }
    const existing = await Ticker.findOne({ symbol });
    if (!existing) {
      const ticker = new Ticker({ symbol });
      await ticker.save();
    }
    res.redirect("/watchlist");
  } catch (err) {
    console.error(err);
    res.redirect("/watchlist");
  }
});

router.post("/remove", async (req, res) => {
  try {
    const raw = (req.body.symbol || "").toString();
    const symbol = raw.trim().toUpperCase();
    if (!symbol) {
      return res.redirect("/watchlist");
    }
    await Ticker.deleteOne({ symbol });
    res.redirect("/watchlist");
  } catch (err) {
    console.error(err);
    res.redirect("/watchlist");
  }
});

module.exports = router;
