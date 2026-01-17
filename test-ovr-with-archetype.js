/**
 * Test OVR calculation using actual archetype from M26 file
 */
const fs = require('fs');
const path = require('path');

// Read OVR weights
const weightsPath = path.join(__dirname, 'data/lookups/ovrweights.json');
const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));

// Get weights by archetype
const weightsByArchetype = {};
for (const w of weights) {
  weightsByArchetype[w.Archetype] = w;
}

// Position ID to name
const POSITION_NAMES = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P'];

// Position to JSON position for OVR weights
const POS_TO_JSON = {
  'QB': 'QB', 'HB': 'HB', 'FB': 'FB', 'WR': 'WR', 'TE': 'TE',
  'LT': 'OT', 'RT': 'OT', 'LG': 'G', 'RG': 'G', 'C': 'C',
  'LE': 'DE', 'RE': 'DE', 'DT': 'DT',
  'LOLB': 'OLB', 'ROLB': 'OLB', 'MLB': 'MLB',
  'CB': 'CB', 'FS': 'S', 'SS': 'S', 'K': 'KP', 'P': 'KP'
};

// Global archetype ID to archetype name mapping (from archetype_lookup.csv + position mapping)
// The key is that we need BOTH position AND archetype ID to determine the ovrweights archetype
const ARCHETYPE_MAP = {
  // QB archetypes (IDs 0-4)
  'QB_0': 'QB_FieldGeneral',
  'QB_1': 'QB_StrongArm',
  'QB_2': 'QB_Improviser',
  'QB_3': 'QB_Scrambler',
  'QB_4': 'QB_Scrambler', // Pure Scrambler -> Scrambler

  // HB archetypes (IDs 5-11)
  'HB_5': 'HB_PowerBack',
  'HB_6': 'HB_ElusiveBack',
  'HB_7': 'HB_ReceivingBack',

  // FB archetypes (IDs 12-13)
  'FB_12': 'FB_Blocking',
  'FB_13': 'FB_Utility',

  // WR archetypes (IDs 14-21)
  'WR_14': 'WR_DeepThreat',
  'WR_15': 'WR_Playmaker',
  'WR_16': 'WR_Physical',
  'WR_17': 'WR_Slot',
  'WR_18': 'WR_Physical',
  'WR_19': 'WR_Playmaker',
  'WR_20': 'WR_Physical',
  'WR_21': 'WR_Slot',

  // TE archetypes (IDs 22-26)
  'TE_22': 'TE_Blocking',
  'TE_23': 'TE_VerticalThreat',
  'TE_24': 'TE_Possession',
  'TE_25': 'TE_Blocking',
  'TE_26': 'TE_Possession',

  // OL archetypes (IDs 27-38)
  'C_27': 'C_PassProtector',
  'C_28': 'C_Power',
  'C_29': 'C_Agile',
  'C_30': 'C_Agile',
  'LT_31': 'OT_PassProtector',
  'LT_32': 'OT_Power',
  'LT_33': 'OT_Agile',
  'LT_34': 'OT_Agile',
  'RT_31': 'OT_PassProtector',
  'RT_32': 'OT_Power',
  'RT_33': 'OT_Agile',
  'RT_34': 'OT_Agile',
  'LG_35': 'G_PassProtector',
  'LG_36': 'G_Agile',
  'LG_37': 'G_Power',
  'LG_38': 'G_Agile',
  'RG_35': 'G_PassProtector',
  'RG_36': 'G_Agile',
  'RG_37': 'G_Power',
  'RG_38': 'G_Agile',

  // DE archetypes (IDs 39-42)
  'LE_39': 'DE_SmallerSpeedRusher',
  'LE_40': 'DE_PowerRusher',
  'LE_41': 'DE_PowerRusher',
  'LE_42': 'DE_RunStopper',
  'RE_39': 'DE_SmallerSpeedRusher',
  'RE_40': 'DE_PowerRusher',
  'RE_41': 'DE_PowerRusher',
  'RE_42': 'DE_RunStopper',

  // DT archetypes (IDs 43-48)
  'DT_43': 'DT_RunStopper',
  'DT_44': 'DT_PowerRusher',
  'DT_45': 'DT_SpeedRusher',
  'DT_46': 'DT_PowerRusher',
  'DT_47': 'DT_SpeedRusher',
  'DT_48': 'DT_PowerRusher',

  // OLB archetypes (IDs 49-50)
  'LOLB_49': 'OLB_PassCoverage',
  'LOLB_50': 'OLB_RunStopper',
  'ROLB_49': 'OLB_PassCoverage',
  'ROLB_50': 'OLB_RunStopper',

  // MLB archetypes (IDs 51-53)
  'MLB_51': 'MLB_FieldGeneral',
  'MLB_52': 'MLB_PassCoverage',
  'MLB_53': 'MLB_RunStopper',

  // CB archetypes (IDs 54-57)
  'CB_54': 'CB_MantoMan',
  'CB_55': 'CB_Slot',
  'CB_56': 'CB_Zone',
  'CB_57': 'CB_Zone',

  // S archetypes (IDs 58-60)
  'FS_58': 'S_Zone',
  'FS_59': 'S_Hybrid',
  'FS_60': 'S_RunSupport',
  'SS_58': 'S_Zone',
  'SS_59': 'S_Hybrid',
  'SS_60': 'S_RunSupport',

  // K/P archetypes (IDs 61-66)
  'K_61': 'KP_Accurate',
  'K_62': 'KP_Power',
  'K_63': 'KP_Accurate',
  'K_64': 'KP_Accurate',
  'K_65': 'KP_Power',
  'K_66': 'KP_Accurate',
  'P_61': 'KP_Accurate',
  'P_62': 'KP_Power',
  'P_63': 'KP_Accurate',
  'P_64': 'KP_Accurate',
  'P_65': 'KP_Power',
  'P_66': 'KP_Accurate',
};

