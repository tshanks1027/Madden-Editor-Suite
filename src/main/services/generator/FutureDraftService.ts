/**
 * Future Draft Service
 *
 * Orchestrates generation of future draft classes (2026+) with:
 * - Hybrid archetype assignment (CSV baseline + NFL comp validation)
 * - Hybrid rating system (NFL comp baseline + wAV variance)
 * - Synthetic player generation to fill gaps (when CSV has < 402 prospects)
 *
 * Key Features:
 * - Uses FutureDraft_Lookup_MERGED.csv as primary data source
 * - Matches prospects to NFL comparables via ComparableMatcherService
 * - Applies realistic variance via VarianceRatingGenerator
 * - Generates complete 402-player draft classes (320 drafted + 82 UFA)
 */

import { playerDataService, FutureProspect, RookieStats } from './PlayerDataService';
import { comparableMatcherService } from './ComparableMatcherService';
import { VarianceRatingGenerator } from '../rating-modes/VarianceRatingGenerator';
import { RatingContext } from '../rating-modes/IRatingGenerator';
import { ArchetypeService } from '../utils/archetypeService';

// ===========================
// CONSTANTS
// ===========================

const TOTAL_PLAYERS = 402;
const DRAFT_PICKS = 320;  // ~80% drafted
const UFA_PLAYERS = 82;   // ~20% undrafted

/**
 * Position distribution targets for synthetic player generation
 */
const POSITION_TARGETS = {
  'QB': 28, 'HB': 19, 'FB': 6, 'WR': 50, 'TE': 22,
  'LT': 16, 'RT': 16, 'LG': 13, 'RG': 13, 'C': 13,
  'LE': 16, 'RE': 16, 'DT': 28, 'NT': 6,
  'LOLB': 16, 'ROLB': 16, 'MLB': 19,
  'CB': 47, 'FS': 16, 'SS': 16,
  'K': 3, 'P': 3, 'LS': 2
};

// ===========================
// INTERFACES
// ===========================

export interface FutureDraftOptions {
  year: number;              // 2026+
  ratingMode: 'variance';    // Only variance mode for future drafts
}

export interface EnrichedProspect extends FutureProspect {
  // Archetype (hybrid: CSV + validation)
  archetypeId?: number;
  archetypeConfidence?: number;

  // Ratings (hybrid: NFL comp baseline + variance)
  ratings?: Partial<RookieStats>;
  compConfidence?: number;

  // Draft assignment
  round?: string;
  pick?: string;

  // Metadata
  isSynthetic?: boolean;     // True if generated to fill gaps
}

// ===========================
// SERVICE
// ===========================

export class FutureDraftService {
  private varianceGenerator: VarianceRatingGenerator;

  constructor() {
    this.varianceGenerator = new VarianceRatingGenerator();
  }

  /**
   * Generate a complete future draft class (402 players)
   */
  public async generateFutureDraftClass(options: FutureDraftOptions): Promise<EnrichedProspect[]> {
    console.log(`\n[FutureDraftService] Generating ${options.year} draft class (Future)`);

    // Step 1: Load prospects from CSV
    const csvProspects = await this.loadProspectsFromCSV(options.year);
    console.log(`  - Loaded ${csvProspects.length} prospects from CSV`);

    // Step 2: Fill gaps if needed (< 402 players)
    const allProspects = await this.fillGapsIfNeeded(csvProspects, options.year);
    console.log(`  - Total prospects after gap filling: ${allProspects.length}`);

    // Step 3: Enrich with hybrid archetypes and ratings
    const enrichedProspects = await this.enrichProspects(allProspects);
    console.log(`  - Enriched ${enrichedProspects.length} prospects with ratings`);

    // Step 4: Assign draft positions (320 drafted + 82 UFA)
    this.assignDraftPositions(enrichedProspects);

    // Step 5: Return shallow copy to prevent mutations
    return [...enrichedProspects];
  }

  /**
   * Load prospects from CSV for a given year
   */
  private async loadProspectsFromCSV(year: number): Promise<FutureProspect[]> {
    const prospects = await playerDataService.getPlayersByYear(year);

    // Sort by rank (ascending) - best prospects first
    prospects.sort((a, b) => {
      const rankA = (a as FutureProspect).rank || 999;
      const rankB = (b as FutureProspect).rank || 999;
      return rankA - rankB;
    });

    return prospects as FutureProspect[];
  }

