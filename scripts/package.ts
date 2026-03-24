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
  } catch {
    console.error("Failed to read manifest.json — ensure it exists and contains valid JSON.");
    return process.exit(1);
  }
}

async function createPackage(): Promise<boolean> {
  const distDir = "dist";

  if (!existsSync(distDir)) {
    console.error("❌ Error: dist/ directory not found. Run 'bun run build' first.");
    return false;
  }

  const version = getVersion();
  const zipFilename = `ok-pour-moi-v${version}.zip`;

  console.log(`📦 Creating package: ${zipFilename}`);
  console.log(`   Source: dist/`);

  // Remove existing zip if present
  await $`rm -f ${zipFilename}`.quiet();

  const result =
    await $`cd dist && zip -r ../${zipFilename} . -x "*.DS_Store" "*.map" "*/.gitkeep" "Thumbs.db"`.quiet();

  if (result.exitCode !== 0) {
    console.error("❌ Error creating ZIP file");
    return false;
  }

  // Get file size
  const stats = statSync(zipFilename);
  const sizeMb = stats.size / (1024 * 1024);

  console.log(`\n✅ Package created successfully!`);
  console.log(`   File: ${zipFilename}`);
  console.log(`   Size: ${sizeMb.toFixed(2)} MB`);

  // Verify package structure
  console.log(`\n🔍 Verifying package structure...`);

  const listResult = await $`unzip -l ${zipFilename}`.text();

  // Check for manifest.json at root
  if (listResult.includes(" manifest.json")) {
    console.log("   ✓ manifest.json at root");
  } else {
    console.error("   ✗ WARNING: manifest.json not at root!");
    return false;
  }

  // Check for icons
  if (listResult.includes("icons/") && listResult.includes(".png")) {
    console.log("   ✓ Icons included");
  } else {
    console.warn("   ⚠ Warning: No icons found");
  }

  // Check for required directories
  const requiredDirs = ["background/", "content/", "options/", "popup/"];
  for (const dir of requiredDirs) {
    if (listResult.includes(dir)) {
      console.log(`   ✓ ${dir} included`);
    }
  }

  console.log(`\n📤 Ready to upload to Chrome Web Store:`);
  console.log(`   https://chrome.google.com/webstore/devconsole`);

  return true;
}

const success = await createPackage();
process.exit(success ? 0 : 1);
