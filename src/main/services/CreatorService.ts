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
import { scraperDebugLogger } from '../utils/DebugLogger';
import { RatingMode, RatingModeFactory } from './rating-modes';
// V2.0 Generator Services
import { playerDataService, HistoricalPlayer, FutureProspect } from './generator/PlayerDataService';
import { decadeClassService } from './generator/DecadeClassService';
import { draftSizeService } from './generator/DraftSizeService';
import { archetypeAssigner } from './generator/ArchetypeAssigner';
import { futureDraftService, EnrichedProspect } from './generator/FutureDraftService';
import { IRatingGenerator, RatingContext } from './rating-modes';
import { archetypeService } from './utils/archetypeService';
import * as fs from 'fs';
import * as path from 'path';

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
  position: string; // M26 position name (QB, HB, etc.)
  positionCode: number; // M26 position code (0-21)
  college: number; // College ID from lookup table (e.g., 4 for Alabama, 265 for No College)
  team?: string;
  jerseyNum: number;
  age: number;
  heightInches: number;
  weight: number;
  homeState: number; // State ID from lookup table (e.g., 0 for Alabama, 4 for California)

  // Dev Trait
  devTrait: number; // 0=Normal, 1=Star, 2=Superstar, 3=X-Factor

  // Ratings
  ratings: MaddenRatings;

  // Visuals
  PID: number; // Portrait ID (0 for generic)
  PAM: string | null; // Player Asset Manager ID (same as PEPS)
  PEPS: string | null; // Player Equipment Preset (null for generic)
  bodyType: string; // Madden body type string: "Thin", "Muscular", "Heavy"
  yearsPro: number; // Years in the league (0 for rookies)
  archetype: string; // Player archetype (e.g., "Field General", "Scrambler")
  race?: number; // Race code from MASTER_LOOKUP (1=White, 5=Hispanic, 7=Black)
  commID?: number; // Commentary/Presentation ID for in-game announcer names

  // Source data (for reference)
  _sourceStats?: PlayerStats;
}

/**
 * V2.0 Generator Options
 */
export interface DraftGeneratorOptionsV2 {
  // Source selection
  year?: number;           // Single year (1936-2025 historical, 2026+ future)
  decade?: number;         // Decade start year (1930, 1940, ..., 2020)

  // Rating mode
  ratingMode: 'random' | 'variance' | 'madden';

  // Options
  includeUFAs?: boolean;   // Include undrafted free agents
  testingMode?: boolean;   // Limit to 40 players for testing

  // Legacy support
  league?: string;         // 'nfl' | 'afl' | 'combined' (for 1960-1969)
}

/**
 * Creator Service Class
 */
export class CreatorService {
  // College lookup cache: college name -> college ID
  private collegeLookupCache: Map<string, number> | null = null;
  // State lookup cache: state abbreviation -> state ID
  private stateLookupCache: Map<string, number> | null = null;

  // DELETED: loadPIDLookup() - no longer needed, all PID data comes from ALL_PLAYER_LOOKUP.csv

  /**
   * Match player name to PID from lookup table with disambiguation
   * Uses ALL_PLAYER_LOOKUP.csv with multiple fields to handle duplicate names
   * NOW WITH: 26,034 players (76% more than old FullData_Lookup!)
   * @param firstName Player first name
   * @param lastName Player last name
   * @param draftYear Draft year (optional, for disambiguation)
   * @param position Position name (optional, for disambiguation)
   * @param college College name (optional, for disambiguation)
   * @returns PID if found, 0 if no match
   */
  private matchPID(firstName: string, lastName: string, draftYear?: number, position?: string, college?: string): number {
    const masterLookup = this.loadMasterLookup();

    // Helper function to normalize names for flexible matching
    // Preserves hyphens, removes punctuation, handles suffixes
    const normalizeName = (name: string): string => {
      let normalized = name.trim().toLowerCase();
      // Remove periods but keep hyphens and apostrophes
      normalized = normalized.replace(/\./g, '');
      // Remove commas (for "Feamster Jr., Tom" format)
      normalized = normalized.replace(/,/g, '');
      // Remove special characters like ‡ and any numbers following them (e.g., "Pearson‡1" -> "Pearson")
      // This handles pro-football-reference disambiguation markers
      normalized = normalized.replace(/[‡†*]+\d*/g, '');
      // Normalize whitespace
      normalized = normalized.replace(/\s+/g, ' ').trim();
      return normalized;
    };

    // Create multiple normalized versions for flexible matching
    const normalizedFirstName = normalizeName(firstName);
    const normalizedLastName = normalizeName(lastName);

    // Also create suffix-stripped versions for fallback matching
    const stripSuffixes = (name: string): string => {
      return name.replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, '').trim();
    };

    const normalizedFirstNameNoSuffix = stripSuffixes(normalizedFirstName);
    const normalizedLastNameNoSuffix = stripSuffixes(normalizedLastName);

    // Find all candidates with matching name
    const candidates: Array<{pid: number, entry: any}> = [];

    masterLookup.forEach((entry, key) => {
      const entryFirstName = normalizeName(entry['First Name'] || '');
      const entryLastName = normalizeName(entry['Last Name'] || '');

      // Try exact match first (with suffixes)
      const exactMatch = (entryFirstName === normalizedFirstName && entryLastName === normalizedLastName);

      // Try suffix-stripped match as fallback
      const entryFirstNoSuffix = stripSuffixes(entryFirstName);
      const entryLastNoSuffix = stripSuffixes(entryLastName);
      const flexibleMatch = (entryFirstNoSuffix === normalizedFirstNameNoSuffix && entryLastNoSuffix === normalizedLastNameNoSuffix);

      if (exactMatch || flexibleMatch) {
        const pid = parseInt(entry['PhotoID']);
        if (!isNaN(pid) && pid > 0) {
          candidates.push({ pid, entry });
        }
      }
    });

    if (candidates.length === 0) {
      // No match found in ALL_PLAYER_LOOKUP
      // Try secondary lookup in PID_Portrait_Mapping.csv (has different players, especially legends)
      const pidFromPortraitMapping = this.matchPIDFromPortraitMapping(firstName, lastName, draftYear);
      if (pidFromPortraitMapping > 0) {
        console.log(`[CreatorService] PID match from PID_Portrait_Mapping: "${firstName} ${lastName}" -> PID ${pidFromPortraitMapping}`);
        return pidFromPortraitMapping;
      }
      return 0;
    }

    if (candidates.length === 1) {
      // Only one match - use it
      console.log(`[CreatorService] PID match: "${firstName} ${lastName}" -> PID ${candidates[0].pid} (unique match)`);
      return candidates[0].pid;
    }

    // Multiple candidates - use disambiguating fields
    console.log(`[CreatorService] Found ${candidates.length} candidates for "${firstName} ${lastName}", using disambiguation`);

    // Strategy 1: Try exact match with draft year + position + league (for AFL/NFL era)
    if (draftYear && position) {
      // For 1960-1969, also check league to avoid AFL/NFL confusion
      if (draftYear >= 1960 && draftYear <= 1969) {
        const aflMatch = candidates.find(c =>
          c.entry['Draft Class'] === String(draftYear) &&
          c.entry['Position'].toLowerCase() === position.toLowerCase() &&
          c.entry['League']?.toUpperCase() === 'AFL'
        );
        const nflMatch = candidates.find(c =>
          c.entry['Draft Class'] === String(draftYear) &&
          c.entry['Position'].toLowerCase() === position.toLowerCase() &&
          c.entry['League']?.toUpperCase() === 'NFL'
        );

        // Prefer NFL unless explicitly AFL
        const exactMatch = nflMatch || aflMatch;
        if (exactMatch) {
          const league = exactMatch.entry['League'] || 'unknown';
          console.log(`[CreatorService] PID match: "${firstName} ${lastName}" -> PID ${exactMatch.pid} (year=${draftYear}, pos=${position}, league=${league})`);
          return exactMatch.pid;
        }
      } else {
        const exactMatch = candidates.find(c =>
          c.entry['Draft Class'] === String(draftYear) &&
          c.entry['Position'].toLowerCase() === position.toLowerCase()
        );

        if (exactMatch) {
          console.log(`[CreatorService] PID match: "${firstName} ${lastName}" -> PID ${exactMatch.pid} (year=${draftYear}, pos=${position})`);
          return exactMatch.pid;
        }
      }
    }

    // Strategy 2: Try match with draft year only
    if (draftYear) {
      const yearMatch = candidates.find(c => c.entry['Draft Class'] === String(draftYear));

      if (yearMatch) {
        console.log(`[CreatorService] PID match: "${firstName} ${lastName}" -> PID ${yearMatch.pid} (year=${draftYear})`);
        return yearMatch.pid;
      }
    }

    // Strategy 3: Try match with position only
    if (position) {
      const posMatch = candidates.find(c => c.entry['Position'].toLowerCase() === position.toLowerCase());

      if (posMatch) {
        console.log(`[CreatorService] PID match: "${firstName} ${lastName}" -> PID ${posMatch.pid} (pos=${position})`);
        return posMatch.pid;
      }
    }

