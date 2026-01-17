// RESEARCH: Deep dive into PAE array structure
// These arrays might be per-team lists of available players
// NO CODING - RESEARCH ONLY

async function analyzePAEArrays() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('PAE ARRAY DEEP DIVE');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Get Player table
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  // Get Team table
  const teamTable = franchise.tables.find(t => t.name === 'Team');
  await teamTable.readRecords();

  // Find PAE tables
  const paeTable = franchise.tables.find(t => t.name === 'PlayerAcquisitionEvaluation');
  const paeArrayTable = franchise.tables.find(t => t.name === 'PlayerAcquisitionEvaluation[]');
  const paeArray2Table = franchise.tables.find(t => t.name === 'PlayerAcquisitionEvaluation[][]');

  await paeTable.readRecords();
  await paeArrayTable.readRecords();
  await paeArray2Table.readRecords();

  console.log(`\nPAE table: ${paeTable.records.filter(r => !r.isEmpty).length} non-empty`);
  console.log(`PAE[] table: ${paeArrayTable.records.filter(r => !r.isEmpty).length} non-empty (${paeArrayTable.records.length} total)`);
  console.log(`PAE[][] table: ${paeArray2Table.records.filter(r => !r.isEmpty).length} non-empty`);

  // Check if PAE[] arrays are linked to teams
  console.log('\n' + '-'.repeat(80));
  console.log('CHECKING IF PAE[] ARRAYS ARE TEAM-LINKED:');
  console.log('-'.repeat(80));

  // Check each team for PAE array references
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;

    const teamIdx = Number(team.TeamIndex);
    if (teamIdx > 32) continue;

    const teamName = team.ShortName || team.DisplayName || `Team${teamIdx}`;

    // Look for PAE array reference
    if (typeof team.getReferenceDataByKey === 'function') {
      const fields = Object.keys(team).filter(k => !k.startsWith('_'));

      for (const field of fields) {
        const ref = team.getReferenceDataByKey(field);
        if (ref && ref.tableId) {
          const refTable = franchise.getTableById(ref.tableId);
          if (refTable && refTable.name && refTable.name.includes('PlayerAcquisitionEvaluation')) {
            console.log(`Team ${teamIdx} (${teamName}): ${field} -> ${refTable.name} row ${ref.rowNumber}`);
          }
        }
      }
    }
  }

  // Look at the PAE[][] table structure
  console.log('\n' + '-'.repeat(80));
  console.log('PAE[][] TABLE STRUCTURE:');
  console.log('-'.repeat(80));

  console.log(`Total PAE[][] records: ${paeArray2Table.records.length}`);

  // Sample a few records
  for (let i = 0; i < Math.min(5, paeArray2Table.records.length); i++) {
    const rec = paeArray2Table.records[i];
    if (rec.isEmpty) continue;

    console.log(`\nPAE[][] record ${i}:`);
    console.log(`  arraySize: ${rec.arraySize}`);

    // Show first few elements
    if (rec.arraySize > 0) {
      for (let j = 0; j < Math.min(3, rec.arraySize); j++) {
        const elemRef = rec[`PlayerAcquisitionEvaluation${j}`];
        console.log(`  Element ${j}: ${elemRef}`);
      }
    }
  }

  // Look at PAE[] array structure
  console.log('\n' + '-'.repeat(80));
  console.log('PAE[] TABLE STRUCTURE:');
  console.log('-'.repeat(80));

  console.log(`Total PAE[] records: ${paeArrayTable.records.length}`);

  // Sample a few records with data
  let samplesShown = 0;
  for (const rec of paeArrayTable.records) {
    if (rec.isEmpty) continue;
    if (samplesShown >= 5) break;

    console.log(`\nPAE[] record ${rec.index}:`);
    console.log(`  arraySize: ${rec.arraySize}`);

    // Show first few PAE references
    if (rec.arraySize > 0) {
      for (let j = 0; j < Math.min(3, rec.arraySize); j++) {
        const elemRef = rec[`PlayerAcquisitionEvaluation${j}`];
        console.log(`  PAE${j}: ${elemRef}`);

        // Try to get the player from this PAE
        if (typeof rec.getReferenceDataByKey === 'function') {
          const paeRef = rec.getReferenceDataByKey(`PlayerAcquisitionEvaluation${j}`);
          if (paeRef && paeRef.rowNumber !== undefined) {
            const paeRecord = paeTable.records[paeRef.rowNumber];
            if (paeRecord && typeof paeRecord.getReferenceDataByKey === 'function') {
              const playerRef = paeRecord.getReferenceDataByKey('Player');
              if (playerRef) {
                const player = playerTable.records[playerRef.rowNumber];
                if (player) {
                  console.log(`    -> Player: ${player.FirstName} ${player.LastName}`);
                }
              }
            }
          }
        }
      }
    }

    samplesShown++;
  }

  // Check which teams have PAE array entries
  console.log('\n' + '-'.repeat(80));
  console.log('LOOKING FOR TEAM -> PAE CONNECTIONS:');
  console.log('-'.repeat(80));

  // Check if there's a pattern: PAE[] records count = number of teams?
  console.log(`\nPAE[] has ${paeArrayTable.records.length} records`);
  console.log(`Number of teams: ${teamTable.records.filter(r => !r.isEmpty).length}`);

  // If PAE[] has 32 records, it might be per-team
  if (paeArrayTable.records.length >= 32) {
    console.log('\nChecking if PAE[] records correspond to team indices:');

    // Check record indices 0-31 for team-like patterns
    for (let i = 0; i < 33; i++) {
      const rec = paeArrayTable.records[i];
      if (rec) {
        const team = teamTable.records.find(t => !t.isEmpty && Number(t.TeamIndex) === i);
        const teamName = team ? (team.ShortName || team.DisplayName || `Team${i}`) : 'N/A';

        console.log(`PAE[] record ${i}: arraySize=${rec.arraySize || 0} (${teamName})`);
      }
    }
  }

  // Finally, let's directly look at what references PAE entries
  console.log('\n' + '-'.repeat(80));
  console.log('SEARCHING FOR WHAT REFERENCES PAE TABLES:');
  console.log('-'.repeat(80));

  // Check all tables for references to PAE tables
  const paeTableId = paeTable.header?.tableId;
  const paeArrayTableId = paeArrayTable.header?.tableId;

  console.log(`PAE tableId: ${paeTableId}`);
  console.log(`PAE[] tableId: ${paeArrayTableId}`);

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

analyzePAEArrays().catch(console.error);
