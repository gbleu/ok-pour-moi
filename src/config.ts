import { BROWSER_DATA_DIR, LOGS_DIR } from "./lib/paths.js";
import { type EnvSchema, envSchema } from "./lib/config-schema.js";
import { existsSync, mkdirSync } from "node:fs";

export { BROWSER_DATA_DIR, LOGS_DIR };

interface Config {
  myEmail: string;
  outlook: { folder: string };
  signature: { imagePath: string; x: number; y: number; width: number; height: number };
  cc: { emails: string[]; enabled: boolean };
  replyMessage: string;
  browser: { headless: boolean };
}

let _config: Config | undefined;

export function _resetConfigForTesting(): void {
  _config = undefined;
}

function buildConfig(env: EnvSchema): Config {
  return {
    browser: { headless: env.OPM_HEADLESS ?? false },
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
}

export function loadConfig(): Config {
  if (_config) {
    return _config;
  }

  const parsed = envSchema.safeParse(Bun.env);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${messages.join("\n")}`);
  }

  _config = buildConfig(parsed.data);
  return _config;
}

// oxlint-disable-next-line no-unsafe-type-assertion
export const config = new Proxy({} as Record<string, unknown>, {
  get(_, prop: keyof Config): Config[keyof Config] {
    return loadConfig()[prop];
  },
}) as unknown as Config;

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
