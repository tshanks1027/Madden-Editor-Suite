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
import { playerDataService, RookieStats } from './generator/PlayerDataService';
import { ovrWeightsCalculator } from './rating-modes/OVRWeightsCalculator';
import { userDatabaseService } from './UserDatabaseService';
import { lookupService } from './lookup-service';
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
  PHTN?: string; // Home Town (city)
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
  { abbr: 'htx', name: 'Houston Texans', id: 32 },      // PFR uses 'htx' for Texans
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
 * Get Madden team ID from PFR team abbreviation, accounting for historical relocations
 * @param teamAbbr - Pro Football Reference team abbreviation (lowercase)
 * @param year - The year of the roster (used for ambiguous cases like St. Louis)
 * @returns Madden team ID (1009 = Free Agent if not found)
 */
function getHistoricalTeamId(teamAbbr: string, year: number): number {
  const abbr = teamAbbr.toLowerCase();

  // Year-aware mappings for teams that shared city names
  // St. Louis: Cardinals (1960-1987), Rams (1995-2015)
  if (abbr === 'stl') {
    if (year <= 1987) {
      return 7;  // Arizona Cardinals (inherited St. Louis Cardinals history)
    } else if (year >= 1995 && year <= 2015) {
      return 24; // Los Angeles Rams (were St. Louis Rams 1995-2015)
    }
    // 1988-1994: Cardinals were in Phoenix, Rams were in LA - 'stl' shouldn't appear
    return 1009; // Free Agent (shouldn't happen)
  }

  // Baltimore: Colts (1953-1983), Ravens (1996-present)
  if (abbr === 'bal') {
    if (year <= 1983) {
      return 10; // Indianapolis Colts (inherited Baltimore Colts history)
    } else if (year >= 1996) {
      return 25; // Baltimore Ravens (expansion team, NOT Colts successor)
    }
    // 1984-1995: No NFL team in Baltimore
    return 1009; // Free Agent
  }

  // LA Raiders (1982-1994) vs LA Rams (1946-1994, 2016+)
  // PFR uses 'lar' for LA Rams historically, but we need to distinguish Raiders years
  if (abbr === 'lar') {
    // LA Raiders were in LA from 1982-1994
    // LA Rams were in LA from 1946-1994, then St. Louis 1995-2015, then back to LA 2016+
    // Since both teams overlapped in LA 1982-1994, check the context
    // For roster generation, 'lar' typically refers to LA Rams in PFR
    // Oakland/LA Raiders use 'rai' or 'oak' in PFR
    return 24; // LA Rams
  }

  // Historical team mappings (franchise continuity)
  const historicalMap: Record<string, number> = {
    // Houston Oilers (1960-1996) -> Tennessee Titans
    'oti': 30,
    'hst': 30,

    // Houston Texans (2002-present) - NOT the Oilers
    'htx': 32,
    'hou': 32, // Modern Houston = Texans

    // Colts franchise (Baltimore 1953-1983, Indianapolis 1984+)
    'clt': 10,
    'ind': 10,
    'blt': 10,

    // Cardinals franchise (Chicago -> St. Louis -> Phoenix -> Arizona)
    'crd': 7,
    'pho': 7,  // Phoenix Cardinals (1988-1993)
    'ari': 7,

    // Rams franchise
    'ram': 24,
    'lar': 24,
    'sla': 24, // St. Louis Rams

    // Boston/New England Patriots
    'bos': 22,
    'nwe': 22,

    // Oakland/LA/Las Vegas Raiders
    'oak': 23,
    'rai': 23,
    'lvr': 23,

    // San Diego/LA Chargers
    'sdg': 8,
    'lac': 8,

    // Ravens (expansion 1996, NOT Colts)
    'rav': 25,
  };

  if (historicalMap[abbr] !== undefined) {
    return historicalMap[abbr];
  }

  // Standard lookup from NFL_TEAMS
  const teamObj = NFL_TEAMS.find(t => t.abbr === abbr);
  return teamObj ? teamObj.id : 1009;
}

/**
 * Roster Creator Service Class
 */
export class RosterCreatorService {
  // PAM/PID mapping data for assigning generic faces
  private pidToPortrait: Map<number, string> = new Map();
  private pidToPAM: Map<number, string> = new Map();
  private pidToPGHE: Map<number, number> = new Map();
  private pidToType: Map<number, string> = new Map(); // 'legend', 'player', or 'generic'
  private pidToRace: Map<number, number> = new Map(); // PID -> Race code (1=white, 5=hispanic, 7=black)
  private validPIDs: Set<number> = new Set(); // All valid PIDs from mapping
  private genericPIDs: number[] = [];
  // NEW: Generic faces grouped by race for proper skin-tone matching
  private genericFacesByRace: Map<number, { pid: number; pam: string; pghe: number }[]> = new Map();
  private pamRaceMapping: { white: string[]; hispanic: string[]; black: string[] } | null = null;
  private dataLoaded: boolean = false;

  /**
   * Load mapping data from database via lookupService
   * - PID data from pid_race table and player_appearance table
   * - PAM race mapping from pam-race-mapping.json (still JSON file)
   */
  private async loadMappingData(): Promise<void> {
    if (this.dataLoaded) return;

    try {
      // Ensure lookupService is initialized
      await lookupService.waitForReady();

      console.log('[RosterCreatorService] Loading mapping data from database');

      // Load all player data from database - this has PID, PAM, race, PLPO
      const allPlayers = lookupService.getAllPlayers();
      let realPlayerCount = 0;
      let raceCount = 0;

      for (const player of allPlayers) {
        const pid = player.pid;
        if (pid && pid > 0) {
          this.validPIDs.add(pid);
          realPlayerCount++;

          // Store race mapping
          if (player.race !== undefined && player.race !== null) {
            this.pidToRace.set(pid, player.race);
            raceCount++;
          }

          // Set type based on PLPO
          const plpo = player.plpo || '';
          if (plpo.includes('legends')) {
            this.pidToType.set(pid, 'legend');
          } else if (plpo) {
            this.pidToType.set(pid, 'player');
          } else {
            this.pidToType.set(pid, 'player');
          }

          // Store PAM if available
          if (player.pam) {
            this.pidToPAM.set(pid, player.pam);
          }

          // Store portrait if available
          if (plpo) {
            this.pidToPortrait.set(pid, plpo);
          }
        }
      }

      console.log(`[RosterCreatorService] Loaded ${realPlayerCount} players from database, ${raceCount} with race data`);

      // Also get generic face PIDs from pid_race table (lookupService.getRaceByPID handles this)
      // For now, load PID_Portrait_Mapping.csv only for generic PIDs (still needed for generic face data)
      const pidMappingPath = path.join(app.getAppPath(), 'data', 'lookups', 'PID_Portrait_Mapping.csv');
      if (fs.existsSync(pidMappingPath)) {
        const csvContent = fs.readFileSync(pidMappingPath, 'utf8');
        const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

        for (const row of parsed.data as any[]) {
          const pid = parseInt(row.PID);
          const type = row.Type || '';

          if (!isNaN(pid) && type === 'generic') {
            this.validPIDs.add(pid);
            this.genericPIDs.push(pid);

            const portrait = row.Portrait || '';
            if (portrait) this.pidToPortrait.set(pid, portrait);
            this.pidToType.set(pid, 'generic');

            const race = parseInt(row.Race) || 0;
            if (race > 0) this.pidToRace.set(pid, race);

            const pghe = parseInt(row.PGHE);
            if (!isNaN(pghe)) this.pidToPGHE.set(pid, pghe);

            const rawPAM = row.PAM ? String(row.PAM).trim() : '';
            if (rawPAM && rawPAM !== '0') {
              this.pidToPAM.set(pid, rawPAM);
            }
          }
        }

        console.log(`[RosterCreatorService] Loaded ${this.genericPIDs.length} generic PIDs from PID_Portrait_Mapping.csv`);
      }

      // Load pam-race-mapping.json (still from JSON file)
      const pamMappingPath = path.join(app.getAppPath(), 'data', 'lookups', 'pam-race-mapping.json');
      if (fs.existsSync(pamMappingPath)) {
        const jsonContent = fs.readFileSync(pamMappingPath, 'utf8');
        this.pamRaceMapping = JSON.parse(jsonContent);
        console.log(`[RosterCreatorService] Loaded PAM race mapping: ${this.pamRaceMapping?.white.length} white, ${this.pamRaceMapping?.hispanic.length} hispanic, ${this.pamRaceMapping?.black.length} black`);
      }

      console.log(`[RosterCreatorService] TOTAL: ${this.validPIDs.size} valid PIDs, ${this.pidToRace.size} race mappings`);

      // DEBUG: Verify Staubach's PID 2966 is in validPIDs
      console.log(`[RosterCreatorService] ✓ VERIFY: validPIDs.has(2966) = ${this.validPIDs.has(2966)}`);
      console.log(`[RosterCreatorService] ✓ VERIFY: pidToRace.get(2966) = ${this.pidToRace.get(2966)}`);
      console.log(`[RosterCreatorService] ✓ VERIFY: pidToType.get(2966) = ${this.pidToType.get(2966)}`);

      this.dataLoaded = true;
    } catch (error) {
      console.error('[RosterCreatorService] Error loading mapping data:', error);
    }
  }

