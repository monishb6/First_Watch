const mongoose = require("mongoose");

const aiBriefSchema = new mongoose.Schema({
  content: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AIBrief", aiBriefSchema);
