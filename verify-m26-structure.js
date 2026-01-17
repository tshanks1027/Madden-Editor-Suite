/**
 * Verify M26 attribute structure against M25 authoritative source
 *
 * M25 structure from WiiExpertise/madden-draft-class-tools:
 * - Block size: 4322 bytes (0x10E2), Visuals: 4096, Attributes: 226 bytes
 * - Attributes read SEQUENTIALLY after visual data
 *
 * M26 structure (current implementation):
 * - Block size: 4296 bytes (0x10C8), Visuals: 4096, Attributes: 200 bytes
 * - Attributes read by OFFSET from block + 0x1000
 */

const fs = require('fs');
const path = require('path');

// M25 sequential attribute order (from WiiExpertise library lines 79-211)
const M25_STRUCTURE = [
  { name: 'firstName', size: 17, type: 'string' },
  { name: 'lastName', size: 21, type: 'string' },
  { name: 'homeState', size: 1, type: 'byte' },
  { name: 'homeTown', size: 27, type: 'string' },
  { name: 'college', size: 2, type: 'ushort' },  // UShort in M25!
  { name: 'birthDate', size: 2, type: 'ushort' },
  { name: 'age', size: 1, type: 'byte' },
  { name: 'heightInches', size: 1, type: 'byte' },
  { name: 'weight', size: 2, type: 'ushort' },  // UShort! (+ 160)
  { name: 'position', size: 1, type: 'byte' },
  { name: 'archetype', size: 1, type: 'byte' },
  { name: 'jerseyNum', size: 1, type: 'byte' },
  { name: 'draftable', size: 1, type: 'byte' },
  { name: 'draftPick', size: 2, type: 'ushort' },  // 2 BYTES - UShort!
  { name: 'draftRound', size: 1, type: 'byte' },
  { name: 'overall', size: 1, type: 'byte' },
  // Then ratings start sequentially...
  { name: 'acceleration', size: 1, type: 'byte' },
  { name: 'agility', size: 1, type: 'byte' },
  { name: 'awareness', size: 1, type: 'byte' },
  { name: 'ballCarrierVision', size: 1, type: 'byte' },
  { name: 'blockShedding', size: 1, type: 'byte' },
  { name: 'breakSack', size: 1, type: 'byte' },
  { name: 'breakTackle', size: 1, type: 'byte' },
  { name: 'carrying', size: 1, type: 'byte' },
  { name: 'catching', size: 1, type: 'byte' },
  { name: 'catchInTraffic', size: 1, type: 'byte' },
  { name: 'changeOfDirection', size: 1, type: 'byte' },
  { name: 'finesseMoves', size: 1, type: 'byte' },
  { name: 'hitPower', size: 1, type: 'byte' },
  { name: 'impactBlocking', size: 1, type: 'byte' },
  { name: 'injury', size: 1, type: 'byte' },
  { name: 'jukeMove', size: 1, type: 'byte' },
  { name: 'jumping', size: 1, type: 'byte' },
  { name: 'kickAccuracy', size: 1, type: 'byte' },
  { name: 'kickPower', size: 1, type: 'byte' },
  { name: 'kickReturn', size: 1, type: 'byte' },
  { name: 'leadBlock', size: 1, type: 'byte' },
  { name: 'manCoverage', size: 1, type: 'byte' },
  { name: 'passBlockFinesse', size: 1, type: 'byte' },
  { name: 'passBlockPower', size: 1, type: 'byte' },
  { name: 'passBlock', size: 1, type: 'byte' },
  { name: 'personality', size: 1, type: 'byte' },
  { name: 'playAction', size: 1, type: 'byte' },
  { name: 'playRecognition', size: 1, type: 'byte' },
  { name: 'powerMoves', size: 1, type: 'byte' },
  { name: 'pressCoverage', size: 1, type: 'byte' },
  { name: 'pursuit', size: 1, type: 'byte' },
  { name: 'release', size: 1, type: 'byte' },
  { name: 'shortRouteRunning', size: 1, type: 'byte' },
  { name: 'mediumRouteRunning', size: 1, type: 'byte' },
  { name: 'deepRouteRunning', size: 1, type: 'byte' },
  { name: 'runBlockFinesse', size: 1, type: 'byte' },
  { name: 'runBlockPower', size: 1, type: 'byte' },
  { name: 'runBlock', size: 1, type: 'byte' },
  { name: 'runningStyle', size: 1, type: 'byte' },
  { name: 'spectacularCatch', size: 1, type: 'byte' },
  { name: 'speed', size: 1, type: 'byte' },
  { name: 'spinMove', size: 1, type: 'byte' },
  { name: 'stamina', size: 1, type: 'byte' },
  { name: 'stiffArm', size: 1, type: 'byte' },
  { name: 'strength', size: 1, type: 'byte' },
  { name: 'tackle', size: 1, type: 'byte' },
  { name: 'throwAccuracyDeep', size: 1, type: 'byte' },
  { name: 'throwAccuracyMid', size: 1, type: 'byte' },
  { name: 'throwAccuracy', size: 1, type: 'byte' },  // Generic throwAccuracy
  { name: 'throwAccuracyShort', size: 1, type: 'byte' },
  { name: 'throwOnTheRun', size: 1, type: 'byte' },
  { name: 'throwPower', size: 1, type: 'byte' },
  { name: 'throwUnderPressure', size: 1, type: 'byte' },
  { name: 'toughness', size: 1, type: 'byte' },
  { name: 'trucking', size: 1, type: 'byte' },
  { name: 'zoneCoverage', size: 1, type: 'byte' },
  { name: 'morale', size: 1, type: 'byte' },
  // Traits...
  { name: 'traitBigHitter', size: 1, type: 'byte' },
  { name: 'traitPossessionCatch', size: 1, type: 'byte' },
  { name: 'traitClutch', size: 1, type: 'byte' },
  { name: 'traitCoverBall', size: 1, type: 'byte' },
  { name: 'traitDeepBall', size: 1, type: 'byte' },
  { name: 'traitDlBullRush', size: 1, type: 'byte' },
  { name: 'traitDlSpinMove', size: 1, type: 'byte' },
  { name: 'traitDlSwimMove', size: 1, type: 'byte' },
  { name: 'traitDropsOpen', size: 1, type: 'byte' },
  { name: 'traitSidelineCatch', size: 1, type: 'byte' },
  { name: 'traitFightForYards', size: 1, type: 'byte' },
  { name: 'traitUnk1', size: 1, type: 'byte' },
  { name: 'traitHighMotor', size: 1, type: 'byte' },
  { name: 'traitAggressiveCatch', size: 1, type: 'byte' },
  { name: 'traitPenalty', size: 1, type: 'byte' },
  { name: 'traitPlayBall', size: 1, type: 'byte' },
  { name: 'traitPumpFake', size: 1, type: 'byte' },
  { name: 'traitLbStyle', size: 1, type: 'byte' },
  { name: 'traitSensePressure', size: 1, type: 'byte' },
  { name: 'traitUnk2', size: 1, type: 'byte' },
  { name: 'traitStripBall', size: 1, type: 'byte' },
  { name: 'traitTackleLow', size: 1, type: 'byte' },
  { name: 'traitThrowAway', size: 1, type: 'byte' },
  { name: 'traitTightSpiral', size: 1, type: 'byte' },
  { name: 'traitTendency', size: 1, type: 'byte' },
  { name: 'traitRunAfterCatch', size: 1, type: 'byte' },
  { name: 'devTrait', size: 1, type: 'byte' },
  { name: 'traitPredictability', size: 1, type: 'byte' },
  { name: 'unkByte2', size: 1, type: 'byte' },
  { name: 'genericHead', size: 2, type: 'ushort' },
  { name: 'handedness', size: 2, type: 'ushort' },
  { name: 'portraitId', size: 2, type: 'ushort' },
  { name: 'qbStyle', size: 1, type: 'byte' },
  { name: 'qbStance', size: 1, type: 'byte' },
  { name: 'unk3', size: 1, type: 'byte' },
  { name: 'unk4', size: 1, type: 'byte' },
  { name: 'unk5', size: 1, type: 'byte' },
  { name: 'unk6', size: 1, type: 'byte' },
  { name: 'visMoveType', size: 1, type: 'byte' },
  { name: 'unk8', size: 1, type: 'byte' },
  { name: 'commentaryId', size: 2, type: 'ushort' },
  { name: 'assetName', size: 42, type: 'string' }
];

