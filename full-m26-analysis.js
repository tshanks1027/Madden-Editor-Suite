/**
 * COMPLETE M26 Draft Class File Analysis
 *
 * This script analyzes every byte of an M26 draft class file
 * and compares it against the M26Parser/M26Writer offsets
 * to identify what's missing or wrong.
 */
const fs = require('fs');

// Current M26Parser offsets (from M26Parser.js)
const M26_PARSER_OFFSETS = {
  // String fields
  firstName:          { offset: 0x00, size: 17, type: 'string' },
  lastName:           { offset: 0x11, size: 21, type: 'string' },
  // 0x26 - homeState (1 byte)
  // 0x27-0x41 - homeTown (27 bytes) - contains "PLACEHOLDER"
  homeState:          { offset: 0x26, size: 1, type: 'byte' },
  college:            { offset: 0x42, size: 1, type: 'byte' },  // Parser reads single byte
  // 0x43 - padding?
  // 0x44-0x45 - birthDate?
  age:                { offset: 0x46, size: 1, type: 'byte' },
  heightInches:       { offset: 0x47, size: 1, type: 'byte' },
  weight:             { offset: 0x48, size: 1, type: 'byte' },  // Parser: +160
  // 0x49 - unknown
  position:           { offset: 0x4a, size: 1, type: 'byte' },
  archetype:          { offset: 0x4b, size: 1, type: 'byte' },
  jerseyNum:          { offset: 0x4c, size: 1, type: 'byte' },
  // 0x4d - draftable? Parser doesn't read this
  draftPick:          { offset: 0x4e, size: 1, type: 'byte' },  // Parser reads single byte
  // 0x4f - padding?
  longSnap:           { offset: 0x50, size: 1, type: 'byte' },  // BUG? Session log says this is draftRound
  overall:            { offset: 0x51, size: 1, type: 'byte' },

  // Ratings (scattered offsets in M26)
  acceleration:       { offset: 0x52, size: 1, type: 'byte' },
  agility:            { offset: 0x53, size: 1, type: 'byte' },
  awareness:          { offset: 0x54, size: 1, type: 'byte' },
  ballCarrierVision:  { offset: 0x55, size: 1, type: 'byte' },
  blockShedding:      { offset: 0x56, size: 1, type: 'byte' },
  breakSack:          { offset: 0x57, size: 1, type: 'byte' },
  breakTackle:        { offset: 0x58, size: 1, type: 'byte' },
  carrying:           { offset: 0x59, size: 1, type: 'byte' },
  catching:           { offset: 0x5A, size: 1, type: 'byte' },
  catchInTraffic:     { offset: 0x5B, size: 1, type: 'byte' },
  changeOfDirection:  { offset: 0x5C, size: 1, type: 'byte' },
  finesseMoves:       { offset: 0x5D, size: 1, type: 'byte' },
  hitPower:           { offset: 0x5E, size: 1, type: 'byte' },
  impactBlocking:     { offset: 0x5F, size: 1, type: 'byte' },
  injury:             { offset: 0x60, size: 1, type: 'byte' },
  jukeMove:           { offset: 0x61, size: 1, type: 'byte' },
  jumping:            { offset: 0x62, size: 1, type: 'byte' },
  kickAccuracy:       { offset: 0x63, size: 1, type: 'byte' },
  kickPower:          { offset: 0x64, size: 1, type: 'byte' },
  kickReturn:         { offset: 0x65, size: 1, type: 'byte' },
  leadBlock:          { offset: 0x66, size: 1, type: 'byte' },
  // 0x67 - unmapped
  manCoverage:        { offset: 0x68, size: 1, type: 'byte' },
  passBlockPower:     { offset: 0x69, size: 1, type: 'byte' },
  passBlockFinesse:   { offset: 0x6A, size: 1, type: 'byte' },
  passBlock:          { offset: 0x6B, size: 1, type: 'byte' },
  // 0x6C - unmapped
  playAction:         { offset: 0x6D, size: 1, type: 'byte' },
  playRecognition:    { offset: 0x6E, size: 1, type: 'byte' },
  powerMoves:         { offset: 0x6F, size: 1, type: 'byte' },
  pressCoverage:      { offset: 0x70, size: 1, type: 'byte' },
  pursuit:            { offset: 0x71, size: 1, type: 'byte' },
  release:            { offset: 0x72, size: 1, type: 'byte' },
  deepRouteRunning:   { offset: 0x73, size: 1, type: 'byte' },
  mediumRouteRunning: { offset: 0x74, size: 1, type: 'byte' },
  shortRouteRunning:  { offset: 0x75, size: 1, type: 'byte' },
  runBlockFinesse:    { offset: 0x76, size: 1, type: 'byte' },
  runBlockPower:      { offset: 0x77, size: 1, type: 'byte' },
  runBlock:           { offset: 0x78, size: 1, type: 'byte' },
  // 0x79 - unmapped
  spectacularCatch:   { offset: 0x7A, size: 1, type: 'byte' },
  speed:              { offset: 0x7B, size: 1, type: 'byte' },
  spinMove:           { offset: 0x7C, size: 1, type: 'byte' },
  stamina:            { offset: 0x7D, size: 1, type: 'byte' },
  stiffArm:           { offset: 0x7E, size: 1, type: 'byte' },
  strength:           { offset: 0x7F, size: 1, type: 'byte' },
  tackle:             { offset: 0x80, size: 1, type: 'byte' },
  throwAccuracyDeep:  { offset: 0x81, size: 1, type: 'byte' },
  // 0x82 - unmapped
  throwAccuracyMid:   { offset: 0x83, size: 1, type: 'byte' },
  throwAccuracyShort: { offset: 0x84, size: 1, type: 'byte' },
  throwOnTheRun:      { offset: 0x85, size: 1, type: 'byte' },
  throwPower:         { offset: 0x86, size: 1, type: 'byte' },
  throwUnderPressure: { offset: 0x87, size: 1, type: 'byte' },
  toughness:          { offset: 0x88, size: 1, type: 'byte' },
  trucking:           { offset: 0x89, size: 1, type: 'byte' },
  zoneCoverage:       { offset: 0x8A, size: 1, type: 'byte' },
  // 0x8B - unmapped (longSnap in Writer?)
  devTrait:           { offset: 0x8c, size: 1, type: 'byte' },
  // 0x8D-0x91 - unmapped
  PID:                { offset: 0x92, size: 2, type: 'uint16' },
  // 0x94-0x9D - unmapped
  assetName:          { offset: 0x9E, size: 42, type: 'string' }
};

