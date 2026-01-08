#!/usr/bin/env python3
"""
Package the extension for Chrome Web Store submission.
Creates a clean ZIP file with only necessary files.
"""

import os
import zipfile
import json
from pathlib import Path

def get_version():
    """Read version from manifest.json."""
    with open('manifest.json', 'r') as f:
        manifest = json.load(f)
    return manifest['version']

def should_exclude(filepath):
    """Check if file should be excluded from package."""
    exclude_patterns = [
        '.DS_Store',
        'Thumbs.db',
        '.map',  # source maps
        '.gitkeep',
    ]
    
    for pattern in exclude_patterns:
        if pattern in filepath:
            return True
    return False

def create_package():
    """Create distribution ZIP package."""
    dist_dir = Path('dist')
    
    if not dist_dir.exists():
        print("❌ Error: dist/ directory not found. Run 'bun run build' first.")
        return False
    
    version = get_version()
    zip_filename = f'ok-pour-moi-v{version}.zip'
    
    print(f"📦 Creating package: {zip_filename}")
    print(f"   Source: dist/")
    
    file_count = 0
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                filepath = Path(root) / file
                
                # Skip excluded files
                if should_exclude(str(filepath)):
                    continue
                
                # Create archive path (relative to dist/)
                arcname = filepath.relative_to(dist_dir)
                
                zipf.write(filepath, arcname)
                file_count += 1
                print(f"   + {arcname}")
    
    # Get file size
    size_bytes = os.path.getsize(zip_filename)
    size_mb = size_bytes / (1024 * 1024)
    
    print(f"\n✅ Package created successfully!")
    print(f"   File: {zip_filename}")
    print(f"   Size: {size_mb:.2f} MB")
    print(f"   Files: {file_count}")
    
    # Verify manifest.json is at root
    print("\n🔍 Verifying package structure...")
    with zipfile.ZipFile(zip_filename, 'r') as zipf:
        names = zipf.namelist()
        
        if 'manifest.json' in names:
            print("   ✓ manifest.json at root")
        else:
            print("   ✗ WARNING: manifest.json not at root!")
            return False
        
        # Check for icons
        has_icons = any('icons/' in name and name.endswith('.png') for name in names)
        if has_icons:
            print("   ✓ Icons included")
        else:
            print("   ⚠ Warning: No icons found")
        
        # Check for required directories
        required_dirs = ['background/', 'content/', 'options/', 'popup/']
        for dir in required_dirs:
            if any(name.startswith(dir) for name in names):
                print(f"   ✓ {dir} included")
    
    print(f"\n📤 Ready to upload to Chrome Web Store:")
    print(f"   https://chrome.google.com/webstore/devconsole")
    
    return True

if __name__ == '__main__':
    success = create_package()
    exit(0 if success else 1)
