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
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { scraperDebugLogger } from '../utils/DebugLogger';
import { findChrome } from '../utils/ChromeFinder';

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
  isHallOfFamer?: boolean; // Flag for future HOF players
  homeState?: string; // Two-letter state code (e.g., "CA", "TX")

  // NFL Career Stats (from draft table)
  careerGames?: number;
  careerStarts?: number;
  careerAV?: number; // Approximate Value

  // Passing
  passCompletions?: number;
  passAttempts?: number;
  passYards?: number;
  passTDs?: number;
  passInts?: number;

  // Rushing
  rushAttempts?: number;
  rushYards?: number;
  rushTDs?: number;

  // Receiving
  receptions?: number;
  recYards?: number;
  recTDs?: number;

  // Defense
  soloTackles?: number;
  defensiveInts?: number;
  sacks?: number;

  // Combine data (available 2000+)
  hasCombineData?: boolean;
}

/**
 * Scraper Service Class
 */
export class ScraperService {
  private browser: Browser | null = null;
  private hofLookup: Map<string, { year: number; height: string; weight: number; position: string; college: string; birthState: string }> | null = null;

  /**
   * Initialize Puppeteer browser
   */
  async initBrowser(): Promise<void> {
    if (!this.browser) {
      console.log('[ScraperService] Launching Puppeteer browser...');

      try {
        // Try to find system Chrome first (avoids 170MB Chromium download)
        const systemChrome = findChrome();

        const launchOptions: any = {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Overcome limited resource problems
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ]
        };

        // If system Chrome/Edge found, use it
        if (systemChrome) {
          console.log(`[ScraperService] Using system ${systemChrome.browser}: ${systemChrome.executablePath}`);
          launchOptions.executablePath = systemChrome.executablePath;
        } else {
          console.log('[ScraperService] System Chrome not found, falling back to bundled Chromium');
        }

        // If no system Chrome found, show helpful error message
        if (!systemChrome) {
          throw new Error(
            'Chrome/Edge not found. To use roster generation features, please either:\n\n' +
            '1. Install Google Chrome from https://www.google.com/chrome/ (RECOMMENDED), OR\n' +
            '2. Install Microsoft Edge (pre-installed on Windows 10+)\n\n' +
            'The application will automatically detect and use Chrome or Edge once installed.\n' +
            'This avoids downloading a separate 170MB Chromium browser.'
          );
        }

        this.browser = await puppeteer.launch(launchOptions);
        console.log('[ScraperService] Browser launched successfully');
      } catch (error: any) {
        console.error('[ScraperService] Failed to launch browser:', error);
        throw new Error(
          `Failed to launch browser: ${error.message}\n\n` +
          'If Chrome is not installed, please either:\n' +
          '1. Install Google Chrome, OR\n' +
          '2. Run "npx puppeteer browsers install chrome" in the app directory'
        );
      }
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
   * Check if a player is a Hall of Famer by checking their PFR page
   * @param playerName - Player's name
   * @returns True if player is in Hall of Fame
   */
  async isHallOfFamer(playerName: string): Promise<boolean> {
    await this.initBrowser();

    if (!this.browser) {
      return false;
    }

    const page = await this.browser.newPage();

    try {
      // Search for player on pro-football-reference
      const searchUrl = `https://www.pro-football-reference.com/search/search.fcgi?search=${encodeURIComponent(playerName)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 10000 });

      // Check for Hall of Fame indicator - MUST be specific to the player's meta section
      const isHOF = await page.evaluate(() => {
        // Look for HOF badge in player name header (gold football icon)
        const nameHeader = document.querySelector('h1[itemprop="name"]');
        if (nameHeader) {
          const hofIcon = nameHeader.querySelector('img[alt*="HOF"], img[alt*="Hall of Fame"]');
          if (hofIcon) return true;
        }

        // Check meta section ONLY (not entire page) for HOF induction text
        const metaDiv = document.querySelector('#meta');
        if (metaDiv) {
          const metaText = metaDiv.textContent || '';

          // Look for specific HOF induction line: "Pro Football Hall of Fame: Inducted as Player in YYYY"
          if (metaText.includes('Inducted as Player in') ||
              metaText.includes('Inducted as Coach in') ||
              metaText.includes('Hall of Fame (1') || // "Hall of Fame (2007)"
              /Hall of Fame:\s*\d{4}/.test(metaText)) { // "Hall of Fame: 2007"
            return true;
          }
        }

        // Look for HOF badge/shield in meta section
        const hofBadge = document.querySelector('#meta .hof, #meta img[alt*="HOF"], #info .hof');
        if (hofBadge) return true;

        return false;
      });

      await page.close();
      return isHOF;

    } catch (error) {
      console.warn(`[ScraperService] Could not check HOF status for ${playerName}:`, error);
      await page.close();
      return false;
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
   * Load HOF lookup data from CSV file (one-time load, cached)
   * CSV contains all Hall of Famers with draft year, height, weight, etc.
   */
  private loadHOFLookup(): void {
    if (this.hofLookup !== null) {
      return; // Already loaded
    }

    this.hofLookup = new Map();

    try {
      // Path to HOF lookup CSV
      const csvPath = path.join(__dirname, '../../data/lookups/hof_lookup.csv');

      if (!fs.existsSync(csvPath)) {
        console.warn(`[ScraperService] HOF lookup file not found at ${csvPath}`);
        return;
      }

      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.trim().split('\n');

      if (lines.length < 2) {
        console.warn('[ScraperService] HOF lookup CSV is empty');
        return;
      }

      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 6) continue;

        const year = parseInt(parts[0]);
        const playerName = parts[1].trim();
        const height = parts[2].trim();
        const weight = parseInt(parts[3]);
        const position = parts[4].trim();
        const college = parts[5].trim();
        const birthState = parts[6]?.trim() || '';

        if (playerName && !isNaN(year)) {
          this.hofLookup.set(playerName, {
            year,
            height,
            weight,
            position,
            college,
            birthState
          });
        }
      }

      console.log(`[ScraperService] Loaded ${this.hofLookup.size} Hall of Famers from lookup CSV`);

    } catch (error) {
      console.error('[ScraperService] Error loading HOF lookup CSV:', error);
      this.hofLookup = new Map(); // Empty map on error
    }
  }

  /**
   * Get Hall of Fame status from pre-loaded CSV lookup
   * Much faster and more reliable than scraping Wikipedia
   * @param year - Draft year
   * @returns Map of player name -> isHOF boolean
   */
  async scrapeHOFFromWikipedia(year: number): Promise<Map<string, boolean>> {
    const hofMap = new Map<string, boolean>();

    // Load HOF lookup if not already loaded
    this.loadHOFLookup();

    if (!this.hofLookup) {
      console.warn('[ScraperService] HOF lookup data not available');
      return hofMap;
    }

    // Find all HOFers from this draft year
    let count = 0;
    for (const [playerName, data] of this.hofLookup.entries()) {
      if (data.year === year) {
        hofMap.set(playerName, true);
        count++;
      }
    }

    console.log(`[ScraperService] Found ${count} HOF players from ${year} draft in lookup CSV`);
    return hofMap;
  }

  /**
   * Enrich prospect data with HOF biographical info (height, weight, homeState)
   * If the player is a Hall of Famer, add their bio data from the lookup CSV
   * This eliminates the need to scrape bio data for HOFers
   * @param prospect - Draft prospect to enrich
   */
  enrichProspectWithHOFData(prospect: DraftProspect): void {
    // Load HOF lookup if not already loaded
    this.loadHOFLookup();

    if (!this.hofLookup) {
      return;
    }

    // Check if this player is a HOFer
    const hofData = this.hofLookup.get(prospect.name);

    if (hofData) {
      // Enrich with HOF data if not already present (or override with correct college data)
      if (!prospect.height) prospect.height = hofData.height;
      if (!prospect.weight) prospect.weight = hofData.weight;
      if (!prospect.homeState) prospect.homeState = hofData.birthState;

      // ALWAYS override college for HOF players to avoid transfer school issues
      // (e.g., Deion Sanders should show Florida State, not West Florida)
      if (hofData.college) {
        prospect.college = hofData.college;
      }

      console.log(`[ScraperService] Enriched HOFer ${prospect.name} with bio data from lookup: ${hofData.height}, ${hofData.weight}lb, ${hofData.birthState}, ${hofData.college}`);
    }
  }

  /**
   * Scrape draft class prospects for a given year using CSV export
   * Much faster than HTML scraping - uses Pro-Football-Reference's CSV export
   * @param year - Draft year
   * @returns Array of draft prospects
   */
  async scrapeDraftClassCSV(year: number): Promise<DraftProspect[]> {
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Fetching draft class CSV for ${year}`);

      // Navigate to draft page
      const draftUrl = `https://www.pro-football-reference.com/years/${year}/draft.htm`;
      await page.goto(draftUrl, { waitUntil: 'networkidle2' });

      // Try to get CSV data by finding button with text "Share & Export"
      const csvText = await page.evaluate(() => {
        return new Promise<string>((resolve) => {
          // Find the "Share & Export" button by looking for elements containing that text
          const allButtons = Array.from(document.querySelectorAll('button, span.hasmore, .section_heading span'));
          const shareButton = allButtons.find(btn =>
            btn.textContent?.includes('Share') && btn.textContent?.includes('Export')
          );

          if (!shareButton) {
            console.log('[ScraperService] Share & Export button not found');
            resolve('');
            return;
          }

          console.log('[ScraperService] Found Share & Export button, clicking...');
          (shareButton as HTMLElement).click();

          setTimeout(() => {
            // Find the "Get table as CSV" link by text content
            const allLinks = Array.from(document.querySelectorAll('li, a, button, div'));
            const csvLink = allLinks.find(link =>
              link.textContent?.toLowerCase().includes('csv') &&
              link.textContent?.toLowerCase().includes('excel')
            );

            if (!csvLink) {
              console.log('[ScraperService] CSV link not found in dropdown');
              resolve('');
              return;
            }

            console.log('[ScraperService] Found CSV link, clicking...');
            (csvLink as HTMLElement).click();

            setTimeout(() => {
              // The CSV should appear in a modal or pre element
              // Look for any pre element with CSV data (starts with "Rnd,Pick,Tm,")
              const allPres = Array.from(document.querySelectorAll('pre, .csv_output, [id*="csv"]'));

              for (const elem of allPres) {
                const text = elem.textContent || '';
                if (text.includes('Rnd,') || text.includes('Round,') || text.includes('Pick,')) {
                  console.log('[ScraperService] Found CSV content!');
                  resolve(text);
                  return;
                }
              }

              // Also check for any newly visible modal/overlay content
              const modal = document.querySelector('.modal-content, .overlay-content, [role="dialog"]');
              if (modal?.textContent) {
                const text = modal.textContent;
                if (text.includes('Rnd,') || text.includes('Round,')) {
                  console.log('[ScraperService] Found CSV in modal!');
                  resolve(text);
                  return;
                }
              }

              console.log('[ScraperService] CSV content not found');
              resolve('');
            }, 1000);
          }, 600);
        });
      });

      if (!csvText) {
        console.warn(`[ScraperService] Could not get CSV for ${year}, falling back to HTML scraping`);
        await page.close();
        return this.scrapeDraftClass(year);
      }

      // Parse CSV into prospects
      const prospects = this.parseCSVDraftData(csvText, year);

      console.log(`[ScraperService] Parsed ${prospects.length} prospects from CSV for ${year} draft`);

      await page.close();
      return prospects;

    } catch (error: any) {
      console.error('[ScraperService] Error fetching CSV:', error);
      await page.close();
      // Fallback to HTML scraping
      return this.scrapeDraftClass(year);
    }
  }