  /**
   * Fill gaps to reach 402 players if CSV has fewer
   * Generates synthetic prospects using position distribution
   */
  private async fillGapsIfNeeded(
    csvProspects: FutureProspect[],
    year: number
  ): Promise<FutureProspect[]> {

    if (csvProspects.length >= TOTAL_PLAYERS) {
      // Trim to exactly 402 if we have more
      return csvProspects.slice(0, TOTAL_PLAYERS);
    }

    const neededCount = TOTAL_PLAYERS - csvProspects.length;
    console.log(`  - Generating ${neededCount} synthetic prospects to reach 402`);

    // Count existing positions
    const positionCounts = new Map<string, number>();
    for (const prospect of csvProspects) {
      const pos = this.normalizePosition(prospect.position);
      positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
    }

    // Generate synthetic prospects for underrepresented positions
    const syntheticProspects: FutureProspect[] = [];
    const positions = Object.keys(POSITION_TARGETS);

    for (let i = 0; i < neededCount; i++) {
      // Find most underrepresented position
      let targetPosition = 'WR'; // Default
      let maxDeficit = 0;

      for (const pos of positions) {
        const target = POSITION_TARGETS[pos as keyof typeof POSITION_TARGETS] || 0;
        const current = positionCounts.get(pos) || 0;
        const deficit = target - current;

        if (deficit > maxDeficit) {
          maxDeficit = deficit;
          targetPosition = pos;
        }
      }

      // Generate synthetic prospect
      const synthetic = this.generateSyntheticProspect(targetPosition, year, i);
      syntheticProspects.push(synthetic);
      positionCounts.set(targetPosition, (positionCounts.get(targetPosition) || 0) + 1);
    }

    return [...csvProspects, ...syntheticProspects];
  }

  /**
   * Generate a synthetic prospect for position distribution balance
   */
  private generateSyntheticProspect(
    position: string,
    year: number,
    index: number
  ): FutureProspect {

    // Generate realistic physical stats based on position
    const physicals = this.getPositionPhysicals(position);

    return {
      lastName: `Prospect${index}`,
      firstName: `Generated`,
      college: 'Unknown',
      position,
      draftClass: year,
      height: physicals.height,
      weight: physicals.weight,
      wAV: 20 + Math.random() * 20, // 20-40 range for synthetic players
      archetype: this.getDefaultArchetype(position),
      rank: 999 + index,
      class: 'Sr.'
    };
  }

  /**
   * Get realistic physical stats for a position
   */
  private getPositionPhysicals(position: string): { height: number, weight: number } {
    const physicals: { [key: string]: { height: number, weight: number } } = {
      'QB': { height: 75, weight: 220 },
      'HB': { height: 70, weight: 210 },
      'FB': { height: 72, weight: 245 },
      'WR': { height: 73, weight: 200 },
      'TE': { height: 77, weight: 250 },
      'LT': { height: 77, weight: 310 },
      'RT': { height: 77, weight: 310 },
      'LG': { height: 75, weight: 305 },
      'RG': { height: 75, weight: 305 },
      'C': { height: 74, weight: 300 },
      'LE': { height: 76, weight: 275 },
      'RE': { height: 76, weight: 275 },
      'DT': { height: 75, weight: 305 },
      'NT': { height: 73, weight: 330 },
      'LOLB': { height: 74, weight: 245 },
      'ROLB': { height: 74, weight: 245 },
      'MLB': { height: 73, weight: 240 },
      'CB': { height: 71, weight: 190 },
      'FS': { height: 72, weight: 200 },
      'SS': { height: 72, weight: 210 },
      'K': { height: 72, weight: 195 },
      'P': { height: 73, weight: 205 },
      'LS': { height: 73, weight: 245 }
    };

    const base = physicals[position] || { height: 73, weight: 220 };

    // Add small variance
    return {
      height: base.height + Math.floor(Math.random() * 4 - 2), // ±2 inches
      weight: base.weight + Math.floor(Math.random() * 20 - 10) // ±10 pounds
    };
  }

