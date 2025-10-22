const MaddenRosterHelper = require('../../helpers/MaddenRosterHelper');
const expect = require('chai').expect;
const path = require('path');

const m24Path = path.join(__dirname, '../data/M24_ROSTER-Official');
const m25Path = path.join(__dirname, '../data/M25_ROSTER-Official');
const m26Path = path.join(__dirname, '../data/M26_ROSTER-Official');
const m26SavedPath = path.join(__dirname, '../data/M26_ROSTER-Saved');

it('M24 Helper test', async function() {
    this.timeout(20000);
    const m24Helper = new MaddenRosterHelper();
    await m24Helper.load(m24Path);
    expect(m24Helper.file.CVPM.records[0].fields['ASNM'].value).to.equal('SmithGeno_112');
    const genoLoadouts = m24Helper.file.CVPM.records[0].fields['LOUT'].value;

    expect(genoLoadouts.records.length).to.equal(2);

    const equipmentLoadout = genoLoadouts.records[1];

    const equipmentLoadoutItems = equipmentLoadout.fields['PINS'].value;

    const armSleeve = equipmentLoadoutItems.records.find((record) => {
        return record.fields['SLOT'].value === 17;
    });

    armSleeve.fields['ITAN'].value = "GearArmSleeve_Full_sleeveLongUnderarmor_normal_White";

    await m24Helper.save(path.join(__dirname, "../data/WriteTest_M24_ROSTER-Official"));

    const m24Helper2 = new MaddenRosterHelper();

    await m24Helper2.load(path.join(__dirname, "../data/WriteTest_M24_ROSTER-Official"));

    const genoLoadouts2 = m24Helper2.file.CVPM.records[0].fields['LOUT'].value;

    const equipmentLoadout2 = genoLoadouts2.records.find((record) => {
        return record.fields['LDTY']?.value === 1;
    });

    const equipmentLoadoutItems2 = equipmentLoadout2.fields['PINS'].value;

    const armSleeve2 = equipmentLoadoutItems2.records.find((record) => {
        return record.fields['SLOT'].value === 17;
    });

    expect(armSleeve2.fields['ITAN'].value).to.equal("GearArmSleeve_Full_sleeveLongUnderarmor_normal_White");
});

it('M24 Added Record Test', async function() {
    this.timeout(20000);
    const m24Helper = new MaddenRosterHelper();
    await m24Helper.load(m24Path);
    const newRecord = m24Helper.file.CVPM.records[0].deepCopyRecord();
    newRecord.index = 113;
    newRecord.fields['ASNM'].value = "SmithGeno_113";

    const originalTableLength = m24Helper.file.CVPM.numEntries;

    m24Helper.file.CVPM.addRecord(newRecord);

    await m24Helper.save(path.join(__dirname, "../data/WriteTest_AddedRecordM24_ROSTER-Official"));
    const m24Helper2 = new MaddenRosterHelper();
    await m24Helper2.load(path.join(__dirname, "../data/WriteTest_AddedRecordM24_ROSTER-Official"));
    // Ensure the new entry is present
    expect(m24Helper2.file.CVPM.numEntries).to.equal(originalTableLength + 1);
    expect(m24Helper2.file.CVPM.records.find((record) => {
        return record.index === 113;
    }).fields['ASNM'].value).to.equal("SmithGeno_113");

    // Ensure that the original record remains intact
    expect(m24Helper2.file.CVPM.records[0].fields['ASNM'].value).to.equal('SmithGeno_112');
});

it('M24 Removed Record Test', async function() {
    this.timeout(20000);
    const m24Helper = new MaddenRosterHelper();
    await m24Helper.load(m24Path);
    const originalTableLength = m24Helper.file.CVPM.numEntries;

    // Remove first record (Geno Smith - key 112)
    m24Helper.file.CVPM.removeRecord(112);

    await m24Helper.save(path.join(__dirname, "../data/WriteTest_RemovedRecordM24_ROSTER-Official"));
    const m24Helper2 = new MaddenRosterHelper();
    await m24Helper2.load(path.join(__dirname, "../data/WriteTest_RemovedRecordM24_ROSTER-Official"));
    // Ensure the entry has been removed
    expect(m24Helper2.file.CVPM.numEntries).to.equal(originalTableLength - 1);
    expect(m24Helper2.file.CVPM.records.find((record) => {
        return record.index === 112;
    })).to.equal(undefined);
});
 

