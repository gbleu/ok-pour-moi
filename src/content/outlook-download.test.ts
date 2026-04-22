/// <reference lib="dom" />
/* eslint-disable unicorn/no-null, unicorn/prefer-global-this -- DOM test fixtures with window API */
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import {
  type BlobCapturedMessage,
  type BlobRequestMessage,
  type BlobResultMessage,
} from "./blob-protocol.js";
vi.mock("./outlook-automation.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    simulateClick: vi.fn(),
    simulateKeyPress: vi.fn(),
    sleep: vi.fn(async () => {
      /* Noop */
    }),
  };
});

const { downloadAttachment } = await import("./outlook-download.js");
const automation = await import("./outlook-automation.js");

function setPathname(path: string): void {
  window.history.replaceState({}, "", path);
}

function renderDownloadMenuItem(label = "Download"): void {
  const btn = document.createElement("div");
  btn.setAttribute("role", "menuitem");
  btn.textContent = label;
  document.body.append(btn);
}

// Happy-dom's window.postMessage does not set event.source=window; dispatch directly instead.
function dispatchOpmMessage(data: BlobCapturedMessage | BlobResultMessage): void {
  window.dispatchEvent(
    new MessageEvent("message", { data, origin: window.location.origin, source: window }),
  );
}

function isBlobRequest(data: unknown): data is BlobRequestMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as Readonly<{ type: unknown }>).type === "OPM_GET_BLOB"
  );
}

function onBlobRequest(handler: (request: BlobRequestMessage) => void): () => void {
  function listener(event: MessageEvent): void {
    if (!isBlobRequest(event.data)) {
      return;
    }
    handler(event.data);
  }
  window.addEventListener("message", listener);
  return () => {
    window.removeEventListener("message", listener);
  };
}

function postCapturedOnDownloadClick(url: string): void {
  vi.mocked(automation.simulateClick).mockImplementation((el: Element) => {
    if (el.getAttribute("role") === "menuitem") {
      dispatchOpmMessage({ type: "OPM_BLOB_CAPTURED", url });
    }
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  setPathname("/");
  vi.clearAllMocks();
});

describe("outlook-download module", () => {
  test("downloadAttachment throws when attachment URL never appears", async () => {
    // Given
    setPathname("/");
    const option = document.createElement("div");
    option.setAttribute("role", "option");
    option.textContent = "test.pdf";
    document.body.append(option);

    // When / Then
    await expect(downloadAttachment(option)).rejects.toThrow("Attachment ID not found in URL");
  });

  test("downloadAttachment returns PDF bytes on the happy path", async () => {
    // Given
    setPathname("/mail/sxs/msg-1");
    renderDownloadMenuItem();
    const option = document.createElement("div");
    option.setAttribute("role", "option");
    option.textContent = "invoice.pdf";
    document.body.append(option);

    const expectedBytes = new Uint8Array([7, 8, 9]);
    postCapturedOnDownloadClick("blob:http://localhost/captured");
    const unsubscribe = onBlobRequest((request) => {
      queueMicrotask(() => {
        dispatchOpmMessage({ data: expectedBytes, id: request.id, type: "OPM_BLOB_RESULT" });
      });
    });

    // When
    const bytes = await downloadAttachment(option);

    // Then
    expect(bytes).toEqual(expectedBytes);
    unsubscribe();
  });

  test("downloadAttachment surfaces errors from the blob fetch", async () => {
    // Given
    setPathname("/mail/sxs/msg-2");
    renderDownloadMenuItem();
    const option = document.createElement("div");
    option.setAttribute("role", "option");
    option.textContent = "other.pdf";
    document.body.append(option);

    postCapturedOnDownloadClick("blob:http://localhost/missing");
    const unsubscribe = onBlobRequest((request) => {
      queueMicrotask(() => {
        dispatchOpmMessage({ error: "Blob not found", id: request.id, type: "OPM_BLOB_RESULT" });
      });
    });

    // When / Then
    await expect(downloadAttachment(option)).rejects.toThrow("Blob not found");
    unsubscribe();
  });
});
