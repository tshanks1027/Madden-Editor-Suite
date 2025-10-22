const m24Path = '../data/M24_ROSTER-Official';
const m25Path = '../data/M25_ROSTER-Official';
const m26Path = './ROSTER-TEST';

const MaddenRosterHelper = require('../../helpers/MaddenRosterHelper');
let done = false;

changeKeyedRecordData(m24Path, m25Path)
    .then(() => {
        done = true;
    });

checkDone();

function checkDone() {
    if (!done) {
        setTimeout(checkDone, 100);
    }
}

async function changeKeyedRecordData(m24Path, m25Path) {
    const m25Helper = new MaddenRosterHelper();

    const m26Helper = new MaddenRosterHelper();
    await m26Helper.load(m26Path);
    await m26Helper.save("./ROSTER-TESTSAVE");

    return;


    m25Helper.load(m25Path)
        .then(() => {
            console.log(m25Helper.file.PLAY.records[0].fields['PEPS'].value);
            let record = m25Helper.file.PLAY.records[0].deepCopyRecord();
            m25Helper.file.PLAY.addRecord(record);
            record.fields['PGID'].value = 8;
            record.fields['POID'].value = 8;
            record.fields['PFNA'].value = "Geniffer";
            let visuals = m25Helper.file.PLEX.records[112].deepCopyRecord();
            visuals.index = 8;
            m25Helper.file.PLEX.addRecord(visuals);

            let sleeveRecord = visuals.fields['LOUT'].value.records[1].fields['PINS'].value.records.find((record) => {
                return record.fields['SLOT']?.value === 17;
            });

            sleeveRecord.fields['ITAN'].value = "GearArmSleeve_Full_sleeveLongUnderarmor_normal_White";

            m25Helper.save("../data/ROSTER-ADDEDRECORDTEST");
            
        });
};