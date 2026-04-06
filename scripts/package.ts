#!/usr/bin/env bun
/**
 * Package the extension for Chrome Web Store submission.
 * Creates a clean ZIP file with only necessary files.
 */

import { existsSync, readFileSync, statSync } from "node:fs";

import { $ } from "bun";

function getVersion(): string {
  try {
    const manifestContent = readFileSync("manifest.json", "utf8");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Manifest structure is known
    const manifest = JSON.parse(manifestContent) as { version: string };
    return manifest.version;
  } catch (error) {
    throw new Error("Failed to read manifest.json — ensure it exists and contains valid JSON.", {
      cause: error,
    });
  }
}

async function createPackage(): Promise<void> {
  const distDir = "dist";

  if (!existsSync(distDir)) {
    throw new Error("dist/ directory not found. Run 'bun run build' first.");
  }

  const version = getVersion();
  const zipFilename = `ok-pour-moi-v${version}.zip`;

  await $`rm -f ${zipFilename}`.quiet();

  const result =
    await $`cd dist && zip -r ../${zipFilename} . -x "*.DS_Store" "*.map" "*/.gitkeep" "Thumbs.db"`.quiet();

  if (result.exitCode !== 0) {
    throw new Error("Error creating ZIP file");
  }

  const listResult = await $`unzip -l ${zipFilename}`.text();

  if (!listResult.includes(" manifest.json")) {
    throw new Error("manifest.json not at root of ZIP");
  }

  const requiredDirs = ["background/", "content/", "options/", "popup/"];
  const missingDirs = requiredDirs.filter((dir) => !listResult.includes(dir));
  if (missingDirs.length > 0) {
    throw new Error(`Missing directories: ${missingDirs.join(", ")}`);
  }

  const sizeMb = statSync(zipFilename).size / (1024 * 1024);
  console.log(`${zipFilename} (${sizeMb.toFixed(2)} MB) — ready for Chrome Web Store`);
}

try {
  await createPackage();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
