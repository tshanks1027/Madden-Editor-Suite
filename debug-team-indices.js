/**
 * Debug: Show all team indices and their record positions
 */
async function main() {
  const mf = await import('madden-franchise');
  const franchise = await mf.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09');

  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  console.log('=== TEAM TABLE: Record Index -> TeamIndex -> Name ===\n');

  for (let i = 0; i < teamTable.records.length; i++) {
    const t = teamTable.records[i];
    if (t.isEmpty) continue;
    const ti = Number(t.TeamIndex);
    const name = t.ShortName || t.DisplayName || 'Unknown';
    const rosterRef = t.getReferenceDataByKey('Roster');
    console.log(`records[${i}]: TeamIndex=${ti} (${name}) -> Roster rowNumber=${rosterRef?.rowNumber}`);
  }

  console.log('\n=== KEY TEAMS ===');
  for (let i = 0; i < teamTable.records.length; i++) {
    const t = teamTable.records[i];
    if (t.isEmpty) continue;
    const ti = Number(t.TeamIndex);
    if (ti === 4 || ti === 24 || ti === 29) {
      const name = t.ShortName || 'Unknown';
      const rosterRef = t.getReferenceDataByKey('Roster');
      console.log(`TeamIndex=${ti} (${name}): record[${i}], Roster rowNumber=${rosterRef?.rowNumber}`);
    }
  }
}

main().catch(console.error);
