import { FIXTURES_DIR, setupBrowser } from "../__test__/test-helper.js";
import { describe, expect, test } from "bun:test";

import { chromium } from "playwright";
import { takeErrorScreenshot } from "./browser.js";

describe("takeErrorScreenshot", () => {
  const { getPage } = setupBrowser();

  test("captures screenshot and returns path", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);

    // When
    const result = await takeErrorScreenshot(page, "test-screenshot");

    // Then
    expect(result).toMatch(/error-test-screenshot-\d+\.png$/);
  }, 30_000);

  test("returns undefined when screenshot fails", async () => {
    // Given: a closed page that will fail to screenshot
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.close();

    // When
    const result = await takeErrorScreenshot(page, "closed-page");

    // Then
    expect(result).toBeUndefined();

    await context.close();
    await browser.close();
  }, 30_000);
});
