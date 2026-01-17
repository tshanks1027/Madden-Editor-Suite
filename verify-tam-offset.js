/**
 * Verify the correct offset for throwAccuracyMid by checking multiple prospects
 */
const fs = require('fs');

const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\1994 Mod V3\\Draft Classes\\CAREERDRAFT-2012V1';
const working = fs.readFileSync(workingPath);

const BLOCK_SIZE = 4322;
const HEADER_OFFSET = 0x46;

// Check first 10 prospects - if they're QBs, look at throw accuracy values
console.log('=== CHECKING THROW ACCURACY OFFSETS ACROSS MULTIPLE PROSPECTS ===\n');

for (let i = 0; i < 10; i++) {
  const blockStart = HEADER_OFFSET + (i * BLOCK_SIZE);
  const attrStart = blockStart + 0x1000;

  const firstName = working.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = working.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const position = working[attrStart + 0x4a];

  // Position 0 = QB
  if (position === 0) {
    console.log(`=== ${firstName} ${lastName} (QB) - Prospect #${i + 1} ===`);
    console.log(`  0x81: ${working[attrStart + 0x81]} (current TAD)`);
    console.log(`  0x82: ${working[attrStart + 0x82]} (current TAM - suspicious if 0)`);
    console.log(`  0x83: ${working[attrStart + 0x83]} (potential TAM?)`);
    console.log(`  0x84: ${working[attrStart + 0x84]} (current TAS)`);
    console.log(`  0x85: ${working[attrStart + 0x85]} (current TOR)`);
    console.log(`  0x86: ${working[attrStart + 0x86]} (current THP)`);
    console.log(`  0x87: ${working[attrStart + 0x87]} (current TUP)`);
    console.log('');
  } else {
    console.log(`Prospect #${i + 1}: ${firstName} ${lastName} - Position ${position} (not QB)`);
  }
}

// Now let's check if 0x82 is used for something else
console.log('\n=== CHECKING WHAT 0x82 MIGHT BE ===');
console.log('Looking at non-QB players to see if 0x82 has a pattern...\n');

for (let i = 0; i < 20; i++) {
  const blockStart = HEADER_OFFSET + (i * BLOCK_SIZE);
  const attrStart = blockStart + 0x1000;

  const firstName = working.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = working.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const position = working[attrStart + 0x4a];
  const val82 = working[attrStart + 0x82];
  const val83 = working[attrStart + 0x83];

  console.log(`${firstName} ${lastName} | pos=${position} | 0x82=${val82} | 0x83=${val83}`);
}
