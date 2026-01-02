import { existsSync, mkdirSync } from "node:fs";
import { envSchema, type EnvSchema } from "./lib/config-schema.js";
import { BROWSER_DATA_DIR, LOGS_DIR } from "./lib/paths.js";

export { BROWSER_DATA_DIR, LOGS_DIR };

type Config = {
  myEmail: string;
  outlook: { folder: string };
  signature: { imagePath: string; x: number; y: number; width: number; height: number };
  cc: { emails: string[]; enabled: boolean };
  replyMessage: string;
  browser: { headless: boolean };
};

let _config: Config | null = null;

function buildConfig(env: EnvSchema): Config {
  return {
    myEmail: env.OPM_MY_EMAIL,
    outlook: { folder: env.OPM_OUTLOOK_FOLDER },
    signature: {
      imagePath: env.OPM_SIGNATURE_PATH,
      x: env.OPM_SIGNATURE_X,
      y: env.OPM_SIGNATURE_Y,
      width: env.OPM_SIGNATURE_WIDTH,
      height: env.OPM_SIGNATURE_HEIGHT,
    },
    cc: { emails: env.OPM_CC_EMAILS, enabled: env.OPM_CC_ENABLED },
    replyMessage: env.OPM_REPLY_MESSAGE,
    browser: { headless: env.OPM_HEADLESS ?? false },
  };
}

export function loadConfig(): Config {
  if (_config) return _config;

  const parsed = envSchema.safeParse(Bun.env);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${messages.join("\n")}`);
  }

  _config = buildConfig(parsed.data);
  return _config;
}

export const config: Config = new Proxy({} as Config, {
  get(_, prop: keyof Config) {
    const cfg = loadConfig();
    return cfg[prop];
  },
});

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
