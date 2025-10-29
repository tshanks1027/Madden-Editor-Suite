/**
 * Simulate exactly what the team card rendering code does
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function testTeamCardLogic() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1];
    await teamTable.readRecords();

    const allTeams = teamTable.records.filter(r => !r.isEmpty);

    console.log('=== SIMULATING TEAM CARD RENDERING ===\n');

    // Same filter as line 500-506
    const realTeams = allTeams.filter(team => {
        const teamId = team.TeamIndex !== undefined ? team.TeamIndex : (team.TGID !== undefined ? team.TGID : -1);
        return teamId >= 0 && teamId <= 32;
    });

    console.log(`Filtered ${realTeams.length} real teams\n`);

    // Show first 5 teams and what teamId they get
    console.log('=== FIRST 5 TEAMS IN realTeams ===');
    realTeams.slice(0, 5).forEach((team, index) => {
        // Same logic as line 513
        const teamId = team.TeamIndex !== undefined ? team.TeamIndex : (team.TGID !== undefined ? team.TGID : index);
        const teamName = team.DisplayName || team.LongName || team.ShortName || '';

        console.log(`\nIndex ${index}: ${teamName}`);
        console.log(`  team.TeamIndex = ${team.TeamIndex}`);
        console.log(`  team.TGID = ${team.TGID}`);
        console.log(`  Computed teamId = ${teamId}`);
        console.log(`  team.TeamIndex !== undefined? ${team.TeamIndex !== undefined}`);

        if (teamName.includes('Bengals')) {
            console.log(`\n  ⭐ THIS IS BENGALS!`);
            console.log(`  Card will be created with teamId = ${teamId}`);
            console.log(`  Click handler will call: viewTeamByTeamIndex(${teamId})`);
        }
    });
}

testTeamCardLogic().catch(console.error);
