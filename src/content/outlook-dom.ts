import {
  expandMessage,
  expandThread,
  findAttachmentListbox,
  findLastMessageFromOthers,
  findPdfOptions,
} from "./outlook-actions.js";
import { downloadAttachment } from "./outlook-download.js";

export interface PdfAttachment {
  readonly conversationId: string;
  readonly pdfBytes: Uint8Array;
  readonly senderLastname: string;
}

function findConversationId(): string | undefined {
  const readingPane = document.querySelector('[role="main"]');
  if (!readingPane) {
    return undefined;
  }

  const selectedEmail = document.querySelector<HTMLElement>(
    '[data-convid][aria-selected="true"], [data-convid]:focus',
  );
  const conversationId = selectedEmail?.dataset.convid ?? "";
  return conversationId === "" ? undefined : conversationId;
}

// Returns [] when no PDF is found (missing DOM state). Throws on expand or download failure.
// Currently returns at most one attachment but the array contract allows future extension.
export async function collectPdfAttachments(myEmail: string): Promise<PdfAttachment[]> {
  const conversationId = findConversationId();
  if (conversationId === undefined) {
    return [];
  }

  await expandThread();

  const message = findLastMessageFromOthers(myEmail);
  if (!message) {
    return [];
  }

  await expandMessage(message.element);

  const attachmentsList = findAttachmentListbox(message.element);
  if (!attachmentsList) {
    return [];
  }

  const [firstPdf] = findPdfOptions(attachmentsList);
  if (!firstPdf) {
    return [];
  }

  const pdfBytes = await downloadAttachment(firstPdf);

  return [
    {
      conversationId,
      pdfBytes,
      senderLastname: message.senderLastname,
    },
  ];
}
