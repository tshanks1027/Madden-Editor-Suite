/**
 * Fix schedule: Replace Browns (TeamIndex=4) with Ravens (TeamIndex=24)
 */

async function main() {
  const mf = await import('madden-franchise');
  const franchise = await mf.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-RELOCTEST3');

  // Get Team table first to find record indices
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Find Browns and Ravens record indices (not TeamIndex!)
  let brownsRecIdx = -1, ravensRecIdx = -1;
  for (let i = 0; i < teamTable.records.length; i++) {
    const t = teamTable.records[i];
    if (t.isEmpty) continue;
    if (Number(t.TeamIndex) === 4) brownsRecIdx = i;
    if (Number(t.TeamIndex) === 24) ravensRecIdx = i;
  }

  console.log(`Browns record index: ${brownsRecIdx}`);
  console.log(`Ravens record index: ${ravensRecIdx}`);

  if (brownsRecIdx < 0 || ravensRecIdx < 0) {
    console.log('Could not find team records');
    return;
  }

  // Get Ravens reference
  const ravensRef = teamTable.getBinaryReferenceToRecord(ravensRecIdx);

  const scheduleTable = franchise.getTableByName('SeasonGame');
  await scheduleTable.readRecords();

  let updated = 0;
  for (const game of scheduleTable.records) {
    if (game.isEmpty) continue;

    // Check HomeTeam
    const homeRef = game.getReferenceDataByKey('HomeTeam');
    if (homeRef && homeRef.rowNumber === brownsRecIdx) {
      game.HomeTeam = ravensRef;
      updated++;
    }

    // Check AwayTeam
    const awayRef = game.getReferenceDataByKey('AwayTeam');
    if (awayRef && awayRef.rowNumber === brownsRecIdx) {
      game.AwayTeam = ravensRef;
      updated++;
    }
  }

  console.log(`Updated ${updated} team references in schedule`);

  await franchise.save();
  console.log('Saved');

  // Verify
  const f2 = await mf.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-RELOCTEST3');
  const st2 = f2.getTableByName('SeasonGame');
  await st2.readRecords();

  let browns = 0, ravens = 0;
  for (const g of st2.records) {
    if (g.isEmpty) continue;
    const h = g.getReferenceDataByKey('HomeTeam');
    const a = g.getReferenceDataByKey('AwayTeam');
    if (h?.rowNumber === brownsRecIdx || a?.rowNumber === brownsRecIdx) browns++;
    if (h?.rowNumber === ravensRecIdx || a?.rowNumber === ravensRecIdx) ravens++;
  }

  console.log(`\nAfter: Browns games=${browns}, Ravens games=${ravens}`);
}

main().catch(console.error);
