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
  gamesPlayed?: number;

  // Passing Stats
  passAttempts?: number;
  passCompletions?: number;
  passYards?: number;
  passTDs?: number;
  interceptions?: number;
  passerRating?: number;

  // Rushing Stats
  rushAttempts?: number;
  rushYards?: number;
  rushTDs?: number;
  rushYPC?: number;

  // Receiving Stats
  receptions?: number;
  recYards?: number;
  recTDs?: number;
  targets?: number;
  recYPC?: number;

  // Defensive Stats
  tackles?: number;
  tacklesSolo?: number;
  tacklesAssist?: number;
  sacks?: number;
  forcedFumbles?: number;
  fumblesRecovered?: number;
  interceptionsCaught?: number;
  passDefended?: number;

  // Kicking Stats
  fgAttempts?: number;
  fgMade?: number;
  fgPct?: number;
  fgLong?: number;
  xpAttempts?: number;
  xpMade?: number;
  xpPct?: number;
  kickingPoints?: number;

  // Punting Stats
  punts?: number;
  puntYards?: number;
  puntAvg?: number;
  puntLong?: number;
  puntBlocked?: number;
  puntIn20?: number;
  puntTouchbacks?: number;

  // Return Stats
  puntReturns?: number;
  puntReturnYards?: number;
  puntReturnTDs?: number;
  puntReturnLong?: number;
  puntReturnAvg?: number;
  kickReturns?: number;
  kickReturnYards?: number;
  kickReturnTDs?: number;
  kickReturnLong?: number;
  kickReturnAvg?: number;

  // Scrimmage Stats (combined rushing + receiving)
  scrimmageYards?: number;
  scrimmageTDs?: number;
  touches?: number;
  yardsPerTouch?: number;

  // Scoring Stats
  totalTDs?: number;
  rushingTDsScoring?: number;
  receivingTDsScoring?: number;
  returnTDs?: number;
  totalPoints?: number;
  twoPointConversions?: number;
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
 * Extended biographical data from PFR player page
 */
export interface ExtendedBioData {
  // Basic bio
  hometown?: string;      // City name
  homeState?: string;     // Two-letter state code
  height?: string;        // "6-2" format
  weight?: number;        // In pounds
  college?: string;       // College name

  // Birth info
  birthDate?: string;     // "Month DD, YYYY"
  birthPlace?: string;    // Full "City, State" string

  // Draft info
  draftYear?: number;     // Year drafted
  draftRound?: string;    // Round (1, 2, ... or "UDFA")
  draftPick?: number;     // Overall pick number
  draftTeam?: string;     // Team that drafted player

  // Career span
  careerFrom?: number;    // First year in NFL
  careerTo?: number;      // Last year in NFL

  // Career history by year
  careerHistory?: CareerYearData[];
}

/**
 * Per-year career data from PFR
 */
export interface CareerYearData {
  year: number;
  team: string;           // Full team name
  jersey?: number;        // Jersey number
  gamesPlayed?: number;
  gamesStarted?: number;
  position?: string;
}

/**
 * Scraper Service Class
 */
export class ScraperService {
  private browser: Browser | null = null;
  private hofLookup: Map<string, { year: number; height: string; weight: number; position: string; college: string; birthState: string }> | null = null;
  private seasonStatsCache: Map<number, Map<string, PlayerStats>> = new Map();

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
    // FIRST: Try to get from cached season data (much faster and more reliable)
    const seasonStats = await this.getPlayerStatsFromSeason(playerName, year);
    if (seasonStats) {
      console.log(`[ScraperService] Found ${playerName} in season ${year} cache`);
      return seasonStats;
    }

