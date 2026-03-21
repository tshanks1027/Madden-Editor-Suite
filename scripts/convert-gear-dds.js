/**
 * Convert ALL gear DDS files to PNG for the visual equipment picker
 * Uses UTEX library for DDS decoding (including BC7/DX10)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Source and destination paths
const GEAR_SOURCE = 'C:\\Users\\tshan\\Downloads\\PAM\\Gear';
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'gear-sprites');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load UTEX library
const UTEX_CODE = fs.readFileSync(path.join(__dirname, 'UTEX.js'), 'utf8');
const DDS_CODE = fs.readFileSync(path.join(__dirname, 'UTEX.DDS.js'), 'utf8');
eval(UTEX_CODE);
eval(DDS_CODE);

async function convertDDSToPNG(inputPath, outputPath) {
    try {
        const buffer = fs.readFileSync(inputPath);

        // Use UTEX.DDS to decode
        const decoded = UTEX.DDS.decode(buffer);

        if (!decoded || decoded.length === 0) {
            console.error(`Failed to decode: ${path.basename(inputPath)}`);
            return false;
        }

        const { width, height, image } = decoded[0];
        const rgba = Buffer.from(image);

        // Use sharp to write PNG
        await sharp(rgba, {
            raw: {
                width: width,
                height: height,
                channels: 4
            }
        })
        .png()
        .toFile(outputPath);

        return true;
    } catch (err) {
        console.error(`Error converting ${path.basename(inputPath)}: ${err.message}`);
        return false;
    }
}

async function main() {
    console.log('Converting ALL gear DDS files to PNG...\n');

    const files = fs.readdirSync(GEAR_SOURCE).filter(f => f.endsWith('.dds'));
    console.log(`Found ${files.length} DDS files total\n`);

    let converted = 0;
    let failed = 0;
    let skipped = 0;

    for (const file of files) {
        const inputPath = path.join(GEAR_SOURCE, file);
        const outputName = file.replace('.dds', '.png');
        const outputPath = path.join(OUTPUT_DIR, outputName);

        // Skip if already converted
        if (fs.existsSync(outputPath)) {
            skipped++;
            continue;
        }

        const success = await convertDDSToPNG(inputPath, outputPath);
        if (success) {
            converted++;
            process.stdout.write(`\rConverted: ${converted}, Skipped: ${skipped}, Failed: ${failed}`);
        } else {
            failed++;
        }
    }

    console.log(`\n\nDone! Converted: ${converted}, Skipped: ${skipped}, Failed: ${failed}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
}

main().catch(console.error);
