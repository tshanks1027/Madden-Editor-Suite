/**
 * Resize all portraits to 256x256 to match MyFranchise's approach
 * This reduces file size from ~185KB to ~55KB per portrait
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PORTRAIT_DIRS = [
  path.join(__dirname, '..', 'data', 'portraits', 'generic'),
  path.join(__dirname, '..', 'data', 'portraits', 'legends'),
  path.join(__dirname, '..', 'data', 'portraits', 'players'),
];

const TARGET_SIZE = 256;
const PNG_QUALITY = 9; // 0-9, 9 = best compression

async function resizePortraitsInDir(dirPath, categoryName) {
  if (!fs.existsSync(dirPath)) {
    console.warn(`[${categoryName}] Directory not found:`, dirPath);
    return 0;
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
  console.log(`\n[${categoryName}] Found ${files.length} portraits`);

  let processed = 0;
  let errors = 0;
  let totalSizeBefore = 0;
  let totalSizeAfter = 0;

  for (const file of files) {
    const filePath = path.join(dirPath, file);

    try {
      // Get original size
      const statsBefore = fs.statSync(filePath);
      totalSizeBefore += statsBefore.size;

      // Create backup
      const backupPath = filePath + '.backup';
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
      }

      // Resize to 256x256 with high compression
      await sharp(filePath)
        .resize(TARGET_SIZE, TARGET_SIZE, {
          fit: 'cover',
          position: 'center'
        })
        .png({
          compressionLevel: PNG_QUALITY,
          quality: 80
        })
        .toFile(filePath + '.tmp');

      // Replace original with resized
      fs.renameSync(filePath + '.tmp', filePath);

      // Get new size
      const statsAfter = fs.statSync(filePath);
      totalSizeAfter += statsAfter.size;

      processed++;

      if (processed % 100 === 0) {
        const savedMB = ((totalSizeBefore - totalSizeAfter) / 1024 / 1024).toFixed(2);
        console.log(`[${categoryName}] Processed ${processed}/${files.length} (saved ${savedMB} MB so far)`);
      }
    } catch (error) {
      console.error(`[${categoryName}] Error processing ${file}:`, error.message);
      errors++;

      // Stop after too many errors
      if (errors > 10) {
        console.error(`[${categoryName}] Too many errors, stopping`);
        break;
      }
    }
  }

  const savedMB = ((totalSizeBefore - totalSizeAfter) / 1024 / 1024).toFixed(2);
  const savedPercent = ((1 - totalSizeAfter / totalSizeBefore) * 100).toFixed(1);

  console.log(`\n[${categoryName}] Complete:`);
  console.log(`  - Processed: ${processed}`);
  console.log(`  - Errors: ${errors}`);
  console.log(`  - Size before: ${(totalSizeBefore / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Size after: ${(totalSizeAfter / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Saved: ${savedMB} MB (${savedPercent}%)`);

  return processed;
}

async function resizeAllPortraits() {
  console.log('='.repeat(60));
  console.log('RESIZING ALL PORTRAITS TO 256x256');
  console.log('='.repeat(60));
  console.log('Target size: 256x256 pixels');
  console.log('PNG compression level:', PNG_QUALITY);
  console.log('Backups will be created with .backup extension');
  console.log('='.repeat(60));

  const startTime = Date.now();
  let totalProcessed = 0;

  // Process each category
  totalProcessed += await resizePortraitsInDir(PORTRAIT_DIRS[0], 'GENERIC');
  totalProcessed += await resizePortraitsInDir(PORTRAIT_DIRS[1], 'LEGENDS');
  totalProcessed += await resizePortraitsInDir(PORTRAIT_DIRS[2], 'PLAYERS');

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('ALL PORTRAITS RESIZED!');
  console.log('='.repeat(60));
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Time elapsed: ${elapsedSeconds} seconds`);
  console.log('\nBackup files (.backup) have been created.');
  console.log('If everything looks good, you can delete them with:');
  console.log('  node scripts/delete-portrait-backups.js');
  console.log('='.repeat(60));
}

resizeAllPortraits().catch(console.error);
