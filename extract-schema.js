/**
 * Extract schema info for specific tables from franchise file
 */
const fs = require('fs');

const schemaData = fs.readFileSync('node_modules/madden-franchise/data/schemas/26/M26_677_0', 'utf8');
const schema = JSON.parse(schemaData);

// Find Player schema
const playerSchema = schema.schemas.find(s => s.name === 'Player');
if (playerSchema) {
  console.log('=== PLAYER SCHEMA ===');
  console.log('numMembers:', playerSchema.numMembers);
  console.log('base:', playerSchema.base);
  console.log('\nAttributes:');
  for (const attr of playerSchema.attributes) {
    console.log(`  ${attr.name}: ${attr.type}${attr.enum ? ' (enum)' : ''}${attr.default !== undefined ? ` [default: ${attr.default}]` : ''}`);
  }
}

// Find Team schema
const teamSchema = schema.schemas.find(s => s.name === 'Team');
if (teamSchema) {
  console.log('\n=== TEAM SCHEMA ===');
  console.log('numMembers:', teamSchema.numMembers);
  console.log('\nAttributes:');
  for (const attr of teamSchema.attributes) {
    console.log(`  ${attr.name}: ${attr.type}${attr.enum ? ' (enum)' : ''}${attr.default !== undefined ? ` [default: ${attr.default}]` : ''}`);
  }
}

// Look for FreeAgent related schemas
console.log('\n=== SCHEMAS CONTAINING "Free" or "Contract" ===');
for (const s of schema.schemas) {
  if (s.name.toLowerCase().includes('free') || s.name.toLowerCase().includes('contract')) {
    console.log(`  ${s.name}`);
  }
}

// Check for ContractStatus in Player schema
if (playerSchema) {
  console.log('\n=== PLAYER FIELDS WITH "Contract" or "Free" or "Status" ===');
  for (const attr of playerSchema.attributes) {
    if (attr.name.toLowerCase().includes('contract') ||
        attr.name.toLowerCase().includes('free') ||
        attr.name.toLowerCase().includes('status')) {
      console.log(`  ${attr.name}: ${attr.type}`);
      if (attr.enum) {
        console.log('    Enum values:', JSON.stringify(attr.enum._members?.map(m => m._name) || []));
      }
    }
  }
}
