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
   * Match player name to PID from lookup table
   * Returns 0 if no match found
   */
  private matchPID(firstName: string, lastName: string): number {
    const pidLookup = this.loadPIDLookup();
    const fullName = `${firstName} ${lastName}`.toLowerCase().replace(/[^a-z\s]/g, '');

    // ONLY try exact full name match - no partial matching to avoid false positives
    if (pidLookup.has(fullName)) {
      console.log(`[CreatorService] PID match: "${firstName} ${lastName}" -> PID ${pidLookup.get(fullName)}`);
      return pidLookup.get(fullName)!;
    }

    // No match - return 0 for generic face
    return 0;
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
    const normalized = scrapedCollegeName.toLowerCase().replace(/[^a-z\s]/g, '');

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
      'LEDG': { name: 'LEDG', code: 10 },
      'RE': { name: 'REDG', code: 11 },
      'REDG': { name: 'REDG', code: 11 },
      'DT': { name: 'DT', code: 12 },
      'NT': { name: 'DT', code: 12 }, // Nose tackles as DT

      // Linebackers
      'LB': { name: 'SAM', code: 13 }, // Default LBs to SAM
      'OLB': { name: 'SAM', code: 13 },
      'SAM': { name: 'SAM', code: 13 },
      'MLB': { name: 'Mike', code: 14 },
      'ILB': { name: 'Mike', code: 14 },
      'Mike': { name: 'Mike', code: 14 },
      'WILL': { name: 'WILL', code: 15 },

      // Secondary
      'CB': { name: 'CB', code: 16 },
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
   * Generate a draft class from web-scraped data
   * Includes drafted players + undrafted free agents (UDFAs)
   * @param year - Draft year
   * @param testingMode - If true, limit to ~40 players for faster testing
   * @returns Array of generated prospects
   */
  async generateDraftClass(year: number, testingMode: boolean = false): Promise<GeneratedPlayer[]> {
    console.log(`[CreatorService] Generating draft class for ${year} (Testing Mode: ${testingMode})`);

    try {
      // Step 1: Scrape drafted prospects using CSV export (MUCH faster!)
      let draftedProspects = await scraperService.scrapeDraftClassCSV(year);
      console.log(`[CreatorService] Scraped ${draftedProspects.length} drafted prospects from CSV`);

      if (draftedProspects.length === 0) {
        throw new Error(`No draft prospects found for ${year}`);
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

        // Convert career stats from draft table to PlayerStats format
        const stats = this.convertProspectToPlayerStats(prospect);

        // Map position to M26 format FIRST (needed for rating generation)
        const mappedPosition = this.mapPosition(prospect.position);

        // Generate ratings from career stats (or draft position if no stats)
        const ratings = stats && (stats.passAttempts || stats.rushAttempts || stats.receptions || stats.tackles)
          ? ratingCalculator.calculateRatings(stats)
          : this.generateDefaultRatings(prospect);

        // Ensure NO ratings are blank - default to 30 (or 1 for kickReturn)
        this.fillMissingRatings(ratings, mappedPosition.name);

        // Cap ratings by position (these are rookies!)
        this.capRatingsByPosition(ratings, mappedPosition.name);

        // Parse name
        const nameParts = prospect.name.split(' ');
        const firstName = nameParts[0] || 'John';
        const lastName = nameParts.slice(1).join(' ') || 'Doe';

        // Generate proper jersey number by position
        const jerseyNum = this.generateJerseyNumber(mappedPosition.name);

        // Calculate age based on draft year (prospects are typically 21-23)
        const age = this.calculateAge(year, prospect.round);

        // Parse height - if not available from scraper, generate realistic height by position
        const heightInches = prospect.height
          ? this.parseHeight(prospect.height)
          : this.generateHeight(mappedPosition.name);

        // Get weight with proper defaults
        const weight = prospect.weight || this.getDefaultWeight(mappedPosition.name);

        // Match PID from lookup table
        const matchedPID = this.matchPID(firstName, lastName);

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
          console.log(`[CreatorService] Player ${i+1} "${prospect.name}": scraped="${prospect.homeState}", generated="${generatedState}", finalID=${homeStateId}`);
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
          weight,
          homeState: homeStateId,
          devTrait: this.determineDevTrait(prospect.round, prospect.pick, ratings.overall, prospect.isHallOfFamer),
          ratings,
          PID: matchedPID,
          PEPS: null, // Generic head
          bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
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

          // Map position to M26 format
          const mappedPosition = this.mapPosition(playerStats.position);

          // Match PID from lookup table
          const matchedPID = this.matchPID(firstName, lastName);

          const player: GeneratedPlayer = {
            firstName,
            lastName,
            position: mappedPosition.name,
            positionCode: mappedPosition.code,
            college: this.matchCollege(playerStats.college || 'Unknown'),
            team: teamAbbr.toUpperCase(),
            jerseyNum: Math.floor(Math.random() * 99) + 1,
            age: playerStats.age || 25,
            heightInches: this.parseHeight(playerStats.height),
            weight: playerStats.weight || this.getDefaultWeight(mappedPosition.name),
            homeState: this.matchHomeState(this.generateHomeState()), // Generate realistic homestate
            devTrait: this.determineDevTraitFromRating(ratings.overall),
            ratings,
            PID: matchedPID,
            PEPS: null,
            bodyType: this.determineBodyType(mappedPosition.name, playerStats.weight),
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
   * Generate default ratings for a prospect when stats aren't available
   * Uses draft position as a proxy for talent
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
   * Determine dev trait based on draft position and overall
   */
  private determineDevTrait(round?: number, pick?: number, overall?: number, isHallOfFamer?: boolean): number {
    // 🏆 Hall of Famers ALWAYS get X-Factor dev trait!
    if (isHallOfFamer) {
      return 3; // X-Factor
    }

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
