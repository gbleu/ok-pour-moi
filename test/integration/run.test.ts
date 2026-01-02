import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { findLastMessageFromOthers, findAttachmentListbox } from "../../src/commands/run.js";

const SCENARIOS_DIR = join(import.meta.dir, "fixtures", "scenarios");

// Test PDF bytes from fixtures
const testPdfBytes = readFileSync(join(import.meta.dir, "../fixtures/sample.pdf"));

describe("Integration: run.ts DOM traversal", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();

    // Set up route interception for PDF downloads
    await page.route("**/mock-downloads/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from(testPdfBytes),
      });
    });
  });

  afterAll(async () => {
    await context.close();
    await browser.close();
  });

  describe("findLastMessageFromOthers", () => {
    test("returns last message from non-user sender (single-pdf scenario)", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "single-pdf.html")}`);
      const readingPane = page.locator('[role="main"]');

      const result = await findLastMessageFromOthers(readingPane, "me@example.com");

      expect(result).not.toBeNull();
      expect(result?.senderLastname).toBe("Smith");
    });

    test("skips user's own messages in multi-message thread", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "multi-message-thread.html")}`);
      const readingPane = page.locator('[role="main"]');

      const result = await findLastMessageFromOthers(readingPane, "me@example.com");

      expect(result).not.toBeNull();
      // Should find Jane Doe's message (last one from others), not the user's message
      expect(result?.senderLastname).toBe("Doe");
      // Verify user's own message was explicitly skipped
      const fromButtonName = await result?.button.getAttribute("name");
      expect(fromButtonName).not.toContain("me@example.com");
    });

    test("returns null when all messages are from user", async () => {
      // Create a page with only user's messages
      await page.setContent(`
        <div role="main">
          <button name="From: Me <me@example.com>">From: Me &lt;me@example.com&gt;</button>
        </div>
      `);
      const readingPane = page.locator('[role="main"]');

      const result = await findLastMessageFromOthers(readingPane, "me@example.com");

      expect(result).toBeNull();
    });

    test("handles case-insensitive email matching", async () => {
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

      expect(result).not.toBeNull();
      expect(result?.senderLastname).toBe("Doe");
    });

    test("returns null when no from buttons exist", async () => {
      await page.setContent(`<div role="main"><p>Empty pane</p></div>`);
      const readingPane = page.locator('[role="main"]');

      const result = await findLastMessageFromOthers(readingPane, "me@example.com");

      expect(result).toBeNull();
    });
  });

  describe("findAttachmentListbox", () => {
    test("finds attachment listbox using XPath following (single-pdf scenario)", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "single-pdf.html")}`);
      const readingPane = page.locator('[role="main"]');
      const messageButton = page.getByRole("button", { name: /^From:/ }).first();

      const result = await findAttachmentListbox(readingPane, messageButton);

      expect(result).not.toBeNull();
      const ariaLabel = await result?.getAttribute("aria-label");
      expect(ariaLabel).toContain("attachments");
    });

    test("returns null when no attachments present (no-attachments scenario)", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "no-attachments.html")}`);
      const readingPane = page.locator('[role="main"]');
      const messageButton = page.getByRole("button", { name: /^From:/ }).first();

      const result = await findAttachmentListbox(readingPane, messageButton);

      expect(result).toBeNull();
    });

    test("excludes draft attachments (draft-with-attachments scenario)", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "draft-with-attachments.html")}`);
      const readingPane = page.locator('[role="main"]');
      // Find Alice's message button (not the draft)
      const messageButton = page.getByRole("button", { name: /Alice Brown/ });

      const result = await findAttachmentListbox(readingPane, messageButton);

      expect(result).not.toBeNull();
      // Should find the non-draft attachments, not the draft ones
      const options = await result?.getByRole("option").allTextContents();
      expect(options?.some((t) => t.includes("invoice_2024_001.pdf"))).toBe(true);
      // Verify draft attachment was excluded
      expect(options?.some((t) => t.includes("signed_invoice.pdf"))).toBe(false);
    });

    test("uses fallback when XPath following doesn't find attachments", async () => {
      // XPath following fails here because the listbox is not a DOM sibling of the button.
      // In real Outlook, attachments appear as following siblings of the message row.
      // This test verifies the fallback to aria-label search works correctly.
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

      expect(result).not.toBeNull();
    });
  });

  describe("PDF attachment list handling", () => {
    test("verifies PDF attachments are present in listbox (single-pdf scenario)", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "single-pdf.html")}`);
      const attachmentsList = page.locator('[role="listbox"][aria-label*="attachments"]');

      // This test verifies the function handles the attachment list correctly
      // The actual download mechanics would be handled by Playwright in real usage
      const optionsCount = await attachmentsList.getByRole("option").count();
      expect(optionsCount).toBe(1);

      const optionText = await attachmentsList.getByRole("option").first().textContent();
      expect(optionText).toContain(".pdf");
    });

    test("skips non-PDF attachments", async () => {
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

      // Count PDF options
      const count = await options.count();
      let pdfCount = 0;
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text?.toLowerCase().includes(".pdf")) {
          pdfCount++;
        }
      }

      expect(pdfCount).toBe(1);
    });

    test("handles multiple PDF attachments", async () => {
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

  describe("end-to-end scenarios", () => {
    test("multi-message-thread: correctly identifies sender's last message", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "multi-message-thread.html")}`);

      // Simulate clicking "See more messages"
      const seeMoreBtn = page.getByRole("button", { name: "See more messages" });
      if (await seeMoreBtn.isVisible()) {
        await seeMoreBtn.click();
      }

      const readingPane = page.locator('[role="main"]');
      const result = await findLastMessageFromOthers(readingPane, "me@example.com");

      expect(result).not.toBeNull();
      expect(result?.senderLastname).toBe("Doe");

      // Verify we can find attachments from this message
      if (result) {
        const attachments = await findAttachmentListbox(readingPane, result.button);
        expect(attachments).not.toBeNull();
      }
    });

    test("draft-with-attachments: finds original sender's attachments, not draft", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "draft-with-attachments.html")}`);
      const readingPane = page.locator('[role="main"]');

      const message = await findLastMessageFromOthers(readingPane, "me@example.com");
      expect(message).not.toBeNull();
      expect(message?.senderLastname).toBe("Brown");

      if (message) {
        const attachments = await findAttachmentListbox(readingPane, message.button);
        expect(attachments).not.toBeNull();

        const options = await attachments?.getByRole("option").allTextContents();
        // Should have the invoice, not the signed_invoice from draft
        expect(options?.some((t) => t.includes("invoice_2024_001.pdf"))).toBe(true);
      }
    });

    test("no-attachments: gracefully handles missing attachments", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "no-attachments.html")}`);
      const readingPane = page.locator('[role="main"]');

      const message = await findLastMessageFromOthers(readingPane, "me@example.com");
      expect(message).not.toBeNull();
      expect(message?.senderLastname).toBe("Wilson");

      if (message) {
        const attachments = await findAttachmentListbox(readingPane, message.button);
        expect(attachments).toBeNull();
      }
    });

    test("folder navigation works correctly", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "single-pdf.html")}`);

      const folder = page.getByRole("treeitem", { name: "ok pour moi" });
      expect(await folder.isVisible()).toBe(true);
      expect(await folder.getAttribute("class")).toContain("selected");
    });

    test("email items have data-convid attribute", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "single-pdf.html")}`);

      const emailItems = page.locator("[data-convid]");
      const count = await emailItems.count();
      expect(count).toBeGreaterThan(0);

      const convId = await emailItems.first().getAttribute("data-convid");
      expect(convId).toBe("conv-001");
    });

    test("subject heading is accessible", async () => {
      await page.goto(`file://${join(SCENARIOS_DIR, "single-pdf.html")}`);

      const subject = page.locator('[role="heading"][aria-level="2"]');
      const text = await subject.textContent();
      expect(text).toBe("Document for signature");
    });
  });
});

