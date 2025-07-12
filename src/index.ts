import { runCommand } from "./commands/run.js";

const command = Bun.argv[2];

if (command === "help" || command === "--help" || command === "-h") {
  console.log(`
ok-pour-moi - PDF signing automation for Outlook

Usage: ./opm [run]

Fetches PDFs from configured Outlook folder, signs them,
and prepares reply drafts. No local state - always starts fresh.
`);
  process.exit(0);
}

runCommand().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
