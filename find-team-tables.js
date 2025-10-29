/**
 * Find all Team table instances
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function findTeamTables() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    console.log('=== FINDING ALL TEAM TABLE INSTANCES ===\n');

    // Check if getAllTablesByName exists
    if (typeof franchise.getAllTablesByName === 'function') {
        const teamTables = franchise.getAllTablesByName('Team');
        console.log(`Found ${teamTables.length} Team table instances\n`);

        for (let i = 0; i < teamTables.length; i++) {
            const table = teamTables[i];
            await table.readRecords();

            console.log(`\n=== Team Table Instance ${i} ===`);
            console.log(`Total records: ${table.records.length}`);

            const nonEmpty = table.records.filter(r => !r.isEmpty);
            console.log(`Non-empty records: ${nonEmpty.length}`);

            if (nonEmpty.length > 0) {
                console.log(`\nFirst 5 non-empty records:`);
                nonEmpty.slice(0, 5).forEach((team, idx) => {
                    console.log(`  ${idx}: TeamIndex=${team.TeamIndex}, TGID=${team.TGID}, Name=${team.DisplayName || team.LongName || '(no name)'}`);
                });
            }
        }
    } else {
        console.log('getAllTablesByName not available');
        console.log('Available franchise methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(franchise)));
    }

    console.log('\n=== DONE ===');
}

findTeamTables().catch(console.error);
