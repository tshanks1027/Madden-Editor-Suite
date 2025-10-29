/**
 * Check what teams exist and their TeamIndex values
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function checkAllTeams() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1];
    await teamTable.readRecords();

    const allTeams = teamTable.records.filter(r => !r.isEmpty);

    console.log('=== ALL TEAMS ===\n');

    allTeams.forEach((team, idx) => {
        console.log(`${idx}: ${team.DisplayName || team.LongName || 'UNNAMED'} - TeamIndex: ${team.TeamIndex}, TGID: ${team.TGID}`);
    });

    console.log(`\nTotal teams: ${allTeams.length}`);

    // Check for AFC/NFC/Practice
    const special = allTeams.filter(t => {
        const name = (t.DisplayName || t.LongName || '').toLowerCase();
        return name.includes('afc') || name.includes('nfc') || name.includes('practice') || name.includes('free');
    });

    if (special.length > 0) {
        console.log('\n=== SPECIAL TEAMS TO FILTER OUT ===');
        special.forEach(t => {
            console.log(`  ${t.DisplayName || t.LongName} - TeamIndex: ${t.TeamIndex}`);
        });
    }
}

checkAllTeams().catch(console.error);
