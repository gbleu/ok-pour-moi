import type { Download, Locator, Page } from "playwright";
import { escapeCssValue } from "./css.js";
import { extractLastname } from "./pdf.js";

export const TIMING = {
  CC_CHECKBOX: 3000,
  CC_FIELD: 5000,
  CONTENT_LOAD: 1000,
  DOWNLOAD_MENU: 5000,
  ELEMENT_VISIBLE: 10_000,
  FILE_CHOOSER: 10_000,
  MENU_ANIMATION: 300,
  MOVE_MENU: 5000,
  UI_SETTLE: 500,
  UPLOAD_COMPLETE: 2000,
} as const;

const MESSAGE_ROW_XPATH = "xpath=ancestor::*[contains(@style, 'cursor') or @tabindex][1]";
const ATTACHMENTS_FOLLOWING_XPATH =
  'xpath=following::*[@role="listbox"][contains(@aria-label, "attachments")][1]';
const DRAFT_MARKER_XPATH = "xpath=ancestor::*[position() <= 8]//*[contains(text(), '[Draft]')]";

export async function selectEmail(
  page: Page,
  index: number,
): Promise<{ emailItem: Locator; conversationId: string; subject: string }> {
  const emailItems = page.locator("[data-convid]");
  const emailItem = emailItems.nth(index);
  await emailItem.click();

  const conversationId = (await emailItem.getAttribute("data-convid")) ?? "";
  const subjectEl = page.locator('[role="main"] [role="heading"][aria-level="2"]').first();
  await subjectEl.waitFor({ state: "visible", timeout: TIMING.ELEMENT_VISIBLE });
  const subject = ((await subjectEl.textContent()) ?? "Unknown")
    .trim()
    .replace(/Summarize$/, "")
    .trim();

  return { conversationId, emailItem, subject };
}

export async function expandThread(page: Page): Promise<number> {
  const readingPane = page.locator('[role="main"]');
  let expandClicks = 0;

  for (let misses = 0; misses < 2; ) {
    await page.waitForTimeout(TIMING.CONTENT_LOAD);
    const seeMoreBtn = readingPane.getByRole("button", { name: "See more messages" }).first();
    const visible = await seeMoreBtn.isVisible().catch(() => false);

    if (!visible) {
      misses += 1;
      continue;
    }

    misses = 0;
    expandClicks += 1;
    await seeMoreBtn.click();
  }

  return expandClicks;
}

export async function findLastMessageFromOthers(
  readingPane: Locator,
  myEmail: string,
): Promise<{ row: Locator; button: Locator; senderLastname: string } | undefined> {
  const fromButtons = readingPane.getByRole("button", { name: /^From:/ });
  const count = await fromButtons.count();

  for (let i = count - 1; i >= 0; i -= 1) {
    const btn = fromButtons.nth(i);
    const fromText = (await btn.textContent()) ?? "";
    if (!fromText.toLowerCase().includes(myEmail.toLowerCase())) {
      const row = btn.locator(MESSAGE_ROW_XPATH);
      const senderLastname = extractLastname(fromText);
      return { button: btn, row, senderLastname };
    }
  }
  return undefined;
}

export async function expandMessage(message: { row: Locator; button: Locator }): Promise<void> {
  if ((await message.row.count()) > 0) {
    await message.row.click();
  } else {
    await message.button.click({ position: { x: -50, y: 0 } });
  }
}

export async function findAttachmentListbox(
  readingPane: Locator,
  messageButton: Locator,
): Promise<Locator | undefined> {
  const following = messageButton.locator(ATTACHMENTS_FOLLOWING_XPATH);
  if ((await following.count()) > 0) {
    return following.first();
  }

  const allLists = readingPane.getByRole("listbox", { name: /attachments/i });
  const count = await allLists.count();

  for (let i = count - 1; i >= 0; i -= 1) {
    const lb = allLists.nth(i);
    const draftMarker = lb.locator(DRAFT_MARKER_XPATH);
    if ((await draftMarker.count()) === 0) {
      return lb;
    }
  }

  return undefined;
}

