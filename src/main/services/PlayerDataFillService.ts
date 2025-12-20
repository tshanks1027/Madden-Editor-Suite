/**
 * Player Data Fill Service
 *
 * Orchestrates filling missing player data from Pro-Football-Reference.
 * Works with both single player fills and batch operations.
 *
 * Fills: hometown, home_state, height, weight, college, and per-year team/jersey
 */

import { ScraperService, ExtendedBioData, CareerYearData } from './ScraperService';
import { userDatabaseService } from './UserDatabaseService';
import { lookupService } from './lookup-service';
import { BrowserWindow } from 'electron';

export interface FillResult {
  success: boolean;
  playerId: number;
  playerName: string;
  fieldsUpdated: string[];
  seasonsUpdated: number;
  error?: string;
}

export interface PreviewResult {
  playerId: number;
  playerName: string;
  found: boolean;
  currentData: {
    hometown?: string;
    homeState?: string;
    height?: number;
    weight?: number;
    college?: string;
    draftYear?: number;
    draftRound?: string;
    draftPick?: number;
    careerFrom?: number;
    careerTo?: number;
  };
  scrapedData?: ExtendedBioData;
  careerData?: CareerYearData[];
  error?: string;
}

export interface BatchFillOptions {
  missingField?: 'hometown' | 'college' | 'height' | 'weight' | 'any';
  limit?: number;
  playerIds?: number[];  // Specific players to fill
}

export interface BatchFillResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  results: FillResult[];
}

export interface PlayerMissingData {
  id: number;
  firstName: string;
  lastName: string;
  missingFields: string[];
}

class PlayerDataFillService {
  private scraper: ScraperService;
  private isCancelled: boolean = false;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.scraper = new ScraperService();
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private sendProgress(data: {
    current: number;
    total: number;
    playerName: string;
    status: 'searching' | 'filling' | 'complete' | 'error' | 'cancelled';
    message?: string;
  }): void {
    // Send progress to all windows (main and database browser)
    const allWindows = BrowserWindow.getAllWindows();
    for (const win of allWindows) {
      if (!win.isDestroyed()) {
        win.webContents.send('player-fill:progress', data);
      }
    }
  }

  /**
   * Preview what data would be filled for a player (dry run)
   * @param playerId - Player ID for saving
   * @param playerInfo - Optional player info from frontend (name, current data)
   */
  async previewFill(playerId: number, playerInfo?: {
    firstName: string;
    lastName: string;
    hometown?: string;
    homeState?: string;
    height?: number;
    weight?: number;
    college?: string;
    draftYear?: number;
    draftRound?: string;
    draftPick?: number;
    careerFrom?: number;
    careerTo?: number;
  }): Promise<PreviewResult> {
    console.log(`[PlayerDataFillService] Previewing fill for player ID: ${playerId}`);

    // Use provided player info, or fall back to database lookup
    let player = playerInfo;
    if (!player) {
      player = await this.getPlayerFromDatabase(playerId);
    }

    if (!player || !player.firstName || !player.lastName) {
      return {
        playerId,
        playerName: 'Unknown',
        found: false,
        currentData: {},
        error: 'Player info not available'
      };
    }

    const playerName = `${player.firstName} ${player.lastName}`;

    try {
      // Initialize browser and scrape
      await this.scraper.initBrowser();
      const scrapedData = await this.scraper.scrapePlayerBioExtended(playerName);

      if (!scrapedData) {
        return {
          playerId,
          playerName,
          found: false,
          currentData: {
            hometown: player.hometown,
            homeState: player.homeState,
            height: player.height,
            weight: player.weight,
            college: player.college,
            draftYear: player.draftYear,
            draftRound: player.draftRound,
            draftPick: player.draftPick,
            careerFrom: player.careerFrom,
            careerTo: player.careerTo
          },
          error: 'Player not found on Pro-Football-Reference'
        };
      }

      // Log what we found for debugging
      console.log(`[PlayerDataFillService] Scraped data for ${playerName}:`, JSON.stringify(scrapedData, null, 2));

      return {
        playerId,
        playerName,
        found: true,
        currentData: {
          hometown: player.hometown,
          homeState: player.homeState,
          height: player.height,
          weight: player.weight,
          college: player.college,
          draftYear: player.draftYear,
          draftRound: player.draftRound,
          draftPick: player.draftPick,
          careerFrom: player.careerFrom,
          careerTo: player.careerTo
        },
        scrapedData,
        careerData: scrapedData.careerHistory
      };

    } catch (error: any) {
      console.error(`[PlayerDataFillService] Preview error:`, error);
      return {
        playerId,
        playerName,
        found: false,
        currentData: {},
        error: error.message || 'Failed to scrape player data'
      };
    }
  }

