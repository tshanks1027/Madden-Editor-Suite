// RESEARCH: Comprehensive Franchise File Structure Analysis
// Goal: Understand EVERY table, column, and relationship for player/team management

const fs = require('fs');
const path = require('path');

async function researchFranchiseFile(filePath) {
  console.log('='.repeat(80));
  console.log('FRANCHISE FILE STRUCTURE RESEARCH');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}\n`);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Get all tables
  const tables = franchise.tables;
  console.log(`\nTotal tables: ${tables.length}\n`);

  // Find player-related tables
  const playerRelatedTables = [];
  const teamRelatedTables = [];
  const rosterRelatedTables = [];
  const contractRelatedTables = [];

  for (const table of tables) {
    const name = table.name || `Table_${table.index}`;
    const nameLower = name.toLowerCase();

    if (nameLower.includes('player') || nameLower.includes('prol')) {
      playerRelatedTables.push(table);
    }
    if (nameLower.includes('team') || nameLower.includes('roster')) {
      teamRelatedTables.push(table);
    }
    if (nameLower.includes('roster') || nameLower.includes('array')) {
      rosterRelatedTables.push(table);
    }
    if (nameLower.includes('contract') || nameLower.includes('salary')) {
      contractRelatedTables.push(table);
    }
  }

  console.log('='.repeat(80));
  console.log('PLAYER-RELATED TABLES');
  console.log('='.repeat(80));
  for (const table of playerRelatedTables) {
    await analyzeTable(table, 'player');
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEAM-RELATED TABLES');
  console.log('='.repeat(80));
  for (const table of teamRelatedTables) {
    await analyzeTable(table, 'team');
  }

  console.log('\n' + '='.repeat(80));
  console.log('ROSTER-RELATED TABLES');
  console.log('='.repeat(80));
  for (const table of rosterRelatedTables) {
    await analyzeTable(table, 'roster');
  }

  // Now find the main Player table and document ALL fields
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED PLAYER TABLE ANALYSIS');
  console.log('='.repeat(80));

  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    playerTable = franchise.getTableByUniqueId(4195422891);
  }

  if (playerTable) {
    await playerTable.readRecords();
    const firstPlayer = playerTable.records.find(r => !r.isEmpty);

    if (firstPlayer) {
      console.log(`\nPlayer: ${firstPlayer.FirstName} ${firstPlayer.LastName}`);
      console.log('\nALL PLAYER FIELDS:');
      console.log('-'.repeat(60));

      // Get all field names
      const allFields = Object.keys(firstPlayer).filter(k => !k.startsWith('_'));
      allFields.sort();

      for (const field of allFields) {
        const value = firstPlayer[field];
        const type = typeof value;
        console.log(`  ${field}: ${value} (${type})`);
      }

      // Specifically look for team/contract related fields
      console.log('\n\nTEAM/CONTRACT SPECIFIC FIELDS:');
      console.log('-'.repeat(60));
      const relevantFields = allFields.filter(f =>
        f.toLowerCase().includes('team') ||
        f.toLowerCase().includes('contract') ||
        f.toLowerCase().includes('status') ||
        f.toLowerCase().includes('roster') ||
        f.toLowerCase().includes('salary') ||
        f.toLowerCase().includes('cap') ||
        f.toLowerCase().includes('free') ||
        f.toLowerCase().includes('agent')
      );

      for (const field of relevantFields) {
        console.log(`  ${field}: ${firstPlayer[field]}`);
      }
    }
  }

  // Find Team table and document roster references
  console.log('\n' + '='.repeat(80));
  console.log('TEAM TABLE ROSTER REFERENCE ANALYSIS');
  console.log('='.repeat(80));

  let teamTable = franchise.getTableByName('Team');
  if (!teamTable) {
    teamTable = franchise.getTableByUniqueId(637929298);
  }

  if (teamTable) {
    await teamTable.readRecords();

    // Find a real team (not FA)
    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      const teamIdx = Number(team.TeamIndex);
      if (teamIdx >= 32) continue; // Skip FA and special teams

      console.log(`\nTeam ${teamIdx}: ${team.LongName || team.DisplayName}`);
      console.log('Team Fields:');

      const teamFields = Object.keys(team).filter(k => !k.startsWith('_'));
      const relevantTeamFields = teamFields.filter(f =>
        f.toLowerCase().includes('roster') ||
        f.toLowerCase().includes('player') ||
        f.toLowerCase().includes('array')
      );

      for (const field of relevantTeamFields) {
        console.log(`  ${field}: ${team[field]}`);
      }

      // Get roster reference
      const rosterRef = team.getReferenceDataByKey ? team.getReferenceDataByKey('Roster') : null;
      if (rosterRef) {
        console.log(`\n  Roster Reference: tableId=${rosterRef.tableId}, rowNumber=${rosterRef.rowNumber}`);

        // Read the roster table
        const rosterTable = franchise.getTableById(rosterRef.tableId);
        if (rosterTable) {
          await rosterTable.readRecords();
          const rosterRecord = rosterTable.records[rosterRef.rowNumber];
          if (rosterRecord) {
            console.log(`  Roster Array Size: ${rosterRecord.arraySize || 0}`);

            // Show first few player refs
            console.log('  First 5 Player Refs:');
            for (let i = 0; i < 5; i++) {
              const playerRef = rosterRecord[`Player${i}`];
              console.log(`    Player${i}: ${playerRef}`);
            }
          }
        }
      }

      break; // Only analyze first team
    }
  }

  // Find Free Agent "team"
  console.log('\n' + '='.repeat(80));
  console.log('FREE AGENT TEAM ANALYSIS');
  console.log('='.repeat(80));

  if (teamTable) {
    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      const teamIdx = Number(team.TeamIndex);
      const name = team.LongName || team.DisplayName || '';

      if (teamIdx === 32 || name.toLowerCase().includes('free')) {
        console.log(`\nTeam ${teamIdx}: ${name}`);

        const teamFields = Object.keys(team).filter(k => !k.startsWith('_'));
        for (const field of teamFields.slice(0, 30)) {
          console.log(`  ${field}: ${team[field]}`);
        }

        // Get roster reference
        const rosterRef = team.getReferenceDataByKey ? team.getReferenceDataByKey('Roster') : null;
        console.log(`\n  Roster Reference: ${rosterRef ? `tableId=${rosterRef.tableId}, row=${rosterRef.rowNumber}` : 'NONE'}`);
      }
    }
  }

  // Compare a signed player vs FA player
  console.log('\n' + '='.repeat(80));
  console.log('SIGNED VS FREE AGENT PLAYER COMPARISON');
  console.log('='.repeat(80));

  if (playerTable) {
    let signedPlayer = null;
    let faPlayer = null;

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      const ti = Number(player.TeamIndex);

      if (!signedPlayer && ti < 32) {
        signedPlayer = player;
      }
      if (!faPlayer && ti === 32) {
        faPlayer = player;
      }
      if (signedPlayer && faPlayer) break;
    }

    if (signedPlayer && faPlayer) {
      console.log(`\nSigned Player: ${signedPlayer.FirstName} ${signedPlayer.LastName} (Team ${signedPlayer.TeamIndex})`);
      console.log(`FA Player: ${faPlayer.FirstName} ${faPlayer.LastName} (Team ${faPlayer.TeamIndex})`);
      console.log('\nField Comparison:');

      const compareFields = [
        'TeamIndex', 'ContractStatus', 'ContractLength', 'ContractYear',
        'ContractSalary0', 'ContractSalary1', 'ContractBonus0', 'ContractBonus1',
        'YearsPro', 'Overall', 'OverallRating', 'Position'
      ];

      console.log('-'.repeat(70));
      console.log(`${'Field'.padEnd(25)} ${'Signed'.padEnd(20)} FA`);
      console.log('-'.repeat(70));

      for (const field of compareFields) {
        const signedVal = signedPlayer[field] !== undefined ? String(signedPlayer[field]) : 'N/A';
        const faVal = faPlayer[field] !== undefined ? String(faPlayer[field]) : 'N/A';
        console.log(`${field.padEnd(25)} ${signedVal.padEnd(20)} ${faVal}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

async function analyzeTable(table, category) {
  try {
    await table.readRecords();
    const recordCount = table.records ? table.records.length : 0;
    const nonEmpty = table.records ? table.records.filter(r => !r.isEmpty).length : 0;

    console.log(`\n${table.name || `Table_${table.index}`}`);
    console.log(`  UniqueId: ${table.header?.uniqueId || 'N/A'}`);
    console.log(`  Records: ${recordCount} (${nonEmpty} non-empty)`);

    if (nonEmpty > 0 && table.records[0]) {
      const sampleRecord = table.records.find(r => !r.isEmpty) || table.records[0];
      const fields = Object.keys(sampleRecord).filter(k => !k.startsWith('_'));
      console.log(`  Fields (${fields.length}): ${fields.slice(0, 10).join(', ')}${fields.length > 10 ? '...' : ''}`);
    }
  } catch (e) {
    console.log(`\n${table.name || `Table_${table.index}`}: Error reading - ${e.message}`);
  }
}

// Run research
const testFile = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';
researchFranchiseFile(testFile).catch(console.error);
