# CLAUDE.md

## Commands

```bash
bun install          # Install dependencies
bun run build        # Build extension to ./dist
bun run lint         # Lint (type-aware)
bun run fmt          # Format
```

## Architecture

Chrome extension for PDF signing in Outlook Web. Downloads PDF attachments, signs them, creates reply drafts.

```
src/
├── content/           # Content scripts (injected into Outlook)
│   ├── outlook-actions.ts  # DOM interactions (click, type, download)
│   ├── outlook-compose.ts  # Create draft replies
│   ├── outlook-dom.ts      # Find messages, attachments, sign PDFs
│   ├── dom-utils.ts        # Low-level DOM utilities
│   └── content.ts          # Entry point, message handling
├── background/        # Service worker
│   └── service-worker.ts   # PDF signing, config storage
├── popup/             # Extension popup UI
├── options/           # Settings page
└── shared/            # Shared types and utilities
    ├── pdf.ts         # PDF signing with pdf-lib
    ├── storage.ts     # Chrome storage API wrappers
    └── messages.ts    # Message types
```

### Workflow

1. User selects conversation in Outlook Web
2. Clicks extension popup → "Run"
3. Content script finds PDF attachments from latest message
4. Downloads PDF, sends to service worker for signing
5. Creates reply draft with signed PDF attached

## Import Sorting (oxlint)

1. Multi-specifier imports first (2+ members), sorted by first member
2. Single-specifier imports second, sorted by first member

Sorting by first imported member name (case-sensitive ASCII), not module path.
