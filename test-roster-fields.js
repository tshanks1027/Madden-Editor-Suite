/**
 * Test script to check which fields are actually in a roster file
 * Run with: node test-roster-fields.js
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-TESTTEST';

async function testRosterFields() {
  console.log('Loading roster file:', filePath);

  const helper = new MaddenRosterHelper();
  const file = await helper.load(filePath);

  console.log('\nFound', file.tables.length, 'tables');
  console.log('Tables:', file.tables.map(t => t.name).join(', '));

  const playerTable = file.PLAY;
  console.log('\nPlayer table has', playerTable.records.length, 'players');

  // Get first player
  const firstPlayer = playerTable.records[0];

  console.log('\n=== ALL FIELDS IN FIRST PLAYER ===');
  const fieldNames = Object.keys(firstPlayer.fields).sort();
  console.log('Total fields:', fieldNames.length);
  console.log('Fields:', fieldNames.join(', '));

  // Check for birthday-related fields
  console.log('\n=== BIRTHDAY-RELATED FIELDS ===');
  const birthdayFields = fieldNames.filter(f => f.toLowerCase().includes('birth') || f.toLowerCase().includes('age') || f === 'PLBD' || f === 'PAGE');
  console.log('Birthday/Age fields found:', birthdayFields.join(', '));

  birthdayFields.forEach(field => {
    const value = firstPlayer.fields[field].value;
    console.log(`  ${field} = ${value} (type: ${typeof value})`);
  });

  // Check for archetype fields
  console.log('\n=== ARCHETYPE-RELATED FIELDS ===');
  const archetypeFields = fieldNames.filter(f => f.toLowerCase().includes('arch') || f.toLowerCase().includes('type') || f === 'PLTY' || f === 'PARC');
  console.log('Archetype fields found:', archetypeFields.join(', '));

  archetypeFields.forEach(field => {
    const value = firstPlayer.fields[field].value;
    console.log(`  ${field} = ${value} (type: ${typeof value})`);
  });

  // Sample first 3 players
  console.log('\n=== SAMPLE OF FIRST 3 PLAYERS ===');
  for (let i = 0; i < Math.min(3, playerTable.records.length); i++) {
    const record = playerTable.records[i];
    const fields = record.fields;

    console.log(`\nPlayer ${i + 1}:`);
    console.log('  Name:', fields.PFNA?.value, fields.PLNA?.value);
    console.log('  Position:', fields.PPOS?.value);
    console.log('  Age:', fields.PAGE?.value);
    console.log('  PLBD:', fields.PLBD?.value);
    console.log('  PLTY:', fields.PLTY?.value);
  }
}

testRosterFields().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
