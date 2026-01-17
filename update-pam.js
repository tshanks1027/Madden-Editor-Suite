const fs = require('fs');

// Generic PAM names available (all race 2)
const GEN_PAMS = [
    'gen_2_B_N_0013',
    'gen_2_B_N_0014',
    'gen_2_B_N_0015',
    'gen_2_B_N_0016',
    'gen_2_B_N_0017',
    'gen_2_B_N_0018',
    'gen_2_B_N_006',
    'gen_2_B_N_007',
    'gen_2_B_N_009',
    'gen_2_B_N_01',
    'gen_2_B_N_02',
    'gen_2_B_N_03',
    'gen_2_B_S_001',
    'gen_2_B_S_005',
    'gen_2_B_S_006',
    'gen_2_B_S_007',
    'gen_2_b_n_008'
];

// Update ROSTER_lookup.csv - PAM is column 10, Race is column 84, PID is column 9
const rosterPath = 'data/lookups/ROSTER_lookup.csv';
let rosterContent = fs.readFileSync(rosterPath, 'utf-8');
let rosterLines = rosterContent.split('\n');

let updatedCount = 0;
for (let i = 1; i < rosterLines.length; i++) {
    if (!rosterLines[i].trim()) continue;

    const cols = rosterLines[i].split(',');
    const pid = cols[8];  // PID (0-indexed column 9)
    const pam = cols[9];  // PAM (0-indexed column 10)
    const race = cols[83]; // Race (0-indexed column 84)

    // If PAM is 0 or empty and PID exists, assign generic PAM
    if ((pam === '0' || !pam) && pid && pid !== '0' && pid !== '') {
        // Pick a generic PAM based on hash of PID for variety
        const pidNum = parseInt(pid) || 0;
        const pamIndex = pidNum % GEN_PAMS.length;
        cols[9] = GEN_PAMS[pamIndex];
        rosterLines[i] = cols.join(',');
        updatedCount++;
    }
}

fs.writeFileSync(rosterPath, rosterLines.join('\n'));
console.log(`Updated ${updatedCount} players in ROSTER_lookup.csv`);

// Now update ALL_PLAYER_LOOKUP.csv - need to check structure first
const allPlayerPath = 'data/lookups/ALL_PLAYER_LOOKUP.csv';
let allPlayerContent = fs.readFileSync(allPlayerPath, 'utf-8');
let allPlayerLines = allPlayerContent.split('\n');

// Get header to find PAM column
const header = allPlayerLines[0];
console.log('ALL_PLAYER_LOOKUP header:', header);

// Find column indices
const headerCols = header.split(',');
let pidCol = -1, pamCol = -1;
for (let c = 0; c < headerCols.length; c++) {
    const col = headerCols[c].toLowerCase().trim();
    if (col === 'pid' || col === 'player id') pidCol = c;
    if (col === 'player assets id' || col === 'pam') pamCol = c;
}

console.log(`Found PID at column ${pidCol}, PAM at column ${pamCol}`);

if (pidCol >= 0 && pamCol >= 0) {
    let allPlayerUpdated = 0;
    for (let i = 1; i < allPlayerLines.length; i++) {
        if (!allPlayerLines[i].trim()) continue;

        const cols = allPlayerLines[i].split(',');
        const pid = cols[pidCol];
        const pam = cols[pamCol];

        // If PAM empty/0 and PID exists, assign generic
        if ((!pam || pam === '0' || pam.trim() === '') && pid && pid !== '0' && pid.trim() !== '') {
            const pidNum = parseInt(pid) || 0;
            const pamIndex = pidNum % GEN_PAMS.length;
            cols[pamCol] = GEN_PAMS[pamIndex];
            allPlayerLines[i] = cols.join(',');
            allPlayerUpdated++;
        }
    }

    fs.writeFileSync(allPlayerPath, allPlayerLines.join('\n'));
    console.log(`Updated ${allPlayerUpdated} players in ALL_PLAYER_LOOKUP.csv`);
}

console.log('Done!');
