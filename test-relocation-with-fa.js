/**
 * PROPER Roster Relocation Test - WITH Free Agent roster array update
 *
 * Moves Browns → Ravens AND puts Ravens players in Free Agent roster array
 */

const fs = require('fs');

const FREE_AGENT_TEAM_INDEX = 32;
const SOURCE_TEAM_INDEX = 4;  // Browns
const DEST_TEAM_INDEX = 24;   // Ravens

async function main() {
  const mf = await import('madden-franchise');

  // Copy the working 2011 file to a test location
  const sourceFile = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';
  const testFile = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-RELOCATIONTEST2';

  console.log('=== ROSTER RELOCATION TEST (with FA roster) ===\n');
  console.log(`Copying ${sourceFile}`);
  console.log(`     to ${testFile}\n`);
  fs.copyFileSync(sourceFile, testFile);

  const franchise = await mf.create(testFile);

  console.log(`Moving Team ${SOURCE_TEAM_INDEX} (Browns) → Team ${DEST_TEAM_INDEX} (Ravens)\n`);

  // Get Team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Get Player table
  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    const tables = franchise.getAllTablesByName('Player');
    if (tables && tables.length > 0) playerTable = tables[0];
  }
  await playerTable.readRecords();

  // Find team records
  let sourceTeamRecord = null;
  let destTeamRecord = null;
  let faTeamRecord = null;
  const teamNameMap = new Map();

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIdx = Number(team.TeamIndex);
    if (teamIdx !== undefined && teamIdx < 34) {
      teamNameMap.set(teamIdx, team.ShortName || team.DisplayName || `Team ${teamIdx}`);
    }
    if (teamIdx === SOURCE_TEAM_INDEX) sourceTeamRecord = team;
    if (teamIdx === DEST_TEAM_INDEX) destTeamRecord = team;
    if (teamIdx === FREE_AGENT_TEAM_INDEX) faTeamRecord = team;
  }

  if (!sourceTeamRecord || !destTeamRecord) {
    console.error('Could not find team records!');
    return;
  }

  const sourceTeamName = teamNameMap.get(SOURCE_TEAM_INDEX);
  const destTeamName = teamNameMap.get(DEST_TEAM_INDEX);
  console.log(`Source: ${sourceTeamName} (TeamIndex=${SOURCE_TEAM_INDEX})`);
  console.log(`Dest: ${destTeamName} (TeamIndex=${DEST_TEAM_INDEX})`);

  // Get Roster references
  const sourceRosterRef = sourceTeamRecord.getReferenceDataByKey('Roster');
  const destRosterRef = destTeamRecord.getReferenceDataByKey('Roster');
  const faRosterRef = faTeamRecord ? faTeamRecord.getReferenceDataByKey('Roster') : null;

  console.log(`\nSource roster ref: tableId=${sourceRosterRef?.tableId}, rowNumber=${sourceRosterRef?.rowNumber}`);
  console.log(`Dest roster ref: tableId=${destRosterRef?.tableId}, rowNumber=${destRosterRef?.rowNumber}`);
  console.log(`Free Agent roster ref: tableId=${faRosterRef?.tableId}, rowNumber=${faRosterRef?.rowNumber}`);

  // Get Player[] array table
  const rosterArrayTable = franchise.getTableById(sourceRosterRef.tableId);
  await rosterArrayTable.readRecords();

  console.log(`\nRoster array table: ${rosterArrayTable.name}, ${rosterArrayTable.records.length} records`);

  // Get roster array records
  const sourceRoster = rosterArrayTable.records[sourceRosterRef.rowNumber];
  const destRoster = rosterArrayTable.records[destRosterRef.rowNumber];
  const faRoster = faRosterRef ? rosterArrayTable.records[faRosterRef.rowNumber] : null;

  const sourceArraySize = sourceRoster.arraySize || 0;
  const destArraySize = destRoster.arraySize || 0;
  const faArraySize = faRoster ? (faRoster.arraySize || 0) : 0;

  console.log(`\n=== BEFORE ===`);
  console.log(`${sourceTeamName} roster arraySize: ${sourceArraySize}`);
  console.log(`${destTeamName} roster arraySize: ${destArraySize}`);
  console.log(`Free Agents roster arraySize: ${faArraySize}`);

  // Show first 3 players from each roster
  console.log(`\n${sourceTeamName} first 3 players:`);
  for (let i = 0; i < Math.min(3, sourceArraySize); i++) {
    const playerRef = sourceRoster.getReferenceDataByKey(`Player${i}`);
    if (playerRef?.rowNumber !== undefined) {
      const p = playerTable.records[playerRef.rowNumber];
      if (p && !p.isEmpty) console.log(`  ${p.FirstName} ${p.LastName}`);
    }
  }

  console.log(`\n${destTeamName} first 3 players:`);
  for (let i = 0; i < Math.min(3, destArraySize); i++) {
    const playerRef = destRoster.getReferenceDataByKey(`Player${i}`);
    if (playerRef?.rowNumber !== undefined) {
      const p = playerTable.records[playerRef.rowNumber];
      if (p && !p.isEmpty) console.log(`  ${p.FirstName} ${p.LastName}`);
    }
  }

  // Collect source player references (Browns)
  const sourcePlayerNames = [];
  const sourcePlayerRefs = [];
  const sourcePlayerIndices = [];

  for (let i = 0; i < sourceArraySize; i++) {
    const fieldName = `Player${i}`;
    try {
      const playerRef = sourceRoster.getReferenceDataByKey(fieldName);
      if (playerRef && playerRef.rowNumber !== undefined) {
        const player = playerTable.records[playerRef.rowNumber];
        if (player && !player.isEmpty) {
          sourcePlayerNames.push(`${player.FirstName} ${player.LastName}`);
          sourcePlayerIndices.push(playerRef.rowNumber);
          sourcePlayerRefs.push(sourceRoster[fieldName]);
        }
      }
    } catch (e) { }
  }

  // Collect dest player references (Ravens - will go to FA)
  const destPlayerRefs = [];
  const destPlayerIndices = [];

  for (let i = 0; i < destArraySize; i++) {
    const fieldName = `Player${i}`;
    try {
      const playerRef = destRoster.getReferenceDataByKey(fieldName);
      if (playerRef && playerRef.rowNumber !== undefined) {
        const player = playerTable.records[playerRef.rowNumber];
        if (player && !player.isEmpty) {
          destPlayerIndices.push(playerRef.rowNumber);
          destPlayerRefs.push(destRoster[fieldName]);
        }
      }
    } catch (e) { }
  }

  console.log(`\nCollected ${sourcePlayerRefs.length} player refs from ${sourceTeamName}`);
  console.log(`Collected ${destPlayerRefs.length} player refs from ${destTeamName} (will go to FA)`);

  // ===== STEP 1: Add dest players (Ravens) to Free Agent roster array =====
  console.log(`\n--- Step 1: Adding ${destTeamName} players to Free Agent roster array ---`);

  // Add Ravens players to the end of FA roster
  const newFASize = faArraySize + destPlayerRefs.length;
  for (let i = 0; i < destPlayerRefs.length; i++) {
    const fieldName = `Player${faArraySize + i}`;
    faRoster[fieldName] = destPlayerRefs[i];
  }

  // Update FA roster arraySize
  faRoster.arraySize = newFASize;
  rosterArrayTable.arraySizes[faRosterRef.rowNumber] = newFASize;
  faRoster.isChanged = true;
  faRoster._parent.onEvent('change', faRoster);

  // Update TeamIndex for Ravens players
  for (const playerIdx of destPlayerIndices) {
    const player = playerTable.records[playerIdx];
    if (player && !player.isEmpty) {
      player.TeamIndex = FREE_AGENT_TEAM_INDEX;
    }
  }
  console.log(`Added ${destPlayerRefs.length} players to FA roster (new size: ${newFASize})`);

  // ===== STEP 2: Copy source (Browns) refs to dest (Ravens) roster =====
  console.log(`\n--- Step 2: Copying ${sourceTeamName} refs to ${destTeamName} roster ---`);
  for (let i = 0; i < sourcePlayerRefs.length; i++) {
    const fieldName = `Player${i}`;
    destRoster[fieldName] = sourcePlayerRefs[i];
  }
  console.log(`Copied ${sourcePlayerRefs.length} player references`);

  // ===== STEP 3: Update dest roster arraySize =====
  console.log(`\n--- Step 3: Updating ${destTeamName} roster arraySize ---`);
  destRoster.arraySize = sourcePlayerRefs.length;
  rosterArrayTable.arraySizes[destRosterRef.rowNumber] = sourcePlayerRefs.length;
  destRoster.isChanged = true;
  destRoster._parent.onEvent('change', destRoster);
  console.log(`Set ${destTeamName} roster arraySize to ${sourcePlayerRefs.length}`);

  // ===== STEP 4: Clear source roster =====
  console.log(`\n--- Step 4: Clearing ${sourceTeamName} roster ---`);
  sourceRoster.arraySize = 0;
  rosterArrayTable.arraySizes[sourceRosterRef.rowNumber] = 0;
  sourceRoster.isChanged = true;
  sourceRoster._parent.onEvent('change', sourceRoster);
  console.log(`Set ${sourceTeamName} roster arraySize to 0`);

  // ===== STEP 5: Update TeamIndex for Browns players =====
  console.log(`\n--- Step 5: Updating ${sourceTeamName} players TeamIndex ---`);
  for (const playerIdx of sourcePlayerIndices) {
    const player = playerTable.records[playerIdx];
    if (player && !player.isEmpty) {
      player.TeamIndex = DEST_TEAM_INDEX;
    }
  }
  console.log(`Updated ${sourcePlayerIndices.length} players to TeamIndex=${DEST_TEAM_INDEX}`);

  // ===== SAVE =====
  console.log(`\n--- Saving file ---`);
  await franchise.save();
  console.log('File saved!');

  // ===== VERIFY =====
  console.log(`\n=== VERIFICATION (re-reading file) ===`);
  const franchise2 = await mf.create(testFile);
  const teamTable2 = franchise2.getTableByUniqueId(637929298);
  await teamTable2.readRecords();

  let sourceTeam2 = null;
  let destTeam2 = null;
  let faTeam2 = null;
  for (const team of teamTable2.records) {
    if (team.isEmpty) continue;
    if (Number(team.TeamIndex) === SOURCE_TEAM_INDEX) sourceTeam2 = team;
    if (Number(team.TeamIndex) === DEST_TEAM_INDEX) destTeam2 = team;
    if (Number(team.TeamIndex) === FREE_AGENT_TEAM_INDEX) faTeam2 = team;
  }

  const rosterArrayTable2 = franchise2.getTableById(sourceRosterRef.tableId);
  await rosterArrayTable2.readRecords();

  const sourceRosterRef2 = sourceTeam2.getReferenceDataByKey('Roster');
  const destRosterRef2 = destTeam2.getReferenceDataByKey('Roster');
  const faRosterRef2 = faTeam2 ? faTeam2.getReferenceDataByKey('Roster') : null;

  const sourceRoster2 = rosterArrayTable2.records[sourceRosterRef2.rowNumber];
  const destRoster2 = rosterArrayTable2.records[destRosterRef2.rowNumber];
  const faRoster2 = faRosterRef2 ? rosterArrayTable2.records[faRosterRef2.rowNumber] : null;

  let playerTable2 = franchise2.getTableByName('Player');
  if (!playerTable2) {
    const tables = franchise2.getAllTablesByName('Player');
    if (tables && tables.length > 0) playerTable2 = tables[0];
  }
  await playerTable2.readRecords();

  console.log(`\n=== AFTER ===`);
  console.log(`${sourceTeamName} roster arraySize: ${sourceRoster2.arraySize}`);
  console.log(`${destTeamName} roster arraySize: ${destRoster2.arraySize}`);
  console.log(`Free Agents roster arraySize: ${faRoster2?.arraySize}`);

  console.log(`\n${destTeamName} first 5 players:`);
  for (let i = 0; i < Math.min(5, destRoster2.arraySize); i++) {
    const playerRef = destRoster2.getReferenceDataByKey(`Player${i}`);
    if (playerRef?.rowNumber !== undefined) {
      const p = playerTable2.records[playerRef.rowNumber];
      if (p && !p.isEmpty) console.log(`  ${p.FirstName} ${p.LastName} (TeamIndex=${p.TeamIndex})`);
    }
  }

  console.log(`\nFree Agents last 5 players (should include former ${destTeamName}):`);
  const faSize = faRoster2?.arraySize || 0;
  for (let i = Math.max(0, faSize - 5); i < faSize; i++) {
    const playerRef = faRoster2.getReferenceDataByKey(`Player${i}`);
    if (playerRef?.rowNumber !== undefined) {
      const p = playerTable2.records[playerRef.rowNumber];
      if (p && !p.isEmpty) console.log(`  ${p.FirstName} ${p.LastName} (TeamIndex=${p.TeamIndex})`);
    }
  }

  console.log(`\n=== RELOCATION COMPLETE ===`);
  console.log(`${sourcePlayerRefs.length} players: ${sourceTeamName} → ${destTeamName}`);
  console.log(`${destPlayerRefs.length} players: ${destTeamName} → Free Agents`);
  console.log(`\nTest file: ${testFile}`);
}

main().catch(console.error);
