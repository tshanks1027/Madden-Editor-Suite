/**
 * Generate Player Asset Names from Portrait XML
 *
 * Uses the portrait XML data to generate likely player asset names
 * Format: LastNameFirstName_AssetID
 *
 * Since we have portrait names like "plpo_AdamsDavante" and their PIDs,
 * we can generate the corresponding player asset names
 */

const fs = require('fs');
const path = require('path');

const INPUT_XML = 'C:\\Users\\tshan\\Downloads\\assetlibrary_playerportraits_brt.xml';
const OUTPUT_CSV = path.join(__dirname, '..', 'data', 'lookups', 'Player_Assets_List.csv');

function generatePlayerAssets() {
  console.log('=== Generating Player Asset Names from Portrait XML ===\n');

  // Read and parse the XML (using our regex approach)
  const xmlContent = fs.readFileSync(INPUT_XML, 'utf-8');
  const assetRegex = /<AssetMetaData>[\s\S]*?<AssetName>(.*?)<\/AssetName>[\s\S]*?<AssetId>(.*?)<\/AssetId>[\s\S]*?<\/AssetMetaData>/g;
  const matches = [...xmlContent.matchAll(assetRegex)];

  console.log(`Found ${matches.length} portrait entries\n`);

  const assets = [];

  for (const match of matches) {
    const assetName = match[1];
    const assetId = match[2];

    // Skip generic faces - we only want actual player assets
    if (assetName.includes('/generic/')) {
      continue;
    }

    // Extract player name from portrait path
    // Legends: plpo_legends_AdamsDavante
    // Players: plpo_AdamsDavante
    let playerName = '';

    if (assetName.includes('/legends/plpo_legends_')) {
      const match = assetName.match(/plpo_legends_([A-Za-z-]+)/);
      if (match) playerName = match[1];
    } else if (assetName.includes('/plpo_')) {
      const match = assetName.match(/plpo_([A-Za-z]+)/);
      if (match) playerName = match[1];
    }

    if (playerName) {
      // Remove any hyphens and try to parse name
      playerName = playerName.replace(/-/g, '');

      // Try to split into first/last name
      // Pattern is usually LastNameFirstName
      // But we need to be smart about it
      // For now, keep the full name

      // Generate asset name: LastNameFirstName_AssetID
      const assetFileName = `${playerName}_${assetId}`;

      assets.push({
        assetName: assetFileName,
        playerName: playerName,
        assetId: parseInt(assetId),
        isLegend: assetName.includes('/legends/')
      });
    }
  }

  // Remove duplicates (same asset ID might appear multiple times)
  const uniqueAssets = [];
  const seen = new Set();

  for (const asset of assets) {
    if (!seen.has(asset.assetId)) {
      seen.add(asset.assetId);
      uniqueAssets.push(asset);
    }
  }

  // Sort by player name
  uniqueAssets.sort((a, b) => a.playerName.localeCompare(b.playerName));

  console.log(`=== Generated ${uniqueAssets.length} unique player assets ===\n`);
  console.log(`  Legends: ${uniqueAssets.filter(a => a.isLegend).length}`);
  console.log(`  Players: ${uniqueAssets.filter(a => !a.isLegend).length}\n`);

  // Write to CSV
  const header = 'Asset Name,Player Name,Asset ID,Type\n';
  const csvLines = uniqueAssets.map(a =>
    `${a.assetName},${a.playerName},${a.assetId},${a.isLegend ? 'Legend' : 'Player'}`
  );

  fs.writeFileSync(OUTPUT_CSV, header + csvLines.join('\n'), 'utf-8');

  console.log(`✓ Asset list written to: ${OUTPUT_CSV}`);

  // Show examples
  console.log(`\nFirst 10 assets:`);
  uniqueAssets.slice(0, 10).forEach(a => {
    console.log(`  ${a.assetName}`);
  });
}

generatePlayerAssets();
