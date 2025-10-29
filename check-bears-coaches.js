/**
 * Check why Bears have 6 coaches instead of 3
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function checkBearsCoaches() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1];
    await teamTable.readRecords();

    const coachTable = franchise.getTableByName('Coach');
    await coachTable.readRecords();

    const teams = teamTable.records.filter(r => !r.isEmpty);
    const bears = teams.find(t => (t.DisplayName || t.LongName || '').includes('Bears'));

    console.log('=== BEARS INFO ===');
    console.log('Bears TeamIndex:', bears.TeamIndex);

    const allCoaches = coachTable.records.filter(r => !r.isEmpty);
    console.log('\nTotal coaches in file:', allCoaches.length);

    // Find coaches with Bears TeamIndex
    const bearsCoaches = allCoaches.filter(c => c.TeamIndex === bears.TeamIndex);

    console.log('\nCoaches with TeamIndex', bears.TeamIndex, '(Bears):');
    bearsCoaches.forEach((c, idx) => {
        console.log(`\n${idx + 1}. ${c.FirstName} ${c.LastName}`);
        console.log(`   Position: ${c.Position}`);
        console.log(`   ContractStatus: ${c.ContractStatus}`);
        console.log(`   TeamIndex: ${c.TeamIndex}`);
        console.log(`   Age: ${c.Age}`);
    });

    // Check if filtering by ContractStatus helps
    const signedBearsCoaches = bearsCoaches.filter(c => c.ContractStatus === 'Signed');
    console.log(`\n\nSigned coaches for Bears: ${signedBearsCoaches.length}`);
    signedBearsCoaches.forEach((c, idx) => {
        console.log(`${idx + 1}. ${c.FirstName} ${c.LastName} - ${c.Position}`);
    });

    // Check a few other teams for comparison
    console.log('\n\n=== COMPARISON WITH OTHER TEAMS ===');
    ['49ers', 'Bills', 'Bengals'].forEach(teamName => {
        const team = teams.find(t => (t.DisplayName || t.LongName || '').includes(teamName));
        if (team) {
            const teamCoaches = allCoaches.filter(c => c.TeamIndex === team.TeamIndex && c.ContractStatus === 'Signed');
            console.log(`${teamName} (TeamIndex ${team.TeamIndex}): ${teamCoaches.length} signed coaches`);
            teamCoaches.forEach(c => {
                console.log(`  - ${c.FirstName} ${c.LastName} (${c.Position})`);
            });
        }
    });
}

checkBearsCoaches().catch(console.error);
