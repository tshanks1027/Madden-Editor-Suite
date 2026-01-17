// RESEARCH: Detailed Player table field analysis
// NO CODING - RESEARCH ONLY

async function analyzePlayerTable() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('DETAILED PLAYER TABLE FIELD ANALYSIS');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Get Player table by unique ID (from madden-franchise library)
  const playerTable = franchise.getTableByUniqueId(4195422891);
  if (!playerTable) {
    console.log('Player table not found!');
    return;
  }

  await playerTable.readRecords();
  console.log(`Player table records: ${playerTable.records.length}`);
  console.log(`Non-empty: ${playerTable.records.filter(r => !r.isEmpty).length}`);

  // Get field names from table header
  const fieldNames = [];
  if (playerTable.header && playerTable.header.record2Fields) {
    for (const field of playerTable.header.record2Fields) {
      fieldNames.push({
        name: field.name,
        type: field.type,
        bits: field.bits,
        isReference: field.isReference || false
      });
    }
  }

  console.log(`\nTotal fields in Player table: ${fieldNames.length}`);

  // Group fields by category
  const categories = {
    team: [],
    contract: [],
    salary: [],
    personal: [],
    physical: [],
    ratings: [],
    status: [],
    position: [],
    experience: [],
    appearance: [],
    abilities: [],
    other: []
  };

  for (const field of fieldNames) {
    const nameLower = field.name.toLowerCase();
    if (nameLower.includes('team') || nameLower.includes('tgid')) {
      categories.team.push(field);
    } else if (nameLower.includes('contract')) {
      categories.contract.push(field);
    } else if (nameLower.includes('salary') || nameLower.includes('bonus') || nameLower.includes('cap')) {
      categories.salary.push(field);
    } else if (nameLower.includes('name') || nameLower.includes('birth') || nameLower.includes('age') || nameLower.includes('college')) {
      categories.personal.push(field);
    } else if (nameLower.includes('weight') || nameLower.includes('height') || nameLower.includes('body') || nameLower.includes('arm')) {
      categories.physical.push(field);
    } else if (nameLower.includes('rating') || nameLower.includes('overall') || nameLower.includes('awareness') || nameLower.includes('speed') || nameLower.includes('strength') || nameLower.includes('throw') || nameLower.includes('catch') || nameLower.includes('run')) {
      categories.ratings.push(field);
    } else if (nameLower.includes('status') || nameLower.includes('injury') || nameLower.includes('flag')) {
      categories.status.push(field);
    } else if (nameLower.includes('position') || nameLower.includes('role')) {
      categories.position.push(field);
    } else if (nameLower.includes('year') || nameLower.includes('exp') || nameLower.includes('rookie') || nameLower.includes('draft')) {
      categories.experience.push(field);
    } else if (nameLower.includes('face') || nameLower.includes('head') || nameLower.includes('skin') || nameLower.includes('hair') || nameLower.includes('portrait')) {
      categories.appearance.push(field);
    } else if (nameLower.includes('ability') || nameLower.includes('trait') || nameLower.includes('signature')) {
      categories.abilities.push(field);
    } else {
      categories.other.push(field);
    }
  }

  // Print by category
  for (const [category, fields] of Object.entries(categories)) {
    if (fields.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`${category.toUpperCase()} FIELDS (${fields.length})`);
      console.log('='.repeat(60));
      for (const f of fields) {
        console.log(`  ${f.name} (${f.type}, ${f.bits} bits)${f.isReference ? ' [REF]' : ''}`);
      }
    }
  }

  // Now find specific FA and non-FA players and compare ALL field values
  console.log('\n' + '='.repeat(80));
  console.log('FA VS NON-FA PLAYER COMPARISON (ALL FIELDS)');
  console.log('='.repeat(80));

  // Find specific players
  let visibleFA = null;  // Shaq Mason or Stephon Gilmore
  let invisibleFA = null;  // Bryce Young
  let signedPlayer = null;  // Patrick Mahomes

  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const name = `${player.FirstName} ${player.LastName}`;
    const teamIdx = Number(player.TeamIndex);

    if (name === 'Shaq Mason' || name === 'Stephon Gilmore') {
      if (!visibleFA) visibleFA = { player, name };
    }
    if (name === 'Bryce Young' || name === 'Trevor Lawrence') {
      if (!invisibleFA) invisibleFA = { player, name };
    }
    if (name === 'Patrick Mahomes' && teamIdx < 32) {
      if (!signedPlayer) signedPlayer = { player, name };
    }
  }

  if (!visibleFA || !invisibleFA) {
    // If we can't find the specific players, find generic ones
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      const name = `${player.FirstName} ${player.LastName}`;
      const teamIdx = Number(player.TeamIndex);
      const contractStatus = player.ContractStatus;

      if (!signedPlayer && teamIdx < 32) {
        signedPlayer = { player, name };
      }
      if (!visibleFA && teamIdx === 32 && contractStatus === 'FreeAgent') {
        visibleFA = { player, name };
      }
    }
  }

  // Compare key fields
  const players = [
    { label: 'Signed Player', data: signedPlayer },
    { label: 'Visible FA', data: visibleFA },
    { label: 'Invisible FA', data: invisibleFA }
  ].filter(p => p.data);

  if (players.length > 0) {
    console.log('\nPlayers being compared:');
    for (const p of players) {
      const pl = p.data.player;
      console.log(`  ${p.label}: ${p.data.name} (TeamIndex=${pl.TeamIndex}, ContractStatus=${pl.ContractStatus})`);
    }

    // Find fields that differ
    console.log('\n' + '-'.repeat(80));
    console.log('FIELDS THAT DIFFER BETWEEN PLAYERS:');
    console.log('-'.repeat(80));

    const allFieldNames = fieldNames.map(f => f.name);
    for (const fieldName of allFieldNames) {
      const values = players.map(p => {
        try {
          return String(p.data.player[fieldName] || '').substring(0, 30);
        } catch (e) {
          return 'ERROR';
        }
      });

      // Check if values differ
      const uniqueValues = [...new Set(values)];
      if (uniqueValues.length > 1) {
        console.log(`\n${fieldName}:`);
        for (let i = 0; i < players.length; i++) {
          console.log(`  ${players[i].label.padEnd(15)}: ${values[i]}`);
        }
      }
    }

    // Also specifically look at PLYR_ prefixed fields
    console.log('\n' + '-'.repeat(80));
    console.log('ALL PLYR_ PREFIXED FIELDS:');
    console.log('-'.repeat(80));

    const plyrFields = allFieldNames.filter(f => f.startsWith('PLYR_'));
    for (const fieldName of plyrFields) {
      const values = players.map(p => {
        try {
          return String(p.data.player[fieldName] || '');
        } catch (e) {
          return 'ERROR';
        }
      });
      console.log(`${fieldName.padEnd(35)}: ${values.join(' | ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

analyzePlayerTable().catch(console.error);
