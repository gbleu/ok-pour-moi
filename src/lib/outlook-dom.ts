import type { Locator, Page } from "playwright";
import { type SignatureFormat, extractLastname, generateAttachmentName, signPdf } from "./pdf.js";
import { config } from "../config.js";
import { readFileSync } from "node:fs";
import { takeErrorScreenshot } from "../services/browser.js";

export { config, generateAttachmentName, takeErrorScreenshot };
export { escapeCssValue } from "./css.js";

export interface PdfItem {
  conversationId: string;
  subject: string;
  senderLastname: string;
  signedPdf: Uint8Array;
}

export const TIMING = {
  CC_CHECKBOX: 3000,
  CC_FIELD: 5000,
  CONTENT_LOAD: 1000,
  DOWNLOAD_MENU: 5000,
  ELEMENT_VISIBLE: 10_000,
  FILE_CHOOSER: 10_000,
  MENU_ANIMATION: 300,
  MOVE_MENU: 5000,
  UI_SETTLE: 500,
  UPLOAD_COMPLETE: 2000,
} as const;

// XPath Selectors Documentation:
// These selectors are tightly coupled to Outlook Web's DOM structure.
// If Outlook updates break automation, check these selectors first.
//
// MESSAGE_ROW_XPATH: Finds the clickable message container from the "From:" button.
// - Outlook renders each message with a "From:" button inside a clickable row
// - The row has cursor:pointer style or tabindex for keyboard navigation
// - We click the row (not the button) to avoid opening the contact card popup
const MESSAGE_ROW_XPATH = "xpath=ancestor::*[contains(@style, 'cursor') or @tabindex][1]";

// ATTACHMENTS_FOLLOWING_XPATH: Finds the attachments listbox after a message's From button.
// - In Outlook, each message's attachments appear in a listbox element
// - The listbox follows the message content in DOM order
// - aria-label contains "attachments" for accessibility
const ATTACHMENTS_FOLLOWING_XPATH =
  'xpath=following::*[@role="listbox"][contains(@aria-label, "attachments")][1]';

// DRAFT_MARKER_XPATH: Detects if a listbox belongs to a draft message.
// - Draft messages show "[Draft]" text in their header area
// - We look up to 8 ancestors to find the message container with draft marker
// - This helps skip our own draft attachments when looking for received files
const DRAFT_MARKER_XPATH = "xpath=ancestor::*[position() <= 8]//*[contains(text(), '[Draft]')]";

export async function findLastMessageFromOthers(
  readingPane: Locator,
  myEmail: string = config.myEmail,
): Promise<{ row: Locator; button: Locator; senderLastname: string } | undefined> {
  const fromButtons = readingPane.getByRole("button", { name: /^From:/ });
  const count = await fromButtons.count();

  for (let i = count - 1; i >= 0; i -= 1) {
    const btn = fromButtons.nth(i);
    const fromText = (await btn.textContent()) ?? "";
    if (!fromText.toLowerCase().includes(myEmail.toLowerCase())) {
      const row = btn.locator(MESSAGE_ROW_XPATH);
      const senderLastname = extractLastname(fromText);
      return { button: btn, row, senderLastname };
    }
  }
  return undefined;
}

export async function findAttachmentListbox(
  readingPane: Locator,
  messageButton: Locator,
): Promise<Locator | undefined> {
  const following = messageButton.locator(ATTACHMENTS_FOLLOWING_XPATH);
  if ((await following.count()) > 0) {
    return following.first();
  }

  // Fallback: find last non-draft listbox
  const allLists = readingPane.getByRole("listbox", { name: /attachments/i });
  const count = await allLists.count();

  for (let i = count - 1; i >= 0; i -= 1) {
    const lb = allLists.nth(i);
    const draftMarker = lb.locator(DRAFT_MARKER_XPATH);
    if ((await draftMarker.count()) === 0) {
      return lb;
    }
  }

  return undefined;
}

