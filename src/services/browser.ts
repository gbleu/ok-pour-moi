import { join } from "node:path";
import { type BrowserContext, chromium, type Page } from "playwright";
import {
  BROWSER_DATA_DIR,
  config,
  ensureBrowserDir,
  ensureLogsDir,
  LOGS_DIR,
} from "../config.js";

let context: BrowserContext | null = null;
let page: Page | null = null;

export async function getOutlookPage(): Promise<Page> {
  if (page && !page.isClosed()) return page;

  ensureBrowserDir();

  context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: config.browser.headless,
    viewport: { width: 1280, height: 900 },
  });

  page = context.pages()[0] ?? (await context.newPage());

  await page.goto("https://outlook.office365.com/mail/");
  await waitForLogin(page);
  await page
    .locator("#loadingScreen")
    .waitFor({ state: "hidden", timeout: 30000 });

  return page;
}

async function waitForLogin(page: Page): Promise<void> {
  const isLoggedIn = async () => {
    const url = page.url();
    return url.includes("outlook.office365.com/mail") && !url.includes("login");
  };

  if (await isLoggedIn()) return;

  console.log("\nPlease log in to Outlook in the browser window...");
  await page.waitForURL("**/mail/**", { timeout: 300000 });
  console.log("Logged in!\n");
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
    page = null;
  }
}

export async function takeErrorScreenshot(
  p: Page,
  label: string,
): Promise<string | null> {
  try {
    ensureLogsDir();

    const filename = `error-${label}-${Date.now()}.png`;
    const path = join(LOGS_DIR, filename);
    await p.screenshot({ path, fullPage: true });
    console.log(`  [screenshot] ${path}`);
    return path;
  } catch {
    console.log(`  [screenshot] failed to capture`);
    return null;
  }
}