  /**
   * Check if a PID has a valid PAM in the mapping
   */
  private hasValidPAM(pid: number): boolean {
    if (!pid || pid === 0) return false;
    const pam = this.pidToPAM.get(pid);
    return !!(pam && pam.length > 0);
  }

  /**
   * Get a random generic PID for a given race
   * @param race - Race code (1=white, 2-7=black variants)
   */
  private getGenericPID(race: number): number {
    if (this.genericPIDs.length === 0) {
      return 719; // Fallback to known generic PID
    }

    // Filter by race if possible using portrait name pattern
    // Generic faces are named like "plpo_generic_1_001" where 1 is the race code
    const raceCode = race === 1 ? 1 : 7; // Simplify to 1 (white) or 7 (black)
    const raceFilteredPIDs = this.genericPIDs.filter(pid => {
      const portrait = this.pidToPortrait.get(pid);
      return portrait && portrait.includes(`plpo_generic_${raceCode}_`);
    });

    const pidsToUse = raceFilteredPIDs.length > 0 ? raceFilteredPIDs : this.genericPIDs;
    return pidsToUse[Math.floor(Math.random() * pidsToUse.length)];
  }

  /**
   * Get a random generic PAM for a given race from pam-race-mapping.json
   * @param race - Race code (1=white, 5=hispanic, 2-4/6-7=black)
   * @returns A valid PAM string - NEVER returns undefined/null/empty
   */
  private getGenericPAM(race: number): string {
    // Hardcoded PAM arrays as fallback to ALWAYS work even if files don't load
    const FALLBACK_WHITE_PAMS = ['gen_1_M_N_02', 'gen_1_M_S_011', 'gen_1_T_EA_JP', 'gen_1_T_N_004', 'gen_2_M_N_04', 'gen_2_T_N_01'];
    const FALLBACK_BLACK_PAMS = ['gen_1_B_N_01', 'gen_1_B_N_02', 'gen_2_B_N_01', 'gen_2_B_N_02', 'gen_2_B_EA_CM', 'gen_3_B_N_01'];
    const FALLBACK_HISPANIC_PAMS = ['gen_1_H_N_010', 'gen_1_H_S_003', 'gen_2_H_N_03', 'gen_2_H_B_002'];
    const ULTIMATE_FALLBACK = 'gen_2_B_N_01'; // Guaranteed valid PAM

    let pamList: string[] = [];
    let selected: string | undefined;

    // Try to use loaded mapping first
    if (this.pamRaceMapping) {
      switch (race) {
        case 1: // Caucasian
          pamList = this.pamRaceMapping.white || [];
          break;
        case 5: // Hispanic/Latino
          pamList = this.pamRaceMapping.hispanic || [];
          break;
        case 6: // Mixed - randomly choose
          pamList = Math.random() < 0.5 ? (this.pamRaceMapping.white || []) : (this.pamRaceMapping.hispanic || []);
          break;
        default: // All black variants (2, 3, 4, 7)
          pamList = this.pamRaceMapping.black || [];
          break;
      }
      if (pamList && pamList.length > 0) {
        selected = pamList[Math.floor(Math.random() * pamList.length)];
        if (selected && selected.length > 0) {
          console.log(`[RosterCreatorService] getGenericPAM: race=${race}, selected PAM from mapping: ${selected}`);
          return selected;
        }
      }
    }

    // Fallback to hardcoded arrays
    console.log(`[RosterCreatorService] getGenericPAM: Using FALLBACK PAMs (mapping not loaded or empty)`);
    switch (race) {
      case 1: // Caucasian
        pamList = FALLBACK_WHITE_PAMS;
        break;
      case 5: // Hispanic
        pamList = FALLBACK_HISPANIC_PAMS;
        break;
      default: // Black
        pamList = FALLBACK_BLACK_PAMS;
        break;
    }
    selected = pamList[Math.floor(Math.random() * pamList.length)];

    // SAFETY: Ensure we NEVER return undefined/null/empty
    if (!selected || selected.length === 0) {
      console.warn(`[RosterCreatorService] getGenericPAM: CRITICAL - all PAM sources failed, using ultimate fallback`);
      return ULTIMATE_FALLBACK;
    }

    console.log(`[RosterCreatorService] getGenericPAM: race=${race}, selected FALLBACK PAM: ${selected}`);
    return selected;
  }

  /**
   * Get generic PGHE (head mesh) based on race
   */
  private getGenericPGHE(race: number): number {
    const blackPGHEs = [6, 42, 57, 64, 79, 89, 101, 102, 108, 114, 131, 138, 143, 148, 160, 161, 164, 190, 209, 210, 211, 224, 230, 255, 257, 267, 274, 280];
    const whitePGHEs = [11, 12, 18, 24, 50, 54, 55, 56, 85, 90, 146, 154, 155, 158, 176, 202, 212, 227, 239, 243, 245, 253, 256, 264, 290];
    const sharedPGHEs = [1, 7, 21, 25, 27, 34, 36, 53, 59, 62, 67, 77, 84, 93, 99, 100, 109, 119, 120, 128, 132, 139, 142, 147, 157, 162, 183, 188, 200, 232, 246, 247, 261, 271, 273, 278, 282, 286, 287, 288];

    let pgheList: number[];
    switch (race) {
      case 1: // Caucasian
        pgheList = [...whitePGHEs, ...sharedPGHEs];
        break;
      case 5: // Hispanic
      case 6: // Mixed
        pgheList = sharedPGHEs;
        break;
      default: // Black variants
        pgheList = [...blackPGHEs, ...sharedPGHEs];
        break;
    }

    return pgheList[Math.floor(Math.random() * pgheList.length)];
  }

  /**
   * Map race to PSKI (skin tone for body)
   * PSKI 1 = Black, PSKI 2 = White
   */
  private mapRaceToPSKI(race: number): number {
    switch (race) {
      case 1: // Caucasian
        return 2; // White skin
      case 5: // Hispanic
      case 6: // Mixed
        return 0; // Default/mixed
      default: // Black variants (2, 3, 4, 7)
        return 1; // Black skin
    }
  }

  /**
   * Reverse map PSKI (skin tone) back to race code
   * Used when we have PSKI but need race for PAM selection
   * PSKI 1 = Black skin -> race 7 (African descent)
   * PSKI 2 = White skin -> race 1 (Caucasian)
   * PSKI 0 = Default -> race 7 (default to black based on NFL demographics)
   */
  private mapPSKIToRace(pski: number): number {
    switch (pski) {
      case 2: // White skin
        return 1; // Caucasian race
      case 1: // Black skin
        return 7; // African descent race
      case 0: // Default/unknown
      default:
        return 7; // Default to black based on NFL demographics (~70%)
    }
  }

  /**
   * Map CSV race to skin tone (1-7) used in generic head names
   * Skin tone is the FIRST DIGIT of head name (1=lightest, 7=darkest)
   * CSV race: 1=Caucasian, 2-4,7=Black variants, 5=Hispanic, 6=Mixed
   */
  private mapCsvRaceToSkinTone(csvRace: number): number {
    switch (csvRace) {
      case 1: // Caucasian -> lightest skin tones
        return Math.random() < 0.5 ? 1 : 2;
      case 2: // African American Medium
        return 5;
      case 3: // African American Light
        return 4;
      case 4: // African American Dark
        return 7;
      case 7: // Default (Black) -> darkest skin tones
        return Math.random() < 0.5 ? 6 : 7;
      case 5: // Hispanic/Latino -> medium skin tones
        return Math.random() < 0.5 ? 3 : 4;
      case 6: // Mixed/Multi-Racial -> medium range
        return Math.random() < 0.33 ? 3 : (Math.random() < 0.5 ? 4 : 5);
      default:
        return 6; // Default to darker
    }
  }

