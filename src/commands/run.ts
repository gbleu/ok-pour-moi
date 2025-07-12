import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import type { Locator, Page } from "playwright";
import { config } from "../config.js";
import {
  closeBrowser,
  getOutlookPage,
  takeErrorScreenshot,
} from "../services/browser.js";

type PdfItem = {
  conversationId: string;
  subject: string;
  filename: string;
  signedPdf: Uint8Array;
};

async function signPdf(
  pdfBytes: Uint8Array,
  sigBytes: Uint8Array,
  sigPath: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const sigImage = sigPath.endsWith(".png")
    ? await pdfDoc.embedPng(sigBytes)
    : await pdfDoc.embedJpg(sigBytes);

  const pages = pdfDoc.getPages();
  const target = pages[pages.length - 1];
  if (!target) throw new Error("PDF has no pages");

  target.drawImage(sigImage, {
    x: config.signature.x,
    y: config.signature.y,
    width: config.signature.width,
    height: config.signature.height,
  });

  return pdfDoc.save();
}

async function findLastMessageFromOthers(
  readingPane: Locator,
): Promise<{ row: Locator; button: Locator } | null> {
  const fromButtons = readingPane.getByRole("button", { name: /^From:/ });
  const count = await fromButtons.count();

  for (let i = count - 1; i >= 0; i--) {
    const btn = fromButtons.nth(i);
    const name = (await btn.textContent()) ?? "";
    if (!name.toLowerCase().includes(config.myEmail.toLowerCase())) {
      // Return the clickable message row (ancestor), not the button itself
      // to avoid opening contact card
      const row = btn.locator(
        "xpath=ancestor::*[contains(@style, 'cursor') or @tabindex][1]",
      );
      return { row, button: btn };
    }
  }
  return null;
}

async function findAttachmentListbox(
  readingPane: Locator,
  messageButton: Locator,
): Promise<Locator | null> {
  // Primary: find listbox following the message button in DOM order
  const following = messageButton.locator(
    'xpath=following::*[@role="listbox"][contains(@aria-label, "attachments")][1]',
  );
  if ((await following.count()) > 0) return following.first();

  // Fallback: find last non-draft listbox
  const allLists = readingPane.getByRole("listbox", { name: /attachments/i });
  const count = await allLists.count();

  for (let i = count - 1; i >= 0; i--) {
    const lb = allLists.nth(i);
    const draftMarker = lb.locator(
      "xpath=ancestor::*[position() <= 8]//*[contains(text(), '[Draft]')]",
    );
    if ((await draftMarker.count()) === 0) return lb;
  }

  return null;
}

async function downloadAndSignPdfs(
  page: Page,
  attachmentsList: Locator,
  conversationId: string,
  subject: string,
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

    const filename = text.match(/^(.+\.pdf)/i)?.[1] ?? "attachment.pdf";

    await option.click({ button: "right" });
    await page.waitForTimeout(500);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: /download/i }).click(),
    ]);

    const pdfBytes = await download
      .path()
      .then((p) => (p ? readFileSync(p) : null));
    if (!pdfBytes) {
      console.log(`    ${filename} - download failed`);
      continue;
    }

    const signedPdf = await signPdf(pdfBytes, sigBytes, sigPath);
    items.push({ conversationId, subject, filename, signedPdf });
    console.log(`    ${filename} - signed`);
  }

  return items;
}

