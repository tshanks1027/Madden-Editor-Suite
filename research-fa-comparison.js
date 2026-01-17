// RESEARCH: Compare visible FA players vs non-visible players
// Goal: Find what field(s) make a player show up in FA

async function compareAllFields(filePath) {
  console.log('='.repeat(80));
  console.log('FA PLAYER FIELD COMPARISON');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}\n`);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  // Find specific players
  const targets = {
    // Players user says ARE visible in FA
    'Shaq Mason': null,
    'Stephon Gilmore': null,
    // Players user says are NOT visible (and should be on expansion teams originally)
    'Bryce Young': null,
    'Trevor Lawrence': null,
    // Control: a player we know is on a team
    'Patrick Mahomes': null,
  };

  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const fullName = `${player.FirstName} ${player.LastName}`;
    if (targets.hasOwnProperty(fullName)) {
      targets[fullName] = player;
    }
  }

  // Get ALL field names from first non-empty player
  const samplePlayer = playerTable.records.find(r => !r.isEmpty);
  const allFields = [];

  // Use the franchise schema to get actual field names
  if (playerTable.header && playerTable.header.record2Fields) {
    for (const field of playerTable.header.record2Fields) {
      allFields.push(field.name);
    }
  }

  // If no schema fields, try to enumerate
  if (allFields.length === 0 && samplePlayer) {
    // Get fields from the record's fieldsArray
    if (samplePlayer.fieldsArray) {
      for (const field of samplePlayer.fieldsArray) {
        if (field.key && !field.key.startsWith('_')) {
          allFields.push(field.key);
        }
      }
    }
  }

  console.log(`Total fields to compare: ${allFields.length}\n`);

  // Print header
  const names = Object.keys(targets);
  console.log('Field'.padEnd(40) + names.map(n => n.substring(0, 15).padEnd(17)).join(''));
  console.log('='.repeat(40 + names.length * 17));

  // Compare each field
  for (const fieldName of allFields) {
    const values = [];
    let hasDifference = false;
    let firstVal = null;

    for (const name of names) {
      const player = targets[name];
      let value = 'NOT_FOUND';

      if (player) {
        try {
          value = player[fieldName];
          if (value === undefined) value = 'undefined';
          if (value === null) value = 'null';
        } catch (e) {
          value = 'ERROR';
        }
      }

      values.push(String(value).substring(0, 15));

      if (firstVal === null) firstVal = value;
      else if (String(value) !== String(firstVal)) hasDifference = true;
    }

    // Only print fields that differ between players
    if (hasDifference || fieldName.toLowerCase().includes('team') ||
        fieldName.toLowerCase().includes('contract') ||
        fieldName.toLowerCase().includes('status') ||
        fieldName.toLowerCase().includes('roster')) {
      console.log(fieldName.padEnd(40) + values.map(v => v.padEnd(17)).join(''));
    }
  }

  console.log('\n' + '='.repeat(80));

  // Now let's also check if there's a pattern in which tables reference these players
  console.log('\nChecking which tables reference each player...\n');

  // Player array tables that might hold roster info
  const arrayTables = franchise.tables.filter(t =>
    t.name && t.name.includes('Player[]')
  );

  for (const name of names) {
    const player = targets[name];
    if (!player) {
      console.log(`${name}: NOT FOUND`);
      continue;
    }

    console.log(`\n${name} (record index ${player.index}):`);

    // Check a few key array tables
    let foundIn = [];
    for (const table of arrayTables.slice(0, 10)) {
      try {
        await table.readRecords();
        for (const record of table.records) {
          if (record.isEmpty) continue;
          // Check if this array contains a reference to the player
          for (let i = 0; i < 100; i++) {
            const ref = record[`Player${i}`];
            if (!ref) break;
            if (ref.includes && ref.includes(`${player.index}`)) {
              foundIn.push(`${table.name} (row ${record.index})`);
              break;
            }
          }
        }
      } catch (e) {
        // Skip tables that error
      }
    }

    if (foundIn.length > 0) {
      console.log(`  Found in: ${foundIn.join(', ')}`);
    } else {
      console.log(`  Not found in any checked Player[] tables`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

// Test on EDITED file (after retro changes)
const testFile = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-95Testing';
compareAllFields(testFile).catch(console.error);
