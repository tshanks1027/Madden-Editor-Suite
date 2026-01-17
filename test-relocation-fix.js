/**
 * Test the CORRECT roster manipulation approach using Player[] array references
 *
 * The game uses Team.Roster references to Player[] array tables.
 * Each team's roster is an array of player references in the Player[] table.
 *
 * This script:
 * 1. Gets Team.Roster references for Browns and Ravens
 * 2. Copies player refs from Browns roster array to Ravens roster array
 * 3. Updates arraySize on both rosters
 * 4. Puts Ravens original players in free agency
 * 5. Updates Player.TeamIndex for compatibility
 */

const FREE_AGENT_TEAM_INDEX = 32;
const SOURCE_TEAM_INDEX = 4;  // Browns
const DEST_TEAM_INDEX = 24;   // Ravens

async function main() {
  const mf = await import('madden-franchise');

  // Use the test file
  const filePath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST';
  const franchise = await mf.create(filePath);

  console.log('=== ROSTER RELOCATION FIX TEST ===\n');
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

  console.log('Player table ID:', playerTable.header.tableId);

  // Find team records by TeamIndex
  let sourceTeamRecord = null;
  let destTeamRecord = null;
  const teamNameMap = new Map();

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIdx = Number(team.TeamIndex);
    if (teamIdx !== undefined && teamIdx < 33) {
      teamNameMap.set(teamIdx, team.ShortName || team.DisplayName || `Team ${teamIdx}`);
    }
    if (teamIdx === SOURCE_TEAM_INDEX) {
      sourceTeamRecord = team;
    }
    if (teamIdx === DEST_TEAM_INDEX) {
      destTeamRecord = team;
    }
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

  console.log(`\nSource roster ref: tableId=${sourceRosterRef?.tableId}, rowNumber=${sourceRosterRef?.rowNumber}`);
  console.log(`Dest roster ref: tableId=${destRosterRef?.tableId}, rowNumber=${destRosterRef?.rowNumber}`);

  // Get Player[] array table
  const rosterArrayTable = franchise.getTableById(sourceRosterRef.tableId);
  await rosterArrayTable.readRecords();

  console.log(`\nRoster array table: ${rosterArrayTable.name}, ${rosterArrayTable.records.length} records`);

  // Get roster array records
  const sourceRoster = rosterArrayTable.records[sourceRosterRef.rowNumber];
  const destRoster = rosterArrayTable.records[destRosterRef.rowNumber];

  const sourceArraySize = sourceRoster.arraySize || 0;
  const destArraySize = destRoster.arraySize || 0;

  console.log(`\nBEFORE:`);
  console.log(`  ${sourceTeamName} roster array size: ${sourceArraySize}`);
  console.log(`  ${destTeamName} roster array size: ${destArraySize}`);

  // Show first 3 players from each roster
  console.log(`\n  ${sourceTeamName} first 3 players:`);
  for (let i = 0; i < Math.min(3, sourceArraySize); i++) {
    const playerRef = sourceRoster.getReferenceDataByKey(`Player${i}`);
    if (playerRef?.rowNumber !== undefined) {
      const p = playerTable.records[playerRef.rowNumber];
      if (p && !p.isEmpty) console.log(`    ${p.FirstName} ${p.LastName}`);
    }
  }

  console.log(`\n  ${destTeamName} first 3 players:`);
  for (let i = 0; i < Math.min(3, destArraySize); i++) {
    const playerRef = destRoster.getReferenceDataByKey(`Player${i}`);
    if (playerRef?.rowNumber !== undefined) {
      const p = playerTable.records[playerRef.rowNumber];
      if (p && !p.isEmpty) console.log(`    ${p.FirstName} ${p.LastName}`);
    }
  }

  // Collect source player references
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

  console.log(`\nCollected ${sourcePlayerRefs.length} player references from ${sourceTeamName}`);

  // Step 1: Put dest players in free agency
  console.log(`\n--- Step 1: Moving ${destTeamName} players to Free Agency ---`);
  let movedToFA = 0;
  for (let i = 0; i < destArraySize; i++) {
    const fieldName = `Player${i}`;
    try {
      const playerRef = destRoster.getReferenceDataByKey(fieldName);
      if (playerRef && playerRef.rowNumber !== undefined) {
        const player = playerTable.records[playerRef.rowNumber];
        if (player && !player.isEmpty) {
          player.TeamIndex = FREE_AGENT_TEAM_INDEX;
          movedToFA++;
        }
      }
    } catch (e) { }
  }
  console.log(`Moved ${movedToFA} players to Free Agents`);

  // Step 2: Copy source roster refs to dest roster
  console.log(`\n--- Step 2: Copying player refs from ${sourceTeamName} to ${destTeamName} roster ---`);
  for (let i = 0; i < sourcePlayerRefs.length; i++) {
    const fieldName = `Player${i}`;
    destRoster[fieldName] = sourcePlayerRefs[i];
  }
  console.log(`Copied ${sourcePlayerRefs.length} player references`);

  // Step 3: Update dest roster arraySize
  // CRITICAL: Must update table.arraySizes AND trigger change event
  console.log(`\n--- Step 3: Updating ${destTeamName} roster arraySize ---`);
  destRoster.arraySize = sourcePlayerRefs.length;
  rosterArrayTable.arraySizes[destRosterRef.rowNumber] = sourcePlayerRefs.length;
  destRoster.isChanged = true;
  destRoster._parent.onEvent('change', destRoster);
  console.log(`Set ${destTeamName} roster arraySize to ${sourcePlayerRefs.length}`);

  // Step 4: Clear source roster
  console.log(`\n--- Step 4: Clearing ${sourceTeamName} roster ---`);
  sourceRoster.arraySize = 0;
  rosterArrayTable.arraySizes[sourceRosterRef.rowNumber] = 0;
  sourceRoster.isChanged = true;
  sourceRoster._parent.onEvent('change', sourceRoster);
  console.log(`Set ${sourceTeamName} roster arraySize to 0`);

  // Step 5: Update Player.TeamIndex for moved players
  console.log(`\n--- Step 5: Updating Player.TeamIndex for moved players ---`);
  for (const playerIdx of sourcePlayerIndices) {
    const player = playerTable.records[playerIdx];
    if (player && !player.isEmpty) {
      player.TeamIndex = DEST_TEAM_INDEX;
    }
  }
  console.log(`Updated ${sourcePlayerIndices.length} players to TeamIndex=${DEST_TEAM_INDEX}`);

  // Save the file
  console.log(`\n--- Saving file ---`);
  await franchise.save();
  console.log('File saved!');

  // Verify by re-reading
  console.log(`\n=== VERIFICATION (re-reading file) ===`);
  const franchise2 = await mf.create(filePath);
  const teamTable2 = franchise2.getTableByUniqueId(637929298);
  await teamTable2.readRecords();

  let sourceTeam2 = null;
  let destTeam2 = null;
  for (const team of teamTable2.records) {
    if (team.isEmpty) continue;
    if (Number(team.TeamIndex) === SOURCE_TEAM_INDEX) sourceTeam2 = team;
    if (Number(team.TeamIndex) === DEST_TEAM_INDEX) destTeam2 = team;
  }

  const rosterArrayTable2 = franchise2.getTableById(sourceRosterRef.tableId);
  await rosterArrayTable2.readRecords();

  const sourceRosterRef2 = sourceTeam2.getReferenceDataByKey('Roster');
  const destRosterRef2 = destTeam2.getReferenceDataByKey('Roster');

  const sourceRoster2 = rosterArrayTable2.records[sourceRosterRef2.rowNumber];
  const destRoster2 = rosterArrayTable2.records[destRosterRef2.rowNumber];

  let playerTable2 = franchise2.getTableByName('Player');
  if (!playerTable2) {
    const tables = franchise2.getAllTablesByName('Player');
    if (tables && tables.length > 0) playerTable2 = tables[0];
  }
  await playerTable2.readRecords();

  console.log(`\nAFTER:`);
  console.log(`  ${sourceTeamName} roster array size: ${sourceRoster2.arraySize}`);
  console.log(`  ${destTeamName} roster array size: ${destRoster2.arraySize}`);

  console.log(`\n  ${destTeamName} first 3 players (from roster array):`);
  for (let i = 0; i < Math.min(3, destRoster2.arraySize); i++) {
    const playerRef = destRoster2.getReferenceDataByKey(`Player${i}`);
    if (playerRef?.rowNumber !== undefined) {
      const p = playerTable2.records[playerRef.rowNumber];
      if (p && !p.isEmpty) console.log(`    ${p.FirstName} ${p.LastName} (TeamIndex=${p.TeamIndex})`);
    }
  }

  console.log(`\n=== RELOCATION COMPLETE ===`);
  console.log(`${sourcePlayerRefs.length} players moved from ${sourceTeamName} to ${destTeamName}`);
  console.log(`${movedToFA} original ${destTeamName} players moved to Free Agents`);
  console.log(`\nPlease verify IN GAME that ${destTeamName} now has the ${sourceTeamName} roster!`);
}

main().catch(console.error);
