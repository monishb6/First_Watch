const { test, expect } = require("@playwright/test");

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("fw_onboarded", "1"));
  });

  test("loads with wordmark and layout", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/First Watch/i);
    await expect(page.locator(".wordmark")).toBeVisible();
    await expect(page.locator(".col-left")).toBeVisible();
    await expect(page.locator(".col-right")).toBeVisible();
  });

  test("nav links present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('.header-nav a[href="/watchlist"]')).toBeVisible();
    await expect(page.locator('.header-nav a[href="/ai/history"]')).toBeVisible();
  });

  test("market status element renders", async ({ page }) => {
    await page.goto("/");
    // element exists in DOM even before fetch resolves
    await expect(page.locator("#market-status")).toBeAttached();
  });

  test("price table loads (empty watchlist shows add link)", async ({ page }) => {
    await page.goto("/");
    const priceTable = page.locator("#price-table");
    await expect(priceTable).toBeVisible();
    // wait for JS fetch to resolve (loading msg clears)
    await page.waitForFunction(() => {
      const el = document.getElementById("price-table");
      return el && !el.textContent.includes("Loading");
    }, { timeout: 10000 });
    // empty DB → shows empty-msg with /watchlist link
    await expect(priceTable.locator('a[href="/watchlist"]')).toBeVisible();
  });

  test("news section renders container", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#news-list")).toBeVisible();
    // without GROQ_API_KEY the fetch returns 503; the JS shows an error message
    // either way the container is visible and not empty after fetch settles
    await page.waitForFunction(() => {
      const el = document.getElementById("news-list");
      return el && el.textContent.trim().length > 0 && !el.textContent.includes("Loading");
    }, { timeout: 10000 });
  });

  test("ask form is present and interactive", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("#ask-input");
    const submit = page.locator(".qa-submit");
    await expect(input).toBeVisible();
    await expect(submit).toBeVisible();
    await input.fill("Is the market bullish today?");
    await expect(input).toHaveValue("Is the market bullish today?");
  });

  test("col-left bottom >= col-right bottom (columns aligned)", async ({ page }) => {
    await page.goto("/");
    const leftBottom = await page.locator(".col-left").evaluate((el) => el.getBoundingClientRect().bottom);
    const rightBottom = await page.locator(".col-right").evaluate((el) => el.getBoundingClientRect().bottom);
    expect(Math.abs(leftBottom - rightBottom)).toBeLessThanOrEqual(2);
  });

  test("market brief shows 'No brief' or paragraph text", async ({ page }) => {
    await page.goto("/");
    const brief = page.locator(".brief-card-text");
    await expect(brief).toBeVisible();
    const text = await brief.innerText();
    expect(text.trim().length).toBeGreaterThan(0);
  });

  test("regenerate button present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".brief-regen")).toBeVisible();
  });
});

test.describe("Watchlist page", () => {
  test("loads and has add form", async ({ page }) => {
    await page.goto("/watchlist");
    await expect(page.locator(".add-form")).toBeVisible();
  });

  test("add and display a ticker", async ({ page }) => {
    await page.goto("/watchlist");
    await page.locator('.add-form input[type="text"]').fill("AAPL");
    await page.locator('.add-form button[type="submit"]').click();
    await expect(page.locator(".ticker-symbol", { hasText: "AAPL" })).toBeVisible();
  });

  test("remove a ticker", async ({ page }) => {
    await page.goto("/watchlist");
    // ensure AAPL exists first
    const existing = page.locator(".ticker-symbol", { hasText: "AAPL" });
    if (!(await existing.isVisible())) {
      await page.locator('.add-form input[type="text"]').fill("AAPL");
      await page.locator('.add-form button[type="submit"]').click();
      await expect(existing).toBeVisible();
    }
    // remove AAPL specifically (not just first button)
    await page.locator(".ticker-row", { hasText: "AAPL" }).locator(".remove-btn").click();
    await expect(page.locator(".ticker-symbol", { hasText: "AAPL" })).toHaveCount(0);
  });
});

test.describe("AI History page", () => {
  test("loads history page", async ({ page }) => {
    await page.goto("/ai/history");
    await expect(page.locator("body")).toBeVisible();
    // empty DB → no cards, but page renders
    const cards = page.locator(".brief-history-card");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
