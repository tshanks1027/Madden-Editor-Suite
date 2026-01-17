// Find ALL fields in the franchise file that contain year-related values
// This will help identify what actually controls the in-game year display

const filePath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';

async function dumpYearFields() {
  console.log('Searching ALL tables for year-related fields...\n');

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  const yearFields = [];

  for (const table of franchise.tables || []) {
    const tableName = table.name || 'Unknown';

    try {
      await table.readRecords();

      if (!table.records || table.records.length === 0) continue;

      // Get first non-empty record
      const record = table.records.find(r => !r.isEmpty) || table.records[0];
      if (!record) continue;

      // Get all field names
      const fieldNames = [];
      for (const key of Object.keys(record)) {
        if (!key.startsWith('_') && typeof record[key] !== 'function') {
          fieldNames.push(key);
        }
      }

      // Look for fields with "year", "season", "calendar" in name
      for (const field of fieldNames) {
        const lowerField = field.toLowerCase();
        if (lowerField.includes('year') ||
            lowerField.includes('season') ||
            lowerField.includes('calendar') ||
            lowerField.includes('date')) {
          try {
            const value = record[field];
            if (value !== null && value !== undefined) {
              yearFields.push({
                table: tableName,
                field: field,
                value: value,
                type: typeof value
              });
            }
          } catch (e) {}
        }
      }

      // Also look for numeric fields with value around 2025-2026
      for (const field of fieldNames) {
        try {
          const value = record[field];
          if (typeof value === 'number' && value >= 1960 && value <= 2030) {
            // Could be a year!
            yearFields.push({
              table: tableName,
              field: field,
              value: value,
              type: 'number (possible year)',
              note: 'Value in year range'
            });
          }
        } catch (e) {}
      }

    } catch (e) {
      // Skip tables that error
    }
  }

  // Sort and display
  console.log('FIELDS THAT MAY CONTROL YEAR DISPLAY:');
  console.log('='.repeat(70));

  // Group by table
  const byTable = {};
  for (const f of yearFields) {
    if (!byTable[f.table]) byTable[f.table] = [];
    byTable[f.table].push(f);
  }

  for (const [table, fields] of Object.entries(byTable)) {
    console.log(`\n${table}:`);
    for (const f of fields) {
      console.log(`  ${f.field}: ${f.value} (${f.type})${f.note ? ' - ' + f.note : ''}`);
    }
  }

  // Specifically check LeagueState which might have runtime state
  console.log('\n\nCHECKING LeagueState TABLE SPECIFICALLY:');
  const leagueState = franchise.getTableByName('LeagueState');
  if (leagueState) {
    await leagueState.readRecords();
    const rec = leagueState.records[0];
    if (rec) {
      const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
      console.log('LeagueState fields:', fields.join(', '));
      for (const f of fields) {
        try {
          console.log(`  ${f}: ${rec[f]}`);
        } catch(e) {}
      }
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

dumpYearFields().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
