/**
 * Test server for Playwright: spins up in-memory MongoDB then starts the app.
 * Called by playwright.config.js webServer.
 */
const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.PORT = process.env.PORT || "3999";

  require("../server");

  const stop = async () => {
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
})();
