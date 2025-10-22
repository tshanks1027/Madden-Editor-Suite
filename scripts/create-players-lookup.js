/**
 * Create Players_lookup.csv from player portraits
 * Maps current/real player names to portrait files
 */

const fs = require('fs');
const path = require('path');

const PORTRAITS_DIR = path.join(__dirname, '..', 'data', 'portraits', 'players');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'lookups', 'Players_lookup.csv');

function createPlayersLookup() {
  console.log('Creating Players_lookup.csv...');
  console.log('Portraits directory:', PORTRAITS_DIR);

  // Get all PNG files
  const files = fs.readdirSync(PORTRAITS_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${files.length} player portrait files`);

  // Create CSV rows
  const rows = ['PLPO,FirstName,LastName,FullName,Filename,Description'];

  for (const file of files) {
    // Parse filename: plpo_LastNameFirstName.png
    const match = file.match(/^plpo_(.+)\.png$/);

    if (match) {
      const nameStr = match[1];

      let lastName = '';
      let firstName = '';

      // Handle special cases with underscores (e.g., Abrams_DraineKris)
      if (nameStr.includes('_')) {
        const parts = nameStr.split('_');
        if (parts.length === 2) {
          // e.g., Abrams_DraineKris -> Abrams-Draine Kris
          const firstPart = parts[0];
          const secondPart = parts[1];

          // Find where first name starts in second part
          let splitIdx = 0;
          for (let i = 1; i < secondPart.length; i++) {
            if (secondPart[i] === secondPart[i].toUpperCase() && secondPart[i] !== secondPart[i].toLowerCase()) {
              splitIdx = i;
              break;
            }
          }

          if (splitIdx > 0) {
            lastName = firstPart + '-' + secondPart.substring(0, splitIdx);
            firstName = secondPart.substring(splitIdx);
          } else {
            lastName = firstPart;
            firstName = secondPart;
          }
        }
      }
      // Handle hyphens in name (e.g., Abdul-QuddusIsa)
      else if (nameStr.includes('-')) {
        const parts = nameStr.split('-');
        if (parts.length >= 2) {
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
      }
      // Standard LastNameFirstName format
      else {
        // Find where first name starts (second capital letter)
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

      const plpoName = `plpo_${nameStr}`;
      const fullName = firstName ? `${firstName} ${lastName}` : lastName;
      const description = `Player - ${fullName}`;

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

createPlayersLookup();
