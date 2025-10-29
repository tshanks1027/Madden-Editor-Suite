/**
 * Find all tables in franchise file
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function findAllTables() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('Finding all tables in franchise file...\n');

    try {
        const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

        const tables = [];

        // Try to iterate through all table indices
        for (let i = 0; i < 500; i++) {
            try {
                const table = franchise.getTableByIndex(i);
                if (table && table.header) {
                    tables.push({
                        index: i,
                        name: table.name || 'UNNAMED',
                        tableId: table.header.tableId,
                        recordCount: table.header.recordCapacity
                    });
                }
            } catch (e) {
                // No more tables
                break;
            }
        }

        console.log(`Found ${tables.length} tables\n`);

        // Filter for depth/roster/coach related
        console.log('=== RELEVANT TABLES ===\n');

        const relevant = tables.filter(t => {
            const lower = t.name.toLowerCase();
            return lower.includes('depth') || lower.includes('roster') ||
                   lower.includes('coach') || lower.includes('team') || lower.includes('player');
        });

        relevant.forEach(t => {
            console.log(`${t.index.toString().padStart(3)}: ${t.name.padEnd(30)} (ID: ${t.tableId}, Records: ${t.recordCount})`);
        });

        // Also check for table ID 11110
        console.log('\n=== SEARCHING FOR TABLE ID 11110 ===\n');

        const target = tables.find(t => t.tableId === 11110);
        if (target) {
            console.log(`✓ Found: ${target.name} at index ${target.index}`);
        } else {
            console.log(`❌ Table ID 11110 not found`);
            console.log('\nAll table IDs around 11110:');
            tables.filter(t => t.tableId >= 11100 && t.tableId <= 11120).forEach(t => {
                console.log(`  ${t.tableId}: ${t.name}`);
            });
        }

        // List ALL tables
        console.log('\n\n=== ALL TABLES ===\n');
        tables.forEach(t => {
            console.log(`${t.index.toString().padStart(3)}: ${t.name.padEnd(40)} ID: ${t.tableId.toString().padStart(5)}, Records: ${t.recordCount}`);
        });

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
    }
}

findAllTables();
