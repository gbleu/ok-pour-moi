/* eslint-disable unicorn/no-null -- Chrome storage API uses null */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

function createStorageMock(): unknown {
  const syncData: Record<string, unknown> = {
    myEmail: "test@example.com",
    replyMessage: "OK pour moi",
    signaturePosition: { height: 50, width: 150, x: 100, y: 100 },
  };

  const localData: Record<string, unknown> = {
    lastRun: null,
    signatureImage: { data: "base64data", format: "png", name: "sig.png", uploadedAt: 1 },
  };

  return {
    storage: {
      local: {
        get: (defaults: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> =>
          Promise.resolve({ ...defaults, ...localData }),
        set: (data: Readonly<Record<string, unknown>>): Promise<void> => {
          Object.assign(localData, data);
          return Promise.resolve();
        },
      },
      sync: {
        get: (defaults: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> =>
          Promise.resolve({ ...defaults, ...syncData }),
        set: (data: Readonly<Record<string, unknown>>): Promise<void> => {
          Object.assign(syncData, data);
          return Promise.resolve();
        },
      },
    },
  };
}

describe("storage wrappers", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Test mock setup
    (globalThis as { chrome: unknown }).chrome = createStorageMock();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Test cleanup
    delete (globalThis as Record<string, unknown>).chrome;
  });

  test("getSyncStorage returns typed defaults merged with stored values", async () => {
    // Given: chrome mock with configured email
    const { getSyncStorage } = await import("./storage.js");

    // When
    const result = await getSyncStorage();

    // Then: returns merged defaults + stored values
    expect(result).toEqual({
      myEmail: "test@example.com",
      replyMessage: "OK pour moi",
      signaturePosition: { height: 50, width: 150, x: 100, y: 100 },
    });
  });

  test("setSyncStorage writes partial data", async () => {
    // Given
    const { getSyncStorage, setSyncStorage } = await import("./storage.js");

    // When
    await setSyncStorage({ myEmail: "new@example.com" });
    const result = await getSyncStorage();

    // Then: email updated, other fields preserved
    expect(result.myEmail).toBe("new@example.com");
    expect(result.replyMessage).toBe("OK pour moi");
  });

  test("getLocalStorage returns signature image and null lastRun", async () => {
    // Given
    const { getLocalStorage } = await import("./storage.js");

    // When
    const result = await getLocalStorage();

    // Then
    expect(result.signatureImage).not.toBeNull();
    expect(result.signatureImage?.format).toBe("png");
  });

  test("setLocalStorage persists data", async () => {
    // Given
    const { getLocalStorage, setLocalStorage } = await import("./storage.js");

    // When
    await setLocalStorage({ lastRun: { emailsProcessed: 1, success: true, timestamp: 123 } });
    const result = await getLocalStorage();

    // Then
    expect(result.lastRun).toEqual({ emailsProcessed: 1, success: true, timestamp: 123 });
  });
});
