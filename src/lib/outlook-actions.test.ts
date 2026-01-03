import { FIXTURES_DIR, setupBrowser } from "../__test__/test-helper.js";
import {
  addCcRecipients,
  closeCompose,
  expandThread,
  openReply,
  saveDraft,
  selectEmail,
  typeMessage,
} from "./outlook-actions.js";
import { describe, expect, test } from "bun:test";

describe("outlook-actions UI edge cases", () => {
  const { getPage } = setupBrowser();

  test("expandThread returns 0 when no thread exists", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);

    // Given: second email has no thread
    await selectEmail(page, 1);

    // When
    const expandClicks = await expandThread(page);

    // Then
    expect(expandClicks).toBe(0);
  }, 30_000);

  test("tab switching between Home and Options", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);

    // Given: Home tab selected
    const homeTab = page.getByRole("tab", { name: "Home" });
    const optionsTab = page.getByRole("tab", { name: "Options" });
    expect(await homeTab.getAttribute("aria-selected")).toBe("true");

    // When
    await optionsTab.click();

    // Then
    expect(await optionsTab.getAttribute("aria-selected")).toBe("true");
    expect(await homeTab.getAttribute("aria-selected")).toBe("false");
    expect(await page.getByRole("checkbox", { name: "Show Cc" }).isVisible()).toBe(true);
  }, 30_000);

  test("discard dialog appears when escaping compose with unsaved content", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);

    // Given: compose open with content
    const composeBody = await openReply(page);
    await typeMessage(composeBody, "test message");

    // When
    await page.keyboard.press("Escape");

    // Then
    const dialog = page.getByRole("dialog");
    expect(await dialog.isVisible()).toBe(true);
    expect(await dialog.textContent()).toContain("Discard draft");

    // When: cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Then: back to compose
    expect(await dialog.isHidden()).toBe(true);
    expect(await composeBody.isVisible()).toBe(true);
  }, 30_000);

  test("addCcRecipients with empty array returns early", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);

    // When / Then - should return without error
    await addCcRecipients(page, []);
  }, 30_000);

  test("closeCompose after saving draft does not show dialog", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);

    // Given: compose with content, then save
    const composeBody = await openReply(page);
    await typeMessage(composeBody, "test message");
    await saveDraft(page);

    // When
    await closeCompose(page);

    // Then - should close without dialog
    const composeArea = page.locator("#compose-area");
    expect(await composeArea.isHidden()).toBe(true);
  }, 30_000);

  test("closeCompose with unsaved content cancels dialog and returns to compose", async () => {
    const page = getPage();
    await page.goto(`file://${FIXTURES_DIR}/outlook.html`);

    // Given: compose with unsaved content
    const composeBody = await openReply(page);
    await typeMessage(composeBody, "unsaved content");

    // When
    await closeCompose(page);

    // Then - should still be in compose (dialog was cancelled)
    expect(await composeBody.isVisible()).toBe(true);
  }, 30_000);
});
