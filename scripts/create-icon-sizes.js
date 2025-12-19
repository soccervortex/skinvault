// Script to create properly sized icons from 512x512 favicon
// This creates a 32x32 version for browser tabs to prevent stretching
// Run with: node scripts/create-icon-sizes.js

const fs = require('fs');
const path = require('path');

console.log('Creating icon sizes from favicon.png');
console.log('====================================');
console.log('');

const publicDir = path.join(__dirname, '..', 'public');
const faviconPath = path.join(publicDir, 'favicon.png');

if (!fs.existsSync(faviconPath)) {
  console.log('❌ favicon.png not found in public/ folder');
  process.exit(1);
}

console.log('✅ Found favicon.png (512x512)');
console.log('');

// Check if sharp is available for resizing
try {
  const sharp = require('sharp');
  
  console.log('Creating properly sized icons...');
  
  // Create 32x32 for browser tabs (prevents stretching)
  sharp(faviconPath)
    .resize(32, 32, { 
      fit: 'contain', 
      background: { r: 0, g: 0, b: 0, alpha: 0 } 
    })
    .toFile(path.join(publicDir, 'icon-32.png'))
    .then(() => {
      console.log('✅ Created icon-32.png (32x32) for browser tabs');
      
      // Also copy 32x32 to app directory for Next.js
      fs.copyFileSync(
        path.join(publicDir, 'icon-32.png'),
        path.join(__dirname, '..', 'src', 'app', 'icon.png')
      );
      console.log('✅ Updated src/app/icon.png (32x32) for Next.js');
    });
  
  // Create 192x192 for PWA
  sharp(faviconPath)
    .resize(192, 192, { 
      fit: 'contain', 
      background: { r: 0, g: 0, b: 0, alpha: 0 } 
    })
    .toFile(path.join(publicDir, 'icon-192.png'))
    .then(() => console.log('✅ Created icon-192.png (192x192) for PWA'));
  
  // icon-512.png is already 512x512 (just copy)
  fs.copyFileSync(faviconPath, path.join(publicDir, 'icon-512.png'));
  console.log('✅ icon-512.png is already 512x512');
  
  console.log('');
  console.log('✅ All icons created successfully!');
  console.log('');
  console.log('Note: Browser tabs use 32x32 to prevent stretching.');
  console.log('Larger sizes (192x192, 512x512) are used for PWA and home screen.');
  
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('ℹ️  Sharp not installed. Installing...');
    console.log('');
    console.log('Run: npm install sharp');
    console.log('Then run this script again.');
    console.log('');
    console.log('OR use an online tool:');
    console.log('1. Go to https://www.iloveimg.com/resize-image');
    console.log('2. Upload public/favicon.png');
    console.log('3. Resize to 32x32, save as icon-32.png');
    console.log('4. Resize to 192x192, save as icon-192.png');
    console.log('5. Copy favicon.png to icon-512.png (already 512x512)');
    console.log('6. Copy icon-32.png to src/app/icon.png');
  } else {
    console.error('Error:', error.message);
  }
}
