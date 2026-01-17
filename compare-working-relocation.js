/**
 * Compare working 2011 mod vs fresh template
 * to understand what ACTUALLY changes for a relocation
 */

async function main() {
  const mf = await import('madden-franchise');

  const workingFile = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';
  const templateFile = 'C:/Users/tshan/Documents/Dev/madden-editor-suite/data/templates/CAREERDRAFT-2026Template';

  console.log('=== COMPARING WORKING 2011 vs TEMPLATE ===\n');

  const working = await mf.create(workingFile);
  const template = await mf.create(templateFile);

  // Get Team tables
  const workingTeam = working.getTableByUniqueId(637929298);
  const templateTeam = template.getTableByUniqueId(637929298);
  await workingTeam.readRecords();
  await templateTeam.readRecords();

  // Compare Browns (TeamIndex=4) and Ravens (TeamIndex=24)
  const teamsToCheck = [4, 24, 32]; // Browns, Ravens, Free Agents

  for (const teamIdx of teamsToCheck) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`TEAM INDEX ${teamIdx}`);
    console.log('='.repeat(50));

    let workingRec = null;
    let templateRec = null;

    for (const t of workingTeam.records) {
      if (!t.isEmpty && Number(t.TeamIndex) === teamIdx) {
        workingRec = t;
        break;
      }
    }
    for (const t of templateTeam.records) {
      if (!t.isEmpty && Number(t.TeamIndex) === teamIdx) {
        templateRec = t;
        break;
      }
    }

    if (workingRec && templateRec) {
      console.log(`\nWORKING: ${workingRec.ShortName || workingRec.DisplayName}`);
      console.log(`TEMPLATE: ${templateRec.ShortName || templateRec.DisplayName}`);

      // Compare key fields
      const fields = ['ShortName', 'DisplayName', 'LongName', 'NickName', 'CityName', 'TEAM_VISIBLE', 'TEAM_INTANGIBLE'];
      for (const f of fields) {
        const wVal = workingRec[f];
        const tVal = templateRec[f];
        if (wVal !== tVal) {
          console.log(`  ${f}: WORKING="${wVal}" vs TEMPLATE="${tVal}"`);
        }
      }

      // Check roster references
      const wRosterRef = workingRec.getReferenceDataByKey('Roster');
      const tRosterRef = templateRec.getReferenceDataByKey('Roster');
      console.log(`\n  Roster ref WORKING: tableId=${wRosterRef?.tableId}, row=${wRosterRef?.rowNumber}`);
      console.log(`  Roster ref TEMPLATE: tableId=${tRosterRef?.tableId}, row=${tRosterRef?.rowNumber}`);
    }
  }

  // Now check Player[] roster arrays
  console.log('\n\n' + '='.repeat(50));
  console.log('ROSTER ARRAY COMPARISON');
  console.log('='.repeat(50));

  // Get roster array tables
  let workingRosterTable = null;
  let templateRosterTable = null;

  for (const t of workingTeam.records) {
    if (t.isEmpty) continue;
    const ref = t.getReferenceDataByKey('Roster');
    if (ref && ref.tableId) {
      workingRosterTable = working.getTableById(ref.tableId);
      break;
    }
  }
  for (const t of templateTeam.records) {
    if (t.isEmpty) continue;
    const ref = t.getReferenceDataByKey('Roster');
    if (ref && ref.tableId) {
      templateRosterTable = template.getTableById(ref.tableId);
      break;
    }
  }

  if (workingRosterTable) await workingRosterTable.readRecords();
  if (templateRosterTable) await templateRosterTable.readRecords();

  // Get Player tables
  let workingPlayer = working.getTableByName('Player');
  let templatePlayer = template.getTableByName('Player');
  if (!workingPlayer) {
    const tables = working.getAllTablesByName('Player');
    if (tables?.length) workingPlayer = tables[0];
  }
  if (!templatePlayer) {
    const tables = template.getAllTablesByName('Player');
    if (tables?.length) templatePlayer = tables[0];
  }
  await workingPlayer.readRecords();
  await templatePlayer.readRecords();

  // Compare roster arrays for Browns and Ravens
  for (const teamIdx of [4, 24]) {
    let workingTeamRec = null;
    let templateTeamRec = null;

    for (const t of workingTeam.records) {
      if (!t.isEmpty && Number(t.TeamIndex) === teamIdx) {
        workingTeamRec = t;
        break;
      }
    }
    for (const t of templateTeam.records) {
      if (!t.isEmpty && Number(t.TeamIndex) === teamIdx) {
        templateTeamRec = t;
        break;
      }
    }

    const teamName = workingTeamRec?.ShortName || `Team ${teamIdx}`;
    console.log(`\n--- ${teamName} (TeamIndex=${teamIdx}) ---`);

    if (workingTeamRec && workingRosterTable) {
      const ref = workingTeamRec.getReferenceDataByKey('Roster');
      const roster = workingRosterTable.records[ref.rowNumber];
      console.log(`WORKING roster arraySize: ${roster?.arraySize}`);

      // First 3 players
      for (let i = 0; i < Math.min(3, roster?.arraySize || 0); i++) {
        const pRef = roster.getReferenceDataByKey(`Player${i}`);
        if (pRef?.rowNumber !== undefined) {
          const p = workingPlayer.records[pRef.rowNumber];
          if (p && !p.isEmpty) {
            console.log(`  Player${i}: ${p.FirstName} ${p.LastName} (TeamIndex=${p.TeamIndex})`);
          }
        }
      }
    }

    if (templateTeamRec && templateRosterTable) {
      const ref = templateTeamRec.getReferenceDataByKey('Roster');
      const roster = templateRosterTable.records[ref.rowNumber];
      console.log(`TEMPLATE roster arraySize: ${roster?.arraySize}`);

      // First 3 players
      for (let i = 0; i < Math.min(3, roster?.arraySize || 0); i++) {
        const pRef = roster.getReferenceDataByKey(`Player${i}`);
        if (pRef?.rowNumber !== undefined) {
          const p = templatePlayer.records[pRef.rowNumber];
          if (p && !p.isEmpty) {
            console.log(`  Player${i}: ${p.FirstName} ${p.LastName} (TeamIndex=${p.TeamIndex})`);
          }
        }
      }
    }
  }

  // Check schedule table for Browns/Ravens
  console.log('\n\n' + '='.repeat(50));
  console.log('SCHEDULE COMPARISON');
  console.log('='.repeat(50));

  const workingSchedule = working.getTableByName('SeasonGame');
  const templateSchedule = template.getTableByName('SeasonGame');

  if (workingSchedule) await workingSchedule.readRecords();
  if (templateSchedule) await templateSchedule.readRecords();

  // Count games for Browns and Ravens
  if (workingSchedule) {
    let brownsGames = 0;
    let ravensGames = 0;
    for (const game of workingSchedule.records) {
      if (game.isEmpty) continue;
      const home = Number(game.HomeTeam);
      const away = Number(game.AwayTeam);
      if (home === 4 || away === 4) brownsGames++;
      if (home === 24 || away === 24) ravensGames++;
    }
    console.log(`\nWORKING SeasonGame:`);
    console.log(`  Browns (TeamIndex=4) games: ${brownsGames}`);
    console.log(`  Ravens (TeamIndex=24) games: ${ravensGames}`);
  }

  if (templateSchedule) {
    let brownsGames = 0;
    let ravensGames = 0;
    for (const game of templateSchedule.records) {
      if (game.isEmpty) continue;
      const home = Number(game.HomeTeam);
      const away = Number(game.AwayTeam);
      if (home === 4 || away === 4) brownsGames++;
      if (home === 24 || away === 24) ravensGames++;
    }
    console.log(`\nTEMPLATE SeasonGame:`);
    console.log(`  Browns (TeamIndex=4) games: ${brownsGames}`);
    console.log(`  Ravens (TeamIndex=24) games: ${ravensGames}`);
  }
}

main().catch(console.error);
