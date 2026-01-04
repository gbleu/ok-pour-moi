/* eslint-disable unicorn/prefer-global-this -- window is required here */
/* eslint-disable promise/prefer-await-to-then */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- Type assertion for window extension */
// This script runs in the MAIN world (page context) to intercept blob URLs
// It communicates with the content script via window.postMessage

// Module marker (required to satisfy import/unambiguous rule, but this file runs in MAIN world)
export type MainWorldModule = true;

interface OpmWindow extends Window {
  __opmBlobCaptureSetup: boolean;
  __opmCapturedPdfData: number[] | undefined;
}

const opmWindow = window as unknown as OpmWindow;

function setupBlobCapture(): void {
  if (opmWindow.__opmBlobCaptureSetup) {
    return;
  }
  opmWindow.__opmBlobCaptureSetup = true;
  opmWindow.__opmCapturedPdfData = undefined;

  const originalCreateObjectURL = URL.createObjectURL.bind(URL);

  URL.createObjectURL = function createObjectURLOverride(obj: Blob | MediaSource): string {
    if (obj instanceof Blob && obj.type === "application/pdf") {
      console.log("[OPM-main] Captured PDF blob:", obj.size, "bytes");
      (async (): Promise<void> => {
        try {
          const buffer = await obj.arrayBuffer();
          opmWindow.__opmCapturedPdfData = [...new Uint8Array(buffer)];
          console.log(
            "[OPM-main] Stored PDF data:",
            opmWindow.__opmCapturedPdfData.length,
            "bytes",
          );
          opmWindow.postMessage(
            { size: opmWindow.__opmCapturedPdfData.length, type: "OPM_BLOB_CAPTURED" },
            "*",
          );
        } catch (error: unknown) {
          console.error("[OPM-main] Failed to read blob:", error);
        }
      })().catch(() => {
        /* Ignore */
      });
    }
    return originalCreateObjectURL(obj);
  };

  // Listen for requests to get the captured data
  opmWindow.addEventListener("message", (event: MessageEvent<{ type: string }>) => {
    if (event.data?.type === "OPM_GET_BLOB_DATA") {
      console.log("[OPM-main] Received request for blob data");
      if (opmWindow.__opmCapturedPdfData === undefined) {
        opmWindow.postMessage({ data: undefined, type: "OPM_BLOB_DATA" }, "*");
      } else {
        opmWindow.postMessage({ data: opmWindow.__opmCapturedPdfData, type: "OPM_BLOB_DATA" }, "*");
        opmWindow.__opmCapturedPdfData = undefined;
      }
    }
  });

  console.log("[OPM-main] Blob capture installed in MAIN world");
}

setupBlobCapture();
