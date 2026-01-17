const fs = require('fs');
const atlas = JSON.parse(fs.readFileSync('./data/portrait-atlas.json', 'utf8'));

// Get all generic morphed portraits
const morphed = atlas.portraits.filter(p => p.id.includes('_morphed'));
console.log('Total morphed:', morphed.length);
console.log('');

// Group by generation
const byGen = {};
morphed.forEach(g => {
  const m = g.id.match(/generic_(\d+)_/);
  if (m) {
    const k = m[1];
    if (byGen[k] === undefined) byGen[k] = [];
    byGen[k].push({ id: g.id, sheet: g.sheet });
  }
});

Object.keys(byGen).sort((a,b) => parseInt(a) - parseInt(b)).forEach(k => {
  const items = byGen[k];
  const sheets = [...new Set(items.map(i => i.sheet))].sort((a,b) => a-b);
  console.log('Gen ' + k + ': ' + items.length + ' items, sheets ' + sheets.join(','));
  console.log('  First: ' + items[0].id);
  console.log('  Last: ' + items[items.length-1].id);
});

// Now look at sheet 0 to see what race those faces should be
console.log('');
console.log('=== SHEET 0 (WHITE FACES) ===');
const sheet0 = atlas.portraits.filter(p => p.sheet === 0);
sheet0.forEach(p => console.log('  ' + p.id));
