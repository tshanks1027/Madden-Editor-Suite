/**
 * Skin Tone Test Script
 *
 * PURPOSE: Create test players to verify skin tone behavior in-game
 * This is a RESEARCH tool, not production code.
 *
 * USAGE: node test-skin-tone.js <path-to-roster>
 *
 * TEST PLAN:
 * 1. Same GENR, Different SKNT - see if SKNT affects body skin
 * 2. Different GENR, Same SKNT - see if GENR affects face appearance
 * 3. Different Variant (B/H/M/T), Same SKNT - see if variant affects face type
 */

const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');
const path = require('path');
const fs = require('fs');

// Test cases for skin tone verification
// First name = Test group, Last name = ZZSKIN + identifier (sortable)
const TEST_CASES = [
  // Group A: Same GENR, Different SKNT
  { firstName: 'SameGENR', lastName: 'ZZSKIN-A1-SKNT1', GENR: 'gen_7_B_N_019', SKNT: 1, desc: 'Dark face + light body' },
  { firstName: 'SameGENR', lastName: 'ZZSKIN-A2-SKNT4', GENR: 'gen_7_B_N_019', SKNT: 4, desc: 'Dark face + med body' },
  { firstName: 'SameGENR', lastName: 'ZZSKIN-A3-SKNT7', GENR: 'gen_7_B_N_019', SKNT: 7, desc: 'Dark face + dark body' },

  // Group B: Different GENR, Same SKNT
  { firstName: 'DiffGENR', lastName: 'ZZSKIN-B1-GEN1', GENR: 'gen_1_B_N_011', SKNT: 7, desc: 'Light face + dark body' },
  { firstName: 'DiffGENR', lastName: 'ZZSKIN-B2-GEN4', GENR: 'gen_4_B_N_01', SKNT: 7, desc: 'Med face + dark body' },
  { firstName: 'DiffGENR', lastName: 'ZZSKIN-B3-GEN7', GENR: 'gen_7_B_N_019', SKNT: 7, desc: 'Dark face + dark body' },

  // Group C: Different Variant, Same SKNT=7
  { firstName: 'Variant', lastName: 'ZZSKIN-C1-B', GENR: 'gen_7_B_N_019', SKNT: 7, desc: 'B=Black features' },
  { firstName: 'Variant', lastName: 'ZZSKIN-C2-H', GENR: 'gen_7_H_N_01', SKNT: 7, desc: 'H=Hispanic features' },
  { firstName: 'Variant', lastName: 'ZZSKIN-C3-M', GENR: 'gen_7_M_N_001', SKNT: 7, desc: 'M=White features' },
  { firstName: 'Variant', lastName: 'ZZSKIN-C4-T', GENR: 'gen_7_T_N_001', SKNT: 7, desc: 'T=Tall/White features' },
];

