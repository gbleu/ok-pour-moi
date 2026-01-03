import { describe, expect, test } from "bun:test";
import {
  findAttachmentListbox,
  findLastMessageFromOthers,
} from "../../src/commands/run.js";
import { SCENARIOS_DIR, setupBrowser } from "./test-helper.js";

describe("Integration: end-to-end scenarios", () => {
  const { getPage } = setupBrowser();

  test("multi-message-thread: correctly identifies sender's last message", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/multi-message-thread.html`);

    const seeMoreBtn = page.getByRole("button", { name: "See more messages" });
    if (await seeMoreBtn.isVisible()) {
      await seeMoreBtn.click();
    }

    const readingPane = page.locator('[role="main"]');
    const result = await findLastMessageFromOthers(
      readingPane,
      "me@example.com",
    );

    expect(result).toBeDefined();
    expect(result?.senderLastname).toBe("Doe");

    if (result) {
      const attachments = await findAttachmentListbox(
        readingPane,
        result.button,
      );
      expect(attachments).toBeDefined();
    }
  });

  test("draft-with-attachments: finds original sender's attachments, not draft", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/draft-with-attachments.html`);
    const readingPane = page.locator('[role="main"]');

    const message = await findLastMessageFromOthers(
      readingPane,
      "me@example.com",
    );
    expect(message).toBeDefined();
    expect(message?.senderLastname).toBe("Brown");

    if (message) {
      const attachments = await findAttachmentListbox(
        readingPane,
        message.button,
      );
      expect(attachments).toBeDefined();

      const options = await attachments?.getByRole("option").allTextContents();
      expect(
        options?.some((text) => text.includes("invoice_2024_001.pdf")),
      ).toBe(true);
    }
  });

  test("no-attachments: gracefully handles missing attachments", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/no-attachments.html`);
    const readingPane = page.locator('[role="main"]');

    const message = await findLastMessageFromOthers(
      readingPane,
      "me@example.com",
    );
    expect(message).toBeDefined();
    expect(message?.senderLastname).toBe("Wilson");

    if (message) {
      const attachments = await findAttachmentListbox(
        readingPane,
        message.button,
      );
      expect(attachments).toBeUndefined();
    }
  });

  test("folder navigation works correctly", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/single-pdf.html`);

    const folder = page.getByRole("treeitem", { name: "ok pour moi" });
    expect(await folder.isVisible()).toBe(true);
    expect(await folder.getAttribute("class")).toContain("selected");
  });

  test("email items have data-convid attribute", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/single-pdf.html`);

    const emailItems = page.locator("[data-convid]");
    const count = await emailItems.count();
    expect(count).toBeGreaterThan(0);

    const convId = await emailItems.first().getAttribute("data-convid");
    expect(convId).toBe("conv-001");
  });

  test("subject heading is accessible", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/single-pdf.html`);

    const subject = page.locator('[role="heading"][aria-level="2"]');
    const text = await subject.textContent();
    expect(text).toBe("Document for signature");
  });

  test("handles empty email list", async () => {
    const page = getPage();
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
    const page = getPage();
    await page.setContent(`
      <div role="main">
        <div tabindex="0" style="cursor: pointer;">
          <button name="From: ">From: </button>
        </div>
      </div>
    `);
    const readingPane = page.locator('[role="main"]');

    const result = await findLastMessageFromOthers(
      readingPane,
      "me@example.com",
    );

    expect(result).toBeDefined();
    expect(result?.senderLastname).toBe("Unknown");
  });

  test("handles special characters in sender name", async () => {
    const page = getPage();
    await page.setContent(`
      <div role="main">
        <div tabindex="0" style="cursor: pointer;">
          <button name="From: O'Brien-Smith <obrien@test.com>">From: O'Brien-Smith &lt;obrien@test.com&gt;</button>
        </div>
      </div>
    `);
    const readingPane = page.locator('[role="main"]');

    const result = await findLastMessageFromOthers(
      readingPane,
      "me@example.com",
    );

    expect(result).toBeDefined();
    expect(result?.senderLastname).toBe("O'Brien-Smith");
  });

  test("handles unicode in sender name", async () => {
    const page = getPage();
    await page.setContent(`
      <div role="main">
        <div tabindex="0" style="cursor: pointer;">
          <button name="From: François Müller <fm@test.com>">From: François Müller &lt;fm@test.com&gt;</button>
        </div>
      </div>
    `);
    const readingPane = page.locator('[role="main"]');

    const result = await findLastMessageFromOthers(
      readingPane,
      "me@example.com",
    );

    expect(result).toBeDefined();
    expect(result?.senderLastname).toBe("Müller");
  });

  test("handles attachment with spaces in filename", async () => {
    const page = getPage();
    await page.setContent(`
      <div role="main">
        <div role="listbox" aria-label="Message attachments">
          <div role="option">my document file.pdf</div>
        </div>
      </div>
    `);
    const attachmentsList = page.locator(
      '[role="listbox"][aria-label*="attachments"]',
    );
    const option = attachmentsList.getByRole("option").first();

    const text = await option.textContent();
    expect(text).toBe("my document file.pdf");
    expect(text?.toLowerCase().includes(".pdf")).toBe(true);
  });

  test("handles PDF with uppercase extension", async () => {
    const page = getPage();
    await page.setContent(`
      <div role="main">
        <div role="listbox" aria-label="Message attachments">
          <div role="option">DOCUMENT.PDF</div>
        </div>
      </div>
    `);
    const attachmentsList = page.locator(
      '[role="listbox"][aria-label*="attachments"]',
    );
    const pdfOptions = attachmentsList
      .getByRole("option")
      .filter({ hasText: /\.pdf/i });

    const count = await pdfOptions.count();
    expect(count).toBe(1);
  });
});
