/**
 * Debug team-to-coach matching to see why coaches are shifted
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function debugTeamCoachMatch() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    console.log('=== DEBUGGING TEAM-COACH MATCHING ===\n');

    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1]; // NFL teams
    await teamTable.readRecords();

    const coachTable = franchise.getTableByName('Coach');
    await coachTable.readRecords();

    const teams = teamTable.records.filter(r => !r.isEmpty && r.TeamIndex <= 31).sort((a, b) => a.TeamIndex - b.TeamIndex);
    const coaches = coachTable.records.filter(r => !r.isEmpty && r.ContractStatus === 'Signed');

    console.log(`Found ${teams.length} teams\n`);

    // Check first 5 teams
    teams.slice(0, 5).forEach((team, idx) => {
        console.log(`\nTeam Array Index ${idx}:`);
        console.log(`  TeamIndex: ${team.TeamIndex}`);
        console.log(`  DisplayName: ${team.DisplayName}`);

        // Find coaches for this team by TeamIndex
        const teamCoaches = coaches.filter(c => c.TeamIndex === team.TeamIndex);
        console.log(`  Coaches (${teamCoaches.length}):`);
        teamCoaches.forEach(c => {
            console.log(`    - ${c.FirstName} ${c.LastName} (${c.Position})`);
        });
    });

    // Now simulate what the app does
    console.log('\n\n=== SIMULATING APP LOGIC ===\n');

    // The app filters to realTeams (0-32)
    const realTeams = teams.filter(team => {
        const teamId = team.TeamIndex !== undefined ? team.TeamIndex : -1;
        return teamId >= 0 && teamId <= 32;
    });

    console.log(`After filter: ${realTeams.length} realTeams\n`);

    // For each team, find actual index in ALL teams
    realTeams.slice(0, 5).forEach((team, filteredIndex) => {
        const actualIndex = teams.findIndex(t => t.TeamIndex === team.TeamIndex);
        console.log(`Filtered Index ${filteredIndex} → Actual Index ${actualIndex}`);
        console.log(`  TeamIndex: ${team.TeamIndex}`);
        console.log(`  Name: ${team.DisplayName}`);

        // When we click, we pass actualIndex
        // Then in viewTeam, we do: this.franchiseData.teams[actualIndex]
        // But franchiseData.teams might not be sorted!
        console.log(`  If we call teams[${actualIndex}], we get team with TeamIndex ${teams[actualIndex].TeamIndex}\n`);
    });

    console.log('\n=== DONE ===');
}

debugTeamCoachMatch().catch(console.error);