  /**
   * Parse CSV draft data into DraftProspect objects
   * @param csvText - Raw CSV text from Pro-Football-Reference
   * @param year - Draft year
   * @returns Array of draft prospects
   */
  private parseCSVDraftData(csvText: string, year: number): DraftProspect[] {
    const prospects: DraftProspect[] = [];
    const lines = csvText.trim().split('\n');

    if (lines.length < 2) {
      return prospects;
    }

    // First line is headers
    const headers = lines[0].split(',');

    // Find column indices - basic info
    const roundIdx = headers.findIndex(h => h.toLowerCase().includes('round') || h.toLowerCase() === 'rnd');
    const pickIdx = headers.findIndex(h => h.toLowerCase().includes('pick'));
    const playerIdx = headers.findIndex(h => h.toLowerCase().includes('player'));
    const posIdx = headers.findIndex(h => h.toLowerCase().includes('pos'));
    const collegeIdx = headers.findIndex(h => h.toLowerCase().includes('college'));
    const ageIdx = headers.findIndex(h => h.toLowerCase().includes('age'));

    // Find career stats column indices
    const gamesIdx = headers.findIndex(h => h.toLowerCase() === 'g' || h.toLowerCase() === 'games');
    const startsIdx = headers.findIndex(h => h.toLowerCase() === 'gs' || h.toLowerCase() === 'starts');
    const avIdx = headers.findIndex(h => h.toLowerCase() === 'av');

    // Passing stats
    const passCmpIdx = headers.findIndex(h => h.toLowerCase() === 'cmp' || h.toLowerCase().includes('pass_cmp'));
    const passAttIdx = headers.findIndex(h => h.toLowerCase() === 'att' || h.toLowerCase().includes('pass_att'));
    const passYdsIdx = headers.findIndex(h => h.toLowerCase() === 'yds' || h.toLowerCase().includes('pass_yds'));
    const passTDIdx = headers.findIndex(h => h.toLowerCase() === 'td' && !h.toLowerCase().includes('rush') && !h.toLowerCase().includes('rec'));
    const passIntIdx = headers.findIndex(h => h.toLowerCase() === 'int');

    // Rushing stats
    const rushAttIdx = headers.findIndex(h => h.toLowerCase().includes('rush_att') || h.toLowerCase() === 'ratt');
    const rushYdsIdx = headers.findIndex(h => h.toLowerCase().includes('rush_yds') || h.toLowerCase() === 'ryds');
    const rushTDIdx = headers.findIndex(h => h.toLowerCase().includes('rush_td') || h.toLowerCase() === 'rtd');

    // Receiving stats
    const recIdx = headers.findIndex(h => h.toLowerCase() === 'rec');
    const recYdsIdx = headers.findIndex(h => h.toLowerCase().includes('rec_yds'));
    const recTDIdx = headers.findIndex(h => h.toLowerCase().includes('rec_td'));

    // Defensive stats
    const tacklesIdx = headers.findIndex(h => h.toLowerCase().includes('tackles') || h.toLowerCase() === 'tkl');
    const defIntIdx = headers.findIndex(h => h.toLowerCase().includes('def_int'));
    const sacksIdx = headers.findIndex(h => h.toLowerCase() === 'sk' || h.toLowerCase() === 'sacks');

    console.log(`[ScraperService] CSV Headers: ${headers.join(', ')}`);
    console.log(`[ScraperService] Found ${lines.length - 1} rows to parse`);

    // Parse each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = this.parseCSVLine(line);

      const prospect: DraftProspect = {
        name: cells[playerIdx]?.trim() || '',
        position: cells[posIdx]?.trim() || '',
        college: cells[collegeIdx]?.trim() || '',
        round: parseInt(cells[roundIdx]) || 0,
        pick: parseInt(cells[pickIdx]) || 0,
        age: parseInt(cells[ageIdx]) || undefined,

        // Career stats
        careerGames: gamesIdx !== -1 ? parseInt(cells[gamesIdx]) || 0 : undefined,
        careerStarts: startsIdx !== -1 ? parseInt(cells[startsIdx]) || 0 : undefined,
        careerAV: avIdx !== -1 ? parseInt(cells[avIdx]) || 0 : undefined,

        // Passing
        passCompletions: passCmpIdx !== -1 ? parseInt(cells[passCmpIdx]) || undefined : undefined,
        passAttempts: passAttIdx !== -1 ? parseInt(cells[passAttIdx]) || undefined : undefined,
        passYards: passYdsIdx !== -1 ? parseInt(cells[passYdsIdx]) || undefined : undefined,
        passTDs: passTDIdx !== -1 ? parseInt(cells[passTDIdx]) || undefined : undefined,
        passInts: passIntIdx !== -1 ? parseInt(cells[passIntIdx]) || undefined : undefined,

        // Rushing
        rushAttempts: rushAttIdx !== -1 ? parseInt(cells[rushAttIdx]) || undefined : undefined,
        rushYards: rushYdsIdx !== -1 ? parseInt(cells[rushYdsIdx]) || undefined : undefined,
        rushTDs: rushTDIdx !== -1 ? parseInt(cells[rushTDIdx]) || undefined : undefined,

        // Receiving
        receptions: recIdx !== -1 ? parseInt(cells[recIdx]) || undefined : undefined,
        recYards: recYdsIdx !== -1 ? parseInt(cells[recYdsIdx]) || undefined : undefined,
        recTDs: recTDIdx !== -1 ? parseInt(cells[recTDIdx]) || undefined : undefined,

        // Defense
        soloTackles: tacklesIdx !== -1 ? parseInt(cells[tacklesIdx]) || undefined : undefined,
        defensiveInts: defIntIdx !== -1 ? parseInt(cells[defIntIdx]) || undefined : undefined,
        sacks: sacksIdx !== -1 ? parseFloat(cells[sacksIdx]) || undefined : undefined
      };

      // Only add if we have at least a name
      if (prospect.name) {
        prospects.push(prospect);
      }
    }

