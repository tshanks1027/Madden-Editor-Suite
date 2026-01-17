// RESEARCH: Extract complete Player table schema from madden-franchise
// NO CODING - RESEARCH ONLY

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'node_modules', 'madden-franchise', 'data', 'schemas', '26', 'M26_677_0.gz');

console.log('Reading schema from:', schemaPath);

const compressed = fs.readFileSync(schemaPath);
const decompressed = zlib.gunzipSync(compressed);
const schema = JSON.parse(decompressed.toString());

// Find Player table schema
const playerSchema = schema.schemas.find(s => s.name === 'Player');

if (playerSchema) {
  console.log('\n' + '='.repeat(80));
  console.log('PLAYER TABLE SCHEMA');
  console.log('='.repeat(80));

  // Get field names - fields might be an object or have attributes property
  let fieldList = [];
  if (Array.isArray(playerSchema.fields)) {
    fieldList = playerSchema.fields;
  } else if (typeof playerSchema.fields === 'object') {
    fieldList = Object.values(playerSchema.fields);
  } else if (playerSchema.attributes) {
    fieldList = playerSchema.attributes;
  }

  console.log('Total fields:', fieldList.length);

  // Group fields by prefix/category
  const categories = {
    contract: [],
    team: [],
    plyr: [],
    other: []
  };

  for (const field of fieldList) {
    const name = field.name || field;
    const nameLower = (typeof name === 'string' ? name : '').toLowerCase();

    if (nameLower.includes('contract') || nameLower.includes('salary') || nameLower.includes('bonus')) {
      categories.contract.push(field);
    } else if (nameLower.includes('team') || nameLower === 'teamindex') {
      categories.team.push(field);
    } else if (nameLower.startsWith('plyr_')) {
      categories.plyr.push(field);
    } else {
      categories.other.push(field);
    }
  }

  // Print CONTRACT fields
  console.log('\n' + '-'.repeat(60));
  console.log(`CONTRACT FIELDS (${categories.contract.length}):`);
  console.log('-'.repeat(60));
  for (const f of categories.contract) {
    const name = f.name || f;
    const type = f.type || 'unknown';
    const enumName = f.enum || '';
    console.log(`  ${name}: ${type}${enumName ? ' [' + enumName + ']' : ''}`);
  }

  // Print TEAM fields
  console.log('\n' + '-'.repeat(60));
  console.log(`TEAM FIELDS (${categories.team.length}):`);
  console.log('-'.repeat(60));
  for (const f of categories.team) {
    const name = f.name || f;
    const type = f.type || 'unknown';
    console.log(`  ${name}: ${type}`);
  }

  // Print PLYR_ fields
  console.log('\n' + '-'.repeat(60));
  console.log(`PLYR_ FIELDS (${categories.plyr.length}):`);
  console.log('-'.repeat(60));
  for (const f of categories.plyr) {
    const name = f.name || f;
    const type = f.type || 'unknown';
    console.log(`  ${name}: ${type}`);
  }

  // Look for ContractStatus enum
  console.log('\n' + '='.repeat(80));
  console.log('LOOKING FOR CONTRACTSTATUS ENUM');
  console.log('='.repeat(80));

  const contractStatusField = fieldList.find(f => f.name === 'ContractStatus');
  if (contractStatusField) {
    console.log('ContractStatus field:', JSON.stringify(contractStatusField, null, 2));

    // Look for enum in schema
    if (contractStatusField.enum && schema.meta && schema.meta.enums) {
      const enumDef = schema.meta.enums[contractStatusField.enum];
      if (enumDef) {
        console.log('\nContractStatus enum values:');
        for (const [key, val] of Object.entries(enumDef)) {
          console.log(`  ${key} = ${val}`);
        }
      }
    }
  }

  // Look for all fields containing "free" or "agent" or "status"
  console.log('\n' + '='.repeat(80));
  console.log('FIELDS WITH "STATUS", "FREE", "AGENT", "RELEASE", "ROSTER":');
  console.log('='.repeat(80));

  for (const f of fieldList) {
    const name = f.name || f;
    const nameLower = (typeof name === 'string' ? name : '').toLowerCase();
    if (nameLower.includes('status') || nameLower.includes('free') ||
        nameLower.includes('agent') || nameLower.includes('release') ||
        nameLower.includes('roster')) {
      const type = f.type || 'unknown';
      const enumName = f.enum || '';
      console.log(`  ${name}: ${type}${enumName ? ' [' + enumName + ']' : ''}`);
    }
  }

} else {
  console.log('Player schema not found!');
  const schemaNames = schema.schemas.map(s => s.name).filter(n => n.includes('Player'));
  console.log('Player-related schemas:', schemaNames.join(', '));
}

console.log('\n' + '='.repeat(80));
console.log('SCHEMA ANALYSIS COMPLETE');
console.log('='.repeat(80));
