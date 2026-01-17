const { FranchiseFile } = require('madden-franchise');

async function test() {
  const throwbackPath = 'C:/Users/tshan/OneDrive/Documents/2011 Throwback/2011 Throwback V0.9/2011 Throwback V0.9/CAREER-2011THROWBACKV09';
  
  const franchise = new FranchiseFile(throwbackPath);
  await franchise.parse();

  const gameTable = franchise.getTableByName('SeasonGame');
  console.log('Game table:', gameTable ? 'found' : 'not found');
  console.log('Header record count:', gameTable?.header?.recordCount);
  console.log('Header data1 length:', gameTable?.header?.data1?.length);
  
  await gameTable.readRecords();
  console.log('Records loaded:', gameTable.records.length);
  
  // Check how many are empty vs non-empty
  let empty = 0;
  let nonEmpty = 0;
  for (const r of gameTable.records) {
    if (r.isEmpty) empty++;
    else nonEmpty++;
  }
  console.log('Empty:', empty, 'Non-empty:', nonEmpty);
  
  // Try accessing by index
  if (gameTable.records.length > 0) {
    const first = gameTable.records[0];
    console.log('\nFirst record isEmpty:', first.isEmpty);
    console.log('First record type:', typeof first);
    console.log('First record constructor:', first.constructor.name);
    
    // Get all enumerable properties
    const props = [];
    for (const key in first) {
      if (!key.startsWith('_')) {
        props.push(key);
      }
    }
    console.log('Enumerable props:', props.slice(0, 30));
  }
}

test().catch(console.error);