// Current M26 Parser offsets (from M26Parser.js)
const M26_OFFSETS = {
  firstName: { offset: 0x00, size: 17 },
  lastName: { offset: 0x11, size: 21 },
  homeState: { offset: 0x26, size: 1 },
  college: { offset: 0x42, size: 1 },  // Single byte in M26!
  age: { offset: 0x46, size: 1 },
  heightInches: { offset: 0x47, size: 1 },
  weight: { offset: 0x48, size: 1 },  // Single byte in M26! (+160)
  position: { offset: 0x4a, size: 1 },
  archetype: { offset: 0x4b, size: 1 },
  jerseyNum: { offset: 0x4c, size: 1 },
  draftPick: { offset: 0x4e, size: 1 },  // Single byte in M26!
  longSnap: { offset: 0x50, size: 1 },   // BUG: This should be draftRound!
  overall: { offset: 0x51, size: 1 },
  // Ratings (NOT sequential like M25 - scattered offsets)
  acceleration: { offset: 0x52, size: 1 },
  agility: { offset: 0x53, size: 1 },
  awareness: { offset: 0x54, size: 1 },
  ballCarrierVision: { offset: 0x55, size: 1 },
  blockShedding: { offset: 0x56, size: 1 },
  breakSack: { offset: 0x57, size: 1 },
  breakTackle: { offset: 0x58, size: 1 },
  carrying: { offset: 0x59, size: 1 },
  catching: { offset: 0x5A, size: 1 },
  catchInTraffic: { offset: 0x5B, size: 1 },
  changeOfDirection: { offset: 0x5C, size: 1 },
  finesseMoves: { offset: 0x5D, size: 1 },
  hitPower: { offset: 0x5E, size: 1 },
  impactBlocking: { offset: 0x5F, size: 1 },
  injury: { offset: 0x60, size: 1 },
  jukeMove: { offset: 0x61, size: 1 },
  jumping: { offset: 0x62, size: 1 },
  kickAccuracy: { offset: 0x63, size: 1 },
  kickPower: { offset: 0x64, size: 1 },
  kickReturn: { offset: 0x65, size: 1 },
  leadBlock: { offset: 0x66, size: 1 },
  manCoverage: { offset: 0x68, size: 1 },
  passBlockPower: { offset: 0x69, size: 1 },
  passBlockFinesse: { offset: 0x6A, size: 1 },
  passBlock: { offset: 0x6B, size: 1 },
  playAction: { offset: 0x6D, size: 1 },
  playRecognition: { offset: 0x6E, size: 1 },
  powerMoves: { offset: 0x6F, size: 1 },
  pressCoverage: { offset: 0x70, size: 1 },
  pursuit: { offset: 0x71, size: 1 },
  release: { offset: 0x72, size: 1 },
  deepRouteRunning: { offset: 0x73, size: 1 },
  mediumRouteRunning: { offset: 0x74, size: 1 },
  shortRouteRunning: { offset: 0x75, size: 1 },
  runBlockFinesse: { offset: 0x76, size: 1 },
  runBlockPower: { offset: 0x77, size: 1 },
  runBlock: { offset: 0x78, size: 1 },
  spectacularCatch: { offset: 0x7A, size: 1 },
  speed: { offset: 0x7B, size: 1 },
  spinMove: { offset: 0x7C, size: 1 },
  stamina: { offset: 0x7D, size: 1 },
  stiffArm: { offset: 0x7E, size: 1 },
  strength: { offset: 0x7F, size: 1 },
  tackle: { offset: 0x80, size: 1 },
  throwAccuracyDeep: { offset: 0x81, size: 1 },
  throwAccuracyMid: { offset: 0x83, size: 1 },
  throwAccuracyShort: { offset: 0x84, size: 1 },
  throwOnTheRun: { offset: 0x85, size: 1 },
  throwPower: { offset: 0x86, size: 1 },
  throwUnderPressure: { offset: 0x87, size: 1 },
  toughness: { offset: 0x88, size: 1 },
  trucking: { offset: 0x89, size: 1 },
  zoneCoverage: { offset: 0x8A, size: 1 },
  devTrait: { offset: 0x8c, size: 1 },
  PID: { offset: 0x92, size: 2 },
  assetName: { offset: 0x9E, size: 42 }
};

