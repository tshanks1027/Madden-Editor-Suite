// Check FranchiseUser table for user's controlled team

async function checkFranchiseUser() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  console.log('=== FranchiseUser Table ===\n');
  const franchiseUserTable = franchise.getTableByName('FranchiseUser');
  if (franchiseUserTable) {
    await franchiseUserTable.readRecords();
    console.log(`Records: ${franchiseUserTable.records.length}`);

    for (const rec of franchiseUserTable.records) {
      if (rec.isEmpty) continue;
      console.log('\nFranchiseUser record:');
      const keys = Object.keys(rec).filter(k => !k.startsWith('_') && typeof rec[k] !== 'function');
      for (const key of keys) {
        console.log(`  ${key}: ${rec[key]}`);
      }
    }
  }

  // Also check Owner table
  console.log('\n=== Owner Table (first 3 non-empty) ===\n');
  const ownerTable = franchise.getTableByName('Owner');
  if (ownerTable) {
    await ownerTable.readRecords();
    let count = 0;
    for (const rec of ownerTable.records) {
      if (rec.isEmpty) continue;
      count++;
      if (count <= 3) {
        console.log(`Owner ${count}:`);
        const keys = Object.keys(rec).filter(k => !k.startsWith('_') && typeof rec[k] !== 'function');
        for (const key of keys.slice(0, 15)) {
          console.log(`  ${key}: ${rec[key]}`);
        }
      }
    }
    console.log(`\nTotal owners: ${count}`);
  }

  // Check Coach table for user's coach
  console.log('\n=== Coach Table (looking for user coach) ===\n');
  const coachTable = franchise.getTableByName('Coach');
  if (coachTable) {
    await coachTable.readRecords();
    let count = 0;
    for (const rec of coachTable.records) {
      if (rec.isEmpty) continue;
      count++;
      // Look for coaches with user-related fields
      const hasUserField = rec.IsUserControlled || rec.IsUser || rec.UserControlled;
      if (count <= 3 || hasUserField) {
        console.log(`Coach ${count}${hasUserField ? ' (USER)' : ''}:`);
        const keys = Object.keys(rec).filter(k => !k.startsWith('_') && typeof rec[k] !== 'function');
        for (const key of keys.slice(0, 20)) {
          console.log(`  ${key}: ${rec[key]}`);
        }
      }
    }
    console.log(`\nTotal coaches: ${count}`);
  }
}

checkFranchiseUser().catch(console.error);
