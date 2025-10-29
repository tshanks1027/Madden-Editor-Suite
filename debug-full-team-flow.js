/**
 * Debug the full team-to-coach flow to see where it breaks
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function debugFullFlow() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    console.log('=== DEBUGGING FULL TEAM FLOW ===\n');

    // Load data like the app does
    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1]; // NFL teams
    await teamTable.readRecords();

    const coachTable = franchise.getTableByName('Coach');
    await coachTable.readRecords();

    // Get all teams (like franchiseData.teams in the app)
    const allTeams = teamTable.records.filter(r => !r.isEmpty);
    console.log(`Total teams loaded: ${allTeams.length}\n`);

    // Filter to "realTeams" (0-32) like the app does
    const realTeams = allTeams.filter(team => {
        const teamId = team.TeamIndex !== undefined ? team.TeamIndex : (team.TGID !== undefined ? team.TGID : -1);
        return teamId >= 0 && teamId <= 32;
    });

    console.log(`Real teams after filter: ${realTeams.length}\n`);

    // Get all coaches
    const coaches = coachTable.records.filter(r => !r.isEmpty && r.ContractStatus === 'Signed');
    console.log(`Total signed coaches: ${coaches.length}\n`);

    // Test a few specific teams
    const testTeams = [
        { name: '49ers', expectedCoach: 'Kyle Shanahan' },
        { name: 'Bears', expectedCoach: 'Ben Johnson' },
        { name: 'Bills', expectedCoach: 'Sean McDermott' }
    ];

    testTeams.forEach(test => {
        console.log(`\n=== Testing ${test.name} ===`);

        // Find in realTeams by name
        const team = realTeams.find(t => {
            const name = t.DisplayName || t.LongName || '';
            return name.includes(test.name);
        });

        if (!team) {
            console.log(`  ❌ Team not found in realTeams!`);
            return;
        }

        console.log(`  ✓ Found team: ${team.DisplayName}`);
        console.log(`    TeamIndex: ${team.TeamIndex}`);
        console.log(`    Array position in allTeams: ${allTeams.indexOf(team)}`);
        console.log(`    Array position in realTeams: ${realTeams.indexOf(team)}`);

        // What would happen if we click this team card?
        const teamId = team.TeamIndex;
        console.log(`\n  Clicking team card would call viewTeamByTeamIndex(${teamId})`);

        // In viewTeamByTeamIndex, we do:
        const foundTeam = allTeams.find(t => {
            const tId = t.TeamIndex !== undefined ? t.TeamIndex : (t.TGID !== undefined ? t.TGID : -1);
            return tId === teamId;
        });

        console.log(`  viewTeamByTeamIndex finds team: ${foundTeam ? foundTeam.DisplayName : 'NOT FOUND'}`);
        console.log(`    TeamIndex of found team: ${foundTeam ? foundTeam.TeamIndex : 'N/A'}`);

        // Filter coaches by this TeamIndex
        const teamCoaches = coaches.filter(c => {
            const coachTeamId = c.TeamIndex !== undefined ? c.TeamIndex : -1;
            return coachTeamId === teamId;
        });

        console.log(`\n  Coaches for TeamIndex ${teamId}:`);
        teamCoaches.forEach(c => {
            console.log(`    - ${c.FirstName} ${c.LastName} (${c.Position})`);
        });

        const headCoach = teamCoaches.find(c =>
            c.Position === 'HeadCoach' ||
            c.Position === 'Head Coach' ||
            c.Position === 0
        );

        if (headCoach) {
            const fullName = `${headCoach.FirstName} ${headCoach.LastName}`;
            if (fullName.includes(test.expectedCoach)) {
                console.log(`  ✓ HEAD COACH CORRECT: ${fullName}`);
            } else {
                console.log(`  ❌ HEAD COACH WRONG: Got "${fullName}", expected "${test.expectedCoach}"`);
            }
        } else {
            console.log(`  ❌ NO HEAD COACH FOUND`);
        }
    });

    console.log('\n\n=== DONE ===');
}

debugFullFlow().catch(console.error);
