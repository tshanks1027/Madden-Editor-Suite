// Verify all team indices against M26 team table
async function verify() {
  try {
    const mf = await import('madden-franchise');
    const fs = require('fs');

    const filePath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1';
    const franchise = await mf.create(filePath);

    const teamTable = franchise.getTableByUniqueId(637929298);
    await teamTable.readRecords();

    // Build map of team names to indices
    const teamNameToIndex = new Map();
    const teamIndexToName = new Map();

    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      const teamIndex = team.TeamIndex;
      const name = team.LongName || team.DisplayName || team.ShortName;
      if (teamIndex !== undefined) {
        teamIndexToName.set(teamIndex, name);
        teamNameToIndex.set(name, teamIndex);
      }
    }

    console.log('=== M26 TEAM TABLE (sorted by TeamIndex) ===');
    const sorted = [...teamIndexToName.entries()].sort((a, b) => a[0] - b[0]);
    for (const [idx, name] of sorted) {
      console.log(`TeamIndex ${idx.toString().padStart(2)}: ${name}`);
    }

    // Load expansion history and verify
    console.log('\n\n=== EXPANSION HISTORY VERIFICATION ===');
    const expData = JSON.parse(fs.readFileSync('data/retro/expansion-history.json', 'utf8'));

    for (const team of expData.expansions) {
      const actualName = teamIndexToName.get(team.teamIndex);
      const matches = actualName && actualName.toLowerCase().includes(team.team.toLowerCase().split(' ')[0]);
      const status = matches ? '✓' : '✗ WRONG';
      console.log(`${status} ${team.team} (year ${team.year}): teamIndex ${team.teamIndex} = "${actualName}"`);
    }

  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
}

verify();
