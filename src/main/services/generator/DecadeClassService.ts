/**
 * Decade Class Service
 *
 * Creates "decade class" draft classes by aggregating the best players from
 * an entire decade (e.g., 1970s, 1990s) into a single mega-draft.
 *
 * Features:
 * - Position-balanced distribution (more QBs, WRs, CBs like real drafts)
 * - Includes both drafted and undrafted players
 * - Ranks by wAV (career value)
 * - Generates 402 total players (drafted + UFAs combined)
 */

import { playerDataService, HistoricalPlayer } from './PlayerDataService';

// ===========================
// CONSTANTS
// ===========================

/**
 * Madden draft structure (402 total players including UFAs)
 */
const TOTAL_PLAYERS = 402;
const DRAFT_PICKS = 320;  // ~80% drafted
const UFA_PLAYERS = 82;   // ~20% undrafted free agents

/**
 * Position distribution targets for a 402-pick draft
 * Based on modern NFL draft trends with premium on QB, WR, CB
 * Scaled to 402 picks (1.57x original 256-pick distribution)
 */
const POSITION_TARGETS = {
  // Offense
  'QB': 28,      // ~7% (premium position)
  'HB': 19,      // ~5%
  'RB': 19,      // Alias for HB
  'FB': 6,       // ~1.5%
  'WR': 50,      // ~12.5% (most drafted skill position)
  'TE': 22,      // ~5.5%
  'LT': 16,      // ~4%
  'RT': 16,      // ~4%
  'OT': 31,      // Combined OT if LT/RT not specified
  'LG': 13,      // ~3%
  'RG': 13,      // ~3%
  'G': 25,       // Combined G if LG/RG not specified
  'OG': 25,      // Alias for G
  'C': 13,       // ~3%

  // Defense
  'LE': 16,      // ~4%
  'RE': 16,      // ~4%
  'DE': 31,      // Combined DE if LE/RE not specified
  'EDGE': 31,    // Modern designation for edge rushers
  'DT': 28,      // ~7%
  'NT': 6,       // ~1.5% (nose tackle)
  'LOLB': 16,    // ~4%
  'ROLB': 16,    // ~4%
  'OLB': 31,     // Combined OLB if LOLB/ROLB not specified
  'MLB': 19,     // ~5%
  'ILB': 19,     // Alias for MLB
  'LB': 35,      // Generic LB
  'CB': 47,      // ~12% (premium secondary position)
  'FS': 16,      // ~4%
  'SS': 16,      // ~4%
  'S': 31,       // Combined S if FS/SS not specified

  // Special Teams
  'K': 3,        // ~0.7%
  'P': 3,        // ~0.7%
  'LS': 2        // ~0.5%
};

// ===========================
// SERVICE
// ===========================

export class DecadeClassService {

  /**
   * Create a decade class draft
   *
   * @param decade Decade start year (e.g., 1970, 1990, 2000)
   * @returns Array of 402 total players (320 drafted + 82 UFA)
   */
  public async createDecadeClass(decade: number): Promise<HistoricalPlayer[]> {
    console.log(`[DecadeClassService] Creating decade class for ${decade}s`);

    // Step 1: Load all players from the decade
    const allPlayers = await playerDataService.getPlayersByDecade(decade);
    console.log(`  - Loaded ${allPlayers.length} players from ${decade}-${decade + 9}`);

    if (allPlayers.length === 0) {
      console.warn(`  - No players found for decade ${decade}s`);
      return [];
    }

    // Step 2: Rank by wAV (career value)
    const rankedPlayers = this.rankPlayersByWAV(allPlayers);

    // Step 3: Separate drafted and undrafted players
    const drafted = rankedPlayers.filter(p => p.round && p.round !== 'UD');
    const undrafted = rankedPlayers.filter(p => !p.round || p.round === 'UD');

    console.log(`  - Drafted: ${drafted.length}, Undrafted: ${undrafted.length}`);

    // Step 4: Select top players with position distribution
    const draftClass = this.selectPlayersWithDistribution(drafted, DRAFT_PICKS);
    const ufaClass = this.selectPlayersWithDistribution(undrafted, UFA_PLAYERS);

    // Step 5: Combine and assign draft positions
    const finalClass = [...draftClass, ...ufaClass];
    this.assignDraftPositions(finalClass);

    console.log(`  - Final decade class: ${finalClass.length} players`);
    console.log(`  - Position distribution:`);
    this.logPositionDistribution(finalClass);

    return finalClass;
  }

  /**
   * Rank players by wAV (descending)
   */
  private rankPlayersByWAV(players: HistoricalPlayer[]): HistoricalPlayer[] {
    return players.sort((a, b) => {
      const wAVA = a.wAV || 0;
      const wAVB = b.wAV || 0;
      return wAVB - wAVA; // Descending
    });
  }

