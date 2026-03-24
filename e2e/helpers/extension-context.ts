import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type BrowserContext, type Page, chromium } from "@playwright/test";

import { type MockConfig, createChromeMock } from "#mocks/chrome-api.js";

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
    headless: Boolean(process.env.CI),
    ignoreDefaultArgs: [
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
    ],
  });

  // Wait for our extension's service worker (filter out Chrome's built-in component extensions)
  let serviceWorker = context
    .serviceWorkers()
    .find((sw: Readonly<{ url: () => string }>) => sw.url().includes("service-worker"));
  serviceWorker ??= await context.waitForEvent("serviceworker", {
    predicate: (sw: Readonly<{ url: () => string }>) => sw.url().includes("service-worker"),
    timeout: 10_000,
  });

  const [, extensionId = ""] = /chrome-extension:\/\/([^/]+)/.exec(serviceWorker.url()) ?? [];

  return {
    close: async () => {
      await context.close();
      await rm(userDataDir, { force: true, recursive: true });
    },
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
  context: Readonly<BrowserContext>,
  fixturePath: string,
  mockConfig: Readonly<MockConfig> = {},
): Promise<Page> {
  const page = await context.newPage();

  await page.addInitScript((chromeMock: Readonly<unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Browser context requires this
    (globalThis as { chrome: unknown }).chrome = chromeMock;
  }, createChromeMock(mockConfig));

  await page.goto(`file://${fixturePath}`);
  return page;
}
