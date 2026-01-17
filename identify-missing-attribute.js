/**
 * Identify the missing attribute at 0x6C by correlating with known player data
 *
 * Strategy:
 * 1. Load template prospects with KNOWN attributes
 * 2. See if 0x6C correlates with any existing attribute
 * 3. Or see if it's a NEW attribute not in our mapping
 */
const fs = require('fs');

const templateFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const buffer = fs.readFileSync(templateFile);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

// Collect data from multiple prospects
const prospects = [];

for (let block = 0; block < 50; block++) {
  const attrStart = DATA_START + (block * BLOCK_SIZE) + ATTR_OFFSET;

  const name = buffer.toString('ascii', attrStart, attrStart + 0x26).replace(/\0/g, ' ').trim();
  const position = buffer[attrStart + 0x4a];

  // Read 0x6C and 0x83 (unknown fields)
  const val_6C = buffer[attrStart + 0x6C];
  const val_83 = buffer[attrStart + 0x83];

  // Read all known attributes
  const attrs = {
    position,
    name,
    val_6C,
    val_83,

    // All attributes in M26Parser order
    acceleration: buffer[attrStart + 0x52],
    agility: buffer[attrStart + 0x53],
    awareness: buffer[attrStart + 0x54],
    ballCarrierVision: buffer[attrStart + 0x55],
    blockShedding: buffer[attrStart + 0x56],
    breakSack: buffer[attrStart + 0x57],
    breakTackle: buffer[attrStart + 0x58],
    carrying: buffer[attrStart + 0x59],
    catching: buffer[attrStart + 0x5A],
    catchInTraffic: buffer[attrStart + 0x5B],
    changeOfDirection: buffer[attrStart + 0x5C],
    finesseMoves: buffer[attrStart + 0x5D],
    hitPower: buffer[attrStart + 0x5E],
    impactBlocking: buffer[attrStart + 0x5F],
    injury: buffer[attrStart + 0x60],
    jukeMove: buffer[attrStart + 0x61],
    jumping: buffer[attrStart + 0x62],
    kickAccuracy: buffer[attrStart + 0x63],
    kickPower: buffer[attrStart + 0x64],
    kickReturn: buffer[attrStart + 0x65],
    leadBlock: buffer[attrStart + 0x66],
    manCoverage: buffer[attrStart + 0x68],
    passBlockPower: buffer[attrStart + 0x69],
    passBlockFinesse: buffer[attrStart + 0x6A],
    passBlock: buffer[attrStart + 0x6B],
    playAction: buffer[attrStart + 0x6D],
    playRecognition: buffer[attrStart + 0x6E],
    powerMoves: buffer[attrStart + 0x6F],
    pressCoverage: buffer[attrStart + 0x70],
    pursuit: buffer[attrStart + 0x71],
    release: buffer[attrStart + 0x72],
    deepRouteRunning: buffer[attrStart + 0x73],
    mediumRouteRunning: buffer[attrStart + 0x74],
    shortRouteRunning: buffer[attrStart + 0x75],
    runBlockFinesse: buffer[attrStart + 0x76],
    runBlockPower: buffer[attrStart + 0x77],
    runBlock: buffer[attrStart + 0x78],
    spectacularCatch: buffer[attrStart + 0x7A],
    speed: buffer[attrStart + 0x7B],
    spinMove: buffer[attrStart + 0x7C],
    stamina: buffer[attrStart + 0x7D],
    stiffArm: buffer[attrStart + 0x7E],
    strength: buffer[attrStart + 0x7F],
    tackle: buffer[attrStart + 0x80],
    throwAccuracyDeep: buffer[attrStart + 0x81],
    throwAccuracyMid: buffer[attrStart + 0x82],
    throwAccuracyShort: buffer[attrStart + 0x84],
    throwOnTheRun: buffer[attrStart + 0x85],
    throwPower: buffer[attrStart + 0x86],
    throwUnderPressure: buffer[attrStart + 0x87],
    toughness: buffer[attrStart + 0x88],
    trucking: buffer[attrStart + 0x89],
    zoneCoverage: buffer[attrStart + 0x8A],
    longSnap: buffer[attrStart + 0x8B],
    overall: buffer[attrStart + 0x51],
  };

  prospects.push(attrs);
}

// Print a table for the first 20 prospects
console.log('=== FIRST 20 PROSPECTS ===\n');
console.log('Name                    | Pos | 0x6C | 0x83 | Speed | ThP | Awa | Inj | Tough');
console.log('------------------------|-----|------|------|-------|-----|-----|-----|------');

