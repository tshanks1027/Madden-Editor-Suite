const path = require('path');
const fs = require('fs');

const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
const rosterPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENTEST';

// Load atlas
const atlas = JSON.parse(fs.readFileSync('data/portrait-atlas.json', 'utf8'));
const atlasPlayerNames = new Set();

// Get all player sprite names (not generic, not legends)
atlas.portraits.forEach(p => {
    if (p.category === 'players') {
        atlasPlayerNames.add(p.id.toLowerCase());
    }
});

console.log(`Player sprites in atlas: ${atlasPlayerNames.size}`);

async function matchPepsToAtlas() {
    try {
        console.log('Loading roster...');
        const helper = new MaddenRosterHelper();
        const file = await helper.load(rosterPath);
        const playerTable = file.PLAY;

        console.log(`Found ${playerTable.records.length} players\n`);

        // Extract all players
        const rosterPlayers = [];
        playerTable.records.forEach((record, index) => {
            const player = {};
            for (const fieldName in record.fields) {
                player[fieldName] = record.fields[fieldName].value;
            }

            const peps = player.PEPS || '';
            // Remove _PID suffix to get player name (e.g., "SmithGeno_112" -> "SmithGeno")
            const playerName = peps.replace(/_\d+$/, '').toLowerCase();

            rosterPlayers.push({
                index: index,
                firstName: player.PFNA || '',
                lastName: player.PLNA || '',
                pid: player.PGID || 0,
                peps: peps,
                playerName: playerName,
                team: player.TGID || 0,
                hasSprite: atlasPlayerNames.has(playerName)
            });
        });

        // Find players without sprites
        const needGeneric = rosterPlayers.filter(p => p.pid > 0 && !p.hasSprite);

        console.log(`Players WITH sprites: ${rosterPlayers.filter(p => p.hasSprite).length}`);
        console.log(`Players NEEDING generics: ${needGeneric.length}\n`);

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
        if (cowboys.length > 0) {
            console.log('\nFirst 10:');
            cowboys.slice(0, 10).forEach(p => {
                console.log(`  ${p.lastName}, ${p.firstName} - PID: ${p.pid} - PEPS: "${p.peps}"`);
            });

            console.log('\nLast 10:');
            cowboys.slice(-10).forEach(p => {
                console.log(`  ${p.lastName}, ${p.firstName} - PID: ${p.pid} - PEPS: "${p.peps}"`);
            });
        }

        // Extract PIDs needing generics
        const pidsNeedingGenerics = needGeneric.map(p => p.pid);

        // Save results
        fs.writeFileSync('pids-needing-generics.json', JSON.stringify({
            count: pidsNeedingGenerics.length,
            pids: pidsNeedingGenerics,
            players: needGeneric.map(p => ({
                name: `${p.firstName} ${p.lastName}`.trim(),
                pid: p.pid,
                peps: p.peps,
                playerName: p.playerName
            })),
            cowboys: cowboys.map(p => ({
                name: `${p.firstName} ${p.lastName}`.trim(),
                pid: p.pid,
                peps: p.peps,
                playerName: p.playerName
            }))
        }, null, 2));

        console.log(`\nSaved to pids-needing-generics.json`);

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

matchPepsToAtlas();
