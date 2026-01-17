/**
 * Check all FranchiseUser fields
 */
const { create } = require('madden-franchise');

async function check() {
  const files = [
    { name: '1980test', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test' },
    { name: '2011 Throwback', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09' }
  ];

  for (const file of files) {
    console.log('\n========== ' + file.name + ' ==========');
    const f = await create(file.path);

    const fu = f.getTableByName('FranchiseUser');
    await fu.readRecords();

    console.log('FranchiseUser table fields:');
    if (fu.records.length > 0) {
      const fields = Object.keys(fu.records[0]).filter(k => !k.startsWith('_'));
      console.log(fields.join(', '));
    }

    console.log('\nFirst FranchiseUser record (all fields):');
    for (const r of fu.records) {
      if (r.isEmpty) continue;
      const fields = Object.keys(r).filter(k => !k.startsWith('_'));
      for (const field of fields) {
        const val = r[field];
        if (val !== null && val !== undefined) {
          console.log('  ' + field + ':', val);
        }
      }
      break;
    }

    // Also check League table
    console.log('\n\nLeague table:');
    try {
      const lt = f.getTableByName('League');
      await lt.readRecords();
      for (const r of lt.records) {
        if (r.isEmpty) continue;
        const fields = Object.keys(r).filter(k => !k.startsWith('_'));
        for (const field of fields) {
          const val = r[field];
          if (val !== null && val !== undefined && String(field).toLowerCase().includes('team')) {
            console.log('  ' + field + ':', val);
          }
        }
        break;
      }
    } catch (e) {
      console.log('  Error:', e.message);
    }
  }
}

check().catch(console.error);
