// Test FULL retro editor flow for 1995 to understand crash cause
// This simulates what the retro editor does step by step
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-REAL';

const TABLE_IDS = {
  seasonInfoTable: 3123991521,
  teamTable: 637929298,
  teamTable2: 3938984019,
  gameTable: 2816609684,
  salaryInfoTable: 3759217828,
  playerTable: 4222,
  coachTable: 0, // Will find by name
};

async function createTestFile(name, operations) {
  const testPath = path.dirname(originalPath) + '/' + name;
  fs.copyFileSync(originalPath, testPath);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Creating: ${name}`);
  console.log(`${'='.repeat(60)}`);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);

  for (const op of operations) {
    console.log(`\n--- ${op.name} ---`);
    try {
      await op.fn(franchise);
    } catch (e) {
      console.error(`ERROR in ${op.name}: ${e.message}`);
      console.error(e.stack);
    }
  }

  console.log('\nSaving...');
  await franchise.save(testPath);
  console.log('Saved:', testPath);

  return testPath;
}

// Operation definitions
const ops = {
  setYear: {
    name: 'Set Season Year to 1995',
    fn: async (franchise) => {
      const table = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
      await table.readRecords();
      const rec = table.records[0];

      console.log('  CurrentSeasonYear:', rec.CurrentSeasonYear, '-> 1995');
      rec.CurrentSeasonYear = 1995;

      console.log('  BaseCalendarYear:', rec.BaseCalendarYear, '-> 1995');
      rec.BaseCalendarYear = 1995;

      console.log('  BaseSuperBowlNumber:', rec.BaseSuperBowlNumber, '-> 30 (1995-1965)');
      rec.BaseSuperBowlNumber = 30;

      console.log('  After: CurrentSeasonYear =', rec.CurrentSeasonYear);
    }
  },

  setSalaryCap: {
    name: 'Set 1995 Salary Cap ($37.1M)',
    fn: async (franchise) => {
      // 1995 cap was $37.1M = 3710 in Madden's format (ten-thousands)
      const cap = 3710;
      let table = franchise.getTableByUniqueId(TABLE_IDS.salaryInfoTable);
      if (!table) table = franchise.getTableByName('SalaryInfo');
      if (!table) {
        console.log('  SalaryInfo table not found');
        return;
      }

      await table.readRecords();
      const rec = table.records.find(r => !r.isEmpty);
      if (!rec) {
        console.log('  No salary info record found');
        return;
      }

      console.log('  TeamSalaryCap:', rec.TeamSalaryCap, '->', cap);
      rec.TeamSalaryCap = cap;

      if (rec.InitialSalaryCap !== undefined) {
        console.log('  InitialSalaryCap:', rec.InitialSalaryCap, '->', cap);
        rec.InitialSalaryCap = cap;
      }
    }
  },

  updateTeamNames: {
    name: 'Update Team Names for 1995',
    fn: async (franchise) => {
      let table = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
      if (!table) table = franchise.getTableByUniqueId(TABLE_IDS.teamTable2);
      if (!table) table = franchise.getTableByName('Team');
      await table.readRecords();

      const changes = [];
      for (const team of table.records) {
        if (team.isEmpty) continue;
        const teamIndex = team.TeamIndex;
        if (teamIndex === undefined) continue;

        // 1995: Texans were Houston Oilers (teamIndex 29 is Titans, formerly Oilers)
        // Note: TeamIndex 29 = Tennessee Titans (were Houston Oilers until 1996, then Tennessee in 1997)
        // TeamIndex 31 = Houston Texans (expansion 2002)
        if (teamIndex === 31) {
          console.log(`  Texans (31) -> inactive for 1995 (didn't exist)`);
          // Don't change name, just note it
        }

        if (teamIndex === 29) {
          console.log(`  Titans (29) -> Houston Oilers for 1995`);
          try {
            team.DisplayName = 'Houston Oilers';
            team.LongName = 'Houston Oilers';
            team.NickName = 'Oilers';
            changes.push({ teamIndex: 29, change: 'Titans -> Oilers' });
          } catch (e) {
            console.log(`    Error: ${e.message}`);
          }
        }
      }
      console.log(`  Made ${changes.length} team name changes`);
    }
  },

  moveExpansionToFA: {
    name: 'Move Expansion Team Players to FA',
    fn: async (franchise) => {
      // For 1995, Panthers (20) and Jaguars (16) were NEW expansion teams
      // They should have their historical rosters, not be emptied
      // But for 1994, they didn't exist - players should go to FA
      // Since we're testing 1995, skip this
      console.log('  Skipped for 1995 (Panthers/Jaguars were new expansion teams in 1995)');
    }
  },

  testScheduleChanges: {
    name: 'Test Schedule Modifications',
    fn: async (franchise) => {
      let gameTable = franchise.getTableByName('SeasonGame');
      if (!gameTable) gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
      await gameTable.readRecords();

      // Find team reference prefix
      let teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
      if (!teamTable) teamTable = franchise.getTableByName('Team');
      await teamTable.readRecords();

      const teamIndexToRecordIndex = new Map();
      for (const team of teamTable.records) {
        if (team.isEmpty) continue;
        const ti = team.TeamIndex;
        if (ti !== undefined && ti < 32) {
          teamIndexToRecordIndex.set(ti, team.index);
        }
      }

      let teamRefPrefix = '001011100011101000000000';
      for (const rec of gameTable.records) {
        if (rec.isEmpty) continue;
        const ht = rec.HomeTeam;
        if (ht && ht !== '00000000000000000000000000000000' && ht.length === 32) {
          teamRefPrefix = ht.slice(0, 24);
          break;
        }
      }

      console.log('  Team ref prefix:', teamRefPrefix);

      // Just modify ONE game as a minimal test
      let modified = 0;
      for (const rec of gameTable.records) {
        if (rec.isEmpty) continue;
        const weekType = rec.SeasonWeekType || rec.Field_53;
        if (weekType === 1 || weekType === 'RegularSeason') {
          const weekNum = rec.SeasonWeek !== undefined ? rec.SeasonWeek : rec.Field_52;
          if (weekNum === 0 && modified === 0) {
            const oldHome = rec.HomeTeam;
            const oldAway = rec.AwayTeam;

            // Swap home and away
            rec.HomeTeam = oldAway;
            rec.AwayTeam = oldHome;

            console.log(`  Swapped game: Week ${weekNum}`);
            console.log(`    Before: Home=${oldHome.slice(-8)}, Away=${oldAway.slice(-8)}`);
            console.log(`    After: Home=${rec.HomeTeam.slice(-8)}, Away=${rec.AwayTeam.slice(-8)}`);
            modified++;
            break;
          }
        }
      }
      console.log(`  Modified ${modified} game(s)`);
    }
  },

  markExtraWeeksOffseason: {
    name: 'Mark Week 17+ as OffSeason',
    fn: async (franchise) => {
      let gameTable = franchise.getTableByName('SeasonGame');
      if (!gameTable) gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
      await gameTable.readRecords();

      let marked = 0;
      for (const rec of gameTable.records) {
        if (rec.isEmpty) continue;
        const weekType = rec.SeasonWeekType || rec.Field_53;
        if (weekType !== 1 && weekType !== 'RegularSeason') continue;

        const weekNum = rec.SeasonWeek !== undefined ? rec.SeasonWeek : rec.Field_52;
        // 1995 had 17 weeks (weeks 0-16 in Madden's 0-indexed system)
        // Mark week 17+ as OffSeason
        if (weekNum >= 17) {
          try {
            rec.SeasonWeekType = 'OffSeason';
            rec.HomeTeam = '00000000000000000000000000000000';
            rec.AwayTeam = '00000000000000000000000000000000';
            rec.GameStatus = 'Unplayed';
            marked++;
          } catch (e) {
            console.log(`    Error marking week ${weekNum}: ${e.message}`);
          }
        }
      }
      console.log(`  Marked ${marked} games as OffSeason`);
    }
  }
};

