/**
 * Map coach TeamIndex to team TGID - showing ALL records
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function mapCoachTeamIds() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const teamTable = franchise.getTableByName('Team');
    await teamTable.readRecords();

    console.log('=== MAPPING COACH TEAMINDEX TO TEAM TGID (ALL RECORDS) ===\n');

    const allTeams = teamTable.records;

    console.log(`Total team records: ${allTeams.length}\n`);

    // Show first 35 teams (all NFL teams + practice)
    console.log('First 35 team records:');
    allTeams.slice(0, 35).forEach((team, idx) => {
        console.log(`\nArray Index ${idx}:`);
        console.log(`  isEmpty: ${team.isEmpty}`);
        console.log(`  TeamIndex: ${team.TeamIndex}`);
        console.log(`  TGID: ${team.TGID}`);
        console.log(`  TeamId: ${team.TeamId}`);
        console.log(`  DisplayName: ${team.DisplayName || team.TEAM_NAME || team.LongName || '(no name)'}`);
        console.log(`  City: ${team.City || team.TEAM_CITY || team.CityName || '(no city)'}`);
    });

    console.log('\n=== DONE ===');
}

mapCoachTeamIds().catch(console.error);
