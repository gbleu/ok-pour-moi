/// <reference lib="dom" />
/* eslint-disable unicorn/no-null -- DOM test fixtures */
import { afterEach, describe, expect, test } from "vite-plus/test";

import { type DraftResult, prepareDrafts } from "./outlook-compose.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("prepareDrafts", () => {
  test("returns zero success and no errors for empty items", async () => {
    // Given / When
    const result: DraftResult = await prepareDrafts([], "Hello");

    // Then
    expect(result).toEqual({ errors: [], successCount: 0 });
  });
});
