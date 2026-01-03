import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll } from "bun:test";
import { join } from "node:path";

export const SCENARIOS_DIR = join(import.meta.dir, "fixtures", "scenarios");

let sharedBrowser: Browser | undefined;
let testPdfBytes: ArrayBuffer | undefined;

async function getSharedBrowser(): Promise<Browser> {
  sharedBrowser ??= await chromium.launch({ headless: true });
  return sharedBrowser;
}

async function getTestPdfBytes(): Promise<ArrayBuffer> {
  testPdfBytes ??= await Bun.file(join(import.meta.dir, "../fixtures/sample.pdf")).arrayBuffer();
  return testPdfBytes;
}

export function setupBrowser(): { getPage: () => Page } {
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    const browser = await getSharedBrowser();
    context = await browser.newContext();
    page = await context.newPage();
  }, 30_000);

  afterAll(async () => {
    await context?.close();
  }, 15_000);

  return {
    getPage: () => page,
  };
}

export function setupBrowserWithPdfRoute(): { getPage: () => Page } {
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    const browser = await getSharedBrowser();
    const pdfBytes = await getTestPdfBytes();

    context = await browser.newContext();
    page = await context.newPage();

    await page.route("**/mock-downloads/**", async (route) => {
      await route.fulfill({
        body: Buffer.from(pdfBytes),
        contentType: "application/pdf",
        status: 200,
      });
    });
  }, 30_000);

  afterAll(async () => {
    await context?.close();
  }, 15_000);

  return {
    getPage: () => page,
  };
}
