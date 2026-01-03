import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll } from "bun:test";
import { join } from "node:path";

export const FIXTURES_DIR = join(import.meta.dir, "fixtures");

let sharedBrowser: Browser | undefined;
let testPdfBytes: ArrayBuffer | undefined;

async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({ headless: true });
  }
  return sharedBrowser;
}

async function getTestPdfBytes(): Promise<ArrayBuffer> {
  testPdfBytes ??= await Bun.file(join(FIXTURES_DIR, "sample.pdf")).arrayBuffer();
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
