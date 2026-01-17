/**
 * COMPREHENSIVE COMPARISON: Working vs Edited draft class
 *
 * Compare TWO draft classes byte-by-byte to find what ACTUALLY differs
 * and which bytes the game might read from that we're not writing to.
 */

const fs = require('fs');

// Working file (presumably works in game)
const WORKING_PATH = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';

// Edited file (shows wrong ratings in game)
const EDITED_PATH = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';

// Template file (original)
const TEMPLATE_PATH = 'C:\\Users\\tshan\\Documents\\Dev\\madden-editor-suite\\data\\templates\\CAREERDRAFT-2026Template';

const working = fs.readFileSync(WORKING_PATH);
const edited = fs.readFileSync(EDITED_PATH);
const template = fs.readFileSync(TEMPLATE_PATH);

console.log('=== FILE SIZES ===');
console.log(`Working: ${working.length} bytes`);
console.log(`Edited: ${edited.length} bytes`);
console.log(`Template: ${template.length} bytes`);

// M26 structure
const HEADER = 0x46;
const BLOCK_SIZE = 4322;
const ATTR_OFFSET = 0x1000;

// Known attribute offsets from M26Parser.js
const ATTR_MAP = {
  'firstName': [0x00, 17, 'string'],
  'lastName': [0x11, 21, 'string'],
  'homeState': [0x26, 1, 'byte'],
  'college': [0x42, 1, 'byte'],
  'age': [0x46, 1, 'byte'],
  'heightInches': [0x47, 1, 'byte'],
  'weight+160': [0x48, 1, 'byte'],
  'position': [0x4a, 1, 'byte'],
  'archetype': [0x4b, 1, 'byte'],
  'jerseyNum': [0x4c, 1, 'byte'],
  'draftPick': [0x4e, 1, 'byte'],
  'acceleration': [0x52, 1, 'byte'],
  'agility': [0x53, 1, 'byte'],
  'awareness': [0x54, 1, 'byte'],
  'ballCarrierVision': [0x55, 1, 'byte'],
  'blockShedding': [0x56, 1, 'byte'],
  'breakSack': [0x57, 1, 'byte'],
  'breakTackle': [0x58, 1, 'byte'],
  'carrying': [0x59, 1, 'byte'],
  'catching': [0x5A, 1, 'byte'],
  'catchInTraffic': [0x5B, 1, 'byte'],
  'changeOfDirection': [0x5C, 1, 'byte'],
  'finesseMoves': [0x5D, 1, 'byte'],
  'hitPower': [0x5E, 1, 'byte'],
  'impactBlocking': [0x5F, 1, 'byte'],
  'injury': [0x60, 1, 'byte'],
  'jukeMove': [0x61, 1, 'byte'],
  'jumping': [0x62, 1, 'byte'],
  'kickAccuracy': [0x63, 1, 'byte'],
  'kickPower': [0x64, 1, 'byte'],
  'kickReturn': [0x65, 1, 'byte'],
  'leadBlock': [0x66, 1, 'byte'],
  'manCoverage': [0x68, 1, 'byte'],
  'passBlockPower': [0x69, 1, 'byte'],
  'passBlockFinesse': [0x6A, 1, 'byte'],
  'passBlock': [0x6B, 1, 'byte'],
  'playAction': [0x6D, 1, 'byte'],
  'playRecognition': [0x6E, 1, 'byte'],
  'powerMoves': [0x6F, 1, 'byte'],
  'pressCoverage': [0x70, 1, 'byte'],
  'pursuit': [0x71, 1, 'byte'],
  'release': [0x72, 1, 'byte'],
  'deepRouteRunning': [0x73, 1, 'byte'],
  'mediumRouteRunning': [0x74, 1, 'byte'],
  'shortRouteRunning': [0x75, 1, 'byte'],
  'runBlockFinesse': [0x76, 1, 'byte'],
  'runBlockPower': [0x77, 1, 'byte'],
  'runBlock': [0x78, 1, 'byte'],
  'spectacularCatch': [0x7A, 1, 'byte'],
  'speed': [0x7B, 1, 'byte'],
  'spinMove': [0x7C, 1, 'byte'],
  'stamina': [0x7D, 1, 'byte'],
  'stiffArm': [0x7E, 1, 'byte'],
  'strength': [0x7F, 1, 'byte'],
  'tackle': [0x80, 1, 'byte'],
  'throwAccuracyDeep': [0x81, 1, 'byte'],
  // UNKNOWN byte at 0x82
  'throwAccuracyMid': [0x83, 1, 'byte'],
  'throwAccuracyShort': [0x84, 1, 'byte'],
  'throwOnTheRun': [0x85, 1, 'byte'],
  'throwPower': [0x86, 1, 'byte'],
  'throwUnderPressure': [0x87, 1, 'byte'],
  'toughness': [0x88, 1, 'byte'],
  'trucking': [0x89, 1, 'byte'],
  'zoneCoverage': [0x8A, 1, 'byte'],
  'longSnap': [0x8B, 1, 'byte'],
  'devTrait': [0x8c, 1, 'byte'],
  'PID_low': [0x92, 2, 'uint16'],
};

