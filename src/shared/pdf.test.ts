import { describe, expect, test } from "vite-plus/test";

import { generateAttachmentName, getSignatureFormat, getTargetMonthAndYear } from "./pdf.js";

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
    expect(generateAttachmentName("", new Date(2024, 3, 15))).toBe("avril24.pdf");
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
