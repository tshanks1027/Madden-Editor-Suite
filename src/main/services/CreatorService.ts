/**
 * Creator Service
 *
 * Orchestrates the creation of draft classes and rosters from web-scraped data.
 * Combines ScraperService (data collection) and RatingCalculator (stats conversion)
 * to generate Madden-ready player data.
 *
 * Workflow:
 * 1. User selects year and mode (roster or draft class)
 * 2. Scrape player data from pro-football-reference.com
 * 3. Convert stats to Madden ratings
 * 4. Display in preview grid for editing
 * 5. Save as draft class or roster file
 */

import { scraperService, PlayerStats, DraftProspect } from './ScraperService';
import { ratingCalculator, MaddenRatings } from './RatingCalculator';

export interface CreatorOptions {
  year: number;
  mode: 'roster' | 'draftClass';
  teams?: string[]; // Team abbreviations for roster mode
  autoGenerate?: boolean; // Auto-generate from scraped data
}

export interface GeneratedPlayer {
  // Basic Info
  firstName: string;
  lastName: string;
  position: string;
  college: string;
  team?: string;
  jerseyNum: number;
  age: number;
  heightInches: number;
  weight: number;

  // Dev Trait
  devTrait: number; // 0=Normal, 1=Star, 2=Superstar, 3=X-Factor

  // Ratings
  ratings: MaddenRatings;

  // Visuals
  PID: number; // Portrait ID (0 for generic)
  PEPS: string | null; // Player Equipment Preset (null for generic)
  bodyType: number;

  // Source data (for reference)
  _sourceStats?: PlayerStats;
}

/**
 * Creator Service Class
 */
export class CreatorService {

  /**
   * Generate a draft class from web-scraped data
   * @param year - Draft year
   * @returns Array of generated prospects
   */
  async generateDraftClass(year: number): Promise<GeneratedPlayer[]> {
    console.log(`[CreatorService] Generating draft class for ${year}`);

    try {
      // Step 1: Scrape draft prospects
      const prospects = await scraperService.scrapeDraftClass(year);
      console.log(`[CreatorService] Scraped ${prospects.length} prospects`);

      if (prospects.length === 0) {
        throw new Error(`No draft prospects found for ${year}`);
      }

      // Step 2: For each prospect, scrape college stats and convert to ratings
      const generatedPlayers: GeneratedPlayer[] = [];

      for (let i = 0; i < Math.min(prospects.length, 300); i++) {
        const prospect = prospects[i];

        console.log(`[CreatorService] Processing ${prospect.name} (${prospect.position})`);

        // Try to scrape player stats (college stats for draft prospects)
        // Note: This may not always work for college players on pro-football-reference
        const stats = await this.getPlayerStats(prospect.name, year - 1);

        // If no stats found, use defaults based on draft position
        const ratings = stats
          ? ratingCalculator.calculateRatings(stats)
          : this.generateDefaultRatings(prospect);

        // Parse name
        const nameParts = prospect.name.split(' ');
        const firstName = nameParts[0] || 'John';
        const lastName = nameParts.slice(1).join(' ') || 'Doe';

        // Generate player
        const player: GeneratedPlayer = {
          firstName,
          lastName,
          position: prospect.position,
          college: prospect.college || 'Unknown',
          jerseyNum: Math.floor(Math.random() * 99) + 1,
          age: prospect.age || 21,
          heightInches: this.parseHeight(prospect.height),
          weight: prospect.weight || this.getDefaultWeight(prospect.position),
          devTrait: this.determineDevTrait(prospect.round, prospect.pick, ratings.overall),
          ratings,
          PID: 0, // Generic portrait
          PEPS: null, // Generic head
          bodyType: this.determineBodyType(prospect.position, prospect.weight),
          _sourceStats: stats || undefined
        };

        generatedPlayers.push(player);
      }

      console.log(`[CreatorService] Generated ${generatedPlayers.length} players`);

      // Close browser when done
      await scraperService.closeBrowser();

      return generatedPlayers;

    } catch (error: any) {
      console.error('[CreatorService] Error generating draft class:', error);
      await scraperService.closeBrowser();
      throw new Error(`Failed to generate draft class: ${error.message}`);
    }
  }