    console.log(`[ScraperService] Parsed ${prospects.length} prospects from CSV`);
    return prospects;
  }

  /**
   * Parse a CSV line handling quoted fields
   * @param line - CSV line
   * @returns Array of cell values
   */
  private parseCSVLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    cells.push(current);
    return cells;
  }

  /**
   * Scrape draft class prospects for a given year (HTML scraping fallback)
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
      console.log(`[ScraperService] Scraping draft class for ${year} (HTML fallback)`);

      // Navigate to draft page
      const draftUrl = `https://www.pro-football-reference.com/years/${year}/draft.htm`;
      await page.goto(draftUrl, { waitUntil: 'networkidle2' });

      // Extract draft prospects WITH career stats
      const prospects = await page.evaluate(() => {
        const draftTable = document.querySelector('#drafts');
        const prospectList: any[] = [];

        if (draftTable) {
          const rows = draftTable.querySelectorAll('tbody tr');

          for (const row of Array.from(rows)) {
            // Skip header rows
            if (row.classList.contains('thead')) continue;

            const prospect: any = {};

            // Extract round and pick
            const roundCell = row.querySelector('th[data-stat="draft_round"]');
            const pickCell = row.querySelector('td[data-stat="draft_pick"]');

            if (roundCell) prospect.round = parseInt(roundCell.textContent?.trim() || '0');
            if (pickCell) prospect.pick = parseInt(pickCell.textContent?.trim() || '0');

            // Extract player info
            // Player name: Try link first (for NFL players), then fallback to cell text (for players who never played)
            const nameCell = row.querySelector('td[data-stat="player"]');
            const nameLink = nameCell?.querySelector('a');
            const posCell = row.querySelector('td[data-stat="pos"]');
            const collegeCell = row.querySelector('td[data-stat="college_id"]');
            const collegeLink = collegeCell?.querySelector('a');
            const ageCell = row.querySelector('td[data-stat="age"]');

            // Get name from link if available, otherwise from cell text
            if (nameCell) {
              prospect.name = (nameLink?.textContent || nameCell.textContent)?.trim() || '';
            }
            if (posCell) prospect.position = posCell.textContent?.trim() || '';
            // Get college from link if available, otherwise from cell text
            if (collegeCell) {
              prospect.college = (collegeLink?.textContent || collegeCell.textContent)?.trim() || '';
            }
            if (ageCell) {
              const ageText = ageCell.textContent?.trim();
              if (ageText) prospect.age = parseInt(ageText);
            }

            // Extract NFL career stats (the whole point of this!)
            // General stats
            const gamesCell = row.querySelector('td[data-stat="g"]');
            const startsCell = row.querySelector('td[data-stat="gs"]');
            const avCell = row.querySelector('td[data-stat="av"]');

            if (gamesCell) prospect.careerGames = parseInt(gamesCell.textContent?.trim() || '0');
            if (startsCell) prospect.careerStarts = parseInt(startsCell.textContent?.trim() || '0');
            if (avCell) prospect.careerAV = parseInt(avCell.textContent?.trim() || '0');

            // Passing stats
            const passCmpCell = row.querySelector('td[data-stat="pass_cmp"]');
            const passAttCell = row.querySelector('td[data-stat="pass_att"]');
            const passYdsCell = row.querySelector('td[data-stat="pass_yds"]');
            const passTDCell = row.querySelector('td[data-stat="pass_td"]');
            const passIntCell = row.querySelector('td[data-stat="pass_int"]');

            if (passCmpCell) prospect.passCompletions = parseInt(passCmpCell.textContent?.trim() || '0');
            if (passAttCell) prospect.passAttempts = parseInt(passAttCell.textContent?.trim() || '0');
            if (passYdsCell) prospect.passYards = parseInt(passYdsCell.textContent?.trim() || '0');
            if (passTDCell) prospect.passTDs = parseInt(passTDCell.textContent?.trim() || '0');
            if (passIntCell) prospect.passInts = parseInt(passIntCell.textContent?.trim() || '0');

            // Rushing stats
            const rushAttCell = row.querySelector('td[data-stat="rush_att"]');
            const rushYdsCell = row.querySelector('td[data-stat="rush_yds"]');
            const rushTDCell = row.querySelector('td[data-stat="rush_td"]');

            if (rushAttCell) prospect.rushAttempts = parseInt(rushAttCell.textContent?.trim() || '0');
            if (rushYdsCell) prospect.rushYards = parseInt(rushYdsCell.textContent?.trim() || '0');
            if (rushTDCell) prospect.rushTDs = parseInt(rushTDCell.textContent?.trim() || '0');

            // Receiving stats
            const recCell = row.querySelector('td[data-stat="rec"]');
            const recYdsCell = row.querySelector('td[data-stat="rec_yds"]');
            const recTDCell = row.querySelector('td[data-stat="rec_td"]');

            if (recCell) prospect.receptions = parseInt(recCell.textContent?.trim() || '0');
            if (recYdsCell) prospect.recYards = parseInt(recYdsCell.textContent?.trim() || '0');
            if (recTDCell) prospect.recTDs = parseInt(recTDCell.textContent?.trim() || '0');

            // Defensive stats
            const tacklesCell = row.querySelector('td[data-stat="tackles_solo"]');
            const defIntCell = row.querySelector('td[data-stat="def_int"]');
            const sacksCell = row.querySelector('td[data-stat="sacks"]');

            if (tacklesCell) prospect.soloTackles = parseInt(tacklesCell.textContent?.trim() || '0');
            if (defIntCell) prospect.defensiveInts = parseInt(defIntCell.textContent?.trim() || '0');
            if (sacksCell) prospect.sacks = parseFloat(sacksCell.textContent?.trim() || '0');

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
   * Scrape NFL Combine data for a given year (2000+)
   * Gets ACTUAL height/weight measurements from combine
   * @param year - Draft year (2000 or later)
   * @returns Map of player name -> {height, weight}
   */
  async scrapeCombineData(year: number): Promise<Map<string, { height: string; weight: number }>> {
    const combineData = new Map<string, { height: string; weight: number }>();

    if (year < 2000) {
      console.log(`[ScraperService] Combine data not available before 2000`);
      return combineData;
    }

    await this.initBrowser();

    if (!this.browser) {
      return combineData;
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping combine data for ${year}`);

      const combineUrl = `https://www.pro-football-reference.com/draft/${year}-combine.htm`;
      await page.goto(combineUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      const data = await page.evaluate(() => {
        const combineTable = document.querySelector('#combine');
        const dataMap: { [key: string]: { height: string; weight: number } } = {};

        if (combineTable) {
          const rows = combineTable.querySelectorAll('tbody tr');

          for (const row of Array.from(rows)) {
            const nameCell = row.querySelector('td[data-stat="player"] a');
            const heightCell = row.querySelector('td[data-stat="height"]');
            const weightCell = row.querySelector('td[data-stat="weight"]');

            if (nameCell && heightCell && weightCell) {
              const name = nameCell.textContent?.trim() || '';
              const height = heightCell.textContent?.trim() || '';
              const weightStr = weightCell.textContent?.trim() || '0';
              const weight = parseInt(weightStr);

              if (name && height && !isNaN(weight) && weight > 0) {
                dataMap[name] = { height, weight };
              }
            }
          }
        }

        return dataMap;
      });

      // Convert to Map
      for (const [name, measurements] of Object.entries(data)) {
        combineData.set(name, measurements);
      }

      console.log(`[ScraperService] Scraped combine data for ${combineData.size} players`);

      await page.close();
      return combineData;

    } catch (error: any) {
      console.warn(`[ScraperService] Error scraping combine data for ${year}:`, error);
      await page.close();
      return combineData;
    }
  }

  /**
   * Scrape player biographical data from pro-football-reference.com
   * Gets hometown (state), height, and weight from player's individual page
   * @param playerName - Player's full name
   * @returns Object with homeState, height, weight (or null if not found)
   */
  async scrapePlayerBio(playerName: string): Promise<{ homeState?: string; height?: string; weight?: number } | null> {
    await this.initBrowser();

    if (!this.browser) {
      return null;
    }

    const page = await this.browser.newPage();

    try {
      // Search for player
      const searchUrl = `https://www.pro-football-reference.com/search/search.fcgi?search=${encodeURIComponent(playerName)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 10000 });

      // Extract bio data from meta section
      const bioData = await page.evaluate(() => {
        const data: { homeState?: string; height?: string; weight?: number } = {};

        // Get bio info from meta section
        const metaElements = document.querySelectorAll('#meta p');
        metaElements.forEach(p => {
          const text = p.textContent || '';

          // Extract hometown/state - format: "Born: Month DD, YYYY in City, State"
          if (text.includes('Born:')) {
            // Look for state abbreviation after "in"
            const bornMatch = text.match(/Born:.*in\s+[^,]+,\s+([A-Z]{2})/i);
            if (bornMatch) {
              data.homeState = bornMatch[1].toUpperCase();
            }
          }

          // Extract height/weight - format: "6-2, 215lb"
          if (text.includes('lb')) {
            const heightMatch = text.match(/(\d+-\d+)/);
            const weightMatch = text.match(/(\d+)lb/);
            if (heightMatch) data.height = heightMatch[1];
            if (weightMatch) data.weight = parseInt(weightMatch[1]);
          }
        });

        return data;
      });

      await page.close();
      return bioData;

    } catch (error) {
      console.warn(`[ScraperService] Could not scrape bio for ${playerName}:`, error);
      await page.close();
      return null;
    }
  }

  /**
   * Scrape undrafted free agents for a given year from Wikipedia
   * Wikipedia has "Notable undrafted players" sections with good data
   * @param year - Draft year
   * @returns Array of UDFA prospects
   */
  async scrapeUndraftedFreeAgents(year: number): Promise<DraftProspect[]> {
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping UDFAs from Wikipedia for ${year}`);

      // Navigate to Wikipedia draft page
      const wikiUrl = `https://en.wikipedia.org/wiki/${year}_NFL_draft`;
      await page.goto(wikiUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Extract notable undrafted players
      const udfas = await page.evaluate(() => {
        const udfaList: any[] = [];

        // Find the "Notable undrafted players" heading
        const headings = Array.from(document.querySelectorAll('h2, h3'));
        const udfaHeading = headings.find(h =>
          h.textContent?.toLowerCase().includes('undrafted') ||
          h.textContent?.toLowerCase().includes('notable')
        );

        if (!udfaHeading) {
          console.log('[ScraperService] No undrafted section found');
          return udfaList;
        }

        // Get the content after this heading (either a table or list)
        let currentElement = udfaHeading.nextElementSibling;

        while (currentElement && !currentElement.matches('h2, h3')) {
          // Check if it's a table
          if (currentElement.tagName === 'TABLE') {
            const rows = currentElement.querySelectorAll('tbody tr');

            for (const row of Array.from(rows)) {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 3) {
                // Typical format: Name, Position, College
                const prospect: any = {
                  name: cells[0]?.textContent?.trim() || '',
                  position: cells[1]?.textContent?.trim() || '',
                  college: cells[2]?.textContent?.trim() || '',
                  round: 0,
                  pick: 0
                };

                if (prospect.name) {
                  udfaList.push(prospect);
                }
              }
            }
          }

          // Check if it's a list
          if (currentElement.tagName === 'UL') {
            const items = currentElement.querySelectorAll('li');

            for (const item of Array.from(items)) {
              const text = item.textContent || '';
              // Parse format like "John Doe, QB, USC" or "John Doe (QB) USC"
              const nameMatch = text.match(/^([^,(]+)/);
              const posMatch = text.match(/\(([A-Z]+)\)|,\s*([A-Z]+)/);
              const collegeMatch = text.match(/,\s*([^,]+)$/);

              if (nameMatch) {
                const prospect: any = {
                  name: nameMatch[1].trim(),
                  position: posMatch ? (posMatch[1] || posMatch[2] || '').trim() : '',
                  college: collegeMatch ? collegeMatch[1].trim() : '',
                  round: 0,
                  pick: 0
                };

                if (prospect.name) {
                  udfaList.push(prospect);
                }
              }
            }
          }

          currentElement = currentElement.nextElementSibling;
        }

        return udfaList;
      });

      console.log(`[ScraperService] Scraped ${udfas.length} notable UDFAs from Wikipedia`);

      await page.close();
      return udfas as DraftProspect[];

    } catch (error: any) {
      console.warn(`[ScraperService] Error scraping Wikipedia UDFAs for ${year}:`, error);
      await page.close();
      return [];
    }
  }

  /**
   * Scrape top college players for a given year (to fill out UDFA pool)
   * Gets players with best college stats who may not have entered NFL
   * @param year - College season year (draft year - 1)
   * @param limit - Max number of players to return
   * @returns Array of college prospects
   */
  async scrapeTopCollegePlayers(year: number, limit: number = 100): Promise<DraftProspect[]> {
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();
    const prospects: DraftProspect[] = [];

    try {
      console.log(`[ScraperService] Scraping top college players for ${year}`);

      // Scrape from multiple stat leader pages
      const statPages = [
        { url: `https://www.sports-reference.com/cfb/years/${year}-passing.html`, positions: ['QB'] },
        { url: `https://www.sports-reference.com/cfb/years/${year}-rushing.html`, positions: ['RB', 'HB'] },
        { url: `https://www.sports-reference.com/cfb/years/${year}-receiving.html`, positions: ['WR', 'TE'] }
      ];

      for (const statPage of statPages) {
        if (prospects.length >= limit) break;

        try {
          await page.goto(statPage.url, { waitUntil: 'networkidle2', timeout: 10000 });

          const pagePlayers = await page.evaluate((positions) => {
            const table = document.querySelector('#players');
            const playerList: any[] = [];

            if (table) {
              const rows = table.querySelectorAll('tbody tr');

              for (const row of Array.from(rows).slice(0, 50)) { // Top 50 per category
                const nameCell = row.querySelector('td[data-stat="player"] a');
                const schoolCell = row.querySelector('td[data-stat="school_name"] a');

                if (nameCell && schoolCell) {
                  playerList.push({
                    name: nameCell.textContent?.trim() || '',
                    college: schoolCell.textContent?.trim() || '',
                    position: positions[Math.floor(Math.random() * positions.length)], // Assign primary position
                    round: 0,
                    pick: 0
                  });
                }
              }
            }

            return playerList;
          }, statPage.positions);

          prospects.push(...pagePlayers);
        } catch (err) {
          console.warn(`[ScraperService] Failed to scrape ${statPage.url}:`, err);
        }
      }

      console.log(`[ScraperService] Scraped ${prospects.length} college players`);

      await page.close();
      return prospects.slice(0, limit);

    } catch (error: any) {
      console.error('[ScraperService] Error scraping college players:', error);
      await page.close();
      return prospects;
    }
  }

  /**
   * Scrape team statistics for a given year - gets player stats from team stats page
   * Scrapes Passing, Rushing & Receiving, and Defense & Fumbles tables
   * @param teamAbbr - Team abbreviation (e.g., 'dal', 'sea', 'nwe')
   * @param year - Season year
   * @returns Map of player name -> stats object
   */
  async scrapeTeamStats(teamAbbr: string, year: number): Promise<Map<string, PlayerStats>> {
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();
    const statsMap = new Map<string, PlayerStats>();

    try {
      scraperDebugLogger.logTeamHeader(teamAbbr, year);
      console.log(`[ScraperService] Scraping team stats for ${teamAbbr} (${year})`);

      // Navigate to team stats page (NOT roster page)
      const teamUrl = `https://www.pro-football-reference.com/teams/${teamAbbr}/${year}.htm`;
      scraperDebugLogger.log(`Team Stats URL: ${teamUrl}`);
      await page.goto(teamUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Pro-Football-Reference hides tables in HTML comments!
      // We need to get the page content and uncomment the tables
      const pageContent = await page.content();

      // Uncomment all HTML comments (<!-- ... -->)
      const uncommentedHTML = pageContent.replace(/<!--/g, '').replace(/-->/g, '');

      // Set the page content to the uncommented HTML
      await page.setContent(uncommentedHTML, { waitUntil: 'domcontentloaded' });

      // Extract stats from all three tables
      const scrapedStats = await page.evaluate(() => {
        const playerStatsMap: { [name: string]: any } = {};
        const debugInfo: any = {
          passingTableFound: false,
          rushingTableFound: false,
          defenseTableFound: false,
          allTableIds: [] as string[],
          allTableClasses: [] as string[]
        };

        // DEBUG: Log ALL table IDs and classes on the page
        const allTables = document.querySelectorAll('table');
        for (const table of Array.from(allTables)) {
          if (table.id) debugInfo.allTableIds.push(table.id);
          if (table.className) debugInfo.allTableClasses.push(table.className);
        }

        // Helper function to get numeric value from cell
        const getNumericValue = (cell: Element | null): number | undefined => {
          if (!cell) return undefined;
          const text = cell.textContent?.trim() || '';
          if (text === '' || text === '-') return undefined;
          const value = parseFloat(text);
          return isNaN(value) ? undefined : value;
        };

        // 1. Scrape Passing Table (#passing)
        const passingTable = document.querySelector('#passing');
        debugInfo.passingTableFound = !!passingTable;
        if (passingTable) {
          const rows = passingTable.querySelectorAll('tbody tr');

          for (const row of Array.from(rows)) {
            // Skip header rows
            if (row.classList.contains('thead')) continue;

            // Try multiple selectors for historical data compatibility
            const nameCell = row.querySelector('th[data-stat="player"] a') ||
                            row.querySelector('td[data-stat="player"] a') ||
                            row.querySelector('th a') ||
                            row.querySelector('td a');
            if (!nameCell) continue;

            const playerName = nameCell.textContent?.trim() || '';
            if (!playerName) continue;

            // Initialize player if not exists
            if (!playerStatsMap[playerName]) {
              playerStatsMap[playerName] = { name: playerName };
            }

            // Extract passing stats
            playerStatsMap[playerName].passCompletions = getNumericValue(row.querySelector('td[data-stat="pass_cmp"]'));
            playerStatsMap[playerName].passAttempts = getNumericValue(row.querySelector('td[data-stat="pass_att"]'));
            playerStatsMap[playerName].passYards = getNumericValue(row.querySelector('td[data-stat="pass_yds"]'));
            playerStatsMap[playerName].passTDs = getNumericValue(row.querySelector('td[data-stat="pass_td"]'));
            playerStatsMap[playerName].interceptions = getNumericValue(row.querySelector('td[data-stat="pass_int"]'));
          }
        }

        // 2. Scrape Rushing & Receiving Table (#rushing_and_receiving)
        const rushingReceivingTable = document.querySelector('#rushing_and_receiving');
        debugInfo.rushingTableFound = !!rushingReceivingTable;
        if (rushingReceivingTable) {
          const rows = rushingReceivingTable.querySelectorAll('tbody tr');

          for (const row of Array.from(rows)) {
            // Skip header rows
            if (row.classList.contains('thead')) continue;

            // Try multiple selectors for historical data compatibility
            const nameCell = row.querySelector('th[data-stat="player"] a') ||
                            row.querySelector('td[data-stat="player"] a') ||
                            row.querySelector('th a') ||
                            row.querySelector('td a');
            if (!nameCell) continue;

            const playerName = nameCell.textContent?.trim() || '';
            if (!playerName) continue;

            // Initialize player if not exists
            if (!playerStatsMap[playerName]) {
              playerStatsMap[playerName] = { name: playerName };
            }

            // Extract rushing stats
            playerStatsMap[playerName].rushAttempts = getNumericValue(row.querySelector('td[data-stat="rush_att"]'));
            playerStatsMap[playerName].rushYards = getNumericValue(row.querySelector('td[data-stat="rush_yds"]'));
            playerStatsMap[playerName].rushTDs = getNumericValue(row.querySelector('td[data-stat="rush_td"]'));

            // Extract receiving stats
            playerStatsMap[playerName].receptions = getNumericValue(row.querySelector('td[data-stat="rec"]'));
            playerStatsMap[playerName].recYards = getNumericValue(row.querySelector('td[data-stat="rec_yds"]'));
            playerStatsMap[playerName].recTDs = getNumericValue(row.querySelector('td[data-stat="rec_td"]'));
            playerStatsMap[playerName].targets = getNumericValue(row.querySelector('td[data-stat="targets"]'));
          }
        }

        // 3. Scrape Defense & Fumbles Table (#defense)
        const defenseTable = document.querySelector('#defense');
        debugInfo.defenseTableFound = !!defenseTable;
        if (defenseTable) {
          const rows = defenseTable.querySelectorAll('tbody tr');

          for (const row of Array.from(rows)) {
            // Skip header rows
            if (row.classList.contains('thead')) continue;

            // Try multiple selectors for historical data compatibility
            const nameCell = row.querySelector('th[data-stat="player"] a') ||
                            row.querySelector('td[data-stat="player"] a') ||
                            row.querySelector('th a') ||
                            row.querySelector('td a');
            if (!nameCell) continue;

            const playerName = nameCell.textContent?.trim() || '';
            if (!playerName) continue;

            // Initialize player if not exists
            if (!playerStatsMap[playerName]) {
              playerStatsMap[playerName] = { name: playerName };
            }

            // Extract defensive stats
            playerStatsMap[playerName].tackles = getNumericValue(row.querySelector('td[data-stat="tackles_combined"]'));
            playerStatsMap[playerName].sacks = getNumericValue(row.querySelector('td[data-stat="sacks"]'));
            playerStatsMap[playerName].forcedFumbles = getNumericValue(row.querySelector('td[data-stat="fumbles_forced"]'));
            playerStatsMap[playerName].interceptionsCaught = getNumericValue(row.querySelector('td[data-stat="def_int"]'));
            playerStatsMap[playerName].passDefended = getNumericValue(row.querySelector('td[data-stat="pass_defended"]'));
          }
        }

        return { playerStatsMap, debugInfo };
      });

      // Log debug info
      console.log(`[ScraperService] Stats table debug for ${teamAbbr} (${year}):`);
      console.log(`  - Passing table found: ${scrapedStats.debugInfo.passingTableFound}`);
      console.log(`  - Rushing table found: ${scrapedStats.debugInfo.rushingTableFound}`);
      console.log(`  - Defense table found: ${scrapedStats.debugInfo.defenseTableFound}`);
      console.log(`  - All table IDs on page: ${scrapedStats.debugInfo.allTableIds.join(', ') || 'NONE'}`);
      console.log(`  - All table classes on page: ${scrapedStats.debugInfo.allTableClasses.join(', ') || 'NONE'}`);

      scraperDebugLogger.log(`\nTable Debug Info:`);
      scraperDebugLogger.log(`  Passing table found: ${scrapedStats.debugInfo.passingTableFound}`);
      scraperDebugLogger.log(`  Rushing table found: ${scrapedStats.debugInfo.rushingTableFound}`);
      scraperDebugLogger.log(`  Defense table found: ${scrapedStats.debugInfo.defenseTableFound}`);
      scraperDebugLogger.log(`  Table IDs on page: ${scrapedStats.debugInfo.allTableIds.join(', ') || 'NONE'}`);

      // Convert to Map
      for (const [name, stats] of Object.entries(scrapedStats.playerStatsMap)) {
        statsMap.set(name, stats as PlayerStats);
      }

      console.log(`[ScraperService] Scraped stats for ${statsMap.size} players from ${teamAbbr} (${year})`);
      scraperDebugLogger.log(`Stats scraped for ${statsMap.size} players`);

      await page.close();
      return statsMap;

    } catch (error: any) {
      console.error(`[ScraperService] Error scraping team stats for ${teamAbbr} (${year}):`, error);
      await page.close();
      return statsMap;
    }
  }

  /**
   * Scrape team roster for a given year - gets ALL players on team
   * @param teamAbbr - Team abbreviation (e.g., 'dal', 'sea', 'nwe')
   * @param year - Season year
   * @returns Array of player stats (should be ~50-60 players per team)
   */
  async scrapeTeamRoster(teamAbbr: string, year: number): Promise<PlayerStats[]> {
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();

    try {
      scraperDebugLogger.logTeamHeader(teamAbbr, year);
      console.log(`[ScraperService] Scraping roster for ${teamAbbr} (${year})`);

      // Navigate to team roster page
      const teamUrl = `https://www.pro-football-reference.com/teams/${teamAbbr}/${year}_roster.htm`;
      scraperDebugLogger.log(`URL: ${teamUrl}`);

      // Try to load page with retry logic (some pages take longer to load)
      let pageLoaded = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.goto(teamUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          pageLoaded = true;
          break;
        } catch (error: any) {
          if (attempt === 1) {
            console.warn(`[ScraperService] ${teamAbbr} roster load attempt 1 failed, retrying...`);
            scraperDebugLogger.log(`Page load timeout, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
          } else {
            console.error(`[ScraperService] ${teamAbbr} roster load attempt 2 failed:`, error.message);
            scraperDebugLogger.log(`Page load failed after 2 attempts: ${error.message}`);
            throw error;
          }
        }
      }

      // Extract roster - find table by looking for "Roster" caption or column headers
      const scrapeResult = await page.evaluate((year) => {
        const playerList: any[] = [];
        const debugInfo: any = {
          tableFound: false,
          tableMethod: '',
          rowsFound: 0,
          firstThreeRows: [],
          rejectedRows: []
        };

        // Strategy 1: Modern pages (2000+) - Try table IDs first
        const possibleTableIds = ['#games_played_team', '#roster', '#team_roster'];
        let rosterTable: Element | null = null;

        for (const tableId of possibleTableIds) {
          rosterTable = document.querySelector(tableId);
          if (rosterTable) {
            debugInfo.tableFound = true;
            debugInfo.tableMethod = `Modern table ID: ${tableId}`;
            break;
          }
        }

        // Strategy 2: Historical pages (<2000) - Find table by caption text or column headers
        if (!rosterTable) {
          // Find all tables on the page
          const allTables = document.querySelectorAll('table');

          for (const table of Array.from(allTables)) {
            // Check if table has a caption with "Roster" text
            const caption = table.querySelector('caption');
            if (caption?.textContent?.includes('Roster')) {
              debugInfo.tableFound = true;
              debugInfo.tableMethod = `Caption: "${caption.textContent}"`;
              rosterTable = table;
              break;
            }

            // Check if table has column headers matching roster structure
            const headers = Array.from(table.querySelectorAll('thead th, thead td')).map(h => h.textContent?.trim().toLowerCase());
            if (headers.includes('player') && headers.includes('pos') && headers.includes('age')) {
              debugInfo.tableFound = true;
              debugInfo.tableMethod = `Column headers match`;
              rosterTable = table;
              break;
            }
          }
        }

        if (!rosterTable) {
          return { players: playerList, debug: debugInfo };
        }

        // Extract players from the roster table
        const rows = rosterTable.querySelectorAll('tbody tr');
        debugInfo.rowsFound = rows.length;

        for (const row of Array.from(rows)) {
          // Skip header rows
          if (row.classList.contains('thead')) continue;

          const player: any = {};
          const rowDebug: any = {};

          // Extract player info from different possible cell structures
          let nameCell = row.querySelector('th[data-stat="player"] a') ||
                         row.querySelector('td[data-stat="player"] a') ||
                         row.querySelector('th a') ||
                         row.querySelector('td a');

          const posCell = row.querySelector('td[data-stat="pos"]');
          const jerseyCell = row.querySelector('th[data-stat="uniform_number"]') ||
                              row.querySelector('td[data-stat="uniform_number"]') ||
                              row.querySelector('th[data-stat="jersey_number"]') ||
                              row.querySelector('td[data-stat="jersey_number"]') ||
                              row.querySelector('th[data-stat="number"]') ||
                              row.querySelector('td[data-stat="number"]');
          const heightCell = row.querySelector('td[data-stat="height"]') ||
                             row.querySelector('td[data-stat="ht"]');
          const weightCell = row.querySelector('td[data-stat="weight"]') ||
                             row.querySelector('td[data-stat="wt"]');
          const ageCell = row.querySelector('td[data-stat="age"]');

          // Years in league - can be "Rook" for rookies or a number
          const yearsCell = row.querySelector('td[data-stat="years_in_league"]') ||
                            row.querySelector('td[data-stat="years"]') ||
                            row.querySelector('td[data-stat="yrs"]');

          // Try multiple possible college selectors
          const collegeCell = row.querySelector('td[data-stat="college"] a') ||
                              row.querySelector('td[data-stat="college_id"] a') ||
                              row.querySelector('td[data-stat="college_name"] a') ||
                              row.querySelector('td[data-stat="college"]');

          // Extract data
          if (nameCell) {
            player.name = nameCell.textContent?.trim() || '';
          }
          if (posCell) player.position = posCell.textContent?.trim() || '';
          if (jerseyCell) {
            const jerseyNum = parseInt(jerseyCell.textContent?.trim() || '0');
            if (jerseyNum > 0) player.jerseyNumber = jerseyNum;
          }
          if (heightCell) player.height = heightCell.textContent?.trim() || '';
          if (weightCell) player.weight = parseInt(weightCell.textContent?.trim() || '0');
          if (ageCell) player.age = parseInt(ageCell.textContent?.trim() || '0');
          if (yearsCell) {
            const yearsText = yearsCell.textContent?.trim().toLowerCase() || '';
            // "Rook" means 0 years, otherwise parse as number
            player.yearsPro = yearsText === 'rook' || yearsText === 'rookie' ? 0 : parseInt(yearsText) || 0;
          }
          if (collegeCell) {
            const collegeLink = collegeCell.querySelector('a');
            player.college = (collegeLink?.textContent || collegeCell.textContent)?.trim() || 'Unknown';
          }

          // Capture debug info for first 3 rows
          if (debugInfo.firstThreeRows.length < 3) {
            rowDebug.hasNameCell = !!nameCell;
            rowDebug.hasPosCell = !!posCell;
            rowDebug.name = player.name || 'EMPTY';
            rowDebug.position = player.position || 'EMPTY';
            rowDebug.height = player.height || 'N/A';
            rowDebug.weight = player.weight || 'N/A';
            rowDebug.age = player.age || 'N/A';
            rowDebug.college = player.college || 'N/A';
            debugInfo.firstThreeRows.push(rowDebug);
          }

          // Only add if we have at least a name and position
          if (player.name && player.position) {
            const isDuplicate = playerList.some(p => p.name === player.name);
            if (!isDuplicate) {
              playerList.push(player);
            }
          } else if (debugInfo.rejectedRows.length < 3) {
            debugInfo.rejectedRows.push({
              reason: !player.name ? 'Missing name' : 'Missing position',
              hasNameCell: !!nameCell,
              hasPosCell: !!posCell
            });
          }
        }

        return { players: playerList, debug: debugInfo };
      }, year);

      const roster = scrapeResult.players;
      const debugInfo = scrapeResult.debug;

      // Log debug info to file
      scraperDebugLogger.log(`Table found: ${debugInfo.tableFound ? 'YES' : 'NO'}`);
      if (debugInfo.tableFound) {
        scraperDebugLogger.log(`Table detection method: ${debugInfo.tableMethod}`);
      }
      scraperDebugLogger.log(`Rows in table: ${debugInfo.rowsFound}`);
      scraperDebugLogger.log(`Players extracted: ${roster.length}`);

      // Log first 3 rows
      if (debugInfo.firstThreeRows.length > 0) {
        scraperDebugLogger.log(`\nFirst ${debugInfo.firstThreeRows.length} rows extracted:`);
        debugInfo.firstThreeRows.forEach((row: any, idx: number) => {
          scraperDebugLogger.logPlayerRow(idx + 1, row);
        });
      }

      // Log rejected rows
      if (debugInfo.rejectedRows.length > 0) {
        scraperDebugLogger.log(`\nRejected rows (first ${debugInfo.rejectedRows.length}):`);
        debugInfo.rejectedRows.forEach((row: any, idx: number) => {
          scraperDebugLogger.log(`  Row ${idx + 1}: ${row.reason} (hasNameCell: ${row.hasNameCell}, hasPosCell: ${row.hasPosCell})`);
        });
      }

      // Log summary
      scraperDebugLogger.logScrapeSummary(teamAbbr, roster.length, debugInfo.tableFound, debugInfo.rowsFound);

      console.log(`[ScraperService] Scraped ${roster.length} players for ${teamAbbr} (${year})`);

      await page.close();
      return roster as PlayerStats[];

    } catch (error: any) {
      console.error(`[ScraperService] Error scraping roster for ${teamAbbr} (${year}):`, error);
      await page.close();
      return [];
    }
  }

  /**
   * Scrape player data from Wikipedia for biographical info
   * Gets birth date, hometown, college, draft info, career highlights
   * @param playerName - Player's full name
   * @returns Player biographical data
   */
  async scrapePlayerWikipedia(playerName: string): Promise<{ birthState?: string; birthDate?: string; college?: string; draftInfo?: string } | null> {
    await this.initBrowser();

    if (!this.browser) {
      return null;
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping Wikipedia for ${playerName}`);

      // Search Wikipedia for the player
      const searchUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(playerName.replace(/ /g, '_'))}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 10000 });

      // Extract biographical data from Wikipedia infobox
      const bioData = await page.evaluate(() => {
        const data: any = {};

        // Get infobox data
        const infobox = document.querySelector('.infobox');
        if (infobox) {
          const rows = infobox.querySelectorAll('tr');

          for (const row of Array.from(rows)) {
            const header = row.querySelector('th');
            const value = row.querySelector('td');

            if (header && value) {
              const label = header.textContent?.trim().toLowerCase() || '';
              const text = value.textContent?.trim() || '';

              // Extract birth place (state)
              if (label.includes('born')) {
                // Format: "December 25, 1950 (age 73)\nSan Francisco, California, U.S."
                const stateMatch = text.match(/,\s*([A-Z][a-z]+)\s*,?\s*(U\.S\.|United States)?/);
                if (stateMatch) {
                  data.birthPlace = stateMatch[1]; // e.g., "California"
                }

                // Extract birth date
                const dateMatch = text.match(/([A-Z][a-z]+ \d+, \d{4})/);
                if (dateMatch) {
                  data.birthDate = dateMatch[1]; // e.g., "December 25, 1950"
                }
              }

              // Extract college
              if (label.includes('college')) {
                data.college = text.split('\n')[0]; // First line is usually the college
              }

              // Extract draft info
              if (label.includes('draft') || label.includes('undrafted')) {
                data.draftInfo = text;
              }

              // Extract position
              if (label.includes('position')) {
                data.position = text;
              }
            }
          }
        }

        return data;
      });

      await page.close();
      return bioData;

    } catch (error) {
      console.warn(`[ScraperService] Could not scrape Wikipedia for ${playerName}:`, error);
      await page.close();
      return null;
    }
  }

  /**
   * Scrape top 10 players per team by Approximate Value (AV)
   * Gets detailed stats for the best players on the team
   * NOW WITH WIKIPEDIA DATA for biographical info
   * @param teamAbbr - Team abbreviation (e.g., 'dal', 'sea', 'ne')
   * @param year - Season year
   * @returns Array of top player stats with detailed info
   */
  async scrapeTop10PlayersPerTeam(teamAbbr: string, year: number): Promise<PlayerStats[]> {
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping top 10 players for ${teamAbbr} (${year})`);

      // Navigate to team stats page
      const teamUrl = `https://www.pro-football-reference.com/teams/${teamAbbr}/${year}.htm`;
      await page.goto(teamUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Extract top players by AV (Approximate Value)
      const topPlayers = await page.evaluate((year) => {
        // Look for the roster table
        const rosterTable = document.querySelector('#roster');
        const playerList: any[] = [];

        if (rosterTable) {
          const rows = Array.from(rosterTable.querySelectorAll('tbody tr'));

          // Extract all players with AV data
          for (const row of rows) {
            const nameCell = row.querySelector('th[data-stat="player"] a');
            const posCell = row.querySelector('td[data-stat="pos"]');
            const ageCell = row.querySelector('td[data-stat="age"]');
            const gamesCell = row.querySelector('td[data-stat="g"]');
            const startsCell = row.querySelector('td[data-stat="gs"]');
            const avCell = row.querySelector('td[data-stat="av"]');

            if (nameCell && avCell) {
              const av = parseInt(avCell.textContent?.trim() || '0');

              if (av > 0) {
                playerList.push({
                  name: nameCell.textContent?.trim() || '',
                  position: posCell?.textContent?.trim() || '',
                  age: parseInt(ageCell?.textContent?.trim() || '0'),
                  careerGames: parseInt(gamesCell?.textContent?.trim() || '0'),
                  careerStarts: parseInt(startsCell?.textContent?.trim() || '0'),
                  av: av
                });
              }
            }
          }

          // Sort by AV descending and take top 10
          playerList.sort((a, b) => b.av - a.av);
        }

        return playerList.slice(0, 10);
      }, year);

      console.log(`[ScraperService] Found ${topPlayers.length} top players for ${teamAbbr}`);

      // For each top player, get their detailed stats AND Wikipedia data
      const detailedPlayers: PlayerStats[] = [];

      for (const player of topPlayers) {
        console.log(`[ScraperService] Getting detailed data for ${player.name}...`);

        // Get pro-football-reference stats
        const stats = await this.scrapePlayerStats(player.name, year);

        // Get Wikipedia biographical data
        const wikiData = await this.scrapePlayerWikipedia(player.name);

        // Combine the data
        const combinedData = stats || (player as PlayerStats);

        if (wikiData) {
          // Add Wikipedia data to the player stats
          if (wikiData.birthPlace) {
            (combinedData as any).birthPlace = wikiData.birthPlace;
          }
          if (wikiData.birthDate) {
            (combinedData as any).birthDate = wikiData.birthDate;
          }
          if (wikiData.college && !combinedData.college) {
            combinedData.college = wikiData.college;
          }

          console.log(`[ScraperService] Enriched ${player.name} with Wikipedia data: ${wikiData.birthPlace}, ${wikiData.birthDate}`);
        }

        detailedPlayers.push(combinedData);
      }

      await page.close();
      return detailedPlayers;

    } catch (error: any) {
      console.error(`[ScraperService] Error scraping top 10 for ${teamAbbr}:`, error);
      await page.close();
      return [];
    }
  }

  /**
   * Get the correct PFR team abbreviation for a given year
   * Maps historical team names to their current franchise abbreviation
   * PFR uses franchise continuity - URLs use current abbreviation for all years
   * @param teamAbbr - Current Madden team abbreviation
   * @param year - Season year
   * @returns Object with PFR abbreviation and historical team name
   */
  getTeamMapping(teamAbbr: string, year: number): { pfrAbbr: string; historicalName: string; currentName: string } {
    const abbr = teamAbbr.toLowerCase();

    // Define franchise relocations and name changes
    // Format: { pfrAbbr, historicalName (for that year), currentName }

    // Tennessee Titans (formerly Houston Oilers)
    if (abbr === 'oti') {
      if (year >= 1999) {
        return { pfrAbbr: 'oti', historicalName: 'Tennessee Titans', currentName: 'Tennessee Titans' };
      } else if (year >= 1997) {
        return { pfrAbbr: 'oti', historicalName: 'Tennessee Oilers', currentName: 'Tennessee Titans' };
      } else {
        return { pfrAbbr: 'oti', historicalName: 'Houston Oilers', currentName: 'Tennessee Titans' };
      }
    }

    // Las Vegas Raiders (formerly Oakland/Los Angeles Raiders)
    if (abbr === 'rai') {
      if (year >= 2020) {
        return { pfrAbbr: 'rai', historicalName: 'Las Vegas Raiders', currentName: 'Las Vegas Raiders' };
      } else if (year >= 1995) {
        return { pfrAbbr: 'rai', historicalName: 'Oakland Raiders', currentName: 'Las Vegas Raiders' };
      } else if (year >= 1982) {
        return { pfrAbbr: 'rai', historicalName: 'Los Angeles Raiders', currentName: 'Las Vegas Raiders' };
      } else {
        return { pfrAbbr: 'rai', historicalName: 'Oakland Raiders', currentName: 'Las Vegas Raiders' };
      }
    }

    // Los Angeles Rams (formerly St. Louis/Los Angeles/Cleveland Rams)
    if (abbr === 'ram') {
      if (year >= 2016) {
        return { pfrAbbr: 'ram', historicalName: 'Los Angeles Rams', currentName: 'Los Angeles Rams' };
      } else if (year >= 1995) {
        return { pfrAbbr: 'ram', historicalName: 'St. Louis Rams', currentName: 'Los Angeles Rams' };
      } else if (year >= 1946) {
        return { pfrAbbr: 'ram', historicalName: 'Los Angeles Rams', currentName: 'Los Angeles Rams' };
      } else {
        return { pfrAbbr: 'ram', historicalName: 'Cleveland Rams', currentName: 'Los Angeles Rams' };
      }
    }

    // Los Angeles Chargers (formerly San Diego Chargers)
    if (abbr === 'sdg') {
      if (year >= 2017) {
        return { pfrAbbr: 'sdg', historicalName: 'Los Angeles Chargers', currentName: 'Los Angeles Chargers' };
      } else if (year >= 1961) {
        return { pfrAbbr: 'sdg', historicalName: 'San Diego Chargers', currentName: 'Los Angeles Chargers' };
      } else {
        return { pfrAbbr: 'sdg', historicalName: 'Los Angeles Chargers', currentName: 'Los Angeles Chargers' };
      }
    }

    // Indianapolis Colts (formerly Baltimore Colts)
    if (abbr === 'clt') {
      if (year >= 1984) {
        return { pfrAbbr: 'clt', historicalName: 'Indianapolis Colts', currentName: 'Indianapolis Colts' };
      } else {
        return { pfrAbbr: 'clt', historicalName: 'Baltimore Colts', currentName: 'Indianapolis Colts' };
      }
    }

    // Arizona Cardinals (formerly Phoenix/St. Louis/Chicago Cardinals)
    if (abbr === 'crd') {
      if (year >= 1994) {
        return { pfrAbbr: 'crd', historicalName: 'Arizona Cardinals', currentName: 'Arizona Cardinals' };
      } else if (year >= 1988) {
        return { pfrAbbr: 'crd', historicalName: 'Phoenix Cardinals', currentName: 'Arizona Cardinals' };
      } else if (year >= 1960) {
        return { pfrAbbr: 'crd', historicalName: 'St. Louis Cardinals', currentName: 'Arizona Cardinals' };
      } else {
        return { pfrAbbr: 'crd', historicalName: 'Chicago Cardinals', currentName: 'Arizona Cardinals' };
      }
    }

    // Washington Commanders (formerly Washington Football Team/Redskins)
    if (abbr === 'was') {
      if (year >= 2022) {
        return { pfrAbbr: 'was', historicalName: 'Washington Commanders', currentName: 'Washington Commanders' };
      } else if (year >= 2020) {
        return { pfrAbbr: 'was', historicalName: 'Washington Football Team', currentName: 'Washington Commanders' };
      } else if (year >= 1937) {
        return { pfrAbbr: 'was', historicalName: 'Washington Redskins', currentName: 'Washington Commanders' };
      } else if (year >= 1933) {
        return { pfrAbbr: 'was', historicalName: 'Boston Redskins', currentName: 'Washington Commanders' };
      } else {
        return { pfrAbbr: 'was', historicalName: 'Boston Braves', currentName: 'Washington Commanders' };
      }
    }

    // New England Patriots (formerly Boston Patriots)
    if (abbr === 'nwe') {
      if (year >= 1971) {
        return { pfrAbbr: 'nwe', historicalName: 'New England Patriots', currentName: 'New England Patriots' };
      } else {
        return { pfrAbbr: 'nwe', historicalName: 'Boston Patriots', currentName: 'New England Patriots' };
      }
    }

    // New York Jets (formerly New York Titans)
    if (abbr === 'nyj') {
      if (year >= 1963) {
        return { pfrAbbr: 'nyj', historicalName: 'New York Jets', currentName: 'New York Jets' };
      } else {
        return { pfrAbbr: 'nyj', historicalName: 'New York Titans', currentName: 'New York Jets' };
      }
    }

    // Kansas City Chiefs (formerly Dallas Texans)
    if (abbr === 'kan') {
      if (year >= 1963) {
        return { pfrAbbr: 'kan', historicalName: 'Kansas City Chiefs', currentName: 'Kansas City Chiefs' };
      } else {
        return { pfrAbbr: 'kan', historicalName: 'Dallas Texans', currentName: 'Kansas City Chiefs' };
      }
    }

    // Baltimore Ravens (new franchise 1996, NOT related to Colts)
    if (abbr === 'rav') {
      return { pfrAbbr: 'rav', historicalName: 'Baltimore Ravens', currentName: 'Baltimore Ravens' };
    }

    // Cleveland Browns (reactivated 1999, original team became Ravens)
    if (abbr === 'cle') {
      if (year >= 1999) {
        return { pfrAbbr: 'cle', historicalName: 'Cleveland Browns', currentName: 'Cleveland Browns' };
      } else if (year >= 1950) {
        return { pfrAbbr: 'cle', historicalName: 'Cleveland Browns (original)', currentName: 'Cleveland Browns' };
      } else {
        return { pfrAbbr: 'cle', historicalName: 'Cleveland Browns', currentName: 'Cleveland Browns' };
      }
    }

    // Houston Texans (new franchise 2002, NOT related to Oilers)
    if (abbr === 'htx') {
      return { pfrAbbr: 'htx', historicalName: 'Houston Texans', currentName: 'Houston Texans' };
    }

    // All other teams - no relocation
    const teamNames: { [key: string]: string } = {
      'atl': 'Atlanta Falcons',
      'buf': 'Buffalo Bills',
      'car': 'Carolina Panthers',
      'chi': 'Chicago Bears',
      'cin': 'Cincinnati Bengals',
      'dal': 'Dallas Cowboys',
      'den': 'Denver Broncos',
      'det': 'Detroit Lions',
      'gnb': 'Green Bay Packers',
      'jax': 'Jacksonville Jaguars',
      'mia': 'Miami Dolphins',
      'min': 'Minnesota Vikings',
      'nor': 'New Orleans Saints',
      'nyg': 'New York Giants',
      'phi': 'Philadelphia Eagles',
      'pit': 'Pittsburgh Steelers',
      'sea': 'Seattle Seahawks',
      'sfo': 'San Francisco 49ers',
      'tam': 'Tampa Bay Buccaneers'
    };

    const teamName = teamNames[abbr] || 'Unknown Team';
    return { pfrAbbr: abbr, historicalName: teamName, currentName: teamName };
  }

  /**
   * Check if team existed in a given year
   * Handles franchise relocations and founding years
   * @param teamAbbr - Team abbreviation (use CURRENT Madden abbreviation)
   * @param year - Season year
   * @returns True if the franchise existed that year (regardless of location)
   */
  teamExistedInYear(teamAbbr: string, year: number): boolean {
    // Franchise founding years (when the FRANCHISE started, regardless of location)
    // Use the franchise's earliest founding year
    const franchiseFoundingYears: { [key: string]: number } = {
      'crd': 1920, // Arizona Cardinals (Chicago 1920-1959, St. Louis 1960-1987, Phoenix 1988-1993, Arizona 1994+)
      'atl': 1966, // Atlanta Falcons
      'rav': 1996, // Baltimore Ravens (new franchise, NOT the Colts)
      'buf': 1960, // Buffalo Bills
      'car': 1995, // Carolina Panthers
      'chi': 1920, // Chicago Bears
      'cin': 1968, // Cincinnati Bengals
      'cle': 1999, // Cleveland Browns (reactivated 1999, original team moved to Baltimore 1996)
      'dal': 1960, // Dallas Cowboys
      'den': 1960, // Denver Broncos
      'det': 1930, // Detroit Lions
      'gnb': 1921, // Green Bay Packers
      'htx': 2002, // Houston Texans (NEW franchise, NOT the Oilers)
      'clt': 1953, // Indianapolis Colts (Baltimore Colts 1953-1983, Indianapolis 1984+)
      'jax': 1995, // Jacksonville Jaguars
      'kan': 1960, // Kansas City Chiefs (Dallas Texans 1960-1962, Kansas City 1963+)
      'sdg': 1960, // Los Angeles Chargers (LA 1960, San Diego 1961-2016, LA 2017+)
      'ram': 1937, // Los Angeles Rams (Cleveland 1937-1945, LA 1946-1994, St. Louis 1995-2015, LA 2016+)
      'rai': 1960, // Las Vegas Raiders (Oakland 1960-1981, LA 1982-1994, Oakland 1995-2019, Las Vegas 2020+)
      'mia': 1966, // Miami Dolphins
      'min': 1961, // Minnesota Vikings
      'nwe': 1960, // New England Patriots (Boston Patriots 1960-1970, New England 1971+)
      'nor': 1967, // New Orleans Saints
      'nyg': 1925, // New York Giants
      'nyj': 1960, // New York Jets (Titans 1960-1962, Jets 1963+)
      'phi': 1933, // Philadelphia Eagles
      'pit': 1933, // Pittsburgh Steelers
      'sea': 1976, // Seattle Seahawks
      'sfo': 1950, // San Francisco 49ers (AAFC 1946-1949, NFL 1950+)
      'tam': 1976, // Tampa Bay Buccaneers
      'oti': 1960, // Tennessee Titans (Houston Oilers 1960-1996, Tennessee Oilers 1997-1998, Tennessee Titans 1999+)
      'was': 1932  // Washington Commanders (Boston Braves 1932, Boston Redskins 1933-1936, Washington 1937+)
    };

    const foundingYear = franchiseFoundingYears[teamAbbr.toLowerCase()];

    if (!foundingYear) {
      console.warn(`[ScraperService] Unknown team abbreviation: ${teamAbbr}`);
      return false;
    }

    return year >= foundingYear;
  }

  /**
   * Scrape Pro Bowl roster for a given year
   * Gets all players who made the Pro Bowl that season for rating boosts
   * @param year - Season year (e.g., 1989 for 1989 Pro Bowl)
   * @returns Set of player names who made Pro Bowl
   */
  async scrapeProBowl(year: number): Promise<Set<string>> {
    const proBowlers = new Set<string>();

    await this.initBrowser();

    if (!this.browser) {
      console.warn('[ScraperService] Could not initialize browser for Pro Bowl scraping');
      return proBowlers;
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping Pro Bowl roster for ${year}`);

      // Pro Bowl URL format
      const probowlUrl = `https://www.pro-football-reference.com/years/${year}/probowl.htm`;
      await page.goto(probowlUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Extract Pro Bowl players
      const players = await page.evaluate(() => {
        const playerSet: string[] = [];

        // Look for the Pro Bowl roster tables (AFC and NFC)
        const tables = document.querySelectorAll('table');

        for (const table of Array.from(tables)) {
          const rows = table.querySelectorAll('tbody tr');

          for (const row of Array.from(rows)) {
            // Skip header rows
            if (row.classList.contains('thead')) continue;

            // Try multiple selectors for player names
            const nameCell = row.querySelector('th[data-stat="player"] a') ||
                            row.querySelector('td[data-stat="player"] a') ||
                            row.querySelector('th a') ||
                            row.querySelector('td a');

            if (nameCell) {
              const playerName = nameCell.textContent?.trim() || '';
              if (playerName && !playerSet.includes(playerName)) {
                playerSet.push(playerName);
              }
            }
          }
        }

        return playerSet;
      });

      // Add to Set (automatically handles duplicates)
      for (const player of players) {
        proBowlers.add(player);
      }

      console.log(`[ScraperService] Found ${proBowlers.size} Pro Bowlers for ${year}`);

      await page.close();
      return proBowlers;

    } catch (error: any) {
      console.warn(`[ScraperService] Error scraping Pro Bowl for ${year}:`, error.message);
      await page.close();
      return proBowlers;
    }
  }

  /**
   * Get HOF players by playing year (not draft year)
   * Returns all HOF players who MIGHT have played in a given season
   * Uses draft year + realistic career span (12 years average for HOFers)
   * @param year - Season year
   * @returns Map of player name -> HOF status
   */
  async getHOFPlayersByYear(year: number): Promise<Map<string, boolean>> {
    const hofMap = new Map<string, boolean>();

    // Load HOF lookup if not already loaded
    this.loadHOFLookup();

    if (!this.hofLookup) {
      console.warn('[ScraperService] HOF lookup data not available');
      return hofMap;
    }

    // For roster generation, estimate if player was likely active in this year
    // HOF careers are typically longer than average (10-17 years)
    // We use a generous range to catch all possible HOFers
    let count = 0;
    for (const [playerName, data] of this.hofLookup.entries()) {
      const draftYear = data.year;

      // Different career lengths by position
      const position = data.position.toUpperCase();
      let careerLength = 12; // Default

      // Position-specific career lengths (HOF players play longer than average)
      if (position === 'QB' || position === 'K' || position === 'P') {
        careerLength = 17; // QBs and kickers play longer
      } else if (position === 'OL' || position === 'OT' || position === 'OG' || position === 'C') {
        careerLength = 14; // Offensive linemen
      } else if (position === 'RB' || position === 'CB') {
        careerLength = 10; // RBs and CBs have shorter careers
      } else if (position === 'WR' || position === 'TE') {
        careerLength = 12; // Receivers
      } else if (position === 'DL' || position === 'LB' || position === 'DE' || position === 'DT') {
        careerLength = 13; // Defensive front 7
      } else if (position === 'DB' || position === 'S' || position === 'FS' || position === 'SS') {
        careerLength = 11; // Defensive backs
      }

      const typicalCareerStart = draftYear;
      const typicalCareerEnd = draftYear + careerLength;

      if (year >= typicalCareerStart && year <= typicalCareerEnd) {
        hofMap.set(playerName, true);
        count++;
      }
    }

    console.log(`[ScraperService] Found ${count} potential HOF players active in ${year} (using position-based career spans)`);
    return hofMap;
  }
}

// Export singleton instance
export const scraperService = new ScraperService();
