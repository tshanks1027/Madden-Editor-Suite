/**
 * Roster Creator Service
 *
 * Service for generating historical NFL rosters by scraping data from pro-football-reference.com
 * Creates complete rosters with real player data mapped to Madden attributes.
 *
 * Features:
 * - Scrapes team-by-team rosters for a given year
 * - Identifies Hall of Fame players automatically
 * - Gets detailed stats for top 10 players per team
 * - Generates random players for teams that didn't exist
 * - Maps real stats to Madden attributes
 * - Progress tracking for long operations
 *
 * Source: Custom implementation based on DraftClassService pattern
 */

import { scraperService, PlayerStats } from './ScraperService';
import { creatorService, GeneratedPlayer } from './CreatorService';
import { mapStatsToAttributes, MaddenAttributes } from '../lib/roster/AttributeMapper';
import { generateRandomRoster, RandomPlayer } from '../lib/roster/RandomPlayerGenerator';
import { scraperDebugLogger } from '../utils/DebugLogger';
import * as fs from 'fs';
import * as path from 'path';

export interface RosterPlayer {
  // Basic Info
  PFNA: string; // First Name
  PLNA: string; // Last Name
  PPOS: string; // Position (Madden position code)
  TGID: number; // Team ID
  PAGE: number; // Age
  PJEN: number; // Jersey Number

  // Physical
  PHGT: number; // Height (inches)
  PWGT: number; // Weight (pounds)

  // College/Background
  PCOL: string; // College
  PHSN?: string; // Home State

  // Attributes (all the PSPD, PSTR, etc. fields)
  [key: string]: any; // All Madden attributes

  // Metadata
  isHallOfFamer?: boolean;
}

export interface ProgressCallback {
  (progress: number, message: string): void;
}

/**
 * NFL Teams with their abbreviations and Madden Team IDs
 * Maps Pro Football Reference abbreviations to actual Madden 26 team IDs
 * (IDs from src/renderer/data/team-data.js)
 */
const NFL_TEAMS = [
  { abbr: 'crd', name: 'Arizona Cardinals', id: 7 },     // ARI in Madden
  { abbr: 'atl', name: 'Atlanta Falcons', id: 14 },
  { abbr: 'rav', name: 'Baltimore Ravens', id: 25 },    // BAL in Madden
  { abbr: 'buf', name: 'Buffalo Bills', id: 3 },
  { abbr: 'car', name: 'Carolina Panthers', id: 21 },
  { abbr: 'chi', name: 'Chicago Bears', id: 1 },
  { abbr: 'cin', name: 'Cincinnati Bengals', id: 2 },
  { abbr: 'cle', name: 'Cleveland Browns', id: 5 },
  { abbr: 'dal', name: 'Dallas Cowboys', id: 11 },
  { abbr: 'den', name: 'Denver Broncos', id: 4 },
  { abbr: 'det', name: 'Detroit Lions', id: 19 },
  { abbr: 'gnb', name: 'Green Bay Packers', id: 20 },   // GB in Madden
  { abbr: 'htx', name: 'Houston Texans', id: 32 },      // HOU in Madden
  { abbr: 'clt', name: 'Indianapolis Colts', id: 10 },  // IND in Madden
  { abbr: 'jax', name: 'Jacksonville Jaguars', id: 17 },
  { abbr: 'kan', name: 'Kansas City Chiefs', id: 9 },   // KC in Madden
  { abbr: 'sdg', name: 'Los Angeles Chargers', id: 8 }, // LAC in Madden
  { abbr: 'ram', name: 'Los Angeles Rams', id: 24 },    // LAR in Madden
  { abbr: 'rai', name: 'Las Vegas Raiders', id: 23 },   // LV in Madden
  { abbr: 'mia', name: 'Miami Dolphins', id: 12 },
  { abbr: 'min', name: 'Minnesota Vikings', id: 31 },
  { abbr: 'nwe', name: 'New England Patriots', id: 22 }, // NE in Madden
  { abbr: 'nor', name: 'New Orleans Saints', id: 27 },   // NO in Madden
  { abbr: 'nyg', name: 'New York Giants', id: 16 },
  { abbr: 'nyj', name: 'New York Jets', id: 18 },
  { abbr: 'phi', name: 'Philadelphia Eagles', id: 13 },
  { abbr: 'pit', name: 'Pittsburgh Steelers', id: 29 },
  { abbr: 'sea', name: 'Seattle Seahawks', id: 28 },
  { abbr: 'sfo', name: 'San Francisco 49ers', id: 15 }, // SF in Madden
  { abbr: 'tam', name: 'Tampa Bay Buccaneers', id: 6 }, // TB in Madden
  { abbr: 'oti', name: 'Tennessee Titans', id: 30 },    // TEN in Madden
  { abbr: 'was', name: 'Washington Commanders', id: 26 }, // WAS in Madden
  { abbr: 'fa', name: 'Free Agent', id: 1009 }           // FA in Madden
];