// Attribute offsets from M26Parser.js
const ATTR_OFFSETS = {
  'PSPD': 0x7B, 'PACC': 0x52, 'PAGI': 0x53, 'PSTR': 0x7F, 'PAWR': 0x54,
  'PJMP': 0x62, 'PSTA': 0x7D, 'PCOD': 0x5C, 'PTGH': 0x88,
  'PCAR': 0x59, 'PBCV': 0x55, 'PBTK': 0x58, 'PLTR': 0x89,
  'PLSA': 0x7E, 'PLSM': 0x7C, 'PLJM': 0x61,
  'PCTH': 0x5A, 'PCIT': 0x5B, 'PSPC': 0x7A,
  'PSRR': 0x75, 'PMRR': 0x74, 'PDRR': 0x73, 'PREL': 0x72,
  'PTHP': 0x86, 'PTAS': 0x84, 'PTAM': 0x83, 'PTAD': 0x81,
  'PTOR': 0x85, 'PTUP': 0x87, 'PPLA': 0x6D, 'PBSK': 0x57,
  'PPBK': 0x6B, 'PPBS': 0x69, 'PPBF': 0x6A,
  'PRBK': 0x78, 'PRBS': 0x77, 'PRBF': 0x76,
  'PLBK': 0x66, 'PLIB': 0x5F,
  'PTAK': 0x80, 'PLHT': 0x5E, 'PLPM': 0x6F, 'PFMS': 0x5D,
  'PBSG': 0x56, 'PLPU': 0x71, 'PLPR': 0x6E,
  'PLMC': 0x68, 'PLZC': 0x8A, 'PLPE': 0x70,
  'PKPW': 0x64, 'PKAC': 0x63, 'PKRT': 0x65
};

