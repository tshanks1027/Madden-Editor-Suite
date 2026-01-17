/**
 * Test script to understand roster array manipulation
 * - How to read roster arrays
 * - How to write player references into roster arrays
 * - How the game actually reads rosters
 */

async function main() {
  const mf = await import('madden-franchise');

  // Use a working file to understand structure
  const filePath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';
  const franchise = await mf.create(filePath);

  console.log('=== ROSTER ARRAY MANIPULATION TEST ===\n');

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
  console.log('Team table ID:', teamTable.header.tableId);

  // Find Browns (TeamIndex=4)
  let brownsRecord = null;
  let brownsRecordIndex = -1;
  for (let i = 0; i < teamTable.records.length; i++) {
    const team = teamTable.records[i];
    if (team.isEmpty) continue;
    if (team.TeamIndex === 4) {
      brownsRecord = team;
      brownsRecordIndex = i;
      break;
    }
  }

  if (!brownsRecord) {
    console.log('Browns not found!');
    return;
  }

  console.log('\n--- Browns Team Record ---');
  console.log('Team record index:', brownsRecordIndex);
  console.log('TeamIndex:', brownsRecord.TeamIndex);
  console.log('ShortName:', brownsRecord.ShortName);

  // Get Roster reference
  const rosterRef = brownsRecord.getReferenceDataByKey('Roster');
  console.log('\nRoster reference data:', rosterRef);

  // Get the roster array table
  const rosterArrayTable = franchise.getTableById(rosterRef.tableId);
  await rosterArrayTable.readRecords();

  console.log('\n--- Roster Array Table Info ---');
  console.log('Table name:', rosterArrayTable.name);
  console.log('Table ID:', rosterArrayTable.header.tableId);
  console.log('Is array table:', rosterArrayTable.isArray);
  console.log('Total records:', rosterArrayTable.records.length);

  // Get the Browns roster array record
  const brownsRoster = rosterArrayTable.records[rosterRef.rowNumber];
  console.log('\n--- Browns Roster Array ---');
  console.log('Row number (from reference):', rosterRef.rowNumber);
  console.log('Array size:', brownsRoster.arraySize);
  console.log('isEmpty:', brownsRoster.isEmpty);

  // Check what fields exist on the roster array record
  const fieldNames = Object.keys(brownsRoster.fields);
  console.log('Field count:', fieldNames.length);
  console.log('First 5 fields:', fieldNames.slice(0, 5));

  // Read first few player references
  console.log('\n--- First 5 Player References ---');
  for (let i = 0; i < Math.min(5, brownsRoster.arraySize); i++) {
    const fieldName = 'Player' + i;
    try {
      const playerRef = brownsRoster.getReferenceDataByKey(fieldName);
      if (playerRef && playerRef.rowNumber !== undefined) {
        const player = playerTable.records[playerRef.rowNumber];
        console.log(`  ${fieldName}: tableId=${playerRef.tableId}, rowNumber=${playerRef.rowNumber} -> ${player?.FirstName} ${player?.LastName}`);
      } else {
        console.log(`  ${fieldName}: null reference`);
      }
    } catch (e) {
      console.log(`  ${fieldName}: error - ${e.message}`);
    }
  }

  // Now let's understand how to SET a player reference
  console.log('\n--- Reference Format Test ---');

  // Get what a binary reference looks like
  const testRef = playerTable.getBinaryReferenceToRecord(0);
  console.log('Player table ref to record 0:', testRef);
  console.log('Reference length:', testRef.length);
  console.log('Reference type:', typeof testRef);

  // Check if Player0 field is a reference
  const player0Field = brownsRoster.getFieldByKey('Player0');
  console.log('\nPlayer0 field isReference:', player0Field.offset.isReference);
  console.log('Player0 field value:', brownsRoster.Player0);
  console.log('Player0 field referenceData:', player0Field.referenceData);

  // Find Ravens for comparison (TeamIndex=24)
  let ravensRecord = null;
  for (let i = 0; i < teamTable.records.length; i++) {
    const team = teamTable.records[i];
    if (team.isEmpty) continue;
    if (team.TeamIndex === 24) {
      ravensRecord = team;
      break;
    }
  }

  if (ravensRecord) {
    const ravensRosterRef = ravensRecord.getReferenceDataByKey('Roster');
    const ravensRoster = rosterArrayTable.records[ravensRosterRef.rowNumber];
    console.log('\n--- Ravens Roster Array ---');
    console.log('Roster row number:', ravensRosterRef.rowNumber);
    console.log('Array size:', ravensRoster.arraySize);
  }

  // Also check Titans (TeamIndex=29) - this is where players are going WRONG
  let titansRecord = null;
  for (let i = 0; i < teamTable.records.length; i++) {
    const team = teamTable.records[i];
    if (team.isEmpty) continue;
    if (team.TeamIndex === 29) {
      titansRecord = team;
      break;
    }
  }

  if (titansRecord) {
    const titansRosterRef = titansRecord.getReferenceDataByKey('Roster');
    const titansRoster = rosterArrayTable.records[titansRosterRef.rowNumber];
    console.log('\n--- Titans Roster Array ---');
    console.log('Roster row number:', titansRosterRef.rowNumber);
    console.log('Array size:', titansRoster.arraySize);

    // Show first few players
    for (let i = 0; i < Math.min(3, titansRoster.arraySize); i++) {
      const playerRef = titansRoster.getReferenceDataByKey('Player' + i);
      if (playerRef && playerRef.rowNumber !== undefined) {
        const player = playerTable.records[playerRef.rowNumber];
        console.log(`  Player${i}: ${player?.FirstName} ${player?.LastName}`);
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('To move players between teams, you must:');
  console.log('1. Get the source team\'s Roster reference -> roster array row');
  console.log('2. Get the destination team\'s Roster reference -> roster array row');
  console.log('3. Copy Player0, Player1, etc. references from source to destination');
  console.log('4. Update the arraySize on both roster array records');
  console.log('5. Also update Player.TeamIndex for each player (for MFT display)');
  console.log('');
  console.log('KEY INSIGHT: Roster rowNumber != TeamIndex!');
}

main().catch(console.error);