    // FALLBACK: Search for player individually (slower, less reliable)
    console.log(`[ScraperService] ${playerName} not in season cache, trying individual search...`);

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
      // Path to HOF lookup CSV - use app.getAppPath() for correct resolution
      const { app } = require('electron');
      const csvPath = path.join(app.getAppPath(), 'data', 'lookups', 'hof_lookup.csv');

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
   * Scrape extended player biographical data from pro-football-reference.com
   * Gets hometown, state, height, weight, college, and career history (team/jersey per year)
   * @param playerName - Player's full name
   * @returns Extended bio data including career history, or null if not found
   */
  async scrapePlayerBioExtended(playerName: string): Promise<ExtendedBioData | null> {
    await this.initBrowser();

    if (!this.browser) {
      return null;
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping extended bio for ${playerName}`);

      // Search for player
      const searchUrl = `https://www.pro-football-reference.com/search/search.fcgi?search=${encodeURIComponent(playerName)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Check if we're on a search results page (not a player page)
      const currentUrl = page.url();
      console.log(`[ScraperService] Current URL after search: ${currentUrl}`);

      // If we're still on search page, we need to click the first player result
      if (currentUrl.includes('/search/')) {
        console.log(`[ScraperService] On search results page, looking for player link...`);

        // Look for first player link in search results
        const playerLink = await page.evaluate(() => {
          // PFR search results have divs with class "search-item-name" or links to /players/
          const links = document.querySelectorAll('a[href*="/players/"]');
          for (const link of Array.from(links)) {
            const href = link.getAttribute('href');
            if (href && href.includes('/players/') && href.endsWith('.htm')) {
              return href;
            }
          }
          return null;
        });

        if (playerLink) {
          console.log(`[ScraperService] Found player link: ${playerLink}`);
          const fullUrl = playerLink.startsWith('http')
            ? playerLink
            : `https://www.pro-football-reference.com${playerLink}`;
          await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          console.log(`[ScraperService] Navigated to player page: ${page.url()}`);
        } else {
          console.log(`[ScraperService] No player link found in search results`);
        }
      }

      // Wait for stats table to load (PFR may load it dynamically)
      try {
        await page.waitForSelector('table.stats_table', { timeout: 5000 });
      } catch (e) {
        console.log(`[ScraperService] No stats_table found after waiting, continuing...`);
      }

      // Extract extended bio data from meta section and career tables
      const bioData = await page.evaluate(() => {
        const data: {
          hometown?: string;
          homeState?: string;
          height?: string;
          weight?: number;
          college?: string;
          birthDate?: string;
          birthPlace?: string;
          careerHistory?: Array<{
            year: number;
            team: string;
            jersey?: number;
            gamesPlayed?: number;
            gamesStarted?: number;
            position?: string;
          }>;
          _debug?: string[];
        } = { _debug: [] };

        // ===== Extract Bio from JSON-LD schema.org data (most reliable) =====
        var jsonLdScript = document.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
          try {
            var jsonLd = JSON.parse(jsonLdScript.textContent || '{}');
            data._debug?.push('Found JSON-LD data');

            // Extract height from schema.org
            if (jsonLd.height && jsonLd.height.value) {
              data.height = jsonLd.height.value;
              data._debug?.push('JSON-LD height: ' + data.height);
            }

            // Extract weight from schema.org
            if (jsonLd.weight && jsonLd.weight.value) {
              var weightStr = jsonLd.weight.value.toString().replace(/[^\d]/g, '');
              data.weight = parseInt(weightStr) || undefined;
              data._debug?.push('JSON-LD weight: ' + data.weight);
            }

            // Extract birthPlace from schema.org
            // birthPlace can be a string like "Shelbyville, IN, USA" or an object with .name
            var birthPlaceValue = null;
            if (typeof jsonLd.birthPlace === 'string') {
              birthPlaceValue = jsonLd.birthPlace;
            } else if (jsonLd.birthPlace && jsonLd.birthPlace.name) {
              birthPlaceValue = jsonLd.birthPlace.name;
            }

            if (birthPlaceValue) {
              data.birthPlace = birthPlaceValue;
              data._debug?.push('JSON-LD birthPlace: ' + data.birthPlace);

              // Parse "City, ST" or "City, ST, USA" format into hometown and state
              // Look for: City name, then 2-letter state code, then optional ", USA" or end
              var placeMatch = data.birthPlace.match(/^([^,]+),\s*([A-Z]{2})(?:,|$)/i);
              if (placeMatch) {
                data.hometown = placeMatch[1].trim();
                var stAbbr = placeMatch[2].toUpperCase();
                // Map state abbreviation to full name
                var stateMap = {
                  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
                  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
                  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
                  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
                  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
                  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
                  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
                  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
                  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
                  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
                  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
                  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
                  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
                };
                data.homeState = stateMap[stAbbr] || stAbbr;
                data._debug?.push('Parsed hometown: ' + data.hometown + ', state: ' + data.homeState);
              } else {
                data._debug?.push('Could not parse birthPlace: ' + data.birthPlace);
              }
            }
          } catch (e) {
            data._debug?.push('JSON-LD parse error');
          }
        }

        // ===== Extract Bio from #meta section (fallback/additional data) =====
        // Try multiple selectors - PFR uses different structures
        const metaDiv = document.querySelector('#meta');
        if (!metaDiv) {
          data._debug?.push('No #meta div found');
        } else {
          // Get all text content from meta section
          const metaText = metaDiv.textContent || '';
          data._debug?.push('Meta text length: ' + metaText.length);

          // Extract Born info from full meta text
          // Format: "Born: November 19, 1947 in Shelbyville, IN"
          // Try to find date and location separately for robustness

          // First, get the birth date
          const dateMatch = metaText.match(/Born:\s*([A-Za-z]+\s+\d+,\s+\d{4})/i);
          if (dateMatch) {
            data.birthDate = dateMatch[1].trim();
            data._debug?.push('Birth date: ' + data.birthDate);
          }

          // Then, find "in City, ST" pattern - look for text after "in" before a parenthesis or newline
          // First find the born line to narrow down the search
          const bornLineMatch = metaText.match(/Born:[^6-9]*/i); // Stop before height numbers
          const bornLine = bornLineMatch ? bornLineMatch[0] : '';
          data._debug?.push('Born line: ' + bornLine.substring(0, 150));

          // State abbreviation to full name mapping (plain JS object, no TypeScript)
          var stateAbbrevToName = {
            'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
            'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
            'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
            'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
            'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
            'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
            'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
            'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
            'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
            'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
            'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
            'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
            'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
          };

          // Only try text parsing for location if JSON-LD didn't provide it
          if (!data.hometown || !data.homeState) {
            // Look for "in City, ST" pattern - try multiple formats
            // Format 1: "in Shelbyville, IN" with comma
            // Format 2: "in Shelbyville IN" without comma
            // Use case-insensitive matching
            var locationMatch = bornLine.match(/\bin\s+([A-Za-z][A-Za-z\s\.'-]*),?\s*([A-Za-z]{2})(?:\s|$|[^a-zA-Z])/i);
            if (locationMatch) {
              data.hometown = locationMatch[1].trim().replace(/,\s*$/, '');
              var stateAbbrev = locationMatch[2].toUpperCase();
              data.homeState = stateAbbrevToName[stateAbbrev] || stateAbbrev;
              data.birthPlace = data.hometown + ', ' + data.homeState;
              data._debug?.push('Text location match: [' + locationMatch[1] + '] [' + stateAbbrev + '] -> ' + data.homeState);
            } else {
              // Try alternate: look for two-letter state code after comma anywhere in born line
              var stateMatch = bornLine.match(/,\s*([A-Za-z]{2})(?:\s|$|[^a-zA-Z])/i);
              if (stateMatch) {
                var stAbbrev = stateMatch[1].toUpperCase();
                data.homeState = stateAbbrevToName[stAbbrev] || stAbbrev;
                data._debug?.push('Text state-only match: ' + stAbbrev + ' -> ' + data.homeState);

                // Try to extract city before the state
                var cityMatch = bornLine.match(/in\s+([A-Za-z][A-Za-z\s\.'-]*?)(?:,|\s+[A-Za-z]{2})/i);
                if (cityMatch) {
                  data.hometown = cityMatch[1].trim();
                  data.birthPlace = data.hometown + ', ' + data.homeState;
                }
              } else {
                data._debug?.push('No text location match. Born line: ' + bornLine.substring(0, 200));
              }
            }
          }

          // Only try text parsing for height/weight if JSON-LD didn't provide it
          if (!data.height || !data.weight) {
            // Extract height/weight - format: "6-3, 208lb" or "6-3 208lb"
            // Look for pattern: digit, hyphen, digit(s), optional comma/space, digits, "lb"
            var hwMatch = metaText.match(/([4-8])-(\d{1,2}),?\s*(\d{2,3})\s*lb/i);
            if (hwMatch) {
              var feet = parseInt(hwMatch[1]);
              var inches = parseInt(hwMatch[2]);
              // Validate inches is reasonable (0-11)
              if (inches >= 0 && inches <= 11) {
                if (!data.height) data.height = feet + '-' + inches;
                if (!data.weight) data.weight = parseInt(hwMatch[3]);
                data._debug?.push('Text height/weight: ' + hwMatch[0] + ' -> ' + data.height + ', ' + data.weight + 'lb');
              } else {
                data._debug?.push('Invalid inches (' + inches + '): ' + hwMatch[0]);
              }
            } else {
              data._debug?.push('No text height/weight match');
            }
          }

          // Extract college from link
          const collegeLink = metaDiv.querySelector('a[href*="/schools/"]');
          if (collegeLink) {
            data.college = collegeLink.textContent?.trim() || '';
            data._debug?.push('College: ' + data.college);
          }

          // Extract draft info from meta section (metaText already declared above)
          // Format: "Draft: Detroit Lions in the 1st round (3rd overall) of the 1989 NFL Draft."
          const draftMatch = metaText.match(/Draft:\s*(.+?)\s+in\s+the\s+(\d+)(?:st|nd|rd|th)\s+round\s*\((\d+)(?:st|nd|rd|th)\s+overall\)\s+of\s+the\s+(\d{4})\s+NFL\s+Draft/i);
          if (draftMatch) {
            data.draftTeam = draftMatch[1].trim();
            data.draftRound = draftMatch[2];
            data.draftPick = parseInt(draftMatch[3]);
            data.draftYear = parseInt(draftMatch[4]);
            data._debug?.push('Draft: Round ' + data.draftRound + ', Pick ' + data.draftPick + ', Year ' + data.draftYear);
          } else if (metaText.toLowerCase().includes('undrafted')) {
            data.draftRound = 'UDFA';
            data._debug?.push('Draft: Undrafted');
          }
        }

        // ===== Extract Career History =====
        data.careerHistory = [];

        // PFR tables: look for first table with stats_table class that has year data
        // Tables may be wrapped in divs like #all_rushing_and_receiving
        const allStatsTables = document.querySelectorAll('table.stats_table');
        let statsTable: Element | null = null;
        let foundTableId = '';

        for (const table of Array.from(allStatsTables)) {
          // Check if this table has year data (Season column)
          const firstDataRow = table.querySelector('tbody tr:not(.thead)');
          if (firstDataRow) {
            // Look for year in first th or td
            const firstCell = firstDataRow.querySelector('th, td');
            const cellText = firstCell?.textContent?.trim() || '';
            if (cellText.match(/^\d{4}/)) {
              statsTable = table;
              foundTableId = table.id || 'stats_table';
              break;
            }
          }
        }

        data._debug?.push('Career table search: found=' + (statsTable ? foundTableId : 'none') + ', total stats_tables=' + allStatsTables.length);

        if (statsTable) {
          const rows = statsTable.querySelectorAll('tbody tr');
          data._debug?.push('Career table rows found: ' + rows.length);

          let processedRows = 0;
          for (const row of Array.from(rows)) {
            // Skip header/section rows
            if (row.classList.contains('thead') || row.classList.contains('partial_table')) continue;
            // Skip summary rows (Career, avg rows)
            const rowText = row.textContent || '';
            if (rowText.includes('Career') || rowText.includes('Yrs') || rowText.includes('Game Avg')) continue;

            // Get year from first cell (th or td)
            const yearCell = row.querySelector('th[data-stat="year_id"], td[data-stat="year_id"], th:first-child, td:first-child');
            const yearText = yearCell?.textContent?.trim() || '';
            // Extract just the year number (PFR may have links like "1989*" or "1989")
            const yearMatch = yearText.match(/^(\d{4})/);
            const year = yearMatch ? parseInt(yearMatch[1]) : NaN;

            if (isNaN(year) || year < 1920 || year > 2100) {
              continue;
            }

            // Get team - try data-stat="team_id" first, then look for team link
            const teamCell = row.querySelector('td[data-stat="team_id"], td[data-stat="team"]');
            let team = '';
            if (teamCell) {
              const teamLink = teamCell.querySelector('a');
              team = (teamLink?.textContent || teamCell.textContent)?.trim() || '';
            }

            // Get games played/started
            const gamesCell = row.querySelector('td[data-stat="g"]');
            const startsCell = row.querySelector('td[data-stat="gs"]');
            const gamesPlayed = gamesCell ? parseInt(gamesCell.textContent?.trim() || '') : undefined;
            const gamesStarted = startsCell ? parseInt(startsCell.textContent?.trim() || '') : undefined;

            // Get position
            const posCell = row.querySelector('td[data-stat="pos"]');
            const position = posCell?.textContent?.trim();

            data.careerHistory.push({
              year,
              team: team || 'Unknown',
              gamesPlayed: !isNaN(gamesPlayed!) ? gamesPlayed : undefined,
              gamesStarted: !isNaN(gamesStarted!) ? gamesStarted : undefined,
              position
            });
            processedRows++;
          }
          data._debug?.push('Career history entries added: ' + data.careerHistory.length);
        } else {
          // Debug: list all tables on page
          const allTables = document.querySelectorAll('table');
          const tableIds = Array.from(allTables).slice(0, 10).map(t => t.id || t.className || 'unnamed').join(', ');
          data._debug?.push('No stats table found. Tables: ' + tableIds);
        }

        // Calculate career span from career history
        data._debug?.push('careerHistory length: ' + (data.careerHistory ? data.careerHistory.length : 0));
        if (data.careerHistory && data.careerHistory.length > 0) {
          const years = data.careerHistory.map(ch => ch.year).filter(y => y > 1900);
          data._debug?.push('Filtered years array: ' + JSON.stringify(years));
          if (years.length > 0) {
            data.careerFrom = Math.min(...years);
            data.careerTo = Math.max(...years);
            data._debug?.push('Career span calculated: ' + data.careerFrom + '-' + data.careerTo);
          } else {
            data._debug?.push('No valid years found in careerHistory');
          }
        } else {
          data._debug?.push('No careerHistory to calculate span from');
        }

        // Fallback: use draft year as careerFrom if we have it and no career span yet
        if (!data.careerFrom && data.draftYear) {
          data.careerFrom = data.draftYear;
          data._debug?.push('Using draft year as careerFrom fallback: ' + data.careerFrom);
        }

        return data;
      });

      console.log(`[ScraperService] Scraped extended bio for ${playerName}:`);
      console.log(`  hometown=${bioData.hometown}`);
      console.log(`  homeState=${bioData.homeState}`);
      console.log(`  height=${bioData.height}`);
      console.log(`  weight=${bioData.weight}`);
      console.log(`  college=${bioData.college}`);
      console.log(`  draft=${bioData.draftYear ? `Round ${bioData.draftRound}, Pick ${bioData.draftPick}, ${bioData.draftYear}` : bioData.draftRound || 'N/A'}`);
      console.log(`  career=${bioData.careerFrom}-${bioData.careerTo} (${bioData.careerHistory?.length || 0} seasons)`);

      // Log debug info
      if ((bioData as any)._debug && (bioData as any)._debug.length > 0) {
        console.log(`[ScraperService] Debug info:`);
        (bioData as any)._debug.forEach((msg: string) => console.log(`  ${msg}`));
      }

      // Remove debug info before returning
      delete (bioData as any)._debug;

      await page.close();
      return bioData as ExtendedBioData;

    } catch (error) {
      console.warn(`[ScraperService] Could not scrape extended bio for ${playerName}:`, error);
      await page.close();
      return null;
    }
  }

  /**
   * Scrape player biographical data from Pro Football Archives (profootballarchives.com)
   * Better source for historical players, hometown, and state data
   * @param playerName - Player's full name
   * @param draftYear - Optional draft year to help narrow search
   * @returns Extended bio data, or null if not found
   */
  async scrapePlayerFromPFA(playerName: string, draftYear?: number): Promise<ExtendedBioData | null> {
    await this.initBrowser();

    if (!this.browser) {
      return null;
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping PFA for ${playerName}${draftYear ? ` (draft ${draftYear})` : ''}`);

      let found = false;

      // Method 1: Try direct profile URL - PFA format is /p{firstname}{lastname}.html (all lowercase, no spaces)
      const nameParts = playerName.toLowerCase().split(/\s+/);
      const urlFormats = [
        // Full name no spaces: "johnsmith"
        nameParts.join(''),
        // First + Last (skip middle): "johnsmith" for "John Michael Smith"
        nameParts.length > 2 ? `${nameParts[0]}${nameParts[nameParts.length - 1]}` : null,
        // Handle Jr/Sr/III suffixes
        nameParts.filter(p => !['jr', 'sr', 'ii', 'iii', 'iv'].includes(p)).join('')
      ].filter(Boolean);

      for (const nameFormat of urlFormats) {
        if (found) break;
        const searchUrl = `https://www.profootballarchives.com/p${nameFormat}.html`;
        console.log(`[ScraperService] Trying PFA URL: ${searchUrl}`);

        try {
          await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          const pageText = await page.evaluate(() => document.body.innerText);
          if (pageText.includes('Height:') || pageText.includes('Born:')) {
            console.log(`[ScraperService] Found player page at ${searchUrl}`);
            found = true;
          }
        } catch (e) {
          // URL didn't work, try next format
        }
      }

      // Method 2: If we have a draft year, search the draft page for the player
      // This also extracts college from the draft table (which is more reliable than player page)
      let draftPageCollege: string | null = null;

      if (!found && draftYear && draftYear >= 1936) {
        console.log(`[ScraperService] Searching ${draftYear} draft page for ${playerName}...`);
        const draftPageUrl = `https://www.profootballarchives.com/drafts/${draftYear}nfldraft.html`;

        try {
          await page.goto(draftPageUrl, { waitUntil: 'networkidle2', timeout: 15000 });

          // Search for player name in draft table and get their profile link + college
          const draftInfo = await page.evaluate((searchName: string) => {
            const searchLower = searchName.toLowerCase();
            const nameParts = searchName.toLowerCase().split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts[nameParts.length - 1];

            const rows = document.querySelectorAll('table tr');
            for (const row of rows) {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 5) {
                const playerLink = cells[3]?.querySelector('a');
                if (playerLink) {
                  const linkText = (playerLink.textContent || '').toLowerCase();
                  // Check if this row matches our player
                  if (linkText.includes(firstName) && linkText.includes(lastName)) {
                    const href = playerLink.getAttribute('href');
                    if (href && href.startsWith('/p')) {
                      // Get college from column 6 (index 5)
                      const college = cells[5]?.textContent?.trim() || null;
                      return { profileUrl: href, college };
                    }
                  }
                }
              }
            }
            return null;
          }, playerName);

          if (draftInfo?.profileUrl) {
            console.log(`[ScraperService] Found player in draft page, URL: ${draftInfo.profileUrl}, College: ${draftInfo.college}`);
            draftPageCollege = draftInfo.college;
            await page.goto(`https://www.profootballarchives.com${draftInfo.profileUrl}`, { waitUntil: 'networkidle2', timeout: 15000 });
            found = true;
          }
        } catch (e) {
          console.log(`[ScraperService] Draft page search failed: ${e}`);
        }
      }

      // Method 3: Try Google search as last resort
      if (!found) {
        console.log(`[ScraperService] Trying Google search for PFA page...`);
        const googleUrl = `https://www.google.com/search?q=site:profootballarchives.com+${encodeURIComponent(playerName)}`;

        try {
          await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 15000 });

          const pfaLink = await page.evaluate(() => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
              const href = link.getAttribute('href') || '';
              if (href.includes('profootballarchives.com') && href.includes('/p')) {
                // Extract actual URL from Google redirect
                const match = href.match(/url=([^&]+)/);
                if (match) {
                  return decodeURIComponent(match[1]);
                }
                if (href.startsWith('http')) {
                  return href;
                }
              }
            }
            return null;
          });

          if (pfaLink) {
            console.log(`[ScraperService] Found via Google: ${pfaLink}`);
            await page.goto(pfaLink, { waitUntil: 'networkidle2', timeout: 15000 });
            found = true;
          }
        } catch (e) {
          console.log(`[ScraperService] Google search failed: ${e}`);
        }
      }

      if (!found) {
        console.log(`[ScraperService] Player not found on PFA: ${playerName}`);
        await page.close();
        return null;
      }

      // Extract RAW data from PFA player page - EXACT same patterns as test-pfa-scraper.js
      // Processing of hometown/state happens OUTSIDE page.evaluate
      const rawData = await page.evaluate(() => {
        const text = document.body.innerText;
        const result: {
          height?: string;
          weight?: string;
          birthDate?: string;
          birthPlace?: string;
          highSchool?: string;
          careerFrom?: number;
          careerTo?: number;
          teams?: string;
          careerHistory?: Array<{year: number, team: string}>;
        } = {};

        // Height: 6-8 Weight: 290 (EXACT pattern from test-pfa-scraper.js line 267)
        const heightWeightMatch = text.match(/Height:\s*(\d+-\d+)\s*Weight:\s*(\d+)/i);
        if (heightWeightMatch) {
          result.height = heightWeightMatch[1].trim();
          result.weight = heightWeightMatch[2].trim();
        }

        // Born: October 25, 1950 Milwaukee, WI (EXACT pattern from test-pfa-scraper.js line 275)
        // IMPORTANT: birthPlace must be a real city, NOT "High School" or other keywords
        const bornMatch = text.match(/Born:\s*(\w+\s+\d+,\s*\d{4})\s+([^,\n]+,\s*\w{2})/i);
        if (bornMatch) {
          result.birthDate = bornMatch[1].trim();
          const potentialPlace = bornMatch[2].trim();
          // Only set birthPlace if it's a real city (not "High School", "College", etc.)
          if (!potentialPlace.toLowerCase().includes('high school') &&
              !potentialPlace.toLowerCase().includes('college') &&
              !potentialPlace.toLowerCase().includes('position')) {
            result.birthPlace = potentialPlace;
          }
        } else {
          // Try just date
          const dateOnlyMatch = text.match(/Born:\s*(\w+\s+\d+,\s*\d{4})/i);
          if (dateOnlyMatch) {
            result.birthDate = dateOnlyMatch[1].trim();
          }
        }

        // High School: Oak Creek (WI) (EXACT pattern from test-pfa-scraper.js line 288)
        const highSchoolMatch = text.match(/High School:\s*([^\n]+)/i);
        if (highSchoolMatch) {
          result.highSchool = highSchoolMatch[1].trim();
        }

        // Career years from stats table (EXACT pattern from test-pfa-scraper.js line 294)
        const yearMatches = text.match(/\b(19[6-9]\d|200\d|201\d|202[0-5])\b/g);
        if (yearMatches) {
          const yearCounts: Record<number, number> = {};
          yearMatches.forEach((y: string) => {
            const yr = parseInt(y);
            yearCounts[yr] = (yearCounts[yr] || 0) + 1;
          });

          const careerYears = Object.keys(yearCounts)
            .map(y => parseInt(y))
            .filter(y => y >= 1960 && y <= 2025 && yearCounts[y] >= 2)
            .sort((a, b) => a - b);

          if (careerYears.length >= 1) {
            result.careerFrom = Math.min(...careerYears);
            result.careerTo = Math.max(...careerYears);
          }
        }

        // Extract teams (EXACT pattern from test-pfa-scraper.js line 388)
        const teamPattern = /\b(Oilers|Chiefs|Raiders|Colts|Eagles|Patriots|Cardinals|Bears|Broncos|Bills|Bengals|Browns|Buccaneers|Chargers|Cowboys|Dolphins|Falcons|49ers|Giants|Jets|Lions|Packers|Panthers|Ravens|Redskins|Commanders|Saints|Seahawks|Steelers|Texans|Titans|Vikings|Rams)\b/g;
        const teamMatches = text.match(teamPattern);
        if (teamMatches) {
          result.teams = [...new Set(teamMatches)].join(', ');
        }

        // Extract year-by-year career history from stats table
        // Format: "1973  Houston Oilers  RDT  16  16" or "2023 New York Jets"
        // Look for: YEAR followed by city/team name followed by team nickname
        const yearTeamData: Array<{year: number, team: string}> = [];
        const teamNames = ['Oilers', 'Chiefs', 'Raiders', 'Colts', 'Eagles', 'Patriots', 'Cardinals',
                          'Bears', 'Broncos', 'Bills', 'Bengals', 'Browns', 'Buccaneers', 'Chargers',
                          'Cowboys', 'Dolphins', 'Falcons', '49ers', 'Giants', 'Jets', 'Lions',
                          'Packers', 'Panthers', 'Ravens', 'Redskins', 'Commanders', 'Saints',
                          'Seahawks', 'Steelers', 'Texans', 'Titans', 'Vikings', 'Rams'];
        const teamNamesPattern = teamNames.join('|');

        // Pattern matches: "YEAR  City Team  ..." or "YEAR Team Name (NFL)"
        const yearTeamPattern = new RegExp(
          `\\b(19[6-9]\\d|20[0-2]\\d)\\s+([A-Za-z.\\s]+?)\\s*(${teamNamesPattern})\\b`,
          'gi'
        );

        let yearTeamMatch;
        while ((yearTeamMatch = yearTeamPattern.exec(text)) !== null) {
          const year = parseInt(yearTeamMatch[1]);
          const teamNickname = yearTeamMatch[3];
          if (year >= 1960 && year <= 2030) {
            yearTeamData.push({ year, team: teamNickname });
          }
        }

        // Deduplicate by year (keep first occurrence which is typically the main team)
        const seenYears = new Set<number>();
        result.careerHistory = [];
        for (const entry of yearTeamData) {
          if (!seenYears.has(entry.year)) {
            seenYears.add(entry.year);
            result.careerHistory.push(entry);
          }
        }

        return result;
      });

      console.log(`[ScraperService] Raw PFA data:`, rawData);

      // Process hometown/state OUTSIDE page.evaluate (same as extractHometown in test-pfa-scraper.js)
      const extractHometown = (birthPlace?: string, highSchool?: string): { city?: string; state?: string } => {
        // State abbreviation to full name mapping
        const stateMap: Record<string, string> = {
          'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
          'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
          'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
          'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
          'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
          'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
          'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
          'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
          'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
          'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
          'DC': 'District of Columbia'
        };
        const foreignCodes = new Set(['AU', 'JA', 'IT', 'PO', 'UK', 'GE', 'EN', 'BR', 'NG', 'ME', 'PR']);

        // Try birthPlace first: "City, ST"
        if (birthPlace) {
          const parts = birthPlace.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            const stateAbbr = parts[1].toUpperCase();
            const stateName = foreignCodes.has(stateAbbr) ? 'Non-US' : (stateMap[stateAbbr] || stateAbbr);
            return { city: parts[0], state: stateName };
          }
        }

        // Fall back to high school: "School Name (City, ST)" or "School Name (ST)"
        if (highSchool) {
          const parenMatch = highSchool.match(/\(([^)]+)\)/);
          if (parenMatch) {
            const inner = parenMatch[1];
            if (inner.includes(',')) {
              const parts = inner.split(',').map(p => p.trim());
              const stateAbbr = parts[1].toUpperCase();
              const stateName = foreignCodes.has(stateAbbr) ? 'Non-US' : (stateMap[stateAbbr] || stateAbbr);
              return { city: parts[0], state: stateName };
            } else {
              // Just state abbreviation like "(WI)"
              const stateAbbr = inner.trim().toUpperCase();
              const stateName = foreignCodes.has(stateAbbr) ? 'Non-US' : (stateMap[stateAbbr] || stateAbbr);
              // Use school name without parentheses as city approximation
              const schoolName = highSchool.replace(/\s*\([^)]+\)/, '').trim();
              return { city: schoolName, state: stateName };
            }
          }
        }

        return {};
      };

      // Parse height to inches (same as parseHeight in test-pfa-scraper.js)
      const parseHeight = (heightStr?: string): number | undefined => {
        if (!heightStr) return undefined;
        const match = heightStr.match(/(\d+)-(\d+)/);
        if (match) {
          return parseInt(match[1]) * 12 + parseInt(match[2]);
        }
        return undefined;
      };

      // Build final bio data
      const hometown = extractHometown(rawData.birthPlace, rawData.highSchool);
      const bioData: any = {
        height: rawData.height,
        weight: rawData.weight ? parseInt(rawData.weight) : undefined,
        heightInches: parseHeight(rawData.height),
        birthDate: rawData.birthDate,
        birthPlace: rawData.birthPlace,
        highSchool: rawData.highSchool,
        hometown: hometown.city,
        homeState: hometown.state,
        careerFrom: rawData.careerFrom,
        careerTo: rawData.careerTo,
        teams: rawData.teams,
        careerHistory: rawData.careerHistory || [],
        college: draftPageCollege || undefined // College comes from draft page
      };

      console.log(`[ScraperService] Processed PFA data:`, bioData);
      if (bioData.careerHistory && bioData.careerHistory.length > 0) {
        console.log(`[ScraperService] Career history:`, bioData.careerHistory);
      }

      // Check if we actually got useful data - if not, return null to trigger PFR fallback
      const hasUsefulData = bioData.hometown || bioData.homeState || bioData.height || bioData.weight || bioData.college;
      if (!hasUsefulData) {
        console.log(`[ScraperService] PFA returned no useful data for ${playerName}, returning null for fallback`);
        await page.close();
        return null;
      }

      await page.close();
      return bioData as ExtendedBioData;

    } catch (error) {
      console.warn(`[ScraperService] Could not scrape PFA for ${playerName}:`, error);
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
      'cle': 1946, // Cleveland Browns (original 1946-1995, moved to Baltimore as Ravens 1996, reactivated 1999)
      'dal': 1960, // Dallas Cowboys
      'den': 1960, // Denver Broncos
      'det': 1930, // Detroit Lions
      'gnb': 1921, // Green Bay Packers
      'htx': 2002, // Houston Texans (NEW franchise, NOT the Oilers) - PFR uses 'htx'
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
   * Get all teams that existed in a given year
   * Uses the same founding year data as teamExistedInYear
   * @param year - The year to check
   * @returns Array of team abbreviations (lowercase)
   */
  getTeamsForYear(year: number): string[] {
    // Franchise founding years (same as teamExistedInYear)
    const franchiseFoundingYears: { [key: string]: number } = {
      'crd': 1920, // Arizona Cardinals
      'atl': 1966, // Atlanta Falcons
      'rav': 1996, // Baltimore Ravens
      'buf': 1960, // Buffalo Bills
      'car': 1995, // Carolina Panthers
      'chi': 1920, // Chicago Bears
      'cin': 1968, // Cincinnati Bengals
      'cle': 1946, // Cleveland Browns (original 1946-1995, moved to Baltimore as Ravens 1996, reactivated 1999)
      'dal': 1960, // Dallas Cowboys
      'den': 1960, // Denver Broncos
      'det': 1930, // Detroit Lions
      'gnb': 1921, // Green Bay Packers
      'htx': 2002, // Houston Texans - PFR uses 'htx'
      'clt': 1953, // Indianapolis Colts
      'jax': 1995, // Jacksonville Jaguars
      'kan': 1960, // Kansas City Chiefs
      'sdg': 1960, // Los Angeles Chargers
      'ram': 1937, // Los Angeles Rams
      'rai': 1960, // Las Vegas Raiders
      'mia': 1966, // Miami Dolphins
      'min': 1961, // Minnesota Vikings
      'nwe': 1960, // New England Patriots
      'nor': 1967, // New Orleans Saints
      'nyg': 1925, // New York Giants
      'nyj': 1960, // New York Jets
      'phi': 1933, // Philadelphia Eagles
      'pit': 1933, // Pittsburgh Steelers
      'sea': 1976, // Seattle Seahawks
      'sfo': 1950, // San Francisco 49ers
      'tam': 1976, // Tampa Bay Buccaneers
      'oti': 1960, // Tennessee Titans
      'was': 1932  // Washington Commanders
    };

    // Return all teams that existed in the given year
    const existingTeams: string[] = [];
    for (const [abbr, foundingYear] of Object.entries(franchiseFoundingYears)) {
      if (year >= foundingYear) {
        existingTeams.push(abbr);
      }
    }

    console.log(`[ScraperService] getTeamsForYear(${year}): Found ${existingTeams.length} teams`);
    return existingTeams;
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

  /**
   * Scrape team roster from JT-SW (PRIMARY - cleaner tables, easier to scrape)
   * Falls back to PFR if JT-SW fails
   * JT-SW has cleaner HTML and is easier to scrape than PFR
   * @param teamCode - JT-SW team code (e.g., 'sf', 'dal', 'gb')
   * @param year - Season year
   * @returns Array of player stats with name + position (get rest from MASTER_LOOKUP)
   */
  async scrapeTeamRosterFromJTSW(teamCode: string, year: number): Promise<PlayerStats[]> {
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();

    try {
      console.log(`[ScraperService] Scraping roster from JT-SW for ${teamCode} (${year})`);

      // Navigate to JT-SW roster page
      const jtswUrl = `https://www.jt-sw.com/football/pro/rosters.nsf/Annual/${year}-${teamCode}`;
      console.log(`[ScraperService] URL: ${jtswUrl}`);

      await page.goto(jtswUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Extract roster from table
      const roster = await page.evaluate(() => {
        const playerList: any[] = [];

        // Find the main roster table
        const table = document.querySelector('table');

        if (!table) {
          return playerList;
        }

        const rows = table.querySelectorAll('tbody tr');

        for (const row of Array.from(rows)) {
          const cells = row.querySelectorAll('td');

          if (cells.length < 3) continue;

          // JT-SW table structure (from WebFetch analysis):
          // Column 0: Position
          // Column 1: Jersey Number
          // Column 2: Player Name
          // Additional columns: GP, GS, College, etc.

          const posCell = cells[0];
          const jerseyCell = cells[1];
          const nameCell = cells[2];

          if (!nameCell || !posCell) continue;

          const playerName = nameCell.textContent?.trim() || '';
          const position = posCell.textContent?.trim() || '';
          const jerseyNum = parseInt(jerseyCell?.textContent?.trim() || '0');

          // Remove HOF indicator (*) from name
          const cleanName = playerName.replace(/\*/g, '').trim();

          if (cleanName && position) {
            playerList.push({
              name: cleanName,
              position: position,
              jerseyNumber: jerseyNum > 0 ? jerseyNum : undefined
            });
          }
        }

        return playerList;
      });

      console.log(`[ScraperService] Scraped ${roster.length} players from JT-SW for ${teamCode} (${year})`);

      await page.close();
      return roster as PlayerStats[];

    } catch (error: any) {
      console.warn(`[ScraperService] JT-SW scrape failed for ${teamCode} (${year}):`, error.message);
      console.log(`[ScraperService] Falling back to PFR scraping...`);
      await page.close();

      // FALLBACK: Use existing PFR scraper
      // Map JT-SW team code to PFR team code (they're usually the same)
      return this.scrapeTeamRoster(teamCode, year);
    }
  }

  /**
   * Scrape all player stats for a given season from PFR season pages
   * Much more reliable than per-player scraping - gets ALL players in one pass
   *
   * URLs scraped:
   * - /years/{year}/passing.htm - All QB passing stats
   * - /years/{year}/rushing.htm - All rushing stats
   * - /years/{year}/receiving.htm - All receiving stats
   * - /years/{year}/defense.htm - All defensive stats
   *
   * @param year - The NFL season year
   * @returns Map of player name -> PlayerStats
   */
  async scrapeSeasonStats(year: number): Promise<Map<string, PlayerStats>> {
    // Check cache first
    if (this.seasonStatsCache.has(year)) {
      console.log(`[ScraperService] Using cached season stats for ${year}`);
      return this.seasonStatsCache.get(year)!;
    }

    await this.initBrowser();
    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const statsMap = new Map<string, PlayerStats>();
    const page = await this.browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
      console.log(`[ScraperService] Scraping season stats for ${year}...`);

      // Scrape passing stats
      console.log(`[ScraperService] Scraping passing stats for ${year}...`);
      await this.scrapeSeasonPage(page, year, 'passing', statsMap);
      await this.delay(1500); // Be nice to the server

      // Scrape rushing stats
      console.log(`[ScraperService] Scraping rushing stats for ${year}...`);
      await this.scrapeSeasonPage(page, year, 'rushing', statsMap);
      await this.delay(1500);

      // Scrape receiving stats
      console.log(`[ScraperService] Scraping receiving stats for ${year}...`);
      await this.scrapeSeasonPage(page, year, 'receiving', statsMap);
      await this.delay(1500);

      // Scrape defensive stats
      console.log(`[ScraperService] Scraping defense stats for ${year}...`);
      await this.scrapeSeasonPage(page, year, 'defense', statsMap);
      await this.delay(1500);

      // Scrape kicking stats
      console.log(`[ScraperService] Scraping kicking stats for ${year}...`);
      await this.scrapeSeasonPage(page, year, 'kicking', statsMap);
      await this.delay(1500);

      // Scrape punting stats
      console.log(`[ScraperService] Scraping punting stats for ${year}...`);
      await this.scrapeSeasonPage(page, year, 'punting', statsMap);
      await this.delay(1500);

      // Scrape return stats
      console.log(`[ScraperService] Scraping returns stats for ${year}...`);
      await this.scrapeSeasonPage(page, year, 'returns', statsMap);
      await this.delay(1500);

      // Scrape scrimmage stats (combined rushing + receiving - useful for OVR)
      console.log(`[ScraperService] Scraping scrimmage stats for ${year}...`);
      await this.scrapeSeasonPage(page, year, 'scrimmage', statsMap);
      await this.delay(1500);

      // Scrape scoring stats (useful for OVR)
      console.log(`[ScraperService] Scraping scoring stats for ${year}...`);
      await this.scrapeSeasonPage(page, year, 'scoring', statsMap);

      console.log(`[ScraperService] Season ${year}: Scraped stats for ${statsMap.size} unique players`);

      // Cache the results
      this.seasonStatsCache.set(year, statsMap);

      await page.close();
      return statsMap;

    } catch (error: any) {
      console.error(`[ScraperService] Error scraping season stats for ${year}:`, error);
      await page.close();
      return statsMap; // Return what we got
    }
  }

  /**
   * Scrape a specific season stats page
   * Supports: passing, rushing, receiving, defense, kicking, punting, returns, scrimmage, scoring
   */
  private async scrapeSeasonPage(
    page: Page,
    year: number,
    statType: 'passing' | 'rushing' | 'receiving' | 'defense' | 'kicking' | 'punting' | 'returns' | 'scrimmage' | 'scoring',
    statsMap: Map<string, PlayerStats>
  ): Promise<void> {
    const url = `https://www.pro-football-reference.com/years/${year}/${statType}.htm`;

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for table to load
      await page.waitForSelector('table#' + statType, { timeout: 10000 }).catch(() => {
        // Some years might have different table IDs
        console.log(`[ScraperService] Table #${statType} not found, trying alternate selectors`);
      });

      const players = await page.evaluate((statType) => {
        const results: any[] = [];

        // Find the main stats table
        const table = document.querySelector(`table#${statType}`) ||
                      document.querySelector('table.stats_table') ||
                      document.querySelector('#all_' + statType + ' table');

        if (!table) {
          console.log('No stats table found for', statType);
          return results;
        }

        const rows = table.querySelectorAll('tbody tr:not(.thead)');

        for (const row of Array.from(rows)) {
          // Skip header rows within tbody
          if (row.classList.contains('thead') || row.querySelector('th[colspan]')) continue;

          const playerLink = row.querySelector('td[data-stat="player"] a');
          if (!playerLink) continue;

          const name = playerLink.textContent?.trim() || '';
          if (!name) continue;

          const playerData: any = { name };

          // Get team
          const teamCell = row.querySelector('td[data-stat="team"]');
          if (teamCell) playerData.team = teamCell.textContent?.trim();

          // Get position
          const posCell = row.querySelector('td[data-stat="pos"]');
          if (posCell) playerData.position = posCell.textContent?.trim();

          // Get age
          const ageCell = row.querySelector('td[data-stat="age"]');
          if (ageCell) playerData.age = parseInt(ageCell.textContent?.trim() || '0');

          // Get games played
          const gamesCell = row.querySelector('td[data-stat="g"]');
          if (gamesCell) playerData.gamesPlayed = parseInt(gamesCell.textContent?.trim() || '0');

          // Extract stat-specific data
          if (statType === 'passing') {
            const getValue = (stat: string) => {
              const cell = row.querySelector(`td[data-stat="${stat}"]`);
              return cell ? cell.textContent?.trim() : null;
            };
            playerData.passAttempts = parseInt(getValue('pass_att') || '0');
            playerData.passCompletions = parseInt(getValue('pass_cmp') || '0');
            playerData.passYards = parseInt(getValue('pass_yds')?.replace(/,/g, '') || '0');
            playerData.passTDs = parseInt(getValue('pass_td') || '0');
            playerData.interceptions = parseInt(getValue('pass_int') || '0');
            playerData.passerRating = parseFloat(getValue('pass_rating') || '0');
          }

          if (statType === 'rushing') {
            const getValue = (stat: string) => {
              const cell = row.querySelector(`td[data-stat="${stat}"]`);
              return cell ? cell.textContent?.trim() : null;
            };
            playerData.rushAttempts = parseInt(getValue('rush_att') || '0');
            playerData.rushYards = parseInt(getValue('rush_yds')?.replace(/,/g, '') || '0');
            playerData.rushTDs = parseInt(getValue('rush_td') || '0');
            playerData.rushYPC = parseFloat(getValue('rush_yds_per_att') || '0');
          }

          if (statType === 'receiving') {
            const getValue = (stat: string) => {
              const cell = row.querySelector(`td[data-stat="${stat}"]`);
              return cell ? cell.textContent?.trim() : null;
            };
            playerData.targets = parseInt(getValue('targets') || '0');
            playerData.receptions = parseInt(getValue('rec') || '0');
            playerData.recYards = parseInt(getValue('rec_yds')?.replace(/,/g, '') || '0');
            playerData.recTDs = parseInt(getValue('rec_td') || '0');
            playerData.recYPC = parseFloat(getValue('rec_yds_per_rec') || '0');
          }

          if (statType === 'defense') {
            const getValue = (stat: string) => {
              const cell = row.querySelector(`td[data-stat="${stat}"]`);
              return cell ? cell.textContent?.trim() : null;
            };
            playerData.tackles = parseInt(getValue('tackles_combined') || getValue('tackles_solo') || '0');
            playerData.tacklesSolo = parseInt(getValue('tackles_solo') || '0');
            playerData.tacklesAssist = parseInt(getValue('tackles_assists') || '0');
            playerData.sacks = parseFloat(getValue('sacks') || '0');
            playerData.interceptionsCaught = parseInt(getValue('def_int') || '0');
            playerData.passDefended = parseInt(getValue('pass_defended') || '0');
            playerData.forcedFumbles = parseInt(getValue('fumbles_forced') || '0');
            playerData.fumblesRecovered = parseInt(getValue('fumbles_rec') || '0');
          }

          if (statType === 'kicking') {
            const getValue = (stat: string) => {
              const cell = row.querySelector(`td[data-stat="${stat}"]`);
              return cell ? cell.textContent?.trim() : null;
            };
            playerData.fgAttempts = parseInt(getValue('fga') || '0');
            playerData.fgMade = parseInt(getValue('fgm') || '0');
            playerData.fgPct = parseFloat(getValue('fg_perc') || '0');
            playerData.fgLong = parseInt(getValue('fg_long') || '0');
            playerData.xpAttempts = parseInt(getValue('xpa') || '0');
            playerData.xpMade = parseInt(getValue('xpm') || '0');
            playerData.xpPct = parseFloat(getValue('xp_perc') || '0');
            playerData.kickingPoints = parseInt(getValue('kick_points') || '0');
          }

          if (statType === 'punting') {
            const getValue = (stat: string) => {
              const cell = row.querySelector(`td[data-stat="${stat}"]`);
              return cell ? cell.textContent?.trim() : null;
            };
            playerData.punts = parseInt(getValue('punt') || '0');
            playerData.puntYards = parseInt(getValue('punt_yds')?.replace(/,/g, '') || '0');
            playerData.puntAvg = parseFloat(getValue('punt_yds_per_punt') || '0');
            playerData.puntLong = parseInt(getValue('punt_long') || '0');
            playerData.puntBlocked = parseInt(getValue('punt_blocked') || '0');
            playerData.puntIn20 = parseInt(getValue('punt_in20') || '0');
            playerData.puntTouchbacks = parseInt(getValue('punt_touchback') || '0');
          }

          if (statType === 'returns') {
            const getValue = (stat: string) => {
              const cell = row.querySelector(`td[data-stat="${stat}"]`);
              return cell ? cell.textContent?.trim() : null;
            };
            // Punt returns
            playerData.puntReturns = parseInt(getValue('punt_ret') || '0');
            playerData.puntReturnYards = parseInt(getValue('punt_ret_yds')?.replace(/,/g, '') || '0');
            playerData.puntReturnTDs = parseInt(getValue('punt_ret_td') || '0');
            playerData.puntReturnLong = parseInt(getValue('punt_ret_long') || '0');
            playerData.puntReturnAvg = parseFloat(getValue('punt_ret_yds_per_ret') || '0');
            // Kick returns
            playerData.kickReturns = parseInt(getValue('kick_ret') || '0');
            playerData.kickReturnYards = parseInt(getValue('kick_ret_yds')?.replace(/,/g, '') || '0');
            playerData.kickReturnTDs = parseInt(getValue('kick_ret_td') || '0');
            playerData.kickReturnLong = parseInt(getValue('kick_ret_long') || '0');
            playerData.kickReturnAvg = parseFloat(getValue('kick_ret_yds_per_ret') || '0');
          }

          if (statType === 'scrimmage') {
            const getValue = (stat: string) => {
              const cell = row.querySelector(`td[data-stat="${stat}"]`);
              return cell ? cell.textContent?.trim() : null;
            };
            // Total yards from scrimmage (rushing + receiving combined)
            playerData.scrimmageYards = parseInt(getValue('yds_from_scrimmage')?.replace(/,/g, '') || '0');
            playerData.scrimmageTDs = parseInt(getValue('rush_receive_td') || '0');
            playerData.touches = parseInt(getValue('touches') || '0');
            playerData.yardsPerTouch = parseFloat(getValue('yds_per_touch') || '0');
          }

          if (statType === 'scoring') {
            const getValue = (stat: string) => {
              const cell = row.querySelector(`td[data-stat="${stat}"]`);
              return cell ? cell.textContent?.trim() : null;
            };
            // Total scoring - useful for OVR calculations
            playerData.totalTDs = parseInt(getValue('all_td') || '0');
            playerData.rushingTDsScoring = parseInt(getValue('rush_td') || '0');
            playerData.receivingTDsScoring = parseInt(getValue('rec_td') || '0');
            playerData.returnTDs = parseInt(getValue('ret_td') || '0');
            playerData.totalPoints = parseInt(getValue('pts') || '0');
            playerData.twoPointConversions = parseInt(getValue('two_pt_md') || '0');
          }

          results.push(playerData);
        }

        return results;
      }, statType);

      console.log(`[ScraperService] Found ${players.length} players in ${statType} stats for ${year}`);

      // Merge into statsMap
      for (const player of players) {
        const existing = statsMap.get(player.name);
        if (existing) {
          // Merge stats - keep existing non-zero values, add new ones
          statsMap.set(player.name, { ...existing, ...player });
        } else {
          statsMap.set(player.name, player as PlayerStats);
        }
      }

    } catch (error: any) {
      console.error(`[ScraperService] Error scraping ${statType} for ${year}:`, error.message);
    }
  }

  /**
   * Normalize a player name for matching
   * Removes suffixes like Jr., III, Sr., etc. and standardizes format
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, '')  // Remove suffixes
      .replace(/[.']/g, '')  // Remove periods and apostrophes
      .replace(/\s+/g, ' ')  // Normalize spaces
      .trim();
  }

  /**
   * Get stats for a specific player from pre-scraped season data
   * Call scrapeSeasonStats first to populate the cache
   *
   * @param playerName - Player name to search for
   * @param year - Season year
   * @param position - Optional position to disambiguate (e.g., "HB", "QB")
   * @param team - Optional team abbreviation to disambiguate (e.g., "MIN", "CHI")
   */
  async getPlayerStatsFromSeason(
    playerName: string,
    year: number,
    position?: string,
    team?: string
  ): Promise<PlayerStats | null> {
    // Ensure we have the season data
    if (!this.seasonStatsCache.has(year)) {
      await this.scrapeSeasonStats(year);
    }

    const seasonStats = this.seasonStatsCache.get(year);
    if (!seasonStats) return null;

    const normalizedSearch = this.normalizeName(playerName);
    const searchParts = normalizedSearch.split(' ');
    const searchFirst = searchParts[0];
    const searchLast = searchParts[searchParts.length - 1];

    // Collect all potential matches with scores
    const matches: { stats: PlayerStats; score: number }[] = [];

    for (const [name, stats] of seasonStats.entries()) {
      const normalizedName = this.normalizeName(name);
      const nameParts = normalizedName.split(' ');
      const nameFirst = nameParts[0];
      const nameLast = nameParts[nameParts.length - 1];

      let score = 0;

      // Exact normalized match = highest score
      if (normalizedName === normalizedSearch) {
        score = 100;
      }
      // First and last name match
      else if (nameFirst === searchFirst && nameLast === searchLast) {
        score = 80;
      }
      // Last name only match (for common nicknames like "A.J." vs "Adrian")
      else if (nameLast === searchLast) {
        // Check if first initial matches
        if (nameFirst[0] === searchFirst[0]) {
          score = 60;
        } else {
          score = 30;
        }
      }

      if (score > 0) {
        // Boost score if position matches
        if (position && stats.position) {
          const normPos = position.toUpperCase();
          const statsPos = stats.position.toUpperCase();
          // Handle position variations (HB/RB, LOLB/OLB, etc.)
          if (statsPos === normPos ||
              (normPos === 'HB' && statsPos === 'RB') ||
              (normPos === 'RB' && statsPos === 'HB') ||
              (normPos.includes('OLB') && statsPos.includes('LB')) ||
              (normPos.includes('ILB') && statsPos.includes('LB'))) {
            score += 20;
          } else {
            score -= 30; // Penalize position mismatch
          }
        }

        // Boost score if team matches
        if (team && stats.team) {
          const normTeam = team.toUpperCase();
          const statsTeam = stats.team.toUpperCase();
          if (statsTeam === normTeam || statsTeam.includes(normTeam) || normTeam.includes(statsTeam)) {
            score += 15;
          }
        }

        if (score > 0) {
          matches.push({ stats, score });
        }
      }
    }

    // Sort by score descending and return best match
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);

      // Log if there were multiple matches (potential disambiguation needed)
      if (matches.length > 1 && matches[0].score === matches[1].score) {
        console.log(`[ScraperService] Multiple matches for "${playerName}" in ${year}:`,
          matches.slice(0, 3).map(m => `${m.stats.name} (${m.stats.position}/${m.stats.team}) score=${m.score}`));
      }

      return matches[0].stats;
    }

    return null;
  }

  /**
   * Get all matching players (for disambiguation UI)
   */
  async getAllMatchingPlayers(
    playerName: string,
    year: number
  ): Promise<PlayerStats[]> {
    if (!this.seasonStatsCache.has(year)) {
      await this.scrapeSeasonStats(year);
    }

    const seasonStats = this.seasonStatsCache.get(year);
    if (!seasonStats) return [];

    const normalizedSearch = this.normalizeName(playerName);
    const searchParts = normalizedSearch.split(' ');
    const searchLast = searchParts[searchParts.length - 1];

    const matches: PlayerStats[] = [];

    for (const [name, stats] of seasonStats.entries()) {
      const normalizedName = this.normalizeName(name);
      const nameParts = normalizedName.split(' ');
      const nameLast = nameParts[nameParts.length - 1];

      // Match on full normalized name or last name
      if (normalizedName === normalizedSearch || nameLast === searchLast) {
        matches.push(stats);
      }
    }

    return matches;
  }

  /**
   * Clear the season stats cache
   */
  clearSeasonStatsCache(): void {
    this.seasonStatsCache.clear();
    console.log('[ScraperService] Season stats cache cleared');
  }

  /**
   * Get cached season years
   */
  getCachedSeasons(): number[] {
    return Array.from(this.seasonStatsCache.keys());
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const scraperService = new ScraperService();
