import { TIMING, collectSignedPdfs } from "../lib/outlook-dom.js";
import { createOutlookSession, takeErrorScreenshot } from "../services/browser.js";
import { existsSync, readFileSync } from "node:fs";
import { config } from "../config.js";
import { getSignatureFormat } from "../lib/pdf.js";
import { prepareDrafts } from "../lib/outlook-compose.js";
import { resolve } from "node:path";

export { findAttachmentListbox, findLastMessageFromOthers, TIMING } from "../lib/outlook-dom.js";
export type { PdfItem } from "../lib/outlook-dom.js";

export async function runCommand(): Promise<void> {
  const sigPath = resolve(config.signature.imagePath);
  if (!existsSync(sigPath)) {
    throw new Error(`Signature not found: ${sigPath}`);
  }
  const sigBytes = readFileSync(sigPath);
  const sigFormat = getSignatureFormat(sigPath);

  console.log("Opening Outlook...");
  const session = await createOutlookSession();

  try {
    console.log(`Navigating to "${config.outlook.folder}"...`);
    try {
      const folder = session.page.getByRole("treeitem", {
        name: config.outlook.folder,
      });
      await folder.waitFor({
        state: "visible",
        timeout: TIMING.ELEMENT_VISIBLE,
      });
      await folder.click();
      console.log(`  Clicked folder`);
    } catch {
      console.error(`  Failed to find folder "${config.outlook.folder}"`);
      await takeErrorScreenshot(session.page, "folder-not-found");
      throw new Error(`Folder "${config.outlook.folder}" not found`);
    }
    // Wait for email list to load
    await session.page
      .locator("[data-convid]")
      .first()
      .waitFor({ state: "attached", timeout: TIMING.ELEMENT_VISIBLE })
      .catch(() => {
        /* Ignore */
      });

    const items = await collectSignedPdfs(session.page, sigBytes, sigFormat);

    if (items.length === 0) {
      console.log("\nNo PDFs to process");
      return;
    }

    await prepareDrafts(session.page, items);

    console.log("\n=== Done ===");
  } finally {
    await session.close();
  }
}
