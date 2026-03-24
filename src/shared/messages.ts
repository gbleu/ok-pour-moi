import type { SignaturePosition } from "./pdf.js";

/** JSON-serialized Uint8Array for Chrome message transport (Uint8Array is not directly serializable) */
type SerializedBytes = readonly number[];

export interface WorkflowConfig {
  readonly myEmail: string;
  readonly replyMessage: string;
  readonly signaturePosition: SignaturePosition;
}

export interface SignPdfRequest {
  readonly originalFilename: string;
  readonly pdfBytes: SerializedBytes;
  readonly senderLastname: string;
}

export type SignPdfResponse =
  | { readonly error: string; readonly success: false }
  | { readonly filename: string; readonly signedPdf: SerializedBytes; readonly success: true };

export interface WorkflowResult {
  readonly message: string;
  readonly success: boolean;
}

export interface ContentToBackgroundMessage {
  readonly payload: SignPdfRequest;
  readonly type: "SIGN_PDF";
}

export interface PopupToContentMessage {
  readonly config: WorkflowConfig;
  readonly type: "START_WORKFLOW";
}
