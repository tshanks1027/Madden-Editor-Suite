// Diagnostic script to understand preseason schedule application issue
async function diagnose() {
  try {
    const mf = await import('madden-franchise');
    const fs = require('fs');

    // Load a FRESH franchise file (not the corrupted one)
    const filePath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1';
    const franchise = await mf.create(filePath);
    console.log('Franchise loaded:', filePath);

    // Load team table and build mapping (same as RetroEditorService)
    const teamTable = franchise.getTableByUniqueId(637929298);
    await teamTable.readRecords();

    const teamIndexToRecordIndex = new Map();
    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      const teamIndex = team.TeamIndex;
      if (teamIndex !== undefined && teamIndex < 32) {
        teamIndexToRecordIndex.set(teamIndex, team.index);
      }
    }

    console.log('\n=== TEAM INDEX TO RECORD INDEX MAP ===');
    console.log(`Map has ${teamIndexToRecordIndex.size} entries`);

    // Show full map for relevant teams
    const relevantTeams = [2, 17, 21, 25]; // Buffalo, Jets, Patriots, Washington
    for (const ti of relevantTeams) {
      const ri = teamIndexToRecordIndex.get(ti);
      console.log(`  TeamIndex ${ti} -> RecordIndex ${ri}`);
    }

    // Load 1994 schedule
    const schedule = JSON.parse(fs.readFileSync('data/retro/schedules/1994.json', 'utf8'));
    const preseasonGames = schedule.games.filter(g => g.weekType === 'preseason');
    console.log(`\n=== 1994 PRESEASON GAMES (${preseasonGames.length} total) ===`);

    // Simulate first 10 games being applied
    console.log('\nSimulating application of first 10 games:');
    const teamRefPrefix = '001011100011101000000000';

    for (let i = 0; i < Math.min(10, preseasonGames.length); i++) {
      const game = preseasonGames[i];
      const homeRecordIndex = teamIndexToRecordIndex.get(game.homeTeamIndex);
      const awayRecordIndex = teamIndexToRecordIndex.get(game.awayTeamIndex);

      console.log(`\nGame ${i}: ${game.awayTeam} (${game.awayTeamIndex}) @ ${game.homeTeam} (${game.homeTeamIndex})`);
      console.log(`  homeRecordIndex = map.get(${game.homeTeamIndex}) = ${homeRecordIndex}`);
      console.log(`  awayRecordIndex = map.get(${game.awayTeamIndex}) = ${awayRecordIndex}`);

      if (homeRecordIndex !== undefined && awayRecordIndex !== undefined) {
        const homeRef = teamRefPrefix + homeRecordIndex.toString(2).padStart(8, '0');
        const awayRef = teamRefPrefix + awayRecordIndex.toString(2).padStart(8, '0');
        console.log(`  homeRef = ${homeRef} (last 8 = ${homeRecordIndex.toString(2).padStart(8, '0')} = ${homeRecordIndex})`);
        console.log(`  awayRef = ${awayRef} (last 8 = ${awayRecordIndex.toString(2).padStart(8, '0')} = ${awayRecordIndex})`);
      } else {
        console.log('  ERROR: Could not resolve team indices!');
      }
    }

    // Now compare with what's actually in the corrupted file
    console.log('\n\n=== COMPARING WITH CORRUPTED FILE ===');
    const corruptedPath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST';
    const corruptedFranchise = await mf.create(corruptedPath);

    let corruptedGameTable = corruptedFranchise.getTableByUniqueId(2816609684);
    if (!corruptedGameTable) {
      corruptedGameTable = corruptedFranchise.getTableByName('SeasonGame');
    }
    await corruptedGameTable.readRecords();

    // Get first 10 preseason games from corrupted file
    const corruptedPreseason = [];
    for (const rec of corruptedGameTable.records) {
      if (rec.isEmpty) continue;
      const weekType = rec.SeasonWeekType;
      if (weekType === 0 || weekType === 'PreSeason') {
        corruptedPreseason.push(rec);
      }
    }

    console.log(`Found ${corruptedPreseason.length} preseason games in corrupted file`);

    // Build reverse lookup for corrupted file's team table
    const corruptedTeamTable = corruptedFranchise.getTableByUniqueId(637929298);
    await corruptedTeamTable.readRecords();

    const corruptedRecordToTeamIndex = new Map();
    const corruptedRecordToName = new Map();
    for (const team of corruptedTeamTable.records) {
      if (team.isEmpty) continue;
      const teamIndex = team.TeamIndex;
      if (teamIndex !== undefined && teamIndex < 32) {
        corruptedRecordToTeamIndex.set(team.index, teamIndex);
        corruptedRecordToName.set(team.index, team.LongName || team.DisplayName);
      }
    }

    console.log('\nFirst 10 preseason games in corrupted file:');
    for (let i = 0; i < Math.min(10, corruptedPreseason.length); i++) {
      const rec = corruptedPreseason[i];
      const homeRef = rec.HomeTeam;
      const awayRef = rec.AwayTeam;

      // Decode record indices from references
      const homeRecIdx = parseInt(homeRef.slice(24), 2);
      const awayRecIdx = parseInt(awayRef.slice(24), 2);

      const homeTeamIdx = corruptedRecordToTeamIndex.get(homeRecIdx);
      const awayTeamIdx = corruptedRecordToTeamIndex.get(awayRecIdx);
      const homeName = corruptedRecordToName.get(homeRecIdx);
      const awayName = corruptedRecordToName.get(awayRecIdx);

      // Expected from 1994.json
      const expected = preseasonGames[i];

      console.log(`\nSlot ${i}:`);
      console.log(`  Expected: ${expected.awayTeam} (${expected.awayTeamIndex}) @ ${expected.homeTeam} (${expected.homeTeamIndex})`);
      console.log(`  Actual:   ${awayName} (${awayTeamIdx}) @ ${homeName} (${homeTeamIdx})`);

      const homeMatch = homeTeamIdx === expected.homeTeamIndex;
      const awayMatch = awayTeamIdx === expected.awayTeamIndex;

      if (!homeMatch || !awayMatch) {
        console.log(`  *** MISMATCH! Home: ${homeMatch ? 'OK' : 'WRONG'}, Away: ${awayMatch ? 'OK' : 'WRONG'}`);
        console.log(`  HomeRef: ${homeRef.slice(-8)} (${homeRecIdx}) - expected recIdx for team ${expected.homeTeamIndex} = ${teamIndexToRecordIndex.get(expected.homeTeamIndex)}`);
        console.log(`  AwayRef: ${awayRef.slice(-8)} (${awayRecIdx}) - expected recIdx for team ${expected.awayTeamIndex} = ${teamIndexToRecordIndex.get(expected.awayTeamIndex)}`);
      } else {
        console.log(`  OK`);
      }
    }

  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
}

diagnose();
