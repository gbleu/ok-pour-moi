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

const isMac = navigator.userAgent.includes("Mac");

export interface MessageInfo {
  element: Element;
  senderLastname: string;
  senderEmail: string;
}

export async function expandThread(): Promise<number> {
  const readingPane = document.querySelector('[role="main"]');
  if (!readingPane) {
    return 0;
  }

  let expandClicks = 0;
  for (let misses = 0; misses < 2; ) {
    await sleep(TIMING.CONTENT_LOAD);
    const seeMoreBtn = getButtonByName("See more messages", readingPane);

    if (!seeMoreBtn || getComputedStyle(seeMoreBtn).display === "none") {
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
  if (!readingPane) {
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

    if (isOwnMessage(myEmail, { elementEmail, fromText, textContent })) {
      continue;
    }

    const normalizedFrom = fromText.includes("From:") ? fromText : `From: ${fromText}`;
    const senderLastname = extractLastname(normalizedFrom);
    const senderEmail =
      elementEmail !== ""
        ? elementEmail
        : extractEmail(textContent) ||
          (el instanceof HTMLElement ? extractEmail(el.textContent ?? "") : "") ||
          extractEmail(fromText);

    if (senderEmail !== "") {
      return { element: el, senderEmail, senderLastname };
    }
  }

  return undefined;
}

function findAncestor(
  element: Element,
  predicate: (ancestor: Element) => boolean,
  maxDepth = 10,
): Element | undefined {
  let current = element.parentElement;
  for (let depth = 0; depth < maxDepth && current; depth += 1) {
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
      const ariaLabel = ancestor.getAttribute("aria-label");
      if (ariaLabel !== null && ariaLabel.startsWith("From:")) {
        return false;
      }
      const style = window.getComputedStyle(ancestor);
      return ancestor.hasAttribute("tabindex") || style.cursor === "pointer";
    }) ?? messageButton.closest('[data-is-focusable="true"], [role="listitem"], [role="article"]');

  if (clickTarget && clickTarget !== messageButton) {
    simulateClick(clickTarget);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await sleep(TIMING.CONTENT_LOAD);
    if (
      findAncestor(
        messageButton,
        (ancestor) =>
          ancestor.querySelector('[role="listbox"][aria-label*="attachment" i]') !== null,
      )
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
    const timerRef: { current: ReturnType<typeof setTimeout> | undefined } = { current: undefined };

    function handler(event: MessageEvent): void {
      if (event.source !== window || !predicate(event.data)) {
        return;
      }
      window.removeEventListener("message", handler);
      clearTimeout(timerRef.current);
      resolve(event.data);
    }

    timerRef.current = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Message timeout"));
    }, timeout);

    window.addEventListener("message", handler);
  });
}

async function getBlobFromMainWorld(blobUrl: string): Promise<Uint8Array> {
  const messageId = `opm-blob-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.postMessage({ id: messageId, type: "OPM_GET_BLOB", url: blobUrl }, window.location.origin);

  const result = await waitForWindowMessage<BlobResultMessage>(
    (data) => isBlobResult(data, messageId),
    30_000,
  );

  if (result.error !== undefined && result.error !== "") {
    throw new Error(result.error);
  }
  if (result.data === undefined) {
    throw new Error("No blob data received");
  }
  return new Uint8Array(result.data);
}

async function waitForAttachmentUrl(maxAttempts = 20): Promise<string> {
  for (let idx = 0; idx < maxAttempts; idx += 1) {
    const match = window.location.pathname.match(/\/sxs\/([^/]+)$/);
    const attachmentId = match?.[1];
    if (attachmentId !== undefined && attachmentId !== "") {
      return decodeURIComponent(attachmentId);
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
  const downloadBtn = await waitForElement('[role="menuitem"]', {
    match: (el) => {
      const text = (el.textContent ?? "").toLowerCase();
      return text.includes("download") || text.includes("télécharger");
    },
    timeout: 3000,
  });
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

  if (removeItem) {
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Uint8Array is a valid BlobPart
  const file = new File([pdfBytes as BlobPart], filename, { type: "application/pdf" });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  const attachBtn = await waitForElement('button[aria-label*="Attach"], button[name*="Attach"]', {
    timeout: 3000,
  });
  simulateClick(attachBtn);
  await sleep(TIMING.MENU_ANIMATION);

  const browseItem = await findMenuItem(
    (text) => text.includes("browse") && text.includes("computer"),
  );

  if (browseItem !== undefined) {
    simulateClick(browseItem);
    await sleep(TIMING.UI_SETTLE);
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
  simulateKeyPress("s", isMac ? { meta: true } : { ctrl: true });
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
