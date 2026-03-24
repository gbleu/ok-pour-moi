import { getErrorMessage } from "#shared/errors.js";

/* eslint-disable unicorn/prefer-global-this */
import { type BlobRequestMessage } from "./blob-protocol.js";

function isBlobMessage(data: unknown): data is BlobRequestMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "OPM_GET_BLOB" &&
    "id" in data &&
    "url" in data
  );
}

const capturedBlobs = new Map<string, Blob>();

const originalCreateObjectURL = URL.createObjectURL.bind(URL);
URL.createObjectURL = (obj: Blob | MediaSource): string => {
  const url = originalCreateObjectURL(obj);
  if (obj instanceof Blob && obj.type === "application/pdf") {
    capturedBlobs.set(url, obj);
    window.postMessage({ type: "OPM_BLOB_CAPTURED", url }, window.location.origin);
  }
  return url;
};

async function postBlobResult(id: string, url: string): Promise<void> {
  const blob = capturedBlobs.get(url);

  if (blob === undefined) {
    window.postMessage(
      { error: "Blob not found", id, type: "OPM_BLOB_RESULT" },
      window.location.origin,
    );
    return;
  }

  try {
    const buffer = await blob.arrayBuffer();
    window.postMessage(
      { data: new Uint8Array(buffer), id, type: "OPM_BLOB_RESULT" },
      window.location.origin,
    );
    capturedBlobs.delete(url);
  } catch (error: unknown) {
    window.postMessage(
      {
        error: getErrorMessage(error),
        id,
        type: "OPM_BLOB_RESULT",
      },
      window.location.origin,
    );
  }
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window || !isBlobMessage(event.data)) {
    return;
  }
  const { id, url } = event.data;
  // eslint-disable-next-line promise/prefer-await-to-callbacks -- Event listener cannot be async
  postBlobResult(id, url).catch((error: unknown) => {
    window.postMessage(
      {
        error: getErrorMessage(error),
        id,
        type: "OPM_BLOB_RESULT",
      },
      window.location.origin,
    );
  });
});

// Sentinel export — ensures bundler treats this as a module (required for Chrome MAIN world injection)
export type MainWorldModule = true;
