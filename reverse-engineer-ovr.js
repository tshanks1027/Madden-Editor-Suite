/**
 * Reverse engineer OVR formula by comparing our calculation to real Madden 24 roster data
 */
const XLSX = require('xlsx');
const weights = require('./data/lookups/ovrweights.json');

const workbook = XLSX.readFile('./data/Madden Old Ratings/2024 Rosters.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

// Column mappings
const colMap = {
  ovr: 'Overall Rating',
  pos: 'Position',
  name: 'Full Name',
  archetype: 'Archetype',
  speed: 'Speed',
  acceleration: 'Acceleration',
  strength: 'Strength',
  agility: 'Agility',
  awareness: 'Awareness',
  tackle: 'Tackle',
  pursuit: 'Pursuit',
  playRecognition: 'Play Recognition',
  powerMoves: 'Power Moves',
  finesseMoves: 'Finesse Moves',
  blockShedding: 'Block Shedding',
  hitPower: 'Hit Power',
  manCoverage: 'Man Coverage',
  zoneCoverage: 'Zone Coverage',
  press: 'Press',
  changeOfDirection: 'Change Of Direction',
  jumping: 'Jumping',
  catching: 'Catching',
};

// Map archetype names to formula names
function getFormulaName(archetype, position) {
  const archetypeToFormula = {
    // DE archetypes
    'Speed Rusher': 'DE_SmallerSpeedRusher',
    'Power Rusher': 'DE_PowerRusher',
    'Run Stopper': 'DE_RunStopper',
    // CB archetypes
    'Man to Man': 'CB_MantoMan',
    'Zone': 'CB_Zone',
    'Slot': 'CB_Slot',
  };

  // Add position prefix if needed
  if (position === 'LE' || position === 'RE') {
    if (archetype === 'Speed Rusher') return 'DE_SmallerSpeedRusher';
    if (archetype === 'Power Rusher') return 'DE_PowerRusher';
    if (archetype === 'Run Stopper') return 'DE_RunStopper';
  }
  if (position === 'CB') {
    if (archetype === 'Man to Man') return 'CB_MantoMan';
    if (archetype === 'Zone') return 'CB_Zone';
    if (archetype === 'Slot') return 'CB_Slot';
  }

  return archetypeToFormula[archetype] || null;
}

function calculateOVR(row, formulaName) {
  const formula = weights.find(w => w.Archetype === formulaName);
  if (!formula) return null;

  let sum = 0;

  // Map our attributes to formula attributes
  const attrMappings = {
    'SpeedRating': parseInt(row[colMap.speed]) || 0,
    'AccelerationRating': parseInt(row[colMap.acceleration]) || 0,
    'AgilityRating': parseInt(row[colMap.agility]) || 0,
    'AwarenessRating': parseInt(row[colMap.awareness]) || 0,
    'StrengthRating': parseInt(row[colMap.strength]) || 0,
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
    'ChangeOfDirectionRating': parseInt(row[colMap.changeOfDirection]) || 0,
    'JumpingRating': parseInt(row[colMap.jumping]) || 0,
    'CatchingRating': parseInt(row[colMap.catching]) || 0,
  };

  for (const [attr, value] of Object.entries(attrMappings)) {
    const weight = parseFloat(formula[attr]) || 0;
    sum += value * weight;
  }

  return { sum, div10: Math.round(sum / 10), div11: Math.round(sum / 11) };
}

// Analyze DEs
console.log('=== LEFT ENDS (LE) - Speed Rusher ===\n');
const LEs = rows.filter(r => r[colMap.pos] === 'LE' && r[colMap.archetype] === 'DE_SmallerSpeedRusher').slice(0, 10);
let totalError10 = 0, totalError11 = 0, count = 0;

LEs.forEach(row => {
  const actual = parseInt(row[colMap.ovr]);
  const calc = calculateOVR(row, 'DE_SmallerSpeedRusher');
  if (calc) {
    const err10 = calc.div10 - actual;
    const err11 = calc.div11 - actual;
    const needed = (calc.sum / actual).toFixed(2);
    console.log(`${row[colMap.name].padEnd(25)} OVR:${actual} | Div10:${calc.div10}(${err10>=0?'+':''}${err10}) | Div11:${calc.div11}(${err11>=0?'+':''}${err11}) | Need:${needed}`);
    totalError10 += Math.abs(err10);
    totalError11 += Math.abs(err11);
    count++;
  }
});
console.log(`\nAvg error: Div10=${(totalError10/count).toFixed(1)}, Div11=${(totalError11/count).toFixed(1)}`);

// Analyze CBs
console.log('\n=== CORNERBACKS (CB) - Man to Man ===\n');
const CBs = rows.filter(r => r[colMap.pos] === 'CB' && r[colMap.archetype] === 'CB_MantoMan').slice(0, 10);
totalError10 = 0; totalError11 = 0; count = 0;

CBs.forEach(row => {
  const actual = parseInt(row[colMap.ovr]);
  const calc = calculateOVR(row, 'CB_MantoMan');
  if (calc) {
    const err10 = calc.div10 - actual;
    const err11 = calc.div11 - actual;
    const needed = (calc.sum / actual).toFixed(2);
    console.log(`${row[colMap.name].padEnd(25)} OVR:${actual} | Div10:${calc.div10}(${err10>=0?'+':''}${err10}) | Div11:${calc.div11}(${err11>=0?'+':''}${err11}) | Need:${needed}`);
    totalError10 += Math.abs(err10);
    totalError11 += Math.abs(err11);
    count++;
  }
});
console.log(`\nAvg error: Div10=${(totalError10/count).toFixed(1)}, Div11=${(totalError11/count).toFixed(1)}`);

// Summary by position
console.log('\n=== SUMMARY BY POSITION ===\n');

const positions = ['QB', 'HB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS'];
positions.forEach(pos => {
  const players = rows.filter(r => r[colMap.pos] === pos);
  if (players.length === 0) return;

  // Get unique archetypes for this position
  const archetypes = [...new Set(players.map(p => p[colMap.archetype]))];
  console.log(`${pos}: ${players.length} players, archetypes: ${archetypes.join(', ')}`);
});
