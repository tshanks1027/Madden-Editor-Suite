/**
 * Preseason Schedule Generator Script
 *
 * Adds historical NFL preseason schedules to existing schedule JSON files.
 * Scrapes from Pro-Football-Reference (available 1983-2024).
 * For 1970-1982, generates algorithmic preseason matchups.
 *
 * Run with: node add-preseason-schedules.js [startYear] [endYear]
 */

const fs = require('fs');
const path = require('path');

// Team name to index mapping - matches Madden 26 TeamIndex values
const teamNameMappings = {
  // Modern teams (current names)
  "Arizona Cardinals": 6,
  "Atlanta Falcons": 13,
  "Baltimore Ravens": 24,
  "Buffalo Bills": 2,
  "Carolina Panthers": 20,
  "Chicago Bears": 0,
  "Cincinnati Bengals": 1,
  "Cleveland Browns": 4,
  "Dallas Cowboys": 10,
  "Denver Broncos": 3,
  "Detroit Lions": 18,
  "Green Bay Packers": 19,
  "Houston Texans": 31,
  "Indianapolis Colts": 9,
  "Jacksonville Jaguars": 16,
  "Kansas City Chiefs": 8,
  "Las Vegas Raiders": 22,
  "Los Angeles Chargers": 7,
  "Los Angeles Rams": 23,
  "Miami Dolphins": 11,
  "Minnesota Vikings": 30,
  "New England Patriots": 21,
  "New Orleans Saints": 26,
  "New York Giants": 15,
  "New York Jets": 17,
  "Philadelphia Eagles": 12,
  "Pittsburgh Steelers": 28,
  "San Francisco 49ers": 14,
  "Seattle Seahawks": 27,
  "Tampa Bay Buccaneers": 5,
  "Tennessee Titans": 29,
  "Washington Commanders": 25,

  // Historical names
  "Phoenix Cardinals": 6,
  "St. Louis Cardinals": 6,
  "Baltimore Colts": 9,
  "Boston Patriots": 21,
  "Houston Oilers": 29,
  "Tennessee Oilers": 29,
  "Oakland Raiders": 22,
  "Los Angeles Raiders": 22,
  "San Diego Chargers": 7,
  "St. Louis Rams": 23,
  "Washington Redskins": 25,
  "Washington Football Team": 25,

  // Nickname-only variations
  "Cardinals": 6,
  "Falcons": 13,
  "Ravens": 24,
  "Bills": 2,
  "Panthers": 20,
  "Bears": 0,
  "Bengals": 1,
  "Browns": 4,
  "Cowboys": 10,
  "Broncos": 3,
  "Lions": 18,
  "Packers": 19,
  "Texans": 31,
  "Colts": 9,
  "Jaguars": 16,
  "Chiefs": 8,
  "Raiders": 22,
  "Chargers": 7,
  "Rams": 23,
  "Dolphins": 11,
  "Vikings": 30,
  "Patriots": 21,
  "Saints": 26,
  "Giants": 15,
  "Jets": 17,
  "Eagles": 12,
  "Steelers": 28,
  "49ers": 14,
  "Seahawks": 27,
  "Buccaneers": 5,
  "Titans": 29,
  "Commanders": 25,
  "Oilers": 29,
  "Redskins": 25
};

// Expansion team history for determining active teams
const expansionTeams = [
  { team: "Cowboys", teamIndex: 10, year: 1960 },
  { team: "Vikings", teamIndex: 30, year: 1961 },
  { team: "Falcons", teamIndex: 13, year: 1966 },
  { team: "Dolphins", teamIndex: 11, year: 1966 },
  { team: "Saints", teamIndex: 26, year: 1967 },
  { team: "Bengals", teamIndex: 1, year: 1968 },
  { team: "Seahawks", teamIndex: 27, year: 1976 },
  { team: "Buccaneers", teamIndex: 5, year: 1976 },
  { team: "Panthers", teamIndex: 20, year: 1995 },
  { team: "Jaguars", teamIndex: 16, year: 1995 },
  { team: "Ravens", teamIndex: 24, year: 1996 },
  { team: "Texans", teamIndex: 31, year: 2002 }
];

// Preseason games per year (historical)
const preseasonGamesPerYear = {
  1970: 6, 1971: 6, 1972: 6, 1973: 6, 1974: 6, 1975: 6, 1976: 6, 1977: 6,
  1978: 4, // Reduced from 6 to 4 when regular season expanded to 16 games
  default: 4
};

function getPreseasonGames(year) {
  return preseasonGamesPerYear[year] || preseasonGamesPerYear.default;
}

function getActiveTeams(year) {
  // All 32 teams minus those that hadn't joined yet
  const allTeamIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
  const inactiveIndices = new Set();

  for (const team of expansionTeams) {
    if (team.year > year) {
      inactiveIndices.add(team.teamIndex);
    }
  }

  // Special case: Browns 1996-1998
  if (year >= 1996 && year <= 1998) {
    inactiveIndices.add(4);
  }

  return allTeamIndices.filter(idx => !inactiveIndices.has(idx));
}

