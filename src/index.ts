import { formatError } from "./lib/error.js";
import { runCommand } from "./commands/run.js";

const command = Bun.argv.at(2);

if (command === "help" || command === "--help" || command === "-h") {
  console.log(`
ok-pour-moi - PDF signing automation for Outlook

Usage: bun run start

Fetches PDFs from configured Outlook folder, signs them,
and prepares reply drafts. No local state - always starts fresh.
`);
} else {
  try {
    await runCommand();
  } catch (error: unknown) {
    console.error("Error:", formatError(error));
    process.exitCode = 1;
  }
}
