/**
 * Trace exactly what gets written to 0x6C
 * We'll create a mock write and see if 0x6C changes
 */
const fs = require('fs');

// Read template
const templateFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const templateBuf = fs.readFileSync(templateFile);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

// Block 0 attribute start
const attr0 = DATA_START + ATTR_OFFSET;

console.log('=== BEFORE ANY WRITE ===');
console.log(`0x6C in template: ${templateBuf[attr0 + 0x6C]}`);

// Make a copy like M26Writer does
const modifiedBuffer = Buffer.from(templateBuf);

console.log(`0x6C in copied buffer: ${modifiedBuffer[attr0 + 0x6C]}`);

// Now let's simulate what M26Writer.writeM26AttributeData does
// I'll write ALL the fields the writer writes and see if 0x6C changes

const mockProspect = {
  firstName: 'Joe',
  lastName: 'Burrow',
  homeState: 10, // Ohio
  college: 50,  // LSU
  age: 23,
  heightInches: 76, // 6'4"
  weight: 221,
  position: 0, // QB
  archetype: 2, // Improviser
  jerseyNum: 9,
  draftable: 1,
  draftPick: 1,
  draftRound: 1,
  devTrait: 3, // X-Factor
  PID: 12345,
  overall: 83,

  // Physical
  speed: 83,
  acceleration: 86,
  agility: 82,
  strength: 68,
  awareness: 77,
  jumping: 74,
  stamina: 88,
  changeOfDirection: 80,
  toughness: 96,
  injury: 95,

  // Ball carrier
  carrying: 67,
  ballCarrierVision: 81,
  breakTackle: 66,
  trucking: 57,
  stiffArm: 49,
  spinMove: 68,
  jukeMove: 69,

  // Receiving
  catching: 40,
  catchInTraffic: 19,
  spectacularCatch: 26,
  shortRouteRunning: 28,
  mediumRouteRunning: 19,
  deepRouteRunning: 15,
  release: 18,

  // Throwing
  throwPower: 86,
  throwAccuracyShort: 88,
  throwAccuracyMid: 84,
  throwAccuracyDeep: 85,
  throwOnTheRun: 86,
  throwUnderPressure: 84,
  playAction: 83,
  breakSack: 38,

  // Blocking
  passBlock: 15,
  passBlockPower: 25,
  passBlockFinesse: 15,
  runBlock: 15,
  runBlockPower: 30,
  runBlockFinesse: 20,
  leadBlock: 20,
  impactBlocking: 29,

  // Defense
  tackle: 36,
  hitPower: 29,
  powerMoves: 10,
  finesseMoves: 10,
  blockShedding: 30,
  pursuit: 38,
  playRecognition: 27,
  manCoverage: 29,
  zoneCoverage: 33,
  pressCoverage: 32,

  // Special teams
  kickPower: 21,
  kickAccuracy: 17,
  kickReturn: 31,
  longSnap: 50,
};

const offset = attr0;

