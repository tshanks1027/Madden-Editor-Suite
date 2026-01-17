/**
 * SIMPLE relocation: Browns → Ravens, Ravens → FA
 * FA has no roster array - just TeamIndex=32
 */

const fs = require('fs');

async function main() {
  const mf = await import('madden-franchise');

  // Work on a copy
  const src = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';
  const dst = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-RELOCTEST3';
  fs.copyFileSync(src, dst);
  console.log('Copied to', dst);

  const franchise = await mf.create(dst);

  // Get tables
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    const t = franchise.getAllTablesByName('Player');
    if (t?.length) playerTable = t[0];
  }
  await playerTable.readRecords();

  // Find Browns (4) and Ravens (24) team records
  let brownsTeam, ravensTeam;
  for (const t of teamTable.records) {
    if (t.isEmpty) continue;
    if (Number(t.TeamIndex) === 4) brownsTeam = t;
    if (Number(t.TeamIndex) === 24) ravensTeam = t;
  }

  // Get roster refs
  const brownsRef = brownsTeam.getReferenceDataByKey('Roster');
  const ravensRef = ravensTeam.getReferenceDataByKey('Roster');

  console.log('Browns roster:', brownsRef);
  console.log('Ravens roster:', ravensRef);

  // Get roster array table
  const rosterTable = franchise.getTableById(brownsRef.tableId);
  await rosterTable.readRecords();

  const brownsRoster = rosterTable.records[brownsRef.rowNumber];
  const ravensRoster = rosterTable.records[ravensRef.rowNumber];

  console.log('Browns arraySize:', brownsRoster.arraySize);
  console.log('Ravens arraySize:', ravensRoster.arraySize);

  // Step 1: Set Ravens players to FA (TeamIndex=32)
  console.log('\n1. Setting Ravens players to FA...');
  for (let i = 0; i < ravensRoster.arraySize; i++) {
    const ref = ravensRoster.getReferenceDataByKey(`Player${i}`);
    if (ref?.rowNumber !== undefined) {
      const p = playerTable.records[ref.rowNumber];
      if (p && !p.isEmpty) p.TeamIndex = 32;
    }
  }

  // Step 2: Copy Browns refs to Ravens roster
  console.log('2. Copying Browns refs to Ravens roster...');
  const brownsCount = brownsRoster.arraySize;
  for (let i = 0; i < brownsCount; i++) {
    ravensRoster[`Player${i}`] = brownsRoster[`Player${i}`];
  }

  // Step 3: Update Ravens arraySize
  console.log('3. Setting Ravens arraySize...');
  ravensRoster.arraySize = brownsCount;
  rosterTable.arraySizes[ravensRef.rowNumber] = brownsCount;
  ravensRoster.isChanged = true;
  ravensRoster._parent.onEvent('change', ravensRoster);

  // Step 4: Clear Browns roster
  console.log('4. Clearing Browns roster...');
  brownsRoster.arraySize = 0;
  rosterTable.arraySizes[brownsRef.rowNumber] = 0;
  brownsRoster.isChanged = true;
  brownsRoster._parent.onEvent('change', brownsRoster);

  // Step 5: Set Browns players to Ravens TeamIndex
  console.log('5. Setting Browns players TeamIndex to 24...');
  for (let i = 0; i < brownsCount; i++) {
    const ref = ravensRoster.getReferenceDataByKey(`Player${i}`);
    if (ref?.rowNumber !== undefined) {
      const p = playerTable.records[ref.rowNumber];
      if (p && !p.isEmpty) p.TeamIndex = 24;
    }
  }

  // Save
  console.log('\nSaving...');
  await franchise.save();

  // Verify
  console.log('\n=== VERIFY ===');
  const f2 = await mf.create(dst);
  const tt2 = f2.getTableByUniqueId(637929298);
  await tt2.readRecords();

  let b2, r2;
  for (const t of tt2.records) {
    if (t.isEmpty) continue;
    if (Number(t.TeamIndex) === 4) b2 = t;
    if (Number(t.TeamIndex) === 24) r2 = t;
  }

  const rt2 = f2.getTableById(brownsRef.tableId);
  await rt2.readRecords();

  const br2 = rt2.records[brownsRef.rowNumber];
  const rr2 = rt2.records[ravensRef.rowNumber];

  let pt2 = f2.getTableByName('Player');
  if (!pt2) {
    const t = f2.getAllTablesByName('Player');
    if (t?.length) pt2 = t[0];
  }
  await pt2.readRecords();

  console.log('Browns arraySize:', br2.arraySize);
  console.log('Ravens arraySize:', rr2.arraySize);

  console.log('\nRavens first 3 players:');
  for (let i = 0; i < Math.min(3, rr2.arraySize); i++) {
    const ref = rr2.getReferenceDataByKey(`Player${i}`);
    if (ref?.rowNumber !== undefined) {
      const p = pt2.records[ref.rowNumber];
      console.log(`  ${p.FirstName} ${p.LastName} TeamIndex=${p.TeamIndex}`);
    }
  }

  // Count players by TeamIndex
  let count24 = 0, count32 = 0, count4 = 0;
  for (const p of pt2.records) {
    if (p.isEmpty) continue;
    const ti = Number(p.TeamIndex);
    if (ti === 4) count4++;
    if (ti === 24) count24++;
    if (ti === 32) count32++;
  }
  console.log(`\nTeamIndex=4 (Browns): ${count4}`);
  console.log(`TeamIndex=24 (Ravens): ${count24}`);
  console.log(`TeamIndex=32 (FA): ${count32}`);

  console.log('\nDone. Test file:', dst);
}

main().catch(console.error);
