/**
 * Check coach TeamIndex values vs actual team IDs
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function checkCoachTeams() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('=== CHECKING COACH TEAM ASSIGNMENTS ===\n');
    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const coachTable = franchise.getTableByName('Coach');
    const teamTable = franchise.getTableByName('Team');

    await coachTable.readRecords();
    await teamTable.readRecords();

    const coaches = coachTable.records.filter(r => !r.isEmpty && r.ContractStatus === 'Signed');

    console.log(`Found ${coaches.length} signed coaches\n`);

    // Group by TeamIndex
    const coachesByTeam = new Map();
    coaches.forEach(coach => {
        const teamIdx = coach.TeamIndex;
        if (!coachesByTeam.has(teamIdx)) {
            coachesByTeam.set(teamIdx, []);
        }
        coachesByTeam.get(teamIdx).push({
            name: `${coach.FirstName} ${coach.LastName}`,
            position: coach.Position
        });
    });

    console.log('Coaches grouped by TeamIndex:');
    Array.from(coachesByTeam.keys()).sort((a, b) => a - b).forEach(teamIdx => {
        const teamCoaches = coachesByTeam.get(teamIdx);
        console.log(`\nTeam ${teamIdx}: ${teamCoaches.length} coaches`);
        teamCoaches.forEach(c => console.log(`  - ${c.name} (${c.position})`));
    });

    // Check team records
    console.log('\n\nChecking Team table for ID fields:');
    const teams = teamTable.records.filter(r => !r.isEmpty).slice(0, 3);
    teams.forEach((team, idx) => {
        console.log(`\nTeam ${idx}:`);
        console.log(`  TeamIndex: ${team.TeamIndex}`);
        console.log(`  TGID: ${team.TGID}`);
        console.log(`  DisplayName: ${team.DisplayName || team.TEAM_NAME || team.Name}`);
    });

    console.log('\n=== DONE ===');
}

checkCoachTeams().catch(console.error);