  /**
   * Derive PSKI from PAM string to ensure body matches face
   * PAM format: gen_X_Y_Z_NNN where X is skin tone (1-7)
   * Returns: PSKI value (1=black, 2=white, 0=mixed)
   */
  private getPSKIFromPAM(pam: string): number {
    if (!pam || !pam.startsWith('gen_')) return 1; // Default to black
    const skinTone = parseInt(pam.charAt(4)); // First digit after "gen_"
    if (isNaN(skinTone)) return 1;

    // Map skin tone to PSKI
    if (skinTone <= 2) return 2; // Light skin -> white body
    if (skinTone >= 5) return 1; // Dark skin -> black body
    return 0; // Medium skin -> mixed body
  }

  /**
   * Select a random generic face that matches the player's race
   * Returns PID, PAM, and PGHE as a complete set that will have matching skin tones
   * PAM is selected from pam-race-mapping.json based on body code (B/H/M/T), NOT skin tone
   */
  private selectGenericFaceByRace(race: number): { pid: number; pam: string; pghe: number } {
    // Get PAM from pam-race-mapping.json based on race (uses body code B/H/M/T)
    const pam = this.getGenericPAM(race);

    // Get matching PGHE (head mesh) for this race
    const pghe = this.getGenericPGHE(race);

    // Get a random generic PID (for portraits) - use any from our list
    const pid = this.genericPIDs.length > 0
      ? this.genericPIDs[Math.floor(Math.random() * this.genericPIDs.length)]
      : 719; // Fallback PID

    console.log(`[RosterCreatorService] Selected generic face for race ${race}: PID=${pid}, PAM=${pam}, PGHE=${pghe}`);

    return { pid, pam, pghe };
  }

  /**
   * Assign generic face data for a player without a valid PID/PAM
   * Sets PLPL=0 (generic), assigns PGHE, PID
   * PEPS stays EMPTY - BLBM GENR/SKNT controls the face appearance
   * DON'T SET PSKI - BLBM handles it
   */
  private assignGenericFace(player: RosterPlayer, race: number): void {
    const genericFace = this.selectGenericFaceByRace(race);
    player.PLPL = 0; // Generic face
    player.PSXP = genericFace.pid;
    player.PEPS = ''; // EMPTY - BLBM GENR/SKNT controls the face
    player.PGHE = genericFace.pghe;
    // DON'T SET PSKI - BLBM GENR/SKNT controls face appearance
    player._race = race; // Store race for BLBM GENR/SKNT assignment
  }

  /**
   * Determine PBOD (body type code) based on position code
   * Returns numeric code: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Extra Heavy
   * Position codes: QB=0, HB=1, FB=2, WR=3, TE=4, LT=5, LG=6, C=7, RG=8, RT=9, LE=10, RE=11, DT=12, LOLB=13, MLB=14, ROLB=15, CB=16, FS=17, SS=18, K=19, P=20
   *
   * IMPORTANT: Do NOT return 0 (Standard) for QB/HB/WR - they look fat in-game!
   * Use 2 (Muscular) as the default for skill positions.
   */
  private determineBodyType(positionCode: number): number {
    // Offensive Line (LT=5, LG=6, C=7, RG=8, RT=9) - Heavy
    if (positionCode >= 5 && positionCode <= 9) {
      return 3; // Heavy
    }

    // Defensive Tackle (DT=12) - Heavy
    if (positionCode === 12) {
      return 3; // Heavy
    }

    // Edge Rushers (LE=10, RE=11) - Muscular
    if (positionCode === 10 || positionCode === 11) {
      return 2; // Muscular
    }

    // Tight End (TE=4) - Muscular
    if (positionCode === 4) {
      return 2; // Muscular
    }

    // Fullback (FB=2) - Muscular
    if (positionCode === 2) {
      return 2; // Muscular
    }

    // Kicker/Punter (K=19, P=20) - Thin
    if (positionCode === 19 || positionCode === 20) {
      return 1; // Thin
    }

    // QB (0), HB (1), WR (3), CB (16), FS (17), SS (18), Linebackers (13, 14, 15)
    // Use Muscular (2) - NOT Standard (0) which causes fat appearance!
    return 2; // Muscular
  }

