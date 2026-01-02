import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Locator, Page } from "playwright";
import { config } from "../config.js";
import { escapeCssValue } from "../lib/css.js";
import {
  extractLastname,
  generateAttachmentName,
  getSignatureFormat,
  type SignatureFormat,
  signPdf,
} from "../lib/pdf.js";
import {
  createOutlookSession,
  takeErrorScreenshot,
} from "../services/browser.js";

export type PdfItem = {
  conversationId: string;
  subject: string;
  senderLastname: string;
  signedPdf: Uint8Array;
};

export const TIMING = {
  MENU_ANIMATION: 300,
  UI_SETTLE: 500,
  CONTENT_LOAD: 1000,
  DOWNLOAD_MENU: 5000,
  ELEMENT_VISIBLE: 10000,
  CC_CHECKBOX: 3000,
  FILE_CHOOSER: 10000,
  UPLOAD_COMPLETE: 2000,
  CC_FIELD: 5000,
  MOVE_MENU: 5000,
} as const;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = <T>(error: string): Result<T> => ({ ok: false, error });

// XPath Selectors Documentation:
// These selectors are tightly coupled to Outlook Web's DOM structure.
// If Outlook updates break automation, check these selectors first.
//
// MESSAGE_ROW_XPATH: Finds the clickable message container from the "From:" button.
// - Outlook renders each message with a "From:" button inside a clickable row
// - The row has cursor:pointer style or tabindex for keyboard navigation
// - We click the row (not the button) to avoid opening the contact card popup
const MESSAGE_ROW_XPATH =
  "xpath=ancestor::*[contains(@style, 'cursor') or @tabindex][1]";

// ATTACHMENTS_FOLLOWING_XPATH: Finds the attachments listbox after a message's From button.
// - In Outlook, each message's attachments appear in a listbox element
// - The listbox follows the message content in DOM order
// - aria-label contains "attachments" for accessibility
const ATTACHMENTS_FOLLOWING_XPATH =
  'xpath=following::*[@role="listbox"][contains(@aria-label, "attachments")][1]';

// DRAFT_MARKER_XPATH: Detects if a listbox belongs to a draft message.
// - Draft messages show "[Draft]" text in their header area
// - We look up to 8 ancestors to find the message container with draft marker
// - This helps skip our own draft attachments when looking for received files
const DRAFT_MARKER_XPATH =
  "xpath=ancestor::*[position() <= 8]//*[contains(text(), '[Draft]')]";

export async function findLastMessageFromOthers(
  readingPane: Locator,
  myEmail: string = config.myEmail,
): Promise<{ row: Locator; button: Locator; senderLastname: string } | null> {
  const fromButtons = readingPane.getByRole("button", { name: /^From:/ });
  const count = await fromButtons.count();

  for (let i = count - 1; i >= 0; i--) {
    const btn = fromButtons.nth(i);
    const fromText = (await btn.textContent()) ?? "";
    if (!fromText.toLowerCase().includes(myEmail.toLowerCase())) {
      const row = btn.locator(MESSAGE_ROW_XPATH);
      const senderLastname = extractLastname(fromText);
      return { row, button: btn, senderLastname };
    }
  }
  return null;
}

export async function findAttachmentListbox(
  readingPane: Locator,
  messageButton: Locator,
): Promise<Locator | null> {
  const following = messageButton.locator(ATTACHMENTS_FOLLOWING_XPATH);
  if ((await following.count()) > 0) return following.first();

  // Fallback: find last non-draft listbox
  const allLists = readingPane.getByRole("listbox", { name: /attachments/i });
  const count = await allLists.count();

  for (let i = count - 1; i >= 0; i--) {
    const lb = allLists.nth(i);
    const draftMarker = lb.locator(DRAFT_MARKER_XPATH);
    if ((await draftMarker.count()) === 0) return lb;
  }

  return null;
}

export async function downloadAndSignPdfs(
  page: Page,
  attachmentsList: Locator,
  conversationId: string,
  subject: string,
  senderLastname: string,
  sigBytes: Uint8Array,
  sigFormat: SignatureFormat,
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
    await downloadMenuItem.waitFor({
      state: "visible",
      timeout: TIMING.DOWNLOAD_MENU,
    });

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

    const signedPdf = await signPdf(
      pdfBytes,
      sigBytes,
      sigFormat,
      config.signature,
    );
    items.push({ conversationId, subject, senderLastname, signedPdf });
    console.log(`    ${originalFilename} - signed`);
  }

  return items;
}

