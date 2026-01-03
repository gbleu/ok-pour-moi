import { FIXTURES_DIR, setupBrowser } from "../__test__/test-helper.js";
import {
  collectSignedPdfs,
  findAttachmentListbox,
  findLastMessageFromOthers,
} from "./outlook-dom.js";
import { describe, expect, test } from "bun:test";

import { selectEmail } from "./outlook-actions.js";

describe("collectSignedPdfs edge cases", () => {
  const { getPage } = setupBrowser();

  test("returns empty array when all messages are from self", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook-no-other-sender.html`);

    // Given
    const sigBytes = new Uint8Array([1, 2, 3]);

    // When
    const items = await collectSignedPdfs(page, {
      myEmail: "me@example.com",
      sigBytes,
      sigFormat: "png",
      signaturePosition: { height: 50, width: 200, x: 100, y: 100 },
    });

    // Then
    expect(items).toEqual([]);
  }, 30_000);

  test("returns empty array when no attachments in last message", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook-no-attachments.html`);

    // Given
    const sigBytes = new Uint8Array([1, 2, 3]);

    // When
    const items = await collectSignedPdfs(page, {
      myEmail: "me@example.com",
      sigBytes,
      sigFormat: "png",
      signaturePosition: { height: 50, width: 200, x: 100, y: 100 },
    });

    // Then
    expect(items).toEqual([]);
  }, 30_000);

  test("returns empty array when no PDF attachments", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook-no-pdfs.html`);

    // Given
    const sigBytes = new Uint8Array([1, 2, 3]);

    // When
    const items = await collectSignedPdfs(page, {
      myEmail: "me@example.com",
      sigBytes,
      sigFormat: "png",
      signaturePosition: { height: 50, width: 200, x: 100, y: 100 },
    });

    // Then
    expect(items).toEqual([]);
  }, 30_000);
});

describe("findLastMessageFromOthers", () => {
  const { getPage } = setupBrowser();

  test("returns undefined when all messages are from self", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook-no-other-sender.html`);

    // Given
    const readingPane = page.locator('[role="main"]');

    // When
    const result = await findLastMessageFromOthers(readingPane, "me@example.com");

    // Then
    expect(result).toBeUndefined();
  }, 30_000);

  test("returns message info when sender is not self", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);
    await selectEmail(page, 0);

    // Given
    const readingPane = page.locator('[role="main"]');

    // When
    const result = await findLastMessageFromOthers(readingPane, "me@example.com");

    // Then
    expect(result).toBeDefined();
    expect(result?.senderLastname).toBe("Dupont");
  }, 30_000);
});

describe("findAttachmentListbox", () => {
  const { getPage } = setupBrowser();

  test("returns undefined when no attachments in message", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook-no-attachments.html`);

    // Given
    const readingPane = page.locator('[role="main"]');
    const message = await findLastMessageFromOthers(readingPane, "me@example.com");

    // When
    const result = message && (await findAttachmentListbox(readingPane, message.button));

    // Then
    expect(result).toBeUndefined();
  }, 30_000);
});
