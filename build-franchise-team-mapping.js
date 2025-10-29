const Franchise = require('madden-franchise');
const { parseRosterFile } = require('./src/main/parsers/RosterParser.js');
const fs = require('fs');
const path = require('path');

const FRANCHISE_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';
const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';

async function buildTeamMapping() {
  console.log('Loading roster file...');
  const roster = await parseRosterFile(ROSTER_FILE);

  console.log('Loading franchise file...');
  const franchise = await Franchise.create(FRANCHISE_FILE, { gameYearOverride: 26 });

  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  console.log(`Roster has ${roster.players.length} players`);
  console.log(`Franchise has ${playerTable.records.length} players`);

  const mapping = new Map();
  let matchCount = 0;

  // Match players by name and build team ID mapping
  for (let i = 0; i < roster.players.length; i++) {
    const rosterPlayer = roster.players[i];

    const franchisePlayer = playerTable.records.find(r =>
      r.FirstName === rosterPlayer.PFNA &&
      r.LastName === rosterPlayer.PLNA
    );

    if (franchisePlayer) {
      const franchiseTeamID = franchisePlayer.TeamIndex; // This is TGID in the data
      const rosterTeamID = rosterPlayer.TGID;

      if (franchiseTeamID !== undefined && rosterTeamID !== undefined) {
        // Store mapping (may have duplicates for players on same team)
        if (!mapping.has(franchiseTeamID)) {
          mapping.set(franchiseTeamID, rosterTeamID);
          matchCount++;

          // Debug output for first few mappings
          if (matchCount <= 10) {
            console.log(`Team mapping: franchise ${franchiseTeamID} → roster ${rosterTeamID} (${rosterPlayer.PFNA} ${rosterPlayer.PLNA})`);
          }
        }
      }
    }
  }

  console.log(`\nBuilt ${mapping.size} unique team mappings from ${matchCount} player matches`);

  // Convert to array format for JSON
  const mappingArray = Array.from(mapping.entries()).map(([franchiseTeam, rosterTeam]) => ({
    franchiseTeam: franchiseTeam,
    rosterTeam: rosterTeam
  }));

  // Sort by franchise team ID
  mappingArray.sort((a, b) => a.franchiseTeam - b.franchiseTeam);

  // Write to JSON file
  const outputPath = path.join(__dirname, 'data', 'franchise-team-mapping.json');
  fs.writeFileSync(outputPath, JSON.stringify(mappingArray, null, 2));

  console.log(`\nWrote ${mappingArray.length} team mappings to ${outputPath}`);
  console.log('\nFirst 5 mappings:');
  mappingArray.slice(0, 5).forEach(m => {
    console.log(`  Franchise team ${m.franchiseTeam} → Roster team ${m.rosterTeam}`);
  });
}

buildTeamMapping().catch(console.error);
