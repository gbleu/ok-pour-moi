import { FIXTURES_DIR, setupBrowser } from "../__test__/test-helper.js";
import { describe, expect, test } from "bun:test";

import type { PdfItem } from "./outlook-dom.js";
import { prepareDrafts } from "./outlook-compose.js";

describe("prepareDrafts", () => {
  const { getPage } = setupBrowser();

  test("returns early with empty items array", async () => {
    // Given
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);
    const items: PdfItem[] = [];

    // When / Then - should complete without error and not interact with page
    await prepareDrafts(page, items, {
      ccEmails: [],
      replyMessage: "ok pour moi",
    });
  }, 30_000);

  test("creates draft reply with message and attachment", async () => {
    // Given
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);
    const items: PdfItem[] = [
      {
        conversationId: "conv-001",
        senderLastname: "Dupont",
        signedPdf: new Uint8Array([1, 2, 3]),
        subject: "Test Subject",
      },
    ];

    // When
    await prepareDrafts(page, items, {
      ccEmails: [],
      replyMessage: "ok pour moi",
    });

    // Then - email should be moved (no longer in list with conv-001)
    const emailItem = page.locator('[data-convid="conv-001"]');
    expect(await emailItem.count()).toBe(0);
  }, 60_000);

  test("adds CC recipients when provided", async () => {
    // Given
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);
    const items: PdfItem[] = [
      {
        conversationId: "conv-002",
        senderLastname: "Martin",
        signedPdf: new Uint8Array([1, 2, 3]),
        subject: "Documents fiscaux 2024",
      },
    ];

    // When
    await prepareDrafts(page, items, {
      ccEmails: ["manager@example.com"],
      replyMessage: "ok pour moi",
    });

    // Then - email should be moved
    const emailItem = page.locator('[data-convid="conv-002"]');
    expect(await emailItem.count()).toBe(0);
  }, 60_000);

  test("continues processing when moveToFolder fails for one item", async () => {
    // Given
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);
    const items: PdfItem[] = [
      {
        conversationId: "nonexistent-conv",
        senderLastname: "Unknown",
        signedPdf: new Uint8Array([1, 2, 3]),
        subject: "Will fail move",
      },
      {
        conversationId: "conv-001",
        senderLastname: "Dupont",
        signedPdf: new Uint8Array([1, 2, 3]),
        subject: "Should succeed",
      },
    ];

    // When / Then - should complete without throwing
    await prepareDrafts(page, items, {
      ccEmails: [],
      replyMessage: "ok pour moi",
    });
  }, 90_000);
});
