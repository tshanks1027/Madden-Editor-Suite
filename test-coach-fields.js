/**
 * Test script to analyze Coach table fields and AssetName values
 */
const path = require('path');
const { create } = require('madden-franchise');

async function analyzeCoachFields(filePath) {
  console.log('Loading franchise file:', filePath);

  const franchise = await create(filePath);

  // Try getting Coach table by unique ID
  let coachTable = franchise.getTableByUniqueId(1864063867);
  if (!coachTable) {
    coachTable = franchise.getTableByName('Coach');
  }

  if (!coachTable) {
    console.log('Could not find Coach table!');
    return;
  }

  console.log(`Found Coach table with ${coachTable.header?.recordCount || '?'} records`);

  await coachTable.readRecords();
  console.log(`\nLoaded ${coachTable.records.length} coach records`);

  // Show ALL fields of first record
  if (coachTable.records.length > 0) {
    const firstRecord = coachTable.records[0];
    const allFields = Object.keys(firstRecord).filter(k => !k.startsWith('_') && typeof firstRecord[k] !== 'function');

    console.log('\n=== ALL COACH TABLE FIELDS ===');
    allFields.forEach(f => {
      const val = firstRecord[f];
      const display = typeof val === 'object' ? JSON.stringify(val) : val;
      console.log(`  ${f}: ${display}`);
    });
  }

  // Show first 5 coaches with portrait-related fields
  console.log('\n\n=== FIRST 10 COACHES (HC only) WITH PORTRAIT FIELDS ===');
  let count = 0;
  for (const record of coachTable.records) {
    if (record.isEmpty) continue;
    if (record.TeamIndex === undefined || record.TeamIndex >= 32) continue;

    const position = record.Position;
    const isHC = position === 0 || position === 'HeadCoach' || position === 'CoachPosition:HeadCoach';
    if (!isHC) continue;

    if (count >= 10) break;
    count++;

    console.log(`\nTeam ${record.TeamIndex}: ${record.FirstName} ${record.LastName}`);
    console.log(`  Position: ${record.Position}`);
    console.log(`  AssetName: "${record.AssetName || '(undefined)'}"`);
    console.log(`  GenericHeadAssetName: "${record.GenericHeadAssetName || '(undefined)'}"`);
    console.log(`  PortraitId: "${record.PortraitId || '(undefined)'}"`);
    console.log(`  PhotoId: "${record.PhotoId || '(undefined)'}"`);
    console.log(`  PresentationId: "${record.PresentationId || '(undefined)'}"`);

    // Check for any field containing "asset", "portrait", "photo", "head"
    const portraitFields = Object.keys(record).filter(k => {
      const lower = k.toLowerCase();
      return (lower.includes('asset') || lower.includes('portrait') ||
              lower.includes('photo') || lower.includes('head') ||
              lower.includes('face') || lower.includes('appearance')) &&
             !k.startsWith('_') && typeof record[k] !== 'function';
    });

    if (portraitFields.length > 0) {
      console.log('  Portrait-related fields:');
      portraitFields.forEach(f => {
        console.log(`    ${f}: ${record[f]}`);
      });
    }
  }
}

// Use a franchise file path from command line - REQUIRED
const testFile = process.argv[2];
if (!testFile) {
  console.error('Usage: node test-coach-fields.js <path-to-franchise-file>');
  process.exit(1);
}
analyzeCoachFields(testFile).catch(err => console.error('Error:', err));
