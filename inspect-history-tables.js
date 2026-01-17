/**
 * Deep Inspect History/Stats/Awards Tables
 *
 * This script reads specific tables to understand their exact structure
 * and what data can be cleared/modified for retro franchise editing.
 */

const Franchise = require('madden-franchise');
const fs = require('fs');

// Tables we want to deeply inspect
const TABLES_TO_INSPECT = [
  // Awards & History
  'Awards',
  'AwardsEval',
  'PlayerAward',
  'CoachAward',
  'AwardEvent',
  'HistoryEntry',

  // Career Stats
  'CareerDefensiveStats',
  'CareerOffensiveStats',
  'CareerKickingStats',
  'CareerOLineStats',
  'CareerDefensiveKPReturnStats',
  'CareerOffensiveKPReturnStats',

  // Season Stats
  'SeasonDefensiveStats',
  'SeasonOffensiveStats',
  'SeasonKickingStats',
  'SeasonOLineStats',
  'SeasonDefensiveKPReturnStats',
  'SeasonOffensiveKPReturnStats',
  'SeasonTalent',

  // Game Stats
  'GameDefensiveStats',
  'GameOffensiveStats',
  'GameKickingStats',
  'GameOLineStats',
  'GameDefensiveKPReturnStats',
  'GameOffensiveKPReturnStats',

  // Team Stats
  'TeamStats',
  'TeamSeasonStats',

  // Records
  'PositionStatRecords',
  'PositionRecordTable',
  'PlayerStatRecordScope',

  // Transaction History
  'PlayerTransactionHistoryEntry',
  'CoachTransactionHistoryEntry',
  'DraftPickTransactionHistoryEntry',
  'PlayerPositionChangeHistoryEntry',
  'PlayerEditTransactionHistoryEntry',

  // Season Info
  'SeasonInfo',
  'SeasonGame',
  'PendingSeasonGame',

  // League-level
  'League',
  'LeagueHistoryRequest',

  // Play History
  'PlaycallHistory',
  'PlaycallHistoryAiGroupDetails',
  'PlaycallHistoryConceptDetails',

  // Other interesting
  'UnpublishedGameStats',
  'PlayerStatSnapShot',
  'PassRushStatSnapShot',
  'ReceiveRushStatSnapShot',
  'CollegeImportStat',
  'CollegeImportAward',
  'PrologueGameStats'
];