async function collectSignedPdfs(
  page: Page,
  sigBytes: Uint8Array,
  sigFormat: SignatureFormat,
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
    await subjectEl.waitFor({
      state: "visible",
      timeout: TIMING.ELEMENT_VISIBLE,
    });
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
        sigFormat,
      );
      items.push(...newItems);
    } catch (e) {
      console.error(`  -> Download/sign failed: ${e}`);
      await takeErrorScreenshot(page, `download-fail-${i}`);
    }
  }

  return items;
}

async function openReplyForEmail(
  page: Page,
  conversationId: string,
): Promise<Result<Locator>> {
  const emailItem = page.locator(
    `[data-convid="${escapeCssValue(conversationId)}"]`,
  );
  if ((await emailItem.count()) === 0) {
    return err("Email not found in list");
  }

  await emailItem.first().click();

  try {
    const replyBtn = page.getByRole("button", { name: "Reply" }).first();
    await replyBtn.waitFor({
      state: "visible",
      timeout: TIMING.ELEMENT_VISIBLE,
    });
    await replyBtn.click();
  } catch (e) {
    return err(`Reply button not found: ${e instanceof Error ? e.message : e}`);
  }

  try {
    const composeBody = page
      .locator('div[role="textbox"][contenteditable="true"]')
      .first();
    await composeBody.waitFor({
      state: "visible",
      timeout: TIMING.ELEMENT_VISIBLE,
    });
    return ok(composeBody);
  } catch (e) {
    return err(`Compose body not found: ${e instanceof Error ? e.message : e}`);
  }
}

async function addCcRecipients(
  page: Page,
  emails: string[],
): Promise<Result<void>> {
  if (emails.length === 0) return ok(undefined);

  const ccList = emails.join("; ");
  try {
    const optionsTab = page.getByRole("tab", { name: "Options" });
    await optionsTab.click();
    await page.waitForTimeout(TIMING.MENU_ANIMATION);

    const showCcCheckbox = page.getByRole("checkbox", { name: "Show Cc" });
    await showCcCheckbox.waitFor({
      state: "visible",
      timeout: TIMING.CC_CHECKBOX,
    });
    if (!(await showCcCheckbox.isChecked())) {
      await showCcCheckbox.click();
      await page.waitForTimeout(TIMING.UI_SETTLE);
    }

    await page.getByRole("tab", { name: "Message" }).click();
    await page.waitForTimeout(TIMING.MENU_ANIMATION);

    const ccField = page.locator('[aria-label="Cc"]').first();
    await ccField.waitFor({ state: "visible", timeout: TIMING.CC_FIELD });
    await ccField.click();
    await page.keyboard.type(ccList);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(TIMING.UI_SETTLE);

    return ok(undefined);
  } catch (e) {
    return err(`Failed to add CC recipients: ${e instanceof Error ? e.message : e}`);
  }
}

async function attachSignedPdf(
  page: Page,
  tmpPath: string,
): Promise<Result<void>> {
  try {
    const attachBtn = page.getByRole("button", { name: "Attach file" });
    await attachBtn.waitFor({
      state: "visible",
      timeout: TIMING.ELEMENT_VISIBLE,
    });

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: TIMING.FILE_CHOOSER }),
      attachBtn
        .click()
        .then(() =>
          page.getByRole("menuitem", { name: /browse this computer/i }).click(),
        ),
    ]);
    await fileChooser.setFiles(tmpPath);

    await page.waitForTimeout(TIMING.UPLOAD_COMPLETE);

    const closePromptBtn = page
      .locator('[role="button"][aria-label="Close"]')
      .last();
    if ((await closePromptBtn.count()) > 0) {
      await closePromptBtn.click().catch(() => {});
      await page.waitForTimeout(TIMING.UI_SETTLE);
    }

    return ok(undefined);
  } catch (e) {
    return err(`Failed to attach file: ${e instanceof Error ? e.message : e}`);
  }
}

