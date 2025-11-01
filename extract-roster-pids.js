const path = require('path');
const fs = require('fs');

// Use the same MaddenRosterHelper that the app uses
const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));

const rosterPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENTEST';

async function extractPIDs() {
    try {
        console.log('Loading roster file...');
        const helper = new MaddenRosterHelper();
        const file = await helper.load(rosterPath);

        console.log('Roster loaded successfully');
        console.log('Found', file.tables.length, 'tables');

        // Get player table
        const playerTable = file.PLAY;

        if (!playerTable) {
            console.error('PLAY table not found');
            const tableNames = file.tables.map(t => t.name);
            console.error('Available tables:', tableNames.join(', '));
            return;
        }

        console.log(`Found ${playerTable.records.length} players`);

        // Extract all unique PIDs
        const rosterPids = new Set();
        const pidDetails = [];

        playerTable.records.forEach((record, index) => {
            const player = {};
            for (const fieldName in record.fields) {
                player[fieldName] = record.fields[fieldName].value;
            }

            // Check for PID field - could be PGID, PhotoId, PID, or similar
            const pid = player.PGID || player.PhotoId || player.PID || player.PEPS;
            const firstName = player.PFNA || '';
            const lastName = player.PLNA || '';

            if (pid && pid > 0) {
                rosterPids.add(pid);
                if (pidDetails.length < 20) {
                    pidDetails.push({
                        index: index,
                        name: `${firstName} ${lastName}`.trim(),
                        pid: pid,
                        peps: player.PEPS || ''
                    });
                }
            }
        });

        const pidsArray = Array.from(rosterPids).sort((a,b) => a-b);
        console.log(`\nUnique PIDs in roster: ${rosterPids.size}`);
        console.log(`PID range: ${Math.min(...pidsArray)} to ${Math.max(...pidsArray)}`);

        // Save to JSON
        fs.writeFileSync('roster-pids.json', JSON.stringify(pidsArray, null, 2));
        console.log('\nSaved PIDs to roster-pids.json');

        // Show sample details
        console.log('\nSample players:');
        pidDetails.forEach(p => {
            console.log(`${p.name} - PID: ${p.pid} - PEPS: ${p.peps}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

extractPIDs();
