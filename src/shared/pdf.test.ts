import { describe, expect, test } from "bun:test";
import {
  extractEmail,
  extractLastname,
  generateAttachmentName,
  getSignatureFormat,
  getTargetMonthAndYear,
} from "./pdf.js";

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