function resolveTeamIndex(teamName, year) {
  if (teamNameMappings[teamName] !== undefined) {
    return teamNameMappings[teamName];
  }

  const withoutThe = teamName.replace(/^the\s+/i, '');
  if (teamNameMappings[withoutThe] !== undefined) {
    return teamNameMappings[withoutThe];
  }

  for (const [name, index] of Object.entries(teamNameMappings)) {
    if (teamName.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(teamName.toLowerCase())) {
      return index;
    }
  }

  console.warn(`Could not resolve team: "${teamName}" for year ${year}`);
  return -1;
}

async function scrapePreseasonSchedule(year) {
  console.log(`Scraping ${year} preseason schedule...`);

  try {
    const url = `https://www.pro-football-reference.com/years/${year}/preseason.htm`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No preseason data available for ${year}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const preseasonGames = [];

    // Parse the HTML to find game rows
    // PFR format: <tr><th>Week</th><td>Day</td><td>Visitor</td><td>Pts</td><td>Home</td><td>Pts</td>...</tr>
    const gameRowRegex = /<tr[^>]*>.*?<th[^>]*data-stat="week_num"[^>]*>(\d+)<\/th>.*?<td[^>]*data-stat="visitor_team"[^>]*>.*?<a[^>]*>([^<]+)<\/a>.*?<td[^>]*data-stat="home_team"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/gs;

    let match;
    while ((match = gameRowRegex.exec(html)) !== null) {
      const week = parseInt(match[1], 10);
      const awayTeam = match[2].trim();
      const homeTeam = match[3].trim();

      const homeTeamIndex = resolveTeamIndex(homeTeam, year);
      const awayTeamIndex = resolveTeamIndex(awayTeam, year);

      if (homeTeamIndex >= 0 && awayTeamIndex >= 0) {
        preseasonGames.push({
          week: week,
          weekType: "preseason",
          homeTeam: homeTeam,
          awayTeam: awayTeam,
          homeTeamIndex: homeTeamIndex,
          awayTeamIndex: awayTeamIndex
        });
      }
    }

    // Alternative parsing if first method fails
    if (preseasonGames.length === 0) {
      // Try simpler regex for game data
      const simpleGameRegex = /game_date.*?<a[^>]*href="\/teams\/\w+\/\d+\.htm"[^>]*>([^<]+)<\/a>.*?<a[^>]*href="\/teams\/\w+\/\d+\.htm"[^>]*>([^<]+)<\/a>/gs;
      let weekNum = 1;
      let gameCount = 0;

      while ((match = simpleGameRegex.exec(html)) !== null) {
        const awayTeam = match[1].trim();
        const homeTeam = match[2].trim();

        const homeTeamIndex = resolveTeamIndex(homeTeam, year);
        const awayTeamIndex = resolveTeamIndex(awayTeam, year);

        if (homeTeamIndex >= 0 && awayTeamIndex >= 0) {
          // Estimate week based on game count (roughly 16 games per week for modern NFL)
          preseasonGames.push({
            week: weekNum,
            weekType: "preseason",
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            homeTeamIndex: homeTeamIndex,
            awayTeamIndex: awayTeamIndex
          });
          gameCount++;
          if (gameCount >= 16) {
            weekNum++;
            gameCount = 0;
          }
        }
      }
    }

    console.log(`Found ${preseasonGames.length} preseason games for ${year}`);
    return preseasonGames;

  } catch (error) {
    console.error(`Error scraping ${year}: ${error.message}`);
    return null;
  }
}

