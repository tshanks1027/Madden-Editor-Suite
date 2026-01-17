/**
 * Detailed comparison of ALL coach fields between files
 */
const { create } = require('madden-franchise');

async function compareCoaches() {
  const workingFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';
  const baseFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading 2011 Throwback (working)...');
  const workingFranchise = await create(workingFile);
  let workingCoachTable = workingFranchise.getTableByUniqueId(1864063867);
  if (!workingCoachTable) workingCoachTable = workingFranchise.getTableByName('Coach');
  await workingCoachTable.readRecords();

  console.log('Loading 1980 Retro...');
  const baseFranchise = await create(baseFile);
  let baseCoachTable = baseFranchise.getTableByUniqueId(1864063867);
  if (!baseCoachTable) baseCoachTable = baseFranchise.getTableByName('Coach');
  await baseCoachTable.readRecords();

  // Find Bears head coaches
  const workingHC = workingCoachTable.records.find(r =>
    !r.isEmpty && r.TeamIndex === 0 && (r.Position === 'HeadCoach' || r.Position === 0) &&
    (r.ContractStatus === 'Signed' || r.ContractStatus === undefined)
  );
  const baseHC = baseCoachTable.records.find(r =>
    !r.isEmpty && r.TeamIndex === 0 && (r.Position === 'HeadCoach' || r.Position === 0) &&
    (r.ContractStatus === 'Signed' || r.ContractStatus === undefined)
  );

  console.log('\n=== BEARS HEAD COACH COMPARISON ===');
  console.log('Working (2011):', workingHC?.FirstName, workingHC?.LastName);
  console.log('Base (1980):', baseHC?.FirstName, baseHC?.LastName);

  // Get all fields from working coach
  if (!workingHC || !workingHC._fieldsArray) {
    console.log('No _fieldsArray found');
    return;
  }

  console.log('\n=== ALL FIELD DIFFERENCES ===');

  const workingFields = {};
  const baseFields = {};

  for (const field of workingHC._fieldsArray) {
    const name = field.name || field.key || field._key;
    workingFields[name] = field.value;
  }

  if (baseHC && baseHC._fieldsArray) {
    for (const field of baseHC._fieldsArray) {
      const name = field.name || field.key || field._key;
      baseFields[name] = field.value;
    }
  }

  // Show differences
  const allFieldNames = new Set([...Object.keys(workingFields), ...Object.keys(baseFields)]);

  for (const name of [...allFieldNames].sort()) {
    const workVal = workingFields[name];
    const baseVal = baseFields[name];

    if (workVal !== baseVal) {
      // Skip long binary strings for display
      const wDisplay = typeof workVal === 'string' && workVal.length > 50 ? workVal.slice(0, 50) + '...' : workVal;
      const bDisplay = typeof baseVal === 'string' && baseVal.length > 50 ? baseVal.slice(0, 50) + '...' : baseVal;

      console.log(`${name}:`);
      console.log(`  Working: ${wDisplay}`);
      console.log(`  Base:    ${bDisplay}`);
    }
  }

  // Show Name field specifically
  console.log('\n=== CRITICAL DISPLAY FIELDS ===');
  console.log('Working Name:', workingHC.Name);
  console.log('Base Name:', baseHC?.Name);
  console.log('Working AssetName:', workingHC.AssetName);
  console.log('Base AssetName:', baseHC?.AssetName);
  console.log('Working GenericHeadAssetName:', workingHC.GenericHeadAssetName);
  console.log('Base GenericHeadAssetName:', baseHC?.GenericHeadAssetName);
  console.log('Working PresentationId:', workingHC.PresentationId);
  console.log('Base PresentationId:', baseHC?.PresentationId);
  console.log('Working SpeechId:', workingHC.SpeechId);
  console.log('Base SpeechId:', baseHC?.SpeechId);
}

compareCoaches().catch(console.error);
