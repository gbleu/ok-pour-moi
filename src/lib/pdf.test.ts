import { describe, expect, test } from "bun:test";
import { extractLastname, generateAttachmentName, signPdf } from "./pdf";

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

describe("generateAttachmentName", () => {
  test("formats as LASTNAME - monthYY.pdf", () => {
    // Given
    const lastname = "Doe";

    // When
    const result = generateAttachmentName(lastname);

    // Then
    expect(result).toMatch(/^DOE - [a-zé]+\d{2}\.pdf$/);
  });

  test("uppercases lastname", () => {
    expect(generateAttachmentName("van der berg")).toMatch(/^VAN DER BERG - /);
  });

  test("ends with .pdf extension", () => {
    const result = generateAttachmentName("Smith");
    expect(result.endsWith(".pdf")).toBe(true);
  });

  test("includes current year (last 2 digits)", () => {
    const result = generateAttachmentName("Smith");
    const currentYear = new Date().getFullYear() % 100;
    expect(result).toContain(currentYear.toString());
  });

  test("handles empty lastname", () => {
    const result = generateAttachmentName("");
    expect(result).toMatch(/ - [a-zé]+\d{2}\.pdf$/);
  });

  test("handles special characters in lastname", () => {
    const result = generateAttachmentName("O'Brien");
    expect(result).toMatch(/^O'BRIEN - /);
  });
});

describe("signPdf", () => {
  test("embeds PNG signature on last page", async () => {
    // Given
    const pdfBytes = await Bun.file("test/fixtures/sample.pdf").bytes();
    const sigBytes = await Bun.file("test/fixtures/signature.png").bytes();
    const position = { x: 100, y: 100, width: 50, height: 20 };

    // When
    const result = await signPdf(pdfBytes, sigBytes, "sig.png", position);

    // Then
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(pdfBytes.length);
  });

  test("returns Uint8Array", async () => {
    const pdfBytes = await Bun.file("test/fixtures/sample.pdf").bytes();
    const sigBytes = await Bun.file("test/fixtures/signature.png").bytes();
    const position = { x: 0, y: 0, width: 100, height: 50 };

    const result = await signPdf(pdfBytes, sigBytes, "signature.png", position);

    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("handles different signature positions", async () => {
    const pdfBytes = await Bun.file("test/fixtures/sample.pdf").bytes();
    const sigBytes = await Bun.file("test/fixtures/signature.png").bytes();

    // Test various positions
    const positions = [
      { x: 0, y: 0, width: 50, height: 25 },
      { x: 200, y: 300, width: 150, height: 75 },
      { x: 50, y: 700, width: 100, height: 40 },
    ];

    for (const position of positions) {
      const result = await signPdf(pdfBytes, sigBytes, "sig.png", position);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    }
  });

  test("signature file path with .PNG extension is treated as PNG", async () => {
    const pdfBytes = await Bun.file("test/fixtures/sample.pdf").bytes();
    const sigBytes = await Bun.file("test/fixtures/signature.png").bytes();
    const position = { x: 100, y: 100, width: 50, height: 20 };

    // Should work with uppercase extension
    const result = await signPdf(pdfBytes, sigBytes, "sig.PNG", position);

    expect(result).toBeInstanceOf(Uint8Array);
  });
});
