# First Watch — Project Context

## What This Is

**First Watch** is a financial news dashboard built for the CMSC335 (Web Development) final exam project at UMD, Spring 2026. It is designed to also serve as a portfolio piece for SWE/AI-ML internship applications.

The name comes from the nautical term for the first shift of watch — you're monitoring the market before anyone else catches on.

## What the App Does

Users land on a dashboard showing:
- Live market news cards — each with an AI-generated **Bullish / Neutral / Bearish sentiment badge**
- A price table for their saved ticker watchlist (auto-refreshes every 60 seconds)
- An **"Ask First Watch"** Q&A box — type any market question, Claude answers grounded in current headlines
- The most recent AI-generated market brief + a button to generate a new one

Users can manage their ticker watchlist on a separate page and browse past AI briefs in a history page.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Templating | EJS |
| Database | MongoDB via Mongoose |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Market Data | Finnhub API (REST, free tier) |
| Styling | CSS + Google Fonts (Inter) |
| Deployment | Render.com (same process as Project 7) |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
PORT=3000
MONGODB_URI=          ← MongoDB Atlas connection string (create a NEW database user — don't reuse Project 6)
FINNHUB_API_KEY=      ← https://finnhub.io — free account, instant key
ANTHROPIC_API_KEY=    ← https://console.anthropic.com
```

---

## File Structure

```
First_Watch/
├── CLAUDE.md
├── README.md
├── Final Exam Project.pdf
├── package.json
├── server.js
├── .env
├── .env.example
├── .gitignore
├── models/
│   ├── Ticker.js        ← saved watchlist symbols
│   ├── AIBrief.js       ← saved AI-generated market briefs
│   └── QAHistory.js     ← saved Q&A exchanges
├── routes/
│   ├── watchlist.js     ← express.Router() for /watchlist
│   └── ai.js            ← express.Router() for /ai
├── views/
│   ├── index.ejs        ← main dashboard
│   ├── watchlist.ejs    ← manage tickers
│   └── history.ejs      ← past AI briefs
└── public/
    └── style.css
```

---

## MongoDB Schemas

**Ticker.js**
```js
{ symbol: String, addedAt: Date }
```

**AIBrief.js**
```js
{ content: String, generatedAt: Date }
```

**QAHistory.js**
```js
{ question: String, answer: String, askedAt: Date }
```

---

## Routes

| Method | Path | File | What it does |
|---|---|---|---|
| GET | `/` | server.js | Renders dashboard (index.ejs) |
| GET | `/api/prices` | server.js | Fetches prices from Finnhub for all saved tickers, returns JSON |
| GET | `/api/news` | server.js | Fetches headlines from Finnhub → sends to Claude for sentiment → returns enriched JSON |
| GET | `/watchlist` | routes/watchlist.js | Shows watchlist form + saved tickers |
| POST | `/watchlist` | routes/watchlist.js | Adds a ticker symbol to MongoDB |
| POST | `/watchlist/remove` | routes/watchlist.js | Removes a ticker from MongoDB |
| POST | `/ai/generate` | routes/ai.js | Fetches news + prices → Claude brief → saves to MongoDB → redirects to / |
| POST | `/ai/ask` | routes/ai.js | Takes user question → fetches headlines → Claude answers → saves to QAHistory → returns JSON |
| GET | `/ai/history` | routes/ai.js | Renders history.ejs with all saved briefs |

`/watchlist` and `/ai` must use `express.Router()` — this satisfies the course router requirement.

---

## The Three Claude API Calls

### 1. Sentiment Scoring — called inside `GET /api/news`

Fetch headlines from Finnhub first, then send all to Claude in one call.

```
You are a financial analyst. Analyze each headline below and return a JSON array.
Each object must have exactly these fields:
- "headline": the original headline text
- "sentiment": one of "bullish", "neutral", or "bearish"
- "score": a float from -1.0 (most bearish) to 1.0 (most bullish)
- "reason": one concise sentence explaining your rating

Headlines:
- Fed signals rate hold through summer
- Oil drops on inventory build
- Apple reports record quarterly revenue
...

Return ONLY valid JSON. No markdown, no explanation, no extra text.
```

Parse the JSON array, merge with the full headline objects (adding url, source, datetime), return to the client. Each news card renders the sentiment badge from this data.

### 2. Market Brief — called on `POST /ai/generate`

```
You are a financial analyst writing a daily market brief.

CURRENT PRICES:
AAPL: $213.42 (+1.2%)
GC=F: $2,341.10 (-0.4%)
[... all watchlist tickers]

RECENT HEADLINES WITH SENTIMENT:
- "Fed signals rate hold through summer" → bearish (-0.6)
- "Oil drops on inventory build" → bearish (-0.4)
[... top 10 headlines]

Write a concise 3-paragraph market brief:
1. What is moving markets today and why
2. What the overall sentiment suggests about near-term direction
3. One specific thing to watch in the next 24-48 hours

Write in clear, professional language. Do not use bullet points.
```

Save the returned string to MongoDB as an AIBrief document.

### 3. Grounded Q&A — called on `POST /ai/ask`

```
You are a financial analyst assistant. A user has asked you a question about current market conditions.

Answer using ONLY the information in the headlines provided below as your source.
If the headlines do not contain enough information to answer the question, say so clearly.
Keep your answer to 2-3 sentences maximum.

CURRENT HEADLINES:
- "Fed signals rate hold through summer" (Reuters, 2h ago)
- "Oil drops on inventory build" (Bloomberg, 3h ago)
[... top 10 headlines]

USER QUESTION: [user's question here]
```

Save the question + answer to MongoDB as a QAHistory document. Return the answer as JSON to the client so it can be rendered without a page reload.

---

## Dashboard Layout (index.ejs)

```
┌─────────────────────────────────────────────────────────┐
│  FIRST WATCH                          [Watchlist] [History] │
├──────────────────────────┬──────────────────────────────┤
│                          │  PRICES                      │
│  MARKET NEWS             │  AAPL  $213.42  +1.2% 🟢    │
│                          │  GC=F  $2341.10 -0.4% 🔴    │
│  [BEARISH] Headline...   │  ...                         │
│  Reuters · 2h ago        ├──────────────────────────────┤
│                          │  ASK FIRST WATCH             │
│  [BULLISH] Headline...   │  [text input................] │
│  Bloomberg · 3h ago      │  [Ask]                       │
│                          │  Answer appears here...      │
│  [NEUTRAL] Headline...   ├──────────────────────────────┤
│  FT · 5h ago             │  AI MARKET BRIEF             │
│                          │  Brief text here...          │
│  ...                     │  [Generate New Brief]        │
└──────────────────────────┴──────────────────────────────┘
```

---

## Finnhub API Reference

Base URL: `https://finnhub.io/api/v1`

- **Stock quote:** `GET /quote?symbol=AAPL&token=YOUR_KEY`
  - Returns: `c` (current price), `dp` (% change), `d` (change)
- **Market news:** `GET /news?category=general&token=YOUR_KEY`
  - Returns array of: `headline`, `source`, `datetime`, `url`, `summary`
- **Symbol search:** `GET /search?q=Apple&token=YOUR_KEY` (optional, for ticker autocomplete)

For commodities use these symbols: `GC=F` (gold), `CL=F` (oil), `SI=F` (silver)

Free tier: 60 API calls/minute — more than enough.

---

## CSS Requirements (must satisfy course spec)

The CSS file must include:
- `background-color` property ✓
- `color` property ✓
- `font-size` property ✓
- Google Font (Inter) via `@import` ✓

Sentiment badge colors:
- Bullish: green background (`#16a34a`), white text
- Neutral: gray background (`#6b7280`), white text
- Bearish: red background (`#dc2626`), white text

Price change colors:
- Positive: `#16a34a` (green)
- Negative: `#dc2626` (red)

---

## Build Order

Follow this sequence — each step is independently testable:

1. **Set up Express + MongoDB connection** in `server.js`. Test: server starts, connects to MongoDB, `/` returns something.
2. **Watchlist routes** — add/remove tickers, render `watchlist.ejs`. Test: form works, tickers saved to MongoDB.
3. **Finnhub prices** — `GET /api/prices` fetches quotes for all saved tickers. Test: returns JSON with prices.
4. **Finnhub news** — `GET /api/news` fetches headlines (no sentiment yet). Test: returns JSON array of headlines.
5. **Dashboard rendering** — `index.ejs` shows prices + news cards (without badges yet). Test: page renders with data.
6. **CSS layout** — two-column layout, Google Font, price table styled, news cards styled.
7. **Claude sentiment** — add Claude call inside `GET /api/news`. Each headline gets a badge. Test: news cards show Bullish/Neutral/Bearish.
8. **Claude brief** — `POST /ai/generate` works, brief saved to MongoDB, shown on dashboard.
9. **Claude Q&A** — `POST /ai/ask` works, answer appears on page without reload (use fetch on client side).
10. **History page** — `GET /ai/history` renders all saved briefs.
11. **Deploy to Render** — same process as Project 7. Add env vars in Render dashboard.

---

## Course Requirements Checklist

| Requirement | How it's met |
|---|---|
| Node.js + Express | Core stack |
| No PHP | Pure Node.js |
| `express.Router()` | `/watchlist` and `/ai` route files |
| Mongoose | All three models use Mongoose |
| Store & retrieve from MongoDB | Tickers + briefs + Q&A stored and displayed |
| At least one form | Add ticker form on `/watchlist`, Ask form on `/` |
| CSS: background-color, color, font-size | In style.css |
| CSS: Google Font | Inter via @import |
| External API with real data | Finnhub (news + prices from internet) |
| Deployed online | Render.com |
| Not a class project extension | New concept, not related to any previous project |
| README.md in root | Present, follows spec format |

---

## Deployment (Render)

Same process as Project 7:
1. Push to GitHub (make sure `.env` is in `.gitignore`)
2. Create new Web Service on Render, connect repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add all four env vars in Render's Environment tab
6. Deploy

---

## README.md Format (course requirement)

The README.md must follow this exact format for submission:

```
Submitted by: Monish Bansal (mbansal)
Group Members: Monish Bansal (mbansal)
App Description: First Watch is a financial news dashboard that uses AI to score market sentiment on live headlines and answer user questions grounded in current news.
YouTube Video Link: [TO BE ADDED BEFORE SUBMISSION]
APIs: Finnhub (https://finnhub.io), Anthropic Claude (https://anthropic.com)
Contact Email: [your UMD email]
Deployed App Link: [TO BE ADDED AFTER DEPLOYMENT]
AI Use: 1. Claude Code
```

---

## Notes for New Session

- Do NOT use `node-fetch` v3 with CommonJS `require()` — use v2 (`"node-fetch": "^2.6.9"`) or switch to ES modules. package.json already uses v2.
- Finnhub news endpoint returns `datetime` as a Unix timestamp — convert with `new Date(datetime * 1000)` for display.
- The Claude sentiment call returns a JSON array as a string — always wrap the parse in a try/catch in case Claude adds extra text.
- Keep the Q&A answer render on the client side with `fetch()` so the page doesn't reload — better UX and shows JS skills.
- Create a new MongoDB Atlas database user specifically for this project (course requirement).
