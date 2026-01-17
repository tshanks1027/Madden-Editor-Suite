/**
 * Comprehensive Franchise File Table Analyzer
 *
 * Dumps ALL tables from a Madden 26 franchise file with:
 * - Table names and IDs
 * - Record counts
 * - Field names and sample values
 * - Identifies history/stats/records related tables
 */

const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

// Keywords to flag interesting tables
const HISTORY_KEYWORDS = ['history', 'record', 'award', 'champion', 'super', 'bowl', 'hall', 'fame', 'stat', 'career', 'season', 'playoff', 'trophy', 'winner', 'mvp', 'pro bowl', 'all-pro', 'retired', 'legend'];
const STATS_KEYWORDS = ['passing', 'rushing', 'receiving', 'tackle', 'sack', 'interception', 'touchdown', 'yard', 'score', 'point', 'win', 'loss', 'tie'];

async function analyzeFranchise(filePath) {
  console.log('='.repeat(80));
  console.log('MADDEN FRANCHISE FILE COMPLETE TABLE ANALYSIS');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log('');

  const franchise = await Franchise.create(filePath);

  // Get all tables
  const tables = franchise.tables || [];
  console.log(`Total Tables Found: ${tables.length}`);
  console.log('');

  // Categorize tables
  const categories = {
    history: [],
    stats: [],
    player: [],
    team: [],
    league: [],
    game: [],
    draft: [],
    contract: [],
    other: []
  };

  const allTableInfo = [];

  for (const table of tables) {
    try {
      const name = table.name || `UnknownTable_${table.header?.tableId || 'NoID'}`;
      const uniqueId = table.header?.tableId || 'N/A';

      // Try to read records
      let recordCount = 0;
      let nonEmptyCount = 0;
      let fields = [];
      let sampleRecord = null;

      try {
        await table.readRecords();
        recordCount = table.records?.length || 0;
        nonEmptyCount = table.records?.filter(r => !r.isEmpty).length || 0;

        // Get field names from first non-empty record
        if (table.records && table.records.length > 0) {
          const firstRecord = table.records.find(r => !r.isEmpty) || table.records[0];
          if (firstRecord) {
            // Get all enumerable properties that look like fields
            fields = Object.keys(firstRecord).filter(k =>
              !k.startsWith('_') &&
              k !== 'isEmpty' &&
              k !== 'index' &&
              typeof firstRecord[k] !== 'function'
            );
            sampleRecord = firstRecord;
          }
        }
      } catch (e) {
        // Table might not be readable
      }

      const tableInfo = {
        name,
        uniqueId,
        recordCount,
        nonEmptyCount,
        fields,
        sampleRecord
      };

      allTableInfo.push(tableInfo);

      // Categorize
      const nameLower = name.toLowerCase();
      const fieldsLower = fields.map(f => f.toLowerCase()).join(' ');
      const combined = nameLower + ' ' + fieldsLower;

      if (HISTORY_KEYWORDS.some(k => combined.includes(k))) {
        categories.history.push(tableInfo);
      } else if (STATS_KEYWORDS.some(k => combined.includes(k))) {
        categories.stats.push(tableInfo);
      } else if (nameLower.includes('player')) {
        categories.player.push(tableInfo);
      } else if (nameLower.includes('team')) {
        categories.team.push(tableInfo);
      } else if (nameLower.includes('league') || nameLower.includes('season')) {
        categories.league.push(tableInfo);
      } else if (nameLower.includes('game') || nameLower.includes('schedule')) {
        categories.game.push(tableInfo);
      } else if (nameLower.includes('draft') || nameLower.includes('pick')) {
        categories.draft.push(tableInfo);
      } else if (nameLower.includes('contract') || nameLower.includes('salary')) {
        categories.contract.push(tableInfo);
      } else {
        categories.other.push(tableInfo);
      }

    } catch (e) {
      console.error(`Error processing table: ${e.message}`);
    }
  }

  // Output results
  console.log('\n' + '='.repeat(80));
  console.log('CATEGORY SUMMARY');
  console.log('='.repeat(80));
  console.log(`History/Awards/Records: ${categories.history.length} tables`);
  console.log(`Stats-Related: ${categories.stats.length} tables`);
  console.log(`Player Tables: ${categories.player.length} tables`);
  console.log(`Team Tables: ${categories.team.length} tables`);
  console.log(`League/Season Tables: ${categories.league.length} tables`);
  console.log(`Game/Schedule Tables: ${categories.game.length} tables`);
  console.log(`Draft Tables: ${categories.draft.length} tables`);
  console.log(`Contract/Salary Tables: ${categories.contract.length} tables`);
  console.log(`Other Tables: ${categories.other.length} tables`);

  // Detailed output for each category
  function printCategory(name, tables) {
    if (tables.length === 0) return;

    console.log('\n' + '='.repeat(80));
    console.log(`${name.toUpperCase()} TABLES (${tables.length})`);
    console.log('='.repeat(80));

    for (const t of tables) {
      console.log('\n' + '-'.repeat(60));
      console.log(`TABLE: ${t.name}`);
      console.log(`Unique ID: ${t.uniqueId}`);
      console.log(`Records: ${t.nonEmptyCount} active / ${t.recordCount} total`);

      if (t.fields.length > 0) {
        console.log(`Fields (${t.fields.length}):`);
        // Group fields by type for readability
        const fieldGroups = [];
        for (let i = 0; i < t.fields.length; i += 5) {
          fieldGroups.push(t.fields.slice(i, i + 5).join(', '));
        }
        fieldGroups.forEach(g => console.log(`  ${g}`));

        // Show sample values for interesting tables
        if (t.sampleRecord && (categories.history.includes(t) || categories.stats.includes(t))) {
          console.log('\nSample Record Values:');
          for (const field of t.fields.slice(0, 20)) {
            const value = t.sampleRecord[field];
            if (value !== undefined && value !== null && value !== '') {
              console.log(`  ${field}: ${JSON.stringify(value).substring(0, 100)}`);
            }
          }
        }
      }
    }
  }

  // Print high-priority categories first
  printCategory('🏆 HISTORY/AWARDS/RECORDS (HIGH PRIORITY)', categories.history);
  printCategory('📊 STATS-RELATED (HIGH PRIORITY)', categories.stats);
  printCategory('🏈 PLAYER', categories.player);
  printCategory('🏟️ TEAM', categories.team);
  printCategory('🏛️ LEAGUE/SEASON', categories.league);
  printCategory('📅 GAME/SCHEDULE', categories.game);
  printCategory('📝 DRAFT', categories.draft);
  printCategory('💰 CONTRACT/SALARY', categories.contract);
  printCategory('📦 OTHER', categories.other);

  // Write full JSON dump
  const outputPath = path.join(__dirname, 'franchise-table-dump.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    file: filePath,
    analyzedAt: new Date().toISOString(),
    totalTables: tables.length,
    categories: {
      history: categories.history.map(t => ({ name: t.name, id: t.uniqueId, records: t.nonEmptyCount, fields: t.fields })),
      stats: categories.stats.map(t => ({ name: t.name, id: t.uniqueId, records: t.nonEmptyCount, fields: t.fields })),
      player: categories.player.map(t => ({ name: t.name, id: t.uniqueId, records: t.nonEmptyCount, fields: t.fields })),
      team: categories.team.map(t => ({ name: t.name, id: t.uniqueId, records: t.nonEmptyCount, fields: t.fields })),
      league: categories.league.map(t => ({ name: t.name, id: t.uniqueId, records: t.nonEmptyCount, fields: t.fields })),
      game: categories.game.map(t => ({ name: t.name, id: t.uniqueId, records: t.nonEmptyCount, fields: t.fields })),
      draft: categories.draft.map(t => ({ name: t.name, id: t.uniqueId, records: t.nonEmptyCount, fields: t.fields })),
      contract: categories.contract.map(t => ({ name: t.name, id: t.uniqueId, records: t.nonEmptyCount, fields: t.fields })),
      other: categories.other.map(t => ({ name: t.name, id: t.uniqueId, records: t.nonEmptyCount, fields: t.fields }))
    },
    allTables: allTableInfo.map(t => ({
      name: t.name,
      uniqueId: t.uniqueId,
      recordCount: t.recordCount,
      nonEmptyCount: t.nonEmptyCount,
      fields: t.fields
    }))
  }, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log(`Full JSON dump saved to: ${outputPath}`);
  console.log('='.repeat(80));

  // Also create a simple list of all table names
  const tableListPath = path.join(__dirname, 'franchise-table-list.txt');
  const tableList = allTableInfo
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(t => `${t.name.padEnd(50)} ID: ${String(t.uniqueId).padEnd(12)} Records: ${t.nonEmptyCount}/${t.recordCount}`)
    .join('\n');
  fs.writeFileSync(tableListPath, tableList);
  console.log(`Table list saved to: ${tableListPath}`);

  await franchise.close();
}

// Get franchise file path from command line or use default
const filePath = process.argv[2] || 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\settings\\YOURFRANCHISEFILE';

if (!fs.existsSync(filePath)) {
  console.log('Usage: node analyze-all-franchise-tables.js <path-to-franchise-file>');
  console.log('');
  console.log('Please provide a valid franchise file path.');
  console.log('Example: node analyze-all-franchise-tables.js "C:\\Users\\tshan\\Documents\\Madden NFL 26\\settings\\Franchise-YourSave"');
  process.exit(1);
}

analyzeFranchise(filePath).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
