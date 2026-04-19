#!/usr/bin/env node
/**
 * Package the extension for Chrome Web Store submission.
 * Creates a clean ZIP file with only necessary files.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";

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
  if (!existsSync("dist")) {
    throw new Error("dist/ directory not found. Run 'vp run build' first.");
  }

  const zipFilename = `ok-pour-moi-v${getVersion()}.zip`;

  await rm(zipFilename, { force: true });

  execFileSync(
    "zip",
    ["-r", `../${zipFilename}`, ".", "-x", "*.DS_Store", "*.map", "*/.gitkeep", "Thumbs.db"],
    { cwd: "dist", stdio: "pipe" },
  );

  const listing = execFileSync("unzip", ["-l", zipFilename], { encoding: "utf8" });

  if (!listing.includes(" manifest.json")) {
    throw new Error("manifest.json not at root of ZIP");
  }

  const requiredDirs = ["background/", "content/", "options/", "popup/"];
  const missingDirs = requiredDirs.filter((dir) => !listing.includes(dir));
  if (missingDirs.length > 0) {
    throw new Error(`Missing directories: ${missingDirs.join(", ")}`);
  }

  const sizeMb = statSync(zipFilename).size / (1024 * 1024);
  console.log(`${zipFilename} (${sizeMb.toFixed(2)} MB) — ready for Chrome Web Store`);
}

try {
  await createPackage();
} catch (error) {
  console.error(error);
  process.exit(1);
}
