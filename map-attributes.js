const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const data = fs.readFileSync(filePath);

const nussm = 0x5366;
const mendo = 0x7788e;

// Complete stats from CSV
const stats = {
  nussm: { speed: 76, acc: 81, agi: 78, cod: 76, str: 61, awr: 64, car: 67, bcv: 62, btk: 60, trk: 54, sfa: 49, spm: 62, jkm: 65, cth: 52, cit: 37, spc: 43, srr: 35, mrr: 25, drr: 30, rls: 38, jmp: 77, thp: 92, sac: 89, mac: 87, dac: 82, run: 76, tup: 82, pac: 78, bsk: 61, pbk: 11, pbp: 10, pbf: 10, rbk: 39, rbp: 39, rbf: 45, lbk: 40, ibl: 25, prc: 31, tak: 40, pow: 41, bsh: 22, fmv: 33, pmv: 25, pur: 35, mcv: 24, zcv: 34, prs: 33, sta: 88, tgh: 98 },
  mendo: { speed: 86, acc: 88, agi: 84, cod: 80, str: 72, awr: 61, car: 75, bcv: 78, btk: 72, trk: 70, sfa: 74, spm: 72, jkm: 80, cth: 55, cit: 23, spc: 24, srr: 24, mrr: 23, drr: 28, rls: 36, jmp: 86, thp: 96, sac: 84, mac: 78, dac: 80, run: 82, tup: 78, pac: 78, bsk: 78, pbk: 11, pbp: 10, pbf: 10, rbk: 28, rbp: 22, rbf: 21, lbk: 26, ibl: 28, prc: 30, tak: 52, pow: 54, bsh: 55, fmv: 54, pmv: 58, pur: 68, mcv: 24, zcv: 52, prs: 42, sta: 86, tgh: 95 }
};

console.log('Complete M26 Attribute Mapping:\n');

const finalMap = {};

// Scan all bytes and find matches
for (let offset = 0x50; offset <= 0x90; offset++) {
  const nVal = data[nussm + offset];
  const mVal = data[mendo + offset];

  // Find stats that match BOTH players
  let matches = [];
  for (const stat of Object.keys(stats.nussm)) {
    if (stats.nussm[stat] === nVal && stats.mendo[stat] === mVal) {
      matches.push(stat);
    }
  }

  if (matches.length > 0) {
    finalMap[offset] = matches[0]; // Take first match
    const offStr = '0x' + offset.toString(16).toUpperCase().padEnd(4);
    console.log(`${offStr}: ${matches[0].toUpperCase().padEnd(6)} (N=${nVal}, M=${mVal})`);
  }
}

console.log('\n\nAttribute byte offset order for parser:');
const orderedOffsets = Object.keys(finalMap).map(k => parseInt(k)).sort((a, b) => a - b);
for (const offset of orderedOffsets) {
  console.log(`  0x${offset.toString(16)}: ${finalMap[offset]}`);
}