it('M25 Helper test', async function() {
    this.timeout(20000);
    const m25Helper = new MaddenRosterHelper();
    await m25Helper.load(m25Path);
    expect(m25Helper.file.PLEX.records[0].fields['ASNM'].value).to.equal('SmithGeno_112');

    const genoLoadouts = m25Helper.file.PLEX.records[0].fields['LOUT'].value;

    expect(genoLoadouts.records.length).to.equal(2);

    const equipmentLoadout = genoLoadouts.records[1];

    const equipmentLoadoutItems = equipmentLoadout.fields['PINS'].value;

    const armSleeve = equipmentLoadoutItems.records.find((record) => {
        return record.fields['SLOT'].value === 17;
    });

    armSleeve.fields['ITAN'].value = "GearArmSleeve_Full_sleeveLongUnderarmor_normal_White";

    await m25Helper.save(path.join(__dirname, "../data/WriteTest_M25_ROSTER-Official"))
    const m25Helper2 = new MaddenRosterHelper();
    await m25Helper2.load(path.join(__dirname, "../data/WriteTest_M25_ROSTER-Official"))
    const genoLoadouts2 = m25Helper2.file.PLEX.records[0].fields['LOUT'].value;

    const equipmentLoadout2 = genoLoadouts2.records.find((record) => {
        return record.fields['LDTY']?.value === 1;
    });

    const equipmentLoadoutItems2 = equipmentLoadout2.fields['PINS'].value;

    const armSleeve2 = equipmentLoadoutItems2.records.find((record) => {
        return record.fields['SLOT'].value === 17;
    });

    expect(armSleeve2.fields['ITAN'].value).to.equal("GearArmSleeve_Full_sleeveLongUnderarmor_normal_White");
});

it('M25 Added Record Test', async function() {
    this.timeout(20000);
    const m25Helper = new MaddenRosterHelper();
    await m25Helper.load(m25Path);
    const newRecord = m25Helper.file.PLEX.records[0].deepCopyRecord();
    newRecord.index = 113;
    newRecord.fields['ASNM'].value = "SmithGeno_113";

    const originalTableLength = m25Helper.file.PLEX.numEntries;

    m25Helper.file.PLEX.addRecord(newRecord);

    await m25Helper.save(path.join(__dirname, "../data/WriteTest_AddedRecordM25_ROSTER-Official"))
    const m25Helper2 = new MaddenRosterHelper();
    await m25Helper2.load(path.join(__dirname, "../data/WriteTest_AddedRecordM25_ROSTER-Official"));
    // Ensure the new entry is present
    expect(m25Helper2.file.PLEX.numEntries).to.equal(originalTableLength + 1);
    expect(m25Helper2.file.PLEX.records.find((record) => {
        return record.index === 113;
    }).fields['ASNM'].value).to.equal("SmithGeno_113");

    // Ensure that the original record remains intact
    expect(m25Helper2.file.PLEX.records[0].fields['ASNM'].value).to.equal('SmithGeno_112');
});

it('M25 Removed Record Test', async function() {
    this.timeout(20000);
    const m25Helper = new MaddenRosterHelper();
    await m25Helper.load(m25Path);
    const originalTableLength = m25Helper.file.PLEX.numEntries;

    // Remove first record (Geno Smith - key 112)
    m25Helper.file.PLEX.removeRecord(112);

    await m25Helper.save(path.join(__dirname, "../data/WriteTest_RemovedRecordM25_ROSTER-Official"));
    const m25Helper2 = new MaddenRosterHelper();
    await m25Helper2.load(path.join(__dirname, "../data/WriteTest_RemovedRecordM25_ROSTER-Official"));
    // Ensure the entry has been removed
    expect(m25Helper2.file.PLEX.numEntries).to.equal(originalTableLength - 1);
    expect(m25Helper2.file.PLEX.records.find((record) => {
        return record.index === 112;
    })).to.equal(undefined);
});

