const fs = require('fs');

// Load the EDITED file where you changed PEPS to urlacherBrian_1895
const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';
const buffer = fs.readFileSync(filePath);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;

// Search for the PEPS value you entered: urlacherBrian_1895
const searchString = 'urlacherBrian_1895';
const searchBuffer = Buffer.from(searchString, 'utf8');

console.log(`Searching for "${searchString}" in the file...\n`);

let found = false;
let offset = buffer.indexOf(searchBuffer, 0);

while (offset !== -1) {
  console.log(`Found at offset 0x${offset.toString(16)}`);

  // Figure out which prospect block this is in
  if (offset >= DATA_START) {
    const offsetFromData = offset - DATA_START;
    const prospectNum = Math.floor(offsetFromData / BLOCK_SIZE);
    const offsetInBlock = offsetFromData % BLOCK_SIZE;

    console.log(`  Prospect #${prospectNum + 1}`);
    console.log(`  Offset in block: 0x${offsetInBlock.toString(16)}`);
  }

  found = true;
  offset = buffer.indexOf(searchBuffer, offset + 1);
}

if (!found) {
  console.log('NOT FOUND - This means the editor is NOT writing PEPS to the file!');
  console.log('\nSearching for the ORIGINAL PEPS value instead...');

  // Search for original value
  const originalPEPS = 'gen_7_H_BMS_013';
  const originalBuffer = Buffer.from(originalPEPS, 'utf8');

  offset = buffer.indexOf(originalBuffer, 0);
  while (offset !== -1) {
    console.log(`Found original PEPS at offset 0x${offset.toString(16)}`);

    if (offset >= DATA_START) {
      const offsetFromData = offset - DATA_START;
      const prospectNum = Math.floor(offsetFromData / BLOCK_SIZE);
      const offsetInBlock = offsetFromData % BLOCK_SIZE;

      console.log(`  Prospect #${prospectNum + 1}`);
      console.log(`  Offset in block: 0x${offsetInBlock.toString(16)}`);
    }

    offset = buffer.indexOf(originalBuffer, offset + 1);
  }
}
