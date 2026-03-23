import test, { expect } from "#helpers/extension-fixture.js";

// Extension loading tests require a real Chrome browser with extension support.
// Skip on CI where Chromium's persistent context doesn't reliably serve extension pages.
test.skip(Boolean(process.env.CI), "Extension loading tests require headed Chrome");

test.describe("Extension Loading", () => {
  test("service worker registers successfully", async ({ context }) => {
    const worker = context.serviceWorkers().find((sw) => sw.url().includes("service-worker"));
    expect(worker).toBeDefined();
    expect(worker?.url()).toMatch(/chrome-extension:\/\/[^/]+\/background\/service-worker\.js/);
  });

  test("popup renders initial state", async ({ getPopupPage }) => {
    const page = await getPopupPage();

    const state = await page.evaluate(() => {
      const status = document.querySelector("#status");
      const runBtn = document.querySelector<HTMLButtonElement>("#run-btn");
      const settingsLink = document.querySelector("#settings-link");
      const progress = document.querySelector("#progress");
      return {
        progressHidden: progress?.classList.contains("hidden") ?? false,
        runBtnDisabled: runBtn?.disabled ?? false,
        settingsLinkText: settingsLink?.textContent ?? "",
        statusVisible: status !== null,
      };
    });

    expect(state).toEqual({
      progressHidden: true,
      runBtnDisabled: true,
      settingsLinkText: "Settings",
      statusVisible: true,
    });

    await page.close();
  });

  test("options page loads and displays form fields", async ({ getOptionsPage }) => {
    const page = await getOptionsPage();

    const state = await page.evaluate(() => ({
      hasEmailField: document.querySelector("#myEmail") !== null,
      hasReplyField: document.querySelector("#replyMessage") !== null,
      hasSaveButton: document.querySelector("#save") !== null,
      hasSignatureUpload: document.querySelector("#signatureFile") !== null,
    }));

    expect(state).toEqual({
      hasEmailField: true,
      hasReplyField: true,
      hasSaveButton: true,
      hasSignatureUpload: true,
    });

    await page.close();
  });

  test("options page saves and reads settings via Chrome storage", async ({ getOptionsPage }) => {
    const page = await getOptionsPage();

    await page.fill("#myEmail", "test@example.com");
    await page.fill("#replyMessage", "Hello, Ok pour moi.");
    await page.click("#save");

    await page.reload();
    await page.waitForSelector("#myEmail");
    const values = await page.evaluate(() => ({
      email: document.querySelector<HTMLInputElement>("#myEmail")?.value ?? "",
      replyMessage: document.querySelector<HTMLTextAreaElement>("#replyMessage")?.value ?? "",
    }));

    expect(values).toEqual({
      email: "test@example.com",
      replyMessage: "Hello, Ok pour moi.",
    });

    await page.close();
  });
});
