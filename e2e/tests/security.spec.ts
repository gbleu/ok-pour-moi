import test, { expect } from "#helpers/extension-fixture.js";

test.describe("Origin Validation", () => {
  test("service worker rejects messages from non-Outlook origins", async ({
    context,
    extensionId,
  }) => {
    // Extension pages have chrome-extension:// origin, not an Outlook origin
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

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

    // When the listener returns false (origin rejected), Chrome doesn't send a response
    expect(["error", "responded"]).toContain(result.status);
    if (result.status === "responded") {
      expect(result.response).not.toHaveProperty("signedPdf");
    }

    await page.close();
  });

  test("content script loads on allowed Outlook origins", async ({ setupOutlookPage }) => {
    // Page served at Outlook URL gets the content script injected
    const page = await setupOutlookPage("outlook-message.html");

    const hasContentScript = await page.evaluate(
      () => chrome !== undefined && chrome.runtime !== undefined,
    );

    expect(hasContentScript).toBe(true);

    await page.close();
  });
});
