import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

/* eslint-disable unicorn/no-null -- DOM test fixtures + Chrome mock setup */
import { getElement } from "#shared/dom.js";

import "../content/happy-dom.setup.js"; // eslint-disable-line import/no-unassigned-import, import/no-relative-parent-imports -- DOM test setup

const syncSetMock = mock(
  (_data: Readonly<Record<string, unknown>>): Promise<void> => Promise.resolve(),
);

function setupChromeMock(): void {
  const syncData: Record<string, unknown> = {
    myEmail: "me@example.com",
    replyMessage: "OK pour moi",
    signaturePosition: { height: 50, width: 150, x: 100, y: 100 },
  };

  const localData: Record<string, unknown> = {
    lastRun: null,
    signatureImage: { data: "base64data", format: "png", name: "sig.png", uploadedAt: 1 },
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Test mock setup
  (globalThis as { chrome: unknown }).chrome = {
    runtime: { id: "test-extension-id" },
    storage: {
      local: {
        get: (defaults: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> =>
          Promise.resolve({ ...defaults, ...localData }),
        set: mock((): Promise<void> => Promise.resolve()),
      },
      sync: {
        get: (defaults: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> =>
          Promise.resolve({ ...defaults, ...syncData }),
        set: syncSetMock,
      },
    },
  };
}

function setupOptionsDom(): void {
  document.body.innerHTML = `
    <input id="myEmail" value="" />
    <textarea id="replyMessage"></textarea>
    <input id="sigX" value="" />
    <input id="sigY" value="" />
    <input id="sigWidth" value="" />
    <input id="sigHeight" value="" />
    <img id="signaturePreview" class="hidden" />
    <div id="status" class="status hidden"></div>
    <button id="save">Save</button>
    <button id="chooseFileBtn">Choose File</button>
    <input id="signatureFile" type="file" />
    <span id="fileName"></span>
  `;
}

function setFormValues(values: Readonly<Record<string, string>>): void {
  for (const [id, value] of Object.entries(values)) {
    const el = getElement<HTMLInputElement | HTMLTextAreaElement>(id);
    el.value = value;
  }
}

describe("options saveSettings", () => {
  beforeEach(() => {
    setupOptionsDom();
    setupChromeMock();
    syncSetMock.mockReset();
    syncSetMock.mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    document.body.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Test cleanup
    delete (globalThis as Record<string, unknown>).chrome;
  });

  test("saves form values to Chrome sync storage", async () => {
    // Given: form fields with values
    setFormValues({
      myEmail: "user@test.com",
      replyMessage: "Custom reply",
      sigHeight: "75",
      sigWidth: "100",
      sigX: "200",
      sigY: "300",
    });
    const { saveSettings } = await import("./options.js");

    // When
    await saveSettings();

    // Then
    expect(syncSetMock.mock.calls[0]).toEqual([
      {
        myEmail: "user@test.com",
        replyMessage: "Custom reply",
        signaturePosition: { height: 75, width: 100, x: 200, y: 300 },
      },
    ]);
  });

  test("uses fallback values when inputs are not numbers", async () => {
    // Given: non-numeric position values
    setFormValues({
      myEmail: "user@test.com",
      replyMessage: "Reply",
      sigHeight: "!!",
      sigWidth: "xyz",
      sigX: "abc",
      sigY: "",
    });
    const { saveSettings } = await import("./options.js");

    // When
    await saveSettings();

    // Then: uses fallback values for NaN inputs
    expect(syncSetMock.mock.calls[0]).toEqual([
      {
        myEmail: "user@test.com",
        replyMessage: "Reply",
        signaturePosition: { height: 50, width: 150, x: 120, y: 130 },
      },
    ]);
  });

  test("uses default reply message when empty", async () => {
    // Given: empty reply message
    setFormValues({
      myEmail: "user@test.com",
      replyMessage: "",
      sigHeight: "50",
      sigWidth: "100",
      sigX: "100",
      sigY: "100",
    });
    const { saveSettings } = await import("./options.js");

    // When
    await saveSettings();

    // Then
    expect(syncSetMock.mock.calls[0]).toEqual([
      {
        myEmail: "user@test.com",
        replyMessage: "Hello, Ok pour moi.",
        signaturePosition: { height: 50, width: 100, x: 100, y: 100 },
      },
    ]);
  });

  test("shows success status after save", async () => {
    // Given
    setFormValues({
      myEmail: "a@b.com",
      replyMessage: "test",
      sigHeight: "0",
      sigWidth: "0",
      sigX: "0",
      sigY: "0",
    });
    const { saveSettings } = await import("./options.js");

    // When
    await saveSettings();

    // Then
    const status = getElement<HTMLDivElement>("status");
    expect({
      hasHidden: status.classList.contains("hidden"),
      text: status.textContent,
    }).toEqual({
      hasHidden: false,
      text: "Settings saved!",
    });
  });
});
