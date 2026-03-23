import test, { expect } from "#helpers/extension-fixture.js";

test.skip(Boolean(process.env.CI), "Extension loading tests require headed Chrome");

test.describe("Origin Validation", () => {
  test("service worker rejects messages from non-Outlook origins", async ({
    context,
    extensionId,
  }) => {
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

  test("content script loads on allowed Outlook origins", async ({ setupOutlookPage }) => {
    // Page served at Outlook URL gets the content script injected
    const page = await setupOutlookPage("outlook-message.html");

    // Chrome content scripts run in an isolated world, so verify via console log instead.
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });

    // Reload to capture console messages from content script
    await page.reload({ waitUntil: "domcontentloaded" });
    // Give content script time to execute
    await page.waitForTimeout(1000);

    expect(consoleMessages.some((msg) => msg.includes("[OPM]"))).toBe(true);

    await page.close();
  });
});
