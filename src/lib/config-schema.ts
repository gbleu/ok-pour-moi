import { DEFAULT_DIR } from "./paths.js";
import { join } from "node:path";
import { z } from "zod";

export const envSchema = z.object({
  OPM_CC_EMAILS: z
    .string()
    .default("")
    .transform((str) => (str.trim() === "" ? [] : str.split(",").map((email) => email.trim())))
    .pipe(z.array(z.email())),
  OPM_CC_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
  OPM_HEADLESS: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  OPM_MY_EMAIL: z.email(),
  OPM_OUTLOOK_FOLDER: z.string().default("ok pour moi"),
  OPM_REPLY_MESSAGE: z.string().min(1),
  OPM_SIGNATURE_HEIGHT: z.coerce.number(),
  OPM_SIGNATURE_PATH: z.string().default(join(DEFAULT_DIR, "signature.png")),
  OPM_SIGNATURE_WIDTH: z.coerce.number(),
  OPM_SIGNATURE_X: z.coerce.number(),
  OPM_SIGNATURE_Y: z.coerce.number(),
});

export type EnvSchema = z.infer<typeof envSchema>;
