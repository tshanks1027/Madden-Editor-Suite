// RESEARCH: Compare a file BEFORE and AFTER releasing a player via MFT
// Goal: Find exactly what MFT modifies that we don't
// NO CODING - RESEARCH ONLY

// INSTRUCTIONS:
// 1. Make a COPY of a franchise file (BEFORE)
// 2. Use MFT to release a specific player to FA
// 3. Save (AFTER)
// 4. Run this script to compare both files

async function compareMFTChanges() {
  const beforeFile = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';
  const afterFile = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-MFTTEST';

  console.log('='.repeat(80));
  console.log('MFT CHANGE COMPARISON');
  console.log('='.repeat(80));
  console.log(`BEFORE: ${beforeFile}`);
  console.log(`AFTER: ${afterFile}`);

  const FranchiseModule = await import('madden-franchise');

  let beforeFranchise, afterFranchise;

  try {
    beforeFranchise = await FranchiseModule.create(beforeFile);
    console.log('\nBEFORE file loaded');
  } catch (e) {
    console.log(`Cannot open BEFORE file: ${e.message}`);
    return;
  }

  try {
    afterFranchise = await FranchiseModule.create(afterFile);
    console.log('AFTER file loaded');
  } catch (e) {
    console.log(`Cannot open AFTER file: ${e.message}`);
    console.log('\nTo use this script:');
    console.log('1. Copy CAREER-Testing to CAREER-MFTTEST');
    console.log('2. Open CAREER-MFTTEST in MFT');
    console.log('3. Release a player (e.g., Patrick Mahomes) to FA');
    console.log('4. Save the file');
    console.log('5. Run this script again');
    return;
  }

  // Get Player tables
  const beforePlayerTable = beforeFranchise.tables.find(t => t.name === 'Player');
  const afterPlayerTable = afterFranchise.tables.find(t => t.name === 'Player');

  await beforePlayerTable.readRecords();
  await afterPlayerTable.readRecords();

  // Find the player that was released (look for TeamIndex change)
  console.log('\n' + '-'.repeat(80));
  console.log('PLAYERS WITH CHANGED TEAMINDEX:');
  console.log('-'.repeat(80));

  const changedPlayers = [];
  for (let i = 0; i < beforePlayerTable.records.length; i++) {
    const before = beforePlayerTable.records[i];
    const after = afterPlayerTable.records[i];

    if (before.isEmpty && after.isEmpty) continue;

    const beforeTI = before.TeamIndex;
    const afterTI = after.TeamIndex;

    if (beforeTI !== afterTI) {
      changedPlayers.push({
        index: i,
        name: `${after.FirstName} ${after.LastName}`,
        beforeTeam: beforeTI,
        afterTeam: afterTI
      });
    }
  }

  if (changedPlayers.length === 0) {
    console.log('No players with changed TeamIndex found');
    console.log('Make sure you released a player via MFT and saved the file');
    return;
  }

  for (const cp of changedPlayers) {
    console.log(`${cp.name}: Team ${cp.beforeTeam} -> Team ${cp.afterTeam}`);
  }

  // For each changed player, compare ALL fields
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED FIELD COMPARISON FOR CHANGED PLAYERS:');
  console.log('='.repeat(80));

  for (const cp of changedPlayers) {
    const before = beforePlayerTable.records[cp.index];
    const after = afterPlayerTable.records[cp.index];

    console.log(`\n${cp.name} (index ${cp.index}):`);
    console.log('-'.repeat(60));

    const allFields = Object.keys(after).filter(k => !k.startsWith('_'));

    for (const field of allFields) {
      const beforeVal = before[field];
      const afterVal = after[field];

      if (String(beforeVal) !== String(afterVal)) {
        console.log(`  ${field}: "${beforeVal}" -> "${afterVal}"`);
      }
    }
  }

  // Now compare ALL tables for ANY changes
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING ALL TABLES FOR ANY CHANGES:');
  console.log('='.repeat(80));

  const changedTables = [];

  for (let t = 0; t < beforeFranchise.tables.length; t++) {
    const beforeTable = beforeFranchise.tables[t];
    const afterTable = afterFranchise.tables[t];

    if (!beforeTable || !afterTable) continue;
    if (beforeTable.name !== afterTable.name) continue;

    try {
      await beforeTable.readRecords();
      await afterTable.readRecords();

      // Compare record counts
      const beforeNonEmpty = beforeTable.records.filter(r => !r.isEmpty).length;
      const afterNonEmpty = afterTable.records.filter(r => !r.isEmpty).length;

      if (beforeNonEmpty !== afterNonEmpty) {
        changedTables.push({
          name: beforeTable.name,
          index: t,
          type: 'record_count',
          before: beforeNonEmpty,
          after: afterNonEmpty
        });
      }

      // Sample check first 100 records for changes
      const maxCheck = Math.min(100, beforeTable.records.length, afterTable.records.length);
      let hasChanges = false;

      for (let r = 0; r < maxCheck; r++) {
        const beforeRec = beforeTable.records[r];
        const afterRec = afterTable.records[r];

        if (beforeRec.isEmpty !== afterRec.isEmpty) {
          hasChanges = true;
          break;
        }

        if (!beforeRec.isEmpty && !afterRec.isEmpty) {
          const fields = Object.keys(afterRec).filter(k => !k.startsWith('_'));
          for (const field of fields) {
            if (String(beforeRec[field]) !== String(afterRec[field])) {
              hasChanges = true;
              break;
            }
          }
        }

        if (hasChanges) break;
      }

      if (hasChanges && beforeTable.name !== 'Player') {
        changedTables.push({
          name: beforeTable.name,
          index: t,
          type: 'data_change'
        });
      }
    } catch (e) {
      // Skip tables that error
    }
  }

  console.log(`\nTables with changes (excluding Player): ${changedTables.length}`);

  for (const ct of changedTables) {
    if (ct.type === 'record_count') {
      console.log(`  ${ct.name}: ${ct.before} -> ${ct.after} records`);
    } else {
      console.log(`  ${ct.name}: data changed`);
    }
  }

  // For each changed table, show details
  if (changedTables.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('DETAILED CHANGES IN NON-PLAYER TABLES:');
    console.log('-'.repeat(80));

    for (const ct of changedTables.slice(0, 10)) {
      const beforeTable = beforeFranchise.tables[ct.index];
      const afterTable = afterFranchise.tables[ct.index];

      console.log(`\n${ct.name}:`);

      await beforeTable.readRecords();
      await afterTable.readRecords();

      // Find changed records
      const maxCheck = Math.min(50, beforeTable.records.length, afterTable.records.length);

      for (let r = 0; r < maxCheck; r++) {
        const beforeRec = beforeTable.records[r];
        const afterRec = afterTable.records[r];

        if (beforeRec.isEmpty && afterRec.isEmpty) continue;

        const fields = Object.keys(afterRec).filter(k => !k.startsWith('_'));
        const changes = [];

        for (const field of fields) {
          if (String(beforeRec[field]) !== String(afterRec[field])) {
            changes.push(`${field}: "${beforeRec[field]}" -> "${afterRec[field]}"`);
          }
        }

        if (changes.length > 0) {
          console.log(`  Record ${r}:`);
          for (const change of changes.slice(0, 5)) {
            console.log(`    ${change}`);
          }
          if (changes.length > 5) {
            console.log(`    ... and ${changes.length - 5} more changes`);
          }
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('COMPARISON COMPLETE');
  console.log('='.repeat(80));
}

compareMFTChanges().catch(console.error);
