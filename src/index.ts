import { runCommand } from "./commands/run.js";
import { loadConfig } from "./config.js";

const command = Bun.argv[2];

if (command === "help" || command === "--help" || command === "-h") {
  console.log(`
ok-pour-moi - PDF signing automation for Outlook

Usage: ./opm

Fetches PDFs from configured Outlook folder, signs them,
and prepares reply drafts. No local state - always starts fresh.
`);
  process.exit(0);
}

try {
  loadConfig();
} catch (err) {
  console.error("Error:", (err as Error).message);
  process.exit(1);
}

runCommand().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
