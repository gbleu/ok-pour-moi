export interface BlobRequestMessage {
  id: string;
  type: "OPM_GET_BLOB";
  url: string;
}

export interface BlobCapturedMessage {
  type: "OPM_BLOB_CAPTURED";
  url: string;
}

export type BlobResultMessage =
  | { data: Uint8Array; id: string; type: "OPM_BLOB_RESULT" }
  | { error: string; id: string; type: "OPM_BLOB_RESULT" };
