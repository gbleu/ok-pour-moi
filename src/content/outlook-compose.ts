import { TIMING, simulateKeyPress, sleep, typeText } from "./outlook-automation.js";
import {
  attachFile,
  closeCompose,
  openReply,
  removeAllAttachments,
  saveDraft,
} from "./outlook-compose-actions.js";
import type { PdfItem } from "./outlook-dom.js";
import type { WorkflowConfig } from "#shared/messages.js";

export interface DraftResult {
  errors: string[];
  successCount: number;
}

export async function prepareDrafts(
  items: PdfItem[],
  config: WorkflowConfig,
): Promise<DraftResult> {
  let successCount = 0;
  const errors: string[] = [];

  for (const [idx, item] of items.entries()) {
    simulateKeyPress("Escape");
    await sleep(TIMING.MENU_ANIMATION);

    try {
      const composeBody = await openReply(item.conversationId);
      composeBody.focus();
      typeText(composeBody, config.replyMessage);
      await removeAllAttachments();
      await attachFile(item.signedPdf, item.filename);
      await saveDraft();
      await sleep(TIMING.CONTENT_LOAD);
      await closeCompose();
      await sleep(TIMING.UI_SETTLE);
      successCount += 1;
    } catch (error) {
      errors.push(`[${idx + 1}] ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return { errors, successCount };
}
