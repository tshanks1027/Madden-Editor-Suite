const path = require('path');
const MaddenRosterHelper = require('./.vite/build/lib/helpers/MaddenRosterHelper');

async function explore() {
  const helper = new MaddenRosterHelper();
  const file = await helper.load('data/retro/M26_1970_Cowboys_Template.ros');

  const blob = file.BLOB?.records?.[0];
  if (!blob) {
    console.log('No BLOB found');
    return;
  }

  const blbm = blob.fields?.['BLBM']?.value;
  if (!blbm || !blbm._records) {
    console.log('No BLBM found');
    return;
  }

  console.log('BLBM has', blbm._records.length, 'records');

  // Get first record and show all field names
  const first = blbm._records[0];
  const fields = first.fields || first._fields;

  console.log('\nALL BLBM FIELDS:');
  const fieldNames = Object.keys(fields).sort();
  for (const name of fieldNames) {
    const field = fields[name];
    const value = field.value !== undefined ? field.value : field._value;
    console.log('  ' + name + ': ' + JSON.stringify(value).substring(0, 60));
  }

  // Look for body-related fields
  console.log('\n--- Possible body type fields ---');
  const bodyFields = fieldNames.filter(n =>
    n.toLowerCase().includes('body') ||
    n.toLowerCase().includes('bld') ||
    n.toLowerCase().includes('weight') ||
    n.toLowerCase().includes('height') ||
    n.toLowerCase().includes('size') ||
    n.toLowerCase().includes('musc') ||
    n.toLowerCase().includes('fat') ||
    n.toLowerCase().includes('morph') ||
    n.toLowerCase().includes('build')
  );
  console.log('Body-related:', bodyFields);

  // Show a few sample records to see variation
  console.log('\n--- Sample values from first 5 records ---');
  for (let i = 0; i < 5 && i < blbm._records.length; i++) {
    const rec = blbm._records[i];
    const f = rec.fields || rec._fields;
    const genr = f['GENR']?.value || f['GENR']?._value;
    const sknt = f['SKNT']?.value || f['SKNT']?._value;
    console.log(`Record ${i}: GENR=${genr}, SKNT=${sknt}`);

    // Print any fields with numeric values 0-10 that might be body morphs
    for (const name of fieldNames) {
      const val = f[name]?.value !== undefined ? f[name].value : f[name]?._value;
      if (typeof val === 'number' && val >= 0 && val <= 100 && !['SKNT'].includes(name)) {
        // Could be a morph slider
      }
    }
  }
}

explore().catch(e => console.error(e));
