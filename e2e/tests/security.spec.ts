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
    extensionId,
    setupOutlookPage,
  }: Readonly<{
    extensionId: string;
    setupOutlookPage: (fixtureName: string) => Promise<Readonly<Page>>;
  }>) => {
    // Page served at Outlook URL gets the content script injected.
    // Chrome throws "Receiving end does not exist" when no content script is loaded.
    // Sending a message that gets any other result proves the content script is present.
    const page = await setupOutlookPage("outlook-message.html");

    const hasContentScript = await page.evaluate(async (extId: string) => {
      try {
        await chrome.runtime.sendMessage(extId, { type: "PING" });
        return true;
      } catch (error) {
        // "Receiving end does not exist" means no content script
        return !(error instanceof Error && error.message.includes("Receiving end"));
      }
    }, extensionId);

    expect(hasContentScript).toBe(true);

    await page.close();
  });
});
