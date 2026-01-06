import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const POPUP_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../dist/popup/popup.html");

test("popup initial state", async ({ page }) => {
  await page.goto(`file://${POPUP_PATH}`);

  await expect(page.locator("#status")).toBeVisible();
  await expect(page.locator("#run-btn")).toBeDisabled();
  await expect(page.locator("#settings-link")).toHaveText("Settings");
  await expect(page.locator("#progress")).toHaveClass(/hidden/);
});
