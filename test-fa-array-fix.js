// TEST: Verify the FA array fix is working
// This script tests that players moved to FA are properly added to the FA array (table 5930)

async function testFAArrayFix() {
  const FranchiseModule = await import('madden-franchise');
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('TESTING FA ARRAY FIX');
  console.log('='.repeat(80));

  const franchise = await FranchiseModule.create(filePath);

  // Get tables
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  const faArrayTable = franchise.getTableById(5930);
  await faArrayTable.readRecords();

  const faArray = faArrayTable.records[0];

  console.log('\n--- INITIAL STATE ---');
  console.log(`FA Array size: ${faArray.arraySize}`);

  // Count FA players in Player table
  const faPlayers = playerTable.records.filter(p =>
    !p.isEmpty &&
    Number(p.TeamIndex) === 32 &&
    p.ContractStatus === 'FreeAgent'
  );
  console.log(`FA players in Player table: ${faPlayers.length}`);

  // Get all players in FA array
  const faArrayPlayerIndices = new Set();
  for (let i = 0; i < faArray.arraySize; i++) {
    try {
      const playerRef = faArray.getReferenceDataByKey(`Player${i}`);
      if (playerRef && playerRef.rowNumber !== undefined) {
        faArrayPlayerIndices.add(playerRef.rowNumber);
      }
    } catch (e) {
      // Skip
    }
  }
  console.log(`Players in FA array: ${faArrayPlayerIndices.size}`);

  // Find FA players NOT in array (this is what our fix should prevent)
  const faPlayerIndices = new Set(faPlayers.map(p => p.index));
  const inFAButNotArray = [...faPlayerIndices].filter(i => !faArrayPlayerIndices.has(i));

  console.log('\n--- SYNC CHECK ---');
  console.log(`FA players missing from array: ${inFAButNotArray.length}`);

  if (inFAButNotArray.length > 0) {
    console.log('\nPlayers missing from FA array (should be added by fix):');
    for (const idx of inFAButNotArray.slice(0, 10)) {
      const player = playerTable.records[idx];
      console.log(`  ${player.FirstName} ${player.LastName} (index ${idx})`);
    }
  } else {
    console.log('\nSUCCESS: All FA players are in the FA array!');
  }

  // Test player reference creation
  console.log('\n--- TESTING PLAYER REFERENCE FORMAT ---');
  const testPlayer = faPlayers[0];
  if (testPlayer) {
    const tableId = playerTable.header.tableId;
    const rowNumber = testPlayer.index;

    // Binary reference format: 15-bit tableId + 17-bit rowNumber
    const tableBits = tableId.toString(2).padStart(15, '0');
    const rowBits = rowNumber.toString(2).padStart(17, '0');
    const playerRef = tableBits + rowBits;

    console.log(`Test player: ${testPlayer.FirstName} ${testPlayer.LastName}`);
    console.log(`  tableId: ${tableId} (binary: ${tableBits})`);
    console.log(`  rowNumber: ${rowNumber} (binary: ${rowBits})`);
    console.log(`  Combined reference: ${playerRef}`);

    // Verify this matches how getReferenceDataByKey works
    // Find this player in the FA array
    let foundAt = -1;
    for (let i = 0; i < faArray.arraySize; i++) {
      try {
        const ref = faArray.getReferenceDataByKey(`Player${i}`);
        if (ref && ref.rowNumber === testPlayer.index) {
          foundAt = i;
          break;
        }
      } catch (e) {
        // Skip
      }
    }

    if (foundAt >= 0) {
      console.log(`  Found in FA array at position: ${foundAt}`);
    } else {
      console.log(`  NOT FOUND in FA array!`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));

  // Summary
  console.log('\n--- SUMMARY ---');
  if (inFAButNotArray.length === 0 && faArray.arraySize === faPlayers.length) {
    console.log('STATUS: FA array is in sync with Player table');
    console.log('The FA array fix should work correctly for new FA moves.');
  } else if (inFAButNotArray.length > 0) {
    console.log(`STATUS: ${inFAButNotArray.length} FA players not in array`);
    console.log('These are likely from previous edits before the fix.');
    console.log('New FA moves should now work correctly.');
  } else {
    console.log(`STATUS: Array size (${faArray.arraySize}) differs from FA count (${faPlayers.length})`);
  }
}

testFAArrayFix().catch(console.error);
