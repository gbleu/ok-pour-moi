// Convention: find* returns undefined or [] when not found. get* throws on miss.
// Action functions (expandMessage) throw on failure after retries.
// ExpandThread is a no-op when the reading pane is missing (nothing to expand).
import { extractEmail, extractLastname } from "#shared/sender.js";

/* eslint-disable no-negated-condition, unicorn/no-useless-undefined, unicorn/prefer-global-this, unicorn/no-null, unicorn/prefer-dom-node-text-content */
import {
  TIMING,
  findAncestor,
  findButtonByName,
  simulateClick,
  sleep,
} from "./outlook-automation.js";

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

  // Poll for "See more messages" button. Stop after 2 consecutive misses
  // (the button may appear after a short delay following each click).
  let consecutiveMisses = 0;
  while (consecutiveMisses < 2) {
    await sleep(TIMING.CONTENT_LOAD);
    const seeMoreBtn = findButtonByName("See more messages", { parent: readingPane });

    if (!seeMoreBtn || getComputedStyle(seeMoreBtn).display === "none") {
      consecutiveMisses += 1;
      continue;
    }

    consecutiveMisses = 0;
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

function parseSenderElement(el: Element, myEmail: string): MessageInfo | undefined {
  const ariaLabel = el.getAttribute("aria-label") ?? "";
  const nameAttr = el.getAttribute("name") ?? "";
  const textContent = (el.textContent ?? "").trim();

  const fromText = [ariaLabel, nameAttr].find((text) => text.startsWith("From:")) ?? textContent;

  const emailElement = el.querySelector("[data-email]");
  const elementEmail =
    emailElement instanceof HTMLElement ? (emailElement.dataset.email ?? "") : "";

  if (isOwnMessage(myEmail, { elementEmail, fromText, textContent })) {
    return undefined;
  }

  const senderEmail = elementEmail || extractSenderEmail(el, textContent, fromText);

  const normalizedFrom = fromText.includes("From:") ? fromText : `From: ${fromText}`;
  return { element: el, senderEmail, senderLastname: extractLastname(normalizedFrom) };
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
    const result = parseSenderElement(el, myEmail);
    if (result !== undefined) {
      return result;
    }
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

export function findPdfOptions(attachmentListbox: Element): Element[] {
  const options = attachmentListbox.querySelectorAll('[role="option"]');
  return [...options].filter((opt) => (opt.textContent ?? "").toLowerCase().includes(".pdf"));
}
