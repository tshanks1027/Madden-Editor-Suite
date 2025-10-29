/**
 * Simple diagnostic to check Coach table structure
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function diagnoseCoaches() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('=== COACH TABLE DIAGNOSTIC ===\n');
    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    // Check Coach table
    console.log('Reading Coach table...\n');
    const coachTable = franchise.getTableByName('Coach');
    await coachTable.readRecords();

    console.log(`Total records: ${coachTable.records.length}`);

    const nonEmpty = coachTable.records.filter(r => !r.isEmpty);
    console.log(`Non-empty records: ${nonEmpty.length}\n`);

    if (nonEmpty.length > 0) {
        const first = nonEmpty[0];
        const fields = Object.keys(first);

        console.log(`First record has ${fields.length} fields:`);
        console.log(fields.join(', '));
        console.log('\n');

        console.log('Sample values from first record:');
        console.log(JSON.stringify({
            FirstName: first.FirstName,
            LastName: first.LastName,
            Name: first.Name,
            PFNA: first.PFNA,
            PLNA: first.PLNA,
            TeamIndex: first.TeamIndex,
            TGID: first.TGID,
            Position: first.Position,
            ContractStatus: first.ContractStatus,
            Age: first.Age,
            isEmpty: first.isEmpty
        }, null, 2));
    }

    console.log('\n=== DONE ===');
}

diagnoseCoaches().catch(console.error);