/**
 * Roster Creator Service Class
 */
export class RosterCreatorService {

  /**
   * Generate a historical roster for a given year
   * Uses CreatorService for proper college lookup, position mapping, dev traits, and stat minimums
   * @param year - Season year (1920-2025)
   * @param templatePath - Path to template roster file
   * @param ratingMode - Rating generation mode: 'random', 'semi-historical', or 'realistic'
   * @param progressCallback - Callback for progress updates
   * @returns Array of roster players
   */
  async generateHistoricalRoster(
    year: number,
    templatePath: string,
    ratingMode: string = 'semi-historical',
    progressCallback?: ProgressCallback
  ): Promise<RosterPlayer[]> {
    try {
      // Clear debug log file at the start of roster generation
      scraperDebugLogger.clear();
      scraperDebugLogger.log(`=== ROSTER GENERATION FOR ${year} ===\n`);

      console.log(`[RosterCreatorService] Starting roster generation for ${year}`);

      progressCallback?.(0, `Loading template roster...`);

      // Load template roster FIRST to determine max player count
      const helperPath = path.join(__dirname, 'lib', 'helpers', 'MaddenRosterHelper');
      const MaddenRosterHelper = require(helperPath);
      const helper = new MaddenRosterHelper();

      console.log(`[RosterCreatorService] Loading template roster from: ${templatePath}`);
      const templateFile = await helper.load(templatePath);

      const playerTable = templateFile.PLAY;
      if (!playerTable) {
        throw new Error('PLAY table not found in template file');
      }

      const maxPlayers = playerTable.records.length;
      console.log(`[RosterCreatorService] Template has ${maxPlayers} player slots available`);
      scraperDebugLogger.log(`Template roster loaded: ${maxPlayers} player slots available\n`);

      progressCallback?.(10, `Generating roster for ${year}...`);

      // Use CreatorService to generate roster with proper data handling
      // This gives us: college lookup, position mapping, dev traits, stat minimums, etc.
      // Exclude 'fa' from team scraping - FA pool will be generated separately
      const teamAbbrs = NFL_TEAMS.filter(t => t.abbr !== 'fa').map(t => t.abbr);
      const generatedPlayers = await creatorService.generateRoster(year, teamAbbrs, maxPlayers, undefined, undefined, ratingMode);

      console.log(`[RosterCreatorService] CreatorService generated ${generatedPlayers.length} players`);

      progressCallback?.(80, `Converting players to roster format...`);

      console.log(`[RosterCreatorService] ========== CONVERTING TO ROSTER FORMAT ==========`);
      console.log(`[RosterCreatorService] Converting ${generatedPlayers.length} generated players to RosterPlayer format`);

      // DEBUG: Log first player BEFORE conversion
      if (generatedPlayers.length > 0) {
        const firstGen = generatedPlayers[0];
        console.log(`[RosterCreatorService] First GeneratedPlayer BEFORE conversion:`);
        console.log(`  - Name: ${firstGen.firstName} ${firstGen.lastName}`);
        console.log(`  - Position: ${firstGen.position} (code ${firstGen.positionCode})`);
        console.log(`  - Team: ${firstGen.team}`);
        console.log(`  - College ID: ${firstGen.college}, HomeState ID: ${firstGen.homeState}`);
        console.log(`  - Overall: ${firstGen.ratings.overall}`);
        console.log(`  - Speed: ${firstGen.ratings.speed}, Strength: ${firstGen.ratings.strength}`);
        console.log(`  - Has source stats: ${!!firstGen._sourceStats}`);
        if (firstGen._sourceStats) {
          const s = firstGen._sourceStats;
          console.log(`  - Source stats: pass=${s.passAttempts}, rush=${s.rushAttempts}, rec=${s.receptions}, tkl=${s.tackles}`);
        }
      }

      // Convert GeneratedPlayer format to RosterPlayer format
      const rosterPlayers: RosterPlayer[] = generatedPlayers.map((player: GeneratedPlayer, idx: number) => {
        // Find team ID from team abbreviation (Pro Football Reference abbr -> Madden team ID)
        const teamObj = NFL_TEAMS.find(t => t.abbr === player.team?.toLowerCase());
        const teamId = teamObj ? teamObj.id : 0; // 0 = Free Agent/Unknown in Madden

        // DEBUG: Log team mapping for first 5 players
        if (idx < 5) {
          console.log(`[RosterCreatorService] Player ${idx + 1} team mapping: "${player.team}" -> ID ${teamId} (found: ${!!teamObj}, teamObj: ${teamObj?.name})`);
        }

        // Warn about unmapped teams
        if (!teamObj && player.team) {
          console.warn(`[RosterCreatorService] ⚠️ Unmapped team abbreviation: "${player.team}" for player ${player.firstName} ${player.lastName}`);
        }

        // Convert GeneratedPlayer to RosterPlayer format
        const rosterPlayer: RosterPlayer = {
          PFNA: player.firstName,
          PLNA: player.lastName,
          PPOS: player.positionCode, // Use numeric position code for lookups
          TGID: teamId,
          PAGE: player.age,
          PJEN: player.jerseyNum,
          PHGT: player.heightInches,
          PWGT: player.weight,
          PCOL: player.college, // College ID (already numeric from CreatorService)
          PHSN: player.homeState, // Home state ID (already numeric from CreatorService)

          // Dev trait (0-3)
          PDEV: player.devTrait,

          // PID (Player Picture ID), PAM, and Years Pro
          PSXP: player.PID, // Player Picture ID for face/headshot
          PEPS: player.PEPS || '', // Player Asset Model (PAM) - blank string for historical players
          PYRP: player.yearsPro, // Years in league
          PBOD: player.bodyType,

          // All ratings from GeneratedPlayer.ratings
          // NOTE: Field names MUST match Madden 26 field definitions exactly!
          PSPD: player.ratings.speed,
          PACC: player.ratings.acceleration,
          PAGI: player.ratings.agility,
          PELU: player.ratings.changeOfDirection, // COD = PELU in M26
          PSTR: player.ratings.strength,
          PAWR: player.ratings.awareness,
          PJMP: player.ratings.jumping,
          PSTA: player.ratings.stamina,
          PINJ: player.ratings.injury,
          PTGH: player.ratings.toughness,

          // Passing
          PTHP: player.ratings.throwPower,
          PTAS: player.ratings.throwAccuracyShort, // TAS not PTHA
          PTAM: player.ratings.throwAccuracyMid, // TAM not PTHM
          PTAD: player.ratings.throwAccuracyDeep, // TAD not PTHD
          PTOR: player.ratings.throwOnTheRun, // TOR not PTHO
          PTUP: player.ratings.throwUnderPressure, // TUP not PTHU
          PPLA: player.ratings.playAction,
          PBSK: player.ratings.breakSack,

          // Rushing/Carrying
          PCAR: player.ratings.carrying,
          PBCV: player.ratings.ballCarrierVision,
          PBKT: player.ratings.breakTackle, // PBKT not PBTK
          PLTR: player.ratings.trucking, // PLTR not PTRK
          PLSA: player.ratings.stiffArm, // PLSA not PSFA
          PLSM: player.ratings.spinMove, // PLSM not PSPM
          PLJM: player.ratings.jukeMove, // PLJM not PJKM

          // Receiving
          PCTH: player.ratings.catching,
          PLCI: player.ratings.catchInTraffic, // PLCI not PCIT
          PLSC: player.ratings.spectacularCatch, // PLSC not PSPC
          PSRR: player.ratings.shortRouteRunning,
          PMRR: player.ratings.mediumRouteRunning,
          PDRR: player.ratings.deepRouteRunning,
          PLRL: player.ratings.release, // PLRL not PREL

          // Blocking
          PPBK: player.ratings.passBlock,
          PPBS: player.ratings.passBlockPower, // PPBS not PPBP (Pass Block Strength)
          PPBF: player.ratings.passBlockFinesse,
          PRBK: player.ratings.runBlock,
          PRBS: player.ratings.runBlockPower, // PRBS not PRBP (Run Block Strength)
          PRBF: player.ratings.runBlockFinesse,
          PLBK: player.ratings.leadBlock,
          PLIB: player.ratings.impactBlocking, // PLIB not PIBL

          // Defense
          PTAK: player.ratings.tackle,
          PLHT: player.ratings.hitPower, // PLHT not PHTP
          PLPM: player.ratings.powerMoves, // PLPM not PPOW
          PFMS: player.ratings.finesseMoves,
          PBSG: player.ratings.blockShedding, // PBSG not PBSH
          PLPU: player.ratings.pursuit, // PLPU not PPUR
          PLPR: player.ratings.playRecognition, // PLPR not PPRC
          PLMC: player.ratings.manCoverage, // PLMC not PMCV
          PLZC: player.ratings.zoneCoverage, // PLZC not PZCV
          PLPE: player.ratings.pressCoverage, // PLPE not PPRS

          // Special Teams
          PKPR: player.ratings.kickPower, // PKPR not PKPW
          PKAC: player.ratings.kickAccuracy,
          PKRT: player.ratings.kickReturn,
          PLSN: player.ratings.longSnap,

          // Overall
          POVR: player.ratings.overall,

          // Metadata
          isHallOfFamer: player.devTrait === 3 // X-Factor dev trait indicates HOFer
        };

        return rosterPlayer;
      });

      // DEBUG: Log first player AFTER conversion
      if (rosterPlayers.length > 0) {
        const firstRoster = rosterPlayers[0];
        console.log(`[RosterCreatorService] First RosterPlayer AFTER conversion:`);
        console.log(`  - Name: ${firstRoster.PFNA} ${firstRoster.PLNA}`);
        console.log(`  - Position: ${firstRoster.PPOS}`);
        console.log(`  - Team ID: ${firstRoster.TGID}`);
        console.log(`  - College ID: ${firstRoster.PCOL}, HomeState ID: ${firstRoster.PHSN}`);
        console.log(`  - Overall: ${firstRoster.POVR}`);
        console.log(`  - Speed: ${firstRoster.PSPD}, Strength: ${firstRoster.PSTR}`);
        console.log(`  - All field names:`, Object.keys(firstRoster).slice(0, 20).join(', ') + '...');
      }

      // DEBUG: Check for any players with team ID 0 (Unknown team)
      const unknownTeamCount = rosterPlayers.filter(p => p.TGID === 0).length;
      if (unknownTeamCount > 0) {
        console.warn(`[RosterCreatorService] ⚠️ WARNING: ${unknownTeamCount} players have Unknown Team (TGID=0)!`);
        const unknownSample = rosterPlayers.filter(p => p.TGID === 0).slice(0, 5);
        unknownSample.forEach(p => {
          console.warn(`  - ${p.PFNA} ${p.PLNA} (${p.PPOS}) - original team was probably not set`);
        });
      }

      progressCallback?.(100, `Roster generation complete! ${rosterPlayers.length} players created.`);

      console.log(`[RosterCreatorService] Roster generation complete`);
      console.log(`[RosterCreatorService] Total players: ${rosterPlayers.length}`);

      return rosterPlayers;

    } catch (error: any) {
      console.error('[RosterCreatorService] Error generating roster:', error);
      await scraperService.closeBrowser();
      throw new Error(`Failed to generate roster: ${error.message}`);
    }
  }

