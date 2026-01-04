# Plan: Fix CC Button Issue Using Forward Instead of Reply

## Problem

`addCcRecipients()` fails because Cc/Bcc buttons are hidden in Outlook's inline reply mode. Synthetic events (`simulateClick`) can't expand the header due to `isTrusted: false`.

## Solution

Use **Forward** instead of Reply. Forward opens a compose with To and Cc fields immediately visible.

**Trade-off**: Forward requires manually adding the recipient (original sender) to the To field.

---

## Files to Modify

| File                             | Changes                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `src/content/outlook-actions.ts` | Add `extractEmail()`, `openForward()`, `addToRecipient()`, update `MessageInfo` |
| `src/content/outlook-dom.ts`     | Add `senderEmail` to `PdfItem`, pass it from `findLastMessageFromOthers()`      |
| `src/content/outlook-compose.ts` | Use `openForward()` instead of `openReply()`, call `addToRecipient()`           |

---

## Implementation Steps

### Step 1: Add `extractEmail()` helper

**File**: `src/shared/pdf.ts` (near `extractLastname`)

```typescript
export function extractEmail(fromText: string): string {
  const angleMatch = fromText.match(/<([^>]+@[^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1];
  const emailMatch = fromText.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return emailMatch?.[0] ?? "";
}
```

### Step 2: Update `MessageInfo` interface

**File**: `src/content/outlook-actions.ts:48-51`

```typescript
export interface MessageInfo {
  element: Element;
  senderLastname: string;
  senderEmail: string;  // ADD
}
```

### Step 3: Update `findLastMessageFromOthers()` return

**File**: `src/content/outlook-actions.ts:145`

```typescript
return { element: el, senderLastname, senderEmail: extractEmail(fromText) };
```

### Step 4: Update `PdfItem` interface

**File**: `src/content/outlook-dom.ts:13-19`

```typescript
export interface PdfItem {
  conversationId: string;
  filename: string;
  senderLastname: string;
  senderEmail: string;  // ADD
  signedPdf: Uint8Array;
  subject: string;
}
```

### Step 5: Pass `senderEmail` when creating `PdfItem`

**File**: `src/content/outlook-dom.ts:105-111`

```typescript
items.push({
  conversationId,
  filename: response.filename,
  senderLastname: message.senderLastname,
  senderEmail: message.senderEmail,  // ADD
  signedPdf: new Uint8Array(response.signedPdf),
  subject,
});
```

### Step 6: Add `openForward()` function

**File**: `src/content/outlook-actions.ts` (after `openReply`)

```typescript
export async function openForward(conversationId?: string): Promise<HTMLElement> {
  if (conversationId !== undefined && conversationId !== "") {
    const emailItem = document.querySelector(`[data-convid="${escapeCssValue(conversationId)}"]`);
    if (emailItem !== null) {
      simulateClick(emailItem);
      await sleep(TIMING.UI_SETTLE);
    }
  }

  const forwardBtn = await waitForElement('button[name="Forward"], button[aria-label*="Forward"]');
  simulateClick(forwardBtn);

  const composeBody = await waitForElement('div[role="textbox"][contenteditable="true"]');
  if (!(composeBody instanceof HTMLElement)) {
    throw new Error("Compose body is not an HTMLElement");
  }
  return composeBody;
}
```

### Step 7: Add `addToRecipient()` function

**File**: `src/content/outlook-actions.ts`

```typescript
export async function addToRecipient(email: string, composeBody?: HTMLElement): Promise<void> {
  if (email === "") return;
  await sleep(TIMING.UI_SETTLE);

  // Find To input - in Forward mode it's visible
  const toInput = await waitForElement(
    '[role="combobox"][aria-label="To"], input[aria-label="To"]',
    { timeout: TIMING.CC_FIELD }
  );

  if (!(toInput instanceof HTMLElement)) {
    throw new Error("Could not find To input field");
  }

  simulateClick(toInput);
  await sleep(TIMING.UI_SETTLE);

  if (toInput.isContentEditable || toInput.getAttribute("contenteditable") === "true") {
    toInput.focus();
    document.execCommand("insertText", false, email);
  } else {
    toInput.focus();
    (toInput as HTMLInputElement).value = email;
    toInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  await sleep(TIMING.UI_SETTLE);
  simulateKeyPress("Tab");
  await sleep(TIMING.UI_SETTLE);
}
```

### Step 8: Update `prepareDrafts()` to use Forward

**File**: `src/content/outlook-compose.ts`

1. Update imports:

```typescript
import {
  addCcRecipients,
  addToRecipient,    // ADD
  attachFile,
  closeCompose,
  moveToFolder,
  openForward,       // CHANGE from openReply
  saveDraft,
  typeMessage,
} from "./outlook-actions.js";
```

2. Update draft preparation (lines 30-43):

```typescript
console.log(`[OPM]   Opening forward...`);
const composeBody = await openForward(item.conversationId);  // CHANGE

console.log(`[OPM]   Adding To recipient: ${item.senderEmail}`);
await addToRecipient(item.senderEmail, composeBody);  // ADD

console.log(`[OPM]   Typing message...`);
// ... rest unchanged
```

---

## Notes

- Forward prepends "FW: " to subject - expected behavior
- Forward includes original message body - `typeMessage()` prepends so this is fine
- If sender email extraction fails, `addToRecipient()` returns early (empty string check)
- The `addCcRecipients()` function should work better in Forward mode since Cc button is visible
