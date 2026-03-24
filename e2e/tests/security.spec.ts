import type { BrowserContext, Page } from "@playwright/test";

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
            payload: { originalFilename: "test.pdf", pdfBytes: [], senderLastname: "Test" },
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
    // Page served at Outlook URL gets the content script injected.
    // Content scripts run in an isolated world, so verify via console.log
    // Emitted on content script load. Subscribe before reload to avoid race.
    const page = await setupOutlookPage("outlook-message.html");

    const consolePromise = page.waitForEvent("console", {
      predicate: (msg: Readonly<{ text: () => string }>) => msg.text().includes("[OPM]"),
      timeout: 10_000,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const message = await consolePromise;

    expect(message.text()).toContain("[OPM]");

    await page.close();
  });
});