  /**
   * Save generated roster to file
   * @param players - Array of roster players
   * @param templatePath - Path to template roster file
   * @param outputPath - Path for output file
   * @returns Success status
   */
  async saveRoster(
    players: RosterPlayer[],
    templatePath: string,
    outputPath: string
  ): Promise<boolean> {
    try {
      console.log(`[RosterCreatorService] Saving roster to: ${outputPath}`);
      console.log(`[RosterCreatorService] Template: ${templatePath}`);
      console.log(`[RosterCreatorService] Players: ${players.length}`);

      // Use MaddenRosterHelper to load template and save roster
      // In build: main.js is at .vite/build/main.js, lib is at .vite/build/lib/
      const helperPath = path.join(__dirname, 'lib', 'helpers', 'MaddenRosterHelper');
      console.log(`[RosterCreatorService] Loading MaddenRosterHelper from: ${helperPath}`);
      const MaddenRosterHelper = require(helperPath);
      const helper = new MaddenRosterHelper();

      // Load template roster file
      console.log(`[RosterCreatorService] Loading template roster...`);
      const file = await helper.load(templatePath);
      console.log(`[RosterCreatorService] Template loaded with ${file.tables.length} tables`);

      // Get player table
      const playerTable = file.PLAY;
      if (!playerTable) {
        throw new Error('PLAY table not found in template file');
      }

      console.log(`[RosterCreatorService] Template has ${playerTable.records.length} player slots`);
      console.log(`[RosterCreatorService] Updating with ${players.length} generated players`);

      // Update player records in template
      const playersToWrite = Math.min(players.length, playerTable.records.length);
      console.log(`[RosterCreatorService] Will write ${playersToWrite} players`);

      for (let i = 0; i < playersToWrite; i++) {
        const record = playerTable.records[i];
        const playerData = players[i];

        // Update each field in the record
        for (const fieldName in playerData) {
          // Skip metadata fields
          if (fieldName === 'isHallOfFamer' || fieldName === '_sourceStats') {
            continue;
          }

          if (record.fields[fieldName]) {
            record.fields[fieldName].value = playerData[fieldName];
          } else {
            console.warn(`[RosterCreatorService] Field ${fieldName} not found in record ${i}`);
          }
        }
      }

      console.log(`[RosterCreatorService] Updated ${playersToWrite} player records`);

      // Save the modified roster file
      console.log(`[RosterCreatorService] Saving to: ${outputPath}`);
      await helper.save(outputPath);

      console.log(`[RosterCreatorService] ✓ Roster saved successfully as Madden 26 file`);
      console.log(`[RosterCreatorService] File: ${outputPath}`);

      return true;

    } catch (error: any) {
      console.error('[RosterCreatorService] Error saving roster:', error);
      throw new Error(`Failed to save roster: ${error.message}`);
    }
  }

