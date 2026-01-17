// Explore ALL coach fields including playbooks, schemes, stats

const TABLE_IDS = {
  coachTable: 1864063867,
};

async function exploreCoachFields() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Get Coach table
  let coachTable = franchise.getTableByUniqueId(TABLE_IDS.coachTable);
  if (!coachTable) {
    coachTable = franchise.getTableByName('Coach');
  }
  await coachTable.readRecords();

  // Find a head coach to analyze
  const headCoaches = coachTable.records.filter(r => !r.isEmpty && r.Position === 'HeadCoach');

  console.log('=== All Coach Table Fields ===\n');

  // Get schema fields if available
  const header = coachTable.header;
  if (header && header.fields) {
    console.log('Schema Fields:');
    for (const field of header.fields) {
      console.log(`  ${field.name} (${field.type})`);
    }
  }

  // Get a sample head coach and show ALL values
  const sampleHC = headCoaches[0];
  console.log(`\n=== Sample HC: ${sampleHC.FirstName} ${sampleHC.LastName} ===\n`);

  // Try to get all properties via prototype
  const proto = Object.getPrototypeOf(sampleHC);
  const descriptors = Object.getOwnPropertyDescriptors(proto);

  const allFields = [];
  for (const [key, desc] of Object.entries(descriptors)) {
    if (desc.get && !key.startsWith('_') && key !== 'hexData' && key !== 'fields' && key !== 'fieldsArray') {
      try {
        const val = sampleHC[key];
        if (val !== undefined && val !== null && typeof val !== 'function' && typeof val !== 'object') {
          allFields.push({ key, val });
        }
      } catch(e) {}
    }
  }

  allFields.sort((a, b) => a.key.localeCompare(b.key));
  for (const { key, val } of allFields) {
    console.log(`  ${key}: ${val}`);
  }

  // Focus on playbook, scheme, record fields
  console.log('\n=== Playbook/Scheme/Record Analysis ===\n');

  const relevantFields = [
    'DefensivePlaybook', 'OffensivePlaybook',
    'DefensiveScheme', 'OffensiveScheme',
    'DefensiveFormation', 'OffensiveFormation',
    'CareerWins', 'CareerLosses', 'CareerTies',
    'SeasonWins', 'SeasonLosses', 'SeasonTies',
    'PlayoffWins', 'PlayoffLosses',
    'SuperBowlWins', 'SuperBowlLosses',
    'YearsExperience', 'YearsWithTeam', 'YearsCoaching',
    'Experience', 'Prestige', 'Overall',
    'Age', 'BirthYear', 'BirthMonth', 'BirthDay'
  ];

  for (const field of relevantFields) {
    const val = sampleHC[field];
    if (val !== undefined && val !== null) {
      console.log(`${field}: ${val}`);
    }
  }

  // Check multiple coaches for playbook variety
  console.log('\n=== Playbook Values Across Coaches ===\n');

  const playbookInfo = new Map();
  for (const coach of headCoaches.slice(0, 10)) {
    const offPB = coach.OffensivePlaybook;
    const defPB = coach.DefensivePlaybook;
    console.log(`${coach.FirstName} ${coach.LastName}:`);
    console.log(`  Offensive: ${offPB}`);
    console.log(`  Defensive: ${defPB}`);
  }

  // Look for playbook tables
  console.log('\n=== Looking for Playbook Tables ===\n');

  const playbookTables = [];
  for (const table of franchise.tables) {
    const name = table.name?.toLowerCase() || '';
    if (name.includes('playbook') || name.includes('scheme') || name.includes('formation')) {
      playbookTables.push(table.name);
    }
  }

  console.log('Tables with playbook/scheme/formation:');
  for (const name of playbookTables) {
    console.log(`  - ${name}`);
  }

  // Check TeamPlaybook table if exists
  const teamPlaybookTable = franchise.getTableByName('TeamPlaybook');
  if (teamPlaybookTable) {
    await teamPlaybookTable.readRecords();
    console.log('\n=== TeamPlaybook Table ===');
    console.log('Records:', teamPlaybookTable.records.length);
    const sample = teamPlaybookTable.records.find(r => !r.isEmpty);
    if (sample) {
      const sampleProto = Object.getPrototypeOf(sample);
      const sampleDesc = Object.getOwnPropertyDescriptors(sampleProto);
      for (const [key, desc] of Object.entries(sampleDesc)) {
        if (desc.get && !key.startsWith('_') && key !== 'hexData' && key !== 'fields' && key !== 'fieldsArray') {
          try {
            const val = sample[key];
            if (val !== undefined && val !== null && typeof val !== 'function' && typeof val !== 'object') {
              console.log(`  ${key}: ${val}`);
            }
          } catch(e) {}
        }
      }
    }
  }

  // Check Playbook table if exists
  const playbookTable = franchise.getTableByName('Playbook');
  if (playbookTable) {
    await playbookTable.readRecords();
    console.log('\n=== Playbook Table ===');
    console.log('Records:', playbookTable.records.length);
    const nonEmpty = playbookTable.records.filter(r => !r.isEmpty);
    console.log('Non-empty:', nonEmpty.length);

    // Show first few
    for (const pb of nonEmpty.slice(0, 5)) {
      console.log(`\nPlaybook ${pb.index}:`);
      const pbProto = Object.getPrototypeOf(pb);
      const pbDesc = Object.getOwnPropertyDescriptors(pbProto);
      for (const [key, desc] of Object.entries(pbDesc)) {
        if (desc.get && !key.startsWith('_') && key !== 'hexData' && key !== 'fields' && key !== 'fieldsArray') {
          try {
            const val = pb[key];
            if (val !== undefined && val !== null && typeof val !== 'function' && typeof val !== 'object') {
              console.log(`  ${key}: ${val}`);
            }
          } catch(e) {}
        }
      }
    }
  }
}

exploreCoachFields().catch(console.error);
