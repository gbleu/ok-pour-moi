import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { getElement } from "./dom.js";

describe("getElement", () => {
  const originalDocument = globalThis.document;

  beforeEach(() => {
    // eslint-disable-next-line unicorn/no-null, @typescript-eslint/no-unsafe-type-assertion -- Mimicking DOM API which returns null
    globalThis.document = { querySelector: () => null } as unknown as Document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  test("throws when element does not exist", () => {
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
