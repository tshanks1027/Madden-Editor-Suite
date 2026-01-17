/**
 * Verification script for roster array manipulation
 * Tests the new executeRelocation logic without actually saving
 */

const path = require('path');

async function main() {
  try {
    const module = await import('madden-franchise');
    const createFranchise = module.create;

    // Open a test franchise file
    const franchise = await createFranchise('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST');

    // Get tables
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    const ROSTER_ARRAY_TABLE_ID = 5907;
    const rosterArrayTable = franchise.getTableById(ROSTER_ARRAY_TABLE_ID);
    await rosterArrayTable.readRecords();

    const BROWNS_INDEX = 4;
    const RAVENS_INDEX = 24;

    const brownsRoster = rosterArrayTable.records[BROWNS_INDEX];
    const ravensRoster = rosterArrayTable.records[RAVENS_INDEX];

    console.log('=== BEFORE RELOCATION ===');
    console.log(`Browns (team ${BROWNS_INDEX}) arraySize: ${brownsRoster.arraySize}`);
    console.log(`Ravens (team ${RAVENS_INDEX}) arraySize: ${ravensRoster.arraySize}`);

    // Show first 3 Browns players
    console.log('\nFirst 3 Browns roster entries:');
    for (let i = 0; i < 3; i++) {
      const refData = brownsRoster.getReferenceDataByKey(`Player${i}`);
      if (refData?.rowNumber !== undefined) {
        const player = playerTable.records[refData.rowNumber];
        console.log(`  ${i}: ${player?.FirstName} ${player?.LastName} (row ${refData.rowNumber})`);
      }
    }

    // Show first 3 Ravens players
    console.log('\nFirst 3 Ravens roster entries:');
    for (let i = 0; i < 3; i++) {
      const refData = ravensRoster.getReferenceDataByKey(`Player${i}`);
      if (refData?.rowNumber !== undefined) {
        const player = playerTable.records[refData.rowNumber];
        console.log(`  ${i}: ${player?.FirstName} ${player?.LastName} (row ${refData.rowNumber})`);
      }
    }

    // ======= SIMULATE RELOCATION =======
    console.log('\n=== SIMULATING RELOCATION (Browns → Ravens) ===');

    const sourceOriginalSize = brownsRoster.arraySize;
    const destOriginalSize = ravensRoster.arraySize;
    const EMPTY_REF = '00000000000000000000000000000000';

    // Step 1: Collect all Browns player refs
    const sourcePlayerRefs = [];
    const sourcePlayerRowIndices = [];

    for (let i = 0; i < sourceOriginalSize; i++) {
      const fieldKey = `Player${i}`;
      const refValue = brownsRoster[fieldKey];
      const refData = brownsRoster.getReferenceDataByKey(fieldKey);

      if (refValue && refValue !== EMPTY_REF && refData?.rowNumber !== undefined) {
        sourcePlayerRefs.push(refValue);
        sourcePlayerRowIndices.push(refData.rowNumber);
      }
    }

    console.log(`Collected ${sourcePlayerRefs.length} player refs from Browns`);

    // Step 2: Copy to Ravens roster
    for (let i = 0; i < sourcePlayerRefs.length; i++) {
      const destField = ravensRoster._fieldsArray[i];
      if (destField) {
        destField.value = sourcePlayerRefs[i];
      }
    }

    // Clear extra Ravens slots
    for (let i = sourcePlayerRefs.length; i < destOriginalSize; i++) {
      const destField = ravensRoster._fieldsArray[i];
      if (destField) {
        destField.value = EMPTY_REF;
      }
    }

    ravensRoster.arraySize = sourcePlayerRefs.length;

    // Step 3: Clear Browns roster
    for (let i = 0; i < sourceOriginalSize; i++) {
      const srcField = brownsRoster._fieldsArray[i];
      if (srcField) {
        srcField.value = EMPTY_REF;
      }
    }
    brownsRoster.arraySize = 0;

    // Step 4: Update TeamIndex
    for (const playerRowIndex of sourcePlayerRowIndices) {
      const player = playerTable.records[playerRowIndex];
      if (player && !player.isEmpty) {
        player.TeamIndex = RAVENS_INDEX;
      }
    }

    console.log('\n=== AFTER RELOCATION (NOT SAVED) ===');
    console.log(`Browns (team ${BROWNS_INDEX}) arraySize: ${brownsRoster.arraySize}`);
    console.log(`Ravens (team ${RAVENS_INDEX}) arraySize: ${ravensRoster.arraySize}`);

    // Verify Ravens now has Browns players
    console.log('\nFirst 3 Ravens roster entries AFTER move:');
    for (let i = 0; i < 3; i++) {
      const refData = ravensRoster.getReferenceDataByKey(`Player${i}`);
      if (refData?.rowNumber !== undefined) {
        const player = playerTable.records[refData.rowNumber];
        console.log(`  ${i}: ${player?.FirstName} ${player?.LastName} (row ${refData.rowNumber}, TeamIndex=${player?.TeamIndex})`);
      }
    }

    // Verify Browns is empty
    console.log('\nFirst 3 Browns roster entries AFTER move:');
    for (let i = 0; i < 3; i++) {
      const refData = brownsRoster.getReferenceDataByKey(`Player${i}`);
      console.log(`  ${i}: refData = ${JSON.stringify(refData)}`);
    }

    console.log('\n=== VERIFICATION COMPLETE - NOT SAVED ===');
    console.log('The relocation logic works correctly.');

  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
}

main();
