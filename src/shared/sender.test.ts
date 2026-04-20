import { describe, expect, test } from "vite-plus/test";

import { extractEmail, extractLastname } from "./sender.js";

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
    ]).toEqual(["DUPONT", "DE LA TOUR", "Dupont", "Admin", "MARTIN", "", "Dupont"]);
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
