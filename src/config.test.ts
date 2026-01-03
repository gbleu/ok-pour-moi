import { BROWSER_DATA_DIR, LOGS_DIR, config, ensureBrowserDir, ensureLogsDir } from "./config";
import { describe, expect, test } from "bun:test";

describe("config exports", () => {
  test("BROWSER_DATA_DIR is a string path containing 'browser'", () => {
    expect(BROWSER_DATA_DIR).toBeTypeOf("string");
    expect(BROWSER_DATA_DIR).toContain("browser");
  });

  test("LOGS_DIR is a string path containing 'logs'", () => {
    expect(LOGS_DIR).toBeTypeOf("string");
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

describe("config", () => {
  test("has all expected properties with correct types", () => {
    expect(config.browser.headless).toBeTypeOf("boolean");
    expect(config.cc.emails).toBeArray();
    expect(config.cc.enabled).toBeTypeOf("boolean");
    expect(config.myEmail).toBeTypeOf("string");
    expect(config.outlook.folder).toBeTypeOf("string");
    expect(config.replyMessage).toBeTypeOf("string");
    expect(config.signature.height).toBeTypeOf("number");
    expect(config.signature.imagePath).toBeTypeOf("string");
    expect(config.signature.width).toBeTypeOf("number");
    expect(config.signature.x).toBeTypeOf("number");
    expect(config.signature.y).toBeTypeOf("number");
  });
});
