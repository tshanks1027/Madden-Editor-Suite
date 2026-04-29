/**
 * Re-scrape preseason schedules for years that currently have algorithmic data
 * Run this when PFR rate limits have reset
 *
 * Usage: node rescrape-preseason.js [startYear] [endYear]
 */

const fs = require('fs');
const path = require('path');

const teamNameMappings = {
  "Arizona Cardinals": 6, "Atlanta Falcons": 13, "Baltimore Ravens": 24,
  "Buffalo Bills": 2, "Carolina Panthers": 20, "Chicago Bears": 0,
  "Cincinnati Bengals": 1, "Cleveland Browns": 4, "Dallas Cowboys": 10,
  "Denver Broncos": 3, "Detroit Lions": 18, "Green Bay Packers": 19,
  "Houston Texans": 31, "Indianapolis Colts": 9, "Jacksonville Jaguars": 16,
  "Kansas City Chiefs": 8, "Las Vegas Raiders": 22, "Los Angeles Chargers": 7,
  "Los Angeles Rams": 23, "Miami Dolphins": 11, "Minnesota Vikings": 30,
  "New England Patriots": 21, "New Orleans Saints": 26, "New York Giants": 15,
  "New York Jets": 17, "Philadelphia Eagles": 12, "Pittsburgh Steelers": 28,
  "San Francisco 49ers": 14, "Seattle Seahawks": 27, "Tampa Bay Buccaneers": 5,
  "Tennessee Titans": 29, "Washington Commanders": 25,
  // Historical names
  "Phoenix Cardinals": 6, "St. Louis Cardinals": 6, "Baltimore Colts": 9,
  "Boston Patriots": 21, "Houston Oilers": 29, "Tennessee Oilers": 29,
  "Oakland Raiders": 22, "Los Angeles Raiders": 22, "San Diego Chargers": 7,
  "St. Louis Rams": 23, "Washington Redskins": 25, "Washington Football Team": 25
};

function resolveTeamIndex(teamName, year) {
  if (teamNameMappings[teamName] !== undefined) return teamNameMappings[teamName];
  const withoutThe = teamName.replace(/^the\s+/i, '');
  if (teamNameMappings[withoutThe] !== undefined) return teamNameMappings[withoutThe];
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
      if (response.status === 429) {
        console.log(`Rate limited (429) for ${year} - try again later`);
        return null;
      }
      if (response.status === 404) {
        console.log(`No preseason data available for ${year} (404)`);
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const preseasonGames = [];

    // Parse game rows - look for table rows with game data
    // Format varies by year but typically has visitor team, home team columns
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

    // Alternative simpler regex if primary fails
    if (preseasonGames.length === 0) {
      const simpleGameRegex = /<a[^>]*href="\/teams\/\w+\/\d+\.htm"[^>]*>([^<]+)<\/a>.*?<a[^>]*href="\/teams\/\w+\/\d+\.htm"[^>]*>([^<]+)<\/a>/gs;
      let weekNum = 1;
      let gameCount = 0;

      while ((match = simpleGameRegex.exec(html)) !== null) {
        const awayTeam = match[1].trim();
        const homeTeam = match[2].trim();

        const homeTeamIndex = resolveTeamIndex(homeTeam, year);
        const awayTeamIndex = resolveTeamIndex(awayTeam, year);

        if (homeTeamIndex >= 0 && awayTeamIndex >= 0 && homeTeamIndex !== awayTeamIndex) {
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

async function rescrapeYear(year) {
  const schedulePath = path.join(__dirname, 'data', 'retro', 'schedules', `${year}.json`);

  if (!fs.existsSync(schedulePath)) {
    console.log(`No schedule file for ${year}, skipping`);
    return false;
  }

  const scheduleData = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));

  // Scrape fresh data
  const preseasonGames = await scrapePreseasonSchedule(year);

  if (preseasonGames && preseasonGames.length > 0) {
    // Remove old preseason
    scheduleData.games = scheduleData.games.filter(g => g.weekType !== 'preseason');

    // Add new preseason at beginning
    scheduleData.preseasonGames = preseasonGames.length;
    scheduleData.preseasonWeeks = Math.max(...preseasonGames.map(g => g.week));
    scheduleData.games = [...preseasonGames, ...scheduleData.games];

    fs.writeFileSync(schedulePath, JSON.stringify(scheduleData, null, 2));
    console.log(`Updated ${year}.json with ${preseasonGames.length} real preseason games`);
    return true;
  }

  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const startYear = parseInt(args[0]) || 1970;
  const endYear = parseInt(args[1]) || 1982;

  console.log(`Re-scraping preseason schedules for ${startYear}-${endYear}`);
  console.log('Press Ctrl+C to stop if rate limited\n');

  let updated = 0;
  let rateLimited = false;

  for (let year = startYear; year <= endYear && !rateLimited; year++) {
    const success = await rescrapeYear(year);
    if (success) {
      updated++;
    }

    // Wait 3 seconds between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log(`\nDone! Updated ${updated} schedule files.`);
}

main().catch(console.error);
