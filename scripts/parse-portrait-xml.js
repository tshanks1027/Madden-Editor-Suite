/**
 * Parse Madden Portrait Asset Library XML
 *
 * Extracts PID to portrait name mappings from assetlibrary_playerportraits_brt.xml
 * Creates a CSV with PID, Portrait Type (generic/legend/player), and Asset Name
 */

const fs = require('fs');
const path = require('path');

const INPUT_XML = 'C:\\Users\\tshan\\Downloads\\assetlibrary_playerportraits_brt.xml';
const OUTPUT_CSV = path.join(__dirname, '..', 'data', 'lookups', 'PID_Portrait_Mapping.csv');

function parsePortraitXML() {
  console.log('=== Parsing Madden Portrait Asset Library ===\n');
  console.log(`Reading: ${INPUT_XML}\n`);

  // Read XML file
  const xmlContent = fs.readFileSync(INPUT_XML, 'utf-8');

  // Use regex to extract AssetMetaData entries
  const assetRegex = /<AssetMetaData>[\s\S]*?<AssetName>(.*?)<\/AssetName>[\s\S]*?<AssetId>(.*?)<\/AssetId>[\s\S]*?<\/AssetMetaData>/g;

  const matches = [...xmlContent.matchAll(assetRegex)];

  console.log(`Found ${matches.length} asset entries\n`);

  const mappings = [];

  for (const match of matches) {
    const assetName = match[1];
    const assetId = match[2];

    // Extract portrait type and name from path
    let portraitType = 'unknown';
    let portraitName = '';

    if (assetName.includes('/generic/')) {
      portraitType = 'generic';
      // Extract: plpo_generic_1_001_morphed
      const match = assetName.match(/plpo_generic_\d+_\d+/);
      portraitName = match ? match[0] : '';
    } else if (assetName.includes('/legends/')) {
      portraitType = 'legend';
      // Extract: plpo_legends_AdamsSam
      const match = assetName.match(/plpo_legends_\w+/);
      portraitName = match ? match[0] : '';
    } else if (assetName.includes('/plpo_')) {
      portraitType = 'player';
      // Extract: plpo_AdamsDavante
      const match = assetName.match(/plpo_\w+/);
      portraitName = match ? match[0] : '';
    }

    mappings.push({
      pid: assetId,
      type: portraitType,
      portrait: portraitName
    });
  }

  // Write CSV
  const header = 'PID,Type,Portrait\n';
  const csvLines = mappings.map(m => `${m.pid},${m.type},${m.portrait}`);

  fs.writeFileSync(OUTPUT_CSV, header + csvLines.join('\n'), 'utf-8');

  // Stats
  const genericCount = mappings.filter(m => m.type === 'generic').length;
  const legendCount = mappings.filter(m => m.type === 'legend').length;
  const playerCount = mappings.filter(m => m.type === 'player').length;
  const unknownCount = mappings.filter(m => m.type === 'unknown').length;

  console.log('=== Parsing Complete ===\n');
  console.log(`Output: ${OUTPUT_CSV}`);
  console.log(`\nTotal Entries: ${mappings.length}`);
  console.log(`  Generic Faces: ${genericCount}`);
  console.log(`  Legend Portraits: ${legendCount}`);
  console.log(`  Player Portraits: ${playerCount}`);
  console.log(`  Unknown: ${unknownCount}`);
}

parsePortraitXML();
