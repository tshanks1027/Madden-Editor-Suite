/**
 * Fix PAM mappings to use correct race-based PAMs
 *
 * PAM Race Code Mapping (from game files):
 * - M (Mixed) = Light skin / White players
 * - T (Tan) = Light skin / White players
 * - H (Hispanic) = Hispanic/Latino players
 * - B (Black) = Black players
 * - BM/BMH/BMT = Mixed combinations
 *
 * PLPO Sheet Mapping:
 * - Sheet 0-1 (Gen 1-2) = WHITE faces -> use gen_X_M_* or gen_X_T_* PAMs
 * - Sheet 2-4 (Gen 3-6) = MIXED/TAN faces -> use gen_X_H_* or gen_X_BM_* PAMs
 * - Sheet 5-6 (Gen 7) = BLACK faces -> use gen_X_B_* PAMs
 */

const fs = require('fs');

// Available M (Mixed/White) PAMs from screenshots
const whitePams = [
  // Gen 1 - M and T (white/light skin)
  'gen_1_M_N_02',
  'gen_1_M_S_011',
  'gen_1_T_EA_JP',
  'gen_1_T_N_004',
  'gen_1_t_s_002',
  // Gen 2 - M and T
  'gen_2_M_B_01',
  'gen_2_M_B_02',
  'gen_2_M_N_007',
  'gen_2_M_N_04',
  'gen_2_M_N_05',
  'gen_2_M_N_22',
  'gen_2_M_S_001',
  'gen_2_m_s_002',
  'gen_2_M_S_011',
  'gen_2_m_s_012',
  'gen_2_T_EA_JW',
  'gen_2_T_EA_SC',
  'gen_2_T_N_01',
  'gen_2_T_N_02',
  'gen_2_T_S_007',
  'gen_2_T_S_01',
  // Gen 3 - M and T
  'gen_3_M_N_01',
  'gen_3_M_N_21',
  'gen_3_T_N_004',
  'gen_3_T_N_01',
];

// Available H (Hispanic) PAMs
const hispanicPams = [
  // Gen 1
  'gen_1_H_B_009',
  'gen_1_H_BD_01',
  'gen_1_H_BD_02',
  'gen_1_H_N_010',
  'gen_1_H_N_015',
  'gen_1_H_S_003',
  'gen_1_H_S_007',
  'gen_1_H_S_008',
  // Gen 2
  'gen_2_H_B_002',
  'gen_2_H_B_004',
  'gen_2_H_B_005',
  'gen_2_h_b_006',
  'gen_2_H_B_010',
  'gen_2_H_BD_03',
  'gen_2_H_G_01',
  'gen_2_H_G_02',
  'gen_2_H_GM_004',
  'gen_2_h_gm_005',
  'gen_2_H_MB_012',
  'gen_2_h_mb_013',
  'gen_2_H_N_006',
  'gen_2_H_N_007',
  'gen_2_H_N_009',
  'gen_2_H_N_03',
  // Gen 3
  'gen_3_H_B_008',
  'gen_3_H_B_01',
  'gen_3_H_BD_01',
  'gen_3_H_MS_01',
  'gen_3_h_n_006',
  'gen_3_H_N_01',
  'gen_3_H_S_001',
];

// Available B (Black) PAMs (already in use)
const blackPams = [
  // Gen 1
  'gen_1_B_B_005',
  'gen_1_B_B_009',
  'gen_1_B_G_01',
  'gen_1_B_N_0012',
  'gen_1_B_N_007',
  'gen_1_b_n_008',
  'gen_1_b_n_01',
  'gen_1_B_N_010',
  'gen_1_B_N_011',
  'gen_1_B_N_02',
  'gen_1_B_N_03',
  'gen_1_B_N_04',
  'gen_1_B_S_001',
  'gen_1_B_S_002',
  'gen_1_b_s_003',
  'gen_1_B_S_004',
  // Gen 2 (most used currently)
  'gen_2_B_B_002',
  'gen_2_B_B_004',
  'gen_2_B_B_005',
  'gen_2_B_B_006',
  'gen_2_B_BD_03',
  'gen_2_b_bd_04',
  'gen_2_B_EA_CM',
  'gen_2_b_ea_co',
  'gen_2_B_EA_GW',
  'gen_2_B_EA_JD',
  'gen_2_B_EA_MD',
  'gen_2_b_ea_rb',
  'gen_2_B_N_0010',
  'gen_2_B_N_0011',
  'gen_2_B_N_0012',
  'gen_2_B_N_0013',
  'gen_2_B_N_0014',
  'gen_2_B_N_0015',
  'gen_2_B_N_0016',
  'gen_2_B_N_0017',
  'gen_2_B_N_0018',
  'gen_2_B_N_006',
  'gen_2_B_N_007',
  'gen_2_b_n_008',
  'gen_2_B_N_009',
  'gen_2_B_N_01',
  'gen_2_B_N_02',
  'gen_2_B_N_03',
  'gen_2_B_S_001',
  'gen_2_B_S_005',
  'gen_2_B_S_006',
  'gen_2_B_S_007',
  'gen_2_b_s_008',
  'gen_2_B_S_009',
  // Gen 3
  'gen_3_B_B_001',
  'gen_3_B_B_009',
  'gen_3_B_B_01',
  'gen_3_B_BD_02',
  'gen_3_b_n_003',
  'gen_3_b_n_004',
  'gen_3_B_N_006',
  'gen_3_B_N_007',
  'gen_3_B_N_01',
  'gen_3_B_N_02',
  'gen_3_B_S_010',
  'gen_3_B_S_011',
];

