// RESEARCH: Find what table holds the reference to FA array (5930)
// and how players are supposed to be added/removed
// NO CODING - RESEARCH ONLY

async function findFAArrayReference() {
  const FranchiseModule = await import('madden-franchise');
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('FINDING FA ARRAY REFERENCE AND MANAGEMENT');
  console.log('='.repeat(80));

  const franchise = await FranchiseModule.create(filePath);

  // Get Player table
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  // The FA array is at table 5930
  const faArrayTable = franchise.getTableById(5930);
  await faArrayTable.readRecords();

  console.log(`\nFA Array table 5930 - arraySize: ${faArrayTable.records[0].arraySize}`);

  // First, let's see what table schema says about Player[] arrays
  console.log('\n' + '-'.repeat(80));
  console.log('INVESTIGATING PLAYER[] TABLE RELATIONSHIPS:');
  console.log('-'.repeat(80));

  // Get all Player[] tables and their row counts
  const playerArrayTables = franchise.tables.filter(t => t.name === 'Player[]');
  console.log(`\nTotal Player[] tables: ${playerArrayTables.length}`);

  for (const table of playerArrayTables) {
    await table.readRecords();
    const totalArrays = table.records.filter(r => !r.isEmpty && r.arraySize > 0).length;
    const totalPlayers = table.records.reduce((sum, r) => sum + (r.arraySize || 0), 0);

    if (totalPlayers > 0) {
      console.log(`  Table ${table.header?.tableId}: ${totalArrays} arrays, ${totalPlayers} total players`);
    }
  }

  // Now look at what field types reference Player[]
  console.log('\n' + '-'.repeat(80));
  console.log('SEARCHING FOR FREEAGENTLIST OR SIMILAR FIELDS:');
  console.log('-'.repeat(80));

  // Look through all tables for fields that might be the FA list reference
  const potentialFAManagers = [];

  for (const table of franchise.tables) {
    if (!table.name) continue;

    try {
      await table.readRecords();
      const rec = table.records.find(r => !r.isEmpty);
      if (!rec) continue;

      // Look for fields that might reference FA
      if (rec._fields) {
        const fieldList = Array.isArray(rec._fields) ? rec._fields : Object.keys(rec._fields);
        const faFields = fieldList.filter(f =>
          typeof f === 'string' && (
            f.toLowerCase().includes('freeagent') ||
            f.toLowerCase().includes('fa_') ||
            f.toLowerCase().includes('_fa') ||
            f.toLowerCase().includes('unrestricted')
          )
        );

        if (faFields.length > 0) {
          potentialFAManagers.push({
            tableName: table.name,
            tableId: table.header?.tableId,
            faFields
          });
        }
      }
    } catch (e) {
      // Skip
    }
  }

  console.log(`\nTables with FA-related fields: ${potentialFAManagers.length}`);

  for (const mgr of potentialFAManagers) {
    console.log(`\n${mgr.tableName} (id=${mgr.tableId}):`);
    console.log(`  FA fields: ${mgr.faFields.join(', ')}`);

    // Get the actual values
    const table = franchise.getTableById(mgr.tableId);
    if (table) {
      await table.readRecords();
      const rec = table.records.find(r => !r.isEmpty);
      if (rec) {
        for (const field of mgr.faFields) {
          const val = rec[field];
          console.log(`    ${field}: ${val}`);

          // Check if it's a reference
          try {
            const ref = rec.getReferenceDataByKey(field);
            if (ref && ref.tableId) {
              console.log(`      -> Reference: tableId=${ref.tableId}, row=${ref.rowNumber}`);
              if (ref.tableId === 5930) {
                console.log(`      *** THIS IS THE FA ARRAY REFERENCE! ***`);
              }
            }
          } catch (e) {
            // Not a reference
          }
        }
      }
    }
  }

  // Search for RosterEval or similar that might manage FA
  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATING ROSTER MANAGEMENT TABLES:');
  console.log('='.repeat(80));

  const rosterMgmtTables = franchise.tables.filter(t =>
    t.name && (
      t.name.includes('RosterEval') ||
      t.name.includes('RosterManager') ||
      t.name.includes('FreeAgent')
    )
  );

  for (const table of rosterMgmtTables) {
    try {
      await table.readRecords();
      const rec = table.records.find(r => !r.isEmpty);
      if (!rec) continue;

      console.log(`\n${table.name}:`);

      if (rec._fields) {
        const fieldList = Array.isArray(rec._fields) ? rec._fields : Object.keys(rec._fields);
        console.log(`  Total fields: ${fieldList.length}`);
        console.log(`  First 20: ${fieldList.slice(0, 20).join(', ')}`);

        // Check for any Player reference fields
        const playerFields = fieldList.filter(f =>
          typeof f === 'string' && f.toLowerCase().includes('player')
        );
        if (playerFields.length > 0) {
          console.log(`  Player fields: ${playerFields.join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Look at FranchiseUser specifically - it might have the FA list reference
  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATING FRANCHISEUSER TABLE:');
  console.log('='.repeat(80));

  const franchiseUserTable = franchise.tables.find(t => t.name === 'FranchiseUser');
  if (franchiseUserTable) {
    await franchiseUserTable.readRecords();
    const user = franchiseUserTable.records.find(r => !r.isEmpty);

    if (user && user._fields) {
      const fieldList = Array.isArray(user._fields) ? user._fields : Object.keys(user._fields);
      console.log(`\nTotal fields: ${fieldList.length}`);

      // Look for FA-related fields
      const faRelated = fieldList.filter(f =>
        typeof f === 'string' && (
          f.toLowerCase().includes('free') ||
          f.toLowerCase().includes('fa') ||
          f.toLowerCase().includes('agent') ||
          f.toLowerCase().includes('player')
        )
      );

      console.log(`\nFA/Player related fields:`);
      for (const field of faRelated) {
        const val = user[field];
        console.log(`  ${field}: ${val}`);

        try {
          const ref = user.getReferenceDataByKey(field);
          if (ref && ref.tableId) {
            console.log(`    -> Reference: tableId=${ref.tableId}, row=${ref.rowNumber}`);
            if (ref.tableId === 5930) {
              console.log(`    *** THIS IS THE FA ARRAY REFERENCE! ***`);
            }
          }
        } catch (e) {
          // Not a reference
        }
      }
    }
  }

  // Try a different approach - look at what table 5930's parent might be
  console.log('\n' + '='.repeat(80));
  console.log('CHECKING FA ARRAY TABLE PARENT:');
  console.log('='.repeat(80));

  if (faArrayTable.records[0]._parent) {
    console.log('FA array has _parent reference');
    const parent = faArrayTable.records[0]._parent;
    console.log(`Parent type: ${typeof parent}`);
    if (parent.name) {
      console.log(`Parent name: ${parent.name}`);
    }
  }

  // Check the table header for clues
  if (faArrayTable.header) {
    console.log('\nFA Array table header:');
    console.log(`  name: ${faArrayTable.header.name}`);
    console.log(`  tableId: ${faArrayTable.header.tableId}`);
    console.log(`  uniqueId: ${faArrayTable.header.uniqueId}`);
    console.log(`  recordCapacity: ${faArrayTable.header.recordCapacity}`);
    console.log(`  numMembers: ${faArrayTable.header.numMembers}`);
  }

  // Brute force search for any reference to table 5930
  console.log('\n' + '='.repeat(80));
  console.log('BRUTE FORCE SEARCH FOR REFERENCES TO TABLE 5930:');
  console.log('='.repeat(80));

  let foundReferences = [];

  for (const table of franchise.tables) {
    if (!table.name) continue;

    try {
      await table.readRecords();

      for (const rec of table.records) {
        if (rec.isEmpty) continue;

        const fields = rec._fields ?
          (Array.isArray(rec._fields) ? rec._fields : Object.keys(rec._fields)) :
          Object.keys(rec).filter(k => !k.startsWith('_'));

        for (const field of fields) {
          try {
            const ref = rec.getReferenceDataByKey ? rec.getReferenceDataByKey(field) : null;
            if (ref && ref.tableId === 5930) {
              foundReferences.push({
                tableName: table.name,
                tableId: table.header?.tableId,
                recordIndex: rec.index,
                field,
                row: ref.rowNumber
              });
            }
          } catch (e) {
            // Not a reference
          }
        }
      }
    } catch (e) {
      // Skip
    }
  }

  console.log(`\nFound ${foundReferences.length} references to FA array (5930):`);
  for (const ref of foundReferences) {
    console.log(`  ${ref.tableName}[${ref.recordIndex}].${ref.field} -> row ${ref.row}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));
}

findFAArrayReference().catch(console.error);
