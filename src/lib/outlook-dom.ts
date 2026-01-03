import { type SignatureFormat, type SignaturePosition, signPdf } from "./pdf.js";
import {
  TIMING,
  downloadAttachment,
  expandMessage,
  expandThread,
  findAttachmentListbox,
  findLastMessageFromOthers,
  selectEmail,
} from "./outlook-actions.js";
import type { Page } from "playwright";
import { readFileSync } from "node:fs";
import { takeErrorScreenshot } from "../services/browser.js";

export { TIMING, findAttachmentListbox, findLastMessageFromOthers } from "./outlook-actions.js";

export interface PdfItem {
  conversationId: string;
  subject: string;
  senderLastname: string;
  signedPdf: Uint8Array;
}

export interface CollectPdfsOptions {
  myEmail: string;
  sigBytes: Uint8Array;
  sigFormat: SignatureFormat;
  signaturePosition: SignaturePosition;
}

export async function collectSignedPdfs(
  page: Page,
  options: CollectPdfsOptions,
): Promise<PdfItem[]> {
  const emailItems = page.locator("[data-convid]");
  const count = await emailItems.count();
  console.log(`  Found ${count} emails in folder\n`);

  console.log("=== Fetching & Signing PDFs ===\n");

  const items: PdfItem[] = [];

  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(TIMING.MENU_ANIMATION);

    console.log(`[${i + 1}/${count}] Opening email...`);
    const { conversationId, subject } = await selectEmail(page, i);
    console.log(`  Subject: "${subject}"`);
    console.log(`  ConversationId: ${conversationId}`);

    const expandClicks = await expandThread(page);
    if (expandClicks > 0) {
      console.log(`  Expanded ${expandClicks} time(s)`);
    }

    const readingPane = page.locator('[role="main"]');
    console.log(`  Looking for messages from others...`);
    const message = await findLastMessageFromOthers(readingPane, options.myEmail);

    if (!message) {
      console.log(`  -> No messages from others, skipping`);
      continue;
    }
    console.log(`  Found message from others`);

    console.log(`  Expanding message...`);
    await expandMessage(message);
    await page.waitForTimeout(TIMING.CONTENT_LOAD);

    console.log(`  Looking for attachments...`);
    const attachmentsList = await findAttachmentListbox(readingPane, message.button);

    if (!attachmentsList) {
      console.log(`  -> No attachments in last message, skipping`);
      continue;
    }

    const pdfOptions = attachmentsList.getByRole("option").filter({ hasText: /\.pdf/i });
    const pdfCount = await pdfOptions.count();
    if (pdfCount === 0) {
      console.log(`  -> No PDF attachments, skipping`);
      continue;
    }

    console.log(`  Found ${pdfCount} PDF(s), downloading...`);
    console.log(`  Sender: ${message.senderLastname}`);

    try {
      for (let j = 0; j < pdfCount; j += 1) {
        const option = pdfOptions.nth(j);
        const text = (await option.textContent()) ?? "";
        const originalFilename = text.match(/^(.+\.pdf)/i)?.[1] ?? "attachment.pdf";

        const download = await downloadAttachment(page, option);
        const downloadPath = await download.path();
        const pdfBytes = downloadPath ? readFileSync(downloadPath) : undefined;
        if (!pdfBytes) {
          console.log(`    ${originalFilename} - download failed`);
          continue;
        }

        const signedPdf = await signPdf({
          format: options.sigFormat,
          pdfBytes,
          position: options.signaturePosition,
          sigBytes: options.sigBytes,
        });
        items.push({ conversationId, senderLastname: message.senderLastname, signedPdf, subject });
        console.log(`    ${originalFilename} - signed`);
      }
    } catch (error) {
      console.error(
        `  -> Download/sign failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await takeErrorScreenshot(page, `download-fail-${i}`);
    }
  }

  return items;
}
