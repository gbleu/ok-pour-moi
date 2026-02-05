import type { SignaturePosition } from "./pdf.js";

export interface WorkflowConfig {
  myEmail: string;
  replyMessage: string;
  signaturePosition: SignaturePosition;
}

export interface SignPdfRequest {
  originalFilename: string;
  pdfBytes: number[];
  senderLastname: string;
}

export interface SignPdfResponse {
  error?: string;
  filename?: string;
  signedPdf?: number[];
  success: boolean;
}

export interface WorkflowResult {
  message: string;
  processed: number;
  success: boolean;
}

export type ContentToBackgroundMessage =
  | { payload: SignPdfRequest; type: "SIGN_PDF" }
  | { type: "GET_CONFIG" }
  | { type: "GET_SIGNATURE" };

export type PopupToContentMessage =
  | { config: WorkflowConfig; type: "START_WORKFLOW" }
  | { type: "GET_EMAIL_COUNT" }
  | { type: "CANCEL_WORKFLOW" };
