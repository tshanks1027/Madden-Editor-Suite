// Explore Team table fields to understand what each one is

const TABLE_IDS = {
  teamTable: 637929298
};

async function exploreTeamFields() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE', {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  console.log('=== Team Table Fields ===\n');

  // Get first non-empty team
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex >= 32) continue; // Skip AFC, NFC, FA

    console.log(`Team: ${team.LongName} (TeamIndex: ${team.TeamIndex})`);
    console.log(`  ShortName: "${team.ShortName}"`);
    console.log(`  NickName: "${team.NickName}"`);
    console.log(`  DisplayName: "${team.DisplayName}"`);
    console.log(`  LongName: "${team.LongName}"`);
    console.log('');

    // Only show first 5 teams to understand the pattern
    if (team.TeamIndex >= 4) break;
  }

  // Show all team abbreviations
  console.log('\n=== All Team Abbreviations (ShortName) ===\n');
  const teams = [];
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex >= 32) continue;
    teams.push({
      index: team.TeamIndex,
      shortName: team.ShortName,
      nickName: team.NickName,
      longName: team.LongName
    });
  }
  teams.sort((a, b) => a.index - b.index);

  for (const t of teams) {
    console.log(`${t.index.toString().padStart(2)}: ${t.shortName.padEnd(4)} | ${t.nickName.padEnd(12)} | ${t.longName}`);
  }
}

exploreTeamFields().catch(console.error);
