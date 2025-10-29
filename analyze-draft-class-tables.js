/**
 * Analyze franchise files to identify draft class tables
 * Compares CAREER-TEST (before) with CAREER-TEST-AUTOSAVE (after loading draft class)
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function analyzeDraftClassTables() {
    const beforePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST');
    const afterPath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('Loading BEFORE file (no draft class)...');
    const beforeFile = await Franchise.create(beforePath, { gameYearOverride: 26 });

    console.log('Loading AFTER file (with draft class)...');
    const afterFile = await Franchise.create(afterPath, { gameYearOverride: 26 });

    console.log('\n=== TABLE COMPARISON ===\n');

    // Get table names
    const beforeTables = beforeFile.tables.map(t => t.name);
    const afterTables = afterFile.tables.map(t => t.name);

    // Find new tables
    const newTables = afterTables.filter(name => !beforeTables.includes(name));
    console.log('NEW TABLES (added when draft class loaded):', newTables.length);
    newTables.forEach(name => console.log(`  - ${name}`));

    // Find tables with different record counts
    console.log('\n=== TABLES WITH CHANGED RECORD COUNTS ===\n');
    const changedTables = [];

    for (const tableName of afterTables) {
        const beforeTable = beforeFile.getTableByName(tableName);
        const afterTable = afterFile.getTableByName(tableName);

        if (beforeTable && afterTable) {
            await beforeTable.readRecords();
            await afterTable.readRecords();

            const beforeCount = beforeTable.records.filter(r => !r.isEmpty).length;
            const afterCount = afterTable.records.filter(r => !r.isEmpty).length;

            if (beforeCount !== afterCount) {
                const diff = afterCount - beforeCount;
                changedTables.push({ name: tableName, before: beforeCount, after: afterCount, diff });
            }
        }
    }

    // Sort by difference
    changedTables.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    console.log('Tables with most significant changes:');
    changedTables.slice(0, 20).forEach(({ name, before, after, diff }) => {
        console.log(`  ${name}: ${before} → ${after} (${diff > 0 ? '+' : ''}${diff})`);
    });

    // Look for draft-related tables
    console.log('\n=== DRAFT-RELATED TABLES IN AFTER FILE ===\n');
    const draftRelated = afterTables.filter(name =>
        name.toLowerCase().includes('draft') ||
        name.toLowerCase().includes('prospect') ||
        name.toLowerCase().includes('future')
    );

    console.log(`Found ${draftRelated.length} draft-related tables:`);

    for (const tableName of draftRelated.slice(0, 30)) {
        const table = afterFile.getTableByName(tableName);
        if (table) {
            await table.readRecords();
            const activeCount = table.records.filter(r => !r.isEmpty).length;
            console.log(`\n${tableName}: ${activeCount} records`);

            // Show first few field names
            if (table.schema && table.schema.attributes) {
                const fieldNames = table.schema.attributes.map(a => a.name).slice(0, 10);
                console.log(`  Fields: ${fieldNames.join(', ')}${table.schema.attributes.length > 10 ? '...' : ''}`);
            }
        }
    }

    // Examine Player table specifically
    console.log('\n=== PLAYER TABLE ANALYSIS ===\n');
    const playerTableAfter = afterFile.getTableByName('Player');
    if (playerTableAfter) {
        await playerTableAfter.readRecords();

        // Group by TeamIndex
        const teamGroups = {};
        playerTableAfter.records.forEach(record => {
            if (!record.isEmpty) {
                const teamId = record.TeamIndex;
                if (!teamGroups[teamId]) {
                    teamGroups[teamId] = [];
                }
                teamGroups[teamId].push(record);
            }
        });

        console.log('Players grouped by TeamIndex:');
        const sortedTeams = Object.entries(teamGroups).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

        sortedTeams.forEach(([teamId, players]) => {
            if (parseInt(teamId) >= 1000) {
                console.log(`  TeamIndex ${teamId}: ${players.length} players`);

                // Show first player's fields
                if (players.length > 0) {
                    const firstPlayer = players[0];
                    console.log(`    Sample: ${firstPlayer.FirstName} ${firstPlayer.LastName}`);
                    console.log(`    YearsPro: ${firstPlayer.YearsPro}`);
                    console.log(`    Position: ${firstPlayer.Position}`);
                    console.log(`    DraftRound: ${firstPlayer.PLYR_DRAFTROUND}`);
                    console.log(`    DraftPick: ${firstPlayer.PLYR_DRAFTPICK}`);
                }
            }
        });
    }

    console.log('\n=== ANALYSIS COMPLETE ===\n');
}

analyzeDraftClassTables().catch(console.error);
