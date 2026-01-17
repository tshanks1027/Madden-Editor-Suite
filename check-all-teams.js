// Check all teams and their record indices

async function checkAllTeams() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  console.log('=== All Teams (recordIndex -> TeamIndex -> name) ===\n');

  const teams = [];
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex !== undefined && team.TeamIndex < 32) {
      teams.push({
        recordIndex: team.index,
        teamIndex: team.TeamIndex,
        name: team.ShortName,
        city: team.LongName
      });
    }
  }

  // Sort by teamIndex
  teams.sort((a, b) => a.teamIndex - b.teamIndex);

  console.log('TeamIndex | RecordIndex | Name | City');
  console.log('---------|-------------|------|------');
  for (const t of teams) {
    console.log(`${t.teamIndex.toString().padStart(8)} | ${t.recordIndex.toString().padStart(11)} | ${t.name.padEnd(4)} | ${t.city}`);
  }

  // Find Giants and Browns specifically
  console.log('\n=== Browns and Giants ===');
  const browns = teams.find(t => t.name === 'CLE');
  const giants = teams.find(t => t.name === 'NYG');
  console.log('Browns:', browns);
  console.log('Giants:', giants);
}

checkAllTeams().catch(console.error);
