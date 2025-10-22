/**
 * Create PLPO_lookup.csv from all generic face portraits
 * Maps Frosty PLPO names to portrait files
 */

const fs = require('fs');
const path = require('path');

const PORTRAITS_DIR = path.join(__dirname, '..', 'data', 'portraits', 'generic');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'lookups', 'PLPO_lookup.csv');

function createPLPOLookup() {
  console.log('Creating PLPO_lookup.csv...');
  console.log('Portraits directory:', PORTRAITS_DIR);

  // Get all PNG files
  const files = fs.readdirSync(PORTRAITS_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${files.length} portrait files`);

  // Create CSV rows
  const rows = ['PLPO,Generation,PAM,Type,Filename,Description'];

  for (const file of files) {
    // Remove .png extension
    const nameWithoutExt = file.replace('.png', '');

    // Type 1: plpo_generic_1_001_morphed.png (numbered faces)
    const morphedMatch = nameWithoutExt.match(/^plpo_generic_(\d+)_(\d+)_morphed$/);

    // Type 2: plpo_generic_1_B_B_005.png (PAM-style faces with generation number)
    const pamMatch = nameWithoutExt.match(/^plpo_generic_(\d+)_([A-Z]+)_([A-Z]+)_(.+)$/);

    // Type 3: plpo_generic_bla_h_041.png (ethnicity-based faces)
    // bla=black, whi=white, lat=latino, dbl=dark_black, lbl=light_black
    const ethnicMatch = nameWithoutExt.match(/^plpo_generic_([a-z]+)_([a-z])_(\d+)$/);

    // Type 4: plpo_generic_2_BMH_003.png (PAM without full codes)
    const shortPamMatch = nameWithoutExt.match(/^plpo_generic_(\d+)_([A-Z]+)_(\d+)$/);

    // Type 5: plpo_generic_CarterLandry.png (named faces)
    const namedMatch = nameWithoutExt.match(/^plpo_generic_([A-Z][a-zA-Z]+)$/);

    if (morphedMatch) {
      const generation = parseInt(morphedMatch[1]);
      const faceNumber = morphedMatch[2];
      const plpoName = `plpo_generic_${generation}_${faceNumber}_morphed`;
      const description = `Generic Face Gen ${generation} #${faceNumber}`;

      rows.push(`${plpoName},${generation},,numbered,${file},${description}`);
    } else if (pamMatch) {
      const generation = parseInt(pamMatch[1]);
      const skinCode = pamMatch[2];
      const shapeCode = pamMatch[3];
      const faceId = pamMatch[4];

      const pamCode = `gen_${generation}_${skinCode}_${shapeCode}_${faceId}`;
      const plpoName = nameWithoutExt;
      const description = `Generic Face ${pamCode}`;

      rows.push(`${plpoName},${generation},${pamCode},pam,${file},${description}`);
    } else if (ethnicMatch) {
      const ethnicity = ethnicMatch[1];
      const bodyType = ethnicMatch[2]; // h=heavy, m=medium, t=thin
      const faceId = ethnicMatch[3];

      const plpoName = nameWithoutExt;
      const ethnicityMap = {
        bla: 'Black',
        whi: 'White',
        lat: 'Latino',
        dbl: 'Dark Black',
        lbl: 'Light Black'
      };
      const bodyTypeMap = { h: 'Heavy', m: 'Medium', t: 'Thin' };

      const description = `Generic ${ethnicityMap[ethnicity] || ethnicity} ${bodyTypeMap[bodyType] || bodyType} #${faceId}`;

      rows.push(`${plpoName},0,,ethnic,${file},${description}`);
    } else if (shortPamMatch) {
      const generation = parseInt(shortPamMatch[1]);
      const skinCode = shortPamMatch[2];
      const faceId = shortPamMatch[3];

      const plpoName = nameWithoutExt;
      const description = `Generic Face Gen ${generation} ${skinCode} #${faceId}`;

      rows.push(`${plpoName},${generation},,pam_short,${file},${description}`);
    } else if (namedMatch) {
      const playerName = namedMatch[1];
      const plpoName = nameWithoutExt;
      const description = `Generic Face ${playerName}`;

      rows.push(`${plpoName},0,,named,${file},${description}`);
    } else {
      console.warn(`Unknown filename pattern: ${file}`);
    }
  }

  // Sort by generation and face number
  const header = rows[0];
  const dataRows = rows.slice(1).sort((a, b) => {
    const [, genA, numA] = a.split(',');
    const [, genB, numB] = b.split(',');

    if (genA !== genB) {
      return parseInt(genA) - parseInt(genB);
    }
    return parseInt(numA) - parseInt(numB);
  });

  const sortedRows = [header, ...dataRows];

  // Write CSV
  fs.writeFileSync(OUTPUT_FILE, sortedRows.join('\n'));

  console.log(`\nCreated ${OUTPUT_FILE}`);
  console.log(`Total entries: ${dataRows.length}`);

  // Show breakdown by generation
  const byGen = {};
  for (const row of dataRows) {
    const gen = row.split(',')[1];
    byGen[gen] = (byGen[gen] || 0) + 1;
  }

  console.log('\nPortraits by generation:');
  for (let i = 1; i <= 7; i++) {
    console.log(`  Gen ${i}: ${byGen[i] || 0}`);
  }
}

createPLPOLookup();