function getAttrStart(prospectIndex) {
  return HEADER + (prospectIndex * BLOCK_SIZE) + ATTR_OFFSET;
}

function readString(buf, offset, len) {
  return buf.toString('ascii', offset, offset + len).replace(/\0/g, '').trim();
}

function readByte(buf, offset) {
  return buf[offset];
}

// Analyze prospect 0 (first one) from each file
console.log('\n=== PROSPECT #1 COMPARISON (ALL THREE FILES) ===\n');

const attrStart = getAttrStart(0);
console.log(`Attribute section starts at: 0x${attrStart.toString(16)}`);

// Get names
const workingName = readString(working, attrStart, 17) + ' ' + readString(working, attrStart + 0x11, 21);
const editedName = readString(edited, attrStart, 17) + ' ' + readString(edited, attrStart + 0x11, 21);
const templateName = readString(template, attrStart, 17) + ' ' + readString(template, attrStart + 0x11, 21);

console.log(`WORKING file - Prospect #1: "${workingName}"`);
console.log(`EDITED file - Prospect #1: "${editedName}"`);
console.log(`TEMPLATE file - Prospect #1: "${templateName}"`);

console.log('\n=== ATTRIBUTE COMPARISON (WORKING vs EDITED) ===\n');
console.log('Attribute'.padEnd(25) + 'Offset'.padEnd(8) + 'WORKING'.padEnd(10) + 'EDITED'.padEnd(10) + 'TEMPLATE'.padEnd(10) + 'Status');
console.log('-'.repeat(80));

const differences = [];
for (const [name, [offset, len, type]] of Object.entries(ATTR_MAP)) {
  const workVal = type === 'string' ? readString(working, attrStart + offset, len) :
                  type === 'uint16' ? working.readUInt16LE(attrStart + offset) :
                  readByte(working, attrStart + offset);
  const editVal = type === 'string' ? readString(edited, attrStart + offset, len) :
                  type === 'uint16' ? edited.readUInt16LE(attrStart + offset) :
                  readByte(edited, attrStart + offset);
  const tempVal = type === 'string' ? readString(template, attrStart + offset, len) :
                  type === 'uint16' ? template.readUInt16LE(attrStart + offset) :
                  readByte(template, attrStart + offset);

  let status = '';
  if (workVal !== editVal) {
    status = '⚠️ DIFFERENT';
    differences.push({ name, offset, workVal, editVal, tempVal });
  } else if (editVal !== tempVal) {
    status = '✓ Both changed from template';
  } else {
    status = '= Same';
  }

  console.log(name.padEnd(25) + `0x${offset.toString(16).padStart(2,'0')}`.padEnd(8) + String(workVal).padEnd(10) + String(editVal).padEnd(10) + String(tempVal).padEnd(10) + status);
}

console.log('\n=== BYTES THAT DIFFER BETWEEN WORKING AND EDITED ===\n');
if (differences.length === 0) {
  console.log('No differences found in known attributes!');
} else {
  for (const d of differences) {
    console.log(`${d.name} (0x${d.offset.toString(16)}): WORKING=${d.workVal}, EDITED=${d.editVal}, TEMPLATE=${d.tempVal}`);
  }
}

