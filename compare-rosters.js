const path = require('path');
const testPath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/ROSTER-HEADTEST4';
const officialPath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/ROSTER-HEADTEST3';

async function compare() {
  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();

  const testFile = await helper.load(testPath);
  const officialFile = await helper.load(officialPath);

  const testPlayers = testFile.PLAY.records.map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  const officialPlayers = officialFile.PLAY.records.map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  // TARGET PLAYERS by PID
  const TARGET_PIDS = [12080, 14080, 14167]; // Jethro Pugh, Calvin Hill, Walt Garrison

  console.log('=== TARGET PLAYERS (by PID) ===');
  for (const pid of TARGET_PIDS) {
    const official = officialPlayers.find(p => p.PSXP === pid);
    const test = testPlayers.find(p => p.PSXP === pid);

    if (official || test) {
      console.log('');
      console.log((official?.PFNA || test?.PFNA) + ' ' + (official?.PLNA || test?.PLNA) + ' (PID ' + pid + '):');
      console.log('  HEADTEST3 (working): PSXP=' + official?.PSXP + ', PLPL=' + official?.PLPL + ', PEPS=' + official?.PEPS + ', PGHE=' + official?.PGHE + ', PSKI=' + official?.PSKI + ', PLRC=' + official?.PLRC);
      console.log('  HEADTEST4 (broken):  PSXP=' + test?.PSXP + ', PLPL=' + test?.PLPL + ', PEPS=' + test?.PEPS + ', PGHE=' + test?.PGHE + ', PSKI=' + test?.PSKI + ', PLRC=' + test?.PLRC);
    }
  }

  // Also check if any PIDs changed (by matching name)
  console.log('\n=== PLAYERS WHERE PID (PSXP) CHANGED ===');
  let pidChanges = 0;
  officialPlayers.forEach(official => {
    if (!official.PFNA && !official.PLNA) return;
    const test = testPlayers.find(t => t.PFNA === official.PFNA && t.PLNA === official.PLNA);
    if (test && official.PSXP !== test.PSXP) {
      pidChanges++;
      console.log(official.PFNA + ' ' + official.PLNA + ': PSXP ' + official.PSXP + ' -> ' + test.PSXP);
    }
  });
  console.log('Total PID changes: ' + pidChanges);

  // Find players where PLPL or PEPS changed between official and test
  console.log('\n=== PLAYERS WITH CHANGED PLPL OR PEPS ===');
  let changedCount = 0;

  testPlayers.forEach(test => {
    const official = officialPlayers.find(o => o.PFNA === test.PFNA && o.PLNA === test.PLNA);
    if (official && (official.PLPL !== test.PLPL || official.PEPS !== test.PEPS)) {
      changedCount++;
      console.log('');
      console.log(test.PFNA + ' ' + test.PLNA + ':');
      console.log('  HEADTEST3: PLPL=' + official.PLPL + ', PEPS=' + official.PEPS + ', PGHE=' + official.PGHE + ', PSKI=' + official.PSKI);
      console.log('  HEADTEST4: PLPL=' + test.PLPL + ', PEPS=' + test.PEPS + ', PGHE=' + test.PGHE + ', PSKI=' + test.PSKI);
    }
  });

  console.log('');
  console.log('Total changed players:', changedCount);

  // Check BLBM table for face models
  console.log('\n=== BLBM TABLE ANALYSIS ===');

  // BLBM is actually inside BLOB table
  const extractBLBM = (file) => {
    const blob = file.BLOB?.records?.[0];
    const blbmField = blob?.fields?.BLBM?.value;
    const records = blbmField?.records || blbmField?._records || [];
    return records.map(record => {
      const fields = record.fields || record._fields || {};
      const entry = { index: record.index };
      for (const key of Object.keys(fields)) {
        entry[key] = fields[key]?.value ?? fields[key]?._value;
      }
      return entry;
    });
  };

  const officialBLBM = extractBLBM(officialFile);
  const testBLBM = extractBLBM(testFile);

  console.log(`HEADTEST3: ${officialBLBM.length} BLBM records`);
  console.log(`HEADTEST4: ${testBLBM.length} BLBM records`);
  console.log(`Total players: ${officialPlayers.length}`);

  // Find players and their BLBM entries by PGID
  console.log('\n=== TARGET PLAYERS BLBM LOOKUP ===');
  for (const pid of TARGET_PIDS) {
    const official = officialPlayers.find(p => p.PSXP === pid);
    const test = testPlayers.find(p => p.PSXP === pid);
    const pgid = official?.PGID || test?.PGID;
    const name = (official?.PFNA || test?.PFNA) + ' ' + (official?.PLNA || test?.PLNA);

    console.log('');
    console.log(name + ' (PID ' + pid + ', PGID ' + pgid + '):');

    // Try matching by PGID (index)
    const officialByPGID = officialBLBM.find(b => b.index === pgid);
    const testByPGID = testBLBM.find(b => b.index === pgid);

    // Also try matching by name (CFNM + CLNM)
    const firstName = (official?.PFNA || test?.PFNA || '').toLowerCase();
    const lastName = (official?.PLNA || test?.PLNA || '').toLowerCase();
    const officialByName = officialBLBM.find(b =>
      (b.CFNM || '').toLowerCase() === firstName && (b.CLNM || '').toLowerCase() === lastName);
    const testByName = testBLBM.find(b =>
      (b.CFNM || '').toLowerCase() === firstName && (b.CLNM || '').toLowerCase() === lastName);

    console.log('  HEADTEST3 (by PGID): ' + (officialByPGID ? 'GENR=' + officialByPGID.GENR + ', SKNT=' + officialByPGID.SKNT : 'NOT FOUND'));
    console.log('  HEADTEST3 (by name): ' + (officialByName ? 'GENR=' + officialByName.GENR + ', SKNT=' + officialByName.SKNT + ', index=' + officialByName.index : 'NOT FOUND'));
    console.log('  HEADTEST4 (by PGID): ' + (testByPGID ? 'GENR=' + testByPGID.GENR + ', SKNT=' + testByPGID.SKNT : 'NOT FOUND'));
    console.log('  HEADTEST4 (by name): ' + (testByName ? 'GENR=' + testByName.GENR + ', SKNT=' + testByName.SKNT + ', index=' + testByName.index : 'NOT FOUND'));
  }

  // Show first few BLBM entries for context
  console.log('\n=== FIRST 5 BLBM ENTRIES (HEADTEST3) ===');
  for (let i = 0; i < Math.min(5, officialBLBM.length); i++) {
    const b = officialBLBM[i];
    console.log(`  [${i}] index=${b.index}, ${b.CFNM} ${b.CLNM}: GENR="${b.GENR}", SKNT=${b.SKNT}`);
  }
}

compare().catch(e => console.error('Error:', e));
