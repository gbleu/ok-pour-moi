/* eslint-disable import/no-nodejs-modules -- Build tests need filesystem access */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";

import { describe, expect, test } from "vite-plus/test";

const SRC_DIR = "./src";
const DIST_DIR = "./dist";
const distExists = existsSync(DIST_DIR);

describe("source HTML", () => {
  test("script tags use type=module for files with exports", async () => {
    const pages = [
      { html: "popup/popup.html", ts: "popup/popup.ts" },
      { html: "options/options.html", ts: "options/options.ts" },
    ];

    for (const { html, ts } of pages) {
      const htmlContent = await readFile(`${SRC_DIR}/${html}`, "utf8");
      const tsContent = await readFile(`${SRC_DIR}/${ts}`, "utf8");
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
      const js = await readFile(`${DIST_DIR}/${path}`, "utf8");
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
