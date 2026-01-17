// Test ONLY coach changes - no other modifications
// This tests the setPlaceholderCoaches and replaceFACoaches operations
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-REAL';
const testPath = path.dirname(originalPath) + '/TEST-COACHES-ONLY';
const YEAR = 1995;

const TABLE_IDS = {
  teamTable: 637929298,
  coachTable: 0, // Will find by name
};

// Teams that don't exist in 1995 (expansion teams that joined later)
// For 1995: Texans (2002 expansion) - teamIndex 31
// Note: Panthers (20) and Jaguars (16) were NEW in 1995, so they should exist
// Browns (4) existed in 1995 (moved to Ravens in 1996)
function getInactiveTeamsForYear(year) {
  const inactive = [];

  // Texans didn't exist until 2002
  if (year < 2002) {
    inactive.push({ team: 'Texans', teamIndex: 31 });
  }

  // Browns were inactive 1996-1998 (moved to Baltimore, new Browns in 1999)
  if (year >= 1996 && year < 1999) {
    inactive.push({ team: 'Browns', teamIndex: 4 });
  }

  return inactive;
}

async function test() {
  // Copy fresh file
  fs.copyFileSync(originalPath, testPath);
  console.log('Created test file:', testPath);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);

  // Get inactive teams
  const inactiveTeams = getInactiveTeamsForYear(YEAR);
  const inactiveTeamIndices = new Set(inactiveTeams.map(t => t.teamIndex));
  console.log('Inactive teams for', YEAR, ':', inactiveTeams.map(t => `${t.team} (${t.teamIndex})`).join(', ') || 'None');

  // Get Coach table
  let coachTable = franchise.getTableByName('Coach');
  if (!coachTable) {
    console.log('Coach table not found');
    return;
  }
  await coachTable.readRecords();
  console.log('Loaded', coachTable.records.length, 'coach records');

  // === TEST 1: Set placeholder coaches for inactive teams ===
  console.log('\n=== TEST 1: SET PLACEHOLDER COACHES ===');

  if (inactiveTeamIndices.size > 0) {
    let placeholdersSet = 0;
    for (const coach of coachTable.records) {
      if (coach.isEmpty) continue;

      const teamIndex = coach.TeamIndex;
      if (!inactiveTeamIndices.has(teamIndex)) continue;

      const position = coach.Position || 'Unknown';
      const inactiveTeam = inactiveTeams.find(t => t.teamIndex === teamIndex);
      const teamName = inactiveTeam?.team || `Team ${teamIndex}`;

      console.log(`  Setting placeholder for ${position} on ${teamName}`);

      try {
        coach.FirstName = 'Inactive';
        coach.LastName = `Coach (${teamName})`;

        // Try to set contract fields
        try { coach.ContractLength = 30; } catch (e) {}
        try { coach.ContractYearsRemaining = 30; } catch (e) {}
        try { coach.ContractStatus = 'Signed'; } catch (e) {}
        try { coach.ContractSalary = 1; } catch (e) {}

        placeholdersSet++;
      } catch (e) {
        console.log(`    Error: ${e.message}`);
      }
    }
    console.log(`Set ${placeholdersSet} placeholder coaches`);
  } else {
    console.log('No inactive teams - skipping placeholder step');
  }

  // === TEST 2: Replace FA coaches ===
  console.log('\n=== TEST 2: REPLACE FA COACHES ===');

  const FREE_AGENT_COACH_TEAM = 32;
  let faCoachCount = 0;
  let faCoachesReplaced = 0;

  for (const coach of coachTable.records) {
    if (coach.isEmpty) continue;

    const teamIndex = coach.TeamIndex;
    const contractStatus = coach.ContractStatus;

    // Skip coaches on inactive teams
    if (inactiveTeamIndices.has(teamIndex)) continue;

    // Identify FA coaches
    if (teamIndex >= FREE_AGENT_COACH_TEAM || contractStatus === 'FreeAgent') {
      faCoachCount++;

      // Replace with a fake historical name (just for testing)
      const position = coach.Position || 'Unknown';
      console.log(`  Replacing FA coach: ${coach.FirstName} ${coach.LastName} (${position})`);

      try {
        coach.FirstName = 'Historical';
        coach.LastName = `Coach${faCoachCount}`;

        // Set some career stats
        try { coach.CareerWins = 50; } catch (e) {}
        try { coach.CareerLosses = 30; } catch (e) {}
        try { coach.YearsCoaching = 10; } catch (e) {}
        try { coach.Age = 50; } catch (e) {}

        faCoachesReplaced++;
      } catch (e) {
        console.log(`    Error: ${e.message}`);
      }

      // Only replace a few for testing
      if (faCoachesReplaced >= 5) {
        console.log('  (stopping after 5 replacements for test)');
        break;
      }
    }
  }

  console.log(`Found ${faCoachCount} FA coaches, replaced ${faCoachesReplaced}`);

  // Save
  console.log('\n=== SAVING ===');
  await franchise.save(testPath);
  console.log('File saved');

  // Reload and verify
  console.log('\n=== VERIFYING ===');
  const franchise2 = await FranchiseModule.create(testPath);
  const coachTable2 = franchise2.getTableByName('Coach');
  await coachTable2.readRecords();

  // Check for placeholder coaches
  let placeholderCount = 0;
  let historicalCount = 0;
  for (const coach of coachTable2.records) {
    if (coach.isEmpty) continue;
    if (coach.FirstName === 'Inactive') placeholderCount++;
    if (coach.FirstName === 'Historical') historicalCount++;
  }

  console.log('Placeholder coaches found:', placeholderCount);
  console.log('Historical replacement coaches found:', historicalCount);

  console.log('\n✅ Test complete');
  console.log('Test file:', testPath);
  console.log('>>> Load this file in Madden and try to sim a week');
  console.log('>>> If it crashes, coach modifications are the issue');
}

test().catch(console.error);
