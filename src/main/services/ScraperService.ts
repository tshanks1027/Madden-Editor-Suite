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
      // Enrich with HOF data if not already present
      if (!prospect.height) prospect.height = hofData.height;
      if (!prospect.weight) prospect.weight = hofData.weight;
      if (!prospect.homeState) prospect.homeState = hofData.birthState;

      console.log(`[ScraperService] Enriched HOFer ${prospect.name} with bio data from lookup: ${hofData.height}, ${hofData.weight}lb, ${hofData.birthState}`);
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
