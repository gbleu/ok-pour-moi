# Chrome Web Store Submission Guide

This guide provides step-by-step instructions for publishing OK Pour Moi to the Chrome Web Store in compliance with 2026 Manifest V3 requirements.

## Prerequisites

### 1. Developer Account Setup

1. **Register as a Chrome Web Store Developer**
   - Go to [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole)
   - Pay the one-time $5 registration fee
   - Use a dedicated Google Account (recommended): e.g., `dev.okpourmoi@gmail.com`

2. **Trader vs. Non-Trader Designation**
   - For this free, open-source extension, select **Non-Trader**
   - This designation is required by the European Digital Services Act (DSA)

### 2. Technical Compliance Checklist

✅ **Manifest V3:** Already implemented in `manifest.json`
✅ **Service Worker:** Using event-driven service worker (no persistent background page)
✅ **Permissions:** Using `activeTab` (least privilege principle)
✅ **Chrome Storage:** All state management uses `chrome.storage` API
✅ **No Remote Code:** All code bundled locally (pdf-lib dependency included)
✅ **Icons:** 16x16, 48x48, and 128x128 PNG icons included

## Required Visual Assets

### Icons (Already Created)

Located in `icons/` directory:

- ✅ `icon16.png` - 16×16 pixels
- ✅ `icon48.png` - 48×48 pixels
- ✅ `icon128.png` - 128×128 pixels

### Store Listing Assets

Located in `store-assets/` directory:

#### 1. Store Icon (128×128 px)

- **File:** `store-assets/store-icon-128.png`
- **Dimensions:** Exactly 128×128 pixels
- **Format:** PNG with transparency
- **Guidelines:**
  - Place main icon elements within central 96×96px area
  - Leave 16px transparent padding on all sides
  - Chrome applies circular masks and shadows

#### 2. Screenshots (Required: At least 1, Maximum: 5)

- **Files:** `store-assets/screenshot-*.png`
- **Dimensions:** 1280×800 pixels OR 640×400 pixels (use 1280×800 for best quality)
- **Format:** PNG or JPEG
- **Content Guidelines:**
  - Show actual extension interface (popup, options page, in-use on Outlook)
  - No marketing fluff or text-only images
  - Capture at exact dimensions (use Window Resizer extension)
  - Full bleed - no padding/borders

**Suggested Screenshots:**

1. Extension popup with "Sign PDFs" button
2. Options page showing signature configuration
3. Extension in action on Outlook Web (before/after signing)
4. Success notification after creating draft

#### 3. Small Promotional Tile (Required)

- **File:** `store-assets/promo-small-440x280.png`
- **Dimensions:** Exactly 440×280 pixels
- **Usage:** Appears in search results and category lists
- **Guidelines:**
  - Feature extension name and logo prominently
  - High contrast, readable at small sizes
  - Avoid small text or complex details

#### 4. Marquee Promotional Tile (Optional but Recommended)

- **File:** `store-assets/promo-marquee-1400x560.png`
- **Dimensions:** Exactly 1400×560 pixels
- **Usage:** Large banner for featured listings and store page header
- **Guidelines:**
  - Required for "Editor's Choice" eligibility
  - Use saturated colors
  - Avoid large white/gray areas
  - Consistent branding with icon and screenshots

### Asset Creation Tips

```bash
# View asset creation instructions
bun run store:assets
```

Or use design tools: Figma (recommended), GIMP, Photoshop, Canva.

## Privacy Policy

✅ **Already Created:** `PRIVACY.md`

**Hosting for Chrome Web Store:**

The privacy policy must be accessible via a public URL. Options:

### Option 1: GitHub Pages (Recommended)

```bash
# Enable GitHub Pages in repository settings
# Settings → Pages → Source: Deploy from branch (main)
# Choose folder: / (root)
```

Privacy Policy URL: `https://gbleu.github.io/ok-pour-moi/PRIVACY`

### Option 2: Add to README

Link directly to the GitHub file:
`https://github.com/gbleu/ok-pour-moi/blob/main/PRIVACY.md`

## Building the Distribution Package

### 1. Build the Extension

```bash
bun install
bun run build
```

This creates the `dist/` folder with:

- Compiled JavaScript files
- HTML files
- Icons
- `manifest.json`

### 2. Create Distribution ZIP

```bash
# Create clean package (excluding development files)
cd dist
zip -r ../ok-pour-moi-v1.0.0.zip . -x "*.DS_Store" "*.map"
cd ..
```

**Important:** The `manifest.json` must be at the root of the ZIP file, not in a subfolder.

Verify structure:

```bash
unzip -l ok-pour-moi-v1.0.0.zip | head -20
```

Should show:

```
manifest.json
background/
content/
options/
popup/
icons/
```

### 3. Package Checklist

✅ `manifest.json` at root
✅ All icons included (`icons/*.png`)
✅ No `node_modules/` or `.git/`
✅ No source maps (unless needed for debugging)
✅ No `.DS_Store` or `Thumbs.db`
✅ Compiled JavaScript only (no TypeScript source)

## Chrome Web Store Dashboard Submission

### 1. Upload Package

