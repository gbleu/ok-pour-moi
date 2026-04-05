/// <reference lib="dom" />
/* eslint-disable unicorn/no-null, @typescript-eslint/no-non-null-assertion, import/no-unassigned-import -- DOM test fixtures */
import "./happy-dom.setup.js";
import { afterEach, describe, expect, test } from "bun:test";

import {
  attachFile,
  closeCompose,
  openReply,
  removeAllAttachments,
  saveDraft,
} from "./outlook-compose-actions.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("removeAllAttachments", () => {
  test("preserves compose body when no attachments exist", async () => {
    // Given: compose body in dialog with no attachments
    document.body.innerHTML = `
      <div role="dialog">
        <div role="textbox" contenteditable="true">draft text</div>
      </div>
    `;

    // When
    await removeAllAttachments();

    // Then: compose body is unchanged
    expect(document.querySelector('[role="textbox"]')?.textContent).toBe("draft text");
  });

  test("does not modify DOM when no compose body exists", async () => {
    // Given: document with no compose textbox
    document.body.innerHTML = "<div>inbox view</div>";
    const originalHtml = document.body.innerHTML;

    // When
    await removeAllAttachments();

    // Then: DOM unchanged
    expect(document.body.innerHTML).toBe(originalHtml);
  });

  test("ignores attachment listbox with no option elements", async () => {
    // Given: compose with empty attachment listbox
    document.body.innerHTML = `
      <div role="dialog">
        <div role="textbox" contenteditable="true">text</div>
        <div role="listbox" aria-label="Attachment list"></div>
      </div>
    `;

    // When
    await removeAllAttachments();

    // Then: listbox remains in DOM
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
  });
});

describe("closeCompose", () => {
  test("exits immediately when no compose textbox exists", async () => {
    // Given: no compose textbox in DOM
    document.body.innerHTML = "<div>inbox view</div>";

    // When
    await closeCompose();

    // Then: DOM unchanged, no errors
    expect(document.querySelector("div")?.textContent).toBe("inbox view");
  });

  test("finds and interacts with cancel button in dialog", async () => {
    // Given: unsaved changes dialog with Cancel button
    const clicks: string[] = [];
    document.body.innerHTML = `
      <div role="dialog">
        <button>Save</button>
        <button>Cancel</button>
      </div>
    `;
    for (const btn of document.querySelectorAll("button")) {
      btn.addEventListener("pointerdown", () => {
        clicks.push(btn.textContent ?? "");
      });
    }

    // When
    await closeCompose();

    // Then: Cancel button was clicked (not Save)
    expect(clicks).toEqual(["Cancel"]);
  });

  test("clicks Home tab when present", async () => {
    // Given: Home tab in ribbon
    let homeClicked = false;
    document.body.innerHTML = `
      <div role="tab" aria-label="Home">Home</div>
    `;
    document.querySelector('[role="tab"]')!.addEventListener("pointerdown", () => {
      homeClicked = true;
    });

    // When
    await closeCompose();

    // Then
    expect(homeClicked).toBe(true);
  });
});

describe("saveDraft", () => {
  test("dispatches keyboard shortcut to active element", async () => {
    // Given: a focused element
    const events: string[] = [];
    document.body.innerHTML = `<input />`;
    const input = document.querySelector("input")!;
    input.focus();
    input.addEventListener("keydown", (event: KeyboardEvent) => {
      events.push(`${event.key}:${String(event.ctrlKey || event.metaKey)}`);
    });

    // When
    await saveDraft();

    // Then: received save shortcut
    expect(events).toEqual(["s:true"]);
  });
});

describe("openReply", () => {
  test("clicks conversation item and reply button, returns compose body", async () => {
    // Given: email item and reply button leading to compose textbox
    const clicks: string[] = [];
    document.body.innerHTML = `
      <div data-convid="conv-123" aria-selected="true">Email</div>
      <button name="Reply">Reply</button>
      <div role="textbox" contenteditable="true">compose area</div>
    `;
    document.querySelector('[data-convid="conv-123"]')!.addEventListener("pointerdown", () => {
      clicks.push("conversation");
    });
    document.querySelector('button[name="Reply"]')!.addEventListener("pointerdown", () => {
      clicks.push("reply");
    });

    // When
    const composeBody = await openReply("conv-123");

    // Then
    expect(clicks).toEqual(["conversation", "reply"]);
    expect(composeBody.getAttribute("contenteditable")).toBe("true");
  });

  test("proceeds without clicking when conversation item is missing", async () => {
    // Given: reply button and compose textbox but no conversation item
    const clicks: string[] = [];
    document.body.innerHTML = `
      <button name="Reply">Reply</button>
      <div role="textbox" contenteditable="true">compose area</div>
    `;
    document.querySelector('button[name="Reply"]')!.addEventListener("pointerdown", () => {
      clicks.push("reply");
    });

    // When
    const composeBody = await openReply("nonexistent-conv");

    // Then: only reply was clicked, compose body returned
    expect(clicks).toEqual(["reply"]);
    expect(composeBody.getAttribute("contenteditable")).toBe("true");
  });
});

describe("attachFile", () => {
  test("creates file and sets it on file input", async () => {
    // Given: attach button and file input
    const clicks: string[] = [];
    document.body.innerHTML = `
      <button aria-label="Attach files">Attach</button>
      <input type="file" accept="application/pdf,.pdf" />
    `;
    document.querySelector("button")!.addEventListener("pointerdown", () => {
      clicks.push("attach");
    });

    // When
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    await attachFile(pdfBytes, "signed.pdf");

    // Then: attach button was clicked and file input received the file
    expect(clicks).toEqual(["attach"]);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.files?.length).toBe(1);
    expect(input.files?.[0]?.name).toBe("signed.pdf");
  });

  test("throws when no file input exists", async () => {
    // Given: attach button but no file input
    document.body.innerHTML = `
      <button aria-label="Attach files">Attach</button>
    `;

    // When / Then
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    try {
      await attachFile(pdfBytes, "signed.pdf");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error instanceof Error && error.message).toBe(
        "Could not find file input for attachment",
      );
    }
  });
});
