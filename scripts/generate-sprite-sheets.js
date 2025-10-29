const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generates sprite sheets from individual portrait images
 * Similar to MyFranchise's approach: multiple portraits packed into single PNG files
 *
 * Configuration:
 * - Grid: 10x10 (100 portraits per sprite sheet)
 * - Portrait size: 256x256 (standard Madden portrait size)
 * - Output: sprite sheets + JSON atlas mapping
 */

const CONFIG = {
  portraitWidth: 256,
  portraitHeight: 256,
  gridColumns: 10,
  gridRows: 10,
  portraitsPerSheet: 100, // 10x10 grid
  inputDir: path.join(__dirname, '..', 'data', 'portraits'),
  outputDir: path.join(__dirname, '..', 'data', 'portrait-sprites'),
  atlasFile: path.join(__dirname, '..', 'data', 'portrait-atlas.json')
};

async function getAllPortraitFiles() {
  const categories = ['generic', 'legends', 'players'];
  const portraits = [];

  for (const category of categories) {
    const categoryPath = path.join(CONFIG.inputDir, category);
    try {
      const files = await fs.readdir(categoryPath);
      for (const file of files) {
        if (file.endsWith('.png') && !file.includes('.backup')) {
          portraits.push({
            category,
            filename: file,
            fullPath: path.join(categoryPath, file),
            id: file.replace('.png', '').replace('plpo_', '')
          });
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not read category ${category}:`, err.message);
    }
  }

  return portraits;
}

async function createSpriteSheet(portraits, sheetIndex) {
  const sheetWidth = CONFIG.portraitWidth * CONFIG.gridColumns;
  const sheetHeight = CONFIG.portraitHeight * CONFIG.gridRows;

  // Create blank canvas
  const canvas = sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  const compositeOps = [];
  const atlasEntries = [];

  for (let i = 0; i < portraits.length; i++) {
    const portrait = portraits[i];
    const row = Math.floor(i / CONFIG.gridColumns);
    const col = i % CONFIG.gridColumns;
    const x = col * CONFIG.portraitWidth;
    const y = row * CONFIG.portraitHeight;

    try {
      // Resize portrait to standard size if needed
      const resizedBuffer = await sharp(portrait.fullPath)
        .resize(CONFIG.portraitWidth, CONFIG.portraitHeight, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toBuffer();

      compositeOps.push({
        input: resizedBuffer,
        top: y,
        left: x
      });

      atlasEntries.push({
        id: portrait.id,
        filename: portrait.filename,
        category: portrait.category,
        sheet: sheetIndex,
        x,
        y,
        width: CONFIG.portraitWidth,
        height: CONFIG.portraitHeight
      });

    } catch (err) {
      console.warn(`Warning: Could not process ${portrait.filename}:`, err.message);
    }
  }

  // Composite all portraits onto canvas
  const outputPath = path.join(CONFIG.outputDir, `portraits-sheet-${sheetIndex}.png`);
  await canvas.composite(compositeOps).png({ quality: 90 }).toFile(outputPath);

  return { atlasEntries, outputPath };
}

async function generateSpriteSheets() {
  console.log('=== Sprite Sheet Generator ===');
  console.log(`Input: ${CONFIG.inputDir}`);
  console.log(`Output: ${CONFIG.outputDir}`);
  console.log('');

  // Create output directory
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  // Get all portrait files
  console.log('Scanning portrait files...');
  const allPortraits = await getAllPortraitFiles();
  console.log(`Found ${allPortraits.length} portraits`);
  console.log('');

  // Calculate number of sheets needed
  const numSheets = Math.ceil(allPortraits.length / CONFIG.portraitsPerSheet);
  console.log(`Generating ${numSheets} sprite sheets (${CONFIG.portraitsPerSheet} portraits per sheet)...`);
  console.log('');

  const fullAtlas = [];

  // Generate sprite sheets
  for (let sheetIndex = 0; sheetIndex < numSheets; sheetIndex++) {
    const startIdx = sheetIndex * CONFIG.portraitsPerSheet;
    const endIdx = Math.min(startIdx + CONFIG.portraitsPerSheet, allPortraits.length);
    const sheetPortraits = allPortraits.slice(startIdx, endIdx);

    console.log(`[${sheetIndex + 1}/${numSheets}] Creating sprite sheet with ${sheetPortraits.length} portraits...`);

    const { atlasEntries, outputPath } = await createSpriteSheet(sheetPortraits, sheetIndex);
    fullAtlas.push(...atlasEntries);

    const stats = await fs.stat(outputPath);
    console.log(`  ✓ Created: ${path.basename(outputPath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  }

  // Write atlas file
  console.log('');
  console.log('Writing atlas mapping...');
  await fs.writeFile(CONFIG.atlasFile, JSON.stringify({
    version: '1.0.0',
    config: {
      portraitWidth: CONFIG.portraitWidth,
      portraitHeight: CONFIG.portraitHeight,
      gridColumns: CONFIG.gridColumns,
      gridRows: CONFIG.gridRows
    },
    sheets: numSheets,
    portraits: fullAtlas
  }, null, 2));
  console.log(`  ✓ Atlas saved: ${CONFIG.atlasFile}`);

  // Summary
  console.log('');
  console.log('=== Summary ===');
  console.log(`Total portraits: ${allPortraits.length}`);
  console.log(`Sprite sheets: ${numSheets}`);
  console.log(`Atlas entries: ${fullAtlas.length}`);

  const outputDirStats = await fs.readdir(CONFIG.outputDir);
  let totalSize = 0;
  for (const file of outputDirStats) {
    const stats = await fs.stat(path.join(CONFIG.outputDir, file));
    totalSize += stats.size;
  }
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log('✓ Sprite sheet generation complete!');
}

// Run generator
generateSpriteSheets().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
