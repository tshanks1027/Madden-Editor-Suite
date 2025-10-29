/**
 * Check if Team table has direct properties like Coach table
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function testTeamTableFields() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1];
    await teamTable.readRecords();

    const teams = teamTable.records.filter(r => !r.isEmpty);

    if (teams.length > 0) {
        const firstTeam = teams[0];

        console.log('=== TEAM TABLE FIELD EXTRACTION ===\n');

        console.log('Team DisplayName:', firstTeam.DisplayName);
        console.log('Team TeamIndex (direct):', firstTeam.TeamIndex);
        console.log('Team TGID (direct):', firstTeam.TGID);

        console.log('\nfieldsArray has', firstTeam.fieldsArray.length, 'fields\n');

        // Check if TeamIndex is in fieldsArray
        const teamIndexField = firstTeam.fieldsArray.find(f => f.key === 'TeamIndex');
        console.log('TeamIndex in fieldsArray?', teamIndexField ? 'YES' : 'NO');

        // Check if TGID is in fieldsArray
        const tgidField = firstTeam.fieldsArray.find(f => f.key === 'TGID');
        console.log('TGID in fieldsArray?', tgidField ? 'YES' : 'NO');

        // Check what fields ARE in fieldsArray
        console.log('\nFirst 20 fields in fieldsArray:');
        firstTeam.fieldsArray.slice(0, 20).forEach(f => {
            console.log(`  ${f.key}: ${f.value}`);
        });

        // Check if Team has common properties as direct access
        console.log('\n=== Direct Property Access Test ===');
        const testProps = ['TeamIndex', 'DisplayName', 'LongName', 'ShortName', 'SeasonWins', 'SeasonLosses', 'TGID'];
        testProps.forEach(prop => {
            console.log(`  ${prop}: ${firstTeam[prop]}`);
        });
    }
}

testTeamTableFields().catch(console.error);
