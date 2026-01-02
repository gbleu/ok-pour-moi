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
});
