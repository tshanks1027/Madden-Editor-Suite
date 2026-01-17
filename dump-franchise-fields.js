// Dump all fields from key franchise tables to understand structure
// Uses ESM import like the app does

const filePath = process.argv[2] || 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/saves/YOURFRANCHISE';

async function dumpFields() {
  console.log('Loading franchise file:', filePath);

  // Import using ESM dynamic import
  const FranchiseModule = await import('madden-franchise');
  console.log('Module keys:', Object.keys(FranchiseModule));

  const createFranchise = FranchiseModule.create;
  if (!createFranchise) {
    throw new Error('No create function found');
  }

  const franchise = await createFranchise(filePath);
  console.log('\nFranchise loaded successfully');

  // Tables to inspect - IDs from the table dump
  const tablesToInspect = [
    // Coach table for fake coaches
    { name: 'Coach', id: 1864063867 },
  ];

  for (const tableInfo of tablesToInspect) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TABLE: ${tableInfo.name}`);
    console.log('='.repeat(60));

    let table = null;
    try {
      if (tableInfo.id) {
        table = franchise.getTableByUniqueId(tableInfo.id);
      }
      if (!table) {
        table = franchise.getTableByName(tableInfo.name);
      }
    } catch (e) {}

    if (!table) {
      console.log('  [TABLE NOT FOUND]');
      continue;
    }

    try {
      await table.readRecords();
      console.log(`  Records: ${table.records.length}`);

      // Get field definitions from table header
      const fieldDefs = table.header?.fields || table.header?.table3Fields || [];
      console.log(`  Field Definitions: ${fieldDefs.length}`);

      if (table.records.length > 0) {
        // Find first non-empty record
        const record = table.records.find(r => !r.isEmpty) || table.records[0];

        // Try to get field names from schema
        let fieldNames = [];

        // Method 1: Try to get from record._fields
        if (record._fields) {
          fieldNames = Object.keys(record._fields);
        }

        // Method 2: Try from table header field definitions
        if (fieldNames.length === 0 && fieldDefs.length > 0) {
          fieldNames = fieldDefs.map(f => f.name || f.fieldName || `Field_${f.index}`);
        }

        // Method 3: Try direct property enumeration with getters
        if (fieldNames.length === 0) {
          const proto = Object.getPrototypeOf(record);
          const descriptors = Object.getOwnPropertyDescriptors(proto);
          fieldNames = Object.keys(descriptors).filter(k =>
            descriptors[k].get && !k.startsWith('_') && k !== 'constructor'
          );
        }

        // Method 4: Just enumerate all props and try them
        if (fieldNames.length === 0) {
          for (const key of Object.getOwnPropertyNames(record)) {
            if (!key.startsWith('_') && typeof record[key] !== 'function') {
              fieldNames.push(key);
            }
          }
        }

        // Show coach info
        console.log(`\n  COACH INFO (first non-empty record):`);
        console.log(`      FirstName: ${record.FirstName}`);
        console.log(`      LastName: ${record.LastName}`);
        console.log(`      TeamIndex: ${record.TeamIndex}`);
        console.log(`      Position: ${record.Position}`);
        console.log(`      ContractStatus: ${record.ContractStatus}`);

        // Show ALL fields for reference
        console.log(`\n  ALL FIELDS (${fieldNames.length} total):`);
        console.log(`  ${fieldNames.join(', ')}`);

        // Also try Field_0 through Field_100 to find raw fields
        console.log(`\n  RAW FIELD VALUES (Field_X pattern):`);
        for (let i = 0; i < 100; i++) {
          const fieldName = `Field_${i}`;
          try {
            const val = record[fieldName];
            if (val !== undefined && val !== null) {
              console.log(`      ${fieldName}: ${val} [${typeof val}]`);
            }
          } catch (e) {
            // Skip errors
          }
        }
      }
    } catch (e) {
      console.log(`  [ERROR reading records: ${e.message}]`);
      console.log(`  Stack: ${e.stack}`);
    }
  }

  // No verbose table search

  console.log('\nDone!');
  process.exit(0);
}

dumpFields().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
