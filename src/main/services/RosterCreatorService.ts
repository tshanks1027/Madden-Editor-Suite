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
import * as XLSX from 'xlsx';
import { app } from 'electron';

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

export interface MaddenHistoricalPlayer {
  firstName: string;
  lastName: string;
  fullName?: string;
  position: string;
  team: string;
  jerseyNumber: number;
  overall: number;
  attributes: { [key: string]: number };
  height?: number;
  weight?: number;
  age?: number;
  yearsPro?: number;
  college?: string;
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

      // Try to load actual Madden ratings for this year (1999-2024)
      let maddenRatings: Map<string, MaddenHistoricalPlayer> | null = null;
      if (year >= 1999 && year <= 2024) {
        progressCallback?.(15, `Checking for Madden ${year} ratings...`);
        console.log(`[RosterCreatorService] Attempting to load Madden ${year} historical ratings...`);
        maddenRatings = await this.loadMaddenOldRatings(year);
        if (maddenRatings && maddenRatings.size > 0) {
          console.log(`[RosterCreatorService] ✓ Loaded ${maddenRatings.size} players from Madden ${year} ratings`);
          scraperDebugLogger.log(`✓ Loaded ${maddenRatings.size} players from actual Madden ${year} ratings\n`);
        } else {
          console.log(`[RosterCreatorService] No Madden ${year} ratings found, will use stat-based generation`);
        }
      }

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

      // Track how many players used Madden ratings
      let maddenRatingMatches = 0;

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

        // Check if we have actual Madden ratings for this player
        let maddenPlayer: MaddenHistoricalPlayer | null = null;
        if (maddenRatings && maddenRatings.size > 0) {
          maddenPlayer = this.findMaddenPlayerMatch(
            player.firstName,
            player.lastName,
            player.position,
            maddenRatings
          );

          if (maddenPlayer) {
            maddenRatingMatches++;
            if (idx < 10) {
              console.log(`[RosterCreatorService] ✓ Found Madden ratings for ${player.firstName} ${player.lastName} (${player.position}) - OVR ${maddenPlayer.overall}`);
            }
          }
        }

        // Use Madden ratings if available, otherwise use generated ratings
        const finalRatings = maddenPlayer ? maddenPlayer.attributes : player.ratings;
        const finalOverall = maddenPlayer ? maddenPlayer.overall : player.ratings.overall;
        const finalHeight = maddenPlayer?.height || player.heightInches;
        const finalWeight = maddenPlayer?.weight || player.weight;
        const finalAge = maddenPlayer?.age || player.age;
        const finalYearsPro = maddenPlayer?.yearsPro || player.yearsPro;