  /**
   * Convert RookieStats from ROSTER_lookup.csv to RosterPlayer format
   * Uses pre-calculated ratings from the lookup file
   */
  private convertRookieStatsToRosterPlayer(
    stats: RookieStats,
    teamId: number,
    idx: number,
    year?: number
  ): RosterPlayer {
    // CRITICAL: Merge user-edited ratings from database
    // This ensures generators pull ratings that users have edited in the database browser
    if (year && stats.firstName && stats.lastName) {
      // Look up the player's internal ID via lookupService
      const playerEntry = lookupService.findPlayerByNameAndYear(
        stats.firstName,
        stats.lastName,
        stats.draftYear || year
      );

      if (playerEntry?.internalId) {
        const userSeasonEdit = userDatabaseService.getSeasonEdit(playerEntry.internalId, year);
        if (userSeasonEdit?.ratings) {
          console.log(`[RosterCreatorService] Merging user edits for ${stats.firstName} ${stats.lastName} (year ${year}):`, Object.keys(userSeasonEdit.ratings));
          // Merge user edits into stats - user edits override lookup values
          for (const [field, value] of Object.entries(userSeasonEdit.ratings)) {
            if (value !== null && value !== undefined) {
              // Map field names from uppercase to lowercase for RookieStats
              const lowerField = field.toLowerCase();
              (stats as any)[lowerField] = value;
            }
          }
        }
      }
    }

    // Get race from lookup or default
    const race = 7; // Default to black (most common in NFL)

    // Generate generic face for players without PID
    let pid = stats.pid || 0;
    let pam = stats.pam || '';
    let pghe = 0;
    let pski = this.mapRaceToPSKI(race);

    // If no valid PID/PAM, assign generic face
    if (!pid || pid === 0 || !pam || pam === '0') {
      const genericFace = this.selectGenericFace(race, stats.position || 'HB');
      pid = genericFace.pid;
      pam = genericFace.pam;
      pghe = genericFace.pghe;
      pski = this.getPSKIFromPAM(pam);
    }

    const bodyType = this.getBodyType(stats.position || 'HB', stats.weight || 220, stats.height || 72);

    // Build the RosterPlayer object with all ratings from lookup
    const rosterPlayer: RosterPlayer = {
      // Basic Info
      PFNA: stats.firstName,
      PLNA: stats.lastName,
      PPOS: stats.position || 'HB',
      TGID: teamId,
      PAGE: stats.age || 25,
      PJEN: stats.jersey || Math.floor(Math.random() * 99) + 1,

      // Physical
      PHGT: stats.height || 72,
      PWGT: (stats.weight || 220) - 160, // Madden offset format

      // College/Background
      PCOL: stats.college || 'Unknown',

      // Portrait/Appearance
      PLPL: pid,       // PhotoID/Portrait
      PEPS: pam,       // Player Assets
      PGHE: pghe,      // Head mesh
      PSKI: pski,      // Skin tone
      PLBD: bodyType,  // Body type

      // All ratings from lookup (already calculated)
      POVR: stats.povr || 65,
      PSPD: stats.pspd || 70,
      PACC: stats.pacc || 70,
      PSTR: stats.pstr || 70,
      PAGI: stats.pagi || 70,
      PAWR: stats.pawr || 65,
      PCTH: stats.pcth || 50,
      PCAR: stats.pcar || 50,
      PTHP: stats.pthp || 30,
      PKPW: stats.pkpw || 30,
      PKAC: stats.pkac || 30,
      PRBK: stats.prbk || 50,
      PPBK: stats.ppbk || 50,
      PTAK: stats.ptak || 50,
      PBTK: stats.pbtk || 50,
      PJMP: stats.pjmp || 70,
      PINJ: stats.pinj || 90,
      PSTA: stats.psta || 90,
      PTGH: stats.ptgh || 85,
      PTRK: stats.ptrk || 50,
      PCOD: stats.pcod || 50,
      PBCV: stats.pbcv || 50,
      PSTF: stats.pstf || 50,
      PSPM: stats.pspm || 50,
      PJUM: stats.pjum || 50,
      PIBL: stats.pibl || 50,
      PRBP: stats.prbp || 50,
      PRBF: stats.prbf || 50,
      PPBP: stats.ppbp || 50,
      PPBF: stats.ppbf || 50,
      PLDB: stats.pldb || 50,
      PBRS: stats.pbrs || 50,
      PTUP: stats.ptup || 50,
      PPWM: stats.ppwm || 50,
      PFNM: stats.pfnm || 50,
      PBSH: stats.pbsh || 50,
      PPUR: stats.ppur || 50,
      PPRC: stats.pprc || 50,
      PMCV: stats.pmcv || 50,
      PZCV: stats.pzcv || 50,
      PSPC: stats.pspc || 50,
      PCIT: stats.pcit || 50,
      PSRR: stats.psrr || 50,
      PMRR: stats.pmrr || 50,
      PDRR: stats.pdrr || 50,
      PHTP: stats.phtp || 50,
      PPRS: stats.pprs || 50,
      PREL: stats.prel || 50,
      PTAS: stats.ptas || 50,
      PTAM: stats.ptam || 50,
      PTAD: stats.ptad || 50,
      PPLA: stats.ppla || 50,
      PTOR: stats.ptor || 50,
      PKRT: 30, // Kick return (not in lookup)

      // Dev trait from lookup
      PDEV: this.mapDevTraitToId(stats.devTrait || 'Normal'),
    };

    // CRITICAL: Recalculate POVR using the official formula
    // This ensures roster POVR matches what Madden expects
    if (ovrWeightsCalculator.isInitialized()) {
      const attributes: Record<string, number> = {
        PSPD: rosterPlayer.PSPD, PACC: rosterPlayer.PACC, PAGI: rosterPlayer.PAGI,
        PSTR: rosterPlayer.PSTR, PAWR: rosterPlayer.PAWR, PCAR: rosterPlayer.PCAR,
        PBCV: rosterPlayer.PBCV, PBKT: rosterPlayer.PBTK, PLTR: rosterPlayer.PTRK,
        PLSA: rosterPlayer.PSTF, PLSM: rosterPlayer.PSPM, PLJM: rosterPlayer.PJUM,
        PCTH: rosterPlayer.PCTH, PLCI: rosterPlayer.PCIT, PLSC: rosterPlayer.PSPC,
        PELU: rosterPlayer.PCOD, PJMP: rosterPlayer.PJMP, PSTA: rosterPlayer.PSTA,
        PTGH: rosterPlayer.PTGH, PINJ: rosterPlayer.PINJ, SRRN: rosterPlayer.PSRR,
        PMRR: rosterPlayer.PMRR, PDRR: rosterPlayer.PDRR, PTHP: rosterPlayer.PTHP,
        PTAS: rosterPlayer.PTAS, PTAM: rosterPlayer.PTAM, PTAD: rosterPlayer.PTAD,
        PTOR: rosterPlayer.PTOR, PTUP: rosterPlayer.PTUP, PPLA: rosterPlayer.PPLA,
        PBSK: rosterPlayer.PBRS, PBSG: rosterPlayer.PBSH, PLPM: rosterPlayer.PPWM,
        PFMS: rosterPlayer.PFNM, PTAK: rosterPlayer.PTAK, PLHT: rosterPlayer.PHTP,
        PLPU: rosterPlayer.PPUR, PLPR: rosterPlayer.PPRC, PLMC: rosterPlayer.PMCV,
        PLZC: rosterPlayer.PZCV, PLPE: rosterPlayer.PPRS, PPBK: rosterPlayer.PPBK,
        PPBS: rosterPlayer.PPBP, PPBF: rosterPlayer.PPBF, PRBK: rosterPlayer.PRBK,
        PRBS: rosterPlayer.PRBP, PRBF: rosterPlayer.PRBF, PLIB: rosterPlayer.PIBL,
        PLBK: rosterPlayer.PLDB, PKPW: rosterPlayer.PKPW, PKAC: rosterPlayer.PKAC,
        PLRL: rosterPlayer.PREL, PKRT: rosterPlayer.PKRT,
      };
      const calculatedOvr = ovrWeightsCalculator.calculateOVR(attributes, stats.position || 'HB');

      // OVR floor of 55 - if below, BOOST RATINGS to achieve 55 (don't just clamp display)
      const OVR_FLOOR = 55;
      if (calculatedOvr < OVR_FLOOR) {
        const adjustment = ovrWeightsCalculator.calculateAdjustmentsForTargetOVR(
          attributes,
          OVR_FLOOR,
          stats.position || 'HB'
        );
        if (adjustment && adjustment.adjustments) {
          for (const [fieldCode, adj] of Object.entries(adjustment.adjustments)) {
            if ((rosterPlayer as any)[fieldCode] !== undefined) {
              (rosterPlayer as any)[fieldCode] = Math.max(40, Math.min(99, adj.suggested));
            }
          }
          rosterPlayer.POVR = adjustment.newOVR;
        } else {
          rosterPlayer.POVR = OVR_FLOOR;
        }
      } else {
        rosterPlayer.POVR = Math.min(99, calculatedOvr);
      }
    }

    return rosterPlayer;
  }

  /**
   * Map dev trait string to Madden ID
   */
  private mapDevTraitToId(devTrait: string): number {
    switch (devTrait?.toLowerCase()) {
      case 'x-factor': return 3;
      case 'superstar': return 2;
      case 'star': return 1;
      default: return 0; // Normal
    }
  }

  /**
   * Get players from ROSTER_lookup.csv for a specific team and year
   * Returns RosterPlayer array with pre-calculated ratings
   */
  private async getPlayersFromLookup(
    teamAbbr: string,
    year: number,
    teamId: number
  ): Promise<RosterPlayer[]> {
    const rookieStats = await playerDataService.getPlayersByTeamYear(teamAbbr, year);

    if (rookieStats.length === 0) {
      console.log(`[RosterCreatorService] No ROSTER_lookup data for ${teamAbbr} in ${year}`);
      return [];
    }

    console.log(`[RosterCreatorService] Found ${rookieStats.length} players for ${teamAbbr} in ${year} from ROSTER_lookup`);

    const players: RosterPlayer[] = [];
    for (let i = 0; i < rookieStats.length; i++) {
      const player = this.convertRookieStatsToRosterPlayer(rookieStats[i], teamId, i, year);
      players.push(player);
    }

    return players;
  }

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

      // Load PID/PAM mapping data for generic face assignment
      await this.loadMappingData();

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

      // Initialize PlayerDataService for ROSTER_lookup access
      await playerDataService.initialize();

      progressCallback?.(20, `Checking ROSTER_lookup for ${year} data...`);

      // First, try to get data from ROSTER_lookup.csv (years 1970-2024)
      const availableTeams = await playerDataService.getAvailableTeamsForYear(year);
      const hasLookupData = availableTeams.length > 0;

      console.log(`[RosterCreatorService] ROSTER_lookup has ${availableTeams.length} teams for ${year}`);

      let allRosterPlayers: RosterPlayer[] = [];

      console.log(`[RosterCreatorService] ======= ROSTER_LOOKUP DECISION =======`);
      console.log(`[RosterCreatorService] hasLookupData=${hasLookupData}, year=${year}`);
      console.log(`[RosterCreatorService] availableTeams=${availableTeams.length > 0 ? availableTeams.join(',') : 'EMPTY'}`);
      console.log(`[RosterCreatorService] Condition check: hasLookupData=${hasLookupData} && year >= 1970 (${year >= 1970}) && year <= 2024 (${year <= 2024})`);
      console.log(`[RosterCreatorService] Will use ROSTER_lookup: ${hasLookupData && year >= 1970 && year <= 2024}`);
      console.log(`[RosterCreatorService] ======================================`);

