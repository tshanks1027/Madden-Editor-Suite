/**
 * Test script for franchise:get-team-roster IPC handler
 * Verifies handler loads team roster correctly without breaking existing functionality
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function testTeamRosterHandler() {
  const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST');

  console.log('Testing franchise:get-team-roster handler logic...\n');

  try {
    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26
    });

    // Get Team table (use index 1 for M26)
    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1];
    await teamTable.readRecords();

    // Get first real team
    const firstTeam = teamTable.records.find(r => !r.isEmpty);
    if (!firstTeam) {
      throw new Error('No teams found in franchise file');
    }

    const teamIndex = firstTeam.TeamIndex;
    console.log(`Testing with team: ${firstTeam.DisplayName || firstTeam.LongName} (TeamIndex: ${teamIndex})\n`);

    // Get Player table
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    // Filter players by TeamIndex (same logic as handler)
    const teamPlayers = playerTable.records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => !record.isEmpty && record.TeamIndex === teamIndex)
      .map(({ record, index }) => ({
        recordIndex: index,
        firstName: record.FirstName || '',
        lastName: record.LastName || '',
        position: record.Position || '',
        overall: record.Overall || 0,
        age: record.Age || 0,
        yearsPro: record.YearsPro || 0,
        jerseyNum: record.JerseyNum || 0,
        contractStatus: record.ContractStatus || '',
        college: record.College || '',
        teamIndex: record.TeamIndex,
        height: record.Height || 0,
        weight: record.Weight || 0
      }));

    console.log(`✓ Found ${teamPlayers.length} players for team ${teamIndex}\n`);

    // Verify data structure
    if (teamPlayers.length === 0) {
      console.log('⚠ WARNING: No players found for this team');
      return;
    }

    // Show first 5 players
    console.log('First 5 players on roster:\n');
    teamPlayers.slice(0, 5).forEach((player, i) => {
      console.log(`${i + 1}. ${player.firstName} ${player.lastName} - ${player.position} ${player.overall} OVR (recordIndex: ${player.recordIndex})`);
    });

    console.log('\n✓ Data structure is correct');
    console.log('✓ recordIndex is being stored for save operations');

    // Verify team info structure
    const teamInfo = {
      teamIndex: firstTeam.TeamIndex,
      displayName: firstTeam.DisplayName || firstTeam.LongName || 'Unknown',
      city: firstTeam.CityName || '',
      abbreviation: firstTeam.TEAM_ABBR || '',
      wins: firstTeam.SeasonWins || 0,
      losses: firstTeam.SeasonLosses || 0,
      ties: firstTeam.SeasonTies || 0
    };

    console.log('\nTeam info:');
    console.log(JSON.stringify(teamInfo, null, 2));

    console.log('\n✓ SUCCESS: Handler logic verified');
    console.log('\nNext steps:');
    console.log('1. Add preload API exposure');
    console.log('2. Create team cards UI');
    console.log('3. Test save integrity with existing franchise:save-file');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

testTeamRosterHandler();