  /**
   * Fill missing data for a single player
   * @param playerId - Player ID for saving
   * @param playerInfo - Optional player info from frontend
   */
  async fillSinglePlayer(playerId: number, playerInfo?: {
    firstName: string;
    lastName: string;
    hometown?: string;
    homeState?: string;
    height?: number;
    weight?: number;
    college?: string;
    draftYear?: number;
    draftRound?: string;
    draftPick?: number;
    careerFrom?: number;
    careerTo?: number;
  }): Promise<FillResult> {
    console.log(`[PlayerDataFillService] Filling data for player ID: ${playerId}`);

    // Always fetch current data from database to know what's already filled
    const dbPlayer = await this.getPlayerFromDatabase(playerId);

    // Merge: use provided playerInfo for names, but use database values for current field state
    let player: any;
    if (playerInfo && playerInfo.firstName && playerInfo.lastName) {
      // Use provided names but merge with database current values
      player = {
        firstName: playerInfo.firstName,
        lastName: playerInfo.lastName,
        hometown: playerInfo.hometown ?? dbPlayer?.hometown,
        homeState: playerInfo.homeState ?? dbPlayer?.homeState,
        height: playerInfo.height ?? dbPlayer?.height,
        weight: playerInfo.weight ?? dbPlayer?.weight,
        college: playerInfo.college ?? dbPlayer?.college,
        draftYear: playerInfo.draftYear ?? dbPlayer?.draftYear,
        draftRound: playerInfo.draftRound ?? dbPlayer?.draftRound,
        draftPick: playerInfo.draftPick ?? dbPlayer?.draftPick,
        careerFrom: playerInfo.careerFrom ?? dbPlayer?.careerFrom,
        careerTo: playerInfo.careerTo ?? dbPlayer?.careerTo
      };
    } else if (dbPlayer) {
      player = dbPlayer;
    } else {
      player = null;
    }

    if (!player || !player.firstName || !player.lastName) {
      return {
        success: false,
        playerId,
        playerName: 'Unknown',
        fieldsUpdated: [],
        seasonsUpdated: 0,
        error: 'Player info not available'
      };
    }

    const playerName = `${player.firstName} ${player.lastName}`;
    const fieldsUpdated: string[] = [];
    let seasonsUpdated = 0;

    try {
      // Initialize browser and scrape
      await this.scraper.initBrowser();
      const scrapedData = await this.scraper.scrapePlayerBioExtended(playerName);

      if (!scrapedData) {
        return {
          success: false,
          playerId,
          playerName,
          fieldsUpdated: [],
          seasonsUpdated: 0,
          error: 'Player not found on Pro-Football-Reference'
        };
      }

      // Log what we have for debugging
      console.log(`[PlayerDataFillService] Current player data:`, JSON.stringify({
        hometown: player.hometown,
        homeState: player.homeState,
        height: player.height,
        weight: player.weight,
        college: player.college
      }));
      console.log(`[PlayerDataFillService] Scraped data:`, JSON.stringify({
        hometown: scrapedData.hometown,
        homeState: scrapedData.homeState,
        height: scrapedData.height,
        weight: scrapedData.weight,
        college: scrapedData.college
      }));

      // Build player edits object
      const playerEdits: any = {};

      // Fill missing bio data
      if (!player.hometown && scrapedData.hometown) {
        playerEdits.hometown = scrapedData.hometown;
        fieldsUpdated.push('hometown');
      }

      if (!player.homeState && scrapedData.homeState) {
        playerEdits.homeState = scrapedData.homeState;
        fieldsUpdated.push('homeState');
      }

      if (!player.height && scrapedData.height) {
        playerEdits.height = this.convertHeightToInches(scrapedData.height);
        fieldsUpdated.push('height');
      }

      if (!player.weight && scrapedData.weight) {
        playerEdits.weight = scrapedData.weight;
        fieldsUpdated.push('weight');
      }

      if (!player.college && scrapedData.college) {
        const collegeId = await this.lookupCollegeId(scrapedData.college);
        if (collegeId) {
          playerEdits.collegeId = collegeId;
          fieldsUpdated.push('college');
        }
      }

      // Save player bio edits if any
      if (Object.keys(playerEdits).length > 0) {
        console.log(`[PlayerDataFillService] Saving player edits for ${playerName}:`, playerEdits);
        await userDatabaseService.savePlayerEdit(playerId, playerEdits);
      } else {
        console.log(`[PlayerDataFillService] No new bio data to save for ${playerName} - all fields already filled or no data from PFR`);
      }

      // Fill season data (team and jersey per year)
      if (scrapedData.careerHistory && scrapedData.careerHistory.length > 0) {
        for (const yearData of scrapedData.careerHistory) {
          const seasonEdits: any = {};

          // Get existing season data
          const existingSeason = await userDatabaseService.getSeasonEdit(playerId, yearData.year);

          // Fill team if missing
          if ((!existingSeason || !existingSeason.team) && yearData.team) {
            const teamAbbrev = this.mapTeamNameToAbbrev(yearData.team);
            if (teamAbbrev) {
              seasonEdits.team = teamAbbrev;
            }
          }

          // Fill jersey if missing
          if ((!existingSeason || !existingSeason.jersey) && yearData.jersey) {
            seasonEdits.jersey = yearData.jersey;
          }

          // Save season edits if any
          if (Object.keys(seasonEdits).length > 0) {
            console.log(`[PlayerDataFillService] Saving season ${yearData.year} edits:`, seasonEdits);
            await userDatabaseService.saveSeasonEdit(playerId, yearData.year, seasonEdits);
            seasonsUpdated++;
          }
        }
      }

      return {
        success: true,
        playerId,
        playerName,
        fieldsUpdated,
        seasonsUpdated
      };

    } catch (error: any) {
      console.error(`[PlayerDataFillService] Fill error:`, error);
      return {
        success: false,
        playerId,
        playerName,
        fieldsUpdated,
        seasonsUpdated,
        error: error.message || 'Failed to fill player data'
      };
    }
  }

