export interface MockConfig {
  myEmail?: string;
  replyMessage?: string;
  signatureImage?: { data: string; format: "png" | "jpg"; name: string; uploadedAt: number };
  signaturePosition?: { height: number; width: number; x: number; y: number };
}

interface ChromeMock {
  runtime: {
    onMessage: { addListener: () => void };
    openOptionsPage: () => Promise<void>;
    sendMessage: () => Promise<Record<string, unknown>>;
  };
  storage: {
    local: {
      get: (defaults: Record<string, unknown>) => Promise<Record<string, unknown>>;
      set: (data: Record<string, unknown>) => Promise<void>;
    };
    sync: {
      get: (defaults: Record<string, unknown>) => Promise<Record<string, unknown>>;
      set: (data: Record<string, unknown>) => Promise<void>;
    };
  };
  tabs: {
    query: () => Promise<{ id: number; url: string }[]>;
    sendMessage: () => Promise<Record<string, unknown>>;
  };
}

export function createChromeMock(config: MockConfig = {}): ChromeMock {
  const syncData = {
    myEmail: config.myEmail ?? "test@example.com",
    replyMessage: config.replyMessage ?? "OK pour moi",
    signaturePosition: config.signaturePosition ?? { height: 50, width: 150, x: 100, y: 100 },
  };

  const localData = {
    lastRun: undefined,
    signatureImage: config.signatureImage ?? {
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      format: "png",
      name: "signature.png",
      uploadedAt: Date.now(),
    },
  };

  return {
    runtime: {
      onMessage: {
        addListener: (): void => {
          // No-op mock
        },
      },
      openOptionsPage: (): Promise<void> => Promise.resolve(),
      sendMessage: (): Promise<Record<string, unknown>> => Promise.resolve({}),
    },
    storage: {
      local: {
        get: (defaults: Record<string, unknown>): Promise<Record<string, unknown>> =>
          Promise.resolve({ ...defaults, ...localData }),
        set: (data: Record<string, unknown>): Promise<void> => {
          Object.assign(localData, data);
          return Promise.resolve();
        },
      },
      sync: {
        get: (defaults: Record<string, unknown>): Promise<Record<string, unknown>> =>
          Promise.resolve({ ...defaults, ...syncData }),
        set: (data: Record<string, unknown>): Promise<void> => {
          Object.assign(syncData, data);
          return Promise.resolve();
        },
      },
    },
    tabs: {
      query: (): Promise<{ id: number; url: string }[]> =>
        Promise.resolve([{ id: 1, url: "https://outlook.office365.com/mail/" }]),
      sendMessage: (): Promise<Record<string, unknown>> => Promise.resolve({}),
    },
  };
}
