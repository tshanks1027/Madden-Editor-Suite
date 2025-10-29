/**
 * Diagnostic script to find coach data in M26 franchise files
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function diagnoseCoaches() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('=== COACH TABLE DIAGNOSTIC ===\n');
    console.log('Loading franchise file...\n');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    // Get all table names directly from franchise
    const allTables = [];
    franchise.schema.forEach(table => {
        if (table.name) {
            allTables.push(table.name);
        }
    });

    console.log('ALL TABLES IN FILE (' + allTables.length + ' total):');
    console.log(allTables.join(', '));
    console.log('\n');

    // Find tables with "coach", "staff", "person" in the name
    const coachRelatedTables = allTables.filter(name =>
        name.toLowerCase().includes('coach') ||
        name.toLowerCase().includes('staff') ||
        name.toLowerCase().includes('person')
    );

    console.log('COACH-RELATED TABLES:');
    console.log(coachRelatedTables.join(', '));
    console.log('\n');

    // Examine each coach-related table
    for (const tableName of coachRelatedTables) {
        console.log(`\n=== TABLE: ${tableName} ===`);

        try {
            const table = franchise.getTableByName(tableName);
            await table.readRecords();

            const nonEmptyRecords = table.records.filter(r => !r.isEmpty);
            console.log(`Total records: ${table.records.length}`);
            console.log(`Non-empty records: ${nonEmptyRecords.length}`);

            if (nonEmptyRecords.length > 0) {
                const firstRecord = nonEmptyRecords[0];
                const fields = Object.keys(firstRecord);

                console.log(`\nFirst non-empty record fields (${fields.length} total):`);
                console.log(fields.slice(0, 30).join(', '));

                // Look for name/team fields
                const nameFields = fields.filter(f =>
                    f.toLowerCase().includes('name') ||
                    f.toLowerCase().includes('first') ||
                    f.toLowerCase().includes('last')
                );
                const teamFields = fields.filter(f =>
                    f.toLowerCase().includes('team') ||
                    f.toLowerCase().includes('index')
                );

                console.log(`\nName-related fields: ${nameFields.join(', ') || 'NONE'}`);
                console.log(`Team-related fields: ${teamFields.join(', ') || 'NONE'}`);

                // Show sample values
                console.log(`\nSample record:`);
                console.log({
                    FirstName: firstRecord.FirstName,
                    LastName: firstRecord.LastName,
                    Name: firstRecord.Name,
                    PFNA: firstRecord.PFNA,
                    PLNA: firstRecord.PLNA,
                    TeamIndex: firstRecord.TeamIndex,
                    TGID: firstRecord.TGID,
                    Position: firstRecord.Position,
                    ContractStatus: firstRecord.ContractStatus
                });
            }
        } catch (error) {
            console.error(`Error reading ${tableName}:`, error.message);
        }
    }

    console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

diagnoseCoaches().catch(console.error);
