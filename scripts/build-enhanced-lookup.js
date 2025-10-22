/**
 * Build Enhanced Lookup File from Pro Football Reference
 *
 * Scrapes draft data from PFR for NFL (1994-2025) and AFL (1960-1969) drafts
 * Adds physical and career stats to FullData_Lookup.csv:
 * - Height, Weight
 * - From (first year), To (last year)
 * - AP1 (All-Pro First Team), PB (Pro Bowls), St (Years Started)
 * - wAV (Weighted Approximate Value)
 *
 * This will make draft class and roster generation much faster and more accurate.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Draft years to scrape
const NFL_DRAFT_YEARS = [];
for (let year = 1994; year <= 2025; year++) {
  NFL_DRAFT_YEARS.push(year);
}

// AFL draft years (1960-1969)
const AFL_DRAFT_YEARS = [];
for (let year = 1960; year <= 1969; year++) {
  AFL_DRAFT_YEARS.push(year);
}

const ALL_DRAFT_YEARS = [...AFL_DRAFT_YEARS, ...NFL_DRAFT_YEARS].sort((a, b) => a - b);

/**
 * Scrape draft data from Pro Football Reference
 * @param {number} year Draft year
 * @param {object} page Puppeteer page
 * @returns {Promise<Array>} Array of player objects
 */
