const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const data = fs.readFileSync(filePath);

const nussm = 0x5366;
const mendo = 0x7788e;

// From CSV: Nussmeier has kpw=39, kac=32, ret=25
// Mendoza has kpw=47, kac=45, ret=41

console.log('Searching for kicking stats:');
console.log('Nussmeier: KPW=39, KAC=32, RET=25');
console.log('Mendoza: KPW=47, KAC=45, RET=41');
console.log('');

// Check all unmapped bytes
const unmapped = [0x50, 0x51, 0x60, 0x63, 0x64, 0x65, 0x67, 0x79, 0x83, 0x86, 0x8B];

for (const offset of unmapped) {
  const nVal = data[nussm + offset];
  const mVal = data[mendo + offset];

  const offStr = '0x' + offset.toString(16).toUpperCase();
  let match = '';

  if (nVal === 39 && mVal === 47) match = ' ← KPW (Kick Power)';
  if (nVal === 32 && mVal === 45) match = ' ← KAC (Kick Accuracy)';
  if (nVal === 25 && mVal === 41) match = ' ← RET (Kick Return)';

  console.log(`${offStr}: N=${nVal}, M=${mVal}${match}`);
}
