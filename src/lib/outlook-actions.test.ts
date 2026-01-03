import { FIXTURES_DIR, setupBrowser } from "../__test__/test-helper.js";
import { describe, expect, test } from "bun:test";

import { expandThread, openReply, selectEmail, typeMessage } from "./outlook-actions.js";

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
});
