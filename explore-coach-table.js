// Explore the Coach table structure in the franchise file

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

  if (!coachTable) {
    console.log('Coach table not found!');
    return;
  }

  await coachTable.readRecords();

  console.log('=== Coach Table Info ===\n');
  console.log('Table name:', coachTable.name);
  console.log('Total records:', coachTable.records.length);

  // Get field info from header
  const header = coachTable.header;
  if (header && header.fields) {
    console.log('\nFields in Coach table:');
    for (const field of header.fields) {
      console.log(`  ${field.name} (${field.type})`);
    }
  }

  // Find non-empty coaches
  const nonEmptyCoaches = coachTable.records.filter(r => !r.isEmpty);
  console.log(`\nNon-empty coaches: ${nonEmptyCoaches.length}`);

  // Show first few coaches with all their fields
  console.log('\n=== Sample Coaches ===\n');
  let count = 0;
  for (const coach of nonEmptyCoaches) {
    if (count >= 5) break;
    count++;

    console.log(`Coach ${count} (record ${coach.index}):`);

    // Get key fields
    const firstName = coach.FirstName;
    const lastName = coach.LastName;
    const position = coach.Position;
    const teamRef = coach.TeamRef || coach.Team;

    console.log(`  Name: ${firstName} ${lastName}`);
    console.log(`  Position: ${position}`);

    if (teamRef && teamRef.length === 32) {
      const teamRecordIndex = parseInt(teamRef.slice(-8), 2);
      const teamInfo = recordIndexToTeam.get(teamRecordIndex);
      console.log(`  Team: ${teamInfo?.name || 'Unknown'} (recordIndex ${teamRecordIndex})`);
    }

    // Show other potentially useful fields
    const otherFields = ['Age', 'Experience', 'Prestige', 'DefensivePlaybook', 'OffensivePlaybook',
                         'CoachType', 'HeadCoachIndex', 'IsHeadCoach', 'Portrait', 'AssetName',
                         'PresentationId', 'Overall'];
    for (const fieldName of otherFields) {
      const val = coach[fieldName];
      if (val !== undefined && val !== null) {
        console.log(`  ${fieldName}: ${val}`);
      }
    }
    console.log('');
  }

  // Group coaches by team
  console.log('=== Coaches by Team ===\n');
  const coachesByTeam = new Map();

  for (const coach of nonEmptyCoaches) {
    const teamRef = coach.TeamRef || coach.Team;
    if (!teamRef || teamRef.length !== 32) continue;

    const teamRecordIndex = parseInt(teamRef.slice(-8), 2);
    const teamInfo = recordIndexToTeam.get(teamRecordIndex);
    if (!teamInfo) continue;

    if (!coachesByTeam.has(teamInfo.name)) {
      coachesByTeam.set(teamInfo.name, []);
    }
    coachesByTeam.get(teamInfo.name).push({
      name: `${coach.FirstName} ${coach.LastName}`,
      position: coach.Position,
      coachType: coach.CoachType,
      isHeadCoach: coach.IsHeadCoach
    });
  }

  // Show coaches for a few teams
  const teamsToShow = ['CHI', 'DAL', 'GB', 'NE', 'SF'];
  for (const teamName of teamsToShow) {
    const coaches = coachesByTeam.get(teamName);
    if (coaches) {
      console.log(`${teamName}:`);
      for (const c of coaches) {
        console.log(`  ${c.position || c.coachType}: ${c.name}${c.isHeadCoach ? ' (HC)' : ''}`);
      }
      console.log('');
    }
  }

  // Count coach types/positions
  console.log('=== Coach Position/Type Counts ===\n');
  const positionCounts = new Map();
  const typeCounts = new Map();

  for (const coach of nonEmptyCoaches) {
    const pos = coach.Position || 'Unknown';
    const type = coach.CoachType || 'Unknown';

    positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  }

  console.log('By Position:');
  for (const [pos, count] of [...positionCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pos}: ${count}`);
  }

  console.log('\nBy CoachType:');
  for (const [type, count] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
}

exploreCoachTable().catch(console.error);
