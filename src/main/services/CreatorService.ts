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
  PEPS: string | null; // Player Equipment Preset (null for generic)
  bodyType: number;
  yearsPro: number; // Years in the league (0 for rookies)

  // Source data (for reference)
  _sourceStats?: PlayerStats;
}

/**
 * Creator Service Class
 */
export class CreatorService {
  // PID lookup cache: player name -> PID
  private pidLookupCache: Map<string, number> | null = null;
  // College lookup cache: college name -> college ID
  private collegeLookupCache: Map<string, number> | null = null;
  // State lookup cache: state abbreviation -> state ID
  private stateLookupCache: Map<string, number> | null = null;

  /**
   * Load PID lookup CSV into memory
   * Format: PID,Player Name
   */
  private loadPIDLookup(): Map<string, number> {
    if (this.pidLookupCache) {
      return this.pidLookupCache;
    }

    this.pidLookupCache = new Map<string, number>();

    try {
      const pidLookupPath = path.join(__dirname, '../../data/lookups/PID_lookup.csv');
      const csvContent = fs.readFileSync(pidLookupPath, 'utf-8');
      const lines = csvContent.split('\n');

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [pidStr, playerName] = line.split(',');
        const pid = parseInt(pidStr);

        if (!isNaN(pid) && playerName) {
          // Normalize player name: lowercase, remove special chars
          const normalizedName = playerName.trim().toLowerCase().replace(/[^a-z\s]/g, '');
          this.pidLookupCache.set(normalizedName, pid);
        }
      }

      console.log(`[CreatorService] Loaded ${this.pidLookupCache.size} PIDs from PID_lookup.csv`);
    } catch (error) {
      console.warn('[CreatorService] Failed to load PID_lookup.csv:', error);
    }

