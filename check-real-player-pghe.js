/**
 * Check if real players (with PAMs) have PGHE data set
 * This may explain glitchy behavior in draft classes and rosters
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function check() {
    // Use EA's official roster file if available, or our generated one
    const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENERATED';
    const helper = new MaddenRosterHelper();
    const file = await helper.load(workingPath);

    const play = file.PLAY;
    console.log('Total players:', play.records.length);

    // PGHE lookup fields: PGHE, PFCG, GPAN, GSLP, PSXP, CPVF
    // PLAY table has: PGHE, PSXP, PEPS (derived from PFCG)

    // Separate real players (PLPL > 0) from generic faces (PLPL = 0)
    const realPlayers = [];
    const genericPlayers = [];

    for (let i = 0; i < play.records.length; i++) {
        const rec = play.records[i];
        const f = rec.fields || rec._fields;

        const plpl = f['PLPL']?.value ?? 0;
        const pfna = f['PFNA']?.value || '';
        const plna = f['PLNA']?.value || '';
        const name = (pfna + ' ' + plna).trim();

        const pghe = f['PGHE']?.value ?? 0;
        const psxp = f['PSXP']?.value ?? 0;
        const peps = f['PEPS']?.value || '';
        const pski = f['PSKI']?.value ?? 0;

        const playerData = {
            index: i,
            name,
            plpl,  // Portrait lookup (>0 = real player face)
            pghe,  // Generic head entry index
            psxp,  // PID in PGHE lookup
            peps,  // GENR/asset
            pski   // Skin tone
        };

        if (plpl > 0) {
            realPlayers.push(playerData);
        } else {
            genericPlayers.push(playerData);
        }
    }

    console.log(`\nReal players (with PAM/PLPL): ${realPlayers.length}`);
    console.log(`Generic faces (PLPL=0): ${genericPlayers.length}`);

    // Analyze PGHE distribution for real players
    console.log('\n=== PGHE VALUES FOR REAL PLAYERS (first 20) ===\n');
    console.log('Idx | Name                    | PLPL  | PGHE | PSXP  | PSKI | PEPS');
    console.log('----+-------------------------+-------+------+-------+------+--------------------');

    for (let i = 0; i < Math.min(20, realPlayers.length); i++) {
        const p = realPlayers[i];
        console.log(
            `${p.index.toString().padStart(3)} | ` +
            `${p.name.substring(0, 23).padEnd(23)} | ` +
            `${p.plpl.toString().padStart(5)} | ` +
            `${p.pghe.toString().padStart(4)} | ` +
            `${p.psxp.toString().padStart(5)} | ` +
            `${p.pski.toString().padStart(4)} | ` +
            `${p.peps.substring(0, 20)}`
        );
    }

    // Check if PGHE is set for real players
    const realWithPghe = realPlayers.filter(p => p.pghe > 0);
    const realWithoutPghe = realPlayers.filter(p => p.pghe === 0);

    console.log(`\n=== PGHE DISTRIBUTION FOR REAL PLAYERS ===`);
    console.log(`Real players WITH PGHE > 0: ${realWithPghe.length}`);
    console.log(`Real players WITH PGHE = 0: ${realWithoutPghe.length}`);

    if (realWithPghe.length > 0) {
        console.log('\nReal players with PGHE > 0 (first 10):');
        for (let i = 0; i < Math.min(10, realWithPghe.length); i++) {
            const p = realWithPghe[i];
            console.log(`  ${p.name}: PLPL=${p.plpl}, PGHE=${p.pghe}, PSXP=${p.psxp}, PEPS="${p.peps}"`);
        }
    }

    // Analyze PGHE distribution for generic faces
    console.log('\n=== PGHE VALUES FOR GENERIC FACES (first 20) ===\n');
    console.log('Idx | Name                    | PLPL  | PGHE | PSXP  | PSKI | PEPS');
    console.log('----+-------------------------+-------+------+-------+------+--------------------');

    for (let i = 0; i < Math.min(20, genericPlayers.length); i++) {
        const p = genericPlayers[i];
        console.log(
            `${p.index.toString().padStart(3)} | ` +
            `${p.name.substring(0, 23).padEnd(23)} | ` +
            `${p.plpl.toString().padStart(5)} | ` +
            `${p.pghe.toString().padStart(4)} | ` +
            `${p.psxp.toString().padStart(5)} | ` +
            `${p.pski.toString().padStart(4)} | ` +
            `${p.peps.substring(0, 20)}`
        );
    }

    // Check for mismatched values (PGHE index != PSXP lookup)
    console.log('\n=== CHECKING FOR MISMATCHED PGHE/PSXP/PEPS ===');

    // Load PGHE lookup for validation
    const fs = require('fs');
    const pgheData = fs.readFileSync('./data/lookups/PGHE_lookup.csv', 'utf8');
    const lines = pgheData.trim().split('\n');
    const pgheByIndex = {};  // PGHE index -> entry
    const pgheByPsxp = {};   // PSXP (PID) -> entry

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        const entry = {
            pghe: parseInt(parts[0]),
            pfcg: parts[1].replace(/"/g, ''),
            gpan: parts[2].replace(/"/g, ''),
            gslp: parseInt(parts[3]),
            psxp: parseInt(parts[4]),
            cpvf: parseInt(parts[5])
        };
        pgheByIndex[entry.pghe] = entry;
        pgheByPsxp[entry.psxp] = entry;
    }

    // Check generic players for mismatches
    let mismatches = 0;
    const mismatchExamples = [];

    for (const p of genericPlayers) {
        if (p.pghe > 0) {
            const expectedEntry = pgheByIndex[p.pghe];
            if (expectedEntry && expectedEntry.psxp !== p.psxp) {
                mismatches++;
                if (mismatchExamples.length < 10) {
                    mismatchExamples.push({
                        name: p.name,
                        pghe: p.pghe,
                        actualPsxp: p.psxp,
                        expectedPsxp: expectedEntry.psxp,
                        actualPeps: p.peps,
                        expectedGenr: 'gen_' + expectedEntry.pfcg
                    });
                }
            }
        }
    }

    console.log(`\nGeneric players with MISMATCHED PGHE/PSXP: ${mismatches}/${genericPlayers.length}`);
    if (mismatchExamples.length > 0) {
        console.log('\nMismatch examples:');
        for (const m of mismatchExamples) {
            console.log(`  ${m.name}:`);
            console.log(`    PGHE=${m.pghe}, actual PSXP=${m.actualPsxp}, expected PSXP=${m.expectedPsxp}`);
            console.log(`    actual PEPS="${m.actualPeps}", expected GENR="${m.expectedGenr}"`);
        }
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total players: ${play.records.length}`);
    console.log(`Real players (PLPL>0): ${realPlayers.length}`);
    console.log(`  - With PGHE > 0: ${realWithPghe.length}`);
    console.log(`  - With PGHE = 0: ${realWithoutPghe.length}`);
    console.log(`Generic faces (PLPL=0): ${genericPlayers.length}`);
    console.log(`  - With mismatched PGHE/PSXP: ${mismatches}`);
}

check().catch(console.error);