    // Strategy 4: Use first candidate as fallback
    console.warn(`[CreatorService] ⚠️ Ambiguous match for "${firstName} ${lastName}", using first candidate PID ${candidates[0].pid}`);
    console.warn(`[CreatorService]    Available: ${candidates.map(c => `${c.entry['Draft Class']} ${c.entry['Position']} ${c.entry['League'] || 'NFL'} (PID ${c.pid})`).join(', ')}`);
    return candidates[0].pid;
  }

  /**
   * Secondary PID lookup using PID_Portrait_Mapping.csv
   * Used when ALL_PLAYER_LOOKUP fails to find a match
   * Handles legends, special characters, and alternate name formats
   *
   * @param firstName Player first name
   * @param lastName Player last name
   * @param draftYear Draft year for disambiguation (optional)
   * @returns PID if found, 0 otherwise
   */
  private matchPIDFromPortraitMapping(firstName: string, lastName: string, draftYear?: number): number {
    try {
      const { app } = require('electron');
      const pidPortraitPath = path.join(app.getAppPath(), 'data', 'lookups', 'PID_Portrait_Mapping.csv');
      const csvContent = fs.readFileSync(pidPortraitPath, 'utf-8');
      const lines = csvContent.split('\n');

      // Normalize input names
      const normalizeName = (name: string): string => {
        return name.trim().toLowerCase()
          .replace(/\./g, '')
          .replace(/,/g, '')
          .replace(/[‡†*]+\d*/g, '')  // Remove pro-football-reference disambiguation markers
          .replace(/\s+/g, ' ');
      };

      const stripSuffixes = (name: string): string => {
        return name.replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, '').trim();
      };

      const searchName = normalizeName(`${firstName} ${lastName}`);
      const searchNameNoSuffix = stripSuffixes(searchName);

      // Parse CSV and find matches
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // CSV format: PID,Player Name,Type,Portrait
        const parts = line.split(',');
        if (parts.length < 2) continue;

        const pid = parseInt(parts[0]);
        const playerName = parts[1];

        if (isNaN(pid) || pid <= 0 || !playerName) continue;

        const entryName = normalizeName(playerName);
        const entryNameNoSuffix = stripSuffixes(entryName);

        // Try exact match first
        if (entryName === searchName) {
          return pid;
        }

        // Try suffix-stripped match
        if (entryNameNoSuffix === searchNameNoSuffix) {
          return pid;
        }

        // Try reversed name format (Last First vs First Last)
        const reversedSearch = normalizeName(`${lastName} ${firstName}`);
        const reversedSearchNoSuffix = stripSuffixes(reversedSearch);

        if (entryName === reversedSearch || entryNameNoSuffix === reversedSearchNoSuffix) {
          return pid;
        }
      }

      return 0;
    } catch (error) {
      console.error(`[CreatorService] Error reading PID_Portrait_Mapping.csv:`, error);
      return 0;
    }
  }

  /**
   * NO LONGER NEEDED - ALL_PLAYER_LOOKUP.csv already has preferred PIDs (no (R) tags)
   * Kept as no-op for backward compatibility
   * @param pid Portrait ID
   * @param playerName Player name (unused)
   * @returns Original PID unchanged
   */
  private getPreferredPID(pid: number, playerName: string): number {
    // ALL_PLAYER_LOOKUP.csv already contains the preferred PIDs (non-(R) versions)
    // No need to check PID_lookup.csv anymore
    return pid;
  }

  /**
   * Assign appropriate generic face PID based on player characteristics
   * Uses race data from MASTER_LOOKUP if available, otherwise falls back to position-based probability
   *
   * Generic face categories:
   * - Category 1 (41 faces): Caucasian/White
   * - Category 2 (63 faces): African American/Black - Light
   * - Category 3 (38 faces): African American/Black - Dark
   * - Category 5 (94 faces): Hispanic/Latino
   * - Category 6 (98 faces): Mixed/Multi-Racial
   * - Category 7 (164 faces): African American/Black - Medium (default for most positions)
   *
   * @param firstName Player first name
   * @param lastName Player last name
   * @param position Player position
   * @param raceData Race string from MASTER_LOOKUP (if available)
   * @returns Generic face PID from PID_Portrait_Mapping.csv
   */
  private assignGenericFace(firstName: string, lastName: string, position?: string, raceData?: string): number {
    // Load PID portrait mapping - use app.getAppPath() for both dev and packaged
    const { app } = require('electron');
    const pidPortraitPath = path.join(app.getAppPath(), 'data', 'lookups', 'PID_Portrait_Mapping.csv');

    let targetCategory = 7; // Default to Black-Medium (largest pool)

    // Priority 1: Use race data from MASTER_LOOKUP if available
    if (raceData && raceData.trim()) {
      const mappedCategory = this.mapRaceToCategory(raceData);
      if (mappedCategory > 0) {
        targetCategory = mappedCategory;
        console.log(`[CreatorService] Using MASTER_LOOKUP race for "${firstName} ${lastName}": "${raceData}" -> Category ${targetCategory}`);
      }
    }
    // Priority 2: Look up race from ROSTER_lookup.csv
    else {
      const rosterRace = this.lookupPlayerRace(firstName, lastName);
      if (rosterRace) {
        const mappedCategory = this.mapRaceToCategory(rosterRace);
        if (mappedCategory > 0) {
          targetCategory = mappedCategory;
          console.log(`[CreatorService] Using ROSTER_lookup race for "${firstName} ${lastName}": "${rosterRace}" -> Category ${targetCategory}`);
        }
      }
    }

    // Priority 3: Fall back to position-based probability (if no race data found)
    if (targetCategory === 7 && !raceData && !this.lookupPlayerRace(firstName, lastName)) {
      // Simple heuristic: NFL is ~70% Black, ~25% White, ~5% other
      // Position-based distribution (rough NFL demographics):
      // - QB, K, P: More likely to be white (50%+ white)
      // - OL, TE: Mixed distribution
      // - Skill positions (WR, RB, CB, S): Predominantly Black (80%+)

      // Adjust based on position
      if (position) {
        const pos = position.toUpperCase();

        // Positions with higher white representation
        if (['QB', 'K', 'P', 'LS'].includes(pos)) {
          // 50/50 split between categories
          targetCategory = Math.random() < 0.5 ? 1 : 7;
        }
        // OL and TE - more mixed
        else if (['LT', 'LG', 'C', 'RG', 'RT', 'TE'].includes(pos)) {
          const rand = Math.random();
          if (rand < 0.4) targetCategory = 1; // 40% white
          else targetCategory = 7; // 60% black/mixed
        }
        // Skill positions - predominantly Black
        else if (['WR', 'HB', 'FB', 'CB', 'FS', 'SS', 'LOLB', 'MLB', 'ROLB', 'LE', 'RE', 'DT'].includes(pos)) {
          const rand = Math.random();
          if (rand < 0.7) targetCategory = 7; // 70% Black-Medium
          else if (rand < 0.85) targetCategory = 2; // 15% Black-Light
          else if (rand < 0.95) targetCategory = 3; // 10% Black-Dark
          else targetCategory = 6; // 5% Mixed
        }
      }
    }

    // Get random face from target category
    const categoryRanges: {[key: number]: {min: number, max: number, count: number}} = {
      1: {min: 1, max: 41, count: 41},
      2: {min: 1, max: 63, count: 63},
      3: {min: 1, max: 38, count: 38},
      5: {min: 1, max: 94, count: 94},
      6: {min: 2, max: 98, count: 98},
      7: {min: 1, max: 164, count: 164}
    };

    const range = categoryRanges[targetCategory];
    const faceNum = Math.floor(Math.random() * range.count) + range.min;

    // Now find a PID that maps to this generic face
    try {
      const csvContent = fs.readFileSync(pidPortraitPath, 'utf-8');
      const lines = csvContent.split('\n');

      const targetPortrait = `plpo_generic_${targetCategory}_${String(faceNum).padStart(3, '0')}`;

      // Find all PIDs that map to this portrait
      // CSV Format: PID,Player Name,Type,Portrait,PAM
      const matchingPIDs: number[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 4) continue;

        const pidStr = parts[0].trim();
        const portrait = parts[3].trim();  // Portrait is column 4 (index 3)

        if (portrait === targetPortrait) {
          const pid = parseInt(pidStr);
          if (!isNaN(pid)) {
            matchingPIDs.push(pid);
          }
        }
      }

      if (matchingPIDs.length > 0) {
        // Return random PID from matching ones
        const randomPID = matchingPIDs[Math.floor(Math.random() * matchingPIDs.length)];
        console.log(`[CreatorService] Assigned generic face: "${firstName} ${lastName}" (${position || 'unknown'}) -> PID ${randomPID} (${targetPortrait})`);
        return randomPID;
      }
    } catch (error) {
      console.error(`[CreatorService] Error loading generic face mapping:`, error);
      console.error(`[CreatorService]   Path attempted: ${pidPortraitPath}`);
    }

    // FALLBACK: Use hardcoded generic PIDs to ensure NEVER returns 0
    // These are known valid generic face PIDs from PID_Portrait_Mapping.csv
    const fallbackPIDs = {
      1: [2547, 2583, 2761, 2798, 2821], // White (Category 1) - actual generic faces
      7: [719, 721, 725, 2758, 2769, 2789]  // Black-Medium (Category 7) - actual generic faces
    };

    const fallbackCategory = targetCategory === 1 ? 1 : 7;
    const fallbackArray = fallbackPIDs[fallbackCategory];
    const fallbackPID = fallbackArray[Math.floor(Math.random() * fallbackArray.length)];

    console.warn(`[CreatorService] ⚠️ Failed to load PID mapping, using hardcoded fallback for "${firstName} ${lastName}" -> PID ${fallbackPID}`);
    return fallbackPID;
  }

  /**
   * Assign PAM/PEPS based on player's PID
   *
   * RESEARCH CONCLUSION: Generic face players should have BLANK PAM
   * The game uses the PID to look up the correct face automatically.
   * Only players with REAL face scans (player-format PAM) need explicit PAM values.
   *
   * @param pid Player Portrait ID
   * @param raceData Race string (unused - kept for API compatibility)
   * @returns Player-format PAM for real faces, NULL for generic faces
   */
  private assignGenericAsset(pid: number, raceData?: string): string | null {
    // For generic faces, return null - game uses PID lookup
    // Only return PAM for players with real face scans (player-format PAM in portrait mapping)

    try {
      const { app } = require('electron');
      const pidPortraitPath = path.join(app.getAppPath(), 'data', 'lookups', 'PID_Portrait_Mapping.csv');
      const csvContent = fs.readFileSync(pidPortraitPath, 'utf-8');
      const lines = csvContent.split('\n');

      // CSV Format: PID,Player Name,Type,Portrait,PAM
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 4) continue;

        const linePID = parseInt(parts[0].trim());
        if (linePID !== pid) continue;

        const playerName = parts[1].trim();
        const type = parts[2].trim();       // 'generic', 'legend', or 'player'
        const pam = parts.length >= 5 ? parts[4].trim() : '';

        // Only return PAM for real face scans (player-format, not gen_X_Y_Z format)
        if (pam && !pam.startsWith('gen_')) {
          console.log(`[CreatorService] Real face PAM for PID ${pid} (${playerName}): "${pam}"`);
          return pam;
        }

        // For generic/legend types or no PAM: return null (blank)
        // Game will use PID to look up the correct generic face
        console.log(`[CreatorService] Generic face for PID ${pid} (${playerName}): PAM=BLANK (game uses PID lookup)`);
        return null;
      }

      // PID not found in mapping - return null (blank)
      console.log(`[CreatorService] PID ${pid} not in portrait mapping: PAM=BLANK`);
      return null;

    } catch (error) {
      console.error('[CreatorService] Error looking up PID portrait mapping:', error);
      return null; // Return null on error - game will handle
    }
  }

  /**
   * Generate a valid Madden genericHeadName in format: gen_X_YY_ZZ_NNN
   * Based on patterns from working draft class files:
   * - gen_1_B_N_010, gen_7_B_G_005, gen_7_M_MB_009
   * @param race Race category (1-7)
   * @returns Valid genericHeadName string
   */
  private generateGenericHeadName(race: number): string {
    // Valid body codes observed in working files
    const bodyCodes = ['B', 'BM', 'BMH', 'H', 'M'];
    // Valid face codes observed in working files
    const faceCodes = ['B', 'BD', 'G', 'GM', 'MB', 'N', 'S', 'M'];

    // Select random body and face codes
    const bodyCode = bodyCodes[Math.floor(Math.random() * bodyCodes.length)];
    const faceCode = faceCodes[Math.floor(Math.random() * faceCodes.length)];

    // Generate number (01-20 range, some use 001-015)
    const useThreeDigit = Math.random() < 0.5;
    const maxNum = useThreeDigit ? 15 : 20;
    const num = Math.floor(Math.random() * maxNum) + 1;
    const numStr = useThreeDigit ? String(num).padStart(3, '0') : String(num).padStart(2, '0');

    const genericHeadName = `gen_${race}_${bodyCode}_${faceCode}_${numStr}`;
    return genericHeadName;
  }

  /**
   * Map race value from ROSTER_lookup or MASTER_LOOKUP to generic face category
   * Handles both numeric values (from ROSTER_lookup) and string values (from MASTER_LOOKUP)
   *
   * ROSTER_lookup numeric values:
   *   1 = Caucasian (Category 1) - ~30k players
   *   2 = African American Medium (Category 7) - ~41k players (largest group)
   *   3 = African American Light (Category 2) - ~14k players
   *   4 = African American Dark (Category 3) - ~278 players
   *   5 = Hispanic/Latino (Category 5) - ~510 players
   *   6 = Mixed/Multi-Racial (Category 6) - ~8.5k players
   *   7 = Asian (Category 6/Mixed) - ~486 players
   *
   * Returns category number (1-7) for generic face assignment, or 0 if unknown
   */
  private mapRaceToCategory(raceValue: string): number {
    if (!raceValue || !raceValue.trim()) return 0;

    const trimmed = raceValue.trim();

    // First check if it's a numeric value (from ROSTER_lookup)
    const numericValue = parseInt(trimmed);
    if (!isNaN(numericValue)) {
      // Map ROSTER_lookup numeric race codes to generic face categories
      switch (numericValue) {
        case 1: return 1;  // Caucasian -> Category 1
        case 2: return 7;  // African American Medium -> Category 7
        case 3: return 2;  // African American Light -> Category 2
        case 4: return 3;  // African American Dark -> Category 3
        case 5: return 5;  // Hispanic/Latino -> Category 5
        case 6: return 6;  // Mixed/Multi-Racial -> Category 6
        case 7: return 6;  // Asian -> Category 6 (closest match)
        default:
          // Handle values 10-55 (variant faces within categories)
          // These are sub-variations, map to main category
          if (numericValue >= 10 && numericValue < 20) return 1;  // Caucasian variants
          if (numericValue >= 20 && numericValue < 30) return 7;  // AA Medium variants
          if (numericValue >= 30 && numericValue < 40) return 2;  // AA Light variants
          if (numericValue >= 40 && numericValue < 50) return 3;  // AA Dark variants
          if (numericValue >= 50 && numericValue < 60) return 5;  // Hispanic variants
          return 7; // Default to Black-Medium (largest pool)
      }
    }

    // Handle string values (from MASTER_LOOKUP)
    const normalized = trimmed.toLowerCase();

    // African American/Black variations
    if (normalized.includes('african dark') || normalized.includes('black dark')) {
      return 3; // Category 3: African American Dark
    }
    if (normalized.includes('african light') || normalized.includes('black light')) {
      return 2; // Category 2: African American Light
    }
    if (normalized.includes('african') || normalized.includes('black')) {
      return 7; // Category 7: African American Medium (default)
    }

    // Caucasian/White
    if (normalized.includes('caucasian') || normalized.includes('white')) {
      return 1; // Category 1: Caucasian
    }

    // Hispanic/Latino
    if (normalized.includes('hispanic') || normalized.includes('latino')) {
      return 5; // Category 5: Hispanic/Latino
    }

    // Mixed/Multi-Racial
    if (normalized.includes('mixed') || normalized.includes('multi') || normalized.includes('biracial')) {
      return 6; // Category 6: Mixed/Multi-Racial
    }

    // Asian/Pacific Islander (map to Mixed as closest match)
    if (normalized.includes('asian') || normalized.includes('pacific')) {
      return 6; // Category 6: Mixed
    }

    // Light/Dark skin tone variations
    if (normalized === 'light') return 2;  // African American Light
    if (normalized === 'dark') return 3;   // African American Dark

    return 0; // Unknown race
  }

  /**
   * Cache for race data from ROSTER_lookup.csv
   * Key: "firstname_lastname" (lowercase), Value: race code (string)
   */
  private rosterRaceCache?: Map<string, string>;

  /**
   * Load race data from ROSTER_lookup.csv for race-based generic face/PAM assignment
   * ROSTER_lookup has ~100k player entries with actual Madden race codes
   */
  private loadRosterRaceData(): Map<string, string> {
    if (this.rosterRaceCache) {
      return this.rosterRaceCache;
    }

    this.rosterRaceCache = new Map<string, string>();

    try {
      const { app } = require('electron');
      // Use app.getAppPath() for both dev and packaged builds
      const rosterPath = path.join(app.getAppPath(), 'data', 'lookups', 'ROSTER_lookup.csv');

      const csvContent = fs.readFileSync(rosterPath, 'utf-8');
      const lines = csvContent.split('\n');

      // Parse header to find column indices
      const header = lines[0].split(',').map(h => h.trim());
      const firstNameIdx = header.indexOf('First_Name');
      const lastNameIdx = header.indexOf('Last_Name');
      const raceIdx = header.indexOf('Race');
      const pamIdx = header.indexOf('PAM');

      if (firstNameIdx === -1 || lastNameIdx === -1 || raceIdx === -1) {
        console.error('[CreatorService] ROSTER_lookup.csv missing required columns');
        return this.rosterRaceCache;
      }

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');
        if (values.length <= Math.max(firstNameIdx, lastNameIdx, raceIdx)) continue;

        const firstName = (values[firstNameIdx] || '').trim().toLowerCase();
        const lastName = (values[lastNameIdx] || '').trim().toLowerCase();
        const race = (values[raceIdx] || '').trim();
        const pam = pamIdx >= 0 ? (values[pamIdx] || '').trim() : '';

        if (firstName && lastName && race) {
          const key = `${firstName}_${lastName}`;
          // Store race (and optionally PAM for future use)
          if (!this.rosterRaceCache.has(key)) {
            this.rosterRaceCache.set(key, race);
          }
        }
      }

      console.log(`[CreatorService] Loaded ${this.rosterRaceCache.size} player race entries from ROSTER_lookup.csv`);
    } catch (error) {
      console.error('[CreatorService] Error loading ROSTER_lookup.csv race data:', error);
    }

    return this.rosterRaceCache;
  }

  /**
   * Look up a player's race from ROSTER_lookup.csv
   * @param firstName Player first name
   * @param lastName Player last name
   * @returns Race code string (numeric like "1", "2", etc.) or undefined if not found
   */
  private lookupPlayerRace(firstName: string, lastName: string): string | undefined {
    const raceData = this.loadRosterRaceData();
    const key = `${firstName.toLowerCase().trim()}_${lastName.toLowerCase().trim()}`;
    return raceData.get(key);
  }

  /**
   * Load ALL_PLAYER_LOOKUP.csv into memory (REPLACES ALL other lookups)
   * Format: Last Name,First Name,College/Univ,Round,Pick,Draft Class,Position,PhotoID,Player Assets ID,CommID,PLPO,Height,Weight,From,To,AP1,PB,St,wAV,League,Race,Home State,Wiki_Image_URL,PFR_Image_URL
   * 26,034 players vs 14,879 in FullData_Lookup (76% more!)
   */
  private masterLookupCache?: Map<string, any>;

  private loadMasterLookup(): Map<string, any> {
    if (this.masterLookupCache) {
      return this.masterLookupCache;
    }

    this.masterLookupCache = new Map<string, any>();

    try {
      // Use app.getAppPath() for correct path resolution in both dev and packaged builds
      const { app } = require('electron');
      const Papa = require('papaparse');

      const masterLookupPath = path.join(app.getAppPath(), 'data', 'lookups', 'ALL_PLAYER_LOOKUP.csv');
      console.log(`[CreatorService] Loading MASTER_LOOKUP from: ${masterLookupPath}`);

      if (!fs.existsSync(masterLookupPath)) {
        console.error(`[CreatorService] ALL_PLAYER_LOOKUP.csv NOT FOUND at ${masterLookupPath}`);
        return this.masterLookupCache;
      }

      const csvContent = fs.readFileSync(masterLookupPath, 'utf-8');

      // Use Papa Parse for robust CSV parsing (handles quoted fields, commas, etc.)
      const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

      console.log(`[CreatorService] Papa Parse found ${parsed.data.length} rows in ALL_PLAYER_LOOKUP.csv`);

      // Strip pro-football-reference disambiguation markers (e.g., ‡1, †2) from names
      const stripMarkers = (name: string): string => {
        return name.toLowerCase().replace(/[‡†*]+\d*/g, '').trim();
      };

      for (const entry of parsed.data as any[]) {
        const firstName = entry['First Name'] || '';
        const lastName = entry['Last Name'] || '';
        const draftClass = entry['Draft Class'] || '';

        if (firstName && lastName && draftClass) {
          const key = `${stripMarkers(firstName)} ${stripMarkers(lastName)} ${draftClass}`;
          this.masterLookupCache.set(key, entry);
        }
      }

      console.log(`[CreatorService] Loaded ${this.masterLookupCache.size} players into MASTER_LOOKUP cache`);

      // Debug: Check if Staubach is in the cache
      const staubachKey = 'roger staubach 1964';
      if (this.masterLookupCache.has(staubachKey)) {
        const staubach = this.masterLookupCache.get(staubachKey);
        console.log(`[CreatorService] ✅ Staubach found in cache: PhotoID=${staubach['PhotoID']}, From=${staubach['From']}, To=${staubach['To']}`);
      } else {
        console.error(`[CreatorService] ❌ Staubach NOT found in cache with key "${staubachKey}"`);
      }
    } catch (error) {
      console.error('[CreatorService] Failed to load ALL_PLAYER_LOOKUP.csv:', error);
    }

    return this.masterLookupCache;
  }

  /**
   * Load Future Draft Lookup CSV into memory for draft class generation (2026+)
   * Cache for fast repeat access
   * Format: Last Name,First Name,College,Rank,Draft Class,Position,Jersey,Height,Weight,2025 College Year,Awards,Star Rating,Hometown,Homestate,Race,Photo
   */
  private futureDraftLookupCache?: Map<string, any>;

  private loadFutureDraftLookup(): Map<string, any> {
    if (this.futureDraftLookupCache) {
      return this.futureDraftLookupCache;
    }

    this.futureDraftLookupCache = new Map<string, any>();

    try {
      const { app } = require('electron');
      const futureDraftLookupPath = path.join(app.getAppPath(), 'data', 'lookups', 'FutureDraft_Lookup.csv');
      const csvContent = fs.readFileSync(futureDraftLookupPath, 'utf-8');
      const lines = csvContent.split('\n');

      // Parse header
      const header = lines[0].split(',').map(h => h.trim());

      // Parse rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV with potential commas in quoted fields
        const values = this.parseCSVLine(line);
        if (values.length < header.length) continue;

        const entry: any = {};
        for (let j = 0; j < header.length; j++) {
          entry[header[j]] = values[j]?.trim() || '';
        }

        // Create composite key: "firstname lastname draftclass"
        // Strip pro-football-reference disambiguation markers (e.g., ‡1, †2) from names
        const stripMarkers = (name: string): string => {
          return name.toLowerCase().replace(/[‡†*]+\d*/g, '').trim();
        };

        const firstName = entry['First Name'] || '';
        const lastName = entry['Last Name'] || '';
        const draftClass = entry['Draft Class'] || '';
        const key = `${stripMarkers(firstName)} ${stripMarkers(lastName)} ${draftClass}`;

        this.futureDraftLookupCache.set(key, entry);
      }

      console.log(`[CreatorService] Loaded ${this.futureDraftLookupCache.size} players from FutureDraft_Lookup.csv`);
    } catch (error) {
      console.error('[CreatorService] Failed to load FutureDraft_Lookup.csv:', error);
    }

    return this.futureDraftLookupCache;
  }

  /**
   * Parse CSV line handling quoted fields with commas
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current); // Add last field
    return result;
  }

  /**
   * Calculate pro-rated wAV for a player at a specific point in their career
   * Used for roster generation to avoid rating rookies as GOATs based on full career stats
   * @param careerWAV - Full career wAV from MASTER_LOOKUP
   * @param totalYears - Total years played in career (To - From + 1)
   * @param yearsPlayed - Years played so far (roster_year - From + 1)
   * @returns Pro-rated wAV for current season
   */
  private calculateProRatedWAV(
    careerWAV: number,
    totalYears: number,
    yearsPlayed: number
  ): number {
    if (totalYears === 0 || yearsPlayed === 0 || careerWAV === 0) {
      return 0;
    }

    const wAVPerYear = careerWAV / totalYears;
    const proRatedWAV = wAVPerYear * yearsPlayed;

    console.log(`[CreatorService] Pro-rated wAV: ${careerWAV} / ${totalYears} years = ${wAVPerYear.toFixed(2)} per year * ${yearsPlayed} years = ${proRatedWAV.toFixed(2)}`);

    return proRatedWAV;
  }

  /**
   * Find player in MASTER_LOOKUP by name and year range
   * For roster generation, we need to find players who were active in a specific year
   * @param firstName - Player's first name
   * @param lastName - Player's last name
   * @param rosterYear - Year of the roster we're generating
   * @returns MASTER_LOOKUP entry or null if not found
   */
  private findPlayerInMASTERLookup(
    firstName: string,
    lastName: string,
    rosterYear: number
  ): any | null {
    const masterLookup = this.loadMasterLookup();

    // DEBUG: Check cache status
    console.log(`[findPlayerInMASTERLookup] Cache size: ${masterLookup.size} entries`);

    // Helper to strip pro-football-reference disambiguation markers (e.g., ‡1, †2)
    const stripMarkers = (name: string): string => {
      return name.toLowerCase().trim().replace(/[‡†*]+\d*/g, '');
    };

    // Helper to strip name suffixes (Jr., Sr., II, III, IV, V)
    // This is critical for matching scraped names like "Patrick Mahomes II" to CSV "Patrick Mahomes"
    const stripSuffixes = (name: string): string => {
      return name.replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, '').trim();
    };

    // Helper to normalize initials (T.J. -> tj, J.J. -> jj)
    const normalizeInitials = (name: string): string => {
      return name.replace(/\./g, '');
    };

    // Combined normalization: lowercase, strip markers, strip suffixes, normalize initials
    // Handles: "T.J. Watt" vs "TJ Watt", "Patrick Mahomes II" vs "Patrick Mahomes"
    const normalizeName = (name: string): string => {
      return normalizeInitials(stripSuffixes(stripMarkers(name)));
    };

    // Normalize names (now handles both markers AND suffixes)
    const normalizedFirst = normalizeName(firstName);
    const normalizedLast = normalizeName(lastName);

    console.log(`[findPlayerInMASTERLookup v2] Looking for: "${normalizedFirst}" "${normalizedLast}" in year ${rosterYear} (normalization: suffixes+initials)`);

    // DEBUG: Specific check for Staubach
    if (normalizedLast === 'staubach') {
      console.log(`[findPlayerInMASTERLookup] STAUBACH DEBUG: Iterating through ${masterLookup.size} entries...`);
      let staubachFound = false;
      for (const [key, entry] of masterLookup.entries()) {
        if (normalizeName(entry['Last Name'] || '') === 'staubach') {
          console.log(`[findPlayerInMASTERLookup] STAUBACH ENTRY: key="${key}", First="${entry['First Name']}", Last="${entry['Last Name']}", From=${entry['From']}, To=${entry['To']}, PhotoID=${entry['PhotoID']}`);
          staubachFound = true;
        }
      }
      if (!staubachFound) {
        console.log(`[findPlayerInMASTERLookup] STAUBACH NOT IN CACHE AT ALL!`);
      }
    }

    // Search through all entries
    for (const [key, entry] of masterLookup.entries()) {
      const entryFirst = normalizeName(entry['First Name'] || '');
      const entryLast = normalizeName(entry['Last Name'] || '');

      // Name must match (now handles suffixes like Jr., II, III)
      if (entryFirst !== normalizedFirst || entryLast !== normalizedLast) {
        continue;
      }

      // DEBUG: Name matched - log what we found
      console.log(`[findPlayerInMASTERLookup] NAME MATCH: ${entryFirst} ${entryLast} - checking year range...`);

      // Check if player was active in this year
      const from = parseInt(entry['From']) || 0;
      const to = parseInt(entry['To']) || 0;
      const draftClass = parseInt(entry['Draft Class']) || 0;

      console.log(`[findPlayerInMASTERLookup] Year data: From=${entry['From']} (parsed: ${from}), To=${entry['To']} (parsed: ${to}), DraftClass=${entry['Draft Class']}, RosterYear=${rosterYear}`);

      // PRIORITY 1: If From/To are available and roster year is in range - EXACT MATCH
      if (from > 0 && to > 0) {
        console.log(`[findPlayerInMASTERLookup] Checking: ${rosterYear} >= ${from} && ${rosterYear} <= ${to} = ${rosterYear >= from && rosterYear <= to}`);
        if (rosterYear >= from && rosterYear <= to) {
          console.log(`[CreatorService] ✅ Found ${firstName} ${lastName} in MASTER_LOOKUP (active ${from}-${to}, roster year ${rosterYear})`);
          return entry;
        }
        // If From/To exist but year is out of range, skip this entry (wrong player with same name)
        console.log(`[findPlayerInMASTERLookup] Year ${rosterYear} NOT in range ${from}-${to}, continuing search...`);
        continue;
      }

      // PRIORITY 2: If only draft year available, check if within reasonable range (career length)
      if (draftClass > 0) {
        const careerLength = rosterYear - draftClass;
        // Most careers are 3-15 years, but allow up to 25 years for long careers
        if (careerLength >= 0 && careerLength <= 25) {
          console.log(`[CreatorService] ✅ Found ${firstName} ${lastName} in MASTER_LOOKUP (drafted ${draftClass}, ${careerLength} years into career)`);
          return entry;
        }
        // If career length is unreasonable, skip (wrong player with same name)
        continue;
      }

      // PRIORITY 3: No year data at all - match by name only (risky but better than nothing)
      console.log(`[CreatorService] ⚠️ Found ${firstName} ${lastName} in MASTER_LOOKUP (no year data, matching by name only)`);
      return entry;
    }

    console.log(`[CreatorService] ❌ Player ${firstName} ${lastName} not found in MASTER_LOOKUP for year ${rosterYear}`);
    return null;
  }

  /**
   * Generate UFA/UDFA free agents from MASTER_LOOKUP
   * Looks for players from last 5 years marked "UD" (undrafted) in Round column
   * Excludes players already on rosters
   * @param year - Current roster year
   * @param existingPlayerNames - Set of player names already on team rosters
   * @param count - Number of UFAs to generate
   * @returns Array of UFA player entries from MASTER_LOOKUP
   */
  private generateUFAsFromLookup(
    year: number,
    existingPlayerNames: Set<string>,
    count: number
  ): any[] {
    console.log(`[CreatorService] Generating ${count} UFAs from last 5 years (${year - 5} to ${year - 1})`);

    const masterLookup = this.loadMasterLookup();
    const ufaCandidates: any[] = [];

    // Find all undrafted players from last 5 years who aren't already on rosters
    for (const [key, entry] of masterLookup.entries()) {
      const round = (entry['Round'] || '').toString().toUpperCase();
      const draftClass = parseInt(entry['Draft Class']) || 0;

      // Check if undrafted AND drafted in last 5 years
      if (round === 'UD' && draftClass >= (year - 5) && draftClass < year) {
        const fullName = `${entry['First Name']} ${entry['Last Name']}`;

        // Skip if already on a roster
        if (!existingPlayerNames.has(fullName)) {
          ufaCandidates.push(entry);
        }
      }
    }

    console.log(`[CreatorService] Found ${ufaCandidates.length} UFA candidates`);

    // Return random sample of UFAs up to count
    const selectedUFAs: any[] = [];
    const shuffled = ufaCandidates.sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      selectedUFAs.push(shuffled[i]);
    }

    console.log(`[CreatorService] Selected ${selectedUFAs.length} UFAs for free agent pool`);
    return selectedUFAs;
  }

  /**
   * DEPRECATED: Load FullData lookup CSV into memory
   * REPLACED BY: loadMasterLookup() which has 76% more players
   * Kept for backwards compatibility
   */
  private fullDataLookupCache?: Map<number, any>;

  private loadFullDataLookup(): Map<number, any> {
    if (this.fullDataLookupCache) {
      return this.fullDataLookupCache;
    }

    // Forward to MASTER_LOOKUP and convert to old format
    console.warn('[CreatorService] FullData_Lookup is deprecated, using ALL_PLAYER_LOOKUP instead');
    this.fullDataLookupCache = new Map<number, any>();

    const masterLookup = this.loadMasterLookup();

    masterLookup.forEach((entry, key) => {
      const pid = parseInt(entry['PhotoID']);
      if (!isNaN(pid) && pid > 0) {
        this.fullDataLookupCache!.set(pid, {
          lastName: entry['Last Name'],
          firstName: entry['First Name'],
          college: entry['College/Univ'],
          round: entry['Round'],
          pick: entry['Pick'],
          draftClass: entry['Draft Class'],
          position: entry['Position'],
          pid: pid,
          pam: entry['Player Assets ID'],
          plpo: entry['PLPO']
        });
      }
    });

    console.log(`[CreatorService] Converted ${this.fullDataLookupCache.size} entries from MASTER_LOOKUP`);
    return this.fullDataLookupCache;
  }

  /**
   * Load college lookup CSV into memory
   * Format: CollegeID,CollegeName
   */
  private loadCollegeLookup(): Map<string, number> {
    if (this.collegeLookupCache) {
      return this.collegeLookupCache;
    }

    this.collegeLookupCache = new Map<string, number>();

    try {
      const { app } = require('electron');
      const collegeLookupPath = path.join(app.getAppPath(), 'data', 'lookups', 'college_lookup.csv');
      const csvContent = fs.readFileSync(collegeLookupPath, 'utf-8');
      const lines = csvContent.split('\n');

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [collegeIdStr, collegeName] = line.split(',');
        const collegeId = parseInt(collegeIdStr);

        if (!isNaN(collegeId) && collegeName) {
          // Normalize college name: lowercase, remove special chars
          const normalizedName = collegeName.trim().toLowerCase().replace(/[^a-z\s]/g, '');
          this.collegeLookupCache.set(normalizedName, collegeId);
        }
      }

      console.log(`[CreatorService] Loaded ${this.collegeLookupCache.size} colleges from college_lookup.csv`);
    } catch (error) {
      console.warn('[CreatorService] Failed to load college_lookup.csv:', error);
    }

    return this.collegeLookupCache;
  }

  /**
   * Match college name to college ID from lookup table
   * Uses fuzzy matching to find closest match
   * Returns college ID as NUMBER (e.g., 4 for Alabama, 265 for No College)
   */
  private matchCollege(scrapedCollegeName: string): number {
    // Default to "No College" (ID 265) if no name provided
    if (!scrapedCollegeName || scrapedCollegeName === 'Unknown') {
      return 265; // No College
    }

    const collegeLookup = this.loadCollegeLookup();

    // Normalize the original name (before expansion)
    const normalizedOriginal = scrapedCollegeName.toLowerCase().replace(/[^a-z\s]/g, '').trim();

    // Try exact match with original name first (e.g., "lsu" matches "lsu")
    for (const [collegeName, collegeId] of collegeLookup.entries()) {
      if (collegeName === normalizedOriginal) {
        console.log(`[CreatorService] Exact college match (original): "${scrapedCollegeName}" -> ID ${collegeId}`);
        return collegeId; // Return the ID as number
      }
    }

    // Expand common abbreviations for additional matching attempts
    const expandedName = this.expandCollegeAbbreviations(scrapedCollegeName);
    const normalizedExpanded = expandedName.toLowerCase().replace(/[^a-z\s]/g, '').trim();

    // Try exact match with expanded name (e.g., "louisiana state" matches "louisiana state")
    for (const [collegeName, collegeId] of collegeLookup.entries()) {
      if (collegeName === normalizedExpanded) {
        console.log(`[CreatorService] Exact college match (expanded): "${scrapedCollegeName}" -> "${expandedName}" -> ID ${collegeId}`);
        return collegeId;
      }
    }

    // Try partial matches with both original and expanded names
    for (const [collegeName, collegeId] of collegeLookup.entries()) {
      // Check if scraped name is contained in lookup name or vice versa
      if (collegeName.includes(normalizedOriginal) || normalizedOriginal.includes(collegeName)) {
        console.log(`[CreatorService] Partial college match (original): "${scrapedCollegeName}" -> "${collegeName}" -> ID ${collegeId}`);
        return collegeId;
      }
      if (collegeName.includes(normalizedExpanded) || normalizedExpanded.includes(collegeName)) {
        console.log(`[CreatorService] Partial college match (expanded): "${scrapedCollegeName}" -> "${expandedName}" -> "${collegeName}" -> ID ${collegeId}`);
        return collegeId;
      }
    }

    // Try matching key words from expanded name (e.g. "University of Alabama" -> "Alabama")
    // But prefer shorter/exact matches to avoid false positives (e.g., "LSU" shouldn't match "SE Louisiana")
    const words = normalizedExpanded.split(/\s+/).filter(w => w.length > 3); // Filter out short words like "of", "the"
    const keywordMatches: Array<{name: string, id: number, length: number}> = [];

    for (const word of words) {
      for (const [collegeName, collegeId] of collegeLookup.entries()) {
        if (collegeName.includes(word)) {
          keywordMatches.push({ name: collegeName, id: collegeId, length: collegeName.length });
        }
      }
    }

    // If we found keyword matches, prefer the shortest one (most specific)
    if (keywordMatches.length > 0) {
      keywordMatches.sort((a, b) => a.length - b.length);
      const bestMatch = keywordMatches[0];
      console.log(`[CreatorService] Keyword college match: "${scrapedCollegeName}" -> "${expandedName}" -> "${bestMatch.name}" -> ID ${bestMatch.id} (chose shortest of ${keywordMatches.length} matches)`);
      return bestMatch.id;
    }

    // No match found - return "No College" (ID 265)
    console.warn(`[CreatorService] No college match found for "${scrapedCollegeName}" (expanded: "${expandedName}") - defaulting to No College (265)`);
    return 265; // No College
  }

  /**
   * Expand common college abbreviations to full names
   * E.g., "Florida St." -> "Florida State", "Ohio St." -> "Ohio State"
   */
  private expandCollegeAbbreviations(collegeName: string | undefined | null): string {
    if (!collegeName) {
      return ''; // Return empty string if undefined/null
    }

    // Common abbreviation mappings
    const abbreviations: { [key: string]: string } = {
      // Common school abbreviations
      '^fsu$': 'florida state',
      '^osu$': 'ohio state',
      '^bucks$': 'ohio state',
      '^usc$': 'southern california',
      // '^lsu$': 'louisiana state',  // Removed - LSU is already in college_lookup.csv, expansion causes false match to SE Louisiana
      '^tcu$': 'texas christian',
      '^smu$': 'southern methodist',
      '^byu$': 'brigham young',
      '^ucf$': 'central florida',
      '^usc$': 'south carolina',
      // State typo fixes
      'virgina': 'virginia',
      'pensylvania': 'pennsylvania',
      'missippi': 'mississippi',
      // General abbreviations
      'st\\.': 'state',
      'st ': 'state ',
      'univ\\.': 'university',
      'u\\.': 'university',
      'tech\\.': 'technology',
      'int\'l': 'international',
      'intl': 'international',
      'n\\.': 'north',
      's\\.': 'south',
      'e\\.': 'east',
      'w\\.': 'west',
      'mt\\.': 'mount',
      'ala\\.': 'alabama',
      'ariz\\.': 'arizona',
      'ark\\.': 'arkansas',
      'calif\\.': 'california',
      'colo\\.': 'colorado',
      'conn\\.': 'connecticut',
      'fla\\.': 'florida',
      'ga\\.': 'georgia',
      'ill\\.': 'illinois',
      'ind\\.': 'indiana',
      'kans\\.': 'kansas',
      'ky\\.': 'kentucky',
      'la\\.': 'louisiana',
      'mass\\.': 'massachusetts',
      'mich\\.': 'michigan',
      'minn\\.': 'minnesota',
      'miss\\.': 'mississippi',
      'mo\\.': 'missouri',
      'nebr\\.': 'nebraska',
      'nev\\.': 'nevada',
      'okla\\.': 'oklahoma',
      'ore\\.': 'oregon',
      'pa\\.': 'pennsylvania',
      'tenn\\.': 'tennessee',
      'tex\\.': 'texas',
      'va\\.': 'virginia',
      'wash\\.': 'washington',
      'wis\\.': 'wisconsin',
      'wyo\\.': 'wyoming'
    };

    let expanded = collegeName.toLowerCase();

    // Apply each abbreviation replacement
    for (const [abbr, full] of Object.entries(abbreviations)) {
      const regex = new RegExp(abbr, 'gi');
      expanded = expanded.replace(regex, full);
    }

    return expanded;
  }

  /**
   * Load state lookup CSV into memory
   * Format: PHSN,StateName (where PHSN is the state ID)
   */
  private loadStateLookup(): Map<string, number> {
    if (this.stateLookupCache) {
      return this.stateLookupCache;
    }

    this.stateLookupCache = new Map<string, number>();

    try {
      const { app } = require('electron');
      const stateLookupPath = path.join(app.getAppPath(), 'data', 'lookups', 'state_lookup.csv');
      const csvContent = fs.readFileSync(stateLookupPath, 'utf-8');
      const lines = csvContent.split('\n');

      // Parse CSV: PHSN,StateName
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [stateIdStr, stateName] = line.split(',');
        const stateId = parseInt(stateIdStr);

        if (!isNaN(stateId) && stateName) {
          // Map both full name and abbreviation
          const fullName = stateName.trim();

          // Create a map of state name -> abbreviation for common conversions
          const stateAbbreviations: { [key: string]: string } = {
            'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
            'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
            'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
            'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
            'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
            'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
            'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
            'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
            'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
            'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
            'Non-US': 'XX'
          };

          const abbr = stateAbbreviations[fullName];
          if (abbr) {
            this.stateLookupCache.set(abbr, stateId);
          }

          // Also store by full name (lowercase)
          this.stateLookupCache.set(fullName.toLowerCase(), stateId);
        }
      }

      console.log(`[CreatorService] Loaded ${this.stateLookupCache.size} state mappings from state_lookup.csv`);
    } catch (error) {
      console.warn('[CreatorService] Failed to load state_lookup.csv:', error);
    }

    return this.stateLookupCache;
  }

  /**
   * Match state abbreviation or name to state ID from lookup table
   * Returns state ID as NUMBER (e.g., 0 for Alabama, 4 for California)
   * Handles formats: "Iowa", "IA", "Ames, Iowa"
   */
  private matchHomeState(stateAbbr: string): number {
    if (!stateAbbr) {
      return 0; // Default to Alabama (ID 0) if no state provided
    }

    const stateLookup = this.loadStateLookup();
    let stateToMatch = stateAbbr.trim();

    // Handle "City, State" format (e.g., "Ames, Iowa")
    if (stateToMatch.includes(',')) {
      const parts = stateToMatch.split(',');
      stateToMatch = parts[parts.length - 1].trim(); // Take the last part (state)
    }

    // Try to match state abbreviation (e.g., "CA" -> 4, "IA" -> 14)
    // Abbreviations are stored in UPPERCASE in the map
    const upperName = stateToMatch.toUpperCase().trim();
    if (stateLookup.has(upperName)) {
      const stateId = stateLookup.get(upperName)!;
      console.log(`[CreatorService] State match (abbr): "${stateAbbr}" -> "${stateToMatch}" -> ID ${stateId}`);
      return stateId;
    }

    // Try to match full state name (e.g., "iowa" -> 14, "california" -> 4)
    // Full names are stored in lowercase in the map
    const lowerName = stateToMatch.toLowerCase();
    if (stateLookup.has(lowerName)) {
      const stateId = stateLookup.get(lowerName)!;
      console.log(`[CreatorService] State match (full name): "${stateAbbr}" -> "${stateToMatch}" -> ID ${stateId}`);
      return stateId;
    }

    // No match - default to Alabama (ID 0)
    console.warn(`[CreatorService] No state match found for "${stateAbbr}" - defaulting to Alabama (0)`);
    return 0; // Alabama
  }

  /**
   * Map scraped position to Madden 26 position
   * Returns both position name and code
   */
  private mapPosition(scrapedPosition: string): { name: string; code: number} {
    const pos = scrapedPosition.toUpperCase();

    // Position mapping: scraped position -> M26 position
    const positionMap: { [key: string]: { name: string; code: number } } = {
      // Offense
      'QB': { name: 'QB', code: 0 },
      'RB': { name: 'HB', code: 1 },
      'HB': { name: 'HB', code: 1 },
      'FB': { name: 'FB', code: 2 },
      'WR': { name: 'WR', code: 3 },
      'TE': { name: 'TE', code: 4 },

      // Offensive Line
      'LT': { name: 'LT', code: 5 },
      'T': { name: 'LT', code: 5 }, // Default tackles to LT
      'OT': { name: 'LT', code: 5 },
      'LG': { name: 'LG', code: 6 },
      'G': { name: 'LG', code: 6 }, // Default guards to LG
      'OG': { name: 'LG', code: 6 },
      'C': { name: 'C', code: 7 },
      'RG': { name: 'RG', code: 8 },
      'RT': { name: 'RT', code: 9 },

      // Defensive Line
      'DE': { name: 'LEDG', code: 10 }, // Default DEs to LEDG
      'LE': { name: 'LEDG', code: 10 },
      'LDE': { name: 'LEDG', code: 10 },
      'LEDG': { name: 'LEDG', code: 10 },
      'RE': { name: 'REDG', code: 11 },
      'RDE': { name: 'REDG', code: 11 },
      'REDG': { name: 'REDG', code: 11 },
      'DT': { name: 'DT', code: 12 },
      'LDT': { name: 'DT', code: 12 },
      'RDT': { name: 'DT', code: 12 },
      'NT': { name: 'DT', code: 12 }, // Nose tackles as DT

      // Linebackers
      'LB': { name: 'SAM', code: 13 }, // Default LBs to SAM
      'OLB': { name: 'SAM', code: 13 },
      'LOLB': { name: 'SAM', code: 13 },
      'ROLB': { name: 'SAM', code: 13 },
      'SAM': { name: 'SAM', code: 13 },
      'MLB': { name: 'Mike', code: 14 },
      'ILB': { name: 'Mike', code: 14 },
      'LILB': { name: 'Mike', code: 14 },
      'RILB': { name: 'Mike', code: 14 },
      'Mike': { name: 'Mike', code: 14 },
      'WILL': { name: 'WILL', code: 15 },

      // Secondary
      'CB': { name: 'CB', code: 16 },
      'RCB': { name: 'CB', code: 16 }, // Right cornerback
      'LCB': { name: 'CB', code: 16 }, // Left cornerback
      'FS': { name: 'FS', code: 17 },
      'SS': { name: 'SS', code: 18 },
      'S': { name: 'FS', code: 17 }, // Default safeties to FS
      'DB': { name: 'CB', code: 16 }, // Default DBs to CB

      // Special Teams
      'K': { name: 'K', code: 19 },
      'P': { name: 'P', code: 20 },
      'LS': { name: 'LS', code: 21 }
    };

    return positionMap[pos] || { name: 'HB', code: 1 }; // Default to HB if unknown
  }

  /**
   * Map historical position to modern Madden position
   * Uses year, position code, and player attributes to determine best fit
   * Handles early football positions (1936-1989) that need special mapping
   * @param historicalPosition - Position from draft data (e.g., "B", "E", "T")
   * @param year - Draft year (determines era)
   * @param weight - Player weight (helps disambiguate)
   * @param height - Player height (helps with position fit)
   * @returns Modern position name and code
   */
  private mapHistoricalPosition(
    historicalPosition: string,
    year: number,
    weight?: number,
    height?: number
  ): { name: string; code: number } {

    // Modern positions (1990+) - use existing mapPosition
    if (year >= 1990) {
      return this.mapPosition(historicalPosition);
    }

    const pos = historicalPosition.toUpperCase().trim();

    // Era 1: Early Football (1936-1949)
    if (year >= 1936 && year < 1950) {
      switch (pos) {
        case 'B':
          // Weight-based logic for generic "Back"
          if (weight) {
            if (weight < 200) return { name: 'HB', code: 1 };      // Speedy back
            if (weight < 215) return { name: 'QB', code: 0 };      // Average QB size
            return { name: 'FB', code: 2 };                         // Bigger back
          }
          return { name: 'HB', code: 1 }; // Default to HB

        case 'BB':
          return { name: 'FB', code: 2 }; // Blocking back = fullback

        case 'TB':
          return { name: 'HB', code: 1 }; // Tailback = halfback

        case 'WB':
          return { name: 'WR', code: 3 }; // Wingback -> modern WR

        case 'E':
          // Weight-based: light = WR, medium = TE, heavy = DE
          if (weight) {
            if (weight < 230) return { name: 'WR', code: 3 };
            if (weight < 260) return { name: 'TE', code: 4 };
            return { name: 'LEDG', code: 10 }; // Defensive end
          }
          return { name: 'TE', code: 4 }; // Default to TE

        case 'T':
          // Weight-based: lighter = OT, heavier = DT
          if (weight && weight >= 280) {
            return { name: 'DT', code: 12 }; // Defensive tackle
          }
          return { name: 'LT', code: 5 }; // Default to offensive tackle

        case 'G':
          return { name: 'LG', code: 6 }; // Guard

        case 'C':
          return { name: 'C', code: 7 }; // Center

        case 'DB':
          // Height-based: taller = S, shorter = CB
          if (height && height >= 72) {
            return { name: 'FS', code: 17 }; // Safety
          }
          return { name: 'CB', code: 16 }; // Default to cornerback
      }
    }

    // Era 2: Modern Positions Emerge (1950-1989)
    if (year >= 1950 && year < 1990) {
      switch (pos) {
        case 'FL':
        case 'SE':
          return { name: 'WR', code: 3 }; // Flanker/Split End = WR

        case 'DE':
          return { name: 'LEDG', code: 10 }; // Defensive end

        case 'NT':
          return { name: 'DT', code: 12 }; // Nose tackle = DT

        case 'ILB':
          return { name: 'Mike', code: 14 }; // Inside LB = Mike

        case 'RCB':
        case 'LCB':
          return { name: 'CB', code: 16 }; // Right/Left CB

        // Generic "B" (Back) still exists in 1950s-1960s
        case 'B':
          if (weight) {
            if (weight < 200) return { name: 'HB', code: 1 };
            if (weight < 215) return { name: 'QB', code: 0 };
            return { name: 'FB', code: 2 };
          }
          return { name: 'HB', code: 1 };

        // Generic "E" (End) still exists
        case 'E':
          if (weight) {
            if (weight < 230) return { name: 'WR', code: 3 };
            if (weight < 260) return { name: 'TE', code: 4 };
            return { name: 'LEDG', code: 10 };
          }
          return { name: 'TE', code: 4 };
      }
    }

    // Fallback: Use modern mapping
    return this.mapPosition(historicalPosition);
  }

  /**
   * Generate a draft class from web-scraped data
   * Includes drafted players + undrafted free agents (UDFAs)
   * @param year - Draft year
   * @param testingMode - If true, limit to ~40 players for faster testing
   * @param league - League filter: 'nfl', 'afl', or 'combined' (default: auto-detect)
   * @returns Array of generated prospects
   */
  async generateDraftClass(year: number, testingMode: boolean = false, league?: string, ratingMode: string = 'semi-historical'): Promise<GeneratedPlayer[]> {
    // Auto-detect league filter based on year
    let leagueFilter: string | undefined = league;
    if (!leagueFilter) {
      if (year >= 1960 && year <= 1969) {
        leagueFilter = 'combined'; // Default to combined for AFL/NFL era
      } else {
        leagueFilter = 'nfl'; // Pre-1960 = NFL only, Post-1970 = merged NFL
      }
    }

    console.log(`[CreatorService] Generating draft class for ${year} (Testing: ${testingMode}, League: ${leagueFilter})`);

    try {
      // Step 1: Scrape drafted prospects using CSV export (MUCH faster!)
      let draftedProspects = await scraperService.scrapeDraftClassCSV(year);
      console.log(`[CreatorService] Scraped ${draftedProspects.length} drafted prospects from CSV`);

      if (draftedProspects.length === 0) {
        throw new Error(`No draft prospects found for ${year}`);
      }

      // Step 1.2: Filter by league if AFL/NFL era (1960-1969)
      if (year >= 1960 && year <= 1969 && leagueFilter !== 'combined') {
        const beforeFilter = draftedProspects.length;
        const masterLookup = this.loadMasterLookup();

        draftedProspects = draftedProspects.filter(prospect => {
          const nameParts = prospect.name.split(' ');
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ');
          // FIX: Use findPlayerInMASTERLookup which checks From/To year range, not just draft class
          const lookupEntry = this.findPlayerInMASTERLookup(firstName, lastName, year);

          if (!lookupEntry) {
            console.warn(`[CreatorService] No MASTER_LOOKUP entry for ${prospect.name} (${year}) - including by default`);
            return true; // Include if unknown
          }

          // Filter by league
          const playerLeague = lookupEntry['League']?.toUpperCase();
          const targetLeague = leagueFilter?.toUpperCase();

          return playerLeague === targetLeague;
        });

        console.log(`[CreatorService] Filtered ${leagueFilter.toUpperCase()} players: ${beforeFilter} -> ${draftedProspects.length} (removed ${beforeFilter - draftedProspects.length})`);
      }

      // CRITICAL: Ensure draft order is correct (round, then pick)
      // M26 file uses BLOCK POSITION as draft order - block 0 = pick 1
      // CSV should already be ordered but sorting ensures correctness
      draftedProspects.sort((a, b) => {
        const roundA = a.round ?? 99;
        const roundB = b.round ?? 99;
        if (roundA !== roundB) return roundA - roundB;

        const pickA = a.pick ?? 999;
        const pickB = b.pick ?? 999;
        return pickA - pickB;
      });
      console.log(`[CreatorService] ✓ Sorted ${draftedProspects.length} prospects by draft order`);

      // Step 1.3: Scrape Hall of Fame status from CSV lookup (fast and accurate!)
      const hofMap = await scraperService.scrapeHOFFromWikipedia(year);
      if (hofMap.size > 0) {
        console.log(`[CreatorService] Applying HOF status to ${hofMap.size} players`);
        for (const prospect of draftedProspects) {
          if (hofMap.has(prospect.name)) {
            prospect.isHallOfFamer = true;
            console.log(`[CreatorService] ✨ ${prospect.name} is a Hall of Famer!`);

            // Enrich with HOF bio data (height, weight, homeState) - saves scraping time!
            scraperService.enrichProspectWithHOFData(prospect);
          }
        }
      }

      // Step 1.5: Scrape combine data (2000+) for REAL height/weight
      const combineData = await scraperService.scrapeCombineData(year);
      if (combineData.size > 0) {
        console.log(`[CreatorService] Merging combine data for ${combineData.size} players`);
        // Merge combine data into prospects
        for (const prospect of draftedProspects) {
          const combMeasurements = combineData.get(prospect.name);
          if (combMeasurements) {
            prospect.height = combMeasurements.height;
            prospect.weight = combMeasurements.weight;
            prospect.hasCombineData = true;
          }
        }
      }

      // Step 1.6: Scrape bio data for HOFers + top 75 players by career stats
      if (!testingMode) {
        console.log(`[CreatorService] Scraping bio data for HOFers + top 75 players by career stats...`);

        // Priority 1: Hall of Famers (must be accurate!)
        const hofProspects = draftedProspects.filter(p => p.isHallOfFamer);

        // Priority 2: Top 75 players by career stats (catches late-round gems like Tom Brady!)
        // Calculate a composite "career value" score for each non-HOF player
        const nonHofProspects = draftedProspects.filter(p => !p.isHallOfFamer);

        const scoredProspects = nonHofProspects.map(p => {
          // Composite score = (Games * 1) + (Starts * 2) + (AV * 5)
          // This weights AV (Approximate Value) most heavily, as it's the best indicator
          const score = (p.careerGames || 0) * 1 +
                        (p.careerStarts || 0) * 2 +
                        (p.careerAV || 0) * 5;
          return { prospect: p, score };
        });

        // Sort by score descending and take top 75
        const top75Prospects = scoredProspects
          .sort((a, b) => b.score - a.score)
          .slice(0, 75)
          .map(item => item.prospect);

        // Combine: HOFers first, then top 75 by stats
        const priorityProspects = [...hofProspects, ...top75Prospects];

        console.log(`[CreatorService] Found ${hofProspects.length} HOFers + ${top75Prospects.length} top players by career stats = ${priorityProspects.length} total bio scrapes`);

        for (const prospect of priorityProspects) {
          try {
            const bioData = await scraperService.scrapePlayerBio(prospect.name);
            if (bioData) {
              if (bioData.homeState) {
                prospect.homeState = bioData.homeState;
              }
              // Also update height/weight if not from combine
              if (!prospect.hasCombineData) {
                if (bioData.height) prospect.height = bioData.height;
                if (bioData.weight) prospect.weight = bioData.weight;
              }
            }
          } catch (error) {
            console.warn(`[CreatorService] Failed to scrape bio for ${prospect.name}`);
          }
        }

        console.log(`[CreatorService] Completed bio scraping for ${priorityProspects.length} players`);
      }

      // Testing mode: limit to 5 players per round (7 rounds = 35 players)
      if (testingMode) {
        const limitedProspects: DraftProspect[] = [];
        for (let round = 1; round <= 7; round++) {
          const roundPlayers = draftedProspects.filter(p => p.round === round).slice(0, 5);
          limitedProspects.push(...roundPlayers);
        }
        draftedProspects = limitedProspects;
        console.log(`[CreatorService] Testing mode: Limited to ${draftedProspects.length} drafted players`);
      }

      // Step 2: Scrape undrafted free agents (UDFAs who signed with teams)
      let udfaProspects = await scraperService.scrapeUndraftedFreeAgents(year);
      console.log(`[CreatorService] Scraped ${udfaProspects.length} UDFAs`);

      // Testing mode: limit UDFAs to 3
      if (testingMode) {
        udfaProspects = udfaProspects.slice(0, 3);
        console.log(`[CreatorService] Testing mode: Limited to ${udfaProspects.length} UDFAs`);
      }

      // Step 3: Fill roster to 380-400 with filler players instead of slow scraping
      const targetTotal = testingMode ? 40 : 400; // Target total roster size
      const currentTotal = draftedProspects.length + udfaProspects.length;
      const fillerNeeded = Math.max(0, targetTotal - currentTotal);

      let fillerPlayers: DraftProspect[] = [];
      if (fillerNeeded > 0) {
        console.log(`[CreatorService] Need ${fillerNeeded} filler players to reach ${targetTotal}`);
        fillerPlayers = this.generateFillerPlayers(fillerNeeded, year);
        console.log(`[CreatorService] Generated ${fillerPlayers.length} filler players`);
      }

      // Combine all prospects
      const allProspects = [...draftedProspects, ...udfaProspects, ...fillerPlayers];
      console.log(`[CreatorService] Total prospects: ${allProspects.length} (${draftedProspects.length} drafted + ${udfaProspects.length} UDFA + ${fillerPlayers.length} filler)`);

      // Step 4: For each prospect, generate player data
      const generatedPlayers: GeneratedPlayer[] = [];
      const ratingModeErrors: Array<{player: string, error: string}> = []; // Track errors for debugging

      for (let i = 0; i < allProspects.length; i++) {
        const prospect = allProspects[i];

        // HOF checking is DISABLED - too slow
        // Will get HOF status from Wikipedia draft page instead (future enhancement)

        // Parse name FIRST (needed for MASTER_LOOKUP query)
        const nameParts = prospect.name.split(' ');
        const firstName = nameParts[0] || 'John';
        const lastName = nameParts.slice(1).join(' ') || 'Doe';

        // Load player data from MASTER_LOOKUP (needed for wAV and other enhancements)
        // FIX: Use findPlayerInMASTERLookup which checks From/To year range, not just draft class
        const lookupEntry = this.findPlayerInMASTERLookup(firstName, lastName, year);

        // Get weight and height from MASTER_LOOKUP or prospect (needed for historical position mapping)
        let weight = prospect.weight || 0;
        let heightInches = 0;
        if (lookupEntry) {
          if (lookupEntry['Weight']) {
            const lookupWeight = parseInt(lookupEntry['Weight']);
            if (!isNaN(lookupWeight) && lookupWeight > 0) {
              weight = lookupWeight;
            }
          }
          if (lookupEntry['Height']) {
            const lookupHeight = parseInt(lookupEntry['Height']);
            if (!isNaN(lookupHeight) && lookupHeight > 0) {
              heightInches = lookupHeight;
            }
          }
        }

        // Map position with historical support (uses weight/height for disambiguation)
        const mappedPosition = this.mapHistoricalPosition(prospect.position, year, weight, heightInches);

        // Extract wAV from MASTER_LOOKUP if available
        let wAV: number | undefined;
        if (lookupEntry && lookupEntry['wAV']) {
          wAV = parseFloat(lookupEntry['wAV']);
          if (!isNaN(wAV)) {
            console.log(`[CreatorService] Found wAV for ${firstName} ${lastName}: ${wAV}`);
          }
        }

        // Convert career stats from draft table to PlayerStats format
        const stats = this.convertProspectToPlayerStats(prospect);

        // Generate ratings based on selected mode
        let ratings: MaddenRatings;

        if (ratingMode === 'random' || ratingMode === 'realistic' || ratingMode === 'variance' || ratingMode === 'madden') {
          // Use rating mode factory for all supported rating modes
          try {
            // Debug logging for first 3 players in realistic/madden mode
            if ((ratingMode === 'realistic' || ratingMode === 'madden') && i < 3) {
              const fs = require('fs');
              const path = require('path');
              const { app } = require('electron');
              const logPath = path.join(app.getPath('temp'), `${ratingMode}-mode-debug.txt`);
              fs.appendFileSync(logPath, `\n[CreatorService] ${firstName} ${lastName}: prospect.pick=${prospect.pick}, prospect.round=${prospect.round}, draftClass=${year}, wAV=${wAV}\n`);
            }

            const generator = RatingModeFactory.create(ratingMode as RatingMode);
            const generatedRatings = await generator.generateRatings({
              position: mappedPosition.name,
              draftPosition: prospect.pick,
              draftRound: prospect.round,
              fortyTime: prospect.fortyTime,
              age: this.calculateAge(year, prospect.round),
              name: `${firstName} ${lastName}`,
              // Include careerStats for MaddenRatingGenerator lookup
              careerStats: {
                draftClass: year,  // Draft year for rookie stats lookup
                wAV: wAV || 0,
                archetype: prospect.archetype || '',
                height: heightInches || 0,
                weight: weight || 0
              }
            });

            // Convert from factory format to MaddenRatings format
            ratings = this.convertFactoryRatingsToMaddenRatings(generatedRatings, ratingMode);

            // Log first 3 players in realistic mode for debugging
            if (ratingMode === 'realistic' && i < 3) {
              console.log(`[CreatorService] ${firstName} ${lastName} (Pick ${prospect.pick}): OVR=${ratings.overall} (realistic mode)`);
            }

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : 'No stack trace';

            console.error(`[CreatorService] Error using rating mode ${ratingMode} for ${firstName} ${lastName}, falling back to default:`, error);
            console.error(`[CreatorService] Error details:`, errorMsg);
            console.error(`[CreatorService] Error stack:`, errorStack);

            // Track error for frontend display (only first 3 to avoid spam)
            if (ratingModeErrors.length < 3) {
              ratingModeErrors.push({
                player: `${firstName} ${lastName} (Pick ${prospect.pick})`,
                error: errorMsg + (errorStack ? `\n${errorStack.split('\n')[0]}` : '')
              });
            }

            ratings = this.generateDefaultRatings(prospect);
          }
        } else {
          // Semi-historical mode: use existing logic (wAV -> stats -> default)
          if (wAV !== undefined && wAV > 0) {
            // Use wAV-based rating tier system
            ratings = this.generateRatingsFromWAV(wAV, mappedPosition.name, prospect.isHallOfFamer);
          } else if (stats && (stats.passAttempts || stats.rushAttempts || stats.receptions || stats.tackles)) {
            // Use career stats if available
            ratings = ratingCalculator.calculateRatings(stats);
          } else {
            // Fall back to draft position
            ratings = this.generateDefaultRatings(prospect);
          }
        }

        // Ensure NO ratings are blank - default to 30 (or 1 for kickReturn)
        this.fillMissingRatings(ratings, mappedPosition.name);

        // Cap ratings by position (these are rookies!)
        this.capRatingsByPosition(ratings, mappedPosition.name);

        // Generate proper jersey number by position
        const jerseyNum = this.generateJerseyNumber(mappedPosition.name);

        // Calculate age based on draft year (prospects are typically 21-23)
        const age = this.calculateAge(year, prospect.round);

        // Height - use MASTER_LOOKUP value if available, otherwise parse from scraper or generate
        if (heightInches === 0) {
          heightInches = prospect.height
            ? this.parseHeight(prospect.height)
            : this.generateHeight(mappedPosition.name);
        }

        // Weight - use MASTER_LOOKUP value if available, otherwise get from prospect
        // Weight validation: if weight is unrealistic (>400 or <150), use position default
        if (weight === 0) {
          weight = prospect.weight || 0;
        }
        if (weight > 400 || weight < 150 || weight === 0) {
          weight = this.getDefaultWeight(mappedPosition.name);
        }

        // Convert weight to Madden offset format (actual - 160)
        const maddenWeight = this.convertWeightToMaddenFormat(weight);

        // Get PID directly from MASTER_LOOKUP if available
        let matchedPID = 0;
        if (lookupEntry) {
          const lookupPID = parseInt(lookupEntry['PhotoID']);
          if (!isNaN(lookupPID) && lookupPID > 0) {
            matchedPID = lookupPID;
            console.log(`[CreatorService] Using PhotoID from MASTER_LOOKUP for ${firstName} ${lastName}: ${matchedPID}`);
          }
        }

        // Fallback: Match PID from lookup table with disambiguation
        if (matchedPID === 0) {
          matchedPID = this.matchPID(firstName, lastName, year, mappedPosition.name, prospect.college);
        }

        // Check for (R) tag and replace with preferred non-(R) version if available
        if (matchedPID > 0) {
          matchedPID = this.getPreferredPID(matchedPID, `${firstName} ${lastName}`);
        }

        // Get race data from MASTER_LOOKUP for generic face assignment
        const raceData = lookupEntry ? lookupEntry['Race'] : undefined;

        // Get PAM (Player Assets ID) from MASTER_LOOKUP
        let playerAssetId = lookupEntry ? lookupEntry['Player Assets ID'] : undefined;

        // If no real portrait found, assign appropriate generic face WITH race data
        if (matchedPID === 0) {
          matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name, raceData);
        }

        // Auto-populate asset ID if missing:
        // 1. Use real asset from MASTER_LOOKUP if available
        // 2. If no asset but has PID, assign generic asset matching their portrait
        // 3. If neither, assign generic asset based on race
        if (!playerAssetId || playerAssetId.trim() === '') {
          playerAssetId = this.assignGenericAsset(matchedPID, raceData);
        }

        // Match college to valid college in lookup (fuzzy matching)
        const matchedCollege = this.matchCollege(prospect.college || 'Unknown');

        // Get homestate: use scraped if available (convert to ID), otherwise generate realistic one
        const generatedState = this.generateHomeState();
        // Check for both undefined/null AND empty string (scraped but no state found)
        const homeStateId = (prospect.homeState && prospect.homeState.trim())
          ? this.matchHomeState(prospect.homeState)
          : this.matchHomeState(generatedState);

        // DEBUG: Log homestate conversion for first 3 players
        if (i < 3) {
          console.log(`[CreatorService] Player ${i+1} "${prospect.name}": scraped="${prospect.homeState}", generated="${generatedState}", finalID=${homeStateId}, wAV=${wAV || 'N/A'}`);
        }

        // Get CommID from MASTER_LOOKUP for in-game commentary
        const commID = lookupEntry ? parseInt(lookupEntry['CommID']) || 0 : 0;

        // Generate player
        const player: GeneratedPlayer = {
          firstName,
          lastName,
          position: mappedPosition.name,
          positionCode: mappedPosition.code,
          college: matchedCollege,
          jerseyNum,
          age,
          heightInches,
          weight: maddenWeight,
          homeState: homeStateId,
          devTrait: this.determineDevTrait(prospect.round, prospect.pick, ratings.overall, prospect.isHallOfFamer, wAV),
          ratings,
          PID: matchedPID,
          PEPS: playerAssetId || null, // Load PAM from MASTER_LOOKUP if available
          bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
          yearsPro: 0,
          commID: commID || undefined,
          _sourceStats: stats || undefined
        };

        generatedPlayers.push(player);
      }

      console.log(`[CreatorService] Generated ${generatedPlayers.length} players`);

      // DEBUG: Log first player's complete data to verify all ratings exist
      if (generatedPlayers.length > 0) {
        const firstPlayer = generatedPlayers[0];
        console.log(`[CreatorService] ========== FIRST PLAYER COMPLETE DATA ==========`);
        console.log(`[CreatorService] Name: ${firstPlayer.firstName} ${firstPlayer.lastName}`);
        console.log(`[CreatorService] Position: ${firstPlayer.position} (code ${firstPlayer.positionCode})`);
        console.log(`[CreatorService] College ID: ${firstPlayer.college}, HomeState ID: ${firstPlayer.homeState}, Body Type: ${firstPlayer.bodyType}`);
        console.log(`[CreatorService] PID: ${firstPlayer.PID}, PEPS: ${firstPlayer.PEPS || 'NULL'}`);
        console.log(`[CreatorService] Ratings:`, JSON.stringify(firstPlayer.ratings, null, 2));
        console.log(`[CreatorService] ================================================`);
      }

      // Close browser when done
      await scraperService.closeBrowser();

      // Log rating mode errors if any occurred
      if (ratingModeErrors.length > 0) {
        console.error(`\n[CreatorService] ⚠️  RATING MODE ERRORS (${ratingModeErrors.length} total):`);
        ratingModeErrors.forEach((err, idx) => {
          console.error(`  ${idx + 1}. ${err.player}`);
          console.error(`     ${err.error}\n`);
        });
      }

      return generatedPlayers;

    } catch (error: any) {
      console.error('[CreatorService] Error generating draft class:', error);
      await scraperService.closeBrowser();
      throw new Error(`Failed to generate draft class: ${error.message}`);
    }
  }

  /**
   * Generate draft class from CSV lookup files (OPTIMIZED - 95%+ faster!)
   * Uses ALL_PLAYER_LOOKUP.csv for year <= 2025 (historical)
   * Uses FutureDraft_Lookup.csv for year >= 2026 (projected)
   * Falls back to scraping ONLY for missing height/weight data
   *
   * @param year - Draft year
   * @param testingMode - If true, limit to ~40 players for faster testing
   * @param league - League filter: 'nfl', 'afl', or 'combined' (default: auto-detect)
   * @param ratingMode - Rating generation mode: 'semi-historical', 'random', or 'realistic'
   * @returns Array of generated prospects
   */
  async generateDraftClassFromLookup(
    year: number,
    testingMode: boolean = false,
    league?: string,
    ratingMode: string = 'semi-historical'
  ): Promise<GeneratedPlayer[]> {
    const startTime = Date.now();

    // Auto-detect league filter based on year
    let leagueFilter: string | undefined = league;
    if (!leagueFilter) {
      if (year >= 1960 && year <= 1969) {
        leagueFilter = 'combined'; // Default to combined for AFL/NFL era
      } else {
        leagueFilter = 'nfl'; // Pre-1960 = NFL only, Post-1970 = merged NFL
      }
    }

    // Choose which CSV file to use based on year
    const useFutureDraft = year >= 2026;
    const lookupSource = useFutureDraft ? 'FutureDraft_Lookup.csv' : 'ALL_PLAYER_LOOKUP.csv';
    console.log(`[CreatorService] ⚡ FAST MODE: Generating ${year} draft from ${lookupSource} (League: ${leagueFilter}, Rating Mode: ${ratingMode})`);

    try {
      // STEP 1: Load ALL players from appropriate lookup for this year (INSTANT!)
      const lookup = useFutureDraft ? this.loadFutureDraftLookup() : this.loadMasterLookup();
      const draftProspects: DraftProspect[] = [];

      lookup.forEach((entry, key) => {
        if (entry['Draft Class'] === String(year)) {
          // Apply league filter if needed (1960-1969) - only for historical data
          if (!useFutureDraft && leagueFilter && leagueFilter !== 'combined' && year >= 1960 && year <= 1969) {
            if (entry['League']?.toUpperCase() !== leagueFilter.toUpperCase()) {
              return; // Skip this player
            }
          }

          const firstName = entry['First Name'];
          const lastName = entry['Last Name'];

          // Handle different CSV structures
          let round: number | undefined;
          let pick: number | undefined;
          let wAV: number | undefined;

          if (useFutureDraft) {
            // FutureDraft_Lookup has "Rank" instead of "Round" and "Pick"
            const rank = entry['Rank'] ? parseFloat(entry['Rank']) : undefined;
            if (rank) {
              // Convert rank to approximate round/pick (32 picks per round)
              round = Math.ceil(rank / 32);
              pick = rank;
            }
            // Future prospects don't have wAV (not played yet)
            wAV = undefined;
          } else {
            // ALL_PLAYER_LOOKUP has "Round", "Pick", and "wAV"
            // Handle "UD" (undrafted) by checking if parseFloat returns NaN
            const parsedRound = entry['Round'] ? parseFloat(entry['Round']) : NaN;
            const parsedPick = entry['Pick'] ? parseFloat(entry['Pick']) : NaN;
            round = !isNaN(parsedRound) ? parsedRound : undefined;
            pick = !isNaN(parsedPick) ? parsedPick : undefined;
            wAV = entry['wAV'] ? parseFloat(entry['wAV']) : undefined;
          }

          draftProspects.push({
            name: `${firstName} ${lastName}`,
            position: entry['Position'],
            round: round,
            pick: pick,
            college: useFutureDraft ? entry['College'] : entry['College/Univ'],
            height: undefined, // Will get from lookup height field or scrape
            weight: undefined, // Will get from lookup weight field or scrape
            careerGames: useFutureDraft ? undefined : (entry['St'] ? parseInt(entry['St']) : undefined),
            careerStarts: useFutureDraft ? undefined : (entry['St'] ? parseInt(entry['St']) : undefined),
            careerAV: wAV,
            // HOF heuristic: AP1 > 0 or wAV > 150 (only for historical players)
            isHallOfFamer: useFutureDraft ? false : ((entry['AP1'] && parseInt(entry['AP1']) > 0) || (wAV && wAV > 150) || false)
          });
        }
      });

      // CRITICAL: Sort prospects by draft order (round, then pick)
      // M26 file uses BLOCK POSITION as draft order - block 0 = pick 1
      // Without this sort, prospects would be in Map iteration order (random)
      draftProspects.sort((a, b) => {
        // Drafted players (with round/pick) come before undrafted
        const roundA = a.round ?? 99;
        const roundB = b.round ?? 99;
        if (roundA !== roundB) return roundA - roundB;

        const pickA = a.pick ?? 999;
        const pickB = b.pick ?? 999;
        return pickA - pickB;
      });

      console.log(`[CreatorService] ✓ Loaded ${draftProspects.length} players from MASTER_LOOKUP in ${Date.now() - startTime}ms`);
      console.log(`[CreatorService] ✓ Sorted by draft order - first: ${draftProspects[0]?.name} (R${draftProspects[0]?.round} P${draftProspects[0]?.pick}), last: ${draftProspects[draftProspects.length-1]?.name}`);

      // Testing mode: limit to first 40 players
      if (testingMode && draftProspects.length > 40) {
        console.log(`[CreatorService] Testing mode: limiting to 40 players`);
        draftProspects.splice(40);
      }

      // STEP 2: Identify players missing critical data (height/weight)
      const missingData = draftProspects.filter(p => !p.height || !p.weight);
      console.log(`[CreatorService] ${missingData.length} players missing height/weight from MASTER_LOOKUP`);

      // STEP 3: Fallback scrape ONLY for missing data (if any)
      if (missingData.length > 0 && !testingMode) {
        console.log(`[CreatorService] Scraping combine data for missing height/weight...`);

        try {
          const combineData = await scraperService.scrapeCombineData(year);

          if (combineData.size > 0) {
            for (const prospect of missingData) {
              const combMeasurements = combineData.get(prospect.name);
              if (combMeasurements) {
                prospect.height = combMeasurements.height;
                prospect.weight = combMeasurements.weight;
                prospect.hasCombineData = true;
              }
            }

            const stillMissing = draftProspects.filter(p => !p.height || !p.weight).length;
            console.log(`[CreatorService] After scraping, ${stillMissing} players still missing data (will use defaults)`);
          }
        } catch (error) {
          console.warn(`[CreatorService] Combine scraping failed, will use defaults for missing data:`, error);
        }
      }

      // STEP 4: Process all players (same logic as original generateDraftClass)
      const generatedPlayers: GeneratedPlayer[] = [];
      const ratingModeErrors: Array<{player: string, error: string}> = []; // Track errors for debugging

      for (let i = 0; i < draftProspects.length; i++) {
        const prospect = draftProspects[i];

        // Parse name
        const nameParts = prospect.name.split(' ');
        const firstName = nameParts[0] || 'John';
        const lastName = nameParts.slice(1).join(' ') || 'Doe';

        // Get full lookup entry for this player
        const lookupKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()} ${year}`;
        const lookupEntry = lookup.get(lookupKey);

        // Get weight and height from lookup
        let weight = prospect.weight || 0;
        let heightInches = 0;

        if (lookupEntry) {
          if (lookupEntry['Weight']) {
            const lookupWeight = parseInt(lookupEntry['Weight']);
            if (!isNaN(lookupWeight) && lookupWeight > 0) {
              weight = lookupWeight;
            }
          }
          if (lookupEntry['Height']) {
            const lookupHeight = parseInt(lookupEntry['Height']);
            if (!isNaN(lookupHeight) && lookupHeight > 0) {
              heightInches = lookupHeight;
            }
          }
        }

        // Map position with historical support (uses weight/height for disambiguation)
        const mappedPosition = this.mapHistoricalPosition(prospect.position, year, weight, heightInches);

        // Extract wAV from lookup (only available for historical players)
        let wAV: number | undefined;
        if (lookupEntry && lookupEntry['wAV']) {
          wAV = parseFloat(lookupEntry['wAV']);
          if (!isNaN(wAV) && wAV > 0) {
            // Adjust wAV based on years in league (normalize to per-year basis)
            // Someone with wAV=58 over 5 years should be rated differently than wAV=58 over 15 years
            const fromYear = lookupEntry['From'] ? parseInt(lookupEntry['From']) : undefined;
            const toYear = lookupEntry['To'] ? parseInt(lookupEntry['To']) : undefined;

            if (fromYear && toYear) {
              const yearsPlayed = toYear - fromYear + 1; // +1 because both years are inclusive
              if (yearsPlayed > 0) {
                // Calculate per-year wAV and scale to 10-year career equivalent
                // This normalizes career length while preserving the per-year impact
                const perYearWAV = wAV / yearsPlayed;
                const adjustedWAV = perYearWAV * 10; // Scale to 10-year standard

                // Log adjustment for first 5 players
                if (i < 5) {
                  console.log(`[CreatorService] ${firstName} ${lastName}: wAV=${wAV} (${yearsPlayed} years) -> adjusted=${adjustedWAV.toFixed(1)} (${perYearWAV.toFixed(2)}/year)`);
                }

                wAV = adjustedWAV;
              }
            } else if (i < 5) {
              // Log unadjusted wAV if From/To not available
              console.log(`[CreatorService] ${firstName} ${lastName}: wAV=${wAV} (years unknown, no adjustment)`);
            }
          }
        }

        // Convert career stats to PlayerStats format (minimal, just for fallback)
        const stats = prospect.careerAV ? {
          name: prospect.name,
          position: prospect.position,
          college: prospect.college,
          gamesPlayed: prospect.careerGames
        } : undefined;

        // Generate ratings based on selected mode
        let ratings: MaddenRatings;

        if (ratingMode === 'random' || ratingMode === 'realistic' || ratingMode === 'variance' || ratingMode === 'madden') {
          // Use rating mode factory for all supported rating modes
          try {
            // Debug logging for first 3 players in realistic/madden mode
            if ((ratingMode === 'realistic' || ratingMode === 'madden') && i < 3) {
              const fs = require('fs');
              const path = require('path');
              const { app } = require('electron');
              const logPath = path.join(app.getPath('temp'), `${ratingMode}-mode-debug.txt`);
              fs.appendFileSync(logPath, `\n[CreatorService-Roster] ${firstName} ${lastName}: prospect.pick=${prospect.pick}, prospect.round=${prospect.round}, draftClass=${year}, wAV=${wAV}\n`);
            }

            const generator = RatingModeFactory.create(ratingMode as RatingMode);
            const generatedRatings = await generator.generateRatings({
              position: mappedPosition.name,
              draftPosition: prospect.pick,
              draftRound: prospect.round,
              fortyTime: prospect.fortyTime,
              age: this.calculateAge(year, prospect.round),
              name: `${firstName} ${lastName}`,
              // Include careerStats for MaddenRatingGenerator lookup
              careerStats: {
                draftClass: year,  // Draft year for rookie stats lookup
                wAV: wAV || 0,
                archetype: prospect.archetype || '',
                height: heightInches || 0,
                weight: weight || 0
              }
            });

            // Convert from factory format to MaddenRatings format
            ratings = this.convertFactoryRatingsToMaddenRatings(generatedRatings, ratingMode);

            // Log first 3 players in realistic mode for debugging
            if (ratingMode === 'realistic' && i < 3) {
              console.log(`[CreatorService] ${firstName} ${lastName} (Pick ${prospect.pick}): OVR=${ratings.overall} (realistic mode)`);
            }

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : 'No stack trace';

            console.error(`[CreatorService] Error using rating mode ${ratingMode} for ${firstName} ${lastName}, falling back to default:`, error);
            console.error(`[CreatorService] Error details:`, errorMsg);
            console.error(`[CreatorService] Error stack:`, errorStack);

            // Track error for frontend display (only first 3 to avoid spam)
            if (ratingModeErrors.length < 3) {
              ratingModeErrors.push({
                player: `${firstName} ${lastName} (Pick ${prospect.pick})`,
                error: errorMsg + (errorStack ? `\n${errorStack.split('\n')[0]}` : '')
              });
            }

            ratings = this.generateDefaultRatings(prospect);
          }
        } else {
          // Semi-historical mode: use existing logic (wAV -> stats -> default)
          if (wAV !== undefined && wAV > 0) {
            // Use wAV-based rating tier system
            ratings = this.generateRatingsFromWAV(wAV, mappedPosition.name, prospect.isHallOfFamer);
          } else if (stats && (stats.passAttempts || stats.rushAttempts || stats.receptions || stats.tackles)) {
            // Use career stats if available
            ratings = ratingCalculator.calculateRatings(stats);
          } else {
            // Fall back to draft position
            ratings = this.generateDefaultRatings(prospect);
          }
        }

        // Ensure NO ratings are blank
        this.fillMissingRatings(ratings, mappedPosition.name);

        // Cap ratings by position (these are rookies!)
        this.capRatingsByPosition(ratings, mappedPosition.name);

        // Generate proper jersey number by position
        const jerseyNum = this.generateJerseyNumber(mappedPosition.name);

        // Calculate age based on draft year (prospects are typically 21-23)
        const age = this.calculateAge(year, prospect.round);

        // Height - use MASTER_LOOKUP value if available, otherwise parse from scraper or generate
        if (heightInches === 0) {
          heightInches = prospect.height
            ? this.parseHeight(prospect.height)
            : this.generateHeight(mappedPosition.name);
        }

        // Weight - use MASTER_LOOKUP value if available, otherwise get from prospect
        if (weight === 0) {
          weight = prospect.weight || 0;
        }
        if (weight > 400 || weight < 150 || weight === 0) {
          weight = this.getDefaultWeight(mappedPosition.name);
        }

        // Convert weight to Madden offset format (actual - 160)
        const maddenWeight = this.convertWeightToMaddenFormat(weight);

        // Get PID directly from MASTER_LOOKUP if available
        let matchedPID = 0;
        if (lookupEntry) {
          const lookupPID = parseInt(lookupEntry['PhotoID']);
          if (!isNaN(lookupPID) && lookupPID > 0) {
            matchedPID = lookupPID;
            console.log(`[CreatorService] Using PhotoID from MASTER_LOOKUP for ${firstName} ${lastName}: ${matchedPID}`);
          }
        }

        // Fallback: Match PID from lookup table with disambiguation
        if (matchedPID === 0) {
          matchedPID = this.matchPID(firstName, lastName, year, mappedPosition.name, prospect.college);
        }

        // Check for (R) tag and replace with preferred non-(R) version if available
        if (matchedPID > 0) {
          matchedPID = this.getPreferredPID(matchedPID, `${firstName} ${lastName}`);
        }

        // Get race data from MASTER_LOOKUP for generic face assignment
        const raceData = lookupEntry ? lookupEntry['Race'] : undefined;

        // Get PAM (Player Assets ID) from MASTER_LOOKUP
        let playerAssetId = lookupEntry ? lookupEntry['Player Assets ID'] : undefined;

        // If no real portrait found, assign appropriate generic face WITH race data
        if (matchedPID === 0) {
          matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name, raceData);
        }

        // Auto-populate asset ID if missing:
        // 1. Use real asset from MASTER_LOOKUP if available
        // 2. If no asset but has PID, assign generic asset matching their portrait
        // 3. If neither, assign generic asset based on race
        if (!playerAssetId || playerAssetId.trim() === '') {
          playerAssetId = this.assignGenericAsset(matchedPID, raceData);
        }

        // Match college to valid college in lookup (fuzzy matching)
        const matchedCollege = this.matchCollege(prospect.college || 'Unknown');

        // Get homestate: generate realistic one
        const generatedState = this.generateHomeState();
        const homeStateId = this.matchHomeState(generatedState);

        // Determine dev trait using wAV
        const devTrait = this.determineDevTrait(prospect.round, prospect.pick, ratings.overall, prospect.isHallOfFamer, wAV);

        // Get CommID from MASTER_LOOKUP for in-game commentary
        const commID = lookupEntry ? parseInt(lookupEntry['CommID']) || 0 : 0;

        // Generate player
        const player: GeneratedPlayer = {
          firstName,
          lastName,
          position: mappedPosition.name,
          positionCode: mappedPosition.code,
          college: matchedCollege,
          jerseyNum,
          age,
          heightInches,
          weight: maddenWeight,
          homeState: homeStateId,
          devTrait,
          ratings,
          PID: matchedPID,
          PEPS: playerAssetId || null, // Load PAM from MASTER_LOOKUP if available
          bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
          yearsPro: 0,
          commID: commID || undefined,
          _sourceStats: stats || undefined
        };

        generatedPlayers.push(player);
      }

      const totalTime = Date.now() - startTime;
      console.log(`[CreatorService] ⚡ Generated ${generatedPlayers.length} drafted players in ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);

      // FILL TO 402 SLOTS: Add UFAs if we have fewer than 402 prospects
      const DRAFT_CLASS_SIZE = 402;
      if (generatedPlayers.length < DRAFT_CLASS_SIZE) {
        const ufasNeeded = DRAFT_CLASS_SIZE - generatedPlayers.length;
        console.log(`[CreatorService] Filling remaining ${ufasNeeded} slots with UFAs (target: ${DRAFT_CLASS_SIZE} total)`);

        // Get existing player names to avoid duplicates
        const existingNames = new Set(generatedPlayers.map(p => `${p.firstName.toLowerCase()} ${p.lastName.toLowerCase()}`));

        // Generate UFAs from MASTER_LOOKUP
        const ufaEntries = this.generateUFAsFromLookup(year, existingNames, ufasNeeded);
        console.log(`[CreatorService] Found ${ufaEntries.length} UFA candidates`);

        // Convert UFA entries to GeneratedPlayer format (treating them as late-round prospects)
        for (const ufaEntry of ufaEntries) {
          const firstName = ufaEntry['First Name'] || 'John';
          const lastName = ufaEntry['Last Name'] || 'Doe';
          const draftYear = parseInt(ufaEntry['Draft Class']) || year - 1;
          const position = ufaEntry['Position'] || 'WR';
          const heightInches = parseInt(ufaEntry['Height']) || 0;
          const weight = parseInt(ufaEntry['Weight']) || 0;
          const college = ufaEntry['College/Univ'] || 'Unknown';
          const raceData = ufaEntry['Race'] || undefined;

          // Map position using mapPosition helper
          const mappedPosition = this.mapPosition(position);

          // Generate ratings as weak prospects (UDFAs)
          const ratings = this.generateDefaultRatings({
            name: `${firstName} ${lastName}`,
            round: 8, // Treat as 8th round (weak prospects)
            pick: 250,
            team: 'UFA',
            position,
            college,
            careerAV: 0
          });

          this.fillMissingRatings(ratings, mappedPosition.name);
          this.capRatingsByPosition(ratings, mappedPosition.name); // Apply rookie caps

          // Get PID directly from ufaEntry if available
          let matchedPID = 0;
          const ufaPID = parseInt(ufaEntry['PhotoID']);
          if (!isNaN(ufaPID) && ufaPID > 0) {
            matchedPID = ufaPID;
            console.log(`[CreatorService] Using PhotoID from MASTER_LOOKUP for UFA ${firstName} ${lastName}: ${matchedPID}`);
          }

          // Fallback: Match PID with disambiguation
          if (matchedPID === 0) {
            matchedPID = this.matchPID(firstName, lastName, draftYear, mappedPosition.name, college);
          }
          if (matchedPID > 0) {
            matchedPID = this.getPreferredPID(matchedPID, `${firstName} ${lastName}`);
          }
          if (matchedPID === 0) {
            matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name, raceData);
          }

          const playerAssetId = ufaEntry['Player Assets ID'] || this.assignGenericAsset(matchedPID, raceData);
          const matchedCollege = this.matchCollege(college);
          const homeState = this.generateHomeState();
          const homeStateId = this.matchHomeState(homeState);
          const jerseyNum = this.generateJerseyNumber(mappedPosition.name);
          const age = 22; // UFAs are typically 22-23
          const finalHeight = heightInches || this.generateHeight(mappedPosition.name);
          const finalWeight = weight || this.getDefaultWeight(mappedPosition.name);
          const bodyType = this.determineBodyType(mappedPosition.name, finalWeight, finalHeight);

          // Get CommID from ufaEntry for in-game commentary
          const ufaCommID = parseInt(ufaEntry['CommID']) || 0;

          const ufaPlayer: GeneratedPlayer = {
            firstName,
            lastName,
            position: mappedPosition.name,
            positionCode: mappedPosition.code,
            college: matchedCollege,
            jerseyNum,
            age,
            heightInches: finalHeight,
            weight: finalWeight,
            homeState: homeStateId,
            bodyType,
            devTrait: 0, // Normal dev trait for UFAs
            PID: matchedPID,
            PEPS: playerAssetId,
            ratings,
            commID: ufaCommID || undefined
          };

          generatedPlayers.push(ufaPlayer);
        }

        console.log(`[CreatorService] ✓ Total draft class size: ${generatedPlayers.length} (${generatedPlayers.length - (generatedPlayers.length - ufaEntries.length)} drafted + ${ufaEntries.length} UFAs)`);
      }

      // Close browser if we opened it
      await scraperService.closeBrowser();

      // Log rating mode errors if any occurred
      if (ratingModeErrors.length > 0) {
        console.error(`\n[CreatorService] ⚠️  RATING MODE ERRORS (${ratingModeErrors.length} total):`);
        ratingModeErrors.forEach((err, idx) => {
          console.error(`  ${idx + 1}. ${err.player}`);
          console.error(`     ${err.error}\n`);
        });
      }

      return generatedPlayers;

    } catch (error: any) {
      console.error('[CreatorService] Error generating draft class from lookup:', error);
      await scraperService.closeBrowser();
      throw new Error(`Failed to generate draft class from lookup: ${error.message}`);
    }
  }

  /**
   * Generate Draft Class V2.0
   *
   * New generator using improved data services and rating modes.
   * Supports:
   * - Single year (1936-2025 historical, 2026+ future)
   * - Decade classes (1930s-2020s)
   * - 3 rating modes: random, variance, madden
   * - Proper draft order (randomized for random mode, preserved for others)
   * - 402-pick drafts for modern era
   *
   * @param options - Generation options
   * @returns Array of generated players
   */
  async generateDraftClassV2(options: DraftGeneratorOptionsV2): Promise<GeneratedPlayer[]> {
    const startTime = Date.now();
    console.log(`[CreatorService V2] Generating draft class with options:`, options);

    try {
      // Route to FutureDraftService for 2026+ (only supports variance mode)
      if (options.year && options.year >= 2026) {
        console.log(`[CreatorService V2] Routing to FutureDraftService for year ${options.year}`);

        // Only variance mode is supported for future drafts
        if (options.ratingMode !== 'variance') {
          console.warn(`[CreatorService V2] Future drafts only support variance mode, switching from ${options.ratingMode}`);
        }

        // Generate future draft class
        const enrichedProspects = await futureDraftService.generateFutureDraftClass({
          year: options.year,
          ratingMode: 'variance'
        });

        // Convert enriched prospects to GeneratedPlayer format
        const generatedPlayers = await this.convertEnrichedProspectsToPlayers(enrichedProspects);

        const elapsed = Date.now() - startTime;
        console.log(`[CreatorService V2] Future draft class generated in ${elapsed}ms`);

        return generatedPlayers;
      }

      // Step 1: Load player data (Historical path - 1936-2025)
      let players: (HistoricalPlayer | FutureProspect)[];

      if (options.decade) {
        // Decade class
        console.log(`[CreatorService V2] Loading decade class for ${options.decade}s...`);
        players = await decadeClassService.createDecadeClass(options.decade);
        console.log(`[CreatorService V2] Loaded ${players.length} players from decade ${options.decade}s`);
      } else if (options.year) {
        // Single year
        console.log(`[CreatorService V2] Loading year ${options.year}...`);

        if (options.year >= 2026) {
          // Future prospects
          players = await playerDataService.getFutureProspectsByYear(options.year);
        } else {
          // Historical draft
          players = await playerDataService.getPlayersByYear(options.year);

          // Apply league filter for 1960-1969
          if (options.league && options.year >= 1960 && options.year <= 1969) {
            if (options.league !== 'combined') {
              players = players.filter(p => {
                const league = (p as any).league?.toUpperCase();
                return league === options.league?.toUpperCase();
              });
            }
          }
        }

        console.log(`[CreatorService V2] Loaded ${players.length} players for year ${options.year}`);
      } else {
        throw new Error('Must provide either year or decade');
      }

      if (players.length === 0) {
        throw new Error(`No players found for ${options.decade ? `decade ${options.decade}s` : `year ${options.year}`}`);
      }

      // Step 2: Determine draft size
      const draftSize = options.year
        ? draftSizeService.getDraftSize(options.year)
        : 402; // Decade classes always 402

      console.log(`[CreatorService V2] Draft size: ${draftSize} picks`);

      // Step 3: Apply testing mode limit
      if (options.testingMode && players.length > 40) {
        console.log(`[CreatorService V2] Testing mode: limiting to 40 players`);
        players = players.slice(0, 40);
      }

      // Step 4: Handle draft order based on mode
      if (options.ratingMode === 'random') {
        console.log(`[CreatorService V2] Random mode: shuffling draft order`);
        console.log(`[CreatorService V2]   Players BEFORE shuffle: ${players.slice(0, 5).map(p => p.firstName + ' ' + p.lastName).join(', ')}...`);
        this.shuffleArray(players);
        console.log(`[CreatorService V2]   Players AFTER shuffle: ${players.slice(0, 5).map(p => p.firstName + ' ' + p.lastName).join(', ')}...`);
      } else if (options.decade) {
        // Decade classes: keep wAV-based order (best players first for BPA simulation)
        console.log(`[CreatorService V2] ${options.ratingMode.toUpperCase()} mode: preserving wAV/position order for decade class`);
        console.log(`[CreatorService V2]   First 10 players: ${players.slice(0, 10).map(p => `${p.firstName} ${p.lastName} (wAV:${p.wAV || 0})`).join(', ')}...`);
      } else {
        // CRITICAL: Single-year historical drafts - sort by round/pick
        // M26 file uses BLOCK POSITION as draft order - block 0 = pick 1
        console.log(`[CreatorService V2] ${options.ratingMode.toUpperCase()} mode: sorting by actual draft order (round/pick)`);
        players.sort((a, b) => {
          const roundA = a.round ?? 99;
          const roundB = b.round ?? 99;
          if (roundA !== roundB) return roundA - roundB;

          const pickA = a.pick ?? 999;
          const pickB = b.pick ?? 999;
          return pickA - pickB;
        });
        console.log(`[CreatorService V2]   First 10 players after sort: ${players.slice(0, 10).map(p => `${p.firstName} ${p.lastName} (R${p.round} P${p.pick})`).join(', ')}...`);
      }

      // Step 5: Assign archetypes if missing
      console.log(`[CreatorService V2] Assigning archetypes for ${options.ratingMode} mode...`);
      let archetypesAssigned = 0;
      let archetypesFromRoster = 0;
      let archetypesFailed = 0;

      for (const player of players) {
        const fullName = `${player.firstName} ${player.lastName}`;

        if (!player.archetype || player.archetype === '') {
          // First, try to get archetype from ROSTER_lookup (actual Madden data)
          // getRookieStats handles the draft year -> rookie season conversion internally
          const rookieStats = await playerDataService.getRookieStats(fullName, player.draftClass);

          // Debug: Show what we got from getRookieStats
          if (archetypesFromRoster + archetypesAssigned < 5) {
            console.log(`[CreatorService V2]   DEBUG: ${fullName} - rookieStats found: ${!!rookieStats}`);
            if (rookieStats) {
              console.log(`[CreatorService V2]   DEBUG: archetype field = "${rookieStats.archetype}"`);
              console.log(`[CreatorService V2]   DEBUG: All keys: ${Object.keys(rookieStats).slice(0, 10).join(', ')}`);
            }
          }

          if (rookieStats && rookieStats.archetype && rookieStats.archetype.trim() !== '') {
            // IMPORTANT: Only use archetype if position matches
            // Players sometimes change positions between draft and rookie season
            // (e.g., Stephen Sullivan: TE in draft, WR in rookie season)
            const normalizePos = (pos: string) => {
              // Normalize similar positions for comparison
              if (['LEDG', 'REDG', 'LE', 'RE'].includes(pos)) return 'EDGE';
              if (['SAM', 'Mike', 'WILL', 'MLB', 'LOLB', 'ROLB'].includes(pos)) return 'LB';
              if (['FS', 'SS'].includes(pos)) return 'S';
              if (['LT', 'RT', 'LG', 'RG', 'C'].includes(pos)) return 'OL';
              if (pos === 'RB') return 'HB';
              return pos;
            };

            const draftPos = normalizePos(player.position);
            const rookiePos = normalizePos(rookieStats.position);

            if (draftPos === rookiePos) {
              player.archetype = rookieStats.archetype.trim();
              archetypesFromRoster++;

              // Debug first few
              if (archetypesFromRoster <= 3) {
                console.log(`[CreatorService V2]   ✓ Loaded "${rookieStats.archetype}" from ROSTER for ${fullName}`);
              }
            } else {
              // Position mismatch - use default for actual draft position
              console.log(`[CreatorService V2]   ⚠️ Position mismatch for ${fullName}: draft=${player.position}, rookie=${rookieStats.position}. Using default.`);
              const defaultId = archetypeService.getDefaultArchetypeForPosition(player.position);
              const defaultName = archetypeService.getArchetypeName(defaultId, player.position);
              player.archetype = defaultName;
              (player as any).archetypeId = defaultId;
              archetypesAssigned++;
            }
          } else {
            // Fallback: Use default archetype for position (just use first valid archetype)
            console.log(`[CreatorService V2]   ⚠️ No ROSTER archetype for ${fullName}, using default for ${player.position}`);
            const defaultId = archetypeService.getDefaultArchetypeForPosition(player.position);
            const defaultName = archetypeService.getArchetypeName(defaultId, player.position);
            player.archetype = defaultName;
            (player as any).archetypeId = defaultId;
            console.log(`[CreatorService V2]   Default archetype: "${defaultName}" (ID ${defaultId})`);
            if (defaultId === 0) {
              archetypesFailed++;
            }
            archetypesAssigned++;
          }
        } else {
          // Player already has archetype
          if (archetypesFromRoster + archetypesAssigned < 3) {
            console.log(`[CreatorService V2]   ✓ ${fullName} already has archetype: "${player.archetype}"`);
          }
        }
      }
      console.log(`[CreatorService V2] Archetypes: ${archetypesFromRoster} from ROSTER_lookup, ${archetypesAssigned} generated (${archetypesFailed} FAILED with ID=0)`);

      // Step 6: Generate ratings using selected mode
      console.log(`[CreatorService V2] Generating ratings using ${options.ratingMode} mode...`);
      const ratingGenerator = RatingModeFactory.create(options.ratingMode as RatingMode);

      // Initialize playerDataService once before the loop (prevents 400+ re-initializations)
      await playerDataService.initialize();

      const generatedPlayers: GeneratedPlayer[] = [];

      for (let i = 0; i < players.length; i++) {
        const player = players[i];

        // Get name from player data (HistoricalPlayer and FutureProspect have firstName/lastName)
        const firstName = player.firstName || 'John';
        const lastName = player.lastName || 'Doe';
        const fullName = `${firstName} ${lastName}`;

        // Build rating context
        const context: RatingContext = {
          position: player.position,
          draftPosition: player.pick ? parseInt(String(player.pick)) : i + 1,
          draftRound: player.round ? parseInt(String(player.round)) : Math.ceil((i + 1) / 32),
          name: fullName,
          careerStats: {
            wAV: player.wAV,
            draftClass: options.year || options.decade,
            archetype: player.archetype,
            height: player.height,
            weight: player.weight
          }
        };

        // Add 40-time if available
        if ((player as any).fortyTime) {
          context.fortyTime = parseFloat((player as any).fortyTime);
        }

        // Generate ratings
        const ratings = await ratingGenerator.generateRatings(context);

        // DEBUG: Log specific players for troubleshooting
        if (fullName === 'Joe Burrow' || fullName === 'Chase Young') {
          console.log(`\n[CreatorService V2] ========== ${fullName} ==========`);
          console.log(`[CreatorService V2] Position: ${player.position}`);
          console.log(`[CreatorService V2] Draft: Round ${context.draftRound}, Pick ${context.draftPosition}`);
          console.log(`[CreatorService V2] Rating Mode: ${options.ratingMode}`);
          console.log(`[CreatorService V2] Archetype: ${player.archetype}`);
          console.log(`[CreatorService V2] Draft Class: ${options.year || options.decade}`);
          console.log(`[CreatorService V2] Generated OVR: ${ratings.POVR}`);
          console.log(`[CreatorService V2] ==========================================\n`);
        }

        // Convert to MaddenRatings format
        const maddenRatings = this.convertFactoryRatingsToMaddenRatings(ratings, options.ratingMode);

        // DEBUG: Log conversion for specific players
        if (fullName === 'Joe Burrow' || fullName === 'Chase Young' || fullName.includes('Wills')) {
          console.log(`\n[CreatorService V2] ========== AFTER CONVERSION: ${fullName} ==========`);
          console.log(`[CreatorService V2]   Rating Mode: ${options.ratingMode}`);
          console.log(`[CreatorService V2]   Input ratings.POVR: ${ratings.POVR}`);
          console.log(`[CreatorService V2]   Output maddenRatings.POVR: ${maddenRatings.POVR}`);
          console.log(`[CreatorService V2]   Output maddenRatings.overall: ${maddenRatings.overall}`);
          console.log(`[CreatorService V2]   Output maddenRatings.speed: ${maddenRatings.speed}`);
          console.log(`[CreatorService V2]   Output maddenRatings.acceleration: ${maddenRatings.acceleration}`);
          console.log(`[CreatorService V2] ==========================================\n`);
        }

        // Validate that overall is set correctly for Madden mode
        if (options.ratingMode === 'madden' && (!maddenRatings.overall || maddenRatings.overall === 0)) {
          console.error(`[CreatorService V2] ⚠️⚠️⚠️ WARNING: Madden mode but overall=${maddenRatings.overall} for ${fullName}`);
          console.error(`[CreatorService V2]   Input POVR was: ${ratings.POVR}`);
        }

        // Map position
        const mappedPosition = this.mapPosition(player.position);

        // Use actual data from CSV when available, fallback to generated/matched values
        let pid = player.photoID !== undefined && player.photoID > 0
          ? player.photoID
          : this.matchPID(firstName, lastName, player.draftClass ? parseInt(String(player.draftClass)) : options.year, player.position, player.college);

        // If no PID found (0), assign a generic face so every player has a portrait
        if (pid === 0) {
          const raceData = (player as any).race;
          pid = this.assignGenericFace(firstName, lastName, player.position, raceData);
        }

        // Always assign generic asset based on the PID (whether real or generic)
        const pam = player.playerAssetsID && player.playerAssetsID.trim() !== ''
          ? player.playerAssetsID.trim()
          : this.assignGenericAsset(pid);

        // Match college
        const collegeId = player.college ? this.matchCollege(player.college) : 265;

        // Match home state (convert to ID for Madden)
        const homeState = player.homeState ? this.matchHomeState(player.homeState) : 0;

        // Use jersey from CSV, fallback to generated
        const jerseyNum = player.jersey
          ? (typeof player.jersey === 'string' ? parseInt(player.jersey.split('.')[0]) : parseInt(String(player.jersey)))
          : this.generateJerseyNumber(player.position);

        // DEBUG: Log Joe Burrow specifically
        if (fullName === 'Joe Burrow') {
          console.log(`\n[CreatorService V2] ========== JOE BURROW GENERATION ==========`);
          console.log(`[CreatorService V2]   FROM HistoricalPlayer object:`);
          console.log(`[CreatorService V2]     player.position = "${player.position}"`);
          console.log(`[CreatorService V2]     player.jersey = "${player.jersey}"`);
          console.log(`[CreatorService V2]     player.homeState = "${player.homeState}"`);
          console.log(`[CreatorService V2]     player.archetype = "${player.archetype}"`);
          console.log(`[CreatorService V2]     player.photoID = ${player.photoID}`);
          console.log(`[CreatorService V2]     player.playerAssetsID = "${player.playerAssetsID}"`);
          console.log(`[CreatorService V2]   AFTER PROCESSING:`);
          console.log(`[CreatorService V2]     jerseyNum = ${jerseyNum}`);
          console.log(`[CreatorService V2]     homeState (ID) = ${homeState}`);
          console.log(`[CreatorService V2]     pid = ${pid}`);
          console.log(`[CreatorService V2]     pam = "${pam}"`);
          console.log(`[CreatorService V2]     mappedPosition = ${mappedPosition.name} (code ${mappedPosition.code})`);
        }

        // Determine dev trait
        const devTrait = this.determineDevTrait(
          player.round ? parseInt(String(player.round)) : undefined,
          player.pick ? parseInt(String(player.pick)) : undefined,
          maddenRatings.POVR,
          (player as any).isHallOfFamer || false,
          player.wAV
        );

        // Generate body type
        const bodyType = this.determineBodyType(player.position, player.weight || 200, player.height || 72);

        // Convert archetype NAME to NUMERIC ID for Madden draft class format
        let archetypeId = 0;

        // FIRST: Check if rating generator calculated the best archetype from attributes
        // This is the most accurate method - it picks the archetype that maximizes OVR
        if ((ratings as any).ARCHETYPE_ID !== undefined && (ratings as any).ARCHETYPE_ID > 0) {
          archetypeId = (ratings as any).ARCHETYPE_ID;
          if (i < 5) {
            console.log(`[CreatorService V2] ${fullName}: Using BEST archetype ID ${archetypeId} (${(ratings as any).ARCHETYPE_NAME}) from rating generator`);
          }
        }
        // SECOND: Check if ArchetypeAssigner already calculated the ID (for players not in ROSTER_lookup)
        else if ((player as any).archetypeId !== undefined) {
          archetypeId = (player as any).archetypeId;
          if (i < 5) {
            console.log(`[CreatorService V2] ${fullName}: Using pre-calculated archetype ID ${archetypeId} from ArchetypeAssigner`);
          }
        } else if (player.archetype && player.archetype.trim() !== '') {
          // Convert archetype NAME from ROSTER_lookup to ID
          // ROSTER_lookup format: "QB_Improviser", "CB_MantoMan", "WR_DeepThreat"
          // archetypeService.getArchetypeId() expects: archetype name WITHOUT position prefix
          // archetype_lookup.csv format: "Improviser", "Man To Man", "Deep Threat"

          let archetypeName = player.archetype.trim();

          // ROSTER_lookup format: "QB_Improviser", "CB_MantoMan", "WR_DeepThreat"
          // Need to convert to: "QB Improviser", "CB Man To Man", "WR Deep Threat"

          // Step 1: Replace underscore with space
          archetypeName = archetypeName.replace('_', ' ');

          // Step 2: Add spaces before capital letters in the archetype part (after position)
          // Split into position and archetype parts
          const parts = archetypeName.split(' ');
          if (parts.length >= 2) {
            // parts[0] is position (e.g., "QB", "CB"), parts[1+] is archetype (e.g., "DeepThreat")
            const positionPrefix = parts[0];
            let archetypePart = parts.slice(1).join(' ');

            // Handle special cases
            if (archetypePart === 'MantoMan') {
              archetypePart = 'Man To Man';
            } else {
              // Add spaces before capital letters: "DeepThreat" -> "Deep Threat"
              archetypePart = archetypePart.replace(/([a-z])([A-Z])/g, '$1 $2');
            }

            archetypeName = `${positionPrefix} ${archetypePart}`;
          }

          archetypeId = archetypeService.getArchetypeId(archetypeName, mappedPosition.name);

          // Debug first 5 conversions and any failures
          if (i < 5 || archetypeId === 0) {
            console.log(`[CreatorService V2] ${fullName} (${mappedPosition.name}): "${player.archetype}" -> "${archetypeName}" -> ID ${archetypeId}`);
            if (archetypeId === 0) {
              console.error(`[CreatorService V2] ⚠️ FAILED ARCHETYPE LOOKUP for "${player.archetype}" -> "${archetypeName}"`);
            }
          }
        } else {
          // No archetype, use default for position
          archetypeId = archetypeService.getDefaultArchetypeForPosition(mappedPosition.name);
          if (i < 5) {
            console.log(`[CreatorService V2] ${fullName} (${mappedPosition.name}): No archetype data, using default archetype ID ${archetypeId}`);
          }
        }

        // CRITICAL: Ensure archetype is never 0 (would display as blank)
        if (archetypeId === 0 || archetypeId === undefined || archetypeId === null) {
          console.warn(`[CreatorService V2] ⚠️ Archetype ID is 0 for ${fullName} (${mappedPosition.name}), forcing default`);
          archetypeId = archetypeService.getDefaultArchetypeForPosition(mappedPosition.name);

          // If still 0, force a basic archetype based on position group
          if (archetypeId === 0) {
            // Fallback defaults by position
            const fallbackArchetypes: Record<string, number> = {
              'QB': 0, 'HB': 5, 'FB': 8, 'WR': 9, 'TE': 14,
              'LT': 17, 'LG': 17, 'C': 17, 'RG': 17, 'RT': 17,
              'LEDG': 33, 'REDG': 33, 'DT': 38,
              'SAM': 42, 'Mike': 42, 'WILL': 42,
              'CB': 46, 'FS': 52, 'SS': 52,
              'K': 56, 'P': 58
            };
            archetypeId = fallbackArchetypes[mappedPosition.name] || 0;
            console.warn(`[CreatorService V2] Using hardcoded fallback archetype ${archetypeId} for ${mappedPosition.name}`);
          }
        }

        // Apply minimum rating floor to prevent 0 ratings
        this.applyMinimumRatingFloor(maddenRatings);

        // Get CommID from player entry for in-game commentary
        const commID = player.commID ? parseInt(String(player.commID)) || 0 : 0;

        // Create generated player
        const generatedPlayer: GeneratedPlayer = {
          firstName,
          lastName,
          position: mappedPosition.name,
          positionCode: mappedPosition.code,
          college: collegeId,
          jerseyNum,
          age: this.calculateAge(player.draftClass ? parseInt(String(player.draftClass)) : options.year || 2024),
          heightInches: player.height || this.getDefaultHeight(player.position),
          weight: player.weight || this.getDefaultWeight(player.position),
          homeState,
          devTrait,
          ratings: maddenRatings,
          PID: pid,
          PAM: pam,
          PEPS: pam,
          bodyType,
          yearsPro: 0,
          archetype: archetypeId,  // NUMERIC archetype ID, not string
          commID: commID || undefined
        };

        // DEBUG: Log final generated player object for specific players
        if (fullName === 'Joe Burrow' || fullName.includes('Wills')) {
          console.log(`[CreatorService V2]   FINAL GeneratedPlayer object for ${fullName}:`);
          console.log(`[CreatorService V2]     position: "${generatedPlayer.position}"`);
          console.log(`[CreatorService V2]     positionCode: ${generatedPlayer.positionCode}`);
          console.log(`[CreatorService V2]     jerseyNum: ${generatedPlayer.jerseyNum}`);
          console.log(`[CreatorService V2]     archetype: "${generatedPlayer.archetype}"`);
          console.log(`[CreatorService V2]     PID: ${generatedPlayer.PID}`);
          console.log(`[CreatorService V2]     PAM: "${generatedPlayer.PAM}"`);
          console.log(`[CreatorService V2]     homeState: ${generatedPlayer.homeState}`);
          console.log(`[CreatorService V2]     ratings.overall: ${generatedPlayer.ratings.overall}`);
          console.log(`[CreatorService V2]     ratings.POVR: ${generatedPlayer.ratings.POVR}`);
          console.log(`[CreatorService V2]   ========================================\n`);
        }

        generatedPlayers.push(generatedPlayer);

        // Progress logging
        if ((i + 1) % 50 === 0) {
          console.log(`[CreatorService V2] Generated ${i + 1}/${players.length} players...`);
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`[CreatorService V2] ✓ Generated ${generatedPlayers.length} players in ${elapsed}ms (${(elapsed / generatedPlayers.length).toFixed(1)}ms/player)`);

      // Log final order to verify it matches input order
      console.log(`[CreatorService V2] ========== FINAL PLAYER ORDER ==========`);
      console.log(`[CreatorService V2] First 10 players in FINAL OUTPUT: ${generatedPlayers.slice(0, 10).map(p => `${p.firstName} ${p.lastName}`).join(', ')}...`);
      console.log(`[CreatorService V2] ==========================================`);

      // Debug: Check if specific high-profile players are included (for 2020 draft)
      if (options.year === 2020) {
        const burrow = generatedPlayers.find(p => p.lastName.toLowerCase() === 'burrow' && p.firstName.toLowerCase() === 'joe');
        const chase = generatedPlayers.find(p => p.lastName.toLowerCase() === 'young' && p.firstName.toLowerCase() === 'chase');
        const herbert = generatedPlayers.find(p => p.lastName.toLowerCase() === 'herbert' && p.firstName.toLowerCase() === 'justin');

        if (burrow) {
          const burrowIndex = generatedPlayers.findIndex(p => p === burrow);
          console.log(`[CreatorService V2] ✓ Joe Burrow found at position ${burrowIndex + 1}, OVR: ${burrow.ratings.overall || burrow.ratings.POVR}`);
        } else {
          console.warn(`[CreatorService V2] ⚠️ Joe Burrow NOT found in generated players!`);
        }

        if (chase) {
          const chaseIndex = generatedPlayers.findIndex(p => p === chase);
          console.log(`[CreatorService V2] ✓ Chase Young found at position ${chaseIndex + 1}, OVR: ${chase.ratings.overall || chase.ratings.POVR}`);
        }

        if (herbert) {
          const herbertIndex = generatedPlayers.findIndex(p => p === herbert);
          console.log(`[CreatorService V2] ✓ Justin Herbert found at position ${herbertIndex + 1}, OVR: ${herbert.ratings.overall || herbert.ratings.POVR}`);
        }
      }

      return generatedPlayers;

    } catch (error: any) {
      console.error('[CreatorService V2] Error generating draft class:', error);
      throw new Error(`Failed to generate draft class V2: ${error.message}`);
    }
  }

  /**
   * Convert EnrichedProspect[] (from FutureDraftService) to GeneratedPlayer[]
   * EnrichedProspects already have ratings, archetypes, and all necessary data
   */
  private async convertEnrichedProspectsToPlayers(prospects: EnrichedProspect[]): Promise<GeneratedPlayer[]> {
    console.log(`[CreatorService V2] Converting ${prospects.length} enriched prospects to GeneratedPlayer format`);

    const generatedPlayers: GeneratedPlayer[] = [];

    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];
      const firstName = prospect.firstName || 'John';
      const lastName = prospect.lastName || 'Doe';

      // Map position
      const mappedPosition = this.mapPosition(prospect.position);

      // PID matching (future prospects likely don't have PIDs, use generic)
      const raceData = prospect.race;
      const pid = this.assignGenericFace(firstName, lastName, prospect.position, raceData);
      const pam = this.assignGenericAsset(pid);

      // Match college
      const collegeId = prospect.college ? this.matchCollege(prospect.college) : 265;

      // Match home state
      const homeState = prospect.homestate ? this.matchHomeState(prospect.homestate) : 0;

      // Jersey number
      const jerseyNum = prospect.jersey || this.generateJerseyNumber(prospect.position);

      // Convert EnrichedProspect ratings to MaddenRatings format
      const maddenRatings = this.convertRookieStatsToMaddenRatings(prospect.ratings || {});

      // Determine dev trait based on wAV and overall
      const draftRound = prospect.round && prospect.round !== 'UD' ? parseInt(prospect.round) : undefined;
      const draftPick = prospect.pick && prospect.pick !== 'UD' ? parseInt(prospect.pick) : undefined;
      const devTrait = this.determineDevTrait(
        draftRound,
        draftPick,
        maddenRatings.POVR,
        false, // Future prospects can't be HOF yet
        prospect.wAV
      );

      // Body type
      const bodyType = this.determineBodyType(prospect.position, prospect.weight || 200, prospect.height || 72);

      // Archetype ID (already assigned by FutureDraftService)
      const archetypeId = prospect.archetypeId || 0;

      // Age (calculate from draft class year)
      const age = 21; // Default age for rookies

      // Get CommID if available
      const commID = prospect.commID ? parseInt(String(prospect.commID)) || 0 : 0;

      generatedPlayers.push({
        firstName,
        lastName,
        position: mappedPosition.name,
        positionCode: mappedPosition.code,
        college: collegeId,
        jerseyNum,
        age,
        heightInches: prospect.height || 72,
        weight: prospect.weight || 200,
        homeState,
        devTrait,
        ratings: maddenRatings,
        PID: pid,
        PAM: pam,
        PEPS: pam,
        bodyType,
        yearsPro: 0,
        archetype: archetypeId,  // NUMERIC archetype ID, not string
        commID: commID || undefined
      });
    }

    return generatedPlayers;
  }

  /**
   * Convert RookieStats (partial) to MaddenRatings format
   */
  private convertRookieStatsToMaddenRatings(stats: Partial<any>): MaddenRatings {
    return {
      overall: stats.povr || 65,
      POVR: stats.povr || 65,
      speed: stats.pspd || 70,
      acceleration: stats.pacc || 70,
      strength: stats.pstr || 65,
      agility: stats.pagi || 70,
      jumping: stats.pjmp || 65,
      stamina: stats.psta || 85,
      injury: stats.pinj || 85,
      toughness: stats.ptgh || 70,

      // QB ratings
      throwPower: stats.pthp || 65,
      throwAccuracyShort: stats.ptas || 65,
      throwAccuracyMid: stats.ptam || 65,
      throwAccuracyDeep: stats.ptad || 65,
      throwOnTheRun: stats.ptor || 65,
      throwUnderPressure: stats.ptup || 65,
      playAction: stats.ppla || 65,

      // RB/WR ratings
      carrying: stats.pcar || 65,
      ballCarrierVision: stats.pbcv || 65,
      breakTackle: stats.pbtk || 65,
      elusiveness: stats.pelu || 65,
      spinMove: stats.pspm || 65,
      jukeMove: stats.pjkm || 65,
      stiffArm: stats.psfa || 65,
      trucking: stats.ptrk || 65,
      catching: stats.pcth || 65,
      shortRouteRunning: stats.psrr || 65,
      mediumRouteRunning: stats.pmrr || 65,
      deepRouteRunning: stats.pdrr || 65,
      spectacularCatch: stats.pspc || 65,
      catchInTraffic: stats.pcit || 65,
      release: stats.prel || 65,

      // OL ratings
      passBlockPower: stats.ppbp || 65,
      passBlockFinesse: stats.ppbf || 65,
      runBlockPower: stats.prbp || 65,
      runBlockFinesse: stats.prbf || 65,
      runBlock: stats.prbk || 65,
      passBlock: stats.ppbk || 65,
      leadBlock: stats.plbk || 65,
      impactBlocking: stats.pibk || 65,

      // DL ratings
      powerMoves: stats.ppmv || 65,
      finesseMoves: stats.pfmv || 65,
      blockShedding: stats.pbsh || 65,
      pursuitChaseTackle: stats.pprc || 65,
      tackle: stats.ptak || 65,
      hitPower: stats.phtp || 65,

      // LB ratings
      playRecognition: stats.pprc || 65,

      // DB ratings
      manCoverage: stats.pman || 65,
      zoneCoverage: stats.pzon || 65,
      press: stats.pprs || 65,
      changeOfDirection: stats.pcod || 65,

      // Special teams
      kickPower: stats.pkpw || 65,
      kickAccuracy: stats.pkacc || 65,
      kickReturn: stats.pkrt || 65,

      // Additional attributes
      awareness: stats.pawr || 65
    };
  }

  /**
   * Shuffle array in place (Fisher-Yates algorithm)
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Generate a roster from web-scraped data
   * NOW WITH: College lookup, dev traits based on HOF+stats, stat minimums, position mapping
   * @param year - Season year
   * @param teams - Array of team abbreviations (e.g., ['dal', 'sea', 'ne'])
   * @param maxPlayers - Maximum number of players (from template roster, default 3000)
   * @param league - League filter (AFL/NFL for 1960-1969)
   * @param progressCallback - Progress callback function
   * @param ratingMode - Rating generation mode: 'random', 'semi-historical', or 'realistic'
   * @returns Array of generated players
   */
  async generateRoster(
    year: number,
    teams: string[],
    maxPlayers: number = 3000,
    league?: string,
    progressCallback?: (progress: number, message: string, currentTeam?: string) => void,
    ratingMode: string = 'semi-historical'
  ): Promise<GeneratedPlayer[]> {
    console.log(`[CreatorService] Generating roster for ${year} (${teams.length} teams, max ${maxPlayers} players, league: ${league || 'all'})`);

    try {
      const generatedPlayers: GeneratedPlayer[] = [];
      const ratingModeErrors: Array<{player: string, error: string}> = []; // Track errors for debugging

      // Step 0: Load MASTER_LOOKUP and team history
      console.log(`[CreatorService] Loading MASTER_LOOKUP...`);
      const masterLookup = this.loadMasterLookup();

      // Load team history for AFL/NFL filtering
      let teamHistory: any = null;
      try {
        const { app } = require('electron');
        const teamHistoryPath = path.join(app.getAppPath(), 'data', 'lookups', 'team_history.json');
        teamHistory = JSON.parse(fs.readFileSync(teamHistoryPath, 'utf-8'));

        // Filter teams by AFL/NFL if year 1960-1969
        if (league && year >= 1960 && year <= 1969) {
          const aflTeams = teamHistory.afl_teams['1960-1969'];
          const nflTeams = teamHistory.nfl_teams['1960-1969'];

          if (league.toLowerCase() === 'afl') {
            teams = teams.filter((t: string) => aflTeams.includes(t.toLowerCase()));
            console.log(`[CreatorService] Filtered to ${teams.length} AFL teams`);
          } else if (league.toLowerCase() === 'nfl') {
            teams = teams.filter((t: string) => nflTeams.includes(t.toLowerCase()));
            console.log(`[CreatorService] Filtered to ${teams.length} NFL teams`);
          }
          // 'combined' means use all teams (no filtering)
        }
      } catch (error) {
        console.warn('[CreatorService] Could not load team_history.json, skipping league filtering');
      }

      // AUTO-POPULATE TEAMS: If teams array is empty, get all teams that existed in this year
      if (teams.length === 0) {
        console.log(`[CreatorService] Teams array is empty - auto-populating teams for year ${year}...`);
        // Get all teams that existed in this year from the scraper service
        const allTeams = scraperService.getTeamsForYear(year);
        teams = allTeams;
        console.log(`[CreatorService] Auto-populated ${teams.length} teams: ${teams.slice(0, 5).join(', ')}...`);
      }

      // Step 1: Get HOF players active in this year
      // NOTE: getHOFPlayersByYear returns Map<string, boolean>
      // We need to also load the HOF lookup to get college data
      const hofPlayers = await scraperService.getHOFPlayersByYear(year);
      console.log(`[CreatorService] Found ${hofPlayers.size} potential HOF players active in ${year}`);

      // Step 1.5: Load HOF lookup data (has college info)
      (scraperService as any).loadHOFLookup(); // Force load HOF data
      const hofLookup = (scraperService as any).hofLookup; // Access private field

      // Step 1.7: Get Pro Bowl players for this year
      const proBowlers = await scraperService.scrapeProBowl(year);
      console.log(`[CreatorService] Found ${proBowlers.size} Pro Bowlers for ${year}`);

      // For each team, scrape roster
      for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {
        const teamAbbr = teams[teamIndex];
        console.log(`[CreatorService] ========== PROCESSING TEAM: ${teamAbbr.toUpperCase()} (${teamIndex + 1}/${teams.length}) ==========`);

        // Report progress with current team
        const teamProgress = Math.floor(10 + (teamIndex / teams.length) * 70); // 10-80% range for team processing
        progressCallback?.(teamProgress, `Processing ${teamAbbr.toUpperCase()} roster (${teamIndex + 1}/${teams.length})...`, teamAbbr.toUpperCase());

        // Check if team existed in this year
        const teamExisted = scraperService.teamExistedInYear(teamAbbr, year);
        console.log(`[CreatorService] Team ${teamAbbr} existed in ${year}: ${teamExisted}`);

        let roster: PlayerStats[] = [];

        if (!teamExisted) {
          console.log(`[CreatorService] ⚠️ ${teamAbbr} did not exist in ${year}, generating fictional roster (53 players with 30-40 OVR)`);
          // Generate 53 fictional players for teams that didn't exist (with low ratings for franchise mode)
          roster = this.generateFictionalRoster(teamAbbr, 53, true); // true = non-existent team
        } else {
          console.log(`[CreatorService] ✅ ${teamAbbr} existed, scraping roster and stats...`);

          // Step 1: Scrape roster from PFR (has name, position, height, weight, college, age, years pro)
          roster = await scraperService.scrapeTeamRoster(teamAbbr, year);
          console.log(`[CreatorService] ========== ROSTER SCRAPE RESULT FOR ${teamAbbr} (${year}) ==========`);
          console.log(`[CreatorService] ✓ Scraped ${roster.length} players from roster page`);
          console.log(`[CreatorService] ALL SCRAPED PLAYERS FROM PFR ROSTER PAGE:`);
          for (let i = 0; i < roster.length; i++) {
            console.log(`[CreatorService]   ${i + 1}. ${roster[i].name} (${roster[i].position})`);
          }
          console.log(`[CreatorService] ====================================================================`);

          if (roster.length === 0) {
            console.warn(`[CreatorService] ⚠️ WARNING: ${teamAbbr} scraper returned ZERO players, generating fictional roster instead!`);
            roster = this.generateFictionalRoster(teamAbbr, 53);
          } else {
            // Step 2: Scrape team stats to find additional player names not on roster page
            // This catches players like Bernie Kosar (supplemental draft) who appear in stats but not roster
            console.log(`[CreatorService] Scraping team stats to find additional players...`);
            const teamStats = await scraperService.scrapeTeamStats(teamAbbr, year);
            console.log(`[CreatorService] ✓ Found ${teamStats.size} players in team stats`);

            // Add any players from stats that aren't already in roster
            const rosterNames = new Set(roster.map(p => p.name));
            let addedCount = 0;

            for (const [name, stats] of teamStats.entries()) {
              if (!rosterNames.has(name)) {
                // This player appears in stats but not roster - add them with stats data
                roster.push({
                  name,
                  position: stats.position || 'WR',
                  // We don't have height/weight/age from stats page, will get from MASTER_LOOKUP or use defaults
                  college: 'Unknown',
                  ...stats // Include all the stats we scraped
                });
                addedCount++;
                console.log(`[CreatorService] ➕ Added ${name} from team stats (not on roster page)`);
              }
            }

            console.log(`[CreatorService] ✓ Added ${addedCount} additional players from team stats`);
            console.log(`[CreatorService] ========== FINAL ROSTER COUNT FOR ${teamAbbr} ==========`);
            console.log(`[CreatorService] TOTAL PLAYERS: ${roster.length}`);
            console.log(`[CreatorService] All player names:`);
            for (let i = 0; i < roster.length; i++) {
              console.log(`[CreatorService]   ${i + 1}. ${roster[i].name} (${roster[i].position})`);
            }
            console.log(`[CreatorService] ==========================================================`);
          }
        }

        console.log(`[CreatorService] Processing ${roster.length} players from ${teamAbbr}...`);

        // Track MASTER_LOOKUP match stats
        let matchedCount = 0;
        let notMatchedCount = 0;
        const notMatchedPlayers: string[] = [];

        // Convert each player to GeneratedPlayer
        for (let playerIdx = 0; playerIdx < roster.length; playerIdx++) {
          const playerStats = roster[playerIdx];

          // DEBUG: Detailed logging for EVERY player
          const debugDetail = playerIdx < 10; // Detailed logs for first 10 players

          if (debugDetail) {
            console.log(`\n[CreatorService] ===== PROCESSING PLAYER ${playerIdx + 1}/${roster.length} =====`);
            console.log(`[CreatorService] Name: "${playerStats.name}"`);
            console.log(`[CreatorService] Position: "${playerStats.position}"`);
          }

          // Parse name
          const nameParts = playerStats.name.split(' ');
          const firstName = nameParts[0] || 'John';
          const lastName = nameParts.slice(1).join(' ') || 'Doe';

          // **NEW: MATCH PLAYER TO MASTER_LOOKUP**
          console.log(`[CreatorService] 🔍 LOOKUP DEBUG: Searching for "${firstName}" "${lastName}" in year ${year}`);
          const lookupEntry = this.findPlayerInMASTERLookup(firstName, lastName, year);
          console.log(`[CreatorService] 🔍 LOOKUP DEBUG: Result for ${firstName} ${lastName} = ${lookupEntry ? 'FOUND (PID=' + lookupEntry['PhotoID'] + ')' : 'NOT FOUND'}`);

          let proRatedWAV = 0;
          let weight = playerStats.weight || 0;
          let heightInches = 0;
          let raceData: string | undefined = undefined;
          let playerAssetId: string | undefined = undefined;
          let matchedPID = 0; // Initialize PID for PID matching
          let draftYear: number | undefined = undefined;
          let collegeName = playerStats.college || 'Unknown';

          if (lookupEntry) {
            matchedCount++;
            if (debugDetail) {
              console.log(`[CreatorService] ✅ MATCHED to MASTER_LOOKUP`);
            }
          } else {
            notMatchedCount++;
            notMatchedPlayers.push(`${firstName} ${lastName}`);
            if (debugDetail) {
              console.log(`[CreatorService] ❌ NOT FOUND in MASTER_LOOKUP - will use fallback ratings`);
            }
          }

          if (lookupEntry) {
            // Extract career wAV and calculate pro-rated wAV
            const careerWAV = parseFloat(lookupEntry['wAV']) || 0;
            const from = parseInt(lookupEntry['From']) || year;
            const to = parseInt(lookupEntry['To']) || year;

            // **CALCULATE PRO-RATED wAV**
            const totalYears = to - from + 1;
            const yearsPlayed = year - from + 1;
            proRatedWAV = this.calculateProRatedWAV(careerWAV, totalYears, yearsPlayed);

            if (debugDetail) {
              console.log(`[CreatorService] 📊 wAV: Career=${careerWAV}, Pro-rated=${proRatedWAV.toFixed(2)} (${yearsPlayed}/${totalYears} years)`);
            }

            // Get height/weight from MASTER_LOOKUP if missing from scrape
            if (!weight && lookupEntry['Weight']) {
              weight = parseInt(lookupEntry['Weight']) || 0;
            }
            if (lookupEntry['Height']) {
              heightInches = parseInt(lookupEntry['Height']) || 0;
            }

            // Get race data for generic face matching
            raceData = lookupEntry['Race'] || undefined;

            // Get PID directly from MASTER_LOOKUP (don't re-search with matchPID)
            const lookupPID = parseInt(lookupEntry['PhotoID']);
            if (!isNaN(lookupPID) && lookupPID > 0) {
              matchedPID = lookupPID;
              console.log(`[CreatorService] Using PhotoID from MASTER_LOOKUP for ${firstName} ${lastName}: ${matchedPID}`);
            }

            // Get PAM (Player Assets ID) from MASTER_LOOKUP
            playerAssetId = lookupEntry['Player Assets ID'] || undefined;

            // Get draft year for years pro calculation
            draftYear = parseInt(lookupEntry['Draft Class']) || undefined;

            // Get college from MASTER_LOOKUP if not scraped
            // Note: CSV header is 'College/Univ', not 'College'
            if (collegeName === 'Unknown' && lookupEntry['College/Univ']) {
              collegeName = lookupEntry['College/Univ'];
            }
          }

          // Check if player is HOF (still useful for logging)
          const isHOF = hofPlayers.has(playerStats.name);
          if (debugDetail && isHOF) {
            console.log(`[CreatorService] 🏆 HALL OF FAMER DETECTED!`);
          }

          // Get college: use HOF lookup if available
          if (isHOF && hofLookup) {
            const hofData = hofLookup.get(playerStats.name);
            if (hofData && hofData.college) {
              collegeName = hofData.college;
              console.log(`[CreatorService] 🏆 Using HOF college data for ${playerStats.name}: ${collegeName}`);
            }
          }

          // **HISTORICAL POSITION MAPPING** (replaces mapPosition)
          const mappedPosition = this.mapHistoricalPosition(
            playerStats.position,
            year,
            weight,
            heightInches
          );
          if (debugDetail) {
            console.log(`[CreatorService] Position mapped: "${playerStats.position}" -> "${mappedPosition.name}" (code ${mappedPosition.code})`);
          }

          // **GENERATE RATINGS BASED ON SELECTED MODE**
          const isNonExistentTeam = (playerStats as any)._isNonExistentTeam || false;
          let ratings: MaddenRatings;

          if (ratingMode === 'random' || ratingMode === 'realistic' || ratingMode === 'variance' || ratingMode === 'madden') {
            // Use rating mode factory for all supported rating modes
            try {
              const generator = RatingModeFactory.create(ratingMode as RatingMode);
              const playerAge = playerStats.age || this.calculateAge(year, yearsPro);

              // For roster mode with 'madden' ratings, we need the current year stats (not rookie year)
              // The draftClass in careerStats is the draft year for rookies, but for roster players
              // we use yearsPro to determine their experience level, and year is their current roster year
              const generatedRatings = await generator.generateRatings({
                position: mappedPosition.name,
                age: playerAge,
                name: playerStats.name,
                yearsExperience: yearsPro,
                // Roster players don't have draft position/round
                draftPosition: undefined,
                draftRound: undefined,
                // Include careerStats - for roster players, set draftClass to (year - yearsPro)
                // to allow proper rookie year lookup
                careerStats: {
                  draftClass: yearsPro > 0 ? year - yearsPro : year,  // Calculate draft year from years of experience
                  wAV: proRatedWAV || 0,
                  archetype: '',
                  height: heightInches || 0,
                  weight: weight || 0
                }
              });

              // Convert from factory format to MaddenRatings format
              ratings = this.convertFactoryRatingsToMaddenRatings(generatedRatings, ratingMode);

              if (debugDetail) {
                console.log(`[CreatorService] ✅ Using ${ratingMode} mode ratings: OVR ${ratings.overall}`);
              }

            } catch (error) {
              console.error(`[CreatorService] Error using rating mode ${ratingMode}, falling back to wAV:`, error);
              // Fall back to wAV-based generation
              ratings = proRatedWAV > 0
                ? this.generateRatingsFromWAV(proRatedWAV, mappedPosition.name, false, false)
                : this.generateFillerRatings(mappedPosition.name, isNonExistentTeam);
            }
          } else {
            // Semi-historical mode: use existing logic (wAV -> stats -> default)
            if (proRatedWAV > 0) {
              // Use wAV-based ratings (already accounts for position scaling)
              // isRookie=false for roster players (allows up to 99 OVR)
              ratings = this.generateRatingsFromWAV(proRatedWAV, mappedPosition.name, false, false);

              if (debugDetail) {
                console.log(`[CreatorService] ✅ Using wAV-based ratings: OVR ${ratings.overall}`);
              }
            } else {
              // Fallback: No wAV data found - use generic ratings
              // For non-existent teams use low ratings, otherwise use average starter ratings
              if (isNonExistentTeam) {
                ratings = this.generateFillerRatings(mappedPosition.name, true); // 30-40 OVR for retro franchise
              } else {
                // Generate average starter ratings (65-70 OVR)
                // isRookie=false for roster players
                ratings = this.generateRatingsFromWAV(10, mappedPosition.name, false, false); // 10 wAV = average backup

                // Boost for HOF/Pro Bowl players if no wAV data available
                const isProBowler = proBowlers.has(playerStats.name);
                if (isHOF) {
                  // HOF without wAV data = assume high career value
                  ratings = this.generateRatingsFromWAV(120, mappedPosition.name, false, false); // Elite tier
                  if (debugDetail) console.log(`[CreatorService] 🏆 HOF player without wAV - using Elite tier (120 wAV)`);
                } else if (isProBowler) {
                  // Pro Bowler without wAV data = assume quality starter
                  ratings = this.generateRatingsFromWAV(40, mappedPosition.name, false, false); // Quality starter tier
                  if (debugDetail) console.log(`[CreatorService] ⭐ Pro Bowl player without wAV - using Quality Starter tier (40 wAV)`);
                }
              }

              if (debugDetail) {
                console.log(`[CreatorService] ℹ️ Using fallback ratings (no wAV data): OVR ${ratings.overall}`);
              }
            }
          }

          // Fill missing ratings (ensures NO blanks)
          this.fillMissingRatings(ratings, mappedPosition.name);

          // Cap ratings by position (veterans can exceed 80 OVR)
          this.capRatingsByPosition(ratings, mappedPosition.name, false);

          // **CALCULATE YEARS PRO FROM DRAFT YEAR** (more accurate than age estimation)
          let yearsPro = 0;
          if (draftYear) {
            yearsPro = year - draftYear;
            if (debugDetail) {
              console.log(`[CreatorService] Years Pro: ${yearsPro} (${year} - ${draftYear})`);
            }
          } else if (playerStats.yearsPro !== undefined && playerStats.yearsPro !== null) {
            // Use scraped value ("Rook" becomes 0, numbers are parsed)
            yearsPro = playerStats.yearsPro;
          } else {
            // Fallback: estimate from age (assume NFL entry at 22)
            const playerAge = playerStats.age || 25;
            yearsPro = Math.max(0, playerAge - 22);
          }

          // Parse height if needed
          if (heightInches === 0 && playerStats.height) {
            heightInches = this.parseHeight(playerStats.height);
          }
          if (heightInches === 0) {
            heightInches = this.generateHeight(mappedPosition.name);
          }

          // Validate weight
          if (weight > 400 || weight < 150 || weight === 0) {
            if (debugDetail && weight > 400) {
              console.warn(`[CreatorService] ⚠️ Invalid weight ${weight} for ${playerStats.name}, using default for ${mappedPosition.name}`);
            }
            weight = this.getDefaultWeight(mappedPosition.name);
          }

          // Convert weight to Madden offset format (actual - 160)
          const maddenWeight = this.convertWeightToMaddenFormat(weight);

          // Calculate age
          const playerAge = playerStats.age || (yearsPro > 0 ? 22 + yearsPro : 25);

          // Use scraped jersey number if available, otherwise generate
          const jerseyNum = (playerStats as any).jerseyNumber || this.generateJerseyNumber(mappedPosition.name);

          // **MATCH PID** - Only search if not already found from MASTER_LOOKUP
          if (matchedPID === 0) {
            matchedPID = this.matchPID(firstName, lastName, draftYear, mappedPosition.name, collegeName);
          }

          // Check for (R) tag and replace with preferred non-(R) version
          if (matchedPID > 0) {
            matchedPID = this.getPreferredPID(matchedPID, `${firstName} ${lastName}`);
          }

          // If no real portrait found, assign generic face with race data
          if (matchedPID === 0) {
            console.log(`[CreatorService] ⚠️ NO PID FOUND for ${firstName} ${lastName} - assigning generic face (raceData=${raceData})`);
            matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name, raceData);
            console.log(`[CreatorService] Assigned generic PID: ${matchedPID}`);
          } else {
            console.log(`[CreatorService] ✅ Using PID ${matchedPID} for ${firstName} ${lastName}`);
          }

          // Match college to valid college ID
          const matchedCollege = this.matchCollege(collegeName);

          // Match homestate (generate if not available)
          const homeStateId = this.matchHomeState(this.generateHomeState());

          // **DETERMINE DEV TRAIT FROM wAV** (replaces HOF = X-Factor logic)
          const devTrait = this.determineDevTrait(
            undefined, // round
            undefined, // pick
            ratings.overall,
            isHOF,
            proRatedWAV  // Use pro-rated wAV for dev trait calculation
          );

          // Get CommID from MASTER_LOOKUP for in-game commentary
          const commID = lookupEntry ? parseInt(lookupEntry['CommID']) || 0 : 0;

          const player: GeneratedPlayer = {
            firstName,
            lastName,
            position: mappedPosition.name,
            positionCode: mappedPosition.code,
            college: matchedCollege,
            team: teamAbbr.toUpperCase(),
            jerseyNum,
            age: playerAge,
            heightInches,
            weight: maddenWeight,
            homeState: homeStateId,
            devTrait,
            ratings,
            PID: matchedPID,
            PEPS: playerAssetId || null, // Load PAM from MASTER_LOOKUP if available
            bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
            yearsPro,
            race: raceData ? parseInt(raceData) || undefined : undefined, // Race from MASTER_LOOKUP for skin tone matching
            commID: commID || undefined,
            _sourceStats: playerStats
          };

          if (isHOF || proRatedWAV > 60) {
            console.log(`[CreatorService] ⭐ Notable player: ${playerStats.name} (${mappedPosition.name}) - OVR ${ratings.overall}, wAV ${proRatedWAV.toFixed(1)}, Dev Trait ${devTrait}`);
          }

          generatedPlayers.push(player);
        }

        // Log MASTER_LOOKUP match statistics
        console.log(`[CreatorService] ========== MASTER_LOOKUP MATCH STATS FOR ${teamAbbr} ==========`);
        console.log(`[CreatorService] Total players processed: ${roster.length}`);
        console.log(`[CreatorService] ✅ Matched to MASTER_LOOKUP: ${matchedCount} (${(matchedCount / roster.length * 100).toFixed(1)}%)`);
        console.log(`[CreatorService] ❌ NOT found in MASTER_LOOKUP: ${notMatchedCount} (${(notMatchedCount / roster.length * 100).toFixed(1)}%)`);
        if (notMatchedPlayers.length > 0) {
          console.log(`[CreatorService] Players NOT in MASTER_LOOKUP:`);
          for (let i = 0; i < Math.min(20, notMatchedPlayers.length); i++) {
            console.log(`[CreatorService]   - ${notMatchedPlayers[i]}`);
          }
          if (notMatchedPlayers.length > 20) {
            console.log(`[CreatorService]   ... and ${notMatchedPlayers.length - 20} more`);
          }
        }
        console.log(`[CreatorService] ================================================================`);

        // Pad roster to 53 players if needed
        const teamPlayerCount = roster.length;
        const targetRosterSize = 53;

        if (teamPlayerCount < targetRosterSize) {
          const playersNeeded = targetRosterSize - teamPlayerCount;
          console.log(`[CreatorService] ⚠️ ${teamAbbr} only has ${teamPlayerCount} players, generating ${playersNeeded} filler players to reach ${targetRosterSize}`);

          // Generate filler players for this team
          const fillerRoster = this.generateFictionalRoster(teamAbbr, playersNeeded);

          // Process filler players the same way as scraped players
          for (const fillerStats of fillerRoster) {
            // Parse name
            const nameParts = fillerStats.name.split(' ');
            const firstName = nameParts[0] || 'John';
            const lastName = nameParts.slice(1).join(' ') || 'Doe';

            // Map position
            const mappedPosition = this.mapPosition(fillerStats.position);

            // Calculate age
            const age = fillerStats.age || 22;

            // Parse height
            const heightParts = fillerStats.height.split('-');
            const heightInches = (parseInt(heightParts[0]) * 12) + parseInt(heightParts[1] || '0');

            // Weight
            const weight = fillerStats.weight;

            // Convert weight to Madden offset format (actual - 160)
            const maddenWeight = this.convertWeightToMaddenFormat(weight);

            // Match college using the same method as real players
            const matchedCollege = this.matchCollege(fillerStats.college || 'Unknown');

            // Match home state using the same method as real players
            const homeStateId = this.matchHomeState(this.generateHomeState());

            // Generate low ratings for filler players (backup/practice squad level)
            const ratings = this.generateFillerRatings(mappedPosition.name);

            // Dev trait (mostly Normal, some Star Potential for young players)
            const devTrait = age <= 23 && Math.random() < 0.15 ? 1 : 0; // 15% Star for young players

            // Assign generic face to fictional players
            const genericPID = this.assignGenericFace(firstName, lastName, mappedPosition.name);

            // Assign generic asset matching the generic face
            const genericAsset = this.assignGenericAsset(genericPID, undefined);

            const fillerPlayer: GeneratedPlayer = {
              firstName,
              lastName,
              position: mappedPosition.name,
              positionCode: mappedPosition.code,
              team: teamAbbr.toUpperCase(),
              jerseyNum: 50 + Math.floor(Math.random() * 50),
              yearsPro: 0,
              college: matchedCollege,
              age,
              heightInches,
              weight: maddenWeight,
              homeState: homeStateId,
              devTrait,
              ratings,
              PID: genericPID, // Use generic face for fictional players
              PEPS: genericAsset,
              bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
              _sourceStats: fillerStats
            };

            generatedPlayers.push(fillerPlayer);
          }

          console.log(`[CreatorService] ✓ Added ${playersNeeded} filler players to ${teamAbbr}, now has ${teamPlayerCount + playersNeeded} total`);
        } else {
          console.log(`[CreatorService] ✓ ${teamAbbr} already has ${teamPlayerCount} players (target: ${targetRosterSize})`);
        }
      }

      console.log(`[CreatorService] Generated ${generatedPlayers.length} total players`);
      console.log(`[CreatorService] HOF players with X-Factor: ${generatedPlayers.filter(p => p.devTrait === 3).length}`);

      scraperDebugLogger.log(`\n============================================`);
      scraperDebugLogger.log(`*** ABOUT TO GENERATE FREE AGENT POOL ***`);
      scraperDebugLogger.log(`============================================\n`);

      console.log(`[CreatorService] ============================================`);
      console.log(`[CreatorService] *** ABOUT TO GENERATE FREE AGENT POOL ***`);
      console.log(`[CreatorService] ============================================`);

      // Generate free agent pool to match template roster size
      // Use the maxPlayers from template to determine how many FAs we can fit
      const teamPlayerCount = generatedPlayers.length;
      const targetTotalPlayers = maxPlayers; // Use template roster size
      const freeAgentsNeeded = Math.max(0, targetTotalPlayers - teamPlayerCount);

      scraperDebugLogger.log(`Team player count: ${teamPlayerCount}`);
      scraperDebugLogger.log(`Target total: ${targetTotalPlayers}`);
      scraperDebugLogger.log(`Free agents needed: ${freeAgentsNeeded}\n`);

      console.log(`[CreatorService] Team player count: ${teamPlayerCount}`);
      console.log(`[CreatorService] Target total: ${targetTotalPlayers}`);
      console.log(`[CreatorService] Free agents needed: ${freeAgentsNeeded}`);

      if (freeAgentsNeeded > 0) {
        scraperDebugLogger.log(`========================================`);
        scraperDebugLogger.log(`Generating Free Agent Pool`);
        scraperDebugLogger.log(`Current players: ${teamPlayerCount}`);
        scraperDebugLogger.log(`Target total: ${targetTotalPlayers}`);
        scraperDebugLogger.log(`Free agents needed: ${freeAgentsNeeded}`);
        scraperDebugLogger.log(`========================================\n`);

        console.log(`[CreatorService] ========================================`);
        console.log(`[CreatorService] Generating Free Agent Pool`);
        console.log(`[CreatorService] Current players: ${teamPlayerCount}`);
        console.log(`[CreatorService] Target total: ${targetTotalPlayers}`);
        console.log(`[CreatorService] Free agents needed: ${freeAgentsNeeded}`);
        console.log(`[CreatorService] ========================================`);

        // Build set of existing player names to exclude from UFA pool
        const existingPlayerNames = new Set<string>();
        for (const player of generatedPlayers) {
          existingPlayerNames.add(`${player.firstName} ${player.lastName}`);
        }

        // Generate real UFAs from MASTER_LOOKUP (undrafted players from last 5 years)
        const ufaEntries = this.generateUFAsFromLookup(year, existingPlayerNames, freeAgentsNeeded);
        scraperDebugLogger.log(`Found ${ufaEntries.length} real UFAs from MASTER_LOOKUP\n`);

        // If not enough real UFAs, fill remainder with fictional players
        let freeAgentRoster: any[] = [];
        if (ufaEntries.length < freeAgentsNeeded) {
          const fictionalNeeded = freeAgentsNeeded - ufaEntries.length;
          freeAgentRoster = this.generateFictionalRoster('FA', fictionalNeeded);
          console.log(`[CreatorService] Not enough UFAs (${ufaEntries.length}), generating ${fictionalNeeded} fictional FAs`);
        }

        // Process REAL UFAs from MASTER_LOOKUP first
        for (const ufaEntry of ufaEntries) {
          const firstName = ufaEntry['First Name'] || 'John';
          const lastName = ufaEntry['Last Name'] || 'Doe';
          const draftYear = parseInt(ufaEntry['Draft Class']) || year - 1;
          const yearsPro = year - draftYear;

          // Get wAV and calculate pro-rated value
          const careerWAV = parseFloat(ufaEntry['wAV']) || 0;
          const from = parseInt(ufaEntry['From']) || draftYear;
          const to = parseInt(ufaEntry['To']) || year;
          const totalYears = to - from + 1;
          const yearsPlayed = year - from + 1;
          const proRatedWAV = this.calculateProRatedWAV(careerWAV, totalYears, yearsPlayed);

          // Map position
          const position = ufaEntry['Position'] || 'WR';
          const height = parseInt(ufaEntry['Height']) || 0;
          const weight = parseInt(ufaEntry['Weight']) || 0;
          const mappedPosition = this.mapHistoricalPosition(position, year, weight, height);

          // Generate ratings from wAV
          // isRookie=false for UFAs (veteran free agents, not draft prospects)
          const ratings = proRatedWAV > 0
            ? this.generateRatingsFromWAV(proRatedWAV, mappedPosition.name, false, false)
            : this.generateFillerRatings(mappedPosition.name);

          // Fill missing ratings
          this.fillMissingRatings(ratings, mappedPosition.name);
          this.capRatingsByPosition(ratings, mappedPosition.name, false); // UFAs are veterans

          // Other attributes
          const heightInches = height > 0 ? height : this.generateHeight(mappedPosition.name);
          const maddenWeight = this.convertWeightToMaddenFormat(weight > 0 ? weight : this.getDefaultWeight(mappedPosition.name));
          const college = this.matchCollege(ufaEntry['College/Univ'] || 'Unknown');
          const homeStateId = this.matchHomeState(this.generateHomeState());
          const age = 22 + yearsPro; // Rookie at 22
          const jerseyNum = this.generateJerseyNumber(mappedPosition.name);
          const raceData = ufaEntry['Race'] || undefined;

          // Match PID with race data
          let matchedPID = this.matchPID(firstName, lastName, draftYear, mappedPosition.name, ufaEntry['College/Univ']);

          // Check for (R) tag and replace with preferred non-(R) version
          if (matchedPID > 0) {
            matchedPID = this.getPreferredPID(matchedPID, `${firstName} ${lastName}`);
          }

          if (matchedPID === 0) {
            matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name, raceData);
          }

          // Assign generic asset for UFA players (no real assets in MASTER_LOOKUP)
          const ufaAsset = this.assignGenericAsset(matchedPID, raceData);

          // Dev trait from wAV
          const devTrait = this.determineDevTrait(undefined, undefined, ratings.overall, false, proRatedWAV);

          // Get CommID from ufaEntry for in-game commentary
          const ufaCommID = parseInt(ufaEntry['CommID']) || 0;

          const freeAgent: GeneratedPlayer = {
            firstName,
            lastName,
            position: mappedPosition.name,
            positionCode: mappedPosition.code,
            team: 'FA',
            jerseyNum,
            yearsPro,
            college,
            age,
            heightInches,
            weight: maddenWeight,
            homeState: homeStateId,
            devTrait,
            ratings,
            PID: matchedPID,
            PEPS: ufaAsset,
            bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
            commID: ufaCommID || undefined,
            _sourceStats: null
          };

          generatedPlayers.push(freeAgent);
        }

        console.log(`[CreatorService] ✓ Added ${ufaEntries.length} real UFAs from MASTER_LOOKUP`);

        // Process FICTIONAL free agents if needed
        for (const faStats of freeAgentRoster) {
          const nameParts = faStats.name.split(' ');
          const firstName = nameParts[0] || 'John';
          const lastName = nameParts.slice(1).join(' ') || 'Doe';

          const mappedPosition = this.mapPosition(faStats.position);
          const age = faStats.age || 24; // FAs tend to be younger

          const heightParts = faStats.height.split('-');
          const heightInches = (parseInt(heightParts[0]) * 12) + parseInt(heightParts[1] || '0');
          const weight = faStats.weight;
          const maddenWeight = this.convertWeightToMaddenFormat(weight);

          const matchedCollege = this.matchCollege(faStats.college || 'Unknown');
          const homeStateId = this.matchHomeState(this.generateHomeState());

          // Free agents: lower ratings (50-70 overall range)
          const ratings = this.generateFillerRatings(mappedPosition.name);

          // Dev trait (mostly Normal, occasional Star for young FAs)
          const devTrait = age <= 23 && Math.random() < 0.10 ? 1 : 0; // 10% Star for young FAs

          // Assign generic face to fictional free agents
          const genericPID = this.assignGenericFace(firstName, lastName, mappedPosition.name);

          // Assign generic asset matching the generic face
          const faAsset = this.assignGenericAsset(genericPID, undefined);

          const freeAgent: GeneratedPlayer = {
            firstName,
            lastName,
            position: mappedPosition.name,
            positionCode: mappedPosition.code,
            team: 'FA', // Free Agent team code
            jerseyNum: Math.floor(Math.random() * 100),
            yearsPro: Math.floor(Math.random() * 3), // 0-2 years pro
            college: matchedCollege,
            age,
            heightInches,
            weight: maddenWeight,
            homeState: homeStateId,
            devTrait,
            ratings,
            PID: genericPID, // Use generic face for fictional FAs
            PEPS: faAsset,
            bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
            _sourceStats: faStats
          };

          generatedPlayers.push(freeAgent);
        }

        scraperDebugLogger.log(`✓ Added ${freeAgentsNeeded} free agents`);
        scraperDebugLogger.log(`Final roster size: ${generatedPlayers.length} players\n`);

        console.log(`[CreatorService] ✓ Added ${freeAgentsNeeded} free agents`);
        console.log(`[CreatorService] Final roster size: ${generatedPlayers.length} players`);
      } else {
        scraperDebugLogger.log(`No free agents needed (already have ${teamPlayerCount} players)\n`);
      }

      // Close browser when done
      await scraperService.closeBrowser();

      // Log rating mode errors if any occurred
      if (ratingModeErrors.length > 0) {
        console.error(`\n[CreatorService] ⚠️  RATING MODE ERRORS (${ratingModeErrors.length} total):`);
        ratingModeErrors.forEach((err, idx) => {
          console.error(`  ${idx + 1}. ${err.player}`);
          console.error(`     ${err.error}\n`);
        });
      }

      return generatedPlayers;

    } catch (error: any) {
      console.error('[CreatorService] Error generating roster:', error);
      await scraperService.closeBrowser();
      throw new Error(`Failed to generate roster: ${error.message}`);
    }
  }

  /**
   * Normalize QB ratings for Madden 26 OVR calculation compatibility.
   * Historical Madden games (14-25) had different OVR formulas that didn't heavily weight
   * PTUP (Throw Under Pressure) and PBSK (Break Sack). Madden 26 weights these significantly:
   * - PBSK: 10% of QB Scrambler OVR
   * - PTUP: 7% of QB Scrambler OVR
   *
   * This function estimates reasonable values when the CSV has suspiciously low ratings
   * that would cause the calculated OVR to be much lower than the stored POVR.
   */
  private normalizeQBRatingsForM26(factoryRatings: any): any {
    const position = String(factoryRatings.Position || factoryRatings.PPOS || '').toUpperCase();

    // Only normalize for QBs
    if (position !== 'QB' && position !== '0') {
      return factoryRatings;
    }

    const result = { ...factoryRatings };

    // Calculate average throwing accuracy as baseline
    const throwAccAvg = Math.round(
      ((factoryRatings.PTAS || 50) + (factoryRatings.PTAM || 50) + (factoryRatings.PTAD || 50)) / 3
    );
    const targetOVR = factoryRatings.POVR || 70;

    // PTUP (Throw Under Pressure) - should be close to throw accuracy average for good QBs
    // If CSV value is more than 30 points below throw accuracy average, it's likely incorrect
    const ptup = factoryRatings.PTUP || 0;
    if (ptup < 40 || (throwAccAvg - ptup > 30)) {
      // Estimate based on throw accuracy with some variance
      result.PTUP = Math.max(50, Math.min(99, throwAccAvg - 5 + Math.floor(Math.random() * 10) - 5));
      console.log(`[CreatorService] Normalized PTUP for QB: ${ptup} -> ${result.PTUP} (based on avg throw acc: ${throwAccAvg})`);
    }

    // PBSK (Break Sack) - for mobile QBs this should be higher
    // If CSV value is below 40, estimate based on speed/agility
    const pbsk = factoryRatings.PBSK || factoryRatings.PBRS || 0;
    const speedAgility = Math.round(((factoryRatings.PSPD || 70) + (factoryRatings.PAGI || 70)) / 2);
    if (pbsk < 40 || (speedAgility - pbsk > 40)) {
      // Estimate based on speed/agility average with variance
      result.PBSK = Math.max(50, Math.min(95, speedAgility - 10 + Math.floor(Math.random() * 10) - 5));
      console.log(`[CreatorService] Normalized PBSK for QB: ${pbsk} -> ${result.PBSK} (based on spd/agi avg: ${speedAgility})`);
    }

    // Also normalize awareness if it's suspiciously low for the target OVR
    const pawr = factoryRatings.PAWR || 50;
    if (targetOVR >= 75 && pawr < 55) {
      result.PAWR = Math.max(60, Math.min(99, targetOVR - 15 + Math.floor(Math.random() * 10) - 5));
      console.log(`[CreatorService] Normalized PAWR for QB: ${pawr} -> ${result.PAWR} (based on target OVR: ${targetOVR})`);
    }

    return result;
  }

  /**
   * Convert factory PlayerRatings format to MaddenRatings format
   * @param factoryRatings - Ratings from the rating generator
   * @param ratingMode - Rating mode ('madden' = use exact values, others = use defaults for missing values)
   */
  private convertFactoryRatingsToMaddenRatings(factoryRatings: any, ratingMode?: string): MaddenRatings {
    // For Madden mode, use EXACT values from CSV with NO defaults
    // This preserves the actual rookie ratings
    if (ratingMode === 'madden') {
      // Normalize QB ratings to ensure M26 OVR calculation works correctly
      const normalized = this.normalizeQBRatingsForM26(factoryRatings);

      return {
        overall: normalized.POVR,
        speed: normalized.PSPD,
        acceleration: normalized.PACC,
        agility: normalized.PAGI,
        strength: normalized.PSTR,
        jumping: normalized.PJMP,
        stamina: normalized.PSTA,
        injury: normalized.PINJ,
        toughness: normalized.PTGH,
        awareness: normalized.PAWR,
        throwAccuracyDeep: normalized.PTAD,
        throwAccuracyMid: normalized.PTAM,
        throwAccuracyShort: normalized.PTAS,
        throwPower: normalized.PTHP,
        throwUnderPressure: normalized.PTUP,
        throwOnTheRun: normalized.PTOR,
        playAction: normalized.PPLA,
        breakSack: normalized.PBSK,
        carrying: factoryRatings.PCAR,
        ballCarrierVision: factoryRatings.PBCV,
        breakTackle: factoryRatings.PBTK,
        trucking: factoryRatings.PTRK,
        jukeMove: factoryRatings.PJUM,
        spinMove: factoryRatings.PSPM,
        stiffArm: factoryRatings.PSTF,
        changeOfDirection: factoryRatings.PCOD,
        catching: factoryRatings.PCTH,
        catchInTraffic: factoryRatings.PCIT,
        spectacularCatch: factoryRatings.PSPC,
        release: factoryRatings.PREL,
        deepRouteRunning: factoryRatings.PDRR,
        mediumRouteRunning: factoryRatings.PMRR,
        shortRouteRunning: factoryRatings.PSRR,
        runBlock: factoryRatings.PRBK,
        passBlock: factoryRatings.PPBK,
        impactBlocking: factoryRatings.PIBL,
        leadBlock: factoryRatings.PLDB,
        runBlockFinesse: factoryRatings.PRBF,
        runBlockPower: factoryRatings.PRBP,
        passBlockFinesse: factoryRatings.PPBF,
        passBlockPower: factoryRatings.PPBP,
        tackle: factoryRatings.PTAK,
        pursuit: factoryRatings.PPUR,
        playRecognition: factoryRatings.PPRC,
        hitPower: factoryRatings.PHTP,
        blockShedding: factoryRatings.PBSH,
        finesseMoves: factoryRatings.PFNM,
        powerMoves: factoryRatings.PPWM,
        manCoverage: factoryRatings.PMCV,
        zoneCoverage: factoryRatings.PZCV,
        press: factoryRatings.PPRS,
        kickPower: factoryRatings.PKPW,
        kickAccuracy: factoryRatings.PKAC,
        kickReturn: factoryRatings.PKRT
      };
    }

    // For other modes, use defaults for missing values
    return {
      overall: factoryRatings.POVR || 65,
      speed: factoryRatings.PSPD || 75,
      acceleration: factoryRatings.PACC || 75,
      agility: factoryRatings.PAGI || 75,
      strength: factoryRatings.PSTR || 75,
      jumping: factoryRatings.PJMP || 70,
      stamina: factoryRatings.PSTA || 85,
      injury: factoryRatings.PINJ || 85,
      toughness: factoryRatings.PTGH || 75,
      awareness: factoryRatings.PAWR || 65,
      throwAccuracyDeep: factoryRatings.PTAD || 65,
      throwAccuracyMid: factoryRatings.PTAM || 65,
      throwAccuracyShort: factoryRatings.PTAS || 65,
      throwPower: factoryRatings.PTHP || 75,
      throwUnderPressure: factoryRatings.PTUP || 65,
      throwOnTheRun: factoryRatings.PTOR || 65,
      playAction: factoryRatings.PPLA || 65,
      breakSack: factoryRatings.PBSK || 60,
      carrying: factoryRatings.PCAR || 65,
      ballCarrierVision: factoryRatings.PBCV || 65,
      breakTackle: factoryRatings.PBKT || 65,
      trucking: factoryRatings.PLTR || 60,
      jukeMove: factoryRatings.PLJM || 65,
      spinMove: factoryRatings.PLSM || 65,
      stiffArm: factoryRatings.PLSA || 60,
      changeOfDirection: factoryRatings.PELU || 75,
      catching: factoryRatings.PCTH || 65,
      catchInTraffic: factoryRatings.PLCI || 65,
      spectacularCatch: factoryRatings.PLSC || 60,
      release: factoryRatings.PLRL || 70,
      deepRouteRunning: factoryRatings.PDRR || 65,
      mediumRouteRunning: factoryRatings.PMRR || 65,
      shortRouteRunning: factoryRatings.SRRN || 65,
      runBlock: factoryRatings.PRBK || 50,
      passBlock: factoryRatings.PPBK || 50,
      impactBlocking: factoryRatings.PLIB || 50,
      leadBlock: factoryRatings.PLBK || 50,
      runBlockFinesse: factoryRatings.PRBF || 50,
      runBlockPower: factoryRatings.PRBS || 50,
      passBlockFinesse: factoryRatings.PPBF || 50,
      passBlockPower: factoryRatings.PPBS || 50,
      tackle: factoryRatings.PTAK || 60,
      pursuit: factoryRatings.PLPU || 65,
      playRecognition: factoryRatings.PLPR || 60,
      hitPower: factoryRatings.PLHT || 60,
      blockShedding: factoryRatings.PBSG || 60,
      finesseMoves: factoryRatings.PFMS || 60,
      powerMoves: factoryRatings.PLPM || 60,
      manCoverage: factoryRatings.PLMC || 60,
      zoneCoverage: factoryRatings.PLZC || 60,
      pressCoverage: factoryRatings.PLPE || 60,
      kickAccuracy: factoryRatings.PKAC || 65,
      kickPower: factoryRatings.PKPR || 65,
      kickReturn: factoryRatings.PKRT || 1,
      longSnap: 30 // Not in factory format
    };
  }

  /**
   * Convert DraftProspect career stats to PlayerStats format for rating calculation
   */
  private convertProspectToPlayerStats(prospect: DraftProspect): PlayerStats {
    return {
      name: prospect.name,
      position: prospect.position,
      college: prospect.college,
      height: prospect.height,
      weight: prospect.weight,
      age: prospect.age,

      // Passing
      passAttempts: prospect.passAttempts,
      passCompletions: prospect.passCompletions,
      passYards: prospect.passYards,
      passTDs: prospect.passTDs,
      interceptions: prospect.passInts,

      // Rushing
      rushAttempts: prospect.rushAttempts,
      rushYards: prospect.rushYards,
      rushTDs: prospect.rushTDs,

      // Receiving
      receptions: prospect.receptions,
      recYards: prospect.recYards,
      recTDs: prospect.recTDs,

      // Defense
      tackles: prospect.soloTackles,
      interceptionsCaught: prospect.defensiveInts,
      sacks: prospect.sacks
    };
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
   * wAV (Weighted Approximate Value) Rating Tiers
   * Used to calculate ratings from career performance data
   * BOOSTED for realistic ratings - elite players should be in 90s!
   */
  private readonly WAV_TIERS = [
    { name: 'Hall of Fame Legend', minWAV: 150, maxWAV: 999, baseOVR: 93, ovrRange: 6, devTraitWeight: 3.0 },  // 93-99 OVR
    { name: 'Elite', minWAV: 100, maxWAV: 149, baseOVR: 88, ovrRange: 5, devTraitWeight: 2.5 },                // 88-93 OVR
    { name: 'Pro Bowl', minWAV: 60, maxWAV: 99, baseOVR: 83, ovrRange: 5, devTraitWeight: 2.0 },               // 83-88 OVR
    { name: 'Quality Starter', minWAV: 30, maxWAV: 59, baseOVR: 77, ovrRange: 6, devTraitWeight: 1.5 },        // 77-83 OVR
    { name: 'Average Starter', minWAV: 15, maxWAV: 29, baseOVR: 72, ovrRange: 5, devTraitWeight: 1.0 },        // 72-77 OVR
    { name: 'Backup', minWAV: 5, maxWAV: 14, baseOVR: 66, ovrRange: 6, devTraitWeight: 0.5 },                  // 66-72 OVR
    { name: 'Bust', minWAV: 0, maxWAV: 4, baseOVR: 60, ovrRange: 6, devTraitWeight: 0.1 }                      // 60-66 OVR
  ];

  /**
   * Position scaling factors for OVR calculation
   * Premium positions get slight boost, devalued positions get slight penalty
   */
  private readonly POSITION_SCALING: { [key: string]: number } = {
    'QB': 1.05,     // QB premium
    'LEDG': 1.03,   // Elite pass rusher premium
    'REDG': 1.03,   // Elite pass rusher premium
    'LT': 1.02,     // Blind side protector premium
    'CB': 1.02,     // Elite coverage premium
    'HB': 1.0,      // Standard scaling
    'WR': 1.0,
    'TE': 1.0,
    'RT': 1.0,
    'LG': 1.0,
    'C': 1.0,
    'RG': 1.0,
    'DT': 1.0,
    'SAM': 1.0,
    'Mike': 1.0,
    'WILL': 1.0,
    'FS': 1.0,
    'SS': 1.0,
    'FB': 0.97,     // Fullback devaluation
    'K': 0.95,      // Kicker devaluation
    'P': 0.95,      // Punter devaluation
    'LS': 0.93      // Long snapper devaluation
  };

  /**
   * Calculate base OVR from wAV (career performance)
   * Includes position scaling
   * @param wAV - Weighted Approximate Value from MASTER_LOOKUP
   * @param position - Player position (for scaling)
   * @param isHOF - Hall of Fame flag (overrides to high tier)
   * @param isRookie - If true, cap at 80 OVR (draft prospects). If false, allow up to 99 OVR (roster players)
   * @returns Base OVR (before attribute distribution)
   */
  private calculateBaseOVRFromWAV(wAV: number, position: string, isHOF: boolean = false, isRookie: boolean = true): number {
    // HOF players always get elite tier minimum
    if (isHOF && wAV < 150) {
      wAV = 150;
    }

    // Find appropriate tier
    let tier = this.WAV_TIERS[this.WAV_TIERS.length - 1]; // Default to lowest tier
    for (const t of this.WAV_TIERS) {
      if (wAV >= t.minWAV && wAV <= t.maxWAV) {
        tier = t;
        break;
      }
    }

    // Calculate base OVR with variation
    const variation = (Math.random() * 2 - 1) * tier.ovrRange; // Random +/- range
    let baseOVR = tier.baseOVR + variation;

    // Apply position scaling
    const scaling = this.POSITION_SCALING[position] || 1.0;
    if (scaling !== 1.0) {
      baseOVR *= scaling;
      console.log(`[CreatorService] Position scaling for ${position}: ${scaling}x`);
    }

    // Clamp to valid range
    // Rookies capped at 80, roster players can go up to 99
    const maxOVR = isRookie ? 80 : 99;
    baseOVR = Math.max(50, Math.min(maxOVR, Math.round(baseOVR)));

    console.log(`[CreatorService] wAV ${wAV} -> Tier "${tier.name}" -> Base OVR ${baseOVR} (position: ${position}, ${isRookie ? 'ROOKIE' : 'VETERAN'})`);

    return baseOVR;
  }

  /**
   * Generate default ratings for a prospect when stats aren't available
   * Uses draft position as a proxy for talent
   * FALLBACK: Use wAV-based ratings if available from MASTER_LOOKUP
   */
  private generateDefaultRatings(prospect: DraftProspect): MaddenRatings {
    const round = prospect.round || 7;
    const pick = prospect.pick || 250;

    // Higher draft pick = better base ratings
    let baseOverall = 75;
    if (round === 0) {
      // UDFAs: 52-60 overall (lower tier)
      baseOverall = 52 + Math.random() * 8;
    } else if (round === 1) {
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
   * Generate ratings based on wAV tier system
   * Uses calculateBaseOVRFromWAV() to get target OVR, then distributes attributes
   */
  private generateRatingsFromWAV(wAV: number, position: string, isHallOfFamer: boolean = false, isRookie: boolean = false): MaddenRatings {
    // Get base OVR from wAV tier system
    const baseOVR = this.calculateBaseOVRFromWAV(wAV, position, isHallOfFamer, isRookie);

    // Create mock stats with career performance hint
    const mockStats: PlayerStats = {
      name: 'wAV-Based Player',
      position: position,
      college: 'Unknown',
      // Add hints for rating calculator based on wAV tier
      gamesPlayed: wAV > 100 ? 200 : wAV > 60 ? 150 : wAV > 30 ? 100 : 50
    };

    // Generate position-appropriate ratings using calculator
    const ratings = ratingCalculator.calculateRatings(mockStats);

    // Scale all ratings based on target OVR
    // Calculate current average rating to determine scale factor
    const ratingValues = Object.values(ratings).filter(v => typeof v === 'number') as number[];
    const currentAvg = ratingValues.reduce((sum, val) => sum + val, 0) / ratingValues.length;
    const scaleFactor = baseOVR / currentAvg;

    // Apply scaling to all ratings (except overall which we'll calculate)
    Object.keys(ratings).forEach(key => {
      if (key !== 'overall' && typeof ratings[key] === 'number') {
        ratings[key] = Math.max(40, Math.min(99, Math.round(ratings[key] * scaleFactor)));
      }
    });

    // Set overall to our target
    ratings.overall = baseOVR;

    console.log(`[CreatorService] Generated wAV-based ratings: OVR ${baseOVR} (wAV=${wAV}, pos=${position})`);

    return ratings;
  }

  /**
   * Generate low ratings for filler/backup players
   * These are practice squad / backup level players (50-60 OVR)
   */
  private generateFillerRatings(position: string, isNonExistentTeam: boolean = false): MaddenRatings {
    // Generate position-appropriate ratings with low base stats
    const mockStats: PlayerStats = {
      name: 'Filler Player',
      position: position,
      college: 'Weber State'
    };

    // Use rating calculator to get position-appropriate ratings
    const ratings = ratingCalculator.calculateRatings(mockStats);

    // Scale down ratings based on team existence
    // Non-existent teams: 30-40 OVR (retro franchise mode ease)
    // Filler players: 50-60 OVR (backup/practice squad level)
    const scaleFactor = isNonExistentTeam ? 0.45 : 0.68; // 45% or 68% of default ratings
    const minRating = isNonExistentTeam ? 30 : 50;

    const scaledRatings: MaddenRatings = {
      overall: Math.max(minRating, Math.floor(ratings.overall * scaleFactor)),
      speed: Math.max(minRating, Math.floor(ratings.speed * scaleFactor)),
      acceleration: Math.max(minRating, Math.floor(ratings.acceleration * scaleFactor)),
      agility: Math.max(minRating, Math.floor(ratings.agility * scaleFactor)),
      strength: Math.max(minRating, Math.floor(ratings.strength * scaleFactor)),
      awareness: Math.max(minRating, Math.floor(ratings.awareness * scaleFactor)),
      catching: Math.max(minRating, Math.floor(ratings.catching * scaleFactor)),
      carrying: Math.max(minRating, Math.floor(ratings.carrying * scaleFactor)),
      throwPower: Math.max(minRating, Math.floor(ratings.throwPower * scaleFactor)),
      throwAccuracy: Math.max(minRating, Math.floor(ratings.throwAccuracy * scaleFactor)),
      shortThrowAccuracy: Math.max(minRating, Math.floor(ratings.shortThrowAccuracy * scaleFactor)),
      mediumThrowAccuracy: Math.max(minRating, Math.floor(ratings.mediumThrowAccuracy * scaleFactor)),
      deepThrowAccuracy: Math.max(minRating, Math.floor(ratings.deepThrowAccuracy * scaleFactor)),
      runBlock: Math.max(minRating, Math.floor(ratings.runBlock * scaleFactor)),
      passBlock: Math.max(minRating, Math.floor(ratings.passBlock * scaleFactor)),
      tackle: Math.max(minRating, Math.floor(ratings.tackle * scaleFactor)),
      hitPower: Math.max(minRating, Math.floor(ratings.hitPower * scaleFactor)),
      manCoverage: Math.max(minRating, Math.floor(ratings.manCoverage * scaleFactor)),
      zoneCoverage: Math.max(minRating, Math.floor(ratings.zoneCoverage * scaleFactor)),
      press: Math.max(minRating, Math.floor(ratings.press * scaleFactor)),
      pursuit: Math.max(minRating, Math.floor(ratings.pursuit * scaleFactor)),
      playRecognition: Math.max(minRating, Math.floor(ratings.playRecognition * scaleFactor)),
      blockShedding: Math.max(minRating, Math.floor(ratings.blockShedding * scaleFactor)),
      finesseMoves: Math.max(minRating, Math.floor(ratings.finesseMoves * scaleFactor)),
      powerMoves: Math.max(minRating, Math.floor(ratings.powerMoves * scaleFactor)),
      jumping: Math.max(minRating, Math.floor(ratings.jumping * scaleFactor)),
      stamina: Math.max(minRating + 10, Math.floor(ratings.stamina * scaleFactor)),
      injury: Math.max(minRating + 10, Math.floor(ratings.injury * scaleFactor)),
      toughness: Math.max(minRating + 10, Math.floor(ratings.toughness * scaleFactor)),
      kickPower: Math.max(minRating, Math.floor(ratings.kickPower * scaleFactor)),
      kickAccuracy: Math.max(minRating, Math.floor(ratings.kickAccuracy * scaleFactor)),
      kickReturn: Math.max(minRating, Math.floor(ratings.kickReturn * scaleFactor))
    };

    return scaledRatings;
  }

  /**
   * Determine dev trait based on draft position, overall, and wAV
   * NOW WITH: wAV-based tier system (prioritizes career performance over draft position)
   */
  private determineDevTrait(round?: number, pick?: number, overall?: number, isHallOfFamer?: boolean, wAV?: number): number {
    // 🏆 Hall of Famers ALWAYS get X-Factor dev trait!
    if (isHallOfFamer) {
      return 3; // X-Factor
    }

    // Use wAV tier if available (career performance is king!)
    if (wAV !== undefined && wAV > 0) {
      // Find tier
      let tier = this.WAV_TIERS[this.WAV_TIERS.length - 1];
      for (const t of this.WAV_TIERS) {
        if (wAV >= t.minWAV && wAV <= t.maxWAV) {
          tier = t;
          break;
        }
      }

      // Roll for dev trait based on tier weight
      const roll = Math.random();

      if (tier.devTraitWeight >= 3.0) {
        return 3; // X-Factor (HOF tier)
      } else if (tier.devTraitWeight >= 2.5 && roll < 0.7) {
        return 3; // X-Factor (70% for Elite tier)
      } else if (tier.devTraitWeight >= 2.0 && roll < 0.5) {
        return 2; // Superstar (50% for Pro Bowl tier)
      } else if (tier.devTraitWeight >= 1.5 && roll < 0.3) {
        return 2; // Superstar (30% for Quality Starter)
      } else if (tier.devTraitWeight >= 1.0 && roll < 0.2) {
        return 1; // Star (20% for Average Starter)
      } else if (tier.devTraitWeight >= 0.5 && roll < 0.1) {
        return 1; // Star (10% for Backups)
      }

      return 0; // Normal (everyone else)
    }

    // Fallback to draft position logic if no wAV
    // UDFAs always get Normal dev trait
    if (round === 0) {
      return 0; // Normal
    }

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
   * Convert actual weight (lbs) to Madden offset format
   * Madden stores weight as offset from 160 lbs
   * Example: 220 lbs = 60 (220 - 160)
   * @param actualWeight - Player's actual weight in pounds
   * @returns Madden weight offset value
   */
  private convertWeightToMaddenFormat(actualWeight: number): number {
    const MADDEN_WEIGHT_BASE = 160;
    const offset = actualWeight - MADDEN_WEIGHT_BASE;

    // Validate: offset should be between 0 and 200 (160-360 lbs actual)
    if (offset < 0) {
      console.warn(`[CreatorService] ⚠️ Weight ${actualWeight} lbs is below minimum (160 lbs), clamping to 160`);
      return 0;
    }
    if (offset > 200) {
      console.warn(`[CreatorService] ⚠️ Weight ${actualWeight} lbs is above maximum (360 lbs), clamping to 360`);
      return 200;
    }

    return offset;
  }

  /**
   * Generate realistic height for a position (in inches)
   * Returns a random height within realistic range for each position
   */
  private generateHeight(position: string): number {
    const pos = position.toUpperCase();

    // Height ranges: [min, max] in inches
    const heightRanges: { [key: string]: [number, number] } = {
      // Skill positions - shorter/average
      'QB': [73, 77],     // 6'1" - 6'5"
      'HB': [68, 73],     // 5'8" - 6'1"
      'FB': [71, 74],     // 5'11" - 6'2"
      'WR': [69, 76],     // 5'9" - 6'4"
      'TE': [75, 79],     // 6'3" - 6'7"

      // Offensive Line - tallest
      'LT': [76, 80],     // 6'4" - 6'8"
      'LG': [74, 78],     // 6'2" - 6'6"
      'C': [73, 77],      // 6'1" - 6'5"
      'RG': [74, 78],     // 6'2" - 6'6"
      'RT': [76, 80],     // 6'4" - 6'8"

      // Defensive Line - tall
      'LEDG': [74, 78],   // 6'2" - 6'6"
      'REDG': [74, 78],   // 6'2" - 6'6"
      'DT': [73, 77],     // 6'1" - 6'5"

      // Linebackers - average/tall
      'SAM': [73, 77],    // 6'1" - 6'5"
      'Mike': [72, 76],   // 6'0" - 6'4"
      'WILL': [72, 76],   // 6'0" - 6'4"

      // Secondary - shorter/average
      'CB': [68, 74],     // 5'8" - 6'2"
      'FS': [70, 75],     // 5'10" - 6'3"
      'SS': [71, 75],     // 5'11" - 6'3"

      // Specialists - average
      'K': [70, 74],      // 5'10" - 6'2"
      'P': [71, 76],      // 5'11" - 6'4"
      'LS': [72, 76]      // 6'0" - 6'4"
    };

    const range = heightRanges[pos] || [70, 75]; // Default 5'10" - 6'3"
    const [min, max] = range;

    return Math.floor(Math.random() * (max - min + 1)) + min;
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
   * Get default height for a position (in inches)
   */
  private getDefaultHeight(position: string): number {
    const heightByPosition: { [key: string]: number } = {
      'QB': 75, 'HB': 70, 'FB': 72, 'WR': 73, 'TE': 77,
      'LT': 77, 'LG': 75, 'C': 75, 'RG': 75, 'RT': 77,
      'LEDG': 75, 'REDG': 75, 'DT': 75, 'NT': 74,
      'SAM': 74, 'Mike': 73, 'WILL': 73,
      'CB': 71, 'FS': 72, 'SS': 72,
      'K': 72, 'P': 74, 'LS': 74
    };

    return heightByPosition[position.toUpperCase()] || 73; // Default 6'1"
  }

  /**
   * Determine body type based on position, weight, and height
   * Returns Madden body type STRING: "Thin", "Muscular", "Heavy"
   * These are the ONLY valid values for draft class visuals JSON
   */
  private determineBodyType(position: string, weight?: number, height?: number): string {
    const pos = position.toUpperCase();
    const w = weight || this.getDefaultWeight(position);
    const h = height || 73; // Default 6'1"

    // Ensure we have valid numbers
    if (!w || !h || w <= 0 || h <= 0) {
      console.warn(`[CreatorService] Invalid weight/height for body type: w=${w}, h=${h}, using default Muscular`);
      return 'Muscular'; // Default Muscular
    }

    // CORRECT Madden body types: "Thin", "Muscular", "Heavy"
    // These are the only valid values for draft class JSON
    const bmi = (w / (h * h)) * 703; // Calculate BMI

    // HB should ALWAYS be Muscular - never Heavy (causes fat appearance)
    if (['HB', 'QB'].includes(pos)) {
      return 'Muscular'; // RBs and QBs are always Muscular
    } else if (['WR', 'CB', 'FS'].includes(pos)) {
      return bmi < 24 ? 'Thin' : 'Muscular'; // Thin for lean receivers/DBs, Muscular otherwise
    } else if (['FB', 'SAM', 'MIKE', 'WILL', 'SS', 'TE'].includes(pos)) {
      return bmi < 28 ? 'Muscular' : 'Heavy'; // Higher threshold - only very large players get Heavy
    } else if (['LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT'].includes(pos)) {
      return 'Heavy'; // Linemen are Heavy
    } else {
      return 'Muscular'; // Default Muscular
    }
  }

  /**
   * Fill missing ratings with defaults (30 for most, 1 for longSnap if not LS)
   * Ensures NO ratings are blank/null/undefined/NaN/0
   */
  private fillMissingRatings(ratings: MaddenRatings, position: string): void {
    // ALL possible rating keys in Madden
    const allRatingKeys: (keyof MaddenRatings)[] = [
      'speed', 'acceleration', 'agility', 'changeOfDirection', 'strength', 'awareness', 'jumping', 'stamina', 'injury', 'toughness',
      'throwPower', 'throwAccuracyShort', 'throwAccuracyMid', 'throwAccuracyDeep',
      'throwOnTheRun', 'throwUnderPressure', 'playAction', 'breakSack',
      'carrying', 'ballCarrierVision', 'breakTackle', 'trucking', 'stiffArm', 'spinMove', 'jukeMove',
      'catching', 'catchInTraffic', 'spectacularCatch', 'shortRouteRunning',
      'mediumRouteRunning', 'deepRouteRunning', 'release',
      'passBlock', 'passBlockPower', 'passBlockFinesse', 'runBlock', 'runBlockPower', 'runBlockFinesse', 'leadBlock', 'impactBlocking',
      'tackle', 'hitPower', 'powerMoves', 'finesseMoves', 'blockShedding', 'pursuit',
      'playRecognition', 'manCoverage', 'zoneCoverage', 'pressCoverage',
      'kickPower', 'kickAccuracy', 'kickReturn', 'longSnap',
      'overall'
    ];

    const pos = position.toUpperCase();
    const isLongSnapper = pos === 'LS';

    for (const key of allRatingKeys) {
      const value = ratings[key];

      // Check if value is missing, invalid, or 0
      if (value === undefined || value === null || isNaN(value as number) || value === 0) {
        // longSnap special case: 1 for non-long snappers, 30 for LS
        if (key === 'longSnap') {
          ratings[key] = (isLongSnapper ? 30 : 1) as any;
        } else {
          ratings[key] = 30 as any;
        }
      }
    }

    // DEBUG: Log any remaining zero/undefined values after fill
    const stillMissing: string[] = [];
    for (const key of allRatingKeys) {
      const value = ratings[key];
      if (value === undefined || value === null || isNaN(value as number) || value === 0) {
        stillMissing.push(`${key}=${value}`);
      }
    }
    if (stillMissing.length > 0) {
      console.warn(`[CreatorService] After fillMissingRatings, still have ${stillMissing.length} missing ratings: ${stillMissing.join(', ')}`);
    }
  }

  /**
   * Check if player has strong stats worthy of a rating boost
   * @param stats - Player stats
   * @param position - Madden position name
   * @returns True if player has strong stats for their position
   */
  private hasStrongStats(stats: PlayerStats, position: string): boolean {
    const pos = position.toUpperCase();

    // QB: Strong passing stats
    if (pos === 'QB') {
      const passAttempts = stats.passAttempts || 0;
      const completions = stats.passCompletions || 0;
      const compPct = passAttempts > 0 ? (completions / passAttempts) * 100 : 0;
      const tds = stats.passTDs || 0;
      const yards = stats.passYards || 0;
      return passAttempts >= 200 && (compPct >= 60 || tds >= 15 || yards >= 2500);
    }

    // RB: Strong rushing stats
    if (pos === 'HB' || pos === 'FB') {
      const rushAttempts = stats.rushAttempts || 0;
      const rushYards = stats.rushYards || 0;
      const rushTDs = stats.rushTDs || 0;
      return rushAttempts >= 100 && (rushYards >= 600 || rushTDs >= 5);
    }

    // WR/TE: Strong receiving stats
    if (pos === 'WR' || pos === 'TE') {
      const receptions = stats.receptions || 0;
      const recYards = stats.recYards || 0;
      const recTDs = stats.recTDs || 0;
      return receptions >= 30 && (recYards >= 500 || recTDs >= 4);
    }

    // DB: Strong defensive back stats
    if (pos === 'CB' || pos === 'FS' || pos === 'SS') {
      const tackles = stats.tackles || 0;
      const ints = stats.interceptionsCaught || 0;
      const passDefended = stats.passDefended || 0;
      return tackles >= 40 || ints >= 3 || passDefended >= 8;
    }

    // LB: Strong linebacker stats
    if (pos === 'SAM' || pos === 'Mike' || pos === 'WILL') {
      const tackles = stats.tackles || 0;
      const sacks = stats.sacks || 0;
      return tackles >= 60 || sacks >= 3;
    }

    // DL: Strong defensive line stats
    if (pos === 'LEDG' || pos === 'REDG' || pos === 'DT') {
      const tackles = stats.tackles || 0;
      const sacks = stats.sacks || 0;
      return tackles >= 30 || sacks >= 5;
    }

    return false;
  }

  /**
   * Apply Hall of Fame rating boost
   * HOFers should have elite ratings (85-99 overall)
   * @param ratings - Ratings to boost
   * @param position - Madden position name
   * @param stats - Player stats for context
   */
  private applyHOFBoost(ratings: MaddenRatings, position: string, stats: PlayerStats): void {
    const pos = position.toUpperCase();

    // Boost overall to HOF level (85-95 range)
    ratings.overall = Math.max(ratings.overall, 85);

    // Boost awareness (HOFers have high football IQ)
    ratings.awareness = Math.min(99, ratings.awareness + 15);

    // Position-specific boosts
    if (pos === 'QB') {
      ratings.throwPower = Math.min(99, ratings.throwPower + 10);
      ratings.throwAccuracyShort = Math.min(99, ratings.throwAccuracyShort + 12);
      ratings.throwAccuracyMid = Math.min(99, ratings.throwAccuracyMid + 12);
      ratings.throwAccuracyDeep = Math.min(99, ratings.throwAccuracyDeep + 10);
    } else if (pos === 'HB') {
      ratings.speed = Math.min(99, ratings.speed + 5);
      ratings.acceleration = Math.min(99, ratings.acceleration + 5);
      ratings.carrying = Math.min(99, ratings.carrying + 10);
      ratings.ballCarrierVision = Math.min(99, ratings.ballCarrierVision + 12);
      ratings.breakTackle = Math.min(99, ratings.breakTackle + 10);
    } else if (pos === 'WR') {
      ratings.speed = Math.min(99, ratings.speed + 5);
      ratings.catching = Math.min(99, ratings.catching + 12);
      ratings.spectacularCatch = Math.min(99, ratings.spectacularCatch + 10);
      ratings.shortRouteRunning = Math.min(99, ratings.shortRouteRunning + 10);
      ratings.mediumRouteRunning = Math.min(99, ratings.mediumRouteRunning + 10);
      ratings.deepRouteRunning = Math.min(99, ratings.deepRouteRunning + 10);
    } else if (pos === 'CB') {
      ratings.speed = Math.min(99, ratings.speed + 5);
      ratings.manCoverage = Math.min(99, ratings.manCoverage + 18);  // Increased from +12
      ratings.zoneCoverage = Math.min(99, ratings.zoneCoverage + 18);  // Increased from +12
      ratings.pressCoverage = Math.min(99, ratings.pressCoverage + 15);  // Increased from +10
    } else if (pos === 'FS' || pos === 'SS') {
      ratings.speed = Math.min(99, ratings.speed + 5);
      ratings.zoneCoverage = Math.min(99, ratings.zoneCoverage + 16);  // Increased from +12
      ratings.manCoverage = Math.min(99, ratings.manCoverage + 14);  // Increased from +10
      ratings.tackle = Math.min(99, ratings.tackle + 8);
    } else if (pos === 'SAM' || pos === 'Mike' || pos === 'WILL') {
      ratings.tackle = Math.min(99, ratings.tackle + 18);  // Increased from +12
      ratings.hitPower = Math.min(99, ratings.hitPower + 10);
      ratings.pursuit = Math.min(99, ratings.pursuit + 10);
      ratings.playRecognition = Math.min(99, ratings.playRecognition + 12);
      ratings.strength = Math.min(99, ratings.strength + 8);  // Added strength boost
    } else if (pos === 'LEDG' || pos === 'REDG' || pos === 'DT') {
      ratings.powerMoves = Math.min(99, ratings.powerMoves + 18);  // Increased from +12
      ratings.finesseMoves = Math.min(99, ratings.finesseMoves + 16);  // Increased from +10
      ratings.blockShedding = Math.min(99, ratings.blockShedding + 12);
      ratings.tackle = Math.min(99, ratings.tackle + 10);
      ratings.strength = Math.min(99, ratings.strength + 15);  // Added strength boost
    } else if (pos === 'TE') {
      ratings.catching = Math.min(99, ratings.catching + 10);
      ratings.runBlock = Math.min(99, ratings.runBlock + 10);
      ratings.passBlock = Math.min(99, ratings.passBlock + 8);
    } else if (pos === 'LT' || pos === 'RT' || pos === 'LG' || pos === 'RG' || pos === 'C') {
      ratings.passBlock = Math.min(99, ratings.passBlock + 12);
      ratings.runBlock = Math.min(99, ratings.runBlock + 12);
      ratings.awareness = Math.min(99, ratings.awareness + 10);
      ratings.strength = Math.min(99, ratings.strength + 15);  // Added strength boost
    }

    // Recalculate overall after boosts
    ratings.overall = Math.max(ratings.overall, Math.min(95, Math.floor(ratings.overall * 1.15)));
  }

  /**
   * Apply Pro Bowl rating boost
   * Pro Bowlers should have high ratings (80-92 overall)
   * @param ratings - Ratings to boost
   * @param position - Madden position name
   * @param stats - Player stats for context
   */
  private applyProBowlBoost(ratings: MaddenRatings, position: string, stats: PlayerStats): void {
    const pos = position.toUpperCase();

    // Boost overall to Pro Bowl level (80-92 range)
    ratings.overall = Math.max(ratings.overall, 80);

    // Moderate awareness boost
    ratings.awareness = Math.min(99, ratings.awareness + 10);

    // Position-specific boosts (smaller than HOF)
    if (pos === 'QB') {
      ratings.throwPower = Math.min(99, ratings.throwPower + 7);
      ratings.throwAccuracyShort = Math.min(99, ratings.throwAccuracyShort + 8);
      ratings.throwAccuracyMid = Math.min(99, ratings.throwAccuracyMid + 8);
      ratings.throwAccuracyDeep = Math.min(99, ratings.throwAccuracyDeep + 7);
    } else if (pos === 'HB') {
      ratings.speed = Math.min(99, ratings.speed + 3);
      ratings.acceleration = Math.min(99, ratings.acceleration + 3);
      ratings.carrying = Math.min(99, ratings.carrying + 8);
      ratings.ballCarrierVision = Math.min(99, ratings.ballCarrierVision + 8);
      ratings.breakTackle = Math.min(99, ratings.breakTackle + 7);
    } else if (pos === 'WR') {
      ratings.speed = Math.min(99, ratings.speed + 3);
      ratings.catching = Math.min(99, ratings.catching + 8);
      ratings.spectacularCatch = Math.min(99, ratings.spectacularCatch + 7);
      ratings.shortRouteRunning = Math.min(99, ratings.shortRouteRunning + 8);
      ratings.mediumRouteRunning = Math.min(99, ratings.mediumRouteRunning + 8);
    } else if (pos === 'CB') {
      ratings.speed = Math.min(99, ratings.speed + 3);
      ratings.manCoverage = Math.min(99, ratings.manCoverage + 14);  // Increased from +8
      ratings.zoneCoverage = Math.min(99, ratings.zoneCoverage + 14);  // Increased from +8
      ratings.pressCoverage = Math.min(99, ratings.pressCoverage + 12);  // Increased from +7
    } else if (pos === 'FS' || pos === 'SS') {
      ratings.speed = Math.min(99, ratings.speed + 3);
      ratings.zoneCoverage = Math.min(99, ratings.zoneCoverage + 12);  // Increased from +8
      ratings.manCoverage = Math.min(99, ratings.manCoverage + 10);  // Increased from +7
      ratings.tackle = Math.min(99, ratings.tackle + 6);
    } else if (pos === 'SAM' || pos === 'Mike' || pos === 'WILL') {
      ratings.tackle = Math.min(99, ratings.tackle + 14);  // Increased from +8
      ratings.hitPower = Math.min(99, ratings.hitPower + 7);
      ratings.pursuit = Math.min(99, ratings.pursuit + 7);
      ratings.playRecognition = Math.min(99, ratings.playRecognition + 8);
      ratings.strength = Math.min(99, ratings.strength + 6);  // Added strength boost
    } else if (pos === 'LEDG' || pos === 'REDG' || pos === 'DT') {
      ratings.powerMoves = Math.min(99, ratings.powerMoves + 14);  // Increased from +8
      ratings.finesseMoves = Math.min(99, ratings.finesseMoves + 12);  // Increased from +7
      ratings.blockShedding = Math.min(99, ratings.blockShedding + 8);
      ratings.tackle = Math.min(99, ratings.tackle + 7);
      ratings.strength = Math.min(99, ratings.strength + 12);  // Added strength boost
    } else if (pos === 'TE') {
      ratings.catching = Math.min(99, ratings.catching + 8);
      ratings.runBlock = Math.min(99, ratings.runBlock + 7);
      ratings.passBlock = Math.min(99, ratings.passBlock + 6);
    } else if (pos === 'LT' || pos === 'RT' || pos === 'LG' || pos === 'RG' || pos === 'C') {
      ratings.passBlock = Math.min(99, ratings.passBlock + 8);
      ratings.runBlock = Math.min(99, ratings.runBlock + 8);
      ratings.awareness = Math.min(99, ratings.awareness + 8);
      ratings.strength = Math.min(99, ratings.strength + 12);  // Added strength boost
    }

    // Recalculate overall after boosts
    ratings.overall = Math.max(ratings.overall, Math.min(92, Math.floor(ratings.overall * 1.10)));
  }

  /**
   * Apply strong stats rating boost
   * Players with strong stats should be good starters (75-85 overall)
   * @param ratings - Ratings to boost
   * @param position - Madden position name
   */
  private applyStrongStatsBoost(ratings: MaddenRatings, position: string): void {
    const pos = position.toUpperCase();

    // Moderate overall boost
    ratings.overall = Math.max(ratings.overall, 75);

    // Small awareness boost
    ratings.awareness = Math.min(99, ratings.awareness + 5);

    // Position-specific boosts (smaller than Pro Bowl)
    if (pos === 'QB') {
      ratings.throwAccuracyShort = Math.min(99, ratings.throwAccuracyShort + 5);
      ratings.throwAccuracyMid = Math.min(99, ratings.throwAccuracyMid + 5);
      ratings.throwAccuracyDeep = Math.min(99, ratings.throwAccuracyDeep + 4);
    } else if (pos === 'HB') {
      ratings.carrying = Math.min(99, ratings.carrying + 5);
      ratings.ballCarrierVision = Math.min(99, ratings.ballCarrierVision + 5);
      ratings.breakTackle = Math.min(99, ratings.breakTackle + 4);
    } else if (pos === 'WR') {
      ratings.catching = Math.min(99, ratings.catching + 5);
      ratings.shortRouteRunning = Math.min(99, ratings.shortRouteRunning + 5);
      ratings.mediumRouteRunning = Math.min(99, ratings.mediumRouteRunning + 5);
    } else if (pos === 'CB') {
      ratings.manCoverage = Math.min(99, ratings.manCoverage + 10);  // Increased from +5
      ratings.zoneCoverage = Math.min(99, ratings.zoneCoverage + 10);  // Increased from +5
      ratings.pressCoverage = Math.min(99, ratings.pressCoverage + 8);  // Increased from +4
    } else if (pos === 'FS' || pos === 'SS') {
      ratings.zoneCoverage = Math.min(99, ratings.zoneCoverage + 8);  // Increased from +5
      ratings.manCoverage = Math.min(99, ratings.manCoverage + 7);  // Increased from +4
      ratings.tackle = Math.min(99, ratings.tackle + 4);
    } else if (pos === 'SAM' || pos === 'Mike' || pos === 'WILL') {
      ratings.tackle = Math.min(99, ratings.tackle + 10);  // Increased from +5
      ratings.pursuit = Math.min(99, ratings.pursuit + 4);
      ratings.playRecognition = Math.min(99, ratings.playRecognition + 5);
      ratings.strength = Math.min(99, ratings.strength + 5);  // Added strength boost
    } else if (pos === 'LEDG' || pos === 'REDG' || pos === 'DT') {
      ratings.powerMoves = Math.min(99, ratings.powerMoves + 10);  // Increased from +5
      ratings.finesseMoves = Math.min(99, ratings.finesseMoves + 8);  // Added finesse boost
      ratings.blockShedding = Math.min(99, ratings.blockShedding + 5);
      ratings.tackle = Math.min(99, ratings.tackle + 4);
      ratings.strength = Math.min(99, ratings.strength + 10);  // Added strength boost
    } else if (pos === 'TE') {
      ratings.catching = Math.min(99, ratings.catching + 5);
      ratings.runBlock = Math.min(99, ratings.runBlock + 4);
    } else if (pos === 'LT' || pos === 'RT' || pos === 'LG' || pos === 'RG' || pos === 'C') {
      ratings.passBlock = Math.min(99, ratings.passBlock + 5);
      ratings.runBlock = Math.min(99, ratings.runBlock + 5);
      ratings.strength = Math.min(99, ratings.strength + 10);  // Added strength boost
    }

    // Recalculate overall after boosts
    ratings.overall = Math.max(ratings.overall, Math.min(85, Math.floor(ratings.overall * 1.05)));
  }

  /**
   * Apply minimum rating floor to prevent 0 ratings
   * Uses position-aware minimums for critical OVR attributes
   *
   * CRITICAL FIX: QB attributes like throwUnderPressure and breakSack were getting
   * random 15-35 values which severely hurt OVR calculation (TUP has 0.7 weight in QB_Scrambler)
   *
   * Now uses higher minimums for position-critical attributes:
   * - QB throwing attributes: 55-75 (affects OVR significantly)
   * - Generic attributes: 15-35 (non-OVR affecting)
   */
  private applyMinimumRatingFloor(ratings: any): void {
    // QB-critical throwing attributes - need higher minimums because they affect OVR heavily
    const qbCriticalFields: Record<string, { min: number; max: number }> = {
      'throwPower': { min: 70, max: 85 },
      'throwAccuracyShort': { min: 65, max: 80 },
      'throwAccuracyMid': { min: 60, max: 78 },
      'throwAccuracyDeep': { min: 55, max: 75 },
      'throwOnTheRun': { min: 55, max: 75 },
      'throwUnderPressure': { min: 55, max: 78 },  // CRITICAL: Was getting 15-35, needs 55+
      'playAction': { min: 55, max: 75 },
      'breakSack': { min: 50, max: 70 }  // CRITICAL: Was getting 15-35, needs 50+
    };

    // List of all other rating fields with generic minimums
    const genericRatingFields = [
      'speed', 'acceleration', 'agility', 'strength', 'awareness', 'jumping',
      'stamina', 'changeOfDirection', 'toughness', 'carrying', 'ballCarrierVision',
      'breakTackle', 'trucking', 'stiffArm', 'spinMove', 'jukeMove',
      'catching', 'catchInTraffic', 'spectacularCatch', 'shortRouteRunning',
      'mediumRouteRunning', 'deepRouteRunning', 'release',
      'passBlock', 'passBlockPower', 'passBlockFinesse', 'runBlock',
      'runBlockPower', 'runBlockFinesse', 'leadBlock', 'impactBlocking',
      'injury', 'tackle', 'hitPower', 'powerMoves', 'finesseMoves',
      'blockShedding', 'pursuit', 'playRecognition', 'manCoverage',
      'zoneCoverage', 'pressCoverage', 'kickPower', 'kickAccuracy',
      'kickReturn', 'longSnap'
    ];

    // Apply QB-critical minimums first (with higher ranges)
    for (const [field, range] of Object.entries(qbCriticalFields)) {
      if (ratings[field] !== undefined && ratings[field] < range.min) {
        // Set to random value within the appropriate range for this attribute
        ratings[field] = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      }
    }

    // Apply generic minimums for other fields
    for (const field of genericRatingFields) {
      if (ratings[field] !== undefined && ratings[field] === 0) {
        // Random value between 15 and 35
        ratings[field] = Math.floor(Math.random() * 21) + 15;
      }
    }
  }

  /**
   * Cap ratings based on position
   * Prevents unrealistic ratings (e.g. LB with 99 zone coverage)
   * @param isRookie - If true, cap overall at 80 (draft prospects). If false, allow up to 99 (roster veterans)
   */
  private capRatingsByPosition(ratings: MaddenRatings, position: string, isRookie: boolean = true): void {
    const pos = position.toUpperCase();

    // Helper function to cap a rating
    const cap = (key: keyof MaddenRatings, max: number) => {
      if (ratings[key] > max) {
        ratings[key] = max as any;
      }
    };

    // Linebackers: Limited coverage skills
    if (['SAM', 'Mike', 'WILL'].includes(pos)) {
      cap('zoneCoverage', 88);      // Max 88 zone for elite rookie LBs
      cap('manCoverage', 85);        // Max 85 man for elite rookie LBs
      cap('catching', 75);           // Limited catching
      cap('speed', 88);              // Max speed for elite LB
      cap('acceleration', 90);
    }

    // Defensive Linemen: Limited coverage
    if (['LEDG', 'REDG', 'DT'].includes(pos)) {
      cap('zoneCoverage', 70);       // Very limited zone
      cap('manCoverage', 65);        // Very limited man
      cap('catching', 60);           // Minimal catching
      cap('speed', 85);              // Max speed for elite DL
      cap('acceleration', 88);
    }

    // Offensive Linemen: No catching/coverage
    if (['LT', 'LG', 'C', 'RG', 'RT'].includes(pos)) {
      cap('catching', 40);
      cap('speed', 75);              // Max speed for elite OL
      cap('acceleration', 80);
      cap('agility', 75);
    }

    // Running Backs: Limited throwing
    if (['HB', 'FB'].includes(pos)) {
      cap('throwPower', 75);
      cap('throwAccuracyShort', 70);
      cap('throwAccuracyMid', 65);
      cap('throwAccuracyDeep', 60);
      cap('speed', 96);              // Max speed for elite HB
    }

    // Wide Receivers: Limited throwing, good catching
    if (['WR'].includes(pos)) {
      cap('throwPower', 75);
      cap('throwAccuracyShort', 70);
      cap('throwAccuracyMid', 65);
      cap('throwAccuracyDeep', 60);
      cap('speed', 97);              // Max speed for elite WR
      cap('catching', 92);           // Max catching for rookie WR
      cap('spectacularCatch', 90);
    }

    // Tight Ends: Limited throwing, moderate catching
    if (['TE'].includes(pos)) {
      cap('throwPower', 75);
      cap('throwAccuracyShort', 70);
      cap('speed', 90);              // Max speed for elite TE
      cap('catching', 90);           // Max catching for rookie TE
    }

    // Cornerbacks: Good coverage, limited tackling
    if (['CB'].includes(pos)) {
      cap('zoneCoverage', 92);       // Max zone for elite rookie CB
      cap('manCoverage', 92);        // Max man for elite rookie CB
      cap('speed', 96);              // Max speed for elite CB
      cap('catching', 85);
      cap('tackling', 75);           // Limited tackling for CBs
    }

    // Safeties: Balanced coverage/tackling
    if (['FS', 'SS'].includes(pos)) {
      cap('zoneCoverage', 90);       // Max zone for elite rookie safety
      cap('manCoverage', 88);        // Max man for elite rookie safety
      cap('speed', 94);              // Max speed for elite safety
      cap('catching', 85);
      cap('tackling', 88);
    }

    // Quarterbacks: Cap physical stats
    if (['QB'].includes(pos)) {
      cap('throwPower', 95);         // Max throw power for elite rookie QB
      cap('throwAccuracyShort', 92);
      cap('throwAccuracyMid', 90);
      cap('throwAccuracyDeep', 88);
      cap('speed', 88);              // Max speed for elite mobile QB
      cap('acceleration', 90);
    }

    // Kickers/Punters
    if (['K', 'P'].includes(pos)) {
      cap('kickPower', 95);
      cap('kickAccuracy', 92);
    }

    // Overall cap: Rookies capped at 80, veterans can reach 99
    if (isRookie) {
      cap('overall', 80);
    } else {
      cap('overall', 99);
    }
  }

  /**
   * Generate jersey number based on position
   */
  private generateJerseyNumber(position: string): number {
    const pos = position.toUpperCase();

    // Position-appropriate jersey number ranges
    const jerseyRanges: { [key: string]: [number, number] } = {
      'QB': [1, 19],
      'HB': [20, 49],
      'FB': [30, 49],
      'WR': [10, 19], // Can also be 80-89
      'TE': [80, 89],
      'LT': [60, 79],
      'LG': [60, 79],
      'C': [50, 79],
      'RG': [60, 79],
      'RT': [60, 79],
      'LEDG': [50, 99],
      'REDG': [50, 99],
      'DT': [50, 99],
      'SAM': [40, 59],
      'Mike': [40, 59],
      'WILL': [40, 59],
      'CB': [20, 49],
      'FS': [20, 49],
      'SS': [20, 49],
      'K': [1, 19],
      'P': [1, 19],
      'LS': [40, 69]
    };

    const range = jerseyRanges[pos] || [1, 99];
    const [min, max] = range;

    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Calculate age based on draft year and round
   * Most prospects are 21-23 years old
   */
  private calculateAge(draftYear: number, round?: number): number {
    // Earlier picks tend to be younger (underclassmen)
    // Later picks/UDFAs tend to be older (seniors, redshirt seniors)

    if (round === 0) {
      // UDFAs: typically 22-24 (mostly seniors)
      return 22 + Math.floor(Math.random() * 3);
    } else if (round === 1) {
      // First round: 20-22 (mix of underclassmen and juniors)
      return 20 + Math.floor(Math.random() * 3);
    } else if (round && round <= 3) {
      // Rounds 2-3: 21-23
      return 21 + Math.floor(Math.random() * 3);
    } else {
      // Late rounds: 22-24 (mostly seniors)
      return 22 + Math.floor(Math.random() * 3);
    }
  }

  /**
   * Generate a realistic homestate based on US population distribution
   * States with more population (and more football talent) are more likely
   */
  private generateHomeState(): string {
    // Weighted state distribution based on NFL player origins
    // High: CA, TX, FL, GA, OH (football powerhouse states)
    // Medium: PA, NC, LA, AL, VA, IL, MI, NJ, SC, MD
    // Low: All other states
    const statePool = [
      // California - highest producer of NFL talent
      'CA', 'CA', 'CA', 'CA', 'CA', 'CA', 'CA', 'CA', 'CA', 'CA',
      // Texas - second highest
      'TX', 'TX', 'TX', 'TX', 'TX', 'TX', 'TX', 'TX',
      // Florida - third highest
      'FL', 'FL', 'FL', 'FL', 'FL', 'FL', 'FL',
      // Georgia
      'GA', 'GA', 'GA', 'GA', 'GA',
      // Ohio
      'OH', 'OH', 'OH', 'OH',
      // Pennsylvania, Louisiana, Alabama, Virginia
      'PA', 'PA', 'PA', 'LA', 'LA', 'LA', 'AL', 'AL', 'AL', 'VA', 'VA', 'VA',
      // North Carolina, Illinois, Michigan, New Jersey
      'NC', 'NC', 'IL', 'IL', 'MI', 'MI', 'NJ', 'NJ',
      // South Carolina, Maryland, Tennessee
      'SC', 'SC', 'MD', 'MD', 'TN', 'TN',
      // Medium states
      'AZ', 'AZ', 'IN', 'IN', 'MO', 'MO', 'MS', 'MS', 'WI', 'WI',
      'CO', 'CO', 'MN', 'MN', 'OK', 'OK', 'AR', 'AR',
      // Lower population states
      'WA', 'MA', 'KS', 'IA', 'NV', 'KY', 'CT', 'UT', 'OR',
      'NE', 'WV', 'NM', 'ID', 'HI', 'ME', 'NH', 'RI', 'MT',
      'DE', 'SD', 'ND', 'AK', 'VT', 'WY'
    ];

    return statePool[Math.floor(Math.random() * statePool.length)];
  }

  /**
   * Generate a fictional roster for teams that didn't exist in a given year
   * Creates 53 low-rated players with generic names
   * @param teamAbbr - Team abbreviation
   * @param count - Number of players to generate (typically 53)
   * @returns Array of PlayerStats for fictional players
   */
  private generateFictionalRoster(teamAbbr: string, count: number, isNonExistentTeam: boolean = false): PlayerStats[] {
    const fictionalPlayers: PlayerStats[] = [];

    // Common first/last names for fictional players
    const firstNames = ['John', 'Mike', 'Dave', 'Tom', 'Chris', 'Matt', 'Ryan', 'Steve', 'Dan', 'Joe',
      'Tim', 'Jim', 'Bob', 'Mark', 'Paul', 'Kevin', 'Brian', 'Eric', 'Jeff', 'Scott'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Moore', 'Taylor',
      'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson'];

    // Small colleges
    const colleges = ['Weber State', 'Idaho State', 'Montana', 'Eastern Illinois', 'Western Kentucky', 'Toledo',
      'Ball State', 'Northern Iowa', 'South Dakota State', 'North Dakota State'];

    // Position distribution for a 53-man roster
    const positions = [
      'QB', 'QB', 'QB',           // 3 QBs
      'RB', 'RB', 'RB', 'RB', 'FB',  // 5 RBs/FBs
      'WR', 'WR', 'WR', 'WR', 'WR', 'WR',  // 6 WRs
      'TE', 'TE', 'TE',           // 3 TEs
      'T', 'T', 'T', 'T',         // 4 Tackles
      'G', 'G', 'G', 'G',         // 4 Guards
      'C', 'C', 'C',              // 3 Centers
      'DE', 'DE', 'DE', 'DE', 'DE',  // 5 DEs
      'DT', 'DT', 'DT', 'DT',     // 4 DTs
      'LB', 'LB', 'LB', 'LB', 'LB', 'LB',  // 6 LBs
      'CB', 'CB', 'CB', 'CB', 'CB',  // 5 CBs
      'S', 'S', 'S', 'S',         // 4 Safeties
      'K', 'P', 'LS'              // 3 Specialists
    ];

    for (let i = 0; i < count; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      // Cycle through positions array if count > positions.length
      const position = positions[i % positions.length];
      const college = colleges[Math.floor(Math.random() * colleges.length)];

      // Generate realistic physical stats by position
      let height = '6-1';
      let weight = 220;

      switch (position) {
        case 'QB':
          height = '6-3';
          weight = 215;
          break;
        case 'RB':
          height = '5-11';
          weight = 210;
          break;
        case 'FB':
          height = '6-0';
          weight = 240;
          break;
        case 'WR':
          height = '6-1';
          weight = 195;
          break;
        case 'TE':
          height = '6-4';
          weight = 250;
          break;
        case 'T':
          height = '6-6';
          weight = 310;
          break;
        case 'G':
        case 'C':
          height = '6-3';
          weight = 305;
          break;
        case 'DE':
          height = '6-4';
          weight = 275;
          break;
        case 'DT':
          height = '6-3';
          weight = 305;
          break;
        case 'LB':
          height = '6-2';
          weight = 240;
          break;
        case 'CB':
          height = '5-11';
          weight = 190;
          break;
        case 'S':
          height = '6-0';
          weight = 205;
          break;
        case 'K':
        case 'P':
          height = '5-11';
          weight = 195;
          break;
      }

      fictionalPlayers.push({
        name: `${firstName} ${lastName}`,
        position: position,
        college: college,
        height: height,
        weight: weight,
        age: 22 + Math.floor(Math.random() * 6), // Age 22-27
        team: teamAbbr.toUpperCase(),
        _isNonExistentTeam: isNonExistentTeam // Custom flag for rating generation
      } as any);
    }

    console.log(`[CreatorService] Generated ${fictionalPlayers.length} fictional players for ${teamAbbr}`);
    return fictionalPlayers;
  }

  /**
   * Generate filler players to reach roster size
   * Creates realistic fictional players with random names and colleges
   */
  private generateFillerPlayers(count: number, year: number): DraftProspect[] {
    const fillerPlayers: DraftProspect[] = [];

    // Common first names
    const firstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
      'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
      'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob'];

    // Common last names
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
      'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
      'Lee', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker'];

    // Small colleges (less likely to have records)
    const colleges = ['Weber State', 'Idaho State', 'Montana', 'Eastern Illinois', 'Western Kentucky', 'Toledo', 'Ball State',
      'Northern Iowa', 'South Dakota State', 'North Dakota State', 'Jacksonville State', 'Samford', 'Furman',
      'Wofford', 'Chattanooga', 'Tennessee Tech', 'Murray State', 'Austin Peay', 'Southeast Missouri State'];

    // Position distribution
    const positions = [
      'QB', 'QB', // 2 QBs
      'HB', 'HB', 'HB', 'HB', 'FB', // 5 RBs/FBs
      'WR', 'WR', 'WR', 'WR', 'WR', 'WR', // 6 WRs
      'TE', 'TE', // 2 TEs
      'T', 'T', 'T', 'G', 'G', 'G', 'C', 'C', // 8 OL
      'DE', 'DE', 'DE', 'DE', 'DT', 'DT', 'DT', // 7 DL
      'LB', 'LB', 'LB', 'LB', 'LB', // 5 LBs
      'CB', 'CB', 'CB', 'CB', 'CB', // 5 CBs
      'SS', 'SS', 'FS', 'FS', // 4 Safeties
      'K', 'P' // 2 Specialists
    ];

    for (let i = 0; i < count; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const position = positions[i % positions.length];
      const college = colleges[Math.floor(Math.random() * colleges.length)];

      fillerPlayers.push({
        name: `${firstName} ${lastName}`,
        position,
        college,
        round: 0,
        pick: 0,
        age: 22 + Math.floor(Math.random() * 2) // 22-23
      });
    }

    return fillerPlayers;
  }
}

// Export singleton
export const creatorService = new CreatorService();
