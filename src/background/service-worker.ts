/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Chrome message listeners require callbacks */
import type { ContentToBackgroundMessage, SignPdfResponse } from "../shared/messages.js";
import { base64ToUint8Array, getLocalStorage, getSyncStorage } from "../shared/storage.js";
import { generateAttachmentName, signPdf } from "../shared/pdf.js";

console.log("[OPM] Service worker loaded");

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function handleSignPdf(request: {
  originalFilename: string;
  pdfBytes: number[];
  senderLastname: string;
}): Promise<SignPdfResponse> {
  const config = await getSyncStorage();
  const local = await getLocalStorage();

  if (local.signatureImage === null) {
    return { error: "No signature configured", success: false };
  }

  const sigBytes = base64ToUint8Array(local.signatureImage.data);

  const signedPdf = await signPdf({
    format: local.signatureImage.format,
    pdfBytes: new Uint8Array(request.pdfBytes),
    position: config.signaturePosition,
    sigBytes,
  });

  const filename = generateAttachmentName(request.senderLastname, new Date());

  return {
    filename,
    signedPdf: [...signedPdf],
    success: true,
  };
}

async function handleGetSignature(): Promise<{
  data?: string;
  error?: string;
  format?: string;
  success: boolean;
}> {
  const local = await getLocalStorage();
  if (local.signatureImage === null) {
    return { error: "No signature configured", success: false };
  }
  return {
    data: local.signatureImage.data,
    format: local.signatureImage.format,
    success: true,
  };
}

function handleAsync<TResult>(
  promise: Promise<TResult>,
  sendResponse: (response: unknown) => void,
): true {
  promise.then(sendResponse).catch((error: unknown) => {
    sendResponse({ error: formatError(error), success: false });
  });
  return true;
}

chrome.runtime.onMessage.addListener(
  (
    message: ContentToBackgroundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type === "SIGN_PDF") {
      return handleAsync(handleSignPdf(message.payload), sendResponse);
    }
    if (message.type === "GET_CONFIG") {
      return handleAsync(getSyncStorage(), sendResponse);
    }
    if (message.type === "GET_SIGNATURE") {
      return handleAsync(handleGetSignature(), sendResponse);
    }
    return false;
  },
);
