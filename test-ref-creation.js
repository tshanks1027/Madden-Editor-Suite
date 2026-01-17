// Test the team reference creation logic

const TABLE_IDS = {
  teamTable: 637929298
};

async function testRefCreation() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE', {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  // Build TeamIndex → RecordIndex mapping
  const teamIndexToRecordIndex = new Map();

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      teamIndexToRecordIndex.set(teamIndex, team.index);
    }
  }

  // Simulate the createTeamRef function
  const teamRefPrefix = '001011100011101000000000'; // Default prefix

  const createTeamRef = (teamIndex) => {
    const recordIndex = teamIndexToRecordIndex.get(teamIndex);
    if (recordIndex === undefined) {
      console.warn(`No record index for TeamIndex ${teamIndex}`);
      return '00000000000000000000000000000000';
    }
    return teamRefPrefix + recordIndex.toString(2).padStart(8, '0');
  };

  // Test with Week 1 Game 1: BAL (24) @ KC (8)
  console.log('=== Testing Team Reference Creation ===\n');

  const testCases = [
    { teamIndex: 8, expected: 'KC' },
    { teamIndex: 24, expected: 'BAL' },
    { teamIndex: 12, expected: 'PHI' },
    { teamIndex: 19, expected: 'GB' },
    { teamIndex: 13, expected: 'ATL' },
    { teamIndex: 28, expected: 'PIT' }
  ];

  for (const { teamIndex, expected } of testCases) {
    const recordIndex = teamIndexToRecordIndex.get(teamIndex);
    const ref = createTeamRef(teamIndex);
    const lastByte = ref.slice(-8);
    const parsedRecordIndex = parseInt(lastByte, 2);

    console.log(`TeamIndex ${teamIndex} (${expected}):`);
    console.log(`  RecordIndex in map: ${recordIndex}`);
    console.log(`  Full ref: ${ref}`);
    console.log(`  Last 8 bits: ${lastByte} = ${parsedRecordIndex}`);
    console.log(`  Match: ${recordIndex === parsedRecordIndex ? 'YES ✓' : 'NO ✗'}`);
    console.log('');
  }

  // Now let's see what the first game looks like with these references
  console.log('=== Example Game Reference ===\n');
  console.log('Game: BAL @ KC');
  console.log(`Home (KC, TeamIndex 8): ${createTeamRef(8)}`);
  console.log(`Away (BAL, TeamIndex 24): ${createTeamRef(24)}`);
}

testRefCreation().catch(console.error);
