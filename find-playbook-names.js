// Find playbook names in the franchise file

async function findPlaybookNames() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  console.log('=== Searching for Playbook-Related Tables ===\n');

  // Search all tables for playbook-related names
  const matches = [];
  for (const table of franchise.tables) {
    const name = table.name || '';
    const lowerName = name.toLowerCase();
    if (lowerName.includes('playbook') || lowerName.includes('scheme') ||
        lowerName === 'team' || lowerName.includes('offensive') || lowerName.includes('defensive')) {
      matches.push(name);
    }
  }

  console.log('Potentially relevant tables:');
  for (const name of matches) {
    console.log(`  - ${name}`);
  }

  // Try some specific table names that might have playbook info
  const tablesToCheck = [
    'Team',
    'CoachScheme',
    'PlaybookType',
    'TeamOffensivePlaybook',
    'TeamDefensivePlaybook'
  ];

  for (const tableName of tablesToCheck) {
    const table = franchise.getTableByName(tableName);
    if (table) {
      await table.readRecords();
      console.log(`\n=== ${tableName} Table ===`);
      console.log('Records:', table.records.length);
      const nonEmpty = table.records.filter(r => !r.isEmpty);
      console.log('Non-empty:', nonEmpty.length);

      if (nonEmpty.length > 0) {
        const sample = nonEmpty[0];
        console.log('Sample record fields:');
        const proto = Object.getPrototypeOf(sample);
        const desc = Object.getOwnPropertyDescriptors(proto);
        for (const [key, d] of Object.entries(desc)) {
          if (d.get && !key.startsWith('_') && key !== 'hexData' && key !== 'fields' && key !== 'fieldsArray') {
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
  }

  // Check the Team table for playbook fields
  console.log('\n=== Team Table Playbook Fields ===\n');
  const teamTable = franchise.getTableByName('Team');
  await teamTable.readRecords();

  const nflTeams = teamTable.records.filter(r => !r.isEmpty && r.TeamIndex !== undefined && r.TeamIndex < 32);

  // Show playbook refs for first few teams
  for (const team of nflTeams.slice(0, 5)) {
    console.log(`${team.ShortName}:`);

    // Try various field names
    const pbFields = ['OffensivePlaybook', 'DefensivePlaybook', 'TeamOffensivePlaybook', 'TeamDefensivePlaybook',
                      'OffPlaybook', 'DefPlaybook', 'OPlaybook', 'DPlaybook'];

    for (const field of pbFields) {
      const val = team[field];
      if (val !== undefined && val !== null) {
        console.log(`  ${field}: ${val}`);
        if (typeof val === 'string' && val.length === 32) {
          console.log(`    -> Index: ${parseInt(val.slice(-8), 2)}`);
        }
      }
    }
    console.log('');
  }

  // Map playbook indices across all coaches to see patterns
  console.log('\n=== Playbook Index Distribution ===\n');

  const coachTable = franchise.getTableByName('Coach');
  await coachTable.readRecords();

  const headCoaches = coachTable.records.filter(r => !r.isEmpty && r.Position === 'HeadCoach' && r.TeamIndex < 32);

  const offPBCounts = new Map();
  const defPBCounts = new Map();

  for (const coach of headCoaches) {
    const offIdx = parseInt(coach.OffensivePlaybook?.slice(-8) || '0', 2);
    const defIdx = parseInt(coach.DefensivePlaybook?.slice(-8) || '0', 2);

    offPBCounts.set(offIdx, (offPBCounts.get(offIdx) || 0) + 1);
    defPBCounts.set(defIdx, (defPBCounts.get(defIdx) || 0) + 1);
  }

  console.log('Offensive Playbook indices used:');
  for (const [idx, count] of [...offPBCounts.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Index ${idx}: ${count} coaches`);
  }

  console.log('\nDefensive Playbook indices used:');
  for (const [idx, count] of [...defPBCounts.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Index ${idx}: ${count} coaches`);
  }
}

findPlaybookNames().catch(console.error);
