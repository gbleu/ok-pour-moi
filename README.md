# Ok pour moi

Chrome extension for PDF signing in Outlook Web. Downloads PDF attachments, signs them, and creates reply drafts.

## Setup

### 1. Install dependencies and build

```bash
bun install
bun run build
```

### 2. Load extension in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" → select the `dist/` folder

### 3. Configure the extension

Click the extension icon → "Options" to configure:

- **Signature image**: PNG or JPG of your signature
- **Signature position**: X, Y coordinates and dimensions
- **Reply message**: Text for the reply draft
- **CC emails** (optional): Comma-separated addresses

## Usage

1. Open a conversation in Outlook Web with PDF attachments
2. Click the extension icon
3. Click "Run"

The extension will:
1. Find PDF attachments from the latest message
2. Download and sign each PDF
3. Create a reply draft with signed PDFs attached

## Development

```bash
bun run build    # Build to ./dist
bun run lint     # Type-aware linting
bun run fmt      # Format code
bun run test     # Unit tests
bun run test:e2e # E2E tests
```

## Architecture

```
src/
├── content/       # Content scripts (injected into Outlook)
├── background/    # Service worker (PDF signing, storage)
├── popup/         # Extension popup UI
├── options/       # Settings page
└── shared/        # Shared types and utilities
```