        // Convert GeneratedPlayer to RosterPlayer format
        const rosterPlayer: RosterPlayer = {
          PFNA: player.firstName,
          PLNA: player.lastName,
          PPOS: player.positionCode, // Use numeric position code for lookups
          TGID: teamId,
          PAGE: finalAge,
          PJEN: player.jerseyNum,
          PHGT: finalHeight,
          PWGT: finalWeight,
          PCOL: player.college, // College ID (already numeric from CreatorService)
          PHSN: player.homeState, // Home state ID (already numeric from CreatorService)

          // Dev trait (0-3)
          PDEV: player.devTrait,

          // PID (Player Picture ID), PAM, and Years Pro
          PSXP: player.PID, // Player Picture ID for face/headshot
          PEPS: player.PEPS || '', // Player Asset Model (PAM) - blank string for historical players
          PYRP: finalYearsPro, // Years in league
          PBOD: player.bodyType,

          // All ratings - use Madden ratings if available, otherwise use generated
          // NOTE: Field names MUST match Madden 26 field definitions exactly!
          PSPD: finalRatings.speed || player.ratings.speed,
          PACC: finalRatings.acceleration || player.ratings.acceleration,
          PAGI: finalRatings.agility || player.ratings.agility,
          PELU: finalRatings.changeOfDirection || player.ratings.changeOfDirection, // COD = PELU in M26
          PSTR: finalRatings.strength || player.ratings.strength,
          PAWR: finalRatings.awareness || player.ratings.awareness,
          PJMP: finalRatings.jumping || player.ratings.jumping,
          PSTA: finalRatings.stamina || player.ratings.stamina,
          PINJ: finalRatings.injury || player.ratings.injury,
          PTGH: finalRatings.toughness || player.ratings.toughness,

          // Passing
          PTHP: finalRatings.throwPower || player.ratings.throwPower,
          PTAS: finalRatings.throwAccuracyShort || player.ratings.throwAccuracyShort, // TAS not PTHA
          PTAM: finalRatings.throwAccuracyMid || player.ratings.throwAccuracyMid, // TAM not PTHM
          PTAD: finalRatings.throwAccuracyDeep || player.ratings.throwAccuracyDeep, // TAD not PTHD
          PTOR: finalRatings.throwOnTheRun || player.ratings.throwOnTheRun, // TOR not PTHO
          PTUP: finalRatings.throwUnderPressure || player.ratings.throwUnderPressure, // TUP not PTHU
          PPLA: finalRatings.playAction || player.ratings.playAction,
          PBSK: finalRatings.breakSack || player.ratings.breakSack,

          // Rushing/Carrying
          PCAR: finalRatings.carrying || player.ratings.carrying,
          PBCV: finalRatings.ballCarrierVision || player.ratings.ballCarrierVision,
          PBKT: finalRatings.breakTackle || player.ratings.breakTackle, // PBKT not PBTK
          PLTR: finalRatings.trucking || player.ratings.trucking, // PLTR not PTRK
          PLSA: finalRatings.stiffArm || player.ratings.stiffArm, // PLSA not PSFA
          PLSM: finalRatings.spinMove || player.ratings.spinMove, // PLSM not PSPM
          PLJM: finalRatings.jukeMove || player.ratings.jukeMove, // PLJM not PJKM

          // Receiving
          PCTH: finalRatings.catching || player.ratings.catching,
          PLCI: finalRatings.catchInTraffic || player.ratings.catchInTraffic, // PLCI not PCIT
          PLSC: finalRatings.spectacularCatch || player.ratings.spectacularCatch, // PLSC not PSPC
          PSRR: finalRatings.shortRouteRunning || player.ratings.shortRouteRunning,
          PMRR: finalRatings.mediumRouteRunning || player.ratings.mediumRouteRunning,
          PDRR: finalRatings.deepRouteRunning || player.ratings.deepRouteRunning,
          PLRL: finalRatings.release || player.ratings.release, // PLRL not PREL

          // Blocking
          PPBK: finalRatings.passBlock || player.ratings.passBlock,
          PPBS: finalRatings.passBlockPower || player.ratings.passBlockPower, // PPBS not PPBP (Pass Block Strength)
          PPBF: finalRatings.passBlockFinesse || player.ratings.passBlockFinesse,
          PRBK: finalRatings.runBlock || player.ratings.runBlock,
          PRBS: finalRatings.runBlockPower || player.ratings.runBlockPower, // PRBS not PRBP (Run Block Strength)
          PRBF: finalRatings.runBlockFinesse || player.ratings.runBlockFinesse,
          PLBK: finalRatings.leadBlock || player.ratings.leadBlock,
          PLIB: finalRatings.impactBlocking || player.ratings.impactBlocking, // PLIB not PIBL

          // Defense
          PTAK: finalRatings.tackle || player.ratings.tackle,
          PLHT: finalRatings.hitPower || player.ratings.hitPower, // PLHT not PHTP
          PLPM: finalRatings.powerMoves || player.ratings.powerMoves, // PLPM not PPOW
          PFMS: finalRatings.finesseMoves || player.ratings.finesseMoves,
          PBSG: finalRatings.blockShedding || player.ratings.blockShedding, // PBSG not PBSH
          PLPU: finalRatings.pursuit || player.ratings.pursuit, // PLPU not PPUR
          PLPR: finalRatings.playRecognition || player.ratings.playRecognition, // PLPR not PPRC
          PLMC: finalRatings.manCoverage || player.ratings.manCoverage, // PLMC not PMCV
          PLZC: finalRatings.zoneCoverage || player.ratings.zoneCoverage, // PLZC not PZCV
          PLPE: finalRatings.pressCoverage || player.ratings.pressCoverage, // PLPE not PPRS

          // Special Teams
          PKPR: finalRatings.kickPower || player.ratings.kickPower, // PKPR not PKPW
          PKAC: finalRatings.kickAccuracy || player.ratings.kickAccuracy,
          PKRT: finalRatings.kickReturn || player.ratings.kickReturn,
          PLSN: finalRatings.longSnap || player.ratings.longSnap,

          // Overall
          POVR: finalOverall,

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

      // Log Madden ratings usage summary
      if (maddenRatings && maddenRatings.size > 0) {
        const matchPercentage = ((maddenRatingMatches / rosterPlayers.length) * 100).toFixed(1);
        console.log(`\n[RosterCreatorService] ========== MADDEN RATINGS SUMMARY ==========`);
        console.log(`[RosterCreatorService] Total players: ${rosterPlayers.length}`);
        console.log(`[RosterCreatorService] Players with Madden ${year} ratings: ${maddenRatingMatches} (${matchPercentage}%)`);
        console.log(`[RosterCreatorService] Players with generated ratings: ${rosterPlayers.length - maddenRatingMatches}`);
        console.log(`[RosterCreatorService] ===============================================\n`);

        scraperDebugLogger.log(`\n=== MADDEN RATINGS SUMMARY ===`);
        scraperDebugLogger.log(`Total players: ${rosterPlayers.length}`);
        scraperDebugLogger.log(`Players using actual Madden ${year} ratings: ${maddenRatingMatches} (${matchPercentage}%)`);
        scraperDebugLogger.log(`Players using stat-based generation: ${rosterPlayers.length - maddenRatingMatches}`);
        scraperDebugLogger.log(`==============================\n`);
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

  /**
   * Get column mapping for a specific year
   * @param year - The year to get mapping for
   * @returns Column mapping object
   */
  private getColumnMappingForYear(year: number): any {
    const mappingPath = app.isPackaged
      ? path.join(app.getAppPath(), 'data', 'madden-ratings-column-mapping.json')
      : path.join(__dirname, '../../data/madden-ratings-column-mapping.json');

    const mappingData = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

    // Determine which year range to use
    if (year >= 2024) {
      return mappingData.yearRanges['2024'];
    } else if (year >= 2018) {
      return mappingData.yearRanges['2018-2023'];
    } else if (year >= 2013) {
      return mappingData.yearRanges['2013-2017'];
    } else if (year >= 2005) {
      return mappingData.yearRanges['2005-2012'];
    } else {
      return mappingData.yearRanges['2002-2004'];
    }
  }

  /**
   * Get file structure type for a year
   * @param year - The year to check
   * @returns 'consolidated' or 'team-based'
   */
  private getFileStructure(year: number): 'consolidated' | 'team-based' {
    const mappingPath = app.isPackaged
      ? path.join(app.getAppPath(), 'data', 'madden-ratings-column-mapping.json')
      : path.join(__dirname, '../../data/madden-ratings-column-mapping.json');

    const mappingData = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    return mappingData.fileStructure[year.toString()] || 'consolidated';
  }

  /**
   * Load Madden Old Ratings for a specific year
   * @param year - The year to load ratings for (1999-2024)
   * @returns Map of players keyed by name+position
   */
  async loadMaddenOldRatings(year: number): Promise<Map<string, MaddenHistoricalPlayer>> {
    const playersMap = new Map<string, MaddenHistoricalPlayer>();

    try {
      const ratingsDir = app.isPackaged
        ? path.join(app.getAppPath(), 'data', 'Madden Old Ratings')
        : path.join(__dirname, '../../data/Madden Old Ratings');

      const fileStructure = this.getFileStructure(year);
      const columnMapping = this.getColumnMappingForYear(year);

      console.log(`[RosterCreatorService] Loading Madden ${year} ratings (${fileStructure} structure)`);

      if (fileStructure === 'consolidated') {
        // Load single consolidated file
        const fileName = this.getMaddenRatingsFileName(year);
        const filePath = path.join(ratingsDir, fileName);

        if (!fs.existsSync(filePath)) {
          console.warn(`[RosterCreatorService] Madden ratings file not found: ${filePath}`);
          return playersMap;
        }

        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        for (const row of rows) {
          const player = this.parseMaddenPlayer(row as any, columnMapping, year);
          if (player) {
            const key = this.getPlayerKey(player.firstName, player.lastName, player.position);
            playersMap.set(key, player);
          }
        }

        console.log(`[RosterCreatorService] Loaded ${playersMap.size} players from ${fileName}`);

      } else {
        // Load team-based files
        const yearDir = path.join(ratingsDir, year.toString());
        if (!fs.existsSync(yearDir)) {
          console.warn(`[RosterCreatorService] Madden ratings directory not found: ${yearDir}`);
          return playersMap;
        }

        const teamFiles = fs.readdirSync(yearDir).filter(f => f.endsWith('.xlsx'));
        console.log(`[RosterCreatorService] Found ${teamFiles.length} team files for ${year}`);

        for (const teamFile of teamFiles) {
          const filePath = path.join(yearDir, teamFile);
          const workbook = XLSX.readFile(filePath);
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet);

          for (const row of rows) {
            const player = this.parseMaddenPlayer(row as any, columnMapping, year);
            if (player) {
              const key = this.getPlayerKey(player.firstName, player.lastName, player.position);
              playersMap.set(key, player);
            }
          }
        }

        console.log(`[RosterCreatorService] Loaded ${playersMap.size} players from ${teamFiles.length} team files`);
      }

      return playersMap;

    } catch (error: any) {
      console.error(`[RosterCreatorService] Error loading Madden ${year} ratings:`, error);
      return playersMap;
    }
  }

  /**
   * Get Madden ratings filename for a year
   * @param year - The year
   * @returns Filename
   */
  private getMaddenRatingsFileName(year: number): string {
    // Handle naming variations
    if (year === 2013 || year === 2015) {
      return `${year} Roster.xlsx`;
    } else if (year === 2023) {
      return `${year} Rosterss.xlsx`; // Note: double 's' in filename
    } else if (year === 2002 || year === 2004) {
      return `${year} Rosters.xlsx`;
    } else {
      return `${year} Rosters.xlsx`;
    }
  }

  /**
   * Parse a Madden player from Excel row
   * @param row - Excel row data
   * @param columnMapping - Column mapping for the year
   * @param year - The year
   * @returns Parsed player or null
   */
  private parseMaddenPlayer(
    row: any,
    columnMapping: any,
    year: number
  ): MaddenHistoricalPlayer | null {
    try {
      // Handle fullName vs firstName/lastName
      let firstName = '';
      let lastName = '';
      let fullName = '';

      if (columnMapping.fullName && row[columnMapping.fullName]) {
        fullName = row[columnMapping.fullName];
        // Split full name (assuming "First Last" format)
        const parts = fullName.trim().split(' ');
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        } else {
          firstName = fullName;
          lastName = '';
        }
      } else {
        firstName = row[columnMapping.firstName] || '';
        lastName = row[columnMapping.lastName] || '';
      }

      const position = row[columnMapping.position] || '';
      const team = row[columnMapping.team] || '';
      const overall = parseInt(row[columnMapping.overall]) || 70;

      if (!firstName || !position) {
        return null; // Skip invalid rows
      }

      // Parse all attributes
      const attributes: { [key: string]: number } = {};
      for (const [attrKey, excelColumn] of Object.entries(columnMapping)) {
        if (attrKey === 'firstName' || attrKey === 'lastName' || attrKey === 'fullName' ||
            attrKey === 'position' || attrKey === 'team' || attrKey === 'overall' ||
            attrKey === 'jerseyNumber' || attrKey === 'height' || attrKey === 'weight' ||
            attrKey === 'age' || attrKey === 'yearsPro' || attrKey === 'college' ||
            attrKey === 'teamId' || attrKey === 'primaryKey' || attrKey === 'birthdate' ||
            attrKey === 'totalSalary' || attrKey === 'signingBonus' || attrKey === 'handedness' ||
            attrKey === 'portraitId' || attrKey === 'runningStyle' || attrKey === 'archetype') {
          continue;
        }

        if (row[excelColumn as string] !== undefined && row[excelColumn as string] !== null) {
          const value = parseInt(row[excelColumn as string]);
          if (!isNaN(value)) {
            attributes[attrKey] = value;
          }
        }
      }

      // Parse optional fields
      const jerseyNumber = columnMapping.jerseyNumber ? (parseInt(row[columnMapping.jerseyNumber]) || 0) : 0;
      const age = columnMapping.age ? (parseInt(row[columnMapping.age]) || 25) : 25;
      const yearsPro = columnMapping.yearsPro ? (parseInt(row[columnMapping.yearsPro]) || 0) : 0;
      const college = columnMapping.college ? row[columnMapping.college] : undefined;

      // Parse height (can be inches or "6-2" format)
      let height: number | undefined;
      if (columnMapping.height && row[columnMapping.height]) {
        const heightValue = row[columnMapping.height];
        if (typeof heightValue === 'string' && heightValue.includes('-')) {
          height = this.heightToInches(heightValue);
        } else {
          height = parseInt(heightValue) || undefined;
        }
      }

      const weight = columnMapping.weight ? (parseInt(row[columnMapping.weight]) || undefined) : undefined;

      return {
        firstName,
        lastName,
        fullName: fullName || `${firstName} ${lastName}`,
        position,
        team,
        jerseyNumber,
        overall,
        attributes,
        height,
        weight,
        age,
        yearsPro,
        college
      };

    } catch (error) {
      console.error('[RosterCreatorService] Error parsing Madden player:', error);
      return null;
    }
  }

