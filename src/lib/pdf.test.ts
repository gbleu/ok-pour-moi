import { describe, expect, test } from "bun:test";
import {
  extractLastname,
  generateAttachmentName,
  getSignatureFormat,
  getTargetMonthAndYear,
  signPdf,
} from "./pdf";

describe("extractLastname", () => {
  test("extracts lastname from simple name", () => {
    expect(extractLastname("From: John Doe")).toBe("Doe");
  });

  test("extracts uppercase lastname prefix", () => {
    expect(extractLastname("From: VAN DER BERG Alice")).toBe("VAN DER BERG");
  });

  test("handles email in angle brackets", () => {
    expect(extractLastname("From: Smith<john.smith@example.com>")).toBe("Smith");
  });

  test("returns Unknown for empty input", () => {
    expect(extractLastname("From: ")).toBe("Unknown");
  });

  test("handles single name", () => {
    expect(extractLastname("From: Admin")).toBe("Admin");
  });

  test("handles name with multiple spaces", () => {
    expect(extractLastname("From: John   Doe")).toBe("Doe");
  });

  test("handles lowercase From prefix", () => {
    expect(extractLastname("from: John Doe")).toBe("Doe");
  });

  test("handles name with special characters", () => {
    expect(extractLastname("From: O'Brien-Smith")).toBe("O'Brien-Smith");
  });

  test("handles unicode characters", () => {
    expect(extractLastname("From: François Müller")).toBe("Müller");
  });

  test("handles name with only spaces", () => {
    expect(extractLastname("From:    ")).toBe("Unknown");
  });

  test("handles partial uppercase parts", () => {
    expect(extractLastname("From: DE LA CRUZ Maria")).toBe("DE LA CRUZ");
  });

  test("handles single uppercase word at start", () => {
    expect(extractLastname("From: SMITH John")).toBe("SMITH");
  });
});

describe("getTargetMonthAndYear", () => {
  test("uses previous month when day is 1 (first of month)", () => {
    const date = new Date(2026, 0, 1); // January 1, 2026
    const result = getTargetMonthAndYear(date);
    expect(result.monthIndex).toBe(11); // December
    expect(result.year).toBe(2025);
  });

  test("uses previous month when day is 9", () => {
    const date = new Date(2026, 5, 9); // June 9, 2026
    const result = getTargetMonthAndYear(date);
    expect(result.monthIndex).toBe(4); // May
    expect(result.year).toBe(2026);
  });

  test("uses current month when day is 10", () => {
    const date = new Date(2026, 5, 10); // June 10, 2026
    const result = getTargetMonthAndYear(date);
    expect(result.monthIndex).toBe(5); // June
    expect(result.year).toBe(2026);
  });

  test("uses current month when day is after 10", () => {
    const date = new Date(2026, 5, 15); // June 15, 2026
    const result = getTargetMonthAndYear(date);
    expect(result.monthIndex).toBe(5); // June
    expect(result.year).toBe(2026);
  });

  test("handles year rollover: January before 10th becomes December of previous year", () => {
    const date = new Date(2026, 0, 2); // January 2, 2026
    const result = getTargetMonthAndYear(date);
    expect(result.monthIndex).toBe(11); // December
    expect(result.year).toBe(2025);
  });

  test("February before 10th becomes January same year", () => {
    const date = new Date(2026, 1, 5); // February 5, 2026
    const result = getTargetMonthAndYear(date);
    expect(result.monthIndex).toBe(0); // January
    expect(result.year).toBe(2026);
  });

  test("December before 10th becomes November same year", () => {
    const date = new Date(2026, 11, 3); // December 3, 2026
    const result = getTargetMonthAndYear(date);
    expect(result.monthIndex).toBe(10); // November
    expect(result.year).toBe(2026);
  });

  test("last day of month uses current month", () => {
    const date = new Date(2026, 5, 30); // June 30, 2026
    const result = getTargetMonthAndYear(date);
    expect(result.monthIndex).toBe(5); // June
    expect(result.year).toBe(2026);
  });
});

