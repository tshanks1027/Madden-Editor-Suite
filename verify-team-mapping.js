const TABLE_IDS = {
  teamTable: 637929298
};

async function checkMapping() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE');

  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  console.log('\n=== Team Index → Record Index Mapping ===');
  console.log('TeamIndex | RecordIndex | ShortName');
  console.log('----------|-------------|----------');

  const mapping = [];
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex >= 32) continue;
    mapping.push({ teamIndex: team.TeamIndex, recordIndex: team.index, name: team.ShortName });
  }

  // Sort by TeamIndex
  mapping.sort((a, b) => a.teamIndex - b.teamIndex);
  for (const m of mapping) {
    const ti = m.teamIndex.toString().padStart(2);
    const ri = m.recordIndex.toString().padStart(2);
    console.log(`    ${ti}    |      ${ri}     | ${m.name}`);
  }

  // Check specific values from 2024 schedule
  console.log('\n=== Verifying Schedule TeamIndex Values ===');

  // KC = TeamIndex 8 in schedule
  const kc = mapping.find(m => m.teamIndex === 8);
  console.log(`Schedule: homeTeamIndex=8 for Kansas City Chiefs`);
  console.log(`Mapping:  TeamIndex 8 -> RecordIndex ${kc?.recordIndex} (${kc?.name})`);
  console.log(`Expected: KC`);
  console.log(`Match: ${kc?.name === 'KC' ? 'YES' : 'NO'}`);

  // BAL = TeamIndex 25 in schedule
  const bal = mapping.find(m => m.teamIndex === 25);
  console.log(`\nSchedule: awayTeamIndex=25 for Baltimore Ravens`);
  console.log(`Mapping:  TeamIndex 25 -> RecordIndex ${bal?.recordIndex} (${bal?.name})`);
  console.log(`Expected: BAL`);
  console.log(`Match: ${bal?.name === 'BAL' ? 'YES' : 'NO'}`);

  // PHI = TeamIndex 13 in schedule
  const phi = mapping.find(m => m.teamIndex === 13);
  console.log(`\nSchedule: homeTeamIndex=13 for Philadelphia Eagles`);
  console.log(`Mapping:  TeamIndex 13 -> RecordIndex ${phi?.recordIndex} (${phi?.name})`);
  console.log(`Expected: PHI`);
  console.log(`Match: ${phi?.name === 'PHI' ? 'YES' : 'NO'}`);

  // GB = TeamIndex 20 in schedule
  const gb = mapping.find(m => m.teamIndex === 20);
  console.log(`\nSchedule: awayTeamIndex=20 for Green Bay Packers`);
  console.log(`Mapping:  TeamIndex 20 -> RecordIndex ${gb?.recordIndex} (${gb?.name})`);
  console.log(`Expected: GB`);
  console.log(`Match: ${gb?.name === 'GB' ? 'YES' : 'NO'}`);

  // ATL = TeamIndex 14 in schedule
  const atl = mapping.find(m => m.teamIndex === 14);
  console.log(`\nSchedule: homeTeamIndex=14 for Atlanta Falcons`);
  console.log(`Mapping:  TeamIndex 14 -> RecordIndex ${atl?.recordIndex} (${atl?.name})`);
  console.log(`Expected: ATL`);
  console.log(`Match: ${atl?.name === 'ATL' ? 'YES' : 'NO'}`);

  // PIT = TeamIndex 28 in schedule
  const pit = mapping.find(m => m.teamIndex === 28);
  console.log(`\nSchedule: awayTeamIndex=28 for Pittsburgh Steelers`);
  console.log(`Mapping:  TeamIndex 28 -> RecordIndex ${pit?.recordIndex} (${pit?.name})`);
  console.log(`Expected: PIT`);
  console.log(`Match: ${pit?.name === 'PIT' ? 'YES' : 'NO'}`);
}

checkMapping().catch(console.error);