1. Navigate to [Developer Console](https://chrome.google.com/webstore/devconsole)
2. Click **"New Item"**
3. Upload `ok-pour-moi-v1.0.0.zip`
4. Wait for validation (should be instant if package is correct)

### 2. Store Listing Tab

Fill out the listing information:

**Product Details:**

- **Detailed Description:**

  ```
  OK Pour Moi helps you sign PDF attachments in Microsoft Outlook Web and create reply drafts automatically.

  Features:
  • Sign PDF attachments with your custom signature
  • Automatically create reply drafts with signed PDFs
  • Customize signature position and size
  • Add custom reply messages

  How to Use:
  1. Configure your signature in the extension options
  2. Open a conversation in Outlook Web with PDF attachments
  3. Click the extension icon
  4. Click "Sign PDFs & Create Drafts"

  The extension will download PDFs, sign them with your signature, and create a reply draft with the signed documents attached.

  Privacy & Security:
  • All processing happens locally on your device
  • Your signature never leaves your computer
  • No data collection or tracking
  • Open source: https://github.com/gbleu/ok-pour-moi
  ```

- **Category:** Productivity
- **Language:** English

**Visual Assets:**

- Upload Store Icon (128×128)
- Upload Screenshots (1-5 images)
- Upload Small Promotional Tile (440×280)
- Upload Marquee Tile (1400×560) - optional but recommended

### 3. Privacy Tab

**Data Collection:**
Select: **"Does not collect or transmit user data"**

The extension stores signature images locally using `chrome.storage.local`. Configuration settings (email, reply message, signature position) use `chrome.storage.sync` which syncs across the user's Chrome browsers via their Google account. No data is transmitted to external servers beyond Chrome's built-in sync.

**Privacy Policy URL:**

```
https://gbleu.github.io/ok-pour-moi/PRIVACY
```

or

```
https://github.com/gbleu/ok-pour-moi/blob/main/PRIVACY.md
```

**Permission Justifications:**

For each permission in `manifest.json`, provide clear justification:

1. **`storage`**

   ```
   Used to save the user's signature image locally (chrome.storage.local) and
   sync configuration settings (email, reply message, signature position) across
   the user's Chrome browsers (chrome.storage.sync). No data is transmitted to
   external servers beyond Chrome's built-in sync mechanism.
   ```

2. **`activeTab`**

   ```
   Allows the extension to access the current Outlook Web tab only when the
   user explicitly activates the extension by clicking the toolbar icon. This
   permission does not grant access to browsing history and follows the
   principle of least privilege.
   ```

3. **`scripting`**

   ```
   Required to inject scripts into Outlook Web pages to find PDF attachments,
   download them, and create draft replies. Scripts only run on Microsoft
   Outlook domains when the user activates the extension.
   ```

4. **Host Permissions** (outlook.office365.com, etc.)
   ```
   Required to interact with Microsoft Outlook Web interface and download
   email attachments. Access is limited to Outlook domains only - the
   extension does not request broad access to all websites.
   ```

### 4. Distribution Tab

**Visibility:**

- **Public:** Available to all Chrome users (recommended for open source)
- Or **Unlisted:** Only accessible via direct link (for beta testing)

**Geographic Distribution:**

- Select all countries (unless you have specific restrictions)

**Pricing:**

- Free

### 5. Submit for Review

1. Click **"Submit for Review"**
2. Confirm submission

**Review Timeline:**

- **Standard Review:** 24-72 hours for extensions with `activeTab` and no suspicious permissions
- **Extended Review:** 3-4 weeks for new developer accounts or broad permissions

During review:

- Status will show **"Pending Review"**
- You'll receive email notifications for approval or rejection
- If rejected, you'll get specific reasons and can resubmit after fixes

## Post-Submission

### If Approved

1. Extension will be published to the store
2. You'll receive a confirmation email
3. Store URL will be: `https://chrome.google.com/webstore/detail/[extension-id]`
4. Add the Chrome Web Store badge to `README.md`

### If Rejected

Common rejection reasons and fixes:

**Permission Creep**

- Remove unused permissions from `manifest.json`
- Improve justifications

**Single Purpose Violation**

- Ensure extension focuses on one core feature (PDF signing)
- Remove unrelated functionality

**Broken Functionality**

- Test extension thoroughly in clean Chrome profile
- Provide detailed testing instructions

**Misleading Metadata**

- Ensure description matches functionality
- Verify screenshots show actual UI

**Privacy Violations**

- Verify no data transmission to external servers
- Update privacy policy if needed

## Version Updates

For future updates:

1. Increment version in `manifest.json` (e.g., `1.0.0` → `1.0.1`)
2. Rebuild extension: `bun run build`
3. Create new ZIP package
4. Upload to Developer Console
5. Update "What's New" section with changelog
6. Submit for review

Chrome Web Store enforces **strict monotonic versioning** - each update must have a higher version number.

## Security Best Practices

### Verified Uploads (Optional but Recommended)

1. Generate private key for signing updates
2. Upload public key to Developer Console
3. Sign all future uploads with private key
4. Prevents supply chain attacks via compromised accounts

### Regular Security Audits

- Run CodeQL checks before each release
- Review dependency updates (especially `pdf-lib`)
- Monitor GitHub security advisories

## Resources

- [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Publishing Guidelines](https://developer.chrome.com/docs/webstore/program-policies/)
- [Chrome Extension Samples](https://github.com/GoogleChrome/chrome-extensions-samples)

## Support

For issues with this extension:

- GitHub Issues: https://github.com/gbleu/ok-pour-moi/issues

For Chrome Web Store policy questions:

- Developer Support: https://support.google.com/chrome_webstore/
