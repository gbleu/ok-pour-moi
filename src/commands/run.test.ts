import { FIXTURES_DIR, setupBrowser, setupBrowserWithPdfRoute } from "../__test__/test-helper.js";
import { describe, expect, test } from "bun:test";

import { join } from "node:path";
import { runWorkflow } from "./run.js";

describe("runWorkflow", () => {
  const { getPage } = setupBrowserWithPdfRoute();

  test("processes emails, signs PDFs, attaches to drafts, and moves to Inbox", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);

    // Given
    const sigPath = join(FIXTURES_DIR, "signature.png");
    const sigBytes = new Uint8Array(await Bun.file(sigPath).arrayBuffer());

    // When
    await runWorkflow(page, {
      ccEmails: ["manager@example.com"],
      folderName: "ok pour moi",
      myEmail: "me@example.com",
      replyMessage: "ok pour moi",
      sigBytes,
      sigFormat: "png",
      signaturePosition: { height: 50, width: 200, x: 100, y: 100 },
    });

    // Then
    const folderBadge = page.getByRole("treeitem", { name: /ok pour moi/ });
    const badgeText = await folderBadge.textContent();
    expect(badgeText).not.toContain("2");
  }, 120_000);
});

describe("runWorkflow edge cases", () => {
  const { getPage } = setupBrowser();

  test("returns early with no PDFs when folder is empty", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook-empty-folder.html`);

    // Given
    const sigBytes = new Uint8Array([1, 2, 3]);

    // When / Then - should complete without error
    await runWorkflow(page, {
      ccEmails: [],
      folderName: "empty folder",
      myEmail: "me@example.com",
      replyMessage: "ok pour moi",
      sigBytes,
      sigFormat: "png",
      signaturePosition: { height: 50, width: 200, x: 100, y: 100 },
    });
  }, 30_000);

  test("throws when folder is not found", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook-empty-folder.html`);

    // Given
    const sigBytes = new Uint8Array([1, 2, 3]);

    // When / Then
    const promise = runWorkflow(page, {
      ccEmails: [],
      folderName: "nonexistent folder",
      myEmail: "me@example.com",
      replyMessage: "ok pour moi",
      sigBytes,
      sigFormat: "png",
      signaturePosition: { height: 50, width: 200, x: 100, y: 100 },
    });
    expect(promise).rejects.toThrow('Folder "nonexistent folder" not found');
  }, 30_000);
});
