/* eslint-disable unicorn/no-null */
import {
  TIMING,
  getByRole,
  simulateClick,
  simulateKeyPress,
  sleep,
  typeText,
  waitForElement,
} from "./dom-utils.js";

function isMac(): boolean {
  return navigator.userAgent.includes("Mac");
}

async function findMenuItem(
  predicate: (text: string) => boolean,
  timeout = 2000,
): Promise<Element | undefined> {
  try {
    return await waitForElement('[role="menuitem"]', {
      match: (el) => predicate((el.textContent ?? "").toLowerCase()),
      timeout,
    });
  } catch {
    return undefined;
  }
}

async function removeFirstAttachment(): Promise<boolean> {
  const composeBody = document.querySelector('div[role="textbox"][contenteditable="true"]');
  if (!composeBody) {
    return false;
  }

  const composeContainer =
    composeBody.closest('[role="dialog"], [role="form"], form') ??
    composeBody.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
  if (!composeContainer) {
    return false;
  }

  const listbox = composeContainer.querySelector('[role="listbox"][aria-label*="attachment" i]');
  if (!listbox) {
    return false;
  }

  const [attachment] = listbox.querySelectorAll('[role="option"]');
  if (!attachment) {
    return false;
  }

  const moreActionsBtn = attachment.querySelector('button[aria-label*="action" i]');
  if (!moreActionsBtn) {
    return false;
  }

  simulateClick(moreActionsBtn);
  await sleep(TIMING.MENU_ANIMATION);

  const removeItem = await findMenuItem(
    (text) => text.includes("remove") || text.includes("delete") || text.includes("supprimer"),
  );

  if (!removeItem) {
    simulateKeyPress("Escape");
    await sleep(TIMING.MENU_ANIMATION);
    return false;
  }

  simulateClick(removeItem);
  await sleep(TIMING.UI_SETTLE);
  return true;
}

export async function openReply(conversationId?: string): Promise<HTMLElement> {
  if (conversationId !== undefined && conversationId !== "") {
    const emailItem = document.querySelector(`[data-convid="${CSS.escape(conversationId)}"]`);
    if (emailItem) {
      simulateClick(emailItem);
      await sleep(TIMING.UI_SETTLE);
    }
  }

  const replyBtn = await waitForElement('button[name="Reply"], button[aria-label*="Reply"]');
  simulateClick(replyBtn);

  const composeBody = await waitForElement('div[role="textbox"][contenteditable="true"]');
  if (!(composeBody instanceof HTMLElement)) {
    throw new Error("Compose body is not an HTMLElement");
  }
  return composeBody;
}

export async function removeAllAttachments(): Promise<void> {
  while (await removeFirstAttachment()) {
    // Continue removing until no more attachments
  }
}

export async function attachFile(pdfBytes: Uint8Array, filename: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TS lib typing issue: Uint8Array<ArrayBufferLike> not assignable to BlobPart
  const file = new File([pdfBytes as BlobPart], filename, { type: "application/pdf" });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  const attachBtn = await waitForElement('button[aria-label*="Attach"], button[name*="Attach"]', {
    timeout: 3000,
  });
  simulateClick(attachBtn);
  await sleep(TIMING.MENU_ANIMATION);

  const browseItem = await findMenuItem(
    (text) =>
      (text.includes("browse") && text.includes("computer")) ||
      (text.includes("parcourir") && text.includes("ordinateur")),
  );

  if (browseItem !== undefined) {
    simulateClick(browseItem);
  }

  await sleep(TIMING.UI_SETTLE);

  const fileInputs = [...document.querySelectorAll('input[type="file"]')].filter(
    (input): input is HTMLInputElement => input instanceof HTMLInputElement,
  );

  const attachmentInput =
    fileInputs.find((input) => {
      const accept = input.getAttribute("accept");
      return accept === null || !accept.startsWith("image/");
    }) ?? fileInputs.at(-1);

  if (!attachmentInput) {
    throw new Error("Could not find file input for attachment");
  }

  attachmentInput.files = dataTransfer.files;
  attachmentInput.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(TIMING.UPLOAD_COMPLETE);
}

export function typeMessage(composeBody: HTMLElement, message: string): void {
  composeBody.focus();
  typeText(composeBody, message);
}

export async function saveDraft(): Promise<void> {
  simulateKeyPress("s", isMac() ? { meta: true } : { ctrl: true });
  await sleep(TIMING.CONTENT_LOAD);
}

export async function closeCompose(): Promise<void> {
  simulateKeyPress("Escape");
  await sleep(TIMING.UI_SETTLE);

  const dialog = document.querySelector('[role="dialog"]');
  if (dialog) {
    const cancelBtn = [...dialog.querySelectorAll("button")].find((btn) =>
      (btn.textContent ?? "").toLowerCase().includes("cancel"),
    );
    if (cancelBtn) {
      simulateClick(cancelBtn);
      await sleep(TIMING.UI_SETTLE);
    }
  }

  const homeTab = getByRole("tab", { name: "Home" });
  if (homeTab) {
    simulateClick(homeTab);
    await sleep(TIMING.UI_SETTLE);
  }

  for (let idx = 0; idx < 20; idx += 1) {
    if (!document.querySelector('[role="textbox"][contenteditable="true"]')) {
      break;
    }
    await sleep(200);
  }
}