      if (hasLookupData && year >= 1970 && year <= 2024) {
        // Use ROSTER_lookup data (pre-calculated ratings)
        progressCallback?.(30, `Loading roster data from database for ${year}...`);
        console.log(`[RosterCreatorService] ✅ Using ROSTER_lookup data for ${year}`);

        // Get all teams that existed in the year
        const teamsForYear = scraperService.getTeamsForYear(year);
        console.log(`[RosterCreatorService] Teams for ${year}: ${teamsForYear.join(', ')}`);

        // Specifically check for 'oti' (Titans/Oilers)
        const hasOti = teamsForYear.includes('oti');
        console.log(`[RosterCreatorService] 'oti' (Titans/Oilers) in teamsForYear: ${hasOti}`);

        let teamIndex = 0;
        for (const teamAbbr of teamsForYear) {
          // Use historical team mapping with year awareness
          const teamId = getHistoricalTeamId(teamAbbr, year);

          // Extra logging for historical teams
          if (['oti', 'bal', 'stl', 'bos', 'oak', 'sdg'].includes(teamAbbr)) {
            console.log(`[RosterCreatorService] >>> Processing historical team ${teamAbbr.toUpperCase()}:`);
            console.log(`[RosterCreatorService]     year: ${year}, teamId: ${teamId}`);
          }

          const players = await this.getPlayersFromLookup(teamAbbr, year, teamId);

          if (players.length > 0) {
            console.log(`[RosterCreatorService] ${teamAbbr}: ${players.length} players from ROSTER_lookup (TGID=${teamId})`);
            allRosterPlayers.push(...players);
          } else {
            console.log(`[RosterCreatorService] ❌ ${teamAbbr}: NO players from ROSTER_lookup`);
          }

          teamIndex++;
          const progress = 30 + Math.floor((teamIndex / teamsForYear.length) * 40);
          progressCallback?.(progress, `Loaded ${teamAbbr.toUpperCase()} roster...`);
        }

        console.log(`[RosterCreatorService] Total players from ROSTER_lookup: ${allRosterPlayers.length}`);

      } else {
        console.log(`[RosterCreatorService] ❌ ROSTER_lookup NOT used - falling through to web scraper`);
      }

      // If we got data from ROSTER_lookup, use it directly
      if (allRosterPlayers.length > 0) {
        console.log(`[RosterCreatorService] Using ${allRosterPlayers.length} players from ROSTER_lookup`);

        // Log team distribution
        const teamCounts = new Map<string, number>();
        for (const p of allRosterPlayers) {
          const tgid = p.TGID || 0;
          const teamKey = tgid.toString();
          teamCounts.set(teamKey, (teamCounts.get(teamKey) || 0) + 1);
        }
        console.log(`[RosterCreatorService] Team distribution from ROSTER_lookup:`);
        for (const [team, count] of Array.from(teamCounts.entries()).sort()) {
          console.log(`[RosterCreatorService]   TGID ${team}: ${count} players`);
        }

        // Check for Titans (TGID 30)
        const titansCount = allRosterPlayers.filter(p => p.TGID === 30).length;
        console.log(`[RosterCreatorService] *** TITANS (TGID=30): ${titansCount} players ***`);

        progressCallback?.(85, `Collecting free agents to fill roster...`);

        // Collect free agents to fill remaining roster slots
        const freeAgents = await this.collectFreeAgents(year, allRosterPlayers, maxPlayers);
        console.log(`[RosterCreatorService] Free agents collected: ${freeAgents.length}`);

        // Combine team rosters with free agents
        const finalRoster = [...allRosterPlayers, ...freeAgents];
        console.log(`[RosterCreatorService] Final roster size: ${finalRoster.length} (team: ${allRosterPlayers.length}, FA: ${freeAgents.length})`);

        progressCallback?.(100, `Roster generation complete! ${finalRoster.length} players created.`);

        return finalRoster;
      }

      // Fall back to web scraping for years not in ROSTER_lookup
      progressCallback?.(30, `Generating roster using web scraper...`);

      // Generate roster using the creator service (web scraping)
      // NOTE: generateRoster signature is (year, teams, maxPlayers, league, progressCallback, ratingMode)
      const generatedPlayers = await creatorService.generateRoster(
        year,
        [],          // teams - empty array means all teams for the year
        3000,        // maxPlayers
        undefined,   // league
        undefined,   // progressCallback
        ratingMode   // ratingMode (6th parameter)
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
        console.log(`  - PID: ${firstGen.PID}`);
        console.log(`  - PEPS: ${firstGen.PEPS}`);
        console.log(`  - Has source stats: ${!!firstGen._sourceStats}`);
        if (firstGen._sourceStats) {
          const s = firstGen._sourceStats;
          console.log(`  - Source stats: pass=${s.passAttempts}, rush=${s.rushAttempts}, rec=${s.receptions}, tkl=${s.tackles}`);
        }
      }

      // DEBUG: Find and log Staubach's GeneratedPlayer data
      const staubachGen = generatedPlayers.find(p =>
        (p.PLNA || p.lastName || '').toLowerCase() === 'staubach'
      );

      // Write debug to file for easy access
      const debugLogPath = path.join(app.getAppPath(), 'pid-debug.log');
      let debugContent = `=== PID DEBUG LOG - ${new Date().toISOString()} ===\n\n`;

      if (staubachGen) {
        console.log(`\n[RosterCreatorService] ========== STAUBACH FOUND IN GENERATED PLAYERS ==========`);
        console.log(`  Name: ${staubachGen.PFNA || staubachGen.firstName} ${staubachGen.PLNA || staubachGen.lastName}`);
        console.log(`  Team: ${staubachGen.team}`);
        console.log(`  PID: ${staubachGen.PID} (should be 2966 for real face)`);
        console.log(`  PEPS: ${staubachGen.PEPS}`);
        console.log(`  Race: ${staubachGen.race}`);
        console.log(`  College: ${staubachGen.college}`);
        console.log(`  ================================================================\n`);

        debugContent += `STAUBACH FOUND IN GENERATED PLAYERS:\n`;
        debugContent += `  Name: ${staubachGen.PFNA || staubachGen.firstName} ${staubachGen.PLNA || staubachGen.lastName}\n`;
        debugContent += `  Team: ${staubachGen.team}\n`;
        debugContent += `  PID: ${staubachGen.PID} (should be 2966 for real face)\n`;
        debugContent += `  PEPS: ${staubachGen.PEPS}\n`;
        debugContent += `  Race: ${staubachGen.race}\n`;
        debugContent += `  College: ${staubachGen.college}\n`;
        debugContent += `\n`;
      } else {
        console.log(`\n[RosterCreatorService] ⚠️ STAUBACH NOT FOUND IN GENERATED PLAYERS!\n`);
        debugContent += `⚠️ STAUBACH NOT FOUND IN GENERATED PLAYERS!\n\n`;
      }

      debugContent += `\nTotal Generated Players: ${generatedPlayers.length}\n`;
      debugContent += `ValidPIDs count: ${this.validPIDs.size}\n`;
      debugContent += `validPIDs.has(2966): ${this.validPIDs.has(2966)}\n`;

      // Write to file
      try {
        fs.writeFileSync(debugLogPath, debugContent);
        console.log(`[RosterCreatorService] Debug log written to: ${debugLogPath}`);
      } catch (err) {
        console.error(`[RosterCreatorService] Failed to write debug log:`, err);
      }

      // DEBUG: Team distribution BEFORE conversion
      console.log(`[RosterCreatorService] ========== TEAM DISTRIBUTION IN GENERATED PLAYERS ==========`);
      const teamCounts = new Map<string, number>();
      for (const p of generatedPlayers) {
        const team = p.team || 'UNDEFINED';
        teamCounts.set(team, (teamCounts.get(team) || 0) + 1);
      }
      // Sort by count descending
      const sortedTeams = Array.from(teamCounts.entries()).sort((a, b) => b[1] - a[1]);
      for (const [team, count] of sortedTeams) {
        console.log(`[RosterCreatorService]   ${team}: ${count} players`);
      }
      // Specifically check for OTI
      const otiCount = teamCounts.get('OTI') || teamCounts.get('oti') || 0;
      console.log(`[RosterCreatorService] *** OTI (Oilers/Titans) player count: ${otiCount} ***`);
      if (otiCount === 0) {
        console.log(`[RosterCreatorService] ⚠️ WARNING: NO OTI PLAYERS IN GENERATED DATA!`);
        console.log(`[RosterCreatorService] This means the scraper did not return any OTI players.`);
      }
      console.log(`[RosterCreatorService] ============================================================`);

