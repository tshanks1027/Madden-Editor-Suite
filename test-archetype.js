/**
 * Archetype Test Script
 *
 * PURPOSE: Create test players to verify archetype affects OVR calculation
 * This is a RESEARCH tool, not production code.
 *
 * USAGE: node test-archetype.js <path-to-roster>
 *
 * TEST PLAN:
 * Create players with SAME ratings but DIFFERENT archetypes
 * See if OVR is calculated differently based on archetype
 */

const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

// Archetype IDs from schema 677
const ARCHETYPES = {
  // QB
  QB_FieldGeneral: 0,
  QB_StrongArm: 1,
  QB_Improviser: 2,
  QB_Scrambler: 3,
  // HB
  HB_PowerBack: 5,
  HB_ElusiveBack: 6,
  HB_ReceivingBack: 7,
  // WR
  WR_DeepThreat: 14,
  WR_Playmaker: 15,
  WR_Physical: 20,
  WR_Slot: 21,
  // TE
  TE_Blocking: 22,
  TE_VerticalThreat: 23,
  TE_Possession: 26,
  // OL
  C_PassProtector: 27,
  C_Power: 28,
  OT_PassProtector: 31,
  OT_Power: 32,
  G_PassProtector: 35,
  G_Power: 37,
  // DL
  DE_SpeedRusher: 39,
  DE_PowerRusher: 40,
  DT_NoseTackle: 43,
  DT_SpeedRusher: 45,
  // LB
  OLB_SpeedRusher: 47,
  OLB_PassCoverage: 49,
  MLB_FieldGeneral: 51,
  MLB_PassCoverage: 52,
  // DB
  CB_ManToMan: 54,
  CB_Slot: 55,
  CB_Zone: 56,
  S_Zone: 58,
  S_Hybrid: 59,
};

// Test cases - same position, same ratings, different archetypes
// First name = position, Last name = ZZARCH + identifier (sortable)
const TEST_CASES = [
  // QB Tests - all same stats
  { firstName: 'QB', lastName: 'ZZARCH-A1-FieldGen', pos: 0, arch: ARCHETYPES.QB_FieldGeneral, archName: 'Field General' },
  { firstName: 'QB', lastName: 'ZZARCH-A2-Scrambler', pos: 0, arch: ARCHETYPES.QB_Scrambler, archName: 'Scrambler' },
  { firstName: 'QB', lastName: 'ZZARCH-A3-StrongArm', pos: 0, arch: ARCHETYPES.QB_StrongArm, archName: 'Strong Arm' },

  // HB Tests
  { firstName: 'HB', lastName: 'ZZARCH-B1-Power', pos: 1, arch: ARCHETYPES.HB_PowerBack, archName: 'Power Back' },
  { firstName: 'HB', lastName: 'ZZARCH-B2-Elusive', pos: 1, arch: ARCHETYPES.HB_ElusiveBack, archName: 'Elusive Back' },
  { firstName: 'HB', lastName: 'ZZARCH-B3-Receiving', pos: 1, arch: ARCHETYPES.HB_ReceivingBack, archName: 'Receiving Back' },

  // WR Tests
  { firstName: 'WR', lastName: 'ZZARCH-C1-DeepThreat', pos: 3, arch: ARCHETYPES.WR_DeepThreat, archName: 'Deep Threat' },
  { firstName: 'WR', lastName: 'ZZARCH-C2-Slot', pos: 3, arch: ARCHETYPES.WR_Slot, archName: 'Slot' },
  { firstName: 'WR', lastName: 'ZZARCH-C3-Physical', pos: 3, arch: ARCHETYPES.WR_Physical, archName: 'Physical' },

  // CB Tests (position 16 = CB, not 11 which is REDG!)
  { firstName: 'CB', lastName: 'ZZARCH-D1-ManToMan', pos: 16, arch: ARCHETYPES.CB_ManToMan, archName: 'Man to Man' },
  { firstName: 'CB', lastName: 'ZZARCH-D2-Zone', pos: 16, arch: ARCHETYPES.CB_Zone, archName: 'Zone' },
  { firstName: 'CB', lastName: 'ZZARCH-D3-Slot', pos: 16, arch: ARCHETYPES.CB_Slot, archName: 'Slot' },
];

