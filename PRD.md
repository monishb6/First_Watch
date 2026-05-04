---
type: project
status: shipped
github: https://github.com/monishb6/First_Watch
language: JavaScript (Node.js, Express, EJS)
tags: [fintech, ai, node, express, mongodb, websockets, finnhub, claude-api]
related:
  - "[[career_targets]]"
  - "[[Projects/pocketprism]]"
---

# First Watch

**Real-time financial news dashboard with AI-powered sentiment scoring, live price tracking, and grounded market Q&A.**

The name comes from the nautical term for the first shift of watch — monitoring the market before anyone else catches on.

---

## What It Does

Users land on a two-column dashboard:

- **Market news feed** — live headlines from Finnhub, each with an AI-generated Bullish / Neutral / Bearish sentiment badge and confidence score
- **Price table** — saved ticker watchlist with live prices, auto-refreshing every 60 seconds
- **Ask First Watch** — type any market question, Claude answers grounded in current headlines (no hallucination — if the headlines don't cover it, it says so)
- **AI Market Brief** — on-demand 3-paragraph market brief generated from current prices + top headlines
- **History page** — all past briefs saved to MongoDB, browsable

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Templating | EJS |
| Database | MongoDB via Mongoose |
| AI | Anthropic Claude API |
| Market data | Finnhub API (REST, free tier) |
| Styling | CSS + Google Fonts (Inter) |
| Deployment | Render.com |

---

## Data Models

| Model | Fields |
|---|---|
| `Ticker` | `symbol`, `addedAt` |
| `AIBrief` | `content`, `generatedAt` |
| `QAHistory` | `question`, `answer`, `askedAt` |

---

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Dashboard — news + prices + Q&A + brief |
| GET | `/api/prices` | Finnhub quotes for all saved tickers → JSON |
| GET | `/api/news` | Finnhub headlines → Claude sentiment → enriched JSON |
| GET | `/watchlist` | Manage saved tickers |
| POST | `/watchlist` | Add ticker to MongoDB |
| POST | `/watchlist/remove` | Remove ticker |
| POST | `/ai/generate` | Generate + save market brief |
| POST | `/ai/ask` | Grounded Q&A — returns JSON (no page reload) |
| GET | `/ai/history` | All saved briefs |

---

## Three Claude API Calls

### 1. Sentiment scoring — `GET /api/news`
Batch all headlines in one call. Returns JSON array with `sentiment` (bullish/neutral/bearish), `score` (−1.0 to 1.0), `reason` per headline. Merged with full Finnhub headline objects before returning to client.

### 2. Market brief — `POST /ai/generate`
Fed current prices + top 10 headlines with sentiment. Returns 3-paragraph brief: what's moving + why, overall sentiment direction, one thing to watch in 24–48h. Saved to MongoDB.

### 3. Grounded Q&A — `POST /ai/ask`
User question + current headlines. Claude answers using only the provided headlines — if coverage is insufficient, says so explicitly. Max 2–3 sentences. Saved to `QAHistory`.

---

## Finnhub API

- Stock quote: `GET /quote?symbol=AAPL&token=KEY` → `c` (price), `dp` (% change)
- Market news: `GET /news?category=general&token=KEY` → headline, source, datetime (Unix), url
- Commodities: `GC=F` (gold), `CL=F` (oil), `SI=F` (silver)
- Free tier: 60 calls/min

---

## Deployment

Render.com — `npm install` build, `node server.js` start, env vars set in Render dashboard.

Live at: `[render URL]`

---

## Status

Shipped ==Spring 2026==. Public repo. Demonstrates: real external API integration, three distinct Claude API patterns (batch classification, generation, grounded retrieval), MongoDB persistence, Express routing.

**GitHub:** https://github.com/monishb6/First_Watch
