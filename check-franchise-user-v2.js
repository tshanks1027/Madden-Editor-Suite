// Check FranchiseUser table fields in detail

async function checkFranchiseUser() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  console.log('=== FranchiseUser Table ===');
  const franchiseUserTable = franchise.getTableByName('FranchiseUser');
  if (franchiseUserTable) {
    await franchiseUserTable.readRecords();
    console.log('Records:', franchiseUserTable.records.length);

    // Get field info from header
    const header = franchiseUserTable.header;
    if (header && header.fields) {
      console.log('\nFields in table:', header.fields.map(f => f.name).join(', '));
    }

    for (const rec of franchiseUserTable.records) {
      if (rec.isEmpty) continue;
      console.log('\nFranchiseUser record', rec.index, ':');

      // Print ALL properties using getOwnPropertyNames
      const proto = Object.getPrototypeOf(rec);
      const descriptors = Object.getOwnPropertyDescriptors(proto);
      for (const [key, desc] of Object.entries(descriptors)) {
        if (desc.get && !key.startsWith('_')) {
          try {
            const val = rec[key];
            if (val !== undefined && val !== null && typeof val !== 'function') {
              console.log('  ' + key + ':', val);
            }
          } catch(e) {}
        }
      }
    }
  }

  // Check Coach table for user's coach (index 64 had (USER) marker)
  console.log('\n=== Coach Index 64 (User Coach) ===');
  const coachTable = franchise.getTableByName('Coach');
  if (coachTable) {
    await coachTable.readRecords();
    const rec = coachTable.records[64];
    if (rec && !rec.isEmpty) {
      const proto = Object.getPrototypeOf(rec);
      const descriptors = Object.getOwnPropertyDescriptors(proto);
      for (const [key, desc] of Object.entries(descriptors)) {
        if (desc.get && !key.startsWith('_')) {
          try {
            const val = rec[key];
            if (val !== undefined && val !== null && typeof val !== 'function') {
              // Only show team-related fields
              if (key.toLowerCase().includes('team') ||
                  key.toLowerCase().includes('user') ||
                  key.toLowerCase().includes('control') ||
                  key.toLowerCase().includes('franchise') ||
                  key.toLowerCase().includes('name') ||
                  key === 'index') {
                console.log('  ' + key + ':', val);
              }
            }
          } catch(e) {}
        }
      }
    }
  }
}

checkFranchiseUser().catch(console.error);
