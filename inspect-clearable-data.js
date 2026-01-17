/**
 * Inspect Clearable History/Stats/Awards Data
 *
 * This script deeply inspects franchise tables to understand:
 * 1. What historical data exists (career stats, awards, records)
 * 2. What fields each table has
 * 3. What CAN be cleared/reset for a fresh retro franchise start
 */

const { create } = require('madden-franchise');
const fs = require('fs');

async function inspectClearableData(filePath) {
  console.log('='.repeat(80));
  console.log('FRANCHISE DATA INSPECTION - CLEARABLE HISTORY/STATS');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}\n`);

  const franchise = await create(filePath);

  const results = {
    file: filePath,
    inspectedAt: new Date().toISOString(),
    canClear: [],    // Tables with data that can be cleared
    cannotClear: [], // Tables that are required for game function
    noData: [],      // Tables with no records
    notFound: []     // Tables that don't exist
  };

  // Tables to inspect for clearable data
  const tablesToInspect = [
    // Career Stats - CLEARABLE
    { name: 'CareerOffensiveStats', clearable: true, description: 'Player career offensive stats' },
    { name: 'CareerDefensiveStats', clearable: true, description: 'Player career defensive stats' },
    { name: 'CareerKickingStats', clearable: true, description: 'Player career kicking stats' },
    { name: 'CareerOLineStats', clearable: true, description: 'Player career O-line stats' },
    { name: 'CareerOffensiveKPReturnStats', clearable: true, description: 'Player career KP return stats (offense)' },
    { name: 'CareerDefensiveKPReturnStats', clearable: true, description: 'Player career KP return stats (defense)' },

    // Season Stats - CLEARABLE
    { name: 'SeasonOffensiveStats', clearable: true, description: 'Player season offensive stats' },
    { name: 'SeasonDefensiveStats', clearable: true, description: 'Player season defensive stats' },
    { name: 'SeasonKickingStats', clearable: true, description: 'Player season kicking stats' },
    { name: 'SeasonOLineStats', clearable: true, description: 'Player season O-line stats' },
    { name: 'SeasonOffensiveKPReturnStats', clearable: true, description: 'Player season KP return stats (offense)' },
    { name: 'SeasonDefensiveKPReturnStats', clearable: true, description: 'Player season KP return stats (defense)' },
    { name: 'SeasonTalent', clearable: true, description: 'Player season talent ratings' },

    // Game Stats - CLEARABLE
    { name: 'GameOffensiveStats', clearable: true, description: 'Per-game offensive stats' },
    { name: 'GameDefensiveStats', clearable: true, description: 'Per-game defensive stats' },
    { name: 'GameKickingStats', clearable: true, description: 'Per-game kicking stats' },
    { name: 'GameOLineStats', clearable: true, description: 'Per-game O-line stats' },
    { name: 'GameOffensiveKPReturnStats', clearable: true, description: 'Per-game KP return stats (offense)' },
    { name: 'GameDefensiveKPReturnStats', clearable: true, description: 'Per-game KP return stats (defense)' },
    { name: 'UnpublishedGameStats', clearable: true, description: 'Unpublished/pending game stats' },

    // Team Stats - CLEARABLE
    { name: 'TeamStats', clearable: true, description: 'Team accumulated statistics' },

    // Awards - CLEARABLE
    { name: 'PlayerAward', clearable: true, description: 'Player awards history' },
    { name: 'CoachAward', clearable: true, description: 'Coach awards history' },
    { name: 'Awards', clearable: false, description: 'Awards configuration (not clear)' },
    { name: 'AwardsEval', clearable: false, description: 'Awards evaluation state' },

    // Transaction History - CLEARABLE
    { name: 'PlayerTransactionHistoryEntry', clearable: true, description: 'Player transaction history' },
    { name: 'CoachTransactionHistoryEntry', clearable: true, description: 'Coach transaction history' },
    { name: 'DraftPickTransactionHistoryEntry', clearable: true, description: 'Draft pick transaction history' },
    { name: 'PlayerPositionChangeHistoryEntry', clearable: true, description: 'Position change history' },
    { name: 'PlayerEditTransactionHistoryEntry', clearable: true, description: 'Player edit history' },

    // Position Records - CLEARABLE
    { name: 'PositionStatRecords', clearable: true, description: 'Position stat records' },
    { name: 'PositionRecordTable', clearable: true, description: 'Position record holders' },
    { name: 'PlayerStatRecordScope', clearable: true, description: 'Stat record scopes' },

    // Play History - CLEARABLE
    { name: 'PlaycallHistory', clearable: true, description: 'Playcall history' },
    { name: 'PlaycallHistoryAiGroupDetails', clearable: true, description: 'AI playcall groups' },
    { name: 'PlaycallHistoryConceptDetails', clearable: true, description: 'Playcall concept details' },

    // Stat Snapshots - CLEARABLE
    { name: 'PlayerStatSnapShot', clearable: true, description: 'Player stat snapshots' },
    { name: 'PassRushStatSnapShot', clearable: true, description: 'Pass rush stat snapshots' },
    { name: 'ReceiveRushStatSnapShot', clearable: true, description: 'Receive/rush stat snapshots' },
    { name: 'PrologueGameStats', clearable: true, description: 'Prologue game stats' },

    // Season/League Info - NOT CLEARABLE (needed for game function)
    { name: 'SeasonInfo', clearable: false, description: 'Season configuration (needed)' },
    { name: 'SeasonGame', clearable: false, description: 'Season games schedule (needed)' },
    { name: 'League', clearable: false, description: 'League configuration (needed)' },
    { name: 'HistoryEntry', clearable: false, description: 'History entry config' },

    // College Import - CLEARABLE (draft class data)
    { name: 'CollegeImportStat', clearable: true, description: 'College import stats' },
    { name: 'CollegeImportAward', clearable: true, description: 'College import awards' },
  ];

  // Process each table
  for (const tableInfo of tablesToInspect) {
    const table = franchise.getTableByName(tableInfo.name);

    if (!table) {
      console.log(`[NOT FOUND] ${tableInfo.name}`);
      results.notFound.push({ name: tableInfo.name, description: tableInfo.description });
      continue;
    }

    try {
      await table.readRecords();

      const recordCount = table.records?.length || 0;
      const nonEmptyRecords = table.records?.filter(r => !r.isEmpty) || [];
      const nonEmptyCount = nonEmptyRecords.length;

      // Get field names from first non-empty record
      let fields = [];
      let sampleValues = {};

      if (nonEmptyRecords.length > 0) {
        const sample = nonEmptyRecords[0];
        fields = Object.keys(sample).filter(k =>
          !k.startsWith('_') &&
          k !== 'isEmpty' &&
          k !== 'index' &&
          k !== 'arraySize' &&
          typeof sample[k] !== 'function'
        );

        // Get sample values
        for (const field of fields.slice(0, 15)) {
          const val = sample[field];
          if (val !== undefined && val !== null && val !== '') {
            sampleValues[field] = typeof val === 'object' ? JSON.stringify(val) : String(val);
            if (sampleValues[field].length > 50) {
              sampleValues[field] = sampleValues[field].substring(0, 50) + '...';
            }
          }
        }
      }

      const info = {
        name: tableInfo.name,
        description: tableInfo.description,
        tableId: table.header?.tableId || table.header?.uniqueId || 'N/A',
        recordCount,
        nonEmptyCount,
        fields,
        sampleValues: Object.keys(sampleValues).length > 0 ? sampleValues : null,
        clearable: tableInfo.clearable
      };

      if (nonEmptyCount === 0) {
        results.noData.push(info);
        console.log(`[NO DATA] ${tableInfo.name}: 0 records`);
      } else if (tableInfo.clearable) {
        results.canClear.push(info);
        console.log(`[CLEARABLE] ${tableInfo.name}: ${nonEmptyCount} records, ${fields.length} fields`);
      } else {
        results.cannotClear.push(info);
        console.log(`[KEEP] ${tableInfo.name}: ${nonEmptyCount} records (required for game function)`);
      }

    } catch (err) {
      console.log(`[ERROR] ${tableInfo.name}: ${err.message}`);
      results.notFound.push({ name: tableInfo.name, error: err.message });
    }
  }

  // ============================================
  // SEARCH FOR HALL OF FAME / CHAMPIONSHIP DATA
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR HALL OF FAME / CHAMPIONSHIP TABLES');
  console.log('='.repeat(80));

  const searchTerms = ['HallOfFame', 'Champion', 'SuperBowl', 'Trophy', 'MVP', 'AllPro', 'ProBowl', 'Legend', 'Retired'];
  const foundChampionshipTables = [];

  for (const table of franchise.tables) {
    if (!table.name) continue;

    const matchedTerm = searchTerms.find(term =>
      table.name.toLowerCase().includes(term.toLowerCase())
    );

    if (matchedTerm) {
      try {
        await table.readRecords();
        const nonEmptyCount = table.records?.filter(r => !r.isEmpty).length || 0;

        foundChampionshipTables.push({
          name: table.name,
          matchedTerm,
          tableId: table.header?.tableId || 'N/A',
          nonEmptyCount,
          totalRecords: table.records?.length || 0
        });

        console.log(`  [${matchedTerm}] ${table.name}: ${nonEmptyCount} records`);

        // Get sample fields from this table
        if (nonEmptyCount > 0) {
          const sample = table.records.find(r => !r.isEmpty);
          const fields = Object.keys(sample).filter(k =>
            !k.startsWith('_') &&
            k !== 'isEmpty' &&
            k !== 'index' &&
            typeof sample[k] !== 'function'
          );
          console.log(`    Fields (first 10): ${fields.slice(0, 10).join(', ')}`);
        }
      } catch (e) {
        console.log(`  [ERROR] ${table.name}: Could not read`);
      }
    }
  }

  results.championshipTables = foundChampionshipTables;

  // ============================================
  // OUTPUT SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  console.log('\n📊 TABLES WITH DATA THAT CAN BE CLEARED:');
  let totalClearableRecords = 0;
  for (const t of results.canClear.sort((a, b) => b.nonEmptyCount - a.nonEmptyCount)) {
    totalClearableRecords += t.nonEmptyCount;
    console.log(`  ${t.name}: ${t.nonEmptyCount} records`);
    console.log(`    ${t.description}`);
    if (t.sampleValues) {
      const samples = Object.entries(t.sampleValues).slice(0, 3);
      for (const [k, v] of samples) {
        console.log(`    - ${k}: ${v}`);
      }
    }
  }
  console.log(`\n  TOTAL CLEARABLE RECORDS: ${totalClearableRecords}`);

  console.log('\n⚠️ TABLES TO KEEP (required for game function):');
  for (const t of results.cannotClear) {
    console.log(`  ${t.name}: ${t.nonEmptyCount} records - ${t.description}`);
  }

  console.log('\n📁 TABLES WITH NO DATA:');
  for (const t of results.noData) {
    console.log(`  ${t.name}: ${t.description}`);
  }

  console.log('\n❌ TABLES NOT FOUND:');
  for (const t of results.notFound) {
    console.log(`  ${t.name}: ${t.description || t.error}`);
  }

  // Save full results to JSON
  const outputPath = 'clearable-data-report.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n\nFull report saved to: ${outputPath}`);
}

// Run
const filePath = process.argv[2] || 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';

if (!fs.existsSync(filePath)) {
  console.log('Usage: node inspect-clearable-data.js <franchise-file>');
  process.exit(1);
}

inspectClearableData(filePath).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
