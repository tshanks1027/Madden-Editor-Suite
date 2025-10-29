/**
 * Map coach TeamIndex to team TGID
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function mapCoachTeamIds() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const teamTable = franchise.getTableByName('Team');
    await teamTable.readRecords();

    console.log('=== MAPPING COACH TEAMINDEX TO TEAM TGID ===\n');

    const teams = teamTable.records.filter(r => !r.isEmpty);

    console.log(`Found ${teams.length} non-empty team records\n`);

    // Show first 10 teams with all their ID fields
    console.log('First 10 teams:');
    teams.slice(0, 10).forEach((team, idx) => {
        console.log(`\nArray Index ${idx}:`);
        console.log(`  TeamIndex: ${team.TeamIndex}`);
        console.log(`  TGID: ${team.TGID}`);
        console.log(`  TeamId: ${team.TeamId}`);
        console.log(`  DisplayName: ${team.DisplayName || team.TEAM_NAME || '(no name)'}`);
        console.log(`  City: ${team.City || team.TEAM_CITY || '(no city)'}`);
    });

    // Check if there's a team with TGID = 0 (Texans)
    const team0 = teams.find(t => t.TGID === 0);
    if (team0) {
        console.log('\n\nTeam with TGID=0:');
        console.log(`  Array index: ${teams.indexOf(team0)}`);
        console.log(`  TeamIndex: ${team0.TeamIndex}`);
        console.log(`  DisplayName: ${team0.DisplayName}`);
    }

    // Check team with TGID = 15 (49ers, where Kyle Shanahan coaches)
    const team15 = teams.find(t => t.TGID === 15);
    if (team15) {
        console.log('\n\nTeam with TGID=15 (should be 49ers with Kyle Shanahan):');
        console.log(`  Array index: ${teams.indexOf(team15)}`);
        console.log(`  TeamIndex: ${team15.TeamIndex}`);
        console.log(`  DisplayName: ${team15.DisplayName}`);
    }

    console.log('\n=== DONE ===');
}

mapCoachTeamIds().catch(console.error);
