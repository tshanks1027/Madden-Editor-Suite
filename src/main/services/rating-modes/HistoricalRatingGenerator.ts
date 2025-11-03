import { IRatingGenerator, RatingContext, PlayerRatings } from './IRatingGenerator';

/**
 * Historical rating generator using web-scraped stats
 * This is a wrapper around the existing scraping logic
 */
export class HistoricalRatingGenerator implements IRatingGenerator {

  getName(): string {
    return 'Semi-Historical (Web Scraping)';
  }

  async generateRatings(context: RatingContext): Promise<PlayerRatings> {
    // For now, this is a placeholder
    // The actual scraping logic is deeply integrated in DraftClassService/RosterCreatorService
    // We'll integrate properly when we modify those services

    // This will be called FROM those services with pre-scraped data
    if (!context.careerStats) {
      throw new Error('Historical mode requires careerStats in context');
    }

    // Convert scraped stats to ratings using existing logic
    return this.statsToRatings(context.careerStats, context.position);
  }

  private statsToRatings(stats: any, position: string): PlayerRatings {
    // This is a simplified version
    // The real implementation will use the existing DraftClassService logic

    // For now, return reasonable defaults based on stats
    // This will be replaced with actual conversion logic in integration step

    const baseRating = this.calculateBaseFromStats(stats);

    return {
      POVR: baseRating,
      PSPD: this.normalizeRating(stats.speed || 80),
      PACC: this.normalizeRating(baseRating - 5),
      PAGI: this.normalizeRating(baseRating - 3),
      PSTR: this.normalizeRating(stats.strength || 75),
      PJMP: this.normalizeRating(baseRating - 10),
      PSTA: this.normalizeRating(85),
      PINJ: this.normalizeRating(85),
      PTGH: this.normalizeRating(baseRating - 5),
      PAWR: this.normalizeRating(baseRating + 5),
      // Position-specific attributes will be added based on position
      ...this.getPositionSpecificRatings(position, stats, baseRating)
    } as PlayerRatings;
  }

  private calculateBaseFromStats(stats: any): number {
    // Placeholder - will use actual formula
    if (stats.overallRating) return stats.overallRating;
    if (stats.grade) return Math.round(stats.grade * 0.9);
    return 70; // Default
  }

  private normalizeRating(value: number): number {
    return Math.max(40, Math.min(99, Math.round(value)));
  }

  private getPositionSpecificRatings(position: string, stats: any, baseRating: number): Partial<PlayerRatings> {
    // Simplified position-specific ratings
    // Real implementation will come from existing service logic

    switch (position) {
      case 'QB':
        return {
          PTAD: this.normalizeRating(stats.deepAccuracy || baseRating),
          PTAM: this.normalizeRating(stats.midAccuracy || baseRating + 2),
          PTAS: this.normalizeRating(stats.shortAccuracy || baseRating + 5),
          PTHP: this.normalizeRating(stats.throwPower || baseRating),
          PTUP: this.normalizeRating(stats.pressureThrow || baseRating - 5),
          PTOR: this.normalizeRating(stats.throwOnRun || baseRating - 8),
          PPLA: this.normalizeRating(baseRating - 3),
          PBSK: this.normalizeRating(baseRating - 10)
        };

      case 'HB':
        return {
          PCAR: this.normalizeRating(stats.ballSecurity || baseRating),
          PBCV: this.normalizeRating(stats.vision || baseRating),
          PBKT: this.normalizeRating(stats.brokenTackles || baseRating),
          PLTR: this.normalizeRating(stats.trucking || baseRating - 5),
          PLJM: this.normalizeRating(stats.jukes || baseRating),
          PLSM: this.normalizeRating(stats.spins || baseRating),
          PLSA: this.normalizeRating(stats.stiffArm || baseRating - 5),
          PELU: this.normalizeRating(stats.elus || baseRating),
          PCTH: this.normalizeRating(stats.catching || baseRating - 15)
        };

      // Add other positions as needed
      default:
        return {};
    }
  }
}
