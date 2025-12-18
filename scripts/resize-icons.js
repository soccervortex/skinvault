// Script to resize favicon.png to required sizes
// Run with: node scripts/resize-icons.js
// Requires: npm install sharp (or use an online tool)

const fs = require('fs');
const path = require('path');

console.log('Icon resizing script');
console.log('===================');
console.log('');
console.log('To resize your favicon.png, you have two options:');
console.log('');
console.log('Option 1: Online Tool (Easiest)');
console.log('1. Go to https://www.iloveimg.com/resize-image');
console.log('2. Upload public/favicon.png');
console.log('3. Resize to 192x192, save as icon-192.png');
console.log('4. Resize to 512x512, save as icon-512.png');
console.log('5. Place both files in public/ folder');
console.log('');
console.log('Option 2: Using Sharp (if installed)');
console.log('1. Run: npm install sharp');
console.log('2. Run: node scripts/resize-icons.js');
console.log('');

// Check if sharp is available
try {
  const sharp = require('sharp');
  const publicDir = path.join(__dirname, '..', 'public');
  const faviconPath = path.join(publicDir, 'favicon.png');
  
  if (!fs.existsSync(faviconPath)) {
    console.log('❌ favicon.png not found in public/ folder');
    process.exit(1);
  }
  
  console.log('✅ Found favicon.png, creating resized versions...');
  
  // Create 192x192
  sharp(faviconPath)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(path.join(publicDir, 'icon-192.png'))
    .then(() => console.log('✅ Created icon-192.png (192x192)'));
  
  // Create 512x512
  sharp(faviconPath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(path.join(publicDir, 'icon-512.png'))
    .then(() => console.log('✅ Created icon-512.png (512x512)'));
  
  console.log('');
  console.log('✅ All icons created successfully!');
  
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('ℹ️  Sharp not installed. Using online tool method above.');
  } else {
    console.error('Error:', error.message);
  }
}
