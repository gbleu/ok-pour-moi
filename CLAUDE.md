# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
vp install           # Install dependencies (wraps bun)
vp run build         # Build extension to ./dist
vp run lint          # Lint (type-aware)
vp run fmt           # Format
vp check             # Run fmt + lint + typecheck in one command
vp run test          # Run unit tests
vp run test src/shared/pdf.test.ts  # Run a single test file
vp run test:e2e      # Run e2e tests with Playwright
vp run package       # Package extension
```

## Architecture

Chrome extension (Manifest V3) for PDF signing in Outlook Web. Downloads PDF attachments, signs them, creates reply drafts. Built with Bun, uses `pdf-lib` for PDF manipulation.

### Path Aliases

- `#shared/*` → `src/shared/*`
- `#mocks/*` → `e2e/mocks/*`
- `#helpers/*` → `e2e/helpers/*`

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

### Two-World Content Script Architecture

The extension uses two content scripts injected into Outlook pages:

- **MAIN world** (`main-world.ts`): Runs in the page's JS context to intercept `blob:` URLs via `XMLHttpRequest` monkey-patching. Communicates PDF data to the content script via `window.postMessage`.
- **ISOLATED world** (`content.ts`): Standard content script that orchestrates the workflow, manipulates DOM, and communicates with the service worker via `chrome.runtime`.

The blob protocol (`blob-protocol.ts`) defines the message types exchanged between worlds.

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
