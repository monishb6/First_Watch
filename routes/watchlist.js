const express = require("express");
const router = express.Router();
const Ticker = require("../models/Ticker");

// GET /watchlist — show form + saved tickers
router.get("/", async (req, res) => {
  // TODO: implement
  // 1. Fetch all tickers from MongoDB (sorted by addedAt)
  // 2. Render watchlist.ejs passing the tickers array
  res.render("watchlist", { tickers: [] });
});

// POST /watchlist — add a ticker
router.post("/", async (req, res) => {
  // TODO: implement
  // 1. Get symbol from req.body.symbol
  // 2. Validate: not empty, not already saved
  // 3. Save new Ticker to MongoDB
  // 4. Redirect to /watchlist
  res.redirect("/watchlist");
});

// POST /watchlist/remove — remove a ticker
router.post("/remove", async (req, res) => {
  // TODO: implement
  // 1. Get symbol from req.body.symbol
  // 2. Delete from MongoDB: Ticker.deleteOne({ symbol })
  // 3. Redirect to /watchlist
  res.redirect("/watchlist");
});

module.exports = router;
