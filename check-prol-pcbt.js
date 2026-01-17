/**
 * Check PROL (dev trait) and PCBT (body type) fields in roster file
 */
const path = require('path');

async function checkFields() {
  const rosterPath = 'C:/Users/tshan/Downloads/PAM/Gamemode/ROSTER-TEMPLATE';

  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();

  try {
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

    // Check if PROL exists
    const prolExists = allFields.includes('PROL');
    console.log('PROL (Dev Trait) field exists:', prolExists);

    // Check if PCBT exists
    const pcbtExists = allFields.includes('PCBT');
    console.log('PCBT (Body Type) field exists:', pcbtExists);
    console.log('');

    // If PROL exists, show distribution
    if (prolExists) {
      const prolDistribution = {};
      playerTable.records.forEach(record => {
        const val = record.fields.PROL.value;
        prolDistribution[val] = (prolDistribution[val] || 0) + 1;
      });
      console.log('PROL distribution:', prolDistribution);

      // Show some example players with different dev traits
      console.log('');
      console.log('Example players by dev trait:');
      const devNames = {0: 'Normal', 1: 'Star', 2: 'Superstar', 3: 'X-Factor'};
      for (const [devVal, devName] of Object.entries(devNames)) {
        const player = playerTable.records.find(r => r.fields.PROL.value === parseInt(devVal));
        if (player) {
          const name = `${player.fields.PFNA.value} ${player.fields.PLNA.value}`;
          console.log(`  ${devName} (${devVal}): ${name}`);
        }
      }
    }

    // If PCBT exists, show distribution
    if (pcbtExists) {
      console.log('');
      const pcbtDistribution = {};
      playerTable.records.forEach(record => {
        const val = record.fields.PCBT.value;
        pcbtDistribution[val] = (pcbtDistribution[val] || 0) + 1;
      });
      console.log('PCBT distribution:', pcbtDistribution);

      // Show sample players for each body type
      console.log('');
      console.log('Example players by body type:');
      const uniqueVals = [...new Set(playerTable.records.map(r => r.fields.PCBT.value))].sort((a,b) => a-b);
      for (const val of uniqueVals.slice(0, 10)) {
        const player = playerTable.records.find(r => r.fields.PCBT.value === val);
        if (player) {
          const name = `${player.fields.PFNA.value} ${player.fields.PLNA.value}`;
          const weight = player.fields.PWGT ? player.fields.PWGT.value + 160 : 'N/A';
          const pos = player.fields.PPOS ? player.fields.PPOS.value : 'N/A';
          console.log(`  PCBT=${val}: ${name} (Weight: ${weight}, Pos: ${pos})`);
        }
      }
    }

    // Look for any body-related fields
    console.log('');
    console.log('All fields containing "body", "build", "type", "morph":');
    const bodyFields = allFields.filter(f =>
      f.toLowerCase().includes('body') ||
      f.toLowerCase().includes('build') ||
      f.toLowerCase().includes('type') ||
      f.toLowerCase().includes('morph') ||
      f.toLowerCase().includes('size')
    );
    console.log(bodyFields.length > 0 ? bodyFields.join(', ') : 'NONE');

    // List all fields for reference
    console.log('');
    console.log('=== ALL FIELDS ===');
    console.log(allFields.join(', '));

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkFields();
