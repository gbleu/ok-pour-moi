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

export type SignPdfResponse =
  | { error: string; success: false }
  | { filename: string; signedPdf: number[]; success: true };

export interface WorkflowResult {
  message: string;
  processed: number;
  success: boolean;
}

export interface ContentToBackgroundMessage {
  payload: SignPdfRequest;
  type: "SIGN_PDF";
}

export type PopupToContentMessage =
  | { config: WorkflowConfig; type: "START_WORKFLOW" }
  | { type: "GET_EMAIL_COUNT" };
