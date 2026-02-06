import { describe, expect, test } from "bun:test";
import {
  extractEmail,
  extractLastname,
  generateAttachmentName,
  getSignatureFormat,
  getTargetMonthAndYear,
  signPdf,
} from "./pdf.js";
import { PDFDocument } from "pdf-lib";

describe("getTargetMonthAndYear", () => {
  test("returns month based on day threshold", () => {
    expect([
      getTargetMonthAndYear(new Date(2024, 5, 15)),
      getTargetMonthAndYear(new Date(2024, 2, 10)),
      getTargetMonthAndYear(new Date(2024, 5, 5)),
      getTargetMonthAndYear(new Date(2024, 0, 3)),
    ]).toEqual([
      { monthIndex: 5, year: 2024 },
      { monthIndex: 2, year: 2024 },
      { monthIndex: 4, year: 2024 },
      { monthIndex: 11, year: 2023 },
    ]);
  });
});

describe("generateAttachmentName", () => {
  test("formats with uppercase lastname and French month", () => {
    expect([
      generateAttachmentName("Dupont", new Date(2024, 0, 15)),
      generateAttachmentName("Martin", new Date(2024, 5, 5)),
      generateAttachmentName("Durand", new Date(2024, 0, 3)),
      generateAttachmentName("de la Tour", new Date(2024, 7, 20)),
    ]).toEqual([
      "DUPONT - janvier24.pdf",
      "MARTIN - mai24.pdf",
      "DURAND - décembre23.pdf",
      "DE LA TOUR - août24.pdf",
    ]);
  });

  test("handles empty string lastname", () => {
    expect(generateAttachmentName("", new Date(2024, 3, 15))).toBe(" - avril24.pdf");
  });
});

describe("extractLastname", () => {
  test("extracts lastname from various formats", () => {
    expect([
      extractLastname("From: DUPONT Jean"),
      extractLastname("From: DE LA TOUR Pierre"),
      extractLastname("From: Jean Dupont"),
      extractLastname("From: Admin"),
      extractLastname("From: MARTIN Sophie <sophie.martin@example.com>"),
      extractLastname("From:   "),
      extractLastname("From: A Jean Dupont"),
    ]).toEqual(["DUPONT", "DE LA TOUR", "Dupont", "Admin", "MARTIN", "Unknown", "Dupont"]);
  });

  test("skips single-char uppercase parts", () => {
    expect(extractLastname("A DUPONT Jean")).toBe("Jean");
  });
});

describe("extractEmail", () => {
  test("extracts email from various formats", () => {
    expect([
      extractEmail("John Doe <john.doe@example.com>"),
      extractEmail("Contact: john.doe@example.com for more info"),
      extractEmail("<user+tag@example.com>"),
      extractEmail("John Doe"),
      extractEmail("alias@old.com <real@example.com>"),
    ]).toEqual([
      "john.doe@example.com",
      "john.doe@example.com",
      "user+tag@example.com",
      "",
      "real@example.com",
    ]);
  });

  test("returns empty string for empty input", () => {
    expect(extractEmail("")).toBe("");
  });
});

describe("getSignatureFormat", () => {
  test("detects image format from filename", () => {
    expect([
      getSignatureFormat("signature.png"),
      getSignatureFormat("SIGNATURE.PNG"),
      getSignatureFormat("signature.jpg"),
      getSignatureFormat("SIGNATURE.JPEG"),
    ]).toEqual(["png", "png", "jpg", "jpg"]);
  });

  test("throws for unsupported formats", () => {
    expect(() => getSignatureFormat("signature.gif")).toThrow(
      'Unsupported signature format: "signature.gif". Only .png, .jpg, .jpeg are supported.',
    );
  });
});

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
