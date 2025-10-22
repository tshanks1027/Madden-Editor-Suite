/**
 * Convert DDS portraits to PNG using parse-dds + decode-dxt + canvas
 */

const fs = require('fs');
const path = require('path');
const parseDDS = require('parse-dds');
const decodeDXT = require('decode-dxt');
const { createCanvas } = require('canvas');

const SOURCE_DIR = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\Portraits\\Madden 26';
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'portraits');
const THUMBNAIL_SIZE = 128;

async function convertDDSToPNG(inputPath, outputPath) {
  // Read DDS file
  const buffer = fs.readFileSync(inputPath);

  // Parse DDS header
  const dds = parseDDS(buffer);

  // Decode DXT compressed data
  const pixels = decodeDXT(
    Buffer.from(buffer, dds.headerLength),
    dds.width,
    dds.height,
    dds.format
  );

  // Create canvas
  const canvas = createCanvas(dds.width, dds.height);
  const ctx = canvas.getContext('2d');

  // Create ImageData
  const imageData = ctx.createImageData(dds.width, dds.height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);

  // Resize to thumbnail if needed
  if (dds.width > THUMBNAIL_SIZE || dds.height > THUMBNAIL_SIZE) {
    const thumbCanvas = createCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    const thumbCtx = thumbCanvas.getContext('2d');
    thumbCtx.drawImage(canvas, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

    // Save as PNG
    const out = fs.createWriteStream(outputPath);
    const stream = thumbCanvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve, reject) => {
      out.on('finish', resolve);
      out.on('error', reject);
    });
  } else {
    // Save full size as PNG
    const out = fs.createWriteStream(outputPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve, reject) => {
      out.on('finish', resolve);
      out.on('error', reject);
    });
  }
}

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
      await convertDDSToPNG(inputPath, outputPath);
      converted++;

      if (converted % 100 === 0) {
        console.log(`Converted ${converted}/${files.length}...`);
      }
    } catch (error) {
      console.error(`Error converting ${file}:`, error.message);
      errors++;

      // Stop after too many errors
      if (errors > 10) {
        console.error('Too many errors, stopping conversion');
        break;
      }
    }
  }

  console.log('\nConversion complete:');
  console.log(`- Converted: ${converted}`);
  console.log(`- Skipped: ${skipped}`);
  console.log(`- Errors: ${errors}`);
}

convertPortraits().catch(console.error);
