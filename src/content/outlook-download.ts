/* eslint-disable promise/avoid-new, unicorn/prefer-global-this */
import { type BlobCapturedMessage, type BlobResultMessage } from "./blob-protocol.js";
import {
  TIMING,
  simulateClick,
  simulateKeyPress,
  sleep,
  waitForElement,
} from "./outlook-automation.js";

function isBlobCaptured(data: unknown): data is BlobCapturedMessage {
  return (
    typeof data === "object" && data !== null && "type" in data && data.type === "OPM_BLOB_CAPTURED"
  );
}

function isBlobResult(data: unknown, id: string): data is BlobResultMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "OPM_BLOB_RESULT" &&
    "id" in data &&
    data.id === id
  );
}

function waitForWindowMessage<TMessage>(
  predicate: (data: unknown) => data is TMessage,
  timeout: number,
): Promise<TMessage> {
  return new Promise((resolve, reject) => {
    const timerRef: { current: ReturnType<typeof setTimeout> | undefined } = { current: undefined };

    function handler(event: MessageEvent): void {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        !predicate(event.data)
      ) {
        return;
      }
      window.removeEventListener("message", handler);
      clearTimeout(timerRef.current);
      resolve(event.data);
    }

    timerRef.current = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Message timeout"));
    }, timeout);

    window.addEventListener("message", handler);
  });
}

async function getBlobFromMainWorld(blobUrl: string): Promise<Uint8Array> {
  const messageId = `opm-blob-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.postMessage({ id: messageId, type: "OPM_GET_BLOB", url: blobUrl }, window.location.origin);

  const result = await waitForWindowMessage<BlobResultMessage>(
    (data) => isBlobResult(data, messageId),
    TIMING.DOWNLOAD_TIMEOUT,
  );

  if ("error" in result) {
    throw new Error(result.error);
  }
  return new Uint8Array(result.data);
}

async function waitUntilAttachmentReady(maxAttempts = 20): Promise<void> {
  for (let idx = 0; idx < maxAttempts; idx += 1) {
    const match = /\/sxs\/([^/]+)$/.exec(window.location.pathname);
    const attachmentId = match?.[1];
    if (attachmentId !== undefined) {
      return;
    }
    await sleep(100);
  }
  throw new Error("Attachment ID not found in URL");
}

export async function downloadAttachment(option: Element): Promise<Uint8Array> {
  simulateClick(option);
  await waitUntilAttachmentReady();

  // Subscribe before triggering download to avoid missing the OPM_BLOB_CAPTURED message
  const blobPromise = waitForWindowMessage<BlobCapturedMessage>(isBlobCaptured, 10_000);

  await sleep(TIMING.UI_SETTLE);
  const downloadBtn = await waitForElement('[role="menuitem"]', {
    match: (el) => {
      const text = (el.textContent ?? "").toLowerCase();
      return text.includes("download") || text.includes("télécharger");
    },
    timeout: 3000,
  });
  simulateClick(downloadBtn);

  const { url } = await blobPromise;
  const pdfBytes = await getBlobFromMainWorld(url);

  simulateKeyPress("Escape");
  await sleep(TIMING.MENU_ANIMATION);

  return pdfBytes;
}
