/**
 * Script to populate 40-yard dash times in ALL_PLAYER_LOOKUP.csv
 *
 * This script scrapes NFL Combine data from Pro Football Reference
 * and updates the player lookup CSV with 40-yard dash times.
 *
 * Usage: npx ts-node scripts/populate-40-times.ts
 */

import * as path from 'path';
import * as fs from 'fs';

// Mock Electron app for standalone script execution
const mockApp = {
  getAppPath: () => process.cwd(),
  isPackaged: false
};

// Inject mock app
(global as any).app = mockApp;

// Set up the module path
process.env.NODE_ENV = 'development';

// Import the service
import('../src/main/services/CombineDataService').then(async ({ combineDataService }) => {
  console.log('🏈 NFL Combine 40-Time Population Script');
  console.log('==========================================\n');

  try {
    console.log('Starting combine data fetch...');
    console.log('This may take several minutes as we scrape data from 1987 to present.\n');

    const startTime = Date.now();

    // Fetch combine data from 1987 to current year
    const currentYear = new Date().getFullYear();
    const startYear = 1987;

    console.log(`Fetching data from ${startYear} to ${currentYear}...\n`);

    const combineData = await combineDataService.fetchCombineDataRange(startYear, currentYear);

    console.log(`\n✓ Fetched ${combineData.length} combine results`);

    // Update the CSV
    console.log('\nUpdating ALL_PLAYER_LOOKUP.csv...');
    await combineDataService.updatePlayerLookupWith40Times(combineData);

    // Close browser
    await combineDataService.closeBrowser();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n✓ Population complete!');
    console.log(`Total time: ${duration} seconds`);
    console.log(`Total combine results: ${combineData.length}`);

    // Export to JSON for reference
    const jsonPath = path.join(process.cwd(), 'data', 'combine-data.json');
    await combineDataService.exportCombineDataToJSON(combineData, jsonPath);
    console.log(`\n✓ Combine data exported to: ${jsonPath}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
});
