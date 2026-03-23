/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Chrome message listeners require callbacks */
import type { PopupToContentMessage, WorkflowResult } from "#shared/messages.js";
import { type SyncStorage, getSyncStorage } from "#shared/storage.js";
import { collectSignedPdfs } from "./outlook-dom.js";
import { prepareDrafts } from "./outlook-compose.js";

async function runWorkflow(config: SyncStorage): Promise<WorkflowResult> {
  try {
    const items = await collectSignedPdfs(config);

    if (items.length === 0) {
      return { message: "No PDFs found in current conversation", success: true };
    }

    const { successCount, errors } = await prepareDrafts(items, config);

    if (errors.length > 0) {
      return {
        message: `${successCount}/${items.length} drafts. Failures: ${errors.join("; ")}`,
        success: false,
      };
    }

    return {
      message: `Processed ${successCount}/${items.length} emails`,
      success: true,
    };
  } catch (error) {
    console.error("[OPM] Workflow error:", error);
    return {
      message: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "o") {
    (async (): Promise<void> => {
      const config = await getSyncStorage();
      await runWorkflow(config);
    })().catch((error: unknown) => {
      console.error("[OPM] Debug workflow error:", error);
    });
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: PopupToContentMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: WorkflowResult) => void,
  ) => {
    if (sender.id !== chrome.runtime.id) {
      return false;
    }

    runWorkflow(message.config)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          message: error instanceof Error ? error.message : "Unknown error",
          success: false,
        });
      });
    return true;
  },
);
