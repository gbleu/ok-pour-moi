import { type SignatureFormat, type SignaturePosition, getSignatureFormat } from "../lib/pdf.js";
import { createOutlookSession, takeErrorScreenshot } from "../services/browser.js";
import { existsSync, readFileSync } from "node:fs";
import type { Page } from "playwright";
import { TIMING } from "../lib/outlook-actions.js";
import { collectSignedPdfs } from "../lib/outlook-dom.js";
import { config } from "../config.js";
import { prepareDrafts } from "../lib/outlook-compose.js";
import { resolve } from "node:path";

export type { PdfItem } from "../lib/outlook-dom.js";

export interface RunWorkflowOptions {
  ccEmails: string[];
  folderName: string;
  myEmail: string;
  replyMessage: string;
  sigBytes: Uint8Array;
  sigFormat: SignatureFormat;
  signaturePosition: SignaturePosition;
}

export async function runWorkflow(page: Page, options: RunWorkflowOptions): Promise<void> {
  console.log(`Navigating to "${options.folderName}"...`);
  try {
    const folder = page.getByRole("treeitem", { name: options.folderName });
    await folder.waitFor({ state: "visible", timeout: TIMING.ELEMENT_VISIBLE });
    await folder.click();
    console.log(`  Clicked folder`);
  } catch {
    console.error(`  Failed to find folder "${options.folderName}"`);
    await takeErrorScreenshot(page, "folder-not-found");
    throw new Error(`Folder "${options.folderName}" not found`);
  }

  await page
    .locator("[data-convid]")
    .first()
    .waitFor({ state: "attached", timeout: TIMING.ELEMENT_VISIBLE })
    .catch(() => {
      // Ignore - folder may be empty
    });

  const items = await collectSignedPdfs(page, {
    myEmail: options.myEmail,
    sigBytes: options.sigBytes,
    sigFormat: options.sigFormat,
    signaturePosition: options.signaturePosition,
  });

  if (items.length === 0) {
    console.log("\nNo PDFs to process");
    return;
  }

  await prepareDrafts(page, items, {
    ccEmails: options.ccEmails,
    replyMessage: options.replyMessage,
  });

  console.log("\n=== Done ===");
}

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
    await runWorkflow(session.page, {
      ccEmails: config.cc.enabled ? config.cc.emails : [],
      folderName: config.outlook.folder,
      myEmail: config.myEmail,
      replyMessage: config.replyMessage,
      sigBytes,
      sigFormat,
      signaturePosition: config.signature,
    });
  } finally {
    await session.close();
  }
}
