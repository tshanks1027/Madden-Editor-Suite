import { IRatingGenerator } from './IRatingGenerator';
import { RandomRatingGenerator } from './RandomRatingGenerator';
import { VarianceRatingGenerator } from './VarianceRatingGenerator';
import { MaddenRatingGenerator } from './MaddenRatingGenerator';
// Legacy generators (kept for backward compatibility)
import { HistoricalRatingGenerator } from './HistoricalRatingGenerator';
import { RealisticRatingGenerator } from './RealisticRatingGenerator';

export enum RatingMode {
  // New modes (v2.0)
  RANDOM = 'random',
  VARIANCE = 'variance',
  MADDEN = 'madden',
  // Legacy modes (deprecated, will be removed in future version)
  SEMI_HISTORICAL = 'semi-historical',
  REALISTIC = 'realistic'
}

export class RatingModeFactory {
  static create(mode: RatingMode | string): IRatingGenerator {
    console.log(`[RatingModeFactory] Creating generator for mode: ${mode}`);

    try {
      let generator: IRatingGenerator;

      switch (mode) {
        // New modes (v2.0)
        case RatingMode.RANDOM:
          console.log(`[RatingModeFactory] Creating RandomRatingGenerator`);
          generator = new RandomRatingGenerator();
          break;

        case RatingMode.VARIANCE:
          console.log(`[RatingModeFactory] Creating VarianceRatingGenerator`);
          generator = new VarianceRatingGenerator();
          break;

        case RatingMode.MADDEN:
          console.log(`[RatingModeFactory] Creating MaddenRatingGenerator`);
          generator = new MaddenRatingGenerator();
          break;

        // Legacy modes (backward compatibility)
        case RatingMode.SEMI_HISTORICAL:
          console.warn(`[RatingModeFactory] SEMI_HISTORICAL is deprecated, using VARIANCE instead`);
          generator = new VarianceRatingGenerator();
          break;

        case RatingMode.REALISTIC:
          console.warn(`[RatingModeFactory] REALISTIC is deprecated, using MADDEN instead`);
          generator = new MaddenRatingGenerator();
          break;

        default:
          throw new Error(`Unknown rating mode: ${mode}`);
      }

      return generator;
    } catch (error) {
      console.error(`[RatingModeFactory] Error creating generator for mode ${mode}:`, error);
      throw error;
    }
  }
}
