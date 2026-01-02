import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const DEFAULT_DIR = join(homedir(), ".ok-pour-moi");

export const envSchema = z.object({
  OPM_MY_EMAIL: z.email(),
  OPM_OUTLOOK_FOLDER: z.string().default("ok pour moi"),
  OPM_SIGNATURE_PATH: z.string().default(join(DEFAULT_DIR, "signature.png")),
  OPM_SIGNATURE_X: z.coerce.number(),
  OPM_SIGNATURE_Y: z.coerce.number(),
  OPM_SIGNATURE_WIDTH: z.coerce.number(),
  OPM_SIGNATURE_HEIGHT: z.coerce.number(),
  OPM_CC_EMAILS: z
    .string()
    .transform((s) => (s.trim() === "" ? [] : s.split(",").map((e) => e.trim())))
    .pipe(z.array(z.email())),
  OPM_CC_ENABLED: z.enum(["true", "false"]).transform((v) => v === "true"),
  OPM_REPLY_MESSAGE: z.string().min(1),
  OPM_HEADLESS: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type EnvSchema = z.infer<typeof envSchema>;
