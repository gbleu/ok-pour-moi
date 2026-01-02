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
});
