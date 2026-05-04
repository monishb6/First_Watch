require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
const watchlistRouter = require("./routes/watchlist");
const aiRouter = require("./routes/ai");
app.use("/watchlist", watchlistRouter);
app.use("/ai", aiRouter);

// Models
const Ticker = require("./models/Ticker");
const AIBrief = require("./models/AIBrief");

// TODO: GET / — render dashboard
// Fetch saved tickers from MongoDB, pass to index.ejs
// The view will use fetch() on the client side to call /api/prices and /api/news
app.get("/", async (req, res) => {
  // TODO: implement
  res.render("index");
});

// TODO: GET /api/prices
// Fetch prices from Finnhub for all saved tickers
// Return JSON: [{ symbol, price, change, percentChange }]
app.get("/api/prices", async (req, res) => {
  // TODO: implement
  // 1. Get all tickers from MongoDB
  // 2. For each ticker, fetch from Finnhub /quote endpoint
  // 3. Return array of price objects
  res.json([]);
});

// TODO: GET /api/news
// Fetch headlines from Finnhub, send to Claude for sentiment scoring, return enriched JSON
// Return JSON: [{ headline, source, datetime, url, sentiment, score, reason }]
app.get("/api/news", async (req, res) => {
  // TODO: implement
  // 1. Fetch from Finnhub /news?category=general
  // 2. Take top 10 headlines
  // 3. Send all to Claude with sentiment prompt (see CLAUDE.md for exact prompt)
  // 4. Parse Claude's JSON array response
  // 5. Merge sentiment data with headline objects
  // 6. Return merged array
  res.json([]);
});

// Connect to MongoDB then start server
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
