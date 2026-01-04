/* eslint-disable max-lines, max-statements, max-depth, no-negated-condition, unicorn/no-nested-ternary, unicorn/no-useless-undefined, promise/avoid-new, unicorn/prefer-global-this */
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
import { escapeCssValue } from "../shared/css.js";
import { extractLastname } from "../shared/pdf.js";

export async function navigateToFolder(folderName: string): Promise<void> {
  const treeitems = document.querySelectorAll('[role="treeitem"]');

  let targetFolder: Element | undefined;
  for (const item of treeitems) {
    const text = item.textContent ?? "";
    if (text.toLowerCase().includes(folderName.toLowerCase())) {
      targetFolder = item;
      break;
    }
  }

  if (targetFolder === undefined) {
    throw new Error(`Folder "${folderName}" not found in sidebar`);
  }

  simulateClick(targetFolder);
  await sleep(TIMING.CONTENT_LOAD);

  // Wait for emails to load (or folder may be empty)
  try {
    await waitForElement("[data-convid]", { timeout: 3000 });
  } catch {
    // Folder may be empty - that's ok
  }
}

export interface EmailSelection {
  conversationId: string;
  subject: string;
}

export interface MessageInfo {
  element: Element;
  senderLastname: string;
}

export async function selectEmail(index: number): Promise<EmailSelection> {
  const emailItems = document.querySelectorAll("[data-convid]");
  const emailItem = emailItems[index];
  if (emailItem === undefined) {
    throw new Error(`No email at index ${index}`);
  }

  simulateClick(emailItem);

  // eslint-disable-next-line unicorn/prefer-dom-node-dataset -- getAttribute is type-safe
  const conversationId = emailItem.getAttribute("data-convid") ?? "";

  const subjectEl = await waitForElement('[role="main"] [role="heading"][aria-level="2"]');
  const rawSubject = subjectEl.textContent ?? "Unknown";
  const subject = rawSubject
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

  // Real Outlook: SPAN with role="button" and aria-label="From: Name"
  // Test fixture: button with name="From: Name"
  const senderElements = [
    ...readingPane.querySelectorAll('[role="button"][aria-label^="From:"], button[name^="From:"]'),
  ];

  console.log(`[OPM] Found ${senderElements.length} sender elements`);

  // Process from last to first (most recent message first)
  for (let idx = senderElements.length - 1; idx >= 0; idx -= 1) {
    const el = senderElements[idx];
    if (el === undefined) {
      continue;
    }
    const ariaLabel = el.getAttribute("aria-label") ?? "";
    const nameAttr = el.getAttribute("name") ?? "";
    const textContent = el.textContent?.trim() ?? "";

    // Get the sender text from whichever source has it
    // eslint-disable-next-line unicorn/no-nested-ternary -- Simple fallback logic
    const fromText = ariaLabel.startsWith("From:")
      ? ariaLabel
      : nameAttr.startsWith("From:")
        ? nameAttr
        : textContent;

    console.log(`[OPM] Checking sender: "${fromText}"`);

    // Skip if this is the user's own message
    const isOwnMessage =
      fromText.toLowerCase().includes(myEmail.toLowerCase()) ||
      textContent.toLowerCase() === "you" ||
      textContent.toLowerCase() === "moi";

    if (!isOwnMessage) {
      const senderLastname = extractLastname(
        fromText.includes("From:") ? fromText : `From: ${fromText}`,
      );
      console.log(`[OPM] Found message from others: "${fromText}" -> lastname: ${senderLastname}`);
      return { element: el, senderLastname };
    }
  }

  console.log("[OPM] No messages from others found");
  return undefined;
}

export async function expandMessage(messageButton: Element): Promise<void> {
  const row = messageButton.closest('[style*="cursor"], [tabindex]') ?? messageButton;
  simulateClick(row);
  await sleep(TIMING.CONTENT_LOAD);
}

export function findAttachmentListbox(messageButton: Element): Element | undefined {
  const readingPane = document.querySelector('[role="main"]');
  if (readingPane === null) {
    return undefined;
  }

  let sibling: Element | null = messageButton.parentElement;
  while (sibling !== null) {
    const listbox = sibling.querySelector('[role="listbox"][aria-label*="attachment" i]');
    if (listbox !== null) {
      return listbox;
    }
    sibling = sibling.nextElementSibling;
  }

  const allLists = [...readingPane.querySelectorAll('[role="listbox"]')];
  for (let idx = allLists.length - 1; idx >= 0; idx -= 1) {
    const lb = allLists[idx];
    if (lb === undefined) {
      continue;
    }
    const label = lb.getAttribute("aria-label") ?? "";
    if (label.toLowerCase().includes("attachment")) {
      const hasDraft = lb.closest('[class*="draft"]') !== null;
      if (!hasDraft) {
        return lb;
      }
    }
  }

  return undefined;
}

