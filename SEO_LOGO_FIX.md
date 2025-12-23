# SEO Logo Fix Guide

## Issue
Your logo doesn't appear properly in Google search results because the current Open Graph image is a square icon (512x512px) instead of a proper Open Graph image.

## Solution

### For Google Search Results
Google and other search engines prefer Open Graph images that are:
- **1200x630 pixels** (recommended size)
- **1.91:1 aspect ratio** (width:height)
- **PNG or JPG format**
- **Under 8MB file size**

### Current Setup
The metadata in `src/app/layout.tsx` is now configured to use `/icons/web-app-manifest-512x512.png` as the Open Graph image. This works, but a proper 1200x630px image will look much better in search results.

### How to Fix

1. **Create a 1200x630px Open Graph Image**
   - Include your logo/branding
   - Add text like "SkinVaults - CS2 Skin Analytics"
   - Use your brand colors
   - Make it visually appealing

2. **Save the image**
   - Save as `public/og-image.png` or `public/og-image.jpg`
   - Ensure it's exactly 1200x630 pixels

3. **Update the metadata** (already done, but you can customize further)
   - The Open Graph image path in `src/app/layout.tsx` can be updated to point to your new image
   - Change line 66 from:
     ```typescript
     images: [{ url: '/icons/web-app-manifest-512x512.png', width: 512, height: 512 }],
     ```
     To:
     ```typescript
     images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'SkinVaults - CS2 Skin Analytics' }],
     ```

### Tools to Create OG Images
- **Canva**: https://www.canva.com/ (has OG image templates)
- **Figma**: https://www.figma.com/ (free design tool)
- **Photoshop/GIMP**: Professional image editors
- **Online OG Image Generators**: Search for "Open Graph image generator"

### Testing
After creating and updating the image:
1. Test with Facebook Debugger: https://developers.facebook.com/tools/debug/
2. Test with Twitter Card Validator: https://cards-dev.twitter.com/validator
3. Test with LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
4. Clear Google's cache (may take time for Google to re-crawl)

### Current Status
✅ Metadata description updated to explain what SkinVaults is and what it can do
✅ Open Graph metadata improved with better descriptions
⚠️ OG image still uses square icon - create 1200x630px image for best results

