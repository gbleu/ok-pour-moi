import { TIMING, simulateKeyPress, sleep } from "./dom-utils.js";
import {
  addCcRecipients,
  attachFile,
  closeCompose,
  moveToFolder,
  openReply,
  saveDraft,
  typeMessage,
} from "./outlook-actions.js";
import type { PdfItem } from "./outlook-dom.js";
import type { WorkflowConfig } from "../shared/messages.js";

export async function prepareDrafts(
  items: PdfItem[],
  config: WorkflowConfig,
  onProgress?: (current: number, total: number, subject: string) => void,
): Promise<number> {
  console.log(`[OPM] Preparing ${items.length} draft(s)`);

  let successCount = 0;

  for (const [idx, item] of items.entries()) {
    simulateKeyPress("Escape");
    await sleep(TIMING.MENU_ANIMATION);

    console.log(`[OPM] [${idx + 1}/${items.length}] "${item.subject}" -> ${item.filename}`);
    onProgress?.(idx + 1, items.length, item.subject);

    try {
      console.log(`[OPM]   Opening reply...`);
      const composeBody = await openReply(item.conversationId);

      console.log(`[OPM]   Typing message...`);
      typeMessage(composeBody, config.replyMessage);

      console.log(`[OPM]   Attaching signed PDF...`);
      await attachFile(item.signedPdf, item.filename);

      if (config.ccEnabled && config.ccEmails.length > 0) {
        console.log(`[OPM]   Adding CC: ${config.ccEmails.join("; ")}`);
        await addCcRecipients(config.ccEmails, composeBody);
      }

      console.log(`[OPM]   Saving draft...`);
      await saveDraft();
      await closeCompose();

      console.log(`[OPM]   Moving to Inbox...`);
      await moveToFolder(item.conversationId, "Inbox");

      console.log(`[OPM]   -> Done`);
      successCount += 1;
    } catch (error) {
      console.error(`[OPM]   -> Failed:`, error);
    }
  }

  return successCount;
}
