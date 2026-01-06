import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const INBOX_FIXTURE = join(FIXTURES, "outlook-inbox.html");
const MESSAGE_FIXTURE = join(FIXTURES, "outlook-message.html");

test.describe("Workflow DOM Interactions", () => {
  test("inbox fixture has conversations with subject", async ({ page }) => {
    await page.goto(`file://${INBOX_FIXTURE}`);

    expect(await page.locator("[data-convid]").count()).toBe(3);
    expect(await page.locator('[data-convid][aria-selected="true"]').count()).toBe(1);
    expect(await page.locator('[role="main"] [role="heading"][aria-level="2"]').textContent()).toBe(
      "Invoice Review",
    );
  });

  test("message fixture has reply button", async ({ page }) => {
    await page.goto(`file://${MESSAGE_FIXTURE}`);
    await expect(page.locator('button[name="Reply"]')).toBeVisible();
  });

  test("compose dialog has textbox and attach button", async ({ page }) => {
    await page.goto(`file://${MESSAGE_FIXTURE}`);
    await page.locator('[role="dialog"]').evaluate((el: HTMLElement) => {
      el.style.display = "block";
    });

    await expect(page.locator('[role="textbox"][contenteditable="true"]')).toBeVisible();
    await expect(page.locator('button[aria-label*="Attach"]')).toBeVisible();
  });

  test("identifies sender email from data-email attribute", async ({ page }) => {
    await page.goto(`file://${MESSAGE_FIXTURE}`);

    const senderEmail = await page.evaluate(() => {
      const senderBtn = document.querySelector<HTMLElement>('button[name^="From:"]');
      return senderBtn?.querySelector<HTMLElement>("[data-email]")?.dataset.email ?? "";
    });

    expect(senderEmail).toBe("sarah.connor@cyberdyne.com");
  });
});
