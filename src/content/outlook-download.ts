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
  if (typeof data !== "object" || data === null || !("type" in data)) {
    return false;
  }
  const record = data as Readonly<Record<string, unknown>>;
  return record.type === "OPM_BLOB_CAPTURED" && typeof record.url === "string";
}

function isBlobResult(data: unknown, id: string): data is BlobResultMessage {
  if (typeof data !== "object" || data === null || !("type" in data)) {
    return false;
  }
  const record = data as Readonly<Record<string, unknown>>;
  if (record.type !== "OPM_BLOB_RESULT" || record.id !== id) {
    return false;
  }
  const hasData = "data" in record && record.data instanceof Uint8Array;
  const hasError = "error" in record && typeof record.error === "string";
  return hasData || hasError;
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
    if (/\/sxs\/[^/]+$/.test(window.location.pathname)) {
      return;
    }
    await sleep(100);
  }
  throw new Error("Attachment ID not found in URL");
}

async function captureAndFetchPdf(trigger: () => void | Promise<void>): Promise<Uint8Array> {
  // Subscribe before triggering so the OPM_BLOB_CAPTURED message cannot race past us
  const capturePromise = waitForWindowMessage<BlobCapturedMessage>(isBlobCaptured, 10_000);
  await trigger();
  const { url } = await capturePromise;
  return getBlobFromMainWorld(url);
}

export async function downloadAttachment(option: Element): Promise<Uint8Array> {
  simulateClick(option);
  await waitUntilAttachmentReady();

  const pdfBytes = await captureAndFetchPdf(async () => {
    await sleep(TIMING.UI_SETTLE);
    const downloadBtn = await waitForElement('[role="menuitem"]', {
      match: (el) => {
        const text = (el.textContent ?? "").toLowerCase();
        return text.includes("download") || text.includes("télécharger");
      },
      timeout: 3000,
    });
    simulateClick(downloadBtn);
  });

  simulateKeyPress("Escape");
  await sleep(TIMING.MENU_ANIMATION);

  return pdfBytes;
}