  /**
   * Scan database for players with missing data
   * Prioritizes players from 1980+ who are more likely to have PFR data
   */
  async scanPlayersWithMissingData(limit: number = 100): Promise<PlayerMissingData[]> {
    console.log(`[PlayerDataFillService] Scanning for players with missing data (limit: ${limit})`);

    try {
      // Get all players from lookup service
      const allPlayers = await lookupService.searchPlayers('', limit * 20);
      console.log(`[PlayerDataFillService] Got ${allPlayers.length} players from lookup service`);

      if (allPlayers.length > 0) {
        const sample = allPlayers[0];
        console.log(`[PlayerDataFillService] Sample player:`, JSON.stringify({
          internalId: sample.internalId,
          firstName: sample.firstName,
          lastName: sample.lastName,
          careerFrom: sample.careerFrom,
          careerTo: sample.careerTo,
          height: sample.height,
          weight: sample.weight,
          homeState: sample.homeState,
          college: sample.college
        }));
      }

      const playersWithMissing: PlayerMissingData[] = [];

      // Sort by career start year (most recent first) to prioritize players with PFR data
      const sortedPlayers = [...allPlayers].sort((a, b) => {
        const yearA = a.careerFrom || 0;
        const yearB = b.careerFrom || 0;
        return yearB - yearA;  // Descending (newest first)
      });

      console.log(`[PlayerDataFillService] After sorting, first player career: ${sortedPlayers[0]?.careerFrom}, last: ${sortedPlayers[sortedPlayers.length-1]?.careerFrom}`);

      let checkedCount = 0;

      for (const player of sortedPlayers) {
        if (playersWithMissing.length >= limit) break;

        // Note: Not filtering by year anymore - PFR has data even for older players
        checkedCount++;

        // Also check user edits for this player
        const userEdits = await userDatabaseService.getPlayerEdit(player.internalId);

        const missingFields: string[] = [];

        // Check what's missing (check both base data and user edits)
        // Note: hometown is not in base CSV, only in user edits
        if (!userEdits?.hometown) missingFields.push('hometown');
        if (!player.homeState && !userEdits?.homeState) missingFields.push('homeState');
        if (!player.height && !userEdits?.height) missingFields.push('height');
        if (!player.weight && !userEdits?.weight) missingFields.push('weight');
        if (!player.college && !userEdits?.collegeId) missingFields.push('college');

        if (missingFields.length > 0) {
          playersWithMissing.push({
            id: player.internalId,  // Use internalId, not id
            firstName: player.firstName,
            lastName: player.lastName,
            missingFields
          });
        }
      }

      console.log(`[PlayerDataFillService] Checked ${checkedCount} players`);
      console.log(`[PlayerDataFillService] Found ${playersWithMissing.length} players with missing data`);

      if (playersWithMissing.length > 0) {
        console.log(`[PlayerDataFillService] First missing player:`, JSON.stringify(playersWithMissing[0]));
      }

      return playersWithMissing;

    } catch (error: any) {
      console.error(`[PlayerDataFillService] Scan error:`, error);
      return [];
    }
  }

