const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function extractFaces() {
  const helper = new MaddenRosterHelper();
  const file = await helper.load('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-GENERATED');

  const blbm = file.BLOB.records[0].fields['BLBM'].value._records;

  // Get all unique CNID/ASNM combinations
  const faces = new Map();

  for (const rec of blbm) {
    const f = rec.fields || rec._fields;
    const cnid = f['CNID']?.value ?? f['CNID']?._value;
    const asnm = f['ASNM']?.value ?? f['ASNM']?._value ?? '';

    if (cnid !== undefined && cnid !== 0) {
      const key = cnid + '|' + asnm;
      if (!faces.has(key)) {
        faces.set(key, {cnid, asnm, count: 0});
      }
      faces.get(key).count++;
    }
  }

  console.log('Total unique CNID/ASNM pairs:', faces.size);
  console.log('');

  // Sort by CNID and show all
  const sorted = Array.from(faces.values()).sort((a,b) => a.cnid - b.cnid);

  console.log('First 50 (lowest CNID):');
  sorted.slice(0,50).forEach(f => {
    console.log('  CNID=' + f.cnid + ' ASNM="' + f.asnm + '" (used ' + f.count + 'x)');
  });

  console.log('');
  console.log('CNID range:', sorted[0]?.cnid, 'to', sorted[sorted.length-1]?.cnid);
  console.log('');

  // Check if any CNID is in 1-264 range
  const inRange = sorted.filter(f => f.cnid >= 1 && f.cnid <= 264);
  console.log('CNIDs in 1-264 range:', inRange.length);
  if (inRange.length > 0) {
    console.log('  Values:', inRange.map(f => f.cnid).join(', '));
  }
}

extractFaces().catch(console.error);
