const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function checkPlayerPic() {
    const helper = new MaddenRosterHelper();
    const file = await helper.load('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-EDITED');

    const players = file.PLAY?._records || [];
    console.log('Total players:', players.length);

    // Check PLAYERPIC/PLPL values
    const plplValues = new Map();
    const pepsValues = new Map();

    for (const rec of players.slice(0, 100)) {
        const f = rec.fields || rec._fields;
        const plpl = f?.['PLPL']?.value ?? f?.['PLPL']?._value ?? f?.['PLPL'];
        const peps = f?.['PEPS']?.value ?? f?.['PEPS']?._value ?? f?.['PEPS'];
        const firstName = f?.['firstName']?.value ?? f?.['firstName']?._value ?? '';
        const lastName = f?.['lastName']?.value ?? f?.['lastName']?._value ?? '';

        if (plpl !== undefined) {
            plplValues.set(plpl, (plplValues.get(plpl) || 0) + 1);
        }
        if (peps) {
            const prefix = peps.substring(0, 30);
            pepsValues.set(prefix, (pepsValues.get(prefix) || 0) + 1);
        }
    }

    console.log('\nPLPL value distribution (first 100 players):');
    for (const [v, count] of [...plplValues.entries()].sort((a,b) => b[1] - a[1])) {
        console.log('  PLPL=' + v + ': ' + count + ' players');
    }

    console.log('\nPEPS value prefixes (first 100 players):');
    for (const [v, count] of [...pepsValues.entries()].sort((a,b) => b[1] - a[1]).slice(0, 10)) {
        console.log('  "' + v + '...": ' + count + ' players');
    }

    // Also check what PLAYERPIC values exist in the parsed data
    console.log('\n=== Checking parsed player data ===');
    const parseResult = await require('./src/main/parsers/MaddenRosterParser').parseRosterFile(
        'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-EDITED'
    );

    if (parseResult.success) {
        const playerpicValues = new Map();
        for (const p of parseResult.data.players.slice(0, 200)) {
            const pic = p.PLAYERPIC || 'undefined';
            playerpicValues.set(pic, (playerpicValues.get(pic) || 0) + 1);
        }
        console.log('\nPLAYERPIC values in parsed data (first 200):');
        for (const [v, count] of [...playerpicValues.entries()].sort((a,b) => b[1] - a[1])) {
            console.log('  "' + v + '": ' + count + ' players');
        }
    }
}

checkPlayerPic().catch(console.error);