// Now scan the ENTIRE attribute section for ANY byte that differs
console.log('\n=== FULL BYTE SCAN (WORKING vs EDITED) - First 256 bytes ===\n');
const unknownDiffs = [];
for (let i = 0; i < 256; i++) {
  const wByte = working[attrStart + i];
  const eByte = edited[attrStart + i];
  if (wByte !== eByte) {
    // Check if this offset is in our known map
    const knownAttr = Object.entries(ATTR_MAP).find(([n, [off, len]]) => i >= off && i < off + len);
    const label = knownAttr ? knownAttr[0] : '???UNKNOWN???';
    unknownDiffs.push({ offset: i, working: wByte, edited: eByte, label });
  }
}

if (unknownDiffs.length === 0) {
  console.log('No byte differences found in first 256 bytes!');
} else {
  console.log(`Found ${unknownDiffs.length} byte differences:`);
  for (const d of unknownDiffs) {
    console.log(`  0x${d.offset.toString(16).padStart(2,'0')}: WORKING=${d.working.toString().padStart(3)} vs EDITED=${d.edited.toString().padStart(3)} (${d.label})`);
  }
}

// Check for UNKNOWN bytes that might be important
console.log('\n=== CHECKING UNKNOWN BYTE OFFSETS ===\n');
const knownOffsets = new Set(Object.values(ATTR_MAP).map(([off]) => off));
const unknownBytes = [];
for (let i = 0x49; i < 0x9E; i++) {
  if (!knownOffsets.has(i)) {
    const wByte = working[attrStart + i];
    const eByte = edited[attrStart + i];
    const tByte = template[attrStart + i];
    if (wByte !== eByte || wByte !== tByte || wByte > 0) {
      unknownBytes.push({ offset: i, working: wByte, edited: eByte, template: tByte });
    }
  }
}

console.log('Unknown bytes with non-zero or differing values:');
for (const b of unknownBytes) {
  const status = b.working !== b.edited ? '⚠️ DIFFERS' : '=';
  console.log(`  0x${b.offset.toString(16)}: WORKING=${b.working.toString().padStart(3)}, EDITED=${b.edited.toString().padStart(3)}, TEMPLATE=${b.template.toString().padStart(3)} ${status}`);
}

// Check the visual JSON section
console.log('\n=== VISUAL JSON SECTION ===\n');
const blockStart = HEADER;
const jsonStartW = working.indexOf(Buffer.from('{"bodyType"'), blockStart);
const jsonStartE = edited.indexOf(Buffer.from('{"bodyType"'), blockStart);

if (jsonStartW !== -1 && jsonStartW < blockStart + ATTR_OFFSET) {
  // Find end
  let braceCount = 0, jsonEndW = -1;
  for (let i = jsonStartW; i < blockStart + ATTR_OFFSET; i++) {
    if (working[i] === 0x7B) braceCount++;
    if (working[i] === 0x7D) { braceCount--; if (braceCount === 0) { jsonEndW = i + 1; break; } }
  }
  if (jsonEndW !== -1) {
    console.log('WORKING visual JSON:');
    console.log(working.toString('utf8', jsonStartW, jsonEndW));
  }
}

if (jsonStartE !== -1 && jsonStartE < blockStart + ATTR_OFFSET) {
  let braceCount = 0, jsonEndE = -1;
  for (let i = jsonStartE; i < blockStart + ATTR_OFFSET; i++) {
    if (edited[i] === 0x7B) braceCount++;
    if (edited[i] === 0x7D) { braceCount--; if (braceCount === 0) { jsonEndE = i + 1; break; } }
  }
  if (jsonEndE !== -1) {
    console.log('\nEDITED visual JSON:');
    console.log(edited.toString('utf8', jsonStartE, jsonEndE));
  }
}

// CRITICAL: Check if there's data BEFORE the attribute section that differs
console.log('\n=== PRE-ATTRIBUTE SECTION (0x00 to 0x1000 in block) ===\n');
const blockStartOffset = HEADER;
let preAttrDiffs = 0;
for (let i = 0; i < ATTR_OFFSET; i++) {
  if (working[blockStartOffset + i] !== edited[blockStartOffset + i]) {
    preAttrDiffs++;
    if (preAttrDiffs <= 20) {
      console.log(`  Block offset 0x${i.toString(16)}: WORKING=${working[blockStartOffset + i]} vs EDITED=${edited[blockStartOffset + i]}`);
    }
  }
}
console.log(`Total differences in pre-attribute section: ${preAttrDiffs}`);
