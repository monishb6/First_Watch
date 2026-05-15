const mongoose = require("mongoose");

const tickerSchema = new mongoose.Schema({
  username: { type: String, required: true, lowercase: true, trim: true },
  symbol: { type: String, required: true, uppercase: true, trim: true },
  addedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Ticker", tickerSchema);
