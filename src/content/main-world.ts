import { getErrorMessage } from "#shared/errors.js";

/* eslint-disable unicorn/prefer-global-this */
import { type BlobRequestMessage } from "./blob-protocol.js";

function isBlobMessage(data: unknown): data is BlobRequestMessage {
  if (typeof data !== "object" || data === null || !("type" in data)) {
    return false;
  }
  const record = data as Readonly<Record<string, unknown>>;
  return (
    record.type === "OPM_GET_BLOB" &&
    typeof record.id === "string" &&
    typeof record.url === "string"
  );
}

const capturedBlobs = new Map<string, Blob>();

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
  } catch (error) {
    capturedBlobs.delete(url);
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

export function installMainWorld(): () => void {
  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (obj: Blob | MediaSource): string => {
    const url = originalCreateObjectURL(obj);
    if (obj instanceof Blob && obj.type === "application/pdf") {
      capturedBlobs.set(url, obj);
      window.postMessage({ type: "OPM_BLOB_CAPTURED", url }, window.location.origin);
    }
    return url;
  };

  function onMessage(event: MessageEvent): void {
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      !isBlobMessage(event.data)
    ) {
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
  }

  window.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener("message", onMessage);
    URL.createObjectURL = originalCreateObjectURL;
    capturedBlobs.clear();
  };
}
