import { type BrowserContext, type Page, chromium } from "@playwright/test";
import { type MockConfig, createChromeMock } from "#mocks/chrome-api.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH_TO_EXTENSION = join(__dirname, "../../dist");
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export async function createExtensionContext(): Promise<{
  close: () => Promise<void>;
  context: BrowserContext;
  extensionId: string;
  getPopupPage: () => Promise<Page>;
}> {
  const context = await chromium.launchPersistentContext("", {
    args: [
      `--disable-extensions-except=${PATH_TO_EXTENSION}`,
      `--load-extension=${PATH_TO_EXTENSION}`,
      "--no-sandbox",
      "--disable-crash-reporter",
      "--disable-crashpad-for-testing",
      "--disable-gpu-watchdog",
    ],
    executablePath: CHROME_PATH,
    headless: false,
  });

  // Wait a bit for the extension to initialize
  await setTimeout(1000);

  const [firstWorker] = context.serviceWorkers();
  const serviceWorker =
    firstWorker ?? (await context.waitForEvent("serviceworker", { timeout: 10_000 }));

  const [, extensionId = ""] = serviceWorker.url().match(/chrome-extension:\/\/([^/]+)/) ?? [];

  return {
    close: async () => context.close(),
    context,
    extensionId,
    getPopupPage: async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      return page;
    },
  };
}

export async function setupMockOutlookPage(
  context: BrowserContext,
  fixturePath: string,
  mockConfig: MockConfig = {},
): Promise<Page> {
  const page = await context.newPage();

  await page.addInitScript((chromeMock) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Browser context requires this
    (globalThis as { chrome: unknown }).chrome = chromeMock;
  }, createChromeMock(mockConfig));

  await page.goto(`file://${fixturePath}`);
  return page;
}
