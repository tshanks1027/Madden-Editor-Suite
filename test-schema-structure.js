const Franchise = require('madden-franchise');

const testFile = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Madden Files\\CAREER-AUG07-02h00m07p-AUTOSAVE';

const franchise = new Franchise(testFile);

franchise.on('ready', () => {
  console.log('Franchise loaded!');
  console.log('');

  // Check schema structure
  console.log('Schema keys:', Object.keys(franchise.schema));
  console.log('');

  console.log('franchise.schema.schema type:', typeof franchise.schema.schema);
  console.log('Is Array?', Array.isArray(franchise.schema.schema));
  if (franchise.schema.schema && typeof franchise.schema.schema === 'object') {
    const keys = Object.keys(franchise.schema.schema);
    console.log('schema.schema keys (first 10):', keys.slice(0, 10));
    console.log('Total keys:', keys.length);
  }
  console.log('');

  // Check schemas property
  if (franchise.schema.schema.schemas) {
    console.log('schema.schema.schemas type:', typeof franchise.schema.schema.schemas);
    console.log('Is Array?', Array.isArray(franchise.schema.schema.schemas));
    if (Array.isArray(franchise.schema.schema.schemas)) {
      console.log('Length:', franchise.schema.schema.schemas.length);
      console.log('First 5 table names:', franchise.schema.schema.schemas.slice(0, 5).map(t => t.name));
    }
  }
  console.log('');

  // Check schemaMap property
  if (franchise.schema.schema.schemaMap) {
    console.log('schema.schema.schemaMap type:', typeof franchise.schema.schema.schemaMap);
    const mapKeys = Object.keys(franchise.schema.schema.schemaMap);
    console.log('schemaMap keys (first 10):', mapKeys.slice(0, 10));
    console.log('Total schemaMap keys:', mapKeys.length);
  }
  console.log('');

  console.log('franchise.schema.tables type:', typeof franchise.schema.tables);
  console.log('Is Array?', Array.isArray(franchise.schema.tables));
  if (franchise.schema.tables) {
    console.log('Length:', franchise.schema.tables.length);
  }
  console.log('');

  // Try getTableByName
  const playerTable = franchise.getTableByName('Player');
  if (playerTable) {
    console.log('✓ Player table found!');
    console.log('  Name:', playerTable.name);
    console.log('  Records:', playerTable.records?.length);
  }

  process.exit(0);
});

franchise.on('error', (err) => {
  console.error('Error:', err);
  process.exit(1);
});
