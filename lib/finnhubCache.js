/** Simple in-memory TTL cache to reduce Finnhub calls (free tier rate limits). */
const store = new Map();

function get(key) {
  const row = store.get(key);
  if (!row) return null;
  if (Date.now() > row.exp) {
    store.delete(key);
    return null;
  }
  return row.val;
}

function set(key, val, ttlMs) {
  store.set(key, { val, exp: Date.now() + ttlMs });
}

module.exports = { get, set };
