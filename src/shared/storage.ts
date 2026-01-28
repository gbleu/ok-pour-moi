import type { SignatureFormat, SignaturePosition } from "./pdf.js";

interface SyncStorage {
  [key: string]: unknown;
  myEmail: string;
  replyMessage: string;
  signaturePosition: SignaturePosition;
}

interface LocalStorage {
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

const DEFAULT_SYNC_STORAGE: SyncStorage = {
  myEmail: "",
  replyMessage: "",
  signaturePosition: { height: 50, width: 150, x: 100, y: 100 },
};

export async function getSyncStorage(): Promise<SyncStorage> {
  const result = await chrome.storage.sync.get(DEFAULT_SYNC_STORAGE);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Chrome storage API returns unknown
  return result as unknown as SyncStorage;
}

export async function setSyncStorage(data: Partial<SyncStorage>): Promise<void> {
  await chrome.storage.sync.set(data);
}

export async function getLocalStorage(): Promise<LocalStorage> {
  // eslint-disable-next-line unicorn/no-null -- Chrome storage API requires null
  const result = await chrome.storage.local.get({ lastRun: null, signatureImage: null });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Chrome storage API returns unknown
  return result as unknown as LocalStorage;
}

export async function setLocalStorage(data: Partial<LocalStorage>): Promise<void> {
  await chrome.storage.local.set(data);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  return Uint8Array.from(binaryString, (char) => char.codePointAt(0) ?? 0);
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCodePoint(...bytes));
}
