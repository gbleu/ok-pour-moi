#!/usr/bin/env python3
"""
Create promotional assets for Chrome Web Store submission.
Generates placeholder images with proper dimensions.
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_store_icon():
    """Create 128x128 store icon with 16px padding."""
    size = 128
    img = Image.new('RGBA', (size, size), color=(0, 120, 212, 255))
    draw = ImageDraw.Draw(img)
    
    # Draw in the 96x96 center area (16px padding on all sides)
    inner_size = 96
    offset = 16
    
    # Draw checkmark in the inner area
    checkmark_scale = inner_size / 100
    base_x = offset
    base_y = offset
    
    points = [
        (base_x + 25 * checkmark_scale, base_y + 50 * checkmark_scale),
        (base_x + 45 * checkmark_scale, base_y + 70 * checkmark_scale),
        (base_x + 75 * checkmark_scale, base_y + 30 * checkmark_scale)
    ]
    
    # Draw checkmark
    line_width = max(2, int(size / 16))
    draw.line([points[0], points[1]], fill='white', width=line_width)
    draw.line([points[1], points[2]], fill='white', width=line_width)
    
    # Add OK text
    text = "OK"
    text_bbox = draw.textbbox((0, 0), text)
    text_width = text_bbox[2] - text_bbox[0]
    text_x = (size - text_width) // 2
    text_y = base_y + int(inner_size * 0.7)
    draw.text((text_x, text_y), text, fill='white')
    
    return img


def create_screenshot(width, height, title, description):
    """Create a placeholder screenshot."""
    img = Image.new('RGB', (width, height), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    
    # Add border
    draw.rectangle([0, 0, width-1, height-1], outline=(200, 200, 200), width=2)
    
    # Add title
    title_bbox = draw.textbbox((0, 0), title)
    title_width = title_bbox[2] - title_bbox[0]
    title_height = title_bbox[3] - title_bbox[1]
    title_x = (width - title_width) // 2
    title_y = height // 3
    draw.text((title_x, title_y), title, fill=(51, 51, 51))
    
    # Add description
    desc_bbox = draw.textbbox((0, 0), description)
    desc_width = desc_bbox[2] - desc_bbox[0]
    desc_x = (width - desc_width) // 2
    desc_y = title_y + title_height + 20
    draw.text((desc_x, desc_y), description, fill=(102, 102, 102))
    
    # Add dimension text
    dim_text = f"{width}×{height}px"
    dim_bbox = draw.textbbox((0, 0), dim_text)
    dim_width = dim_bbox[2] - dim_bbox[0]
    dim_x = (width - dim_width) // 2
    dim_y = height - 40
    draw.text((dim_x, dim_y), dim_text, fill=(153, 153, 153))
    
    return img


def create_promo_tile(width, height, title):
    """Create promotional tile."""
    img = Image.new('RGB', (width, height), color=(0, 120, 212))
    draw = ImageDraw.Draw(img)
    
    # Add icon in center-left
    icon_size = min(height - 40, 128)
    icon_x = 40
    icon_y = (height - icon_size) // 2
    
    # Draw simplified icon
    icon_img = Image.new('RGBA', (icon_size, icon_size), color=(255, 255, 255, 0))
    icon_draw = ImageDraw.Draw(icon_img)
    
    # White circle background
    icon_draw.ellipse([5, 5, icon_size-5, icon_size-5], fill='white')
    
    # Blue checkmark
    checkmark_scale = icon_size / 100
    points = [
        (25 * checkmark_scale, 50 * checkmark_scale),
        (45 * checkmark_scale, 70 * checkmark_scale),
        (75 * checkmark_scale, 30 * checkmark_scale)
    ]
    line_width = max(3, int(icon_size / 12))
    icon_draw.line([points[0], points[1]], fill=(0, 120, 212), width=line_width)
    icon_draw.line([points[1], points[2]], fill=(0, 120, 212), width=line_width)
    
    img.paste(icon_img, (icon_x, icon_y), icon_img)
    
    # Add title text
    text_x = icon_x + icon_size + 30
    text_y = height // 2 - 20
    
    # Try to use a larger font for title
    try:
        font_size = 48 if width > 800 else 24
        # Use default font with size approximation
        draw.text((text_x, text_y), title, fill='white')
    except:
        draw.text((text_x, text_y), title, fill='white')
    
    # Add tagline
    tagline = "Sign PDFs in Outlook Web"
    tagline_y = text_y + 60 if width > 800 else text_y + 30
    draw.text((text_x, tagline_y), tagline, fill='white')
    
    return img


def main():
    """Generate all store assets."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    assets_dir = os.path.join(repo_root, 'store-assets')
    
    os.makedirs(assets_dir, exist_ok=True)
    
    print("Creating Chrome Web Store assets...")
    
    # 1. Store Icon (128x128 with padding)
    print("  → Creating store icon (128×128)...")
    store_icon = create_store_icon()
    store_icon.save(os.path.join(assets_dir, 'store-icon-128.png'))
    
    # 2. Screenshots (1280x800)
    print("  → Creating screenshot templates (1280×800)...")
    screenshots = [
        ("OK Pour Moi Extension", "Placeholder: Extension Popup"),
        ("Configuration Options", "Placeholder: Options Page"),
        ("Signing in Action", "Placeholder: Outlook Web Integration"),
        ("Success Notification", "Placeholder: Draft Created"),
    ]
    
    for i, (title, desc) in enumerate(screenshots, 1):
        screenshot = create_screenshot(1280, 800, title, desc)
        screenshot.save(os.path.join(assets_dir, f'screenshot-{i}.png'))
    
    # 3. Small Promotional Tile (440x280)
    print("  → Creating small promotional tile (440×280)...")
    small_promo = create_promo_tile(440, 280, "OK Pour Moi")
    small_promo.save(os.path.join(assets_dir, 'promo-small-440x280.png'))
    
    # 4. Marquee Promotional Tile (1400x560)
    print("  → Creating marquee promotional tile (1400×560)...")
    marquee = create_promo_tile(1400, 560, "OK Pour Moi")
    marquee.save(os.path.join(assets_dir, 'promo-marquee-1400x560.png'))
    
    print("\n✅ All assets created successfully!")
    print(f"\nAssets location: {assets_dir}/")
    print("\nNote: These are placeholder templates. Replace them with:")
    print("  • Actual screenshots of the extension in use")
    print("  • Professional promotional tiles with your branding")
    print("\nSee store-assets/README.md for guidelines.")


if __name__ == '__main__':
    main()
