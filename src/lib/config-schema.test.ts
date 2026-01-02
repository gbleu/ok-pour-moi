import { describe, expect, test } from "bun:test";
import { envSchema } from "./config-schema";

const validEnv = {
  OPM_MY_EMAIL: "test@example.com",
  OPM_SIGNATURE_X: "100",
  OPM_SIGNATURE_Y: "200",
  OPM_SIGNATURE_WIDTH: "150",
  OPM_SIGNATURE_HEIGHT: "50",
  OPM_CC_EMAILS: "",
  OPM_CC_ENABLED: "false",
  OPM_REPLY_MESSAGE: "OK pour moi",
};

describe("envSchema", () => {
  test("parses valid environment", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  test("rejects invalid email", () => {
    const result = envSchema.safeParse({ ...validEnv, OPM_MY_EMAIL: "invalid" });
    expect(result.success).toBe(false);
  });

  test("transforms CC_EMAILS to array", () => {
    const result = envSchema.parse({
      ...validEnv,
      OPM_CC_EMAILS: "a@b.com, c@d.com",
    });
    expect(result.OPM_CC_EMAILS).toEqual(["a@b.com", "c@d.com"]);
  });

  test("transforms empty CC_EMAILS to empty array", () => {
    const result = envSchema.parse(validEnv);
    expect(result.OPM_CC_EMAILS).toEqual([]);
  });

  test("coerces numeric strings", () => {
    const result = envSchema.parse(validEnv);
    expect(result.OPM_SIGNATURE_X).toBe(100);
  });

  test("transforms CC_ENABLED boolean", () => {
    const result = envSchema.parse({ ...validEnv, OPM_CC_ENABLED: "true" });
    expect(result.OPM_CC_ENABLED).toBe(true);
  });

  test("uses default values when optional fields missing", () => {
    const minimal = {
      OPM_MY_EMAIL: "test@example.com",
      OPM_SIGNATURE_X: "100",
      OPM_SIGNATURE_Y: "200",
      OPM_SIGNATURE_WIDTH: "150",
      OPM_SIGNATURE_HEIGHT: "50",
      OPM_REPLY_MESSAGE: "OK",
    };
    const result = envSchema.parse(minimal);
    expect(result.OPM_OUTLOOK_FOLDER).toBe("ok pour moi");
    expect(result.OPM_CC_ENABLED).toBe(false);
    expect(result.OPM_CC_EMAILS).toEqual([]);
  });

  test("rejects missing required email", () => {
    const noEmail = { ...validEnv };
    delete (noEmail as any).OPM_MY_EMAIL;
    const result = envSchema.safeParse(noEmail);
    expect(result.success).toBe(false);
  });

  test("rejects missing required reply message", () => {
    const noReply = { ...validEnv };
    delete (noReply as any).OPM_REPLY_MESSAGE;
    const result = envSchema.safeParse(noReply);
    expect(result.success).toBe(false);
  });

  test("coerces all signature position values", () => {
    const result = envSchema.parse(validEnv);
    expect(typeof result.OPM_SIGNATURE_X).toBe("number");
    expect(typeof result.OPM_SIGNATURE_Y).toBe("number");
    expect(typeof result.OPM_SIGNATURE_WIDTH).toBe("number");
    expect(typeof result.OPM_SIGNATURE_HEIGHT).toBe("number");
  });

  test("handles CC_EMAILS with extra spaces", () => {
    const result = envSchema.parse({
      ...validEnv,
      OPM_CC_EMAILS: "  a@b.com  ,  c@d.com  ",
    });
    expect(result.OPM_CC_EMAILS).toEqual(["a@b.com", "c@d.com"]);
  });

  test("handles single CC email", () => {
    const result = envSchema.parse({
      ...validEnv,
      OPM_CC_EMAILS: "single@email.com",
    });
    expect(result.OPM_CC_EMAILS).toEqual(["single@email.com"]);
  });

  test("handles OPM_HEADLESS optional boolean", () => {
    const withHeadless = { ...validEnv, OPM_HEADLESS: "true" };
    const result = envSchema.parse(withHeadless);
    expect(result.OPM_HEADLESS).toBe(true);
  });

  test("accepts custom outlook folder name", () => {
    const result = envSchema.parse({
      ...validEnv,
      OPM_OUTLOOK_FOLDER: "My Custom Folder",
    });
    expect(result.OPM_OUTLOOK_FOLDER).toBe("My Custom Folder");
  });
});
