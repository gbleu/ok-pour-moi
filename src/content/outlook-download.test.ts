/// <reference lib="dom" />
/* eslint-disable unicorn/no-null, import/no-unassigned-import -- DOM test fixtures */
import "./happy-dom.setup.js";
import { afterEach, describe, expect, test } from "bun:test";

// Verify downloadAttachment contract through its error paths
// Type guards and blob protocol are internal

describe("outlook-download module", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("downloadAttachment throws when attachment URL never appears", async () => {
    // Given: an element that can be clicked but no /sxs/ URL navigation occurs
    const option = document.createElement("div");
    option.setAttribute("role", "option");
    option.textContent = "test.pdf";
    document.body.append(option);

    const { downloadAttachment } = await import("./outlook-download.js");

    // When/Then: throws because waitUntilAttachmentReady times out
    expect(downloadAttachment(option)).rejects.toThrow("Attachment ID not found in URL");
  });
});
