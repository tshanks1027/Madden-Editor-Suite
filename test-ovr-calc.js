/**
 * Test OVR calculation against ROSTER_lookup.csv
 * Verify that our OVR calculation matches the expected values
 */
const fs = require('fs');
const path = require('path');

// Read OVR weights
const weightsPath = path.join(__dirname, 'data/lookups/ovrweights.json');
const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));

// Read ROSTER_lookup.csv
const rosterPath = path.join(__dirname, 'data/lookups/ROSTER_lookup.csv');
const rosterCsv = fs.readFileSync(rosterPath, 'utf-8');
const lines = rosterCsv.split('\n');
const header = lines[0].split(',');

// Parse header to get column indices
const colIndex = {};
header.forEach((col, i) => colIndex[col] = i);

// Map attribute columns
const ATTR_MAP = {
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
  'FinesseMovesRating': 'PFNM',
  'HitPowerRating': 'PHTP',
  'ImpactBlockingRating': 'PIBL',
  'InjuryRating': 'PINJ',
  'JukeMoveRating': 'PJUM',
  'JumpingRating': 'PJMP',
  'KickAccuracyRating': 'PKAC',
  'KickPowerRating': 'PKPW',
  'LeadBlockRating': 'PLDB',
  'ManCoverageRating': 'PMCV',
  'PassBlockFinesseRating': 'PPBF',
  'PassBlockPowerRating': 'PPBP',
  'PassBlockRating': 'PPBK',
  'PlayActionRating': 'PPLA',
  'PlayRecognitionRating': 'PPRC',
  'PowerMovesRating': 'PPWM',
  'PressRating': 'PPRS',
  'PursuitRating': 'PPUR',
  'ReleaseRating': 'PREL',
  'DeepRouteRunningRating': 'PDRR',
  'MediumRouteRunningRating': 'PMRR',
  'ShortRouteRunningRating': 'PSRR',
  'RunBlockFinesseRating': 'PRBF',
  'RunBlockPowerRating': 'PRBP',
  'RunBlockRating': 'PRBK',
  'SpectacularCatchRating': 'PSPC',
  'SpeedRating': 'PSPD',
  'SpinMoveRating': 'PSPM',
  'StaminaRating': 'PSTA',
  'StiffArmRating': 'PSTF',
  'StrengthRating': 'PSTR',
  'TackleRating': 'PTAK',
  'ThrowAccuracyDeepRating': 'PTAD',
  'ThrowAccuracyMidRating': 'PTAM',
  'ThrowAccuracyShortRating': 'PTAS',
  'ThrowOnTheRunRating': 'PTOR',
  'ThrowPowerRating': 'PTHP',
  'ThrowUnderPressureRating': 'PTUP',
  'TruckingRating': 'PTRK',
  'ZoneCoverageRating': 'PZCV',
  'ToughnessRating': 'PTGH',
  'KickReturnRating': 'PKRT'
};

// Reverse mapping
const FIELD_TO_ATTR = {};
for (const [attr, field] of Object.entries(ATTR_MAP)) {
  FIELD_TO_ATTR[field] = attr;
}

// Default archetypes
const DEFAULT_ARCHETYPES = {
  'QB': 'QB_FieldGeneral',
  'HB': 'HB_PowerBack',
  'FB': 'FB_Blocking',
  'WR': 'WR_Playmaker',
  'TE': 'TE_Possession',
  'LT': 'OT_PassProtector',
  'RT': 'OT_PassProtector',
  'LG': 'G_PassProtector',
  'RG': 'G_PassProtector',
  'C': 'C_PassProtector',
  'LE': 'DE_PowerRusher',
  'RE': 'DE_PowerRusher',
  'LEDG': 'DE_PowerRusher',
  'REDG': 'DE_PowerRusher',
  'DT': 'DT_RunStopper',
  'LOLB': 'OLB_PassCoverage',
  'ROLB': 'OLB_PassCoverage',
  'SAM': 'OLB_PassCoverage',
  'WILL': 'OLB_PassCoverage',
  'MLB': 'MLB_FieldGeneral',
  'MIKE': 'MLB_FieldGeneral',
  'CB': 'CB_Zone',
  'FS': 'S_Zone',
  'SS': 'S_Zone',
  'K': 'KP_Accurate',
  'P': 'KP_Accurate'
};

// Get weights by archetype
const weightsByArchetype = {};
for (const w of weights) {
  weightsByArchetype[w.Archetype] = w;
}

