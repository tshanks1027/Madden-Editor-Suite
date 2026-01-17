/**
 * Verify which Team table the lookup methods return
 */
const { create } = require('madden-franchise');

async function verifyTeamTableLookup() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Try by unique ID (correct ID)
  console.log('\n=== getTableByUniqueId(637929298) ===');
  const byCorrectId = franchise.getTableByUniqueId(637929298);
  if (byCorrectId) {
    await byCorrectId.readRecords();
    const nonEmpty = byCorrectId.records.filter(r => !r.isEmpty).length;
    console.log(`Found! Name: ${byCorrectId.name}, Records: ${nonEmpty}`);
    // Show first team
    const first = byCorrectId.records.find(r => !r.isEmpty && r.TeamIndex < 32);
    if (first) {
      console.log(`First NFL team: ${first.ShortName} (TeamIndex ${first.TeamIndex})`);
    }
  } else {
    console.log('NOT FOUND');
  }

  // Try by name
  console.log('\n=== getTableByName("Team") ===');
  const byName = franchise.getTableByName('Team');
  if (byName) {
    await byName.readRecords();
    const nonEmpty = byName.records.filter(r => !r.isEmpty).length;
    console.log(`Found! Name: ${byName.name}, Records: ${nonEmpty}`);
    console.log(`UniqueId: ${byName.header?.uniqueId}`);
    // Show first team
    const first = byName.records.find(r => !r.isEmpty);
    if (first) {
      console.log(`First team: ${first.ShortName} (TeamIndex ${first.TeamIndex})`);
    }
  } else {
    console.log('NOT FOUND');
  }

  // Try by old wrong ID
  console.log('\n=== getTableByUniqueId(2079398721) [OLD WRONG ID] ===');
  const byOldId = franchise.getTableByUniqueId(2079398721);
  if (byOldId) {
    await byOldId.readRecords();
    const nonEmpty = byOldId.records.filter(r => !r.isEmpty).length;
    console.log(`Found! Name: ${byOldId.name}, Records: ${nonEmpty}`);
  } else {
    console.log('NOT FOUND');
  }

  // Count all tables named "Team"
  console.log('\n=== All tables with "Team" in name (exact match) ===');
  for (const table of franchise.tables) {
    if (table.name === 'Team') {
      const uid = table.header?.uniqueId;
      const tid = table.header?.tableId;
      console.log(`- Team (uniqueId: ${uid}, tableId: ${tid})`);
    }
  }

  // Check what happens when we build the team mapping
  console.log('\n=== BUILDING TEAM INDEX MAPPING ===');
  const correctTable = franchise.getTableByUniqueId(637929298);
  if (correctTable) {
    await correctTable.readRecords();

    const teamIndexToRecordIndex = new Map();
    for (const team of correctTable.records) {
      if (team.isEmpty) continue;
      const teamIndex = team.TeamIndex;
      if (teamIndex !== undefined && teamIndex < 32) {
        teamIndexToRecordIndex.set(teamIndex, team.index);
        console.log(`TeamIndex ${teamIndex} -> Record ${team.index}: ${team.ShortName}`);
      }
    }
    console.log(`\nBuilt mapping for ${teamIndexToRecordIndex.size} NFL teams`);
  }
}

verifyTeamTableLookup().catch(console.error);
