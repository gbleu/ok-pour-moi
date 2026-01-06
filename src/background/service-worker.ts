/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Chrome message listeners require callbacks */
import type { ContentToBackgroundMessage, SignPdfResponse } from "../shared/messages.js";
import { base64ToUint8Array, getLocalStorage, getSyncStorage } from "../shared/storage.js";
import { generateAttachmentName, signPdf } from "../shared/pdf.js";

console.log("[OPM] Service worker loaded");

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

chrome.runtime.onMessage.addListener(
  (
    message: ContentToBackgroundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type === "SIGN_PDF") {
      handleSignPdf(message.payload)
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse({
            error: error instanceof Error ? error.message : "Unknown error",
            success: false,
          });
        });
      return true;
    }

    if (message.type === "GET_CONFIG") {
      getSyncStorage()
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse({
            error: error instanceof Error ? error.message : "Unknown error",
            success: false,
          });
        });
      return true;
    }

    if (message.type === "GET_SIGNATURE") {
      handleGetSignature()
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse({
            error: error instanceof Error ? error.message : "Unknown error",
            success: false,
          });
        });
      return true;
    }

    return false;
  },
);
