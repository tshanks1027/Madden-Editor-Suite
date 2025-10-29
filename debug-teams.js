const Franchise = require('madden-franchise');

const FRANCHISE_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';

async function debugTeams() {
  console.log('Loading franchise file...');
  const franchise = await Franchise.create(FRANCHISE_FILE, { gameYearOverride: 26 });

  // Get Team table
  const teamTable = franchise.getTableByName('Team');
  await teamTable.readRecords();

  console.log('\n=== TEAM TABLE ===');
  console.log(`Found ${teamTable.records.length} teams\n`);

  // Show first 15 teams with their key fields
  for (let i = 0; i < Math.min(15, teamTable.records.length); i++) {
    const team = teamTable.records[i];
    if (team.isEmpty) continue;

    console.log(`Team ${i}:`);
    console.log(`  DisplayName: ${team.DisplayName}`);
    console.log(`  TeamIndex: ${team.TeamIndex}`);
    console.log(`  TGID: ${team.TGID}`);
    console.log();
  }

  // Get Player table
  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  console.log('\n=== PLAYER TABLE ===');
  console.log(`Found ${playerTable.records.length} players\n`);

  // Count players per team ID
  const teamPlayerCounts = new Map();
  for (const player of playerTable.records) {
    if (player.isEmpty) continue;

    const teamId = player.TeamIndex !== undefined ? player.TeamIndex : (player.TGID !== undefined ? player.TGID : -1);
    teamPlayerCounts.set(teamId, (teamPlayerCounts.get(teamId) || 0) + 1);
  }

  console.log('Players per TeamIndex:');
  const sortedCounts = Array.from(teamPlayerCounts.entries()).sort((a, b) => a[0] - b[0]);
  for (const [teamId, count] of sortedCounts.slice(0, 15)) {
    // Find team name
    const team = teamTable.records.find(t => !t.isEmpty && t.TeamIndex === teamId);
    const teamName = team ? team.DisplayName : 'Unknown';
    console.log(`  TeamIndex ${teamId} (${teamName}): ${count} players`);
  }

  // Show sample players from team 0 (Bears)
  console.log('\n=== SAMPLE PLAYERS FROM TEAM 0 (Bears) ===');
  const bearPlayers = playerTable.records.filter(p =>
    !p.isEmpty && (p.TeamIndex === 0 || p.TGID === 0)
  ).slice(0, 5);

  for (const player of bearPlayers) {
    console.log(`${player.FirstName} ${player.LastName} - TeamIndex: ${player.TeamIndex}, TGID: ${player.TGID}`);
  }

  // Show sample players from team 5 (Buccaneers alphabetically)
  console.log('\n=== SAMPLE PLAYERS FROM TEAM 5 ===');
  const team5Players = playerTable.records.filter(p =>
    !p.isEmpty && (p.TeamIndex === 5 || p.TGID === 5)
  ).slice(0, 5);

  for (const player of team5Players) {
    console.log(`${player.FirstName} ${player.LastName} - TeamIndex: ${player.TeamIndex}, TGID: ${player.TGID}`);
  }
}

debugTeams().catch(console.error);
