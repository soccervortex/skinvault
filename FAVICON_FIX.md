# Favicon Display Fix

## Problem
The favicon appears stretched or incorrectly sized in browser tabs.

## Solution
Next.js App Router has special handling for favicons. The best approach is:

1. **Place `icon.png` in the `src/app/` directory** - Next.js will automatically use this
2. **Ensure the icon is square and properly sized** (32x32 or 16x16 for browser tabs)
3. **Keep larger sizes in `public/` for PWA and home screen**

## Current Setup
- ✅ `src/app/icon.png` - Main favicon (Next.js will use this automatically)
- ✅ `public/favicon.png` - Backup/fallback
- ✅ `public/icon.png` - For PWA
- ⚠️ `public/icon-192.png` - Still needs to be created (192x192)
- ⚠️ `public/icon-512.png` - Still needs to be created (512x512)

## To Fix the Stretching Issue

The favicon should be:
- **Square** (same width and height)
- **Small size** (32x32 or 16x16 pixels for browser tabs)
- **Simple design** (details get lost at small sizes)
- **High contrast** (visible on light/dark backgrounds)

## Recommended Steps

1. **Resize your favicon to 32x32 pixels** (square)
2. **Save as `src/app/icon.png`** (this is what Next.js uses for browser tabs)
3. **Keep larger versions in `public/`** for PWA and home screen icons

## Tools to Resize

- **Online**: https://www.iloveimg.com/resize-image
- **Online**: https://realfavicongenerator.net/
- **Photoshop/GIMP**: Resize to 32x32, save as PNG

## Testing

After updating:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Check browser tab - should show properly sized icon
4. If still stretched, the image itself may not be square - check dimensions
