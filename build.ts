import { cpSync, existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { build } from "vite";

const SRC_DIR = "src";
const DIST_DIR = "dist";

const ENTRIES = [
  "popup/popup",
  "options/options",
  "content/content",
  "content/main-world",
  "background/service-worker",
] as const;

async function buildEntry(entry: string): Promise<void> {
  await build({
    configFile: "./vite.config.ts",
    build: {
      outDir: DIST_DIR,
      emptyOutDir: false,
      copyPublicDir: false,
      minify: false,
      sourcemap: true,
      target: "esnext",
      modulePreload: false,
      lib: {
        entry: join(SRC_DIR, `${entry}.ts`),
        formats: ["es"],
        fileName: () => `${entry}.js`,
      },
      rollupOptions: {
        output: {
          codeSplitting: false,
        },
      },
    },
    logLevel: "warn",
  });
}

async function copyStatic(): Promise<void> {
  cpSync("manifest.json", join(DIST_DIR, "manifest.json"));
  cpSync(join(SRC_DIR, "popup/popup.html"), join(DIST_DIR, "popup/popup.html"));
  cpSync(join(SRC_DIR, "options/options.html"), join(DIST_DIR, "options/options.html"));
  if (existsSync("icons")) {
    cpSync("icons", join(DIST_DIR, "icons"), { recursive: true });
  }
}

await rm(DIST_DIR, { force: true, recursive: true });
await mkdir(DIST_DIR, { recursive: true });

for (const entry of ENTRIES) {
  await buildEntry(entry);
}

await copyStatic();

console.log("Build complete! Output in ./dist");
