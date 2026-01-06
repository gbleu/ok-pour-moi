# Ok pour moi

Chrome extension for signing PDF attachments in Outlook Web. Downloads PDF attachments from email conversations, signs them with your signature, and creates reply drafts with the signed PDFs attached.

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Build the extension

```bash
bun run build
```

This creates the extension in the `./dist` directory.

### 3. Load extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `dist` directory from this project

### 4. Configure extension

1. Click the extension icon in Chrome toolbar
2. Click "Settings" to open the configuration page
3. Fill in required settings:
   - **Your Email Address**: Used to identify your messages in conversations
   - **Reply Message**: Text to include in reply drafts
   - **Signature Image**: Upload your signature (PNG or JPG format)
   - **Signature Position**: Set X/Y position (pixels from left/bottom) and dimensions

## Usage

1. Open Outlook Web (`outlook.office.com`, `outlook.office365.com`, or `outlook.live.com`)
2. Select a conversation containing PDF attachments
3. Click the extension icon in Chrome toolbar
4. Click "Sign PDFs & Create Drafts"

The extension will:
- Find PDF attachments in the latest message of the conversation
- Download and sign each PDF with your signature
- Create a reply draft with the signed PDFs attached
- Include your reply message in the draft

## Development

```bash
bun install          # Install dependencies
bun run build        # Build extension to ./dist
bun run lint         # Lint (type-aware)
bun run fmt          # Format
```

## Architecture

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

```
src/
├── content/           # Content scripts (injected into Outlook)
├── background/        # Service worker (PDF signing, config storage)
├── popup/             # Extension popup UI
├── options/           # Settings page
└── shared/            # Shared types and utilities
```
