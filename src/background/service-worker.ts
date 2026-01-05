/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Chrome message listeners require callbacks */
import type { ContentToBackgroundMessage, SignPdfResponse } from "../shared/messages.js";
import { base64ToUint8Array, getLocalStorage, getSyncStorage } from "../shared/storage.js";
import { generateAttachmentName, signPdf } from "../shared/pdf.js";

console.log("[OPM] Service worker loaded");

// Download capture state
let capturedDownload: { data: number[]; filename: string } | undefined;
let webRequestListener: ((details: chrome.webRequest.WebRequestDetails) => void) | undefined;

async function captureAttachment(url: string): Promise<void> {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const contentDisposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const filename =
        filenameMatch?.[1] === undefined
          ? "download.pdf"
          : filenameMatch[1].replaceAll(/['"]/g, "");

      capturedDownload = {
        data: [...new Uint8Array(buffer)],
        filename: decodeURIComponent(filename),
      };
      console.log("[OPM] Captured via webRequest:", capturedDownload.data.length, "bytes");
    } else {
      console.log("[OPM] webRequest fetch failed:", response.status);
    }
  } catch (error: unknown) {
    console.error("[OPM] webRequest fetch error:", error);
  }
}

function startDownloadCapture(): void {
  capturedDownload = undefined;

  if (webRequestListener !== undefined) {
    chrome.webRequest.onBeforeRequest.removeListener(webRequestListener);
  }

  // Listen for PDF download requests
  webRequestListener = (details: chrome.webRequest.WebRequestDetails): void => {
    // Only capture attachment downloads
    try {
      const url = new URL(details.url);
      const isAttachmentUrl =
        url.hostname === "attachments.office.net" && url.pathname.includes("GetFileAttachment");
      if (!isAttachmentUrl) {
        return;
      }
    } catch {
      return;
    }

    console.log("[OPM] Intercepted attachment request:", details.url.slice(0, 100));

    // Fetch the URL immediately with the service worker's context
    captureAttachment(details.url).catch(() => {
      /* Ignore */
    });
  };

  chrome.webRequest.onBeforeRequest.addListener(webRequestListener, {
    urls: ["https://attachments.office.net/*", "https://*.office365.com/*"],
  });

  console.log("[OPM] Download capture started (webRequest)");
}

function stopDownloadCapture(): void {
  if (webRequestListener !== undefined) {
    chrome.webRequest.onBeforeRequest.removeListener(webRequestListener);
    webRequestListener = undefined;
  }
  console.log("[OPM] Download capture stopped");
}

async function fetchAttachment(
  url: string,
): Promise<{ data?: number[]; error?: string; success: boolean }> {
  console.log("[OPM] Service worker fetching attachment:", url);
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    return { error: `HTTP ${response.status}`, success: false };
  }
  const buffer = await response.arrayBuffer();
  return { data: [...new Uint8Array(buffer)], success: true };
}

async function handleSignPdf(request: {
  originalFilename: string;
  pdfBytes: number[];
  senderLastname: string;
}): Promise<SignPdfResponse> {
  const config = await getSyncStorage();
  const local = await getLocalStorage();

  // eslint-disable-next-line unicorn/no-null -- Chrome storage API returns null
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
  // eslint-disable-next-line unicorn/no-null -- Chrome storage API returns null
  if (local.signatureImage === null) {
    return { error: "No signature configured", success: false };
  }
  return {
    data: local.signatureImage.data,
    format: local.signatureImage.format,
    success: true,
  };
}

function wrapAsyncHandler<TResponse>(
  handler: () => Promise<TResponse>,
  sendResponse: (response: unknown) => void,
): void {
  handler()
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      });
    });
}

chrome.runtime.onMessage.addListener(
  (
    message: ContentToBackgroundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type === "SIGN_PDF") {
      wrapAsyncHandler(async () => handleSignPdf(message.payload), sendResponse);
      return true;
    }

    if (message.type === "GET_CONFIG") {
      wrapAsyncHandler(getSyncStorage, sendResponse);
      return true;
    }

    if (message.type === "GET_SIGNATURE") {
      wrapAsyncHandler(handleGetSignature, sendResponse);
      return true;
    }

    if (message.type === "FETCH_ATTACHMENT") {
      wrapAsyncHandler(async () => fetchAttachment(message.payload.url), sendResponse);
      return true;
    }

    if (message.type === "START_DOWNLOAD_CAPTURE") {
      startDownloadCapture();
      sendResponse({ success: true });
      return false;
    }

    if (message.type === "STOP_DOWNLOAD_CAPTURE") {
      stopDownloadCapture();
      sendResponse({ success: true });
      return false;
    }

    if (message.type === "GET_CAPTURED_DOWNLOAD") {
      if (capturedDownload !== undefined && capturedDownload.data.length > 0) {
        sendResponse({
          data: capturedDownload.data,
          filename: capturedDownload.filename,
          success: true,
        });
        capturedDownload = undefined;
      } else {
        sendResponse({ error: "No download captured", success: false });
      }
      return false;
    }

    return false;
  },
);
