import { type BrowserContext, type Page, test as base } from "@playwright/test";
import { dirname, join } from "node:path";
import { createExtensionContext } from "./extension-context.js";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../fixtures");

interface ExtensionWorkerFixtures {
  extensionContext: BrowserContext;
  extensionId: string;
}

interface ExtensionTestFixtures {
  context: BrowserContext;
  getOptionsPage: () => Promise<Page>;
  getPopupPage: () => Promise<Page>;
  setupOutlookPage: (fixtureName: string) => Promise<Page>;
}

// eslint-disable-next-line import/no-default-export -- Playwright fixture pattern requires default export
export default base.extend<ExtensionTestFixtures, ExtensionWorkerFixtures>({
  context: async ({ extensionContext }, use) => {
    await use(extensionContext);
  },
  extensionContext: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires destructuring
    async ({}, use): Promise<void> => {
      const ext = await createExtensionContext();
      await use(ext.context);
      await ext.close();
    },
    { scope: "worker" },
  ],
  extensionId: [
    async ({ extensionContext }, use): Promise<void> => {
      const worker = extensionContext
        .serviceWorkers()
        .find((sw) => sw.url().includes("service-worker"));
      const url = worker?.url() ?? "";
      const [, id = ""] = url.match(/chrome-extension:\/\/([^/]+)/) ?? [];
      await use(id);
    },
    { scope: "worker" },
  ],
  getOptionsPage: async ({ extensionContext, extensionId }, use) => {
    await use(async () => {
      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/options/options.html`);
      return page;
    });
  },
  getPopupPage: async ({ extensionContext, extensionId }, use) => {
    await use(async () => {
      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      return page;
    });
  },
  setupOutlookPage: async ({ extensionContext }, use) => {
    await use(async (fixtureName: string) => {
      const fixturePath = join(FIXTURES_DIR, fixtureName);
      const html = await readFile(fixturePath, "utf8");
      const page = await extensionContext.newPage();

      await page.route("https://outlook.office365.com/mail/**", (route) =>
        route.fulfill({ body: html, contentType: "text/html" }),
      );

      await page.goto("https://outlook.office365.com/mail/inbox");
      return page;
    });
  },
});

export { expect } from "@playwright/test";
