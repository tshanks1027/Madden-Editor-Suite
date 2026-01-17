// Test each retro editor operation in isolation to find the crash cause
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';
const testDir = path.dirname(originalPath);

async function testOperation(operationName, operation) {
  const testPath = path.join(testDir, `TEST-${operationName}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${operationName}`);
  console.log(`${'='.repeat(60)}`);

  // Copy fresh file
  fs.copyFileSync(originalPath, testPath);
  console.log(`Created test file: ${testPath}`);

  const FranchiseModule = await import('madden-franchise');

  try {
    // Load the file
    const franchise = await FranchiseModule.create(testPath);
    console.log('File loaded successfully');

    // Run the operation
    await operation(franchise, testPath);
    console.log('Operation completed');

    // Save the file
    await franchise.save(testPath);
    console.log('File saved successfully');

    // Reload to verify it's still valid
    const franchise2 = await FranchiseModule.create(testPath);
    console.log('File reloaded successfully - FILE IS VALID');

    // Clean up if successful
    // fs.unlinkSync(testPath);
    console.log(`[KEEP] Test file kept for manual testing: ${testPath}`);

    return { success: true, testPath };
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    console.error(error.stack);
    return { success: false, error: error.message, testPath };
  }
}

async function main() {
  const year = 1995;
  const results = [];

  // Test 1: Season Year ONLY
  results.push(await testOperation('YEAR-ONLY', async (franchise) => {
    const table = franchise.getTableByUniqueId(3123991521);
    await table.readRecords();
    const rec = table.records[0];
    console.log(`  Before: CurrentSeasonYear=${rec.CurrentSeasonYear}`);
    rec.CurrentSeasonYear = year;
    rec.BaseCalendarYear = year;
    rec.BaseSuperBowlNumber = 30;
    console.log(`  After: CurrentSeasonYear=${rec.CurrentSeasonYear}`);
  }));

  // Test 2: Salary Cap ONLY
  results.push(await testOperation('SALCAP-ONLY', async (franchise) => {
    // Find SalaryInfo table
    let salaryTable = franchise.getTableByUniqueId(3759217828);
    if (!salaryTable) salaryTable = franchise.getTableByName('SalaryInfo');

    if (salaryTable) {
      await salaryTable.readRecords();
      const rec = salaryTable.records.find(r => !r.isEmpty);
      if (rec) {
        const newCap = 3710; // $37.1M in ten-thousands
        console.log(`  Before: TeamSalaryCap=${rec.TeamSalaryCap}`);
        rec.TeamSalaryCap = newCap;
        rec.InitialSalaryCap = newCap;
        console.log(`  After: TeamSalaryCap=${rec.TeamSalaryCap}`);
      }
    }
  }));

  // Test 3: Team Names ONLY
  results.push(await testOperation('TEAMS-ONLY', async (franchise) => {
    // Just test changing one team name
    const teamTable = franchise.getTableByUniqueId(3938984019);
    if (teamTable) {
      await teamTable.readRecords();
      const texans = teamTable.records.find(r => r.NickName === 'Texans' || r.DisplayName === 'Houston Texans');
      if (texans) {
        console.log(`  Before: ${texans.DisplayName} (${texans.NickName})`);
        texans.DisplayName = 'Houston Oilers';
        texans.LongName = 'Houston Oilers';
        texans.NickName = 'Oilers';
        console.log(`  After: ${texans.DisplayName} (${texans.NickName})`);
      }
    }
  }));

  // Test 4: Schedule ONLY (this is likely the culprit)
  results.push(await testOperation('SCHEDULE-ONLY', async (franchise) => {
    // Find SeasonGame table
    const gameTable = franchise.getTableByName('SeasonGame') || franchise.getTableByUniqueId(2816609684);
    if (gameTable) {
      await gameTable.readRecords();
      let gameCount = 0;
      for (const game of gameTable.records) {
        if (game.isEmpty) continue;
        gameCount++;
      }
      console.log(`  Total games in table: ${gameCount}`);

      // Test modifying just one game's week
      const firstGame = gameTable.records.find(r => !r.isEmpty);
      if (firstGame) {
        console.log(`  Sample game SeasonWeek: ${firstGame.SeasonWeek || firstGame.Field_52}`);
        // Don't actually modify - just read
      }
    }
  }));

  // Test 5: Draft Picks ONLY
  results.push(await testOperation('DRAFT-ONLY', async (franchise) => {
    const draftTable = franchise.getTableByUniqueId(2546719563);
    if (draftTable) {
      await draftTable.readRecords();
      let pickCount = 0;
      for (const pick of draftTable.records) {
        if (pick.isEmpty) continue;
        pickCount++;
      }
      console.log(`  Total draft picks: ${pickCount}`);

      // Sample a pick
      const firstPick = draftTable.records.find(r => !r.isEmpty);
      if (firstPick) {
        console.log(`  First pick: Round=${firstPick.Round}, PickNumber=${firstPick.PickNumber}, Team=${firstPick.Team}`);
      }
    }
  }));

  // Print summary
  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const result of results) {
    const name = path.basename(result.testPath);
    console.log(`${result.success ? 'PASS' : 'FAIL'}: ${name}`);
  }

  console.log('\n>>> Load each TEST-* file in Madden and try to sim to find which one crashes');
}

main().catch(console.error);
