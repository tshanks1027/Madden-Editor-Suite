/**
 * Find the table containing NFL team data
 */
const { create } = require('madden-franchise');

async function findNFLTeams() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  console.log('\n=== SEARCHING FOR TABLES WITH "TEAM" IN NAME ===');
  const teamTables = [];
  for (const table of franchise.tables) {
    if (!table.name) continue;
    const lower = table.name.toLowerCase();
    if (lower.includes('team')) {
      teamTables.push(table.name);
    }
  }
  console.log('Team-related tables:', teamTables.join(', '));

  // Check a few specific tables that might have team data
  const tablesToCheck = ['Team', 'TeamIdentity', 'TeamInfo', 'TeamData', 'FranchiseTeam', 'TeamSetting'];

  for (const tableName of tablesToCheck) {
    const table = franchise.getTableByName(tableName);
    if (!table) {
      console.log(`\n${tableName}: NOT FOUND`);
      continue;
    }

    await table.readRecords();
    const nonEmpty = table.records.filter(r => !r.isEmpty).length;
    console.log(`\n${tableName}: ${nonEmpty} non-empty records`);

    // Check first few records for team-like data
    if (nonEmpty > 0 && nonEmpty <= 40) {
      for (const record of table.records.slice(0, Math.min(5, table.records.length))) {
        if (record.isEmpty) continue;
        console.log(`  Record ${record.index}:`);

        // Try to find team-related fields
        const fields = ['TeamIndex', 'ShortName', 'LongName', 'DisplayName', 'NickName', 'City', 'Abbr'];
        for (const field of fields) {
          try {
            const val = record[field];
            if (val !== undefined && val !== null && val !== '') {
              const display = typeof val === 'string' && val.length > 50 ? val.slice(0, 50) + '...' : val;
              console.log(`    ${field}: ${display}`);
            }
          } catch (e) {}
        }
      }
    }
  }

  // Also try to find by examining fields that reference teams
  console.log('\n\n=== CHECKING SeasonGame.HomeTeam/AwayTeam REFERENCES ===');
  let gameTable = franchise.getTableByName('SeasonGame');
  if (!gameTable) gameTable = franchise.getTableByUniqueId(748954923);

  if (gameTable) {
    await gameTable.readRecords();

    // Get first game with valid team references
    for (const record of gameTable.records.slice(0, 10)) {
      if (record.isEmpty) continue;

      const homeTeamRef = record.HomeTeam;
      const awayTeamRef = record.AwayTeam;

      if (homeTeamRef && homeTeamRef.length === 32 && homeTeamRef !== '00000000000000000000000000000000') {
        // Extract table ID from the reference
        // Binary references: first bits = table ID, last bits = record index
        console.log('HomeTeam reference:', homeTeamRef);

        // Try to decode: typically bits 0-15 or similar are table ID
        const tableIdBits = homeTeamRef.slice(0, 16);
        const recordIdxBits = homeTeamRef.slice(-8);
        const tableId = parseInt(tableIdBits, 2);
        const recordIdx = parseInt(recordIdxBits, 2);

        console.log(`  Table ID bits: ${tableIdBits} (${tableId})`);
        console.log(`  Record index bits: ${recordIdxBits} (${recordIdx})`);

        // Try to find table by various ID interpretations
        const potentialIds = [
          parseInt(homeTeamRef.slice(0, 10), 2),
          parseInt(homeTeamRef.slice(0, 12), 2),
          parseInt(homeTeamRef.slice(0, 16), 2),
          parseInt(homeTeamRef.slice(0, 20), 2),
        ];

        console.log(`  Potential table IDs: ${potentialIds.join(', ')}`);

        // Look for table with these IDs
        for (const table of franchise.tables) {
          if (!table) continue;
          const uniqueId = table.header?.uniqueId;
          const tableId2 = table.header?.tableId;
          if (potentialIds.includes(uniqueId) || potentialIds.includes(tableId2)) {
            console.log(`  FOUND TABLE: ${table.name} (uniqueId: ${uniqueId}, tableId: ${tableId2})`);
          }
        }

        break;
      }
    }
  }

  // Check TeamIdentity table specifically
  console.log('\n\n=== CHECKING TeamIdentity TABLE ===');
  const identityTable = franchise.getTableByName('TeamIdentity');
  if (identityTable) {
    await identityTable.readRecords();
    console.log(`Records: ${identityTable.records.filter(r => !r.isEmpty).length}`);

    // Show first 5 records
    for (const record of identityTable.records.slice(0, 35)) {
      if (record.isEmpty) continue;

      // Get all field values
      console.log(`\nRecord ${record.index}:`);
      if (record._fieldsArray) {
        for (const field of record._fieldsArray) {
          const name = field.name || field.key;
          if (!name) continue;
          const val = field.value;
          if (val === undefined || val === null || val === '') continue;
          // Skip long binary strings for readability
          if (typeof val === 'string' && val.length > 40 && val.match(/^[01]+$/)) continue;
          const display = typeof val === 'string' && val.length > 50 ? val.slice(0, 50) + '...' : val;
          console.log(`  ${name}: ${display}`);
        }
      }
    }
  }
}

findNFLTeams().catch(console.error);
