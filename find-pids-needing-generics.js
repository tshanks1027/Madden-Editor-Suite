const path = require('path');
const fs = require('fs');

const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
const rosterPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENTEST';

// Load atlas to see which player sprites exist
const atlas = JSON.parse(fs.readFileSync('data/portrait-atlas.json', 'utf8'));
const playerSprites = new Set();

// Get all player-specific sprites (not generic, not legends)
atlas.portraits.forEach(p => {
    if (p.category === 'players') {
        // Extract player name from ID (e.g., "SmithGeno_112" -> PID 112)
        const match = p.id.match(/_(\d+)$/);
        if (match) {
            const pid = parseInt(match[1]);
            playerSprites.add(pid);
        }
    }
});

console.log(`Player sprites in atlas: ${playerSprites.size}`);

async function findPidsNeedingGenerics() {
    try {
        console.log('Loading roster...');
        const helper = new MaddenRosterHelper();
        const file = await helper.load(rosterPath);
        const playerTable = file.PLAY;

        console.log(`Found ${playerTable.records.length} players\n`);

        // Extract all PIDs and PEPS values
        const rosterPlayers = [];
        playerTable.records.forEach((record, index) => {
            const player = {};
            for (const fieldName in record.fields) {
                player[fieldName] = record.fields[fieldName].value;
            }
            rosterPlayers.push({
                index: index,
                firstName: player.PFNA || '',
                lastName: player.PLNA || '',
                pid: player.PGID || 0,
                peps: player.PEPS || '',
                team: player.TGID || 0
            });
        });

        // Find PIDs that don't have player sprites
        const needGeneric = rosterPlayers.filter(p => {
            return p.pid > 0 && !playerSprites.has(p.pid);
        });

        console.log(`PIDs needing generic faces: ${needGeneric.length}\n`);

        // Show first 30
        console.log('First 30 players needing generic faces:');
        needGeneric.slice(0, 30).forEach(p => {
            console.log(`  ${p.lastName}, ${p.firstName} - PID: ${p.pid} - PEPS: "${p.peps}"`);
        });

        // Find Cowboys needing generics
        const cowboys = needGeneric.filter(p => p.team === 7).sort((a, b) => {
            const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
            const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        console.log(`\n=== COWBOYS needing generic faces (alphabetically) ===`);
        console.log(`Total: ${cowboys.length}`);
        cowboys.slice(0, 10).forEach(p => {
            console.log(`  ${p.lastName}, ${p.firstName} - PID: ${p.pid} - PEPS: "${p.peps}"`);
        });

        // Extract unique PIDs
        const pidsNeedingGenerics = needGeneric.map(p => p.pid);

        // Save results
        fs.writeFileSync('pids-needing-generics.json', JSON.stringify({
            count: pidsNeedingGenerics.length,
            pids: pidsNeedingGenerics,
            players: needGeneric,
            cowboys: cowboys
        }, null, 2));

        console.log(`\nSaved to pids-needing-generics.json`);

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

findPidsNeedingGenerics();
