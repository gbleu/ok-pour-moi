export interface BlobRequestMessage {
  readonly id: string;
  readonly type: "OPM_GET_BLOB";
  readonly url: string;
}

export interface BlobCapturedMessage {
  readonly type: "OPM_BLOB_CAPTURED";
  readonly url: string;
}

export type BlobResultMessage =
  | { readonly data: Uint8Array; readonly id: string; readonly type: "OPM_BLOB_RESULT" }
  | { readonly error: string; readonly id: string; readonly type: "OPM_BLOB_RESULT" };
