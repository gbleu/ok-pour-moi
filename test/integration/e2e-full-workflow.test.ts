import { SCENARIOS_DIR, setupBrowserWithPdfRoute } from "./test-helper.js";
import {
  addCcRecipients,
  closeCompose,
  downloadAttachment,
  expandThread,
  findAttachmentListbox,
  findLastMessageFromOthers,
  moveToFolder,
  openReply,
  saveDraft,
  selectEmail,
  typeMessage,
} from "../../src/lib/outlook-actions.js";
import { describe, expect, test } from "bun:test";
import { collectSignedPdfs } from "../../src/lib/outlook-dom.js";
import { getSignatureFormat } from "../../src/lib/pdf.js";
import { join } from "node:path";

describe("E2E: Full workflow with comprehensive Outlook mock", () => {
  const { getPage } = setupBrowserWithPdfRoute();

  test("processes email thread: expand → find sender → download PDFs → reply with CC → move to inbox", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/full-outlook-mock.html`);

    // Given: folder selected with 2 emails
    const folder = page.getByRole("treeitem", { name: /ok pour moi/ });
    expect(await folder.textContent()).toContain("2");

    // Step 1: Select email and expand thread
    const { emailItem, conversationId, subject } = await selectEmail(page, 0);
    expect(await emailItem.getAttribute("class")).toContain("selected");
    expect(conversationId).toBeTruthy();
    expect(subject).toBeTruthy();

    const expandClicks = await expandThread(page);
    expect(expandClicks).toBeGreaterThanOrEqual(1);

    // Step 2: Find last message from sender (not me)
    const readingPane = page.locator('[role="main"]');
    const message = await findLastMessageFromOthers(readingPane, "me@example.com");
    expect(message).toBeDefined();
    expect(message?.senderLastname).toBe("Dupont");

    if (message?.row && (await message.row.count()) > 0) {
      await message.row.click();
    }

    if (!message) {
      throw new Error("Message not found");
    }

    // Step 3: Download PDF attachment
    const attachmentsList = await findAttachmentListbox(readingPane, message.button);
    expect(attachmentsList).toBeDefined();

    const pdfOptions = attachmentsList?.getByRole("option");
    expect(await pdfOptions?.count()).toBe(2);

    const firstPdf = pdfOptions?.first();
    expect(await firstPdf?.textContent()).toContain("contrat_location_2024.pdf");

    if (!firstPdf) {
      throw new Error("PDF option not found");
    }
    const download = await downloadAttachment(page, firstPdf);
    expect(download.suggestedFilename()).toBe("contrat_location_2024.pdf");

    // Step 4: Setup reply with CC (after download redirect)
    await page.goto(`file://${SCENARIOS_DIR}/full-outlook-mock.html`);
    await selectEmail(page, 0);
    await page.waitForTimeout(100);

    const composeBody = await openReply(page);
    expect(await page.locator('[aria-label="To"]').inputValue()).toBe("jean.dupont@example.com");

    await addCcRecipients(page, ["manager@example.com"]);
    const ccField = page.locator('[aria-label="Cc"]');
    expect(await ccField.isVisible()).toBe(true);

    await typeMessage(composeBody, "ok pour moi");
    expect(await composeBody.textContent()).toContain("ok pour moi");

    await saveDraft(page);
    await closeCompose(page);

    // Step 5: Move to inbox
    const { conversationId: convId } = await selectEmail(page, 0);
    await moveToFolder(page, convId, "Inbox");

    expect(await page.locator("[data-convid]").count()).toBe(1);
    expect(await page.getByRole("treeitem", { name: /ok pour moi/ }).textContent()).toContain("1");
  }, 60_000);

  test("handles email without thread (no See more button)", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/full-outlook-mock.html`);

    // Click second email (no thread) using app function
    await selectEmail(page, 1);

    // When: try to expand thread
    const expandClicks = await expandThread(page);

    // Then: no expansion needed
    expect(expandClicks).toBe(0);
  }, 30_000);

  test("tabs switch correctly between Home and Options", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/full-outlook-mock.html`);

    // Given: Home tab selected, Reply toolbar visible
    const homeTab = page.getByRole("tab", { name: "Home" });
    expect(await homeTab.getAttribute("aria-selected")).toBe("true");

    const replyBtn = page.getByRole("button", { name: /Reply$/ });
    expect(await replyBtn.isVisible()).toBe(true);

    // When: click Options tab
    const optionsTab = page.getByRole("tab", { name: "Options" });
    await optionsTab.click();

    // Then: Options selected, CC checkbox visible
    expect(await optionsTab.getAttribute("aria-selected")).toBe("true");
    expect(await homeTab.getAttribute("aria-selected")).toBe("false");

    const showCcCheckbox = page.getByRole("checkbox", { name: "Show Cc" });
    expect(await showCcCheckbox.isVisible()).toBe(true);
  }, 30_000);

  test("discard dialog appears when escaping compose with content", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/full-outlook-mock.html`);

    // Open reply using app function
    const composeBody = await openReply(page);
    await typeMessage(composeBody, "test message");

    // Press Escape
    await page.keyboard.press("Escape");

    // Then: discard dialog appears
    const dialog = page.getByRole("dialog");
    expect(await dialog.isVisible()).toBe(true);
    expect(await dialog.textContent()).toContain("Discard draft");

    // When: click Cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Then: dialog closes, compose still visible
    expect(await dialog.isHidden()).toBe(true);
    expect(await composeBody.isVisible()).toBe(true);
  }, 30_000);

  test("collectSignedPdfs processes emails and signs PDFs", async () => {
    const page = getPage();
    await page.goto(`file://${SCENARIOS_DIR}/full-outlook-mock.html`);

    // Given: signature fixture
    const sigPath = join(import.meta.dir, "../fixtures/signature.png");
    const sigBytes = new Uint8Array(await Bun.file(sigPath).arrayBuffer());
    const sigFormat = getSignatureFormat(sigPath);

    // When: collect signed PDFs
    const items = await collectSignedPdfs(page, {
      myEmail: "me@example.com",
      sigBytes,
      sigFormat,
      signaturePosition: { height: 50, width: 200, x: 100, y: 100 },
    });

    // Then: PDFs collected and signed (2 emails × 2 PDFs each = 4 items)
    expect(items.length).toBe(4);
    expect(
      items.map((i) => ({ conversationId: i.conversationId, senderLastname: i.senderLastname })),
    ).toEqual([
      { conversationId: "conv-001", senderLastname: "Dupont" },
      { conversationId: "conv-001", senderLastname: "Dupont" },
      { conversationId: "conv-002", senderLastname: "Dupont" },
      { conversationId: "conv-002", senderLastname: "Dupont" },
    ]);
    expect(items.every((i) => i.signedPdf.length > 0)).toBe(true);
  }, 60_000);
});
