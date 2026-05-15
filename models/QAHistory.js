const mongoose = require("mongoose");

const qaHistorySchema = new mongoose.Schema({
  username: { type: String, required: true, lowercase: true, trim: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  askedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("QAHistory", qaHistorySchema);
