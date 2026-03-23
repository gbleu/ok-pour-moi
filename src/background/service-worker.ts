/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Chrome message listeners require callbacks */
import type {
  ContentToBackgroundMessage,
  SignPdfRequest,
  SignPdfResponse,
} from "#shared/messages.js";
import { generateAttachmentName, signPdf } from "#shared/pdf.js";
import { getLocalStorage, getSyncStorage } from "#shared/storage.js";
import { OUTLOOK_ORIGINS } from "#shared/origins.js";
import { base64ToUint8Array } from "#shared/encoding.js";

async function signPdfFromRequest(request: SignPdfRequest): Promise<SignPdfResponse> {
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

function respondWithPromise(
  promise: Promise<unknown>,
  sendResponse: (response: unknown) => void,
): void {
  promise.then(sendResponse).catch((error: unknown) => {
    sendResponse({
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    });
  });
}

chrome.runtime.onMessage.addListener(
  (
    message: ContentToBackgroundMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (
      sender.url === undefined ||
      !OUTLOOK_ORIGINS.some((origin) => sender.url?.startsWith(origin) === true)
    ) {
      return false;
    }

    if (message.type === "SIGN_PDF") {
      respondWithPromise(signPdfFromRequest(message.payload), sendResponse);
      return true;
    }

    return false;
  },
);
