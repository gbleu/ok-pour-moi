import { type BrowserContext, type Page } from "@playwright/test";

import test, { expect } from "#helpers/extension-fixture.js";

test.skip(Boolean(process.env.CI), "Extension tests require real Chrome");

test.describe("PDF Signing Workflow", () => {
  test("reports no attachments when none present", async ({
    setupOutlookPage,
  }: Readonly<{ setupOutlookPage: (fixtureName: string) => Promise<Readonly<Page>> }>) => {
    const page = await setupOutlookPage("outlook-no-attachments.html");

    const attachmentCount = await page.evaluate(() => {
      const listboxes = document.querySelectorAll('[role="listbox"][aria-label*="attachment" i]');
      let count = 0;
      for (const lb of listboxes) {
        count += lb.querySelectorAll('[role="option"]').length;
      }
      return count;
    });

    expect(attachmentCount).toBe(0);

    await page.close();
  });

  test("skips non-PDF attachments", async ({
    setupOutlookPage,
  }: Readonly<{ setupOutlookPage: (fixtureName: string) => Promise<Readonly<Page>> }>) => {
    const page = await setupOutlookPage("outlook-non-pdf-only.html");

    const result = await page.evaluate(() => {
      const listboxes = document.querySelectorAll('[role="listbox"][aria-label*="attachment" i]');
      let totalCount = 0;
      let pdfCount = 0;
      for (const lb of listboxes) {
        const options = lb.querySelectorAll('[role="option"]');
        for (const opt of options) {
          totalCount += 1;
          if (opt.textContent.toLowerCase().includes(".pdf")) {
            pdfCount += 1;
          }
        }
      }
      return { pdfCount, totalCount };
    });

    expect(result).toEqual({ pdfCount: 0, totalCount: 3 });

    await page.close();
  });

  test("service worker rejects signing from non-Outlook origin", async ({
    context,
    extensionId,
  }: Readonly<{ context: Readonly<BrowserContext>; extensionId: string }>) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
      waitUntil: "domcontentloaded",
    });

    await page.evaluate(async () => {
      await chrome.storage.local.clear();
    });

    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- Chrome API returns untyped response in page.evaluate */
    const result: { response?: Record<string, unknown>; status: string } = await page.evaluate(
      async () => {
        try {
          const response = await chrome.runtime.sendMessage({
            payload: {
              pdfBytes: [...new Uint8Array(100)],
              senderLastname: "Test",
            },
            type: "SIGN_PDF",
          });
          return { response, status: "responded" };
        } catch {
          return { status: "rejected" };
        }
      },
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    // Origin rejected: either threw an error, or returned undefined/no signedPdf
    if (result.status === "responded" && result.response !== undefined) {
      expect(result.response).not.toHaveProperty("signedPdf");
    }

    await page.close();
  });

  test("detects multiple PDF attachments", async ({
    setupOutlookPage,
  }: Readonly<{ setupOutlookPage: (fixtureName: string) => Promise<Readonly<Page>> }>) => {
    const page = await setupOutlookPage("outlook-message.html");

    const pdfCount = await page.evaluate(() => {
      const listboxes = document.querySelectorAll('[role="listbox"][aria-label*="attachment" i]');
      let count = 0;
      for (const lb of listboxes) {
        for (const opt of lb.querySelectorAll('[role="option"]')) {
          if (opt.textContent.toLowerCase().includes(".pdf")) {
            count += 1;
          }
        }
      }
      return count;
    });

    // Q4_Report.pdf, Q4_Report_v2.pdf, and existing-attachment.pdf (compose dialog)
    expect(pdfCount).toBe(3);

    await page.close();
  });
});
