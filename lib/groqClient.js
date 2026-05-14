const Groq = require("groq-sdk");

let cached;

/**
 * Returns a Groq SDK client, or null if GROQ_API_KEY is unset (server can still boot).
 */
function getGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key || !String(key).trim()) return null;
  if (!cached) cached = new Groq({ apiKey: key });
  return cached;
}

module.exports = { getGroq };
