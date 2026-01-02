import type { Locator } from "playwright";
import { extractLastname } from "./pdf.js";

export type MessageResult = {
  row: Locator;
  button: Locator;
  senderLastname: string;
};

// XPath Selectors Documentation:
// These selectors are tightly coupled to Outlook Web's DOM structure.
// If Outlook updates break automation, check these selectors first.
//
// MESSAGE_ROW_XPATH: Finds the clickable message container from the "From:" button.
// - Outlook renders each message with a "From:" button inside a clickable row
// - The row has cursor:pointer style or tabindex for keyboard navigation
// - We click the row (not the button) to avoid opening the contact card popup
export const MESSAGE_ROW_XPATH =
  "xpath=ancestor::*[contains(@style, 'cursor') or @tabindex][1]";

// ATTACHMENTS_FOLLOWING_XPATH: Finds the attachments listbox after a message's From button.
// - In Outlook, each message's attachments appear in a listbox element
// - The listbox follows the message content in DOM order
// - aria-label contains "attachments" for accessibility
export const ATTACHMENTS_FOLLOWING_XPATH =
  'xpath=following::*[@role="listbox"][contains(@aria-label, "attachments")][1]';

// DRAFT_MARKER_XPATH: Detects if a listbox belongs to a draft message.
// - Draft messages show "[Draft]" text in their header area
// - We look up to 8 ancestors to find the message container with draft marker
// - This helps skip our own draft attachments when looking for received files
export const DRAFT_MARKER_XPATH =
  "xpath=ancestor::*[position() <= 8]//*[contains(text(), '[Draft]')]";

/**
 * Find the last message in the reading pane that is NOT from the current user.
 * Iterates in reverse order through "From:" buttons to find the most recent external message.
 */
export async function findLastMessageFromOthers(
  readingPane: Locator,
  myEmail: string,
): Promise<MessageResult | null> {
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

/**
 * Find the attachments listbox for a given message.
 * First tries to find attachments following the message button,
 * then falls back to finding the last non-draft attachments listbox.
 */
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
