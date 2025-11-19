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
import { rosterGeneratorService } from './RosterGeneratorService';
import { app } from 'electron';
import Papa from 'papaparse';
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
  { abbr: 'hou', name: 'Houston Texans', id: 32 },      // HOU in Madden
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

      progressCallback?.(30, `Generating roster using scraper service...`);

      // Generate roster using the creator service (web scraping)
      const generatedPlayers = await creatorService.generateRoster(
        year,
        [],
        ratingMode
      );

      console.log(`[RosterCreatorService] Generated ${generatedPlayers.length} players from scraper`);

      progressCallback?.(80, `Converting players to roster format...`);

      console.log(`[RosterCreatorService] ========== CONVERTING TO ROSTER FORMAT ==========`);
      console.log(`[RosterCreatorService] Converting ${generatedPlayers.length} generated players to RosterPlayer format`);

      // DEBUG: Log first player BEFORE conversion
      if (generatedPlayers.length > 0) {
        const firstGen = generatedPlayers[0];
        console.log(`[RosterCreatorService] First GeneratedPlayer BEFORE conversion:`);
        console.log(`  - Name: ${firstGen.PFNA || firstGen.firstName} ${firstGen.PLNA || firstGen.lastName}`);
        console.log(`  - Position: ${firstGen.position} (code ${firstGen.positionCode})`);
        console.log(`  - Team: ${firstGen.team}`);
        console.log(`  - College ID: ${firstGen.college}, HomeState ID: ${firstGen.homeState}`);
        console.log(`  - Overall: ${firstGen.ratings?.overall || 'N/A'}`);
        console.log(`  - Speed: ${firstGen.ratings?.speed || 'N/A'}, Strength: ${firstGen.ratings?.strength || 'N/A'}`);
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
        const teamId = teamObj ? teamObj.id : 1009; // 1009 = Free Agent (team_lookup.csv uses IDs 1-32, 1009 for FA)

        // DEBUG: Log team mapping for first 5 players
        if (idx < 5) {
          console.log(`[RosterCreatorService] Player ${idx + 1} team mapping: "${player.team}" -> ID ${teamId} (found: ${!!teamObj}, teamObj: ${teamObj?.name})`);
        }

        // Warn about unmapped teams
        if (!teamObj && player.team) {
          console.warn(`[RosterCreatorService] ⚠️ Unmapped team abbreviation: "${player.team}" for player ${player.PFNA || player.firstName} ${player.PLNA || player.lastName}`);
        }

        // Convert GeneratedPlayer to RosterPlayer format
        const rosterPlayer: RosterPlayer = {
          PFNA: player.PFNA || player.firstName,
          PLNA: player.PLNA || player.lastName,
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

      // DEBUG: Check for any players with invalid team IDs (not 1-32 or 1009)
      const invalidTeamPlayers = rosterPlayers.filter(p => {
        const tgid = p.TGID;
        return (tgid < 1 || tgid > 32) && tgid !== 1009;
      });
      if (invalidTeamPlayers.length > 0) {
        console.warn(`[RosterCreatorService] ⚠️ WARNING: ${invalidTeamPlayers.length} players have invalid team IDs!`);
        const invalidSample = invalidTeamPlayers.slice(0, 5);
        invalidSample.forEach(p => {
          console.warn(`  - ${p.PFNA} ${p.PLNA} (${p.PPOS}) - TGID=${p.TGID} (expected 1-32 or 1009)`);
        });
      }

      progressCallback?.(85, `Collecting free agents to fill roster...`);

      // Collect free agents from 5 years before to fill remaining roster slots
      console.log(`[RosterCreatorService] ===== FREE AGENT COLLECTION =====`);
      const freeAgents = await this.collectFreeAgents(year, rosterPlayers, maxPlayers);
      console.log(`[RosterCreatorService] Free agents collected: ${freeAgents.length}`);

      // Combine team rosters with free agents
      const finalRoster = [...rosterPlayers, ...freeAgents];
      console.log(`[RosterCreatorService] Final roster size: ${finalRoster.length} (team: ${rosterPlayers.length}, FA: ${freeAgents.length})`);

      progressCallback?.(100, `Roster generation complete! ${finalRoster.length} players created.`);

      console.log(`[RosterCreatorService] Roster generation complete`);
      console.log(`[RosterCreatorService] Total players: ${finalRoster.length}`);

      return finalRoster;

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

      // Step 1: Copy template to output path
      console.log(`[RosterCreatorService] Copying template to output path...`);
      await fs.promises.copyFile(templatePath, outputPath);
      console.log(`[RosterCreatorService] Template copied successfully`);

      // Step 2: Load the copied file
      console.log(`[RosterCreatorService] Loading copied roster...`);
      const RosterParser = require(path.join(__dirname, 'parsers', 'RosterParser.js'));
      const { parseRosterFile, saveRosterFile } = RosterParser;

      const rosterData = await parseRosterFile(outputPath);
      const templateSize = rosterData.playerCount;
      console.log(`[RosterCreatorService] ===== PADDING DEBUG =====`);
      console.log(`[RosterCreatorService] Template has ${templateSize} slots, we generated ${players.length} players`);

      // PAD to match template size (generate random players for missing slots)
      let finalPlayers = [...players];
      if (finalPlayers.length < templateSize) {
        console.log(`[RosterCreatorService] Padding ${templateSize - finalPlayers.length} random players to match template size...`);
        while (finalPlayers.length < templateSize) {
          const randomPlayer = await rosterGeneratorService.generateRandomPlayer(2024);
          console.log(`[RosterCreatorService] Generated padding player ${finalPlayers.length + 1}: ${randomPlayer.PFNA} ${randomPlayer.PLNA}`);
          finalPlayers.push(randomPlayer);
        }
        console.log(`[RosterCreatorService] ✓ Padded to ${finalPlayers.length} total players`);
      } else {
        console.log(`[RosterCreatorService] No padding needed - already have enough players`);
      }

      console.log(`[RosterCreatorService] About to write ${finalPlayers.length} players to file with ${templateSize} slots`);
      console.log(`[RosterCreatorService] ===== END PADDING DEBUG =====`);

      // Step 4: Save back to the same file
      await saveRosterFile(outputPath, finalPlayers, rosterData);

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
   * Collect free agents from ROSTER_lookup.csv for 5 years before the target year
   * Uses players' final year stats (most recent season)
   * Excludes players already on the current roster
   * @param year - Target roster year
   * @param currentRosterPlayers - Players already on current roster
   * @param maxPlayers - Maximum total roster size from template
   * @returns Free agent players to fill remaining roster slots
   */
  private async collectFreeAgents(
    year: number,
    currentRosterPlayers: RosterPlayer[],
    maxPlayers: number
  ): Promise<RosterPlayer[]> {
    console.log(`[RosterCreatorService] ===== COLLECTING FREE AGENTS =====`);
    console.log(`[RosterCreatorService] Target year: ${year}`);
    console.log(`[RosterCreatorService] Current roster size: ${currentRosterPlayers.length}`);
    console.log(`[RosterCreatorService] Template max: ${maxPlayers}`);
    console.log(`[RosterCreatorService] Need ${maxPlayers - currentRosterPlayers.length} free agents`);

    // Load ROSTER_lookup.csv
    const csvPath = path.join(app.getAppPath(), 'data', 'lookups', 'ROSTER_lookup.csv');
    console.log(`[RosterCreatorService] Loading CSV from: ${csvPath}`);
    console.log(`[RosterCreatorService] CSV exists: ${fs.existsSync(csvPath)}`);

    if (!fs.existsSync(csvPath)) {
      console.error(`[RosterCreatorService] ROSTER_lookup.csv NOT FOUND - generating all random players`);
      const needed = maxPlayers - currentRosterPlayers.length;
      const randoms: RosterPlayer[] = [];
      for (let i = 0; i < needed; i++) {
        randoms.push(this.generateLowTierPlayer(year));
      }
      return randoms;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });

    console.log(`[RosterCreatorService] Parsed ${parsed.data.length} CSV rows`);

    // Build set of players already on current roster (firstName|lastName only - ignore position)
    const rosterPlayerNames = new Set(
      currentRosterPlayers.map(p => `${p.PFNA}|${p.PLNA}`)
    );
    console.log(`[RosterCreatorService] Current roster has ${rosterPlayerNames.size} unique player names`);

    // Collect free agents from 5 years BEFORE target year
    const freeAgentsByKey = new Map<string, any>();
    const startYear = year - 5;
    const endYear = year - 1;

    console.log(`[RosterCreatorService] Scanning years ${startYear} to ${endYear} for free agents...`);

    for (const csvRow of parsed.data as any[]) {
      const rowYear = Math.floor(csvRow.Year);

      // Only include years 5-1 before target year
      if (rowYear < startYear || rowYear > endYear) {
        continue;
      }

      const firstName = csvRow.PFNA || csvRow.firstName || '';
      const lastName = csvRow.PLNA || csvRow.lastName || '';
      const nameKey = `${firstName}|${lastName}`;

      // Skip if already on current roster
      if (rosterPlayerNames.has(nameKey)) {
        continue;
      }

      // Keep LAST year (most recent) for each free agent
      // Use their final season stats and age
      const existing = freeAgentsByKey.get(nameKey);
      const existingYear = existing ? Math.floor(existing.Year) : 0;

      if (!existing || rowYear > existingYear) {
        freeAgentsByKey.set(nameKey, csvRow);
      }
    }

    console.log(`[RosterCreatorService] Found ${freeAgentsByKey.size} unique free agents`);

    // Convert CSV rows to RosterPlayer format
    const freeAgentPlayers: RosterPlayer[] = [];

    for (const csvRow of freeAgentsByKey.values()) {
      try {
        // Convert CSV row to RosterPlayer format
        const rosterPlayer: RosterPlayer = {
          PFNA: csvRow.PFNA || csvRow.firstName || 'Unknown',
          PLNA: csvRow.PLNA || csvRow.lastName || 'Unknown',
          PPOS: csvRow.PPOS || csvRow.position || 0,
          TGID: 1009, // Free Agent team ID
          PAGE: csvRow.PAGE || csvRow.age || 25,
          PJEN: csvRow.PJEN || csvRow.jerseyNum || 99,
          PHGT: csvRow.PHGT || csvRow.heightInches || 72,
          PWGT: csvRow.PWGT || csvRow.weight || 220,
          PCOL: csvRow.PCOL || csvRow.college || 0,
          PHSN: csvRow.PHSN || csvRow.homeState || 0,

          // Dev trait
          PDEV: csvRow.PDEV || csvRow.devTrait || 0,

          // PID, PAM, Years Pro
          PSXP: csvRow.PSXP || csvRow.PID || 0,
          PEPS: csvRow.PEPS || csvRow.PAM || '',
          PYRP: csvRow.PYRP || csvRow.yearsPro || 0,
          PBOD: csvRow.PBOD || csvRow.bodyType || 0,

          // All ratings - use CSV values directly
          PSPD: csvRow.PSPD || 50,
          PACC: csvRow.PACC || 50,
          PAGI: csvRow.PAGI || 50,
          PELU: csvRow.PELU || csvRow.PCOD || 50, // COD = PELU
          PSTR: csvRow.PSTR || 50,
          PAWR: csvRow.PAWR || 50,
          PJMP: csvRow.PJMP || 50,
          PSTA: csvRow.PSTA || 50,
          PINJ: csvRow.PINJ || 50,
          PTGH: csvRow.PTGH || 50,

          // Passing
          PTHP: csvRow.PTHP || 50,
          PTAS: csvRow.PTAS || 50,
          PTAM: csvRow.PTAM || 50,
          PTAD: csvRow.PTAD || 50,
          PTOR: csvRow.PTOR || 50,
          PTUP: csvRow.PTUP || 50,
          PPLA: csvRow.PPLA || csvRow.PPWM || 50, // Play Action
          PBSK: csvRow.PBSK || csvRow.PBRS || 50, // Break Sack

          // Rushing/Carrying
          PCAR: csvRow.PCAR || 50,
          PBCV: csvRow.PBCV || 50,
          PBKT: csvRow.PBKT || csvRow.PBTK || 50, // Break Tackle
          PLTR: csvRow.PLTR || csvRow.PTRK || 50, // Trucking
          PLSA: csvRow.PLSA || csvRow.PSTF || 50, // Stiff Arm
          PLSM: csvRow.PLSM || csvRow.PSPM || 50, // Spin Move
          PLJM: csvRow.PLJM || csvRow.PJUM || 50, // Juke Move

          // Receiving
          PCTH: csvRow.PCTH || 50,
          PLCI: csvRow.PLCI || csvRow.PCIT || 50, // Catch in Traffic
          PLSC: csvRow.PLSC || csvRow.PSPC || 50, // Spectacular Catch
          PSRR: csvRow.PSRR || 50,
          PMRR: csvRow.PMRR || 50,
          PDRR: csvRow.PDRR || 50,
          PLRL: csvRow.PLRL || csvRow.PREL || 50, // Release

          // Blocking
          PPBK: csvRow.PPBK || 50,
          PPBS: csvRow.PPBS || csvRow.PPBP || 50, // Pass Block Strength
          PPBF: csvRow.PPBF || 50,
          PRBK: csvRow.PRBK || 50,
          PRBS: csvRow.PRBS || csvRow.PRBP || 50, // Run Block Strength
          PRBF: csvRow.PRBF || 50,
          PLBK: csvRow.PLBK || csvRow.PLDB || 50, // Lead Block
          PLIB: csvRow.PLIB || csvRow.PIBL || 50, // Impact Blocking

          // Defense
          PTAK: csvRow.PTAK || 50,
          PLHT: csvRow.PLHT || csvRow.PHTP || 50, // Hit Power
          PLPM: csvRow.PLPM || csvRow.PPWM || 50, // Power Moves
          PFMS: csvRow.PFMS || csvRow.PFNM || 50, // Finesse Moves
          PBSG: csvRow.PBSG || csvRow.PBSH || 50, // Block Shedding
          PLPU: csvRow.PLPU || csvRow.PPUR || 50, // Pursuit
          PLPR: csvRow.PLPR || csvRow.PPRC || 50, // Play Recognition
          PLMC: csvRow.PLMC || csvRow.PMCV || 50, // Man Coverage
          PLZC: csvRow.PLZC || csvRow.PZCV || 50, // Zone Coverage
          PLPE: csvRow.PLPE || csvRow.PPRS || 50, // Press Coverage

          // Special Teams
          PKPR: csvRow.PKPR || csvRow.PKPW || 50, // Kick Power
          PKAC: csvRow.PKAC || 50,
          PKRT: csvRow.PKRT || 50,
          PLSN: csvRow.PLSN || 50, // Long Snap

          // Overall
          POVR: csvRow.POVR || 50,

          // Metadata
          isHallOfFamer: (csvRow.PDEV || csvRow.devTrait || 0) === 3
        };

        freeAgentPlayers.push(rosterPlayer);
      } catch (error: any) {
        console.error(`[RosterCreatorService] Error converting CSV row to RosterPlayer:`, error);
      }
    }

    // Sort by POVR descending (best players first)
    freeAgentPlayers.sort((a, b) => b.POVR - a.POVR);

    // Calculate how many free agents we need to fill the template
    const needed = maxPlayers - currentRosterPlayers.length;
    console.log(`[RosterCreatorService] Need ${needed} free agents to reach template size ${maxPlayers}`);
    console.log(`[RosterCreatorService] Found ${freeAgentPlayers.length} real free agents from CSV`);

    // Take what we need (or all if not enough)
    let finalFreeAgents = freeAgentPlayers.slice(0, needed);
    console.log(`[RosterCreatorService] Took ${finalFreeAgents.length} real free agents from CSV`);

    // CRITICAL: If not enough real free agents, generate random low-tier players to FILL TEMPLATE
    if (finalFreeAgents.length < needed) {
      const stillNeeded = needed - finalFreeAgents.length;
      console.log(`[RosterCreatorService] *** STILL NEED ${stillNeeded} MORE PLAYERS - GENERATING RANDOM ***`);

      // Generate random low-tier players (40-55 OVR)
      for (let i = 0; i < stillNeeded; i++) {
        const randomPlayer: RosterPlayer = this.generateLowTierPlayer(year);
        finalFreeAgents.push(randomPlayer);
      }
      console.log(`[RosterCreatorService] *** ADDED ${stillNeeded} RANDOM PLAYERS ***`);
    }

    console.log(`[RosterCreatorService] *** FINAL COUNT: ${finalFreeAgents.length} free agents (${Math.min(freeAgentPlayers.length, needed)} real + ${Math.max(0, needed - freeAgentPlayers.length)} random) ***`);
    console.log(`[RosterCreatorService] *** THIS SHOULD EQUAL NEEDED (${needed}) ***`);

    return finalFreeAgents;
  }

  /**
   * Get team abbreviation from team ID
   * @param teamId - Madden team ID (1-32, 1009 for FA)
   * @returns Team abbreviation (e.g., 'crd', 'atl', 'fa')
   */
  private getTeamAbbrFromId(teamId: number): string {
    const team = NFL_TEAMS.find(t => t.id === teamId);
    return team ? team.abbr : 'fa'; // Default to free agent if not found
  }

  /**
   * Generate a low-tier random player in GeneratedPlayer format
   * Used to fill template slots when not enough real players exist
   * @param year - Season year
   * @returns Player in GeneratedPlayer format (with nested ratings object)
   */
  private generateLowTierGeneratedPlayer(year: number): any {
    // Random position (weighted towards common positions)
    const positions = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    const position = positions[Math.floor(Math.random() * positions.length)];

    // Random name from common names
    const firstNames = ['John', 'Mike', 'Chris', 'Dave', 'Tom', 'Dan', 'Jim', 'Steve', 'Mark', 'Paul'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    // Low-tier stats (40-55 OVR range)
    const baseRating = 40 + Math.floor(Math.random() * 16); // 40-55

    return {
      firstName: firstName,
      lastName: lastName,
      positionCode: position,
      position: 'WR', // Will be mapped correctly later
      team: 'fa',
      age: 23 + Math.floor(Math.random() * 5), // 23-27
      jerseyNum: 50 + Math.floor(Math.random() * 50), // 50-99
      heightInches: 70 + Math.floor(Math.random() * 8), // 70-77 inches
      weight: 200 + Math.floor(Math.random() * 80), // 200-279 lbs
      college: 0,
      homeState: 0,
      devTrait: 0,
      PID: 0,
      PEPS: '',
      yearsPro: 0,
      bodyType: 0,
      ratings: {
        overall: baseRating,
        speed: baseRating + Math.floor(Math.random() * 10) - 5,
        acceleration: baseRating + Math.floor(Math.random() * 10) - 5,
        agility: baseRating + Math.floor(Math.random() * 10) - 5,
        changeOfDirection: baseRating + Math.floor(Math.random() * 10) - 5,
        strength: baseRating + Math.floor(Math.random() * 10) - 5,
        awareness: baseRating + Math.floor(Math.random() * 10) - 5,
        jumping: baseRating + Math.floor(Math.random() * 10) - 5,
        stamina: baseRating + Math.floor(Math.random() * 10) - 5,
        injury: baseRating + Math.floor(Math.random() * 10) - 5,
        toughness: baseRating + Math.floor(Math.random() * 10) - 5,
        throwPower: baseRating + Math.floor(Math.random() * 10) - 5,
        throwAccuracyShort: baseRating + Math.floor(Math.random() * 10) - 5,
        throwAccuracyMid: baseRating + Math.floor(Math.random() * 10) - 5,
        throwAccuracyDeep: baseRating + Math.floor(Math.random() * 10) - 5,
        throwOnTheRun: baseRating + Math.floor(Math.random() * 10) - 5,
        throwUnderPressure: baseRating + Math.floor(Math.random() * 10) - 5,
        playAction: baseRating + Math.floor(Math.random() * 10) - 5,
        breakSack: baseRating + Math.floor(Math.random() * 10) - 5,
        carrying: baseRating + Math.floor(Math.random() * 10) - 5,
        ballCarrierVision: baseRating + Math.floor(Math.random() * 10) - 5,
        breakTackle: baseRating + Math.floor(Math.random() * 10) - 5,
        trucking: baseRating + Math.floor(Math.random() * 10) - 5,
        stiffArm: baseRating + Math.floor(Math.random() * 10) - 5,
        spinMove: baseRating + Math.floor(Math.random() * 10) - 5,
        jukeMove: baseRating + Math.floor(Math.random() * 10) - 5,
        catching: baseRating + Math.floor(Math.random() * 10) - 5,
        catchInTraffic: baseRating + Math.floor(Math.random() * 10) - 5,
        spectacularCatch: baseRating + Math.floor(Math.random() * 10) - 5,
        shortRouteRunning: baseRating + Math.floor(Math.random() * 10) - 5,
        mediumRouteRunning: baseRating + Math.floor(Math.random() * 10) - 5,
        deepRouteRunning: baseRating + Math.floor(Math.random() * 10) - 5,
        release: baseRating + Math.floor(Math.random() * 10) - 5,
        passBlock: baseRating + Math.floor(Math.random() * 10) - 5,
        passBlockPower: baseRating + Math.floor(Math.random() * 10) - 5,
        passBlockFinesse: baseRating + Math.floor(Math.random() * 10) - 5,
        runBlock: baseRating + Math.floor(Math.random() * 10) - 5,
        runBlockPower: baseRating + Math.floor(Math.random() * 10) - 5,
        runBlockFinesse: baseRating + Math.floor(Math.random() * 10) - 5,
        impactBlocking: baseRating + Math.floor(Math.random() * 10) - 5,
        leadBlock: baseRating + Math.floor(Math.random() * 10) - 5,
        tackle: baseRating + Math.floor(Math.random() * 10) - 5,
        hitPower: baseRating + Math.floor(Math.random() * 10) - 5,
        powerMoves: baseRating + Math.floor(Math.random() * 10) - 5,
        finesseMoves: baseRating + Math.floor(Math.random() * 10) - 5,
        blockShedding: baseRating + Math.floor(Math.random() * 10) - 5,
        pursuit: baseRating + Math.floor(Math.random() * 10) - 5,
        playRecognition: baseRating + Math.floor(Math.random() * 10) - 5,
        manCoverage: baseRating + Math.floor(Math.random() * 10) - 5,
        zoneCoverage: baseRating + Math.floor(Math.random() * 10) - 5,
        press: baseRating + Math.floor(Math.random() * 10) - 5,
        kickPower: baseRating + Math.floor(Math.random() * 10) - 5,
        kickAccuracy: baseRating + Math.floor(Math.random() * 10) - 5,
        kickReturn: baseRating + Math.floor(Math.random() * 10) - 5,
        longSnap: baseRating + Math.floor(Math.random() * 10) - 5,
        pressCoverage: baseRating + Math.floor(Math.random() * 10) - 5
      }
    };
  }

  /**
   * Generate a low-tier random player to fill template slots
   * Used when not enough real free agents exist
   */
  private generateLowTierPlayer(year: number): RosterPlayer {
    // Random position (weighted towards common positions)
    const positions = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    const position = positions[Math.floor(Math.random() * positions.length)];

    // Random name from common names
    const firstNames = ['John', 'Mike', 'Chris', 'Dave', 'Tom', 'Dan', 'Jim', 'Steve', 'Mark', 'Paul'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    // Low-tier stats (40-55 OVR range)
    const baseRating = 40 + Math.floor(Math.random() * 16); // 40-55

    return {
      PFNA: firstName,
      PLNA: lastName,
      PPOS: position,
      TGID: 1009, // Free Agent
      PAGE: 23 + Math.floor(Math.random() * 5), // 23-27
      PJEN: 50 + Math.floor(Math.random() * 50), // 50-99
      PHGT: 70 + Math.floor(Math.random() * 8), // 70-77 inches
      PWGT: 200 + Math.floor(Math.random() * 80), // 200-279 lbs
      PCOL: 0,
      PHSN: 0,
      PDEV: 0,
      PSXP: 0,
      PEPS: '',
      PYRP: 0,
      PBOD: 0,

      // All ratings around baseRating ± 5
      POVR: baseRating,
      PSPD: baseRating + Math.floor(Math.random() * 10) - 5,
      PACC: baseRating + Math.floor(Math.random() * 10) - 5,
      PAGI: baseRating + Math.floor(Math.random() * 10) - 5,
      PELU: baseRating + Math.floor(Math.random() * 10) - 5,
      PSTR: baseRating + Math.floor(Math.random() * 10) - 5,
      PAWR: baseRating + Math.floor(Math.random() * 10) - 5,
      PJMP: baseRating + Math.floor(Math.random() * 10) - 5,
      PSTA: baseRating + Math.floor(Math.random() * 10) - 5,
      PINJ: baseRating + Math.floor(Math.random() * 10) - 5,
      PTGH: baseRating + Math.floor(Math.random() * 10) - 5,
      PTHP: baseRating + Math.floor(Math.random() * 10) - 5,
      PTAS: baseRating + Math.floor(Math.random() * 10) - 5,
      PTAM: baseRating + Math.floor(Math.random() * 10) - 5,
      PTAD: baseRating + Math.floor(Math.random() * 10) - 5,
      PTOR: baseRating + Math.floor(Math.random() * 10) - 5,
      PTUP: baseRating + Math.floor(Math.random() * 10) - 5,
      PPLA: baseRating + Math.floor(Math.random() * 10) - 5,
      PBSK: baseRating + Math.floor(Math.random() * 10) - 5,
      PCAR: baseRating + Math.floor(Math.random() * 10) - 5,
      PBCV: baseRating + Math.floor(Math.random() * 10) - 5,
      PBKT: baseRating + Math.floor(Math.random() * 10) - 5,
      PLTR: baseRating + Math.floor(Math.random() * 10) - 5,
      PLSA: baseRating + Math.floor(Math.random() * 10) - 5,
      PLSM: baseRating + Math.floor(Math.random() * 10) - 5,
      PLJM: baseRating + Math.floor(Math.random() * 10) - 5,
      PCTH: baseRating + Math.floor(Math.random() * 10) - 5,
      PLCI: baseRating + Math.floor(Math.random() * 10) - 5,
      PLSC: baseRating + Math.floor(Math.random() * 10) - 5,
      PSRR: baseRating + Math.floor(Math.random() * 10) - 5,
      PMRR: baseRating + Math.floor(Math.random() * 10) - 5,
      PDRR: baseRating + Math.floor(Math.random() * 10) - 5,
      PLRL: baseRating + Math.floor(Math.random() * 10) - 5,
      PPBK: baseRating + Math.floor(Math.random() * 10) - 5,
      PPBS: baseRating + Math.floor(Math.random() * 10) - 5,
      PPBF: baseRating + Math.floor(Math.random() * 10) - 5,
      PRBK: baseRating + Math.floor(Math.random() * 10) - 5,
      PRBS: baseRating + Math.floor(Math.random() * 10) - 5,
      PRBF: baseRating + Math.floor(Math.random() * 10) - 5,
      PLBK: baseRating + Math.floor(Math.random() * 10) - 5,
      PLIB: baseRating + Math.floor(Math.random() * 10) - 5,
      PTAK: baseRating + Math.floor(Math.random() * 10) - 5,
      PLHT: baseRating + Math.floor(Math.random() * 10) - 5,
      PLPM: baseRating + Math.floor(Math.random() * 10) - 5,
      PFMS: baseRating + Math.floor(Math.random() * 10) - 5,
      PBSG: baseRating + Math.floor(Math.random() * 10) - 5,
      PLPU: baseRating + Math.floor(Math.random() * 10) - 5,
      PLPR: baseRating + Math.floor(Math.random() * 10) - 5,
      PLMC: baseRating + Math.floor(Math.random() * 10) - 5,
      PLZC: baseRating + Math.floor(Math.random() * 10) - 5,
      PLPE: baseRating + Math.floor(Math.random() * 10) - 5,
      PKPR: baseRating + Math.floor(Math.random() * 10) - 5,
      PKAC: baseRating + Math.floor(Math.random() * 10) - 5,
      PKRT: baseRating + Math.floor(Math.random() * 10) - 5,
      PLSN: baseRating + Math.floor(Math.random() * 10) - 5,

      isHallOfFamer: false
    };
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
