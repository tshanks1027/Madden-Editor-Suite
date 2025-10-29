/**
 * Map TeamIndex to NFL_TEAMS key to verify mapping
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function mapTeamIndexes() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    console.log('=== MAPPING TEAMINDEX VALUES ===\n');

    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1]; // Use instance 1 with NFL teams
    await teamTable.readRecords();

    const teams = teamTable.records.filter(r => !r.isEmpty).sort((a, b) => a.TeamIndex - b.TeamIndex);

    console.log(`Found ${teams.length} teams\n`);

    console.log('TeamIndex -> Team Name mapping:');
    teams.forEach(team => {
        const name = team.DisplayName || team.LongName || team.ShortName || '(no name)';
        console.log(`  TeamIndex ${team.TeamIndex}: ${name}`);
    });

    console.log('\n=== DONE ===');
}

mapTeamIndexes().catch(console.error);
