import { IRatingGenerator, RatingContext, PlayerRatings } from './IRatingGenerator';

interface AttributeRange {
  min: number;
  max: number;
}

interface PositionRanges {
  [attribute: string]: AttributeRange;
}

export class RandomRatingGenerator implements IRatingGenerator {
  private readonly positionRanges: Map<string, PositionRanges>;

  constructor() {
    this.positionRanges = this.initializePositionRanges();
  }

  getName(): string {
    return 'Random';
  }

  async generateRatings(context: RatingContext): Promise<PlayerRatings> {
    const ranges = this.positionRanges.get(context.position) || this.getDefaultRanges();

    const ratings: Partial<PlayerRatings> = {};

    // Generate all attributes within position-appropriate ranges
    for (const [attr, range] of Object.entries(ranges)) {
      ratings[attr as keyof PlayerRatings] = this.randomInRange(range.min, range.max);
    }

    // Calculate OVR as average of key ratings (simplified)
    ratings.POVR = this.calculateSimpleOVR(ratings, context.position);

    return ratings as PlayerRatings;
  }

  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private calculateSimpleOVR(ratings: Partial<PlayerRatings>, position: string): number {
    // Use position-specific key attributes
    const keyAttrs = this.getKeyAttributes(position);
    const values = keyAttrs
      .map(attr => ratings[attr as keyof PlayerRatings] || 0)
      .filter(v => v > 0);

    if (values.length === 0) return 65;

    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.round(avg);
  }

  private getKeyAttributes(position: string): string[] {
    const keyAttrsByPosition: { [key: string]: string[] } = {
      'QB': ['PTAD', 'PTAM', 'PTAS', 'PTHP', 'PAWR', 'PTUP'],
      'HB': ['PSPD', 'PACC', 'PAGI', 'PCAR', 'PBCV', 'PBKT'],
      'WR': ['PSPD', 'PACC', 'PCTH', 'PLCI', 'PDRR', 'PLSC'],
      'TE': ['PCTH', 'PLCI', 'PRBK', 'PSTR', 'PAWR'],
      'LT': ['PRBK', 'PPBK', 'PSTR', 'PAWR', 'PAGI'],
      'LG': ['PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'C': ['PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'RG': ['PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'RT': ['PRBK', 'PPBK', 'PSTR', 'PAWR', 'PAGI'],
      'LEDG': ['PFMS', 'PLPM', 'PBSG', 'PTAK', 'PAWR'],
      'REDG': ['PFMS', 'PLPM', 'PBSG', 'PTAK', 'PAWR'],
      'DT': ['PBSG', 'PLPM', 'PSTR', 'PTAK', 'PAWR'],
      'SAM': ['PTAK', 'PLPU', 'PLPR', 'PLMC', 'PLZC'],
      'Mike': ['PTAK', 'PLPU', 'PLPR', 'PLMC', 'PLZC'],
      'WILL': ['PTAK', 'PLPU', 'PLPR', 'PLMC', 'PLZC'],
      'CB': ['PSPD', 'PACC', 'PAGI', 'PLMC', 'PLZC', 'PLPE'],
      'FS': ['PSPD', 'PACC', 'PLZC', 'PLPR', 'PTAK'],
      'SS': ['PTAK', 'PLHT', 'PLZC', 'PLPR', 'PSPD'],
      'K': ['PKAC', 'PKPR'],
      'P': ['PKAC', 'PKPR'],
      'LS': ['PSTR', 'PAWR']
    };

    return keyAttrsByPosition[position] || ['PSPD', 'PSTR', 'PAWR'];
  }

  private initializePositionRanges(): Map<string, PositionRanges> {
    const ranges = new Map<string, PositionRanges>();

    // QB ranges
    ranges.set('QB', {
      PSPD: { min: 60, max: 85 },
      PACC: { min: 65, max: 90 },
      PAGI: { min: 60, max: 85 },
      PSTR: { min: 60, max: 85 },
      PJMP: { min: 50, max: 75 },
      PSTA: { min: 85, max: 99 },
      PINJ: { min: 70, max: 99 },
      PTGH: { min: 70, max: 95 },
      PAWR: { min: 60, max: 99 },
      PTAD: { min: 55, max: 99 },
      PTAM: { min: 60, max: 99 },
      PTAS: { min: 65, max: 99 },
      PTHP: { min: 70, max: 99 },
      PTUP: { min: 55, max: 99 },
      PTOR: { min: 50, max: 90 },
      PPLA: { min: 60, max: 95 },
      PBSK: { min: 50, max: 85 }
    });

    // HB ranges
    ranges.set('HB', {
      PSPD: { min: 75, max: 99 },
      PACC: { min: 80, max: 99 },
      PAGI: { min: 75, max: 99 },
      PSTR: { min: 50, max: 85 },
      PJMP: { min: 70, max: 95 },
      PSTA: { min: 80, max: 99 },
      PINJ: { min: 60, max: 99 },
      PTGH: { min: 65, max: 95 },
      PAWR: { min: 50, max: 90 },
      PCAR: { min: 65, max: 99 },
      PBCV: { min: 60, max: 99 },
      PBKT: { min: 50, max: 99 },
      PLTR: { min: 40, max: 95 },
      PLJM: { min: 60, max: 99 },
      PLSM: { min: 60, max: 99 },
      PLSA: { min: 45, max: 90 },
      PELU: { min: 75, max: 99 },
      PCTH: { min: 40, max: 75 },
      PRBK: { min: 25, max: 60 },
      PPBK: { min: 20, max: 55 }
    });

    // Add minimal ranges for other positions (can expand later)
    const defaultRange: PositionRanges = {
      PSPD: { min: 60, max: 90 },
      PACC: { min: 60, max: 90 },
      PAGI: { min: 60, max: 90 },
      PSTR: { min: 60, max: 90 },
      PJMP: { min: 50, max: 80 },
      PSTA: { min: 70, max: 95 },
      PINJ: { min: 70, max: 99 },
      PTGH: { min: 70, max: 95 },
      PAWR: { min: 50, max: 90 }
    };

    // Copy default for all other positions
    const positions = ['WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT',
                       'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS', 'K', 'P', 'LS', 'FB'];

    for (const pos of positions) {
      ranges.set(pos, { ...defaultRange });
    }

    return ranges;
  }

  private getDefaultRanges(): PositionRanges {
    return {
      PSPD: { min: 60, max: 90 },
      PACC: { min: 60, max: 90 },
      PAGI: { min: 60, max: 90 },
      PSTR: { min: 60, max: 90 },
      PJMP: { min: 50, max: 80 },
      PSTA: { min: 70, max: 95 },
      PINJ: { min: 70, max: 99 },
      PTGH: { min: 70, max: 95 },
      PAWR: { min: 50, max: 90 }
    };
  }
}
