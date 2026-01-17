/**
 * Compare current state of 1980test vs AUTOSAVE vs 2011 Throwback
 */
const { create } = require('madden-franchise');

async function compare() {
  const files = [
    { name: '1980test', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test' },
    { name: '1980-AUTOSAVE', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE' },
    { name: '2011 Throwback', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09' }
  ];

  for (const file of files) {
    console.log('\n========== ' + file.name + ' ==========');
    try {
      const f = await create(file.path);

      // Check SeasonInfo
      const si = f.getTableByName('SeasonInfo');
      await si.readRecords();
      for (const r of si.records) {
        if (r.isEmpty === false) {
          console.log('CurrentWeek:', r.CurrentWeek);
          console.log('CurrentSeasonWeekType:', r.CurrentSeasonWeekType);
        }
      }

      // Check preseason game status
      const gt = f.getTableByUniqueId(1607878349);
      await gt.readRecords();

      const weekStats = {};
      for (const g of gt.records) {
        if (g.isEmpty) continue;
        const wt = g.SeasonWeekType;
        if (wt === 0 || wt === 'PreSeason') {
          const week = g.SeasonWeek;
          if (weekStats[week] === undefined) weekStats[week] = { unplayed: 0, played: 0, other: 0 };
          const status = String(g.GameStatus);
          if (status === 'Unplayed') weekStats[week].unplayed++;
          else if (status === 'HomeWon' || status === 'AwayWon') weekStats[week].played++;
          else weekStats[week].other++;
        }
      }

      console.log('Preseason weeks:');
      for (const week of Object.keys(weekStats).sort((a, b) => Number(a) - Number(b))) {
        const s = weekStats[week];
        console.log('  Week ' + week + ': ' + s.unplayed + ' unplayed, ' + s.played + ' played, ' + s.other + ' other');
      }

      // Check Coach table - first coach
      const ct = f.getTableByName('Coach');
      await ct.readRecords();
      let coachCount = 0;
      for (const c of ct.records) {
        if (c.isEmpty) continue;
        if (coachCount < 3) {
          console.log('Coach ' + coachCount + ': Name="' + c.Name + '", FirstName="' + c.FirstName + '", LastName="' + c.LastName + '"');
          coachCount++;
        }
      }

    } catch (err) {
      console.log('Error loading:', err.message);
    }
  }
}

compare().catch(console.error);
