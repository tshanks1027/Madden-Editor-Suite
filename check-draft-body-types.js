/**
 * Check body types in a draft class file to see what values are valid
 */

const path = require('path');
const fs = require('fs');

async function checkDraftBodyTypes() {
  const draftClassPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026Template';

  console.log('Loading draft class file...');

  // Read buffer
  const buffer = fs.readFileSync(draftClassPath);

  // Parse header
  const signature = buffer.toString('ascii', 0, 8);
  const versionByte = buffer.readUInt8(8);
  const year = buffer.readUInt16LE(0x16);
  const product = buffer.toString('ascii', 0x22, 0x37).replace(/\0/g, '');

  const header = {
    signature,
    version: versionByte,
    year,
    product,
    gameVersion: 'M26',
    dataStartOffset: 0x46 // M26 starts at 0x46
  };

  console.log('Header:', header);

  // Use M26Parser
  const { parseM26Prospects } = require(path.join(__dirname, 'src', 'main', 'lib', 'draft-class', 'M26Parser'));

  const prospects = parseM26Prospects(buffer, header);
  console.log('Parsed', prospects.length, 'prospects');
  console.log('');

  // Count body types
  const bodyTypeDistribution = {};
  const positionBodyType = {};

  for (const prospect of prospects) {
    const bodyType = prospect.visuals?.bodyType || prospect.bodyType || 'UNKNOWN';
    const position = prospect.position || 'UNK';
    const weight = prospect.weight;
    const height = prospect.height;
    const firstName = prospect.firstName;
    const lastName = prospect.lastName;

    // Track body type distribution
    if (!bodyTypeDistribution[bodyType]) bodyTypeDistribution[bodyType] = [];
    bodyTypeDistribution[bodyType].push({ name: `${firstName} ${lastName}`, position, weight, height });

    // Track by position
    if (!positionBodyType[position]) positionBodyType[position] = {};
    if (!positionBodyType[position][bodyType]) positionBodyType[position][bodyType] = 0;
    positionBodyType[position][bodyType]++;
  }

  console.log('=== Body Type Distribution ===');
  const sortedBodyTypes = Object.keys(bodyTypeDistribution).sort();
  for (const bodyType of sortedBodyTypes) {
    const players = bodyTypeDistribution[bodyType];
    console.log(`${bodyType}: ${players.length} prospects`);
    // Show a few examples
    const samples = players.slice(0, 3);
    for (const s of samples) {
      console.log(`  - ${s.name} (${s.position}) Weight: ${s.weight}, Height: ${s.height}`);
    }
  }

  console.log('');
  console.log('=== Body Type by Position ===');
  const positions = Object.keys(positionBodyType).sort();
  for (const pos of positions) {
    const counts = positionBodyType[pos];
    const distribution = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([bt, count]) => `${bt}:${count}`)
      .join(', ');
    console.log(`${pos}: ${distribution}`);
  }

  // Now analyze what body types make sense per position based on template
  console.log('');
  console.log('=== Recommended Body Type by Position ===');
  for (const pos of positions) {
    const counts = positionBodyType[pos];
    // Find most common body type for this position
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    console.log(`${pos}: ${mostCommon[0]} (${mostCommon[1]} of ${Object.values(counts).reduce((a, b) => a + b, 0)})`);
  }
}

checkDraftBodyTypes().catch(console.error);
