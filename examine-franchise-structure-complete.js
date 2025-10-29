/**
 * Comprehensive franchise file structure examination
 * Examines: Teams, Players, Depth Charts, Coaches, Binary References
 */

const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

async function examineFranchiseStructure() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('==============================================');
    console.log('  MADDEN 26 FRANCHISE FILE STRUCTURE ANALYSIS');
    console.log('==============================================\n');

    try {
        const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

        // =======================
        // 1. EXAMINE TEAM TABLE
        // =======================
        console.log('\n╔═══════════════════════════════════════╗');
        console.log('║       TEAM TABLE STRUCTURE            ║');
        console.log('╚═══════════════════════════════════════╝\n');

        const teamTable = franchise.getTableByName('Team');
        await teamTable.readRecords();

        console.log(`Table Name: ${teamTable.name}`);
        console.log(`Table ID: ${teamTable.header.tableId}`);
        console.log(`Total Records: ${teamTable.records.length}`);
        console.log(`Non-Empty Records: ${teamTable.records.filter(r => !r.isEmpty).length}\n`);

        // Get first real team (skip empty records)
        const firstTeam = teamTable.records.find(r => !r.isEmpty);

        console.log('Sample Team Fields:');
        console.log('-------------------');
        const teamFields = firstTeam.fields;
        Object.keys(teamFields).slice(0, 30).forEach(field => {
            const value = firstTeam[field];
            const type = typeof value === 'object' && value !== null ? 'reference' : typeof value;
            console.log(`  ${field}: ${type} = ${JSON.stringify(value).substring(0, 60)}`);
        });

        // Check for depth chart reference
        console.log('\n\nDepth Chart Reference:');
        console.log('----------------------');
        if (firstTeam.DepthChart) {
            console.log(`  Type: ${typeof firstTeam.DepthChart}`);
            console.log(`  Value: ${JSON.stringify(firstTeam.DepthChart, null, 2)}`);
        } else {
            console.log('  NOT FOUND - checking for alternatives...');
            Object.keys(teamFields).filter(f => f.toLowerCase().includes('depth')).forEach(f => {
                console.log(`  ${f}: ${JSON.stringify(firstTeam[f])}`);
            });
        }

        // Check for coach references
        console.log('\n\nCoach References:');
        console.log('-----------------');
        ['HeadCoach', 'OffensiveCoordinator', 'DefensiveCoordinator', 'SpecialTeamsCoordinator'].forEach(pos => {
            if (firstTeam[pos]) {
                console.log(`  ${pos}: ${JSON.stringify(firstTeam[pos])}`);
            }
        });

        // =======================
        // 2. EXAMINE PLAYER TABLE
        // =======================
        console.log('\n\n╔═══════════════════════════════════════╗');
        console.log('║      PLAYER TABLE STRUCTURE           ║');
        console.log('╚═══════════════════════════════════════╝\n');

        const playerTable = franchise.getTableByName('Player');
        await playerTable.readRecords();

        console.log(`Table Name: ${playerTable.name}`);
        console.log(`Table ID: ${playerTable.header.tableId}`);
        console.log(`Total Records: ${playerTable.records.length}`);
        console.log(`Non-Empty Records: ${playerTable.records.filter(r => !r.isEmpty).length}\n`);

        // Find a real player
        const firstPlayer = playerTable.records.find(r => !r.isEmpty && r.FirstName && r.LastName);

        console.log(`Sample Player: ${firstPlayer.FirstName} ${firstPlayer.LastName}`);
        console.log('-------------------');
        const playerFields = firstPlayer.fields;

        // Show key fields for team management
        const keyFields = ['FirstName', 'LastName', 'Position', 'Overall', 'TeamIndex', 'RosterIndex',
                          'ContractStatus', 'College', 'Age', 'YearsPro', 'JerseyNum'];

        console.log('\nKey Fields:');
        keyFields.forEach(field => {
            if (firstPlayer[field] !== undefined) {
                console.log(`  ${field}: ${JSON.stringify(firstPlayer[field])}`);
            }
        });

        // Check for depth chart position field
        console.log('\n\nDepth Chart Position Fields:');
        console.log('----------------------------');
        Object.keys(playerFields).filter(f =>
            f.toLowerCase().includes('depth') ||
            f.toLowerCase().includes('starter') ||
            f.toLowerCase().includes('roster')
        ).forEach(f => {
            console.log(`  ${f}: ${JSON.stringify(firstPlayer[f]).substring(0, 80)}`);
        });

        // =======================
        // 3. EXAMINE DEPTH CHART TABLES
        // =======================
        console.log('\n\n╔═══════════════════════════════════════╗');
        console.log('║    DEPTH CHART TABLE STRUCTURE        ║');
        console.log('╚═══════════════════════════════════════╝\n');

        // Try to find depth chart tables
        const depthTableNames = ['DepthChart', 'TeamDepthChart', 'DepthChartPosition'];
        const foundDepthTables = [];

        for (const name of depthTableNames) {
            try {
                const tables = franchise.getAllTablesByName(name);
                if (tables && tables.length > 0) {
                    foundDepthTables.push({ name, tables });
                }
            } catch (e) {
                // Table doesn't exist
            }
        }

        console.log('Depth Chart Tables Found:');
        if (foundDepthTables.length === 0) {
            console.log('  (none found - trying alternative approach...)');

            // Try to follow the reference from Team.DepthChart
            if (firstTeam.DepthChart && typeof firstTeam.DepthChart === 'string') {
                console.log('\n  Following Team.DepthChart binary reference...');
                // The binary string is a reference - need to decode it
                console.log(`  Binary: ${firstTeam.DepthChart}`);
            }
        } else {
            foundDepthTables.forEach(({ name, tables }) => {
                console.log(`  - ${name} (${tables.length} table(s))`);
            });
        }

        if (foundDepthTables.length > 0) {
            // Examine first found depth chart table
            const { name, tables } = foundDepthTables[0];
            const depthTable = tables[0];
            await depthTable.readRecords();

            console.log(`\n\nExamining: ${name}`);
            console.log(`Table ID: ${depthTable.header.tableId}`);
            console.log(`Records: ${depthTable.records.length}`);
            console.log(`Non-Empty: ${depthTable.records.filter(r => !r.isEmpty).length}\n`);

            const firstDepth = depthTable.records.find(r => !r.isEmpty);
            if (firstDepth) {
                console.log('Sample Depth Chart Record Fields:');
                const depthFields = Object.keys(firstDepth.fields).slice(0, 20);
                depthFields.forEach(field => {
                    const value = firstDepth[field];
                    console.log(`  ${field}: ${JSON.stringify(value).substring(0, 80)}`);
                });
            }
        }

        // Check for second level (DepthChartPlayer)
        const depthPlayerTableNames = ['DepthChartPlayer', 'TeamDepthChartPlayer', 'DepthChartPlayerSlot'];

        for (const name of depthPlayerTableNames) {
            try {
                const tables = franchise.getAllTablesByName(name);
                if (tables && tables.length > 0) {
                    console.log(`\n\nFound ${name} Table:`);
                    const depthPlayerTable = tables[0];
                    await depthPlayerTable.readRecords();

                    console.log(`Table ID: ${depthPlayerTable.header.tableId}`);
                    console.log(`Records: ${depthPlayerTable.records.length}\n`);

                    const firstDepthPlayer = depthPlayerTable.records.find(r => !r.isEmpty);
                    if (firstDepthPlayer) {
                        console.log('Sample Depth Chart Player Record:');
                        const fields = Object.keys(firstDepthPlayer.fields).slice(0, 15);
                        fields.forEach(field => {
                            const value = firstDepthPlayer[field];
                            console.log(`  ${field}: ${JSON.stringify(value).substring(0, 80)}`);
                        });
                    }
                    break; // Found one, no need to check others
                }
            } catch (e) {
                // Table doesn't exist
            }
        }

        // =======================
        // 4. EXAMINE COACH TABLE
        // =======================
        console.log('\n\n╔═══════════════════════════════════════╗');
        console.log('║       COACH TABLE STRUCTURE           ║');
        console.log('╚═══════════════════════════════════════╝\n');

        const coachTable = franchise.getTableByName('Coach');
        await coachTable.readRecords();

        console.log(`Table Name: ${coachTable.name}`);
        console.log(`Table ID: ${coachTable.header.tableId}`);
        console.log(`Total Records: ${coachTable.records.length}`);
        console.log(`Non-Empty Records: ${coachTable.records.filter(r => !r.isEmpty).length}\n`);

        const firstCoach = coachTable.records.find(r => !r.isEmpty && r.FirstName && r.LastName);
        if (firstCoach) {
            console.log(`Sample Coach: ${firstCoach.FirstName} ${firstCoach.LastName}`);
            console.log('-------------------');

            const coachKeyFields = ['FirstName', 'LastName', 'Position', 'TeamIndex', 'ContractStatus',
                                   'ContractLength', 'ContractYearsRemaining', 'ContractSalary'];

            console.log('\nKey Fields:');
            coachKeyFields.forEach(field => {
                if (firstCoach[field] !== undefined) {
                    console.log(`  ${field}: ${JSON.stringify(firstCoach[field])}`);
                }
            });

            // Check for scheme/playbook fields
            console.log('\n\nScheme/Playbook Fields:');
            Object.keys(firstCoach.fields).filter(f =>
                f.toLowerCase().includes('scheme') ||
                f.toLowerCase().includes('playbook') ||
                f.toLowerCase().includes('offensive') ||
                f.toLowerCase().includes('defensive')
            ).forEach(f => {
                console.log(`  ${f}: ${JSON.stringify(firstCoach[f]).substring(0, 80)}`);
            });
        }

        // =======================
        // 5. EXAMINE BINARY REFERENCES
        // =======================
        console.log('\n\n╔═══════════════════════════════════════╗');
        console.log('║     BINARY REFERENCE PATTERNS         ║');
        console.log('╚═══════════════════════════════════════╝\n');

        console.log('Checking how binary references work...\n');

        // Get a team with players
        const team = teamTable.records.find(r => !r.isEmpty && r.DisplayName);
        console.log(`Team: ${team.DisplayName || team.LongName}`);
        console.log(`TeamIndex: ${team.TeamIndex}\n`);

        // Find players on this team
        const teamPlayers = playerTable.records.filter(r =>
            !r.isEmpty && r.TeamIndex === team.TeamIndex
        ).slice(0, 3);

        if (teamPlayers.length > 0) {
            console.log('Players on this team:');
            teamPlayers.forEach((player, idx) => {
                console.log(`\n${idx + 1}. ${player.FirstName} ${player.LastName} (${player.Position})`);
                console.log(`   Overall: ${player.Overall}`);
                console.log(`   TeamIndex: ${player.TeamIndex}`);
                console.log(`   Record Index: ${playerTable.records.indexOf(player)}`);

                // Check for binary fields
                const binaryFields = Object.keys(player.fields).filter(f => {
                    const val = player[f];
                    return typeof val === 'string' && val.length === 32 && val.match(/^[01]+$/);
                });

                if (binaryFields.length > 0) {
                    console.log('   Binary Fields:');
                    binaryFields.slice(0, 3).forEach(f => {
                        console.log(`     ${f}: ${player[f]}`);
                    });
                }
            });
        }

        // =======================
        // 6. ROSTER TABLE STRUCTURE
        // =======================
        console.log('\n\n╔═══════════════════════════════════════╗');
        console.log('║      ROSTER TABLE STRUCTURE           ║');
        console.log('╚═══════════════════════════════════════╝\n');

        const rosterTableNames = ['Roster', 'TeamRoster'];

        for (const name of rosterTableNames) {
            try {
                const tables = franchise.getAllTablesByName(name);
                if (tables && tables.length > 0) {
                    console.log(`Found: ${name}`);
                    const rosterTable = tables[0];
                    await rosterTable.readRecords();

                    console.log(`Table ID: ${rosterTable.header.tableId}`);
                    console.log(`Records: ${rosterTable.records.length}\n`);

                    // Show first roster record
                    const firstRoster = rosterTable.records[0];
                    if (firstRoster) {
                        console.log('First Roster Record Structure:');
                        console.log(`  Is Array-like: ${Array.isArray(firstRoster.fields)}`);
                        console.log(`  Field Count: ${Object.keys(firstRoster.fields).length}`);

                        // Show first few fields
                        const rosterFields = Object.keys(firstRoster.fields).slice(0, 10);
                        rosterFields.forEach(field => {
                            const value = firstRoster[field];
                            const isBinary = typeof value === 'string' && value.length === 32 && value.match(/^[01]+$/);
                            console.log(`  ${field}: ${isBinary ? 'BINARY_REF' : typeof value} = ${JSON.stringify(value).substring(0, 50)}`);
                        });
                    }
                    break;
                }
            } catch (e) {
                // Table doesn't exist
            }
        }

        // =======================
        // SUMMARY
        // =======================
        console.log('\n\n╔═══════════════════════════════════════╗');
        console.log('║            SUMMARY                    ║');
        console.log('╚═══════════════════════════════════════╝\n');

        console.log('Key Tables Found:');
        console.log('-----------------');
        console.log('  ✓ Team');
        console.log('  ✓ Player');
        console.log('  ✓ Coach');
        if (foundDepthTables.length > 0) {
            foundDepthTables.forEach(({name}) => console.log(`  ✓ ${name}`));
        }
        console.log('\nNote: Use franchise.getAllTablesByName(name) to access these tables.');

        console.log('\n\n==============================================');
        console.log('  EXAMINATION COMPLETE');
        console.log('==============================================\n');

        // Save output to file
        const outputPath = path.join(__dirname, 'FRANCHISE_STRUCTURE_ANALYSIS.txt');
        console.log(`\nOutput also saved to: ${outputPath}\n`);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

examineFranchiseStructure();
