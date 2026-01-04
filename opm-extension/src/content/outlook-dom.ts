import type { SignPdfResponse, WorkflowConfig } from "../shared/messages.js";
import { TIMING, simulateKeyPress, sleep } from "./dom-utils.js";
import {
  downloadAttachment,
  expandMessage,
  expandThread,
  findAttachmentListbox,
  findLastMessageFromOthers,
  getPdfOptions,
  selectEmail,
} from "./outlook-actions.js";

export interface PdfItem {
  conversationId: string;
  filename: string;
  senderLastname: string;
  signedPdf: Uint8Array;
  subject: string;
}

export async function collectSignedPdfs(
  config: WorkflowConfig,
  onProgress?: (current: number, total: number, subject: string) => void,
): Promise<PdfItem[]> {
  const emailItems = document.querySelectorAll("[data-convid]");
  const count = emailItems.length;

  console.log(`[OPM] Found ${count} emails in folder`);

  const items: PdfItem[] = [];

  for (let idx = 0; idx < count; idx += 1) {
    simulateKeyPress("Escape");
    await sleep(TIMING.MENU_ANIMATION);

    console.log(`[OPM] [${idx + 1}/${count}] Opening email...`);
    const { conversationId, subject } = await selectEmail(idx);
    console.log(`[OPM]   Subject: "${subject}"`);

    onProgress?.(idx + 1, count, subject);

    const expandClicks = await expandThread();
    if (expandClicks > 0) {
      console.log(`[OPM]   Expanded ${expandClicks} time(s)`);
    }

    console.log(`[OPM]   Looking for messages from others...`);
    const message = findLastMessageFromOthers(config.myEmail);

    if (message === undefined) {
      console.log(`[OPM]   -> No messages from others, skipping`);
      continue;
    }

    console.log(`[OPM]   Expanding message...`);
    await expandMessage(message.element);

    console.log(`[OPM]   Looking for attachments...`);
    const attachmentsList = findAttachmentListbox(message.element);

    if (attachmentsList === undefined) {
      console.log(`[OPM]   -> No attachments, skipping`);
      continue;
    }

    const pdfOptions = getPdfOptions(attachmentsList);
    if (pdfOptions.length === 0) {
      console.log(`[OPM]   -> No PDF attachments, skipping`);
      continue;
    }

    console.log(`[OPM]   Found ${pdfOptions.length} PDF(s), downloading...`);

    for (const option of pdfOptions) {
      const text = option.textContent ?? "";
      const originalFilename = text.match(/^(.+\.pdf)/i)?.[1] ?? "attachment.pdf";

      try {
        const pdfBytes = await downloadAttachment(option);

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

        if (
          !response.success ||
          response.signedPdf === undefined ||
          response.filename === undefined
        ) {
          console.error(`[OPM]     ${originalFilename} - signing failed: ${response.error}`);
          continue;
        }

        items.push({
          conversationId,
          filename: response.filename,
          senderLastname: message.senderLastname,
          signedPdf: new Uint8Array(response.signedPdf),
          subject,
        });
        console.log(`[OPM]     ${originalFilename} -> ${response.filename}`);
      } catch (error) {
        console.error(`[OPM]     ${originalFilename} - failed:`, error);
      }
    }
  }

  return items;
}