// M25 sequential structure for reference
const M25_OFFSETS = {
  firstName: 0,      // 17 bytes
  lastName: 17,      // 21 bytes
  homeState: 38,     // 1 byte
  homeTown: 39,      // 27 bytes
  college: 66,       // 2 bytes (UShort!)
  birthDate: 68,     // 2 bytes
  age: 70,           // 1 byte
  heightInches: 71,  // 1 byte
  weight: 72,        // 2 bytes (UShort!)
  position: 74,      // 1 byte
  archetype: 75,     // 1 byte
  jerseyNum: 76,     // 1 byte
  draftable: 77,     // 1 byte
  draftPick: 78,     // 2 bytes (UShort!)
  draftRound: 80,    // 1 byte
  overall: 81,       // 1 byte
  // Then ratings start at 82 sequentially...
};

function analyzeFile(filePath) {
  const buffer = fs.readFileSync(filePath);

  console.log('='.repeat(80));
  console.log('COMPLETE M26 DRAFT CLASS ANALYSIS');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}`);
  console.log(`Size: ${buffer.length} bytes`);
  console.log('');

  // Parse header
  const headerMarker = buffer.toString('ascii', 0, 8);
  const version = buffer.readUInt16LE(8);
  const headerSize = buffer.readUInt32LE(0xA);
  const dataSize = buffer.readUInt32LE(0xE);
  const totalSize = buffer.readUInt32LE(0x12);
  const gameYear = buffer.readUInt16LE(0x16);
  const fileName = buffer.toString('ascii', 0x22, 0x22 + 21).replace(/\0/g, '');
  const numProspects = buffer.readUInt32LE(0x42);

  console.log('=== HEADER ===');
  console.log(`Header marker: "${headerMarker}"`);
  console.log(`Version: ${version}`);
  console.log(`Header size: ${headerSize} (0x${headerSize.toString(16)})`);
  console.log(`Data size: ${dataSize}`);
  console.log(`Total size: ${totalSize}`);
  console.log(`Game year: ${gameYear}`);
  console.log(`File name: "${fileName}"`);
  console.log(`Num prospects from header: ${numProspects}`);
  console.log('');

  const BLOCK_SIZE = 4296;
  const VISUAL_SIZE = 4096;
  const ATTR_SIZE = 200;
  const DATA_START = headerSize;

  const maxBlocks = Math.floor((buffer.length - DATA_START) / BLOCK_SIZE);
  console.log(`Calculated max blocks: ${maxBlocks}`);
  console.log('');

  // Analyze first prospect in detail
  console.log('='.repeat(80));
  console.log('DETAILED ANALYSIS OF FIRST PROSPECT (Block 0)');
  console.log('='.repeat(80));
  console.log('');

  const block0Start = DATA_START;
  const attr0Start = block0Start + VISUAL_SIZE;

  console.log(`Block 0 starts at: 0x${block0Start.toString(16)}`);
  console.log(`Attribute data starts at: 0x${attr0Start.toString(16)}`);
  console.log('');

  // Read all 200 bytes and identify them
  console.log('=== ATTRIBUTE DATA BYTE-BY-BYTE (200 bytes) ===\n');

  const mapped = new Set();
  for (const [name, info] of Object.entries(M26_PARSER_OFFSETS)) {
    for (let i = 0; i < info.size; i++) {
      mapped.add(info.offset + i);
    }
  }

  // Group bytes for display
  for (let baseOffset = 0; baseOffset < ATTR_SIZE; baseOffset += 16) {
    let hexLine = '';
    let descLine = '';

    for (let i = 0; i < 16 && baseOffset + i < ATTR_SIZE; i++) {
      const offset = baseOffset + i;
      const val = buffer[attr0Start + offset];
      hexLine += val.toString(16).padStart(2, '0') + ' ';

      // Find what this offset maps to
      let fieldName = null;
      for (const [name, info] of Object.entries(M26_PARSER_OFFSETS)) {
        if (offset >= info.offset && offset < info.offset + info.size) {
          fieldName = name;
          break;
        }
      }

      if (!fieldName) {
        descLine += '?? ';
      } else {
        descLine += fieldName.slice(0, 2) + ' ';
      }
    }

    console.log(`0x${baseOffset.toString(16).padStart(2, '0')}: ${hexLine}`);
    console.log(`     ${descLine}`);
    console.log('');
  }

  // Read using M26Parser offsets
  console.log('=== VALUES READ USING M26PARSER OFFSETS ===\n');

  const firstName = buffer.toString('ascii', attr0Start, attr0Start + 17).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attr0Start + 0x11, attr0Start + 0x26).replace(/\0/g, '').trim();
  const homeState = buffer[attr0Start + 0x26];
  const homeTown = buffer.toString('ascii', attr0Start + 0x27, attr0Start + 0x42).replace(/\0/g, '').trim();

  console.log(`firstName (0x00, 17b): "${firstName}"`);
  console.log(`lastName (0x11, 21b): "${lastName}"`);
  console.log(`homeState (0x26): ${homeState}`);
  console.log(`homeTown (0x27-0x41): "${homeTown}"`);
  console.log('');

  // Metadata fields
  console.log('--- Metadata Fields ---');
  console.log(`college (0x42, 1b): ${buffer[attr0Start + 0x42]}`);
  console.log(`0x43: ${buffer[attr0Start + 0x43]} (unmapped)`);
  console.log(`0x44-0x45 (uint16): ${buffer.readUInt16LE(attr0Start + 0x44)} (possibly birthDate?)`);
  console.log(`age (0x46): ${buffer[attr0Start + 0x46]}`);
  console.log(`heightInches (0x47): ${buffer[attr0Start + 0x47]}`);
  console.log(`weight (0x48): ${buffer[attr0Start + 0x48]} (+160 = ${buffer[attr0Start + 0x48] + 160})`);
  console.log(`0x49: ${buffer[attr0Start + 0x49]} (unmapped)`);
  console.log(`position (0x4a): ${buffer[attr0Start + 0x4a]}`);
  console.log(`archetype (0x4b): ${buffer[attr0Start + 0x4b]}`);
  console.log(`jerseyNum (0x4c): ${buffer[attr0Start + 0x4c]}`);
  console.log(`0x4d: ${buffer[attr0Start + 0x4d]} (draftable? unmapped in parser)`);
  console.log(`draftPick (0x4e): ${buffer[attr0Start + 0x4e]}`);
  console.log(`0x4f: ${buffer[attr0Start + 0x4f]} (padding?)`);
  console.log(`longSnap/draftRound (0x50): ${buffer[attr0Start + 0x50]}`);
  console.log(`overall (0x51): ${buffer[attr0Start + 0x51]}`);
  console.log('');

  // Key ratings
  console.log('--- Key Ratings ---');
  console.log(`speed (0x7B): ${buffer[attr0Start + 0x7B]}`);
  console.log(`acceleration (0x52): ${buffer[attr0Start + 0x52]}`);
  console.log(`agility (0x53): ${buffer[attr0Start + 0x53]}`);
  console.log(`awareness (0x54): ${buffer[attr0Start + 0x54]}`);
  console.log(`throwPower (0x86): ${buffer[attr0Start + 0x86]}`);
  console.log(`throwAccuracyShort (0x84): ${buffer[attr0Start + 0x84]}`);
  console.log(`throwAccuracyMid (0x83): ${buffer[attr0Start + 0x83]}`);
  console.log(`throwAccuracyDeep (0x81): ${buffer[attr0Start + 0x81]}`);
  console.log(`strength (0x7F): ${buffer[attr0Start + 0x7F]}`);
  console.log('');

  // Unmapped bytes
  console.log('=== UNMAPPED BYTES (not read by M26Parser) ===\n');
  const unmappedOffsets = [];
  for (let i = 0; i < ATTR_SIZE; i++) {
    if (!mapped.has(i)) {
      unmappedOffsets.push(i);
    }
  }
  console.log(`Total unmapped bytes: ${unmappedOffsets.length}`);
  console.log('Unmapped offsets with non-zero values:');
  for (const offset of unmappedOffsets) {
    const val = buffer[attr0Start + offset];
    if (val !== 0) {
      console.log(`  0x${offset.toString(16).padStart(2, '0')}: ${val}`);
    }
  }
  console.log('');

  // Visual JSON analysis
  console.log('='.repeat(80));
  console.log('VISUAL JSON ANALYSIS');
  console.log('='.repeat(80));
  console.log('');

  // Find JSON in visual section
  let jsonStart = -1;
  for (let i = block0Start; i < block0Start + VISUAL_SIZE; i++) {
    if (buffer[i] === 0x7B) { // '{'
      jsonStart = i;
      break;
    }
  }

  if (jsonStart !== -1) {
    let braceCount = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < block0Start + VISUAL_SIZE; i++) {
      if (buffer[i] === 0x7B) braceCount++;
      if (buffer[i] === 0x7D) {
        braceCount--;
        if (braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }

    if (jsonEnd !== -1) {
      const jsonStr = buffer.toString('utf8', jsonStart, jsonEnd);
      console.log(`JSON starts at: 0x${jsonStart.toString(16)}`);
      console.log(`JSON ends at: 0x${jsonEnd.toString(16)}`);
      console.log(`JSON length: ${jsonEnd - jsonStart} bytes`);
      console.log('');
      try {
        const visual = JSON.parse(jsonStr);
        console.log('Parsed Visual JSON:');
        console.log(JSON.stringify(visual, null, 2));
        console.log('');

        console.log('Key fields for M26Parser/Writer:');
        console.log(`  genericHeadName: ${visual.genericHeadName || 'NOT PRESENT'}`);
        console.log(`  assetName: ${visual.assetName || 'NOT PRESENT'}`);
        console.log(`  bodyType: ${visual.bodyType || 'NOT PRESENT (defaults to Standard)'}`);
        console.log(`  skinTone: ${visual.skinTone}`);
      } catch (e) {
        console.log('Failed to parse JSON:', e.message);
      }
    }
  } else {
    console.log('No JSON found in visual section!');
  }

  // Compare first 5 prospects
  console.log('');
  console.log('='.repeat(80));
  console.log('COMPARING FIRST 10 PROSPECTS');
  console.log('='.repeat(80));
  console.log('');

  console.log('| Block | Name                    | Pos | Speed | OVR  | 0x4d | 0x4e | 0x50 |');
  console.log('|-------|-------------------------|-----|-------|------|------|------|------|');

  for (let i = 0; i < 10; i++) {
    const attrStart = DATA_START + (i * BLOCK_SIZE) + VISUAL_SIZE;
    if (attrStart + ATTR_SIZE > buffer.length) break;

    const fn = buffer.toString('ascii', attrStart, attrStart + 17).replace(/\0/g, '').trim();
    const ln = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
    const fullName = `${fn} ${ln}`.slice(0, 23).padEnd(23);
    const pos = buffer[attrStart + 0x4a];
    const spd = buffer[attrStart + 0x7B];
    const ovr = buffer[attrStart + 0x51];
    const x4d = buffer[attrStart + 0x4d];
    const x4e = buffer[attrStart + 0x4e];
    const x50 = buffer[attrStart + 0x50];

    console.log(`| ${i.toString().padStart(5)} | ${fullName} | ${pos.toString().padStart(3)} | ${spd.toString().padStart(5)} | ${ovr.toString().padStart(4)} | ${x4d.toString().padStart(4)} | ${x4e.toString().padStart(4)} | ${x50.toString().padStart(4)} |`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

const testFile = process.argv[2] || 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
if (fs.existsSync(testFile)) {
  analyzeFile(testFile);
} else {
  console.log(`File not found: ${testFile}`);
}
