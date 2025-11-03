import { IRatingGenerator, RatingContext, PlayerRatings } from './IRatingGenerator';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface TierRange {
  min: number;
  max: number;
}

interface PositionTiers {
  [tier: string]: TierRange;
}

interface AttributeWeights {
  key_attributes: string[];
  weights: { [attr: string]: number };
}

export class RealisticRatingGenerator implements IRatingGenerator {
  private tierData: Map<string, PositionTiers>;
  private weightData: Map<string, AttributeWeights>;

  constructor() {
    this.tierData = new Map();
    this.weightData = new Map();
    this.loadData();
  }

  getName(): string {
    return 'Realistic (RowdyRandy)';
  }

  async generateRatings(context: RatingContext): Promise<PlayerRatings> {
    // Step 1: Determine draft tier
    const tier = this.getDraftTier(context.draftPosition, context.draftRound);

    // Step 2: Map position to tier category
    const tierCategory = this.mapPositionToTierCategory(context.position);

    // Step 3: Get target OVR range
    const ovrRange = this.getTierOVR(tierCategory, tier);
    const targetOVR = this.randomInRange(ovrRange.min, ovrRange.max);

    // Step 4: Generate Speed from 40 time (if available)
    const speed = context.fortyTime
      ? this.fortyTimeToSpeed(context.fortyTime)
      : this.randomInRange(70, 95);

    // Step 5: Generate key attributes around target OVR
    const keyAttrs = this.generateKeyAttributes(
      context.position,
      targetOVR,
      speed
    );

    // Step 6: Fill remaining attributes
    const allRatings = this.fillRemainingAttributes(
      keyAttrs,
      targetOVR,
      context.position
    );

    // Step 7: Adjust to hit exact target OVR
    const finalRatings = this.adjustToTargetOVR(
      allRatings,
      targetOVR,
      context.position
    );

    finalRatings.POVR = targetOVR;

    return finalRatings;
  }

  private loadData(): void {
    try {
      const appPath = app.isPackaged ? app.getAppPath() : process.cwd();

      // Load tier data
      const tierPath = path.join(appPath, 'src', 'main', 'services', 'rating-modes', 'data', 'rowdy-randy-tiers.json');
      const tierJson = JSON.parse(fs.readFileSync(tierPath, 'utf-8'));

      for (const [pos, tiers] of Object.entries(tierJson)) {
        this.tierData.set(pos, tiers as PositionTiers);
      }

      // Load weight data
      const weightPath = path.join(appPath, 'src', 'main', 'services', 'rating-modes', 'data', 'position-attribute-weights.json');
      const weightJson = JSON.parse(fs.readFileSync(weightPath, 'utf-8'));

      for (const [pos, weights] of Object.entries(weightJson)) {
        this.weightData.set(pos, weights as AttributeWeights);
      }

      console.log('[RealisticRatingGenerator] Data loaded successfully');
    } catch (error) {
      console.error('[RealisticRatingGenerator] Error loading data:', error);
      throw error;
    }
  }

  private getDraftTier(position?: number, round?: number): string {
    if (!position && !round) return 'Day 3';

    if (position && position <= 5) return 'Generational';
    if (position && position <= 15) return 'Top 5';

    if (round) {
      if (round === 1) {
        if (position && position <= 16) return 'Round 1';
        return 'Round 1-2';
      }
      if (round === 2) return 'Round 1-2';
      if (round === 3) return 'Round 2-3';
      if (round === 4) return 'Round 3-4';
      if (round <= 7) return 'Day 3';
    }

    return 'UDFA';
  }

  private mapPositionToTierCategory(position: string): string {
    // Map specific Madden positions to RowdyRandy tier categories
    const mapping: { [key: string]: string } = {
      'QB': 'QB',
      'HB': 'HB',
      'FB': 'FB',
      'WR': 'WR',
      'TE': 'TE',
      'LT': 'OL',
      'LG': 'OL',
      'C': 'OL',
      'RG': 'OL',
      'RT': 'OL',
      'LEDG': 'EDGE',
      'REDG': 'EDGE',
      'DT': 'IDL',
      'SAM': 'LB',
      'Mike': 'LB',
      'WILL': 'LB',
      'CB': 'CB',
      'FS': 'S',
      'SS': 'S',
      'K': 'ST',
      'P': 'ST',
      'LS': 'ST'
    };

    return mapping[position] || 'OL'; // Default to OL if unknown
  }

  private getTierOVR(position: string, tier: string): TierRange {
    const posTiers = this.tierData.get(position);
    if (!posTiers || !posTiers[tier]) {
      // Fallback to generic range
      return { min: 65, max: 70 };
    }
    return posTiers[tier];
  }

