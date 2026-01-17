/**
 * Generate valid preseason schedules for retro years
 * Rules:
 * - Each team plays exactly once per week
 * - Madden has 3 preseason weeks (0, 1, 2)
 * - Each team gets 3 preseason games total
 */

const fs = require('fs');
const path = require('path');

// Team data for different eras
const TEAM_CONFIGS = {
  // 1994: 28 teams (no Jaguars, Panthers, Ravens, Texans)
  1994: {
    teams: [
      { name: 'Arizona Cardinals', index: 6 },
      { name: 'Atlanta Falcons', index: 13 },
      { name: 'Buffalo Bills', index: 2 },
      { name: 'Chicago Bears', index: 0 },
      { name: 'Cincinnati Bengals', index: 1 },
      { name: 'Cleveland Browns', index: 4 },
      { name: 'Dallas Cowboys', index: 10 },
      { name: 'Denver Broncos', index: 3 },
      { name: 'Detroit Lions', index: 18 },
      { name: 'Green Bay Packers', index: 19 },
      { name: 'Houston Oilers', index: 29 }, // Now Tennessee
      { name: 'Indianapolis Colts', index: 9 },
      { name: 'Kansas City Chiefs', index: 8 },
      { name: 'Los Angeles Raiders', index: 22 }, // Now Las Vegas
      { name: 'Los Angeles Rams', index: 23 },
      { name: 'Miami Dolphins', index: 11 },
      { name: 'Minnesota Vikings', index: 30 },
      { name: 'New England Patriots', index: 21 },
      { name: 'New Orleans Saints', index: 26 },
      { name: 'New York Giants', index: 15 },
      { name: 'New York Jets', index: 17 },
      { name: 'Philadelphia Eagles', index: 12 },
      { name: 'Pittsburgh Steelers', index: 28 },
      { name: 'San Diego Chargers', index: 7 }, // Now LA Chargers
      { name: 'San Francisco 49ers', index: 14 },
      { name: 'Seattle Seahawks', index: 27 },
      { name: 'Tampa Bay Buccaneers', index: 5 },
      { name: 'Washington Redskins', index: 25 }
    ],
    preseasonWeeks: 3 // Madden limitation
  }
};

/**
 * Shuffle array in place (Fisher-Yates)
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Generate valid pairings for one week
 * Each team plays exactly once
 */
function generateWeekPairings(teams, previousGames = []) {
  const teamCount = teams.length;
  const games = [];
  const usedThisWeek = new Set();

  // Create set of previous matchups to avoid repeats
  const previousMatchups = new Set();
  for (const game of previousGames) {
    const key1 = `${game.homeTeamIndex}-${game.awayTeamIndex}`;
    const key2 = `${game.awayTeamIndex}-${game.homeTeamIndex}`;
    previousMatchups.add(key1);
    previousMatchups.add(key2);
  }

  // Shuffle teams for randomness
  const shuffled = shuffle([...teams]);

  // Try to pair teams
  for (let i = 0; i < shuffled.length; i++) {
    const team1 = shuffled[i];
    if (usedThisWeek.has(team1.index)) continue;

    for (let j = i + 1; j < shuffled.length; j++) {
      const team2 = shuffled[j];
      if (usedThisWeek.has(team2.index)) continue;

      // Check if this matchup already happened
      const matchupKey = `${team1.index}-${team2.index}`;
      if (previousMatchups.has(matchupKey)) continue;

      // Valid pairing found
      usedThisWeek.add(team1.index);
      usedThisWeek.add(team2.index);

      // Randomly assign home/away
      if (Math.random() > 0.5) {
        games.push({
          homeTeam: team1.name,
          homeTeamIndex: team1.index,
          awayTeam: team2.name,
          awayTeamIndex: team2.index
        });
      } else {
        games.push({
          homeTeam: team2.name,
          homeTeamIndex: team2.index,
          awayTeam: team1.name,
          awayTeamIndex: team1.index
        });
      }
      break;
    }
  }

  return games;
}

/**
 * Generate complete preseason schedule
 */
function generatePreseasonSchedule(year) {
  const config = TEAM_CONFIGS[year];
  if (!config) {
    console.error(`No config for year ${year}`);
    return null;
  }

  const allGames = [];
  const teams = config.teams;

  console.log(`Generating preseason for ${year}`);
  console.log(`Teams: ${teams.length}`);
  console.log(`Weeks: ${config.preseasonWeeks}`);
  console.log(`Expected games per week: ${teams.length / 2}`);
  console.log(`Expected total games: ${(teams.length / 2) * config.preseasonWeeks}`);

  for (let week = 1; week <= config.preseasonWeeks; week++) {
    const weekGames = generateWeekPairings(teams, allGames);

    for (const game of weekGames) {
      allGames.push({
        week: week,
        weekType: 'preseason',
        ...game
      });
    }

    console.log(`Week ${week}: ${weekGames.length} games`);
  }

  // Verify schedule
  console.log('\n=== VERIFICATION ===');
  const teamGameCount = {};
  const teamWeekCount = {};

  for (const game of allGames) {
    // Count games per team
    teamGameCount[game.homeTeamIndex] = (teamGameCount[game.homeTeamIndex] || 0) + 1;
    teamGameCount[game.awayTeamIndex] = (teamGameCount[game.awayTeamIndex] || 0) + 1;

    // Check for duplicate appearances per week
    const homeKey = `${game.homeTeamIndex}_w${game.week}`;
    const awayKey = `${game.awayTeamIndex}_w${game.week}`;
    teamWeekCount[homeKey] = (teamWeekCount[homeKey] || 0) + 1;
    teamWeekCount[awayKey] = (teamWeekCount[awayKey] || 0) + 1;
  }

  // Check all teams have same number of games
  const gameCounts = Object.values(teamGameCount);
  const allSame = gameCounts.every(c => c === gameCounts[0]);
  console.log(`All teams have ${gameCounts[0]} games: ${allSame ? 'YES' : 'NO'}`);

  // Check no duplicates per week
  const duplicates = Object.entries(teamWeekCount).filter(([k, v]) => v > 1);
  console.log(`Duplicate appearances per week: ${duplicates.length === 0 ? 'NONE' : duplicates.length}`);

  if (duplicates.length > 0) {
    console.log('DUPLICATES:', duplicates);
  }

  return allGames;
}

// Generate for 1994
const year = 1994;
const preseasonGames = generatePreseasonSchedule(year);

if (preseasonGames) {
  // Load existing schedule to preserve regular season
  const schedulePath = path.join(__dirname, '..', 'data', 'retro', 'schedules', `${year}.json`);
  let scheduleData;

  if (fs.existsSync(schedulePath)) {
    scheduleData = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
    // Remove old preseason games
    scheduleData.games = scheduleData.games.filter(g => g.weekType !== 'preseason');
    // Add new preseason games
    scheduleData.games = [...preseasonGames, ...scheduleData.games];
  } else {
    scheduleData = {
      year: year,
      seasonLength: 16,
      byeWeeksEnabled: true,
      regularSeasonWeeks: 17,
      games: preseasonGames
    };
  }

  // Write back
  fs.writeFileSync(schedulePath, JSON.stringify(scheduleData, null, 2));
  console.log(`\nWrote ${preseasonGames.length} preseason games to ${schedulePath}`);
}
