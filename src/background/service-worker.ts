import { base64ToUint8Array } from "#shared/encoding.js";
import { getErrorMessage } from "#shared/errors.js";
/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Chrome message listeners require callbacks */
import {
  type ContentToBackgroundMessage,
  type SignPdfRequest,
  type SignPdfResponse,
} from "#shared/messages.js";
import { OUTLOOK_ORIGINS } from "#shared/origins.js";
import { generateAttachmentName, signPdf } from "#shared/pdf.js";
import { getLocalStorage, getSyncStorage } from "#shared/storage.js";

export async function signPdfFromRequest(request: SignPdfRequest): Promise<SignPdfResponse> {
  const [config, local] = await Promise.all([getSyncStorage(), getLocalStorage()]);

  if (!local.signatureImage) {
    return { error: "No signature configured", success: false };
  }

  try {
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
  } catch (error) {
    return {
      error: getErrorMessage(error),
      success: false,
    };
  }
}

function sendAsyncResponse(
  promise: Promise<SignPdfResponse>,
  sendResponse: (response: SignPdfResponse) => void,
): void {
  promise.then(sendResponse).catch((error: unknown) => {
    sendResponse({
      error: getErrorMessage(error),
      success: false,
    });
  });
}

chrome.runtime.onMessage.addListener(
  // eslint-disable-next-line typescript-eslint/strict-void-return -- Chrome onMessage requires boolean return to keep channel open
  (
    message: ContentToBackgroundMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: SignPdfResponse) => void,
  ): boolean => {
    const senderUrl = sender.url;
    try {
      if (
        senderUrl === undefined ||
        !OUTLOOK_ORIGINS.some((origin) => origin === new URL(senderUrl).origin)
      ) {
        return false;
      }
    } catch {
      return false;
    }

    if (message.type !== "SIGN_PDF") {
      return false;
    }

    sendAsyncResponse(signPdfFromRequest(message.payload), sendResponse);
    return true;
  },
);
