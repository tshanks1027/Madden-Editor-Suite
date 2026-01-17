/**
 * SIMPLE ROSTER SWAP: Browns ↔ Ravens
 * No ContractStatus, no schedule, just swap the Player[] arrays
 */
const fs = require('fs');

async function main() {
  const mf = await import('madden-franchise');

  // Fresh copy
  const src = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';
  const dst = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-SWAPTEST';
  fs.copyFileSync(src, dst);
  console.log('Copied to', dst);

  const franchise = await mf.create(dst);

  // Get Team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Find Browns (TeamIndex=4) and Ravens (TeamIndex=24)
  let brownsTeam, ravensTeam;
  for (const t of teamTable.records) {
    if (t.isEmpty) continue;
    if (Number(t.TeamIndex) === 4) brownsTeam = t;
    if (Number(t.TeamIndex) === 24) ravensTeam = t;
  }

  console.log('Browns:', brownsTeam?.ShortName);
  console.log('Ravens:', ravensTeam?.ShortName);

  // Get their roster refs
  const brownsRosterRef = brownsTeam.getReferenceDataByKey('Roster');
  const ravensRosterRef = ravensTeam.getReferenceDataByKey('Roster');

  console.log('Browns roster ref:', brownsRosterRef);
  console.log('Ravens roster ref:', ravensRosterRef);

  // Get roster array table
  const rosterTable = franchise.getTableById(brownsRosterRef.tableId);
  await rosterTable.readRecords();

  const brownsRoster = rosterTable.records[brownsRosterRef.rowNumber];
  const ravensRoster = rosterTable.records[ravensRosterRef.rowNumber];

  console.log('Browns roster size:', brownsRoster.arraySize);
  console.log('Ravens roster size:', ravensRoster.arraySize);

  // Save all Browns player refs
  const brownsPlayerRefs = [];
  for (let i = 0; i < brownsRoster.arraySize; i++) {
    brownsPlayerRefs.push(brownsRoster[`Player${i}`]);
  }
  const brownsSize = brownsRoster.arraySize;

  // Save all Ravens player refs
  const ravensPlayerRefs = [];
  for (let i = 0; i < ravensRoster.arraySize; i++) {
    ravensPlayerRefs.push(ravensRoster[`Player${i}`]);
  }
  const ravensSize = ravensRoster.arraySize;

  // SWAP: Put Ravens refs into Browns roster
  for (let i = 0; i < ravensPlayerRefs.length; i++) {
    brownsRoster[`Player${i}`] = ravensPlayerRefs[i];
  }
  brownsRoster.arraySize = ravensSize;
  rosterTable.arraySizes[brownsRosterRef.rowNumber] = ravensSize;
  brownsRoster.isChanged = true;
  brownsRoster._parent.onEvent('change', brownsRoster);

  // SWAP: Put Browns refs into Ravens roster
  for (let i = 0; i < brownsPlayerRefs.length; i++) {
    ravensRoster[`Player${i}`] = brownsPlayerRefs[i];
  }
  ravensRoster.arraySize = brownsSize;
  rosterTable.arraySizes[ravensRosterRef.rowNumber] = brownsSize;
  ravensRoster.isChanged = true;
  ravensRoster._parent.onEvent('change', ravensRoster);

  // Update TeamIndex on players
  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    const t = franchise.getAllTablesByName('Player');
    if (t?.length) playerTable = t[0];
  }
  await playerTable.readRecords();

  // Browns roster now has Ravens players - set their TeamIndex to 4
  for (let i = 0; i < ravensPlayerRefs.length; i++) {
    const ref = brownsRoster.getReferenceDataByKey(`Player${i}`);
    if (ref?.rowNumber !== undefined) {
      const p = playerTable.records[ref.rowNumber];
      if (p && !p.isEmpty) p.TeamIndex = 4;
    }
  }

  // Ravens roster now has Browns players - set their TeamIndex to 24
  for (let i = 0; i < brownsPlayerRefs.length; i++) {
    const ref = ravensRoster.getReferenceDataByKey(`Player${i}`);
    if (ref?.rowNumber !== undefined) {
      const p = playerTable.records[ref.rowNumber];
      if (p && !p.isEmpty) p.TeamIndex = 24;
    }
  }

  await franchise.save();
  console.log('\nSaved!');

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

  const bRef = b2.getReferenceDataByKey('Roster');
  const rRef = r2.getReferenceDataByKey('Roster');
  const rt2 = f2.getTableById(bRef.tableId);
  await rt2.readRecords();

  console.log('Browns roster size:', rt2.records[bRef.rowNumber].arraySize);
  console.log('Ravens roster size:', rt2.records[rRef.rowNumber].arraySize);

  let pt2 = f2.getTableByName('Player');
  if (!pt2) {
    const t = f2.getAllTablesByName('Player');
    if (t?.length) pt2 = t[0];
  }
  await pt2.readRecords();

  // Show first 3 players on each team
  console.log('\nBrowns first 3:');
  const br = rt2.records[bRef.rowNumber];
  for (let i = 0; i < Math.min(3, br.arraySize); i++) {
    const ref = br.getReferenceDataByKey(`Player${i}`);
    if (ref?.rowNumber !== undefined) {
      const p = pt2.records[ref.rowNumber];
      console.log(`  ${p.FirstName} ${p.LastName} TeamIndex=${p.TeamIndex}`);
    }
  }

  console.log('\nRavens first 3:');
  const rr = rt2.records[rRef.rowNumber];
  for (let i = 0; i < Math.min(3, rr.arraySize); i++) {
    const ref = rr.getReferenceDataByKey(`Player${i}`);
    if (ref?.rowNumber !== undefined) {
      const p = pt2.records[ref.rowNumber];
      console.log(`  ${p.FirstName} ${p.LastName} TeamIndex=${p.TeamIndex}`);
    }
  }

  console.log('\nTest file:', dst);
}

main().catch(console.error);
