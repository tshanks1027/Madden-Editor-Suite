/**
 * Comprehensive OVR validation across ALL positions using Madden 24 roster data
 * This is the definitive test for divisor validation
 */
const XLSX = require('xlsx');
const weights = require('./data/lookups/ovrweights.json');

const workbook = XLSX.readFile('./data/Madden Old Ratings/2024 Rosters.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log(`Loaded ${rows.length} players from M24 roster\n`);

// Column mappings
const colMap = {
  ovr: 'Overall Rating',
  pos: 'Position',
  name: 'Full Name',
  archetype: 'Archetype',
  // Physical
  speed: 'Speed',
  acceleration: 'Acceleration',
  strength: 'Strength',
  agility: 'Agility',
  awareness: 'Awareness',
  stamina: 'Stamina',
  jumping: 'Jumping',
  changeOfDirection: 'Change Of Direction',
  // Tackling/Pass Rush
  tackle: 'Tackle',
  pursuit: 'Pursuit',
  playRecognition: 'Play Recognition',
  powerMoves: 'Power Moves',
  finesseMoves: 'Finesse Moves',
  blockShedding: 'Block Shedding',
  hitPower: 'Hit Power',
  // Coverage
  manCoverage: 'Man Coverage',
  zoneCoverage: 'Zone Coverage',
  press: 'Press',
  // Receiving
  catching: 'Catching',
  catchInTraffic: 'Catch In Traffic',
  spectacularCatch: 'Spectacular Catch',
  shortRouteRunning: 'Short Route Running',
  mediumRouteRunning: 'Medium Route Running',
  deepRouteRunning: 'Deep Route Running',
  release: 'Release',
  // Running
  carrying: 'Carrying',
  breakTackle: 'Break Tackle',
  trucking: 'Trucking',
  stiffArm: 'Stiff Arm',
  spinMove: 'Spin Move',
  jukeMove: 'Juke Move',
  ballCarrierVision: 'Ball Carrier Vision',
  // Blocking
  runBlock: 'Run Block',
  runBlockPower: 'Run Block Power',
  runBlockFinesse: 'Run Block Finesse',
  passBlock: 'Pass Block',
  passBlockPower: 'Pass Block Power',
  passBlockFinesse: 'Pass Block Finesse',
  impactBlocking: 'Impact Blocking',
  leadBlock: 'Lead Block',
  // Throwing
  throwPower: 'Throw Power',
  throwAccuracyShort: 'Throw Accuracy Short',
  throwAccuracyMid: 'Throw Accuracy Mid',
  throwAccuracyDeep: 'Throw Accuracy Deep',
  throwOnTheRun: 'Throw On The Run',
  throwUnderPressure: 'Throw Under Pressure',
  playAction: 'Play Action',
  breakSack: 'Break Sack',
  // Kicking
  kickPower: 'Kick Power',
  kickAccuracy: 'Kick Accuracy',
};

// Build attribute map for formula
function buildAttrMap(row) {
  return {
    'SpeedRating': parseInt(row[colMap.speed]) || 0,
    'AccelerationRating': parseInt(row[colMap.acceleration]) || 0,
    'AgilityRating': parseInt(row[colMap.agility]) || 0,
    'AwarenessRating': parseInt(row[colMap.awareness]) || 0,
    'StrengthRating': parseInt(row[colMap.strength]) || 0,
    'JumpingRating': parseInt(row[colMap.jumping]) || 0,
    'StaminaRating': parseInt(row[colMap.stamina]) || 0,
    'ChangeOfDirectionRating': parseInt(row[colMap.changeOfDirection]) || 0,
    'TackleRating': parseInt(row[colMap.tackle]) || 0,
    'PursuitRating': parseInt(row[colMap.pursuit]) || 0,
    'PlayRecognitionRating': parseInt(row[colMap.playRecognition]) || 0,
    'PowerMovesRating': parseInt(row[colMap.powerMoves]) || 0,
    'FinesseMovesRating': parseInt(row[colMap.finesseMoves]) || 0,
    'BlockSheddingRating': parseInt(row[colMap.blockShedding]) || 0,
    'HitPowerRating': parseInt(row[colMap.hitPower]) || 0,
    'ManCoverageRating': parseInt(row[colMap.manCoverage]) || 0,
    'ZoneCoverageRating': parseInt(row[colMap.zoneCoverage]) || 0,
    'PressRating': parseInt(row[colMap.press]) || 0,
    'CatchingRating': parseInt(row[colMap.catching]) || 0,
    'CatchInTrafficRating': parseInt(row[colMap.catchInTraffic]) || 0,
    'SpectacularCatchRating': parseInt(row[colMap.spectacularCatch]) || 0,
    'ShortRouteRunningRating': parseInt(row[colMap.shortRouteRunning]) || 0,
    'MediumRouteRunningRating': parseInt(row[colMap.mediumRouteRunning]) || 0,
    'DeepRouteRunningRating': parseInt(row[colMap.deepRouteRunning]) || 0,
    'ReleaseRating': parseInt(row[colMap.release]) || 0,
    'CarryingRating': parseInt(row[colMap.carrying]) || 0,
    'BreakTackleRating': parseInt(row[colMap.breakTackle]) || 0,
    'TruckingRating': parseInt(row[colMap.trucking]) || 0,
    'StiffArmRating': parseInt(row[colMap.stiffArm]) || 0,
    'SpinMoveRating': parseInt(row[colMap.spinMove]) || 0,
    'JukeMoveRating': parseInt(row[colMap.jukeMove]) || 0,
    'BCVisionRating': parseInt(row[colMap.ballCarrierVision]) || 0,
    'RunBlockRating': parseInt(row[colMap.runBlock]) || 0,
    'RunBlockPowerRating': parseInt(row[colMap.runBlockPower]) || 0,
    'RunBlockFinesseRating': parseInt(row[colMap.runBlockFinesse]) || 0,
    'PassBlockRating': parseInt(row[colMap.passBlock]) || 0,
    'PassBlockPowerRating': parseInt(row[colMap.passBlockPower]) || 0,
    'PassBlockFinesseRating': parseInt(row[colMap.passBlockFinesse]) || 0,
    'ImpactBlockingRating': parseInt(row[colMap.impactBlocking]) || 0,
    'LeadBlockRating': parseInt(row[colMap.leadBlock]) || 0,
    'ThrowPowerRating': parseInt(row[colMap.throwPower]) || 0,
    'ThrowAccuracyShortRating': parseInt(row[colMap.throwAccuracyShort]) || 0,
    'ThrowAccuracyMidRating': parseInt(row[colMap.throwAccuracyMid]) || 0,
    'ThrowAccuracyDeepRating': parseInt(row[colMap.throwAccuracyDeep]) || 0,
    'ThrowOnTheRunRating': parseInt(row[colMap.throwOnTheRun]) || 0,
    'ThrowUnderPressureRating': parseInt(row[colMap.throwUnderPressure]) || 0,
    'PlayActionRating': parseInt(row[colMap.playAction]) || 0,
    'BreakSackRating': parseInt(row[colMap.breakSack]) || 0,
    'KickPowerRating': parseInt(row[colMap.kickPower]) || 0,
    'KickAccuracyRating': parseInt(row[colMap.kickAccuracy]) || 0,
  };
}

function calculateOVR(row, formulaName, divisor) {
  const formula = weights.find(w => w.Archetype === formulaName);
  if (!formula) return null;

  const attrMap = buildAttrMap(row);
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

// Group by position and archetype
const byPosArch = {};

for (const row of rows) {
  const pos = row[colMap.pos];
  const arch = row[colMap.archetype];
  const actual = parseInt(row[colMap.ovr]);

  if (!pos || !arch || !actual) continue;

  const key = `${pos}|${arch}`;

  const calc10 = calculateOVR(row, arch, 10);
  const calc11 = calculateOVR(row, arch, 11);

  if (!calc10 || !calc11) continue;

  if (!byPosArch[key]) {
    byPosArch[key] = {
      pos,
      arch,
      players: []
    };
  }

  byPosArch[key].players.push({
    name: row[colMap.name],
    actual,
    div10: calc10.ovr,
    div11: calc11.ovr,
    sum: calc10.sum
  });
}

// Calculate stats per position/archetype
console.log('='.repeat(110));
console.log('COMPREHENSIVE OVR VALIDATION - Madden 24 Roster Data (2368 players)');
console.log('='.repeat(110));
console.log('');
console.log('Position | Archetype                    | Count | Div10 Err | Div11 Err | Better | Exact10 | Exact11');
console.log('-'.repeat(110));

let totalDiv10Errors = 0;
let totalDiv11Errors = 0;
let totalPlayers = 0;
let div10Wins = 0;
let div11Wins = 0;

const sortedKeys = Object.keys(byPosArch).sort((a, b) => {
  const [posA] = a.split('|');
  const [posB] = b.split('|');
  return posA.localeCompare(posB);
});

for (const key of sortedKeys) {
  const data = byPosArch[key];
  const players = data.players;

  const div10Errors = players.map(p => Math.abs(p.div10 - p.actual));
  const div11Errors = players.map(p => Math.abs(p.div11 - p.actual));

  const avgDiv10 = div10Errors.reduce((a, b) => a + b, 0) / div10Errors.length;
  const avgDiv11 = div11Errors.reduce((a, b) => a + b, 0) / div11Errors.length;

  const exact10 = players.filter(p => p.div10 === p.actual).length;
  const exact11 = players.filter(p => p.div11 === p.actual).length;

  const better = avgDiv10 < avgDiv11 ? 'Div10' : (avgDiv11 < avgDiv10 ? 'Div11' : 'TIE');

  if (avgDiv10 < avgDiv11) div10Wins++;
  else if (avgDiv11 < avgDiv10) div11Wins++;

  totalDiv10Errors += div10Errors.reduce((a, b) => a + b, 0);
  totalDiv11Errors += div11Errors.reduce((a, b) => a + b, 0);
  totalPlayers += players.length;

  console.log(
    `${data.pos.padEnd(8)} | ${data.arch.padEnd(28)} | ${String(players.length).padStart(5)} | ${avgDiv10.toFixed(2).padStart(9)} | ${avgDiv11.toFixed(2).padStart(9)} | ${better.padStart(6)} | ${String(exact10).padStart(7)} | ${String(exact11).padStart(7)}`
  );
}

console.log('-'.repeat(110));
console.log('');
console.log('='.repeat(110));
console.log('OVERALL SUMMARY');
console.log('='.repeat(110));
console.log(`Total players analyzed: ${totalPlayers}`);
console.log(`Overall Div10 average error: ${(totalDiv10Errors / totalPlayers).toFixed(2)}`);
console.log(`Overall Div11 average error: ${(totalDiv11Errors / totalPlayers).toFixed(2)}`);
console.log(`Archetype categories where Div10 is better: ${div10Wins}`);
console.log(`Archetype categories where Div11 is better: ${div11Wins}`);
console.log('');
console.log(`WINNER: ${totalDiv10Errors < totalDiv11Errors ? 'DIVISOR 10' : 'DIVISOR 11'}`);
console.log('');

// Show sample players with exact matches
console.log('='.repeat(110));
console.log('SAMPLE EXACT MATCHES WITH DIVISOR 11');
console.log('='.repeat(110));
let shown = 0;
for (const key of sortedKeys) {
  const data = byPosArch[key];
  for (const p of data.players) {
    if (p.div11 === p.actual && shown < 20) {
      console.log(`${p.name.padEnd(30)} | ${data.pos.padEnd(5)} | ${data.arch.padEnd(25)} | Actual: ${p.actual} = Div11: ${p.div11}`);
      shown++;
    }
  }
}
