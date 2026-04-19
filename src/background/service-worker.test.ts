/* eslint-disable unicorn/no-null */
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { type SignPdfRequest } from "#shared/messages.js";

// Mock chrome.storage before importing the module
const mockSyncData = {
  myEmail: "test@example.com",
  replyMessage: "Ok pour moi.",
  signaturePosition: { height: 50, width: 150, x: 100, y: 100 },
};

const mockLocalData: {
  signatureImage: { data: string; format: "png"; name: string; uploadedAt: number } | null;
} = {
  signatureImage: null,
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Partial chrome mock for testing
(globalThis as Record<string, unknown>).chrome = {
  runtime: { onMessage: { addListener: vi.fn() } },
  storage: {
    local: { get: vi.fn(async () => mockLocalData) },
    sync: { get: vi.fn(async () => mockSyncData) },
  },
};

const { signPdfFromRequest } = await import("./service-worker.js");

async function createMinimalPdf(): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.addPage();
  return doc.save();
}

describe("signPdfFromRequest", () => {
  const request: SignPdfRequest = {
    originalFilename: "attachment.pdf",
    pdfBytes: [],
    senderLastname: "DUPONT",
  };

  beforeEach(() => {
    mockLocalData.signatureImage = null;
  });

  test("returns error when no signature configured", async () => {
    const result = await signPdfFromRequest(request);

    expect(result).toEqual({ error: "No signature configured", success: false });
  });

  test("returns signed PDF when signature is configured", async () => {
    // 1x1 transparent PNG
    mockLocalData.signatureImage = {
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
      format: "png",
      name: "sig.png",
      uploadedAt: Date.now(),
    };

    const result = await signPdfFromRequest({
      ...request,
      pdfBytes: [...(await createMinimalPdf())],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.filename).toContain("DUPONT");
      expect(result.signedPdf.length).toBeGreaterThan(0);
    }
  });
});
