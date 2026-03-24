import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type BrowserContext, type Page, test as base } from "@playwright/test";

import { createExtensionContext } from "./extension-context.js";

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
  context: async (
    { extensionContext }: Readonly<{ extensionContext: Readonly<BrowserContext> }>,
    use,
  ) => {
    await use(extensionContext);
  },
  extensionContext: [
    // eslint-disable-next-line no-empty-pattern, typescript/prefer-readonly-parameter-types -- Playwright fixture signature requires destructuring
    async ({}, use): Promise<void> => {
      const ext = await createExtensionContext();
      await use(ext.context);
      await ext.close();
    },
    { scope: "worker" },
  ],
  extensionId: [
    async (
      { extensionContext }: Readonly<{ extensionContext: Readonly<BrowserContext> }>,
      use,
    ): Promise<void> => {
      const worker = extensionContext
        .serviceWorkers()
        .find((sw: Readonly<{ url: () => string }>) => sw.url().includes("service-worker"));
      const url = worker?.url() ?? "";
      const [, id = ""] = /chrome-extension:\/\/([^/]+)/.exec(url) ?? [];
      await use(id);
    },
    { scope: "worker" },
  ],
  getOptionsPage: async (
    {
      extensionContext,
      extensionId,
    }: Readonly<{ extensionContext: Readonly<BrowserContext>; extensionId: string }>,
    use,
  ) => {
    await use(async () => {
      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/options/options.html`, {
        waitUntil: "domcontentloaded",
      });
      return page;
    });
  },
  getPopupPage: async (
    {
      extensionContext,
      extensionId,
    }: Readonly<{ extensionContext: Readonly<BrowserContext>; extensionId: string }>,
    use,
  ) => {
    await use(async () => {
      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
        waitUntil: "domcontentloaded",
      });
      return page;
    });
  },
  setupOutlookPage: async (
    { extensionContext }: Readonly<{ extensionContext: Readonly<BrowserContext> }>,
    use,
  ) => {
    await use(async (fixtureName: string) => {
      const fixturePath = join(FIXTURES_DIR, fixtureName);
      const html = await readFile(fixturePath, "utf8");
      const page = await extensionContext.newPage();

      await page.route(
        "https://outlook.office365.com/mail/**",
        (
          route: Readonly<{
            fulfill: (response: Readonly<{ body: string; contentType: string }>) => Promise<void>;
          }>,
        ) => route.fulfill({ body: html, contentType: "text/html" }),
      );

      await page.goto("https://outlook.office365.com/mail/inbox", {
        waitUntil: "domcontentloaded",
      });
      return page;
    });
  },
});

export { expect } from "@playwright/test";
