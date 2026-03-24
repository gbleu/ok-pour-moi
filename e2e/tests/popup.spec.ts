import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Page, expect, test } from "@playwright/test";

const POPUP_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../dist/popup/popup.html");

test("popup initial state", async ({ page }: Readonly<{ page: Readonly<Page> }>) => {
  // Given
  await page.goto(`file://${POPUP_PATH}`);

  // When
  const state = await page.evaluate(() => {
    const status = document.querySelector("#status");
    const runBtn = document.querySelector<HTMLButtonElement>("#run-btn");
    const settingsLink = document.querySelector("#settings-link");
    const progress = document.querySelector("#progress");
    return {
      progressHidden: progress?.classList.contains("hidden") ?? false,
      runBtnDisabled: runBtn?.disabled ?? false,
      settingsLinkText: settingsLink?.textContent ?? "",
      statusVisible: status?.checkVisibility() ?? false,
    };
  });

  // Then
  expect(state).toEqual({
    progressHidden: true,
    runBtnDisabled: true,
    settingsLinkText: "Settings",
    statusVisible: true,
  });
});
