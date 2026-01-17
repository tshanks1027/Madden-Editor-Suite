/**
 * Analyze PAM (PLPL) values in the official roster template
 */

const path = require('path');

async function analyzePAMValues() {
  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  const playerTable = file.PLAY;

  if (!playerTable) {
    console.log('PLAY table not found!');
    return;
  }

  // Get all players
  const players = playerTable.records.map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  console.log('Total players:', players.length);
  console.log('');

  // Analyze PLPL (PAM) values
  const plplDistribution = {};
  players.forEach(p => {
    const val = String(p.PLPL || '(empty)');
    plplDistribution[val] = (plplDistribution[val] || 0) + 1;
  });

  console.log('=== PLPL (PAM) Value Distribution ===');
  Object.entries(plplDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([val, count]) => {
      console.log(`  "${val}": ${count} players`);
    });

  // Also check PEPS values
  console.log('\n=== PEPS Value Distribution ===');
  const pepsDistribution = {};
  players.forEach(p => {
    const val = String(p.PEPS || '(empty)');
    pepsDistribution[val] = (pepsDistribution[val] || 0) + 1;
  });

  Object.entries(pepsDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([val, count]) => {
      console.log(`  "${val}": ${count} players`);
    });

  // Show some sample players with EMPTY PLPL (generic faces)
  console.log('\n=== Players with Empty PLPL (Generic Faces) ===');
  const emptyPLPL = players.filter(p => !p.PLPL || p.PLPL === '' || p.PLPL === '100');
  console.log('Count:', emptyPLPL.length);

  emptyPLPL.slice(0, 10).forEach(p => {
    console.log(`\n${p.PFNA} ${p.PLNA}:`);
    console.log(`  PSXP (PID): ${p.PSXP}`);
    console.log(`  PLPL (PAM): "${p.PLPL}"`);
    console.log(`  PEPS: "${p.PEPS}"`);
    console.log(`  PSKI: ${p.PSKI}`);
    console.log(`  PGHE (generic head?): ${p.PGHE}`);
  });

  // Check if there's a pattern between PSXP and appearance
  console.log('\n=== PSXP (PID) ranges ===');
  const pids = players.map(p => p.PSXP).sort((a, b) => a - b);
  console.log('Min PID:', pids[0]);
  console.log('Max PID:', pids[pids.length - 1]);

  // Sample of PIDs with empty PLPL
  console.log('\nSample PIDs with empty PLPL:');
  emptyPLPL.slice(0, 10).forEach(p => {
    console.log(`  ${p.PSXP} - ${p.PFNA} ${p.PLNA}`);
  });

  // Check PGHE distribution
  console.log('\n=== PGHE Distribution ===');
  const pgheDistribution = {};
  players.forEach(p => {
    const val = p.PGHE;
    pgheDistribution[val] = (pgheDistribution[val] || 0) + 1;
  });

  Object.entries(pgheDistribution)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([val, count]) => {
      console.log(`  PGHE ${val}: ${count} players`);
    });
}

analyzePAMValues().catch(console.error);
