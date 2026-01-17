/**
 * Test: Roster Manipulation (Remove + Add)
 *
 * Tests the shift-pad pattern for removing players and adding to new rosters.
 * This validates the core mechanics needed for expansion draft.
 */
const fs = require('fs');

const ZERO_REF = '00000000000000000000000000000000';
const TEAM_TABLE_ID = 637929298;

async function main() {
  const mf = await import('madden-franchise');

  // Work on a copy
  const src = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';
  const dst = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-ROSTERTEST';
  fs.copyFileSync(src, dst);
  console.log('Created test copy:', dst);

  const franchise = await mf.create(dst);

  // Get team table
  const teamTable = franchise.getTableByUniqueId(TEAM_TABLE_ID);
  await teamTable.readRecords();

  // Find two teams - let's use Bills (TeamIndex=3) and Jets (TeamIndex=2)
  let billsTeam, jetsTeam;
  for (const t of teamTable.records) {
    if (t.isEmpty) continue;
    const ti = Number(t.TeamIndex);
    if (ti === 3) billsTeam = t;
    if (ti === 2) jetsTeam = t;
  }

  console.log('\n=== TEAMS ===');
  console.log(`Bills: ${billsTeam?.ShortName}`);
  console.log(`Jets: ${jetsTeam?.ShortName}`);

  // Get roster refs
  const billsRosterRef = billsTeam.getReferenceDataByKey('Roster');
  const jetsRosterRef = jetsTeam.getReferenceDataByKey('Roster');

  console.log('\n=== ROSTER REFS ===');
  console.log(`Bills roster: tableId=${billsRosterRef.tableId}, row=${billsRosterRef.rowNumber}`);
  console.log(`Jets roster: tableId=${jetsRosterRef.tableId}, row=${jetsRosterRef.rowNumber}`);

  // Get roster table
  const rosterTable = franchise.getTableById(billsRosterRef.tableId);
  await rosterTable.readRecords();

  const billsRoster = rosterTable.records[billsRosterRef.rowNumber];
  const jetsRoster = rosterTable.records[jetsRosterRef.rowNumber];

  console.log('\n=== BEFORE ===');
  console.log(`Bills roster size: ${billsRoster.arraySize}`);
  console.log(`Jets roster size: ${jetsRoster.arraySize}`);

  // Get player table to show names
  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    const tables = franchise.getAllTablesByName('Player');
    if (tables?.length) playerTable = tables[0];
  }
  await playerTable.readRecords();

  // Get first player on Bills roster
  const firstBillsPlayerRef = billsRoster.Player0;
  const firstBillsPlayerRefData = billsRoster.getReferenceDataByKey('Player0');
  const firstBillsPlayer = playerTable.records[firstBillsPlayerRefData.rowNumber];

  console.log(`\nFirst Bills player: ${firstBillsPlayer.FirstName} ${firstBillsPlayer.LastName} (row ${firstBillsPlayerRefData.rowNumber})`);
  console.log(`Player ref: ${firstBillsPlayerRef}`);
  console.log(`Player TeamIndex: ${firstBillsPlayer.TeamIndex}`);

  // ==================== TEST REMOVE ====================
  console.log('\n=== TEST: REMOVE PLAYER FROM BILLS ===');

  // Collect all non-ZERO refs except the first player
  const remainingRefs = [];
  for (let i = 0; i < billsRoster.arraySize; i++) {
    const ref = billsRoster[`Player${i}`];
    if (i === 0) {
      console.log(`Skipping Player${i} (the one we're removing)`);
    } else if (ref && ref !== ZERO_REF) {
      remainingRefs.push(ref);
    }
  }

  console.log(`Remaining players: ${remainingRefs.length}`);

  // Shift remaining players down, pad with ZERO_REF
  const originalSize = billsRoster.arraySize;
  for (let i = 0; i < originalSize; i++) {
    if (i < remainingRefs.length) {
      billsRoster[`Player${i}`] = remainingRefs[i];
    } else {
      billsRoster[`Player${i}`] = ZERO_REF;
    }
  }

  // Update arraySize
  billsRoster.arraySize = remainingRefs.length;
  rosterTable.arraySizes[billsRosterRef.rowNumber] = remainingRefs.length;
  billsRoster.isChanged = true;
  billsRoster._parent.onEvent('change', billsRoster);

  console.log(`Bills new roster size: ${billsRoster.arraySize}`);

  // ==================== TEST ADD ====================
  console.log('\n=== TEST: ADD PLAYER TO JETS ===');

  const jetsSize = jetsRoster.arraySize;
  console.log(`Jets current size: ${jetsSize}`);

  // Add the player to Jets
  jetsRoster[`Player${jetsSize}`] = firstBillsPlayerRef;
  jetsRoster.arraySize = jetsSize + 1;
  rosterTable.arraySizes[jetsRosterRef.rowNumber] = jetsSize + 1;
  jetsRoster.isChanged = true;
  jetsRoster._parent.onEvent('change', jetsRoster);

  console.log(`Jets new roster size: ${jetsRoster.arraySize}`);

  // Update player's TeamIndex
  firstBillsPlayer.TeamIndex = 2; // Jets
  console.log(`Updated player TeamIndex to: ${firstBillsPlayer.TeamIndex}`);

  // ==================== SAVE ====================
  console.log('\n=== SAVING ===');
  await franchise.save();
  console.log('Saved!');

  // ==================== VERIFY ====================
  console.log('\n=== VERIFY (reload) ===');
  const f2 = await mf.create(dst);

  const tt2 = f2.getTableByUniqueId(TEAM_TABLE_ID);
  await tt2.readRecords();

  let bills2, jets2;
  for (const t of tt2.records) {
    if (t.isEmpty) continue;
    const ti = Number(t.TeamIndex);
    if (ti === 3) bills2 = t;
    if (ti === 2) jets2 = t;
  }

  const billsRef2 = bills2.getReferenceDataByKey('Roster');
  const jetsRef2 = jets2.getReferenceDataByKey('Roster');

  const rt2 = f2.getTableById(billsRef2.tableId);
  await rt2.readRecords();

  const billsRoster2 = rt2.records[billsRef2.rowNumber];
  const jetsRoster2 = rt2.records[jetsRef2.rowNumber];

  console.log(`Bills roster size after reload: ${billsRoster2.arraySize}`);
  console.log(`Jets roster size after reload: ${jetsRoster2.arraySize}`);

  // Check player table
  let pt2 = f2.getTableByName('Player');
  if (!pt2) {
    const tables = f2.getAllTablesByName('Player');
    if (tables?.length) pt2 = tables[0];
  }
  await pt2.readRecords();

  // Find moved player
  const movedPlayer = pt2.records[firstBillsPlayerRefData.rowNumber];
  console.log(`\nMoved player: ${movedPlayer.FirstName} ${movedPlayer.LastName}`);
  console.log(`TeamIndex after reload: ${movedPlayer.TeamIndex}`);

  // Check if player is on Jets roster
  let foundOnJets = false;
  for (let i = 0; i < jetsRoster2.arraySize; i++) {
    const ref = jetsRoster2[`Player${i}`];
    if (ref === firstBillsPlayerRef) {
      foundOnJets = true;
      console.log(`Found player on Jets roster at slot ${i}`);
      break;
    }
  }

  if (!foundOnJets) {
    console.log('WARNING: Player NOT found on Jets roster!');
  }

  // Check player NOT on Bills roster
  let foundOnBills = false;
  for (let i = 0; i < billsRoster2.arraySize; i++) {
    const ref = billsRoster2[`Player${i}`];
    if (ref === firstBillsPlayerRef) {
      foundOnBills = true;
      console.log(`WARNING: Player still on Bills roster at slot ${i}!`);
      break;
    }
  }

  if (!foundOnBills) {
    console.log('Confirmed: Player removed from Bills roster');
  }

  console.log('\n=== TEST COMPLETE ===');
  console.log('Test file:', dst);

  if (foundOnJets && !foundOnBills && movedPlayer.TeamIndex === 2) {
    console.log('SUCCESS: Roster manipulation works correctly!');
  } else {
    console.log('FAILURE: Something went wrong');
  }
}

main().catch(console.error);
