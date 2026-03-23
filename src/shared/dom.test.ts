import { describe, expect, test } from "bun:test";
import { getElement } from "./dom.js";

describe("getElement", () => {
  test("throws when element does not exist", () => {
    // eslint-disable-next-line unicorn/no-null, @typescript-eslint/no-unsafe-type-assertion -- Mimicking DOM API which returns null
    globalThis.document = { querySelector: () => null } as unknown as Document;

    expect(() => getElement("nonexistent")).toThrow("Element #nonexistent not found");
  });

  test("returns the matching element", () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Test mock
    const fakeElement = { id: "found" } as unknown as HTMLElement;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Test mock
    globalThis.document = { querySelector: () => fakeElement } as unknown as Document;

    const result = getElement("found");

    expect(result).toBe(fakeElement);
  });
});
