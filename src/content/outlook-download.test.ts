/// <reference lib="dom" />
/* eslint-disable unicorn/no-null -- DOM test fixtures */
import { afterEach, describe, expect, test } from "vite-plus/test";

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
    await expect(downloadAttachment(option)).rejects.toThrow("Attachment ID not found in URL");
  });
});
