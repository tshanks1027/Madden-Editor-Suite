/**
 * Check if player TGID matches team TeamIndex
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function checkPlayerMapping() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    console.log('=== CHECKING PLAYER TGID vs TEAM TEAMINDEX ===\n');

    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1]; // NFL teams
    await teamTable.readRecords();

    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    const teams = teamTable.records.filter(r => !r.isEmpty && r.TeamIndex <= 31);
    const players = playerTable.records.filter(r => !r.isEmpty);

    console.log(`Found ${teams.length} teams`);
    console.log(`Found ${players.length} players\n`);

    // Check a few specific teams
    const testTeams = [
        { name: 'Bears', teamIndex: 0 },
        { name: '49ers', teamIndex: 14 },
        { name: 'Texans', teamIndex: 31 }
    ];

    for (const test of testTeams) {
        const team = teams.find(t => t.TeamIndex === test.teamIndex);
        if (!team) continue;

        console.log(`\n${team.DisplayName} (TeamIndex ${team.TeamIndex}):`);

        // Find players with TGID matching this TeamIndex
        const teamPlayers = players.filter(p => p.TGID === team.TeamIndex);
        console.log(`  Players with TGID = ${team.TeamIndex}: ${teamPlayers.length}`);

        if (teamPlayers.length > 0) {
            console.log(`  First 3 players:`);
            teamPlayers.slice(0, 3).forEach(p => {
                console.log(`    - ${p.FirstName || ''} ${p.LastName || ''} (TGID: ${p.TGID})`);
            });
        }
    }

    // Check distribution of player TGID values
    console.log('\n\nPlayer TGID distribution:');
    const tgidCounts = new Map();
    players.forEach(p => {
        const tgid = p.TGID;
        tgidCounts.set(tgid, (tgidCounts.get(tgid) || 0) + 1);
    });

    const sortedTgids = Array.from(tgidCounts.entries()).sort((a, b) => a[0] - b[0]);
    sortedTgids.slice(0, 35).forEach(([tgid, count]) => {
        const team = teams.find(t => t.TeamIndex === tgid);
        const teamName = team ? team.DisplayName : '(unknown)';
        console.log(`  TGID ${tgid}: ${count} players (${teamName})`);
    });

    console.log('\n=== DONE ===');
}

checkPlayerMapping().catch(console.error);
