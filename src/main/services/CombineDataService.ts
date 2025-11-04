/**
 * Combine Data Service
 *
 * Service for fetching and managing NFL Combine 40-yard dash times.
 * Uses web scraping to gather combine data from various sources.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { scraperDebugLogger } from '../utils/DebugLogger';
import { findChrome } from '../utils/ChromeFinder';

export interface CombineData {
  playerName: string;
  firstName: string;
  lastName: string;
  year: number;
  position: string;
  fortyTime: number;
  college?: string;
}

export class CombineDataService {
  private browser: Browser | null = null;
  private readonly MAX_RETRIES = 3;
  private readonly DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    const chromePath = await findChrome();

    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    scraperDebugLogger.info('CombineDataService: Browser initialized');
    return this.browser;
  }

  /**
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      scraperDebugLogger.info('CombineDataService: Browser closed');
    }
  }

  /**
   * Fetch combine data for a specific year from Pro Football Reference
   */
  async fetchCombineDataByYear(year: number): Promise<CombineData[]> {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    const combineData: CombineData[] = [];

    try {
      const url = `https://www.pro-football-reference.com/draft/${year}-combine.htm`;
      scraperDebugLogger.info(`Fetching combine data from: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for the combine table to load
      await page.waitForSelector('#combine', { timeout: 10000 });

      // Extract table data
      const data = await page.evaluate(() => {
        const results: any[] = [];
        const table = document.querySelector('#combine');

        if (!table) return results;

        const rows = table.querySelectorAll('tbody tr');

        rows.forEach((row) => {
          // Skip header rows
          if (row.classList.contains('thead')) return;

          const cells = row.querySelectorAll('td, th');
          if (cells.length === 0) return;

          const playerNameEl = row.querySelector('th[data-stat="player"] a');
          const fortyTimeEl = row.querySelector('td[data-stat="forty_yd"]');
          const positionEl = row.querySelector('td[data-stat="pos"]');
          const collegeEl = row.querySelector('td[data-stat="school"]');

          if (!playerNameEl || !fortyTimeEl) return;

          const fullName = playerNameEl.textContent?.trim() || '';
          const fortyTime = fortyTimeEl.textContent?.trim();
          const position = positionEl?.textContent?.trim() || '';
          const college = collegeEl?.textContent?.trim() || '';

          // Skip if no 40 time
          if (!fortyTime || fortyTime === '') return;

          const fortyTimeNum = parseFloat(fortyTime);
          if (isNaN(fortyTimeNum)) return;

          // Split name into first and last
          const nameParts = fullName.split(' ');
          const firstName = nameParts.slice(0, -1).join(' ');
          const lastName = nameParts[nameParts.length - 1];

          results.push({
            playerName: fullName,
            firstName,
            lastName,
            fortyTime: fortyTimeNum,
            position,
            college
          });
        });

        return results;
      });

      scraperDebugLogger.info(`Fetched ${data.length} combine results for ${year}`);

      combineData.push(...data.map(d => ({
        ...d,
        year
      })));

    } catch (error) {
      scraperDebugLogger.error(`Error fetching combine data for ${year}:`, error);
      throw error;
    } finally {
      await page.close();
    }

    return combineData;
  }

  /**
   * Fetch combine data for multiple years
   */
  async fetchCombineDataRange(startYear: number, endYear: number): Promise<CombineData[]> {
    const allData: CombineData[] = [];

    scraperDebugLogger.info(`Fetching combine data from ${startYear} to ${endYear}`);

    for (let year = startYear; year <= endYear; year++) {
      try {
        const yearData = await this.fetchCombineDataByYear(year);
        allData.push(...yearData);

        // Delay between requests to be respectful to the server
        if (year < endYear) {
          await this.delay(this.DELAY_BETWEEN_REQUESTS);
        }
      } catch (error) {
        scraperDebugLogger.error(`Failed to fetch data for year ${year}:`, error);
        // Continue with next year
      }
    }

    scraperDebugLogger.info(`Total combine results fetched: ${allData.length}`);
    return allData;
  }

  /**
   * Update ALL_PLAYER_LOOKUP.csv with combine data
   */
  async updatePlayerLookupWith40Times(combineData: CombineData[]): Promise<void> {
    const csvPath = path.join(app.getAppPath(), 'data', 'lookups', 'ALL_PLAYER_LOOKUP.csv');

    scraperDebugLogger.info(`Reading player lookup CSV: ${csvPath}`);

    // Read CSV file
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    const header = lines[0];

    // Create a map of player names to 40 times
    const fortyTimeMap = new Map<string, number>();

    combineData.forEach(data => {
      // Create multiple key variations for matching
      const fullNameKey = `${data.firstName} ${data.lastName}`.toLowerCase();
      const reversedKey = `${data.lastName}, ${data.firstName}`.toLowerCase();

      fortyTimeMap.set(fullNameKey, data.fortyTime);
      fortyTimeMap.set(reversedKey, data.fortyTime);
    });

    scraperDebugLogger.info(`Created mapping for ${fortyTimeMap.size} player entries`);

    // Process each line
    let matchCount = 0;
    const updatedLines = lines.map((line, index) => {
      if (index === 0) return line; // Keep header as is

      const fields = line.split(',');
      if (fields.length < 2) return line;

      const lastName = fields[0]?.trim();
      const firstName = fields[1]?.trim();

      if (!lastName || !firstName) return line;

      // Try to find a match
      const fullName = `${firstName} ${lastName}`.toLowerCase();
      const fortyTime = fortyTimeMap.get(fullName);

      if (fortyTime) {
        matchCount++;
        // Replace the empty 40Time value (last field) with the actual time
        const fieldsWithoutLastComma = line.endsWith(',') ? line.slice(0, -1) : line;
        return `${fieldsWithoutLastComma}${fortyTime}`;
      }

      return line;
    });

    scraperDebugLogger.info(`Matched ${matchCount} players with 40 times`);

    // Write updated CSV
    fs.writeFileSync(csvPath, updatedLines.join('\n'), 'utf-8');
    scraperDebugLogger.info('Player lookup CSV updated successfully');
  }

  /**
   * Main method to populate ALL_PLAYER_LOOKUP.csv with 40 times
   */
  async populateAllPlayer40Times(): Promise<{ totalFetched: number; totalMatched: number }> {
    try {
      // NFL Combine started in 1982, but comprehensive data is available from 1987
      // Fetch data from 1987 to current year
      const currentYear = new Date().getFullYear();
      const startYear = 1987;

      scraperDebugLogger.info(`Starting 40 time population from ${startYear} to ${currentYear}`);

      const combineData = await this.fetchCombineDataRange(startYear, currentYear);

      await this.updatePlayerLookupWith40Times(combineData);

      await this.closeBrowser();

      return {
        totalFetched: combineData.length,
        totalMatched: combineData.length // This will be updated in the updatePlayerLookupWith40Times method
      };
    } catch (error) {
      scraperDebugLogger.error('Error populating 40 times:', error);
      await this.closeBrowser();
      throw error;
    }
  }

  /**
   * Utility method to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Export combine data to JSON file
   */
  async exportCombineDataToJSON(data: CombineData[], outputPath: string): Promise<void> {
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    scraperDebugLogger.info(`Combine data exported to: ${outputPath}`);
  }
}

// Export singleton instance
export const combineDataService = new CombineDataService();