export async function downloadAndSignPdfs(opts: {
  page: Page;
  attachmentsList: Locator;
  conversationId: string;
  subject: string;
  senderLastname: string;
  sigBytes: Uint8Array;
  sigFormat: SignatureFormat;
}): Promise<PdfItem[]> {
  const { page, attachmentsList, conversationId, subject, senderLastname, sigBytes, sigFormat } =
    opts;
  const items: PdfItem[] = [];
  const options = attachmentsList.getByRole("option");
  const count = await options.count();

  for (let i = 0; i < count; i += 1) {
    const option = options.nth(i);
    const text = (await option.textContent()) ?? "";
    if (!text.toLowerCase().includes(".pdf")) {
      continue;
    }

    const originalFilename = text.match(/^(.+\.pdf)/i)?.[1] ?? "attachment.pdf";

    await option.click({ button: "right" });
    const downloadMenuItem = page.getByRole("menuitem", { name: /download/i });
    await downloadMenuItem.waitFor({
      state: "visible",
      timeout: TIMING.DOWNLOAD_MENU,
    });

    const [download] = await Promise.all([page.waitForEvent("download"), downloadMenuItem.click()]);

    const pdfBytes = await download.path().then((path) => (path ? readFileSync(path) : undefined));
    if (!pdfBytes) {
      console.log(`    ${originalFilename} - download failed`);
      continue;
    }

    const signedPdf = await signPdf({
      format: sigFormat,
      pdfBytes,
      position: config.signature,
      sigBytes,
    });
    items.push({ conversationId, senderLastname, signedPdf, subject });
    console.log(`    ${originalFilename} - signed`);
  }

  return items;
}

export async function collectSignedPdfs(
  page: Page,
  sigBytes: Uint8Array,
  sigFormat: SignatureFormat,
): Promise<PdfItem[]> {
  const emailItems = page.locator("[data-convid]");
  const count = await emailItems.count();
  console.log(`  Found ${count} emails in folder\n`);

  console.log("=== Fetching & Signing PDFs ===\n");

  const items: PdfItem[] = [];

  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(TIMING.MENU_ANIMATION);

    const emailItem = emailItems.nth(i);
    console.log(`[${i + 1}/${count}] Opening email...`);
    await emailItem.click();

    const conversationId = (await emailItem.getAttribute("data-convid")) ?? "";
    const subjectEl = page.locator('[role="main"] [role="heading"][aria-level="2"]').first();
    await subjectEl.waitFor({
      state: "visible",
      timeout: TIMING.ELEMENT_VISIBLE,
    });
    const subject = ((await subjectEl.textContent()) ?? "Unknown")
      .trim()
      .replace(/Summarize$/, "")
      .trim();
    console.log(`  Subject: "${subject}"`);
    console.log(`  ConversationId: ${conversationId}`);

    const readingPane = page.locator('[role="main"]');

    let expandClicks = 0;
    let noButtonCount = 0;
    while (noButtonCount < 2) {
      await page.waitForTimeout(TIMING.CONTENT_LOAD);
      const seeMoreBtn = readingPane.getByRole("button", { name: "See more messages" }).first();
      if ((await seeMoreBtn.count()) === 0) {
        noButtonCount += 1;
        continue;
      }
      noButtonCount = 0;
      expandClicks += 1;
      console.log(`  Expanding conversation... (click ${expandClicks})`);
      await seeMoreBtn.click();
    }
    if (expandClicks > 0) {
      console.log(`  Expanded ${expandClicks} time(s)`);
    }

    console.log(`  Looking for messages from others...`);
    const message = await findLastMessageFromOthers(readingPane);

    if (!message) {
      console.log(`  -> No messages from others, skipping`);
      continue;
    }
    console.log(`  Found message from others`);

    console.log(`  Expanding message...`);
    if ((await message.row.count()) > 0) {
      await message.row.click();
    } else {
      await message.button.click({ position: { x: -50, y: 0 } });
    }
    await page.waitForTimeout(TIMING.CONTENT_LOAD);

    console.log(`  Looking for attachments...`);
    const attachmentsList = await findAttachmentListbox(readingPane, message.button);

    if (!attachmentsList) {
      console.log(`  -> No attachments in last message, skipping`);
      continue;
    }

    const pdfCount = await attachmentsList
      .getByRole("option")
      .filter({ hasText: /\.pdf/i })
      .count();
    if (pdfCount === 0) {
      console.log(`  -> No PDF attachments, skipping`);
      continue;
    }

    console.log(`  Found ${pdfCount} PDF(s), downloading...`);
    console.log(`  Sender: ${message.senderLastname}`);
    try {
      const newItems = await downloadAndSignPdfs({
        attachmentsList,
        conversationId,
        page,
        senderLastname: message.senderLastname,
        sigBytes,
        sigFormat,
        subject,
      });
      items.push(...newItems);
    } catch (error) {
      console.error(
        `  -> Download/sign failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await takeErrorScreenshot(page, `download-fail-${i}`);
    }
  }

  return items;
}
