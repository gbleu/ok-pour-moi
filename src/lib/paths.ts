import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_DIR = join(homedir(), ".ok-pour-moi");
export const BROWSER_DATA_DIR = join(DEFAULT_DIR, "browser");
export const LOGS_DIR = join(DEFAULT_DIR, "logs");
