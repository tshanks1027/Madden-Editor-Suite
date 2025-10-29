const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generates sprite sheets from individual coach portrait images
 * Similar to player portraits: multiple portraits packed into single PNG files
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
  inputDir: path.join(__dirname, '..', 'data', 'coach-portraits-by-pid'),
  outputDir: path.join(__dirname, '..', 'data', 'coach-sprites'),
  atlasFile: path.join(__dirname, '..', 'data', 'coach-atlas.json')
};

async function getAllCoachPortraits() {
  const portraits = [];

  try {
    const files = await fs.readdir(CONFIG.inputDir);

    // Process numbered PID files (coaches and owners)
    for (const file of files) {
      if (file.endsWith('.png') && !file.includes('.backup') && !file.startsWith('generic_')) {
        const pidMatch = file.match(/^(\d+)\.png$/);
        if (pidMatch) {
          const pid = parseInt(pidMatch[1]);
          portraits.push({
            pid,
            filename: file,
            fullPath: path.join(CONFIG.inputDir, file),
            type: 'coach'
          });
        }
      }
    }

    // Process generic files (starting with "generic_")
    // Assign them sequential PIDs starting from 150
    let genericPID = 150;
    for (const file of files) {
      if (file.endsWith('.png') && file.startsWith('generic_')) {
        portraits.push({
          pid: genericPID++,
          filename: file,
          fullPath: path.join(CONFIG.inputDir, file),
          type: 'generic'
        });
      }
    }
  } catch (err) {
    console.error(`Error reading coach portraits directory:`, err.message);
    throw err;
  }

  // Sort by PID for consistent ordering
  portraits.sort((a, b) => a.pid - b.pid);

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
        pid: portrait.pid,
        filename: portrait.filename,
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
  const outputPath = path.join(CONFIG.outputDir, `coach-sheet-${sheetIndex}.png`);
  await canvas.composite(compositeOps).png({ quality: 90 }).toFile(outputPath);

  return { atlasEntries, outputPath };
}

async function generateCoachSpriteSheets() {
  console.log('=== Coach Sprite Sheet Generator ===');
  console.log(`Input: ${CONFIG.inputDir}`);
  console.log(`Output: ${CONFIG.outputDir}`);
  console.log('');

  // Create output directory
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  // Get all coach portrait files
  console.log('Scanning coach portrait files...');
  const allPortraits = await getAllCoachPortraits();
  console.log(`Found ${allPortraits.length} coach portraits`);
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
    type: 'coach',
    config: {
      portraitWidth: CONFIG.portraitWidth,
      portraitHeight: CONFIG.portraitHeight,
      gridColumns: CONFIG.gridColumns,
      gridRows: CONFIG.gridRows
    },
    sheets: numSheets,
    coaches: fullAtlas
  }, null, 2));
  console.log(`  ✓ Atlas saved: ${CONFIG.atlasFile}`);

  // Summary
  console.log('');
  console.log('=== Summary ===');
  console.log(`Total coach portraits: ${allPortraits.length}`);
  console.log(`Sprite sheets: ${numSheets}`);
  console.log(`Atlas entries: ${fullAtlas.length}`);

  const outputDirStats = await fs.readdir(CONFIG.outputDir);
  let totalSize = 0;
  for (const file of outputDirStats) {
    if (file.endsWith('.png')) {
      const stats = await fs.stat(path.join(CONFIG.outputDir, file));
      totalSize += stats.size;
    }
  }
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log('✓ Coach sprite sheet generation complete!');
}

// Run generator
generateCoachSpriteSheets().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
