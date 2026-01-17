/**
 * Analyze the team reference prefix structure
 */
const { create } = require('madden-franchise');

async function analyzePrefix() {
  const file1980 = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';
  const file2011 = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';

  const f1980 = await create(file1980);
  const f2011 = await create(file2011);

  // Get Team tables
  const t1980 = f1980.getTableByUniqueId(637929298);
  const t2011 = f2011.getTableByUniqueId(637929298);

  console.log('=== TEAM TABLE INFO ===');
  console.log('1980 Team table:');
  console.log('  uniqueId:', t1980.header.uniqueId);
  console.log('  tableId:', t1980.header.tableId);
  console.log('  name:', t1980.name);
  console.log('  tableIndex:', t1980.header.tableIndex);
  console.log('  record1Offset:', t1980.header.record1Offset);

  console.log('2011 Team table:');
  console.log('  uniqueId:', t2011.header.uniqueId);
  console.log('  tableId:', t2011.header.tableId);
  console.log('  name:', t2011.name);
  console.log('  tableIndex:', t2011.header.tableIndex);
  console.log('  record1Offset:', t2011.header.record1Offset);

  // Check if tableIndex is in the prefix
  console.log('\n=== PREFIX ANALYSIS ===');
  console.log('1980 prefix: 001011100011101000000000');
  console.log('2011 prefix: 001011100010011000000000');

  // Parse prefixes
  const prefix1980 = '001011100011101000000000';
  const prefix2011 = '001011100010011000000000';

  // First 8 bits
  console.log('\nByte 0 (bits 0-7):');
  console.log('  1980:', prefix1980.slice(0, 8), '=', parseInt(prefix1980.slice(0, 8), 2));
  console.log('  2011:', prefix2011.slice(0, 8), '=', parseInt(prefix2011.slice(0, 8), 2));

  // Second 8 bits
  console.log('Byte 1 (bits 8-15):');
  console.log('  1980:', prefix1980.slice(8, 16), '=', parseInt(prefix1980.slice(8, 16), 2));
  console.log('  2011:', prefix2011.slice(8, 16), '=', parseInt(prefix2011.slice(8, 16), 2));

  // Third 8 bits
  console.log('Byte 2 (bits 16-23):');
  console.log('  1980:', prefix1980.slice(16, 24), '=', parseInt(prefix1980.slice(16, 24), 2));
  console.log('  2011:', prefix2011.slice(16, 24), '=', parseInt(prefix2011.slice(16, 24), 2));

  // Check tableIndex relationship
  console.log('\n=== TABLE INDEX ===');
  console.log('1980 tableIndex:', t1980.header.tableIndex);
  console.log('2011 tableIndex:', t2011.header.tableIndex);

  // The middle byte might be the tableIndex
  console.log('\nMiddle byte vs tableIndex:');
  console.log('  1980 middle byte:', parseInt(prefix1980.slice(8, 16), 2), 'tableIndex:', t1980.header.tableIndex);
  console.log('  2011 middle byte:', parseInt(prefix2011.slice(8, 16), 2), 'tableIndex:', t2011.header.tableIndex);
}

analyzePrefix().catch(console.error);
