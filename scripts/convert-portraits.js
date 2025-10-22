/**
 * Convert DDS portraits to PNG for web display
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_DIR = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\Portraits\\Madden 26';
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'portraits');

async function convertPortraits() {
  console.log('Converting DDS portraits to PNG...');
  console.log('Source:', SOURCE_DIR);
  console.log('Output:', OUTPUT_DIR);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all DDS files
  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.dds'));
  console.log(`Found ${files.length} DDS files`);

  let converted = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const inputPath = path.join(SOURCE_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file.replace('.dds', '.png'));

    // Skip if already converted
    if (fs.existsSync(outputPath)) {
      skipped++;
      continue;
    }

    try {
      await sharp(inputPath)
        .resize(128, 128, { fit: 'cover' }) // Resize to thumbnails to save space
        .png({ quality: 80, compressionLevel: 9 })
        .toFile(outputPath);

      converted++;
      if (converted % 100 === 0) {
        console.log(`Converted ${converted}/${files.length}...`);
      }
    } catch (error) {
      console.error(`Error converting ${file}:`, error.message);
      errors++;
    }
  }

  console.log('\nConversion complete:');
  console.log(`- Converted: ${converted}`);
  console.log(`- Skipped: ${skipped}`);
  console.log(`- Errors: ${errors}`);
}

convertPortraits().catch(console.error);
