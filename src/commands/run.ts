import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Locator, Page } from "playwright";
import { config } from "../config.js";
import {
  findAttachmentListbox,
  findLastMessageFromOthers,
} from "../lib/outlook-dom.js";
import { generateAttachmentName, signPdf } from "../lib/pdf.js";
import {
  createOutlookSession,
  takeErrorScreenshot,
} from "../services/browser.js";

type PdfItem = {
  conversationId: string;
  subject: string;
  senderLastname: string;
  signedPdf: Uint8Array;
};

const TIMING = {
  MENU_ANIMATION: 300,
  UI_SETTLE: 500,
  CONTENT_LOAD: 1000,
} as const;

async function downloadAndSignPdfs(
  page: Page,
  attachmentsList: Locator,
  conversationId: string,
  subject: string,
  senderLastname: string,
  sigBytes: Uint8Array,
  sigPath: string,
): Promise<PdfItem[]> {
  const items: PdfItem[] = [];
  const options = attachmentsList.getByRole("option");
  const count = await options.count();

  for (let i = 0; i < count; i++) {
    const option = options.nth(i);
    const text = (await option.textContent()) ?? "";
    if (!text.toLowerCase().includes(".pdf")) continue;

    const originalFilename = text.match(/^(.+\.pdf)/i)?.[1] ?? "attachment.pdf";

    await option.click({ button: "right" });
    const downloadMenuItem = page.getByRole("menuitem", { name: /download/i });
    await downloadMenuItem.waitFor({ state: "visible", timeout: 5000 });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadMenuItem.click(),
    ]);

    const pdfBytes = await download
      .path()
      .then((p) => (p ? readFileSync(p) : null));
    if (!pdfBytes) {
      console.log(`    ${originalFilename} - download failed`);
      continue;
    }

    const signedPdf = await signPdf(pdfBytes, sigBytes, sigPath, config.signature);
    items.push({ conversationId, subject, senderLastname, signedPdf });
    console.log(`    ${originalFilename} - signed`);
  }

  return items;
}

async function collectSignedPdfs(
  page: Page,
  sigBytes: Uint8Array,
  sigPath: string,
): Promise<PdfItem[]> {
  const emailItems = page.locator("[data-convid]");
  const count = await emailItems.count();
  console.log(`  Found ${count} emails in folder\n`);

  console.log("=== Fetching & Signing PDFs ===\n");

  const items: PdfItem[] = [];

  for (let i = 0; i < count; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(TIMING.MENU_ANIMATION);

    const emailItem = emailItems.nth(i);
    console.log(`[${i + 1}/${count}] Opening email...`);
    await emailItem.click();

    const conversationId = (await emailItem.getAttribute("data-convid")) ?? "";
    const subjectEl = page
      .locator('[role="main"] [role="heading"][aria-level="2"]')
      .first();
    await subjectEl.waitFor({ state: "visible", timeout: 10000 });
    const subject = ((await subjectEl.textContent()) ?? "Unknown")
      .trim()
      .replace(/Summarize$/, "")
      .trim();
    console.log(`  Subject: "${subject}"`);
    console.log(`  ConversationId: ${conversationId}`);

    const readingPane = page.locator('[role="main"]');

    let expandClicks = 0;
    let noButtonCount = 0;
    while (noButtonCount < 2) {
      await page.waitForTimeout(TIMING.CONTENT_LOAD);
      const seeMoreBtn = readingPane
        .getByRole("button", { name: "See more messages" })
        .first();
      if ((await seeMoreBtn.count()) === 0) {
        noButtonCount++;
        continue;
      }
      noButtonCount = 0;
      console.log(`  Expanding conversation... (click ${++expandClicks})`);
      await seeMoreBtn.click();
    }
    if (expandClicks > 0) console.log(`  Expanded ${expandClicks} time(s)`);

    console.log(`  Looking for messages from others...`);
    const message = await findLastMessageFromOthers(readingPane);

    if (!message) {
      console.log(`  -> No messages from others, skipping`);
      continue;
    }
    console.log(`  Found message from others`);

    console.log(`  Expanding message...`);
    if ((await message.row.count()) > 0) {
      await message.row.click();
    } else {
      await message.button.click({ position: { x: -50, y: 0 } });
    }
    await page.waitForTimeout(TIMING.CONTENT_LOAD);

    console.log(`  Looking for attachments...`);
    const attachmentsList = await findAttachmentListbox(
      readingPane,
      message.button,
    );

    if (!attachmentsList) {
      console.log(`  -> No attachments in last message, skipping`);
      continue;
    }

    const pdfCount = await attachmentsList
      .getByRole("option")
      .filter({ hasText: /\.pdf/i })
      .count();
    if (pdfCount === 0) {
      console.log(`  -> No PDF attachments, skipping`);
      continue;
    }

    console.log(`  Found ${pdfCount} PDF(s), downloading...`);
    console.log(`  Sender: ${message.senderLastname}`);
    try {
      const newItems = await downloadAndSignPdfs(
        page,
        attachmentsList,
        conversationId,
        subject,
        message.senderLastname,
        sigBytes,
        sigPath,
      );
      items.push(...newItems);
    } catch (e) {
      console.error(`  -> Download/sign failed: ${e}`);
      await takeErrorScreenshot(page, `download-fail-${i}`);
    }
  }

  return items;
}

