/**
 * Analyze OVR calculations across ALL positions in the 2020 draft class
 * Compare editor/stored OVR vs what different divisors would give
 */
const fs = require('fs');
const weights = require('./data/lookups/ovrweights.json');
// Position lookup - hardcoded for simplicity
const positionLookup = [
  {id: 0, name: 'QB'}, {id: 1, name: 'HB'}, {id: 2, name: 'FB'}, {id: 3, name: 'WR'},
  {id: 4, name: 'TE'}, {id: 5, name: 'LT'}, {id: 6, name: 'LG'}, {id: 7, name: 'C'},
  {id: 8, name: 'RG'}, {id: 9, name: 'RT'}, {id: 10, name: 'LE'}, {id: 11, name: 'RE'},
  {id: 12, name: 'DT'}, {id: 13, name: 'LOLB'}, {id: 14, name: 'MLB'}, {id: 15, name: 'ROLB'},
  {id: 16, name: 'CB'}, {id: 17, name: 'FS'}, {id: 18, name: 'SS'}, {id: 19, name: 'K'}, {id: 20, name: 'P'}
];

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

// Archetype code to name mapping (from M26Parser)
const archetypeMap = {
  0: 'Balanced_QB',
  1: 'Improviser_QB',
  2: 'Scrambler_QB',
  3: 'FieldGeneral_QB',
  4: 'EliteFB',
  5: 'BlockingFB',
  6: 'UtilityFB',
  7: 'Power_HB',
  8: 'Elusive_HB',
  9: 'Receiving_HB',
  10: 'Blocking_TE',
  11: 'VerticalThreat_TE',
  12: 'PossessionReceiver_TE',
  13: 'DeepThreat_WR',
  14: 'RouteRunner_WR',
  15: 'PhysicalReceiver_WR',
  16: 'SlotReceiver_WR',
  17: 'PassProtector_T',
  18: 'PowerRunBlocker_T',
  19: 'AgilityRunBlocker_T',
  20: 'PassProtector_G',
  21: 'PowerRunBlocker_G',
  22: 'AgilityRunBlocker_G',
  23: 'PassProtector_C',
  24: 'PowerRunBlocker_C',
  25: 'AgilityRunBlocker_C',
  26: 'Balanced_DT',
  27: 'RunStopper_DT',
  28: 'PassRusher_DT',
  29: 'Smaller_PassRusher_DT',
  30: 'Balanced_LE',
  31: 'Balanced_RE',
  32: 'SpeedRusher_LE',
  33: 'SpeedRusher_RE',
  34: 'PowerRusher_LE',
  35: 'PowerRusher_RE',
  36: 'RunStopper_LE',
  37: 'RunStopper_RE',
  38: 'SmallerSpeedRusher_RE',
  39: 'SmallerSpeedRusher_LE',
  40: 'FieldGeneral_MLB',
  41: 'RunStopper_MLB',
  42: 'PassCoverage_MLB',
  43: 'FieldGeneral_OLB',
  44: 'RunStopper_OLB',
  45: 'PassCoverage_OLB',
  46: 'SpeedRusher_OLB',
  47: 'PowerRusher_OLB',
  48: 'SpeedRusher_ROLB',
  49: 'SpeedRusher_LOLB',
  50: 'PowerRusher_ROLB',
  51: 'PowerRusher_LOLB',
  52: 'Slot_CB',
  53: 'Zone_CB',
  54: 'MantoMan_CB',
  55: 'Zone_FS',
  56: 'HybridSafety_FS',
  57: 'RunSupport_FS',
  58: 'Zone_SS',
  59: 'HybridSafety_SS',
  60: 'RunSupport_SS',
  61: 'Accurate_K',
  62: 'Power_K',
  63: 'Accurate_P',
  64: 'Power_P'
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

// Map archetype code to formula name
function getFormulaName(archetypeCode, posCode) {
  const name = archetypeMap[archetypeCode];
  if (!name) return null;

  // Map to actual formula names in ovrweights.json
  const mappings = {
    'Balanced_QB': 'QB_Balanced',
    'Improviser_QB': 'QB_Improviser',
    'Scrambler_QB': 'QB_Scrambler',
    'FieldGeneral_QB': 'QB_FieldGeneral',
    'Power_HB': 'HB_Power',
    'Elusive_HB': 'HB_Elusive',
    'Receiving_HB': 'HB_Receiving',
    'Blocking_TE': 'TE_Blocking',
    'VerticalThreat_TE': 'TE_VerticalThreat',
    'PossessionReceiver_TE': 'TE_PossessionReceiver',
    'DeepThreat_WR': 'WR_DeepThreat',
    'RouteRunner_WR': 'WR_RouteRunner',
    'PhysicalReceiver_WR': 'WR_Physical',
    'SlotReceiver_WR': 'WR_Slot',
    'PassProtector_T': 'T_PassProtector',
    'PowerRunBlocker_T': 'T_PowerRunBlocker',
    'AgilityRunBlocker_T': 'T_AgilityRunBlocker',
    'PassProtector_G': 'G_PassProtector',
    'PowerRunBlocker_G': 'G_PowerRunBlocker',
    'AgilityRunBlocker_G': 'G_AgilityRunBlocker',
    'PassProtector_C': 'C_PassProtector',
    'PowerRunBlocker_C': 'C_PowerRunBlocker',
    'AgilityRunBlocker_C': 'C_AgilityRunBlocker',
    'Balanced_DT': 'DT_Balanced',
    'RunStopper_DT': 'DT_RunStopper',
    'PassRusher_DT': 'DT_PassRusher',
    'Smaller_PassRusher_DT': 'DT_PassRusher',
    'Balanced_LE': 'DE_Balanced',
    'Balanced_RE': 'DE_Balanced',
    'SpeedRusher_LE': 'DE_SmallerSpeedRusher',
    'SpeedRusher_RE': 'DE_SmallerSpeedRusher',
    'PowerRusher_LE': 'DE_PowerRusher',
    'PowerRusher_RE': 'DE_PowerRusher',
    'RunStopper_LE': 'DE_RunStopper',
    'RunStopper_RE': 'DE_RunStopper',
    'SmallerSpeedRusher_RE': 'DE_SmallerSpeedRusher',
    'SmallerSpeedRusher_LE': 'DE_SmallerSpeedRusher',
    'FieldGeneral_MLB': 'MLB_FieldGeneral',
    'RunStopper_MLB': 'MLB_RunStopper',
    'PassCoverage_MLB': 'MLB_PassCoverage',
    'FieldGeneral_OLB': 'OLB_FieldGeneral',
    'RunStopper_OLB': 'OLB_RunStopper',
    'PassCoverage_OLB': 'OLB_PassCoverage',
    'SpeedRusher_OLB': 'OLB_SpeedRusher',
    'PowerRusher_OLB': 'OLB_PowerRusher',
    'SpeedRusher_ROLB': 'OLB_SpeedRusher',
    'SpeedRusher_LOLB': 'OLB_SpeedRusher',
    'PowerRusher_ROLB': 'OLB_PowerRusher',
    'PowerRusher_LOLB': 'OLB_PowerRusher',
    'Slot_CB': 'CB_Slot',
    'Zone_CB': 'CB_Zone',
    'MantoMan_CB': 'CB_MantoMan',
    'Zone_FS': 'FS_Zone',
    'HybridSafety_FS': 'FS_Hybrid',
    'RunSupport_FS': 'FS_RunSupport',
    'Zone_SS': 'SS_Zone',
    'HybridSafety_SS': 'SS_Hybrid',
    'RunSupport_SS': 'SS_RunSupport',
    'Accurate_K': 'K_Accurate',
    'Power_K': 'K_Power',
    'Accurate_P': 'P_Accurate',
    'Power_P': 'P_Power',
  };

  return mappings[name] || name;
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

// Read file to get count
const prospectCount = buffer.readUInt16BE(DATA_START - 2); // Usually stored before data
console.log('Analyzing 2020 draft class prospects...\n');

// Group results by position
const byPosition = {};

// Read first 100 prospects (or however many exist)
for (let i = 0; i < Math.min(471, 500); i++) {
  const p = readProspect(i);
  if (!p || p.speed === 0) continue;

  const formulaName = getFormulaName(p.archetypeCode, p.position);
  if (!formulaName) continue;

  const calc10 = calculateOVR(p, formulaName, 10);
  const calc11 = calculateOVR(p, formulaName, 11.0);

  if (!calc10 || !calc11) continue;

  const posName = positionLookup.find(pl => pl.id === p.position)?.name || 'UNK' + p.position;

  if (!byPosition[posName]) {
    byPosition[posName] = [];
  }

  byPosition[posName].push({
    index: i,
    stored: p.storedOVR,
    div10: calc10.ovr,
    div11: calc11.ovr,
    sum: calc10.sum,
    archetype: archetypeMap[p.archetypeCode]
  });
}

// Print summary by position
console.log('='.repeat(80));
console.log('POSITION ANALYSIS - OVR Calculations');
console.log('='.repeat(80));

const positions = Object.keys(byPosition).sort();

for (const pos of positions) {
  const players = byPosition[pos];
  if (players.length === 0) continue;

  console.log(`\n=== ${pos} (${players.length} prospects) ===`);
  console.log('Idx | Stored | Div10 | Div11 | Needed | Archetype');
  console.log('-'.repeat(70));

  for (const p of players.slice(0, 5)) { // First 5 of each position
    const neededDivisor = p.sum > 0 ? (p.sum / p.stored).toFixed(2) : 'N/A';
    console.log(`${String(p.index).padStart(3)} | ${String(p.stored).padStart(6)} | ${String(p.div10).padStart(5)} | ${String(p.div11).padStart(5)} | ${String(neededDivisor).padStart(6)} | ${p.archetype}`);
  }

  // Calculate average needed divisor for this position
  const neededDivisors = players.map(p => p.sum / p.stored).filter(d => d > 0 && d < 15);
  if (neededDivisors.length > 0) {
    const avgDivisor = neededDivisors.reduce((a, b) => a + b, 0) / neededDivisors.length;
    const div10Errors = players.map(p => Math.abs(p.div10 - p.stored));
    const div11Errors = players.map(p => Math.abs(p.div11 - p.stored));
    const avgDiv10Error = div10Errors.reduce((a, b) => a + b, 0) / div10Errors.length;
    const avgDiv11Error = div11Errors.reduce((a, b) => a + b, 0) / div11Errors.length;
    console.log(`Average needed divisor: ${avgDivisor.toFixed(2)}`);
    console.log(`Avg error with div 10: ${avgDiv10Error.toFixed(1)}, with div 11: ${avgDiv11Error.toFixed(1)}`);
  }
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('SUMMARY - Which divisor works better per position?');
console.log('='.repeat(80));

for (const pos of positions) {
  const players = byPosition[pos];
  const div10Exact = players.filter(p => p.div10 === p.stored).length;
  const div11Exact = players.filter(p => p.div11 === p.stored).length;
  const div10Close = players.filter(p => Math.abs(p.div10 - p.stored) <= 1).length;
  const div11Close = players.filter(p => Math.abs(p.div11 - p.stored) <= 1).length;

  const avgNeeded = players.map(p => p.sum / p.stored).filter(d => d > 0 && d < 15);
  const avgDiv = avgNeeded.length > 0 ? (avgNeeded.reduce((a, b) => a + b, 0) / avgNeeded.length).toFixed(2) : 'N/A';

  console.log(`${pos.padEnd(5)}: Div10 exact=${div10Exact}/${players.length}, Div11 exact=${div11Exact}/${players.length}, AvgDivisor=${avgDiv}`);
}