async function main() {
  console.log('Creating isolated test files for 1995 retro mode...\n');

  // Test 1: Year only
  await createTestFile('TEST-1995-01-YEAR', [ops.setYear]);

  // Test 2: Year + Salary Cap
  await createTestFile('TEST-1995-02-SALARY', [ops.setYear, ops.setSalaryCap]);

  // Test 3: Year + Salary + Teams
  await createTestFile('TEST-1995-03-TEAMS', [ops.setYear, ops.setSalaryCap, ops.updateTeamNames]);

  // Test 4: Year + Salary + Teams + One Schedule Change
  await createTestFile('TEST-1995-04-SCHEDULE-MIN', [
    ops.setYear, ops.setSalaryCap, ops.updateTeamNames, ops.testScheduleChanges
  ]);

  // Test 5: Year + Salary + Teams + Mark Extra Weeks
  await createTestFile('TEST-1995-05-OFFSEASON', [
    ops.setYear, ops.setSalaryCap, ops.updateTeamNames, ops.markExtraWeeksOffseason
  ]);

  // Test 6: All combined
  await createTestFile('TEST-1995-06-ALL', [
    ops.setYear, ops.setSalaryCap, ops.updateTeamNames, ops.testScheduleChanges, ops.markExtraWeeksOffseason
  ]);

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY - Test these files in Madden in order to find crash source:');
  console.log('='.repeat(60));
  console.log('TEST-1995-01-YEAR         - Just year change');
  console.log('TEST-1995-02-SALARY       - Year + salary cap');
  console.log('TEST-1995-03-TEAMS        - Year + salary + team names');
  console.log('TEST-1995-04-SCHEDULE-MIN - Year + salary + teams + 1 game swap');
  console.log('TEST-1995-05-OFFSEASON    - Year + salary + teams + mark weeks as OffSeason');
  console.log('TEST-1995-06-ALL          - All combined');
  console.log('\nTest each file by loading in Madden and simming a week.');
  console.log('The first file that crashes indicates the problem operation.');
}

main().catch(console.error);
