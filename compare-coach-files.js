/**
 * Compare coach fields between retro file and working throwback
 */
const { create } = require('madden-franchise');

async function compareCoaches() {
  // Use the AUTOSAVE to see our applied changes
  const retroFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';
  const workingFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';

  console.log('Loading retro file...');
  const retroFranchise = await create(retroFile);
  let retroCoachTable = retroFranchise.getTableByUniqueId(1864063867);
  if (!retroCoachTable) retroCoachTable = retroFranchise.getTableByName('Coach');
  await retroCoachTable.readRecords();

  console.log('Loading working throwback...');
  const workingFranchise = await create(workingFile);
  let workingCoachTable = workingFranchise.getTableByUniqueId(1864063867);
  if (!workingCoachTable) workingCoachTable = workingFranchise.getTableByName('Coach');
  await workingCoachTable.readRecords();

  // Get field names from prototype
  const sampleCoach = retroCoachTable.records.find(r => !r.isEmpty && r.Position === 'HeadCoach');
  const proto = Object.getPrototypeOf(sampleCoach);
  const descriptors = Object.getOwnPropertyDescriptors(proto);
  const fieldNames = [];
  for (const [key, desc] of Object.entries(descriptors)) {
    if (desc.get && !key.startsWith('_') && key !== 'hexData' && key !== 'fields' && key !== 'fieldsArray') {
      fieldNames.push(key);
    }
  }

  console.log('\n=== COMPARING HEAD COACHES (TeamIndex 0 - Bears) ===');

  const retroHC = retroCoachTable.records.find(r =>
    !r.isEmpty && r.TeamIndex === 0 &&
    (r.Position === 'HeadCoach' || r.Position === 0) &&
    (r.ContractStatus === 'Signed' || r.ContractStatus === undefined)
  );
  const workingHC = workingCoachTable.records.find(r =>
    !r.isEmpty && r.TeamIndex === 0 &&
    (r.Position === 'HeadCoach' || r.Position === 0) &&
    (r.ContractStatus === 'Signed' || r.ContractStatus === undefined)
  );

  console.log('\nRetro HC:', retroHC?.FirstName, retroHC?.LastName);
  console.log('Working HC:', workingHC?.FirstName, workingHC?.LastName);

  // List of known coach fields to check
  const knownFields = [
    'FirstName', 'LastName', 'Portrait', 'Position', 'TeamIndex', 'ContractStatus',
    'CharacterVisuals', 'CareerWins', 'CareerLosses', 'SeasonWins', 'SeasonLosses',
    'Age', 'BirthYear', 'Experience', 'Overall', 'Prestige', 'YearsExperience',
    'OffensivePlaybook', 'DefensivePlaybook', 'OffensiveScheme', 'DefensiveScheme',
    'CommentaryId', 'PCMT', 'AssetId', 'AssetName', 'GenericHead', 'GenericHeadName',
    'CharacterVisualsKey', 'PresentationId', 'GenericHeadId', 'UniqueId', 'PlayerAssetName',
    'CoachAssetName', 'VisualKey', 'PresentationKey', 'LastNameAudioId', 'FirstNameAudioId'
  ];

  // Also try Field_XX format
  for (let i = 0; i < 50; i++) {
    knownFields.push('Field_' + i);
  }

  console.log('\n=== FIELD COMPARISON (differences only) ===');
  for (const field of knownFields) {
    try {
      const retroVal = retroHC?.[field];
      const workingVal = workingHC?.[field];
      if (retroVal !== workingVal && retroVal !== undefined && workingVal !== undefined) {
        if (typeof retroVal !== 'object' && typeof workingVal !== 'object') {
          console.log(field + ':');
          console.log('  Retro:   ' + retroVal);
          console.log('  Working: ' + workingVal);
        }
      }
    } catch (e) {}
  }

  console.log('\n=== ALL FIELDS ON RETRO HC ===');
  for (const field of knownFields) {
    try {
      const val = retroHC?.[field];
      if (val !== undefined && val !== '' && val !== null && typeof val !== 'object' && typeof val !== 'function') {
        console.log(field + ': ' + val);
      }
    } catch (e) {}
  }

  console.log('\n=== ALL FIELDS ON WORKING HC ===');
  for (const field of knownFields) {
    try {
      const val = workingHC?.[field];
      if (val !== undefined && val !== '' && val !== null && typeof val !== 'object' && typeof val !== 'function') {
        console.log(field + ': ' + val);
      }
    } catch (e) {}
  }

  // Check CharacterVisuals table
  console.log('\n=== INVESTIGATING CharacterVisuals REFERENCE ===');
  console.log('Retro CharacterVisuals:', retroHC?.CharacterVisuals);
  console.log('Working CharacterVisuals:', workingHC?.CharacterVisuals);

  // Decode the binary reference
  const cvRef = retroHC?.CharacterVisuals;
  if (cvRef) {
    // Binary references: first N bits = table ID, last bits = record index
    const recordIndex = parseInt(cvRef.slice(-15), 2);  // last 15 bits for record index
    console.log('CharacterVisuals record index (from binary):', recordIndex);
  }

  // Try to find CharacterVisuals table
  const cvTable = workingFranchise.getTableByName('CharacterVisuals');
  if (cvTable) {
    await cvTable.readRecords();
    console.log('\nCharacterVisuals table found! Records:', cvTable.records.length);

    // Read the specific record referenced by the coach
    const cvRef = retroHC?.CharacterVisuals;
    if (cvRef) {
      const recordIndex = parseInt(cvRef.slice(-15), 2);
      const cvRecord = cvTable.records[recordIndex];
      if (cvRecord) {
        console.log('\n=== CharacterVisuals Record ' + recordIndex + ' (referenced by coach) ===');
        // Use readChviRecord if available
        try {
          const { readChviRecord } = require('madden-franchise');
          if (readChviRecord) {
            const parsed = await readChviRecord(cvRecord);
            console.log('Parsed CHVI record:', JSON.stringify(parsed, null, 2).slice(0, 2000));
          }
        } catch(e) {
          console.log('Could not parse CHVI record:', e.message);
        }

        // Also dump raw fields
        console.log('\nRaw CharacterVisuals record fields:');
        const cvProto = Object.getPrototypeOf(cvRecord);
        const cvDesc = Object.getOwnPropertyDescriptors(cvProto);
        for (const [key, desc] of Object.entries(cvDesc)) {
          if (desc.get && !key.startsWith('_') && key !== 'hexData') {
            try {
              const val = cvRecord[key];
              if (val !== undefined && val !== null && typeof val !== 'function') {
                if (key === 'data' && val.length) {
                  // Show first 200 bytes as hex
                  const hex = Buffer.from(val).slice(0, 200).toString('hex');
                  console.log('  data (first 200 bytes): ' + hex);
                  // Try to find ASCII strings in the data
                  const ascii = Buffer.from(val).toString('utf8').replace(/[^\x20-\x7E]/g, '.');
                  const names = ascii.match(/[A-Z][a-z]+/g);
                  if (names && names.length > 0) {
                    console.log('  Possible names in data:', names.slice(0, 10).join(', '));
                  }
                } else if (typeof val !== 'object') {
                  console.log('  ' + key + ': ' + val);
                }
              }
            } catch(e) {}
          }
        }
      }
    }
  } else {
    console.log('\nCharacterVisuals table NOT FOUND');
  }

  // Check CoachManager table - might have display info
  console.log('\n=== CHECKING CoachManager TABLE ===');
  const cmTable = workingFranchise.getTableByName('CoachManager');
  if (cmTable) {
    await cmTable.readRecords();
    console.log('CoachManager records:', cmTable.records.length);
    const cmRecord = cmTable.records.find(r => !r.isEmpty);
    if (cmRecord) {
      for (const field of knownFields) {
        try {
          const val = cmRecord[field];
          if (val !== undefined && val !== '' && val !== null && typeof val !== 'object') {
            console.log('  ' + field + ': ' + val);
          }
        } catch(e) {}
      }
    }
  }

  // Check for any table with "Name" in it that relates to coaches
  console.log('\n=== SEARCHING FOR TABLES WITH COACH DATA ===');
  for (const table of workingFranchise.tables) {
    const name = table.name?.toLowerCase() || '';
    if (name.includes('coachback') || name.includes('coachcentral') || name.includes('staffhiring')) {
      console.log('Found table:', table.name);
      try {
        await table.readRecords();
        const rec = table.records.find(r => !r.isEmpty);
        if (rec) {
          // Look for name-like fields
          const proto = Object.getPrototypeOf(rec);
          const desc = Object.getOwnPropertyDescriptors(proto);
          for (const [key] of Object.entries(desc)) {
            if (key.toLowerCase().includes('name') || key.toLowerCase().includes('first') || key.toLowerCase().includes('last')) {
              try {
                const val = rec[key];
                if (typeof val === 'string' && val.length > 0) {
                  console.log('  ' + table.name + '.' + key + ': ' + val);
                }
              } catch(e) {}
            }
          }
        }
      } catch(e) {}
    }
  }

  // Check CoachBackstoryInfo which might have display data
  console.log('\n=== CHECKING CoachBackstoryInfo ===');
  const backstoryTable = workingFranchise.getTableByName('CoachBackstoryInfo');
  if (backstoryTable) {
    await backstoryTable.readRecords();
    console.log('CoachBackstoryInfo records:', backstoryTable.records.length);
    // Find record for team 0
    for (const rec of backstoryTable.records.slice(0, 5)) {
      if (rec.isEmpty) continue;
      console.log('Record', rec.index, ':');
      for (const field of ['FirstName', 'LastName', 'Name', 'DisplayName', 'CoachRef', 'Coach']) {
        try {
          const val = rec[field];
          if (val !== undefined) console.log('  ' + field + ': ' + val);
        } catch(e) {}
      }
    }
  }
}

compareCoaches().catch(console.error);
