import { extractEmail, extractLastname } from "#shared/sender.js";

/* eslint-disable no-negated-condition, unicorn/no-useless-undefined, unicorn/prefer-global-this, unicorn/no-null, unicorn/prefer-dom-node-text-content */
import { TIMING, getButtonByName, simulateClick, sleep } from "./outlook-automation.js";

export interface MessageInfo {
  readonly element: Element;
  readonly senderLastname: string;
  readonly senderEmail: string;
}

export async function expandThread(): Promise<void> {
  const readingPane = document.querySelector('[role="main"]');
  if (!readingPane) {
    return;
  }

  for (let misses = 0; misses < 2; ) {
    await sleep(TIMING.CONTENT_LOAD);
    const seeMoreBtn = getButtonByName("See more messages", { parent: readingPane });

    if (!seeMoreBtn || getComputedStyle(seeMoreBtn).display === "none") {
      misses += 1;
      continue;
    }

    misses = 0;
    simulateClick(seeMoreBtn);
  }
}

function isOwnMessage(
  myEmail: string,
  {
    elementEmail,
    fromText,
    textContent,
  }: Readonly<{ elementEmail: string; fromText: string; textContent: string }>,
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

function extractSenderEmail(el: Element, textContent: string, fromText: string): string {
  const titleEmail = el.querySelector("[title*='@']")?.getAttribute("title") ?? "";
  if (titleEmail !== "") {
    return titleEmail;
  }

  return (
    extractEmail(textContent) ||
    (el instanceof HTMLElement ? extractEmail(el.textContent ?? "") : "") ||
    extractEmail(fromText)
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
    const textContent = (el.textContent ?? "").trim();

    const fromText = [ariaLabel, nameAttr].find((text) => text.startsWith("From:")) ?? textContent;

    const emailElement = el.querySelector("[data-email]");
    const elementEmail =
      emailElement instanceof HTMLElement ? (emailElement.dataset.email ?? "") : "";

    if (isOwnMessage(myEmail, { elementEmail, fromText, textContent })) {
      continue;
    }

    const senderEmail = elementEmail || extractSenderEmail(el, textContent, fromText);
    if (senderEmail !== "") {
      const normalizedFrom = fromText.includes("From:") ? fromText : `From: ${fromText}`;
      return { element: el, senderEmail, senderLastname: extractLastname(normalizedFrom) };
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
      // Walk past From: header elements — they're nested inside the clickable message container
      const ariaLabel = ancestor.getAttribute("aria-label");
      if (ariaLabel?.startsWith("From:") === true) {
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
  throw new Error("Message did not expand after 5 attempts");
}

export function findAttachmentListbox(messageButton: Element): Element | undefined {
  const container = findAncestor(
    messageButton,
    (ancestor) => ancestor.querySelector('[role="listbox"][aria-label*="attachment" i]') !== null,
  );
  if (!container) {
    return undefined;
  }

  const listboxes = container.querySelectorAll('[role="listbox"][aria-label*="attachment" i]');
  for (const listbox of listboxes) {
    if (
      // eslint-disable-next-line no-bitwise -- compareDocumentPosition returns bitmask
      (messageButton.compareDocumentPosition(listbox) & Node.DOCUMENT_POSITION_FOLLOWING) !==
      0
    ) {
      return listbox;
    }
  }
  return undefined;
}

export function getPdfOptions(attachmentListbox: Element): Element[] {
  const options = attachmentListbox.querySelectorAll('[role="option"]');
  return [...options].filter((opt) => (opt.textContent ?? "").toLowerCase().includes(".pdf"));
}