  /**
   * Get default archetype for position
   */
  private getDefaultArchetype(position: string): string {
    const defaults: { [key: string]: string } = {
      'QB': 'Field General',
      'HB': 'Balanced',
      'FB': 'Blocking',
      'WR': 'Route Runner',
      'TE': 'Vertical Threat',
      'LT': 'Pass Protector',
      'RT': 'Pass Protector',
      'LG': 'Pass Protector',
      'RG': 'Pass Protector',
      'C': 'Pass Protector',
      'LE': 'Power Rusher',
      'RE': 'Power Rusher',
      'DT': 'Run Stopper',
      'NT': 'Run Stopper',
      'LOLB': 'Pass Coverage',
      'ROLB': 'Pass Coverage',
      'MLB': 'Field General',
      'CB': 'Man-to-Man',
      'FS': 'Zone',
      'SS': 'Run Support',
      'K': 'Accurate',
      'P': 'Power',
      'LS': 'Accurate'
    };

    return defaults[position] || 'Balanced';
  }

  /**
   * Enrich prospects with hybrid archetypes and ratings
   *
   * Hybrid Approach:
   * 1. Use CSV archetype as baseline
   * 2. Find NFL comparables via ComparableMatcherService
   * 3. Validate archetype against comp data (adjust if low confidence)
   * 4. Use comp ratings as baseline
   * 5. Apply variance based on wAV and archetype
   */
  private async enrichProspects(prospects: FutureProspect[]): Promise<EnrichedProspect[]> {
    const enriched: EnrichedProspect[] = [];

    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];

      if (i < 5 || i % 50 === 0) {
        console.log(`  - Enriching prospect ${i + 1}/${prospects.length}: ${prospect.firstName} ${prospect.lastName} (${prospect.position})`);
      }

      // Step 1: Find NFL comparables
      const compResult = await comparableMatcherService.findComparables(prospect, 5);

      // Step 2: Hybrid archetype assignment
      const archetype = this.assignHybridArchetype(prospect, compResult.comparables);

      if (i < 3) {
        console.log(`  - Archetype for ${prospect.firstName} ${prospect.lastName}: "${archetype.name}" (ID: ${archetype.id})`);
        console.log(`    CSV archetype: "${prospect.archetype}", CSV detailed: "${prospect.archetypeDetailed}"`);
      }

      // Step 3: Hybrid rating generation
      const ratings = await this.generateHybridRatings(
        prospect,
        compResult,
        archetype.name
      );