  /**
   * Batch fill missing data for multiple players
   */
  async fillMissingDataBatch(options: BatchFillOptions): Promise<BatchFillResult> {
    console.log(`[PlayerDataFillService] Starting batch fill with options:`, options);
    this.isCancelled = false;

    const result: BatchFillResult = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      results: []
    };

    try {
      // Initialize browser once for all requests
      await this.scraper.initBrowser();

      // Get players to fill
      let players: PlayerMissingData[];
      if (options.playerIds && options.playerIds.length > 0) {
        // Fill specific players
        players = await Promise.all(
          options.playerIds.map(async (id) => {
            const player = await this.getPlayerFromDatabase(id);
            if (player) {
              return {
                id,
                firstName: player.firstName,
                lastName: player.lastName,
                missingFields: [] // Fill all fields
              };
            }
            return null;
          })
        ).then(results => results.filter((p): p is PlayerMissingData => p !== null));
      } else {
        // Scan for players with missing data
        players = await this.scanPlayersWithMissingData(options.limit || 100);
      }

      result.total = players.length;

      // Process each player with rate limiting
      for (let i = 0; i < players.length; i++) {
        if (this.isCancelled) {
          this.sendProgress({
            current: i,
            total: result.total,
            playerName: '',
            status: 'cancelled',
            message: 'Batch fill cancelled by user'
          });
          break;
        }

        const player = players[i];
        const playerName = `${player.firstName} ${player.lastName}`;

        // Send progress update
        this.sendProgress({
          current: i + 1,
          total: result.total,
          playerName,
          status: 'searching',
          message: `Searching for ${playerName}...`
        });

        // Fill this player - pass player info to avoid database lookup failures
        const fillResult = await this.fillSinglePlayer(player.id, {
          firstName: player.firstName,
          lastName: player.lastName
        });
        result.results.push(fillResult);

        if (fillResult.success) {
          if (fillResult.fieldsUpdated.length > 0 || fillResult.seasonsUpdated > 0) {
            result.success++;
            this.sendProgress({
              current: i + 1,
              total: result.total,
              playerName,
              status: 'filling',
              message: `Updated ${fillResult.fieldsUpdated.length} fields, ${fillResult.seasonsUpdated} seasons for ${playerName}`
            });
          } else {
            result.skipped++;
            this.sendProgress({
              current: i + 1,
              total: result.total,
              playerName,
              status: 'complete',
              message: `No new data found for ${playerName}`
            });
          }
        } else {
          result.failed++;
          this.sendProgress({
            current: i + 1,
            total: result.total,
            playerName,
            status: 'error',
            message: fillResult.error || `Failed to fill ${playerName}`
          });
        }

        // Rate limit: 1.5 seconds between requests
        if (i < players.length - 1) {
          await this.sleep(1500);
        }
      }

      // Send final complete status
      this.sendProgress({
        current: result.total,
        total: result.total,
        playerName: '',
        status: 'complete',
        message: `Batch complete: ${result.success} updated, ${result.failed} failed, ${result.skipped} skipped`
      });

    } catch (error: any) {
      console.error(`[PlayerDataFillService] Batch fill error:`, error);
    } finally {
      // Close browser when done
      await this.scraper.closeBrowser();
    }

