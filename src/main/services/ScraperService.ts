/**
 * Scraper Service
 *
 * Web scraping service for gathering player data from pro-football-reference.com
 * and other sports statistics websites.
 *
 * Uses Puppeteer for headless browser automation to extract:
 * - Player stats (rushing, passing, receiving, defense, etc.)
 * - Player info (name, position, college, height, weight, etc.)
 * - Draft class prospects
 * - Historical roster data
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface PlayerStats {
  // Basic Info
  name: string;
  position: string;
  team?: string;
  college?: string;
  height?: string;
  weight?: number;
  age?: number;

  // Passing Stats
  passAttempts?: number;
  passCompletions?: number;
  passYards?: number;
  passTDs?: number;
  interceptions?: number;

  // Rushing Stats
  rushAttempts?: number;
  rushYards?: number;
  rushTDs?: number;

  // Receiving Stats
  receptions?: number;
  recYards?: number;
  recTDs?: number;
  targets?: number;

  // Defensive Stats
  tackles?: number;
  sacks?: number;
  forcedFumbles?: number;
  interceptionsCaught?: number;
  passDefended?: number;
}

export interface DraftProspect {
  name: string;
  position: string;
  college: string;
  height?: string;
  weight?: number;
  age?: number;
  round?: number;
  pick?: number;
}

/**
 * Scraper Service Class
 */
export class ScraperService {
  private browser: Browser | null = null;

  /**
   * Initialize Puppeteer browser
   */
  async initBrowser(): Promise<void> {
    if (!this.browser) {
      console.log('[ScraperService] Launching Puppeteer browser...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('[ScraperService] Browser launched successfully');
    }
  }

  /**
   * Close browser when done
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      console.log('[ScraperService] Closing browser...');
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrape player stats from pro-football-reference.com
   * @param playerName - Player's name
   * @param year - Season year
   * @returns Player stats object
   */
  async scrapePlayerStats(playerName: string, year: number): Promise<PlayerStats | null> {
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping stats for ${playerName} (${year})`);

      // Search for player on pro-football-reference
      const searchUrl = `https://www.pro-football-reference.com/search/search.fcgi?search=${encodeURIComponent(playerName)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });

      // Extract player stats from the page
      const stats = await page.evaluate((year) => {
        const playerStats: any = {
          name: '',
          position: '',
          team: '',
          college: ''
        };

        // Get player name from page title
        const nameElement = document.querySelector('h1[itemprop="name"]');
        if (nameElement) {
          playerStats.name = nameElement.textContent?.trim() || '';
        }

        // Get player info from meta section
        const metaElements = document.querySelectorAll('#meta p');
        metaElements.forEach(p => {
          const text = p.textContent || '';

          // Extract position
          if (text.includes('Position:')) {
            const posMatch = text.match(/Position:\s*([A-Z]+)/);
            if (posMatch) playerStats.position = posMatch[1];
          }

          // Extract college
          if (text.includes('College:')) {
            const collegeLink = p.querySelector('a[href*="/schools/"]');
            if (collegeLink) playerStats.college = collegeLink.textContent?.trim() || '';
          }

          // Extract height/weight
          if (text.includes('lb')) {
            const heightMatch = text.match(/(\d+-\d+)/);
            const weightMatch = text.match(/(\d+)lb/);
            if (heightMatch) playerStats.height = heightMatch[1];
            if (weightMatch) playerStats.weight = parseInt(weightMatch[1]);
          }
        });

        // Find the stats table for the specified year
        const statsTable = document.querySelector('#stats');
        if (statsTable) {
          const rows = statsTable.querySelectorAll('tbody tr');

          for (const row of Array.from(rows)) {
            const yearCell = row.querySelector('th[data-stat="year_id"]');
            if (yearCell && yearCell.textContent?.trim() === year.toString()) {
              // Extract stats from this row
              const cells = row.querySelectorAll('td');
              cells.forEach(cell => {
                const stat = cell.getAttribute('data-stat');
                const value = cell.textContent?.trim();

                if (stat && value) {
                  // Passing stats
                  if (stat === 'pass_att') playerStats.passAttempts = parseInt(value);
                  if (stat === 'pass_cmp') playerStats.passCompletions = parseInt(value);
                  if (stat === 'pass_yds') playerStats.passYards = parseInt(value);
                  if (stat === 'pass_td') playerStats.passTDs = parseInt(value);
                  if (stat === 'pass_int') playerStats.interceptions = parseInt(value);

                  // Rushing stats
                  if (stat === 'rush_att') playerStats.rushAttempts = parseInt(value);
                  if (stat === 'rush_yds') playerStats.rushYards = parseInt(value);
                  if (stat === 'rush_td') playerStats.rushTDs = parseInt(value);

                  // Receiving stats
                  if (stat === 'targets') playerStats.targets = parseInt(value);
                  if (stat === 'rec') playerStats.receptions = parseInt(value);
                  if (stat === 'rec_yds') playerStats.recYards = parseInt(value);
                  if (stat === 'rec_td') playerStats.recTDs = parseInt(value);

                  // Defensive stats
                  if (stat === 'tackles_combined') playerStats.tackles = parseInt(value);
                  if (stat === 'sacks') playerStats.sacks = parseFloat(value);
                  if (stat === 'fumbles_forced') playerStats.forcedFumbles = parseInt(value);
                  if (stat === 'def_int') playerStats.interceptionsCaught = parseInt(value);
                  if (stat === 'pass_defended') playerStats.passDefended = parseInt(value);
                }
              });
              break;
            }
          }
        }

        return playerStats;
      }, year);

      console.log(`[ScraperService] Scraped stats for ${stats.name}`);

      await page.close();
      return stats as PlayerStats;

    } catch (error: any) {
      console.error('[ScraperService] Error scraping player stats:', error);
      await page.close();
      return null;
    }
  }

