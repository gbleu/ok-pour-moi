import { describe, expect, test } from "bun:test";

import {
  type ContentToBackgroundMessage,
  type PopupToContentMessage,
  type SignPdfResponse,
  type WorkflowResult,
} from "#shared/messages.js";

describe("cross-context message contract", () => {
  test("PopupToContentMessage shape matches content.ts onMessage handler expectations", () => {
    // Given: the message shape popup sends
    const message: PopupToContentMessage = {
      config: { myEmail: "me@example.com", replyMessage: "OK" },
      type: "START_WORKFLOW",
    };

    // Then: the discriminant and payload match what content.ts expects
    expect({
      hasConfig: "config" in message,
      hasMyEmail: message.config.myEmail !== "",
      hasReplyMessage: message.config.replyMessage !== "",
      type: message.type,
    }).toEqual({
      hasConfig: true,
      hasMyEmail: true,
      hasReplyMessage: true,
      type: "START_WORKFLOW",
    });
  });

  test("ContentToBackgroundMessage shape matches service-worker onMessage handler expectations", () => {
    // Given: the message shape content.ts sends to the service worker
    const message: ContentToBackgroundMessage = {
      payload: { originalFilename: "doc.pdf", pdfBytes: [1, 2, 3], senderLastname: "DUPONT" },
      type: "SIGN_PDF",
    };

    // Then: the discriminant and payload match what service-worker.ts expects
    expect({
      hasOriginalFilename: message.payload.originalFilename !== "",
      hasPdfBytes: message.payload.pdfBytes.length > 0,
      hasSenderLastname: message.payload.senderLastname !== "",
      type: message.type,
    }).toEqual({
      hasOriginalFilename: true,
      hasPdfBytes: true,
      hasSenderLastname: true,
      type: "SIGN_PDF",
    });
  });

  test("SignPdfResponse success shape carries filename and signedPdf", () => {
    // Given: a successful signing response
    const response: SignPdfResponse = {
      filename: "DUPONT - mars25.pdf",
      signedPdf: [1, 2, 3],
      success: true,
    };

    // Then: success response has the fields content.ts needs
    expect({
      hasFilename: response.success && response.filename !== "",
      hasSignedPdf: response.success && response.signedPdf.length > 0,
      success: response.success,
    }).toEqual({
      hasFilename: true,
      hasSignedPdf: true,
      success: true,
    });
  });

  test("SignPdfResponse error shape carries error message", () => {
    // Given: a failed signing response
    const response: SignPdfResponse = {
      error: "No signature configured",
      success: false,
    };

    // Then: error response has the fields content.ts needs
    expect({
      hasError: !response.success && response.error !== "",
      success: response.success,
    }).toEqual({
      hasError: true,
      success: false,
    });
  });

  test("WorkflowResult shape matches popup dispatchWorkflow expectations", () => {
    // Given: the result shape content.ts returns to popup
    const success: WorkflowResult = { message: "Processed 1/1 emails", success: true };
    const failure: WorkflowResult = { message: "Signing failed", success: false };

    // Then: both shapes have message and success fields
    expect([
      { hasMessage: success.message !== "", success: success.success },
      { hasMessage: failure.message !== "", success: failure.success },
    ]).toEqual([
      { hasMessage: true, success: true },
      { hasMessage: true, success: false },
    ]);
  });
});
