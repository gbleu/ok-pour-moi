import { SCENARIOS_DIR, setupBrowserWithPdfRoute } from "./test-helper.js";
import { describe, expect, test } from "bun:test";
import { findAttachmentListbox, findLastMessageFromOthers } from "../../src/commands/run.js";

describe("Integration: run.ts DOM traversal", () => {
  const { getPage } = setupBrowserWithPdfRoute();

  describe("findLastMessageFromOthers", () => {
    test("returns last message from non-user sender (single-pdf scenario)", async () => {
      const page = getPage();
      await page.goto(`file://${SCENARIOS_DIR}/single-pdf.html`);
      const readingPane = page.locator('[role="main"]');

      const result = await findLastMessageFromOthers(readingPane, "me@example.com");

      expect(result).toBeDefined();
      expect(result?.senderLastname).toBe("Smith");
    });

    test("skips user's own messages in multi-message thread", async () => {
      const page = getPage();
      await page.goto(`file://${SCENARIOS_DIR}/multi-message-thread.html`);
      const readingPane = page.locator('[role="main"]');

      const result = await findLastMessageFromOthers(readingPane, "me@example.com");

      expect(result).toBeDefined();
      expect(result?.senderLastname).toBe("Doe");
      const fromButtonName = await result?.button.getAttribute("name");
      expect(fromButtonName).not.toContain("me@example.com");
    });

    test("returns null when all messages are from user", async () => {
      const page = getPage();
      await page.setContent(`
        <div role="main">
          <button name="From: Me <me@example.com>">From: Me &lt;me@example.com&gt;</button>
        </div>
      `);
      const readingPane = page.locator('[role="main"]');

      const result = await findLastMessageFromOthers(readingPane, "me@example.com");

      expect(result).toBeUndefined();
    });

    test("handles case-insensitive email matching", async () => {
      const page = getPage();
      await page.setContent(`
        <div role="main">
          <div tabindex="0" style="cursor: pointer;">
            <button name="From: ME <ME@EXAMPLE.COM>">From: ME &lt;ME@EXAMPLE.COM&gt;</button>
          </div>
          <div tabindex="0" style="cursor: pointer;">
            <button name="From: John Doe <john@other.com>">From: John Doe &lt;john@other.com&gt;</button>
          </div>
        </div>
      `);
      const readingPane = page.locator('[role="main"]');

      const result = await findLastMessageFromOthers(readingPane, "me@example.com");

      expect(result).toBeDefined();
      expect(result?.senderLastname).toBe("Doe");
    });

    test("returns null when no from buttons exist", async () => {
      const page = getPage();
      await page.setContent(`<div role="main"><p>Empty pane</p></div>`);
      const readingPane = page.locator('[role="main"]');

      const result = await findLastMessageFromOthers(readingPane, "me@example.com");

      expect(result).toBeUndefined();
    });
  });

  describe("findAttachmentListbox", () => {
    test("finds attachment listbox using XPath following (single-pdf scenario)", async () => {
      const page = getPage();
      await page.goto(`file://${SCENARIOS_DIR}/single-pdf.html`);
      const readingPane = page.locator('[role="main"]');
      const messageButton = page.getByRole("button", { name: /^From:/ }).first();

      const result = await findAttachmentListbox(readingPane, messageButton);

      expect(result).toBeDefined();
      const ariaLabel = await result?.getAttribute("aria-label");
      expect(ariaLabel).toContain("attachments");
    });

    test("returns null when no attachments present (no-attachments scenario)", async () => {
      const page = getPage();
      await page.goto(`file://${SCENARIOS_DIR}/no-attachments.html`);
      const readingPane = page.locator('[role="main"]');
      const messageButton = page.getByRole("button", { name: /^From:/ }).first();

      const result = await findAttachmentListbox(readingPane, messageButton);

      expect(result).toBeUndefined();
    });

    test("excludes draft attachments (draft-with-attachments scenario)", async () => {
      const page = getPage();
      await page.goto(`file://${SCENARIOS_DIR}/draft-with-attachments.html`);
      const readingPane = page.locator('[role="main"]');
      const messageButton = page.getByRole("button", { name: /Alice Brown/ });

      const result = await findAttachmentListbox(readingPane, messageButton);

      expect(result).toBeDefined();
      const options = await result?.getByRole("option").allTextContents();
      expect(options?.some((text) => text.includes("invoice_2024_001.pdf"))).toBe(true);
      expect(options?.some((text) => text.includes("signed_invoice.pdf"))).toBe(false);
    });

    test("uses fallback when XPath following doesn't find attachments", async () => {
      const page = getPage();
      await page.setContent(`
        <div role="main">
          <div>
            <button name="From: Test User">From: Test User</button>
          </div>
          <div role="listbox" aria-label="Message attachments">
            <div role="option">document.pdf</div>
          </div>
        </div>
      `);
      const readingPane = page.locator('[role="main"]');
      const messageButton = page.getByRole("button", { name: /^From:/ });

      const result = await findAttachmentListbox(readingPane, messageButton);

      expect(result).toBeDefined();
    });
  });

  describe("PDF attachment list handling", () => {
    test("verifies PDF attachments are present in listbox (single-pdf scenario)", async () => {
      const page = getPage();
      await page.goto(`file://${SCENARIOS_DIR}/single-pdf.html`);
      const attachmentsList = page.locator('[role="listbox"][aria-label*="attachments"]');

      const optionsCount = await attachmentsList.getByRole("option").count();
      expect(optionsCount).toBe(1);

      const optionText = await attachmentsList.getByRole("option").first().textContent();
      expect(optionText).toContain(".pdf");
    });

    test("skips non-PDF attachments", async () => {
      const page = getPage();
      await page.setContent(`
        <div role="main">
          <div role="listbox" aria-label="Message attachments">
            <div role="option">image.jpg</div>
            <div role="option">document.pdf</div>
            <div role="option">spreadsheet.xlsx</div>
          </div>
        </div>
      `);
      const attachmentsList = page.locator('[role="listbox"][aria-label*="attachments"]');
      const options = attachmentsList.getByRole("option");

      const count = await options.count();
      let pdfCount = 0;
      for (let i = 0; i < count; i += 1) {
        const text = await options.nth(i).textContent();
        if (text?.toLowerCase().includes(".pdf") === true) {
          pdfCount += 1;
        }
      }

      expect(pdfCount).toBe(1);
    });

    test("handles multiple PDF attachments", async () => {
      const page = getPage();
      await page.setContent(`
        <div role="main">
          <div role="listbox" aria-label="Message attachments">
            <div role="option">contract.pdf</div>
            <div role="option">appendix.pdf</div>
            <div role="option">terms.pdf</div>
          </div>
        </div>
      `);
      const attachmentsList = page.locator('[role="listbox"][aria-label*="attachments"]');
      const pdfOptions = attachmentsList.getByRole("option").filter({ hasText: /\.pdf/i });

      const count = await pdfOptions.count();
      expect(count).toBe(3);
    });
  });
});
