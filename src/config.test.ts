import { BROWSER_DATA_DIR, LOGS_DIR, ensureBrowserDir, ensureLogsDir } from "./config";
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";

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

describe("ensureBrowserDir", () => {
  afterEach(() => {
    if (existsSync(BROWSER_DATA_DIR)) {
      rmSync(BROWSER_DATA_DIR, { force: true, recursive: true });
    }
  });

  test("creates browser data directory if it does not exist", () => {
    if (existsSync(BROWSER_DATA_DIR)) {
      rmSync(BROWSER_DATA_DIR, { force: true, recursive: true });
    }

    ensureBrowserDir();

    expect(existsSync(BROWSER_DATA_DIR)).toBe(true);
  });

  test("does not throw if directory already exists", () => {
    ensureBrowserDir();
    expect(() => ensureBrowserDir()).not.toThrow();
  });
});

describe("ensureLogsDir", () => {
  afterEach(() => {
    if (existsSync(LOGS_DIR)) {
      rmSync(LOGS_DIR, { force: true, recursive: true });
    }
  });

  test("creates logs directory if it does not exist", () => {
    if (existsSync(LOGS_DIR)) {
      rmSync(LOGS_DIR, { force: true, recursive: true });
    }

    ensureLogsDir();

    expect(existsSync(LOGS_DIR)).toBe(true);
  });

  test("does not throw if directory already exists", () => {
    ensureLogsDir();
    expect(() => ensureLogsDir()).not.toThrow();
  });
});