// Simulate ALL writes from M26Writer
function simulateWrite(buffer, offset, prospect) {
  if (prospect.firstName) {
    const firstName = prospect.firstName.slice(0, 0x11).padEnd(0x11, '\0');
    buffer.write(firstName, offset, 0x11, 'ascii');
  }
  if (prospect.lastName) {
    const lastName = prospect.lastName.slice(0, 0x15).padEnd(0x15, '\0');
    buffer.write(lastName, offset + 0x11, 0x15, 'ascii');
  }

  if (prospect.homeState !== undefined) buffer[offset + 0x26] = prospect.homeState;
  if (prospect.college !== undefined) buffer[offset + 0x42] = prospect.college;
  if (prospect.age !== undefined) buffer[offset + 0x46] = prospect.age;
  if (prospect.heightInches !== undefined) buffer[offset + 0x47] = prospect.heightInches;
  if (prospect.weight !== undefined) buffer[offset + 0x48] = Math.max(0, prospect.weight - 160);
  if (prospect.position !== undefined) buffer[offset + 0x4a] = prospect.position;
  if (prospect.archetype !== undefined) buffer[offset + 0x4b] = prospect.archetype;
  if (prospect.jerseyNum !== undefined) buffer[offset + 0x4c] = prospect.jerseyNum;
  if (prospect.draftable !== undefined) buffer[offset + 0x4d] = prospect.draftable;
  if (prospect.draftPick !== undefined) buffer[offset + 0x4e] = prospect.draftPick;
  if (prospect.draftRound !== undefined) buffer[offset + 0x50] = prospect.draftRound;
  if (prospect.devTrait !== undefined) buffer[offset + 0x8c] = prospect.devTrait;
  if (prospect.PID !== undefined) buffer.writeUInt16LE(prospect.PID, offset + 0x92);
  if (prospect.overall !== undefined) buffer[offset + 0x51] = prospect.overall;

  // All ratings
  if (prospect.speed !== undefined) buffer[offset + 0x7B] = prospect.speed;
  if (prospect.acceleration !== undefined) buffer[offset + 0x52] = prospect.acceleration;
  if (prospect.agility !== undefined) buffer[offset + 0x53] = prospect.agility;
  if (prospect.strength !== undefined) buffer[offset + 0x7F] = prospect.strength;
  if (prospect.awareness !== undefined) buffer[offset + 0x54] = prospect.awareness;
  if (prospect.jumping !== undefined) buffer[offset + 0x62] = prospect.jumping;
  if (prospect.stamina !== undefined) buffer[offset + 0x7D] = prospect.stamina;
  if (prospect.changeOfDirection !== undefined) buffer[offset + 0x5C] = prospect.changeOfDirection;
  if (prospect.toughness !== undefined) buffer[offset + 0x88] = prospect.toughness;
  if (prospect.injury !== undefined) buffer[offset + 0x60] = prospect.injury;
  if (prospect.carrying !== undefined) buffer[offset + 0x59] = prospect.carrying;
  if (prospect.ballCarrierVision !== undefined) buffer[offset + 0x55] = prospect.ballCarrierVision;
  if (prospect.breakTackle !== undefined) buffer[offset + 0x58] = prospect.breakTackle;
  if (prospect.trucking !== undefined) buffer[offset + 0x89] = prospect.trucking;
  if (prospect.stiffArm !== undefined) buffer[offset + 0x7E] = prospect.stiffArm;
  if (prospect.spinMove !== undefined) buffer[offset + 0x7C] = prospect.spinMove;
  if (prospect.jukeMove !== undefined) buffer[offset + 0x61] = prospect.jukeMove;
  if (prospect.catching !== undefined) buffer[offset + 0x5A] = prospect.catching;
  if (prospect.catchInTraffic !== undefined) buffer[offset + 0x5B] = prospect.catchInTraffic;
  if (prospect.spectacularCatch !== undefined) buffer[offset + 0x7A] = prospect.spectacularCatch;
  if (prospect.shortRouteRunning !== undefined) buffer[offset + 0x75] = prospect.shortRouteRunning;
  if (prospect.mediumRouteRunning !== undefined) buffer[offset + 0x74] = prospect.mediumRouteRunning;
  if (prospect.deepRouteRunning !== undefined) buffer[offset + 0x73] = prospect.deepRouteRunning;
  if (prospect.release !== undefined) buffer[offset + 0x72] = prospect.release;
  if (prospect.throwPower !== undefined) buffer[offset + 0x86] = prospect.throwPower;
  if (prospect.throwAccuracyShort !== undefined) buffer[offset + 0x84] = prospect.throwAccuracyShort;
  if (prospect.throwAccuracyMid !== undefined) buffer[offset + 0x82] = prospect.throwAccuracyMid;
  if (prospect.throwAccuracyDeep !== undefined) buffer[offset + 0x81] = prospect.throwAccuracyDeep;
  if (prospect.throwOnTheRun !== undefined) buffer[offset + 0x85] = prospect.throwOnTheRun;
  if (prospect.throwUnderPressure !== undefined) buffer[offset + 0x87] = prospect.throwUnderPressure;
  if (prospect.playAction !== undefined) buffer[offset + 0x6D] = prospect.playAction;
  if (prospect.breakSack !== undefined) buffer[offset + 0x57] = prospect.breakSack;
  if (prospect.passBlock !== undefined) buffer[offset + 0x6B] = prospect.passBlock;
  if (prospect.passBlockPower !== undefined) buffer[offset + 0x69] = prospect.passBlockPower;
  if (prospect.passBlockFinesse !== undefined) buffer[offset + 0x6A] = prospect.passBlockFinesse;
  if (prospect.runBlock !== undefined) buffer[offset + 0x78] = prospect.runBlock;
  if (prospect.runBlockPower !== undefined) buffer[offset + 0x77] = prospect.runBlockPower;
  if (prospect.runBlockFinesse !== undefined) buffer[offset + 0x76] = prospect.runBlockFinesse;
  if (prospect.leadBlock !== undefined) buffer[offset + 0x66] = prospect.leadBlock;
  if (prospect.impactBlocking !== undefined) buffer[offset + 0x5F] = prospect.impactBlocking;
  if (prospect.tackle !== undefined) buffer[offset + 0x80] = prospect.tackle;
  if (prospect.hitPower !== undefined) buffer[offset + 0x5E] = prospect.hitPower;
  if (prospect.powerMoves !== undefined) buffer[offset + 0x6F] = prospect.powerMoves;
  if (prospect.finesseMoves !== undefined) buffer[offset + 0x5D] = prospect.finesseMoves;
  if (prospect.blockShedding !== undefined) buffer[offset + 0x56] = prospect.blockShedding;
  if (prospect.pursuit !== undefined) buffer[offset + 0x71] = prospect.pursuit;
  if (prospect.playRecognition !== undefined) buffer[offset + 0x6E] = prospect.playRecognition;
  if (prospect.manCoverage !== undefined) buffer[offset + 0x68] = prospect.manCoverage;
  if (prospect.zoneCoverage !== undefined) buffer[offset + 0x8A] = prospect.zoneCoverage;
  if (prospect.pressCoverage !== undefined) buffer[offset + 0x70] = prospect.pressCoverage;
  if (prospect.kickPower !== undefined) buffer[offset + 0x64] = prospect.kickPower;
  if (prospect.kickAccuracy !== undefined) buffer[offset + 0x63] = prospect.kickAccuracy;
  if (prospect.kickReturn !== undefined) buffer[offset + 0x65] = prospect.kickReturn;
  if (prospect.longSnap !== undefined) buffer[offset + 0x8B] = prospect.longSnap;
}

