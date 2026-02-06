import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { escapeCssValue } from "./css.js";

describe("escapeCssValue", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "CSS", {
      configurable: true,
      value: { escape: (value: string) => value.replaceAll(".", String.raw`\.`) },
    });
  });

  afterAll(() => {
    // @ts-expect-error cleaning up polyfill
    delete globalThis.CSS;
  });

  test("delegates to CSS.escape", () => {
    expect([escapeCssValue("hello"), escapeCssValue("a.b.c"), escapeCssValue("")]).toEqual([
      "hello",
      String.raw`a\.b\.c`,
      "",
    ]);
  });
});
