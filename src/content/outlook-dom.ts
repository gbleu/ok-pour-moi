import {
  expandMessage,
  expandThread,
  findAttachmentListbox,
  findLastMessageFromOthers,
  getPdfOptions,
} from "./outlook-actions.js";
import { downloadAttachment } from "./outlook-download.js";

export interface PdfAttachment {
  conversationId: string;
  originalFilename: string;
  pdfBytes: Uint8Array;
  senderEmail: string;
  senderLastname: string;
  subject: string;
}

function getConversationContext(): { conversationId: string; subject: string } | undefined {
  const readingPane = document.querySelector('[role="main"]');
  if (!readingPane) {
    return undefined;
  }

  const subjectEl = readingPane.querySelector('[role="heading"][aria-level="2"]');
  const subject = (subjectEl?.textContent ?? "Unknown")
    .trim()
    .replace(/Summarize$/, "")
    .trim();

  const selectedEmail = document.querySelector<HTMLElement>(
    '[data-convid][aria-selected="true"], [data-convid]:focus',
  );
  const conversationId = selectedEmail?.dataset.convid ?? "";

  return { conversationId, subject };
}

// Returns [] when no PDF is found (missing DOM state). Throws on download failure.
export async function collectPdfAttachment(myEmail: string): Promise<PdfAttachment[]> {
  const context = getConversationContext();
  if (!context) {
    return [];
  }

  const { subject, conversationId } = context;

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

  const [firstPdf] = getPdfOptions(attachmentsList);
  if (!firstPdf) {
    return [];
  }

  const originalFilename =
    (firstPdf.textContent ?? "").match(/^(.+\.pdf)/i)?.[1] ?? "attachment.pdf";

  const pdfBytes = await downloadAttachment(firstPdf);

  return [
    {
      conversationId,
      originalFilename,
      pdfBytes,
      senderEmail: message.senderEmail,
      senderLastname: message.senderLastname,
      subject,
    },
  ];
}
