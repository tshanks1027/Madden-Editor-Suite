/**
 * Test changing Payton Turner to a white/light skin generic face
 */

async function test() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  const sourcePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';
  const destPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-GENRTEST2';

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

      // Change to gen_1 (light skin)
      const newGENR = 'gen_1_B_N_010';
      const newSKNT = 1;

      console.log('\nSetting new values:');
      console.log(`  GENR: ${newGENR}`);
      console.log(`  SKNT: ${newSKNT}`);

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
  console.log('Done! Load ROSTER-GENRTEST2 in game - Turner should now have a white/light skin face.');
}

test().catch(console.error);
