/**
 * Examine Team.Roster array structure to understand Madden 26 array patterns
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function examineRosterArray() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST');

    console.log('Examining Team.Roster array structure...\n');

    try {
        const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

        // Get Team table (use index 1)
        const teamTables = franchise.getAllTablesByName('Team');
        const teamTable = teamTables[1];
        await teamTable.readRecords();

        const realTeams = teamTable.records.filter(r => !r.isEmpty);
        const firstTeam = realTeams[0];

        console.log(`Team: ${firstTeam.DisplayName || firstTeam.LongName}`);
        console.log(`TeamIndex: ${firstTeam.TeamIndex}\n`);

        // Get Roster reference
        const rosterBinary = firstTeam.Roster;
        console.log(`Roster Binary: ${rosterBinary}\n`);

        // Get reference data from fieldsArray
        const rosterField = firstTeam.fieldsArray.find(f => f.key === 'Roster');
        if (rosterField) {
            console.log(`Roster Reference Data:`);
            console.log(`  Table ID: ${rosterField.referenceData.tableId}`);
            console.log(`  Row Number: ${rosterField.referenceData.rowNumber}\n`);

            // Get the roster table
            const rosterTableId = rosterField.referenceData.tableId;
            const rosterTable = franchise.getTableByUniqueId(rosterTableId);

            if (rosterTable) {
                await rosterTable.readRecords();

                console.log(`✓ Found Roster Table: ${rosterTable.name}`);
                console.log(`  Table ID: ${rosterTable.header.tableId}`);
                console.log(`  Records: ${rosterTable.records.length}\n`);

                // Get the roster record
                const rosterRow = rosterField.referenceData.rowNumber;
                const rosterRecord = rosterTable.records[rosterRow];

                if (rosterRecord && !rosterRecord.isEmpty) {
                    console.log(`Roster Record Structure:`);
                    console.log('------------------------');
                    console.log(`  Fields Count: ${rosterRecord.fieldsArray.length}`);

                    // Get player table for comparison
                    const playerTable = franchise.getTableByName('Player');
                    await playerTable.readRecords();

                    console.log(`\nFirst 10 roster slots:\n`);

                    for (let i = 0; i < Math.min(10, rosterRecord.fieldsArray.length); i++) {
                        const field = rosterRecord.fieldsArray[i];

                        if (field.referenceData && field.referenceData.tableId !== 0) {
                            const isPlayer = field.referenceData.tableId === playerTable.header.tableId;

                            if (isPlayer) {
                                const player = playerTable.records[field.referenceData.rowNumber];
                                if (player && !player.isEmpty && player.FirstName) {
                                    console.log(`${i}: ${player.FirstName} ${player.LastName} (${player.Position}) - ${player.Overall || 'N/A'} OVR`);
                                } else {
                                    console.log(`${i}: EMPTY SLOT (ref to row ${field.referenceData.rowNumber})`);
                                }
                            } else {
                                console.log(`${i}: NON-PLAYER REFERENCE (Table ${field.referenceData.tableId})`);
                            }
                        } else {
                            console.log(`${i}: NULL REFERENCE`);
                        }
                    }

                    console.log(`\n✓ SUCCESS: Roster array contains direct player references`);
                    console.log(`\nKey Learning: In M26, array tables store direct references to entities`);
                    console.log(`Pattern: Team.Roster → Roster[] table → Player references`);
                }
            } else {
                console.log(`❌ Roster table ID ${rosterTableId} not found`);
            }
        }

        // Now check if depth chart works the same way
        console.log(`\n\n${'='.repeat(50)}`);
        console.log(`NOW CHECKING DEPTH CHART WITH SAME PATTERN`);
        console.log(`${'='.repeat(50)}\n`);

        const depthField = firstTeam.fieldsArray.find(f => f.key === 'DepthChart');
        if (depthField) {
            console.log(`DepthChart Reference Data:`);
            console.log(`  Table ID: ${depthField.referenceData.tableId}`);
            console.log(`  Row Number: ${depthField.referenceData.rowNumber}\n`);

            const depthTableId = depthField.referenceData.tableId;
            const depthTable = franchise.getTableByUniqueId(depthTableId);

            if (depthTable) {
                await depthTable.readRecords();

                console.log(`✓ Found DepthChart Table: ${depthTable.name}`);
                console.log(`  Table ID: ${depthTable.header.tableId}`);
                console.log(`  Records: ${depthTable.records.length}\n`);

                const depthRow = depthField.referenceData.rowNumber;
                const depthRecord = depthTable.records[depthRow];

                if (depthRecord) {
                    console.log(`DepthChart Record has ${depthRecord.fieldsArray.length} position fields\n`);

                    // Check QB position
                    const qbField = depthRecord.fieldsArray.find(f => f.key === 'QB');
                    if (qbField && qbField.referenceData && qbField.referenceData.tableId !== 0) {
                        console.log(`QB Position References:`);
                        console.log(`  Table ID: ${qbField.referenceData.tableId}`);
                        console.log(`  Row: ${qbField.referenceData.rowNumber}\n`);

                        const qbArrayTable = franchise.getTableByUniqueId(qbField.referenceData.tableId);
                        if (qbArrayTable) {
                            await qbArrayTable.readRecords();

                            console.log(`✓ Found QB Array Table: ${qbArrayTable.name}`);
                            console.log(`  Table ID: ${qbArrayTable.header.tableId}`);
                            console.log(`  Records: ${qbArrayTable.records.length}\n`);

                            const qbArrayRecord = qbArrayTable.records[qbField.referenceData.rowNumber];
                            if (qbArrayRecord) {
                                console.log(`QB Depth Chart (first 5 slots):\n`);

                                const playerTable = franchise.getTableByName('Player');

                                for (let i = 0; i < Math.min(5, qbArrayRecord.fieldsArray.length); i++) {
                                    const slot = qbArrayRecord.fieldsArray[i];

                                    if (slot.referenceData && slot.referenceData.tableId === playerTable.header.tableId) {
                                        const player = playerTable.records[slot.referenceData.rowNumber];
                                        if (player && !player.isEmpty && player.FirstName) {
                                            console.log(`  ${i + 1}. ${player.FirstName} ${player.LastName} - ${player.Overall || 'N/A'} OVR`);
                                        } else {
                                            console.log(`  ${i + 1}. EMPTY`);
                                        }
                                    } else {
                                        console.log(`  ${i + 1}. NULL`);
                                    }
                                }

                                console.log(`\n✓ SUCCESS: Depth chart uses same array pattern as roster!`);
                                console.log(`\nPattern: Team.DepthChart → DepthChart → Position → PositionArray[] → Player`);
                            }
                        } else {
                            console.log(`❌ QB Array Table ${qbField.referenceData.tableId} not found`);
                            console.log(`This might be an uninitialized depth chart`);
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
    }
}

examineRosterArray();
