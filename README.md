# Ok pour moi

PDF signing automation for Outlook. Fetches PDFs from a specified folder, signs them, and sends them back as replies.

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

## Usage

1. Move emails with PDFs to sign into your `ok pour moi` folder (use Quick Step)
2. Run via Spotlight: `Cmd+Space` → type `ok pour moi` → Enter
   Or from terminal: `bun "ok pour moi"`

On first run, a browser window opens for Outlook login. Session is saved in `~/.ok-pour-moi/browser/`.

## Directory structure

```
~/.ok-pour-moi/
├── signature.png   # Signature image
├── browser/        # Browser session data
└── logs/
```