function calculateOVR(player, position, archetype) {
  const arch = archetype || DEFAULT_ARCHETYPES[position];
  const w = weightsByArchetype[arch];

  if (!w) {
    console.log(`No weights for archetype: ${arch}`);
    return 50;
  }

  let sum = 0;
  for (const [attrName, fieldCode] of Object.entries(ATTR_MAP)) {
    const weight = Number(w[attrName]) || 0;
    if (weight > 0) {
      const value = Number(player[fieldCode]) || 50;
      sum += value * weight;
    }
  }

  return Math.round(sum / 10);
}

// Test with some QBs from ROSTER_lookup
console.log('=== Testing OVR Calculation vs ROSTER_lookup ===\n');

// Parse a few players
const players = [];
for (let i = 1; i < Math.min(100, lines.length); i++) {
  const cols = lines[i].split(',');
  if (cols.length < 20) continue;

  const player = {};
  for (const [name, idx] of Object.entries(colIndex)) {
    player[name] = cols[idx];
  }
  players.push(player);
}

// Filter QBs
const qbs = players.filter(p => p.Position === 'QB');
console.log(`Found ${qbs.length} QBs in first 100 players\n`);

console.log('Player Name | Pos | Archetype | Expected OVR | Calc OVR | Diff');
console.log('------------|-----|-----------|--------------|----------|------');

for (const qb of qbs.slice(0, 10)) {
  const name = `${qb.First_Name} ${qb.Last_Name}`;
  const position = qb.Position;
  const archetype = qb.Archetype;
  const expectedOVR = Number(qb.POVR);

  // Build attribute object
  const attrs = {};
  for (const [attrName, fieldCode] of Object.entries(ATTR_MAP)) {
    const csvCol = fieldCode.replace(/^P/, ''); // PSPD -> SPD
    if (colIndex[fieldCode]) {
      attrs[fieldCode] = Number(qb[colIndex[fieldCode]]) || 50;
    } else {
      // Try to find the column by matching
      for (const col of Object.keys(colIndex)) {
        if (col === fieldCode || col === `P${col}`) {
          attrs[fieldCode] = Number(qb[col]) || 50;
          break;
        }
      }
    }
  }

  // Map from CSV columns to field codes
  attrs.PSPD = Number(qb.PSPD) || 50;
  attrs.PACC = Number(qb.PACC) || 50;
  attrs.PSTR = Number(qb.PSTR) || 50;
  attrs.PAGI = Number(qb.PAGI) || 50;
  attrs.PAWR = Number(qb.PAWR) || 50;
  attrs.PTHP = Number(qb.PTHP) || 50;
  attrs.PTAS = Number(qb.PTAS) || 50;
  attrs.PTAM = Number(qb.PTAM) || 50;
  attrs.PTAD = Number(qb.PTAD) || 50;
  attrs.PTOR = Number(qb.PTOR) || 50;
  attrs.PTUP = Number(qb.PTUP) || 50;
  attrs.PPLA = Number(qb.PPLA) || 50;
  attrs.PBSK = Number(qb.PBSK) || 50;

  const calcOVR = calculateOVR(attrs, position, archetype);
  const diff = calcOVR - expectedOVR;

  console.log(`${name.padEnd(12)} | ${position.padEnd(3)} | ${(archetype || 'default').padEnd(17)} | ${expectedOVR.toString().padStart(12)} | ${calcOVR.toString().padStart(8)} | ${diff.toString().padStart(4)}`);
}

// Let's manually calculate one QB
console.log('\n\n=== Manual OVR Calculation for John Brodie (QB) ===');
const brodie = qbs.find(q => q.Last_Name === 'Brodie');
if (brodie) {
  const arch = brodie.Archetype || 'QB_FieldGeneral';
  const w = weightsByArchetype[arch] || weightsByArchetype['QB_FieldGeneral'];

  console.log(`Archetype: ${arch}`);
  console.log(`Expected OVR: ${brodie.POVR}`);
  console.log('\nWeighted attributes:');

  let sum = 0;
  for (const [attrName, weight] of Object.entries(w)) {
    if (typeof weight === 'number' && weight > 0 && attrName.endsWith('Rating')) {
      const fieldCode = ATTR_MAP[attrName];
      const value = Number(brodie[fieldCode]) || 50;
      const contribution = value * weight;
      sum += contribution;
      console.log(`  ${attrName}: ${value} x ${weight} = ${contribution.toFixed(2)}`);
    }
  }

  console.log(`\nTotal weighted sum: ${sum.toFixed(2)}`);
  console.log(`OVR (sum/10): ${Math.round(sum / 10)}`);
}
