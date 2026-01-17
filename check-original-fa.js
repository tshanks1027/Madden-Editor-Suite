/**
 * Check how FA works in the ORIGINAL file (before my changes)
 */
async function main() {
  const mf = await import('madden-franchise');
  const f = await mf.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09');

  const teamTable = f.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  let playerTable = f.getTableByName('Player');
  if (!playerTable) {
    const t = f.getAllTablesByName('Player');
    if (t?.length) playerTable = t[0];
  }
  await playerTable.readRecords();

  // Count TeamIndex=32 in original
  let faCount = 0;
  for (const p of playerTable.records) {
    if (p.isEmpty) continue;
    if (Number(p.TeamIndex) === 32) faCount++;
  }
  console.log('Original file: TeamIndex=32 players:', faCount);

  // Check AFC/NFC/FA roster arrays
  console.log('\nTeamIndex=32 teams:');
  for (const t of teamTable.records) {
    if (t.isEmpty) continue;
    if (Number(t.TeamIndex) === 32) {
      const name = t.ShortName || t.DisplayName || 'Unknown';
      const rosterRef = t.getReferenceDataByKey('Roster');
      console.log(`${name}: tableId=${rosterRef?.tableId}, rowNumber=${rosterRef?.rowNumber}`);

      if (rosterRef?.tableId && rosterRef.tableId !== 0) {
        const rt = f.getTableById(rosterRef.tableId);
        await rt.readRecords();
        const roster = rt.records[rosterRef.rowNumber];
        console.log(`  arraySize=${roster?.arraySize || 0}`);
      } else {
        console.log('  NO ROSTER ARRAY');
      }
    }
  }
}
main();
