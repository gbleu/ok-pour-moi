/* eslint-disable max-lines, promise/avoid-new, no-bitwise, no-negated-condition, unicorn/no-useless-undefined, unicorn/prefer-global-this, unicorn/no-null, unicorn/prefer-dom-node-text-content */
import {
  TIMING,
  getButtonByName,
  getByRole,
  simulateClick,
  simulateKeyPress,
  simulateRightClick,
  sleep,
  typeText,
  waitForElement,
} from "./dom-utils.js";
import { extractEmail, extractLastname } from "../shared/pdf.js";
import { escapeCssValue } from "../shared/css.js";

export interface EmailSelection {
  conversationId: string;
  subject: string;
}

export interface MessageInfo {
  element: Element;
  senderLastname: string;
  senderEmail: string;
}

export async function selectEmail(index: number): Promise<EmailSelection> {
  const emailItems = document.querySelectorAll("[data-convid]");
  const emailItem = emailItems[index];
  if (emailItem === undefined) {
    throw new Error(`No email at index ${index}`);
  }

  simulateClick(emailItem);

  const conversationId = emailItem instanceof HTMLElement ? (emailItem.dataset.convid ?? "") : "";
  const subjectEl = await waitForElement('[role="main"] [role="heading"][aria-level="2"]');
  const subject = (subjectEl.textContent ?? "Unknown")
    .trim()
    .replace(/Summarize$/, "")
    .trim();

  return { conversationId, subject };
}

export async function expandThread(): Promise<number> {
  const readingPane = document.querySelector('[role="main"]');
  if (readingPane === null) {
    return 0;
  }

  let expandClicks = 0;
  for (let misses = 0; misses < 2; ) {
    await sleep(TIMING.CONTENT_LOAD);
    const seeMoreBtn = getButtonByName("See more messages", readingPane);

    if (seeMoreBtn === undefined || getComputedStyle(seeMoreBtn).display === "none") {
      misses += 1;
      continue;
    }

    misses = 0;
    expandClicks += 1;
    simulateClick(seeMoreBtn);
  }

  return expandClicks;
}

export function findLastMessageFromOthers(myEmail: string): MessageInfo | undefined {
  const readingPane = document.querySelector('[role="main"]');
  if (readingPane === null) {
    return undefined;
  }

  const senderElements = [
    ...readingPane.querySelectorAll('[role="button"][aria-label^="From:"], button[name^="From:"]'),
  ];

  for (const el of senderElements.toReversed()) {
    const ariaLabel = el.getAttribute("aria-label") ?? "";
    const nameAttr = el.getAttribute("name") ?? "";
    const textContent = el.textContent?.trim() ?? "";

    const fromText = [ariaLabel, nameAttr].find((text) => text.startsWith("From:")) ?? textContent;

    const emailElement = el.querySelector("[data-email]");
    const elementEmail =
      emailElement instanceof HTMLElement ? (emailElement.dataset.email ?? "") : "";

    const myEmailLower = myEmail.toLowerCase();
    const isOwnMessage =
      elementEmail.toLowerCase() === myEmailLower ||
      fromText.toLowerCase().includes(myEmailLower) ||
      textContent.toLowerCase() === "you" ||
      textContent.toLowerCase() === "moi";

    if (!isOwnMessage) {
      const senderLastname = extractLastname(
        fromText.includes("From:") ? fromText : `From: ${fromText}`,
      );
      const senderEmail =
        elementEmail ||
        extractEmail(textContent) ||
        (el instanceof HTMLElement ? extractEmail(el.textContent ?? "") : "") ||
        extractEmail(fromText);

      if (senderEmail) {
        return { element: el, senderEmail, senderLastname };
      }
    }
  }

  return undefined;
}

