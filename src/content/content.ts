/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Chrome message listeners require callbacks */
import type { PopupToContentMessage, WorkflowConfig, WorkflowResult } from "../shared/messages.js";
import { collectSignedPdfs } from "./outlook-dom.js";
import { getSyncStorage } from "../shared/storage.js";
import { prepareDrafts } from "./outlook-compose.js";

console.log("[OPM] Content script loaded - v2025-01-05-B (simplified: Reply + manual selection)");

async function runWorkflow(config: WorkflowConfig): Promise<WorkflowResult> {
  console.log("[OPM] Starting workflow with config:", config);

  try {
    // User has already selected the conversation - collect PDFs from current view
    const items = await collectSignedPdfs(config);

    if (items.length === 0) {
      return {
        message: "No PDFs found in current conversation",
        processed: 0,
        success: true,
      };
    }

    console.log(`[OPM] Collected ${items.length} signed PDFs`);

    const successCount = await prepareDrafts(items, config);

    return {
      message: `Processed ${successCount}/${items.length} emails`,
      processed: successCount,
      success: true,
    };
  } catch (error) {
    console.error("[OPM] Workflow error:", error);
    return {
      message: error instanceof Error ? error.message : "Unknown error",
      processed: 0,
      success: false,
    };
  }
}

// Debug trigger: press Ctrl+Shift+O to start workflow
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.shiftKey && ["O", "o"].includes(event.key)) {
    console.log("[OPM] Debug trigger: Ctrl+Shift+O pressed");
    (async (): Promise<void> => {
      const sync = await getSyncStorage();
      const config: WorkflowConfig = {
        myEmail: sync.myEmail,
        replyMessage: sync.replyMessage,
        signaturePosition: sync.signaturePosition,
      };
      const result = await runWorkflow(config);
      console.log("[OPM] Debug workflow result:", result);
    })().catch((error: unknown) => {
      console.error("[OPM] Debug workflow error:", error);
    });
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: PopupToContentMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: WorkflowResult) => void,
  ) => {
    if (message.type === "START_WORKFLOW") {
      runWorkflow(message.config)
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse({
            message: error instanceof Error ? error.message : "Unknown error",
            processed: 0,
            success: false,
          });
        });
      return true;
    }

    if (message.type === "GET_EMAIL_COUNT") {
      const count = document.querySelectorAll("[data-convid]").length;
      sendResponse({ message: `Found ${count} emails`, processed: count, success: true });
      return false;
    }

    return false;
  },
);
