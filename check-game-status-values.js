/**
 * Check what GameStatus values look like in 2011 Throwback (working file)
 */
const { create } = require('madden-franchise');

async function check() {
  const f = await create('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09');
  const gt = f.getTableByUniqueId(1607878349);
  await gt.readRecords();

  console.log('=== GameStatus field analysis ===');

  // Get the first few preseason games and see their raw GameStatus
  let count = 0;
  for (const g of gt.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if (wt === 0 || wt === 'PreSeason') {
      console.log('Game ' + count + ':');
      console.log('  GameStatus:', g.GameStatus);
      console.log('  GameStatus type:', typeof g.GameStatus);
      console.log('  Field_18:', g.Field_18);
      count++;
      if (count >= 5) break;
    }
  }

  // Also check what the GameStatus enum values are
  console.log('\n=== Unique GameStatus values in 2011 file ===');
  const statusValues = new Set();
  for (const g of gt.records) {
    if (g.isEmpty === false) {
      statusValues.add(String(g.GameStatus));
    }
  }
  console.log('Unique values:', Array.from(statusValues).join(', '));
}

check().catch(console.error);
