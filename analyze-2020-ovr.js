/**
 * Analyze 2020 draft class OVR to understand the discrepancy
 * Chase Young: Editor 75, Game 80
 * Jeff Okudah: Editor 74, Game 71
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

// Position and archetype mappings
const POSITION_NAMES = {
  0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
  8: 'RG', 9: 'RT', 10: 'LE', 11: 'RE', 12: 'DT', 13: 'LOLB', 14: 'MLB',
  15: 'ROLB', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
};

// Read prospect by index
function readProspect(index) {
  const blockStart = DATA_START + (index * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const firstName = buffer.toString('ascii', attrStart, attrStart + 0x10).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();

  return {
    firstName,
    lastName,
    positionCode: buffer[attrStart + 0x4a],
    archetypeCode: buffer[attrStart + 0x4b],
    storedOVR: buffer[attrStart + 0x51],
    // Key ratings
    speed: buffer[attrStart + 0x7b],
    acceleration: buffer[attrStart + 0x52],
    agility: buffer[attrStart + 0x53],
    awareness: buffer[attrStart + 0x54],
    // DE-specific
    powerMoves: buffer[attrStart + 0x6f],
    finesseMoves: buffer[attrStart + 0x5d],
    blockShedding: buffer[attrStart + 0x56],
    tackle: buffer[attrStart + 0x80],
    pursuit: buffer[attrStart + 0x71],
    playRecognition: buffer[attrStart + 0x6e],
    strength: buffer[attrStart + 0x7f],
    // CB-specific
    manCoverage: buffer[attrStart + 0x68],
    zoneCoverage: buffer[attrStart + 0x8a],
    pressCoverage: buffer[attrStart + 0x70],
  };
}

// Find Chase Young (LEDG) and Jeff Okudah (CB)
console.log('=== ANALYZING 2020 DRAFT CLASS ===\n');

for (let i = 0; i < 20; i++) {
  const p = readProspect(i);
  const posName = POSITION_NAMES[p.positionCode] || 'UNK';

  if (p.lastName === 'Young' || p.lastName === 'Okudah' || p.lastName === 'Thomas' || i < 5) {
    console.log(`\n=== ${p.firstName} ${p.lastName} (${posName}) ===`);
    console.log(`Position code: ${p.positionCode}, Archetype code: ${p.archetypeCode}`);
    console.log(`Stored OVR in file: ${p.storedOVR}`);
    console.log('Key ratings:');
    console.log(`  SPD: ${p.speed}, ACC: ${p.acceleration}, AGI: ${p.agility}, AWR: ${p.awareness}`);
    console.log(`  STR: ${p.strength}, TAK: ${p.tackle}, PUR: ${p.pursuit}, PRC: ${p.playRecognition}`);
    console.log(`  PMV: ${p.powerMoves}, FMV: ${p.finesseMoves}, BSH: ${p.blockShedding}`);
    console.log(`  MCV: ${p.manCoverage}, ZCV: ${p.zoneCoverage}, PRS: ${p.pressCoverage}`);

    // What archetype formula should we use?
    let archetypeName = null;
    if (posName === 'LE' || posName === 'RE' || posName === 'LEDG' || posName === 'REDG') {
      // DE archetypes: 39=SpeedRusher, 40=PowerRusher, 41=PurePower, 42=RunStopper
      const deArchetypes = {
        39: 'DE_SmallerSpeedRusher',
        40: 'DE_PowerRusher',
        41: 'DE_PowerRusher',
        42: 'DE_RunStopper'
      };
      archetypeName = deArchetypes[p.archetypeCode] || 'DE_PowerRusher';
    } else if (posName === 'CB') {
      // CB archetypes: 54=MantoMan, 55=Slot, 56=Zone, 57=Hybrid
      const cbArchetypes = {
        54: 'CB_MantoMan',
        55: 'CB_Slot',
        56: 'CB_Zone',
        57: 'CB_MantoMan'
      };
      archetypeName = cbArchetypes[p.archetypeCode] || 'CB_Zone';
    }

    if (archetypeName) {
      console.log(`\nArchetype formula: ${archetypeName}`);

      // Calculate OVR with both divisors
      const formula = weights.find(w => w.Archetype === archetypeName);
      if (formula) {
        // Build attributes object
        const attrs = {
          SpeedRating: p.speed,
          AccelerationRating: p.acceleration,
          AgilityRating: p.agility,
          AwarenessRating: p.awareness,
          StrengthRating: p.strength,
          TackleRating: p.tackle,
          PursuitRating: p.pursuit,
          PlayRecognitionRating: p.playRecognition,
          PowerMovesRating: p.powerMoves,
          FinesseMovesRating: p.finesseMoves,
          BlockSheddingRating: p.blockShedding,
          ManCoverageRating: p.manCoverage,
          ZoneCoverageRating: p.zoneCoverage,
          PressRating: p.pressCoverage,
        };

        let weightedSum = 0;
        console.log('\nWeighted calculation:');
        for (const [attrName, value] of Object.entries(attrs)) {
          const weight = parseFloat(formula[attrName]) || 0;
          if (weight > 0) {
            const contrib = value * weight;
            weightedSum += contrib;
            console.log(`  ${attrName.padEnd(22)}: ${value} * ${weight} = ${contrib.toFixed(2)}`);
          }
        }

        console.log(`\nWeighted sum: ${weightedSum.toFixed(2)}`);
        console.log(`OVR with divisor 10: ${Math.round(weightedSum / 10)}`);
        console.log(`OVR with divisor 11.1: ${Math.round(weightedSum / 11.1)}`);
        console.log(`Stored OVR: ${p.storedOVR}`);
      }
    }
  }
}
