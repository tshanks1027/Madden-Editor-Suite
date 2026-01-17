/**
 * Logo Handlers
 *
 * IPC handlers for team logo import/export operations.
 * Includes Wikimedia Commons logo scraping functionality.
 */

import { ipcMain, dialog } from 'electron';
import { teamLogoExportService, LogoType, LOGO_TYPES } from '../services/TeamLogoExportService';
import { logoScraperService } from '../services/LogoScraperService';

export function registerLogoHandlers(): void {
  /**
   * Get teams for a specific year with logo info
   */
  ipcMain.handle('logo:getTeamsForYear', async (_event, year: number) => {
    try {
      const teams = teamLogoExportService.getTeamsForYear(year);
      return { success: true, teams };
    } catch (error) {
      console.error('Error getting teams for year:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Get all abbreviations that need custom logos
   */
  ipcMain.handle('logo:getAbbreviationsNeedingLogos', async () => {
    try {
      const abbreviations = teamLogoExportService.getAbbreviationsNeedingLogos();
      return { success: true, abbreviations };
    } catch (error) {
      console.error('Error getting abbreviations:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Get logo types available
   */
  ipcMain.handle('logo:getLogoTypes', async () => {
    return { success: true, logoTypes: LOGO_TYPES };
  });

  /**
   * Import a logo file
   */
  ipcMain.handle('logo:importLogo', async (_event, abbreviation: string, logoType: LogoType) => {
    try {
      // Show file picker
      const result = await dialog.showOpenDialog({
        title: `Import ${logoType} logo for ${abbreviation}`,
        filters: [
          { name: 'Logo Files', extensions: ['dds', 'png'] },
          { name: 'DDS Files', extensions: ['dds'] },
          { name: 'PNG Files', extensions: ['png'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const importResult = await teamLogoExportService.importLogo(abbreviation, logoType, result.filePaths[0]);
      return importResult;
    } catch (error) {
      console.error('Error importing logo:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Import logo from a specific path (no dialog)
   */
  ipcMain.handle('logo:importLogoFromPath', async (_event, abbreviation: string, logoType: LogoType, sourcePath: string) => {
    try {
      const result = await teamLogoExportService.importLogo(abbreviation, logoType, sourcePath);
      return result;
    } catch (error) {
      console.error('Error importing logo from path:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Get path to a specific logo
   */
  ipcMain.handle('logo:getLogoPath', async (_event, abbreviation: string, logoType: LogoType) => {
    try {
      const logoPath = teamLogoExportService.getLogoPath(abbreviation, logoType);
      return { success: true, path: logoPath };
    } catch (error) {
      console.error('Error getting logo path:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Check if a logo exists
   */
  ipcMain.handle('logo:hasLogo', async (_event, abbreviation: string, logoType: LogoType) => {
    try {
      const exists = teamLogoExportService.hasLogo(abbreviation, logoType);
      return { success: true, exists };
    } catch (error) {
      console.error('Error checking logo:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Get all logos for a team abbreviation
   */
  ipcMain.handle('logo:getLogosForTeam', async (_event, abbreviation: string) => {
    try {
      const logos = teamLogoExportService.getLogosForTeam(abbreviation);
      return { success: true, logos };
    } catch (error) {
      console.error('Error getting logos for team:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Delete a logo
   */
  ipcMain.handle('logo:deleteLogo', async (_event, abbreviation: string, logoType: LogoType) => {
    try {
      const deleted = teamLogoExportService.deleteLogo(abbreviation, logoType);
      return { success: deleted };
    } catch (error) {
      console.error('Error deleting logo:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Export logos for Frosty
   */
  ipcMain.handle('logo:exportForFrosty', async (_event, year: number) => {
    try {
      // Show folder picker
      const result = await dialog.showOpenDialog({
        title: `Select output folder for ${year} logos`,
        properties: ['openDirectory', 'createDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const outputDir = result.filePaths[0];
      const exportResult = await teamLogoExportService.exportForFrosty(year, outputDir);
      return exportResult;
    } catch (error) {
      console.error('Error exporting for Frosty:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Export logos to a specific path (no dialog)
   */
  ipcMain.handle('logo:exportForFrostyToPath', async (_event, year: number, outputDir: string) => {
    try {
      const result = await teamLogoExportService.exportForFrosty(year, outputDir);
      return result;
    } catch (error) {
      console.error('Error exporting for Frosty:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Export logos for MFT (Madden Franchise Tool)
   */
  ipcMain.handle('logo:exportForMFT', async (_event, year: number) => {
    try {
      const result = await dialog.showOpenDialog({
        title: `Select output folder for ${year} MFT logos`,
        properties: ['openDirectory', 'createDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const outputDir = result.filePaths[0];
      const exportResult = await teamLogoExportService.exportForMFT(year, outputDir);
      return exportResult;
    } catch (error) {
      console.error('Error exporting for MFT:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Get logo summary statistics
   */
  ipcMain.handle('logo:getSummary', async () => {
    try {
      const summary = teamLogoExportService.getLogoSummary();
      return { success: true, summary };
    } catch (error) {
      console.error('Error getting logo summary:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // =====================================================
  // Logo Scraper Handlers (Wikimedia Commons)
  // =====================================================

  /**
   * Search for available logos on Wikimedia Commons
   */
  ipcMain.handle('logo:scrapeSearch', async (_event, abbreviations: string[]) => {
    try {
      console.log('[logo-handlers] Searching Wikimedia for logos:', abbreviations);
      const results = await logoScraperService.searchAvailableLogos(abbreviations);
      return { success: true, results };
    } catch (error) {
      console.error('Error searching for logos:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Scrape a single team logo from Wikimedia
   */
  ipcMain.handle('logo:scrapeSingle', async (_event, abbreviation: string, year?: number) => {
    try {
      console.log(`[logo-handlers] Scraping logo for ${abbreviation}${year ? ` (${year})` : ''}`);
      const result = await logoScraperService.scrapeTeamLogo(abbreviation, year);
      return result;
    } catch (error) {
      console.error('Error scraping logo:', error);
      return { success: false, abbreviation, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Download logos for a year from SportsLogos.net database
   */
  ipcMain.handle('logo:scrapeForYear', async (_event, year: number, abbreviations: string[]) => {
    try {
      console.log(`[logo-handlers] Downloading logos for year ${year}:`, abbreviations);
      // Service returns { success, results } directly
      return await logoScraperService.scrapeLogosForYear(year, abbreviations);
    } catch (error) {
      console.error('Error downloading logos for year:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * List all downloaded logos
   */
  ipcMain.handle('logo:listDownloaded', async () => {
    try {
      const logos = logoScraperService.listDownloadedLogos();
      return { success: true, logos };
    } catch (error) {
      console.error('Error listing downloaded logos:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Check if a scraped logo exists
   */
  ipcMain.handle('logo:hasScrapedLogo', async (_event, abbreviation: string) => {
    try {
      const exists = logoScraperService.hasLogo(abbreviation);
      return { success: true, exists };
    } catch (error) {
      console.error('Error checking scraped logo:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Get path to scraped logo
   */
  ipcMain.handle('logo:getScrapedLogoPath', async (_event, abbreviation: string) => {
    try {
      const logoPath = logoScraperService.getLogoPath(abbreviation);
      return { success: true, path: logoPath };
    } catch (error) {
      console.error('Error getting scraped logo path:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Get the logos base path
   */
  ipcMain.handle('logo:getLogosBasePath', async () => {
    try {
      const basePath = logoScraperService.getLogosBasePath();
      return { success: true, path: basePath };
    } catch (error) {
      console.error('Error getting logos base path:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  console.log('Logo handlers registered');
}
