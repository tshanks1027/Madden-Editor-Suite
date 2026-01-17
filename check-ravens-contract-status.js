/**
 * Check ContractStatus of Ravens players that were moved to FA
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

  // Find players with TeamIndex=32 and check their ContractStatus
  console.log('=== PLAYERS WITH TeamIndex=32 - ContractStatus check ===');

  let statusCounts = new Map();
  let samKoch = null;

  for (const p of playerTable.records) {
    if (p.isEmpty) continue;
    if (Number(p.TeamIndex) === 32) {
      const status = p.ContractStatus;
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

      // Find Sam Koch (a Ravens player we moved)
      if (p.LastName === 'Koch') {
        samKoch = p;
      }
    }
  }

  console.log('\nContractStatus distribution for TeamIndex=32:');
  for (const [status, count] of statusCounts.entries()) {
    console.log(`  ${status}: ${count}`);
  }

  if (samKoch) {
    console.log('\n=== Sam Koch (moved Ravens player) ===');
    console.log(`  Name: ${samKoch.FirstName} ${samKoch.LastName}`);
    console.log(`  TeamIndex: ${samKoch.TeamIndex}`);
    console.log(`  ContractStatus: ${samKoch.ContractStatus}`);
    console.log(`  ContractLength: ${samKoch.ContractLength}`);
    console.log(`  ContractYear: ${samKoch.ContractYear}`);
  }

  // Also check what ContractStatus REAL free agents have in original file
  console.log('\n\n=== CHECKING ORIGINAL FILE ===');
  const f2 = await mf.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09');

  let pt2 = f2.getTableByName('Player');
  if (!pt2) {
    const t = f2.getAllTablesByName('Player');
    if (t?.length) pt2 = t[0];
  }
  await pt2.readRecords();

  let origStatusCounts = new Map();
  for (const p of pt2.records) {
    if (p.isEmpty) continue;
    if (Number(p.TeamIndex) === 32) {
      const status = p.ContractStatus;
      origStatusCounts.set(status, (origStatusCounts.get(status) || 0) + 1);
    }
  }

  console.log('\nOriginal file - ContractStatus for TeamIndex=32:');
  for (const [status, count] of origStatusCounts.entries()) {
    console.log(`  ${status}: ${count}`);
  }
}

main().catch(console.error);
