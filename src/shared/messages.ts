import type { SignatureFormat, SignaturePosition } from "./pdf.js";

export interface WorkflowConfig {
  myEmail: string;
  replyMessage: string;
  signaturePosition: SignaturePosition;
}

export interface WorkflowProgress {
  current: number;
  currentSubject: string;
  phase: "collecting" | "signing" | "drafting";
  total: number;
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
  | { type: "GET_SIGNATURE" }
  | { payload: { url: string }; type: "FETCH_ATTACHMENT" }
  | { type: "START_DOWNLOAD_CAPTURE" }
  | { type: "STOP_DOWNLOAD_CAPTURE" }
  | { type: "GET_CAPTURED_DOWNLOAD" };

export type PopupToContentMessage =
  | { config: WorkflowConfig; type: "START_WORKFLOW" }
  | { type: "GET_EMAIL_COUNT" }
  | { type: "CANCEL_WORKFLOW" };

export type BackgroundResponse<TData> =
  | { data: TData; success: true }
  | { error: string; success: false };

export interface SignatureData {
  data: string;
  format: SignatureFormat;
  name: string;
}
