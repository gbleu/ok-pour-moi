import { FIXTURES_DIR, setupBrowserWithPdfRoute } from "../__test__/test-helper.js";
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
