import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const SRC_DIR = "./src";
const DIST_DIR = "./dist";
const distExists = existsSync(DIST_DIR);

async function readDistFile(path: string): Promise<string> {
  return Bun.file(join(DIST_DIR, path)).text();
}

describe("source HTML", () => {
  test("script tags use type=module for files with exports", async () => {
    const pages = [
      { html: "popup/popup.html", ts: "popup/popup.ts" },
      { html: "options/options.html", ts: "options/options.ts" },
    ];

    for (const { html, ts } of pages) {
      const htmlContent = await Bun.file(join(SRC_DIR, html)).text();
      const tsContent = await Bun.file(join(SRC_DIR, ts)).text();
      const hasExport = /^export /m.test(tsContent);

      if (hasExport) {
        expect(htmlContent).toContain('type="module"');
      }
    }
  });
});

describe.skipIf(!distExists)("build output", () => {
  test("all entrypoint JS files are non-empty", async () => {
    const entrypoints = [
      "popup/popup.js",
      "options/options.js",
      "content/content.js",
      "content/main-world.js",
      "background/service-worker.js",
    ];

    for (const path of entrypoints) {
      const js = await readDistFile(path);
      expect(js.length).toBeGreaterThan(0);
    }
  });

  test("dist contains all expected directories", async () => {
    const entries = await readdir(DIST_DIR);

    expect(entries.toSorted()).toEqual(
      ["background", "content", "icons", "manifest.json", "options", "popup"].toSorted(),
    );
  });
});
