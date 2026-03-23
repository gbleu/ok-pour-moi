import type {
  ContentToBackgroundMessage,
  SignPdfResponse,
  WorkflowConfig,
} from "#shared/messages.js";
import {
  expandMessage,
  expandThread,
  findAttachmentListbox,
  findLastMessageFromOthers,
  getPdfOptions,
} from "./outlook-actions.js";
import { downloadAttachment } from "./outlook-download.js";

export interface PdfItem {
  conversationId: string;
  filename: string;
  senderLastname: string;
  senderEmail: string;
  signedPdf: Uint8Array;
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

export async function collectSignedPdfs(config: WorkflowConfig): Promise<PdfItem[]> {
  const context = getConversationContext();
  if (!context) {
    return [];
  }

  const { subject, conversationId } = context;

  await expandThread();

  const message = findLastMessageFromOthers(config.myEmail);
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

  try {
    const pdfBytes = await downloadAttachment(firstPdf);

    const response = await chrome.runtime.sendMessage<ContentToBackgroundMessage, SignPdfResponse>({
      payload: {
        originalFilename,
        pdfBytes: [...pdfBytes],
        senderLastname: message.senderLastname,
      },
      type: "SIGN_PDF",
    });

    if (!response.success) {
      throw new Error(`Signing failed: ${response.error}`);
    }

    return [
      {
        conversationId,
        filename: response.filename,
        senderEmail: message.senderEmail,
        senderLastname: message.senderLastname,
        signedPdf: new Uint8Array(response.signedPdf),
        subject,
      },
    ];
  } catch (error) {
    throw error instanceof Error ? error : new Error("Download failed");
  }
}
