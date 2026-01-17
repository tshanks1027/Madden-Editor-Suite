/**
 * Find body type field in roster file
 */

const path = require('path');

async function findBodyTypeField() {
  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  const playerTable = file.PLAY;

  if (!playerTable) {
    console.log('PLAY table not found!');
    return;
  }

  // Get all field names from first record
  const firstRecord = playerTable.records[0];
  const allFields = Object.keys(firstRecord.fields).sort();

  console.log('Total fields in player record:', allFields.length);
  console.log('');

  // Look for body-related fields
  const bodyFields = allFields.filter(f =>
    f.toLowerCase().includes('body') ||
    f.toLowerCase().includes('bdy') ||
    f.toLowerCase().includes('build') ||
    f.toLowerCase().includes('type') ||
    f.toLowerCase().includes('size') ||
    f.toLowerCase().includes('morph')
  );

  console.log('Potential body type fields:', bodyFields.join(', ') || 'NONE FOUND');
  console.log('');

  // Check fields starting with 'P' that we might not know
  const unknownPFields = allFields.filter(f =>
    f.startsWith('P') &&
    !['PACC', 'PAGE', 'PAGI', 'PAWR', 'PBCV', 'PBKT', 'PBSG', 'PBSK', 'PCAR', 'PCMT', 'PCOL', 'PCON', 'PCSA', 'PCTH', 'PCYL', 'PDPI', 'PDRO', 'PDRR', 'PEGO', 'PELU', 'PEPS', 'PFMS', 'PFNA', 'PGHE', 'PGID', 'PHGT', 'PHSN', 'PHTN', 'PIMP', 'PINJ', 'PJEN', 'PJMP', 'PKAC', 'PKPR', 'PKRT', 'PLBD', 'PLBK', 'PLCI', 'PLHT', 'PLHY', 'PLIB', 'PLJM', 'PLMC', 'PLMO', 'PLNA', 'PLPE', 'PLPL', 'PLPM', 'PLPO', 'PLPR', 'PLPU', 'PLRL', 'PLSA', 'PLSC', 'PLSM', 'PLTR', 'PLZC', 'PMRR', 'POID', 'POVR', 'PPBF', 'PPBK', 'PPBS', 'PPLA', 'PQBS', 'PRBF', 'PRBK', 'PRBS', 'PROL', 'PRSE', 'PSA0', 'PSA1', 'PSA2', 'PSA3', 'PSA4', 'PSA5', 'PSA6', 'PSB0', 'PSB1', 'PSB2', 'PSB3', 'PSB4', 'PSB5', 'PSB6', 'PSBO', 'PSKI', 'PSPD', 'PSTA', 'PSTM', 'PSTN', 'PSTR', 'PSXP', 'PTAD', 'PTAK', 'PTAM', 'PTAS', 'PTEN', 'PTGH', 'PTHA', 'PTHP', 'PTOR', 'PTSA', 'PTUP', 'PVCO', 'PVSB', 'PVTS', 'PWGT', 'PYCF', 'PYRP', 'PPOS', 'PLTY', 'PYWT', 'PLDT', 'PCPH', 'PHAN'].includes(f)
  );

  console.log('Unknown P fields:', unknownPFields.join(', ') || 'NONE');
  console.log('');

  // Print ALL fields for analysis
  console.log('=== ALL FIELDS ===');
  console.log(allFields.join(', '));
  console.log('');

  // Get a few players and look at all field values to find patterns
  const players = playerTable.records.slice(0, 10).map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  // Look for fields with values 0-3 (typical body type range)
  console.log('=== Fields with small integer values (0-3) that could be body type ===');
  const candidates = [];

  for (const field of allFields) {
    const values = players.map(p => p[field]);
    const allSmallInts = values.every(v => typeof v === 'number' && v >= 0 && v <= 10);
    const uniqueValues = [...new Set(values)];

    if (allSmallInts && uniqueValues.length <= 5) {
      candidates.push({ field, values: uniqueValues.sort((a,b) => a-b) });
    }
  }

  candidates.forEach(c => {
    console.log(`${c.field}: unique values = [${c.values.join(', ')}]`);
  });

  // Check PCBT specifically (sounds like "Player Character Body Type")
  console.log('');
  console.log('=== Checking PCBT field ===');
  const pcbtExists = allFields.includes('PCBT');
  console.log('PCBT exists:', pcbtExists);

  if (pcbtExists) {
    // Get distribution of PCBT values
    const allPlayers = playerTable.records.map(record => {
      const player = {};
      for (const fieldName in record.fields) {
        player[fieldName] = record.fields[fieldName].value;
      }
      return player;
    });

    const pcbtDistribution = {};
    allPlayers.forEach(p => {
      const val = p.PCBT;
      pcbtDistribution[val] = (pcbtDistribution[val] || 0) + 1;
    });

    console.log('PCBT distribution:', pcbtDistribution);

    // Show some examples by position
    console.log('');
    console.log('PCBT by position (sample):');
    const positions = { 0: 'QB', 5: 'LT', 7: 'C', 9: 'RT', 12: 'DT', 19: 'K' };
    for (const [posId, posName] of Object.entries(positions)) {
      const posPlayers = allPlayers.filter(p => p.PPOS === parseInt(posId)).slice(0, 3);
      posPlayers.forEach(p => {
        console.log(`  ${posName}: ${p.PFNA} ${p.PLNA} - PCBT=${p.PCBT}, Weight=${p.PWGT + 160}`);
      });
    }
  }
}

findBodyTypeField().catch(console.error);
