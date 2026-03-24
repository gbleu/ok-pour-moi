import { describe, expect, test } from "bun:test";

import { getErrorMessage } from "./errors.js";

describe("getErrorMessage", () => {
  test("extracts message from Error instance", () => {
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  test("returns 'Unknown error' for non-Error values", () => {
    expect([getErrorMessage("string"), getErrorMessage(42)]).toEqual([
      "Unknown error",
      "Unknown error",
    ]);
  });
});
