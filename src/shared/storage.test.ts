import { base64ToUint8Array, uint8ArrayToBase64 } from "./storage.js";
import { describe, expect, test } from "bun:test";

describe("base64ToUint8Array", () => {
  test("converts base64 to bytes", () => {
    expect([
      base64ToUint8Array("SGVsbG8="),
      base64ToUint8Array(""),
      base64ToUint8Array("AQID/w=="),
    ]).toEqual([
      new Uint8Array([72, 101, 108, 108, 111]),
      new Uint8Array([]),
      new Uint8Array([1, 2, 3, 255]),
    ]);
  });
});

describe("uint8ArrayToBase64", () => {
  test("converts bytes to base64", () => {
    expect([
      uint8ArrayToBase64(new Uint8Array([72, 101, 108, 108, 111])),
      uint8ArrayToBase64(new Uint8Array([])),
      uint8ArrayToBase64(new Uint8Array([1, 2, 3, 255])),
    ]).toEqual(["SGVsbG8=", "", "AQID/w=="]);
  });
});

describe("uint8ArrayToBase64 large input", () => {
  test("handles arrays larger than JS argument limit", () => {
    // Given - 200KB array (exceeds typical ~65k-125k argument limit)
    const large = new Uint8Array(200_000);
    for (let i = 0; i < large.length; i += 1) {
      large[i] = i % 256;
    }

    // When
    const base64 = uint8ArrayToBase64(large);
    const roundTripped = base64ToUint8Array(base64);

    // Then
    expect(base64.length).toBeGreaterThan(0);
    expect(roundTripped).toEqual(large);
  });
});

describe("roundtrip conversion", () => {
  test("preserves data in both directions", () => {
    const originalBase64 = "VGVzdCBkYXRhIGZvciByb3VuZHRyaXA=";
    const originalBytes = new Uint8Array([0, 127, 128, 255, 1, 254]);

    expect([
      uint8ArrayToBase64(base64ToUint8Array(originalBase64)),
      base64ToUint8Array(uint8ArrayToBase64(originalBytes)),
    ]).toEqual([originalBase64, originalBytes]);
  });
});
