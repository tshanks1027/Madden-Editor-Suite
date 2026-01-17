/**
 * Inspect Table Fields via Schema and Record Access
 *
 * The madden-franchise library stores fields differently than just object properties.
 * This script reads actual field definitions and values.
 */

const Franchise = require('madden-franchise');
const fs = require('fs');

// Key tables to deep inspect
const KEY_TABLES = [
  'Player',               // Player data structure
  'Team',                 // Team data structure
  'Coach',                // Coach data structure
  'League',               // League settings
  'SeasonInfo',           // Current season data
  'Awards',               // Awards configuration
  'PlayerAward',          // Player award records
  'CoachAward',           // Coach award records
  'CareerOffensiveStats', // Career stats structure
  'CareerDefensiveStats', // Career defensive stats
  'SeasonGame',           // Season game results
  'TeamStats',            // Team stats structure
  'HistoryEntry',         // History records
  'PlayerTransactionHistoryEntry', // Transaction history
  'PositionRecordTable',  // Position records
  'Stadium'               // Stadium data
];

async function inspectTableFields(filePath) {
  console.log('='.repeat(80));
  console.log('DEEP FIELD INSPECTION');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}\n`);

  const franchise = await Franchise.create(filePath);

  const results = {};

  for (const tableName of KEY_TABLES) {
    const table = franchise.tables.find(t => t.name === tableName);

    if (!table) {
      console.log(`\n[NOT FOUND] ${tableName}`);
      results[tableName] = { found: false };
      continue;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`TABLE: ${tableName}`);
    console.log(`Table ID: ${table.header?.tableId || table.header?.uniqueId || 'N/A'}`);

    await table.readRecords();

    const recordCount = table.records?.length || 0;
    const nonEmptyRecords = table.records?.filter(r => !r.isEmpty) || [];
    console.log(`Records: ${nonEmptyRecords.length} active / ${recordCount} total`);

    // Method 1: Get field names from offsetTable
    let fieldNames = [];
    if (table.offsetTable) {
      fieldNames = Object.keys(table.offsetTable);
      console.log(`\nFields from offsetTable (${fieldNames.length}):`);
      fieldNames.slice(0, 50).forEach(name => {
        console.log(`  - ${name}`);
      });
      if (fieldNames.length > 50) {
        console.log(`  ... and ${fieldNames.length - 50} more`);
      }
    }

    // Method 2: Try to access actual fields on a record
    if (nonEmptyRecords.length > 0) {
      const sample = nonEmptyRecords[0];

      console.log(`\nSample record values:`);
      let valueCount = 0;

      // Try accessing known field patterns
      if (fieldNames.length > 0) {
        for (const fieldName of fieldNames.slice(0, 25)) {
          try {
            const value = sample[fieldName];
            if (value !== undefined && value !== null) {
              const displayVal = typeof value === 'object'
                ? JSON.stringify(value).substring(0, 80)
                : String(value).substring(0, 80);
              console.log(`  ${fieldName}: ${displayVal}`);
              valueCount++;
            }
          } catch (e) {
            // Field not accessible
          }
        }
      }

      // Try common field names
      const commonFields = [
        'FirstName', 'LastName', 'Position', 'Overall', 'Age',
        'TeamIndex', 'PlayerID', 'ContractStatus', 'YearsPro',
        'Name', 'DisplayName', 'City', 'Nickname',
        'SeasonYear', 'SeasonWeek', 'CurrentWeek', 'CurrentStage',
        'HomeTeam', 'AwayTeam', 'HomeScore', 'AwayScore',
        'AwardType', 'AwardYear', 'PlayerRef', 'CoachRef',
        'CareerTotalYards', 'CareerTouchdowns', 'CareerInterceptions',
        'TotalYards', 'Touchdowns', 'Receptions', 'Tackles', 'Sacks',
        'PFID', 'AssetName', 'PortraitId', 'GenericHead',
        'SalaryCap', 'CurrentSalary', 'TotalCap',
        'SuperBowlWinner', 'SuperBowlLoser', 'ChampionTeamIndex',
        'WinsRecord', 'LossesRecord', 'TiesRecord', 'PlayoffWins'
      ];

      for (const fieldName of commonFields) {
        if (!fieldNames.includes(fieldName)) {
          try {
            const value = sample[fieldName];
            if (value !== undefined && value !== null && value !== '') {
              const displayVal = typeof value === 'object'
                ? JSON.stringify(value).substring(0, 80)
                : String(value).substring(0, 80);
              console.log(`  ${fieldName}: ${displayVal}`);
              valueCount++;
            }
          } catch (e) {
            // Field not accessible
          }
        }
      }

      if (valueCount === 0) {
        console.log('  (No values could be read)');
      }
    }

    // Store results
    results[tableName] = {
      found: true,
      tableId: table.header?.tableId || table.header?.uniqueId,
      recordCount,
      nonEmptyCount: nonEmptyRecords.length,
      fields: fieldNames
    };
  }

  // Save detailed output
  const outputPath = 'table-fields-detail.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n\nDetailed results saved to: ${outputPath}`);

  // Now let's also check the franchise file schema for any additional info
  console.log('\n' + '='.repeat(80));
  console.log('CHECKING FRANCHISE SCHEMA INFO');
  console.log('='.repeat(80));

  // Check if there's schema information available
  if (franchise.schemaList) {
    console.log(`\nSchema list entries: ${franchise.schemaList.length || 'N/A'}`);
  }

  // Check the raw file structure
  console.log(`\nTotal tables in franchise file: ${franchise.tables?.length || 0}`);

  // Find any tables with "Super" or "Bowl" or "Champion" in the fields
  console.log('\n\nSearching for championship-related fields across all tables...');

  const champFields = [];
  for (const table of franchise.tables) {
    try {
      if (table.offsetTable) {
        const tableFields = Object.keys(table.offsetTable);
        for (const field of tableFields) {
          const lower = field.toLowerCase();
          if (lower.includes('super') || lower.includes('bowl') ||
              lower.includes('champion') || lower.includes('trophy') ||
              lower.includes('mvp') || lower.includes('allpro') ||
              lower.includes('probowl') || lower.includes('halloffame')) {
            champFields.push({ table: table.name, field });
          }
        }
      }
    } catch (e) {
      // Skip tables with issues
    }
  }

  if (champFields.length > 0) {
    console.log(`\nFound ${champFields.length} championship-related fields:`);
    champFields.forEach(cf => {
      console.log(`  ${cf.table}.${cf.field}`);
    });
  } else {
    console.log('\nNo championship-specific fields found in field names.');
  }

  // Search for history-related fields
  console.log('\n\nSearching for history/record-related fields...');
  const historyFields = [];
  for (const table of franchise.tables) {
    try {
      if (table.offsetTable) {
        const tableFields = Object.keys(table.offsetTable);
        for (const field of tableFields) {
          const lower = field.toLowerCase();
          if (lower.includes('history') || lower.includes('record') ||
              lower.includes('career') || lower.includes('lifetime') ||
              lower.includes('alltime') || lower.includes('legacy')) {
            historyFields.push({ table: table.name, field });
          }
        }
      }
    } catch (e) {
      // Skip tables with issues
    }
  }

  if (historyFields.length > 0) {
    console.log(`\nFound ${historyFields.length} history-related fields:`);
    historyFields.slice(0, 50).forEach(hf => {
      console.log(`  ${hf.table}.${hf.field}`);
    });
    if (historyFields.length > 50) {
      console.log(`  ... and ${historyFields.length - 50} more`);
    }
  }
}

const filePath = process.argv[2] || 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';

if (!fs.existsSync(filePath)) {
  console.log('Usage: node inspect-table-fields.js <franchise-file>');
  process.exit(1);
}

inspectTableFields(filePath).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