console.log('=== PAM INVENTORY ===');
console.log('White/Light (M/T) PAMs:', whitePams.length);
console.log('Hispanic (H) PAMs:', hispanicPams.length);
console.log('Black (B) PAMs:', blackPams.length);
console.log('');

// Read ALL_PLAYER_LOOKUP.csv
const lookupPath = './data/lookups/ALL_PLAYER_LOOKUP.csv';
const lookupData = fs.readFileSync(lookupPath, 'utf8');
const lines = lookupData.split('\n');
const header = lines[0];
const headerCols = header.split(',');

// Find column indices
const pamIdx = headerCols.indexOf('Player Assets ID');
const raceIdx = headerCols.indexOf('Race');
const firstNameIdx = headerCols.indexOf('First Name');
const lastNameIdx = headerCols.indexOf('Last Name');

console.log('Column indices:');
console.log('  PAM:', pamIdx);
console.log('  Race:', raceIdx);
console.log('');

// Count current generic PAM usage by race
const currentStats = { white: 0, black: 0, hispanic: 0, unknown: 0, total: 0 };
const playersNeedingFix = [];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;

  const cols = lines[i].split(',');
  const pam = cols[pamIdx] ? cols[pamIdx].trim() : '';
  const race = cols[raceIdx] ? cols[raceIdx].trim().toLowerCase() : '';

  if (pam && pam.startsWith('gen_')) {
    currentStats.total++;

    // Current PAM is Black but player might be white
    if (pam.includes('_B_')) {
      if (race === 'white' || race === 'w' || race === '') {
        playersNeedingFix.push({
          line: i,
          name: `${cols[firstNameIdx]} ${cols[lastNameIdx]}`,
          currentPam: pam,
          race: race || 'unknown'
        });
      }
      currentStats.black++;
    } else if (pam.includes('_M_') || pam.includes('_T_')) {
      currentStats.white++;
    } else if (pam.includes('_H_')) {
      currentStats.hispanic++;
    } else {
      currentStats.unknown++;
    }
  }
}

console.log('=== CURRENT GENERIC PAM USAGE ===');
console.log('Total generic PAMs:', currentStats.total);
console.log('Black (B) PAMs:', currentStats.black);
console.log('White (M/T) PAMs:', currentStats.white);
console.log('Hispanic (H) PAMs:', currentStats.hispanic);
console.log('Unknown:', currentStats.unknown);
console.log('');

console.log('=== PLAYERS NEEDING FIX (Black PAM but potentially white) ===');
console.log('Count:', playersNeedingFix.length);
if (playersNeedingFix.length > 0) {
  console.log('First 20:');
  playersNeedingFix.slice(0, 20).forEach(p => {
    console.log(`  ${p.name} | Race: ${p.race} | Current PAM: ${p.currentPam}`);
  });
}

// Export available PAMs for use in the app
const pamMapping = {
  white: whitePams,
  hispanic: hispanicPams,
  black: blackPams,
  // Assign by generation
  byGeneration: {
    '1': { white: whitePams.filter(p => p.startsWith('gen_1')), hispanic: hispanicPams.filter(p => p.startsWith('gen_1')), black: blackPams.filter(p => p.startsWith('gen_1')) },
    '2': { white: whitePams.filter(p => p.startsWith('gen_2')), hispanic: hispanicPams.filter(p => p.startsWith('gen_2')), black: blackPams.filter(p => p.startsWith('gen_2')) },
    '3': { white: whitePams.filter(p => p.startsWith('gen_3')), hispanic: hispanicPams.filter(p => p.startsWith('gen_3')), black: blackPams.filter(p => p.startsWith('gen_3')) },
  }
};

fs.writeFileSync('./data/lookups/pam-race-mapping.json', JSON.stringify(pamMapping, null, 2));
console.log('');
console.log('Saved PAM race mapping to ./data/lookups/pam-race-mapping.json');