function generateAlgorithmicPreseason(year) {
  console.log(`Generating algorithmic preseason for ${year}...`);

  const activeTeams = getActiveTeams(year);
  const numWeeks = getPreseasonGames(year);
  const gamesPerWeek = Math.floor(activeTeams.length / 2);

  console.log(`Active teams: ${activeTeams.length}, Preseason weeks: ${numWeeks}, Games/week: ${gamesPerWeek}`);

  // Each team needs: numWeeks games total, numWeeks/2 home, numWeeks/2 away
  const homeGamesNeeded = Math.floor(numWeeks / 2);
  const awayGamesNeeded = numWeeks - homeGamesNeeded;

  // Track each team's home/away counts
  const teamHomeCount = {};
  const teamAwayCount = {};
  const teamOpponents = {}; // Track who each team has played
  activeTeams.forEach(t => {
    teamHomeCount[t] = 0;
    teamAwayCount[t] = 0;
    teamOpponents[t] = new Set();
  });

  const preseasonGames = [];

  // Generate games week by week
  for (let week = 1; week <= numWeeks; week++) {
    const teamsThisWeek = [...activeTeams];
    const gamesThisWeek = [];

    // Shuffle for variety
    teamsThisWeek.sort(() => Math.random() - 0.5);

    while (teamsThisWeek.length >= 2) {
      // Find best home team (needs home games, hasn't exceeded limit)
      let homeTeamIndex = -1;
      let awayTeamIndex = -1;

      for (let i = 0; i < teamsThisWeek.length && homeTeamIndex === -1; i++) {
        const potentialHome = teamsThisWeek[i];
        if (teamHomeCount[potentialHome] >= homeGamesNeeded) continue;

        // Find an away opponent for this home team
        for (let j = 0; j < teamsThisWeek.length; j++) {
          if (i === j) continue;
          const potentialAway = teamsThisWeek[j];
          if (teamAwayCount[potentialAway] >= awayGamesNeeded) continue;
          // Avoid repeat matchups if possible
          if (teamOpponents[potentialHome].has(potentialAway) && teamsThisWeek.length > 2) continue;

          homeTeamIndex = potentialHome;
          awayTeamIndex = potentialAway;
          break;
        }
      }

      // If strict matching failed, relax constraints
      if (homeTeamIndex === -1 && teamsThisWeek.length >= 2) {
        // Just take first two available
        for (let i = 0; i < teamsThisWeek.length && homeTeamIndex === -1; i++) {
          const potentialHome = teamsThisWeek[i];
          for (let j = 0; j < teamsThisWeek.length; j++) {
            if (i === j) continue;
            homeTeamIndex = potentialHome;
            awayTeamIndex = teamsThisWeek[j];
            break;
          }
        }
      }

      if (homeTeamIndex === -1) break;

      // Create the game
      teamHomeCount[homeTeamIndex]++;
      teamAwayCount[awayTeamIndex]++;
      teamOpponents[homeTeamIndex].add(awayTeamIndex);
      teamOpponents[awayTeamIndex].add(homeTeamIndex);

      // Remove from available teams this week
      teamsThisWeek.splice(teamsThisWeek.indexOf(homeTeamIndex), 1);
      teamsThisWeek.splice(teamsThisWeek.indexOf(awayTeamIndex), 1);

      // Get team names
      const homeTeam = Object.entries(teamNameMappings).find(([_, idx]) => idx === homeTeamIndex)?.[0] || `Team ${homeTeamIndex}`;
      const awayTeam = Object.entries(teamNameMappings).find(([_, idx]) => idx === awayTeamIndex)?.[0] || `Team ${awayTeamIndex}`;

      gamesThisWeek.push({
        week: week,
        weekType: "preseason",
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        homeTeamIndex: homeTeamIndex,
        awayTeamIndex: awayTeamIndex
      });
    }

    preseasonGames.push(...gamesThisWeek);
    console.log(`  Week ${week}: ${gamesThisWeek.length} games`);
  }

  // Verify balance
  let unbalanced = 0;
  for (const team of activeTeams) {
    const total = teamHomeCount[team] + teamAwayCount[team];
    if (total !== numWeeks) {
      console.warn(`  Team ${team}: ${total} games (${teamHomeCount[team]}H/${teamAwayCount[team]}A) - expected ${numWeeks}`);
      unbalanced++;
    }
  }

  if (unbalanced > 0) {
    console.warn(`  ${unbalanced} teams have wrong game count!`);
  } else {
    console.log(`  All ${activeTeams.length} teams have exactly ${numWeeks} games`);
  }

  console.log(`Generated ${preseasonGames.length} preseason games for ${year}`);
  return preseasonGames;
}

async function addPreseasonToSchedule(year) {
  const schedulePath = path.join(__dirname, 'data', 'retro', 'schedules', `${year}.json`);

  if (!fs.existsSync(schedulePath)) {
    console.log(`No schedule file for ${year}, skipping`);
    return false;
  }

  const scheduleData = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));

  // Check if preseason already exists
  const hasPreseason = scheduleData.games.some(g => g.weekType === 'preseason');
  if (hasPreseason) {
    console.log(`${year} already has preseason data, skipping`);
    return false;
  }

  // Get preseason games - try scraping first, fall back to algorithmic
  let preseasonGames;
  // PFR has preseason data going back to at least 1970
  preseasonGames = await scrapePreseasonSchedule(year);
  if (!preseasonGames || preseasonGames.length === 0) {
    // Fall back to algorithmic
    console.log(`Scraping failed for ${year}, using algorithmic preseason`);
    preseasonGames = generateAlgorithmicPreseason(year);
  }

  if (preseasonGames && preseasonGames.length > 0) {
    // Add preseason games to the schedule
    scheduleData.preseasonGames = preseasonGames.length;
    scheduleData.preseasonWeeks = Math.max(...preseasonGames.map(g => g.week));

    // Add preseason games at the beginning
    scheduleData.games = [...preseasonGames, ...scheduleData.games];

    // Write back
    fs.writeFileSync(schedulePath, JSON.stringify(scheduleData, null, 2));
    console.log(`Added ${preseasonGames.length} preseason games to ${year}.json`);
    return true;
  }

  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const startYear = parseInt(args[0]) || 1970;
  const endYear = parseInt(args[1]) || 2024;

  console.log(`Adding preseason schedules for ${startYear}-${endYear}`);

  let updated = 0;
  for (let year = startYear; year <= endYear; year++) {
    const success = await addPreseasonToSchedule(year);
    if (success) updated++;

    // Rate limit for scraping
    if (year >= 1983) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\nDone! Updated ${updated} schedule files.`);
}

main().catch(console.error);
