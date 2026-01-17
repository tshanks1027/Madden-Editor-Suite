// Explore the Coach table structure - find all fields

const TABLE_IDS = {
  teamTable: 637929298,
  coachTable: 1864063867,
};

async function exploreCoachTable() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Get Team table for reference
  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  const recordIndexToTeam = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex !== undefined && team.TeamIndex < 32) {
      recordIndexToTeam.set(team.index, {
        name: team.ShortName,
        city: team.LongName,
        teamIndex: team.TeamIndex
      });
    }
  }

  // Get Coach table
  let coachTable = franchise.getTableByUniqueId(TABLE_IDS.coachTable);
  if (!coachTable) {
    coachTable = franchise.getTableByName('Coach');
  }

  await coachTable.readRecords();

  console.log('=== Coach Table Fields ===\n');

  // Get ALL fields from first non-empty record
  const firstCoach = coachTable.records.find(r => !r.isEmpty);
  if (firstCoach) {
    // Try to get all property descriptors
    const proto = Object.getPrototypeOf(firstCoach);
    const descriptors = Object.getOwnPropertyDescriptors(proto);

    console.log('All available getters:');
    const allFields = [];
    for (const [key, desc] of Object.entries(descriptors)) {
      if (desc.get && !key.startsWith('_')) {
        try {
          const val = firstCoach[key];
          if (val !== undefined && val !== null && typeof val !== 'function' && key !== 'hexData' && key !== 'fields') {
            allFields.push({ key, val });
          }
        } catch(e) {}
      }
    }

    // Sort and display
    allFields.sort((a, b) => a.key.localeCompare(b.key));
    for (const { key, val } of allFields) {
      const displayVal = typeof val === 'string' && val.length > 50 ? val.slice(0, 50) + '...' : val;
      console.log(`  ${key}: ${displayVal}`);
    }
  }

  // Look for head coaches with their teams
  console.log('\n=== Head Coaches ===\n');

  const headCoaches = coachTable.records.filter(r => !r.isEmpty && r.Position === 'HeadCoach');
  console.log(`Found ${headCoaches.length} head coaches\n`);

  for (const coach of headCoaches.slice(0, 10)) {
    console.log(`${coach.FirstName} ${coach.LastName}:`);

    // Look for any team-related fields
    const teamFields = ['Team', 'TeamRef', 'ContractTeam', 'TeamIndex', 'ActiveTeam'];
    for (const field of teamFields) {
      const val = coach[field];
      if (val !== undefined && val !== null) {
        if (typeof val === 'string' && val.length === 32) {
          const ri = parseInt(val.slice(-8), 2);
          const team = recordIndexToTeam.get(ri);
          console.log(`  ${field}: ${team?.name || '?'} (ri=${ri})`);
        } else {
          console.log(`  ${field}: ${val}`);
        }
      }
    }

    // Check ContractInfo
    if (coach.ContractInfo) {
      console.log(`  ContractInfo: ${coach.ContractInfo}`);
    }

    console.log(`  Age: ${coach.Age}, Portrait: ${coach.Portrait}`);
    console.log('');
  }

  // Check if there's a separate table linking coaches to teams
  console.log('=== Looking for Coach-Team relationship tables ===\n');

  const relevantTables = [];
  for (const table of franchise.tables) {
    const name = table.name?.toLowerCase() || '';
    if (name.includes('coach') || name.includes('staff') || name.includes('personnel')) {
      relevantTables.push(table);
    }
  }

  console.log('Tables with coach/staff in name:');
  for (const t of relevantTables) {
    console.log(`  - ${t.name}`);
  }

  // Check Team table for coach references
  console.log('\n=== Team Table Coach Fields ===\n');

  const firstTeam = teamTable.records.find(r => !r.isEmpty && r.TeamIndex !== undefined && r.TeamIndex < 32);
  if (firstTeam) {
    const proto = Object.getPrototypeOf(firstTeam);
    const descriptors = Object.getOwnPropertyDescriptors(proto);

    console.log('Team fields containing "Coach":');
    for (const [key, desc] of Object.entries(descriptors)) {
      if (desc.get && key.toLowerCase().includes('coach')) {
        try {
          const val = firstTeam[key];
          console.log(`  ${key}: ${val}`);
        } catch(e) {}
      }
    }

    // Also check for HeadCoach, OffensiveCoordinator, DefensiveCoordinator references
    const coachRefFields = ['HeadCoach', 'OffensiveCoordinator', 'DefensiveCoordinator', 'Coach', 'Staff'];
    console.log('\nTeam coach reference fields:');
    for (const field of coachRefFields) {
      const val = firstTeam[field];
      if (val !== undefined && val !== null) {
        console.log(`  ${field}: ${val}`);
      }
    }
  }
}

exploreCoachTable().catch(console.error);
