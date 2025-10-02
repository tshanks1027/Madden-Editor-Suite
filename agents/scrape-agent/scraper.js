#!/usr/bin/env node

/**
 * NFL Data Scraper Agent
 *
 * Scrapes NFL information from pro-football-reference.com and other sources.
 * Can be used for general web searches or specific NFL data extraction.
 *
 * Future: AI-driven data extraction for full rosters and draft classes
 *
 * Usage:
 *   node scraper.js search "NFL 1994 season"
 *   node scraper.js scrape-roster 1994
 *   node scraper.js scrape-draft 1994
 *   node scraper.js scrape-player "Joe Montana"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Cache directory for scraped data
const CACHE_DIR = path.join(__dirname, 'cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

class NFLScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser instance
   */
  async init() {
    console.log('🌐 Starting browser...');
    this.browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();

    // Set user agent to avoid detection
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('✅ Browser closed');
    }
  }

  /**
   * General web search for NFL information
   */
  async search(query) {
    console.log(`🔍 Searching for: ${query}`);

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' site:pro-football-reference.com')}`;
    await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });

    // Extract search results
    const results = await this.page.evaluate(() => {
      const items = [];
      document.querySelectorAll('div.g').forEach((result) => {
        const titleEl = result.querySelector('h3');
        const linkEl = result.querySelector('a');
        const descEl = result.querySelector('.VwiC3b');

        if (titleEl && linkEl) {
          items.push({
            title: titleEl.textContent,
            url: linkEl.href,
            description: descEl ? descEl.textContent : ''
          });
        }
      });
      return items;
    });

    console.log(`\n📋 Found ${results.length} results:\n`);
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   ${result.description}\n`);
    });

    return results;
  }

  /**
   * Scrape roster data from Pro-Football-Reference
   */
  async scrapeRoster(year) {
    console.log(`🏈 Scraping ${year} NFL rosters from Pro-Football-Reference...`);

    const url = `https://www.pro-football-reference.com/years/${year}/`;
    await this.page.goto(url, { waitUntil: 'networkidle2' });

    console.log(`📄 Loaded: ${await this.page.title()}`);

    // Extract team data
    const teams = await this.page.evaluate(() => {
      const teamData = [];

      // Find the team standings table
      const table = document.querySelector('#AFC, #NFC');
      if (!table) return teamData;

      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const teamLink = row.querySelector('th a');
        if (teamLink) {
          teamData.push({
            name: teamLink.textContent,
            url: teamLink.href,
            wins: row.querySelector('td[data-stat="wins"]')?.textContent || '0',
            losses: row.querySelector('td[data-stat="losses"]')?.textContent || '0',
            ties: row.querySelector('td[data-stat="ties"]')?.textContent || '0'
          });
        }
      });

      return teamData;
    });

    console.log(`\n✅ Found ${teams.length} teams for ${year} season:`);
    teams.forEach(team => {
      console.log(`   ${team.name}: ${team.wins}-${team.losses}-${team.ties}`);
    });

    // Cache the data
    const cacheFile = path.join(CACHE_DIR, `roster-${year}.json`);
    fs.writeFileSync(cacheFile, JSON.stringify({ year, teams, scrapedAt: new Date().toISOString() }, null, 2));
    console.log(`\n💾 Cached to: ${cacheFile}`);

    return { year, teams };
  }

  /**
   * Scrape draft class data
   */
  async scrapeDraft(year) {
    console.log(`🏈 Scraping ${year} NFL Draft from Pro-Football-Reference...`);

    const url = `https://www.pro-football-reference.com/years/${year}/draft.htm`;
    await this.page.goto(url, { waitUntil: 'networkidle2' });

    console.log(`📄 Loaded: ${await this.page.title()}`);

    // Extract draft picks
    const draftPicks = await this.page.evaluate(() => {
      const picks = [];

      const table = document.querySelector('#drafts');
      if (!table) return picks;

      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const playerLink = row.querySelector('td[data-stat="player"] a');
        if (playerLink) {
          picks.push({
            round: row.querySelector('th[data-stat="draft_round"]')?.textContent || '',
            pick: row.querySelector('td[data-stat="draft_pick"]')?.textContent || '',
            team: row.querySelector('td[data-stat="team"] a')?.textContent || '',
            player: playerLink.textContent,
            position: row.querySelector('td[data-stat="pos"]')?.textContent || '',
            college: row.querySelector('td[data-stat="college"] a')?.textContent || '',
            playerUrl: playerLink.href
          });
        }
      });

      return picks;
    });

    console.log(`\n✅ Found ${draftPicks.length} draft picks for ${year}:`);
    draftPicks.slice(0, 10).forEach(pick => {
      console.log(`   Round ${pick.round}, Pick ${pick.pick}: ${pick.player} (${pick.position}) - ${pick.team}`);
    });
    console.log(`   ... and ${draftPicks.length - 10} more picks`);

    // Cache the data
    const cacheFile = path.join(CACHE_DIR, `draft-${year}.json`);
    fs.writeFileSync(cacheFile, JSON.stringify({ year, draftPicks, scrapedAt: new Date().toISOString() }, null, 2));
    console.log(`\n💾 Cached to: ${cacheFile}`);

    return { year, draftPicks };
  }

  /**
   * Scrape specific player data
   */
  async scrapePlayer(playerName) {
    console.log(`👤 Searching for player: ${playerName}`);

    // Search for the player first
    const searchUrl = `https://www.pro-football-reference.com/search/search.fcgi?search=${encodeURIComponent(playerName)}`;
    await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });

    // Check if we were redirected to a player page
    const currentUrl = this.page.url();

    if (currentUrl.includes('/players/')) {
      // We're on a player page
      console.log(`📄 Found player page: ${currentUrl}`);

      const playerData = await this.page.evaluate(() => {
        const data = {
          name: document.querySelector('h1[itemprop="name"]')?.textContent || '',
          position: document.querySelector('p strong:contains("Position")')?.parentElement?.textContent || '',
          college: document.querySelector('p:contains("College")').textContent || '',
          height: '',
          weight: '',
          born: '',
          stats: {}
        };

        // Extract player info from the info box
        const infoDiv = document.querySelector('#meta');
        if (infoDiv) {
          const text = infoDiv.textContent;
          const heightMatch = text.match(/(\d+-\d+)/);
          const weightMatch = text.match(/(\d+)lb/);
          const bornMatch = text.match(/Born:\s*(.+)/);

          if (heightMatch) data.height = heightMatch[1];
          if (weightMatch) data.weight = weightMatch[1];
          if (bornMatch) data.born = bornMatch[1];
        }

        return data;
      });

      console.log(`\n✅ Player Data:`);
      console.log(`   Name: ${playerData.name}`);
      console.log(`   Position: ${playerData.position}`);
      console.log(`   College: ${playerData.college}`);
      console.log(`   Height: ${playerData.height}`);
      console.log(`   Weight: ${playerData.weight}`);

      // Cache the data
      const cacheFile = path.join(CACHE_DIR, `player-${playerName.replace(/\s+/g, '-')}.json`);
      fs.writeFileSync(cacheFile, JSON.stringify({ ...playerData, scrapedAt: new Date().toISOString() }, null, 2));
      console.log(`\n💾 Cached to: ${cacheFile}`);

      return playerData;
    } else {
      console.log('❌ Player not found or multiple results');
      return null;
    }
  }

  /**
   * List cached data
   */
  static listCache() {
    if (!fs.existsSync(CACHE_DIR)) {
      console.log('📂 No cached data found');
      return;
    }

    const files = fs.readdirSync(CACHE_DIR);
    console.log(`\n📂 Cached Data (${files.length} files):\n`);

    files.forEach(file => {
      const filePath = path.join(CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      console.log(`   ${file}`);
      console.log(`   Last scraped: ${data.scrapedAt || stats.mtime}`);
      console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB\n`);
    });
  }

  /**
   * Clear cache
   */
  static clearCache() {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      });
      console.log(`✅ Cleared ${files.length} cached files`);
    }
  }
}

// CLI Interface
async function main() {
  const [,, command, ...args] = process.argv;

  if (command === 'list-cache') {
    NFLScraper.listCache();
    return;
  }

  if (command === 'clear-cache') {
    NFLScraper.clearCache();
    return;
  }

  const scraper = new NFLScraper();

  try {
    await scraper.init();

    switch (command) {
      case 'search':
        const [query] = args;
        if (!query) {
          console.error('Usage: node scraper.js search "query"');
          process.exit(1);
        }
        await scraper.search(query);
        break;

      case 'scrape-roster':
        const [rosterYear] = args;
        if (!rosterYear) {
          console.error('Usage: node scraper.js scrape-roster YEAR');
          process.exit(1);
        }
        await scraper.scrapeRoster(rosterYear);
        break;

      case 'scrape-draft':
        const [draftYear] = args;
        if (!draftYear) {
          console.error('Usage: node scraper.js scrape-draft YEAR');
          process.exit(1);
        }
        await scraper.scrapeDraft(draftYear);
        break;

      case 'scrape-player':
        const playerName = args.join(' ');
        if (!playerName) {
          console.error('Usage: node scraper.js scrape-player "Player Name"');
          process.exit(1);
        }
        await scraper.scrapePlayer(playerName);
        break;

      default:
        console.log(`
NFL Data Scraper Agent

Commands:
  search "query"              - Search for NFL information
  scrape-roster YEAR          - Scrape full roster data for a year
  scrape-draft YEAR           - Scrape draft class for a year
  scrape-player "Name"        - Scrape specific player data
  list-cache                  - List all cached data
  clear-cache                 - Clear all cached data

Examples:
  node scraper.js search "NFL 1994 season"
  node scraper.js scrape-roster 1994
  node scraper.js scrape-draft 1994
  node scraper.js scrape-player "Joe Montana"
  node scraper.js list-cache

Future Features:
  - AI-driven data extraction
  - Automatic roster file generation
  - Draft class file creation
  - Stats mapping to Madden attributes
  - Batch processing of multiple years
`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = NFLScraper;
