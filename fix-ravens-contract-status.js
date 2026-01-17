/**
 * Fix Ravens players that were moved to FA but still have ContractStatus=Signed
 */
async function main() {
  const mf = await import('madden-franchise');
  const franchise = await mf.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-RELOCTEST3');

  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    const t = franchise.getAllTablesByName('Player');
    if (t?.length) playerTable = t[0];
  }
  await playerTable.readRecords();

  // Find players with TeamIndex=32 AND ContractStatus=Signed (these are the Ravens we moved)
  let fixed = 0;
  for (const p of playerTable.records) {
    if (p.isEmpty) continue;
    if (Number(p.TeamIndex) === 32 && p.ContractStatus === 'Signed') {
      console.log(`Fixing: ${p.FirstName} ${p.LastName} - Setting ContractStatus to FreeAgent`);
      p.ContractStatus = 'FreeAgent';
      p.ContractLength = 0;
      p.ContractYear = 0;
      fixed++;
    }
  }

  console.log(`\nFixed ${fixed} players`);

  await franchise.save();
  console.log('Saved!');

  // Verify
  console.log('\n=== VERIFY ===');
  const f2 = await mf.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-RELOCTEST3');
  let pt2 = f2.getTableByName('Player');
  if (!pt2) {
    const t = f2.getAllTablesByName('Player');
    if (t?.length) pt2 = t[0];
  }
  await pt2.readRecords();

  let statusCounts = new Map();
  for (const p of pt2.records) {
    if (p.isEmpty) continue;
    if (Number(p.TeamIndex) === 32) {
      const status = p.ContractStatus;
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    }
  }

  console.log('\nAfter fix - ContractStatus distribution for TeamIndex=32:');
  for (const [status, count] of statusCounts.entries()) {
    console.log(`  ${status}: ${count}`);
  }
}

main().catch(console.error);
