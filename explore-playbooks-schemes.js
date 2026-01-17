// Explore Playbook and Scheme tables

async function explorePlaybooksSchemes() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Try to find playbook-related tables
  console.log('=== Looking for Playbook Data ===\n');

  // Check DefensivePlaybookDataType
  let defPBTable = franchise.getTableByName('DefensivePlaybookDataType');
  if (defPBTable) {
    await defPBTable.readRecords();
    console.log('DefensivePlaybookDataType:');
    console.log('  Records:', defPBTable.records.length);
    const nonEmpty = defPBTable.records.filter(r => !r.isEmpty);
    console.log('  Non-empty:', nonEmpty.length);

    for (const pb of nonEmpty.slice(0, 10)) {
      console.log(`\n  [${pb.index}]:`);
      const proto = Object.getPrototypeOf(pb);
      const desc = Object.getOwnPropertyDescriptors(proto);
      for (const [key, d] of Object.entries(desc)) {
        if (d.get && !key.startsWith('_') && key !== 'hexData' && key !== 'fields' && key !== 'fieldsArray') {
          try {
            const val = pb[key];
            if (val !== undefined && val !== null && typeof val !== 'function' && typeof val !== 'object') {
              console.log(`    ${key}: ${val}`);
            }
          } catch(e) {}
        }
      }
    }
  }

  // Check OffensivePlaybookDataType
  let offPBTable = franchise.getTableByName('OffensivePlaybookDataType');
  if (offPBTable) {
    await offPBTable.readRecords();
    console.log('\n\nOffensivePlaybookDataType:');
    console.log('  Records:', offPBTable.records.length);
    const nonEmpty = offPBTable.records.filter(r => !r.isEmpty);
    console.log('  Non-empty:', nonEmpty.length);

    for (const pb of nonEmpty.slice(0, 10)) {
      console.log(`\n  [${pb.index}]:`);
      const proto = Object.getPrototypeOf(pb);
      const desc = Object.getOwnPropertyDescriptors(proto);
      for (const [key, d] of Object.entries(desc)) {
        if (d.get && !key.startsWith('_') && key !== 'hexData' && key !== 'fields' && key !== 'fieldsArray') {
          try {
            const val = pb[key];
            if (val !== undefined && val !== null && typeof val !== 'function' && typeof val !== 'object') {
              console.log(`    ${key}: ${val}`);
            }
          } catch(e) {}
        }
      }
    }
  }

  // Check Scheme table
  let schemeTable = franchise.getTableByName('Scheme');
  if (schemeTable) {
    await schemeTable.readRecords();
    console.log('\n\nScheme Table:');
    console.log('  Records:', schemeTable.records.length);
    const nonEmpty = schemeTable.records.filter(r => !r.isEmpty);
    console.log('  Non-empty:', nonEmpty.length);

    for (const s of nonEmpty.slice(0, 10)) {
      console.log(`\n  [${s.index}]:`);
      const proto = Object.getPrototypeOf(s);
      const desc = Object.getOwnPropertyDescriptors(proto);
      for (const [key, d] of Object.entries(desc)) {
        if (d.get && !key.startsWith('_') && key !== 'hexData' && key !== 'fields' && key !== 'fieldsArray') {
          try {
            const val = s[key];
            if (val !== undefined && val !== null && typeof val !== 'function' && typeof val !== 'object') {
              console.log(`    ${key}: ${val}`);
            }
          } catch(e) {}
        }
      }
    }
  }

  // Try to match playbook references to names
  console.log('\n\n=== Decoding Coach Playbook References ===\n');

  let coachTable = franchise.getTableByName('Coach');
  await coachTable.readRecords();

  const headCoach = coachTable.records.find(r => !r.isEmpty && r.Position === 'HeadCoach');
  if (headCoach) {
    const offPB = headCoach.OffensivePlaybook;
    const defPB = headCoach.DefensivePlaybook;
    const offScheme = headCoach.OffensiveScheme;
    const defScheme = headCoach.DefensiveScheme;

    console.log(`Coach: ${headCoach.FirstName} ${headCoach.LastName}`);
    console.log(`  OffensivePlaybook ref: ${offPB}`);
    console.log(`    -> Record index: ${parseInt(offPB.slice(-8), 2)}`);
    console.log(`  DefensivePlaybook ref: ${defPB}`);
    console.log(`    -> Record index: ${parseInt(defPB.slice(-8), 2)}`);
    console.log(`  OffensiveScheme ref: ${offScheme}`);
    console.log(`    -> Record index: ${parseInt(offScheme.slice(-8), 2)}`);
    console.log(`  DefensiveScheme ref: ${defScheme}`);
    console.log(`    -> Record index: ${parseInt(defScheme.slice(-8), 2)}`);

    // Try to look up the playbook names
    if (offPBTable) {
      const offIdx = parseInt(offPB.slice(-8), 2);
      const offRec = offPBTable.records[offIdx];
      if (offRec && !offRec.isEmpty) {
        console.log(`\n  Offensive Playbook Name: ${offRec.Name || offRec.PlaybookName || 'N/A'}`);
      }
    }

    if (defPBTable) {
      const defIdx = parseInt(defPB.slice(-8), 2);
      const defRec = defPBTable.records[defIdx];
      if (defRec && !defRec.isEmpty) {
        console.log(`  Defensive Playbook Name: ${defRec.Name || defRec.PlaybookName || 'N/A'}`);
      }
    }

    if (schemeTable) {
      const offSchemeIdx = parseInt(offScheme.slice(-8), 2);
      const defSchemeIdx = parseInt(defScheme.slice(-8), 2);
      const offSchemeRec = schemeTable.records[offSchemeIdx];
      const defSchemeRec = schemeTable.records[defSchemeIdx];
      if (offSchemeRec && !offSchemeRec.isEmpty) {
        console.log(`  Offensive Scheme Name: ${offSchemeRec.Name || offSchemeRec.SchemeName || 'N/A'}`);
      }
      if (defSchemeRec && !defSchemeRec.isEmpty) {
        console.log(`  Defensive Scheme Name: ${defSchemeRec.Name || defSchemeRec.SchemeName || 'N/A'}`);
      }
    }
  }
}

explorePlaybooksSchemes().catch(console.error);
