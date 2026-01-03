import {
  BROWSER_DATA_DIR,
  LOGS_DIR,
  _resetConfigForTesting,
  config,
  ensureBrowserDir,
  ensureLogsDir,
  loadConfig,
} from "./config";
import { describe, expect, test } from "bun:test";

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
  test("does not throw when directory already exists", () => {
    expect(() => {
      ensureBrowserDir();
    }).not.toThrow();
  });
});

describe("ensureLogsDir", () => {
  test("does not throw when directory already exists", () => {
    expect(() => {
      ensureLogsDir();
    }).not.toThrow();
  });
});

describe("loadConfig", () => {
  test("returns cached config on subsequent calls", () => {
    // Given
    _resetConfigForTesting();
    const first = loadConfig();

    // When
    const second = loadConfig();

    // Then
    expect(first).toBe(second);
  });

  test("loads config from environment", () => {
    // Given
    _resetConfigForTesting();

    // When
    const cfg = loadConfig();

    // Then
    expect(cfg).toHaveProperty("browser.headless");
    expect(cfg).toHaveProperty("cc.emails");
    expect(cfg).toHaveProperty("cc.enabled");
    expect(cfg).toHaveProperty("myEmail");
    expect(cfg).toHaveProperty("outlook.folder");
    expect(cfg).toHaveProperty("replyMessage");
    expect(cfg).toHaveProperty("signature.height");
    expect(cfg).toHaveProperty("signature.imagePath");
    expect(cfg).toHaveProperty("signature.width");
    expect(cfg).toHaveProperty("signature.x");
    expect(cfg).toHaveProperty("signature.y");
  });
});

describe("config proxy", () => {
  test("accesses config properties via proxy", () => {
    // When / Then
    expect(typeof config.myEmail).toBe("string");
    expect(typeof config.browser.headless).toBe("boolean");
    expect(typeof config.outlook.folder).toBe("string");
  });
});
