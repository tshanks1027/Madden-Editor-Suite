/**
 * Examine depth chart table structure directly without assuming format
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function examineDepthChartDirect() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('Examining DepthChart table structure directly...\n');

    try {
        const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

        // Get Team table (use index 1)
        const teamTables = franchise.getAllTablesByName('Team');
        const teamTable = teamTables[1];
        await teamTable.readRecords();

        const realTeams = teamTable.records.filter(r => !r.isEmpty);
        const firstTeam = realTeams[0];

        console.log(`Team: ${firstTeam.DisplayName || firstTeam.LongName}\n`);

        // Get DepthChart table
        const depthChartTables = franchise.getAllTablesByName('DepthChart');
        const depthChartTable = depthChartTables[0];
        await depthChartTable.readRecords();

        console.log('DepthChart Table:');
        console.log(`  Name: ${depthChartTable.name}`);
        console.log(`  Table ID: ${depthChartTable.header.tableId}`);
        console.log(`  Records: ${depthChartTable.records.length}\n`);

        // Get first record
        const depthRecord = depthChartTable.records[0];

        console.log('QB Position Field:');
        console.log('==================\n');

        const qbValue = depthRecord.QB;
        console.log(`Type: ${typeof qbValue}`);
        console.log(`Value: ${JSON.stringify(qbValue, null, 2)}`);
        console.log(`\nLength: ${qbValue ? qbValue.length : 'N/A'}`);

        if (typeof qbValue === 'string') {
            // Try to use the field metadata
            const qbField = depthRecord.fields.QB;
            console.log(`\nField exists in fields object: ${!!qbField}`);
        }

        // Check the fieldsArray for QB
        console.log('\n\n Checking fieldsArray:');
        console.log('======================\n');

        const qbFieldFromArray = depthRecord.fieldsArray.find(f => f.key === 'QB');
        if (qbFieldFromArray) {
            console.log(`Key: ${qbFieldFromArray.key}`);
            console.log(`Value: ${qbFieldFromArray.value}`);
            console.log(`Reference Data:`, qbFieldFromArray.referenceData);
            console.log(`Index: ${qbFieldFromArray.index}`);
            console.log(`Is Changed: ${qbFieldFromArray.isChanged}`);
            console.log(`Offset: ${qbFieldFromArray.offset}`);

            console.log(`\n\n✓ FOUND REFERENCE DATA!`);
            console.log(`  Table ID: ${qbFieldFromArray.referenceData.tableId}`);
            console.log(`  Row Number: ${qbFieldFromArray.referenceData.rowNumber}`);

            // Now try to get the table
            const refTableId = qbFieldFromArray.referenceData.tableId;
            const refRow = qbFieldFromArray.referenceData.rowNumber;

            console.log(`\nLooking for table with ID ${refTableId}...\n`);

            const refTable = franchise.getTableByUniqueId(refTableId);
            if (refTable) {
                await refTable.readRecords();

                console.log(`✓ Found table: ${refTable.name}`);
                console.log(`  Table ID: ${refTable.header.tableId}`);
                console.log(`  Records: ${refTable.records.length}\n`);

                // Get the referenced record
                const refRecord = refTable.records[refRow];
                if (refRecord && !refRecord.isEmpty) {
                    console.log(`Record at row ${refRow}:`);
                    console.log('------------------------');

                    // Show all fields
                    const fields = Object.keys(refRecord.fields).slice(0, 20);
                    fields.forEach(field => {
                        const value = refRecord[field];
                        console.log(`  ${field}: ${JSON.stringify(value).substring(0, 80)}`);
                    });

                    // Check if these are player references
                    console.log('\n\nLooking for player references in this record...\n');

                    refRecord.fieldsArray.slice(0, 5).forEach(field => {
                        if (field.referenceData && field.referenceData.tableId !== 0) {
                            console.log(`${field.key}:`);
                            console.log(`  Table ID: ${field.referenceData.tableId}`);
                            console.log(`  Row: ${field.referenceData.rowNumber}`);

                            // Check if this is the Player table
                            const playerTable = franchise.getTableByName('Player');
                            if (field.referenceData.tableId === playerTable.header.tableId) {
                                console.log(`  ✓ This references the Player table!`);
                            }
                        }
                    });
                }
            } else {
                console.log(`❌ Could not find table with ID ${refTableId}`);
            }
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
    }
}

examineDepthChartDirect();
