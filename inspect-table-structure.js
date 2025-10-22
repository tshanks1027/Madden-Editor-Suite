const Franchise = require('madden-franchise');

const testFile = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Madden Files\\CAREER-AUG07-02h00m07p-AUTOSAVE';

const franchise = new Franchise(testFile);

franchise.on('ready', () => {
  console.log('Franchise loaded!');
  console.log('');

  const playerTable = franchise.getTableByName('Player');

  console.log('Player table keys:', Object.keys(playerTable));
  console.log('');

  console.log('Player table structure:');
  console.log('  name:', playerTable.name);
  console.log('  header keys:', Object.keys(playerTable.header));
  console.log('  header.recordCapacity:', playerTable.header.recordCapacity);
  console.log('  header.record2OffsetEnd:', playerTable.header.record2OffsetEnd);
  console.log('');

  if (playerTable.offsetTable) {
    console.log('  offsetTable exists');
  }

  if (playerTable.schema) {
    console.log('  schema keys:', Object.keys(playerTable.schema));
    console.log('  schema.attributes?:', !!playerTable.schema.attributes);
    if (playerTable.schema.attributes) {
      console.log('  First 5 attributes:', playerTable.schema.attributes.slice(0, 5).map(a => a.name));
    }
  }

  if (playerTable.records) {
    console.log('  records.length:', playerTable.records.length);
    if (playerTable.records.length > 0) {
      const firstPlayer = playerTable.records[0];
      console.log('  First player keys (first 20):', Object.keys(firstPlayer).slice(0, 20));
    }
  }

  process.exit(0);
});

franchise.on('error', (err) => {
  console.error('Error:', err);
  process.exit(1);
});
