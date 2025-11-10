/**
 * Draft Size Service
 *
 * Returns historically accurate draft sizes for different eras.
 *
 * Historical draft sizes have varied significantly:
 * - 1936-1942: 200+ picks (varied by year)
 * - 1943-1946: ~300 picks (wartime expanded rosters)
 * - 1947-1966: ~280-390 picks (20-30 rounds)
 * - 1967-1993: ~330 picks (12 rounds with expansions)
 * - 1994-2010: ~255 picks (7 rounds)
 * - 2011+: 402 picks (Madden's expanded draft with compensatory picks)
 */

export class DraftSizeService {

  /**
   * Get the appropriate draft size for a given year
   *
   * @param year Draft year
   * @returns Number of draft picks for that year
   */
  public getDraftSize(year: number): number {
    // Modern era (2011+): Madden uses 402 picks (includes compensatory/additional rounds)
    if (year >= 2011) {
      return 402;
    }

    // Post-expansion era (1994-2010): 30-32 teams × 7 rounds ≈ 255 picks
    if (year >= 1994) {
      return 255;
    }

    // Mid-expansion era (1967-1993): 12 rounds with varying teams
    if (year >= 1967) {
      const teams = this.getTeamCountForYear(year);
      return teams * 12; // 12 rounds
    }

    // Classic era (1960-1966): 20 rounds (AFL-NFL competition)
    if (year >= 1960) {
      return 280; // ~14 teams × 20 rounds
    }

    // Pre-AFL era (1947-1959): 30 rounds
    if (year >= 1947) {
      return 360; // ~12 teams × 30 rounds
    }

    // Wartime era (1943-1946): Expanded rosters, ~300 picks
    if (year >= 1943) {
      return 300;
    }

    // Early era (1936-1942): Varied, but generally 200-250
    if (year >= 1936) {
      return 220;
    }

    // Default: Modern size
    return 256;
  }

  /**
   * Get number of rounds for a given year
   */
  public getRoundsForYear(year: number): number {
    if (year >= 2011) return 7;          // Modern era
    if (year >= 1994) return 7;          // Post-expansion
    if (year >= 1967) return 12;         // Mid-expansion
    if (year >= 1960) return 20;         // AFL-NFL era
    if (year >= 1947) return 30;         // Classic long draft
    if (year >= 1943) return 30;         // Wartime
    if (year >= 1936) return 20;         // Early era
    return 7;                             // Default modern
  }

  /**
   * Get estimated number of NFL teams for a year
   * (Used for calculating draft sizes in older eras)
   */
  private getTeamCountForYear(year: number): number {
    if (year >= 2002) return 32;         // Houston Texans expansion
    if (year >= 1999) return 31;         // Cleveland Browns return
    if (year >= 1995) return 30;         // Carolina Panthers, Jacksonville Jaguars
    if (year >= 1976) return 28;         // Tampa Bay Buccaneers, Seattle Seahawks
    if (year >= 1970) return 26;         // AFL-NFL merger complete
    if (year >= 1967) return 24;         // New Orleans Saints
    if (year >= 1966) return 24;         // Atlanta Falcons
    if (year >= 1961) return 14;         // Minnesota Vikings
    if (year >= 1960) return 13;         // Dallas Cowboys
    if (year >= 1950) return 12;         // Post-AAFC merger
    if (year >= 1936) return 10;         // Early NFL
    return 32;                            // Default modern
  }

  /**
   * Get era description for a year
   */
  public getEraDescription(year: number): string {
    if (year >= 2011) return 'Modern Era (7 rounds, 32 teams)';
    if (year >= 1994) return 'Post-Expansion Era (7 rounds, 30-32 teams)';
    if (year >= 1967) return 'Expansion Era (12 rounds, 24-28 teams)';
    if (year >= 1960) return 'AFL-NFL Competition Era (20 rounds)';
    if (year >= 1947) return 'Classic Era (30 rounds)';
    if (year >= 1943) return 'Wartime Era (expanded rosters)';
    if (year >= 1936) return 'Early Draft Era (20 rounds)';
    return 'Unknown Era';
  }

  /**
   * Check if a year has realistic draft size data
   */
  public hasRealisticData(year: number): boolean {
    return year >= 1936 && year <= new Date().getFullYear() + 10;
  }

  /**
   * Get picks per round for a year (average)
   */
  public getPicksPerRound(year: number): number {
    const teams = this.getTeamCountForYear(year);
    return teams;
  }

  /**
   * Get draft size info for UI display
   */
  public getDraftSizeInfo(year: number): {
    totalPicks: number;
    rounds: number;
    era: string;
    picksPerRound: number;
  } {
    return {
      totalPicks: this.getDraftSize(year),
      rounds: this.getRoundsForYear(year),
      era: this.getEraDescription(year),
      picksPerRound: this.getPicksPerRound(year)
    };
  }
}

// Export singleton instance
export const draftSizeService = new DraftSizeService();
