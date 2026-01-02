import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll } from "bun:test";
import { join } from "node:path";

export const SCENARIOS_DIR = join(import.meta.dir, "fixtures", "scenarios");

export function setupBrowser(): { getPage: () => Page } {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
  }, 30_000);

  afterAll(async () => {
    await context.close();
    await browser.close();
  }, 15_000);

  return {
    getPage: () => page,
  };
}

export function setupBrowserWithPdfRoute(): { getPage: () => Page } {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    const testPdfBytes = await Bun.file(
      join(import.meta.dir, "../fixtures/sample.pdf"),
    ).arrayBuffer();

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();

    await page.route("**/mock-downloads/**", async (route) => {
      await route.fulfill({
        body: Buffer.from(testPdfBytes),
        contentType: "application/pdf",
        status: 200,
      });
    });
  }, 30_000);

  afterAll(async () => {
    await context.close();
    await browser.close();
  }, 15_000);

  return {
    getPage: () => page,
  };
}
