/* eslint-disable unicorn/prefer-global-this */

interface BlobMessage {
  id: string;
  type: "OPM_GET_BLOB";
  url: string;
}

function isBlobMessage(data: unknown): data is BlobMessage {
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
    window.postMessage({ type: "OPM_BLOB_CAPTURED", url }, "*");
  }
  return url;
};

async function handleBlobRequest(id: string, url: string): Promise<void> {
  const blob = capturedBlobs.get(url);

  if (blob === undefined) {
    window.postMessage({ error: "Blob not found", id, type: "OPM_BLOB_RESULT" }, "*");
    return;
  }

  try {
    const buffer = await blob.arrayBuffer();
    window.postMessage({ data: [...new Uint8Array(buffer)], id, type: "OPM_BLOB_RESULT" }, "*");
  } catch (error: unknown) {
    window.postMessage(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        id,
        type: "OPM_BLOB_RESULT",
      },
      "*",
    );
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !isBlobMessage(event.data)) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  handleBlobRequest(event.data.id, event.data.url);
});

export type MainWorldModule = true;
