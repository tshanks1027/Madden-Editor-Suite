// Quick check of schedule structures
const years = [1975, 1980];

for (const year of years) {
  const d = require(`./data/retro/schedules/${year}.json`);
  const reg = d.games.filter(g => g.weekType !== 'preseason');
  const teams = new Set();
  reg.forEach(g => {
    teams.add(g.homeTeamIndex);
    teams.add(g.awayTeamIndex);
  });
  console.log(`\n=== ${year} ===`);
  console.log('Season length:', d.seasonLength);
  console.log('Regular season games:', reg.length);
  console.log('Teams:', teams.size);
  console.log('Team indices:', [...teams].sort((a,b) => a-b).join(', '));

  // Find which teams are missing
  const missing = [];
  for (let i = 0; i < 32; i++) {
    if (!teams.has(i)) missing.push(i);
  }
  console.log('Missing teams (expansion):', missing.join(', '));
}