async function inspectTables(filePath) {
  console.log('='.repeat(80));
  console.log('DEEP INSPECTION OF HISTORY/STATS/AWARDS TABLES');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}`);
  console.log('');

  const franchise = await Franchise.create(filePath);

  const results = {
    file: filePath,
    inspectedAt: new Date().toISOString(),
    tables: {}
  };

  for (const tableName of TABLES_TO_INSPECT) {
    try {
      // Find table by name
      const table = franchise.tables.find(t => t.name === tableName);

      if (!table) {
        console.log(`\n[NOT FOUND] ${tableName}`);
        results.tables[tableName] = { found: false };
        continue;
      }

      await table.readRecords();

      const recordCount = table.records?.length || 0;
      const nonEmptyRecords = table.records?.filter(r => !r.isEmpty) || [];
      const nonEmptyCount = nonEmptyRecords.length;

      console.log('\n' + '='.repeat(60));
      console.log(`TABLE: ${tableName}`);
      console.log(`ID: ${table.header?.tableId || 'N/A'}`);
      console.log(`Records: ${nonEmptyCount} active / ${recordCount} total`);

      // Get field definitions from table schema
      let fields = [];
      if (table.fieldDefinitions) {
        fields = table.fieldDefinitions.map(fd => ({
          name: fd.name,
          type: fd.type,
          offset: fd.offset
        }));
      }

      // Also try to get fields from first record
      let sampleFields = [];
      let sampleValues = {};

      if (nonEmptyRecords.length > 0) {
        const sample = nonEmptyRecords[0];
        // Get all enumerable properties
        for (const key of Object.keys(sample)) {
          if (!key.startsWith('_') &&
              key !== 'isEmpty' &&
              key !== 'index' &&
              key !== 'arraySize' &&
              typeof sample[key] !== 'function') {
            sampleFields.push(key);
            const val = sample[key];
            if (val !== undefined && val !== null && val !== '') {
              sampleValues[key] = typeof val === 'object' ? JSON.stringify(val).substring(0, 100) : String(val).substring(0, 100);
            }
          }
        }
      }

      console.log(`\nFields from schema (${fields.length}):`);
      if (fields.length > 0) {
        fields.forEach(f => console.log(`  - ${f.name} (${f.type})`));
      } else {
        console.log('  (No schema fields found)');
      }

      console.log(`\nFields from sample record (${sampleFields.length}):`);
      if (sampleFields.length > 0) {
        sampleFields.slice(0, 30).forEach(f => console.log(`  - ${f}`));
        if (sampleFields.length > 30) {
          console.log(`  ... and ${sampleFields.length - 30} more`);
        }
      }

      if (Object.keys(sampleValues).length > 0) {
        console.log(`\nSample values:`);
        Object.entries(sampleValues).slice(0, 15).forEach(([k, v]) => {
          console.log(`  ${k}: ${v}`);
        });
      }

      results.tables[tableName] = {
        found: true,
        tableId: table.header?.tableId,
        recordCount,
        nonEmptyCount,
        schemaFields: fields,
        sampleFields: sampleFields,
        sampleValues: Object.keys(sampleValues).length > 0 ? sampleValues : null
      };

    } catch (err) {
      console.log(`\n[ERROR] ${tableName}: ${err.message}`);
      results.tables[tableName] = { found: false, error: err.message };
    }
  }

  // Also search for any tables with "Super", "Bowl", "Champion", "Hall", "Fame" in name
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR CHAMPIONSHIP/SUPER BOWL/HALL OF FAME TABLES');
  console.log('='.repeat(80));

  const championshipTables = franchise.tables.filter(t =>
    t.name && (
      t.name.toLowerCase().includes('super') ||
      t.name.toLowerCase().includes('bowl') ||
      t.name.toLowerCase().includes('champion') ||
      t.name.toLowerCase().includes('hall') ||
      t.name.toLowerCase().includes('fame') ||
      t.name.toLowerCase().includes('trophy') ||
      t.name.toLowerCase().includes('mvp') ||
      t.name.toLowerCase().includes('probowl') ||
      t.name.toLowerCase().includes('allpro') ||
      t.name.toLowerCase().includes('legend') ||
      t.name.toLowerCase().includes('retired')
    )
  );

  if (championshipTables.length > 0) {
    console.log(`Found ${championshipTables.length} championship-related tables:`);
    for (const table of championshipTables) {
      console.log(`  - ${table.name} (ID: ${table.header?.tableId})`);
      try {
        await table.readRecords();
        const nonEmpty = table.records?.filter(r => !r.isEmpty).length || 0;
        console.log(`    Records: ${nonEmpty}/${table.records?.length || 0}`);
      } catch (e) {
        console.log(`    (Could not read records)`);
      }
    }
  } else {
    console.log('No championship-specific tables found in table names.');
    console.log('Championship data may be stored in League or SeasonInfo tables.');
  }

  // Write results
  const outputPath = 'history-tables-inspection.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  // Create summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY: WHAT CAN BE CLEARED FOR RETRO FRANCHISE');
  console.log('='.repeat(80));

  const clearable = [];
  const notClearable = [];

  for (const [name, data] of Object.entries(results.tables)) {
    if (data.found && data.nonEmptyCount > 0) {
      clearable.push({ name, records: data.nonEmptyCount, fields: data.sampleFields?.length || 0 });
    } else if (!data.found) {
      notClearable.push({ name, reason: 'Table not found' });
    } else if (data.nonEmptyCount === 0) {
      notClearable.push({ name, reason: 'No records' });
    }
  }

  console.log('\nTables with data that CAN be cleared:');
  clearable.sort((a, b) => b.records - a.records);
  clearable.forEach(t => {
    console.log(`  ${t.name}: ${t.records} records (${t.fields} fields)`);
  });

  console.log('\nTables with NO data:');
  notClearable.forEach(t => {
    console.log(`  ${t.name}: ${t.reason}`);
  });
}

// Get franchise file path from command line
const filePath = process.argv[2] || 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';

if (!fs.existsSync(filePath)) {
  console.log('Usage: node inspect-history-tables.js <path-to-franchise-file>');
  process.exit(1);
}

inspectTables(filePath).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
