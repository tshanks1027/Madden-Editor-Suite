// Quick test script to verify CSV loading
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Check both possible paths
const paths = [
  path.join(__dirname, 'data', 'lookups', 'ALL_PLAYER_LOOKUP.csv'),
  path.join(__dirname, '.vite', 'build', 'data', 'lookups', 'ALL_PLAYER_LOOKUP.csv')
];

console.log('=== CSV LOADING TEST ===\n');

for (const csvPath of paths) {
  console.log(`Checking: ${csvPath}`);
  console.log(`  Exists: ${fs.existsSync(csvPath)}`);

  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });

    console.log(`  Total rows: ${parsed.data.length}`);
    console.log(`  Headers: ${Object.keys(parsed.data[0] || {}).slice(0, 10).join(', ')}...`);

    // Search for Staubach
    let staubachFound = false;
    for (const row of parsed.data) {
      const firstName = (row['First Name'] || '').toLowerCase();
      const lastName = (row['Last Name'] || '').toLowerCase();

      if (lastName === 'staubach' || firstName === 'roger' && lastName === 'staubach') {
        console.log('\n  === STAUBACH FOUND ===');
        console.log(`  First Name: "${row['First Name']}"`);
        console.log(`  Last Name: "${row['Last Name']}"`);
        console.log(`  PhotoID: "${row['PhotoID']}"`);
        console.log(`  From: "${row['From']}"`);
        console.log(`  To: "${row['To']}"`);
        console.log(`  Draft Class: "${row['Draft Class']}"`);
        console.log(`  College: "${row['College/Univ']}"`);
        console.log(`  Race: "${row['Race']}"`);
        console.log(`  PLPO: "${row['PLPO']}"`);
        staubachFound = true;
      }
    }

    if (!staubachFound) {
      console.log('\n  !!! STAUBACH NOT FOUND IN CSV !!!');
    }

    // Test key format
    const stripMarkers = (name) => name.toLowerCase().trim().replace(/[‡†*]+\d*/g, '');

    console.log('\n  === CACHE KEY TEST ===');
    const testEntry = parsed.data.find(r =>
      stripMarkers(r['Last Name'] || '') === 'staubach' &&
      stripMarkers(r['First Name'] || '') === 'roger'
    );

    if (testEntry) {
      const key = `${stripMarkers(testEntry['First Name'])} ${stripMarkers(testEntry['Last Name'])} ${testEntry['Draft Class']}`;
      console.log(`  Cache key would be: "${key}"`);
      console.log(`  PhotoID would be: ${parseInt(testEntry['PhotoID'])}`);

      // Test year range
      const from = parseInt(testEntry['From']) || 0;
      const to = parseInt(testEntry['To']) || 0;
      const testYear = 1970;
      console.log(`\n  === YEAR RANGE TEST (for 1970) ===`);
      console.log(`  From: ${from}, To: ${to}`);
      console.log(`  Is 1970 in range? ${testYear >= from && testYear <= to}`);
    }

    console.log('\n');
  }
  console.log('');
}