  /**
   * Generate player key for matching
   * @param firstName - First name
   * @param lastName - Last name
   * @param position - Position
   * @returns Key string
   */
  private getPlayerKey(firstName: string, lastName: string, position: string): string {
    // Normalize for matching: lowercase, remove punctuation, trim whitespace
    const normFirst = firstName.toLowerCase().replace(/[^a-z]/g, '').trim();
    const normLast = lastName.toLowerCase().replace(/[^a-z]/g, '').trim();
    const normPos = position.toUpperCase().trim();
    return `${normFirst}_${normLast}_${normPos}`;
  }

  /**
   * Try to find a Madden historical player match
   * @param firstName - First name to match
   * @param lastName - Last name to match
   * @param position - Position to match
   * @param maddenRatings - Map of Madden historical players
   * @returns Matched player or null
   */
  findMaddenPlayerMatch(
    firstName: string,
    lastName: string,
    position: string,
    maddenRatings: Map<string, MaddenHistoricalPlayer>
  ): MaddenHistoricalPlayer | null {
    // Try exact match first
    const exactKey = this.getPlayerKey(firstName, lastName, position);
    if (maddenRatings.has(exactKey)) {
      return maddenRatings.get(exactKey)!;
    }

    // Try without position (for position changes)
    const nameOnlyKey = `${firstName.toLowerCase().replace(/[^a-z]/g, '')}_${lastName.toLowerCase().replace(/[^a-z]/g, '')}`;
    for (const [key, player] of maddenRatings.entries()) {
      if (key.startsWith(nameOnlyKey)) {
        console.log(`[RosterCreatorService] Position mismatch match: ${firstName} ${lastName} (${position} -> ${player.position})`);
        return player;
      }
    }

    // No match found
    return null;
  }
}

// Export singleton instance
export const rosterCreatorService = new RosterCreatorService();
