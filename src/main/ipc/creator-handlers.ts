/**
 * Creator IPC Handlers
 *
 * Handles IPC communication between renderer and main process
 * for roster/draft class creator operations.
 */

import { ipcMain } from 'electron';

/**
 * Register all creator IPC handlers
 */
export function registerCreatorHandlers(): void {
  console.log('[CreatorHandlers] Registering creator IPC handlers');

  /**
   * Generate draft class from web scraping
   */
  ipcMain.handle('creator:generate-draft-class', async (event, year: number, testingMode: boolean = false) => {
    try {
      console.log(`[CreatorHandlers] Generating draft class for ${year} (Testing Mode: ${testingMode})`);

      // Lazy load to avoid loading Puppeteer until first use
      const { creatorService } = await import('../services/CreatorService');
      const players = await creatorService.generateDraftClass(year, testingMode);

      // DEBUG: Log first player data BEFORE sending to renderer
      if (players.length > 0) {
        const firstPlayer = players[0];
        console.log(`[CreatorHandlers] ========== IPC HANDLER FIRST PLAYER ==========`);
        console.log(`[CreatorHandlers] Name: ${firstPlayer.firstName} ${firstPlayer.lastName}`);
        console.log(`[CreatorHandlers] Position: ${firstPlayer.position} (code ${firstPlayer.positionCode})`);
        console.log(`[CreatorHandlers] College ID: ${firstPlayer.college}, HomeState ID: ${firstPlayer.homeState}, Body Type: ${firstPlayer.bodyType}`);
        console.log(`[CreatorHandlers] COD: ${firstPlayer.ratings.changeOfDirection}, TGH: ${firstPlayer.ratings.toughness}, LS: ${firstPlayer.ratings.longSnap}`);
        console.log(`[CreatorHandlers] PBS: ${firstPlayer.ratings.passBlockPower}, PBF: ${firstPlayer.ratings.passBlockFinesse}`);
        console.log(`[CreatorHandlers] RBS: ${firstPlayer.ratings.runBlockPower}, RBF: ${firstPlayer.ratings.runBlockFinesse}`);
        console.log(`[CreatorHandlers] ================================================`);
      }

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

      // Lazy load to avoid loading Puppeteer until first use
      const { creatorService } = await import('../services/CreatorService');
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

      // Lazy load to avoid loading Puppeteer until first use
      const { scraperService } = await import('../services/ScraperService');
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
