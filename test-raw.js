const { FranchiseFile } = require('madden-franchise');

async function test() {
  const throwbackPath = 'C:/Users/tshan/OneDrive/Documents/2011 Throwback/2011 Throwback V0.9/2011 Throwback V0.9/CAREER-2011THROWBACKV09';
  
  const franchise = new FranchiseFile(throwbackPath);
  await franchise.parse();

  const gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();
  
  // Get first 5 non-empty records and show all fields
  let count = 0;
  for (const game of gameTable.records) {
    if (game.isEmpty) continue;
    
    console.log('=== Game', count, '===');
    const keys = Object.keys(game).filter(k => !k.startsWith('_') && typeof game[k] !== 'function');
    for (const key of keys.slice(0, 20)) {
      console.log('  ' + key + ':', game[key]);
    }
    
    count++;
    if (count >= 3) break;
  }
  
  // Also check week 16, 17, 18 specifically
  console.log('\n=== Looking for high week numbers ===');
  const weekCounts = {};
  for (const game of gameTable.records) {
    if (game.isEmpty) continue;
    // Try both field names
    const week = game.SeasonWeek !== undefined ? game.SeasonWeek : game.Field_52;
    if (week !== undefined) {
      weekCounts[week] = (weekCounts[week] || 0) + 1;
    }
  }
  console.log('Weeks found:', Object.keys(weekCounts).sort((a,b) => a-b).join(', '));
}

test().catch(console.error);
