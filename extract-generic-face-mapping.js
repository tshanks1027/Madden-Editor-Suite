/**
 * Extract genericHead -> genericHeadName mappings from leaguevisuals.JSON
 */
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('C:/Users/tshan/Downloads/PAM/Gamemode/leaguevisuals.JSON', 'utf8'));

const mappings = new Map();

for (const [id, player] of Object.entries(data.characterVisualsPlayerMap || {})) {
  const genericHead = player.genericHead;
  const genericHeadName = player.genericHeadName;
  const skinTone = player.skinTone;
  const containerId = player.containerId;
  const assetName = player.assetName;

  if (genericHead !== undefined && genericHeadName) {
    if (!mappings.has(genericHead)) {
      mappings.set(genericHead, {
        genericHead,
        genericHeadName,
        skinTone,
        examples: []
      });
    }
    // Add example player
    if (mappings.get(genericHead).examples.length < 3) {
      mappings.get(genericHead).examples.push({
        containerId,
        assetName,
        name: `${player.firstName} ${player.lastName}`
      });
    }
  }
}

// Sort by genericHead number
const sorted = Array.from(mappings.values()).sort((a, b) => a.genericHead - b.genericHead);

console.log('Total unique genericHead values:', sorted.length);
console.log('');
console.log('Range:', sorted[0]?.genericHead, 'to', sorted[sorted.length - 1]?.genericHead);
console.log('');

// Output as lookup table
const lookup = {};
for (const m of sorted) {
  lookup[m.genericHead] = {
    genr: m.genericHeadName,
    sknt: m.skinTone
  };
}

// Save to file
fs.writeFileSync('./data/lookups/generic-face-catalog.json', JSON.stringify(lookup, null, 2));
console.log('Saved to data/lookups/generic-face-catalog.json');
console.log('');

// Show first 30 mappings
console.log('First 30 mappings:');
sorted.slice(0, 30).forEach(m => {
  console.log(`  ${m.genericHead.toString().padStart(3)}: ${m.genericHeadName.padEnd(20)} skinTone=${m.skinTone} (${m.examples[0]?.name || 'N/A'})`);
});

console.log('');
console.log('Last 20 mappings:');
sorted.slice(-20).forEach(m => {
  console.log(`  ${m.genericHead.toString().padStart(3)}: ${m.genericHeadName.padEnd(20)} skinTone=${m.skinTone} (${m.examples[0]?.name || 'N/A'})`);
});
