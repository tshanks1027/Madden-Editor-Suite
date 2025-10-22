/**
 * Extract Player Asset Names from Frosty Export
 *
 * Scans through the player assets directory structure to find all
 * player asset names (e.g., DartJaxson_14796)
 *
 * Expected structure:
 * content/characters/player/players/
 *   a/
 *     AdamsDevante_12345/
 *   b/
 *     BradyTom_67890/
 *   ...
 */

const fs = require('fs');
const path = require('path');

// Base path to player assets - UPDATE THIS PATH
const PLAYER_ASSETS_BASE = 'C:\\Program Files\\MyFranchise\\resources\\frosty-exports\\content\\characters\\player\\players';

// Output file
const OUTPUT_CSV = path.join(__dirname, '..', 'data', 'lookups', 'Player_Assets_List.csv');

/**
 * Recursively find all player asset folders
 * @param {string} dir Directory to search
 * @param {number} depth Current depth (to avoid infinite loops)
 * @returns {Array<string>} Array of asset names
 */
function findPlayerAssets(dir, depth = 0) {
  const assets = [];

  // Safety check - don't go too deep
  if (depth > 5) return assets;

  try {
    if (!fs.existsSync(dir)) {
      console.warn(`Directory not found: ${dir}`);
      return assets;
    }

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const fullPath = path.join(dir, item.name);

        // Check if this folder matches pattern: LastNameFirstName_ID
        // e.g., DartJaxson_14796, AdamsDevante_12345
        const match = item.name.match(/^([A-Za-z]+)([A-Za-z]+)_(\d+)$/);

        if (match) {
          // This is a player asset folder!
          const lastName = match[1];
          const firstName = match[2];
          const assetId = match[3];

          assets.push({
            assetName: item.name,
            lastName,
            firstName,
            assetId: parseInt(assetId),
            path: fullPath
          });

          console.log(`Found: ${item.name}`);
        } else {
          // Not a player asset folder, search inside it
          const subAssets = findPlayerAssets(fullPath, depth + 1);
          assets.push(...subAssets);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return assets;
}

/**
 * Main function
 */
function main() {
  console.log('=== Extracting Player Assets ===\n');
  console.log(`Searching: ${PLAYER_ASSETS_BASE}\n`);

  // Check if base path exists
  if (!fs.existsSync(PLAYER_ASSETS_BASE)) {
    console.error(`❌ Base path not found: ${PLAYER_ASSETS_BASE}`);
    console.error('\nPlease update PLAYER_ASSETS_BASE in this script to point to your Frosty export location.');
    console.error('Common locations:');
    console.error('  - C:\\Program Files\\MyFranchise\\resources\\frosty-exports\\content\\characters\\player\\players');
    console.error('  - [Your Madden Install]\\data\\characters\\player\\players');
    process.exit(1);
  }

  // Find all player assets
  const assets = findPlayerAssets(PLAYER_ASSETS_BASE);

  console.log(`\n=== Found ${assets.length} player assets ===\n`);

  // Sort by asset name
  assets.sort((a, b) => a.assetName.localeCompare(b.assetName));

  // Write to CSV
  const header = 'Asset Name,Last Name,First Name,Asset ID\n';
  const csvLines = assets.map(a =>
    `${a.assetName},${a.lastName},${a.firstName},${a.assetId}`
  );

  fs.writeFileSync(OUTPUT_CSV, header + csvLines.join('\n'), 'utf-8');

  console.log(`✓ Asset list written to: ${OUTPUT_CSV}`);
  console.log(`✓ Total assets: ${assets.length}`);

  // Show some examples
  console.log(`\nFirst 10 assets:`);
  assets.slice(0, 10).forEach(a => {
    console.log(`  ${a.assetName} (${a.firstName} ${a.lastName})`);
  });
}

main();
