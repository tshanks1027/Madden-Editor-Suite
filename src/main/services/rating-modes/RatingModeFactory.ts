import { IRatingGenerator } from './IRatingGenerator';
import { RandomRatingGenerator } from './RandomRatingGenerator';

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
        // Will implement in Task 3
        throw new Error('Semi-historical mode not yet implemented');

      case RatingMode.REALISTIC:
        // Will implement in Task 5
        throw new Error('Realistic mode not yet implemented');

      default:
        throw new Error(`Unknown rating mode: ${mode}`);
    }
  }
}
