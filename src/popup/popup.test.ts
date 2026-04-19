import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

/* eslint-disable unicorn/no-null -- Chrome mock setup */

const tabsQueryMock = vi.fn(() => Promise.resolve([] as chrome.tabs.Tab[]));
const tabsSendMessageMock = vi.fn(() =>
  Promise.resolve({ message: "Processed 1/1 emails", success: true }),
);

function setupChromeMock(): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Test mock setup
  (globalThis as { chrome: unknown }).chrome = {
    runtime: {
      id: "test-extension-id",
      openOptionsPage: vi.fn(() => Promise.resolve()),
    },
    storage: {
      local: {
        get: (defaults: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> =>
          Promise.resolve({
            ...defaults,
            lastRun: null,
            signatureImage: { data: "base64data", format: "png", name: "sig.png", uploadedAt: 1 },
          }),
      },
      sync: {
        get: (defaults: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> =>
          Promise.resolve({
            ...defaults,
            myEmail: "me@example.com",
            replyMessage: "OK pour moi",
            signaturePosition: { height: 50, width: 150, x: 100, y: 100 },
          }),
      },
    },
    tabs: {
      query: tabsQueryMock,
      sendMessage: tabsSendMessageMock,
    },
  };
}

function setupPopupDom(): void {
  document.body.innerHTML = `
    <div id="status" class="status"></div>
    <div id="progress" class="hidden">
      <progress id="progress-bar" value="0" max="100"></progress>
      <div id="progress-text"></div>
    </div>
    <button id="run-btn" disabled>Sign PDFs &amp; Create Drafts</button>
    <a id="settings-link" href="#">Settings</a>
  `;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Partial mock for test
const activeTab = { id: 1, url: "https://outlook.office.com/mail/inbox" } as chrome.tabs.Tab;

describe("popup dispatchWorkflow", () => {
  beforeEach(() => {
    setupPopupDom();
    setupChromeMock();
    tabsQueryMock.mockReset();
    tabsSendMessageMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Test cleanup
    delete (globalThis as Record<string, unknown>).chrome;
  });

  test("sends correct message and shows success", async () => {
    // Given: valid config and active Outlook tab
    tabsQueryMock.mockResolvedValue([activeTab]);
    tabsSendMessageMock.mockResolvedValue({ message: "Processed 1/1 emails", success: true });
    const { dispatchWorkflow } = await import("./popup.js");

    // When
    await dispatchWorkflow();

    // Then: correct message sent to the right tab, success shown
    const status = document.querySelector<HTMLDivElement>("#status");
    expect({
      callCount: tabsSendMessageMock.mock.calls.length,
      className: status?.className,
      text: status?.textContent,
    }).toEqual({
      callCount: 1,
      className: "status ready",
      text: "Processed 1/1 emails",
    });
  });

  test("shows error when workflow fails", async () => {
    // Given: workflow returns failure
    tabsQueryMock.mockResolvedValue([activeTab]);
    tabsSendMessageMock.mockResolvedValue({ message: "Signing failed", success: false });
    const { dispatchWorkflow } = await import("./popup.js");

    // When
    await dispatchWorkflow();

    // Then
    const status = document.querySelector<HTMLDivElement>("#status");
    expect({
      className: status?.className,
      text: status?.textContent,
    }).toEqual({
      className: "status error",
      text: "Signing failed",
    });
  });

  test("maps connection error to user-friendly message", async () => {
    // Given: content script not loaded (connection error)
    tabsQueryMock.mockResolvedValue([activeTab]);
    tabsSendMessageMock.mockRejectedValue(
      new Error("Could not establish connection. Receiving end does not exist."),
    );
    const { dispatchWorkflow } = await import("./popup.js");

    // When
    await dispatchWorkflow();

    // Then
    const status = document.querySelector<HTMLDivElement>("#status");
    expect({
      className: status?.className,
      text: status?.textContent,
    }).toEqual({
      className: "status error",
      text: "Refresh Outlook page and try again",
    });
  });

  test("shows error when no Outlook tab found", async () => {
    // Given: no Outlook tab
    tabsQueryMock.mockResolvedValue([]);
    const { dispatchWorkflow } = await import("./popup.js");

    // When
    await dispatchWorkflow();

    // Then
    const status = document.querySelector<HTMLDivElement>("#status");
    expect({
      className: status?.className,
      text: status?.textContent,
    }).toEqual({
      className: "status error",
      text: "Open Outlook Web mail first",
    });
  });
});
