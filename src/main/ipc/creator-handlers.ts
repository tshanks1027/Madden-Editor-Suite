/**
 * Creator IPC Handlers
 *
 * Handles IPC communication between renderer and main process
 * for roster/draft class creator operations.
 */

import { ipcMain } from 'electron';
import { creatorService } from '../services/CreatorService';

/**
 * Register all creator IPC handlers
 */
export function registerCreatorHandlers(): void {
  console.log('[CreatorHandlers] Registering creator IPC handlers');

  /**
   * Generate draft class from web scraping
   */
  ipcMain.handle('creator:generate-draft-class', async (event, year: number) => {
    try {
      console.log(`[CreatorHandlers] Generating draft class for ${year}`);

      const players = await creatorService.generateDraftClass(year);

      return {
        success: true,
        players,
        count: players.length
      };

    } catch (error: any) {
      console.error('[CreatorHandlers] Error generating draft class:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Generate roster from web scraping
   */
  ipcMain.handle('creator:generate-roster', async (event, year: number, teams: string[]) => {
    try {
      console.log(`[CreatorHandlers] Generating roster for ${year} (${teams.length} teams)`);

      const players = await creatorService.generateRoster(year, teams);

      return {
        success: true,
        players,
        count: players.length
      };

    } catch (error: any) {
      console.error('[CreatorHandlers] Error generating roster:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Test scraper connection (verify web scraping is working)
   */
  ipcMain.handle('creator:test-scraper', async (event, year: number) => {
    try {
      console.log(`[CreatorHandlers] Testing scraper with year ${year}`);

      // Try to scrape just 5 prospects as a test
      const { scraperService } = require('../services/ScraperService');
      const prospects = await scraperService.scrapeDraftClass(year);
      await scraperService.closeBrowser();

      return {
        success: true,
        prospectCount: prospects.length,
        message: `Successfully scraped ${prospects.length} prospects`
      };

    } catch (error: any) {
      console.error('[CreatorHandlers] Error testing scraper:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  console.log('[CreatorHandlers] Creator IPC handlers registered');
}
