/**
 * Dump ALL field names from Coach table to see what we can set
 */
const { create } = require('madden-franchise');

async function dumpCoachFields() {
  const workingFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';

  console.log('Loading 2011 Throwback file...');
  const franchise = await create(workingFile);

  // Get Coach table
  let coachTable = franchise.getTableByUniqueId(1864063867);
  if (!coachTable) coachTable = franchise.getTableByName('Coach');
  await coachTable.readRecords();

  console.log('\n=== COACH TABLE SCHEMA ===');

  // Try to get schema/field definitions
  if (coachTable._fields) {
    console.log('\nFields from _fields:');
    for (const f of coachTable._fields) {
      console.log(`  ${f.name}: type=${f.type || 'unknown'}, offset=${f.offset || 'n/a'}`);
    }
  }

  // Get fields from a sample record
  const sampleCoach = coachTable.records.find(r => !r.isEmpty && r.Position === 'HeadCoach');

  if (sampleCoach) {
    console.log('\n=== ALL ACCESSIBLE FIELDS FROM RECORD ===');
    console.log('Sample: ' + sampleCoach.FirstName + ' ' + sampleCoach.LastName + ' (index ' + sampleCoach.index + ')');

    const proto = Object.getPrototypeOf(sampleCoach);
    const descriptors = Object.getOwnPropertyDescriptors(proto);

    const fields = [];
    for (const [key, desc] of Object.entries(descriptors)) {
      if (desc.get && !key.startsWith('_')) {
        fields.push(key);
      }
    }

    console.log('\nAll field names (' + fields.length + '):');
    console.log(fields.sort().join('\n'));

    // Now print all field values for this coach
    console.log('\n=== ALL FIELD VALUES ===');
    for (const field of fields.sort()) {
      try {
        const val = sampleCoach[field];
        if (val !== undefined && val !== null) {
          if (typeof val === 'object') {
            const str = JSON.stringify(val);
            if (str.length < 200) {
              console.log(`${field}: ${str}`);
            } else {
              console.log(`${field}: [object, ${str.length} chars]`);
            }
          } else {
            console.log(`${field}: ${val}`);
          }
        }
      } catch (e) {
        console.log(`${field}: [error: ${e.message}]`);
      }
    }
  }

  // Also check if there's a separate commentary/name table
  console.log('\n\n=== SEARCHING FOR NAME/COMMENTARY TABLES ===');
  const namePatterns = ['commentary', 'name', 'display', 'audio', 'announcer', 'presentation'];

  for (const table of franchise.tables) {
    if (!table.name) continue;
    const lower = table.name.toLowerCase();
    for (const pattern of namePatterns) {
      if (lower.includes(pattern)) {
        console.log(`Found: ${table.name}`);
        try {
          await table.readRecords();
          const count = table.records.filter(r => !r.isEmpty).length;
          console.log(`  Records: ${count}`);

          // Show field names
          const rec = table.records.find(r => !r.isEmpty);
          if (rec) {
            const proto = Object.getPrototypeOf(rec);
            const desc = Object.getOwnPropertyDescriptors(proto);
            const fields = Object.keys(desc).filter(k => desc[k].get && !k.startsWith('_'));
            console.log(`  Fields: ${fields.slice(0, 10).join(', ')}${fields.length > 10 ? '...' : ''}`);
          }
        } catch (e) {
          console.log(`  Error: ${e.message}`);
        }
        break;
      }
    }
  }

  // Check if there's an AssetName lookup table
  console.log('\n\n=== CHECKING AssetName RELATED TABLES ===');
  for (const table of franchise.tables) {
    if (!table.name) continue;
    const lower = table.name.toLowerCase();
    if (lower.includes('asset') || lower.includes('chvi') || lower.includes('visual')) {
      console.log(`Found: ${table.name}`);
      try {
        await table.readRecords();
        const count = table.records.filter(r => !r.isEmpty).length;
        console.log(`  Records: ${count}`);
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }
    }
  }
}

dumpCoachFields().catch(console.error);
