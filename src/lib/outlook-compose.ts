import type { Locator, Page } from "playwright";
import {
  type PdfItem,
  TIMING,
  config,
  escapeCssValue,
  generateAttachmentName,
  takeErrorScreenshot,
} from "./outlook-dom.js";
import { createTempRunDir } from "./temp-files.js";

async function openReplyForEmail(page: Page, conversationId: string): Promise<Locator> {
  const emailItem = page.locator(`[data-convid="${escapeCssValue(conversationId)}"]`);
  if ((await emailItem.count()) === 0) {
    throw new Error("Email not found in list");
  }

  await emailItem.first().click();

  const replyBtn = page.getByRole("button", { name: "Reply" }).first();
  await replyBtn.waitFor({
    state: "visible",
    timeout: TIMING.ELEMENT_VISIBLE,
  });
  await replyBtn.click();

  const composeBody = page.locator('div[role="textbox"][contenteditable="true"]').first();
  await composeBody.waitFor({
    state: "visible",
    timeout: TIMING.ELEMENT_VISIBLE,
  });
  return composeBody;
}

async function addCcRecipients(page: Page, emails: string[]): Promise<void> {
  if (emails.length === 0) {
    return;
  }

  const ccList = emails.join("; ");
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
}

async function attachSignedPdf(page: Page, tmpPath: string): Promise<void> {
  const attachBtn = page.getByRole("button", { name: "Attach file" });
  await attachBtn.waitFor({
    state: "visible",
    timeout: TIMING.ELEMENT_VISIBLE,
  });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: TIMING.FILE_CHOOSER }),
    attachBtn
      .click()
      .then(async () => page.getByRole("menuitem", { name: /browse this computer/i }).click()),
  ]);
  await fileChooser.setFiles(tmpPath);

  await page.waitForTimeout(TIMING.UPLOAD_COMPLETE);

  const closePromptBtn = page.locator('[role="button"][aria-label="Close"]').last();
  if ((await closePromptBtn.count()) > 0) {
    await closePromptBtn.click().catch(() => {
      /* Ignore */
    });
    await page.waitForTimeout(TIMING.UI_SETTLE);
  }
}

async function saveDraftAndClose(page: Page, composeBody: Locator, message: string): Promise<void> {
  await composeBody.click();
  await composeBody.pressSequentially(message, { delay: 20 });

  await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
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

async function moveEmailToInbox(page: Page, conversationId: string): Promise<void> {
  const emailInList = page.locator(`[data-convid="${escapeCssValue(conversationId)}"]`).first();
  await emailInList.click();

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
}

export async function prepareDrafts(page: Page, items: PdfItem[]): Promise<void> {
  console.log(`\n=== Preparing ${items.length} Draft(s) ===\n`);

  const tempDir = createTempRunDir();

  try {
    for (const [idx, item] of items.entries()) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(TIMING.MENU_ANIMATION);

      const attachmentName = generateAttachmentName(item.senderLastname, new Date());
      console.log(`\n[${idx + 1}/${items.length}] "${item.subject}" -> ${attachmentName}`);

      let composeBody: Locator;
      console.log(`  Opening reply...`);
      try {
        composeBody = await openReplyForEmail(page, item.conversationId);
      } catch (error) {
        console.log(`  -> ${error instanceof Error ? error.message : String(error)}, skipping`);
        await takeErrorScreenshot(page, `reply-fail-${idx}`);
        continue;
      }

      if (config.cc.enabled && config.cc.emails.length > 0) {
        console.log(`  Adding CC: ${config.cc.emails.join("; ")}`);
        try {
          await addCcRecipients(page, config.cc.emails);
        } catch (error) {
          console.log(`  -> ${error instanceof Error ? error.message : String(error)}, skipping`);
          await takeErrorScreenshot(page, `cc-fail-${idx}`);
          continue;
        }
      }

      const tmpPath = tempDir.filePath(attachmentName);
      await Bun.write(tmpPath, item.signedPdf);

      console.log(`  Attaching signed PDF...`);
      try {
        await attachSignedPdf(page, tmpPath);
      } catch (error) {
        console.log(`  -> ${error instanceof Error ? error.message : String(error)}, skipping`);
        await takeErrorScreenshot(page, `attach-fail-${idx}`);
        continue;
      } finally {
        tempDir.cleanupFile(tmpPath);
      }

      console.log(`  Saving draft...`);
      await saveDraftAndClose(page, composeBody, config.replyMessage);

      console.log(`  Moving to Inbox...`);
      try {
        await moveEmailToInbox(page, item.conversationId);
        console.log(`  -> Done`);
      } catch (error) {
        console.log(`  -> ${error instanceof Error ? error.message : String(error)}`);
        await takeErrorScreenshot(page, `move-fail-${idx}`);
      }
    }
  } finally {
    tempDir.cleanup();
  }
}