async function scrapeDraftYear(year, page) {
  const isAFL = year >= 1960 && year <= 1969;
  const league = isAFL ? 'AFL' : 'NFL';
  const url = `https://www.pro-football-reference.com/years/${year}/draft.htm`;

  console.log(`\n[${league}] Scraping ${year} draft: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 }); // NO TIMEOUT

    // Wait for draft table (NO TIMEOUT)
    await page.waitForSelector('#drafts', { timeout: 0 });

    // Extract data from table
    const players = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#drafts tbody tr'));
      const data = [];

      rows.forEach(row => {
        // Skip header rows
        if (row.classList.contains('thead')) return;

        const cells = row.querySelectorAll('td, th');
        if (cells.length < 10) return;

        // Extract data from cells
        const round = cells[0]?.textContent?.trim() || '';
        const pick = cells[1]?.textContent?.trim() || '';
        const team = cells[2]?.textContent?.trim() || '';
        const player = cells[3]?.textContent?.trim() || '';
        const position = cells[4]?.textContent?.trim() || '';
        const age = cells[5]?.textContent?.trim() || '';
        const from = cells[6]?.textContent?.trim() || ''; // First year
        const to = cells[7]?.textContent?.trim() || ''; // Last year
        const ap1 = cells[8]?.textContent?.trim() || '0'; // All-Pro First Team
        const pb = cells[9]?.textContent?.trim() || '0'; // Pro Bowls
        const st = cells[10]?.textContent?.trim() || '0'; // Years Started
        const wAV = cells[11]?.textContent?.trim() || '0'; // Weighted Approximate Value
        const college = cells[13]?.textContent?.trim() || '';

        // Extract player page link
        const playerLink = cells[3]?.querySelector('a')?.getAttribute('href') || '';

        if (player && position) {
          data.push({
            round,
            pick,
            team,
            player,
            position,
            age,
            from,
            to,
            ap1,
            pb,
            st,
            wAV,
            college,
            playerLink, // Will use this to fetch height/weight
            height: '',  // Will be filled in later
            weight: ''   // Will be filled in later
          });
        }
      });

      return data;
    });

    console.log(`  Found ${players.length} players in ${year} ${league} draft`);
    return players.map(p => ({ ...p, draftYear: year, league }));

  } catch (error) {
    console.error(`  Error scraping ${year} ${league} draft:`, error.message);
    return [];
  }
}

/**
 * Scrape player physical data from their player page (with retry logic)
 * @param {string} playerLink Player page URL path (e.g. "/players/A/AdamsDa01.htm")
 * @param {string} playerName Player name for logging
 * @param {object} page Puppeteer page
 * @param {number} retries Number of retries remaining (default: 3)
 * @returns {Promise<{height: string, weight: string}>}
 */
async function scrapePlayerPhysicals(playerLink, playerName, page, retries = 3) {
  // Skip if no player link
  if (!playerLink) {
    return { height: '', weight: '' };
  }

  try {
    // Navigate to player page (NO TIMEOUT)
    const playerUrl = `https://www.pro-football-reference.com${playerLink}`;
    await page.goto(playerUrl, { waitUntil: 'domcontentloaded', timeout: 0 });

    // Try to find height and weight on player page
    const physicals = await page.evaluate(() => {
      // Look for player info in the meta div
      const heightSpan = document.querySelector('span[itemprop="height"]');
      const weightSpan = document.querySelector('span[itemprop="weight"]');

      return {
        height: heightSpan?.textContent?.trim() || '',
        weight: weightSpan?.textContent?.trim().replace(/lbs?/, '').trim() || ''
      };
    });

    return physicals;

  } catch (error) {
    // Retry if we have retries remaining
    if (retries > 0) {
      console.error(`    Error getting physicals for ${playerName}: ${error.message} - retrying (${retries} left)...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
      return scrapePlayerPhysicals(playerLink, playerName, page, retries - 1);
    } else {
      console.error(`    Failed to get physicals for ${playerName} after all retries:`, error.message);
      return { height: '', weight: '' };
    }
  }
}

/**
 * Load existing FullData_Lookup.csv to preserve PID and PLPO mappings
 * @returns {Map<string, object>} Map of player key to entry
 */
function loadExistingLookup() {
  const lookupPath = path.join(__dirname, '..', 'data', 'lookups', 'FullData_Lookup.csv');
  const existing = new Map();

  if (!fs.existsSync(lookupPath)) {
    console.log('No existing FullData_Lookup.csv found, creating new file');
    return existing;
  }

  const content = fs.readFileSync(lookupPath, 'utf-8');
  const lines = content.split('\n');

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 12) continue;

    const lastName = parts[0].trim();
    const firstName = parts[1].trim();
    const draftClass = parts[5].trim();
    const position = parts[6].trim();

    // Use name + draft year + position as key
    const key = `${lastName}|${firstName}|${draftClass}|${position}`.toLowerCase();

    existing.set(key, {
      lastName,
      firstName,
      college: parts[2].trim(),
      round: parts[3].trim(),
      pick: parts[4].trim(),
      draftClass,
      position,
      pid: parts[7].trim(),
      pam: parts[8].trim(),
      commID: parts[9].trim(),
      presID: parts[10].trim(),
      plpo: parts[11].trim()
    });
  }

  console.log(`Loaded ${existing.size} existing entries from FullData_Lookup.csv`);
  return existing;
}

/**
 * Save checkpoint data
 */
function saveCheckpoint(data, filename = 'lookup-checkpoint.json') {
  const checkpointPath = path.join(__dirname, '..', 'data', 'lookups', filename);
  fs.writeFileSync(checkpointPath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Load checkpoint data
 */
function loadCheckpoint(filename = 'lookup-checkpoint.json') {
  const checkpointPath = path.join(__dirname, '..', 'data', 'lookups', filename);
  if (fs.existsSync(checkpointPath)) {
    console.log('\n✓ Found checkpoint file - resuming from saved progress\n');
    return JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
  }
  return null;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Building Enhanced FullData Lookup ===\n');
  console.log(`Scraping ${ALL_DRAFT_YEARS.length} draft years (${ALL_DRAFT_YEARS[0]}-${ALL_DRAFT_YEARS[ALL_DRAFT_YEARS.length - 1]})`);

  // Load existing lookup to preserve PID/PLPO mappings
  const existingLookup = loadExistingLookup();

  // Check for checkpoint
  const checkpoint = loadCheckpoint();

  // Launch browser with NO TIMEOUT - this will run for hours
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    protocolTimeout: 0 // DISABLE timeout - will run for hours
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setDefaultTimeout(0); // DISABLE timeout
  await page.setDefaultNavigationTimeout(0); // DISABLE navigation timeout

  // Scrape all draft years (or resume from checkpoint)
  let allPlayers = [];
  let startFrom = 0;

  if (checkpoint && checkpoint.allPlayers) {
    allPlayers = checkpoint.allPlayers;
    startFrom = checkpoint.lastPlayerIndex + 1 || 0;
    console.log(`\n✓ Resuming from player ${startFrom} of ${checkpoint.playersWithLinks.length}\n`);
  } else {
    for (const year of ALL_DRAFT_YEARS) {
      const players = await scrapeDraftYear(year, page);
      allPlayers.push(...players);

      // Rate limit - wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n=== Scraped ${allPlayers.length} total players ===\n`);
  }

  // Now scrape height/weight for players with links
  const playersWithLinks = checkpoint?.playersWithLinks || allPlayers.filter(p => p.playerLink);
  console.log(`\n=== Scraping physical data for ${playersWithLinks.length} players ===`);
  console.log('(This will take a while - be patient!)\n');

  let scrapedCount = startFrom;
  let errorCount = checkpoint?.errorCount || 0;

  // CSV path for incremental writing
  const csvPath = path.join(__dirname, '..', 'data', 'lookups', 'FullData_Lookup_Enhanced.csv');

  // Write CSV header if starting fresh
  if (startFrom === 0) {
    const header = 'Last Name,First Name,College/Univ,Round,Pick,Draft Class,Position,PhotoID,Player Assets ID,CommID,PresID,PLPO,Height,Weight,From,To,AP1,PB,St,wAV,League\n';
    fs.writeFileSync(csvPath, header, 'utf-8');
  }

  for (let i = startFrom; i < playersWithLinks.length; i++) {
    const player = playersWithLinks[i];
    scrapedCount++;

    if (scrapedCount % 50 === 0) {
      console.log(`Progress: ${scrapedCount}/${playersWithLinks.length} (${Math.round(scrapedCount / playersWithLinks.length * 100)}%)`);
    }

    try {
      const physicals = await scrapePlayerPhysicals(player.playerLink, player.player, page);
      player.height = physicals.height;
      player.weight = physicals.weight;

      // Update the corresponding player in allPlayers
      const originalPlayer = allPlayers.find(p => p.playerLink === player.playerLink);
      if (originalPlayer) {
        originalPlayer.height = physicals.height;
        originalPlayer.weight = physicals.weight;
      }

      // IMMEDIATELY write this player to CSV (NO DATA LOSS)
      const nameParts = player.player.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const key = `${lastName}|${firstName}|${player.draftYear}|${player.position}`.toLowerCase();
      const existing = existingLookup.get(key);

      const csvLine = `${lastName},${firstName},${player.college},${player.round},${player.pick},${player.draftYear},${player.position},${existing?.pid || ''},${existing?.pam || ''},${existing?.commID || ''},${existing?.presID || ''},${existing?.plpo || ''},${player.height || ''},${player.weight || ''},${player.from},${player.to},${player.ap1},${player.pb},${player.st},${player.wAV},${player.league}\n`;

      fs.appendFileSync(csvPath, csvLine, 'utf-8');

      // Save checkpoint every 10 players now (more frequent)
      if (scrapedCount % 10 === 0) {
        saveCheckpoint({
          allPlayers,
          playersWithLinks,
          lastPlayerIndex: i,
          errorCount
        });
      }

      // Rate limit - wait 3 seconds between player page requests
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      errorCount++;
      console.error(`  Error scraping ${player.player}:`, error.message);
    }
  }

  await browser.close();

  console.log(`\n✓ Physical data scraping complete!`);
  console.log(`  Scraped: ${scrapedCount} players`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  With height/weight: ${allPlayers.filter(p => p.height && p.weight).length}`);

  console.log(`\n✓ Enhanced lookup file written to: ${csvPath}`);
  console.log(`✓ Total entries: ${scrapedCount}`);
  console.log(`\nNext steps:`);
  console.log(`1. Review FullData_Lookup_Enhanced.csv`);
  console.log(`2. Backup original FullData_Lookup.csv`);
  console.log(`3. Replace FullData_Lookup.csv with enhanced version`);

  // Clean up checkpoint file
  const checkpointPath = path.join(__dirname, '..', 'data', 'lookups', 'lookup-checkpoint.json');
  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
    console.log(`\n✓ Checkpoint file cleaned up`);
  }
}

main().catch(error => {
  console.error('\n' + '='.repeat(60));
  console.error('✗✗✗ SCRAPER CRASHED ✗✗✗');
  console.error('='.repeat(60));
  console.error('\nError:', error.message);
  console.error('\nStack trace:', error.stack);
  console.error('\n' + '='.repeat(60));
  console.error('CHECKPOINT SAVED - YOU CAN RESTART TO RESUME');
  console.error('Run: node scripts/build-enhanced-lookup.js');
  console.error('='.repeat(60) + '\n');

  // Write crash notification to file
  const crashPath = path.join(__dirname, '..', 'data', 'lookups', 'SCRAPER_CRASHED.txt');
  const crashMsg = `SCRAPER CRASHED AT ${new Date().toISOString()}\n\nError: ${error.message}\n\nRestart with: node scripts/build-enhanced-lookup.js`;
  fs.writeFileSync(crashPath, crashMsg, 'utf-8');

  process.exit(1);
});