console.log(`\n0x6C before simulate: ${modifiedBuffer[attr0 + 0x6C]}`);
simulateWrite(modifiedBuffer, attr0, mockProspect);
console.log(`0x6C after simulate: ${modifiedBuffer[attr0 + 0x6C]}`);

// Check all bytes that changed
console.log('\n=== BYTES THAT CHANGED ===');
for (let off = 0; off <= 0xC8; off++) {
  if (templateBuf[attr0 + off] !== modifiedBuffer[attr0 + off]) {
    console.log(`  0x${off.toString(16).padStart(2, '0')}: ${templateBuf[attr0 + off]} -> ${modifiedBuffer[attr0 + off]}`);
  }
}

// NOW read the actual generated file and compare
console.log('\n\n=== COMPARING WITH ACTUAL GENERATED FILE ===');
const generatedFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const generatedBuf = fs.readFileSync(generatedFile);

const gAttr = DATA_START + ATTR_OFFSET;

console.log(`Generated file 0x6C: ${generatedBuf[gAttr + 0x6C]}`);
console.log(`Our simulated 0x6C: ${modifiedBuffer[attr0 + 0x6C]}`);
console.log(`Template 0x6C: ${templateBuf[attr0 + 0x6C]}`);

// What's different between generated and our simulation?
console.log('\n=== DIFFERENCES (Generated vs Simulated) ===');
let diffCount = 0;
for (let off = 0; off <= 0xC8; off++) {
  if (generatedBuf[gAttr + off] !== modifiedBuffer[attr0 + off]) {
    console.log(`  0x${off.toString(16).padStart(2, '0')}: Generated=${generatedBuf[gAttr + off]}, Simulated=${modifiedBuffer[attr0 + off]}`);
    diffCount++;
  }
}
console.log(`\nTotal differences: ${diffCount}`);

// The key insight: if 0x6C in generated differs from template but our simulation
// keeps template value, then something ELSE is writing to 0x6C