export async function runCommand() {
  const sigPath = resolve(config.signature.imagePath);
  if (!existsSync(sigPath)) {
    console.error(`Signature not found: ${sigPath}`);
    process.exit(1);
  }
  const sigBytes = readFileSync(sigPath);

  console.log("Opening Outlook...");
  const page = await getOutlookPage();

  console.log(`Navigating to "${config.outlook.folder}"...`);
  try {
    const folder = page.getByRole("treeitem", { name: config.outlook.folder });
    await folder.waitFor({ state: "visible", timeout: 10000 });
    await folder.click();
    console.log(`  Clicked folder`);
  } catch (_e) {
    console.error(`  Failed to find folder "${config.outlook.folder}"`);
    await takeErrorScreenshot(page, "folder-not-found");
    await closeBrowser();
    process.exit(1);
  }
  await page.waitForTimeout(2000);

  const emailItems = page.locator("[data-convid]");
  const count = await emailItems.count();
  console.log(`  Found ${count} emails in folder\n`);

  console.log("=== Fetching & Signing PDFs ===\n");

  const items: PdfItem[] = [];

  for (let i = 0; i < count; i++) {
    // Dismiss any open dialogs/cards
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const emailItem = emailItems.nth(i);
    console.log(`[${i + 1}/${count}] Opening email...`);
    await emailItem.click();
    await page.waitForTimeout(2000);

    const conversationId = (await emailItem.getAttribute("data-convid")) ?? "";
    const subjectEl = page
      .locator('[role="main"] [role="heading"][aria-level="2"]')
      .first();
    const subject = ((await subjectEl.textContent()) ?? "Unknown")
      .trim()
      .replace(/Summarize$/, "")
      .trim();
    console.log(`  Subject: "${subject}"`);
    console.log(`  ConversationId: ${conversationId}`);

    const readingPane = page.locator('[role="main"]');

    // Expand conversation to show all messages (click until no more "See more" buttons)
    let expandClicks = 0;
    let noButtonCount = 0;
    while (noButtonCount < 2) {
      await page.waitForTimeout(1500);
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

    // Click the message row to expand (not the From button which opens contact card)
    console.log(`  Expanding message...`);
    if ((await message.row.count()) > 0) {
      await message.row.click();
    } else {
      // Fallback: click near the button but not on it
      await message.button.click({ position: { x: -50, y: 0 } });
    }
    await page.waitForTimeout(1000);

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
    try {
      const newItems = await downloadAndSignPdfs(
        page,
        attachmentsList,
        conversationId,
        subject,
        sigBytes,
        sigPath,
      );
      items.push(...newItems);
    } catch (e) {
      console.error(`  -> Download/sign failed: ${e}`);
      await takeErrorScreenshot(page, `download-fail-${i}`);
    }
  }

  if (items.length === 0) {
    console.log("\nNo PDFs to process");
    await closeBrowser();
    return;
  }

  console.log(`\n=== Preparing ${items.length} Draft(s) ===\n`);

  const tmpDir = tmpdir();

  for (const [idx, item] of items.entries()) {
    // Dismiss any open dialogs/cards
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    console.log(
      `\n[${idx + 1}/${items.length}] "${item.subject}" - ${item.filename}`,
    );

    const emailItem = page.locator(`[data-convid="${item.conversationId}"]`);
    if ((await emailItem.count()) === 0) {
      console.log(`  -> Email not found in list, skipping`);
      await takeErrorScreenshot(page, `email-not-found-${idx}`);
      continue;
    }

    console.log(`  Clicking email...`);
    await emailItem.first().click();
    await page.waitForTimeout(1500);

    console.log(`  Opening reply...`);
    try {
      const replyBtn = page.getByRole("button", { name: "Reply" }).first();
      await replyBtn.waitFor({ state: "visible", timeout: 5000 });
      await replyBtn.click();
      await page.waitForTimeout(1000);
    } catch (e) {
      console.error(`  -> Reply button not found: ${e}`);
      await takeErrorScreenshot(page, `reply-btn-not-found-${idx}`);
      continue;
    }

    if (config.cc.enabled && config.cc.emails.length > 0) {
      const ccList = config.cc.emails.join("; ");
      console.log(`  Adding CC: ${ccList}`);
      try {
        // Enable Cc field via Options tab -> Show Cc checkbox
        const optionsTab = page.getByRole("tab", { name: "Options" });
        await optionsTab.click();
        await page.waitForTimeout(300);
        const showCcCheckbox = page.getByRole("checkbox", { name: "Show Cc" });
        await showCcCheckbox.waitFor({ state: "visible", timeout: 3000 });
        if (!(await showCcCheckbox.isChecked())) {
          await showCcCheckbox.click();
          await page.waitForTimeout(500);
        }

        // Go back to Message tab
        await page.getByRole("tab", { name: "Message" }).click();
        await page.waitForTimeout(300);

        // Fill the Cc field
        const ccField = page.locator('[aria-label="Cc"]').first();
        await ccField.waitFor({ state: "visible", timeout: 5000 });
        await ccField.click();
        await page.keyboard.type(ccList);
        await page.keyboard.press("Tab");
        await page.waitForTimeout(500);
      } catch (e) {
        console.error(`  -> CC failed: ${e}`);
        await takeErrorScreenshot(page, `cc-fail-${idx}`);
        continue;
      }
    }

    const tmpPath = join(tmpDir, item.filename);
    await Bun.write(tmpPath, item.signedPdf);

    console.log(`  Attaching signed PDF...`);
    try {
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 10000 }),
        page
          .getByRole("button", { name: "Attach file" })
          .click()
          .then(() =>
            page
              .getByRole("menuitem", { name: /browse this computer/i })
              .click(),
          ),
      ]);
      await fileChooser.setFiles(tmpPath);
      await page.waitForTimeout(3000);
    } catch (e) {
      console.error(`  -> Attach failed: ${e}`);
      await takeErrorScreenshot(page, `attach-fail-${idx}`);
      continue;
    }

    console.log(`  Typing reply message...`);
    const composeBody = page
      .locator('div[role="textbox"][contenteditable="true"]')
      .first();
    await composeBody.click();
    await composeBody.pressSequentially(config.replyMessage, { delay: 20 });

    // Save draft with Cmd+S
    console.log(`  Saving draft...`);
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+s" : "Control+s",
    );
    await page.waitForTimeout(2000);

    // Close compose - click Send dropdown and "Save draft" to ensure save, then close
    console.log(`  Closing compose...`);
    // Press Escape and Cancel to stay in compose but with draft saved
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    const discardDialog = page.getByRole("dialog");
    if ((await discardDialog.count()) > 0) {
      // Click Cancel - keeps compose open but draft is saved
      const cancelBtn = discardDialog.getByRole("button", { name: /cancel/i });
      if ((await cancelBtn.count()) > 0) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Now use keyboard shortcut to move - select email first via keyboard
    // Click Home tab to access Move button
    console.log(`  Switching to Home tab...`);
    const homeTab = page.getByRole("tab", { name: "Home" });
    if ((await homeTab.count()) > 0) {
      await homeTab.click();
      await page.waitForTimeout(500);
    }

    // Select email in list
    console.log(`  Selecting email...`);
    const emailInList = page
      .locator(`[data-convid="${item.conversationId}"]`)
      .first();
    await emailInList.click();
    await page.waitForTimeout(1000);

    // Move to Inbox
    console.log(`  Moving to Inbox...`);
    try {
      const moveButton = page.getByRole("button", { name: "Move to" });
      await moveButton.waitFor({ state: "visible", timeout: 10000 });
      await moveButton.click();
      await page.waitForTimeout(300);
      await page.getByRole("menuitem", { name: "Inbox" }).click();
      await page.waitForTimeout(500);
      console.log(`  -> Done`);
    } catch (e) {
      console.error(`  -> Move failed: ${e}`);
      await takeErrorScreenshot(page, `move-fail-${idx}`);
    }
  }

  console.log("\n=== Done ===");
  await closeBrowser();
}
