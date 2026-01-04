import { BROWSER_DATA_DIR, LOGS_DIR } from "./lib/paths.js";
import { existsSync, mkdirSync } from "node:fs";

import { envSchema } from "./lib/config-schema.js";

export { BROWSER_DATA_DIR, LOGS_DIR };

const parsed = envSchema.safeParse(Bun.env);
if (!parsed.success) {
  const messages = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
  throw new Error(`Invalid environment configuration:\n${messages.join("\n")}`);
}

const env = parsed.data;

export const config = {
  browser: { headless: env.OPM_HEADLESS ?? false, useChrome: env.OPM_USE_CHROME },
  cc: { emails: env.OPM_CC_EMAILS, enabled: env.OPM_CC_ENABLED },
  myEmail: env.OPM_MY_EMAIL,
  outlook: { folder: env.OPM_OUTLOOK_FOLDER },
  replyMessage: env.OPM_REPLY_MESSAGE,
  signature: {
    height: env.OPM_SIGNATURE_HEIGHT,
    imagePath: env.OPM_SIGNATURE_PATH,
    width: env.OPM_SIGNATURE_WIDTH,
    x: env.OPM_SIGNATURE_X,
    y: env.OPM_SIGNATURE_Y,
  },
};

export function ensureBrowserDir(): void {
  if (!existsSync(BROWSER_DATA_DIR)) {
    mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }
}

export function ensureLogsDir(): void {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}
