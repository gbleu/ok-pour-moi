import { TIMING, simulateKeyPress, sleep, typeText } from "./outlook-automation.js";
import {
  attachFile,
  closeCompose,
  openReply,
  removeAllAttachments,
  saveDraft,
} from "./outlook-compose-actions.js";
import { getErrorMessage } from "#shared/errors.js";
export interface SignedPdfItem {
  conversationId: string;
  filename: string;
  senderEmail: string;
  senderLastname: string;
  signedPdf: Uint8Array;
  subject: string;
}

export interface DraftResult {
  errors: string[];
  successCount: number;
}

export async function prepareDrafts(
  items: SignedPdfItem[],
  replyMessage: string,
): Promise<DraftResult> {
  let successCount = 0;
  const errors: string[] = [];

  for (const [idx, item] of items.entries()) {
    simulateKeyPress("Escape");
    await sleep(TIMING.MENU_ANIMATION);

    try {
      const composeBody = await openReply(item.conversationId);
      composeBody.focus();
      typeText(composeBody, replyMessage);
      await removeAllAttachments();
      await attachFile(item.signedPdf, item.filename);
      await saveDraft();
      await sleep(TIMING.CONTENT_LOAD);
      await closeCompose();
      await sleep(TIMING.UI_SETTLE);
      successCount += 1;
    } catch (error) {
      errors.push(`[${idx + 1}] ${getErrorMessage(error)}`);
    }
  }

  return { errors, successCount };
}
