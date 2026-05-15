const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3999",
    headless: true,
  },
  webServer: {
    command: "node scripts/pw-server.js",
    port: 3999,
    reuseExistingServer: false,
    timeout: 60000,
    env: { PORT: "3999" },
  },
});
