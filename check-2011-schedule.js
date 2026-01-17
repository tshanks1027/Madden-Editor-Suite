const d = require('./data/retro/schedules/2011.json');
const pre = d.games.filter(g => g.weekType === 'preseason');
const reg = d.games.filter(g => g.weekType !== 'preseason');
console.log('Preseason games:', pre.length);
console.log('Regular season games:', reg.length);
if (reg.length > 0) {
  console.log('First reg game:', JSON.stringify(reg[0]));
  // Count by week
  const byWeek = {};
  for (const g of reg) {
    byWeek[g.week] = (byWeek[g.week] || 0) + 1;
  }
  console.log('Games per week:', byWeek);
}