  private fortyTimeToSpeed(fortyTime: number): number {
    // Convert 40-yard dash time to Madden Speed rating
    // 4.24 (fastest) = 99 SPD
    // 5.40 (slowest) = 70 SPD

    const minTime = 4.24;
    const maxTime = 5.40;
    const minSpeed = 70;
    const maxSpeed = 99;

    // Clamp time to range
    const clampedTime = Math.max(minTime, Math.min(maxTime, fortyTime));

    // Linear interpolation (inverted because lower time = higher speed)
    const speed = maxSpeed - ((clampedTime - minTime) / (maxTime - minTime)) * (maxSpeed - minSpeed);

    return Math.round(speed);
  }

  private generateKeyAttributes(
    position: string,
    targetOVR: number,
    speed: number
  ): Partial<PlayerRatings> {
    const weights = this.weightData.get(position);
    if (!weights) {
      return { PSPD: speed, PAWR: targetOVR };
    }

    const ratings: Partial<PlayerRatings> = {};

    // Set speed
    ratings.PSPD = speed;

    // Generate key attributes around target OVR
    for (const attr of weights.key_attributes) {
      if (attr === 'PSPD') continue; // Already set

      // Generate rating close to target OVR with some variance
      const variance = 10;
      const min = Math.max(40, targetOVR - variance);
      const max = Math.min(99, targetOVR + variance);

      ratings[attr as keyof PlayerRatings] = this.randomInRange(min, max);
    }

    return ratings;
  }

  private fillRemainingAttributes(
    keyAttrs: Partial<PlayerRatings>,
    targetOVR: number,
    position: string
  ): PlayerRatings {
    // Start with key attributes
    const ratings = { ...keyAttrs } as PlayerRatings;

    // Fill in all missing attributes with reasonable defaults
    const allAttributes = this.getAllAttributeNames();

    for (const attr of allAttributes) {
      if (ratings[attr as keyof PlayerRatings] === undefined) {
        // Generate based on position and target OVR
        ratings[attr as keyof PlayerRatings] = this.generateDefaultAttribute(
          attr,
          position,
          targetOVR
        );
      }
    }

    return ratings;
  }

  private adjustToTargetOVR(
    ratings: PlayerRatings,
    targetOVR: number,
    position: string
  ): PlayerRatings {
    // This is a simplified version
    // In reality, we'd use the RatingCalculator to compute actual OVR
    // and iteratively adjust key attributes

    // For now, just ensure key attributes average to target
    const weights = this.weightData.get(position);
    if (!weights) return ratings;

    let currentAvg = 0;
    let count = 0;

    for (const attr of weights.key_attributes) {
      const value = ratings[attr as keyof PlayerRatings];
      if (typeof value === 'number') {
        currentAvg += value;
        count++;
      }
    }

    if (count === 0) return ratings;

    currentAvg = currentAvg / count;
    const diff = targetOVR - currentAvg;

    // Adjust key attributes by the difference
    for (const attr of weights.key_attributes) {
      const current = ratings[attr as keyof PlayerRatings];
      if (typeof current === 'number') {
        const adjusted = Math.max(40, Math.min(99, current + diff));
        ratings[attr as keyof PlayerRatings] = Math.round(adjusted);
      }
    }

    return ratings;
  }

  private generateDefaultAttribute(
    attr: string,
    position: string,
    targetOVR: number
  ): number {
    // Generate reasonable default based on attribute type and position

    // Physical attributes generally correlate with OVR
    const physicalAttrs = ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PJMP'];
    if (physicalAttrs.includes(attr)) {
      return this.randomInRange(
        Math.max(40, targetOVR - 15),
        Math.min(99, targetOVR + 5)
      );
    }

    // Mental attributes
    const mentalAttrs = ['PAWR', 'PLPR'];
    if (mentalAttrs.includes(attr)) {
      return this.randomInRange(
        Math.max(50, targetOVR - 10),
        Math.min(99, targetOVR + 10)
      );
    }

    // Durability attributes - generally high
    const durabilityAttrs = ['PSTA', 'PINJ', 'PTGH'];
    if (durabilityAttrs.includes(attr)) {
      return this.randomInRange(75, 95);
    }

    // Default to target OVR with variance
    return this.randomInRange(
      Math.max(40, targetOVR - 20),
      Math.min(99, targetOVR)
    );
  }

  private getAllAttributeNames(): string[] {
    return [
      'PSPD', 'PACC', 'PAGI', 'PSTR', 'PJMP', 'PSTA', 'PINJ', 'PTGH', 'PAWR',
      'PTAD', 'PTAM', 'PTAS', 'PTHP', 'PTUP', 'PTOR', 'PPLA', 'PBSK',
      'PCAR', 'PBCV', 'PBKT', 'PLTR', 'PLJM', 'PLSM', 'PLSA', 'PELU',
      'PCTH', 'PLCI', 'PLSC', 'PLRL', 'PDRR', 'PMRR', 'SRRN',
      'PRBK', 'PPBK', 'PLIB', 'PLBK', 'PRBF', 'PRBS', 'PPBF', 'PPBS',
      'PTAK', 'PLPU', 'PLPR', 'PLHT', 'PBSG', 'PFMS', 'PLPM', 'PLMC', 'PLZC', 'PLPE',
      'PKAC', 'PKPR', 'PKRT'
    ];
  }

  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