      // Convert GeneratedPlayer format to RosterPlayer format
      const rosterPlayers: RosterPlayer[] = generatedPlayers.map((player: GeneratedPlayer, idx: number) => {
        // Find team ID from team abbreviation (Pro Football Reference abbr -> Madden team ID)
        // Uses year-aware historical team mapping for relocated franchises
        const teamAbbr = player.team?.toLowerCase() || '';
        const teamId = getHistoricalTeamId(teamAbbr, year);

        // DEBUG: Log team mapping for first 5 players
        if (idx < 5) {
          console.log(`[RosterCreatorService] Player ${idx + 1} team mapping: "${player.team}" (year ${year}) -> TGID ${teamId}`);
        }

        // Warn about unmapped teams (went to Free Agent)
        if (teamId === 1009 && player.team) {
          console.warn(`[RosterCreatorService] ⚠️ Unmapped team abbreviation: "${player.team}" for player ${player.PFNA || player.firstName} ${player.PLNA || player.lastName}`);
        }

        // DEBUG: Track historical team players
        if (['oti', 'bal', 'stl', 'bos', 'oak'].includes(teamAbbr)) {
          if (idx < 10) {
            console.log(`[RosterCreatorService] Historical team player: ${player.firstName || player.PFNA} ${player.lastName || player.PLNA} (${teamAbbr.toUpperCase()}) -> Team ID ${teamId}`);
          }
        }

        // Convert GeneratedPlayer to RosterPlayer format
        // CRITICAL: Ensure all required fields have valid fallback values
        // Age 0 causes players to show as 0 years old in-game (major bug)
        const playerAge = player.age || (22 + (player.yearsPro || 0)); // Default to 22 + years pro
        const validAge = Math.max(21, Math.min(45, playerAge)); // Clamp to valid range

        const rosterPlayer: RosterPlayer = {
          PFNA: player.PFNA || player.firstName,
          PLNA: player.PLNA || player.lastName,
          PPOS: player.positionCode, // Use numeric position code for lookups
          TGID: teamId,
          PAGE: validAge, // NEVER allow 0 or undefined age
          PJEN: player.jerseyNum || Math.floor(Math.random() * 99) + 1,
          PHGT: player.heightInches || 72, // Default to 6'0"
          PWGT: player.weight || 40, // Default to 200 lbs (200-160=40)
          PCOL: player.college, // College ID (already numeric from CreatorService)
          PHTN: player.hometown || '', // Home town city name
          PHSN: player.homeState, // Home state ID (already numeric from CreatorService)

          // Dev trait (0-3) - 0=Normal is the safe default
          PROL: typeof player.devTrait === 'number' ? player.devTrait : 0,

          // PID (Player Picture ID), PAM, and Years Pro
          // Use rosterGeneratorService to get valid PIDs and PAMs for generic faces
          PSXP: player.PID, // Player Picture ID for face/headshot (will be updated below if needed)
          PEPS: player.PEPS || '', // Player Asset Model (PAM) - will be updated below if needed
          PYRP: player.yearsPro || 0, // Years in league
          PBOD: player.bodyType,
          POID: player.commID || 0, // Presentation ID for in-game commentary

          // Face type fields - will be set after checking if PID is valid
          PLPL: 100, // Default to real face, updated below if generic
          PGHE: 0, // Generic head ID, updated below if generic
          // FIX: Don't use player.race (doesn't exist on GeneratedPlayer interface)
          // PSKI will be set correctly by assignGenericFace from PAM body code
          PSKI: 0, // Will be overwritten by assignGenericFace

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

          // Blocking - fallback to base blocking rating when finesse/power missing
          PPBK: player.ratings.passBlock,
          PPBS: player.ratings.passBlockPower || player.ratings.passBlock || 50, // PPBS - fallback to passBlock
          PPBF: player.ratings.passBlockFinesse || player.ratings.passBlock || 50, // PPBF - fallback to passBlock
          PRBK: player.ratings.runBlock,
          PRBS: player.ratings.runBlockPower || player.ratings.runBlock || 50, // PRBS - fallback to runBlock
          PRBF: player.ratings.runBlockFinesse || player.ratings.runBlock || 50, // PRBF - fallback to runBlock
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

          // Overall - will be recalculated below
          POVR: player.ratings.overall,

          // Metadata
          isHallOfFamer: player.devTrait === 3 // X-Factor dev trait indicates HOFer
        };

        // CRITICAL: Recalculate POVR using the official formula
        if (ovrWeightsCalculator.isInitialized()) {
          const attributes: Record<string, number> = {
            PSPD: rosterPlayer.PSPD, PACC: rosterPlayer.PACC, PAGI: rosterPlayer.PAGI,
            PSTR: rosterPlayer.PSTR, PAWR: rosterPlayer.PAWR, PCAR: rosterPlayer.PCAR,
            PBCV: rosterPlayer.PBCV, PBKT: rosterPlayer.PBKT, PLTR: rosterPlayer.PLTR,
            PLSA: rosterPlayer.PLSA, PLSM: rosterPlayer.PLSM, PLJM: rosterPlayer.PLJM,
            PCTH: rosterPlayer.PCTH, PLCI: rosterPlayer.PLCI, PLSC: rosterPlayer.PLSC,
            PELU: rosterPlayer.PELU, PJMP: rosterPlayer.PJMP, PSTA: rosterPlayer.PSTA,
            PTGH: rosterPlayer.PTGH, PINJ: rosterPlayer.PINJ, PSRR: rosterPlayer.PSRR,
            PMRR: rosterPlayer.PMRR, PDRR: rosterPlayer.PDRR, PTHP: rosterPlayer.PTHP,
            PTAS: rosterPlayer.PTAS, PTAM: rosterPlayer.PTAM, PTAD: rosterPlayer.PTAD,
            PTOR: rosterPlayer.PTOR, PTUP: rosterPlayer.PTUP, PPLA: rosterPlayer.PPLA,
            PBSK: rosterPlayer.PBSK, PBSG: rosterPlayer.PBSG, PLPM: rosterPlayer.PLPM,
            PFMS: rosterPlayer.PFMS, PTAK: rosterPlayer.PTAK, PLHT: rosterPlayer.PLHT,
            PLPU: rosterPlayer.PLPU, PLPR: rosterPlayer.PLPR, PLMC: rosterPlayer.PLMC,
            PLZC: rosterPlayer.PLZC, PLPE: rosterPlayer.PLPE, PPBK: rosterPlayer.PPBK,
            PPBS: rosterPlayer.PPBS, PPBF: rosterPlayer.PPBF, PRBK: rosterPlayer.PRBK,
            PRBS: rosterPlayer.PRBS, PRBF: rosterPlayer.PRBF, PLIB: rosterPlayer.PLIB,
            PLBK: rosterPlayer.PLBK, PKPR: rosterPlayer.PKPR, PKAC: rosterPlayer.PKAC,
            PLRL: rosterPlayer.PLRL, PKRT: rosterPlayer.PKRT,
          };
          const calculatedOvr = ovrWeightsCalculator.calculateOVR(attributes, player.positionCode, rosterPlayer.PLTY);

          // OVR floor of 55 - if below, BOOST RATINGS to achieve 55
          const OVR_FLOOR = 55;
          if (calculatedOvr < OVR_FLOOR) {
            const adjustment = ovrWeightsCalculator.calculateAdjustmentsForTargetOVR(
              attributes,
              OVR_FLOOR,
              player.positionCode,
              rosterPlayer.PLTY
            );
            if (adjustment && adjustment.adjustments) {
              for (const [fieldCode, adj] of Object.entries(adjustment.adjustments)) {
                if ((rosterPlayer as any)[fieldCode] !== undefined) {
                  (rosterPlayer as any)[fieldCode] = Math.max(40, Math.min(99, adj.suggested));
                }
              }
              rosterPlayer.POVR = adjustment.newOVR;
            } else {
              rosterPlayer.POVR = OVR_FLOOR;
            }
          } else {
            rosterPlayer.POVR = Math.min(99, calculatedOvr);
          }
        }

        return rosterPlayer;
      });

