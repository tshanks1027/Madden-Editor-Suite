/**
 * Decode depth chart binary references to find player slot table
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function decodeDepthChartStructure() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('==============================================');
    console.log('  DEPTH CHART BINARY REFERENCE DECODER');
    console.log('==============================================\n');

    try {
        const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

        // Get Team table (use index 1 like existing scripts)
        const teamTables = franchise.getAllTablesByName('Team');
        console.log(`Found ${teamTables.length} Team table(s)\n`);

        const teamTable = teamTables.length > 1 ? teamTables[1] : teamTables[0];
        await teamTable.readRecords();

        const realTeams = teamTable.records.filter(r => !r.isEmpty);
        console.log(`Found ${realTeams.length} real teams\n`);

        // Get first real team
        const firstTeam = realTeams[0];
        console.log(`Team: ${firstTeam.DisplayName || firstTeam.LongName}`);
        console.log(`TeamIndex: ${firstTeam.TeamIndex}\n`);

        // Get depth chart reference
        const depthChartBinary = firstTeam.DepthChart;
        console.log(`DepthChart Binary Reference: ${depthChartBinary}\n`);

        // Get DepthChart table
        const depthChartTables = franchise.getAllTablesByName('DepthChart');
        const depthChartTable = depthChartTables[0];
        await depthChartTable.readRecords();

        console.log(`DepthChart Table ID: ${depthChartTable.header.tableId}`);
        console.log(`DepthChart Records: ${depthChartTable.records.length}\n`);

        // Madden franchise library has getBinaryReferenceData function
        // Binary format: first bits = table ID, last bits = row number
        // Let's decode manually: 32-bit binary string

        function decodeBinaryReference(binary) {
            // Convert binary string to parts
            // Typically: bits 0-15 = table ID, bits 16-31 = row number (varies by format)
            const tableIdBits = binary.substring(0, 16);
            const rowBits = binary.substring(16);

            const tableId = parseInt(tableIdBits, 2);
            const rowNumber = parseInt(rowBits, 2);

            return { tableId, rowNumber, binary };
        }

        // Decode depth chart reference
        const depthChartRef = decodeBinaryReference(depthChartBinary);
        console.log('Decoded DepthChart Reference:');
        console.log(`  Table ID: ${depthChartRef.tableId}`);
        console.log(`  Row Number: ${depthChartRef.rowNumber}\n`);

        // Get the depth chart record
        const depthChartRecord = depthChartTable.records[depthChartRef.rowNumber];
        if (!depthChartRecord) {
            console.log(`⚠️  Row ${depthChartRef.rowNumber} not found in DepthChart table\n`);
            console.log('Trying record 0 instead...\n');
        }

        const depthRecord = depthChartRecord || depthChartTable.records[0];
        console.log('Depth Chart Positions:');
        console.log('----------------------');

        const positions = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
                          'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P'];

        const positionRefs = [];

        for (const pos of positions) {
            if (depthRecord[pos]) {
                const binary = depthRecord[pos];
                const decoded = decodeBinaryReference(binary);
                positionRefs.push({ pos, ...decoded });

                console.log(`${pos.padEnd(6)} → Table ${decoded.tableId}, Row ${decoded.rowNumber}`);
            }
        }

        // Now find which table these references point to
        console.log('\n\nFinding Depth Chart Player Table:');
        console.log('----------------------------------');

        const targetTableId = positionRefs[0].tableId;
        console.log(`Target Table ID from references: ${targetTableId}\n`);

        // Try to find table by ID - iterate through all table indices
        console.log('Searching for table...\n');

        let depthPlayerTable = null;

        // Try direct lookup first
        try {
            depthPlayerTable = franchise.getTableByUniqueId(targetTableId);
        } catch (e) {
            console.log(`Direct lookup failed, trying table iteration...`);
        }

        // If not found, try iterating
        if (!depthPlayerTable) {
            for (let i = 0; i < 300; i++) {
                try {
                    const table = franchise.getTableByIndex(i);
                    if (table && table.header && table.header.tableId === targetTableId) {
                        depthPlayerTable = table;
                        console.log(`✓ Found table at index ${i}`);
                        break;
                    }
                } catch (e) {
                    // Table index doesn't exist
                    break;
                }
            }
        }

        if (depthPlayerTable) {
            await depthPlayerTable.readRecords();

            console.log(`✓ Found table: ${depthPlayerTable.name || 'UNNAMED'}`);
            console.log(`  Table ID: ${depthPlayerTable.header.tableId}`);
            console.log(`  Records: ${depthPlayerTable.records.length}\n`);

            // Examine a few records
            console.log('Sample Depth Chart Player Records:');
            console.log('-----------------------------------');

            for (let i = 0; i < Math.min(3, positionRefs.length); i++) {
                const { pos, rowNumber } = positionRefs[i];
                const record = depthPlayerTable.records[rowNumber];

                if (record && !record.isEmpty) {
                    console.log(`\n${pos} (Row ${rowNumber}):`);

                    const fields = Object.keys(record.fields).slice(0, 10);
                    fields.forEach(field => {
                        const value = record[field];
                        const isBinary = typeof value === 'string' && value.length === 32 && value.match(/^[01]+$/);

                        if (isBinary) {
                            const playerRef = decodeBinaryReference(value);
                            console.log(`  ${field}: PLAYER_REF (Table ${playerRef.tableId}, Row ${playerRef.rowNumber})`);
                        } else {
                            console.log(`  ${field}: ${JSON.stringify(value).substring(0, 60)}`);
                        }
                    });
                }
            }

            // Now verify we can get actual players
            console.log('\n\n═══════════════════════════════════════');
            console.log('  VERIFYING PLAYER RESOLUTION');
            console.log('═══════════════════════════════════════\n');

            const playerTable = franchise.getTableByName('Player');
            await playerTable.readRecords();

            const qbDepthRecord = depthPlayerTable.records[positionRefs.find(p => p.pos === 'QB').rowNumber];
            console.log('QB Depth Chart Slots:');
            console.log('---------------------');

            const qbFields = Object.keys(qbDepthRecord.fields);
            qbFields.forEach(field => {
                const binary = qbDepthRecord[field];
                if (typeof binary === 'string' && binary.length === 32 && binary.match(/^[01]+$/)) {
                    const playerRef = decodeBinaryReference(binary);

                    if (playerRef.tableId === playerTable.header.tableId) {
                        const player = playerTable.records[playerRef.rowNumber];
                        if (player && !player.isEmpty && player.FirstName) {
                            console.log(`  ${field}: ${player.FirstName} ${player.LastName} (${player.Overall || 'N/A'} OVR)`);
                        } else {
                            console.log(`  ${field}: EMPTY SLOT`);
                        }
                    }
                }
            });
        } else {
            console.log(`❌ Could not find table with ID ${targetTableId}`);
        }

        console.log('\n\n==============================================');
        console.log('  DEPTH CHART STRUCTURE DECODED');
        console.log('==============================================\n');

        console.log('Key Findings:');
        console.log('-------------');
        console.log(`1. Team.DepthChart → DepthChart table (${depthChartTable.name})`);
        console.log(`2. DepthChart.QB/HB/etc → Depth Chart Player Slots table (${depthPlayerTable ? depthPlayerTable.name : 'NOT FOUND'})`);
        console.log(`3. Depth Chart Player Slots.Starter0/Backup0/etc → Player table\n`);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

decodeDepthChartStructure();
