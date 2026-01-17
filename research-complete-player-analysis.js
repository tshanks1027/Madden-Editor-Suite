// COMPREHENSIVE RESEARCH: All Player table fields and FA analysis
// NO CODING - RESEARCH ONLY

const fs = require('fs');
const path = require('path');

async function analyzeAllPlayerFields() {
  // Check both original and edited files
  const files = [
    'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing',
    'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-95Testing'
  ];

  const FranchiseModule = await import('madden-franchise');

  for (const filePath of files) {
    console.log('\n' + '='.repeat(100));
    console.log(`FILE: ${filePath}`);
    console.log('='.repeat(100));

    let franchise;
    try {
      franchise = await FranchiseModule.create(filePath);
    } catch (e) {
      console.log(`Cannot open file: ${e.message}`);
      continue;
    }

    // Find Player table
    const playerTable = franchise.tables.find(t => t.name === 'Player');
    if (!playerTable) {
      console.log('Player table not found!');
      continue;
    }

    await playerTable.readRecords();
    console.log(`\nPlayer records: ${playerTable.records.length} (${playerTable.records.filter(r => !r.isEmpty).length} non-empty)`);

    // Get ALL field names from the table header
    const allFields = [];
    if (playerTable.header && playerTable.header.record2Fields) {
      for (const field of playerTable.header.record2Fields) {
        allFields.push(field.name);
      }
    }
    console.log(`Total fields: ${allFields.length}`);

    // Find specific players
    const targetsNames = [
      'Bryce Young',
      'Trevor Lawrence',
      'Shaq Mason',
      'Stephon Gilmore',
      'Patrick Mahomes'
    ];

    const targets = {};
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      const name = `${player.FirstName} ${player.LastName}`;
      if (targetsNames.includes(name)) {
        targets[name] = player;
      }
    }

    // Print all field names
    console.log('\n' + '-'.repeat(100));
    console.log('ALL PLAYER TABLE FIELDS:');
    console.log('-'.repeat(100));
    console.log(allFields.join(', '));

    // Now print detailed comparison for target players
    console.log('\n' + '-'.repeat(100));
    console.log('TARGET PLAYER ANALYSIS:');
    console.log('-'.repeat(100));

    // Key fields to focus on
    const keyFields = [
      'TeamIndex', 'ContractStatus', 'ContractLength', 'ContractYear',
      'ContractSalary0', 'ContractSalary1', 'ContractSalary2', 'ContractSalary3',
      'ContractBonus0', 'ContractBonus1', 'ContractBonus2', 'ContractBonus3',
      'YearsPro', 'Overall', 'Position',
      // PLYR_ prefixed fields
      'PLYR_CONSECYEARSWITHTEAM', 'PLYR_ISCAPTAIN', 'PLYR_ISUSER', 'PLYR_ISHALLOFFAMER',
      'PLYR_PRORATING', 'PLYR_ASSETNAME', 'PLYR_DRAFTROUND', 'PLYR_DRAFTPICK',
      'PLYR_DRAFTTEAM', 'PLYR_ROOKIE', 'PLYR_PRACTICE_SQUAD'
    ];

    for (const [name, player] of Object.entries(targets)) {
      console.log(`\n${name} (record index ${player.index}):`);
      for (const field of keyFields) {
        try {
          const value = player[field];
          if (value !== undefined) {
            console.log(`  ${field.padEnd(30)}: ${value}`);
          }
        } catch (e) {
          // Field doesn't exist
        }
      }

      // Also find any PLYR_ fields not in our list
      console.log(`\n  Other PLYR_ fields:`);
      for (const field of allFields) {
        if (field.startsWith('PLYR_') && !keyFields.includes(field)) {
          try {
            const value = player[field];
            if (value !== undefined && value !== null && value !== '' && value !== false && value !== 0) {
              console.log(`    ${field.padEnd(30)}: ${value}`);
            }
          } catch (e) {
            // Skip
          }
        }
      }
    }

    // Count players by TeamIndex
    console.log('\n' + '-'.repeat(100));
    console.log('PLAYER COUNTS BY TEAM:');
    console.log('-'.repeat(100));

    const teamCounts = {};
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      const ti = player.TeamIndex;
      teamCounts[ti] = (teamCounts[ti] || 0) + 1;
    }

    const sortedTeams = Object.keys(teamCounts).map(Number).sort((a, b) => a - b);
    for (const ti of sortedTeams) {
      console.log(`  Team ${ti}: ${teamCounts[ti]} players`);
    }

    // Count FA players with different ContractStatus values
    console.log('\n' + '-'.repeat(100));
    console.log('FA TEAM (32) PLAYER CONTRACT STATUS BREAKDOWN:');
    console.log('-'.repeat(100));

    const faStatusCounts = {};
    const faPlayers = playerTable.records.filter(r => !r.isEmpty && Number(r.TeamIndex) === 32);
    for (const player of faPlayers) {
      const status = player.ContractStatus;
      faStatusCounts[status] = (faStatusCounts[status] || 0) + 1;
    }

    for (const [status, count] of Object.entries(faStatusCounts)) {
      console.log(`  ${status}: ${count} players`);
    }

    // Check for any Team array references
    console.log('\n' + '-'.repeat(100));
    console.log('TEAM TABLE ANALYSIS:');
    console.log('-'.repeat(100));

    const teamTable = franchise.tables.find(t => t.name === 'Team');
    if (teamTable) {
      await teamTable.readRecords();

      // Get team fields
      const teamFields = [];
      if (teamTable.header && teamTable.header.record2Fields) {
        for (const field of teamTable.header.record2Fields) {
          teamFields.push(field.name);
        }
      }
      console.log(`Team fields (${teamFields.length}): ${teamFields.slice(0, 30).join(', ')}...`);

      // Find FA team
      for (const team of teamTable.records) {
        if (team.isEmpty) continue;
        const ti = Number(team.TeamIndex);
        if (ti === 32) {
          console.log(`\nFA Team (index 32) record:`);
          for (const field of teamFields.slice(0, 40)) {
            try {
              const value = team[field];
              if (value !== undefined && value !== null && value !== '') {
                console.log(`  ${field}: ${value}`);
              }
            } catch (e) {
              // Skip
            }
          }

          // Check Roster reference
          if (typeof team.getReferenceDataByKey === 'function') {
            const rosterRef = team.getReferenceDataByKey('Roster');
            console.log(`\nRoster Reference: ${JSON.stringify(rosterRef)}`);

            if (rosterRef && rosterRef.tableId) {
              const rosterTable = franchise.getTableById(rosterRef.tableId);
              if (rosterTable) {
                await rosterTable.readRecords();
                const rosterRecord = rosterTable.records[rosterRef.rowNumber];
                if (rosterRecord) {
                  console.log(`Roster array size: ${rosterRecord.arraySize}`);
                  console.log(`First 5 player refs in FA roster:`);
                  for (let i = 0; i < 5; i++) {
                    const ref = rosterRecord[`Player${i}`];
                    if (ref) console.log(`  Player${i}: ${ref}`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(100));
}

analyzeAllPlayerFields().catch(console.error);