const ATTR_NAME_TO_FIELD = {
  'AccelerationRating': 'PACC', 'AgilityRating': 'PAGI', 'AwarenessRating': 'PAWR',
  'BCVisionRating': 'PBCV', 'BlockSheddingRating': 'PBSG', 'BreakSackRating': 'PBSK',
  'BreakTackleRating': 'PBTK', 'CarryingRating': 'PCAR', 'CatchingRating': 'PCTH',
  'CatchInTrafficRating': 'PCIT', 'ChangeOfDirectionRating': 'PCOD',
  'FinesseMovesRating': 'PFMS', 'HitPowerRating': 'PLHT', 'ImpactBlockingRating': 'PLIB',
  'JukeMoveRating': 'PLJM', 'JumpingRating': 'PJMP', 'KickAccuracyRating': 'PKAC',
  'KickPowerRating': 'PKPW', 'LeadBlockRating': 'PLBK', 'ManCoverageRating': 'PLMC',
  'PassBlockFinesseRating': 'PPBF', 'PassBlockPowerRating': 'PPBS', 'PassBlockRating': 'PPBK',
  'PlayActionRating': 'PPLA', 'PlayRecognitionRating': 'PLPR', 'PowerMovesRating': 'PLPM',
  'PressRating': 'PLPE', 'PursuitRating': 'PLPU', 'ReleaseRating': 'PREL',
  'DeepRouteRunningRating': 'PDRR', 'MediumRouteRunningRating': 'PMRR',
  'ShortRouteRunningRating': 'PSRR', 'RunBlockFinesseRating': 'PRBF',
  'RunBlockPowerRating': 'PRBS', 'RunBlockRating': 'PRBK', 'SpectacularCatchRating': 'PSPC',
  'SpeedRating': 'PSPD', 'SpinMoveRating': 'PLSM', 'StaminaRating': 'PSTA',
  'StiffArmRating': 'PLSA', 'StrengthRating': 'PSTR', 'TackleRating': 'PTAK',
  'ThrowAccuracyDeepRating': 'PTAD', 'ThrowAccuracyMidRating': 'PTAM',
  'ThrowAccuracyShortRating': 'PTAS', 'ThrowOnTheRunRating': 'PTOR',
  'ThrowPowerRating': 'PTHP', 'ThrowUnderPressureRating': 'PTUP',
  'TruckingRating': 'PLTR', 'ZoneCoverageRating': 'PLZC',
  'ToughnessRating': 'PTGH', 'KickReturnRating': 'PKRT'
};

// Read real M26 file
const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const real = fs.readFileSync(realPath);

const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

function calculateOVR(attrData, archetypeName) {
  const w = weightsByArchetype[archetypeName];
  if (!w) return 50;

  let sum = 0;
  for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
    const weight = Number(w[attrName]) || 0;
    if (weight > 0) {
      const offset = ATTR_OFFSETS[fieldCode];
      const value = offset !== undefined ? attrData[offset] : 50;
      sum += value * weight;
    }
  }

  return Math.round(sum / 10);
}

console.log('=== Testing OVR with Proper Archetype Mapping ===\n');
console.log('Block | Pos | Arch ID | Archetype Name      | Stored | Calc | Diff | Name');
console.log('------|-----|---------|---------------------|--------|------|------|-----');

let totalDiff = 0;
let count = 0;

for (let i = 0; i < 50; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0xC8 > real.length) break;

  const attrData = real.subarray(attrStart, attrStart + 0xC8);

  const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = real.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const positionId = attrData[0x4a];
  const position = POSITION_NAMES[positionId] || `?${positionId}`;
  const archetypeId = attrData[0x4b];
  const storedOVR = attrData[0x51];

  // Look up archetype name
  const archKey = `${position}_${archetypeId}`;
  const archetypeName = ARCHETYPE_MAP[archKey];

  if (!archetypeName) {
    console.log(`${(i + 1).toString().padStart(5)} | ${position.padEnd(3)} | ${archetypeId.toString().padStart(7)} | UNKNOWN             | ${storedOVR.toString().padStart(6)} | ???? |      | ${firstName} ${lastName}`);
    continue;
  }

  const calcOVR = calculateOVR(attrData, archetypeName);
  const diff = calcOVR - storedOVR;
  totalDiff += Math.abs(diff);
  count++;

  console.log(`${(i + 1).toString().padStart(5)} | ${position.padEnd(3)} | ${archetypeId.toString().padStart(7)} | ${archetypeName.padEnd(19)} | ${storedOVR.toString().padStart(6)} | ${calcOVR.toString().padStart(4)} | ${(diff >= 0 ? '+' : '') + diff.toString().padStart(4)} | ${firstName} ${lastName}`);
}

console.log(`\nAverage absolute difference: ${(totalDiff / count).toFixed(2)}`);