      // POST-PROCESSING: Set up generic face data while PRESERVING valid PIDs
      // Historical players don't have 3D face scans, but may have valid portrait PIDs
      console.log(`[RosterCreatorService] ===== SETTING UP FACE DATA =====`);
      let preservedPIDCount = 0;
      let assignedGenericCount = 0;
      for (let i = 0; i < rosterPlayers.length; i++) {
        const player = rosterPlayers[i];
        const existingPID = player.PSXP as number;

        // Check if player has a valid PID (exists in portrait mapping)
        const hasValidPID = existingPID > 0 && this.validPIDs.has(existingPID);

        // DEBUG: Specific Staubach trace
        const lastName = player.PLNA?.toLowerCase() || '';
        if (lastName === 'staubach') {
          console.log(`\n[RosterCreatorService] ========== STAUBACH TRACE ==========`);
          console.log(`[RosterCreatorService] Player: ${player.PFNA} ${player.PLNA}`);
          console.log(`[RosterCreatorService] existingPID (PSXP): ${existingPID}`);
          console.log(`[RosterCreatorService] existingPID > 0: ${existingPID > 0}`);
          console.log(`[RosterCreatorService] validPIDs.has(${existingPID}): ${this.validPIDs.has(existingPID)}`);
          console.log(`[RosterCreatorService] hasValidPID: ${hasValidPID}`);
          console.log(`[RosterCreatorService] validPIDs size: ${this.validPIDs.size}`);
          // Check if 2966 specifically is in validPIDs
          console.log(`[RosterCreatorService] validPIDs.has(2966): ${this.validPIDs.has(2966)}`);
          console.log(`[RosterCreatorService] =====================================\n`);
        }

        // Get race: prioritize CSV race mapping for valid PIDs, then original player data, then PSKI fallback
        const originalPlayer = generatedPlayers[i];
        const csvRace = hasValidPID ? this.pidToRace.get(existingPID) : undefined;
        const race = csvRace || originalPlayer?.race || this.mapPSKIToRace(player.PSKI || 0);

        if (hasValidPID) {
          // PRESERVE the existing PID - player has a valid portrait/identity
          const playerType = this.pidToType.get(existingPID) || 'generic';
          const isLegendOrPlayer = playerType === 'legend' || playerType === 'player';

          // Use the PAM from mapping if available
          const mappedPAM = this.pidToPAM.get(existingPID);
          if (mappedPAM) {
            player.PEPS = mappedPAM; // Use PAM from mapping (legend or generic)
            player.PGHE = this.pidToPGHE.get(existingPID) || this.getGenericPGHE(race);
            player.PLPL = isLegendOrPlayer ? 100 : 0; // Legends have real faces (100), generics have 0
          } else {
            // No PAM mapped for this PID - select a race-matched generic face
            const genericFace = this.selectGenericFaceByRace(race);
            player.PEPS = ''; // EMPTY - BLBM GENR/SKNT controls the face
            player.PGHE = genericFace.pghe;
            player.PLPL = 0; // Generic face
            player._race = race; // Store race for BLBM GENR/SKNT assignment
          }

          // DON'T SET PSKI - BLBM GENR/SKNT controls face appearance
          // Only set _race for BLBM to use
          player._race = race;

          preservedPIDCount++;
          if (preservedPIDCount <= 5) {
            console.log(`[RosterCreatorService] Preserved PID for ${player.PFNA} ${player.PLNA}: PID=${existingPID}, PEPS="${player.PEPS}", PLPL=${player.PLPL}, type=${playerType}, csvRace=${csvRace}, race=${race}, PSKI=${player.PSKI}`);
          }
        } else {
          // No valid PID - assign generic PID and face
          this.assignGenericFace(player, race);
          assignedGenericCount++;
          if (assignedGenericCount <= 5) {
            console.log(`[RosterCreatorService] Assigned generic face to ${player.PFNA} ${player.PLNA}: PID=${player.PSXP}, PEPS="${player.PEPS}", PLPL=0, race=${race}`);
          }
        }
      }
      console.log(`[RosterCreatorService] Face data: ${preservedPIDCount} preserved PIDs, ${assignedGenericCount} assigned generic`);

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

      // DEBUG: Count OTI (Titans/Oilers) players
      const otiPlayers = rosterPlayers.filter(p => p.TGID === 30);
      console.log(`[RosterCreatorService] ========== OTI/TITANS SUMMARY ==========`);
      console.log(`[RosterCreatorService] Total players with TGID=30 (Titans): ${otiPlayers.length}`);
      if (otiPlayers.length > 0) {
        console.log(`[RosterCreatorService] Sample OTI players:`);
        otiPlayers.slice(0, 5).forEach(p => {
          console.log(`[RosterCreatorService]   - ${p.PFNA} ${p.PLNA} (${p.PPOS})`);
        });
      } else {
        console.log(`[RosterCreatorService] ⚠️ NO PLAYERS ASSIGNED TO TITANS (TGID=30)!`);
      }
      console.log(`[RosterCreatorService] =========================================`);

      progressCallback?.(85, `Collecting free agents to fill roster...`);

      // Collect free agents from 5 years before to fill remaining roster slots
      console.log(`[RosterCreatorService] ===== FREE AGENT COLLECTION =====`);
      const freeAgents = await this.collectFreeAgents(year, rosterPlayers, maxPlayers);
      console.log(`[RosterCreatorService] Free agents collected: ${freeAgents.length}`);

      // Combine team rosters with free agents
      const finalRoster = [...rosterPlayers, ...freeAgents];
      console.log(`[RosterCreatorService] Final roster size: ${finalRoster.length} (team: ${rosterPlayers.length}, FA: ${freeAgents.length})`);

      // NOTE: Face data is already assigned correctly:
      // - Team roster players with valid PIDs have faces preserved (lines ~705-743)
      // - Team roster players without valid PIDs got generic faces assigned
      // - Free agents have face data from CSV or from random generation
      // Do NOT re-apply generic faces here as it would overwrite preserved PIDs!

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
   * Collect free agents from database for 5 years before the target year
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

    // Ensure lookupService is ready
    await lookupService.waitForReady();

    // Collect all player seasons for years 5-1 before target year
    const startYear = year - 5;
    const endYear = year - 1;
    console.log(`[RosterCreatorService] Scanning years ${startYear} to ${endYear} for free agents from database...`);

    const parsed = { data: [] as any[] };
    for (let y = startYear; y <= endYear; y++) {
      const yearPlayers = lookupService.getAllPlayerSeasonsForYear(y);
      for (const p of yearPlayers) {
        // Transform to CSV-compatible format
        parsed.data.push({
          Year: y,
          PFNA: p.firstName,
          PLNA: p.lastName,
          firstName: p.firstName,
          lastName: p.lastName,
          PPOS: p.position,
          position: p.position,
          PAGE: p.age,
          age: p.age,
          PJEN: p.jersey,
          jerseyNum: p.jersey,
          PSXP: p.maddenPid,
          PID: p.maddenPid,
          PEPS: p.maddenPam,
          PAM: p.maddenPam,
          PCOL: p.college,
          college: p.college,
          Race: p.race,
          ...p.ratings
        });
      }
    }

    console.log(`[RosterCreatorService] Loaded ${parsed.data.length} player-seasons from database`);

    // Build set of players already on current roster (firstName|lastName only - ignore position)
    const rosterPlayerNames = new Set(
      currentRosterPlayers.map(p => `${p.PFNA}|${p.PLNA}`)
    );
    console.log(`[RosterCreatorService] Current roster has ${rosterPlayerNames.size} unique player names`);

    // Collect free agents - keep best version of each player
    const freeAgentsByKey = new Map<string, any>();

    for (const csvRow of parsed.data as any[]) {
      // Year already filtered when loading from database
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
          PHTN: csvRow.PHTN || csvRow.hometown || '',
          PHSN: csvRow.PHSN || csvRow.homeState || 0,

          // Dev trait (0=Normal, 1=Star, 2=Superstar, 3=X-Factor)
          PROL: csvRow.PROL || csvRow.devTrait || 0,

          // PID, PAM, Years Pro
          PSXP: csvRow.PSXP || csvRow.PID || 0,
          // Keep PAM from CSV - both real faces and gen_ formats are valid
          // gen_ PAMs ensure face and body skin tones match
          PEPS: csvRow.PEPS || csvRow.PAM || '',
          PYRP: csvRow.PYRP || csvRow.yearsPro || 0,
          PBOD: csvRow.PBOD || csvRow.bodyType || 0,
          POID: csvRow.POID || csvRow.commID || 0, // Presentation ID for in-game commentary

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

          // Blocking - fallback to base blocking rating when finesse/power missing
          PPBK: csvRow.PPBK || 50,
          PPBS: csvRow.PPBS || csvRow.PPBP || csvRow.PPBK || 50, // Pass Block Strength (Power) - fallback to PPBK
          PPBF: csvRow.PPBF || csvRow.PPBK || 50, // Pass Block Finesse - fallback to PPBK
          PRBK: csvRow.PRBK || 50,
          PRBS: csvRow.PRBS || csvRow.PRBP || csvRow.PRBK || 50, // Run Block Strength (Power) - fallback to PRBK
          PRBF: csvRow.PRBF || csvRow.PRBK || 50, // Run Block Finesse - fallback to PRBK
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

          // Overall - will be recalculated below
          POVR: csvRow.POVR || 50,

          // Face/Appearance fields - read from CSV or use defaults
          // These will be overwritten by assignGenericFace in the final loop
          PLPL: csvRow.PLPL || 0, // Generic face (will be set properly later)
          PGHE: csvRow.PGHE || 0, // Generic head ID (will be set properly later)
          // DON'T SET PSKI - BLBM GENR/SKNT controls face appearance
          _race: parseInt(csvRow.Race) || 7, // Store race for BLBM GENR/SKNT

          // Metadata
          isHallOfFamer: (csvRow.PDEV || csvRow.devTrait || 0) === 3
        };

