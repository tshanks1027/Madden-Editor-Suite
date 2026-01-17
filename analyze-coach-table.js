const Franchise = require('madden-franchise');
const filePath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST-AUTOSAVE';

async function analyze() {
  try {
    console.log('Loading franchise file...');
    const franchise = await Franchise.create(filePath);
    const tables = franchise.tables || [];

    // List all tables with "coach" in name
    console.log('Tables with "coach" in name:');
    tables.filter(t => t.name.toLowerCase().includes('coach')).forEach(t => {
      console.log(' -', t.name);
    });

    // Find Coach table
    const coachTable = franchise.getTableByName('Coach');
    if (!coachTable) {
      console.log('Coach table not found.');
      return;
    }

    console.log('\nCoach table found:', coachTable.name);

    // Read the table records
    await coachTable.readRecords();
    const records = coachTable.records;
    console.log('Record count:', records.length);

    // Get field names
    if (coachTable.header && coachTable.header.fields) {
      console.log('\nFields:', coachTable.header.fields.map(f => f.name).join(', '));
    }

    // Show first 10 coaches with key fields
    console.log('\n=== First 10 Coaches ===');
    for (let i = 0; i < Math.min(10, records.length); i++) {
      const rec = records[i];
      const firstName = rec.FirstName || '';
      const lastName = rec.LastName || '';
      const assetName = rec.AssetName || '';
      const genericHead = rec.GenericHeadAssetName || '';
      const portraitId = rec.PortraitId;
      const skinTone = rec.SkinTone;
      const contractStatus = rec.ContractStatus || '';

      console.log(`\n[${i}] ${firstName} ${lastName}`);
      console.log('  AssetName (PAM):', assetName);
      console.log('  GenericHeadAssetName:', genericHead);
      console.log('  PortraitId:', portraitId);
      console.log('  SkinTone:', skinTone);
      console.log('  ContractStatus:', contractStatus);
    }

    // Collect all unique GenericHeadAssetName values
    console.log('\n=== All Unique GenericHeadAssetName Values ===');
    const genericHeadMap = {};
    for (const rec of records) {
      const genericHead = rec.GenericHeadAssetName || '';
      if (genericHead && genericHead !== 'MustBeUnique') {
        if (!genericHeadMap[genericHead]) {
          genericHeadMap[genericHead] = [];
        }
        genericHeadMap[genericHead].push(`${rec.FirstName} ${rec.LastName}`);
      }
    }

    const sortedHeads = Object.keys(genericHeadMap).sort();
    console.log(`Found ${sortedHeads.length} unique generic head types:`);
    sortedHeads.forEach(head => {
      console.log(`  ${head} (used by ${genericHeadMap[head].length} coaches): ${genericHeadMap[head].slice(0, 2).join(', ')}...`);
    });

    // Collect all real coaches with PAM
    console.log('\n=== Real Coaches with PAM Values ===');
    const realCoaches = [];
    for (const rec of records) {
      const pam = rec.AssetName || '';
      if (pam && pam.endsWith('_C_PRO')) {
        realCoaches.push({
          name: `${rec.FirstName} ${rec.LastName}`,
          pam: pam,
          portraitId: rec.PortraitId
        });
      }
    }
    console.log(`Found ${realCoaches.length} real coaches with PAM:`);
    realCoaches.slice(0, 30).forEach(c => {
      console.log(`  ${c.name}: PAM=${c.pam}, PortraitId=${c.portraitId}`);
    });

  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

analyze();
