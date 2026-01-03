# Ok pour moi

PDF signing automation for Outlook. Fetches PDFs from a specified folder, signs them, and prepares draft replies with the signed PDFs attached.

## Setup

### 1. Install dependencies

```bash
bun install
bunx playwright install chromium
```

### 2. Create config directory

```bash
mkdir -p ~/.ok-pour-moi
```

### 3. Add your signature image

```bash
cp /path/to/your/signature.png ~/.ok-pour-moi/signature.png
```

Supported formats: `.png`, `.jpg`, `.jpeg`

### 4. Create Outlook folder

In Outlook web, create a folder named `ok pour moi` (or customize via `OPM_OUTLOOK_FOLDER` in `.env`).

### 5. Create Quick Step (optional)

To quickly move emails to the folder:

1. In Outlook toolbar, click the `ok pour moi` dropdown next to "Move to"
2. Click "Create new Quick Step"
3. Name it `ok pour moi`, choose action "Move to folder" → select your folder
4. Now you can move emails with one click from the toolbar

### 6. Create config file

```bash
cp .env.example .env
```

Edit `.env` with your settings.

**Required variables:**

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `OPM_MY_EMAIL`         | Your email address (to identify your messages)    |
| `OPM_SIGNATURE_X`      | Signature X position on page (pixels from left)   |
| `OPM_SIGNATURE_Y`      | Signature Y position on page (pixels from bottom) |
| `OPM_SIGNATURE_WIDTH`  | Signature width in pixels                         |
| `OPM_SIGNATURE_HEIGHT` | Signature height in pixels                        |
| `OPM_REPLY_MESSAGE`    | Message text for the reply                        |

**Optional variables:**

| Variable             | Default                        | Description                        |
| -------------------- | ------------------------------ | ---------------------------------- |
| `OPM_OUTLOOK_FOLDER` | `ok pour moi`                  | Outlook folder to process          |
| `OPM_SIGNATURE_PATH` | `~/.ok-pour-moi/signature.png` | Path to signature image            |
| `OPM_CC_EMAILS`      | (empty)                        | Comma-separated CC email addresses |
| `OPM_CC_ENABLED`     | `false`                        | Enable CC recipients               |
| `OPM_HEADLESS`       | (unset)                        | Run browser in headless mode       |

## Usage

1. Move emails with PDFs to sign into your `ok pour moi` folder (use Quick Step)
2. Run via Spotlight: `Cmd+Space` → type `ok pour moi` → Enter
   Or from terminal: `bun src/index.ts`

On first run, a browser window opens for Outlook login. Session is saved in `~/.ok-pour-moi/browser/`.

## Directory structure

```
~/.ok-pour-moi/
├── signature.png   # Signature image
├── browser/        # Browser session data
└── logs/           # Error screenshots
```
