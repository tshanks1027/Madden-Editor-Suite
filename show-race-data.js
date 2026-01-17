const fs = require('fs');
const Papa = require('papaparse');
const content = fs.readFileSync('./data/lookups/ALL_PLAYER_LOOKUP.csv', 'utf8');
const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });

const withRace = parsed.data.filter(r => r.Race && r.Race.trim() !== '');
console.log('Players with Race data assigned (109 total):');
console.log('');

// Count by race value
const raceCount = {};
withRace.forEach(r => {
  const race = r.Race;
  raceCount[race] = (raceCount[race] || 0) + 1;
});
console.log('Race distribution:');
Object.entries(raceCount).sort((a, b) => b[1] - a[1]).forEach(([race, count]) => {
  console.log(`  ${race}: ${count}`);
});

console.log('');
console.log('Sample players with race assigned:');
withRace.slice(0, 20).forEach(r => {
  console.log(`  ${r['First Name']} ${r['Last Name']} (${r.Position}) - Race: ${r.Race}`);
});
