/// <reference lib="dom" />
/* eslint-disable unicorn/no-null -- DOM test fixtures */
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("./outlook-compose-actions.js", () => ({
  attachFile: vi.fn(async () => {
    /* Noop */
  }),
  closeCompose: vi.fn(async () => {
    /* Noop */
  }),
  openReply: vi.fn(async () => {
    const el = document.createElement("div");
    el.setAttribute("role", "textbox");
    el.setAttribute("contenteditable", "true");
    document.body.append(el);
    return el;
  }),
  removeAllAttachments: vi.fn(async () => {
    /* Noop */
  }),
  saveDraft: vi.fn(async () => {
    /* Noop */
  }),
}));

vi.mock("./outlook-automation.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    simulateKeyPress: vi.fn(),
    sleep: vi.fn(async () => {
      /* Noop */
    }),
    typeText: vi.fn(),
  };
});

const { prepareDrafts } = await import("./outlook-compose.js");
const composeActions = await import("./outlook-compose-actions.js");

function makeItem(idx: number): Parameters<typeof prepareDrafts>[0][number] {
  return {
    conversationId: `conv-${idx}`,
    filename: `attachment-${idx}.pdf`,
    signedPdf: new Uint8Array([idx]),
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("prepareDrafts", () => {
  test("returns zero success and no errors for empty items", async () => {
    // Given / When
    const result = await prepareDrafts([], "Hello");

    // Then
    expect(result).toEqual({ errors: [], successCount: 0 });
  });

  test("drives the full draft pipeline for every item on happy path", async () => {
    // Given
    const items = [makeItem(1), makeItem(2)];

    // When
    const result = await prepareDrafts(items, "Reply body");

    // Then
    expect(result).toEqual({ errors: [], successCount: 2 });
    expect({
      attachFileCalls: vi.mocked(composeActions.attachFile).mock.calls,
      closeCalls: vi.mocked(composeActions.closeCompose).mock.calls.length,
      openCalls: vi.mocked(composeActions.openReply).mock.calls,
      removeAttachmentCalls: vi.mocked(composeActions.removeAllAttachments).mock.calls.length,
      saveCalls: vi.mocked(composeActions.saveDraft).mock.calls.length,
    }).toEqual({
      attachFileCalls: [
        [items[0]?.signedPdf, items[0]?.filename],
        [items[1]?.signedPdf, items[1]?.filename],
      ],
      closeCalls: 2,
      openCalls: [[items[0]?.conversationId], [items[1]?.conversationId]],
      removeAttachmentCalls: 2,
      saveCalls: 2,
    });
  });

  test("collects per-item errors with 1-based index prefix and continues processing", async () => {
    // Given
    vi.mocked(composeActions.openReply).mockImplementationOnce(async () => {
      throw new Error("compose unavailable");
    });
    const items = [makeItem(1), makeItem(2)];

    // When
    const result = await prepareDrafts(items, "Reply body");

    // Then
    expect(result).toEqual({
      errors: [{ index: 1, message: "compose unavailable" }],
      successCount: 1,
    });
  });
});
