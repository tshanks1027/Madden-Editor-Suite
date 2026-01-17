/**
 * Explore ALL tables in the franchise file for coach-related data
 * Find where names are stored that the upgrade screen uses
 */
const { create } = require('madden-franchise');

async function exploreAllTables() {
  const workingFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';
  const retroFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading 2011 Throwback (working) file...');
  const workingFranchise = await create(workingFile);

  console.log('Loading 1980 Retro file...');
  const retroFranchise = await create(retroFile);

  // Get head coach references
  let workingCoachTable = workingFranchise.getTableByUniqueId(1864063867);
  if (!workingCoachTable) workingCoachTable = workingFranchise.getTableByName('Coach');
  await workingCoachTable.readRecords();

  let retroCoachTable = retroFranchise.getTableByUniqueId(1864063867);
  if (!retroCoachTable) retroCoachTable = retroFranchise.getTableByName('Coach');
  await retroCoachTable.readRecords();

  const workingHC = workingCoachTable.records.find(r =>
    !r.isEmpty && r.TeamIndex === 0 && r.Position === 'HeadCoach'
  );
  const retroHC = retroCoachTable.records.find(r =>
    !r.isEmpty && r.TeamIndex === 0 && r.Position === 'HeadCoach'
  );

  console.log('\n=== Bears Head Coach (TeamIndex 0) ===');
  console.log('Working (2011): ' + workingHC?.FirstName + ' ' + workingHC?.LastName + ' (index: ' + workingHC?.index + ')');
  console.log('Retro (1980):   ' + retroHC?.FirstName + ' ' + retroHC?.LastName + ' (index: ' + retroHC?.index + ')');

  // Search all tables for references to "Smith" or "Lovie" or "SmithLovie" or the coach index
  console.log('\n=== SEARCHING ALL TABLES FOR COACH DATA ===\n');

  const searchTerms = ['SmithLovie', 'Lovie', 'Smith', 'Armstrong', 'Neill'];
  const coachIndex = workingHC?.index;

  for (const table of workingFranchise.tables) {
    if (!table.name) continue;

    try {
      await table.readRecords();

      // Skip tables with no records
      if (!table.records || table.records.length === 0) continue;

      const nonEmptyRecords = table.records.filter(r => !r.isEmpty);
      if (nonEmptyRecords.length === 0) continue;

      // Get field names
      const sampleRec = nonEmptyRecords[0];
      const proto = Object.getPrototypeOf(sampleRec);
      const descriptors = Object.getOwnPropertyDescriptors(proto);
      const fieldNames = [];
      for (const [key, desc] of Object.entries(descriptors)) {
        if (desc.get && !key.startsWith('_') && key !== 'hexData' && key !== 'fields' && key !== 'fieldsArray') {
          fieldNames.push(key);
        }
      }

      // Check for name-related fields
      let hasNameField = false;
      let hasCoachRef = false;

      for (const field of fieldNames) {
        const lower = field.toLowerCase();
        if (lower.includes('name') || lower.includes('coach') || lower.includes('asset') ||
            lower.includes('presentation') || lower.includes('visual') || lower.includes('portrait')) {
          hasNameField = true;
        }
        if (lower.includes('coach')) {
          hasCoachRef = true;
        }
      }

      // Search records for coach references
      let foundMatch = false;
      for (const record of nonEmptyRecords.slice(0, 100)) { // Check first 100 non-empty records
        for (const field of fieldNames) {
          try {
            const val = record[field];
            if (typeof val === 'string') {
              for (const term of searchTerms) {
                if (val.includes(term)) {
                  if (!foundMatch) {
                    console.log(`\n=== ${table.name} ===`);
                    console.log('Fields: ' + fieldNames.slice(0, 15).join(', ') + (fieldNames.length > 15 ? '...' : ''));
                    foundMatch = true;
                  }
                  console.log(`  Record ${record.index}, ${field}: "${val}"`);
                }
              }
            }
            // Also check for references that might be the coach record index
            if (typeof val === 'string' && val.length > 20 && val.match(/^[01]+$/)) {
              // Binary reference - check if last 15 bits equal coach index
              const refIndex = parseInt(val.slice(-15), 2);
              if (refIndex === coachIndex) {
                if (!foundMatch) {
                  console.log(`\n=== ${table.name} ===`);
                  console.log('Fields: ' + fieldNames.slice(0, 15).join(', ') + (fieldNames.length > 15 ? '...' : ''));
                  foundMatch = true;
                }
                console.log(`  Record ${record.index}, ${field}: Reference to coach index ${coachIndex}`);
              }
            }
          } catch (e) {}
        }
      }

      // If table has coach-related fields, show them anyway
      if (hasCoachRef && !foundMatch) {
        console.log(`\n=== ${table.name} (has Coach-related fields) ===`);
        console.log('Fields: ' + fieldNames.join(', '));
        // Show first non-empty record
        if (nonEmptyRecords.length > 0) {
          console.log('Sample record:');
          for (const field of fieldNames) {
            try {
              const val = nonEmptyRecords[0][field];
              if (val !== undefined && val !== null && val !== '' && typeof val !== 'object') {
                console.log(`  ${field}: ${val}`);
              }
            } catch (e) {}
          }
        }
      }

    } catch (e) {
      // Skip tables that fail to read
    }
  }

  // Specifically check PresentationId table
  console.log('\n\n=== CHECKING PresentationId RELATED TABLES ===');

  const presentationId = workingHC?.PresentationId;
  console.log('Working HC PresentationId: ' + presentationId);

  // Look for Presentation tables
  for (const table of workingFranchise.tables) {
    if (!table.name) continue;
    const name = table.name.toLowerCase();
    if (name.includes('presentation') || name.includes('presid') || name.includes('pres_')) {
      console.log(`\nFound table: ${table.name}`);
      try {
        await table.readRecords();
        console.log(`Records: ${table.records.filter(r => !r.isEmpty).length}`);

        // Check if there's a record at the presentationId index
        if (presentationId && table.records[presentationId]) {
          const rec = table.records[presentationId];
          console.log('Record at PresentationId index:');
          const proto = Object.getPrototypeOf(rec);
          const desc = Object.getOwnPropertyDescriptors(proto);
          for (const [key, d] of Object.entries(desc)) {
            if (d.get && !key.startsWith('_')) {
              try {
                const val = rec[key];
                if (val !== undefined && val !== null && typeof val !== 'object') {
                  console.log(`  ${key}: ${val}`);
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.log('  Error reading: ' + e.message);
      }
    }
  }

  // Check Team table to see what references coaches
  console.log('\n\n=== CHECKING TEAM TABLE COACH REFERENCES ===');
  let teamTable = workingFranchise.getTableByName('Team');
  if (teamTable) {
    await teamTable.readRecords();
    const bearsTeam = teamTable.records.find(t => t.TeamIndex === 0 && !t.isEmpty);

    if (bearsTeam) {
      const proto = Object.getPrototypeOf(bearsTeam);
      const desc = Object.getOwnPropertyDescriptors(proto);
      console.log('Bears team coach-related fields:');
      for (const [key, d] of Object.entries(desc)) {
        if (d.get && !key.startsWith('_')) {
          const lower = key.toLowerCase();
          if (lower.includes('coach') || lower.includes('head') || lower.includes('staff')) {
            try {
              console.log(`  ${key}: ${bearsTeam[key]}`);
            } catch (e) {}
          }
        }
      }
    }
  }
}

exploreAllTables().catch(console.error);
