/**
 * Schedule Generator Script
 *
 * Generates historical NFL schedule JSON files by scraping Pro-Football-Reference.
 * Run with: node generate-schedules.js [startYear] [endYear]
 *
 * Uses fetch + regex parsing (no puppeteer needed).
 */

const fs = require('fs');
const path = require('path');

// Team name to index mapping - matches Madden 26 TeamIndex values from franchise file
const teamNameMappings = {
  // Modern teams (current names) - TeamIndex from Madden 26
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

  // Nickname-only variations (PFR uses these sometimes)
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

// Era info for determining season characteristics
const eras = [
  { startYear: 1966, endYear: 1969, seasonLength: 14, byeWeeks: false },
  { startYear: 1970, endYear: 1977, seasonLength: 14, byeWeeks: false },
  { startYear: 1978, endYear: 1981, seasonLength: 16, byeWeeks: false },
  { startYear: 1982, endYear: 1982, seasonLength: 9, byeWeeks: false },
  { startYear: 1983, endYear: 1989, seasonLength: 16, byeWeeks: false },
  { startYear: 1990, endYear: 2020, seasonLength: 16, byeWeeks: true, regularSeasonWeeks: 17 },
  { startYear: 2021, endYear: 2025, seasonLength: 17, byeWeeks: true, regularSeasonWeeks: 18 }
];

function getEra(year) {
  return eras.find(e => year >= e.startYear && year <= e.endYear);
}

function resolveTeamIndex(teamName, year) {
  // Direct lookup first
  if (teamNameMappings[teamName] !== undefined) {
    return teamNameMappings[teamName];
  }

  // Try with "the" prefix removed
  const withoutThe = teamName.replace(/^the\s+/i, '');
  if (teamNameMappings[withoutThe] !== undefined) {
    return teamNameMappings[withoutThe];
  }

  // Try partial match
  for (const [name, index] of Object.entries(teamNameMappings)) {
    if (teamName.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(teamName.toLowerCase())) {
      return index;
    }
  }

  console.warn(`Could not resolve team: "${teamName}" for year ${year}`);
  return -1;
}

async function scrapeSchedule(year) {
  console.log(`Scraping ${year} schedule...`);

  try {
    const url = `https://www.pro-football-reference.com/years/${year}/games.htm`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const games = [];

    // Find the games table id position, then extract tbody after it
    const gamesTableIdx = html.indexOf('id="games"');
    if (gamesTableIdx === -1) {
      console.log(`No games table found for ${year}`);
      return [];
    }

    // Find tbody after the games table start
    const tbodyStart = html.indexOf('<tbody>', gamesTableIdx);

    if (tbodyStart === -1) {
      console.log(`No tbody found for ${year}`);
      return [];
    }

    // Find the end - either </tbody> or </table> whichever comes first
    // PFR sometimes doesn't close tbody properly
    let tbodyEnd = html.indexOf('</tbody>', tbodyStart);
    const tableEnd = html.indexOf('</table>', tbodyStart);

    if (tbodyEnd === -1 && tableEnd === -1) {
      // Neither found - use next tbody as boundary
      const nextTbody = html.indexOf('<tbody>', tbodyStart + 7);
      if (nextTbody > 0) {
        tbodyEnd = nextTbody;
      } else {
        // Take a reasonable chunk (300KB should cover any season)
        tbodyEnd = Math.min(tbodyStart + 300000, html.length);
      }
    } else if (tbodyEnd === -1) {
      tbodyEnd = tableEnd;
    }

    const tbody = html.substring(tbodyStart, tbodyEnd);

    // Parse each row by splitting on <tr (more reliable than regex for large HTML)
    const rows = tbody.split('<tr').slice(1); // Skip first empty element

    for (const row of rows) {
      // Skip header rows
      if (row.includes('class="thead"') || row.includes('colspan=')) {
        continue;
      }

      // Extract week number
      const weekMatch = row.match(/data-stat="week_num"[^>]*>(\d+)</);
      if (!weekMatch) continue;
      const week = parseInt(weekMatch[1]);

      // Extract winner team (handles both linked and unlinked, with/without <strong>)
      const winnerMatch = row.match(/data-stat="winner"[^>]*>(?:<strong>)?(?:<a[^>]*>)?([^<]+)/);
      if (!winnerMatch) continue;
      const winner = winnerMatch[1].trim();

      // Extract location indicator (@ means winner was away)
      const locationMatch = row.match(/data-stat="game_location"[^>]*>([^<]*)</);
      const location = locationMatch ? locationMatch[1].trim() : '';

      // Extract loser team
      const loserMatch = row.match(/data-stat="loser"[^>]*>(?:<a[^>]*>)?([^<]+)/);
      if (!loserMatch) continue;
      const loser = loserMatch[1].trim();

      // Determine home/away
      let homeTeam, awayTeam;
      if (location === '@') {
        homeTeam = loser;
        awayTeam = winner;
      } else {
        homeTeam = winner;
        awayTeam = loser;
      }

      if (homeTeam && awayTeam && week) {
        games.push({ week, homeTeam, awayTeam });
      }
    }

    return games;

  } catch (error) {
    console.error(`Error scraping ${year}:`, error.message);
    return [];
  }
}

async function generateScheduleFile(year, games) {
  const era = getEra(year);
  if (!era) {
    console.error(`No era definition for year ${year}`);
    return;
  }

  // Convert games to our schema
  const regularGames = [];
  const playoffGames = [];

  // Determine which weeks are playoffs based on era
  const regularSeasonWeeks = era.regularSeasonWeeks || (era.byeWeeks ? 17 : era.seasonLength);

  for (const game of games) {
    const homeTeamIndex = resolveTeamIndex(game.homeTeam, year);
    const awayTeamIndex = resolveTeamIndex(game.awayTeam, year);

    if (homeTeamIndex === -1 || awayTeamIndex === -1) {
      console.warn(`Skipping game: ${game.awayTeam} @ ${game.homeTeam} (week ${game.week})`);
      continue;
    }

    const gameObj = {
      week: game.week,
      weekType: game.week <= regularSeasonWeeks ? 'regular' : 'playoff',
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeTeamIndex,
      awayTeamIndex
    };

    if (gameObj.weekType === 'regular') {
      regularGames.push(gameObj);
    } else {
      // Categorize playoff games
      if (game.week === regularSeasonWeeks + 1) {
        gameObj.weekType = 'wildcard';
      } else if (game.week === regularSeasonWeeks + 2) {
        gameObj.weekType = 'divisional';
      } else if (game.week === regularSeasonWeeks + 3) {
        gameObj.weekType = 'conference';
      } else {
        gameObj.weekType = 'superbowl';
      }
      playoffGames.push(gameObj);
    }
  }

  const schedule = {
    year,
    seasonLength: era.seasonLength,
    byeWeeksEnabled: era.byeWeeks,
    regularSeasonWeeks: era.regularSeasonWeeks || regularSeasonWeeks,
    games: regularGames,
    playoffs: playoffGames
  };

  // Write to file
  const outputPath = path.join(__dirname, 'data', 'retro', 'schedules', `${year}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(schedule, null, 2));
  console.log(`Generated ${outputPath}: ${regularGames.length} regular season games, ${playoffGames.length} playoff games`);
}

async function main() {
  // Ensure output directory exists
  const schedulesDir = path.join(__dirname, 'data', 'retro', 'schedules');
  if (!fs.existsSync(schedulesDir)) {
    fs.mkdirSync(schedulesDir, { recursive: true });
  }

  console.log('Starting NFL schedule generation...\n');

  // Generate schedules for years 1966-2024
  // (2025 season hasn't happened yet)
  const startYear = parseInt(process.argv[2]) || 1966;
  const endYear = parseInt(process.argv[3]) || 2024;

  for (let year = startYear; year <= endYear; year++) {
    try {
      const games = await scrapeSchedule(year);
      if (games.length > 0) {
        await generateScheduleFile(year, games);
      } else {
        console.log(`No games found for ${year}`);
      }

      // Be polite to the server - wait 3 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Failed to process ${year}:`, error.message);
    }
  }

  console.log('\nSchedule generation complete!');
}

main().catch(console.error);
