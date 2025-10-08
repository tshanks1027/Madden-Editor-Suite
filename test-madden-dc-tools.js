/**
 * Test Script: madden-draft-class-tools on Madden 26 File
 *
 * Purpose: Test if the madden-draft-class-tools library can parse Madden 26 draft class files
 * Expected: Should fail due to Madden 26 compression/format differences
 */

const fs = require('fs');
const path = require('path');
const { readDraftClass } = require('madden-draft-class-tools');

// File path
const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Madden Files\\CAREERDRAFT-2026DRAFT7RND';

console.log('='.repeat(80));
console.log('TEST: madden-draft-class-tools on Madden 26 File');
console.log('='.repeat(80));
console.log(`File: ${filePath}`);
console.log('');

try {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('❌ ERROR: File does not exist');
    process.exit(1);
  }

  // Read file
  console.log('Reading file...');
  const buffer = fs.readFileSync(filePath);
  console.log(`✓ File read successfully (${buffer.length} bytes)`);
  console.log('');

  // Inspect first 100 bytes
  console.log('First 100 bytes (hex):');
  console.log(buffer.subarray(0, 100).toString('hex'));
  console.log('');

  console.log('First 100 bytes (ASCII):');
  const ascii = buffer.subarray(0, 100).toString('utf8', 0, 100).replace(/[\x00-\x1F\x7F-\x9F]/g, '.');
  console.log(ascii);
  console.log('');

  // Try to parse with madden-draft-class-tools
  console.log('Attempting to parse with madden-draft-class-tools...');
  const startTime = Date.now();
  const draftClass = readDraftClass(buffer);
  const endTime = Date.now();

  console.log(`✅ SUCCESS: File parsed in ${endTime - startTime}ms`);
  console.log('');

  // Display results
  console.log('Header:');
  console.log(JSON.stringify(draftClass.header, null, 2));
  console.log('');

  console.log(`Number of prospects: ${draftClass.prospects.length}`);
  console.log('');

  if (draftClass.prospects.length > 0) {
    console.log('First prospect:');
    console.log(JSON.stringify(draftClass.prospects[0], null, 2));
  }

} catch (error) {
  console.log(`❌ FAILED: ${error.message}`);
  console.log('');
  console.log('Error stack:');
  console.log(error.stack);
  console.log('');
  console.log('This is EXPECTED for Madden 26 files.');
  console.log('Reason: madden-draft-class-tools is designed for Madden 25 format.');
  console.log('Madden 26 uses different compression and file structure.');
}

console.log('');
console.log('='.repeat(80));
console.log('TEST COMPLETE');
console.log('='.repeat(80));
