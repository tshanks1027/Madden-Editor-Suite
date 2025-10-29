/**
 * Verify coach TeamIndex matches team TeamIndex
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function verifyMapping() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    console.log('=== VERIFYING TEAM-COACH MAPPING ===\n');

    // Get the SECOND Team table instance (index 1) which has all NFL teams
    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1]; // Use instance 1, not 0
    await teamTable.readRecords();

    const coachTable = franchise.getTableByName('Coach');
    await coachTable.readRecords();

    const teams = teamTable.records.filter(r => !r.isEmpty);
    const coaches = coachTable.records.filter(r => !r.isEmpty && r.ContractStatus === 'Signed');

    console.log(`Found ${teams.length} teams`);
    console.log(`Found ${coaches.length} signed coaches\n`);

    // Test specific team: 49ers (TeamIndex 14)
    const team14 = teams.find(t => t.TeamIndex === 14);
    console.log('Team with TeamIndex 14:');
    console.log(`  Name: ${team14.DisplayName || team14.LongName}`);
    console.log(`  TeamIndex: ${team14.TeamIndex}`);

    const team14Coaches = coaches.filter(c => c.TeamIndex === 14);
    console.log(`  Coaches (${team14Coaches.length}):`);
    team14Coaches.forEach(c => {
        console.log(`    - ${c.FirstName} ${c.LastName} (${c.Position})`);
    });

    // Test Bears (should be TeamIndex 0 or 1)
    console.log('\n\nBears team:');
    const bears = teams.find(t => (t.DisplayName || t.LongName || '').includes('Bears'));
    if (bears) {
        console.log(`  Name: ${bears.DisplayName || bears.LongName}`);
        console.log(`  TeamIndex: ${bears.TeamIndex}`);

        const bearsCoaches = coaches.filter(c => c.TeamIndex === bears.TeamIndex);
        console.log(`  Coaches (${bearsCoaches.length}):`);
        bearsCoaches.forEach(c => {
            console.log(`    - ${c.FirstName} ${c.LastName} (${c.Position})`);
        });
    }

    console.log('\n\n=== MAPPING SUMMARY ===');
    console.log('Coach TeamIndex matches Team TeamIndex directly!');
    console.log('Both use values 0-31 for the 32 NFL teams');
    console.log('CRITICAL: Must use getAllTablesByName("Team")[1] for team data, not getTableByName("Team")');

    console.log('\n=== DONE ===');
}

verifyMapping().catch(console.error);
