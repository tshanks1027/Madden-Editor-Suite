/**
 * Generate Historical Coach Data from Pro-Football-Reference
 *
 * Scrapes team coaching pages to build year-by-year coach data with:
 * - Head Coach, OC, DC for each team per year
 * - HC records calculated UP TO that year (not career totals)
 * - Birth years for age calculation
 *
 * Usage: node generate-coach-data.js [startYear] [endYear]
 * Example: node generate-coach-data.js 1966 2024
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Find Chrome/Edge on the system
function findChrome() {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  for (const chromePath of chromePaths) {
    if (fs.existsSync(chromePath)) {
      console.log(`Found browser at: ${chromePath}`);
      return chromePath;
    }
  }
  return null;
}

// Team info for scraping
const TEAMS = [
  { abbr: 'crd', name: 'Arizona Cardinals', teamIndex: 6, currentAbbr: 'ARI' },
  { abbr: 'atl', name: 'Atlanta Falcons', teamIndex: 13, currentAbbr: 'ATL' },
  { abbr: 'rav', name: 'Baltimore Ravens', teamIndex: 24, currentAbbr: 'BAL', startYear: 1996 },
  { abbr: 'buf', name: 'Buffalo Bills', teamIndex: 2, currentAbbr: 'BUF' },
  { abbr: 'car', name: 'Carolina Panthers', teamIndex: 20, currentAbbr: 'CAR', startYear: 1995 },
  { abbr: 'chi', name: 'Chicago Bears', teamIndex: 0, currentAbbr: 'CHI' },
  { abbr: 'cin', name: 'Cincinnati Bengals', teamIndex: 1, currentAbbr: 'CIN', startYear: 1968 },
  { abbr: 'cle', name: 'Cleveland Browns', teamIndex: 4, currentAbbr: 'CLE' },
  { abbr: 'dal', name: 'Dallas Cowboys', teamIndex: 10, currentAbbr: 'DAL', startYear: 1960 },
  { abbr: 'den', name: 'Denver Broncos', teamIndex: 3, currentAbbr: 'DEN' },
  { abbr: 'det', name: 'Detroit Lions', teamIndex: 18, currentAbbr: 'DET' },
  { abbr: 'gnb', name: 'Green Bay Packers', teamIndex: 19, currentAbbr: 'GB' },
  { abbr: 'htx', name: 'Houston Texans', teamIndex: 31, currentAbbr: 'HOU', startYear: 2002 },
  { abbr: 'clt', name: 'Indianapolis Colts', teamIndex: 9, currentAbbr: 'IND' },
  { abbr: 'jax', name: 'Jacksonville Jaguars', teamIndex: 16, currentAbbr: 'JAX', startYear: 1995 },
  { abbr: 'kan', name: 'Kansas City Chiefs', teamIndex: 8, currentAbbr: 'KC' },
  { abbr: 'sdg', name: 'Los Angeles Chargers', teamIndex: 7, currentAbbr: 'LAC' },
  { abbr: 'ram', name: 'Los Angeles Rams', teamIndex: 23, currentAbbr: 'LAR' },
  { abbr: 'rai', name: 'Las Vegas Raiders', teamIndex: 22, currentAbbr: 'LV' },
  { abbr: 'mia', name: 'Miami Dolphins', teamIndex: 11, currentAbbr: 'MIA', startYear: 1966 },
  { abbr: 'min', name: 'Minnesota Vikings', teamIndex: 30, currentAbbr: 'MIN', startYear: 1961 },
  { abbr: 'nwe', name: 'New England Patriots', teamIndex: 21, currentAbbr: 'NE' },
  { abbr: 'nor', name: 'New Orleans Saints', teamIndex: 26, currentAbbr: 'NO', startYear: 1967 },
  { abbr: 'nyg', name: 'New York Giants', teamIndex: 15, currentAbbr: 'NYG' },
  { abbr: 'nyj', name: 'New York Jets', teamIndex: 17, currentAbbr: 'NYJ' },
  { abbr: 'phi', name: 'Philadelphia Eagles', teamIndex: 12, currentAbbr: 'PHI' },
  { abbr: 'pit', name: 'Pittsburgh Steelers', teamIndex: 28, currentAbbr: 'PIT' },
  { abbr: 'sfo', name: 'San Francisco 49ers', teamIndex: 14, currentAbbr: 'SF' },
  { abbr: 'sea', name: 'Seattle Seahawks', teamIndex: 27, currentAbbr: 'SEA', startYear: 1976 },
  { abbr: 'tam', name: 'Tampa Bay Buccaneers', teamIndex: 5, currentAbbr: 'TB', startYear: 1976 },
  { abbr: 'oti', name: 'Tennessee Titans', teamIndex: 29, currentAbbr: 'TEN' },
  { abbr: 'was', name: 'Washington Commanders', teamIndex: 25, currentAbbr: 'WAS' }
];

// Coach career tracking (to calculate records UP TO a year)
const coachCareerData = new Map();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeTeamCoaches(browser, team) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const url = `https://www.pro-football-reference.com/teams/${team.abbr}/coaches.htm`;
  console.log(`  Fetching ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1000); // Be polite to the server

    // PFR sometimes hides tables in HTML comments - unwrap them first
    await page.evaluate(() => {
      const comments = document.body.innerHTML.match(/<!--[\s\S]*?-->/g) || [];
      comments.forEach(comment => {
        if (comment.includes('id="coaches_year"') || comment.includes('id="all_coaches_year"')) {
          const clean = comment.replace('<!--', '').replace('-->', '');
          const div = document.createElement('div');
          div.innerHTML = clean;
          document.body.appendChild(div);
        }
      });
    });

    // Extract year-by-year coaching data from the table
    const coachData = await page.evaluate(() => {
      const data = [];

      // Try different possible table IDs - PFR uses coaches_year for year-by-year data
      const table = document.querySelector('#coaches_year') ||
                    document.querySelector('#all_coaches_year') ||
                    document.querySelector('#coaching') ||
                    document.querySelector('table.stats_table');
      if (!table) {
        console.log('No coaching table found');
        return data;
      }

      const rows = table.querySelectorAll('tbody tr');
      for (const row of rows) {
        // Skip header rows
        if (row.classList.contains('thead') || row.classList.contains('over_header')) continue;

        const cells = row.querySelectorAll('td, th');
        if (cells.length < 3) continue;

        // Extract year (first cell or th with data-stat="year_id")
        const yearCell = row.querySelector('th[data-stat="year_id"]') ||
                         row.querySelector('td[data-stat="year_id"]') ||
                         cells[0];
        const year = parseInt(yearCell?.textContent?.trim());
        if (isNaN(year)) continue;

        // Extract head coach - try different possible data-stat values
        const hcCell = row.querySelector('td[data-stat="coach"]') ||
                       row.querySelector('td[data-stat="head_coach"]');
        const headCoach = hcCell?.textContent?.trim() || '';
        const hcLink = hcCell?.querySelector('a')?.getAttribute('href');
        const hcRef = hcLink ? hcLink.split('/').pop().replace('.htm', '') : null;

        // Extract OC - data-stat="oc" is the actual attribute (Offense column)
        const ocCell = row.querySelector('td[data-stat="oc"]') ||
                       row.querySelector('td[data-stat="off_coord"]') ||
                       row.querySelector('td[data-stat="offense"]');
        const offCoordinator = ocCell?.textContent?.trim() || '';
        const ocLink = ocCell?.querySelector('a')?.getAttribute('href');
        const ocRef = ocLink ? ocLink.split('/').pop().replace('.htm', '') : null;

        // Extract DC - data-stat="dc" is the actual attribute (Defense column)
        const dcCell = row.querySelector('td[data-stat="dc"]') ||
                       row.querySelector('td[data-stat="def_coord"]') ||
                       row.querySelector('td[data-stat="defense"]');
        const defCoordinator = dcCell?.textContent?.trim() || '';
        const dcLink = dcCell?.querySelector('a')?.getAttribute('href');
        const dcRef = dcLink ? dcLink.split('/').pop().replace('.htm', '') : null;

        // Extract season record - try different possible data-stat values
        const winsCell = row.querySelector('td[data-stat="wins"]') ||
                         row.querySelector('td[data-stat="g"]'); // sometimes just games
        const lossesCell = row.querySelector('td[data-stat="losses"]') ||
                           row.querySelector('td[data-stat="l"]');
        const tiesCell = row.querySelector('td[data-stat="ties"]') ||
                         row.querySelector('td[data-stat="t"]');

        const wins = parseInt(winsCell?.textContent?.trim()) || 0;
        const losses = parseInt(lossesCell?.textContent?.trim()) || 0;
        const ties = parseInt(tiesCell?.textContent?.trim()) || 0;

        // Extract playoff info - data-stat="wins_playoffs" and "losses_playoffs"
        const pWinsCell = row.querySelector('td[data-stat="wins_playoffs"]') ||
                          row.querySelector('td[data-stat="playoff_wins"]') ||
                          row.querySelector('td[data-stat="g_playoffs"]');
        const pLossesCell = row.querySelector('td[data-stat="losses_playoffs"]') ||
                            row.querySelector('td[data-stat="playoff_losses"]');
        const playoffWins = parseInt(pWinsCell?.textContent?.trim()) || 0;
        const playoffLosses = parseInt(pLossesCell?.textContent?.trim()) || 0;

        data.push({
          year,
          headCoach,
          hcRef,
          offCoordinator,
          ocRef,
          defCoordinator,
          dcRef,
          wins,
          losses,
          ties,
          playoffWins,
          playoffLosses
        });
      }

      return data;
    });

    await page.close();
    return coachData;

  } catch (error) {
    console.error(`  Error scraping ${team.name}: ${error.message}`);
    await page.close();
    return [];
  }
}

async function scrapeCoachBirthYear(browser, coachRef) {
  if (!coachRef || coachCareerData.has(coachRef + '_birthYear')) {
    return coachCareerData.get(coachRef + '_birthYear') || null;
  }

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const url = `https://www.pro-football-reference.com/coaches/${coachRef}.htm`;

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(500);

    const birthYear = await page.evaluate(() => {
      // Look for birth date in the info box
      const birthSpan = document.querySelector('span[itemprop="birthDate"]');
      if (birthSpan) {
        const dateStr = birthSpan.getAttribute('data-birth') || birthSpan.textContent;
        const match = dateStr.match(/(\d{4})/);
        if (match) return parseInt(match[1]);
      }
      return null;
    });

    await page.close();
    coachCareerData.set(coachRef + '_birthYear', birthYear);
    return birthYear;

  } catch (error) {
    await page.close();
    return null;
  }
}

function parseName(fullName) {
  if (!fullName || fullName === 'N/A' || fullName === '') {
    return { firstName: '', lastName: '' };
  }
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

// Track and calculate coach career stats UP TO a given year
function getCoachStatsUpToYear(coachRef, fullName, targetYear, allSeasons) {
  // Filter seasons for this coach up to (but not including) target year
  const priorSeasons = allSeasons.filter(s =>
    s.hcRef === coachRef && s.year < targetYear
  );

  let yearsAsHC = priorSeasons.length;
  let careerWins = 0;
  let careerLosses = 0;
  let careerTies = 0;
  let playoffWins = 0;
  let playoffLosses = 0;
  let superBowlWins = 0;

  for (const season of priorSeasons) {
    careerWins += season.wins || 0;
    careerLosses += season.losses || 0;
    careerTies += season.ties || 0;
    playoffWins += season.playoffWins || 0;
    playoffLosses += season.playoffLosses || 0;
    // Super Bowl wins would need special tracking
  }

  return {
    yearsAsHC,
    careerWins,
    careerLosses,
    careerTies,
    playoffWins,
    playoffLosses,
    superBowlWins
  };
}

async function generateCoachData(startYear, endYear) {
  console.log(`Generating coach data for ${startYear}-${endYear}\n`);

  const chromePath = findChrome();
  if (!chromePath) {
    console.error('ERROR: Could not find Chrome or Edge browser. Please install Chrome or Edge.');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Collect all seasons from all teams first
  const allTeamSeasons = new Map(); // team abbr -> season data
  const allHCSeasons = []; // All HC seasons for career tracking

  console.log('Phase 1: Scraping team coaching pages...\n');

  for (const team of TEAMS) {
    console.log(`Scraping ${team.name}...`);
    const coachData = await scrapeTeamCoaches(browser, team);

    // Filter to our year range
    const filteredData = coachData.filter(d => d.year >= startYear && d.year <= endYear);
    allTeamSeasons.set(team.abbr, { team, data: filteredData });

    // Add to all HC seasons for career tracking
    for (const season of coachData) {
      if (season.hcRef) {
        allHCSeasons.push({
          ...season,
          teamAbbr: team.abbr
        });
      }
    }

    await delay(1500); // Be respectful of rate limits
  }

  console.log('\nPhase 2: Building year-by-year coach files...\n');

  // Create output directory
  const outputDir = path.join(__dirname, 'data', 'retro', 'coaches');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Build coach data for each year
  for (let year = startYear; year <= endYear; year++) {
    console.log(`Building ${year} coach data...`);

    const yearData = {
      year,
      teams: []
    };

    for (const team of TEAMS) {
      // Skip teams that didn't exist yet
      if (team.startYear && year < team.startYear) continue;

      const teamSeasons = allTeamSeasons.get(team.abbr);
      if (!teamSeasons) continue;

      const seasonData = teamSeasons.data.find(d => d.year === year);
      if (!seasonData) continue;

      // Calculate HC stats up to this year
      const hcStats = seasonData.hcRef ?
        getCoachStatsUpToYear(seasonData.hcRef, seasonData.headCoach, year, allHCSeasons) :
        { yearsAsHC: 0, careerWins: 0, careerLosses: 0, careerTies: 0, playoffWins: 0, playoffLosses: 0, superBowlWins: 0 };

      // Calculate years with this specific team
      let yearsWithTeam = 1;
      for (let y = year - 1; y >= startYear - 20; y--) {
        const priorSeason = teamSeasons.data.find(d => d.year === y);
        if (priorSeason && priorSeason.hcRef === seasonData.hcRef) {
          yearsWithTeam++;
        } else {
          break;
        }
      }

      const hcName = parseName(seasonData.headCoach);
      const ocName = parseName(seasonData.offCoordinator);
      const dcName = parseName(seasonData.defCoordinator);

      yearData.teams.push({
        teamIndex: team.teamIndex,
        teamAbbr: team.currentAbbr,
        headCoach: {
          firstName: hcName.firstName,
          lastName: hcName.lastName,
          coachRef: seasonData.hcRef,
          yearsAsHC: hcStats.yearsAsHC,
          yearsWithTeam: yearsWithTeam,
          careerWins: hcStats.careerWins,
          careerLosses: hcStats.careerLosses,
          careerTies: hcStats.careerTies,
          playoffWins: hcStats.playoffWins,
          playoffLosses: hcStats.playoffLosses,
          superBowlWins: hcStats.superBowlWins
        },
        offensiveCoordinator: {
          firstName: ocName.firstName,
          lastName: ocName.lastName,
          coachRef: seasonData.ocRef
        },
        defensiveCoordinator: {
          firstName: dcName.firstName,
          lastName: dcName.lastName,
          coachRef: seasonData.dcRef
        }
      });
    }

    // Save year file
    const outputPath = path.join(outputDir, `${year}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(yearData, null, 2));
    console.log(`  Saved ${outputPath}: ${yearData.teams.length} teams`);
  }

  await browser.close();
  console.log('\nCoach data generation complete!');
}

// Parse command line arguments
const args = process.argv.slice(2);
const startYear = parseInt(args[0]) || 1966;
const endYear = parseInt(args[1]) || 2024;

generateCoachData(startYear, endYear).catch(console.error);
