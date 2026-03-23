import { type BrowserContext, type Page, chromium } from "@playwright/test";
import { type MockConfig, createChromeMock } from "#mocks/chrome-api.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH_TO_EXTENSION = join(__dirname, "../../dist");

export async function createExtensionContext(): Promise<{
  close: () => Promise<void>;
  context: BrowserContext;
  extensionId: string;
  getPopupPage: () => Promise<Page>;
}> {
  const userDataDir = await mkdtemp(join(tmpdir(), "opm-test-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    args: [
      `--disable-extensions-except=${PATH_TO_EXTENSION}`,
      `--load-extension=${PATH_TO_EXTENSION}`,
      "--no-sandbox",
      "--disable-crash-reporter",
      "--disable-crashpad-for-testing",
      "--disable-gpu-watchdog",
    ],
    executablePath: chromium.executablePath(),
    headless: false,
    ignoreDefaultArgs: [
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
    ],
  });

  // Wait for our extension's service worker (filter out Chrome's built-in component extensions)
  let serviceWorker = context.serviceWorkers().find((sw) => sw.url().includes("service-worker"));
  serviceWorker ??= await context.waitForEvent("serviceworker", {
    predicate: (sw) => sw.url().includes("service-worker"),
    timeout: 10_000,
  });

  const [, extensionId = ""] = serviceWorker.url().match(/chrome-extension:\/\/([^/]+)/) ?? [];

  return {
    close: async () => context.close(),
    context,
    extensionId,
    getPopupPage: async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
        waitUntil: "domcontentloaded",
      });
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
