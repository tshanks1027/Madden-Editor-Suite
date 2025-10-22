const fs = require('fs');
const path = require('path');

const MaddenRosterHelper = require('../helpers/MaddenRosterHelper');
const tdb2RosterFilePath = path.join(__dirname, './data/M25_ROSTER-Official');
let done = false;

const maddenRosterHelper = new MaddenRosterHelper();

checkDone();

function checkDone() {
    if (!done) {
        setTimeout(checkDone, 100);
    }
}

// If the promise is resolved, write the roster file to the disk
maddenRosterHelper.load(tdb2RosterFilePath).then((file) => {
    console.log('Made it in');
    //fs.writeFileSync('M24RosterFile.json', JSON.stringify(file, null, 2));
    //done = true;
    maddenRosterHelper.save('ROSTER-SavedOfficial').then(() => {
        console.log('Saved');
        done = true;
    });
});
