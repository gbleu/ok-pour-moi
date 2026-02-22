# Ok pour moi

Chrome extension for PDF signing in Outlook Web. Downloads PDF attachments, signs them, and creates reply drafts.

## Features

- ✅ **Manifest V3 Compliant** - Ready for Chrome Web Store 2026
- ✅ **Sign PDF Attachments** - Add your signature to PDFs in Outlook Web
- ✅ **Auto-create Reply Drafts** - Automatically create drafts with signed PDFs
- ✅ **Customizable Signature** - Position and size your signature
- ✅ **Privacy-First** - All processing happens locally, no data transmission

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
- **CC recipients** (optional): Comma-separated email addresses

## Usage

1. Open a conversation in Outlook Web with PDF attachments
2. Click the extension icon
3. Click "Sign PDFs & Create Drafts"

The extension will:

1. Find PDF attachments from the latest message
2. Download and sign each PDF
3. Create a reply draft with signed PDFs attached

## Development

```bash
bun run build       # Build to ./dist
bun run lint        # Type-aware linting
bun run fmt         # Format code
bun run test        # Unit tests
bun run test:e2e    # E2E tests
```

## Chrome Web Store Submission

Ready to publish to Chrome Web Store! See [CHROME_STORE_GUIDE.md](./CHROME_STORE_GUIDE.md) for detailed submission instructions.

### Quick Start

1. **Build the extension:**

   ```bash
   bun run build
   ```

2. **Package for submission:**

   ```bash
   bun run package
   ```

   This creates `ok-pour-moi-v1.0.0.zip` ready for upload.

3. **Upload to Chrome Web Store:**
   - Go to [Developer Console](https://chrome.google.com/webstore/devconsole)
   - Upload the ZIP file
   - Follow the [submission guide](./CHROME_STORE_GUIDE.md)

### Compliance Status

- ✅ Manifest V3 implementation
- ✅ Service worker architecture (no persistent background page)
- ✅ Chrome storage API for state management
- ✅ `activeTab` permission (least privilege)
- ✅ No remote code execution
- ✅ Privacy policy included
- ✅ All dependencies bundled locally
- ✅ Icon assets (16x16, 48x48, 128x128)

See [PRIVACY.md](./PRIVACY.md) for our privacy policy.

## Architecture

```
src/
├── content/       # Content scripts (injected into Outlook)
├── background/    # Service worker (PDF signing, storage)
├── popup/         # Extension popup UI
├── options/       # Settings page
└── shared/        # Shared types and utilities
```
