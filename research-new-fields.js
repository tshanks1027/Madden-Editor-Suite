// RESEARCH: Check newly discovered fields for FA players
// IsDemandRelease, PrevTeamIndex, ReleaseRating, TradeStatus
// NO CODING - RESEARCH ONLY

async function checkNewFields() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('CHECKING NEW FIELDS FOR FA VISIBILITY');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  // Target players to compare
  const targets = [
    { name: 'Shaq Mason', expected: 'Visible FA' },
    { name: 'Stephon Gilmore', expected: 'Visible FA' },
    { name: 'Bryce Young', expected: 'Signed to team' },
    { name: 'Trevor Lawrence', expected: 'Signed to team' },
    { name: 'Patrick Mahomes', expected: 'Signed to team' }
  ];

  // Fields to check
  const fieldsToCheck = [
    'TeamIndex',
    'ContractStatus',
    'ContractLength',
    'ContractYear',
    'PrevTeamIndex',
    'IsDemandRelease',
    'ReleaseRating',
    'OriginalReleaseRating',
    'TradeStatus',
    'PLYR_CONSECYEARSWITHTEAM',
    'PLYR_ISCAPTAIN',
    'PLYR_PREVTEAMID',
    'PLYR_CAREERPHASE',
    'PLYR_FLAGPROBOWL',
    'PLYR_ICON'
  ];

  console.log('\n' + '-'.repeat(80));
  console.log('FIELD COMPARISON:');
  console.log('-'.repeat(80));

  for (const target of targets) {
    const [firstName, lastName] = target.name.split(' ');
    const player = playerTable.records.find(r =>
      !r.isEmpty && r.FirstName === firstName && r.LastName === lastName
    );

    if (!player) {
      console.log(`\n${target.name}: NOT FOUND`);
      continue;
    }

    console.log(`\n${target.name} (${target.expected}):`);

    for (const field of fieldsToCheck) {
      try {
        const value = player[field];
        console.log(`  ${field.padEnd(28)}: ${value}`);
      } catch (e) {
        console.log(`  ${field.padEnd(28)}: ERROR - ${e.message}`);
      }
    }
  }

  // Now get 5 random FA players (TeamIndex=32, ContractStatus=FreeAgent) and check their fields
  console.log('\n' + '='.repeat(80));
  console.log('RANDOM SAMPLE OF FA PLAYERS (TeamIndex=32):');
  console.log('='.repeat(80));

  const faPlayers = playerTable.records.filter(r =>
    !r.isEmpty &&
    Number(r.TeamIndex) === 32 &&
    r.ContractStatus === 'FreeAgent'
  );

  console.log(`\nTotal FA players: ${faPlayers.length}`);

  // Sample 10 FA players
  const sample = faPlayers.slice(0, 10);

  for (const player of sample) {
    console.log(`\n${player.FirstName} ${player.LastName}:`);
    for (const field of fieldsToCheck) {
      try {
        const value = player[field];
        console.log(`  ${field.padEnd(28)}: ${value}`);
      } catch (e) {
        // Skip
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

checkNewFields().catch(console.error);
