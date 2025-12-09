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
   * Load PID_Portrait_Mapping.csv and pam-race-mapping.json for generic face assignment
   */
  private async loadMappingData(): Promise<void> {
    if (this.dataLoaded) return;

    try {
      // Load PID_Portrait_Mapping.csv
      const pidMappingPath = path.join(app.getAppPath(), 'data', 'lookups', 'PID_Portrait_Mapping.csv');
      if (fs.existsSync(pidMappingPath)) {
        const csvContent = fs.readFileSync(pidMappingPath, 'utf8');
        const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

        // Build race-based generic face lookup
        const genericFacesByRaceTemp: Map<number, { pid: number; pam: string; pghe: number }[]> = new Map();

        // Helper to parse skin tone from portrait name - FIRST DIGIT is skin tone (1-7)
        // Portrait format: plpo_generic_X_Y_Z_NNN where X is skin tone (1=lightest, 7=darkest)
        const parseSkinToneFromPortrait = (portrait: string): { skinTone: number; headName: string } | null => {
          if (!portrait.startsWith('plpo_generic_')) return null;
          const headName = portrait.substring('plpo_generic_'.length); // e.g., "7_M_G_005"
          const firstChar = headName.charAt(0);
          const skinTone = parseInt(firstChar);
          if (isNaN(skinTone) || skinTone < 1 || skinTone > 7) return null;
          return { skinTone, headName };
        };

        // REMOVED: generatePAMFromPortrait was incorrectly converting PLPO to PAM
        // PLPO format: plpo_generic_SKINTONE_... (first digit = skin tone 1-7)
        // PAM format: gen_GENERATION_BODYCODE_... (first digit = generation 1-3, BODYCODE = B/H/M/T for race)
        // These encode different information and cannot be directly converted!
        // Instead, use getGenericPAM(race) which selects from pam-race-mapping.json

        for (const row of parsed.data as any[]) {
          const pid = parseInt(row.PID);
          if (!isNaN(pid)) {
            // Track all valid PIDs
            this.validPIDs.add(pid);

            // Store portrait, type, and race for each PID
            const portrait = row.Portrait || '';
            const type = row.Type || 'generic';
            const race = parseInt(row.Race) || 0;
            if (portrait) this.pidToPortrait.set(pid, portrait);
            this.pidToType.set(pid, type);
            if (race > 0) this.pidToRace.set(pid, race);

            // Store PGHE mapping if present (may not exist in original CSV)
            const pghe = parseInt(row.PGHE);
            if (!isNaN(pghe)) {
              this.pidToPGHE.set(pid, pghe);
            }

            // Handle PAM - only use if it exists in CSV, otherwise leave blank
            const rawPAM = row.PAM ? String(row.PAM).trim() : '';
            if (rawPAM && rawPAM !== '0') {
              this.pidToPAM.set(pid, rawPAM);
            }
            // If no PAM in lookup, leave blank - game handles it via PID

            // Collect generic PIDs for fallback random selection
            if (type === 'generic' && portrait) {
              this.genericPIDs.push(pid);

              // NOTE: We no longer build genericFacesByRace from PLPO portrait names
              // because PLPO skin tone (1-7) does NOT map to PAM format.
              // PAM selection will be done at runtime using getGenericPAM(race)
              // which properly selects from pam-race-mapping.json based on body code.

              // Only cache if CSV already has a valid PAM
              if (rawPAM && rawPAM !== '0' && !this.pidToPAM.has(pid)) {
                this.pidToPAM.set(pid, rawPAM);
              }
            }
          }
        }

        this.genericFacesByRace = genericFacesByRaceTemp;

        console.log(`[RosterCreatorService] Loaded ${this.pidToPortrait.size} PID mappings, ${this.genericPIDs.length} generic PIDs, ${this.pidToRace.size} race mappings`);
        console.log('[RosterCreatorService] Generic faces by race:');
        this.genericFacesByRace.forEach((faces, race) => {
          console.log(`  Race ${race}: ${faces.length} faces`);
        });
      }

      // Load pam-race-mapping.json
      const pamMappingPath = path.join(app.getAppPath(), 'data', 'lookups', 'pam-race-mapping.json');
      if (fs.existsSync(pamMappingPath)) {
        const jsonContent = fs.readFileSync(pamMappingPath, 'utf8');
        this.pamRaceMapping = JSON.parse(jsonContent);
        console.log(`[RosterCreatorService] Loaded PAM race mapping: ${this.pamRaceMapping?.white.length} white, ${this.pamRaceMapping?.hispanic.length} hispanic, ${this.pamRaceMapping?.black.length} black`);
      }

      // CRITICAL FIX: Also load ALL_PLAYER_LOOKUP.csv to ensure ALL valid PIDs and race data are available
      // This ensures PIDs from MASTER_LOOKUP (used by CreatorService) are recognized as valid
      const allPlayerLookupPath = path.join(app.getAppPath(), 'data', 'lookups', 'ALL_PLAYER_LOOKUP.csv');
      if (fs.existsSync(allPlayerLookupPath)) {
        const allPlayerContent = fs.readFileSync(allPlayerLookupPath, 'utf8');
        const allPlayerParsed = Papa.parse(allPlayerContent, { header: true, skipEmptyLines: true });

        let addedFromMaster = 0;
        let raceAddedFromMaster = 0;

        for (const row of allPlayerParsed.data as any[]) {
          const photoId = parseInt(row['PhotoID']);
          if (!isNaN(photoId) && photoId > 0) {
            // Add to validPIDs if not already present
            if (!this.validPIDs.has(photoId)) {
              this.validPIDs.add(photoId);
              addedFromMaster++;
            }

            // Add race mapping if not already present and race is valid
            const race = parseInt(row['Race']);
            if (!isNaN(race) && race > 0 && !this.pidToRace.has(photoId)) {
              this.pidToRace.set(photoId, race);
              raceAddedFromMaster++;
            }

            // Also set type to 'player' or 'legend' based on presence of PLPO
            if (!this.pidToType.has(photoId)) {
              const plpo = row['PLPO'] || '';
              if (plpo.includes('legends')) {
                this.pidToType.set(photoId, 'legend');
              } else if (plpo) {
                this.pidToType.set(photoId, 'player');
              } else {
                this.pidToType.set(photoId, 'player'); // Default real players to 'player' type
              }
            }

            // Also store PAM (Player Assets ID) if not already present
            const pamValue = row['Player Assets ID'] || '';
            if (pamValue && !this.pidToPAM.has(photoId)) {
              this.pidToPAM.set(photoId, pamValue);
            }
          }
        }

        console.log(`[RosterCreatorService] Extended from ALL_PLAYER_LOOKUP: ${addedFromMaster} new PIDs, ${raceAddedFromMaster} new race mappings`);
        console.log(`[RosterCreatorService] TOTAL: ${this.validPIDs.size} valid PIDs, ${this.pidToRace.size} race mappings`);

        // DEBUG: Verify Staubach's PID 2966 is in validPIDs
        console.log(`[RosterCreatorService] ✓ VERIFY: validPIDs.has(2966) = ${this.validPIDs.has(2966)}`);
        console.log(`[RosterCreatorService] ✓ VERIFY: pidToRace.get(2966) = ${this.pidToRace.get(2966)}`);
        console.log(`[RosterCreatorService] ✓ VERIFY: pidToType.get(2966) = ${this.pidToType.get(2966)}`);
      } else {
        console.warn(`[RosterCreatorService] ALL_PLAYER_LOOKUP.csv not found at ${allPlayerLookupPath}`);
      }

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

      progressCallback?.(30, `Generating roster using scraper service...`);

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
          PHSN: player.homeState, // Home state ID (already numeric from CreatorService)

          // Dev trait (0-3) - 0=Normal is the safe default
          PDEV: typeof player.devTrait === 'number' ? player.devTrait : 0,

          // PID (Player Picture ID), PAM, and Years Pro
          // Use rosterGeneratorService to get valid PIDs and PAMs for generic faces
          PSXP: player.PID, // Player Picture ID for face/headshot (will be updated below if needed)
          PEPS: player.PEPS || '', // Player Asset Model (PAM) - will be updated below if needed
          PYRP: player.yearsPro || 0, // Years in league
          PBOD: player.bodyType,

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
          // Keep PAM from CSV - both real faces and gen_ formats are valid
          // gen_ PAMs ensure face and body skin tones match
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

          // Face/Appearance fields - read from CSV or use defaults
          // These will be overwritten by assignGenericFace in the final loop
          PLPL: csvRow.PLPL || 0, // Generic face (will be set properly later)
          PGHE: csvRow.PGHE || 0, // Generic head ID (will be set properly later)
          // DON'T SET PSKI - BLBM GENR/SKNT controls face appearance
          _race: parseInt(csvRow.Race) || 7, // Store race for BLBM GENR/SKNT

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
