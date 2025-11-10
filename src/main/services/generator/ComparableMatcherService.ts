/**
 * Comparable Matcher Service
 *
 * Finds NFL comparable players for future prospects based on:
 * - Position
 * - wAV (Weighted Approximate Value) range
 * - Archetype similarity
 * - Physical attributes (height, weight)
 *
 * Used for "Madden Rating" mode with future prospects (2026+) to assign
 * realistic ratings based on similar NFL players' rookie stats.
 */

import { playerDataService, RookieStats, FutureProspect } from './PlayerDataService';

// ===========================
// INTERFACES
// ===========================

export interface ComparablePlayer {
  player: RookieStats;
  matchScore: number;           // 0-100, higher = better match
  wAVDifference: number;
  heightDifference: number;     // Inches
  weightDifference: number;     // Pounds
  archetypeMatch: boolean;
}

export interface ComparableMatchResult {
  comparables: ComparablePlayer[];
  averagedRatings: Partial<RookieStats>;
  confidence: number;           // 0-1, based on match quality and quantity
}

// ===========================
// SERVICE
// ===========================

export class ComparableMatcherService {

  /**
   * Find comparable NFL players for a future prospect
   *
   * @param prospect Future prospect to find comparables for
   * @param maxResults Maximum number of comparables to return (default 5)
   * @returns Comparable players and averaged ratings
   */
  public async findComparables(
    prospect: FutureProspect,
    maxResults: number = 5
  ): Promise<ComparableMatchResult> {

    console.log(`[ComparableMatcherService] Finding comparables for ${prospect.firstName} ${prospect.lastName} (${prospect.position})`);

    // Step 1: Get all rookie stats data
    await playerDataService.initialize();
    const allRookieStats = await this.getAllRookieStats();

    // Step 2: Filter by position
    const positionMatches = allRookieStats.filter(stats =>
      this.matchPosition(stats.position, prospect.position)
    );

    console.log(`  - Position matches: ${positionMatches.length} / ${allRookieStats.length}`);

    if (positionMatches.length === 0) {
      console.warn(`  - No position matches found for ${prospect.position}`);
      return {
        comparables: [],
        averagedRatings: {},
        confidence: 0
      };
    }

    // Step 3: Score and rank candidates
    const scoredCandidates: ComparablePlayer[] = positionMatches.map(stats => {
      const matchScore = this.calculateMatchScore(prospect, stats);
      return {
        player: stats,
        matchScore,
        wAVDifference: Math.abs((prospect.wAV || 0) - (stats.av || 0)),
        heightDifference: Math.abs((prospect.height || 0) - (stats.height || 0)),
        weightDifference: Math.abs((prospect.weight || 0) - (stats.weight || 0)),
        archetypeMatch: this.matchArchetype(prospect.archetype, stats.archetype)
      };
    });

    // Step 4: Sort by match score (descending) and take top N
    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);
    const topComparables = scoredCandidates.slice(0, maxResults);

    console.log(`  - Top comparable: ${topComparables[0]?.player.playerName} (score: ${topComparables[0]?.matchScore.toFixed(1)})`);

    // Step 5: Average rookie stats from top comparables
    const averagedRatings = this.averageRookieStats(topComparables.map(c => c.player));

    // Step 6: Calculate confidence based on match quality
    const confidence = this.calculateConfidence(topComparables);