describe("generateAttachmentName", () => {
  test("formats as LASTNAME - monthYY.pdf", () => {
    // Given
    const lastname = "Doe";
    const date = new Date(2026, 5, 15); // June 15, 2026

    // When
    const result = generateAttachmentName(lastname, date);

    // Then
    expect(result).toBe("DOE - juin26.pdf");
  });

  test("uppercases lastname", () => {
    const date = new Date(2026, 5, 15);
    expect(generateAttachmentName("van der berg", date)).toMatch(/^VAN DER BERG - /);
  });

  test("ends with .pdf extension", () => {
    const date = new Date(2026, 5, 15);
    const result = generateAttachmentName("Smith", date);
    expect(result.endsWith(".pdf")).toBe(true);
  });

  test("uses previous month before 10th", () => {
    const date = new Date(2026, 0, 2); // January 2, 2026
    const result = generateAttachmentName("Smith", date);
    expect(result).toBe("SMITH - décembre25.pdf");
  });

  test("uses current month on or after 10th", () => {
    const date = new Date(2026, 0, 10); // January 10, 2026
    const result = generateAttachmentName("Smith", date);
    expect(result).toBe("SMITH - janvier26.pdf");
  });

  test("handles empty lastname", () => {
    const date = new Date(2026, 5, 15);
    const result = generateAttachmentName("", date);
    expect(result).toBe(" - juin26.pdf");
  });

  test("handles special characters in lastname", () => {
    const date = new Date(2026, 5, 15);
    const result = generateAttachmentName("O'Brien", date);
    expect(result).toBe("O'BRIEN - juin26.pdf");
  });

  test("uses French month names with accents", () => {
    // Test février (February)
    const febDate = new Date(2026, 2, 1); // March 1 -> février
    expect(generateAttachmentName("Doe", febDate)).toBe("DOE - février26.pdf");

    // Test août (August)
    const augDate = new Date(2026, 8, 5); // September 5 -> août
    expect(generateAttachmentName("Doe", augDate)).toBe("DOE - août26.pdf");

    // Test décembre (December)
    const decDate = new Date(2026, 0, 5); // January 5 -> décembre previous year
    expect(generateAttachmentName("Doe", decDate)).toBe("DOE - décembre25.pdf");
  });
});

describe("getSignatureFormat", () => {
  test("returns png for .png extension", () => {
    expect(getSignatureFormat("signature.png")).toBe("png");
  });

  test("returns png for .PNG extension (case-insensitive)", () => {
    expect(getSignatureFormat("signature.PNG")).toBe("png");
  });

  test("returns jpg for .jpg extension", () => {
    expect(getSignatureFormat("signature.jpg")).toBe("jpg");
  });

  test("returns jpg for .jpeg extension", () => {
    expect(getSignatureFormat("signature.jpeg")).toBe("jpg");
  });

  test("throws for unsupported extensions", () => {
    expect(() => getSignatureFormat("signature.gif")).toThrow(/unsupported signature format/i);
  });
});

describe("signPdf", () => {
  test("embeds PNG signature on last page", async () => {
    // Given
    const pdfBytes = await Bun.file("test/fixtures/sample.pdf").bytes();
    const sigBytes = await Bun.file("test/fixtures/signature.png").bytes();
    const position = { x: 100, y: 100, width: 50, height: 20 };

    // When
    const result = await signPdf(pdfBytes, sigBytes, "png", position);

    // Then
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(pdfBytes.length);
  });

  test("returns Uint8Array", async () => {
    const pdfBytes = await Bun.file("test/fixtures/sample.pdf").bytes();
    const sigBytes = await Bun.file("test/fixtures/signature.png").bytes();
    const position = { x: 0, y: 0, width: 100, height: 50 };

    const result = await signPdf(pdfBytes, sigBytes, "png", position);

    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("handles different signature positions", async () => {
    const pdfBytes = await Bun.file("test/fixtures/sample.pdf").bytes();
    const sigBytes = await Bun.file("test/fixtures/signature.png").bytes();

    const positions = [
      { x: 0, y: 0, width: 50, height: 25 },
      { x: 200, y: 300, width: 150, height: 75 },
      { x: 50, y: 700, width: 100, height: 40 },
    ];

    for (const position of positions) {
      const result = await signPdf(pdfBytes, sigBytes, "png", position);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    }
  });

  test("throws on empty PDF", async () => {
    const sigBytes = await Bun.file("test/fixtures/signature.png").bytes();
    const position = { x: 0, y: 0, width: 50, height: 25 };

    await expect(signPdf(new Uint8Array([]), sigBytes, "png", position)).rejects.toThrow();
  });

  test("throws on invalid PDF", async () => {
    const invalidPdf = new Uint8Array([1, 2, 3, 4, 5]);
    const sigBytes = await Bun.file("test/fixtures/signature.png").bytes();
    const position = { x: 0, y: 0, width: 50, height: 25 };

    await expect(signPdf(invalidPdf, sigBytes, "png", position)).rejects.toThrow();
  });
});
