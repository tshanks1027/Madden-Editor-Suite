/**
 * Check body types in the official roster to understand the correct distribution
 */

const path = require('path');

async function checkBodyTypes() {
  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  console.log('Loading roster file...');

  // Use MaddenRosterHelper from vendored library
  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  console.log('Found', file.tables.length, 'tables');

  // Get player table (PLAY in TDB2 format)
  const playerTable = file.PLAY;
  if (!playerTable) {
    console.log('PLAY table not found!');
    return;
  }

  // Convert to array of records with fields accessible
  const records = playerTable.records.map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  console.log('Total players:', records.length);
  console.log('');

  // Check what body type field exists
  const samplePlayer = records[0];
  const allFields = Object.keys(samplePlayer).sort();
  console.log('ALL FIELDS:', allFields.join(', '));

  // Find body-related fields
  const bodyFields = allFields.filter(f =>
    f.toLowerCase().includes('body') ||
    f.toLowerCase().includes('bty') ||
    f === 'PTAR' ||
    f === 'PBTY' ||
    f === 'PBAR'
  );
  console.log('Body-related fields found:', bodyFields.join(', ') || 'NONE');

  // Check PTAR (body type field)
  const ptarDistribution = {};
  const positionPTAR = {};

  for (const record of records) {
    const firstName = record.PFNA || '';
    const lastName = record.PLNA || '';
    if (!firstName && !lastName) continue;

    const ptar = record.PTAR;
    const position = record.PPOS;
    const weight = record.PWGT;
    const height = record.PHGT;

    // Track PTAR distribution
    if (ptarDistribution[ptar] === undefined) ptarDistribution[ptar] = [];
    ptarDistribution[ptar].push({ name: `${firstName} ${lastName}`, position, weight, height });

    // Track by position
    if (!positionPTAR[position]) positionPTAR[position] = {};
    if (!positionPTAR[position][ptar]) positionPTAR[position][ptar] = 0;
    positionPTAR[position][ptar]++;
  }

  console.log('');
  console.log('=== PTAR (Body Type) Distribution ===');
  const sortedPTAR = Object.keys(ptarDistribution).sort((a, b) => Number(a) - Number(b));
  for (const ptar of sortedPTAR) {
    const players = ptarDistribution[ptar];
    console.log(`PTAR ${ptar}: ${players.length} players`);
    // Show a few examples
    const samples = players.slice(0, 3);
    for (const s of samples) {
      console.log(`  - ${s.name} (${s.position}) Weight: ${s.weight}, Height: ${s.height}`);
    }
  }

  console.log('');
  console.log('=== PTAR by Position (common positions) ===');
  const commonPositions = ['QB', 'HB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P'];
  for (const pos of commonPositions) {
    if (positionPTAR[pos]) {
      const counts = positionPTAR[pos];
      const distribution = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([ptar, count]) => `${ptar}:${count}`)
        .join(', ');
      console.log(`${pos}: ${distribution}`);
    }
  }

  // Also check for other possible body type fields
  console.log('');
  console.log('=== Sample Player Full Data (first 3 players) ===');
  for (let i = 0; i < 3; i++) {
    const p = records[i];
    console.log(`\nPlayer ${i + 1}: ${p.PFNA} ${p.PLNA}`);
    console.log(`  Position: ${p.PPOS}, Height: ${p.PHGT}, Weight: ${p.PWGT}`);
    console.log(`  PTAR: ${p.PTAR}, PSKI: ${p.PSKI}`);
  }
}

checkBodyTypes().catch(console.error);
