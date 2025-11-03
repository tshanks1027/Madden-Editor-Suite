import { IRatingGenerator } from './IRatingGenerator';
import { RandomRatingGenerator } from './RandomRatingGenerator';
import { HistoricalRatingGenerator } from './HistoricalRatingGenerator';
import { RealisticRatingGenerator } from './RealisticRatingGenerator';

export enum RatingMode {
  RANDOM = 'random',
  SEMI_HISTORICAL = 'semi-historical',
  REALISTIC = 'realistic'
}

export class RatingModeFactory {
  static create(mode: RatingMode): IRatingGenerator {
    console.log(`[RatingModeFactory] Creating generator for mode: ${mode}`);

    try {
      let generator: IRatingGenerator;

      switch (mode) {
        case RatingMode.RANDOM:
          console.log(`[RatingModeFactory] Creating RandomRatingGenerator`);
          generator = new RandomRatingGenerator();
          break;

        case RatingMode.SEMI_HISTORICAL:
          console.log(`[RatingModeFactory] Creating HistoricalRatingGenerator`);
          generator = new HistoricalRatingGenerator();
          break;

        case RatingMode.REALISTIC:
          console.log(`[RatingModeFactory] Creating RealisticRatingGenerator`);
          generator = new RealisticRatingGenerator();
          console.log(`[RatingModeFactory] RealisticRatingGenerator created successfully`);
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
