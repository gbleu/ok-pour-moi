import type { SignaturePosition } from "./pdf.js";

/** JSON-serialized Uint8Array for Chrome message transport (Uint8Array is not directly serializable) */
type SerializedBytes = number[];

export interface WorkflowConfig {
  myEmail: string;
  replyMessage: string;
  signaturePosition: SignaturePosition;
}

export interface SignPdfRequest {
  originalFilename: string;
  pdfBytes: SerializedBytes;
  senderLastname: string;
}

export type SignPdfResponse =
  | { error: string; success: false }
  | { filename: string; signedPdf: SerializedBytes; success: true };

export interface WorkflowResult {
  message: string;
  success: boolean;
}

export interface ContentToBackgroundMessage {
  payload: SignPdfRequest;
  type: "SIGN_PDF";
}

export interface PopupToContentMessage {
  config: WorkflowConfig;
  type: "START_WORKFLOW";
}
