import { BROWSER_DATA_DIR, DEFAULT_DIR, LOGS_DIR } from "./paths";
import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";

describe("paths", () => {
  test("DEFAULT_DIR starts with home directory", () => {
    expect(DEFAULT_DIR.startsWith(homedir())).toBe(true);
  });

  test("DEFAULT_DIR ends with .ok-pour-moi", () => {
    expect(DEFAULT_DIR.endsWith(".ok-pour-moi")).toBe(true);
  });

  test("BROWSER_DATA_DIR is under DEFAULT_DIR", () => {
    expect(BROWSER_DATA_DIR.startsWith(DEFAULT_DIR)).toBe(true);
  });

  test("BROWSER_DATA_DIR ends with browser", () => {
    expect(BROWSER_DATA_DIR.endsWith("browser")).toBe(true);
  });

  test("LOGS_DIR is under DEFAULT_DIR", () => {
    expect(LOGS_DIR.startsWith(DEFAULT_DIR)).toBe(true);
  });

  test("LOGS_DIR ends with logs", () => {
    expect(LOGS_DIR.endsWith("logs")).toBe(true);
  });

  test("paths are distinct", () => {
    const paths = [DEFAULT_DIR, BROWSER_DATA_DIR, LOGS_DIR];
    const unique = new Set(paths);
    expect(unique.size).toBe(3);
  });
});
