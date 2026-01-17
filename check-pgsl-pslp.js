/**
 * Check PGSL and PSLP fields to see if they relate to GSLP from PGHE
 * Also check what differs between generic and real players
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function check() {
    const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENERATED';
    const helper = new MaddenRosterHelper();
    const file = await helper.load(workingPath);

    const play = file.PLAY;
    console.log('Total players:', play.records.length);

    // Look at first 20 players to see patterns
    console.log('\n=== FIRST 20 PLAYERS - PGHE RELATED FIELDS ===\n');
    console.log('Idx | Name                    | PLPL | PGHE | PSXP  | PGSL | PSLP | PSKI | PEPS');
    console.log('----+-------------------------+------+------+-------+------+------+------+--------------------');

    for (let i = 0; i < Math.min(20, play.records.length); i++) {
        const rec = play.records[i];
        const f = rec.fields || rec._fields;

        const pfna = f['PFNA']?.value || '';
        const plna = f['PLNA']?.value || '';
        const name = (pfna + ' ' + plna).trim().substring(0, 23).padEnd(23);

        const plpl = (f['PLPL']?.value ?? '').toString().padStart(4);
        const pghe = (f['PGHE']?.value ?? '').toString().padStart(4);
        const psxp = (f['PSXP']?.value ?? '').toString().padStart(5);
        const pgsl = (f['PGSL']?.value ?? '').toString().padStart(4);
        const pslp = (f['PSLP']?.value ?? '').toString().padStart(4);
        const pski = (f['PSKI']?.value ?? '').toString().padStart(4);
        const peps = (f['PEPS']?.value ?? '').substring(0, 20);

        console.log(`${i.toString().padStart(3)} | ${name} | ${plpl} | ${pghe} | ${psxp} | ${pgsl} | ${pslp} | ${pski} | ${peps}`);
    }

    // Find some generic faces (PLPL=0)
    console.log('\n=== FIRST 5 GENERIC FACE PLAYERS (PLPL=0) ===\n');
    let genericCount = 0;
    for (let i = 0; i < play.records.length && genericCount < 5; i++) {
        const rec = play.records[i];
        const f = rec.fields || rec._fields;
        const plpl = f['PLPL']?.value ?? 100;

        if (plpl === 0) {
            const pfna = f['PFNA']?.value || '';
            const plna = f['PLNA']?.value || '';
            const name = (pfna + ' ' + plna).trim();

            console.log(`Player ${i}: ${name}`);
            console.log(`  PLPL=${plpl}, PGHE=${f['PGHE']?.value}, PSXP=${f['PSXP']?.value}`);
            console.log(`  PGSL=${f['PGSL']?.value}, PSLP=${f['PSLP']?.value}, PSKI=${f['PSKI']?.value}`);
            console.log(`  PEPS="${f['PEPS']?.value}"`);
            console.log('');
            genericCount++;
        }
    }
}

check().catch(console.error);