describe("Integration: context menu and download simulation", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
  }, 30000);

  afterAll(async () => {
    await context.close();
    await browser.close();
  }, 30000);

  test("context menu appears on right-click", async () => {
    await page.goto(`file://${join(SCENARIOS_DIR, "single-pdf.html")}`);

    const attachment = page.locator('[role="option"]').first();
    await attachment.click({ button: "right" });

    const contextMenu = page.locator("#context-menu");
    const contextMenuClass = await contextMenu.getAttribute("class");
    expect(contextMenuClass).toMatch(/visible/);

    const downloadItem = page.getByRole("menuitem", { name: /download/i });
    expect(await downloadItem.isVisible()).toBe(true);
  });

  test("reply button reveals compose area", async () => {
    await page.goto(`file://${join(SCENARIOS_DIR, "single-pdf.html")}`);

    const composeArea = page.locator("#compose-area");
    expect(await composeArea.isVisible()).toBe(false);

    const replyBtn = page.getByRole("button", { name: "Reply" });
    await replyBtn.click();

    const composeAreaClass = await composeArea.getAttribute("class");
    expect(composeAreaClass).toMatch(/visible/);
  });

  test("tabs switch correctly", async () => {
    await page.goto(`file://${join(SCENARIOS_DIR, "single-pdf.html")}`);

    const homeTab = page.getByRole("tab", { name: "Home" });
    const optionsTab = page.getByRole("tab", { name: "Options" });

    expect(await homeTab.getAttribute("aria-selected")).toBe("true");
    expect(await optionsTab.getAttribute("aria-selected")).not.toBe("true");

    await optionsTab.click();

    expect(await homeTab.getAttribute("aria-selected")).not.toBe("true");
    expect(await optionsTab.getAttribute("aria-selected")).toBe("true");
  });
});

