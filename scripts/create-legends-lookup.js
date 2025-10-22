/**
 * Create Legends_lookup.csv from legends portraits
 * Maps legend player names to portrait files
 */

const fs = require('fs');
const path = require('path');

const PORTRAITS_DIR = path.join(__dirname, '..', 'data', 'portraits', 'legends');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'lookups', 'Legends_lookup.csv');

function createLegendsLookup() {
  console.log('Creating Legends_lookup.csv...');
  console.log('Portraits directory:', PORTRAITS_DIR);

  // Get all PNG files
  const files = fs.readdirSync(PORTRAITS_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${files.length} legend portrait files`);

  // Create CSV rows
  const rows = ['PLPO,FirstName,LastName,FullName,Filename,Description'];

  for (const file of files) {
    // Parse filename: plpo_legends_LastNameFirstName.png
    const match = file.match(/^plpo_legends_(.+)\.png$/);

    if (match) {
      const nameStr = match[1];

      // Try to split into LastNameFirstName
      // Most are in format: LastNameFirstName (e.g., AdamsAlie)
      // Some have hyphens: Abdul-JabbarKarim
      // Some have special cases: AmobiOkoye (one word)

      let lastName = '';
      let firstName = '';

      // Check if there's a hyphen (compound last name)
      if (nameStr.includes('-')) {
        // e.g., Abdul-JabbarKarim -> Abdul-Jabbar Karim
        const parts = nameStr.split('-');
        if (parts.length >= 2) {
          // Find where last name ends (first capital after hyphen)
          const afterHyphen = parts[1];
          let splitIdx = 0;
          for (let i = 1; i < afterHyphen.length; i++) {
            if (afterHyphen[i] === afterHyphen[i].toUpperCase() && afterHyphen[i] !== afterHyphen[i].toLowerCase()) {
              splitIdx = i;
              break;
            }
          }

          if (splitIdx > 0) {
            lastName = parts[0] + '-' + afterHyphen.substring(0, splitIdx);
            firstName = afterHyphen.substring(splitIdx);
          } else {
            lastName = nameStr;
            firstName = '';
          }
        }
      } else {
        // No hyphen - find where first name starts (second capital letter)
        let splitIdx = 0;
        for (let i = 1; i < nameStr.length; i++) {
          if (nameStr[i] === nameStr[i].toUpperCase() && nameStr[i] !== nameStr[i].toLowerCase()) {
            splitIdx = i;
            break;
          }
        }

        if (splitIdx > 0) {
          lastName = nameStr.substring(0, splitIdx);
          firstName = nameStr.substring(splitIdx);
        } else {
          // Single name
          lastName = nameStr;
          firstName = '';
        }
      }

      const plpoName = `plpo_legends_${nameStr}`;
      const fullName = firstName ? `${firstName} ${lastName}` : lastName;
      const description = `Legend - ${fullName}`;

      rows.push(`${plpoName},${firstName},${lastName},${fullName},${file},${description}`);
    } else {
      console.warn(`Unknown filename pattern: ${file}`);
    }
  }

  // Sort alphabetically by last name
  const header = rows[0];
  const dataRows = rows.slice(1).sort((a, b) => {
    const [, , lastNameA] = a.split(',');
    const [, , lastNameB] = b.split(',');
    return lastNameA.localeCompare(lastNameB);
  });

  const sortedRows = [header, ...dataRows];

  // Write CSV
  fs.writeFileSync(OUTPUT_FILE, sortedRows.join('\n'));

  console.log(`\nCreated ${OUTPUT_FILE}`);
  console.log(`Total entries: ${dataRows.length}`);

  // Show first 10 entries
  console.log('\nFirst 10 entries:');
  for (let i = 1; i <= Math.min(11, sortedRows.length); i++) {
    console.log(`  ${sortedRows[i]}`);
  }
}

createLegendsLookup();
