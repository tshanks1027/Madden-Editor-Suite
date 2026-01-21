/**
 * Clear Injuries Script
 *
 * Clears all INJY table records by setting PGID to 0 (unlinks from players)
 *
 * Usage: node clear-injuries.js <input-roster> <output-roster>
 */

const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function clearInjuries() {
  const inputPath = process.argv[2] || 'C:/Users/tshan/Documents/Madden NFL 26/Saves/ROSTER-Official';
  const outputPath = process.argv[3] || 'C:/Users/tshan/Documents/Madden NFL 26/Saves/ROSTER-NOINJURY';

  console.log('=== CLEAR INJURIES ===');
  console.log('Input:', inputPath);
  console.log('Output:', outputPath);
  console.log();

  try {
    const helper = new MaddenRosterHelper();
    const file = await helper.load(inputPath);

    const injyTable = file.INJY;
    if (!injyTable || !injyTable.records) {
      console.log('No INJY table found');
      return;
    }

    console.log(`Found ${injyTable.records.length} injury records`);

    // Count injuries before
    let injuredBefore = 0;
    for (const record of injyTable.records) {
      const pgid = record.fields['PGID']?.value;
      if (pgid && pgid !== 0) {
        injuredBefore++;
      }
    }
    console.log(`Injured players before: ${injuredBefore}`);

    // Clear all injuries by setting PGID to 0
    let cleared = 0;
    for (const record of injyTable.records) {
      const pgidField = record.fields['PGID'];
      if (pgidField && pgidField.value !== 0) {
        console.log(`Clearing injury for PGID ${pgidField.value}`);
        pgidField.value = 0;
        cleared++;
      }

      // Also clear other fields to be safe
      if (record.fields['TGID']) record.fields['TGID'].value = 0;
      if (record.fields['INJL']) record.fields['INJL'].value = 0;
      if (record.fields['INJR']) record.fields['INJR'].value = 0;
      if (record.fields['INJS']) record.fields['INJS'].value = 0;
      if (record.fields['INJT']) record.fields['INJT'].value = 0;
      if (record.fields['INIR']) record.fields['INIR'].value = 0;
      if (record.fields['INSI']) record.fields['INSI'].value = 0;
      if (record.fields['INTW']) record.fields['INTW'].value = 0;
    }

    console.log(`Cleared ${cleared} injury records`);

    // Save
    console.log('Saving to:', outputPath);
    await helper.save(outputPath);

    console.log('Done! Load ROSTER-NOINJURY in Madden to verify injuries are cleared.');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

clearInjuries();