      enriched.push({
        ...prospect,
        archetype: archetype.name,
        archetypeId: archetype.id,
        archetypeConfidence: archetype.confidence,
        ratings,
        compConfidence: compResult.confidence
      });
    }

    return enriched;
  }

  /**
   * Assign archetype using hybrid approach
   * - Use CSV archetype as baseline
   * - Validate against NFL comparable archetypes
   * - Adjust if comparables strongly suggest different archetype
   */
  private assignHybridArchetype(
    prospect: FutureProspect,
    comparables: Array<{ player: RookieStats, matchScore: number }>
  ): { name: string, id: number, confidence: number } {

    // Start with CSV archetype (use detailed version which has position prefix)
    // CSV has: archetype = "Run Stopper", archetypeDetailed = "MLB Run Stopper"
    // We want the detailed version for proper archetype ID lookup
    let archetypeName = prospect.archetypeDetailed || prospect.archetype || this.getDefaultArchetype(prospect.position);
    let confidence = 0.7; // Medium confidence in CSV data

    // If we have good comparables, validate archetype
    if (comparables.length > 0) {
      const topComp = comparables[0];

      // If top comparable has high match score and different archetype, consider switching
      if (topComp.matchScore > 70 && topComp.player.archetype) {
        const compArchetype = topComp.player.archetype;

        // Check if multiple comps agree on this archetype
        const compArchetypes = comparables
          .map(c => c.player.archetype)
          .filter(a => a);

        const compArchetypeCounts = new Map<string, number>();
        for (const arch of compArchetypes) {
          compArchetypeCounts.set(arch, (compArchetypeCounts.get(arch) || 0) + 1);
        }

        const mostCommonCompArchetype = Array.from(compArchetypeCounts.entries())
          .sort((a, b) => b[1] - a[1])[0];

        // If 3+ comparables agree, trust comp archetype more
        if (mostCommonCompArchetype && mostCommonCompArchetype[1] >= 3) {
          archetypeName = mostCommonCompArchetype[0];
          confidence = 0.9; // High confidence from comp agreement
        }
      }
    }

    // Get archetype ID from ArchetypeService
    const archetypeId = ArchetypeService.getArchetypeId(archetypeName, prospect.position);

    return { name: archetypeName, id: archetypeId, confidence };
  }

  /**
   * Generate ratings using hybrid approach
   * - Use NFL comparable ratings as baseline
   * - Apply variance based on wAV difference and archetype
   * - Create realistic draft uncertainty (sleepers, gems, reaches)
   */
  private async generateHybridRatings(
    prospect: FutureProspect,
    compResult: { averagedRatings: Partial<RookieStats>, confidence: number },
    archetype: string
  ): Promise<Partial<RookieStats>> {

    // Build proper RatingContext for VarianceRatingGenerator
    const draftRound = prospect.round && prospect.round !== 'UD' ? parseInt(prospect.round) : undefined;
    const draftPosition = prospect.pick && prospect.pick !== 'UD' ? parseInt(prospect.pick) : undefined;

    const ratingContext = {
      position: prospect.position,
      draftRound,
      draftPosition,
      name: `${prospect.firstName} ${prospect.lastName}`,
      careerStats: {
        wAV: prospect.wAV,
        draftClass: prospect.draftClass,
        archetype,
        height: prospect.height,
        weight: prospect.weight
      }
    };

    // If we have good comp data, use it as baseline
    if (compResult.confidence > 0.5 && Object.keys(compResult.averagedRatings).length > 0) {
      // Use comp ratings as baseline
      const baselineRatings = compResult.averagedRatings;

      // Generate ratings with variance using proper context
      const variantRatings = await this.varianceGenerator.generateRatings(ratingContext);

      // Blend comp baseline with variance (70% comp, 30% variance for high confidence)
      const blendFactor = compResult.confidence;
      const blendedRatings: Partial<RookieStats> = {};

      // Convert PlayerRatings back to RookieStats format
      for (const key of Object.keys(variantRatings)) {
        const compValue = baselineRatings[key.toLowerCase() as keyof RookieStats] as number || 65;
        const varValue = variantRatings[key as keyof typeof variantRatings] as number || 65;

        // Blend: higher comp confidence = more weight on comp ratings
        blendedRatings[key.toLowerCase() as keyof RookieStats] = Math.round(
          compValue * blendFactor + varValue * (1 - blendFactor)
        );
      }

      // Ensure POVR is set
      if (variantRatings.POVR) {
        blendedRatings.povr = Math.round(
          (baselineRatings.povr || 65) * blendFactor + variantRatings.POVR * (1 - blendFactor)
        );
      }

      return blendedRatings;

    } else {
      // Low comp confidence - rely fully on variance generator
      const variantRatings = await this.varianceGenerator.generateRatings(ratingContext);

      // Convert PlayerRatings to RookieStats format (lowercase keys)
      const rookieStats: Partial<RookieStats> = {};
      for (const [key, value] of Object.entries(variantRatings)) {
        rookieStats[key.toLowerCase() as keyof RookieStats] = value as number;
      }

      return rookieStats;
    }
  }

  /**
   * Assign draft positions (320 drafted + 82 UFA)
   */
  private assignDraftPositions(prospects: EnrichedProspect[]): void {
    const PICKS_PER_ROUND = 32;

    for (let i = 0; i < prospects.length; i++) {
      if (i < DRAFT_PICKS) {
        const round = Math.floor(i / PICKS_PER_ROUND) + 1;
        const pick = (i % PICKS_PER_ROUND) + 1;
        prospects[i].round = String(round);
        prospects[i].pick = String(pick);
      } else {
        prospects[i].round = 'UD';
        prospects[i].pick = 'UD';
      }
    }
  }

  /**
   * Normalize position for consistent grouping
   */
  private normalizePosition(position: string): string {
    const normalized: { [key: string]: string } = {
      'HB': 'RB',
      'LT': 'OT', 'RT': 'OT',
      'LG': 'G', 'RG': 'G', 'OG': 'G',
      'LE': 'DE', 'RE': 'DE', 'EDGE': 'DE',
      'LOLB': 'OLB', 'ROLB': 'OLB',
      'ILB': 'MLB',
      'FS': 'S', 'SS': 'S'
    };

    return normalized[position] || position;
  }
}

// Export singleton instance
export const futureDraftService = new FutureDraftService();