async function saveDraftAndClose(
  page: Page,
  composeBody: Locator,
  message: string,
): Promise<void> {
  await composeBody.click();
  await composeBody.pressSequentially(message, { delay: 20 });

  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+s" : "Control+s",
  );
  await page.waitForTimeout(TIMING.CONTENT_LOAD);

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

  const homeTab = page.getByRole("tab", { name: "Home" });
  if ((await homeTab.count()) > 0) {
    await homeTab.click();
    await page.waitForTimeout(TIMING.UI_SETTLE);
  }
}

async function moveEmailToInbox(
  page: Page,
  conversationId: string,
): Promise<Result<void>> {
  const emailInList = page
    .locator(`[data-convid="${escapeCssValue(conversationId)}"]`)
    .first();
  await emailInList.click();

  try {
    const moveButton = page.getByRole("button", { name: "Move to" });
    await moveButton.waitFor({
      state: "visible",
      timeout: TIMING.ELEMENT_VISIBLE,
    });
    await moveButton.click();
    const inboxItem = page.getByRole("menuitem", { name: "Inbox" });
    await inboxItem.waitFor({ state: "visible", timeout: TIMING.MOVE_MENU });
    await inboxItem.click();
    await page.waitForTimeout(TIMING.UI_SETTLE);
    return ok(undefined);
  } catch {
    return err("Failed to move email to inbox");
  }
}

async function prepareDrafts(page: Page, items: PdfItem[]): Promise<void> {
  console.log(`\n=== Preparing ${items.length} Draft(s) ===\n`);

  const runDir = join(tmpdir(), `opm-${Date.now()}`);
  mkdirSync(runDir, { recursive: true });

  try {
    for (const [idx, item] of items.entries()) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(TIMING.MENU_ANIMATION);

      const attachmentName = generateAttachmentName(
        item.senderLastname,
        new Date(),
      );
      console.log(
        `\n[${idx + 1}/${items.length}] "${item.subject}" -> ${attachmentName}`,
      );

      console.log(`  Opening reply...`);
      const replyResult = await openReplyForEmail(page, item.conversationId);
      if (!replyResult.ok) {
        console.log(`  -> ${replyResult.error}, skipping`);
        await takeErrorScreenshot(page, `reply-fail-${idx}`);
        continue;
      }
      const composeBody = replyResult.value;

      if (config.cc.enabled && config.cc.emails.length > 0) {
        console.log(`  Adding CC: ${config.cc.emails.join("; ")}`);
        const ccResult = await addCcRecipients(page, config.cc.emails);
        if (!ccResult.ok) {
          console.log(`  -> ${ccResult.error}, skipping`);
          await takeErrorScreenshot(page, `cc-fail-${idx}`);
          continue;
        }
      }

      const tmpPath = join(runDir, attachmentName);
      await Bun.write(tmpPath, item.signedPdf);

      console.log(`  Attaching signed PDF...`);
      const attachResult = await attachSignedPdf(page, tmpPath);
      try {
        unlinkSync(tmpPath);
      } catch {}
      if (!attachResult.ok) {
        console.log(`  -> ${attachResult.error}, skipping`);
        await takeErrorScreenshot(page, `attach-fail-${idx}`);
        continue;
      }

      console.log(`  Saving draft...`);
      await saveDraftAndClose(page, composeBody, config.replyMessage);

      console.log(`  Moving to Inbox...`);
      const moveResult = await moveEmailToInbox(page, item.conversationId);
      if (!moveResult.ok) {
        console.log(`  -> ${moveResult.error}`);
        await takeErrorScreenshot(page, `move-fail-${idx}`);
      } else {
        console.log(`  -> Done`);
      }
    }
  } finally {
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
    } catch (_e) {
      console.error(`  Failed to find folder "${config.outlook.folder}"`);
      await takeErrorScreenshot(session.page, "folder-not-found");
      throw new Error(`Folder "${config.outlook.folder}" not found`);
    }
    // Wait for email list to load
    await session.page
      .locator("[data-convid]")
      .first()
      .waitFor({ state: "attached", timeout: TIMING.ELEMENT_VISIBLE })
      .catch(() => {});

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
