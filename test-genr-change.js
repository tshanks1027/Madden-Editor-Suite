/**
 * Test changing a player's GENR and SKNT in BLBM
 * This will modify Payton Turner to use a gen_7 face with SKNT=7
 */

async function test() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');
  const fs = require('fs');

  // Use Official as source, save to new file
  const sourcePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';
  const destPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-GENRTEST';

  console.log('Loading roster...');
  const helper = new MaddenRosterHelper();
  const file = await helper.load(sourcePath);

  const blob = file.BLOB.records[0];
  const blbm = blob.fields['BLBM']?.value;

  let found = false;
  for (const rec of blbm._records) {
    const fields = rec.fields || rec._fields;
    const clnm = fields['CLNM']?.value ?? fields['CLNM']?._value;
    const cfnm = fields['CFNM']?.value ?? fields['CFNM']?._value;

    if (clnm === 'Turner' && cfnm === 'Payton') {
      console.log('\nFound Payton Turner, current values:');
      console.log(`  GENR: ${fields['GENR']?.value ?? fields['GENR']?._value}`);
      console.log(`  SKNT: ${fields['SKNT']?.value ?? fields['SKNT']?._value}`);

      // Change to gen_7 (dark skin)
      const newGENR = 'gen_7_B_N_019';
      const newSKNT = 7;

      console.log('\nSetting new values:');
      console.log(`  GENR: ${newGENR}`);
      console.log(`  SKNT: ${newSKNT}`);

      // Set the values
      if (fields['GENR'].value !== undefined) {
        fields['GENR'].value = newGENR;
        fields['SKNT'].value = newSKNT;
      } else {
        fields['GENR']._value = newGENR;
        fields['SKNT']._value = newSKNT;
      }

      found = true;
      break;
    }
  }

  if (!found) {
    console.log('Payton Turner not found in BLBM!');
    return;
  }

  console.log('\nSaving to:', destPath);
  await helper.save(destPath);
  console.log('Done! Load ROSTER-GENRTEST in game and check Payton Turner\'s face.');
}

test().catch(console.error);