export function getPdfOptions(attachmentListbox: Element): Element[] {
  const options = attachmentListbox.querySelectorAll('[role="option"]');
  return [...options].filter((opt) => {
    const text = opt.textContent ?? "";
    return text.toLowerCase().includes(".pdf");
  });
}

// Communication with main-world.js which intercepts blob URLs
let blobListenerReady = false;

function setupBlobCapture(): void {
  // Listen for captured blobs from the main world script
  if (!blobListenerReady) {
    window.addEventListener("message", (event: MessageEvent<{ size: number; type: string }>) => {
      if (event.data?.type === "OPM_BLOB_CAPTURED") {
        console.log("[OPM] Received blob notification from main world:", event.data.size, "bytes");
      }
    });
    blobListenerReady = true;
  }
  console.log("[OPM] Blob capture listener ready");
}

async function getBlobData(): Promise<Uint8Array | undefined> {
  // Request the captured data from the main world script
  return new Promise((resolve) => {
    function handler(event: MessageEvent<{ data: number[] | undefined; type: string }>): void {
      if (event.data?.type === "OPM_BLOB_DATA") {
        window.removeEventListener("message", handler);
        if (event.data.data !== undefined) {
          console.log("[OPM] Received blob data:", event.data.data.length, "bytes");
          resolve(new Uint8Array(event.data.data));
        } else {
          console.log("[OPM] No blob data available");
          resolve(undefined);
        }
      }
    }
    window.addEventListener("message", handler);

    // Request the data from the main world
    window.postMessage({ type: "OPM_GET_BLOB_DATA" }, "*");

    // Timeout after 1 second
    setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(undefined);
    }, 1000);
  });
}

export async function downloadAttachment(option: Element): Promise<Uint8Array> {
  // Setup blob capture before triggering download
  console.log("[OPM] Setting up blob capture...");
  setupBlobCapture();

  // Try right-click menu download first (most reliable)
  console.log("[OPM] Trying right-click context menu...");
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
    console.log("[OPM] Found download menu item, clicking...");
    simulateClick(downloadItem);

    // Wait for blob to be captured
    for (let idx = 0; idx < 30; idx += 1) {
      await sleep(100);
      const data = await getBlobData();
      if (data !== undefined && data.length > 0) {
        console.log("[OPM] Got captured blob:", data.length, "bytes");
        return data;
      }
    }
    console.log("[OPM] Blob capture timed out");
  } else {
    // Close any menu that might have opened
    simulateKeyPress("Escape");
    await sleep(TIMING.MENU_ANIMATION);
  }

  // Fallback: Click on attachment to open preview
  console.log("[OPM] Trying preview approach...");
  simulateClick(option);
  await sleep(1500);

  // Look for download button in preview panel
  let downloadBtn: Element | undefined;
  try {
    downloadBtn = await waitForElement(
      'button[aria-label*="Download"], button[name*="Download"], [role="button"][aria-label*="Download"], [role="menuitem"][aria-label*="Download"]',
      { timeout: 5000 },
    );
  } catch {
    downloadBtn = undefined;
  }

  if (downloadBtn !== undefined) {
    console.log("[OPM] Found download button in preview, clicking...");
    simulateClick(downloadBtn);

    // Wait for blob to be captured
    for (let idx = 0; idx < 30; idx += 1) {
      await sleep(100);
      const data = await getBlobData();
      if (data !== undefined && data.length > 0) {
        console.log("[OPM] Got captured blob from preview:", data.length, "bytes");
        simulateKeyPress("Escape"); // Close preview
        return data;
      }
    }

    simulateKeyPress("Escape"); // Close preview
  }

  // Check for iframe with PDF URL
  const iframe = document.querySelector('iframe[src*="attachment"], iframe[src*=".pdf"]');
  if (iframe instanceof HTMLIFrameElement && iframe.src !== "") {
    console.log("[OPM] Found iframe with attachment URL");
    try {
      const response = await chrome.runtime.sendMessage<
        { payload: { url: string }; type: "FETCH_ATTACHMENT" },
        { data?: number[]; error?: string; success: boolean }
      >({
        payload: { url: iframe.src },
        type: "FETCH_ATTACHMENT",
      });
      if (response?.success && response.data !== undefined) {
        return new Uint8Array(response.data);
      }
    } catch {
      /* Ignore */
    }
  }

  throw new Error("Could not download attachment - no URL found");
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

