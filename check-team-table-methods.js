// Check different ways to access Team table

const TABLE_IDS = {
  teamTable: 637929298
};

async function checkTeamTableMethods() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE', {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  console.log('=== Method 1: getTableByUniqueId ===\n');
  const teamById = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  if (teamById) {
    await teamById.readRecords();
    console.log(`Found table: ${teamById.name}`);
    console.log(`Record count: ${teamById.records.length}`);
    console.log('First 5 teams:');
    let count = 0;
    for (const team of teamById.records) {
      if (team.isEmpty) continue;
      if (team.TeamIndex === undefined || team.TeamIndex >= 32) continue;
      count++;
      console.log(`  ${team.index}: TeamIndex ${team.TeamIndex} - ${team.ShortName} (${team.LongName})`);
      if (count >= 5) break;
    }
  } else {
    console.log('Table NOT found by UniqueId');
  }

  console.log('\n=== Method 2: getTableByName("Team") ===\n');
  const teamByName = franchise.getTableByName('Team');
  if (teamByName) {
    await teamByName.readRecords();
    console.log(`Found table: ${teamByName.name}`);
    console.log(`UniqueId: ${teamByName.uniqueId}`);
    console.log(`Record count: ${teamByName.records.length}`);
    console.log('First 5 non-empty records:');
    let count = 0;
    for (const team of teamByName.records) {
      if (team.isEmpty) continue;
      count++;
      console.log(`  ${team.index}: TeamIndex ${team.TeamIndex} - ${team.ShortName} (${team.LongName})`);
      if (count >= 5) break;
    }
  } else {
    console.log('Table NOT found by name');
  }

  console.log('\n=== Method 3: Search all tables for "Team" ===\n');
  const teamTables = [];
  for (const table of franchise.tables) {
    if (table.name === 'Team') {
      teamTables.push({
        name: table.name,
        uniqueId: table.uniqueId,
        recordCount: table.records?.length || 'not loaded'
      });
    }
  }
  console.log(`Found ${teamTables.length} tables named "Team":`);
  for (const t of teamTables) {
    console.log(`  Name: ${t.name}, UniqueId: ${t.uniqueId}, Records: ${t.recordCount}`);
  }
}

checkTeamTableMethods().catch(console.error);
