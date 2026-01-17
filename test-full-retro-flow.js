// Test the FULL retro editor flow to identify crash causes
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-REAL';
const testDir = path.dirname(originalPath);
const year = 1995;

// Table IDs
const TABLE_IDS = {
  seasonInfoTable: 3123991521,
  teamTable: 637929298,
  gameTable: 2816609684,
  salaryInfoTable: 3759217828,
};

async function runTest(testName, originalFile, testOps) {
  const testPath = path.join(testDir, `RETRO-TEST-${testName}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${'='.repeat(60)}`);

  // Copy fresh file
  fs.copyFileSync(originalFile, testPath);
  console.log('Created test file:', testPath);

  const FranchiseModule = await import('madden-franchise');

  try {
    const franchise = await FranchiseModule.create(testPath);
    console.log('File loaded');

    // Run all operations
    for (const op of testOps) {
      console.log(`\n--- ${op.name} ---`);
      await op.fn(franchise);
    }

    // Save
    console.log('\nSaving...');
    await franchise.save(testPath);
    console.log('Saved');

    // Reload to verify
    const franchise2 = await FranchiseModule.create(testPath);
    console.log('Reloaded successfully');

    console.log(`\n✅ TEST PASSED: ${testName}`);
    console.log(`Test file: ${testPath}`);
    console.log('>>> Load this file in Madden and try to sim to test for crashes');
    return { success: true, testPath };

  } catch (error) {
    console.error(`\n❌ TEST FAILED: ${error.message}`);
    return { success: false, error: error.message, testPath };
  }
}

async function main() {
  // Operation definitions
  const setSeasonYear = {
    name: 'Set Season Year',
    fn: async (franchise) => {
      const table = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
      await table.readRecords();
      const rec = table.records[0];
      console.log(`  CurrentSeasonYear: ${rec.CurrentSeasonYear} -> ${year}`);
      rec.CurrentSeasonYear = year;
      rec.BaseCalendarYear = year;
      rec.BaseSuperBowlNumber = year - 1965;
      console.log(`  After: ${rec.CurrentSeasonYear}, ${rec.BaseCalendarYear}, ${rec.BaseSuperBowlNumber}`);
    }
  };

  const setSalaryCap = {
    name: 'Set Salary Cap',
    fn: async (franchise) => {
      // 1995 salary cap was $37.1 million
      const cap1995 = 3710; // in ten-thousands
      let table = franchise.getTableByUniqueId(TABLE_IDS.salaryInfoTable);
      if (!table) table = franchise.getTableByName('SalaryInfo');
      if (table) {
        await table.readRecords();
        const rec = table.records.find(r => !r.isEmpty);
        if (rec) {
          console.log(`  TeamSalaryCap: ${rec.TeamSalaryCap} -> ${cap1995}`);
          rec.TeamSalaryCap = cap1995;
          rec.InitialSalaryCap = cap1995;
        }
      }
    }
  };

  const updateTeamNames = {
    name: 'Update Team Names',
    fn: async (franchise) => {
      const table = franchise.getTableByUniqueId(TABLE_IDS.teamTable) ||
                    franchise.getTableByName('Team');
      await table.readRecords();

      // For 1995, Texans -> Oilers, Ravens -> Browns (sort of)
      let changesCount = 0;
      for (const team of table.records) {
        if (team.isEmpty) continue;
        if (team.NickName === 'Texans') {
          console.log(`  Texans -> Oilers`);
          team.DisplayName = 'Houston Oilers';
          team.LongName = 'Houston Oilers';
          team.NickName = 'Oilers';
          changesCount++;
        }
      }
      console.log(`  Changed ${changesCount} teams`);
    }
  };

  const modifySchedule = {
    name: 'Modify Schedule (sample)',
    fn: async (franchise) => {
      // Just test modifying a few game records
      const table = franchise.getTableByName('SeasonGame') ||
                    franchise.getTableByUniqueId(TABLE_IDS.gameTable);
      await table.readRecords();

      let count = 0;
      for (const rec of table.records) {
        if (rec.isEmpty) continue;
        // Just read values, don't modify
        const weekType = rec.SeasonWeekType || rec.Field_53;
        const week = rec.SeasonWeek || rec.Field_52;
        if (count === 0) {
          console.log(`  Sample game: Week ${week}, Type ${weekType}`);
        }
        count++;
      }
      console.log(`  Total games: ${count}`);
      // Note: NOT modifying schedule to test if schedule changes cause crash
    }
  };

  const moveExpansionToFA = {
    name: 'Move Expansion Teams to FA',
    fn: async (franchise) => {
      // Panthers (20) and Jaguars (16) are expansion teams in 1995
      const expansionTeams = [20, 16];
      const FA_TEAM = 32;

      let playerTable = franchise.getTableByName('Player') ||
                        franchise.getTableByUniqueId(4222);
      await playerTable.readRecords();

      let moved = 0;
      for (const player of playerTable.records) {
        if (player.isEmpty) continue;
        const teamIndex = Number(player.TeamIndex);
        if (expansionTeams.includes(teamIndex)) {
          player.TeamIndex = FA_TEAM;
          moved++;
        }
      }
      console.log(`  Moved ${moved} players from expansion teams to FA`);
    }
  };

  // Run tests with increasing complexity
  const results = [];

  // Test 1: Just year change
  results.push(await runTest('1-YEAR', originalPath, [setSeasonYear]));

  // Test 2: Year + Salary Cap
  results.push(await runTest('2-YEAR-SALARY', originalPath, [setSeasonYear, setSalaryCap]));

  // Test 3: Year + Salary + Teams
  results.push(await runTest('3-YEAR-SALARY-TEAMS', originalPath, [setSeasonYear, setSalaryCap, updateTeamNames]));

  // Test 4: All except expansion
  results.push(await runTest('4-ALL-EXCEPT-EXPANSION', originalPath, [setSeasonYear, setSalaryCap, updateTeamNames, modifySchedule]));

  // Test 5: All including expansion
  results.push(await runTest('5-ALL-WITH-EXPANSION', originalPath, [setSeasonYear, setSalaryCap, updateTeamNames, modifySchedule, moveExpansionToFA]));

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    const name = path.basename(r.testPath);
    console.log(`${r.success ? 'PASS' : 'FAIL'}: ${name}`);
  }
  console.log('\n>>> Load each RETRO-TEST-* file in Madden and sim to find which causes crash');
}

main().catch(console.error);
