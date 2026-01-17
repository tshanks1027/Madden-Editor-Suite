/**
 * Explore franchise file history and records tables
 * Run with: node explore-history-records.js <franchise-file-path>
 *
 * This script investigates:
 * 1. LeagueHistoryAward - Super Bowl championship history
 * 2. League records tables (passing yards, rushing yards, etc.)
 * 3. Any other history-related tables
 */

const path = require('path');
const fs = require('fs');

const Franchise = require('madden-franchise');

async function exploreHistoryAndRecords(filePath) {
  console.log('='.repeat(80));
  console.log('FRANCHISE FILE HISTORY & RECORDS EXPLORATION');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}`);
  console.log('');

  const franchise = await Franchise.create(filePath);
  // File is read by Franchise.create()

  const allTables = franchise.tables || [];
  console.log(`Total tables in franchise file: ${allTables.length}`);
  console.log('');

  // Categories of tables to explore
  const categories = {
    history: [],
    award: [],
    record: [],
    stat: [],
    leader: [],
    career: [],
    season: [],
    superbowl: [],
    championship: [],
    other_interesting: []
  };

  // Categorize tables
  for (const table of allTables) {
    const name = (table.name || '').toLowerCase();

    if (name.includes('history')) categories.history.push(table.name);
    if (name.includes('award')) categories.award.push(table.name);
    if (name.includes('record')) categories.record.push(table.name);
    if (name.includes('stat')) categories.stat.push(table.name);
    if (name.includes('leader')) categories.leader.push(table.name);
    if (name.includes('career')) categories.career.push(table.name);
    if (name.includes('season') && !name.includes('preseason')) categories.season.push(table.name);
    if (name.includes('super')) categories.superbowl.push(table.name);
    if (name.includes('champ')) categories.championship.push(table.name);
  }

  // Print categorized tables
  console.log('='.repeat(80));
  console.log('TABLES BY CATEGORY');
  console.log('='.repeat(80));

  for (const [category, tables] of Object.entries(categories)) {
    if (tables.length > 0) {
      console.log(`\n${category.toUpperCase()} (${tables.length} tables):`);
      for (const t of tables) {
        console.log(`  - ${t}`);
      }
    }
  }

  // Detailed exploration of key tables
  console.log('\n');
  console.log('='.repeat(80));
  console.log('DETAILED TABLE EXPLORATION');
  console.log('='.repeat(80));

  // 1. LeagueHistoryAward - Super Bowl history
  await exploreTable(franchise, 'LeagueHistoryAward', 'Super Bowl Championship History');

  // 2. Look for league records tables
  const recordTableNames = [
    'LeagueRecord',
    'NFLRecord',
    'CareerRecord',
    'SeasonRecord',
    'SingleGameRecord',
    'AllTimeRecord',
    'LeagueLeader',
    'CareerLeader',
    'SeasonLeader',
    'StatRecord',
    'HistoricalRecord',
    'RecordBook',
    'LeagueStats',
    'CareerStats',
    'HistoricalStats'
  ];

  for (const tableName of recordTableNames) {
    await exploreTable(franchise, tableName, `Potential Records Table`);
  }

  // 3. Explore any table with "Record" in the name that we haven't tried
  for (const table of allTables) {
    const name = table.name || '';
    if (name.toLowerCase().includes('record') && !recordTableNames.includes(name)) {
      await exploreTable(franchise, name, 'Additional Record Table');
    }
  }

  // 4. Explore career stats tables
  const careerTableNames = [
    'CareerDefensiveKPReturnStats',
    'CareerDefensiveStats',
    'CareerKickingStats',
    'CareerOffensiveKPReturnStats',
    'CareerOffensiveStats',
    'CareerOLineStats'
  ];

  for (const tableName of careerTableNames) {
    await exploreTable(franchise, tableName, 'Career Stats Table', true); // summary only
  }

  // 5. Look for history manager tables (these are INTERNAL - don't clear!)
  console.log('\n');
  console.log('='.repeat(80));
  console.log('INTERNAL TABLES (DO NOT CLEAR!)');
  console.log('='.repeat(80));

  const internalTables = [
    'HistoryManager',
    'TransactionHistoryManager',
    'AwardsEval',
    'Awards'
  ];

  for (const tableName of internalTables) {
    const table = franchise.getTableByName(tableName);
    if (table) {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`\n${tableName}: ${table.records.length} total, ${nonEmpty} non-empty`);
      console.log(`  WARNING: This is an internal game state table - DO NOT CLEAR!`);
    }
  }

  console.log('\n');
  console.log('='.repeat(80));
  console.log('EXPLORATION COMPLETE');
  console.log('='.repeat(80));
}

async function exploreTable(franchise, tableName, description, summaryOnly = false) {
  try {
    const table = franchise.getTableByName(tableName);
    if (!table) {
      // Try by searching all tables
      const allTables = franchise.tables || [];
      const found = allTables.find(t => (t.name || '').toLowerCase() === tableName.toLowerCase());
      if (!found) {
        return; // Table doesn't exist
      }
    }

    const actualTable = table || franchise.getTableByName(tableName);
    if (!actualTable) return;

    await actualTable.readRecords();

    const totalRecords = actualTable.records.length;
    const nonEmptyRecords = actualTable.records.filter(r => !r.isEmpty);
    const nonEmptyCount = nonEmptyRecords.length;

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`TABLE: ${tableName}`);
    console.log(`Description: ${description}`);
    console.log(`Total Records: ${totalRecords}, Non-Empty: ${nonEmptyCount}`);
    console.log(`${'─'.repeat(70)}`);

    if (nonEmptyCount === 0) {
      console.log('  (No data in this table)');
      return;
    }

    // Get field names from first non-empty record
    const sampleRecord = nonEmptyRecords[0];
    const fields = Object.keys(sampleRecord).filter(k =>
      !k.startsWith('_') &&
      typeof sampleRecord[k] !== 'function' &&
      k !== 'isEmpty' &&
      k !== 'index'
    );

    console.log(`\nFields (${fields.length}):`);
    console.log(`  ${fields.join(', ')}`);

    if (summaryOnly) {
      console.log(`\n  (Summary only - ${nonEmptyCount} records with data)`);
      return;
    }

    // Show sample records
    const samplesToShow = Math.min(5, nonEmptyCount);
    console.log(`\nSample Records (showing ${samplesToShow} of ${nonEmptyCount}):`);

    for (let i = 0; i < samplesToShow; i++) {
      const record = nonEmptyRecords[i];
      console.log(`\n  Record ${i + 1}:`);

      for (const field of fields) {
        const value = record[field];
        if (value !== undefined && value !== null && value !== '' && value !== 0) {
          // Truncate long values
          const displayValue = String(value).length > 50
            ? String(value).substring(0, 50) + '...'
            : value;
          console.log(`    ${field}: ${displayValue}`);
        }
      }
    }

    // Special analysis for certain tables
    if (tableName === 'LeagueHistoryAward') {
      console.log(`\n  ANALYSIS: This table contains Super Bowl championship records.`);
      console.log(`  To clear historical Super Bowl data, empty all ${nonEmptyCount} records.`);

      // Check for Year/SeasonYear fields
      const years = new Set();
      for (const record of nonEmptyRecords) {
        if (record.Year) years.add(record.Year);
        if (record.SeasonYear) years.add(record.SeasonYear);
      }
      if (years.size > 0) {
        const sortedYears = Array.from(years).sort((a, b) => a - b);
        console.log(`  Years found: ${sortedYears.join(', ')}`);
      }
    }

  } catch (err) {
    // Silently skip tables that can't be read
  }
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node explore-history-records.js <franchise-file-path>');
  console.log('Example: node explore-history-records.js "C:/path/to/YOURFRANCHISE"');
  process.exit(1);
}

const filePath = args[0];
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

exploreHistoryAndRecords(filePath)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
