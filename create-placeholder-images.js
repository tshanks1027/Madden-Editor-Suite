const sharp = require('sharp');
const path = require('path');

async function createPlaceholderImages() {
  const buildAssetsDir = path.join(__dirname, 'build-assets');

  // NSIS installer header: 150x57 pixels (standard size)
  await sharp({
    create: {
      width: 150,
      height: 57,
      channels: 4,
      background: { r: 0, g: 122, b: 204, alpha: 1 } // Blue background
    }
  })
  .png()
  .toFile(path.join(buildAssetsDir, 'banner.png'));

  console.log('Created banner.png (150x57)');

  // NSIS installer sidebar: 164x314 pixels (standard size)
  await sharp({
    create: {
      width: 164,
      height: 314,
      channels: 4,
      background: { r: 0, g: 122, b: 204, alpha: 1 } // Blue background
    }
  })
  .png()
  .toFile(path.join(buildAssetsDir, 'splash.png'));

  console.log('Created splash.png (164x314)');
}

createPlaceholderImages().then(() => {
  console.log('Placeholder images created successfully');
}).catch(err => {
  console.error('Error creating placeholder images:', err);
  process.exit(1);
});