        // CRITICAL: Recalculate POVR using the official formula
        if (ovrWeightsCalculator.isInitialized()) {
          const attributes: Record<string, number> = {
            PSPD: rosterPlayer.PSPD, PACC: rosterPlayer.PACC, PAGI: rosterPlayer.PAGI,
            PSTR: rosterPlayer.PSTR, PAWR: rosterPlayer.PAWR, PCAR: rosterPlayer.PCAR,
            PBCV: rosterPlayer.PBCV, PBKT: rosterPlayer.PBKT, PLTR: rosterPlayer.PLTR,
            PLSA: rosterPlayer.PLSA, PLSM: rosterPlayer.PLSM, PLJM: rosterPlayer.PLJM,
            PCTH: rosterPlayer.PCTH, PLCI: rosterPlayer.PLCI, PLSC: rosterPlayer.PLSC,
            PELU: rosterPlayer.PELU, PJMP: rosterPlayer.PJMP, PSTA: rosterPlayer.PSTA,
            PTGH: rosterPlayer.PTGH, PINJ: rosterPlayer.PINJ, PSRR: rosterPlayer.PSRR,
            PMRR: rosterPlayer.PMRR, PDRR: rosterPlayer.PDRR, PTHP: rosterPlayer.PTHP,
            PTAS: rosterPlayer.PTAS, PTAM: rosterPlayer.PTAM, PTAD: rosterPlayer.PTAD,
            PTOR: rosterPlayer.PTOR, PTUP: rosterPlayer.PTUP, PPLA: rosterPlayer.PPLA,
            PBSK: rosterPlayer.PBSK, PBSG: rosterPlayer.PBSG, PLPM: rosterPlayer.PLPM,
            PFMS: rosterPlayer.PFMS, PTAK: rosterPlayer.PTAK, PLHT: rosterPlayer.PLHT,
            PLPU: rosterPlayer.PLPU, PLPR: rosterPlayer.PLPR, PLMC: rosterPlayer.PLMC,
            PLZC: rosterPlayer.PLZC, PLPE: rosterPlayer.PLPE, PPBK: rosterPlayer.PPBK,
            PPBS: rosterPlayer.PPBS, PPBF: rosterPlayer.PPBF, PRBK: rosterPlayer.PRBK,
            PRBS: rosterPlayer.PRBS, PRBF: rosterPlayer.PRBF, PLIB: rosterPlayer.PLIB,
            PLBK: rosterPlayer.PLBK, PKPR: rosterPlayer.PKPR, PKAC: rosterPlayer.PKAC,
            PLRL: rosterPlayer.PLRL, PKRT: rosterPlayer.PKRT,
          };
          const calculatedOvr = ovrWeightsCalculator.calculateOVR(attributes, rosterPlayer.PPOS, rosterPlayer.PLTY);

          // OVR floor of 55 - if below, BOOST RATINGS to achieve 55
          const OVR_FLOOR = 55;
          if (calculatedOvr < OVR_FLOOR) {
            const adjustment = ovrWeightsCalculator.calculateAdjustmentsForTargetOVR(
              attributes,
              OVR_FLOOR,
              rosterPlayer.PPOS,
              rosterPlayer.PLTY
            );
            if (adjustment && adjustment.adjustments) {
              for (const [fieldCode, adj] of Object.entries(adjustment.adjustments)) {
                if ((rosterPlayer as any)[fieldCode] !== undefined) {
                  (rosterPlayer as any)[fieldCode] = Math.max(40, Math.min(99, adj.suggested));
                }
              }
              rosterPlayer.POVR = adjustment.newOVR;
            } else {
              rosterPlayer.POVR = OVR_FLOOR;
            }
          } else {
            rosterPlayer.POVR = Math.min(99, calculatedOvr);
          }
        }

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
      bodyType: this.determineBodyType(position), // Position-aware body type
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

    // Random race (weighted: 70% black, 25% white, 5% hispanic based on NFL demographics)
    const raceRoll = Math.random();
    const race = raceRoll < 0.70 ? 7 : (raceRoll < 0.95 ? 1 : 5);

    // Select a complete generic face (PID, PAM, PGHE) that matches race
    const genericFace = this.selectGenericFaceByRace(race);
    // DON'T SET PSKI - BLBM GENR/SKNT controls face appearance

    const player: RosterPlayer = {
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
      PROL: 0, // Dev trait: Normal
      PSXP: genericFace.pid, // Generic PID from race-matched face
      PEPS: '', // EMPTY - BLBM GENR/SKNT controls the face
      PYRP: 0,
      PBOD: this.determineBodyType(position), // Position-aware body type
      PLPL: 0, // Generic face (not real face)
      PGHE: genericFace.pghe, // Generic head mesh from race-matched face
      // DON'T SET PSKI - BLBM handles it
      _race: race, // Store race for BLBM GENR/SKNT assignment

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

    // CRITICAL: Recalculate POVR using the official formula
    if (ovrWeightsCalculator.isInitialized()) {
      const attributes: Record<string, number> = {
        PSPD: player.PSPD as number, PACC: player.PACC as number, PAGI: player.PAGI as number,
        PSTR: player.PSTR as number, PAWR: player.PAWR as number, PCAR: player.PCAR as number,
        PBCV: player.PBCV as number, PBKT: player.PBKT as number, PLTR: player.PLTR as number,
        PLSA: player.PLSA as number, PLSM: player.PLSM as number, PLJM: player.PLJM as number,
        PCTH: player.PCTH as number, PLCI: player.PLCI as number, PLSC: player.PLSC as number,
        PELU: player.PELU as number, PJMP: player.PJMP as number, PSTA: player.PSTA as number,
        PTGH: player.PTGH as number, PINJ: player.PINJ as number, PSRR: player.PSRR as number,
        PMRR: player.PMRR as number, PDRR: player.PDRR as number, PTHP: player.PTHP as number,
        PTAS: player.PTAS as number, PTAM: player.PTAM as number, PTAD: player.PTAD as number,
        PTOR: player.PTOR as number, PTUP: player.PTUP as number, PPLA: player.PPLA as number,
        PBSK: player.PBSK as number, PBSG: player.PBSG as number, PLPM: player.PLPM as number,
        PFMS: player.PFMS as number, PTAK: player.PTAK as number, PLHT: player.PLHT as number,
        PLPU: player.PLPU as number, PLPR: player.PLPR as number, PLMC: player.PLMC as number,
        PLZC: player.PLZC as number, PLPE: player.PLPE as number, PPBK: player.PPBK as number,
        PPBS: player.PPBS as number, PPBF: player.PPBF as number, PRBK: player.PRBK as number,
        PRBS: player.PRBS as number, PRBF: player.PRBF as number, PLIB: player.PLIB as number,
        PLBK: player.PLBK as number, PKPR: player.PKPR as number, PKAC: player.PKAC as number,
        PLRL: player.PLRL as number, PKRT: player.PKRT as number,
      };
      const calculatedOvr = ovrWeightsCalculator.calculateOVR(attributes, position, player.PLTY);

      // OVR floor of 55 - if below, BOOST RATINGS to achieve 55
      const OVR_FLOOR = 55;
      if (calculatedOvr < OVR_FLOOR) {
        const adjustment = ovrWeightsCalculator.calculateAdjustmentsForTargetOVR(
          attributes,
          OVR_FLOOR,
          position,
          player.PLTY
        );
        if (adjustment && adjustment.adjustments) {
          for (const [fieldCode, adj] of Object.entries(adjustment.adjustments)) {
            if ((player as any)[fieldCode] !== undefined) {
              (player as any)[fieldCode] = Math.max(40, Math.min(99, adj.suggested));
            }
          }
          player.POVR = adjustment.newOVR;
        } else {
          player.POVR = OVR_FLOOR;
        }
      } else {
        player.POVR = Math.min(99, calculatedOvr);
      }
    }

    return player;
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
