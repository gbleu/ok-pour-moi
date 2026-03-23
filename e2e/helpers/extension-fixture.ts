import { type BrowserContext, type Page, test as base } from "@playwright/test";
import { dirname, join } from "node:path";
import { createExtensionContext } from "./extension-context.js";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../fixtures");

interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  getOptionsPage: () => Promise<Page>;
  getPopupPage: () => Promise<Page>;
  setupOutlookPage: (fixtureName: string) => Promise<Page>;
}

// eslint-disable-next-line import/no-default-export -- Playwright fixture pattern requires default export
export default base.extend<ExtensionFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires destructuring
  context: async ({}, use) => {
    const ext = await createExtensionContext();
    await use(ext.context);
    await ext.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers().find((sw) => sw.url().includes("service-worker"));
    const url = worker?.url() ?? "";
    const [, id = ""] = url.match(/chrome-extension:\/\/([^/]+)/) ?? [];
    await use(id);
  },
  getOptionsPage: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/options/options.html`);
      return page;
    });
  },
  getPopupPage: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      return page;
    });
  },
  setupOutlookPage: async ({ context }, use) => {
    await use(async (fixtureName: string) => {
      const fixturePath = join(FIXTURES_DIR, fixtureName);
      const html = await readFile(fixturePath, "utf8");
      const page = await context.newPage();

      await page.route("https://outlook.office365.com/mail/**", (route) =>
        route.fulfill({ body: html, contentType: "text/html" }),
      );

      await page.goto("https://outlook.office365.com/mail/inbox");
      return page;
    });
  },
});

export { expect } from "@playwright/test";
