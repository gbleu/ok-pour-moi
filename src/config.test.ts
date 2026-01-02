import { describe, expect, test } from "bun:test";
import { BROWSER_DATA_DIR, LOGS_DIR } from "./config";

describe("config exports", () => {
  test("BROWSER_DATA_DIR is a string path", () => {
    expect(typeof BROWSER_DATA_DIR).toBe("string");
    expect(BROWSER_DATA_DIR.length).toBeGreaterThan(0);
  });

  test("LOGS_DIR is a string path", () => {
    expect(typeof LOGS_DIR).toBe("string");
    expect(LOGS_DIR.length).toBeGreaterThan(0);
  });

  test("BROWSER_DATA_DIR contains expected directory name", () => {
    expect(BROWSER_DATA_DIR).toContain("browser");
  });

  test("LOGS_DIR contains expected directory name", () => {
    expect(LOGS_DIR).toContain("logs");
  });
});
