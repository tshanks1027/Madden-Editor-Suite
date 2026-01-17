/**
 * Check the current state of a franchise file
 * Shows Panthers, Jaguars, FA players and Super Bowl number
 */
const Franchise = require('madden-franchise');

async function check(filePath) {
  console.log('Checking:', filePath);
  console.log('');

  const franchise = await Franchise.create(filePath);

  // Check players
  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  const teams = { 16: [], 20: [], 32: [] }; // Jaguars, Panthers, FA

  for (const p of playerTable.records) {
    if (p.isEmpty) continue;
    const ti = Number(p.TeamIndex);
    const name = `${p.FirstName || ''} ${p.LastName || ''}`.trim();
    const pos = p.Position;

    if (ti === 16) teams[16].push({ name, pos });
    if (ti === 20) teams[20].push({ name, pos });
    if (ti === 32) teams[32].push({ name, pos });
  }

  console.log('=== JAGUARS (16) ===');
  console.log('Count:', teams[16].length);
  const jagQBs = teams[16].filter(p => p.pos === 'QB' || p.pos === 0);
  console.log('QBs:', jagQBs.map(p => p.name).join(', ') || 'NONE');
  console.log('');

  console.log('=== PANTHERS (20) ===');
  console.log('Count:', teams[20].length);
  const panQBs = teams[20].filter(p => p.pos === 'QB' || p.pos === 0);
  console.log('QBs:', panQBs.map(p => p.name).join(', ') || 'NONE');
  console.log('');

  console.log('=== FREE AGENTS (32) ===');
  console.log('Count:', teams[32].length);
  const faQBs = teams[32].filter(p => p.pos === 'QB' || p.pos === 0);
  console.log('QBs:', faQBs.slice(0, 10).map(p => p.name).join(', '));
  if (faQBs.length > 10) console.log('  ... and', faQBs.length - 10, 'more QBs');

  // Check for specific players
  const bryceYoung = teams[20].find(p => p.name.includes('Bryce') && p.name.includes('Young'));
  const trevorLawrence = teams[16].find(p => p.name.includes('Trevor') && p.name.includes('Lawrence'));
  const andyDalton = teams[20].find(p => p.name.includes('Andy') && p.name.includes('Dalton'));

  console.log('');
  console.log('=== KEY PLAYER CHECK ===');
  console.log('Bryce Young on Panthers?', bryceYoung ? 'YES - WRONG' : 'NO - CORRECT');
  console.log('Trevor Lawrence on Jaguars?', trevorLawrence ? 'YES - WRONG' : 'NO - CORRECT');
  console.log('Andy Dalton on Panthers?', andyDalton ? 'YES - WRONG' : 'NO - CORRECT');

  // Check Super Bowl
  const seasonInfo = franchise.getTableByName('SeasonInfo');
  await seasonInfo.readRecords();
  const sb = seasonInfo.records[0]?.BaseSuperBowlNumber;

  console.log('');
  console.log('=== SUPER BOWL ===');
  console.log('BaseSuperBowlNumber:', sb);
  console.log('Should be 30 for 1995:', sb === 30 ? 'CORRECT' : 'WRONG (is ' + sb + ')');
}

const file = process.argv[2] || 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-REALTest';
check(file).catch(e => console.error(e));
