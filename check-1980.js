const d = require('./data/retro/schedules/1980.json');
const byWeek = {};
d.games.forEach(g => {
  if (!byWeek[g.week]) byWeek[g.week] = 0;
  byWeek[g.week]++;
});
console.log('1980 Schedule Analysis:');
console.log('Total games:', d.games.length);
console.log('Regular season weeks:', d.regularSeasonWeeks);
console.log('\nGames per week:');
Object.keys(byWeek).sort((a, b) => a - b).forEach(w => console.log('  Week ' + w + ': ' + byWeek[w] + ' games'));
