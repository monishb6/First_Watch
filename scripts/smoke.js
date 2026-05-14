/**
 * Spins up in-memory MongoDB, starts the app in a child process, and hits key HTTP routes.
 * Run: npm run test:smoke
 *
 * Optional: export GROQ_API_KEY and FINNHUB_API_KEY for full /api/news and Finnhub checks.
 */
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      })
      .on("error", reject);
  });
}

function httpPostJson(url, json) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(json);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log("Starting MongoMemoryServer (first run may download MongoDB binaries)…");
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  const port = 33331 + Math.floor(Math.random() * 500);
  const cwd = path.join(__dirname, "..");
  const env = { ...process.env, MONGODB_URI: uri, PORT: String(port) };
  if (!env.GROQ_API_KEY || !String(env.GROQ_API_KEY).trim()) {
    delete env.GROQ_API_KEY;
  }

  const child = spawn(process.execPath, ["server.js"], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  const collect = (d) => {
    logs += d.toString();
  };
  child.stderr.on("data", collect);
  child.stdout.on("data", collect);

  const base = `http://127.0.0.1:${port}`;
  let homeOk = false;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await httpGet(`${base}/`);
      if (r.status === 200 && /First/.test(r.body)) {
        homeOk = true;
        console.log("PASS: GET / (200, dashboard HTML)");
        break;
      }
    } catch (_) {
      /* server not listening yet */
    }
    await sleep(500);
  }

  if (!homeOk) {
    console.error("FAIL: GET / did not succeed in time.");
    console.error(logs.slice(-4000));
    child.kill("SIGTERM");
    await sleep(400);
    await mongo.stop();
    process.exit(1);
  }

  const checks = [
    ["/watchlist", "GET /watchlist"],
    ["/ai/history", "GET /ai/history"],
    ["/api/prices", "GET /api/prices"],
  ];

  for (const [p, label] of checks) {
    const r = await httpGet(base + p);
    if (r.status === 200) {
      console.log(`PASS: ${label} (200)`);
    } else {
      console.error(`FAIL: ${label} — status ${r.status}`);
      child.kill("SIGTERM");
      await sleep(400);
      await mongo.stop();
      process.exit(1);
    }
  }

  const news = await httpGet(`${base}/api/news`);
  let newsAiOk = false;
  if (news.status === 503) {
    console.log("PASS: GET /api/news returns 503 without GROQ_API_KEY (expected)");
  } else if (news.status === 200) {
    try {
      const arr = JSON.parse(news.body);
      if (Array.isArray(arr) && arr.length > 0 && arr[0].sentiment) {
        console.log("PASS: GET /api/news (200, enriched headlines)");
        newsAiOk = true;
      } else {
        console.log(`NOTE: GET /api/news 200 but unexpected shape: ${news.body.slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`NOTE: GET /api/news 200 but not JSON array: ${news.body.slice(0, 200)}`);
    }
  } else {
    console.log(`NOTE: GET /api/news status ${news.status} — ${news.body.slice(0, 200)}`);
  }

  if (newsAiOk) {
    const ask = await httpPostJson(`${base}/ai/ask`, { question: "Is sentiment mostly bullish?" });
    if (ask.status === 200) {
      try {
        const j = JSON.parse(ask.body);
        if (j.answer && j.answer.length > 0) {
          console.log("PASS: POST /ai/ask (200, answer present)");
        } else {
          console.log(`NOTE: POST /ai/ask 200 but empty answer: ${ask.body}`);
        }
      } catch (_) {
        console.log(`NOTE: POST /ai/ask non-JSON: ${ask.body.slice(0, 200)}`);
      }
    } else {
      console.log(`NOTE: POST /ai/ask ${ask.status} — ${ask.body.slice(0, 200)}`);
    }
  } else {
    console.log("SKIP: POST /ai/ask (requires working GET /api/news + Groq)");
  }

  child.kill("SIGTERM");
  await sleep(500);
  await mongo.stop();
  console.log("Smoke tests finished successfully.");
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