export async function addCcRecipients(emails: string[], composeBody?: HTMLElement): Promise<void> {
  if (emails.length === 0) {
    return;
  }

  // Wait for compose form to fully render
  await sleep(TIMING.UI_SETTLE);

  // Find compose container by walking up from composeBody or finding Send button
  let composeContainer: Element | undefined;

  if (composeBody !== undefined) {
    let parent: Element | null = composeBody.parentElement;
    for (let idx = 0; idx < 15 && parent !== null; idx += 1) {
      if (
        parent.querySelector('[role="textbox"]') !== null &&
        parent.querySelector("button") !== null
      ) {
        composeContainer = parent;
        break;
      }
      parent = parent.parentElement;
    }
  }

  if (composeContainer === undefined) {
    const sendBtns = document.querySelectorAll("button");
    for (const btn of sendBtns) {
      const text = btn.textContent?.toLowerCase().trim() ?? "";
      if (text === "send") {
        let parent = btn.parentElement;
        for (let idx = 0; idx < 10 && parent !== null; idx += 1) {
          if (parent.querySelector('[role="textbox"]') !== null) {
            composeContainer = parent;
            break;
          }
          parent = parent.parentElement;
        }
        if (composeContainer !== undefined) {
          break;
        }
      }
    }
  }

  const containerToUse: Element = composeContainer ?? document.body;
  console.log("[OPM] Found compose container");

  // In inline reply mode, Cc/Bcc buttons are hidden until header is expanded
  // First check if Cc button is already visible
  let ccButton: Element | undefined;
  const allButtons = containerToUse.querySelectorAll("button");
  for (const btn of allButtons) {
    if (btn.textContent?.trim() === "Cc") {
      ccButton = btn;
      break;
    }
  }

  // If no Cc button found, expand header to reveal Cc/Bcc options
  if (ccButton === undefined) {
    console.log("[OPM] Cc button not visible, expanding header...");

    // Look for "Expand header" button by aria-label
    let expandButton: Element | undefined;
    for (const btn of allButtons) {
      const ariaLabel = btn.getAttribute("aria-label")?.toLowerCase() ?? "";
      if (ariaLabel.includes("expand header")) {
        expandButton = btn;
        console.log("[OPM] Found Expand header button:", btn.getAttribute("aria-label"));
        break;
      }
    }

    if (expandButton !== undefined) {
      console.log("[OPM] Clicking Expand header button...");
      // Try native click first (more reliable with React)
      if (expandButton instanceof HTMLElement) {
        expandButton.click();
      }
      await sleep(TIMING.UI_SETTLE);

      // Check if Cc appeared
      for (const btn of containerToUse.querySelectorAll("button")) {
        if (btn.textContent?.trim() === "Cc") {
          ccButton = btn;
          console.log("[OPM] Cc button appeared after expand");
          break;
        }
      }

      // If still not visible, try simulateClick as fallback
      if (ccButton === undefined) {
        console.log("[OPM] Trying simulateClick on expand button...");
        simulateClick(expandButton);
        await sleep(TIMING.UI_SETTLE);
      }
    } else {
      // Fallback: try clicking on "To:" label or the To recipient row
      console.log("[OPM] No Expand header button, trying To: area click...");
      const toLabel = containerToUse.querySelector('[class*="To:"], [aria-label*="To:"]');
      if (toLabel !== null) {
        simulateClick(toLabel);
        await sleep(TIMING.UI_SETTLE);
      }
    }

    // Now try to find Cc button again after expanding
    ccButton = await waitForElement("button", {
      match: (el) => el.textContent?.trim() === "Cc",
      parent: containerToUse,
      timeout: TIMING.CC_FIELD,
    });
  }

  console.log("[OPM] Found Cc button, clicking");
  simulateClick(ccButton);
  await sleep(TIMING.UI_SETTLE);

  // After clicking Cc, find the Cc input field
  // Look for a contenteditable near a "Cc" label
  let ccInput: Element | undefined;
  try {
    ccInput = await waitForElement('[contenteditable="true"], [role="textbox"]', {
      match: (el) => {
        // Find input that's near a Cc label (sibling or parent contains "Cc")
        const parent = el.parentElement;
        if (parent === null) {
          return false;
        }
        const parentText = parent.textContent ?? "";
        // Accept if this is in a Cc row (contains "Cc" but not just the button)
        const hasMultipleRecipientFields =
          containerToUse.querySelectorAll('[contenteditable="true"]').length > 1;
        if (hasMultipleRecipientFields) {
          // Look for the Cc-specific input
          const row = el.closest('[class*="row"], [class*="recipient"]');
          if (row !== null) {
            return row.textContent?.includes("Cc") ?? false;
          }
        }
        return parentText.includes("Cc") || el === document.activeElement;
      },
      parent: containerToUse,
      timeout: TIMING.CC_FIELD,
    });
  } catch {
    ccInput = undefined;
  }

  // Fallback: just find any focused/active contenteditable
  const inputWell =
    ccInput ?? (document.activeElement instanceof HTMLElement ? document.activeElement : undefined);

  if (inputWell === undefined || !(inputWell instanceof HTMLElement)) {
    throw new Error("Could not find Cc input field");
  }

  console.log("[OPM] Found Cc input area");

  // Add each email
  for (const email of emails) {
    console.log(`[OPM] Adding CC recipient: ${email}`);

    simulateClick(inputWell);
    await sleep(TIMING.UI_SETTLE);

    if (inputWell.isContentEditable) {
      inputWell.focus();
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Required for contenteditable
      document.execCommand("insertText", false, email);
    } else {
      for (const char of email) {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: char }),
        );
        document.activeElement?.dispatchEvent(
          new InputEvent("input", { bubbles: true, data: char, inputType: "insertText" }),
        );
      }
    }
    await sleep(TIMING.UI_SETTLE);

    // Press Tab to confirm the recipient
    simulateKeyPress("Tab");
    await sleep(TIMING.UI_SETTLE);
  }
}

