import type { SignatureFormat, SignaturePosition } from "./pdf.js";

export interface SyncStorage {
  ccEmails: string[];
  ccEnabled: boolean;
  myEmail: string;
  outlookFolder: string;
  replyMessage: string;
  signaturePosition: SignaturePosition;
}

export interface LocalStorage {
  lastRun: {
    emailsProcessed: number;
    success: boolean;
    timestamp: number;
  } | null;
  signatureImage: {
    data: string;
    format: SignatureFormat;
    name: string;
    uploadedAt: number;
  } | null;
}

export const DEFAULT_SYNC_STORAGE: SyncStorage = {
  ccEmails: [],
  ccEnabled: false,
  myEmail: "",
  outlookFolder: "ok pour moi",
  replyMessage: "",
  signaturePosition: { height: 50, width: 150, x: 100, y: 100 },
};

export async function getSyncStorage(): Promise<SyncStorage> {
  const result = await chrome.storage.sync.get(DEFAULT_SYNC_STORAGE);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Chrome storage API returns unknown
  return result as SyncStorage;
}

export async function setSyncStorage(data: Partial<SyncStorage>): Promise<void> {
  await chrome.storage.sync.set(data);
}

export async function getLocalStorage(): Promise<LocalStorage> {
  // eslint-disable-next-line unicorn/no-null -- Chrome storage API requires null
  const result = await chrome.storage.local.get({ lastRun: null, signatureImage: null });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Chrome storage API returns unknown
  return result as LocalStorage;
}

export async function setLocalStorage(data: Partial<LocalStorage>): Promise<void> {
  await chrome.storage.local.set(data);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let idx = 0; idx < binaryString.length; idx += 1) {
    bytes[idx] = binaryString.codePointAt(idx) ?? 0;
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
}