  /**
   * Scrape draft class prospects for a given year
   * @param year - Draft year
   * @returns Array of draft prospects
   */
  async scrapeDraftClass(year: number): Promise<DraftProspect[]> {
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping draft class for ${year}`);

      // Navigate to draft page
      const draftUrl = `https://www.pro-football-reference.com/years/${year}/draft.htm`;
      await page.goto(draftUrl, { waitUntil: 'networkidle2' });

      // Extract draft prospects
      const prospects = await page.evaluate(() => {
        const draftTable = document.querySelector('#drafts');
        const prospectList: any[] = [];

        if (draftTable) {
          const rows = draftTable.querySelectorAll('tbody tr');

          for (const row of Array.from(rows)) {
            const prospect: any = {};

            // Extract round and pick
            const roundCell = row.querySelector('th[data-stat="draft_round"]');
            const pickCell = row.querySelector('td[data-stat="draft_pick"]');

            if (roundCell) prospect.round = parseInt(roundCell.textContent?.trim() || '0');
            if (pickCell) prospect.pick = parseInt(pickCell.textContent?.trim() || '0');

            // Extract player info
            const nameCell = row.querySelector('td[data-stat="player"] a');
            const posCell = row.querySelector('td[data-stat="pos"]');
            const collegeCell = row.querySelector('td[data-stat="college_id"] a');

            if (nameCell) prospect.name = nameCell.textContent?.trim() || '';
            if (posCell) prospect.position = posCell.textContent?.trim() || '';
            if (collegeCell) prospect.college = collegeCell.textContent?.trim() || '';

            // Only add if we have at least a name
            if (prospect.name) {
              prospectList.push(prospect);
            }
          }
        }

        return prospectList;
      });

      console.log(`[ScraperService] Scraped ${prospects.length} prospects for ${year} draft`);

      await page.close();
      return prospects as DraftProspect[];

    } catch (error: any) {
      console.error('[ScraperService] Error scraping draft class:', error);
      await page.close();
      return [];
    }
  }

  /**
   * Scrape team roster for a given year
   * @param teamAbbr - Team abbreviation (e.g., 'dal', 'sea', 'ne')
   * @param year - Season year
   * @returns Array of player stats
   */
  async scrapeTeamRoster(teamAbbr: string, year: number): Promise<PlayerStats[]> {
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping roster for ${teamAbbr} (${year})`);

      // Navigate to team page
      const teamUrl = `https://www.pro-football-reference.com/teams/${teamAbbr}/${year}_roster.htm`;
      await page.goto(teamUrl, { waitUntil: 'networkidle2' });

      // Extract roster
      const roster = await page.evaluate(() => {
        const rosterTable = document.querySelector('#games_played_team');
        const playerList: any[] = [];

        if (rosterTable) {
          const rows = rosterTable.querySelectorAll('tbody tr');

          for (const row of Array.from(rows)) {
            const player: any = {};

            // Extract player info
            const nameCell = row.querySelector('th[data-stat="player"] a');
            const posCell = row.querySelector('td[data-stat="pos"]');
            const heightCell = row.querySelector('td[data-stat="height"]');
            const weightCell = row.querySelector('td[data-stat="weight"]');
            const ageCell = row.querySelector('td[data-stat="age"]');
            const collegeCell = row.querySelector('td[data-stat="college"] a');

            if (nameCell) player.name = nameCell.textContent?.trim() || '';
            if (posCell) player.position = posCell.textContent?.trim() || '';
            if (heightCell) player.height = heightCell.textContent?.trim() || '';
            if (weightCell) player.weight = parseInt(weightCell.textContent?.trim() || '0');
            if (ageCell) player.age = parseInt(ageCell.textContent?.trim() || '0');
            if (collegeCell) player.college = collegeCell.textContent?.trim() || '';

            // Only add if we have at least a name
            if (player.name) {
              playerList.push(player);
            }
          }
        }

        return playerList;
      });

      console.log(`[ScraperService] Scraped ${roster.length} players for ${teamAbbr}`);

      await page.close();
      return roster as PlayerStats[];

    } catch (error: any) {
      console.error('[ScraperService] Error scraping team roster:', error);
      await page.close();
      return [];
    }
  }
}

// Export singleton instance
export const scraperService = new ScraperService();