function findAncestor(
  element: Element,
  predicate: (ancestor: Element) => boolean,
  maxDepth = 10,
): Element | undefined {
  let current: Element | null = element.parentElement;
  for (let depth = 0; depth < maxDepth && current !== null; depth += 1) {
    if (predicate(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return undefined;
}

export async function expandMessage(messageButton: Element): Promise<void> {
  const clickTarget =
    findAncestor(messageButton, (ancestor) => {
      const ariaLabel = ancestor.getAttribute("aria-label") ?? "";
      if (ariaLabel.startsWith("From:")) {
        return false;
      }
      const style = window.getComputedStyle(ancestor);
      return ancestor.hasAttribute("tabindex") || style.cursor === "pointer";
    }) ?? messageButton.closest('[data-is-focusable="true"], [role="listitem"], [role="article"]');

  if (clickTarget !== null && clickTarget !== messageButton) {
    simulateClick(clickTarget);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await sleep(TIMING.CONTENT_LOAD);
    if (
      findAncestor(
        messageButton,
        (ancestor) =>
          ancestor.querySelector('[role="listbox"][aria-label*="attachment" i]') !== null,
      ) !== undefined
    ) {
      return;
    }
  }
}

export function findAttachmentListbox(messageButton: Element): Element | undefined {
  return findAncestor(messageButton, (ancestor) => {
    const listboxes = ancestor.querySelectorAll('[role="listbox"][aria-label*="attachment" i]');
    for (const listbox of listboxes) {
      if (
        (messageButton.compareDocumentPosition(listbox) & Node.DOCUMENT_POSITION_FOLLOWING) !==
        0
      ) {
        return true;
      }
    }
    return false;
  });
}

export function getPdfOptions(attachmentListbox: Element): Element[] {
  const options = attachmentListbox.querySelectorAll('[role="option"]');
  return [...options].filter((opt) => (opt.textContent ?? "").toLowerCase().includes(".pdf"));
}

// Blob capture via main-world.js
let blobListenerReady = false;

function setupBlobCapture(): void {
  if (!blobListenerReady) {
    window.addEventListener("message", (event: MessageEvent<{ type: string }>) => {
      if (event.data?.type === "OPM_BLOB_CAPTURED") {
        console.log("[OPM] Blob captured");
      }
    });
    blobListenerReady = true;
  }
}

async function getBlobData(): Promise<Uint8Array | undefined> {
  return new Promise((resolve) => {
    function handler(event: MessageEvent<{ data: number[] | undefined; type: string }>): void {
      if (event.data?.type === "OPM_BLOB_DATA") {
        window.removeEventListener("message", handler);
        resolve(event.data.data !== undefined ? new Uint8Array(event.data.data) : undefined);
      }
    }
    window.addEventListener("message", handler);
    window.postMessage({ type: "OPM_GET_BLOB_DATA" }, "*");
    setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(undefined);
    }, 1000);
  });
}

async function pollForBlobData(maxAttempts = 30): Promise<Uint8Array | undefined> {
  for (let idx = 0; idx < maxAttempts; idx += 1) {
    await sleep(100);
    const data = await getBlobData();
    if (data !== undefined && data.length > 0) {
      return data;
    }
  }
  return undefined;
}

export async function downloadAttachment(option: Element): Promise<Uint8Array> {
  setupBlobCapture();

  simulateRightClick(option);
  await sleep(TIMING.MENU_ANIMATION);

  let downloadItem: Element | undefined;
  try {
    downloadItem = await waitForElement('[role="menuitem"]', {
      match: (el) => (el.textContent ?? "").toLowerCase().includes("download"),
      timeout: TIMING.MOVE_MENU,
    });
  } catch {
    downloadItem = undefined;
  }

  if (downloadItem !== undefined) {
    simulateClick(downloadItem);
    const data = await pollForBlobData();
    if (data !== undefined) {
      return data;
    }
  } else {
    simulateKeyPress("Escape");
    await sleep(TIMING.MENU_ANIMATION);
  }

  simulateClick(option);
  await sleep(1500);

  let downloadBtn: Element | undefined;
  try {
    downloadBtn = await waitForElement(
      'button[aria-label*="Download"], button[name*="Download"], [role="button"][aria-label*="Download"]',
      { timeout: 5000 },
    );
  } catch {
    downloadBtn = undefined;
  }

  if (downloadBtn !== undefined) {
    simulateClick(downloadBtn);
    const data = await pollForBlobData();
    simulateKeyPress("Escape");
    if (data !== undefined) {
      return data;
    }
  }

  throw new Error("Could not download attachment");
}

export async function openReply(conversationId?: string): Promise<HTMLElement> {
  if (conversationId !== undefined && conversationId !== "") {
    const emailItem = document.querySelector(`[data-convid="${escapeCssValue(conversationId)}"]`);
    if (emailItem !== null) {
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

async function removeFirstAttachment(): Promise<boolean> {
  // Find compose area by locating the textbox and its container
  const composeBody = document.querySelector('div[role="textbox"][contenteditable="true"]');
  if (composeBody === null) {
    return false;
  }

  // Find the compose container (form or dialog ancestor)
  const composeContainer =
    composeBody.closest('[role="dialog"], [role="form"], form') ??
    composeBody.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
  if (composeContainer === null || composeContainer === undefined) {
    return false;
  }

  // Only look for attachment listbox within compose area
  const listbox = composeContainer.querySelector('[role="listbox"][aria-label*="attachment" i]');
  if (listbox === null) {
    return false;
  }

  const [attachment] = listbox.querySelectorAll('[role="option"]');
  if (attachment === undefined) {
    return false;
  }

  const moreActionsBtn = attachment.querySelector('button[aria-label*="action" i]');
  if (moreActionsBtn === null) {
    return false;
  }

  simulateClick(moreActionsBtn);
  await sleep(TIMING.MENU_ANIMATION);

  let removeItem: Element | undefined;
  try {
    removeItem = await waitForElement('[role="menuitem"]', {
      match: (el) => {
        const text = (el.textContent ?? "").toLowerCase();
        return text.includes("remove") || text.includes("delete") || text.includes("supprimer");
      },
      timeout: 2000,
    });
  } catch {
    removeItem = undefined;
  }

  if (removeItem !== undefined) {
    simulateClick(removeItem);
    await sleep(TIMING.UI_SETTLE);
  } else {
    simulateKeyPress("Escape");
    await sleep(TIMING.MENU_ANIMATION);
  }

  return true;
}

export async function removeAllAttachments(): Promise<void> {
  while (await removeFirstAttachment()) {
    // Continue removing until no more attachments
  }
}

export async function attachFile(pdfBytes: Uint8Array, filename: string): Promise<void> {
  // Create a copy of the buffer that's properly typed
  const arrayBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(arrayBuffer).set(pdfBytes);
  const file = new File([arrayBuffer], filename, { type: "application/pdf" });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  const attachBtn = await waitForElement('button[aria-label*="Attach"], button[name*="Attach"]', {
    timeout: 3000,
  });
  simulateClick(attachBtn);
  await sleep(TIMING.MENU_ANIMATION);

  let browseItem: Element | undefined;
  try {
    browseItem = await waitForElement('[role="menuitem"]', {
      match: (el) => {
        const text = (el.textContent ?? "").toLowerCase();
        return text.includes("browse") && text.includes("computer");
      },
      timeout: 2000,
    });
  } catch {
    browseItem = undefined;
  }

  if (browseItem !== undefined) {
    simulateClick(browseItem);
    await sleep(TIMING.UI_SETTLE);
  }

  await sleep(TIMING.UI_SETTLE);

  const fileInputs = document.querySelectorAll('input[type="file"]');
  let attachmentInput: HTMLInputElement | undefined;

  for (const input of fileInputs) {
    if (!(input instanceof HTMLInputElement)) {
      continue;
    }
    const accept = input.getAttribute("accept") ?? "";
    if (!accept.startsWith("image/")) {
      attachmentInput = input;
      break;
    }
  }

  if (attachmentInput === undefined && fileInputs.length > 0) {
    const lastInput = fileInputs.item(fileInputs.length - 1);
    if (lastInput instanceof HTMLInputElement) {
      attachmentInput = lastInput;
    }
  }

  if (attachmentInput === undefined) {
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
  const isMac = navigator.userAgent.includes("Mac");
  simulateKeyPress("s", isMac ? { meta: true } : { ctrl: true });
  await sleep(TIMING.CONTENT_LOAD);
}

export async function closeCompose(): Promise<void> {
  simulateKeyPress("Escape");
  await sleep(TIMING.UI_SETTLE);

  const dialog = document.querySelector('[role="dialog"]');
  if (dialog !== null) {
    const cancelBtn = [...dialog.querySelectorAll("button")].find((btn) =>
      (btn.textContent ?? "").toLowerCase().includes("cancel"),
    );
    if (cancelBtn !== undefined) {
      simulateClick(cancelBtn);
      await sleep(TIMING.UI_SETTLE);
    }
  }

  const homeTab = getByRole("tab", { name: "Home" });
  if (homeTab !== undefined) {
    simulateClick(homeTab);
    await sleep(TIMING.UI_SETTLE);
  }

  for (let idx = 0; idx < 20; idx += 1) {
    if (document.querySelector('[role="textbox"][contenteditable="true"]') === null) {
      break;
    }
    await sleep(200);
  }
}
