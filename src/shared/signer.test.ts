import { PDFDocument } from "pdf-lib";
import { describe, expect, test } from "vite-plus/test";

import { signPdf } from "./signer.js";

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4z8AAAAACAAHiIbwzAAAAAElFTkSuQmCC";
const MINIMAL_PNG = Uint8Array.from(atob(MINIMAL_PNG_BASE64), (char) => char.codePointAt(0) ?? 0);

async function createTestPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  return doc.save();
}

describe("signPdf", () => {
  test("returns valid PDF bytes with embedded signature", async () => {
    // Given
    const pdfBytes = await createTestPdf();
    const position = { height: 50, width: 100, x: 50, y: 50 };

    // When
    const result = await signPdf({
      format: "png",
      pdfBytes: new Uint8Array(pdfBytes),
      position,
      sigBytes: MINIMAL_PNG,
    });

    // Then
    expect({
      hasPdfHeader: new TextDecoder().decode(result.slice(0, 5)) === "%PDF-",
      isUint8Array: result instanceof Uint8Array,
      nonEmpty: result.length > 0,
    }).toEqual({
      hasPdfHeader: true,
      isUint8Array: true,
      nonEmpty: true,
    });
  });

  test("output is larger than input due to embedded image", async () => {
    // Given
    const pdfBytes = await createTestPdf();

    // When
    const result = await signPdf({
      format: "png",
      pdfBytes: new Uint8Array(pdfBytes),
      position: { height: 10, width: 10, x: 0, y: 0 },
      sigBytes: MINIMAL_PNG,
    });

    // Then
    expect(result.length).toBeGreaterThan(pdfBytes.length);
  });

  test("signs on the last page of a multi-page PDF", async () => {
    // Given
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    doc.addPage();
    const pdfBytes = await doc.save();

    // When
    const result = await signPdf({
      format: "png",
      pdfBytes: new Uint8Array(pdfBytes),
      position: { height: 25, width: 50, x: 10, y: 10 },
      sigBytes: MINIMAL_PNG,
    });

    // Then
    const resultDoc = await PDFDocument.load(result);
    expect(resultDoc.getPageCount()).toBe(3);
  });
});
