import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { envSchema } from "./lib/config-schema.js";

const DEFAULT_DIR = join(homedir(), ".ok-pour-moi");
export const BROWSER_DATA_DIR = join(DEFAULT_DIR, "browser");
export const LOGS_DIR = join(DEFAULT_DIR, "logs");

const parsed = envSchema.safeParse(Bun.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  myEmail: env.OPM_MY_EMAIL,
  outlook: {
    folder: env.OPM_OUTLOOK_FOLDER,
  },
  signature: {
    imagePath: env.OPM_SIGNATURE_PATH,
    x: env.OPM_SIGNATURE_X,
    y: env.OPM_SIGNATURE_Y,
    width: env.OPM_SIGNATURE_WIDTH,
    height: env.OPM_SIGNATURE_HEIGHT,
  },
  cc: {
    emails: env.OPM_CC_EMAILS,
    enabled: env.OPM_CC_ENABLED,
  },
  replyMessage: env.OPM_REPLY_MESSAGE,
  browser: {
    headless: env.OPM_HEADLESS ?? false,
  },
} as const;

export type Config = typeof config;

export function ensureBrowserDir() {
  if (!existsSync(BROWSER_DATA_DIR)) {
    mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }
}

export function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}
