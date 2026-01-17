/**
 * Test history and records manipulation in franchise files
 * Run with: node test-history-manipulation.js <franchise-file-path>
 *
 * This script tests:
 * 1. Can we clear LeagueHistoryAward (Super Bowl history)?
 * 2. Can we find and manipulate league records?
 * 3. What tables are safe to modify vs internal game state?
 *
 * NOTE: This does NOT save changes - it only tests if manipulation is possible
 */

const path = require('path');
const fs = require('fs');

const Franchise = require('madden-franchise');

async function testHistoryManipulation(filePath) {
  console.log('='.repeat(80));
  console.log('HISTORY & RECORDS MANIPULATION TEST');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}`);
  console.log('NOTE: No changes will be saved - this is a read-only test');
  console.log('');

  const franchise = await Franchise.create(filePath);
  // File is read by Franchise.create()

  const results = {
    leagueHistoryAward: { found: false, canClear: false, recordCount: 0 },
    leagueRecords: { found: false, tables: [] },
    safeToModify: [],
    internalDoNotTouch: []
  };

  // ============================================
  // TEST 1: LeagueHistoryAward (Super Bowl History)
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: LeagueHistoryAward (Super Bowl History)');
  console.log('='.repeat(80));

  try {
    const leagueHistoryAward = franchise.getTableByName('LeagueHistoryAward');
    if (leagueHistoryAward) {
      await leagueHistoryAward.readRecords();
      const nonEmpty = leagueHistoryAward.records.filter(r => !r.isEmpty);

      results.leagueHistoryAward.found = true;
      results.leagueHistoryAward.recordCount = nonEmpty.length;

      console.log(`\nFound LeagueHistoryAward table`);
      console.log(`Total records: ${leagueHistoryAward.records.length}`);
      console.log(`Non-empty records: ${nonEmpty.length}`);

      if (nonEmpty.length > 0) {
        // Get field names
        const sample = nonEmpty[0];
        const fields = Object.keys(sample).filter(k =>
          !k.startsWith('_') && typeof sample[k] !== 'function'
        );
        console.log(`\nFields: ${fields.join(', ')}`);

        // Show a sample record
        console.log(`\nSample Super Bowl record:`);
        for (const field of fields) {
          const value = sample[field];
          if (value !== undefined && value !== null) {
            console.log(`  ${field}: ${value}`);
          }
        }

        // Test if we can clear a record (don't actually save)
        console.log(`\nTesting if records can be cleared...`);
        const testRecord = nonEmpty[0];
        try {
          // Try the empty() method
          const originalYear = testRecord.Year;
          testRecord.empty();
          console.log(`  empty() method: SUCCESS`);

          // Check if it was actually emptied
          if (testRecord.isEmpty) {
            console.log(`  Record is now empty: YES`);
            results.leagueHistoryAward.canClear = true;
          } else {
            console.log(`  Record is now empty: NO (but empty() didn't throw)`);
          }

        } catch (e) {
          console.log(`  empty() method: FAILED - ${e.message}`);

          // Try setting fields to 0/null
          try {
            if (testRecord.Year !== undefined) {
              testRecord.Year = 0;
              console.log(`  Setting Year=0: SUCCESS`);
              results.leagueHistoryAward.canClear = true;
            }
            if (testRecord.TeamIndex !== undefined) {
              testRecord.TeamIndex = 255;
              console.log(`  Setting TeamIndex=255: SUCCESS`);
            }
          } catch (e2) {
            console.log(`  Setting fields manually: FAILED - ${e2.message}`);
          }
        }
      }

      console.log(`\nCONCLUSION: LeagueHistoryAward CAN be cleared: ${results.leagueHistoryAward.canClear ? 'YES' : 'UNKNOWN'}`);

    } else {
      console.log(`\nLeagueHistoryAward table NOT FOUND`);
    }
  } catch (err) {
    console.log(`\nError testing LeagueHistoryAward: ${err.message}`);
  }

  // ============================================
  // TEST 2: Find League Records Tables
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Finding League Records Tables');
  console.log('='.repeat(80));

  const allTables = franchise.tables || [];

  // Search for tables that might contain league records
  const recordKeywords = ['record', 'leader', 'alltime', 'all_time', 'best', 'top'];

  console.log(`\nSearching ${allTables.length} tables for record-related data...`);

  for (const table of allTables) {
    const name = (table.name || '').toLowerCase();
    const isRecordTable = recordKeywords.some(kw => name.includes(kw));

    if (isRecordTable) {
      try {
        await table.readRecords();
        const nonEmpty = table.records.filter(r => !r.isEmpty);

        console.log(`\n${table.name}:`);
        console.log(`  Records: ${table.records.length} total, ${nonEmpty.length} non-empty`);

        if (nonEmpty.length > 0) {
          const sample = nonEmpty[0];
          const fields = Object.keys(sample).filter(k =>
            !k.startsWith('_') && typeof sample[k] !== 'function'
          );

          // Look for stat-related fields
          const statFields = fields.filter(f => {
            const fl = f.toLowerCase();
            return fl.includes('yard') || fl.includes('pass') || fl.includes('rush') ||
                   fl.includes('touchdown') || fl.includes('td') || fl.includes('reception') ||
                   fl.includes('sack') || fl.includes('interception') || fl.includes('int') ||
                   fl.includes('stat') || fl.includes('value') || fl.includes('amount');
          });

          if (statFields.length > 0) {
            console.log(`  Stat-related fields: ${statFields.join(', ')}`);
            results.leagueRecords.tables.push({
              name: table.name,
              recordCount: nonEmpty.length,
              statFields: statFields
            });
          } else {
            console.log(`  Fields: ${fields.slice(0, 10).join(', ')}${fields.length > 10 ? '...' : ''}`);
          }
        }
      } catch (e) {
        console.log(`  Error reading: ${e.message}`);
      }
    }
  }

  if (results.leagueRecords.tables.length > 0) {
    results.leagueRecords.found = true;
  }

  // ============================================
  // TEST 3: Search for Passing/Rushing/etc Records
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Searching for Specific Stat Records');
  console.log('='.repeat(80));

  // Look for tables with specific stat names
  const statTableNames = [
    'SeasonStatsOffensiveKPReturnStatInfo',
    'SeasonStatsDefensiveStatInfo',
    'SeasonStatsKickingStatInfo',
    'CareerStatsInfo',
    'YearlyAwards',
    'YearlyTeamStats',
    'LeagueLeaderInfo',
    'RecordHolder'
  ];

  for (const tableName of statTableNames) {
    try {
      const table = franchise.getTableByName(tableName);
      if (table) {
        await table.readRecords();
        const nonEmpty = table.records.filter(r => !r.isEmpty);
        console.log(`\n${tableName}: ${nonEmpty.length} records`);

        if (nonEmpty.length > 0) {
          const sample = nonEmpty[0];
          const fields = Object.keys(sample).filter(k =>
            !k.startsWith('_') && typeof sample[k] !== 'function'
          );
          console.log(`  Fields: ${fields.join(', ')}`);

          // Show sample values for stat fields
          for (const field of fields) {
            const value = sample[field];
            if (value !== undefined && value !== null && value !== 0 && value !== '') {
              console.log(`  ${field}: ${value}`);
            }
          }
        }
      }
    } catch (e) {
      // Table doesn't exist
    }
  }

  // ============================================
  // TEST 4: Identify Safe vs Internal Tables
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: Safe vs Internal Tables Classification');
  console.log('='.repeat(80));

  // Tables that are SAFE to modify (user data)
  const safeTablePatterns = [
    'LeagueHistoryAward',  // Super Bowl history
    'YearlyAwards',        // MVP, ROTY, etc.
    'TeamRecord',          // Team franchise records
    'PlayerRecord'         // Player records
  ];

  // Tables that are INTERNAL (game state - DO NOT MODIFY)
  const internalTablePatterns = [
    'Manager',
    'Eval',
    'Tracker',
    'Pool',
    'Generator',
    'Controller',
    'State',
    'Settings'
  ];

  console.log('\nClassifying history-related tables...\n');

  for (const table of allTables) {
    const name = table.name || '';
    const nameLower = name.toLowerCase();

    // Only look at history/award/record tables
    if (!nameLower.includes('history') &&
        !nameLower.includes('award') &&
        !nameLower.includes('record')) {
      continue;
    }

    const isInternal = internalTablePatterns.some(p =>
      nameLower.includes(p.toLowerCase())
    );

    if (isInternal) {
      results.internalDoNotTouch.push(name);
      console.log(`  INTERNAL (DO NOT TOUCH): ${name}`);
    } else {
      results.safeToModify.push(name);
      console.log(`  SAFE TO MODIFY: ${name}`);
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  console.log('\n1. SUPER BOWL HISTORY (LeagueHistoryAward):');
  console.log(`   Found: ${results.leagueHistoryAward.found ? 'YES' : 'NO'}`);
  console.log(`   Record Count: ${results.leagueHistoryAward.recordCount}`);
  console.log(`   Can Clear: ${results.leagueHistoryAward.canClear ? 'YES' : 'UNKNOWN'}`);

  console.log('\n2. LEAGUE RECORDS:');
  if (results.leagueRecords.found) {
    console.log(`   Found ${results.leagueRecords.tables.length} potential record tables:`);
    for (const t of results.leagueRecords.tables) {
      console.log(`   - ${t.name} (${t.recordCount} records)`);
    }
  } else {
    console.log('   No obvious league record tables found');
    console.log('   May need deeper investigation into Career/Season stat tables');
  }

  console.log('\n3. SAFE TO MODIFY:');
  for (const t of results.safeToModify) {
    console.log(`   - ${t}`);
  }

  console.log('\n4. INTERNAL (DO NOT TOUCH):');
  for (const t of results.internalDoNotTouch) {
    console.log(`   - ${t}`);
  }

  console.log('\n' + '='.repeat(80));

  return results;
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node test-history-manipulation.js <franchise-file-path>');
  console.log('Example: node test-history-manipulation.js "C:/path/to/YOURFRANCHISE"');
  process.exit(1);
}

const filePath = args[0];
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

testHistoryManipulation(filePath)
  .then((results) => {
    console.log('\nTest complete. No changes were saved.');

    // Write results to JSON for reference
    const outputPath = path.join(__dirname, 'history-manipulation-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Results written to: ${outputPath}`);

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
