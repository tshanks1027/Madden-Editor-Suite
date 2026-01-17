/**
 * Analyze OVR calculations across ALL positions in the 2020 draft class
 * Using the correct ARCHETYPE_ID_TO_FORMULA mapping from OVRWeightsCalculator.ts
 */
const fs = require('fs');
const weights = require('./data/lookups/ovrweights.json');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

// Position lookup
const positionLookup = {
  0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
  8: 'RG', 9: 'RT', 10: 'LE', 11: 'RE', 12: 'DT', 13: 'LOLB', 14: 'MLB',
  15: 'ROLB', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P'
};

// Exact mapping from OVRWeightsCalculator.ts
const ARCHETYPE_ID_TO_FORMULA = {
  0: 'QB_FieldGeneral', 1: 'QB_StrongArm', 2: 'QB_Improviser', 3: 'QB_Scrambler', 4: 'QB_Scrambler',
  5: 'HB_PowerBack', 6: 'HB_ElusiveBack', 7: 'HB_ReceivingBack', 8: 'HB_PowerBack', 9: 'HB_ReceivingBack',
  10: 'HB_ElusiveBack', 11: 'HB_ReceivingBack',
  12: 'FB_Blocking', 13: 'FB_Utility',
  14: 'WR_DeepThreat', 15: 'WR_Playmaker', 16: 'WR_Physical', 17: 'WR_Slot', 18: 'WR_Physical',
  19: 'WR_Slot', 20: 'WR_Physical', 21: 'WR_Slot',
  22: 'TE_Blocking', 23: 'TE_VerticalThreat', 24: 'TE_Possession', 25: 'TE_Blocking', 26: 'TE_Possession',
  27: 'C_PassProtector', 28: 'C_Power', 29: 'C_Agile', 30: 'C_Agile',
  31: 'OT_PassProtector', 32: 'OT_Power', 33: 'OT_Agile', 34: 'OT_Agile',
  35: 'G_PassProtector', 36: 'G_Agile', 37: 'G_Power', 38: 'G_Agile',
  39: 'DE_SmallerSpeedRusher', 40: 'DE_PowerRusher', 41: 'DE_PowerRusher', 42: 'DE_RunStopper',
  43: 'DT_RunStopper', 44: 'DT_PowerRusher', 45: 'DT_SpeedRusher', 46: 'DT_PowerRusher',
  47: 'OLB_SpeedRusher', 48: 'OLB_PowerRusher', 49: 'OLB_PassCoverage', 50: 'OLB_RunStopper',
  51: 'MLB_FieldGeneral', 52: 'MLB_PassCoverage', 53: 'MLB_RunStopper',
  54: 'CB_MantoMan', 55: 'CB_Slot', 56: 'CB_Zone', 57: 'CB_MantoMan',
  58: 'S_Zone', 59: 'S_Hybrid', 60: 'S_RunSupport',
  61: 'KP_Accurate', 62: 'KP_Power', 63: 'KP_Accurate', 64: 'KP_Accurate',
  65: 'C_Power', 66: 'C_PassProtector', 67: 'WR_Slot'
};

