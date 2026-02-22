/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Chrome message listeners require callbacks */
import type { ContentToBackgroundMessage, SignPdfResponse } from "#shared/messages.js";
import { base64ToUint8Array, getLocalStorage, getSyncStorage } from "#shared/storage.js";
import { generateAttachmentName, signPdf } from "#shared/pdf.js";

console.log("[OPM] Service worker loaded");

async function handleSignPdf(request: {
  originalFilename: string;
  pdfBytes: number[];
  senderLastname: string;
}): Promise<SignPdfResponse> {
  const [config, local] = await Promise.all([getSyncStorage(), getLocalStorage()]);

  if (!local.signatureImage) {
    return { error: "No signature configured", success: false };
  }

  const sigBytes = base64ToUint8Array(local.signatureImage.data);

  const signedPdf = await signPdf({
    format: local.signatureImage.format,
    pdfBytes: new Uint8Array(request.pdfBytes),
    position: config.signaturePosition,
    sigBytes,
  });

  return {
    filename: generateAttachmentName(request.senderLastname, new Date()),
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
  const { signatureImage } = await getLocalStorage();
  if (!signatureImage) {
    return { error: "No signature configured", success: false };
  }
  return {
    data: signatureImage.data,
    format: signatureImage.format,
    success: true,
  };
}

function handleAsync(promise: Promise<unknown>, sendResponse: (response: unknown) => void): void {
  promise.then(sendResponse).catch((error: unknown) => {
    sendResponse({
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    });
  });
}

const ALLOWED_ORIGINS = [
  "https://outlook.office.com",
  "https://outlook.office365.com",
  "https://outlook.live.com",
  "https://outlook.cloud.microsoft",
];

chrome.runtime.onMessage.addListener(
  (
    message: ContentToBackgroundMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (
      sender.url === undefined ||
      !ALLOWED_ORIGINS.some((origin) => sender.url?.startsWith(origin) === true)
    ) {
      return false;
    }

    if (message.type === "SIGN_PDF") {
      handleAsync(handleSignPdf(message.payload), sendResponse);
      return true;
    }

    if (message.type === "GET_CONFIG") {
      handleAsync(getSyncStorage(), sendResponse);
      return true;
    }

    if (message.type === "GET_SIGNATURE") {
      handleAsync(handleGetSignature(), sendResponse);
      return true;
    }

    return false;
  },
);
