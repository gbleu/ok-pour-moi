# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
bun install
bunx playwright install chromium

# Run the tool
bun run start

# Run all tests
bun test

# Run a single test file
bun test src/lib/pdf.test.ts

# Lint (type-aware)
bun run lint

# Format
bun run fmt
```

## Architecture

This is a PDF signing automation tool for Outlook Web. It processes emails from a designated folder, signs attached PDFs, and creates reply drafts.

### Flow

1. `src/index.ts` → loads config, calls `runCommand()`
2. `src/commands/run.ts` → orchestrates the workflow via `runWorkflow()`
3. `src/services/browser.ts` → manages Playwright persistent context, handles Outlook login
4. `src/lib/outlook-dom.ts` → reads emails, downloads attachments, returns `PdfItem[]` with signed PDFs
5. `src/lib/outlook-compose.ts` → creates draft replies with signed PDF attachments
6. `src/lib/outlook-actions.ts` → low-level Outlook DOM interactions (navigation, clicking, typing)

### Key Types

- `PdfItem`: conversation data with signed PDF bytes
- `SignaturePosition`: coordinates for PDF signature placement
- `BrowserSession`: Playwright page wrapper with cleanup

### Config

Environment variables validated via Zod schema (`src/lib/config-schema.ts`). Config is lazy-loaded and cached as a singleton via proxy (`src/config.ts`).

User data stored in `~/.ok-pour-moi/`:

- `signature.png` - signature image
- `browser/` - Playwright persistent session
- `logs/` - error screenshots

### Testing

Integration tests use a mock Outlook HTML fixture in `src/__test__/fixtures/`. Browser context is shared across tests via `setupBrowser()` helper from `src/__test__/test-helper.ts`.

## Import Sorting Rules (oxlint)

The `sort-imports` rule enforces this order:

1. **Multi-specifier imports first** (2+ members), sorted by first member name
2. **Single-specifier imports second** (1 member), sorted by first member name

Sorting is by **first imported member name** (case-sensitive ASCII: uppercase before lowercase), NOT by module path.

```typescript
// Correct order:
import { FIXTURES_DIR, setupBrowser } from "./test-helper.js";    // F < a
import { addCcRecipients, closeCompose } from "./actions.js";     // a < d
import { describe, expect, test } from "bun:test";                // d

import type { Page } from "playwright";     // P < c (single-specifier)
import { collectPdfs } from "./dom.js";     // c < g
import { getFormat } from "./pdf.js";       // g
```

Empty catch handlers must have a comment: `.catch(() => { /* Ignore */ })`
