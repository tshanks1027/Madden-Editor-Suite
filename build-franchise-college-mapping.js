/**
 * Build franchise-specific college mapping by comparing roster and franchise files
 */

const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

const FRANCHISE_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';
const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';
const COLLEGE_CSV = path.join(__dirname, 'data', 'lookups', 'college_lookup.csv');

// Load college CSV
const collegeCSV = fs.readFileSync(COLLEGE_CSV, 'utf-8');
const rosterColleges = new Map();
const lines = collegeCSV.split('\n').filter(line => line.trim());
const headers = lines[0].split(',').map(h => h.trim());
const idIndex = headers.findIndex(h => h.toUpperCase() === 'PCOL');
const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'));

for (let i = 1; i < lines.length; i++) {
  const values = lines[i].split(',');
  const id = parseInt(values[idIndex]?.trim());
  const name = values[nameIndex]?.trim();
  if (!isNaN(id) && name) {
    rosterColleges.set(id, name);
  }
}

console.log(`\n✓ Loaded ${rosterColleges.size} colleges from roster CSV\n`);

async function buildMapping() {
  try {
    // Load roster file
    console.log('Loading roster file...');
    const { parseRosterFile } = require('./src/main/parsers/RosterParser.js');
    const roster = await parseRosterFile(ROSTER_FILE);
    console.log(`✓ Loaded roster with ${roster.players.length} players\n`);

    // Load franchise file
    console.log('Loading franchise file...');
    const franchise = await Franchise.create(FRANCHISE_FILE, { gameYearOverride: 26 });
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();
    console.log(`✓ Loaded franchise with ${playerTable.records.length} players\n`);

    // Build mapping
    const mapping = new Map(); // franchise binary ID -> roster college ID
    let matchCount = 0;

    console.log('Building mapping from ALL matching players:\n');

    for (let i = 0; i < roster.players.length; i++) {
      const rosterPlayer = roster.players[i];

      // Find matching player in franchise (by name)
      const franchisePlayer = playerTable.records.find(r =>
        r.FirstName === rosterPlayer.PFNA &&
        r.LastName === rosterPlayer.PLNA
      );

      if (!franchisePlayer) continue;

      // Get roster college ID
      const rosterCollegeId = rosterPlayer.PCOL;

      // Get franchise binary college value
      const franchiseBinary = franchisePlayer.College;

      if (typeof franchiseBinary === 'string' && franchiseBinary.match(/^[01]{32}$/)) {
        const last8Bits = franchiseBinary.substring(24);
        const franchiseId = parseInt(last8Bits, 2);

        if (!mapping.has(franchiseId)) {
          mapping.set(franchiseId, rosterCollegeId);

          const collegeName = rosterColleges.get(rosterCollegeId) || 'UNKNOWN';

          if (matchCount < 20) {
            console.log(`${rosterPlayer.PFNA} ${rosterPlayer.PLNA}:`);
            console.log(`  Franchise ID: ${franchiseId} → Roster ID: ${rosterCollegeId} (${collegeName})`);
          }

          matchCount++;
        }
      }
    }

    console.log(`\n✓ Built mapping with ${mapping.size} entries from ${matchCount} players\n`);

    // Check if mapping is consistent (1-to-1)
    const reverseMap = new Map();
    let conflicts = 0;

    for (const [franchiseId, rosterId] of mapping.entries()) {
      if (reverseMap.has(rosterId)) {
        console.log(`⚠️ Conflict: Roster ID ${rosterId} maps to both franchise IDs ${reverseMap.get(rosterId)} and ${franchiseId}`);
        conflicts++;
      } else {
        reverseMap.set(rosterId, franchiseId);
      }
    }

    if (conflicts === 0) {
      console.log('✓ Mapping is 1-to-1 (no conflicts)\n');
    } else {
      console.log(`⚠️ Found ${conflicts} conflicts in mapping\n`);
    }

    // Save mapping to JSON file
    const mappingArray = Array.from(mapping.entries()).map(([fId, rId]) => ({
      franchiseId: fId,
      rosterId: rId,
      collegeName: rosterColleges.get(rId) || 'UNKNOWN'
    }));

    fs.writeFileSync(
      path.join(__dirname, 'data', 'franchise-college-mapping.json'),
      JSON.stringify(mappingArray, null, 2)
    );

    console.log('✓ Saved mapping to data/franchise-college-mapping.json\n');

    // Test the mapping with our known players
    console.log('=== TESTING MAPPING ===\n');

    const testPlayers = [
      { name: 'Abanikanda', expectedCollege: 'Pittsburgh' },
      { name: 'Abdullah', expectedCollege: 'Nebraska' }
    ];

    for (const test of testPlayers) {
      const player = playerTable.records.find(r =>
        r.LastName && r.LastName.includes(test.name)
      );

      if (player && typeof player.College === 'string') {
        const last8Bits = player.College.substring(24);
        const franchiseId = parseInt(last8Bits, 2);
        const rosterId = mapping.get(franchiseId);
        const collegeName = rosterColleges.get(rosterId);

        console.log(`${player.FirstName} ${player.LastName}:`);
        console.log(`  Franchise ID: ${franchiseId} → Roster ID: ${rosterId} → ${collegeName}`);
        console.log(`  Expected: ${test.expectedCollege}, Got: ${collegeName}, ${collegeName === test.expectedCollege ? '✓' : '✗'}`);
      }
    }

    console.log('\n=== DONE ===\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

buildMapping();
