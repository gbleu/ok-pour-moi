import type { SignPdfResponse, WorkflowConfig } from "../shared/messages.js";
import {
  downloadAttachment,
  expandMessage,
  expandThread,
  findAttachmentListbox,
  findLastMessageFromOthers,
  getPdfOptions,
} from "./outlook-actions.js";

export interface PdfItem {
  conversationId: string;
  filename: string;
  senderLastname: string;
  senderEmail: string;
  signedPdf: Uint8Array;
  subject: string;
}

export async function collectSignedPdfs(
  config: WorkflowConfig,
  onProgress?: (current: number, total: number, subject: string) => void,
): Promise<PdfItem[]> {
  const items: PdfItem[] = [];

  const readingPane = document.querySelector('[role="main"]');
  if (readingPane === null) {
    console.log("[OPM] No reading pane - select a conversation first");
    return items;
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

  console.log(`[OPM] Subject: "${subject}"`);
  onProgress?.(1, 1, subject);

  await expandThread();

  const message = findLastMessageFromOthers(config.myEmail);
  if (message === undefined) {
    console.log("[OPM] No messages from others found");
    return items;
  }

  await expandMessage(message.element);

  const attachmentsList = findAttachmentListbox(message.element);
  if (attachmentsList === undefined) {
    console.log("[OPM] No attachments found");
    return items;
  }

  const pdfOptions = getPdfOptions(attachmentsList);
  const [firstPdf] = pdfOptions;
  if (firstPdf === undefined) {
    console.log("[OPM] No PDF attachments found");
    return items;
  }

  const text = firstPdf.textContent ?? "";
  const originalFilename = text.match(/^(.+\.pdf)/i)?.[1] ?? "attachment.pdf";

  try {
    const pdfBytes = await downloadAttachment(firstPdf);

    const response = await chrome.runtime.sendMessage<
      {
        payload: { originalFilename: string; pdfBytes: number[]; senderLastname: string };
        type: "SIGN_PDF";
      },
      SignPdfResponse
    >({
      payload: {
        originalFilename,
        pdfBytes: [...pdfBytes],
        senderLastname: message.senderLastname,
      },
      type: "SIGN_PDF",
    });

    if (!response.success || response.signedPdf === undefined || response.filename === undefined) {
      console.error(`[OPM] Signing failed: ${response.error}`);
      return items;
    }

    items.push({
      conversationId,
      filename: response.filename,
      senderEmail: message.senderEmail,
      senderLastname: message.senderLastname,
      signedPdf: new Uint8Array(response.signedPdf),
      subject,
    });
    console.log(`[OPM] Signed: ${response.filename}`);
  } catch (error) {
    console.error(`[OPM] Download failed:`, error);
  }

  return items;
}
