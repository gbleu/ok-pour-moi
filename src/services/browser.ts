import { join } from "node:path";
import { chromium, type Page } from "playwright";
import {
  BROWSER_DATA_DIR,
  config,
  ensureBrowserDir,
  ensureLogsDir,
  LOGS_DIR,
} from "../config.js";

export type BrowserSession = {
  page: Page;
  close: () => Promise<void>;
};

export async function createOutlookSession(): Promise<BrowserSession> {
  ensureBrowserDir();

  const context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: config.browser.headless,
    viewport: { width: 1280, height: 900 },
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto("https://outlook.office365.com/mail/");
  await waitForLogin(page);
  await page
    .locator("#loadingScreen")
    .waitFor({ state: "hidden", timeout: 30000 });

  return {
    page,
    close: () => context.close(),
  };
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

export async function takeErrorScreenshot(
  page: Page,
  label: string,
): Promise<string | null> {
  try {
    ensureLogsDir();

    const filename = `error-${label}-${Date.now()}.png`;
    const path = join(LOGS_DIR, filename);
    await page.screenshot({ path, fullPage: true });
    console.log(`  [screenshot] ${path}`);
    return path;
  } catch {
    console.log(`  [screenshot] failed to capture`);
    return null;
  }
}
