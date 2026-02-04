/* eslint-disable max-lines, promise/avoid-new, no-bitwise, no-negated-condition, unicorn/no-useless-undefined, unicorn/prefer-global-this, unicorn/no-null, unicorn/prefer-dom-node-text-content */
import {
  TIMING,
  getButtonByName,
  getByRole,
  simulateClick,
  simulateKeyPress,
  sleep,
  typeText,
  waitForElement,
} from "./dom-utils.js";
import { extractEmail, extractLastname } from "#shared/pdf.js";
import { escapeCssValue } from "#shared/css.js";

export interface MessageInfo {
  element: Element;
  senderLastname: string;
  senderEmail: string;
}

function textMatchesAny(text: string, patterns: (string | string[])[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((pattern) =>
    Array.isArray(pattern)
      ? pattern.every((word) => lower.includes(word))
      : lower.includes(pattern),
  );
}

async function findMenuItem(
  patterns: (string | string[])[],
  timeout = 2000,
): Promise<Element | undefined> {
  try {
    return await waitForElement('[role="menuitem"]', {
      match: (el) => textMatchesAny(el.textContent ?? "", patterns),
      timeout,
    });
  } catch {
    return undefined;
  }
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

function isOwnMessage(
  myEmail: string,
  {
    elementEmail,
    fromText,
    textContent,
  }: { elementEmail: string; fromText: string; textContent: string },
): boolean {
  const myEmailLower = myEmail.toLowerCase();
  const textLower = textContent.toLowerCase();
  return (
    elementEmail.toLowerCase() === myEmailLower ||
    fromText.toLowerCase().includes(myEmailLower) ||
    textLower === "you" ||
    textLower === "moi"
  );
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

    // Also check title attribute (used by cloud.microsoft domain)
    const titleElement = el.querySelector("[title*='@']");
    const titleEmail = titleElement?.getAttribute("title") ?? "";

    if (isOwnMessage(myEmail, { elementEmail, fromText, textContent })) {
      continue;
    }

    const senderLastname = extractLastname(
      fromText.includes("From:") ? fromText : `From: ${fromText}`,
    );
    const senderEmail =
      elementEmail ||
      titleEmail ||
      extractEmail(textContent) ||
      (el instanceof HTMLElement ? extractEmail(el.textContent ?? "") : "") ||
      extractEmail(fromText);

    // Return even without email - Reply will work via Outlook's native handling
    return { element: el, senderEmail, senderLastname };
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

interface BlobCapturedMessage {
  type: "OPM_BLOB_CAPTURED";
  url: string;
}

interface BlobResultMessage {
  data?: number[];
  error?: string;
  id: string;
  type: "OPM_BLOB_RESULT";
}

function isBlobCaptured(data: unknown): data is BlobCapturedMessage {
  return (
    typeof data === "object" && data !== null && "type" in data && data.type === "OPM_BLOB_CAPTURED"
  );
}

function isBlobResult(data: unknown, id: string): data is BlobResultMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "OPM_BLOB_RESULT" &&
    "id" in data &&
    data.id === id
  );
}

async function waitForWindowMessage<TMessage>(
  predicate: (data: unknown) => data is TMessage,
  timeout: number,
): Promise<TMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Message timeout"));
    }, timeout);

    function handler(event: MessageEvent): void {
      if (!predicate(event.data)) {
        return;
      }
      window.removeEventListener("message", handler);
      clearTimeout(timer);
      resolve(event.data);
    }

    window.addEventListener("message", handler);
  });
}

async function getBlobFromMainWorld(blobUrl: string): Promise<Uint8Array> {
  const messageId = `opm-blob-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.postMessage({ id: messageId, type: "OPM_GET_BLOB", url: blobUrl }, "*");

  const result = await waitForWindowMessage<BlobResultMessage>(
    (data): data is BlobResultMessage => isBlobResult(data, messageId),
    30_000,
  );

  if (result.error !== undefined) {
    throw new Error(result.error);
  }
  if (!result.data) {
    throw new Error("No blob data received");
  }
  return new Uint8Array(result.data);
}

async function waitForAttachmentUrl(maxAttempts = 20): Promise<string> {
  for (let idx = 0; idx < maxAttempts; idx += 1) {
    const match = window.location.pathname.match(/\/sxs\/([^/]+)$/);
    if (match?.[1] !== undefined) {
      return decodeURIComponent(match[1]);
    }
    await sleep(100);
  }
  throw new Error("Attachment ID not found in URL");
}

export async function downloadAttachment(option: Element): Promise<Uint8Array> {
  simulateClick(option);
  await waitForAttachmentUrl();

  const blobPromise = waitForWindowMessage<BlobCapturedMessage>(isBlobCaptured, 10_000);

  await sleep(TIMING.UI_SETTLE);
  const downloadBtn = await findMenuItem(["download", "télécharger"], 3000);
  if (downloadBtn === undefined) {
    throw new Error("Download menu item not found");
  }
  simulateClick(downloadBtn);

  const { url } = await blobPromise;
  const pdfBytes = await getBlobFromMainWorld(url);

  simulateKeyPress("Escape");
  await sleep(TIMING.MENU_ANIMATION);

  return pdfBytes;
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

  const removeItem = await findMenuItem(["remove", "delete", "supprimer"]);
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

  const browseItem = await findMenuItem([
    ["browse", "computer"],
    ["parcourir", "ordinateur"],
  ]);
  if (browseItem !== undefined) {
    simulateClick(browseItem);
    await sleep(TIMING.UI_SETTLE);
  }

  await sleep(TIMING.UI_SETTLE);

  const fileInputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')];
  const attachmentInput =
    fileInputs.find((input) => input.getAttribute("accept")?.startsWith("image/") !== true) ??
    fileInputs.at(-1);

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
