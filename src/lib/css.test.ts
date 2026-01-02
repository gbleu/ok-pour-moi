import { describe, expect, test } from "bun:test";
import { escapeCssValue } from "./css";

describe("escapeCssValue", () => {
  test("returns unmodified string when no special characters", () => {
    expect(escapeCssValue("abc123")).toBe("abc123");
  });

  test("escapes double quotes", () => {
    const result = escapeCssValue('hello"world');
    expect(result).toContain("\\22 ");
  });

  test("escapes single quotes", () => {
    const result = escapeCssValue("hello'world");
    expect(result).toContain("\\27 ");
  });

  test("escapes backslashes", () => {
    const result = escapeCssValue("hello\\world");
    expect(result).toContain("\\5c ");
  });

  test("escapes square brackets", () => {
    const result = escapeCssValue("hello[world]");
    expect(result).toContain("\\5b ");
    expect(result).toContain("\\5d ");
  });

  test("escapes parentheses", () => {
    const result = escapeCssValue("hello(world)");
    expect(result).toContain("\\28 ");
    expect(result).toContain("\\29 ");
  });

  test("escapes control characters", () => {
    const result = escapeCssValue("hello\nworld");
    expect(result).toContain("\\0a ");
  });

  test("escapes null character", () => {
    const result = escapeCssValue("hello\0world");
    expect(result).toContain("\\00 ");
  });

  test("handles empty string", () => {
    expect(escapeCssValue("")).toBe("");
  });

  test("handles typical conversation ID", () => {
    const convId = "AAQkAGFiZDk1";
    expect(escapeCssValue(convId)).toBe(convId);
  });

  test("escapes multiple special characters in sequence", () => {
    const result = escapeCssValue("a\"b'c");
    expect(result).toBe("a\\22 b\\27 c");
  });
});
