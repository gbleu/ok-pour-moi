import { BROWSER_DATA_DIR, LOGS_DIR, config, ensureBrowserDir, ensureLogsDir } from "../config.js";
import { type Page, chromium } from "playwright";
import { join } from "node:path";

export interface BrowserSession {
  page: Page;
  close: () => Promise<void>;
}

export async function createOutlookSession(): Promise<BrowserSession> {
  ensureBrowserDir();

  const context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: config.browser.headless,
    viewport: { height: 900, width: 1280 },
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto("https://outlook.office365.com/mail/");
  await waitForLogin(page);
  await page.locator("#loadingScreen").waitFor({ state: "hidden", timeout: 30_000 });

  return {
    close: async () => context.close(),
    page,
  };
}

async function waitForLogin(page: Page): Promise<void> {
  const inbox = page.getByRole("treeitem", { name: "Inbox" }).first();

  if (await inbox.isVisible()) {
    return;
  }

  console.log("\nPlease log in to Outlook in the browser window...");
  await inbox.waitFor({ state: "visible", timeout: 300_000 });
  console.log("Logged in!\n");
}

export async function takeErrorScreenshot(page: Page, label: string): Promise<string | undefined> {
  try {
    ensureLogsDir();

    const filename = `error-${label}-${Date.now()}.png`;
    const path = join(LOGS_DIR, filename);
    await page.screenshot({ fullPage: true, path });
    console.log(`  [screenshot] ${path}`);
    return path;
  } catch {
    console.log(`  [screenshot] failed to capture`);
    return undefined;
  }
}