  /**
   * Validate year is in valid range
   */
  validateYear(year: number): boolean {
    return year >= 1920 && year <= 2025;
  }

  /**
   * Get roster statistics
   */
  getRosterStats(players: RosterPlayer[]): any {
    const stats = {
      totalPlayers: players.length,
      hofPlayers: players.filter(p => p.isHallOfFamer).length,
      playersByTeam: {} as { [teamId: number]: number },
      playersByPosition: {} as { [position: string]: number },
      averageOVR: 0,
      topPlayers: [] as RosterPlayer[]
    };

    // Count by team
    for (const player of players) {
      stats.playersByTeam[player.TGID] = (stats.playersByTeam[player.TGID] || 0) + 1;
    }

    // Count by position
    for (const player of players) {
      stats.playersByPosition[player.PPOS] = (stats.playersByPosition[player.PPOS] || 0) + 1;
    }

    // Calculate average OVR
    const totalOVR = players.reduce((sum, p) => sum + (p.POVR || 0), 0);
    stats.averageOVR = Math.round(totalOVR / players.length);

    // Get top 10 players
    stats.topPlayers = players
      .sort((a, b) => (b.POVR || 0) - (a.POVR || 0))
      .slice(0, 10);

    return stats;
  }

  /**
   * Convert height string to inches
   * @param height - Height string like "6-2"
   * @returns Height in inches
   */
  private heightToInches(height: string): number {
    const parts = height.split('-');
    if (parts.length === 2) {
      const feet = parseInt(parts[0]);
      const inches = parseInt(parts[1]);
      return (feet * 12) + inches;
    }
    return 72; // Default 6'0"
  }

  /**
   * Convert inches to height string
   * @param inches - Height in inches
   * @returns Height string like "6-2"
   */
  private inchesToHeight(inches: number): string {
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}-${remainingInches}`;
  }
}

// Export singleton instance
export const rosterCreatorService = new RosterCreatorService();
