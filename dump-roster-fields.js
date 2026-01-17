/**
 * Dump all field names from a Madden roster file to find Long Snap field
 */
const path = require('path');
const { parseRosterFile } = require('./src/main/parsers/RosterParser.js');

const ROSTER_PATH = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'ROSTER-GENERATED');

async function dumpFields() {
  console.log('Loading roster from:', ROSTER_PATH);

  try {
    const result = await parseRosterFile(ROSTER_PATH);

    if (result.players && result.players.length > 0) {
      const firstPlayer = result.players[0];
      const fieldNames = Object.keys(firstPlayer).sort();
      console.log('\nAll PLAY table fields (' + fieldNames.length + '):');
      console.log(fieldNames.join('\n'));

      // Look for anything with SN, LS, or SNAP in it
      const snapFields = fieldNames.filter(f =>
        f.includes('SN') || f.includes('LS') || f.toLowerCase().includes('snap')
      );
      console.log('\n=== Fields with SN/LS/SNAP ===');
      console.log(snapFields.join(', ') || 'NONE FOUND');

      // Also show any P*** fields we might be missing
      const pFields = fieldNames.filter(f => f.startsWith('P') && f.length === 4);
      console.log('\n=== All 4-char P*** rating fields ===');
      console.log(pFields.join(', '));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

dumpFields();
