/**
 * List all fields defined in Coach table schema
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function listCoachSchema() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    console.log('=== COACH TABLE SCHEMA ===\n');

    const coachTable = franchise.getTableByName('Coach');

    // Check if table has a schema or fields property
    if (coachTable.schema) {
        console.log('Table schema:', coachTable.schema);
    }

    if (coachTable.fields) {
        console.log('\nTable fields:', coachTable.fields.length);
        coachTable.fields.forEach((field, idx) => {
            console.log(`  ${idx}: ${field.name || field.key} (${field.type || 'unknown'})`);
        });
    }

    // Try reading headers
    await coachTable.readRecords();

    const coaches = coachTable.records.filter(r => !r.isEmpty);
    console.log(`\nFound ${coaches.length} non-empty coaches\n`);

    if (coaches.length > 0) {
        const firstCoach = coaches[0];

        // Check fieldsArray (the iterable fields)
        if (firstCoach.fieldsArray) {
            console.log(`\nfieldsArray has ${firstCoach.fieldsArray.length} fields:\n`);
            firstCoach.fieldsArray.forEach((field, idx) => {
                if (idx < 30) {  // Show first 30
                    console.log(`  ${field.key}: ${typeof field.value} = ${field.value}`);
                }
            });

            if (firstCoach.fieldsArray.length > 30) {
                console.log(`  ... and ${firstCoach.fieldsArray.length - 30} more fields`);
            }
        }
    }

    console.log('\n=== DONE ===');
}

listCoachSchema().catch(console.error);
