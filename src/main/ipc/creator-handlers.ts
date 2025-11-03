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
  ipcMain.handle('creator:generate-draft-class', async (event, year: number, testingMode: boolean = false, ratingMode: string = 'semi-historical') => {
    try {
      console.log(`[CreatorHandlers] Generating draft class for ${year} (Testing Mode: ${testingMode}, Rating Mode: ${ratingMode})`);

      // Lazy load to avoid loading Puppeteer until first use
      const { creatorService } = await import('../services/CreatorService');
      const players = await creatorService.generateDraftClass(year, testingMode, undefined, ratingMode);

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
  ipcMain.handle('creator:generate-roster', async (event, year: number, teams: string[], ratingMode: string = 'semi-historical') => {
    try {
      console.log(`[CreatorHandlers] Generating roster for ${year} (${teams.length} teams, Rating Mode: ${ratingMode})`);

      // Lazy load to avoid loading Puppeteer until first use
      const { creatorService } = await import('../services/CreatorService');
      const players = await creatorService.generateRoster(year, teams, 3000, undefined, undefined, ratingMode);

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
   * Generate decade draft class using Python script
   */
  ipcMain.handle('creator:generate-decade-draft-class', async (event, startYear: number, endYear: number) => {
    try {
      console.log(`[CreatorHandlers] Generating decade draft class for ${startYear}-${endYear}`);

      const { spawn } = await import('child_process');
      const path = await import('path');
      const fs = await import('fs');

      // Path to the Python script
      const scriptPath = path.join(__dirname, '..', '..', '..', '..', 'draft_class_generator.py');

      // Output directory for generated CSV
      const outputDir = path.join(__dirname, '..', '..', '..', '..', 'madden-editor-suite', 'data', 'generated_drafts');
      const outputFile = path.join(outputDir, `NFL_Draft_${startYear}s_DECADE.csv`);

      return new Promise((resolve, reject) => {
        console.log(`[CreatorHandlers] Running Python script: ${scriptPath}`);

        // Spawn Python process
        const pythonProcess = spawn('python', [scriptPath]);

        let stdout = '';
        let stderr = '';

        // Provide input to the script (mode 2, then start year)
        pythonProcess.stdin.write('2\n'); // Select decade mode
        pythonProcess.stdin.write(`${startYear}\n`); // Enter decade start year
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
          console.log(`[CreatorHandlers] Python stdout: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          console.error(`[CreatorHandlers] Python stderr: ${data}`);
        });

        pythonProcess.on('close', async (code) => {
          if (code !== 0) {
            console.error(`[CreatorHandlers] Python process exited with code ${code}`);
            resolve({
              success: false,
              error: `Python script failed: ${stderr || 'Unknown error'}`
            });
            return;
          }

          // Read the generated CSV file
          try {
            if (!fs.existsSync(outputFile)) {
              throw new Error(`Output file not found: ${outputFile}`);
            }

            const csvContent = fs.readFileSync(outputFile, 'utf-8');
            const lines = csvContent.split('\n');
            const headers = lines[0].split(',');

            const players: any[] = [];
            for (let i = 1; i < lines.length; i++) {
              if (lines[i].trim() === '') continue;

              const values = lines[i].split(',');
              const player: any = {};
              headers.forEach((header, index) => {
                player[header.trim()] = values[index]?.trim();
              });
              players.push(player);
            }

            console.log(`[CreatorHandlers] Successfully loaded ${players.length} players from decade class`);

            resolve({
              success: true,
              players,
              count: players.length,
              outputFile
            });

          } catch (readError: any) {
            console.error(`[CreatorHandlers] Error reading CSV: ${readError.message}`);
            resolve({
              success: false,
              error: `Failed to read generated file: ${readError.message}`
            });
          }
        });

        pythonProcess.on('error', (error) => {
          console.error(`[CreatorHandlers] Failed to start Python process:`, error);
          resolve({
            success: false,
            error: `Failed to start Python: ${error.message}. Make sure Python is installed and in your PATH.`
          });
        });
      });

    } catch (error: any) {
      console.error('[CreatorHandlers] Error generating decade draft class:', error);
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
