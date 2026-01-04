# CC Button Issue - Investigation Summary

## Problem

The `addCcRecipients` function in `src/content/outlook-actions.ts` fails to add CC recipients because the Cc/Bcc buttons are hidden in Outlook Web's inline reply mode and need the header to be expanded first.

## Error

```
[OPM]   -> Failed: Error: Timeout waiting for button
```

## What Works

- Navigating to folder
- Opening email
- Finding and downloading PDF attachments
- Opening reply compose
- Typing message
- Attaching signed PDF

## What Fails

- Expanding the compose header to reveal Cc/Bcc buttons
- Adding CC recipients

## Approaches Tried

### 1. Click "Expand header" button by aria-label

Found button with `aria-label="Expand header and show message history"` but:

- Native `.click()` doesn't trigger the expand
- `simulateClick()` with pointer/mouse events doesn't work either

### 2. Shift+Tab keyboard shortcut

User suggested this works manually, but:

- `simulateKeyPress("Tab", { shift: true })` doesn't trigger the expand
- KeyboardEvent dispatch doesn't work with Outlook's React UI

### 3. Click on "To:" label

Tried clicking on the To: area to expand, but selector matching was too strict.

## Current State of Code

File: `src/content/outlook-actions.ts` lines 390-425

```typescript
// If no Cc button found, expand header to reveal Cc/Bcc options
if (!ccButton) {
  console.log("[OPM] Cc button not visible, expanding header...");

  // Look for "Expand header" button by aria-label
  let expandButton: Element | null = null;
  for (const btn of allButtons) {
    const ariaLabel = btn.getAttribute("aria-label")?.toLowerCase() ?? "";
    if (ariaLabel.includes("expand header")) {
      expandButton = btn;
      console.log("[OPM] Found Expand header button:", btn.getAttribute("aria-label"));
      break;
    }
  }

  if (expandButton) {
    console.log("[OPM] Clicking Expand header button...");
    // Try native click first (more reliable with React)
    (expandButton as HTMLElement).click();
    await sleep(TIMING.UI_SETTLE);

    // Check if Cc appeared
    for (const btn of composeContainer.querySelectorAll("button")) {
      if (btn.textContent?.trim() === "Cc") {
        ccButton = btn;
        console.log("[OPM] Cc button appeared after expand");
        break;
      }
    }

    // If still not visible, try simulateClick as fallback
    if (!ccButton) {
      console.log("[OPM] Trying simulateClick on expand button...");
      simulateClick(expandButton);
      await sleep(TIMING.UI_SETTLE);
    }
  }
  // ... rest of code
}
```

## Console Log Sequence

```
[OPM] Found compose container
[OPM] Cc button not visible, expanding header...
[OPM] Found Expand header button: Expand header and show message history
[OPM] Clicking Expand header button...
[OPM] Trying simulateClick on expand button...
[OPM]   -> Failed: Error: Timeout waiting for button
```

## Relevant DOM Structure (from page snapshot)

The compose form has:

- `button "Expand header and show message history"` - exists but clicks don't work
- `generic "To: Gabriel Bleu <box.gbleu@gmail.com>"` - To recipient row
- No visible Cc/Bcc buttons until header is expanded

## Possible Next Steps

1. **Try focus + keyboard**: Focus the expand button first, then dispatch Enter/Space key
2. **Use Playwright directly**: If running via Playwright, use real browser clicks instead of DOM events
3. **Different event sequence**: Try mouseenter/mouseleave before click
4. **Check for isTrusted**: Outlook might check `event.isTrusted` which is false for synthetic events
5. **Try aria-expanded toggle**: Look for aria-expanded attribute changes
6. **Pop out to full compose**: Use "Pop Out" button to open full compose window where Cc is always visible

## Files Modified

- `src/content/outlook-actions.ts` - addCcRecipients function
- `src/content/dom-utils.ts` - simulateKeyPress (added shift modifier)

## Test Command

1. Build: `bun run build.ts`
2. Reload extension in chrome://extensions
3. Navigate to Outlook, go to "ok pour moi" folder
4. Press Ctrl+Shift+O to trigger workflow
