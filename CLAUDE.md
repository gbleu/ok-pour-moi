# CLAUDE.md

## Commands

```bash
bun install          # Install dependencies
bun run build        # Build extension to ./dist
bun run lint         # Lint (type-aware)
bun run fmt          # Format
bun run test         # Run unit tests
bun run test:e2e     # Run e2e tests with Playwright
bun run package      # Package extension
```

## Architecture

Chrome extension for PDF signing in Outlook Web. Downloads PDF attachments, signs them, creates reply drafts.

```
src/
├── content/           # Content scripts (injected into Outlook)
│   ├── content.ts              # Entry point, message handling
│   ├── outlook-dom.ts          # PDF collection workflow orchestrator
│   ├── outlook-actions.ts      # Outlook DOM operations (messages, attachments, replies)
│   ├── outlook-automation.ts   # DOM interaction helpers (click, type, wait)
│   ├── outlook-compose.ts      # Create draft replies
│   ├── outlook-compose-actions.ts # Draft reply DOM operations
│   ├── outlook-download.ts     # PDF download via blob interception
│   ├── blob-protocol.ts        # Window message types for blob transfer
│   └── main-world.ts           # MAIN world script (blob URL interception)
├── background/        # Service worker
│   └── service-worker.ts   # PDF signing, message routing
├── popup/             # Extension popup UI
├── options/           # Settings page
└── shared/            # Shared types and utilities
    ├── dom.ts         # DOM utility (getElement)
    ├── encoding.ts    # Base64 encoding/decoding
    ├── errors.ts      # Error message extraction
    ├── messages.ts    # Message types
    ├── origins.ts     # Outlook origin constants
    ├── pdf.ts         # PDF signing, name extraction, attachment naming
    ├── sender.ts      # Email/lastname extraction from sender strings
    └── storage.ts     # Chrome storage API wrappers
```

### Workflow

1. User selects conversation in Outlook Web
2. Clicks extension popup → "Sign PDFs & Create Drafts"
3. Content script finds PDF attachments from the last message sent by others
4. Downloads PDF, sends to service worker for signing
5. Creates reply draft with signed PDF attached

### Code Style

- `setTimeout`: In Node scripts, use `import { setTimeout } from "node:timers/promises"` not `new Promise(r => setTimeout(r, ms))`. In browser code (`src/`), use the `sleep` helper from `outlook-automation.ts`
- Encoding: `utf8` not `utf-8` (unicorn/text-encoding-identifier-case)
- Array destructuring: `const [, second] = arr` not `arr[1]` (prefer-destructuring)
- Strict booleans: `!== undefined && !== ""` not truthy checks (strict-boolean-expressions)
- Catch params: `error` not `err` (unicorn/catch-error-name)
- Catch handlers: Must use braces `(error) => { console.error(error); }` (no-confusing-void-expression)
- No empty catch: Always handle or log errors
