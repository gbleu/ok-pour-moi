/// <reference lib="dom" />
/* eslint-disable unicorn/no-null, unicorn/prefer-global-this, promise/avoid-new -- DOM test fixtures with window API */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vite-plus/test";

import {
  type BlobCapturedMessage,
  type BlobRequestMessage,
  type BlobResultMessage,
} from "./blob-protocol.js";
import { installMainWorld } from "./main-world.js";

type PostedMessage = BlobCapturedMessage | BlobResultMessage;

function isOpmMessage(data: unknown): data is PostedMessage {
  if (typeof data !== "object" || data === null || !("type" in data)) {
    return false;
  }
  const record = data as Record<string, unknown>;
  return typeof record.type === "string" && record.type.startsWith("OPM_");
}

function isBlobResult(message: Readonly<PostedMessage>): message is BlobResultMessage {
  return message.type === "OPM_BLOB_RESULT";
}

function collectMessages(): { messages: PostedMessage[]; cleanup: () => void } {
  const messages: PostedMessage[] = [];
  function handler(event: MessageEvent): void {
    if (isOpmMessage(event.data)) {
      messages.push(event.data);
    }
  }
  window.addEventListener("message", handler);
  return {
    messages,
    cleanup: () => {
      window.removeEventListener("message", handler);
    },
  };
}

function sendBlobRequest(id: string, url: string): void {
  const data: BlobRequestMessage = { id, type: "OPM_GET_BLOB", url };
  window.dispatchEvent(
    new MessageEvent("message", { data, origin: window.location.origin, source: window }),
  );
}

function waitForBlobResult(): Promise<BlobResultMessage> {
  return new Promise((resolve) => {
    function handler(event: MessageEvent): void {
      if (isOpmMessage(event.data) && isBlobResult(event.data)) {
        window.removeEventListener("message", handler);
        resolve(event.data);
      }
    }
    window.addEventListener("message", handler);
  });
}

async function flush(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
}

describe("main-world", () => {
  let cleanupMessages: (() => void) | undefined;
  let uninstall: (() => void) | undefined;

  beforeAll(() => {
    uninstall = installMainWorld();
  });

  afterAll(() => {
    uninstall?.();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    cleanupMessages?.();
    cleanupMessages = undefined;
  });

  describe("isBlobMessage (via message listener)", () => {
    test("ignores messages without OPM_GET_BLOB type", async () => {
      // Given
      const { messages, cleanup } = collectMessages();
      cleanupMessages = cleanup;

      // When
      window.postMessage({ type: "UNRELATED" }, window.location.origin);
      window.postMessage("string-message", window.location.origin);
      window.postMessage(null, window.location.origin);
      window.postMessage({ id: "1", type: "OTHER", url: "x" }, window.location.origin);
      await flush();

      // Then
      expect(messages).toEqual([]);
    });

    test("ignores OPM_GET_BLOB messages missing required fields", async () => {
      // Given
      const { messages, cleanup } = collectMessages();
      cleanupMessages = cleanup;

      // When
      window.postMessage({ type: "OPM_GET_BLOB" }, window.location.origin);
      window.postMessage({ id: "1", type: "OPM_GET_BLOB" }, window.location.origin);
      window.postMessage({ type: "OPM_GET_BLOB", url: "x" }, window.location.origin);
      await flush();

      // Then — no OPM_BLOB_RESULT messages means none matched
      const results = messages.filter((msg) => isBlobResult(msg));
      expect(results).toEqual([]);
    });
  });

  describe("createObjectURL monkey-patch", () => {
    test("captures PDF blobs and posts OPM_BLOB_CAPTURED", async () => {
      // Given
      const { messages, cleanup } = collectMessages();
      cleanupMessages = cleanup;
      const pdfBlob = new Blob(["pdf-content"], { type: "application/pdf" });

      // When
      const url = URL.createObjectURL(pdfBlob);
      await flush();

      // Then
      const captured = messages.filter(
        (msg): msg is BlobCapturedMessage => msg.type === "OPM_BLOB_CAPTURED",
      );
      expect(captured).toEqual([{ type: "OPM_BLOB_CAPTURED", url }]);
    });

    test("does not capture non-PDF blobs", async () => {
      // Given
      const { messages, cleanup } = collectMessages();
      cleanupMessages = cleanup;
      const textBlob = new Blob(["text"], { type: "text/plain" });
      const imageBlob = new Blob(["img"], { type: "image/png" });

      // When
      URL.createObjectURL(textBlob);
      URL.createObjectURL(imageBlob);
      await flush();

      // Then
      expect(messages).toEqual([]);
    });

    test("returns a valid blob URL", () => {
      // Given
      const pdfBlob = new Blob(["data"], { type: "application/pdf" });

      // When
      const url = URL.createObjectURL(pdfBlob);

      // Then
      expect(url).toMatch(/^blob:/);
    });
  });

  describe("postBlobResult", () => {
    test("returns blob data for a captured PDF", async () => {
      // Given
      const pdfContent = new Uint8Array([1, 2, 3, 4]);
      const pdfBlob = new Blob([pdfContent], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(pdfBlob);
      const resultPromise = waitForBlobResult();

      // When
      sendBlobRequest("req-1", blobUrl);
      const result = await resultPromise;

      // Then
      expect(result).toEqual({
        data: new Uint8Array([1, 2, 3, 4]),
        id: "req-1",
        type: "OPM_BLOB_RESULT",
      });
    });

    test("returns error for unknown blob URL", async () => {
      // Given
      const resultPromise = waitForBlobResult();

      // When
      sendBlobRequest("req-2", "blob:http://localhost/nonexistent");
      const result = await resultPromise;

      // Then
      expect(result).toEqual({
        error: "Blob not found",
        id: "req-2",
        type: "OPM_BLOB_RESULT",
      });
    });

    test("removes blob from cache after successful retrieval", async () => {
      // Given
      const pdfBlob = new Blob([new Uint8Array([5])], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(pdfBlob);
      const firstResult = waitForBlobResult();
      sendBlobRequest("first", blobUrl);
      await firstResult;

      // When — second request for same URL
      const secondResult = waitForBlobResult();
      sendBlobRequest("second", blobUrl);
      const result = await secondResult;

      // Then
      expect(result).toEqual({
        error: "Blob not found",
        id: "second",
        type: "OPM_BLOB_RESULT",
      });
    });
  });
});
