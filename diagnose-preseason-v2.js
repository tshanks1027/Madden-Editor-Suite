// Diagnostic v2: Check if availableSlots order matches gameTable order
async function diagnose() {
  try {
    const mf = await import('madden-franchise');
    const fs = require('fs');

    // Load CORRUPTED file to see its current state
    const filePath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST';
    const franchise = await mf.create(filePath);
    console.log('Loaded corrupted file:', filePath);

    let gameTable = franchise.getTableByUniqueId(2816609684);
    if (!gameTable) gameTable = franchise.getTableByName('SeasonGame');
    await gameTable.readRecords();

    // Collect preseason slots EXACTLY like the code does
    const allPreseasonSlots = [];
    const offSeasonSlots = [];

    for (const record of gameTable.records) {
      if (record.isEmpty) continue;
      const weekType = record.SeasonWeekType;
      const isPreseason = weekType === 0 || weekType === 'PreSeason';
      const isOffSeason = weekType === 8 || weekType === 'OffSeason';
      if (isPreseason) {
        allPreseasonSlots.push(record);
      } else if (isOffSeason) {
        offSeasonSlots.push(record);
      }
    }

    console.log(`\nPreSeason slots: ${allPreseasonSlots.length}`);
    console.log(`OffSeason slots: ${offSeasonSlots.length}`);

    // Show the actual record indices of preseason slots
    console.log('\nPreseason slot record indices (first 20):');
    for (let i = 0; i < Math.min(20, allPreseasonSlots.length); i++) {
      const slot = allPreseasonSlots[i];
      console.log(`  availableSlots[${i}] -> record.index = ${slot.index}`);
    }

    // Load team table for reverse lookup
    const teamTable = franchise.getTableByUniqueId(637929298);
    await teamTable.readRecords();

    const recordToTeamIndex = new Map();
    const recordToName = new Map();
    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      if (team.TeamIndex !== undefined && team.TeamIndex < 32) {
        recordToTeamIndex.set(team.index, team.TeamIndex);
        recordToName.set(team.index, team.LongName || team.DisplayName);
      }
    }

    // Decode and show what's in each preseason slot
    console.log('\nCurrent preseason games in file (first 20):');
    for (let i = 0; i < Math.min(20, allPreseasonSlots.length); i++) {
      const slot = allPreseasonSlots[i];
      const homeRef = slot.HomeTeam;
      const awayRef = slot.AwayTeam;

      const homeRecIdx = parseInt(homeRef.slice(24), 2);
      const awayRecIdx = parseInt(awayRef.slice(24), 2);

      const homeTeamIdx = recordToTeamIndex.get(homeRecIdx);
      const awayTeamIdx = recordToTeamIndex.get(awayRecIdx);
      const homeName = recordToName.get(homeRecIdx) || '?';
      const awayName = recordToName.get(awayRecIdx) || '?';

      console.log(`  Slot ${i} (rec ${slot.index}): ${awayName}(${awayTeamIdx}) @ ${homeName}(${homeTeamIdx})`);
    }

    // Now simulate what the code SHOULD write
    console.log('\n\n=== SIMULATING CORRECT APPLICATION ===');

    // Build mapping from fresh file
    const freshPath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1';
    const freshFranchise = await mf.create(freshPath);
    const freshTeamTable = freshFranchise.getTableByUniqueId(637929298);
    await freshTeamTable.readRecords();

    const teamIndexToRecordIndex = new Map();
    for (const team of freshTeamTable.records) {
      if (team.isEmpty) continue;
      const teamIndex = team.TeamIndex;
      if (teamIndex !== undefined && teamIndex < 32) {
        teamIndexToRecordIndex.set(teamIndex, team.index);
      }
    }

    // Load 1994 schedule
    const schedule = JSON.parse(fs.readFileSync('data/retro/schedules/1994.json', 'utf8'));
    const preseasonGames = schedule.games.filter(g => g.weekType === 'preseason');

    console.log(`\nHistorical preseason games: ${preseasonGames.length}`);
    console.log('First 20 games that SHOULD be written:');

    for (let i = 0; i < Math.min(20, preseasonGames.length); i++) {
      const game = preseasonGames[i];
      const homeRecordIndex = teamIndexToRecordIndex.get(game.homeTeamIndex);
      const awayRecordIndex = teamIndexToRecordIndex.get(game.awayTeamIndex);

      console.log(`  Game ${i}: ${game.awayTeam}(${game.awayTeamIndex}->rec${awayRecordIndex}) @ ${game.homeTeam}(${game.homeTeamIndex}->rec${homeRecordIndex})`);
    }

    // Check if availableSlots has enough capacity
    const availableSlots = [...allPreseasonSlots, ...offSeasonSlots].slice(0, 48);
    console.log(`\nAvailableSlots length: ${availableSlots.length}`);

    // Check for any issues with the slot order
    console.log('\nDIAGNOSTIC: Checking if slots are contiguous...');
    let prevIdx = null;
    let gaps = [];
    for (let i = 0; i < availableSlots.length; i++) {
      const idx = availableSlots[i].index;
      if (prevIdx !== null && idx !== prevIdx + 1) {
        gaps.push({ pos: i, prev: prevIdx, curr: idx });
      }
      prevIdx = idx;
    }

    if (gaps.length > 0) {
      console.log('  GAPS FOUND in slot indices:');
      for (const g of gaps) {
        console.log(`    At position ${g.pos}: jumped from ${g.prev} to ${g.curr}`);
      }
    } else {
      console.log('  Slots are contiguous (no gaps)');
    }

  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
}

diagnose();