// Calculate M25 sequential offsets
function calculateM25Offsets() {
  let offset = 0;
  const offsets = {};

  for (const field of M25_STRUCTURE) {
    offsets[field.name] = { offset, size: field.size, type: field.type };
    offset += field.size;
  }

  return offsets;
}

// Read actual M26 file to verify
async function analyzeM26File(filePath) {
  const buffer = fs.readFileSync(filePath);

  // Find data start offset (after header)
  const HEADER_MARKER = Buffer.from('FBCHUNKS');
  const headerIndex = buffer.indexOf(HEADER_MARKER);

  if (headerIndex === -1) {
    console.log('Not a valid draft class file');
    return;
  }

  // Parse header to find data start
  const version = buffer.readUInt16LE(headerIndex + 8);
  const headerSize = buffer.readUInt32LE(headerIndex + 0xA);
  const dataStartOffset = headerIndex + headerSize;

  console.log('=== M26 FILE ANALYSIS ===');
  console.log(`File: ${path.basename(filePath)}`);
  console.log(`Header found at: 0x${headerIndex.toString(16)}`);
  console.log(`Version: ${version}`);
  console.log(`Header size: ${headerSize}`);
  console.log(`Data starts at: 0x${dataStartOffset.toString(16)}`);

  const BLOCK_SIZE = 4296; // M26 block size
  const ATTR_OFFSET = 0x1000; // Visual section ends here

  // Analyze first 5 prospects
  console.log('\n=== PROSPECT ANALYSIS ===\n');

  for (let i = 0; i < 5; i++) {
    const blockStart = dataStartOffset + (i * BLOCK_SIZE);
    const attrStart = blockStart + ATTR_OFFSET;

    // Read basic info
    const firstName = buffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
    const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();

    console.log(`=== PROSPECT ${i + 1}: ${firstName} ${lastName} ===`);
    console.log(`Block start: 0x${blockStart.toString(16)}`);
    console.log(`Attribute start: 0x${attrStart.toString(16)}`);

    // Read draft-related fields around 0x4e-0x51
    console.log('\nDRAFT FIELDS (0x4d-0x52):');
    for (let j = 0x4d; j <= 0x52; j++) {
      const val = buffer[attrStart + j];
      console.log(`  0x${j.toString(16).padStart(2, '0')}: ${val.toString().padStart(3)} (0x${val.toString(16).padStart(2, '0')})`);
    }

    // Read specific fields with M26 offsets
    console.log('\nKey M26 fields:');
    console.log(`  position (0x4a): ${buffer[attrStart + 0x4a]}`);
    console.log(`  archetype (0x4b): ${buffer[attrStart + 0x4b]}`);
    console.log(`  jerseyNum (0x4c): ${buffer[attrStart + 0x4c]}`);
    console.log(`  0x4d (unknown): ${buffer[attrStart + 0x4d]}`);
    console.log(`  draftPick (0x4e): ${buffer[attrStart + 0x4e]}`);
    console.log(`  0x4f (padding?): ${buffer[attrStart + 0x4f]}`);
    console.log(`  0x50 (longSnap/round?): ${buffer[attrStart + 0x50]}`);
    console.log(`  overall (0x51): ${buffer[attrStart + 0x51]}`);
    console.log(`  acceleration (0x52): ${buffer[attrStart + 0x52]}`);
    console.log(`  speed (0x7b): ${buffer[attrStart + 0x7b]}`);
    console.log(`  throwPower (0x86): ${buffer[attrStart + 0x86]}`);

    // Calculate what OVR should be for QB
    if (buffer[attrStart + 0x4a] === 0) { // QB
      const throwPower = buffer[attrStart + 0x86];
      const throwAccShort = buffer[attrStart + 0x84];
      const throwAccMid = buffer[attrStart + 0x83];
      const throwAccDeep = buffer[attrStart + 0x81];
      const speed = buffer[attrStart + 0x7b];
      const awareness = buffer[attrStart + 0x54];
      const playAction = buffer[attrStart + 0x6D];
      const breakSack = buffer[attrStart + 0x57];

      console.log('\nQB Rating breakdown:');
      console.log(`  throwPower: ${throwPower}`);
      console.log(`  throwAccShort: ${throwAccShort}`);
      console.log(`  throwAccMid: ${throwAccMid}`);
      console.log(`  throwAccDeep: ${throwAccDeep}`);
      console.log(`  speed: ${speed}`);
      console.log(`  awareness: ${awareness}`);
      console.log(`  playAction: ${playAction}`);
      console.log(`  breakSack: ${breakSack}`);
    }

    console.log('\n');
  }

  // Look for UDFAs (round 63)
  console.log('=== SEARCHING FOR UDFAs (round field = 63) ===');
  let udafaCount = 0;
  for (let i = 0; i < 402 && udafaCount < 5; i++) {
    const blockStart = dataStartOffset + (i * BLOCK_SIZE);
    const attrStart = blockStart + ATTR_OFFSET;

    if (attrStart + 0x51 >= buffer.length) break;

    const roundField = buffer[attrStart + 0x50];
    if (roundField === 63) {
      const firstName = buffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
      const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
      const pick = buffer[attrStart + 0x4e];
      console.log(`Block ${i}: ${firstName} ${lastName} - 0x4e=${pick}, 0x50=${roundField} (UDFA)`);
      udafaCount++;
    }
  }

  console.log('\n=== M25 vs M26 OFFSET COMPARISON ===\n');
  const m25Offsets = calculateM25Offsets();

  // Key comparison
  const keyFields = ['draftable', 'draftPick', 'draftRound', 'overall', 'acceleration', 'throwPower', 'speed'];

  console.log('Field                M25 Offset     M26 Offset     M25 Size    Notes');
  console.log('----                 ----------     ----------     --------    -----');

  for (const field of keyFields) {
    const m25 = m25Offsets[field];
    const m26 = M26_OFFSETS[field];

    const m25Off = m25 ? `0x${m25.offset.toString(16).padStart(2, '0')}` : 'N/A';
    const m26Off = m26 ? `0x${m26.offset.toString(16).padStart(2, '0')}` : 'N/A';
    const m25Size = m25 ? m25.size : 'N/A';
    const m25Type = m25 ? m25.type : '';

    let notes = '';
    if (field === 'draftPick') notes = '2 bytes in M25, 1 byte in M26?';
    if (field === 'draftRound') notes = 'Missing in M26Parser!';
    if (field === 'draftable') notes = 'Missing in M26Parser!';

    console.log(`${field.padEnd(20)} ${m25Off.padEnd(14)} ${m26Off.padEnd(14)} ${String(m25Size).padEnd(11)} ${m25Type} ${notes}`);
  }
}

// Run analysis
const testFile = process.argv[2] || 'C:/Users/tshan/OneDrive/Documents/Madden Files/Madden 26/CAREERDRAFT-2026NOV22';

if (fs.existsSync(testFile)) {
  analyzeM26File(testFile);
} else {
  console.log(`File not found: ${testFile}`);
  console.log('Usage: node verify-m26-structure.js <path-to-m26-draft-class>');
}
