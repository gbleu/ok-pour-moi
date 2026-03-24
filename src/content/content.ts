import { getErrorMessage } from "#shared/errors.js";
/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Chrome message listeners require callbacks */
import {
  type ContentToBackgroundMessage,
  type PopupToContentMessage,
  type SignPdfResponse,
  type WorkflowConfig,
  type WorkflowResult,
} from "#shared/messages.js";
import { getSyncStorage } from "#shared/storage.js";

import { prepareDrafts } from "./outlook-compose.js";
import { collectPdfAttachment } from "./outlook-dom.js";

function signPdf(
  pdfBytes: Uint8Array,
  originalFilename: string,
  senderLastname: string,
): Promise<SignPdfResponse> {
  return chrome.runtime.sendMessage<ContentToBackgroundMessage, SignPdfResponse>({
    payload: { originalFilename, pdfBytes: [...pdfBytes], senderLastname },
    type: "SIGN_PDF",
  });
}

async function runWorkflow(config: WorkflowConfig): Promise<WorkflowResult> {
  try {
    const attachments = await collectPdfAttachment(config.myEmail);

    if (attachments.length === 0) {
      return { message: "No PDFs found in current conversation", success: true };
    }

    const items = await Promise.all(
      attachments.map(async (attachment) => {
        const response = await signPdf(
          attachment.pdfBytes,
          attachment.originalFilename,
          attachment.senderLastname,
        );

        if (!response.success) {
          throw new Error(`Signing failed: ${response.error}`);
        }

        return {
          conversationId: attachment.conversationId,
          filename: response.filename,
          senderEmail: attachment.senderEmail,
          senderLastname: attachment.senderLastname,
          signedPdf: new Uint8Array(response.signedPdf),
          subject: attachment.subject,
        };
      }),
    );

    const { successCount, errors } = await prepareDrafts(items, config.replyMessage);

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
    return { message: getErrorMessage(error), success: false };
  }
}

document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "o") {
    (async (): Promise<void> => {
      const sync = await getSyncStorage();
      await runWorkflow({
        myEmail: sync.myEmail,
        replyMessage: sync.replyMessage,
      });
    })().catch((error: unknown) => {
      console.error("[OPM] Debug workflow error:", error);
    });
  }
});

chrome.runtime.onMessage.addListener(
  // eslint-disable-next-line typescript-eslint/strict-void-return -- Chrome onMessage requires boolean return to keep channel open
  (
    message: PopupToContentMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: WorkflowResult) => void,
  ): boolean => {
    if (sender.id !== chrome.runtime.id) {
      return false;
    }

    runWorkflow(message.config)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({ message: getErrorMessage(error), success: false });
      });
    return true;
  },
);