    return this.pidLookupCache;
  }

  /**
   * Match player name to PID from lookup table with disambiguation
   * Uses MASTER_LOOKUP_FINAL.csv with multiple fields to handle duplicate names
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
    const normalizedFirstName = firstName.trim().toLowerCase().replace(/[^a-z\s]/g, '');
    const normalizedLastName = lastName.trim().toLowerCase().replace(/[^a-z\s]/g, '');

    // Find all candidates with matching name
    const candidates: Array<{pid: number, entry: any}> = [];

    masterLookup.forEach((entry, key) => {
      const entryFirstName = (entry['First Name'] || '').trim().toLowerCase().replace(/[^a-z\s]/g, '');
      const entryLastName = (entry['Last Name'] || '').trim().toLowerCase().replace(/[^a-z\s]/g, '');

      if (entryFirstName === normalizedFirstName && entryLastName === normalizedLastName) {
        const pid = parseInt(entry['PhotoID']);
        if (!isNaN(pid) && pid > 0) {
          candidates.push({ pid, entry });
        }
      }
    });

    if (candidates.length === 0) {
      // No match found
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
    // Load PID portrait mapping
    const pidPortraitPath = path.join(__dirname, '../../data/lookups/PID_Portrait_Mapping.csv');

    let targetCategory = 7; // Default to Black-Medium (largest pool)

    // Priority 1: Use race data from MASTER_LOOKUP if available
    if (raceData && raceData.trim()) {
      const mappedCategory = this.mapRaceToCategory(raceData);
      if (mappedCategory > 0) {
        targetCategory = mappedCategory;
        console.log(`[CreatorService] Using race data for "${firstName} ${lastName}": "${raceData}" -> Category ${targetCategory}`);
      }
    }
    // Priority 2: Fall back to position-based probability (existing logic)
    else {
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
      const matchingPIDs: number[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [pidStr, type, portrait] = line.split(',');
        if (portrait && portrait.trim() === targetPortrait) {
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
    }

    // Fallback: return 0 (no portrait)
    console.warn(`[CreatorService] No generic face found for "${firstName} ${lastName}", using blank portrait`);
    return 0;
  }

  /**
   * Map race string from MASTER_LOOKUP to generic face category
   * Returns category number (1-7) or 0 if unknown
   */
  private mapRaceToCategory(raceValue: string): number {
    const normalized = raceValue.toLowerCase().trim();

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

    return 0; // Unknown race
  }

  /**
   * Load MASTER_LOOKUP_FINAL.csv into memory (REPLACES FullData_Lookup.csv)
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
      const masterLookupPath = path.join(__dirname, '../../data/lookups/MASTER_LOOKUP_FINAL.csv');
      const csvContent = fs.readFileSync(masterLookupPath, 'utf-8');
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
        const firstName = entry['First Name'] || '';
        const lastName = entry['Last Name'] || '';
        const draftClass = entry['Draft Class'] || '';

        if (firstName && lastName && draftClass) {
          const key = `${firstName.toLowerCase()} ${lastName.toLowerCase()} ${draftClass}`;
          this.masterLookupCache.set(key, entry);
        }
      }

      console.log(`[CreatorService] Loaded ${this.masterLookupCache.size} players from MASTER_LOOKUP_FINAL.csv`);
    } catch (error) {
      console.error('[CreatorService] Failed to load MASTER_LOOKUP_FINAL.csv:', error);
    }

    return this.masterLookupCache;
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

    // Normalize names
    const normalizedFirst = firstName.toLowerCase().trim();
    const normalizedLast = lastName.toLowerCase().trim();

    // Search through all entries
    for (const [key, entry] of masterLookup.entries()) {
      const entryFirst = (entry['First Name'] || '').toLowerCase().trim();
      const entryLast = (entry['Last Name'] || '').toLowerCase().trim();

      // Name must match
      if (entryFirst !== normalizedFirst || entryLast !== normalizedLast) {
        continue;
      }

      // Check if player was active in this year
      const from = parseInt(entry['From']) || 0;
      const to = parseInt(entry['To']) || 0;

      // If From/To are available, check if roster year is in range
      if (from > 0 && to > 0) {
        if (rosterYear >= from && rosterYear <= to) {
          console.log(`[CreatorService] Found ${firstName} ${lastName} in MASTER_LOOKUP (active ${from}-${to}, roster year ${rosterYear})`);
          return entry;
        }
      } else {
        // If From/To not available, try draft year match (rookie season)
        const draftClass = parseInt(entry['Draft Class']) || 0;
        if (draftClass > 0 && Math.abs(rosterYear - draftClass) <= 15) {
          console.log(`[CreatorService] Found ${firstName} ${lastName} in MASTER_LOOKUP (drafted ${draftClass}, roster year ${rosterYear})`);
          return entry;
        }
      }
    }

    console.log(`[CreatorService] Player ${firstName} ${lastName} not found in MASTER_LOOKUP for year ${rosterYear}`);
    return null;
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
    console.warn('[CreatorService] FullData_Lookup is deprecated, using MASTER_LOOKUP_FINAL instead');
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
      const collegeLookupPath = path.join(__dirname, '../../data/lookups/college_lookup.csv');
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

    // Expand common abbreviations before normalization
    const expandedName = this.expandCollegeAbbreviations(scrapedCollegeName);
    const normalized = expandedName.toLowerCase().replace(/[^a-z\s]/g, '');

    // Try exact match first
    for (const [collegeName, collegeId] of collegeLookup.entries()) {
      if (collegeName === normalized) {
        console.log(`[CreatorService] Exact college match: "${scrapedCollegeName}" -> ID ${collegeId}`);
        return collegeId; // Return the ID as number
      }
    }

    // Try partial matches (e.g. "USC" matches "Southern California")
    for (const [collegeName, collegeId] of collegeLookup.entries()) {
      // Check if scraped name is contained in lookup name or vice versa
      if (collegeName.includes(normalized) || normalized.includes(collegeName)) {
        console.log(`[CreatorService] Partial college match: "${scrapedCollegeName}" -> "${collegeName}" -> ID ${collegeId}`);
        return collegeId;
      }
    }

    // Try matching key words (e.g. "University of Alabama" -> "Alabama")
    const words = normalized.split(/\s+/).filter(w => w.length > 3); // Filter out short words like "of", "the"
    for (const word of words) {
      for (const [collegeName, collegeId] of collegeLookup.entries()) {
        if (collegeName.includes(word)) {
          console.log(`[CreatorService] Keyword college match: "${scrapedCollegeName}" (word: "${word}") -> "${collegeName}" -> ID ${collegeId}`);
          return collegeId;
        }
      }
    }

    // No match found - return "No College" (ID 265)
    console.warn(`[CreatorService] No college match found for "${scrapedCollegeName}" - defaulting to No College (265)`);
    return 265; // No College
  }

  /**
   * Expand common college abbreviations to full names
   * E.g., "Florida St." -> "Florida State", "Ohio St." -> "Ohio State"
   */
  private expandCollegeAbbreviations(collegeName: string): string {
    // Common abbreviation mappings
    const abbreviations: { [key: string]: string } = {
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
      const stateLookupPath = path.join(__dirname, '../../data/lookups/state_lookup.csv');
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
   */
  private matchHomeState(stateAbbr: string): number {
    if (!stateAbbr) {
      return 0; // Default to Alabama (ID 0) if no state provided
    }

    const stateLookup = this.loadStateLookup();
    const normalized = stateAbbr.toUpperCase().trim();

    // Try to match state abbreviation (e.g., "CA" -> 4)
    if (stateLookup.has(normalized)) {
      const stateId = stateLookup.get(normalized)!;
      console.log(`[CreatorService] State match: "${stateAbbr}" -> ID ${stateId}`);
      return stateId;
    }

    // Try to match full state name (e.g., "california" -> 4)
    const lowerName = stateAbbr.toLowerCase();
    if (stateLookup.has(lowerName)) {
      const stateId = stateLookup.get(lowerName)!;
      console.log(`[CreatorService] State match (full name): "${stateAbbr}" -> ID ${stateId}`);
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
  async generateDraftClass(year: number, testingMode: boolean = false, league?: string): Promise<GeneratedPlayer[]> {
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
          const lookupKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()} ${year}`;
          const lookupEntry = masterLookup.get(lookupKey);

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

      for (let i = 0; i < allProspects.length; i++) {
        const prospect = allProspects[i];

        // HOF checking is DISABLED - too slow
        // Will get HOF status from Wikipedia draft page instead (future enhancement)

        // Parse name FIRST (needed for MASTER_LOOKUP query)
        const nameParts = prospect.name.split(' ');
        const firstName = nameParts[0] || 'John';
        const lastName = nameParts.slice(1).join(' ') || 'Doe';

        // Load player data from MASTER_LOOKUP (needed for wAV and other enhancements)
        const masterLookup = this.loadMasterLookup();
        const lookupKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()} ${year}`;
        const lookupEntry = masterLookup.get(lookupKey);

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

        // Generate ratings using wAV if available (career performance is king!)
        // Otherwise fall back to career stats or draft position
        let ratings: MaddenRatings;
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

        // Match PID from lookup table with disambiguation
        let matchedPID = this.matchPID(firstName, lastName, year, mappedPosition.name, prospect.college);

        // Get race data from MASTER_LOOKUP for generic face assignment
        const raceData = lookupEntry ? lookupEntry['Race'] : undefined;

        // If no real portrait found, assign appropriate generic face WITH race data
        if (matchedPID === 0) {
          matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name, raceData);
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
          PEPS: null, // Generic head
          bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
          yearsPro: 0,
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
        console.log(`[CreatorService] Ratings:`, JSON.stringify(firstPlayer.ratings, null, 2));
        console.log(`[CreatorService] ================================================`);
      }

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
   * Generate draft class from MASTER_LOOKUP (OPTIMIZED - 95%+ faster!)
   * Loads players directly from MASTER_LOOKUP_FINAL.csv instead of web scraping
   * Falls back to scraping ONLY for missing height/weight data
   *
   * @param year - Draft year
   * @param testingMode - If true, limit to ~40 players for faster testing
   * @param league - League filter: 'nfl', 'afl', or 'combined' (default: auto-detect)
   * @returns Array of generated prospects
   */
  async generateDraftClassFromLookup(
    year: number,
    testingMode: boolean = false,
    league?: string
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

    console.log(`[CreatorService] ⚡ FAST MODE: Generating ${year} draft from MASTER_LOOKUP (League: ${leagueFilter})`);

    try {
      // STEP 1: Load ALL players from MASTER_LOOKUP for this year (INSTANT!)
      const masterLookup = this.loadMasterLookup();
      const draftProspects: DraftProspect[] = [];

      masterLookup.forEach((entry, key) => {
        if (entry['Draft Class'] === String(year)) {
          // Apply league filter if needed (1960-1969)
          if (leagueFilter && leagueFilter !== 'combined' && year >= 1960 && year <= 1969) {
            if (entry['League']?.toUpperCase() !== leagueFilter.toUpperCase()) {
              return; // Skip this player
            }
          }

          const firstName = entry['First Name'];
          const lastName = entry['Last Name'];
          const round = entry['Round'] ? parseFloat(entry['Round']) : undefined;
          const pick = entry['Pick'] ? parseFloat(entry['Pick']) : undefined;
          const wAV = entry['wAV'] ? parseFloat(entry['wAV']) : undefined;

          draftProspects.push({
            name: `${firstName} ${lastName}`,
            position: entry['Position'],
            round: round,
            pick: pick,
            college: entry['College/Univ'],
            height: undefined, // Will get from MASTER_LOOKUP height field or scrape
            weight: undefined, // Will get from MASTER_LOOKUP weight field or scrape
            careerGames: entry['St'] ? parseInt(entry['St']) : undefined,
            careerStarts: entry['St'] ? parseInt(entry['St']) : undefined,
            careerAV: wAV,
            // HOF heuristic: AP1 > 0 or wAV > 150
            isHallOfFamer: (entry['AP1'] && parseInt(entry['AP1']) > 0) || (wAV && wAV > 150) || false
          });
        }
      });

      console.log(`[CreatorService] ✓ Loaded ${draftProspects.length} players from MASTER_LOOKUP in ${Date.now() - startTime}ms`);

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

      for (let i = 0; i < draftProspects.length; i++) {
        const prospect = draftProspects[i];

        // Parse name
        const nameParts = prospect.name.split(' ');
        const firstName = nameParts[0] || 'John';
        const lastName = nameParts.slice(1).join(' ') || 'Doe';

        // Get full MASTER_LOOKUP entry for this player
        const lookupKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()} ${year}`;
        const lookupEntry = masterLookup.get(lookupKey);

        // Get weight and height from MASTER_LOOKUP
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

        // Extract wAV from MASTER_LOOKUP
        let wAV: number | undefined;
        if (lookupEntry && lookupEntry['wAV']) {
          wAV = parseFloat(lookupEntry['wAV']);
          if (!isNaN(wAV)) {
            // Log wAV for first 5 players
            if (i < 5) {
              console.log(`[CreatorService] ${firstName} ${lastName}: wAV=${wAV}`);
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

        // Generate ratings using wAV-based tier system
        let ratings: MaddenRatings;
        if (wAV !== undefined && wAV > 0) {
          // Use wAV-based rating tier system
          ratings = this.generateRatingsFromWAV(wAV, mappedPosition.name, prospect.isHallOfFamer);
        } else {
          // Fall back to draft position
          ratings = this.generateDefaultRatings(prospect);
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

        // Match PID from lookup table with disambiguation
        let matchedPID = this.matchPID(firstName, lastName, year, mappedPosition.name, prospect.college);

        // Get race data from MASTER_LOOKUP for generic face assignment
        const raceData = lookupEntry ? lookupEntry['Race'] : undefined;

        // If no real portrait found, assign appropriate generic face WITH race data
        if (matchedPID === 0) {
          matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name, raceData);
        }

        // Match college to valid college in lookup (fuzzy matching)
        const matchedCollege = this.matchCollege(prospect.college || 'Unknown');

        // Get homestate: generate realistic one
        const generatedState = this.generateHomeState();
        const homeStateId = this.matchHomeState(generatedState);

        // Determine dev trait using wAV
        const devTrait = this.determineDevTrait(prospect.round, prospect.pick, ratings.overall, prospect.isHallOfFamer, wAV);

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
          PEPS: null,
          bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
          yearsPro: 0,
          _sourceStats: stats || undefined
        };

        generatedPlayers.push(player);
      }

      const totalTime = Date.now() - startTime;
      console.log(`[CreatorService] ⚡ Generated ${generatedPlayers.length} players in ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);

      // Close browser if we opened it
      await scraperService.closeBrowser();

      return generatedPlayers;

    } catch (error: any) {
      console.error('[CreatorService] Error generating draft class from lookup:', error);
      await scraperService.closeBrowser();
      throw new Error(`Failed to generate draft class from lookup: ${error.message}`);
    }
  }

  /**
   * Generate a roster from web-scraped data
   * NOW WITH: College lookup, dev traits based on HOF+stats, stat minimums, position mapping
   * @param year - Season year
   * @param teams - Array of team abbreviations (e.g., ['dal', 'sea', 'ne'])
   * @param maxPlayers - Maximum number of players (from template roster, default 3000)
   * @returns Array of generated players
   */
  async generateRoster(year: number, teams: string[], maxPlayers: number = 3000, league?: string): Promise<GeneratedPlayer[]> {
    console.log(`[CreatorService] Generating roster for ${year} (${teams.length} teams, max ${maxPlayers} players, league: ${league || 'all'})`);

    try {
      const generatedPlayers: GeneratedPlayer[] = [];

      // Step 0: Load MASTER_LOOKUP and team history
      console.log(`[CreatorService] Loading MASTER_LOOKUP...`);
      const masterLookup = this.loadMasterLookup();

      // Load team history for AFL/NFL filtering
      let teamHistory: any = null;
      try {
        const teamHistoryPath = path.join(__dirname, '../../data/lookups/team_history.json');
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
      for (const teamAbbr of teams) {
        console.log(`[CreatorService] ========== PROCESSING TEAM: ${teamAbbr.toUpperCase()} ==========`);

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

          // Step 1: Scrape roster using JT-SW as primary (cleaner tables), PFR as fallback
          roster = await scraperService.scrapeTeamRosterFromJTSW(teamAbbr, year);
          console.log(`[CreatorService] ✓ Scraped ${roster.length} players from roster page`);

          if (roster.length === 0) {
            console.warn(`[CreatorService] ⚠️ WARNING: ${teamAbbr} scraper returned ZERO players, generating fictional roster instead!`);
            roster = this.generateFictionalRoster(teamAbbr, 53);
          } else {
            // Step 2: Scrape team stats (passing, rushing, receiving, defense stats)
            console.log(`[CreatorService] Scraping team stats for ${teamAbbr}...`);
            const teamStats = await scraperService.scrapeTeamStats(teamAbbr, year);
            console.log(`[CreatorService] ✓ Scraped stats for ${teamStats.size} players from team stats page`);

            // Step 3: Merge stats into roster data by player name
            let mergedCount = 0;
            let notFoundCount = 0;
            const unmatchedPlayers: string[] = [];
            const matchedPlayers: string[] = [];

            console.log(`[CreatorService] ========== STATS MERGE DEBUG ==========`);
            console.log(`[CreatorService] Roster has ${roster.length} players`);
            console.log(`[CreatorService] Team stats has ${teamStats.size} players with stats`);

            // DEBUG: Log first 5 names from each source
            console.log(`[CreatorService] First 5 roster names:`);
            for (let i = 0; i < Math.min(5, roster.length); i++) {
              console.log(`  ${i + 1}. "${roster[i].name}" (${roster[i].position})`);
            }

            console.log(`[CreatorService] First 5 teamStats names:`);
            let statsIdx = 0;
            for (const [name, stats] of teamStats.entries()) {
              if (statsIdx >= 5) break;
              console.log(`  ${statsIdx + 1}. "${name}" (${stats.position})`);
              statsIdx++;
            }
            console.log(`[CreatorService] ========================================`);

            for (const player of roster) {
              const stats = teamStats.get(player.name);
              if (stats) {
                // Merge stats into player object
                player.passCompletions = stats.passCompletions;
                player.passAttempts = stats.passAttempts;
                player.passYards = stats.passYards;
                player.passTDs = stats.passTDs;
                player.interceptions = stats.interceptions;

                player.rushAttempts = stats.rushAttempts;
                player.rushYards = stats.rushYards;
                player.rushTDs = stats.rushTDs;

                player.receptions = stats.receptions;
                player.recYards = stats.recYards;
                player.recTDs = stats.recTDs;
                player.targets = stats.targets;

                player.tackles = stats.tackles;
                player.sacks = stats.sacks;
                player.forcedFumbles = stats.forcedFumbles;
                player.interceptionsCaught = stats.interceptionsCaught;
                player.passDefended = stats.passDefended;

                mergedCount++;
                matchedPlayers.push(player.name);

                // DEBUG: Log ALL merged players (not just first 3)
                if (mergedCount <= 10) {
                  console.log(`[CreatorService] ✓ Merged stats for "${player.name}" (${player.position}):`);
                  console.log(`  - Pass: cmp=${player.passCompletions}, att=${player.passAttempts}, yds=${player.passYards}, TD=${player.passTDs}, INT=${player.interceptions}`);
                  console.log(`  - Rush: att=${player.rushAttempts}, yds=${player.rushYards}, TD=${player.rushTDs}`);
                  console.log(`  - Rec: rec=${player.receptions}, yds=${player.recYards}, TD=${player.recTDs}, tgt=${player.targets}`);
                  console.log(`  - Def: tkl=${player.tackles}, sacks=${player.sacks}, FF=${player.forcedFumbles}, INT=${player.interceptionsCaught}, PD=${player.passDefended}`);
                }
              } else {
                notFoundCount++;
                unmatchedPlayers.push(player.name);
                if (notFoundCount <= 10) {
                  console.warn(`[CreatorService] ⚠️ No stats found for "${player.name}" (${player.position}) - will use generic ratings`);
                }
              }
            }

            console.log(`[CreatorService] ========== MERGE SUMMARY ==========`);
            console.log(`[CreatorService] ✓ Stats merge complete for ${teamAbbr}:`);
            console.log(`[CreatorService]   - ${mergedCount} players WITH stats (${(mergedCount/roster.length*100).toFixed(1)}%)`);
            console.log(`[CreatorService]   - ${notFoundCount} players WITHOUT stats (${(notFoundCount/roster.length*100).toFixed(1)}%)`);
            if (unmatchedPlayers.length > 0 && unmatchedPlayers.length <= 20) {
              console.warn(`[CreatorService] Unmatched players: ${unmatchedPlayers.join(', ')}`);
            }
            console.log(`[CreatorService] ===================================`);
          }
        }

        console.log(`[CreatorService] Processing ${roster.length} players from ${teamAbbr}...`);

        // DEBUG: Log ALL roster data to see if stats are present
        console.log(`[CreatorService] ========== FULL ROSTER DATA FOR ${teamAbbr} ==========`);
        for (let idx = 0; idx < Math.min(5, roster.length); idx++) {
          const p = roster[idx];
          console.log(`[CreatorService] Player ${idx + 1}: ${p.name} (${p.position})`);
          console.log(`  - Basic: age=${p.age}, height=${p.height}, weight=${p.weight}, college=${p.college}, jersey=${(p as any).jerseyNumber}`);
          console.log(`  - Pass: cmp=${p.passCompletions}, att=${p.passAttempts}, yds=${p.passYards}, TD=${p.passTDs}, INT=${p.interceptions}`);
          console.log(`  - Rush: att=${p.rushAttempts}, yds=${p.rushYards}, TD=${p.rushTDs}`);
          console.log(`  - Rec: rec=${p.receptions}, yds=${p.recYards}, TD=${p.recTDs}, tgt=${p.targets}`);
          console.log(`  - Def: tkl=${p.tackles}, sacks=${p.sacks}, FF=${p.forcedFumbles}, INT=${p.interceptionsCaught}, PD=${p.passDefended}`);
        }
        console.log(`[CreatorService] ==================================================`);

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

          // Check if player is HOF
          const isHOF = hofPlayers.has(playerStats.name);
          if (debugDetail && isHOF) {
            console.log(`[CreatorService] 🏆 HALL OF FAMER DETECTED!`);
          }

          // Get college: use HOF lookup if available, otherwise use scraped data
          let collegeName = playerStats.college || 'Unknown';
          if (isHOF && hofLookup) {
            const hofData = hofLookup.get(playerStats.name);
            if (hofData && hofData.college) {
              collegeName = hofData.college;
              console.log(`[CreatorService] 🏆 Using HOF college data for ${playerStats.name}: ${collegeName}`);
            }
          }

          // Map position to M26 format
          const mappedPosition = this.mapPosition(playerStats.position);
          if (debugDetail) {
            console.log(`[CreatorService] Position mapped: "${playerStats.position}" -> "${mappedPosition.name}" (code ${mappedPosition.code})`);
          }

          // DEBUG: Log stats BEFORE rating calculation
          if (debugDetail) {
            console.log(`[CreatorService] Raw stats before rating calc:`);
            console.log(`  - Pass: cmp=${playerStats.passCompletions}, att=${playerStats.passAttempts}, yds=${playerStats.passYards}, TD=${playerStats.passTDs}, INT=${playerStats.interceptions}`);
            console.log(`  - Rush: att=${playerStats.rushAttempts}, yds=${playerStats.rushYards}, TD=${playerStats.rushTDs}`);
            console.log(`  - Rec: rec=${playerStats.receptions}, yds=${playerStats.recYards}, TD=${playerStats.recTDs}, tgt=${playerStats.targets}`);
            console.log(`  - Def: tkl=${playerStats.tackles}, sacks=${playerStats.sacks}, FF=${playerStats.forcedFumbles}, INT=${playerStats.interceptionsCaught}, PD=${playerStats.passDefended}`);

            // Check if ANY stats exist
            const hasAnyStats = !!(playerStats.passAttempts || playerStats.rushAttempts || playerStats.receptions || playerStats.tackles);
            console.log(`  - Has ANY stats: ${hasAnyStats}`);
          }

          // Calculate ratings (use low ratings for non-existent teams)
          const isNonExistentTeam = (playerStats as any)._isNonExistentTeam || false;
          const ratings = isNonExistentTeam
            ? this.generateFillerRatings(mappedPosition.name, true) // 30-40 OVR for retro franchise
            : ratingCalculator.calculateRatings(playerStats);

          // DEBUG: Log ratings AFTER calculation
          if (debugDetail) {
            console.log(`[CreatorService] Ratings after calc:`);
            console.log(`  - Overall: ${ratings.overall}`);
            console.log(`  - Physical: SPD=${ratings.speed}, ACC=${ratings.acceleration}, AGI=${ratings.agility}, STR=${ratings.strength}, AWR=${ratings.awareness}`);
            console.log(`  - Pass: THP=${ratings.throwPower}, TAS=${ratings.throwAccuracyShort}, TAM=${ratings.throwAccuracyMid}, TAD=${ratings.throwAccuracyDeep}`);
            console.log(`  - Rush: CAR=${ratings.carrying}, BCV=${ratings.ballCarrierVision}, BTK=${ratings.breakTackle}, TRK=${ratings.trucking}`);
            console.log(`  - Rec: CTH=${ratings.catching}, CIT=${ratings.catchInTraffic}, SPC=${ratings.spectacularCatch}, SRR=${ratings.shortRouteRunning}`);
            console.log(`  - Def: TAK=${ratings.tackle}, HTP=${ratings.hitPower}, PMV=${ratings.powerMoves}, BSH=${ratings.blockShedding}, MCV=${ratings.manCoverage}, ZCV=${ratings.zoneCoverage}`);
          }

          // Apply tiered rating boosts based on accomplishments
          const isProBowler = proBowlers.has(playerStats.name);
          if (isHOF) {
            // Tier 1: Hall of Famers - elite ratings (85-99 overall)
            this.applyHOFBoost(ratings, mappedPosition.name, playerStats);
            if (debugDetail) console.log(`[CreatorService] 🏆 Applied HOF rating boost`);
          } else if (isProBowler) {
            // Tier 1: Pro Bowlers - high ratings (80-90 overall)
            this.applyProBowlBoost(ratings, mappedPosition.name, playerStats);
            if (debugDetail) console.log(`[CreatorService] ⭐ Applied Pro Bowl rating boost`);
          } else if (this.hasStrongStats(playerStats, mappedPosition.name)) {
            // Tier 2: Players with strong stats - good starter ratings (75-85 overall)
            this.applyStrongStatsBoost(ratings, mappedPosition.name);
            if (debugDetail) console.log(`[CreatorService] ✓ Applied strong stats boost`);
          }
          // Tier 3: Average/backup players - no boost (ratings as calculated)
          // Tier 4: Players with weak/no stats - ratings remain low

          // Fill missing ratings (ensures NO blanks)
          this.fillMissingRatings(ratings, mappedPosition.name);

          // Match PID from lookup table with disambiguation
          // For roster generation, we don't have draft year, but we have year (season year)
          // Most players were drafted within ~10 years of their playing year
          let matchedPID = this.matchPID(firstName, lastName, undefined, mappedPosition.name, collegeName);

          // If no real portrait found, assign appropriate generic face
          if (matchedPID === 0) {
            matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name);
          }

          // Match college to valid college ID
          const matchedCollege = this.matchCollege(collegeName);

          // Use scraped jersey number if available, otherwise generate
          const jerseyNum = (playerStats as any).jerseyNumber || this.generateJerseyNumber(mappedPosition.name);

          // Get height with proper defaults
          const heightInches = playerStats.height
            ? this.parseHeight(playerStats.height)
            : this.generateHeight(mappedPosition.name);

          // Get weight with proper defaults and validation
          // Weight validation: if weight is unrealistic (>400 or <150), use position default
          let weight = playerStats.weight || 0;
          if (weight > 400 || weight < 150 || weight === 0) {
            if (debugDetail && weight > 400) {
              console.warn(`[CreatorService] ⚠️ Invalid weight ${weight} for ${playerStats.name}, using default for ${mappedPosition.name}`);
            }
            weight = this.getDefaultWeight(mappedPosition.name);
          }

          // Convert weight to Madden offset format (actual - 160)
          const maddenWeight = this.convertWeightToMaddenFormat(weight);

          // Match homestate (generate if not available)
          const homeStateId = this.matchHomeState(this.generateHomeState());

          // Determine dev trait: HOFers get X-Factor, others based on overall rating
          const devTrait = isHOF ? 3 : this.determineDevTraitFromRating(ratings.overall);

          // Use scraped years pro if available, otherwise calculate from age
          const playerAge = playerStats.age || 25;
          let yearsPro = 0;
          if (playerStats.yearsPro !== undefined && playerStats.yearsPro !== null) {
            // Use scraped value ("Rook" becomes 0, numbers are parsed)
            yearsPro = playerStats.yearsPro;
          } else {
            // Fallback: estimate from age (assume NFL entry at 22)
            const typicalRookieAge = 22;
            yearsPro = Math.max(0, playerAge - typicalRookieAge);
          }

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
            PEPS: null,
            bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
            yearsPro,
            _sourceStats: playerStats
          };

          if (isHOF) {
            console.log(`[CreatorService] 🏆 HOF player: ${playerStats.name} (${mappedPosition.name}) - OVR ${ratings.overall}, Dev Trait ${devTrait}`);
          }

          generatedPlayers.push(player);
        }

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
              PID: -1, // No player ID for fictional players
              PEPS: null,
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

        // Generate fictional free agents with varied positions
        const freeAgentRoster = this.generateFictionalRoster('FA', freeAgentsNeeded);
        scraperDebugLogger.log(`Generated ${freeAgentRoster.length} fictional FA players\n`);

        // Process free agents (same as filler players but with team = 1009)
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
            PID: -1,
            PEPS: null,
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

      return generatedPlayers;

    } catch (error: any) {
      console.error('[CreatorService] Error generating roster:', error);
      await scraperService.closeBrowser();
      throw new Error(`Failed to generate roster: ${error.message}`);
    }
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
   */
  private readonly WAV_TIERS = [
    { name: 'Hall of Fame Legend', minWAV: 150, maxWAV: 999, baseOVR: 85, ovrRange: 5, devTraitWeight: 3.0 },
    { name: 'Elite', minWAV: 100, maxWAV: 149, baseOVR: 82, ovrRange: 4, devTraitWeight: 2.5 },
    { name: 'Pro Bowl', minWAV: 60, maxWAV: 99, baseOVR: 77, ovrRange: 5, devTraitWeight: 2.0 },
    { name: 'Quality Starter', minWAV: 30, maxWAV: 59, baseOVR: 72, ovrRange: 5, devTraitWeight: 1.5 },
    { name: 'Average Starter', minWAV: 15, maxWAV: 29, baseOVR: 68, ovrRange: 4, devTraitWeight: 1.0 },
    { name: 'Backup', minWAV: 5, maxWAV: 14, baseOVR: 63, ovrRange: 4, devTraitWeight: 0.5 },
    { name: 'Bust', minWAV: 0, maxWAV: 4, baseOVR: 58, ovrRange: 5, devTraitWeight: 0.1 }
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
   * @returns Base OVR (before attribute distribution)
   */
  private calculateBaseOVRFromWAV(wAV: number, position: string, isHOF: boolean = false): number {
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

    // Clamp to valid range (50-80 for rookies)
    baseOVR = Math.max(50, Math.min(80, Math.round(baseOVR)));

    console.log(`[CreatorService] wAV ${wAV} -> Tier "${tier.name}" -> Base OVR ${baseOVR} (position: ${position})`);

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
  private generateRatingsFromWAV(wAV: number, position: string, isHallOfFamer: boolean = false): MaddenRatings {
    // Get base OVR from wAV tier system
    const baseOVR = this.calculateBaseOVRFromWAV(wAV, position, isHallOfFamer);

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
   * These are practice squad / backup level players (50-65 OVR)
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
    // Filler players: 45-60 OVR (backup/practice squad level)
    const scaleFactor = isNonExistentTeam ? 0.45 : 0.65; // 45% or 65% of default ratings
    const minRating = isNonExistentTeam ? 30 : 45;

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
   * Determine body type based on position, weight, and height
   */
  private determineBodyType(position: string, weight?: number, height?: number): number {
    const pos = position.toUpperCase();
    const w = weight || this.getDefaultWeight(position);
    const h = height || 73; // Default 6'1"

    // Ensure we have valid numbers
    if (!w || !h || w <= 0 || h <= 0) {
      console.warn(`[CreatorService] Invalid weight/height for body type: w=${w}, h=${h}, using default Athletic (1)`);
      return 1; // Default Athletic
    }

    // Body types: 0=Lean, 1=Athletic, 2=Muscular, 3=Stocky
    const bmi = (w / (h * h)) * 703; // Calculate BMI

    if (['WR', 'CB', 'FS'].includes(pos)) {
      return bmi < 24 ? 0 : 1; // Lean or Athletic
    } else if (['HB', 'FB', 'SAM', 'Mike', 'WILL', 'SS', 'TE'].includes(pos)) {
      return bmi < 26 ? 1 : 2; // Athletic or Muscular
    } else if (['QB'].includes(pos)) {
      return 1; // Athletic
    } else if (['LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT'].includes(pos)) {
      return bmi < 32 ? 2 : 3; // Muscular or Stocky (linemen)
    } else {
      return 1; // Default Athletic
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
   * Cap ratings based on position for rookies
   * Prevents unrealistic ratings (e.g. LB with 99 zone coverage)
   * Remember: these are ROOKIES, not veterans. Even HOF players shouldn't exceed 79-80 overall.
   */
  private capRatingsByPosition(ratings: MaddenRatings, position: string): void {
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

    // Overall cap: NO rookie should exceed 80 overall (even HOF players)
    cap('overall', 80);
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
