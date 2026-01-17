/**
 * Verify PROL is the dev trait field
 */
const path = require('path');

async function verify() {
  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();
  const file = await helper.load('C:/Users/tshan/Downloads/PAM/Gamemode/ROSTER-TEMPLATE');
  const playerTable = file.PLAY;

  // Show PROL distribution
  const prolDist = {};
  playerTable.records.forEach(r => {
    const val = r.fields.PROL?.value;
    prolDist[val] = (prolDist[val] || 0) + 1;
  });
  console.log('PROL Distribution:', prolDist);
  console.log('  0 = Normal:', prolDist[0] || 0);
  console.log('  1 = Star:', prolDist[1] || 0);
  console.log('  2 = Superstar:', prolDist[2] || 0);
  console.log('  3 = X-Factor:', prolDist[3] || 0);
  console.log('');

  // Find known X-Factor players by name
  const xFactorNames = ['Patrick Mahomes', 'Travis Kelce', 'Aaron Donald', 'Tyreek Hill', 'Josh Allen', 'Lamar Jackson', 'Ja\'Marr Chase'];
  console.log('Known X-Factor players and their PROL values:');
  for (const name of xFactorNames) {
    const parts = name.split(' ');
    const first = parts[0];
    const last = parts.slice(1).join(' ');
    const player = playerTable.records.find(r =>
      r.fields.PFNA?.value?.includes(first) && r.fields.PLNA?.value?.includes(last)
    );
    if (player) {
      const prol = player.fields.PROL?.value;
      const devName = {0:'Normal', 1:'Star', 2:'Superstar', 3:'X-Factor'}[prol];
      console.log(`  ${name}: PROL=${prol} (${devName})`);
    } else {
      console.log(`  ${name}: NOT FOUND`);
    }
  }

  // Also check if PDEV exists
  const firstRecord = playerTable.records[0];
  const allFields = Object.keys(firstRecord.fields).sort();
  console.log('');
  console.log('PDEV field exists:', allFields.includes('PDEV'));
  console.log('PROL field exists:', allFields.includes('PROL'));

  // Show all fields starting with P for reference
  console.log('');
  console.log('All P* fields:', allFields.filter(f => f.startsWith('P')).join(', '));
}

verify().catch(e => console.error('Error:', e.message));
