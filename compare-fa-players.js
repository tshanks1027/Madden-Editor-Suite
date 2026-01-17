// Compare FA players that were originally FA vs moved to FA

async function compareFA(filePath) {
  const FranchiseModule = await import('madden-franchise');
  console.log(`File: ${filePath}`);

  const franchise = await FranchiseModule.create(filePath);
  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  // Find specific players
  const targets = ['Bryce Young', 'Trevor Lawrence', 'Shaq Mason', 'Stephon Gilmore'];

  for (const target of targets) {
    const [first, last] = target.split(' ');

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      if (player.FirstName === first && player.LastName === last) {
        console.log(`\n=== ${target} ===`);
        console.log(`TeamIndex: ${player.TeamIndex}`);
        console.log(`ContractStatus: ${player.ContractStatus}`);
        console.log(`ContractLength: ${player.ContractLength}`);
        console.log(`ContractYear: ${player.ContractYear}`);
        console.log(`YearsPro: ${player.YearsPro}`);
        console.log(`Overall: ${player.OverallRating || player.Overall}`);
        console.log(`Position: ${player.Position}`);

        // Check all fields that might have "status" or "contract" in name
        const fields = Object.keys(player).filter(k =>
          !k.startsWith('_') &&
          (k.toLowerCase().includes('status') ||
           k.toLowerCase().includes('contract') ||
           k.toLowerCase().includes('active') ||
           k.toLowerCase().includes('retired'))
        );
        console.log('Relevant fields:');
        for (const f of fields) {
          console.log(`  ${f}: ${player[f]}`);
        }
        break;
      }
    }
  }
}

async function main() {
  try {
    await compareFA('C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-95Testing');
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
}

main();
