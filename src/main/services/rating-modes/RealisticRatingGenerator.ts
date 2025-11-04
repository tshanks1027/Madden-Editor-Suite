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

    try {
      this.loadData();
      // Write success to file for verification
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(require('electron').app.getPath('temp'), 'realistic-mode-debug.txt');
      fs.writeFileSync(logPath, `RealisticRatingGenerator initialized successfully\nTier data size: ${this.tierData.size}\nWeight data size: ${this.weightData.size}\nQB Generational: ${JSON.stringify(this.tierData.get('QB')?.['Generational'])}\nLog path: ${logPath}\n`);
    } catch (error) {
      // Write error to file for debugging
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(require('electron').app.getPath('temp'), 'realistic-mode-debug.txt');
      fs.writeFileSync(logPath, `RealisticRatingGenerator FAILED to initialize\nError: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack : 'No stack'}\n`);
      throw error;
    }
  }

  getName(): string {
    return 'Realistic (RowdyRandy)';
  }

  async generateRatings(context: RatingContext): Promise<PlayerRatings> {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(require('electron').app.getPath('temp'), 'realistic-mode-debug.txt');

    // Step 1: Determine draft tier
    const tier = this.getDraftTier(context.draftPosition, context.draftRound);
    console.log(`[RealisticRatingGenerator] ${context.name}: Draft tier = ${tier} (pos ${context.draftPosition}, round ${context.draftRound})`);
    fs.appendFileSync(logPath, `\n${context.name}: tier=${tier}, pos=${context.draftPosition}, round=${context.draftRound}\n`);

    // Step 2: Map position to tier category
    const tierCategory = this.mapPositionToTierCategory(context.position);
    console.log(`[RealisticRatingGenerator] ${context.name}: Position ${context.position} -> Tier category ${tierCategory}`);
    fs.appendFileSync(logPath, `  Position: ${context.position} -> Category: ${tierCategory}\n`);

    // Step 3: Get target OVR range
    const ovrRange = this.getTierOVR(tierCategory, tier);
    const targetOVR = this.randomInRange(ovrRange.min, ovrRange.max);
    console.log(`[RealisticRatingGenerator] ${context.name}: Target OVR = ${targetOVR} (range ${ovrRange.min}-${ovrRange.max})`);
    fs.appendFileSync(logPath, `  OVR Range: ${ovrRange.min}-${ovrRange.max}, Target: ${targetOVR}\n`);

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
      let tierPath: string;
      let weightPath: string;

      if (app.isPackaged) {
        // In packaged mode, files are in .vite/build/services/rating-modes/data/
        const appPath = app.getAppPath();
        tierPath = path.join(appPath, 'services', 'rating-modes', 'data', 'rowdy-randy-tiers.json');
        weightPath = path.join(appPath, 'services', 'rating-modes', 'data', 'position-attribute-weights.json');
      } else {
        // In dev mode, __dirname is .vite/build/, so we need the full relative path
        tierPath = path.join(__dirname, 'services', 'rating-modes', 'data', 'rowdy-randy-tiers.json');
        weightPath = path.join(__dirname, 'services', 'rating-modes', 'data', 'position-attribute-weights.json');
      }

      console.log('[RealisticRatingGenerator] Loading tier data from:', tierPath);
      console.log('[RealisticRatingGenerator] __dirname:', __dirname);
      console.log('[RealisticRatingGenerator] app.isPackaged:', app.isPackaged);

      // Load tier data
      const tierJson = JSON.parse(fs.readFileSync(tierPath, 'utf-8'));

      for (const [pos, tiers] of Object.entries(tierJson)) {
        this.tierData.set(pos, tiers as PositionTiers);
      }

      console.log('[RealisticRatingGenerator] Loaded tiers for positions:', Array.from(this.tierData.keys()));
      console.log('[RealisticRatingGenerator] QB Generational range:', this.tierData.get('QB')?. ['Generational']);

      console.log('[RealisticRatingGenerator] Loading weight data from:', weightPath);

      // Load weight data
      const weightJson = JSON.parse(fs.readFileSync(weightPath, 'utf-8'));

      for (const [pos, weights] of Object.entries(weightJson)) {
        this.weightData.set(pos, weights as AttributeWeights);
      }

      console.log('[RealisticRatingGenerator] Data loaded successfully - tierData size:', this.tierData.size, 'weightData size:', this.weightData.size);
    } catch (error) {
      console.error('[RealisticRatingGenerator] Error loading data:', error);
      throw error;
    }
  }

  private getDraftTier(position?: number, round?: number): string {
    // If no draft info at all, player is undrafted
    if (!position && !round) return 'UDFA';

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
    console.log(`[RealisticRatingGenerator] getTierOVR - position: ${position}, tier: ${tier}`);
    console.log(`[RealisticRatingGenerator] getTierOVR - posTiers found:`, posTiers ? 'YES' : 'NO');
    if (posTiers) {
      console.log(`[RealisticRatingGenerator] getTierOVR - available tiers:`, Object.keys(posTiers));
      console.log(`[RealisticRatingGenerator] getTierOVR - tier '${tier}' exists:`, posTiers[tier] ? 'YES' : 'NO');
    }

    if (!posTiers || !posTiers[tier]) {
      // Fallback to generic range
      console.log(`[RealisticRatingGenerator] getTierOVR - FALLING BACK to default range { min: 65, max: 70 }`);
      return { min: 65, max: 70 };
    }

    const range = posTiers[tier];
    console.log(`[RealisticRatingGenerator] getTierOVR - returning range:`, range);
    return range;
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
