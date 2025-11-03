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
    switch (mode) {
      case RatingMode.RANDOM:
        return new RandomRatingGenerator();

      case RatingMode.SEMI_HISTORICAL:
        return new HistoricalRatingGenerator();

      case RatingMode.REALISTIC:
        return new RealisticRatingGenerator();

      default:
        throw new Error(`Unknown rating mode: ${mode}`);
    }
  }
}