    return {
      comparables: topComparables,
      averagedRatings,
      confidence
    };
  }

  /**
   * Get all rookie stats from ROSTER_lookup (cached in PlayerDataService)
   */
  private async getAllRookieStats(): Promise<RookieStats[]> {
    // Access the private rosterLookupCache via a public method
    // For now, we'll need to add a public method to PlayerDataService
    // Workaround: Load directly from CSV since PlayerDataService doesn't expose it yet

    const allStats: RookieStats[] = [];

    // Get all available years from 1970-2024 (ROSTER_lookup range)
    for (let year = 1970; year <= 2024; year++) {
      // We need PlayerDataService to expose this, but for now we'll work with
      // what we have. This is a limitation we'll address in integration phase.
    }

    // TODO: Add getAllRosterLookupData() method to PlayerDataService
    // For now, return empty array - will be fixed in Phase 4 integration
    console.warn('[ComparableMatcherService] getAllRookieStats not yet implemented - needs PlayerDataService update');
    return [];
  }

  /**
   * Check if two positions match
   * Handles position group equivalences (e.g., LT/RT both = OT)
   */
  private matchPosition(statsPosition: string, prospectPosition: string): boolean {
    // Normalize positions
    const normalize = (pos: string): string => {
      const normalized: { [key: string]: string } = {
        'LT': 'OT', 'RT': 'OT',
        'LG': 'G', 'RG': 'G', 'OG': 'G',
        'LE': 'DE', 'RE': 'DE', 'EDGE': 'DE',
        'LOLB': 'OLB', 'ROLB': 'OLB',
        'FS': 'S', 'SS': 'S',
        'HB': 'RB', 'FB': 'RB'
      };
      return normalized[pos] || pos;
    };

    return normalize(statsPosition) === normalize(prospectPosition);
  }

  /**
   * Check if archetypes match (simplified archetype names)
   */
  private matchArchetype(prospectArchetype?: string, statsArchetype?: string): boolean {
    if (!prospectArchetype || !statsArchetype) {
      return false; // Can't match if either is missing
    }

    // Exact match
    if (prospectArchetype.toLowerCase() === statsArchetype.toLowerCase()) {
      return true;
    }

    // Partial match (e.g., "Power" in "Power Back")
    const prospectLower = prospectArchetype.toLowerCase();
    const statsLower = statsArchetype.toLowerCase();

    if (prospectLower.includes(statsLower) || statsLower.includes(prospectLower)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate match score for a candidate (0-100)
   *
   * Scoring weights:
   * - wAV similarity: 40%
   * - Archetype match: 30%
   * - Physical attributes: 30% (height 15%, weight 15%)
   */
  private calculateMatchScore(prospect: FutureProspect, stats: RookieStats): number {
    let score = 0;

    // 1. wAV similarity (40 points max)
    const prospectWAV = prospect.wAV || 0;
    const statsAV = stats.av || 0;
    const wAVDiff = Math.abs(prospectWAV - statsAV);

    if (wAVDiff === 0) {
      score += 40;
    } else if (wAVDiff <= 5) {
      score += 40 * (1 - (wAVDiff / 5) * 0.5); // 40 points at 0 diff, 20 points at 5 diff
    } else if (wAVDiff <= 10) {
      score += 20 * (1 - ((wAVDiff - 5) / 5)); // 20 points at 5 diff, 0 points at 10+ diff
    }

    // 2. Archetype match (30 points max)
    if (this.matchArchetype(prospect.archetype, stats.archetype)) {
      score += 30;
    }

    // 3. Height similarity (15 points max)
    if (prospect.height && stats.height) {
      const heightDiff = Math.abs(prospect.height - stats.height);
      if (heightDiff === 0) {
        score += 15;
      } else if (heightDiff <= 2) {
        score += 15 * (1 - (heightDiff / 2) * 0.5); // 15 at 0", 7.5 at 2"
      } else if (heightDiff <= 4) {
        score += 7.5 * (1 - ((heightDiff - 2) / 2)); // 7.5 at 2", 0 at 4"
      }
    }

    // 4. Weight similarity (15 points max)
    if (prospect.weight && stats.weight) {
      const weightDiff = Math.abs(prospect.weight - stats.weight);
      if (weightDiff === 0) {
        score += 15;
      } else if (weightDiff <= 15) {
        score += 15 * (1 - (weightDiff / 15) * 0.5); // 15 at 0 lbs, 7.5 at 15 lbs
      } else if (weightDiff <= 30) {
        score += 7.5 * (1 - ((weightDiff - 15) / 15)); // 7.5 at 15 lbs, 0 at 30 lbs
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Average rookie stats from multiple players
   */
  private averageRookieStats(players: RookieStats[]): Partial<RookieStats> {
    if (players.length === 0) {
      return {};
    }

    // List of all rating attributes to average
    const ratingAttributes = [
      'pspd', 'pacc', 'pstr', 'pagi', 'pawr', 'pcth', 'pcar', 'pthp', 'pkpw', 'pkac',
      'prbk', 'ppbk', 'ptak', 'pbtk', 'pjmp', 'pinj', 'psta', 'ptgh', 'ptrk', 'pcod',
      'pbcv', 'pstf', 'pspm', 'pjum', 'pibl', 'prbp', 'prbf', 'ppbp', 'ppbf', 'pldb',
      'pbrs', 'ptup', 'ppwm', 'pfnm', 'pbsh', 'ppur', 'pprc', 'pmcv', 'pzcv', 'pspc',
      'pcit', 'psrr', 'pmrr', 'pdrr', 'phtp', 'pprs', 'prel', 'ptas', 'ptam', 'ptad',
      'ppla', 'ptor', 'povr'
    ];

    const averaged: any = {};

    // Average each rating
    for (const attr of ratingAttributes) {
      const values = players
        .map(p => (p as any)[attr])
        .filter(v => v !== undefined && v !== null && !isNaN(v));

      if (values.length > 0) {
        const sum = values.reduce((acc, v) => acc + v, 0);
        averaged[attr] = Math.round(sum / values.length);
      }
    }

    // Take most common archetype
    const archetypes = players
      .map(p => p.archetype)
      .filter(a => a);

    if (archetypes.length > 0) {
      averaged.archetype = this.mostCommon(archetypes);
    }

    // Take most common dev trait
    const devTraits = players
      .map(p => p.devTrait)
      .filter(d => d);

    if (devTraits.length > 0) {
      averaged.devTrait = this.mostCommon(devTraits);
    }

    return averaged;
  }

  /**
   * Find most common element in an array
   */
  private mostCommon<T>(arr: T[]): T {
    const counts = new Map<T, number>();

    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon = arr[0];

    for (const [item, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }

    return mostCommon;
  }

  /**
   * Calculate confidence score based on match quality
   *
   * @returns 0-1 confidence score
   */
  private calculateConfidence(comparables: ComparablePlayer[]): number {
    if (comparables.length === 0) {
      return 0;
    }

    // Factors affecting confidence:
    // 1. Number of comparables found (more = better)
    // 2. Average match score (higher = better)
    // 3. Consistency of match scores (less variance = better)

    const countFactor = Math.min(1.0, comparables.length / 5); // 5+ comparables = full confidence

    const avgScore = comparables.reduce((sum, c) => sum + c.matchScore, 0) / comparables.length;
    const scoreFactor = avgScore / 100;

    // Variance: measure how consistent the match scores are
    const variance = comparables.reduce((sum, c) => {
      return sum + Math.pow(c.matchScore - avgScore, 2);
    }, 0) / comparables.length;
    const stdDev = Math.sqrt(variance);
    const consistencyFactor = Math.max(0, 1 - (stdDev / 50)); // High std dev reduces confidence

    // Weighted combination
    const confidence = (countFactor * 0.3) + (scoreFactor * 0.5) + (consistencyFactor * 0.2);

    return Math.max(0, Math.min(1, confidence));
  }
}

// Export singleton instance
export const comparableMatcherService = new ComparableMatcherService();
