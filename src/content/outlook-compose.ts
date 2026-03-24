import { getErrorMessage } from "#shared/errors.js";

import { TIMING, simulateKeyPress, sleep, typeText } from "./outlook-automation.js";
import {
  attachFile,
  closeCompose,
  openReply,
  removeAllAttachments,
  saveDraft,
} from "./outlook-compose-actions.js";
export interface SignedPdfItem {
  readonly conversationId: string;
  readonly filename: string;
  readonly senderEmail: string;
  readonly senderLastname: string;
  readonly signedPdf: Uint8Array;
  readonly subject: string;
}

export interface DraftResult {
  readonly errors: readonly string[];
  readonly successCount: number;
}

export async function prepareDrafts(
  items: readonly SignedPdfItem[],
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