it('M26 Helper test', async function() {
    this.timeout(20000);
    const m26Helper = new MaddenRosterHelper();
    await m26Helper.load(m26Path);
    expect(m26Helper.file.BLOB.records[0].fields['BLBM'].value.records[112].fields['ASNM'].value).to.equal('SchraderCody_1345');

    const loadouts = m26Helper.file.BLOB.records[0].fields['BLBM'].value.records.find((record) => {
        return record.index === 1345;
    }).fields['LOUT'].value;

    expect(loadouts.records.length).to.equal(2);

    const equipmentLoadout = loadouts.records[1];

    const equipmentLoadoutItems = equipmentLoadout.fields['PINS'].value;

    const armSleeve = equipmentLoadoutItems.records.find((record) => {
        return record.fields['SLOT']?.value === 110;
    });

    armSleeve.fields['ITAN'].value = "GearArmSleeve_Full_sleeveLongUnderarmor_normal_White";

    await m26Helper.save(path.join(__dirname, "../data/WriteTest_M26_ROSTER-Official"));
    const m26Helper2 = new MaddenRosterHelper();
    await m26Helper2.load(path.join(__dirname, "../data/WriteTest_M26_ROSTER-Official"));
    const loadouts2 = m26Helper2.file.BLOB.records[0].fields['BLBM'].value.records.find((record) => {
        return record.index === 1345;
    }).fields['LOUT'].value;

    const equipmentLoadout2 = loadouts2.records.find((record) => {
        return record.fields['LDTY']?.value === 1;
    });

    const equipmentLoadoutItems2 = equipmentLoadout2.fields['PINS'].value;

    const armSleeve2 = equipmentLoadoutItems2.records.find((record) => {
        return record.fields['SLOT'].value === 110;
    });

    expect(armSleeve2.fields['ITAN'].value).to.equal("GearArmSleeve_Full_sleeveLongUnderarmor_normal_White");
});

it('M26 Added Record Test', async function() {
    this.timeout(20000);
    const m26Helper = new MaddenRosterHelper();
    await m26Helper.load(m26Path);
    const newRecord = m26Helper.file.BLOB.records[0].fields['BLBM'].value.records.find((record) => {
        return record.index === 1345;
    }).deepCopyRecord();
    newRecord.index = 113;
    newRecord.fields['ASNM'].value = "SmithGeno_113";

    const originalTableLength = m26Helper.file.BLOB.records[0].fields['BLBM'].value.numEntries;

    m26Helper.file.BLOB.records[0].fields['BLBM'].value.addRecord(newRecord);

    await m26Helper.save(path.join(__dirname, "../data/WriteTest_AddedRecordM26_ROSTER-Official"));
    const m26Helper2 = new MaddenRosterHelper();
    await m26Helper2.load(path.join(__dirname, "../data/WriteTest_AddedRecordM26_ROSTER-Official"));
    // Ensure the new entry is present
    expect(m26Helper2.file.BLOB.records[0].fields['BLBM'].value.numEntries).to.equal(originalTableLength + 1);
    expect(m26Helper2.file.BLOB.records[0].fields['BLBM'].value.records.find((record) => {
        return record.index === 113;
    }).fields['ASNM'].value).to.equal("SmithGeno_113");

    // Ensure that the original record remains intact
    expect(m26Helper2.file.BLOB.records[0].fields['BLBM'].value.records.find((record) => {
        return record.index === 1345;
    }).fields['ASNM'].value).to.equal('SchraderCody_1345');
});

it('M26 Removed Record Test', async function() {
    this.timeout(20000);
    const m26Helper = new MaddenRosterHelper();
    await m26Helper.load(m26Path);
    const originalTableLength = m26Helper.file.BLOB.records[0].fields['BLBM'].value.numEntries;

    // Remove first record (Cody Schrader - key 1345)
    m26Helper.file.BLOB.records[0].fields['BLBM'].value.removeRecord(1345);

    await m26Helper.save(path.join(__dirname, "../data/WriteTest_RemovedRecordM26_ROSTER-Official"));
    const m26Helper2 = new MaddenRosterHelper();
    await m26Helper2.load(path.join(__dirname, "../data/WriteTest_RemovedRecordM26_ROSTER-Official"));

    // Ensure the entry has been removed
    expect(m26Helper2.file.BLOB.records[0].fields['BLBM'].value.numEntries).to.equal(originalTableLength - 1);
    expect(m26Helper2.file.BLOB.records[0].fields['BLBM'].value.records.find((record) => {
        return record.index === 1345;
    })).to.equal(undefined);
});

it('M26 Saved Roster Edit Test', async function() {
    this.timeout(20000);
    const m26Helper = new MaddenRosterHelper();
    await m26Helper.load(m26SavedPath);
    const barkleyRecord = m26Helper.file.BLOB.records[0].fields['BLBM'].value.records.find((record) => {
        return record.index === 13085;
    })

    barkleyRecord.fields['ASNM'].value = "EditedSaquon_13085";

    await m26Helper.save(path.join(__dirname, "../data/WriteTest_M26_ROSTER-Saved"));
    const m26Helper2 = new MaddenRosterHelper();
    await m26Helper2.load(path.join(__dirname, "../data/WriteTest_M26_ROSTER-Saved"));

    // Ensure the written data matches
    expect(m26Helper2.file.BLOB.records[0].fields['BLBM'].value.records.find((record) => {
        return record.index === 13085;
    }).fields['ASNM'].value).to.equal("EditedSaquon_13085");
});



