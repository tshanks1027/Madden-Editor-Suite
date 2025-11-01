const { readDraftClass } = require('./src/main/lib/draft-class/DraftClassParser');

const rosterPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENTEST';
const prospects = readDraftClass(rosterPath);

console.log(`Loaded ${prospects.length} players from roster`);

// Extract all unique PIDs
const rosterPids = new Set();
prospects.forEach(player => {
    if (player.PhotoID && player.PhotoID > 0) {
        rosterPids.add(player.PhotoID);
    }
});

const pidsArray = Array.from(rosterPids).sort((a,b) => a-b);
console.log(`Unique PIDs in roster: ${rosterPids.size}`);
console.log(`PID range: ${Math.min(...pidsArray)} to ${Math.max(...pidsArray)}`);

// Save to JSON
fs.writeFileSync('roster-pids.json', JSON.stringify(pidsArray, null, 2));
console.log('Saved PIDs to roster-pids.json');
