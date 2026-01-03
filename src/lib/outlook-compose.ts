import {
  TIMING,
  addCcRecipients,
  attachFile,
  closeCompose,
  moveToFolder,
  openReply,
  saveDraft,
  typeMessage,
} from "./outlook-actions.js";
import type { Page } from "playwright";
import type { PdfItem } from "./outlook-dom.js";
import { createTempRunDir } from "./temp-files.js";
import { formatError } from "./error.js";
import { generateAttachmentName } from "./pdf.js";
import { takeErrorScreenshot } from "../services/browser.js";

export interface PrepareDraftsOptions {
  ccEmails: string[];
  replyMessage: string;
}

export async function prepareDrafts(
  page: Page,
  items: PdfItem[],
  options: PrepareDraftsOptions,
): Promise<void> {
  console.log(`\n=== Preparing ${items.length} Draft(s) ===\n`);

  const tempDir = createTempRunDir();

  try {
    for (const [idx, item] of items.entries()) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(TIMING.MENU_ANIMATION);

      const attachmentName = generateAttachmentName(item.senderLastname, new Date());
      console.log(`\n[${idx + 1}/${items.length}] "${item.subject}" -> ${attachmentName}`);

      console.log(`  Opening reply...`);
      let composeBody;
      try {
        composeBody = await openReply(page, item.conversationId);
      } catch (error) {
        console.log(`  -> ${formatError(error)}, skipping`);
        await takeErrorScreenshot(page, `reply-fail-${idx}`);
        continue;
      }

      if (options.ccEmails.length > 0) {
        console.log(`  Adding CC: ${options.ccEmails.join("; ")}`);
        try {
          await addCcRecipients(page, options.ccEmails);
        } catch (error) {
          console.log(`  -> ${formatError(error)}, skipping`);
          await takeErrorScreenshot(page, `cc-fail-${idx}`);
          continue;
        }
      }

      const tmpPath = tempDir.filePath(attachmentName);
      await Bun.write(tmpPath, item.signedPdf);

      console.log(`  Attaching signed PDF...`);
      try {
        await attachFile(page, tmpPath);
      } catch (error) {
        console.log(`  -> ${formatError(error)}, skipping`);
        await takeErrorScreenshot(page, `attach-fail-${idx}`);
        continue;
      } finally {
        tempDir.cleanupFile(tmpPath);
      }

      console.log(`  Saving draft...`);
      await typeMessage(composeBody, options.replyMessage);
      await saveDraft(page);
      await closeCompose(page);

      console.log(`  Moving to Inbox...`);
      try {
        await moveToFolder(page, item.conversationId, "Inbox");
        console.log(`  -> Done`);
      } catch (error) {
        console.log(`  -> ${formatError(error)}`);
        await takeErrorScreenshot(page, `move-fail-${idx}`);
      }
    }
  } finally {
    tempDir.cleanup();
  }
}
