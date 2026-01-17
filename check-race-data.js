const fs = require('fs');
const Papa = require('papaparse');

// Check ALL_PLAYER_LOOKUP race data
const allPlayerPath = './data/lookups/ALL_PLAYER_LOOKUP.csv';
const content = fs.readFileSync(allPlayerPath, 'utf8');
const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });

const withRace = parsed.data.filter(r => r.Race && r.Race.trim() !== '');
const withPID = parsed.data.filter(r => r.PhotoID && r.PhotoID.trim() !== '');

console.log('ALL_PLAYER_LOOKUP.csv:');
console.log('  Total rows:', parsed.data.length);
console.log('  With Race:', withRace.length);
console.log('  With PhotoID:', withPID.length);

console.log('\nSample rows with Race:');
withRace.slice(0, 10).forEach(r => {
  console.log(`  ${r['First Name']} ${r['Last Name']} - Race: ${r.Race}, PID: ${r.PhotoID || 'none'}`);
});

console.log('\nSample rows with PhotoID but no Race:');
const pidNoRace = parsed.data.filter(r => r.PhotoID && r.PhotoID.trim() !== '' && (!r.Race || r.Race.trim() === ''));
pidNoRace.slice(0, 10).forEach(r => {
  console.log(`  ${r['First Name']} ${r['Last Name']} - PID: ${r.PhotoID}, Race: ${r.Race || 'EMPTY'}`);
});

// Check PID_Portrait_Mapping
const pidMappingPath = './data/lookups/PID_Portrait_Mapping.csv';
const pidContent = fs.readFileSync(pidMappingPath, 'utf8');
const pidParsed = Papa.parse(pidContent, { header: true, skipEmptyLines: true });

console.log('\n\nPID_Portrait_Mapping.csv:');
console.log('  Total rows:', pidParsed.data.length);
console.log('  Columns:', Object.keys(pidParsed.data[0] || {}).join(', '));

const legends = pidParsed.data.filter(r => r.Type === 'legend');
console.log('  Legends:', legends.length);

console.log('\nFirst 5 legends:');
legends.slice(0, 5).forEach(r => {
  console.log(`  PID ${r.PID}: ${r['Player Name']} - Race: ${r.Race || 'EMPTY'}`);
});
