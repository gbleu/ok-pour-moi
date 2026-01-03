import { SCENARIOS_DIR, setupBrowserWithPdfRoute } from "./test-helper.js";
import { describe, expect, test } from "bun:test";
import { downloadAndSignPdfs } from "../../src/lib/outlook-dom.js";
import { join } from "node:path";

const testSigBytes = await Bun.file(join(import.meta.dir, "../fixtures/signature.png")).bytes();

describe("Integration: downloadAndSignPdfs", () => {
  const { getPage } = setupBrowserWithPdfRoute();

  test(
    "downloads and signs a single PDF attachment",
    async () => {
      const page = getPage();
      await page.goto(`file://${SCENARIOS_DIR}/single-pdf.html`);

      const attachmentsList = page.locator('[role="listbox"][aria-label*="attachments"]');

      const items = await downloadAndSignPdfs({
        attachmentsList,
        conversationId: "conv-001",
        page,
        senderLastname: "Smith",
        sigBytes: testSigBytes,
        sigFormat: "png",
        subject: "Test Subject",
      });

      expect(items).toHaveLength(1);
      expect(items[0]).toEqual(
        expect.objectContaining({
          conversationId: "conv-001",
          senderLastname: "Smith",
          subject: "Test Subject",
        }),
      );
      expect(items[0].signedPdf).toBeInstanceOf(Uint8Array);
      expect(items[0].signedPdf.length).toBeGreaterThan(0);
    },
    30_000,
  );

  test("skips non-PDF attachments", async () => {
    const page = getPage();
    await page.setContent(`
      <html>
        <body>
          <div role="main">
            <div role="listbox" aria-label="Message attachments">
              <div role="option">image.jpg</div>
              <div role="option">document.docx</div>
            </div>
          </div>
        </body>
      </html>
    `);

    const attachmentsList = page.locator('[role="listbox"][aria-label*="attachments"]');

    const items = await downloadAndSignPdfs({
      attachmentsList,
      conversationId: "conv-002",
      page,
      senderLastname: "Doe",
      sigBytes: testSigBytes,
      sigFormat: "png",
      subject: "No PDFs",
    });

    expect(items).toHaveLength(0);
  });
});
