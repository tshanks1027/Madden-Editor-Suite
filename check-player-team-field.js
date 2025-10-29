/**
 * Check what field players use for team assignment
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function checkPlayerTeamField() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    console.log('=== CHECKING PLAYER TEAM FIELDS ===\n');

    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    const players = playerTable.records.filter(r => !r.isEmpty);

    console.log(`Found ${players.length} players\n`);

    if (players.length > 0) {
        const firstPlayer = players[0];

        console.log('First player fields related to team:');
        const teamFields = ['TGID', 'TeamIndex', 'Team', 'TeamId', 'TGID', 'ContractTeam'];
        teamFields.forEach(field => {
            if (firstPlayer[field] !== undefined) {
                console.log(`  ${field}: ${firstPlayer[field]}`);
            }
        });

        console.log('\nAll fields on first player:');
        const allFields = Object.keys(firstPlayer).filter(k => !k.startsWith('_') && k !== 'isEmpty');
        console.log(allFields.join(', '));

        // Try to find a player with a known team by checking ContractTeam
        console.log('\n\nChecking first 10 players for team-related fields:');
        players.slice(0, 10).forEach((p, idx) => {
            const name = `${p.FirstName || ''} ${p.LastName || ''}`.trim();
            console.log(`\nPlayer ${idx}: ${name || '(no name)'}`);
            console.log(`  TeamIndex: ${p.TeamIndex}`);
            console.log(`  TGID: ${p.TGID}`);
            console.log(`  ContractTeam: ${p.ContractTeam}`);
            console.log(`  Team: ${p.Team}`);
        });
    }

    console.log('\n=== DONE ===');
}

checkPlayerTeamField().catch(console.error);
