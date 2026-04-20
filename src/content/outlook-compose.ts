import { getErrorMessage } from "#shared/errors.js";
import { type DraftError } from "#shared/messages.js";

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
  readonly signedPdf: Uint8Array;
}

export interface DraftResult {
  readonly errors: readonly DraftError[];
  readonly successCount: number;
}

// Sequential: Outlook allows only one compose window at a time
export async function prepareDrafts(
  items: readonly SignedPdfItem[],
  replyMessage: string,
): Promise<DraftResult> {
  let successCount = 0;
  const errors: DraftError[] = [];

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
      errors.push({ index: idx + 1, message: getErrorMessage(error) });
    }
  }

  return { errors, successCount };
}
