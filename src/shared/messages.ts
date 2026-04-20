/** JSON-serialized Uint8Array for Chrome message transport (Uint8Array is not directly serializable) */
type SerializedBytes = readonly number[];

export interface WorkflowConfig {
  readonly myEmail: string;
  readonly replyMessage: string;
}

export interface SignPdfRequest {
  readonly pdfBytes: SerializedBytes;
  readonly senderLastname: string;
}

export type SignPdfResponse =
  | { readonly error: string; readonly success: false }
  | { readonly filename: string; readonly signedPdf: SerializedBytes; readonly success: true };

export interface DraftError {
  readonly index: number;
  readonly message: string;
}

export type WorkflowResult =
  | {
      readonly kind: "processed";
      readonly success: true;
      readonly successCount: number;
      readonly totalCount: number;
    }
  | {
      readonly kind: "partial-failure";
      readonly success: false;
      readonly successCount: number;
      readonly totalCount: number;
      readonly draftErrors: readonly DraftError[];
    }
  | { readonly kind: "workflow-error"; readonly success: false; readonly error: string };

export interface ContentToBackgroundMessage {
  readonly payload: SignPdfRequest;
  readonly type: "SIGN_PDF";
}

export interface PopupToContentMessage {
  readonly config: WorkflowConfig;
  readonly type: "START_WORKFLOW";
}