    return result;
  }

  /**
   * Cancel ongoing batch operation
   */
  cancelBatch(): void {
    console.log(`[PlayerDataFillService] Cancelling batch operation`);
    this.isCancelled = true;
  }

  // ==================== Helper Methods ====================

  private async getPlayerFromDatabase(playerId: number): Promise<any | null> {
    try {
      // Try to get player from lookup service
      const players = await lookupService.searchPlayers('', 50000);
      const player = players.find(p => p.internalId === playerId);
      if (player) {
        return {
          firstName: player.firstName,
          lastName: player.lastName,
          hometown: player.hometown,
          homeState: player.homeState,
          height: player.height,
          weight: player.weight,
          college: player.college
        };
      }

      // Also check for edits
      const edits = await userDatabaseService.getPlayerEdit(playerId);
      if (edits) {
        return {
          firstName: edits.firstName || '',
          lastName: edits.lastName || '',
          hometown: edits.hometown,
          homeState: edits.homeState,
          height: edits.height,
          weight: edits.weight,
          college: '' // Would need college_id lookup
        };
      }

      return null;
    } catch (error) {
      console.error(`[PlayerDataFillService] Error getting player ${playerId}:`, error);
      return null;
    }
  }

  private convertHeightToInches(height: string): number {
    // Convert "6-2" format to inches (74)
    const match = height.match(/(\d+)-(\d+)/);
    if (match) {
      const feet = parseInt(match[1]);
      const inches = parseInt(match[2]);
      return feet * 12 + inches;
    }
    return 0;
  }

  private async lookupCollegeId(collegeName: string): Promise<number | null> {
    try {
      const colleges = await lookupService.getDropdownOptions('college_lookup.csv');
      const college = colleges.find(c =>
        c.name.toLowerCase() === collegeName.toLowerCase() ||
        c.name.toLowerCase().includes(collegeName.toLowerCase())
      );
      return college ? college.id : null;
    } catch (error) {
      console.error(`[PlayerDataFillService] Error looking up college ${collegeName}:`, error);
      return null;
    }
  }

  private mapTeamNameToAbbrev(teamName: string): string | null {
    // Map full team names to abbreviations
    const teamMap: Record<string, string> = {
      'Arizona Cardinals': 'ARI', 'Cardinals': 'ARI',
      'Atlanta Falcons': 'ATL', 'Falcons': 'ATL',
      'Baltimore Ravens': 'BAL', 'Ravens': 'BAL',
      'Buffalo Bills': 'BUF', 'Bills': 'BUF',
      'Carolina Panthers': 'CAR', 'Panthers': 'CAR',
      'Chicago Bears': 'CHI', 'Bears': 'CHI',
      'Cincinnati Bengals': 'CIN', 'Bengals': 'CIN',
      'Cleveland Browns': 'CLE', 'Browns': 'CLE',
      'Dallas Cowboys': 'DAL', 'Cowboys': 'DAL',
      'Denver Broncos': 'DEN', 'Broncos': 'DEN',
      'Detroit Lions': 'DET', 'Lions': 'DET',
      'Green Bay Packers': 'GB', 'Packers': 'GB',
      'Houston Texans': 'HOU', 'Texans': 'HOU',
      'Indianapolis Colts': 'IND', 'Colts': 'IND',
      'Jacksonville Jaguars': 'JAX', 'Jaguars': 'JAX',
      'Kansas City Chiefs': 'KC', 'Chiefs': 'KC',
      'Las Vegas Raiders': 'LV', 'Raiders': 'LV', 'Oakland Raiders': 'LV',
      'Los Angeles Chargers': 'LAC', 'Chargers': 'LAC', 'San Diego Chargers': 'LAC',
      'Los Angeles Rams': 'LAR', 'Rams': 'LAR', 'St. Louis Rams': 'LAR',
      'Miami Dolphins': 'MIA', 'Dolphins': 'MIA',
      'Minnesota Vikings': 'MIN', 'Vikings': 'MIN',
      'New England Patriots': 'NE', 'Patriots': 'NE',
      'New Orleans Saints': 'NO', 'Saints': 'NO',
      'New York Giants': 'NYG', 'Giants': 'NYG',
      'New York Jets': 'NYJ', 'Jets': 'NYJ',
      'Philadelphia Eagles': 'PHI', 'Eagles': 'PHI',
      'Pittsburgh Steelers': 'PIT', 'Steelers': 'PIT',
      'San Francisco 49ers': 'SF', '49ers': 'SF',
      'Seattle Seahawks': 'SEA', 'Seahawks': 'SEA',
      'Tampa Bay Buccaneers': 'TB', 'Buccaneers': 'TB',
      'Tennessee Titans': 'TEN', 'Titans': 'TEN', 'Houston Oilers': 'TEN',
      'Washington Commanders': 'WAS', 'Commanders': 'WAS', 'Redskins': 'WAS', 'Football Team': 'WAS'
    };

    // Try exact match first
    if (teamMap[teamName]) {
      return teamMap[teamName];
    }

    // Try partial match
    for (const [name, abbrev] of Object.entries(teamMap)) {
      if (teamName.includes(name) || name.includes(teamName)) {
        return abbrev;
      }
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const playerDataFillService = new PlayerDataFillService();