export async function attachFile(pdfBytes: Uint8Array, filename: string): Promise<void> {
  const attachBtn = await waitForElement(
    'button[name="Attach file"], button[aria-label*="Attach"]',
  );
  simulateClick(attachBtn);
  await sleep(TIMING.MENU_ANIMATION);

  const browseItem = await waitForElement('[role="menuitem"]', {
    match: (el) => (el.textContent ?? "").toLowerCase().includes("browse this computer"),
  });

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.style.display = "none";
  document.body.append(fileInput);

  // Create file from Uint8Array (cast needed for TypeScript 5.7 compatibility)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TypeScript 5.7 compatibility
  const file = new File([pdfBytes as unknown as BlobPart], filename, { type: "application/pdf" });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;

  const realInput = document.querySelector('input[type="file"]');
  if (realInput instanceof HTMLInputElement) {
    realInput.files = dataTransfer.files;
    realInput.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    simulateClick(browseItem);
    await sleep(TIMING.UI_SETTLE);

    const chooser = await waitForElement('input[type="file"]');
    if (!(chooser instanceof HTMLInputElement)) {
      throw new Error("File chooser is not an HTMLInputElement");
    }
    chooser.files = dataTransfer.files;
    chooser.dispatchEvent(new Event("change", { bubbles: true }));
  }

  fileInput.remove();
  await sleep(TIMING.UPLOAD_COMPLETE);
}

export function typeMessage(composeBody: HTMLElement, message: string): void {
  composeBody.focus();
  typeText(composeBody, message);
}

export async function saveDraft(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Required for platform detection
  const isMac = navigator.platform.includes("Mac");
  simulateKeyPress("s", isMac ? { meta: true } : { ctrl: true });
  await sleep(TIMING.CONTENT_LOAD);
}

export async function closeCompose(): Promise<void> {
  simulateKeyPress("Escape");
  await sleep(TIMING.UI_SETTLE);

  const dialog = document.querySelector('[role="dialog"]');
  if (dialog !== null) {
    const buttons = dialog.querySelectorAll("button");
    for (const btn of buttons) {
      if ((btn.textContent ?? "").toLowerCase().includes("cancel")) {
        simulateClick(btn);
        await sleep(TIMING.UI_SETTLE);
        break;
      }
    }
  }

  const homeTab = getByRole("tab", { name: "Home" });
  if (homeTab !== undefined) {
    simulateClick(homeTab);
    await sleep(TIMING.UI_SETTLE);
  }
}

export async function moveToFolder(conversationId: string, folderName: string): Promise<void> {
  const emailItem = document.querySelector(`[data-convid="${escapeCssValue(conversationId)}"]`);
  if (emailItem !== null) {
    simulateClick(emailItem);
    await sleep(TIMING.UI_SETTLE);
  }

  const moveBtn = await waitForElement('button[name="Move to"], button[aria-label*="Move"]');
  simulateClick(moveBtn);

  const folderItem = await waitForElement('[role="menuitem"]', {
    match: (el) => (el.textContent ?? "").toLowerCase().includes(folderName.toLowerCase()),
    timeout: TIMING.MOVE_MENU,
  });
  simulateClick(folderItem);
  await sleep(TIMING.UI_SETTLE);
}
