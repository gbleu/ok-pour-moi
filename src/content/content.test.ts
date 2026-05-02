import { afterAll, beforeEach, describe, expect, test, vi } from "vite-plus/test";

/* eslint-disable unicorn/no-null -- Chrome mock setup */
import { type PopupToContentMessage, type WorkflowResult } from "#shared/messages.js";

const originalChrome = (globalThis as Record<string, unknown>).chrome;

type MessageListener<TMessage, TResponse> = (
  message: TMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: TResponse) => void,
) => boolean;

function captureResponse<T>(): {
  mock: (response: T) => void;
  promise: Promise<T>;
} {
  const { promise, resolve } = Promise.withResolvers<T>();
  return {
    mock: vi.fn<(response: T) => void>((response: T) => {
      resolve(response);
    }),
    promise,
  };
}

vi.mock("./outlook-dom.js", () => ({
  collectPdfAttachments: vi.fn(async () => []),
}));
vi.mock("./outlook-compose.js", () => ({
  prepareDrafts: vi.fn(async () => ({ errors: [], successCount: 0 })),
}));

const { collectPdfAttachments } = await import("./outlook-dom.js");
const { prepareDrafts } = await import("./outlook-compose.js");

const addListenerMock = vi.fn();
const sendMessageMock = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Partial chrome mock for testing
(globalThis as Record<string, unknown>).chrome = {
  runtime: {
    id: "test-extension-id",
    onMessage: { addListener: addListenerMock },
    sendMessage: sendMessageMock,
  },
  storage: {
    sync: { get: vi.fn(async () => ({ myEmail: "test@example.com", replyMessage: "Ok" })) },
  },
};

const originalDocument = globalThis.document;
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Stub document for module load
globalThis.document = {
  addEventListener: vi.fn(),
  documentElement: { dataset: {} },
} as unknown as typeof globalThis.document;
await import("./content.js");
globalThis.document = originalDocument;

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-non-null-assertion -- Mock call args
const contentHandler = addListenerMock.mock.calls[0]![0] as MessageListener<
  PopupToContentMessage,
  WorkflowResult
>;

afterAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Restore original global state
  if (originalChrome === undefined) {
    delete (globalThis as Record<string, unknown>).chrome;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Restore original global state
    globalThis.chrome = originalChrome as typeof chrome;
  }
});

const validMessage: PopupToContentMessage = {
  config: { myEmail: "me@example.com", replyMessage: "OK" },
  type: "START_WORKFLOW",
};

describe("signAndDraft via onMessage", () => {
  beforeEach(() => {
    vi.mocked(collectPdfAttachments).mockReset();
    vi.mocked(prepareDrafts).mockReset();
    sendMessageMock.mockReset();
  });

  test("runs sign + draft pipeline for each attachment on the happy path", async () => {
    // Given
    vi.mocked(collectPdfAttachments).mockResolvedValueOnce([
      { conversationId: "conv-1", pdfBytes: new Uint8Array([1]), senderLastname: "DUPONT" },
      { conversationId: "conv-2", pdfBytes: new Uint8Array([2]), senderLastname: "MARTIN" },
    ]);
    sendMessageMock.mockResolvedValue({
      filename: "signed.pdf",
      signedPdf: [9, 9],
      success: true,
    });
    vi.mocked(prepareDrafts).mockResolvedValueOnce({ errors: [], successCount: 2 });
    const { mock: sendResponse, promise } = captureResponse<WorkflowResult>();

    // When
    const keepOpen = contentHandler(validMessage, { id: "test-extension-id" }, sendResponse);

    // Then
    expect({
      keepOpen,
      result: await promise,
      signCalls: sendMessageMock.mock.calls.length,
    }).toEqual({
      keepOpen: true,
      result: { kind: "processed", success: true, successCount: 2, totalCount: 2 },
      signCalls: 2,
    });
  });

  test("returns workflow-error when signing fails", async () => {
    // Given
    vi.mocked(collectPdfAttachments).mockResolvedValueOnce([
      { conversationId: "conv-1", pdfBytes: new Uint8Array([1]), senderLastname: "DUPONT" },
    ]);
    sendMessageMock.mockResolvedValueOnce({ error: "No signature configured", success: false });
    const { mock: sendResponse, promise } = captureResponse<WorkflowResult>();

    // When
    contentHandler(validMessage, { id: "test-extension-id" }, sendResponse);

    // Then
    expect(await promise).toEqual({
      error: "Signing failed: No signature configured",
      kind: "workflow-error",
      success: false,
    });
  });

  test("returns partial-failure with structured errors when some drafts fail", async () => {
    // Given
    vi.mocked(collectPdfAttachments).mockResolvedValueOnce([
      { conversationId: "conv-1", pdfBytes: new Uint8Array([1]), senderLastname: "DUPONT" },
      { conversationId: "conv-2", pdfBytes: new Uint8Array([2]), senderLastname: "MARTIN" },
    ]);
    sendMessageMock.mockResolvedValue({ filename: "signed.pdf", signedPdf: [0], success: true });
    vi.mocked(prepareDrafts).mockResolvedValueOnce({
      errors: [{ index: 2, message: "compose unavailable" }],
      successCount: 1,
    });
    const { mock: sendResponse, promise } = captureResponse<WorkflowResult>();

    // When
    contentHandler(validMessage, { id: "test-extension-id" }, sendResponse);

    // Then
    expect(await promise).toEqual({
      draftErrors: [{ index: 2, message: "compose unavailable" }],
      kind: "partial-failure",
      success: false,
      successCount: 1,
      totalCount: 2,
    });
  });
});
