import { type BrowserContext, type Page } from "@playwright/test";

import test, { expect } from "#helpers/extension-fixture.js";

test.skip(Boolean(process.env.CI), "Extension tests require real Chrome");

test.describe("Origin Validation", () => {
  test("service worker rejects messages from non-Outlook origins", async ({
    context,
    extensionId,
  }: Readonly<{ context: Readonly<BrowserContext>; extensionId: string }>) => {
    // Extension pages have chrome-extension:// origin, not an Outlook origin
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
      waitUntil: "domcontentloaded",
    });

    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- Chrome API returns untyped response in page.evaluate */
    const result: { response?: Record<string, unknown>; status: string } = await page.evaluate(
      async () => {
        try {
          const response = await chrome.runtime.sendMessage({
            payload: { pdfBytes: [], senderLastname: "Test" },
            type: "SIGN_PDF",
          });
          return { response, status: "responded" };
        } catch {
          return { status: "error" };
        }
      },
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    // Origin rejected: either error, or response without signedPdf
    expect(["error", "responded"]).toContain(result.status);
    if (result.status === "responded" && result.response !== undefined) {
      expect(result.response).not.toHaveProperty("signedPdf");
    }

    await page.close();
  });

  test("content script loads on allowed Outlook origins", async ({
    setupOutlookPage,
  }: Readonly<{ setupOutlookPage: (fixtureName: string) => Promise<Readonly<Page>> }>) => {
    // Content scripts run in an isolated world, but can modify the page DOM.
    // The content script sets data-opm-loaded="true" on <html> when it loads.
    const page = await setupOutlookPage("outlook-message.html");

    await page.waitForFunction(() => document.documentElement.dataset.opmLoaded === "true", {
      timeout: 5000,
    });

    const marker = await page.evaluate(() => document.documentElement.dataset.opmLoaded);
    expect(marker).toBe("true");

    await page.close();
  });
});
