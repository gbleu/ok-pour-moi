import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

const FIXTURES = join(import.meta.dirname, "../fixtures");
const INBOX_FIXTURE = join(FIXTURES, "outlook-inbox.html");
const MESSAGE_FIXTURE = join(FIXTURES, "outlook-message.html");

test.describe("Workflow DOM Interactions", () => {
  test("inbox fixture has conversations with subject", async ({
    page,
  }: Readonly<{ page: Readonly<Page> }>) => {
    // Given
    await page.goto(`file://${INBOX_FIXTURE}`);

    // When
    const state = await page.evaluate(() => {
      const conversations = document.querySelectorAll("[data-convid]");
      const selected = document.querySelectorAll('[data-convid][aria-selected="true"]');
      const heading = document.querySelector('[role="main"] [role="heading"][aria-level="2"]');
      return {
        conversationCount: conversations.length,
        headingText: heading?.textContent ?? "",
        selectedCount: selected.length,
      };
    });

    // Then
    expect(state).toEqual({
      conversationCount: 3,
      headingText: "Invoice Review",
      selectedCount: 1,
    });
  });

  test("message fixture has reply button", async ({ page }: Readonly<{ page: Readonly<Page> }>) => {
    // Given
    await page.goto(`file://${MESSAGE_FIXTURE}`);

    // Then
    await expect(page.locator('button[name="Reply"]')).toBeVisible();
  });

  test("compose dialog has textbox and attach button", async ({
    page,
  }: Readonly<{ page: Readonly<Page> }>) => {
    // Given
    await page.goto(`file://${MESSAGE_FIXTURE}`);

    // When
    await page.locator('[role="dialog"]').evaluate((el) => {
      el.style.display = "block";
    });

    // Then
    const state = await page.evaluate(() => {
      const textbox = document.querySelector('[role="textbox"][contenteditable="true"]');
      const attachBtn = document.querySelector('button[aria-label*="Attach"]');
      return {
        attachBtnVisible: attachBtn?.checkVisibility() ?? false,
        textboxVisible: textbox?.checkVisibility() ?? false,
      };
    });
    expect(state).toEqual({
      attachBtnVisible: true,
      textboxVisible: true,
    });
  });

  test("identifies sender email from data-email attribute", async ({
    page,
  }: Readonly<{ page: Readonly<Page> }>) => {
    // Given
    await page.goto(`file://${MESSAGE_FIXTURE}`);

    // When
    const senderEmail = await page.evaluate(() => {
      const senderBtn = document.querySelector<HTMLElement>('button[name^="From:"]');
      return senderBtn?.querySelector<HTMLElement>("[data-email]")?.dataset.email ?? "";
    });

    // Then
    expect(senderEmail).toBe("sarah.connor@cyberdyne.com");
  });
});
