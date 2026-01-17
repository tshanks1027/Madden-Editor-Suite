// Script to extract correct Madden TeamIndex values from franchise file
// This will help fix historical-teams.json

const TABLE_IDS = {
  teamTable: 637929298
};

async function extractTeamIndices() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE');

  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  console.log('=== Correct Madden Team Indices ===\n');
  console.log('Use these TeamIndex values in historical-teams.json:\n');

  const teams = [];
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex >= 32) continue; // Skip AFC, NFC, FA

    teams.push({
      teamIndex: team.TeamIndex,
      shortName: team.ShortName,
      longName: team.LongName,
      displayName: team.DisplayName || team.LongName
    });
  }

  // Sort by shortName alphabetically for comparison
  teams.sort((a, b) => a.shortName.localeCompare(b.shortName));

  console.log('Sorted by abbreviation:');
  console.log('TeamIndex | Abbr | LongName');
  console.log('----------|------|----------');
  for (const t of teams) {
    console.log(`    ${t.teamIndex.toString().padStart(2)}    | ${t.shortName.padEnd(4)} | ${t.longName}`);
  }

  // Now sort by TeamIndex
  teams.sort((a, b) => a.teamIndex - b.teamIndex);

  console.log('\n\nSorted by TeamIndex:');
  console.log('TeamIndex | Abbr | LongName');
  console.log('----------|------|----------');
  for (const t of teams) {
    console.log(`    ${t.teamIndex.toString().padStart(2)}    | ${t.shortName.padEnd(4)} | ${t.longName}`);
  }

  // Output JSON-style for easy copy-paste
  console.log('\n\n=== JSON Format for historical-teams.json ===\n');
  for (const t of teams) {
    console.log(`    { "teamIndex": ${t.teamIndex}, "currentName": "${t.longName.split(' ').pop()}", "currentCity": "${t.longName.split(' ').slice(0, -1).join(' ')}", "abbreviation": "${t.shortName}" },`);
  }
}

extractTeamIndices().catch(console.error);