// Standard test ratings (all 80s to see OVR differences clearly)
const TEST_RATINGS = {
  // Speed/Agility
  PSPD: 80, // Speed
  PACC: 80, // Acceleration
  PAGI: 80, // Agility
  PCOD: 80, // Change of Direction

  // Strength
  PSTR: 80, // Strength
  PTAK: 80, // Tackle
  PBKT: 80, // Block Shedding
  PPOW: 80, // Power Moves

  // QB
  PTHA: 80, // Throw Accuracy
  PTHP: 80, // Throw Power
  PTAS: 80, // Throw Accuracy Short
  PTAM: 80, // Throw Accuracy Mid
  PTAD: 80, // Throw Accuracy Deep
  PTOR: 80, // Throw on Run

  // Receiving
  PCTH: 80, // Catching
  PSPC: 80, // Spectacular Catch
  PCIT: 80, // Catch in Traffic
  PSRR: 80, // Short Route Running
  PMRR: 80, // Medium Route Running
  PDRR: 80, // Deep Route Running
  PREL: 80, // Release

  // Running
  PCAR: 80, // Carrying
  PBTK: 80, // Break Tackle
  PTRK: 80, // Trucking
  PELU: 80, // Elusiveness
  PSPN: 80, // Spin Move
  PJMV: 80, // Juke Move
  PSTF: 80, // Stiff Arm

  // Blocking
  PPBK: 80, // Pass Block
  PRBK: 80, // Run Block
  PIBL: 80, // Impact Blocking
  PLBK: 80, // Lead Blocking

  // Defense
  PPMV: 80, // Pass Rush Power
  PFMV: 80, // Pass Rush Finesse
  PBSH: 80, // Block Shedding
  PPRC: 80, // Play Recognition
  PPUR: 80, // Pursuit
  PHIT: 80, // Hit Power
  PZCV: 80, // Zone Coverage
  PMCV: 80, // Man Coverage
  PPRS: 80, // Press

  // Kicking
  PKPR: 80, // Kick Power
  PKAC: 80, // Kick Accuracy

  // Other
  PSTA: 80, // Stamina
  PINJ: 80, // Injury
  PTGH: 80, // Toughness
  PAWB: 80, // Awareness
};

async function runTest() {
  const rosterPath = process.argv[2] || 'C:/Users/tshan/Documents/Dev/madden-editor-suite/data/templates/ROSTER-Official';
  const outputPath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/ROSTER-ARCHTEST';

  console.log('=== ARCHETYPE TEST ===');
  console.log('Input roster:', rosterPath);
  console.log('Output path:', outputPath);
  console.log();

  try {
    const helper = new MaddenRosterHelper();
    const file = await helper.load(rosterPath);

    console.log('Roster loaded successfully');

    const playerTable = file.PLAY;
    if (!playerTable) {
      console.error('ERROR: Could not find PLAY table');
      return;
    }

    console.log(`Found ${playerTable.records.length} players`);
    console.log();

    // Apply test cases to first N players
    console.log('Applying test cases...');
    console.log();

    for (let i = 0; i < TEST_CASES.length && i < playerTable.records.length; i++) {
      const test = TEST_CASES[i];
      const playerRec = playerTable.records[i];
      const fields = playerRec.fields;

      // Set player name (lastName is sortable identifier)
      if (fields['PFNA']) fields['PFNA'].value = test.firstName;
      if (fields['PLNA']) fields['PLNA'].value = test.lastName;

      // Set position
      if (fields['PPOS']) fields['PPOS'].value = test.pos;

      // Set archetype (PLTY field)
      if (fields['PLTY']) {
        const oldArch = fields['PLTY'].value;
        fields['PLTY'].value = test.arch;
        console.log(`[${i}] ${test.firstName} ${test.lastName} (${test.archName})`);
        console.log(`    Position: ${test.pos}, Archetype: ${oldArch} -> ${test.arch}`);
      }

      // Set all ratings to 80
      Object.entries(TEST_RATINGS).forEach(([key, value]) => {
        if (fields[key]) {
          fields[key].value = value;
        }
      });

      console.log(`    All ratings set to 80`);
      console.log();
    }

    // Save the modified roster
    console.log('Saving to:', outputPath);
    await helper.save(outputPath);
    console.log('Done! Load ROSTER-ARCHTEST in Madden to test.');
    console.log();
    console.log('=== WHAT TO CHECK IN-GAME ===');
    console.log('1. Compare OVR for same-position players with different archetypes');
    console.log('2. QBTest1-3: All have same ratings - do they have different OVRs?');
    console.log('3. HBTest1-3: All have same ratings - do they have different OVRs?');
    console.log('4. WRTest1-3: All have same ratings - do they have different OVRs?');
    console.log('5. CBTest1-3: All have same ratings - do they have different OVRs?');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

// Only run if called directly
if (require.main === module) {
  runTest();
}

module.exports = { ARCHETYPES, TEST_CASES, runTest };
