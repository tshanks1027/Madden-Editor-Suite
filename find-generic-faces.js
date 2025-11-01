const path = require('path');
const fs = require('fs');

const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
const rosterPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENTEST';

async function findGenericFaces() {
    try {
        console.log('Loading roster...');
        const helper = new MaddenRosterHelper();
        const file = await helper.load(rosterPath);
        const playerTable = file.PLAY;

        console.log(`Found ${playerTable.records.length} players\n`);

        // Extract all players with their PEPS values
        const players = [];
        playerTable.records.forEach((record, index) => {
            const player = {};
            for (const fieldName in record.fields) {
                player[fieldName] = record.fields[fieldName].value;
            }
            players.push({
                index: index,
                firstName: player.PFNA || '',
                lastName: player.PLNA || '',
                pid: player.PGID || 0,
                peps: player.PEPS || '',
                team: player.TGID || 0
            });
        });

        // Filter to only players with generic PEPS values
        const genericPlayers = players.filter(p => {
            const peps = p.peps.toLowerCase();
            return peps.includes('generic') || peps.includes('_morphed');
        });

        console.log(`Players with generic faces: ${genericPlayers.length}\n`);

        // Extract generic face numbers
        const genericFaceNumbers = new Set();
        const genericDetails = [];

        genericPlayers.forEach(p => {
            genericDetails.push({
                name: `${p.firstName} ${p.lastName}`.trim(),
                pid: p.pid,
                peps: p.peps,
                team: p.team
            });

            // Try to extract the generic face number (001-265)
            const match = p.peps.match(/generic_(\d+)_(\d+)/);
            if (match) {
                const faceNum = parseInt(match[2]);
                genericFaceNumbers.add(faceNum);
            }
        });

        console.log(`Unique generic face numbers found: ${genericFaceNumbers.size}`);
        const sortedFaces = Array.from(genericFaceNumbers).sort((a, b) => a - b);
        console.log(`Range: ${Math.min(...sortedFaces)} to ${Math.max(...sortedFaces)}`);
        console.log(`\nGeneric face numbers: ${sortedFaces.slice(0, 50).join(', ')}${sortedFaces.length > 50 ? '...' : ''}`);

        // Find Cowboys players (team ID for Cowboys is usually 7)
        console.log('\n=== COWBOYS PLAYERS (alphabetically) ===');
        const cowboys = genericPlayers.filter(p => p.team === 7).sort((a, b) => {
            const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
            const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        console.log(`Cowboys with generic faces: ${cowboys.length}`);
        cowboys.slice(0, 10).forEach(p => {
            console.log(`  ${p.lastName}, ${p.firstName} - PID: ${p.pid} - PEPS: ${p.peps}`);
        });

        // Save all generic face details
        fs.writeFileSync('generic-faces-in-roster.json', JSON.stringify({
            totalGenericPlayers: genericPlayers.length,
            uniqueGenericNumbers: sortedFaces,
            genericNumberCount: sortedFaces.length,
            cowboys: cowboys,
            allGenericPlayers: genericDetails
        }, null, 2));

        console.log(`\nSaved details to generic-faces-in-roster.json`);

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

findGenericFaces();
