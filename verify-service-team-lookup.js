/**
 * Verify how the RetroEditorService gets the Team table
 */
const { create } = require('madden-franchise');

const TABLE_IDS = {
  teamTable: 637929298
};

async function verifyLookup() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Simulate exactly what RetroEditorService does
  console.log('\n=== SIMULATING RetroEditorService TEAM TABLE LOOKUP ===');

  let teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  console.log('1. getTableByUniqueId(637929298):', teamTable ? 'FOUND' : 'NOT FOUND');

  if (!teamTable) {
    console.log('   Falling back to getTableByName...');
    teamTable = franchise.getTableByName('Team');
    console.log('2. getTableByName("Team"):', teamTable ? 'FOUND' : 'NOT FOUND');
  }

  if (teamTable) {
    await teamTable.readRecords();
    const nonEmpty = teamTable.records.filter(r => !r.isEmpty).length;
    console.log(`   Table has ${nonEmpty} non-empty records`);
    console.log(`   Table uniqueId: ${teamTable.header?.uniqueId}`);

    // Check if this is the correct table
    const firstNFL = teamTable.records.find(r => !r.isEmpty && r.TeamIndex < 32);
    if (firstNFL) {
      console.log(`   First NFL team: ${firstNFL.ShortName} (TeamIndex ${firstNFL.TeamIndex})`);
      console.log('   >>> THIS IS THE CORRECT TABLE');
    } else {
      console.log('   >>> WARNING: No NFL teams found - WRONG TABLE!');
    }
  }

  // Also check what happens with wrong ID
  console.log('\n=== CHECKING IF OLD WRONG ID WOULD FAIL ===');
  const wrongTable = franchise.getTableByUniqueId(2079398721);
  console.log('getTableByUniqueId(2079398721):', wrongTable ? 'FOUND' : 'NOT FOUND');

  if (wrongTable) {
    await wrongTable.readRecords();
    const nonEmpty = wrongTable.records.filter(r => !r.isEmpty).length;
    console.log(`   Table has ${nonEmpty} non-empty records`);
  }
}

verifyLookup().catch(console.error);
