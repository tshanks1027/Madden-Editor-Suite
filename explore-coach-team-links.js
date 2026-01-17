// Explore how coaches are linked to teams

const TABLE_IDS = {
  teamTable: 637929298,
  coachTable: 1864063867,
};

async function exploreCoachTeamLinks() {
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

  // Build coach index map
  const coachByRecordIndex = new Map();
  for (const coach of coachTable.records) {
    if (coach.isEmpty) continue;
    coachByRecordIndex.set(coach.index, {
      name: `${coach.FirstName} ${coach.LastName}`,
      position: coach.Position,
      teamIndex: coach.TeamIndex,
      age: coach.Age,
      portrait: coach.Portrait
    });
  }

  // Get Team table
  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  console.log('=== Teams and Their Coaches ===\n');

  // Decode coach reference
  const decodeCoachRef = (ref) => {
    if (!ref || ref === '00000000000000000000000000000000') return null;
    const recordIndex = parseInt(ref.slice(-8), 2);
    return coachByRecordIndex.get(recordIndex);
  };

  // Show all 32 NFL teams with their coaching staff
  const teams = [];
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex === undefined || team.TeamIndex >= 32) continue;

    const hc = decodeCoachRef(team.HeadCoach);
    const oc = decodeCoachRef(team.OffensiveCoordinator);
    const dc = decodeCoachRef(team.DefensiveCoordinator);

    teams.push({
      teamIndex: team.TeamIndex,
      name: team.ShortName,
      city: team.LongName,
      recordIndex: team.index,
      headCoach: hc,
      offensiveCoordinator: oc,
      defensiveCoordinator: dc,
      hcRef: team.HeadCoach,
      ocRef: team.OffensiveCoordinator,
      dcRef: team.DefensiveCoordinator
    });
  }

  // Sort by team index
  teams.sort((a, b) => a.teamIndex - b.teamIndex);

  for (const team of teams) {
    console.log(`${team.name} (${team.city}) - TeamIndex ${team.teamIndex}:`);
    console.log(`  HC: ${team.headCoach?.name || 'None'} (Age ${team.headCoach?.age || '?'})`);
    console.log(`  OC: ${team.offensiveCoordinator?.name || 'None'}`);
    console.log(`  DC: ${team.defensiveCoordinator?.name || 'None'}`);
    console.log('');
  }

  // Show the reference format
  console.log('=== Reference Format Analysis ===\n');
  const sampleTeam = teams[0];
  console.log(`Sample team: ${sampleTeam.name}`);
  console.log(`  HC ref: ${sampleTeam.hcRef}`);
  console.log(`  OC ref: ${sampleTeam.ocRef}`);
  console.log(`  DC ref: ${sampleTeam.dcRef}`);
  console.log(`  HC record index: ${parseInt(sampleTeam.hcRef.slice(-8), 2)}`);
  console.log(`  Prefix (24 bits): ${sampleTeam.hcRef.slice(0, 24)}`);

  // Verify two-way link: Coach.TeamIndex should match Team.TeamIndex
  console.log('\n=== Verifying Two-Way Links ===\n');
  let mismatches = 0;
  for (const team of teams) {
    const hc = team.headCoach;
    if (hc && hc.teamIndex !== team.teamIndex) {
      console.log(`MISMATCH: ${team.name} HC ${hc.name} has TeamIndex ${hc.teamIndex}, expected ${team.teamIndex}`);
      mismatches++;
    }
  }
  if (mismatches === 0) {
    console.log('All Head Coach TeamIndex values match their assigned team!');
  }
}

exploreCoachTeamLinks().catch(console.error);
