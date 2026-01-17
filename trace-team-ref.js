/**
 * Trace team references to find the actual team data table
 */
const { create } = require('madden-franchise');

async function traceTeamRef() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Get a team reference from a SeasonGame
  let gameTable = franchise.getTableByName('SeasonGame');
  if (!gameTable) gameTable = franchise.getTableByUniqueId(748954923);
  await gameTable.readRecords();

  let teamRef = null;
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const homeTeam = record.HomeTeam;
    if (homeTeam && homeTeam.length === 32 && homeTeam !== '00000000000000000000000000000000') {
      teamRef = homeTeam;
      console.log('Found team reference:', teamRef);
      break;
    }
  }

  if (!teamRef) {
    console.log('No team references found in games!');
    return;
  }

  // The reference format is: table header data + record index (last 8 bits usually)
  // But the exact format depends on madden-franchise library
  // Let's try to find which table this points to

  const refRecordIdx = parseInt(teamRef.slice(-8), 2);
  console.log(`\nReference record index (last 8 bits): ${refRecordIdx}`);

  // The table ID is encoded in the first part of the reference
  // In madden-franchise, references use a format where the first part identifies the table

  // Let's check every table to find which one has data at that record index
  console.log('\n=== CHECKING ALL TABLES FOR TEAM DATA ===');

  for (const table of franchise.tables) {
    if (!table.name) continue;

    // Skip certain tables
    if (table.name.includes('Event') || table.name.includes('Reaction') ||
        table.name.includes('Request') || table.name.includes('View')) continue;

    try {
      await table.readRecords();

      // Check if this table has a record at refRecordIdx with team-like data
      if (table.records.length > refRecordIdx) {
        const record = table.records[refRecordIdx];
        if (record && !record.isEmpty) {
          // Check for team-like fields
          let hasTeamFields = false;
          let shortName = null;
          let teamIndex = null;

          try { shortName = record.ShortName; if (shortName) hasTeamFields = true; } catch (e) {}
          try { teamIndex = record.TeamIndex; if (teamIndex !== undefined) hasTeamFields = true; } catch (e) {}

          if (hasTeamFields) {
            console.log(`\nPOTENTIAL MATCH: ${table.name}`);
            console.log(`  Record ${refRecordIdx}: ShortName=${shortName}, TeamIndex=${teamIndex}`);

            // Check the table header
            console.log(`  Table uniqueId: ${table.header?.uniqueId}`);
            console.log(`  Table tableId: ${table.header?.tableId}`);
          }
        }
      }
    } catch (e) {
      // Skip tables that fail to read
    }
  }

  // Also check if the Team table record count is just wrong
  console.log('\n=== CHECKING IF THERE ARE MORE RECORDS IN MAIN Team TABLE ===');
  const mainTeamTable = franchise.getTableByName('Team');
  if (mainTeamTable) {
    await mainTeamTable.readRecords();
    console.log(`Team table record count: ${mainTeamTable.records.length}`);
    console.log(`Team table header.numMembers: ${mainTeamTable.header?.numMembers}`);
    console.log(`Team table header.recordCapacity: ${mainTeamTable.header?.recordCapacity}`);

    // Check if there are records beyond index 0
    for (let i = 0; i < Math.min(40, mainTeamTable.records.length); i++) {
      const record = mainTeamTable.records[i];
      if (!record.isEmpty) {
        console.log(`  Record ${i}: ShortName=${record.ShortName}, TeamIndex=${record.TeamIndex}`);
      }
    }
  }

  // Check what table has uniqueId that matches the prefix
  // The reference prefix is 001011100011101000000000 (24 bits)
  // This could be a table ID or a combination of table ID and flags
  console.log('\n=== LOOKING FOR TABLE WITH MATCHING REFERENCE PREFIX ===');

  const prefix = '001011100011101000000000';
  const prefixAsInt = parseInt(prefix, 2);
  console.log(`Reference prefix: ${prefix}`);
  console.log(`Prefix as integer: ${prefixAsInt}`);

  for (const table of franchise.tables) {
    if (!table.name || !table.header) continue;

    const uniqueId = table.header.uniqueId;
    const tableId = table.header.tableId;
    const data1Id = table.header.data1Id;

    // Check if any ID matches
    if (uniqueId === prefixAsInt || tableId === prefixAsInt ||
        data1Id === prefixAsInt) {
      console.log(`MATCH: ${table.name} (uniqueId: ${uniqueId}, tableId: ${tableId})`);
    }

    // Also check partial matches (the prefix might only use certain bits)
    const uniqueIdBinary = uniqueId?.toString(2).padStart(32, '0');
    if (uniqueIdBinary && uniqueIdBinary.startsWith(prefix.slice(0, 16))) {
      console.log(`PARTIAL MATCH: ${table.name} (uniqueId: ${uniqueId} = ${uniqueIdBinary})`);
    }
  }
}

traceTeamRef().catch(console.error);
