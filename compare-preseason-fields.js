/**
 * Compare preseason records field-by-field between fresh and test files
 * to find exactly what's different and causing crashes
 */
async function compare() {
  const mf = await import('madden-franchise');

  const freshPath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1';
  const testPath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-SCHEDULE-TEST';

  console.log('Loading fresh file...');
  const fresh = await mf.create(freshPath);
  const freshGame = fresh.getTableByName('SeasonGame');
  await freshGame.readRecords();

  console.log('Loading test file...');
  const test = await mf.create(testPath);
  const testGame = test.getTableByName('SeasonGame');
  await testGame.readRecords();

  // Known fields in SeasonGame table based on what we've seen
  const knownFields = [
    'HomeTeam', 'AwayTeam', 'SeasonWeek', 'SeasonWeekType', 'GameStatus',
    'HomeScore', 'AwayScore', 'DayOfWeek', 'TimeOfDay', 'Stadium',
    'IsPracticeMode', 'SeasonYear', 'IsNeutralSite'
  ];

  // Try to discover fields from first record
  console.log('\nDiscovering fields...');
  const firstRec = freshGame.records.find(r => !r.isEmpty);
  if (firstRec) {
    // Try accessing table header info
    console.log('Table header:', freshGame.header);

    // Try different approaches to get fields
    if (freshGame.loadedTable && freshGame.loadedTable.fields) {
      console.log('Fields from loadedTable:', freshGame.loadedTable.fields.map(f => f.name));
    }
  }

  // Compare preseason records
  console.log('\n=== COMPARING PRESEASON RECORDS ===\n');

  const freshPre = freshGame.records.filter(r => !r.isEmpty && (r.SeasonWeekType === 'PreSeason' || r.SeasonWeekType === 0));
  const testPre = testGame.records.filter(r => !r.isEmpty && (r.SeasonWeekType === 'PreSeason' || r.SeasonWeekType === 0));

  console.log('Fresh preseason records:', freshPre.length);
  console.log('Test preseason records:', testPre.length);

  // Show a sample record's values for known fields
  console.log('\n=== SAMPLE FRESH RECORD (first preseason) ===');
  const sampleFresh = freshPre[0];
  for (const field of knownFields) {
    try {
      console.log(`  ${field}: ${sampleFresh[field]}`);
    } catch (e) {
      console.log(`  ${field}: ERROR - ${e.message}`);
    }
  }

  console.log('\n=== SAMPLE TEST RECORD (first preseason) ===');
  const sampleTest = testPre[0];
  for (const field of knownFields) {
    try {
      console.log(`  ${field}: ${sampleTest[field]}`);
    } catch (e) {
      console.log(`  ${field}: ERROR - ${e.message}`);
    }
  }

  // Check Invalid_ records
  console.log('\n=== INVALID RECORDS ===\n');

  const freshInvalid = freshPre.filter(r => r.GameStatus === 'Invalid_');
  const testInvalid = testPre.filter(r => r.GameStatus === 'Invalid_');

  console.log('Fresh Invalid_ count:', freshInvalid.length);
  console.log('Test Invalid_ count:', testInvalid.length);

  if (freshInvalid.length > 0) {
    console.log('\nFresh Invalid_ record (index', freshInvalid[0].index, '):');
    for (const field of knownFields) {
      try {
        console.log(`  ${field}: ${freshInvalid[0][field]}`);
      } catch (e) {}
    }
  }

  if (testInvalid.length > 0) {
    console.log('\nTest Invalid_ record (index', testInvalid[0].index, '):');
    for (const field of knownFields) {
      try {
        console.log(`  ${field}: ${testInvalid[0][field]}`);
      } catch (e) {}
    }
  }

  // Compare all preseason records by index
  console.log('\n=== FIELD-BY-FIELD COMPARISON ===\n');

  // Map by index
  const freshMap = new Map(freshPre.map(r => [r.index, r]));
  const testMap = new Map(testPre.map(r => [r.index, r]));

  let diffCount = 0;
  for (const idx of [...freshMap.keys()].sort((a, b) => a - b)) {
    const f = freshMap.get(idx);
    const t = testMap.get(idx);

    if (!t) {
      console.log(`Record ${idx}: MISSING in test`);
      diffCount++;
      continue;
    }

    const diffs = [];
    for (const field of knownFields) {
      const fv = String(f[field] || '');
      const tv = String(t[field] || '');
      if (fv !== tv) {
        diffs.push({ field, fresh: f[field], test: t[field] });
      }
    }

    if (diffs.length > 0) {
      diffCount++;
      console.log(`Record ${idx} differences:`);
      for (const d of diffs) {
        console.log(`  ${d.field}: "${d.fresh}" -> "${d.test}"`);
      }
    }
  }

  console.log('\nTotal records with differences:', diffCount);

  // Also check if there are records in test not in fresh
  for (const idx of testMap.keys()) {
    if (!freshMap.has(idx)) {
      console.log(`Record ${idx}: ONLY in test`);
    }
  }
}

compare().catch(e => console.error('Error:', e.message, e.stack));
