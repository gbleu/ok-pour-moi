/// <reference lib="dom" />
/* eslint-disable unicorn/no-null, import/no-unassigned-import -- DOM test fixtures */
import "./happy-dom.setup.js";
import { afterEach, describe, expect, test } from "bun:test";

// GetConversationContext is not exported, so test collectPdfAttachment indirectly
// By verifying the DOM parsing logic through the public API

describe("collectPdfAttachment DOM prerequisites", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("returns empty when no reading pane exists", async () => {
    // Given: empty document with no [role="main"]
    document.body.innerHTML = "<div>empty</div>";

    // When: we import and call collectPdfAttachment
    const { collectPdfAttachment } = await import("./outlook-dom.js");
    const result = await collectPdfAttachment("test@example.com");

    // Then: returns empty array
    expect(result).toEqual([]);
  });

  test("returns empty when reading pane has no sender messages", async () => {
    // Given: reading pane with heading but no sender buttons
    document.body.innerHTML = `
      <div role="main">
        <div role="heading" aria-level="2">Test Subject</div>
      </div>
    `;

    const { collectPdfAttachment } = await import("./outlook-dom.js");
    const result = await collectPdfAttachment("me@example.com");

    // Then: returns empty (no message from others found)
    expect(result).toEqual([]);
  });
});