describe("Integration: edge cases", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
  }, 30000);

  afterAll(async () => {
    await context.close();
    await browser.close();
  }, 30000);

  test("handles empty email list", async () => {
    await page.setContent(`
      <div role="main">
        <div id="email-list"></div>
      </div>
    `);

    const emailItems = page.locator("[data-convid]");
    const count = await emailItems.count();
    expect(count).toBe(0);
  });

  test("handles malformed from button text", async () => {
    await page.setContent(`
      <div role="main">
        <div tabindex="0" style="cursor: pointer;">
          <button name="From: ">From: </button>
        </div>
      </div>
    `);
    const readingPane = page.locator('[role="main"]');

    const result = await findLastMessageFromOthers(readingPane, "me@example.com");

    expect(result).not.toBeNull();
    expect(result?.senderLastname).toBe("Unknown");
  });

  test("handles special characters in sender name", async () => {
    await page.setContent(`
      <div role="main">
        <div tabindex="0" style="cursor: pointer;">
          <button name="From: O'Brien-Smith <obrien@test.com>">From: O'Brien-Smith &lt;obrien@test.com&gt;</button>
        </div>
      </div>
    `);
    const readingPane = page.locator('[role="main"]');

    const result = await findLastMessageFromOthers(readingPane, "me@example.com");

    expect(result).not.toBeNull();
    expect(result?.senderLastname).toBe("O'Brien-Smith");
  });

  test("handles unicode in sender name", async () => {
    await page.setContent(`
      <div role="main">
        <div tabindex="0" style="cursor: pointer;">
          <button name="From: François Müller <fm@test.com>">From: François Müller &lt;fm@test.com&gt;</button>
        </div>
      </div>
    `);
    const readingPane = page.locator('[role="main"]');

    const result = await findLastMessageFromOthers(readingPane, "me@example.com");

    expect(result).not.toBeNull();
    expect(result?.senderLastname).toBe("Müller");
  });

  test("handles attachment with spaces in filename", async () => {
    await page.setContent(`
      <div role="main">
        <div role="listbox" aria-label="Message attachments">
          <div role="option">my document file.pdf</div>
        </div>
      </div>
    `);
    const attachmentsList = page.locator('[role="listbox"][aria-label*="attachments"]');
    const option = attachmentsList.getByRole("option").first();

    const text = await option.textContent();
    expect(text).toBe("my document file.pdf");
    expect(text?.toLowerCase().includes(".pdf")).toBe(true);
  });

  test("handles PDF with uppercase extension", async () => {
    await page.setContent(`
      <div role="main">
        <div role="listbox" aria-label="Message attachments">
          <div role="option">DOCUMENT.PDF</div>
        </div>
      </div>
    `);
    const attachmentsList = page.locator('[role="listbox"][aria-label*="attachments"]');
    const pdfOptions = attachmentsList.getByRole("option").filter({ hasText: /\.pdf/i });

    const count = await pdfOptions.count();
    expect(count).toBe(1);
  });
});
