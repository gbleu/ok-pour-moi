/* eslint-disable unicorn/no-null -- Chrome mock setup */
import { afterAll, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  type ContentToBackgroundMessage,
  type PopupToContentMessage,
  type SignPdfResponse,
  type WorkflowResult,
} from "#shared/messages.js";

// Capture before any module-scope mock overwrites globalThis.chrome
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

// --- Service worker handler capture ---

const swAddListenerMock = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Partial chrome mock for testing
(globalThis as Record<string, unknown>).chrome = {
  runtime: { onMessage: { addListener: swAddListenerMock } },
  storage: {
    local: { get: vi.fn(async () => ({ signatureImage: null })) },
    sync: {
      get: vi.fn(async () => ({
        myEmail: "test@example.com",
        replyMessage: "Ok",
        signaturePosition: { height: 50, width: 150, x: 100, y: 100 },
      })),
    },
  },
};

await import("./background/service-worker.js");

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-non-null-assertion -- Mock call args
const swHandler = swAddListenerMock.mock.calls[0]![0] as MessageListener<
  ContentToBackgroundMessage,
  SignPdfResponse
>;

// --- Content handler capture ---

vi.mock("./content/outlook-dom.js", () => ({
  collectPdfAttachments: async (): Promise<never[]> => [],
}));
vi.mock("./content/outlook-compose.js", () => ({
  prepareDrafts: async (): Promise<{ errors: never[]; successCount: number }> => ({
    errors: [],
    successCount: 0,
  }),
}));

const contentAddListenerMock = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Partial chrome mock for testing
(globalThis as Record<string, unknown>).chrome = {
  runtime: {
    id: "test-extension-id",
    onMessage: { addListener: contentAddListenerMock },
    sendMessage: vi.fn(async () => ({ error: "No signature", success: false })),
  },
  storage: {
    sync: {
      get: vi.fn(async () => ({
        myEmail: "test@example.com",
        replyMessage: "Ok",
      })),
    },
  },
};

const originalDocument = globalThis.document;
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Stub document for module load
globalThis.document = {
  addEventListener: vi.fn(),
  documentElement: { dataset: {} },
} as unknown as typeof globalThis.document;
await import("./content/content.js");
globalThis.document = originalDocument;

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-non-null-assertion -- Mock call args
const contentHandler = contentAddListenerMock.mock.calls[0]![0] as MessageListener<
  PopupToContentMessage,
  WorkflowResult
>;

// --- Cleanup ---

afterAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Restore original global state
  if (originalChrome === undefined) {
    delete (globalThis as Record<string, unknown>).chrome;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Restore original global state
    globalThis.chrome = originalChrome as typeof chrome;
  }
});

// --- Tests ---

describe("service-worker onMessage handler", () => {
  const validMessage: ContentToBackgroundMessage = {
    payload: { pdfBytes: [1, 2, 3], senderLastname: "DUPONT" },
    type: "SIGN_PDF",
  };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Partial chrome mock for testing
    (globalThis as Record<string, unknown>).chrome = {
      runtime: { onMessage: { addListener: vi.fn() } },
      storage: {
        local: { get: vi.fn(async () => ({ signatureImage: null })) },
        sync: {
          get: vi.fn(async () => ({
            myEmail: "test@example.com",
            replyMessage: "Ok",
            signaturePosition: { height: 50, width: 150, x: 100, y: 100 },
          })),
        },
      },
    };
  });

  test("rejects messages from non-Outlook origins", () => {
    const sendResponse = vi.fn();

    const keepOpen = swHandler(validMessage, { url: "https://evil.com/mail/inbox" }, sendResponse);

    expect([keepOpen, sendResponse.mock.calls.length]).toEqual([false, 0]);
  });

  test("rejects messages with undefined sender URL", () => {
    const sendResponse = vi.fn();

    const keepOpen = swHandler(validMessage, {}, sendResponse);

    expect([keepOpen, sendResponse.mock.calls.length]).toEqual([false, 0]);
  });

  test("rejects messages with malformed sender URL", () => {
    const sendResponse = vi.fn();

    const keepOpen = swHandler(validMessage, { url: "not-a-url" }, sendResponse);

    expect([keepOpen, sendResponse.mock.calls.length]).toEqual([false, 0]);
  });

  test("accepts Outlook origin and responds with signing result", async () => {
    const { mock: sendResponse, promise } = captureResponse<SignPdfResponse>();

    const keepOpen = swHandler(
      validMessage,
      { url: "https://outlook.office.com/mail/inbox" },
      sendResponse,
    );

    expect(keepOpen).toBe(true);

    expect(await promise).toEqual({
      error: "No signature configured",
      success: false,
    });
  });
});

describe("content.ts onMessage handler", () => {
  const validMessage: PopupToContentMessage = {
    config: { myEmail: "me@example.com", replyMessage: "OK" },
    type: "START_WORKFLOW",
  };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Partial chrome mock for testing
    (globalThis as Record<string, unknown>).chrome = {
      runtime: {
        id: "test-extension-id",
        onMessage: { addListener: vi.fn() },
        sendMessage: vi.fn(async () => ({ error: "No signature", success: false })),
      },
      storage: {
        sync: {
          get: vi.fn(async () => ({
            myEmail: "test@example.com",
            replyMessage: "Ok",
          })),
        },
      },
    };
  });

  test("rejects messages from different extension", () => {
    const sendResponse = vi.fn();

    const keepOpen = contentHandler(validMessage, { id: "other-extension" }, sendResponse);

    expect([keepOpen, sendResponse.mock.calls.length]).toEqual([false, 0]);
  });

  test("accepts own extension and responds with workflow result", async () => {
    const { mock: sendResponse, promise } = captureResponse<WorkflowResult>();

    const keepOpen = contentHandler(validMessage, { id: "test-extension-id" }, sendResponse);

    expect(keepOpen).toBe(true);

    expect(await promise).toEqual({
      message: "No PDFs found in current conversation",
      success: true,
    });
  });
});
