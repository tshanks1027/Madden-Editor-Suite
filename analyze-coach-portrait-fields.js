// Analyze Coach table to understand portrait/model relationships
const Franchise = require('madden-franchise');
const filePath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST-AUTOSAVE';

async function analyze() {
  try {
    console.log('Loading franchise file...');
    const franchise = await Franchise.create(filePath);

    const coachTable = franchise.getTableByName('Coach');
    if (!coachTable) {
      console.log('Coach table not found.');
      return;
    }

    await coachTable.readRecords();
    const records = coachTable.records;

    // Get all fields
    if (coachTable.header && coachTable.header.fields) {
      console.log('\n=== All Coach Fields ===');
      const fields = coachTable.header.fields.map(f => f.name);
      console.log(fields.join(', '));
    }

    // Show coaches with their portrait-related fields
    console.log('\n=== First 20 Coaches - Portrait Fields ===');
    console.log('Name | AssetName (PAM) | GenericHeadAssetName | PortraitId | SkinTone | ContractStatus');
    console.log('-'.repeat(120));

    for (let i = 0; i < Math.min(20, records.length); i++) {
      const rec = records[i];
      const name = `${rec.FirstName || ''} ${rec.LastName || ''}`.padEnd(20);
      const pam = (rec.AssetName || '').padEnd(25);
      const genericHead = (rec.GenericHeadAssetName || '').padEnd(25);
      const portraitId = String(rec.PortraitId !== undefined ? rec.PortraitId : 'null').padEnd(10);
      const skinTone = String(rec.SkinTone !== undefined ? rec.SkinTone : 'null').padEnd(10);
      const status = rec.ContractStatus || '';

      console.log(`${name} | ${pam} | ${genericHead} | ${portraitId} | ${skinTone} | ${status}`);
    }

    // Analyze all coaches - find unique combinations
    console.log('\n=== Analysis ===');

    // Coaches with real PAM (scanned faces)
    const realCoaches = records.filter(r => r.AssetName && r.AssetName.endsWith('_C_PRO') && !r.AssetName.startsWith('_'));
    console.log(`\nReal scanned coaches: ${realCoaches.length}`);
    realCoaches.slice(0, 10).forEach(r => {
      console.log(`  ${r.FirstName} ${r.LastName}: PAM=${r.AssetName}, GenericHead=${r.GenericHeadAssetName}`);
    });

    // Coaches with GenericHeadAssetName but no PAM
    const genericCoaches = records.filter(r => {
      const hasGenericHead = r.GenericHeadAssetName && r.GenericHeadAssetName !== 'MustBeUnique';
      const noPam = !r.AssetName || r.AssetName === '' || r.AssetName === '_C_PRO';
      return hasGenericHead && noPam;
    });
    console.log(`\nGeneric coaches (with GenericHeadAssetName, no PAM): ${genericCoaches.length}`);
    genericCoaches.slice(0, 10).forEach(r => {
      console.log(`  ${r.FirstName} ${r.LastName}: GenericHead=${r.GenericHeadAssetName}, SkinTone=${r.SkinTone}`);
    });

    // Collect unique GenericHeadAssetName values with their SkinTone
    console.log('\n=== GenericHeadAssetName → SkinTone Mapping ===');
    const headToSkin = {};
    for (const rec of records) {
      const head = rec.GenericHeadAssetName;
      if (head && head !== 'MustBeUnique') {
        const skinTone = rec.SkinTone;
        if (!headToSkin[head]) {
          headToSkin[head] = new Set();
        }
        headToSkin[head].add(skinTone);
      }
    }

    // Show mapping
    const sortedHeads = Object.keys(headToSkin).sort();
    console.log(`Found ${sortedHeads.length} unique GenericHeadAssetName values`);
    sortedHeads.slice(0, 30).forEach(head => {
      const skins = Array.from(headToSkin[head]).join(', ');
      console.log(`  ${head} → SkinTone(s): ${skins}`);
    });

    // Find any coaches with PortraitId set
    console.log('\n=== Coaches with PortraitId set ===');
    const withPortraitId = records.filter(r => r.PortraitId !== undefined && r.PortraitId !== null && r.PortraitId !== 0);
    console.log(`Coaches with non-zero PortraitId: ${withPortraitId.length}`);
    withPortraitId.slice(0, 10).forEach(r => {
      console.log(`  ${r.FirstName} ${r.LastName}: PortraitId=${r.PortraitId}, PAM=${r.AssetName}`);
    });

  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

analyze();