async function prepareDrafts(page: Page, items: PdfItem[]): Promise<void> {
  console.log(`\n=== Preparing ${items.length} Draft(s) ===\n`);

  // Create temp subfolder for this run
  const runDir = join(tmpdir(), `opm-${Date.now()}`);
  mkdirSync(runDir, { recursive: true });

  try {
    for (const [idx, item] of items.entries()) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(TIMING.MENU_ANIMATION);

      const attachmentName = generateAttachmentName(item.senderLastname);
      console.log(
        `\n[${idx + 1}/${items.length}] "${item.subject}" -> ${attachmentName}`,
      );

    const emailItem = page.locator(`[data-convid="${item.conversationId}"]`);
    if ((await emailItem.count()) === 0) {
      console.log(`  -> Email not found in list, skipping`);
      await takeErrorScreenshot(page, `email-not-found-${idx}`);
      continue;
    }

    console.log(`  Clicking email...`);
    await emailItem.first().click();

    console.log(`  Opening reply...`);
    try {
      const replyBtn = page.getByRole("button", { name: "Reply" }).first();
      await replyBtn.waitFor({ state: "visible", timeout: 10000 });
      await replyBtn.click();
    } catch (e) {
      console.error(`  -> Reply button not found: ${e}`);
      await takeErrorScreenshot(page, `reply-btn-not-found-${idx}`);
      continue;
    }

    const composeBody = page
      .locator('div[role="textbox"][contenteditable="true"]')
      .first();
    await composeBody.waitFor({ state: "visible", timeout: 10000 });

    if (config.cc.enabled && config.cc.emails.length > 0) {
      const ccList = config.cc.emails.join("; ");
      console.log(`  Adding CC: ${ccList}`);
      try {
        const optionsTab = page.getByRole("tab", { name: "Options" });
        await optionsTab.click();
        await page.waitForTimeout(TIMING.MENU_ANIMATION);
        const showCcCheckbox = page.getByRole("checkbox", { name: "Show Cc" });
        await showCcCheckbox.waitFor({ state: "visible", timeout: 3000 });
        if (!(await showCcCheckbox.isChecked())) {
          await showCcCheckbox.click();
          await page.waitForTimeout(TIMING.UI_SETTLE);
        }

        await page.getByRole("tab", { name: "Message" }).click();
        await page.waitForTimeout(TIMING.MENU_ANIMATION);

        const ccField = page.locator('[aria-label="Cc"]').first();
        await ccField.waitFor({ state: "visible", timeout: 5000 });
        await ccField.click();
        await page.keyboard.type(ccList);
        await page.keyboard.press("Tab");
        await page.waitForTimeout(TIMING.UI_SETTLE);
      } catch (e) {
        console.error(`  -> CC failed: ${e}`);
        await takeErrorScreenshot(page, `cc-fail-${idx}`);
        continue;
      }
    }

    const tmpPath = join(runDir, attachmentName);
    await Bun.write(tmpPath, item.signedPdf);

    console.log(`  Attaching signed PDF...`);
    try {
      const attachBtn = page.getByRole("button", { name: "Attach file" });
      await attachBtn.waitFor({ state: "visible", timeout: 5000 });

      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 10000 }),
        attachBtn.click().then(() =>
          page.getByRole("menuitem", { name: /browse this computer/i }).click(),
        ),
      ]);
      await fileChooser.setFiles(tmpPath);

      // Wait for upload to complete - Outlook may show prompts for CC recipients
      await page.waitForTimeout(2000);

      // Dismiss any "Choose this attachment" prompt for CC recipients
      const closePromptBtn = page.locator('[role="button"][aria-label="Close"]').last();
      if ((await closePromptBtn.count()) > 0) {
        await closePromptBtn.click().catch(() => {});
        await page.waitForTimeout(TIMING.UI_SETTLE);
      }

      unlinkSync(tmpPath);
    } catch (e) {
      console.error(`  -> Attach failed: ${e}`);
      await takeErrorScreenshot(page, `attach-fail-${idx}`);
      try { unlinkSync(tmpPath); } catch {}
      continue;
    }

    console.log(`  Typing reply message...`);
    await composeBody.click();
    await composeBody.pressSequentially(config.replyMessage, { delay: 20 });

    console.log(`  Saving draft...`);
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+s" : "Control+s",
    );
    // Wait for draft indicator
    await page.waitForTimeout(TIMING.CONTENT_LOAD);

    console.log(`  Closing compose...`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(TIMING.UI_SETTLE);

    const discardDialog = page.getByRole("dialog");
    if ((await discardDialog.count()) > 0) {
      const cancelBtn = discardDialog.getByRole("button", { name: /cancel/i });
      if ((await cancelBtn.count()) > 0) {
        await cancelBtn.click();
        await page.waitForTimeout(TIMING.UI_SETTLE);
      }
    }

    console.log(`  Switching to Home tab...`);
    const homeTab = page.getByRole("tab", { name: "Home" });
    if ((await homeTab.count()) > 0) {
      await homeTab.click();
      await page.waitForTimeout(TIMING.UI_SETTLE);
    }

    console.log(`  Selecting email...`);
    const emailInList = page
      .locator(`[data-convid="${item.conversationId}"]`)
      .first();
    await emailInList.click();

    console.log(`  Moving to Inbox...`);
    try {
      const moveButton = page.getByRole("button", { name: "Move to" });
      await moveButton.waitFor({ state: "visible", timeout: 10000 });
      await moveButton.click();
      const inboxItem = page.getByRole("menuitem", { name: "Inbox" });
      await inboxItem.waitFor({ state: "visible", timeout: 5000 });
      await inboxItem.click();
      await page.waitForTimeout(TIMING.UI_SETTLE);
      console.log(`  -> Done`);
    } catch (e) {
      console.error(`  -> Move failed: ${e}`);
      await takeErrorScreenshot(page, `move-fail-${idx}`);
    }
    }
  } finally {
    // Clean up temp folder
    rmSync(runDir, { recursive: true, force: true });
  }
}

export async function runCommand() {
  const sigPath = resolve(config.signature.imagePath);
  if (!existsSync(sigPath)) {
    console.error(`Signature not found: ${sigPath}`);
    process.exit(1);
  }
  const sigBytes = readFileSync(sigPath);

  console.log("Opening Outlook...");
  const session = await createOutlookSession();

  try {
    console.log(`Navigating to "${config.outlook.folder}"...`);
    try {
      const folder = session.page.getByRole("treeitem", { name: config.outlook.folder });
      await folder.waitFor({ state: "visible", timeout: 10000 });
      await folder.click();
      console.log(`  Clicked folder`);
    } catch (_e) {
      console.error(`  Failed to find folder "${config.outlook.folder}"`);
      await takeErrorScreenshot(session.page, "folder-not-found");
      throw new Error(`Folder "${config.outlook.folder}" not found`);
    }
    // Wait for email list to load
    await session.page.locator("[data-convid]").first().waitFor({ state: "attached", timeout: 10000 }).catch(() => {});

    const items = await collectSignedPdfs(session.page, sigBytes, sigPath);

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