async function runTest() {
  const rosterPath = process.argv[2] || 'C:/Users/tshan/Documents/Dev/madden-editor-suite/data/templates/ROSTER-Official';
  const outputPath = process.argv[3] || 'C:/Users/tshan/Documents/Madden NFL 26/Saves/ROSTER-SKINTEST';

  console.log('=== SKIN TONE TEST ===');
  console.log('Input roster:', rosterPath);
  console.log('Output path:', outputPath);
  console.log();

  try {
    const helper = new MaddenRosterHelper();
    const file = await helper.load(rosterPath);

    console.log('Roster loaded successfully');

    const playerTable = file.PLAY;
    const blob = file.BLOB?.records?.[0];
    const blbm = blob?.fields?.['BLBM']?.value;

    if (!playerTable || !blbm) {
      console.error('ERROR: Could not find PLAY or BLBM table');
      return;
    }

    console.log(`Found ${playerTable.records.length} players, ${blbm._records.length} BLBM records`);
    console.log();

    // Find empty slots or overwrite first N players
    console.log('Applying test cases...');
    console.log();

    for (let i = 0; i < TEST_CASES.length && i < playerTable.records.length; i++) {
      const test = TEST_CASES[i];
      const playerRec = playerTable.records[i];
      const blbmRec = blbm._records[i];

      // Set player name (lastName is sortable identifier)
      if (playerRec.fields['PFNA']) {
        playerRec.fields['PFNA'].value = test.firstName;
      }
      if (playerRec.fields['PLNA']) {
        playerRec.fields['PLNA'].value = test.lastName;
      }

      // Set as generic face - must clear PAM reference
      if (playerRec.fields['PLPL']) {
        playerRec.fields['PLPL'].value = 0; // Generic
      }
      // Clear PAM (PEPS) - this is critical! PAM overrides GENR/SKNT
      if (playerRec.fields['PEPS']) {
        const oldPeps = playerRec.fields['PEPS'].value;
        playerRec.fields['PEPS'].value = 0; // No PAM
        console.log(`[${i}] Cleared PEPS (PAM): ${oldPeps} -> 0`);
      }
      // Also clear PSXP (Portrait ID) to use generic portrait
      if (playerRec.fields['PSXP']) {
        playerRec.fields['PSXP'].value = 0;
      }

      // Set BLBM fields
      const blbmFields = blbmRec.fields || blbmRec._fields;
      if (blbmFields) {
        // GENR
        if (blbmFields['GENR']) {
          const oldGenr = blbmFields['GENR'].value || blbmFields['GENR']._value;
          if (blbmFields['GENR'].value !== undefined) {
            blbmFields['GENR'].value = test.GENR;
          } else if (blbmFields['GENR']._value !== undefined) {
            blbmFields['GENR']._value = test.GENR;
          }
          console.log(`[${i}] ${test.firstName} ${test.lastName}: GENR ${oldGenr} -> ${test.GENR}`);
        }

        // SKNT
        if (blbmFields['SKNT']) {
          const oldSknt = blbmFields['SKNT'].value || blbmFields['SKNT']._value;
          if (blbmFields['SKNT'].value !== undefined) {
            blbmFields['SKNT'].value = test.SKNT;
          } else if (blbmFields['SKNT']._value !== undefined) {
            blbmFields['SKNT']._value = test.SKNT;
          }
          console.log(`[${i}] ${test.firstName} ${test.lastName}: SKNT ${oldSknt} -> ${test.SKNT}`);
        }

        // CNID = 0 for generic faces
        if (blbmFields['CNID']) {
          if (blbmFields['CNID'].value !== undefined) {
            blbmFields['CNID'].value = 0;
          } else if (blbmFields['CNID']._value !== undefined) {
            blbmFields['CNID']._value = 0;
          }
        }

        // GNHD = 0 for GENR-based faces
        if (blbmFields['GNHD']) {
          if (blbmFields['GNHD'].value !== undefined) {
            blbmFields['GNHD'].value = 0;
          } else if (blbmFields['GNHD']._value !== undefined) {
            blbmFields['GNHD']._value = 0;
          }
        }

        // ASNM = empty for generic faces
        if (blbmFields['ASNM']) {
          if (blbmFields['ASNM'].value !== undefined) {
            blbmFields['ASNM'].value = '';
          } else if (blbmFields['ASNM']._value !== undefined) {
            blbmFields['ASNM']._value = '';
          }
        }
      }

      console.log(`  ${test.desc}`);
      console.log();
    }

    // Save the modified roster
    console.log('Saving to:', outputPath);
    await helper.save(outputPath);
    console.log('Done! Load ROSTER-SKINTEST in Madden to test.');
    console.log();
    console.log('=== WHAT TO CHECK IN-GAME ===');
    console.log('1. Group A (TestA1-A3): Does SKNT change body skin color?');
    console.log('2. Group B (TestB1-B3): Does GENR number change face shade?');
    console.log('3. Group C (TestC1-C4): Does variant (B/H/M/T) change face type?');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

// Only run if called directly
if (require.main === module) {
  runTest();
}

module.exports = { TEST_CASES, runTest };
