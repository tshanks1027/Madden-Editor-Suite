/**
 * Compare OVR stored in M26 file (0x51) vs calculated OVR
 * This will show if the problem is in reading, writing, or calculation
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

// Position to JSON position mapping
const POSITION_TO_JSON = {
  'QB': 'QB', 'HB': 'HB', 'FB': 'FB', 'WR': 'WR', 'TE': 'TE',
  'LT': 'OT', 'RT': 'OT', 'LG': 'G', 'RG': 'G', 'C': 'C',
  'LE': 'DE', 'RE': 'DE', 'DT': 'DT',
  'LOLB': 'OLB', 'ROLB': 'OLB', 'MLB': 'MLB',
  'CB': 'CB', 'FS': 'S', 'SS': 'S', 'K': 'KP', 'P': 'KP'
};

// Default archetypes
const DEFAULT_ARCHETYPES = {
  'QB': 'QB_FieldGeneral', 'HB': 'HB_PowerBack', 'FB': 'FB_Blocking',
  'WR': 'WR_Playmaker', 'TE': 'TE_Possession',
  'OT': 'OT_PassProtector', 'G': 'G_PassProtector', 'C': 'C_PassProtector',
  'DE': 'DE_PowerRusher', 'DT': 'DT_RunStopper',
  'OLB': 'OLB_PassCoverage', 'MLB': 'MLB_FieldGeneral',
  'CB': 'CB_Zone', 'S': 'S_Zone', 'KP': 'KP_Accurate'
};

// Attribute offsets from M26Parser.js (THESE ARE THE KEY!)
const ATTR_OFFSETS = {
  'PSPD': 0x7B,
  'PACC': 0x52,
  'PAGI': 0x53,
  'PSTR': 0x7F,
  'PAWR': 0x54,
  'PJMP': 0x62,
  'PSTA': 0x7D,
  'PCOD': 0x5C,  // changeOfDirection
  'PTGH': 0x88,  // toughness
  'PCAR': 0x59,
  'PBCV': 0x55,
  'PBTK': 0x58,
  'PLTR': 0x89,  // trucking
  'PLSA': 0x7E,  // stiffArm
  'PLSM': 0x7C,  // spinMove
  'PLJM': 0x61,  // jukeMove
  'PCTH': 0x5A,
  'PCIT': 0x5B,
  'PSPC': 0x7A,
  'PSRR': 0x75,
  'PMRR': 0x74,
  'PDRR': 0x73,
  'PREL': 0x72,
  'PTHP': 0x86,
  'PTAS': 0x84,
  'PTAM': 0x83,
  'PTAD': 0x81,
  'PTOR': 0x85,
  'PTUP': 0x87,
  'PPLA': 0x6D,
  'PBSK': 0x57,  // breakSack
  'PPBK': 0x6B,
  'PPBS': 0x69,  // passBlockPower
  'PPBF': 0x6A,  // passBlockFinesse
  'PRBK': 0x78,
  'PRBS': 0x77,  // runBlockPower
  'PRBF': 0x76,  // runBlockFinesse
  'PLBK': 0x66,  // leadBlock
  'PLIB': 0x5F,  // impactBlocking
  'PTAK': 0x80,
  'PLHT': 0x5E,  // hitPower
  'PLPM': 0x6F,  // powerMoves
  'PFMS': 0x5D,  // finesseMoves
  'PBSG': 0x56,  // blockShedding
  'PLPU': 0x71,  // pursuit
  'PLPR': 0x6E,  // playRecognition
  'PLMC': 0x68,  // manCoverage
  'PLZC': 0x8A,  // zoneCoverage
  'PLPE': 0x70,  // pressCoverage
  'PKPW': 0x64,  // kickPower
  'PKAC': 0x63,  // kickAccuracy
  'PKRT': 0x65   // kickReturn
};

// Mapping from OVRWeightsCalculator
const ATTR_NAME_TO_FIELD = {
  'AccelerationRating': 'PACC',
  'AgilityRating': 'PAGI',
  'AwarenessRating': 'PAWR',
  'BCVisionRating': 'PBCV',
  'BlockSheddingRating': 'PBSG',
  'BreakSackRating': 'PBSK',
  'BreakTackleRating': 'PBTK',
  'CarryingRating': 'PCAR',
  'CatchingRating': 'PCTH',
  'CatchInTrafficRating': 'PCIT',
  'ChangeOfDirectionRating': 'PCOD',
  'FinesseMovesRating': 'PFMS',
  'HitPowerRating': 'PLHT',
  'ImpactBlockingRating': 'PLIB',
  'JukeMoveRating': 'PLJM',
  'JumpingRating': 'PJMP',
  'KickAccuracyRating': 'PKAC',
  'KickPowerRating': 'PKPW',
  'LeadBlockRating': 'PLBK',
  'ManCoverageRating': 'PLMC',
  'PassBlockFinesseRating': 'PPBF',
  'PassBlockPowerRating': 'PPBS',
  'PassBlockRating': 'PPBK',
  'PlayActionRating': 'PPLA',
  'PlayRecognitionRating': 'PLPR',
  'PowerMovesRating': 'PLPM',
  'PressRating': 'PLPE',
  'PursuitRating': 'PLPU',
  'ReleaseRating': 'PREL',
  'DeepRouteRunningRating': 'PDRR',
  'MediumRouteRunningRating': 'PMRR',
  'ShortRouteRunningRating': 'PSRR',
  'RunBlockFinesseRating': 'PRBF',
  'RunBlockPowerRating': 'PRBS',
  'RunBlockRating': 'PRBK',
  'SpectacularCatchRating': 'PSPC',
  'SpeedRating': 'PSPD',
  'SpinMoveRating': 'PLSM',
  'StaminaRating': 'PSTA',
  'StiffArmRating': 'PLSA',
  'StrengthRating': 'PSTR',
  'TackleRating': 'PTAK',
  'ThrowAccuracyDeepRating': 'PTAD',
  'ThrowAccuracyMidRating': 'PTAM',
  'ThrowAccuracyShortRating': 'PTAS',
  'ThrowOnTheRunRating': 'PTOR',
  'ThrowPowerRating': 'PTHP',
  'ThrowUnderPressureRating': 'PTUP',
  'TruckingRating': 'PLTR',
  'ZoneCoverageRating': 'PLZC',
  'ToughnessRating': 'PTGH',
  'KickReturnRating': 'PKRT'
};

// Read real M26 file
const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const real = fs.readFileSync(realPath);

const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

console.log('=== Comparing Stored OVR vs Calculated OVR ===\n');

function calculateOVR(attrData, position, archetype) {
  const jsonPos = POSITION_TO_JSON[position] || position;
  const arch = archetype || DEFAULT_ARCHETYPES[jsonPos];
  const w = weightsByArchetype[arch];

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

console.log('Block | Pos | Stored OVR | Calc OVR | Diff | Name');
console.log('------|-----|------------|----------|------|-----');

for (let i = 0; i < 50; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0xC8 > real.length) break;

  const attrData = real.subarray(attrStart, attrStart + 0xC8);

  const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = real.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const positionId = attrData[0x4a];
  const position = POSITION_NAMES[positionId] || `?${positionId}`;
  const storedOVR = attrData[0x51];

  const calcOVR = calculateOVR(attrData, position, null);
  const diff = calcOVR - storedOVR;

  console.log(`${(i + 1).toString().padStart(5)} | ${position.padEnd(3)} | ${storedOVR.toString().padStart(10)} | ${calcOVR.toString().padStart(8)} | ${(diff >= 0 ? '+' : '') + diff.toString().padStart(4)} | ${firstName} ${lastName}`);
}

// Detailed breakdown for first QB
console.log('\n\n=== Detailed OVR Breakdown for First QB ===');

for (let i = 0; i < 50; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;
  const attrData = real.subarray(attrStart, attrStart + 0xC8);

  const positionId = attrData[0x4a];
  if (positionId !== 0) continue; // Only QB

  const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = real.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const storedOVR = attrData[0x51];

  console.log(`\nPlayer: ${firstName} ${lastName}`);
  console.log(`Stored OVR: ${storedOVR}`);
  console.log(`Position: QB`);

  const jsonPos = 'QB';
  const arch = DEFAULT_ARCHETYPES[jsonPos];
  console.log(`Archetype: ${arch}`);

  const w = weightsByArchetype[arch];
  if (!w) {
    console.log('No weights found!');
    break;
  }

  console.log('\nWeighted attributes (only non-zero weights):');
  let sum = 0;
  for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
    const weight = Number(w[attrName]) || 0;
    if (weight > 0) {
      const offset = ATTR_OFFSETS[fieldCode];
      const value = offset !== undefined ? attrData[offset] : 50;
      const contribution = value * weight;
      sum += contribution;
      console.log(`  ${attrName.padEnd(25)}: ${value.toString().padStart(3)} x ${weight.toString().padStart(4)} = ${contribution.toFixed(2).padStart(8)}`);
    }
  }

  console.log(`\nTotal weighted sum: ${sum.toFixed(2)}`);
  console.log(`Calculated OVR (sum/10): ${Math.round(sum / 10)}`);

  break; // Just first QB
}