  /**
   * Select players with realistic position distribution
   *
   * Algorithm:
   * 1. Group players by position
   * 2. Fill draft slots based on position targets
   * 3. Fill remaining slots with best available players
   */
  private selectPlayersWithDistribution(
    players: HistoricalPlayer[],
    totalSlots: number
  ): HistoricalPlayer[] {

    const selected: HistoricalPlayer[] = [];
    const remaining = [...players]; // Copy to avoid mutating original

    // Group by normalized position
    const byPosition = new Map<string, HistoricalPlayer[]>();
    for (const player of remaining) {
      const normalizedPos = this.normalizePosition(player.position);
      if (!byPosition.has(normalizedPos)) {
        byPosition.set(normalizedPos, []);
      }
      byPosition.get(normalizedPos)!.push(player);
    }

    // Calculate scaled targets based on total slots
    const scaleFactor = totalSlots / DRAFT_PICKS;
    const scaledTargets = new Map<string, number>();
    for (const [pos, target] of Object.entries(POSITION_TARGETS)) {
      scaledTargets.set(pos, Math.round(target * scaleFactor));
    }

    // Phase 1: Fill slots based on position targets
    for (const [position, target] of scaledTargets.entries()) {
      const available = byPosition.get(position) || [];
      const toSelect = Math.min(target, available.length);

      for (let i = 0; i < toSelect && selected.length < totalSlots; i++) {
        selected.push(available[i]);
      }
    }

    // Phase 2: Fill remaining slots with best available (by wAV)
    const alreadySelected = new Set(selected);
    const bestAvailable = remaining
      .filter(p => !alreadySelected.has(p))
      .sort((a, b) => (b.wAV || 0) - (a.wAV || 0));

    for (const player of bestAvailable) {
      if (selected.length >= totalSlots) break;
      selected.push(player);
    }

    console.log(`  - Selected ${selected.length} / ${totalSlots} players`);

    return selected;
  }

  /**
   * Normalize position names for consistent grouping
   */
  private normalizePosition(position: string): string {
    const normalized: { [key: string]: string } = {
      'HB': 'RB',
      'LT': 'OT',
      'RT': 'OT',
      'LG': 'G',
      'RG': 'G',
      'OG': 'G',
      'LE': 'DE',
      'RE': 'DE',
      'LOLB': 'OLB',
      'ROLB': 'OLB',
      'ILB': 'MLB',
      'FS': 'S',
      'SS': 'S'
    };

    return normalized[position] || position;
  }

  /**
   * Assign realistic draft positions to players
   *
   * First 320 players: Round and pick based on position
   * Remaining 82 players: Undrafted (UD)
   */
  private assignDraftPositions(players: HistoricalPlayer[]): void {
    const PICKS_PER_ROUND = 32;

    for (let i = 0; i < players.length; i++) {
      if (i < DRAFT_PICKS) {
        const round = Math.floor(i / PICKS_PER_ROUND) + 1;
        const pick = (i % PICKS_PER_ROUND) + 1;
        players[i].round = String(round);
        players[i].pick = String(pick);
      } else {
        players[i].round = 'UD';
        players[i].pick = 'UD';
      }
    }
  }

  /**
   * Log position distribution for debugging
   */
  private logPositionDistribution(players: HistoricalPlayer[]): void {
    const counts = new Map<string, number>();

    for (const player of players) {
      const pos = this.normalizePosition(player.position);
      counts.set(pos, (counts.get(pos) || 0) + 1);
    }

    // Sort by count descending
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

    for (const [pos, count] of sorted.slice(0, 15)) {
      const pct = ((count / players.length) * 100).toFixed(1);
      console.log(`    ${pos}: ${count} (${pct}%)`);
    }
  }

  /**
   * Get position distribution summary
   */
  public getPositionDistribution(players: HistoricalPlayer[]): { position: string, count: number, percentage: number }[] {
    const counts = new Map<string, number>();

    for (const player of players) {
      const pos = this.normalizePosition(player.position);
      counts.set(pos, (counts.get(pos) || 0) + 1);
    }

    const distribution = Array.from(counts.entries()).map(([position, count]) => ({
      position,
      count,
      percentage: (count / players.length) * 100
    }));

    return distribution.sort((a, b) => b.count - a.count);
  }

  /**
   * Get decade options for UI selector
   */
  public getDecadeOptions(): { label: string, value: number }[] {
    return [
      { label: '1930s', value: 1930 },
      { label: '1940s', value: 1940 },
      { label: '1950s', value: 1950 },
      { label: '1960s', value: 1960 },
      { label: '1970s', value: 1970 },
      { label: '1980s', value: 1980 },
      { label: '1990s', value: 1990 },
      { label: '2000s', value: 2000 },
      { label: '2010s', value: 2010 },
      { label: '2020s', value: 2020 }
    ];
  }
}

// Export singleton instance
export const decadeClassService = new DecadeClassService();
