#!/usr/bin/env bun
/**
 * Create promotional assets for Chrome Web Store submission.
 * Note: This script requires external image creation tools.
 * For actual production assets, use design tools like Figma, GIMP, or Photoshop.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function createAssetsDirectory(): string {
  const assetsDir = join(process.cwd(), "store-assets");
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }
  return assetsDir;
}

function printInstructions(): void {
  console.log("Creating Chrome Web Store assets...\n");

  const assetsDir = createAssetsDirectory();

  console.log("📁 Assets directory:", assetsDir);
  console.log("\n⚠️  Manual Asset Creation Required\n");
  console.log("This script cannot create actual image files without additional dependencies.");
  console.log("Please create the following assets manually:\n");

  console.log("1. Store Icon (128×128px)");
  console.log("   File: store-assets/store-icon-128.png");
  console.log("   - PNG with transparency");
  console.log("   - Main icon within central 96×96px area");
  console.log("   - 16px transparent padding on all sides\n");

  console.log("2. Screenshots (1280×800px) - at least 1, maximum 5");
  console.log("   Files: store-assets/screenshot-1.png, screenshot-2.png, etc.");
  console.log("   Suggested content:");
  console.log("   - Extension popup with 'Sign PDFs' button");
  console.log("   - Options page showing signature configuration");
  console.log("   - Extension in action on Outlook Web");
  console.log("   - Success state after creating draft\n");

  console.log("3. Small Promotional Tile (440×280px)");
  console.log("   File: store-assets/promo-small-440x280.png");
  console.log("   - Features extension name and logo prominently");
  console.log("   - High contrast, readable at small sizes\n");

  console.log("4. Marquee Promotional Tile (1400×560px) - Optional but recommended");
  console.log("   File: store-assets/promo-marquee-1400x560.png");
  console.log("   - Required for 'Editor's Choice' eligibility");
  console.log("   - Use saturated colors");
  console.log("   - Avoid large white/gray areas\n");

  console.log("💡 Tools you can use:");
  console.log("   • Figma (recommended for web design): https://figma.com");
  console.log("   • GIMP (free, open-source): https://gimp.org");
  console.log("   • Photoshop");
  console.log("   • Canva (quick templates): https://canva.com");
  console.log("   • Python PIL: Run the Python script if available\n");

  console.log("📖 See store-assets/README.md for detailed guidelines.\n");

  console.log("🔧 Alternative: If you have Python and PIL installed:");
  console.log("   python3 scripts/create-store-assets.py\n");

  console.log("✅ Assets directory created at:", assetsDir);
  console.log("   Ready for you to add your assets!\n");
}

printInstructions();
