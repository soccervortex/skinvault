# Icon Setup Guide for SkinVaults

## Required Icon Sizes

For proper favicon and PWA (home screen) support, you need these icon files in the `public/` folder:

### Essential Icons
1. **icon.png** - Main favicon (should be at least 512x512, will be scaled)
2. **icon-192.png** - 192x192 pixels (Android home screen, PWA)
3. **icon-512.png** - 512x512 pixels (Android home screen, PWA splash screen)

### Optional (for better quality)
4. **favicon.ico** - 16x16, 32x32, 48x48 (traditional favicon)
5. **apple-touch-icon.png** - 180x180 (iOS home screen)

---

## How to Create Proper Icons

### Option 1: Online Tools (Easiest)
1. Go to https://realfavicongenerator.net/ or https://www.favicon-generator.org/
2. Upload your logo/icon (should be square, at least 512x512)
3. Generate all sizes
4. Download and place in `public/` folder

### Option 2: Image Editor (Photoshop/GIMP)
1. Open your logo in an image editor
2. Create square canvas (512x512 minimum)
3. Center your logo with padding (about 10-15% on each side)
4. Export as PNG with transparent background
5. Resize to create:
   - `icon.png` - 512x512 (or original size)
   - `icon-192.png` - 192x192
   - `icon-512.png` - 512x512

### Option 3: Using Your Current Icon
If you have `icon.png` already:
1. Check its current size
2. If it's not square, crop/resize to square
3. If it's smaller than 512x512, upscale it (may lose quality)
4. Create the 192x192 and 512x512 versions

---

## Icon Design Best Practices

### For Favicon (Small Sizes)
- **Simple design**: Complex details won't show at 16x16
- **High contrast**: Should be visible on light and dark backgrounds
- **Square format**: Always use square canvas
- **Padding**: Leave 10-15% padding around edges
- **No text**: Text is usually unreadable at small sizes

### For Home Screen Icons (192x192, 512x512)
- **Clear branding**: Your logo should be recognizable
- **Centered**: Logo should be centered with padding
- **Transparent background**: Or solid color that matches your theme
- **Sharp edges**: Use vector graphics or high-resolution images

---

## Current Setup

The following files are configured:
- ✅ `public/icon.png` - Main icon (you need to ensure it's properly sized)
- ⚠️ `public/icon-192.png` - **NEEDS TO BE CREATED** (192x192)
- ⚠️ `public/icon-512.png` - **NEEDS TO BE CREATED** (512x512)

---

## Quick Fix Steps

1. **Take your current logo/icon**
2. **Make it square** (if not already)
3. **Resize to 512x512** (save as `icon-512.png`)
4. **Resize to 192x192** (save as `icon-192.png`)
5. **Update main icon.png** to be at least 512x512
6. **Place all files in `public/` folder**

---

## Testing

After adding icons:
1. Clear browser cache
2. Test favicon in browser tab
3. Test on mobile:
   - iOS: Add to home screen → Check icon
   - Android: Add to home screen → Check icon
4. Verify in browser DevTools → Application → Manifest

---

## Recommended Tools

- **Favicon Generator**: https://realfavicongenerator.net/
- **PWA Asset Generator**: https://github.com/onderceylan/pwa-asset-generator
- **Image Resizer**: https://www.iloveimg.com/resize-image
- **Online Editor**: https://www.photopea.com/ (free Photoshop alternative)

---

## File Checklist

Place these in `public/` folder:
- [ ] `icon.png` (512x512 or larger, square)
- [ ] `icon-192.png` (exactly 192x192)
- [ ] `icon-512.png` (exactly 512x512)
- [ ] Optional: `favicon.ico` (multi-size ICO file)
- [ ] Optional: `apple-touch-icon.png` (180x180)

---

## Notes

- All icons should be PNG format with transparency
- Square aspect ratio is required
- Higher resolution is better (can scale down, not up)
- Test on actual devices for best results
