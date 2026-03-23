import { TIMING, simulateKeyPress, sleep, typeText } from "./dom-utils.js";
import {
  attachFile,
  closeCompose,
  openReply,
  removeAllAttachments,
  saveDraft,
} from "./outlook-compose-actions.js";
import type { PdfItem } from "./outlook-dom.js";
import type { SyncStorage } from "#shared/storage.js";

export async function prepareDrafts(items: PdfItem[], config: SyncStorage): Promise<number> {
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

  if (errors.length > 0) {
    throw new Error(
      `${successCount}/${items.length} drafts succeeded. Failures: ${errors.join("; ")}`,
    );
  }

  return successCount;
}
