/* eslint-disable unicorn/no-null */
import {
  TIMING,
  getByRole,
  simulateClick,
  simulateKeyPress,
  sleep,
  waitForElement,
} from "./outlook-automation.js";

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

  // Outlook nests the compose textbox ~5 levels deep within the compose pane. closest() covers
  // Standard dialog/form wrappers; the parentElement chain is a fallback for inline compose mode.
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

export async function openReply(conversationId: string): Promise<HTMLElement> {
  const emailItem = document.querySelector(`[data-convid="${CSS.escape(conversationId)}"]`);
  if (emailItem) {
    simulateClick(emailItem);
    await sleep(TIMING.UI_SETTLE);
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
    /* Empty */
  }
}

function findFileInput(): HTMLInputElement {
  const fileInputs = [...document.querySelectorAll('input[type="file"]')].filter(
    (input: Element): input is HTMLInputElement => input instanceof HTMLInputElement,
  );

  const attachmentInput =
    fileInputs.find((input: HTMLInputElement) => {
      const accept = input.getAttribute("accept");
      return accept === null || !accept.startsWith("image/");
    }) ?? fileInputs.at(-1);

  if (!attachmentInput) {
    throw new Error("Could not find file input for attachment");
  }

  return attachmentInput;
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

  const input = findFileInput();
  input.files = dataTransfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(TIMING.UPLOAD_COMPLETE);
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
    const cancelBtn = [...dialog.querySelectorAll("button")].find((btn: HTMLButtonElement) =>
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

  for (let idx = 0; idx < TIMING.COMPOSE_CLOSE_MAX_POLLS; idx += 1) {
    if (!document.querySelector('[role="textbox"][contenteditable="true"]')) {
      break;
    }
    await sleep(TIMING.COMPOSE_CLOSE_INTERVAL);
  }
}
