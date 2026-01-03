import { describe, expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { createTempRunDir } from "./temp-files";

describe("createTempRunDir", () => {
  test("creates a temp directory", () => {
    const tempDir = createTempRunDir();

    expect(existsSync(tempDir.path)).toBe(true);
    expect(tempDir.path).toContain("opm-");

    tempDir.cleanup();
  });

  test("filePath returns path within temp directory", () => {
    const tempDir = createTempRunDir();

    const filePath = tempDir.filePath("test.pdf");

    expect(filePath).toContain(tempDir.path);
    expect(filePath).toContain("test.pdf");

    tempDir.cleanup();
  });

  test("cleanup removes the temp directory", () => {
    const tempDir = createTempRunDir();
    const dirPath = tempDir.path;

    expect(existsSync(dirPath)).toBe(true);
    tempDir.cleanup();
    expect(existsSync(dirPath)).toBe(false);
  });

  test("cleanupFile removes a single file", () => {
    const tempDir = createTempRunDir();
    const filePath = tempDir.filePath("test.txt");
    writeFileSync(filePath, "test content");

    expect(existsSync(filePath)).toBe(true);
    tempDir.cleanupFile(filePath);
    expect(existsSync(filePath)).toBe(false);

    tempDir.cleanup();
  });

  test("cleanupFile does not throw if file does not exist", () => {
    const tempDir = createTempRunDir();
    const filePath = tempDir.filePath("nonexistent.txt");

    expect(() => tempDir.cleanupFile(filePath)).not.toThrow();

    tempDir.cleanup();
  });
});
