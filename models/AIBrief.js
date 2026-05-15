const mongoose = require("mongoose");

const aiBriefSchema = new mongoose.Schema({
  username: { type: String, required: true, lowercase: true, trim: true },
  content: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AIBrief", aiBriefSchema);