  /**
   * Generate a roster from web-scraped data
   * @param year - Season year
   * @param teams - Array of team abbreviations (e.g., ['dal', 'sea', 'ne'])
   * @returns Array of generated players
   */
  async generateRoster(year: number, teams: string[]): Promise<GeneratedPlayer[]> {
    console.log(`[CreatorService] Generating roster for ${year} (${teams.length} teams)`);

    try {
      const generatedPlayers: GeneratedPlayer[] = [];

      // For each team, scrape roster
      for (const teamAbbr of teams) {
        console.log(`[CreatorService] Scraping roster for ${teamAbbr}`);

        const roster = await scraperService.scrapeTeamRoster(teamAbbr, year);
        console.log(`[CreatorService] Found ${roster.length} players for ${teamAbbr}`);

        // Convert each player to GeneratedPlayer
        for (const playerStats of roster) {
          const ratings = ratingCalculator.calculateRatings(playerStats);

          // Parse name
          const nameParts = playerStats.name.split(' ');
          const firstName = nameParts[0] || 'John';
          const lastName = nameParts.slice(1).join(' ') || 'Doe';

          const player: GeneratedPlayer = {
            firstName,
            lastName,
            position: playerStats.position,
            college: playerStats.college || 'Unknown',
            team: teamAbbr.toUpperCase(),
            jerseyNum: Math.floor(Math.random() * 99) + 1,
            age: playerStats.age || 25,
            heightInches: this.parseHeight(playerStats.height),
            weight: playerStats.weight || this.getDefaultWeight(playerStats.position),
            devTrait: this.determineDevTraitFromRating(ratings.overall),
            ratings,
            PID: 0,
            PEPS: null,
            bodyType: this.determineBodyType(playerStats.position, playerStats.weight),
            _sourceStats: playerStats
          };

          generatedPlayers.push(player);
        }
      }

      console.log(`[CreatorService] Generated ${generatedPlayers.length} total players`);

      // Close browser when done
      await scraperService.closeBrowser();

      return generatedPlayers;

    } catch (error: any) {
      console.error('[CreatorService] Error generating roster:', error);
      await scraperService.closeBrowser();
      throw new Error(`Failed to generate roster: ${error.message}`);
    }
  }

  /**
   * Get player stats from scraper (with error handling)
   */
  private async getPlayerStats(playerName: string, year: number): Promise<PlayerStats | null> {
    try {
      return await scraperService.scrapePlayerStats(playerName, year);
    } catch (error) {
      console.warn(`[CreatorService] Could not scrape stats for ${playerName}:`, error);
      return null;
    }
  }

  /**
   * Generate default ratings for a prospect when stats aren't available
   * Uses draft position as a proxy for talent
   */
  private generateDefaultRatings(prospect: DraftProspect): MaddenRatings {
    const round = prospect.round || 7;
    const pick = prospect.pick || 250;

    // Higher draft pick = better base ratings
    let baseOverall = 75;
    if (round === 1) {
      baseOverall = 80 - (pick * 0.5); // Picks 1-32: 80-64
    } else if (round === 2) {
      baseOverall = 72;
    } else if (round === 3) {
      baseOverall = 68;
    } else if (round <= 5) {
      baseOverall = 62;
    } else {
      baseOverall = 58;
    }

    // Generate position-appropriate ratings
    const mockStats: PlayerStats = {
      name: prospect.name,
      position: prospect.position,
      college: prospect.college
    };

    return ratingCalculator.calculateRatings(mockStats);
  }

  /**
   * Determine dev trait based on draft position and overall
   */
  private determineDevTrait(round?: number, pick?: number, overall?: number): number {
    // Top 10 picks: potential for X-Factor
    if (pick && pick <= 10 && overall && overall >= 78) {
      return 3; // X-Factor
    }

    // First round: potential for Superstar
    if (round === 1 && overall && overall >= 75) {
      return 2; // Superstar
    }

    // First 2 rounds: potential for Star
    if (round && round <= 2 && overall && overall >= 72) {
      return 1; // Star
    }

    return 0; // Normal
  }

  /**
   * Determine dev trait from overall rating (for roster mode)
   */
  private determineDevTraitFromRating(overall: number): number {
    if (overall >= 90) return 3; // X-Factor
    if (overall >= 85) return 2; // Superstar
    if (overall >= 80) return 1; // Star
    return 0; // Normal
  }

  /**
   * Parse height string (e.g., "6-2") to inches
   */
  private parseHeight(heightStr?: string): number {
    if (!heightStr) return 73; // Default 6'1"

    const parts = heightStr.split('-');
    if (parts.length !== 2) return 73;

    const feet = parseInt(parts[0]) || 6;
    const inches = parseInt(parts[1]) || 1;

    return (feet * 12) + inches;
  }

  /**
   * Get default weight for a position
   */
  private getDefaultWeight(position: string): number {
    const weightByPosition: { [key: string]: number } = {
      'QB': 220, 'RB': 215, 'FB': 245, 'WR': 200, 'TE': 250,
      'T': 315, 'G': 310, 'C': 300,
      'DE': 275, 'DT': 310, 'NT': 330,
      'LB': 245, 'MLB': 245, 'OLB': 240,
      'CB': 190, 'FS': 200, 'SS': 210,
      'K': 200, 'P': 205
    };

    return weightByPosition[position.toUpperCase()] || 220;
  }

  /**
   * Determine body type based on position and weight
   */
  private determineBodyType(position: string, weight?: number): number {
    const pos = position.toUpperCase();
    const w = weight || this.getDefaultWeight(position);

    // Body types: 0=Lean, 1=Athletic, 2=Muscular, 3=Stocky
    if (['WR', 'CB', 'FS'].includes(pos)) {
      return w < 190 ? 0 : 1; // Lean or Athletic
    } else if (['RB', 'LB', 'SS', 'TE'].includes(pos)) {
      return w < 230 ? 1 : 2; // Athletic or Muscular
    } else if (['QB'].includes(pos)) {
      return 1; // Athletic
    } else {
      return w < 290 ? 2 : 3; // Muscular or Stocky (linemen)
    }
  }
}

// Export singleton
export const creatorService = new CreatorService();
