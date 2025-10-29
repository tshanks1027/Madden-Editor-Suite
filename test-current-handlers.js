const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

// Load college lookup
const colleges = new Map();
const collegePath = path.join(__dirname, 'data', 'lookups', 'college_lookup.csv');
const collegeData = fs.readFileSync(collegePath, 'utf-8');
collegeData.split('\n').slice(1).forEach(line => {
    const [id, name] = line.split(',');
    if (id && name) colleges.set(parseInt(id), name.trim());
});
console.log(`Loaded ${colleges.size} colleges`);

// Load franchise college mapping
const franchiseCollegeMapping = new Map();
const mappingPath = path.join(__dirname, 'data', 'franchise-college-mapping.json');
const mappingData = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
mappingData.forEach(m => franchiseCollegeMapping.set(m.franchiseId, m.rosterId));
console.log(`Loaded ${franchiseCollegeMapping.size} franchise→roster college mappings\n`);

async function testHandlerLogic() {
    const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';

    console.log('Testing current handler logic...\n');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    const activeRecords = playerTable.records.filter(r => !r.isEmpty);
    console.log(`Found ${activeRecords.length} players\n`);

    // Test first player
    const record = activeRecords[0];
    console.log(`Testing player: ${record.FirstName} ${record.LastName}`);

    // Find College field in fieldsArray
    const collegeField = record.fieldsArray.find(f => f.key === 'College');
    if (collegeField) {
        console.log(`  College field.key: ${collegeField.key}`);
        console.log(`  College field.value type: ${typeof collegeField.value}`);
        console.log(`  College field.value: ${String(collegeField.value).substring(0, 40)}...`);

        const value = collegeField.value;
        if (typeof value === 'string' && value.match(/^[01]{32}$/)) {
            const last8Bits = value.substring(24);
            const franchiseCollegeId = parseInt(last8Bits, 2);
            console.log(`  Last 8 bits: ${last8Bits}`);
            console.log(`  Franchise college ID: ${franchiseCollegeId}`);

            const rosterCollegeId = franchiseCollegeMapping.get(franchiseCollegeId);
            console.log(`  Roster college ID: ${rosterCollegeId}`);

            if (rosterCollegeId !== undefined) {
                const collegeName = colleges.get(rosterCollegeId);
                console.log(`  College name: ${collegeName}`);
            }
        }
    }

    // Also check direct property access
    console.log(`\n  Direct record.College: ${String(record.College).substring(0, 40)}...`);
}

testHandlerLogic().catch(console.error);