export async function downloadAttachment(page: Page, option: Locator): Promise<Download> {
  await option.click({ button: "right" });
  const downloadMenuItem = page.getByRole("menuitem", { name: /download/i });
  await downloadMenuItem.waitFor({ state: "visible", timeout: TIMING.DOWNLOAD_MENU });

  const [download] = await Promise.all([page.waitForEvent("download"), downloadMenuItem.click()]);
  return download;
}

export async function openReply(page: Page, conversationId?: string): Promise<Locator> {
  if (conversationId !== undefined) {
    const emailItem = page.locator(`[data-convid="${escapeCssValue(conversationId)}"]`);
    if ((await emailItem.count()) === 0) {
      throw new Error("Email not found in list");
    }
    await emailItem.first().click();
  }

  const replyBtn = page.getByRole("button", { name: "Reply" }).first();
  await replyBtn.waitFor({ state: "visible", timeout: TIMING.ELEMENT_VISIBLE });
  await replyBtn.click();

  const composeBody = page.locator('div[role="textbox"][contenteditable="true"]').first();
  await composeBody.waitFor({ state: "visible", timeout: TIMING.ELEMENT_VISIBLE });
  return composeBody;
}

export async function addCcRecipients(page: Page, emails: string[]): Promise<void> {
  if (emails.length === 0) {
    return;
  }

  const ccList = emails.join("; ");
  const optionsTab = page.getByRole("tab", { name: "Options" });
  await optionsTab.click();
  await page.waitForTimeout(TIMING.MENU_ANIMATION);

  const showCcCheckbox = page.getByRole("checkbox", { name: "Show Cc" });
  await showCcCheckbox.waitFor({ state: "visible", timeout: TIMING.CC_CHECKBOX });
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

export async function attachFile(page: Page, filePath: string): Promise<void> {
  const attachBtn = page.getByRole("button", { name: "Attach file" });
  await attachBtn.waitFor({ state: "visible", timeout: TIMING.ELEMENT_VISIBLE });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: TIMING.FILE_CHOOSER }),
    attachBtn
      .click()
      .then(async () => page.getByRole("menuitem", { name: /browse this computer/i }).click()),
  ]);
  await fileChooser.setFiles(filePath);

  const attachmentChip = page.locator('[class*="attachment"]').filter({ hasText: /./ });
  await attachmentChip.waitFor({ state: "visible", timeout: TIMING.UPLOAD_COMPLETE }).catch(() => {
    /* Ignore if attachment indicator doesn't appear */
  });

  const closePromptBtn = page.locator('[role="button"][aria-label="Close"]').last();
  if ((await closePromptBtn.count()) > 0) {
    await closePromptBtn.click().catch(() => {
      /* Ignore click errors */
    });
    await page.waitForTimeout(TIMING.UI_SETTLE);
  }
}

export async function typeMessage(composeBody: Locator, message: string): Promise<void> {
  await composeBody.click();
  await composeBody.pressSequentially(message, { delay: 20 });
}

export async function saveDraft(page: Page): Promise<void> {
  await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
  await page.waitForTimeout(TIMING.CONTENT_LOAD);
}

export async function closeCompose(page: Page): Promise<void> {
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

export async function moveToFolder(
  page: Page,
  conversationId: string,
  folderName: string,
): Promise<void> {
  const emailInList = page.locator(`[data-convid="${escapeCssValue(conversationId)}"]`).first();
  await emailInList.click();

  const moveButton = page.getByRole("button", { name: "Move to" });
  await moveButton.waitFor({ state: "visible", timeout: TIMING.ELEMENT_VISIBLE });
  await moveButton.click();

  const folderItem = page.getByRole("menuitem", { name: folderName });
  await folderItem.waitFor({ state: "visible", timeout: TIMING.MOVE_MENU });
  await folderItem.click();
  await page.waitForTimeout(TIMING.UI_SETTLE);
}
