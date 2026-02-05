# Store Assets Directory

This directory contains visual assets required for Chrome Web Store submission.

## Required Assets

### ✅ Icons (Already Created in /icons/)

- `icon16.png` - 16×16 pixels
- `icon48.png` - 48×48 pixels
- `icon128.png` - 128×128 pixels

### 📋 Store Listing Assets (To Be Created)

#### 1. Store Icon

- **File:** `store-icon-128.png`
- **Dimensions:** 128×128 pixels
- **Notes:** Same as extension icon with 16px transparent padding

#### 2. Screenshots (1-5 required)

- **Files:** `screenshot-1.png`, `screenshot-2.png`, etc.
- **Dimensions:** 1280×800 pixels (recommended) or 640×400 pixels
- **Content Ideas:**
  1. Extension popup showing "Sign PDFs & Create Drafts" button
  2. Options page with signature configuration
  3. Extension in action on Outlook Web
  4. Success state after creating draft

#### 3. Small Promotional Tile

- **File:** `promo-small-440x280.png`
- **Dimensions:** 440×280 pixels
- **Purpose:** Search results and category listings

#### 4. Marquee Promotional Tile (Optional but Recommended)

- **File:** `promo-marquee-1400x560.png`
- **Dimensions:** 1400×560 pixels
- **Purpose:** Featured listings and editor's choice eligibility

## Creating Assets

### Manual Creation

Use design tools like:

- Figma (recommended for web design)
- GIMP (free, open-source)
- Photoshop
- Canva (quick templates)

### Automated Creation (Optional)

View asset creation instructions:

```bash
bun run store:assets
```

## Asset Guidelines

### Store Icon

- PNG with transparency
- Main graphical element within central 96×96px area
- 16px transparent padding on all sides
- Visible on both light and dark backgrounds

### Screenshots

- Must show actual extension interface
- No marketing text-only images
- Full bleed (no borders or padding)
- Capture at exact dimensions
- Clear, legible text

### Promotional Tiles

- High contrast colors
- Extension name and logo prominently displayed
- Avoid small text (especially on 440×280 tile)
- Consistent branding with icon and screenshots
- Saturated colors (avoid large white/gray areas for marquee)

## Validation

Before uploading to Chrome Web Store:

1. Verify exact pixel dimensions
2. Check file formats (PNG for icons, PNG/JPEG for screenshots)
3. Preview on different backgrounds
4. Test readability at actual display sizes

## Resources

- [Chrome Web Store Image Guidelines](https://developer.chrome.com/docs/webstore/images/)
- Example assets from successful extensions
- Design templates available in `/docs/design-templates/` (if created)
