import { type SignatureFormat, type SignaturePosition } from "./pdf.js";

export interface SyncStorage {
  readonly myEmail: string;
  readonly replyMessage: string;
  readonly signaturePosition: SignaturePosition;
}

export interface LocalStorage {
  readonly lastRun: {
    readonly emailsProcessed: number;
    readonly success: boolean;
    readonly timestamp: number;
  } | null;
  readonly signatureImage: {
    readonly data: string;
    readonly format: SignatureFormat;
    readonly name: string;
    readonly uploadedAt: number;
  } | null;
}

const DEFAULT_SYNC_STORAGE: SyncStorage = {
  myEmail: "",
  replyMessage: "",
  signaturePosition: { height: 50, width: 150, x: 100, y: 100 },
};

export async function getSyncStorage(): Promise<SyncStorage> {
  const defaults: Record<string, unknown> = { ...DEFAULT_SYNC_STORAGE };
  const result = await chrome.storage.sync.get(defaults);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Chrome storage API returns unknown
  return result as unknown as SyncStorage;
}

export async function setSyncStorage(data: Readonly<Partial<SyncStorage>>): Promise<void> {
  await chrome.storage.sync.set(data as Record<string, unknown>);
}

export async function getLocalStorage(): Promise<LocalStorage> {
  // eslint-disable-next-line unicorn/no-null -- Chrome storage API requires null
  const result = await chrome.storage.local.get({ lastRun: null, signatureImage: null });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Chrome storage API returns unknown
  return result as unknown as LocalStorage;
}

export async function setLocalStorage(data: Readonly<Partial<LocalStorage>>): Promise<void> {
  await chrome.storage.local.set(data);
}
