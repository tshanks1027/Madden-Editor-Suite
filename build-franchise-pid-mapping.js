/**
 * Build franchise-specific PID mapping by comparing roster and franchise files
 */

const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

const FRANCHISE_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';
const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';

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
    const mapping = new Map(); // franchise PID -> roster PID
    let matchCount = 0;

    console.log('Building PID mapping from ALL matching players:\n');

    for (let i = 0; i < roster.players.length; i++) {
      const rosterPlayer = roster.players[i];

      // Find matching player in franchise (by name)
      const franchisePlayer = playerTable.records.find(r =>
        r.FirstName === rosterPlayer.PFNA &&
        r.LastName === rosterPlayer.PLNA
      );

      if (!franchisePlayer) continue;

      // Get roster PID (PSXP field)
      const rosterPID = rosterPlayer.PSXP;

      // Get franchise PID
      const franchisePID = franchisePlayer.PresentationId;

      if (typeof franchisePID === 'number' && typeof rosterPID === 'number') {
        if (!mapping.has(franchisePID)) {
          mapping.set(franchisePID, rosterPID);

          if (matchCount < 20) {
            console.log(`${rosterPlayer.PFNA} ${rosterPlayer.PLNA}:`);
            console.log(`  Franchise PID: ${franchisePID} → Roster PID: ${rosterPID}`);
          }

          matchCount++;
        }
      }
    }

    console.log(`\n✓ Built mapping with ${mapping.size} entries from ${matchCount} players\n`);

    // Check if mapping is 1-to-1
    const reverseMap = new Map();
    let conflicts = 0;

    for (const [franchisePID, rosterPID] of mapping.entries()) {
      if (reverseMap.has(rosterPID)) {
        console.log(`⚠️  Conflict: Roster PID ${rosterPID} maps to both franchise PIDs ${reverseMap.get(rosterPID)} and ${franchisePID}`);
        conflicts++;
      } else {
        reverseMap.set(rosterPID, franchisePID);
      }
    }

    if (conflicts === 0) {
      console.log('✓ Mapping is 1-to-1 (no conflicts)\n');
    } else {
      console.log(`⚠️  Found ${conflicts} conflicts in mapping\n`);
    }

    // Save mapping to JSON file
    const mappingArray = Array.from(mapping.entries()).map(([fPID, rPID]) => ({
      franchisePID: fPID,
      rosterPID: rPID
    }));

    fs.writeFileSync(
      path.join(__dirname, 'data', 'franchise-pid-mapping.json'),
      JSON.stringify(mappingArray, null, 2)
    );

    console.log('✓ Saved mapping to data/franchise-pid-mapping.json\n');

    // Test the mapping with our known players
    console.log('=== TESTING MAPPING ===\n');

    const testPlayers = [
      { name: 'Abanikanda' },
      { name: 'Abdullah' }
    ];

    for (const test of testPlayers) {
      const player = playerTable.records.find(r =>
        r.LastName && r.LastName.includes(test.name)
      );

      if (player) {
        const franchisePID = player.PresentationId;
        const rosterPID = mapping.get(franchisePID);

        console.log(`${player.FirstName} ${player.LastName}:`);
        console.log(`  Franchise PID: ${franchisePID} → Roster PID: ${rosterPID}`);
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