for (let i = 0; i < 20; i++) {
  const p = prospects[i];
  const posNames = {0:'QB', 1:'HB', 2:'FB', 3:'WR', 4:'TE', 5:'LT', 6:'LG', 7:'C', 8:'RG', 9:'RT', 10:'LE', 11:'RE', 12:'DT', 13:'LOLB', 14:'MLB', 15:'ROLB', 16:'CB', 17:'FS', 18:'SS', 19:'K', 20:'P'};
  const pos = posNames[p.position] || `P${p.position}`;

  console.log(`${p.name.padEnd(24)}| ${pos.padEnd(3)} | ${p.val_6C.toString().padStart(4)} | ${p.val_83.toString().padStart(4)} | ${p.speed.toString().padStart(5)} | ${p.throwPower.toString().padStart(3)} | ${p.awareness.toString().padStart(3)} | ${p.injury.toString().padStart(3)} | ${p.toughness.toString().padStart(5)}`);
}

// Now check correlation - does 0x6C equal any known attribute?
console.log('\n\n=== CHECKING IF 0x6C MATCHES ANY KNOWN ATTRIBUTE ===');

const attrNames = Object.keys(prospects[0]).filter(k => k !== 'name' && k !== 'position' && k !== 'val_6C' && k !== 'val_83');

for (const attr of attrNames) {
  let matches = 0;
  for (const p of prospects) {
    if (p.val_6C === p[attr]) matches++;
  }
  if (matches >= 5) { // At least 10% match
    console.log(`  ${attr}: ${matches}/${prospects.length} matches`);
  }
}

console.log('\n\n=== CHECKING IF 0x83 MATCHES ANY KNOWN ATTRIBUTE ===');

for (const attr of attrNames) {
  let matches = 0;
  for (const p of prospects) {
    if (p.val_83 === p[attr]) matches++;
  }
  if (matches >= 5) {
    console.log(`  ${attr}: ${matches}/${prospects.length} matches`);
  }
}

// Check if 0x6C could be a duplicate of passBlock or runBlock (which ARE written)
console.log('\n\n=== CORRELATION CHECK ===');
console.log('Check if 0x6C correlates with blocking stats:');
for (let i = 0; i < 10; i++) {
  const p = prospects[i];
  console.log(`  ${p.name.slice(0,15).padEnd(15)} | 0x6C=${p.val_6C} | passBlock=${p.passBlock} | passBlockPower=${p.passBlockPower} | playAction=${p.playAction}`);
}

// The fact that 0x6C varies a lot suggests it's an attribute
// Let me check what Madden attributes we might be missing from the complete list

console.log('\n\n=== POTENTIAL MISSING ATTRIBUTES ===');
console.log('Attributes NOT in our M26Writer but exist in Madden:');
console.log('  - ?');
console.log('');
console.log('OVR Weights file attributes (for reference):');
console.log('  AccelerationRating, AgilityRating, AwarenessRating, BCVisionRating,');
console.log('  BlockSheddingRating, BreakSackRating, BreakTackleRating, CarryingRating,');
console.log('  CatchingRating, CatchInTrafficRating, ChangeOfDirectionRating, FinesseMovesRating,');
console.log('  HitPowerRating, ImpactBlockingRating, InjuryRating, JukeMoveRating, JumpingRating,');
console.log('  KickAccuracyRating, KickPowerRating, LeadBlockRating, ManCoverageRating,');
console.log('  PassBlockFinesseRating, PassBlockPowerRating, PassBlockRating, PlayActionRating,');
console.log('  PlayRecognitionRating, PowerMovesRating, PressRating, PursuitRating, ReleaseRating,');
console.log('  DeepRouteRunningRating, MediumRouteRunningRating, ShortRouteRunningRating,');
console.log('  RunBlockFinesseRating, RunBlockPowerRating, RunBlockRating, SpectacularCatchRating,');
console.log('  SpeedRating, SpinMoveRating, StaminaRating, StiffArmRating, StrengthRating,');
console.log('  TackleRating, ThrowAccuracyDeepRating, ThrowAccuracyMidRating, ThrowAccuracyShortRating,');
console.log('  ThrowOnTheRunRating, ThrowPowerRating, ThrowUnderPressureRating, TruckingRating,');
console.log('  ZoneCoverageRating');
console.log('');
console.log('We have ALL of these. So 0x6C might be:');
console.log('  1. A game-calculated field (not user-set)');
console.log('  2. A legacy field from older Madden');
console.log('  3. A new M26 field not in OVR weights');
