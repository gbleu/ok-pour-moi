/// <reference lib="dom" />
/* eslint-disable unicorn/no-null -- DOM test fixtures */
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

interface MockMessageInfo {
  readonly element: Element;
  readonly senderEmail: string;
  readonly senderLastname: string;
}

function findMessageInDom(): MockMessageInfo | undefined {
  const messageEl = document.querySelector<HTMLElement>("[data-test-message]");
  if (!messageEl) {
    return undefined;
  }
  return {
    element: messageEl,
    senderEmail: "dupont@example.com",
    senderLastname: "DUPONT",
  };
}

vi.mock("./outlook-actions.js", () => ({
  expandMessage: vi.fn(async () => {
    /* Noop */
  }),
  expandThread: vi.fn(async () => {
    /* Noop */
  }),
  findAttachmentListbox: vi.fn((message: Element): Element | null =>
    message.querySelector('[role="listbox"]'),
  ),
  findLastMessageFromOthers: vi.fn(findMessageInDom),
  findPdfOptions: vi.fn((listbox: Element): Element[] => [
    ...listbox.querySelectorAll('[role="option"]'),
  ]),
}));

vi.mock("./outlook-download.js", () => ({
  downloadAttachment: vi.fn(async () => new Uint8Array([10, 20, 30])),
}));

const { collectPdfAttachments } = await import("./outlook-dom.js");

function renderHappyPathDom(subject: string): void {
  document.body.innerHTML = `
    <div role="main">
      <div role="heading" aria-level="2">${subject}</div>
      <div data-convid="conv-123" aria-selected="true"></div>
      <div data-test-message>
        <div role="listbox">
          <div role="option">invoice-2026.pdf</div>
        </div>
      </div>
    </div>
  `;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("collectPdfAttachments DOM prerequisites", () => {
  test("returns empty when no reading pane exists", async () => {
    // Given: empty document with no [role="main"]
    document.body.innerHTML = "<div>empty</div>";

    // When
    const result = await collectPdfAttachments("test@example.com");

    // Then
    expect(result).toEqual([]);
  });

  test("returns empty when no conversation is selected", async () => {
    // Given
    document.body.innerHTML = `
      <div role="main">
        <div role="heading" aria-level="2">Test Subject</div>
      </div>
    `;

    // When
    const result = await collectPdfAttachments("me@example.com");

    // Then
    expect(result).toEqual([]);
  });
});

describe("collectPdfAttachments happy path", () => {
  test("assembles PdfAttachment from DOM + downloaded bytes", async () => {
    // Given
    renderHappyPathDom("Project update");

    // When
    const result = await collectPdfAttachments("me@example.com");

    // Then
    expect(result).toEqual([
      {
        conversationId: "conv-123",
        pdfBytes: new Uint8Array([10, 20, 30]),
        senderEmail: "dupont@example.com",
        senderLastname: "DUPONT",
        subject: "Project update",
      },
    ]);
  });

  test("strips trailing 'Summarize' from the subject heading", async () => {
    // Given
    renderHappyPathDom("Project updateSummarize");

    // When
    const [attachment] = await collectPdfAttachments("me@example.com");

    // Then
    expect(attachment?.subject).toBe("Project update");
  });

  test("returns empty when the listbox has no PDF options", async () => {
    // Given
    document.body.innerHTML = `
      <div role="main">
        <div role="heading" aria-level="2">Subject</div>
        <div data-convid="conv-42" aria-selected="true"></div>
        <div data-test-message>
          <div role="listbox"></div>
        </div>
      </div>
    `;

    // When
    const result = await collectPdfAttachments("me@example.com");

    // Then
    expect(result).toEqual([]);
  });
});
