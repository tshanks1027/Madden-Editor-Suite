/**
 * Find what TeamIndex the Bengals actually have
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function findBengalsTeamIndex() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1];
    await teamTable.readRecords();

    const allTeams = teamTable.records.filter(r => !r.isEmpty);

    console.log('=== FINDING BENGALS TEAMINDEX ===\n');

    // Find Bengals
    const bengals = allTeams.find(t => {
        const name = t.DisplayName || t.LongName || '';
        return name.includes('Bengals');
    });

    if (bengals) {
        console.log('Found Bengals:');
        console.log(`  DisplayName: ${bengals.DisplayName}`);
        console.log(`  TeamIndex: ${bengals.TeamIndex}`);
        console.log(`  TGID: ${bengals.TGID}`);
        console.log(`  Array position: ${allTeams.indexOf(bengals)}`);
    } else {
        console.log('Bengals not found!');
    }

    // Also check first 5 teams to see the pattern
    console.log('\n=== FIRST 5 TEAMS ===');
    allTeams.slice(0, 5).forEach((team, idx) => {
        console.log(`Array[${idx}]: ${team.DisplayName} → TeamIndex=${team.TeamIndex}, TGID=${team.TGID}`);
    });
}

findBengalsTeamIndex().catch(console.error);