// Read all attributes for a prospect
function readProspect(index) {
  const blockStart = DATA_START + (index * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  // Check if valid (not all zeros)
  if (buffer[attrStart + 0x7b] === 0) return null;

  return {
    index,
    position: buffer[attrStart + 0x4a],
    archetypeCode: buffer[attrStart + 0x4b],
    storedOVR: buffer[attrStart + 0x51],
    // Physical
    speed: buffer[attrStart + 0x7b],
    acceleration: buffer[attrStart + 0x52],
    agility: buffer[attrStart + 0x53],
    awareness: buffer[attrStart + 0x54],
    strength: buffer[attrStart + 0x7f],
    jumping: buffer[attrStart + 0x62],
    stamina: buffer[attrStart + 0x7d],
    changeOfDirection: buffer[attrStart + 0x5c],
    // Coverage
    manCoverage: buffer[attrStart + 0x68],
    zoneCoverage: buffer[attrStart + 0x8a],
    pressCoverage: buffer[attrStart + 0x70],
    // Tackling/Pass Rush
    tackle: buffer[attrStart + 0x80],
    hitPower: buffer[attrStart + 0x5e],
    pursuit: buffer[attrStart + 0x71],
    playRecognition: buffer[attrStart + 0x6e],
    blockShedding: buffer[attrStart + 0x56],
    finesseMoves: buffer[attrStart + 0x5d],
    powerMoves: buffer[attrStart + 0x6f],
    // Receiving
    catching: buffer[attrStart + 0x5a],
    catchInTraffic: buffer[attrStart + 0x5b],
    spectacularCatch: buffer[attrStart + 0x7a],
    shortRouteRunning: buffer[attrStart + 0x75],
    mediumRouteRunning: buffer[attrStart + 0x74],
    deepRouteRunning: buffer[attrStart + 0x73],
    release: buffer[attrStart + 0x72],
    // Running
    carrying: buffer[attrStart + 0x59],
    breakTackle: buffer[attrStart + 0x58],
    trucking: buffer[attrStart + 0x89],
    stiffArm: buffer[attrStart + 0x7e],
    spinMove: buffer[attrStart + 0x7c],
    jukeMove: buffer[attrStart + 0x61],
    ballCarrierVision: buffer[attrStart + 0x55],
    // Blocking
    runBlock: buffer[attrStart + 0x78],
    runBlockPower: buffer[attrStart + 0x77],
    runBlockFinesse: buffer[attrStart + 0x76],
    passBlock: buffer[attrStart + 0x6b],
    passBlockPower: buffer[attrStart + 0x69],
    passBlockFinesse: buffer[attrStart + 0x6a],
    impactBlocking: buffer[attrStart + 0x5f],
    leadBlock: buffer[attrStart + 0x66],
    // Throwing
    throwPower: buffer[attrStart + 0x86],
    throwAccuracyShort: buffer[attrStart + 0x84],
    throwAccuracyMid: buffer[attrStart + 0x82],
    throwAccuracyDeep: buffer[attrStart + 0x81],
    throwOnTheRun: buffer[attrStart + 0x85],
    throwUnderPressure: buffer[attrStart + 0x87],
    playAction: buffer[attrStart + 0x6d],
    breakSack: buffer[attrStart + 0x57],
    // Kicking
    kickPower: buffer[attrStart + 0x64],
    kickAccuracy: buffer[attrStart + 0x63],
  };
}

// Build attribute map for OVR formula
function buildAttrMap(p) {
  return {
    'SpeedRating': p.speed,
    'AccelerationRating': p.acceleration,
    'AgilityRating': p.agility,
    'AwarenessRating': p.awareness,
    'StrengthRating': p.strength,
    'JumpingRating': p.jumping,
    'StaminaRating': p.stamina,
    'ChangeOfDirectionRating': p.changeOfDirection,
    'ManCoverageRating': p.manCoverage,
    'ZoneCoverageRating': p.zoneCoverage,
    'PressRating': p.pressCoverage,
    'TackleRating': p.tackle,
    'HitPowerRating': p.hitPower,
    'PursuitRating': p.pursuit,
    'PlayRecognitionRating': p.playRecognition,
    'BlockSheddingRating': p.blockShedding,
    'FinesseMovesRating': p.finesseMoves,
    'PowerMovesRating': p.powerMoves,
    'CatchingRating': p.catching,
    'CatchInTrafficRating': p.catchInTraffic,
    'SpectacularCatchRating': p.spectacularCatch,
    'ShortRouteRunningRating': p.shortRouteRunning,
    'MediumRouteRunningRating': p.mediumRouteRunning,
    'DeepRouteRunningRating': p.deepRouteRunning,
    'ReleaseRating': p.release,
    'CarryingRating': p.carrying,
    'BreakTackleRating': p.breakTackle,
    'TruckingRating': p.trucking,
    'StiffArmRating': p.stiffArm,
    'SpinMoveRating': p.spinMove,
    'JukeMoveRating': p.jukeMove,
    'BCVisionRating': p.ballCarrierVision,
    'RunBlockRating': p.runBlock,
    'RunBlockPowerRating': p.runBlockPower,
    'RunBlockFinesseRating': p.runBlockFinesse,
    'PassBlockRating': p.passBlock,
    'PassBlockPowerRating': p.passBlockPower,
    'PassBlockFinesseRating': p.passBlockFinesse,
    'ImpactBlockingRating': p.impactBlocking,
    'LeadBlockRating': p.leadBlock,
    'ThrowPowerRating': p.throwPower,
    'ThrowAccuracyShortRating': p.throwAccuracyShort,
    'ThrowAccuracyMidRating': p.throwAccuracyMid,
    'ThrowAccuracyDeepRating': p.throwAccuracyDeep,
    'ThrowOnTheRunRating': p.throwOnTheRun,
    'ThrowUnderPressureRating': p.throwUnderPressure,
    'PlayActionRating': p.playAction,
    'BreakSackRating': p.breakSack,
    'KickPowerRating': p.kickPower,
    'KickAccuracyRating': p.kickAccuracy,
  };
}

// Calculate OVR with given divisor
function calculateOVR(prospect, formulaName, divisor) {
  const formula = weights.find(w => w.Archetype === formulaName);
  if (!formula) return null;

  const attrMap = buildAttrMap(prospect);
  let weightedSum = 0;

  for (const [attrName, value] of Object.entries(attrMap)) {
    const weight = parseFloat(formula[attrName]) || 0;
    weightedSum += value * weight;
  }

  return {
    sum: weightedSum,
    ovr: Math.round(weightedSum / divisor)
  };
}

console.log('Analyzing 2020 draft class prospects with CORRECT archetype mapping...\n');

// Group results by position
const byPosition = {};

// Read all prospects
for (let i = 0; i < 471; i++) {
  const p = readProspect(i);
  if (!p || p.speed === 0) continue;

  const formulaName = ARCHETYPE_ID_TO_FORMULA[p.archetypeCode];
  if (!formulaName) {
    console.log(`Unknown archetype ${p.archetypeCode} at index ${i}`);
    continue;
  }

  const calc10 = calculateOVR(p, formulaName, 10);
  const calc11 = calculateOVR(p, formulaName, 11.0);

  if (!calc10 || !calc11) {
    console.log(`No formula for ${formulaName} at index ${i}`);
    continue;
  }

  const posName = positionLookup[p.position] || 'UNK';

  if (!byPosition[posName]) {
    byPosition[posName] = [];
  }

  byPosition[posName].push({
    index: i,
    stored: p.storedOVR,
    div10: calc10.ovr,
    div11: calc11.ovr,
    sum: calc10.sum,
    archetype: formulaName,
    archetypeCode: p.archetypeCode
  });
}

// Print summary by position
console.log('='.repeat(100));
console.log('POSITION ANALYSIS - OVR Calculations (Correct Mapping)');
console.log('='.repeat(100));

const positions = Object.keys(byPosition).sort();

for (const pos of positions) {
  const players = byPosition[pos];
  if (players.length === 0) continue;

  console.log(`\n=== ${pos} (${players.length} prospects) ===`);
  console.log('Idx | Stored | Div10 | Div11 | Needed | Archetype');
  console.log('-'.repeat(80));

  // Show first 5
  for (const p of players.slice(0, 5)) {
    const neededDivisor = p.sum > 0 ? (p.sum / p.stored).toFixed(2) : 'N/A';
    console.log(`${String(p.index).padStart(3)} | ${String(p.stored).padStart(6)} | ${String(p.div10).padStart(5)} | ${String(p.div11).padStart(5)} | ${String(neededDivisor).padStart(6)} | ${p.archetype}`);
  }

  // Calculate stats
  const neededDivisors = players.map(p => p.sum / p.stored).filter(d => d > 0 && d < 15);
  if (neededDivisors.length > 0) {
    const avgDivisor = neededDivisors.reduce((a, b) => a + b, 0) / neededDivisors.length;
    const div10Errors = players.map(p => Math.abs(p.div10 - p.stored));
    const div11Errors = players.map(p => Math.abs(p.div11 - p.stored));
    const avgDiv10Error = div10Errors.reduce((a, b) => a + b, 0) / div10Errors.length;
    const avgDiv11Error = div11Errors.reduce((a, b) => a + b, 0) / div11Errors.length;
    console.log(`Average needed divisor: ${avgDivisor.toFixed(2)} | Div10 avg error: ${avgDiv10Error.toFixed(1)} | Div11 avg error: ${avgDiv11Error.toFixed(1)}`);
  }
}

// Final summary
console.log('\n' + '='.repeat(100));
console.log('SUMMARY - Which divisor works better per position?');
console.log('='.repeat(100));
console.log('Pos   | Count | Div10 exact | Div11 exact | Avg Divisor | Better?');
console.log('-'.repeat(80));

for (const pos of positions) {
  const players = byPosition[pos];
  const div10Exact = players.filter(p => p.div10 === p.stored).length;
  const div11Exact = players.filter(p => p.div11 === p.stored).length;

  const avgNeeded = players.map(p => p.sum / p.stored).filter(d => d > 0 && d < 15);
  const avgDiv = avgNeeded.length > 0 ? (avgNeeded.reduce((a, b) => a + b, 0) / avgNeeded.length).toFixed(2) : 'N/A';

  const better = div10Exact > div11Exact ? 'Div10' : (div11Exact > div10Exact ? 'Div11' : 'TIE');

  console.log(`${pos.padEnd(5)} | ${String(players.length).padStart(5)} | ${String(div10Exact).padStart(11)} | ${String(div11Exact).padStart(11)} | ${String(avgDiv).padStart(11)} | ${better}`);
}
