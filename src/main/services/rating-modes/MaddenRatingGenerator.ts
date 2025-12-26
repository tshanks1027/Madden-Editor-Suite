/**
 * Madden Rating Generator
 *
 * Uses actual Madden rookie stats from historical data or comparable player stats.
 * Features:
 * - Historical (1936-2025): Looks up actual rookie Madden ratings from ROSTER_lookup.csv
 * - Future (2026+): Uses comparable NFL players (wAV + archetype + physical matching)
 * - Fallback to variance mode if no data found
 * - Preserves realistic draft order
 */

import { IRatingGenerator, RatingContext, PlayerRatings } from './IRatingGenerator';
import { playerDataService, RookieStats } from '../generator/PlayerDataService';
import { comparableMatcherService } from '../generator/ComparableMatcherService';
import { VarianceRatingGenerator } from './VarianceRatingGenerator';
import { ovrWeightsCalculator } from './OVRWeightsCalculator';

export class MaddenRatingGenerator implements IRatingGenerator {
  private varianceFallback: VarianceRatingGenerator;

  constructor() {
    this.varianceFallback = new VarianceRatingGenerator();
  }

  getName(): string {
    return 'Madden Rating';
  }

  async generateRatings(context: RatingContext): Promise<PlayerRatings> {
    // Determine if this is historical or future
    const isFuture = context.careerStats?.draftClass >= 2026;

    console.log(`[MaddenRatingGenerator] Player: ${context.name}, Draft Class: ${context.careerStats?.draftClass}, Is Future: ${isFuture}`);

    if (isFuture) {
      return this.generateRatingsFuture(context);
    } else {
      return this.generateRatingsHistorical(context);
    }
  }

  /**
   * Generate ratings for historical players (1936-2025)
   * Uses actual rookie stats from ROSTER_lookup.csv
   */
  private async generateRatingsHistorical(context: RatingContext): Promise<PlayerRatings> {
    if (!context.name || !context.careerStats?.draftClass) {
      console.warn('[MaddenRatingGenerator] Missing name or draft class for historical lookup, using fallback');
      return this.varianceFallback.generateRatings(context);
    }

    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    const logFile = path.join(app.getPath('temp'), 'madden-generator-debug.log');

    const log = (msg: string) => {
      console.log(msg);
      fs.appendFileSync(logFile, msg + '\n');
    };

    log(`\n========================================`);
    log(`[MaddenRatingGenerator] Looking up rookie stats for: ${context.name}, Draft Class: ${context.careerStats.draftClass}`);
    log(`[MaddenRatingGenerator] Position: ${context.position}`);

    // Look up rookie stats
    const rookieStats = await playerDataService.getRookieStats(
      context.name,
      context.careerStats.draftClass
    );

    if (!rookieStats) {
      log(`[MaddenRatingGenerator] ⚠️⚠️⚠️ NO ROOKIE STATS FOUND FOR ${context.name} (${context.careerStats.draftClass}) ⚠️⚠️⚠️`);
      log(`[MaddenRatingGenerator] Using FALLBACK generator instead of CSV data`);
      log(`========================================\n`);
      return this.varianceFallback.generateRatings(context);
    }

    // Convert RookieStats to PlayerRatings
    const ratings = this.convertRookieStatsToRatings(rookieStats);

    log(`[MaddenRatingGenerator] ✅✅✅ FOUND ROOKIE STATS FOR ${context.name}`);
    log(`[MaddenRatingGenerator]   CSV OVR: ${rookieStats.povr}`);
    log(`[MaddenRatingGenerator]   CSV Position: ${rookieStats.position}`);
    log(`[MaddenRatingGenerator]   Converted OVR: ${ratings.POVR}`);
    log(`========================================\n`);
    return ratings;
  }

  /**
   * Generate ratings for future prospects (2026+)
   * Uses comparable NFL players based on wAV, archetype, and physical attributes
   */
  private async generateRatingsFuture(context: RatingContext): Promise<PlayerRatings> {
    if (!context.careerStats) {
      console.warn('[MaddenRatingGenerator] Missing career stats for future prospect, using fallback');
      return this.varianceFallback.generateRatings(context);
    }

    // Build prospect object for comparable matching
    const prospect = {
      name: context.name || 'Unknown',
      position: context.position,
      wAV: context.careerStats.wAV || 0,
      archetype: context.careerStats.archetype || '',
      height: context.careerStats.height || 72, // Default 6'0"
      weight: context.careerStats.weight || 200
    };

    // Find comparable players
    const comparables = await comparableMatcherService.findComparables(prospect);

    if (!comparables || comparables.length === 0) {
      console.log(`[MaddenRatingGenerator] No comparables found for ${prospect.name}, using fallback`);
      return this.varianceFallback.generateRatings(context);
    }

    // Average rookie stats from top comparables
    const avgRookieRatings = comparableMatcherService.averageRookieStats(comparables);

    // Scale by wAV difference
    const avgWAV = comparables.reduce((sum, c) => sum + c.wAV, 0) / comparables.length;
    const wAVRatio = prospect.wAV / Math.max(1, avgWAV);
    const scaledRatings = this.scaleRatingsByWAV(avgRookieRatings, wAVRatio);

    console.log(`[MaddenRatingGenerator] Using ${comparables.length} comparables for ${prospect.name}: OVR ${scaledRatings.POVR} (wAV ratio: ${wAVRatio.toFixed(2)})`);

    return scaledRatings;
  }

  /**
   * Convert RookieStats from CSV to PlayerRatings format
   * IMPORTANT: We ALWAYS recalculate OVR from attributes, not use CSV value
   * because the game calculates OVR from individual attributes at runtime
   */
  private convertRookieStatsToRatings(stats: RookieStats): PlayerRatings {
    // RookieStats uses lowercase property names (povr, pspd, pacc, etc.)
    // PlayerRatings uses uppercase (POVR, PSPD, PACC, etc.)
    // Map all lowercase properties to uppercase
    const ratings: Partial<PlayerRatings> = {};

    // NOTE: We intentionally DON'T copy stats.povr here - we'll recalculate it
    // The CSV OVR was captured at a specific time and may not match what the
    // game calculates from the individual attributes
    if (stats.pspd !== undefined) ratings.PSPD = stats.pspd;
    if (stats.pacc !== undefined) ratings.PACC = stats.pacc;
    if (stats.pstr !== undefined) ratings.PSTR = stats.pstr;
    if (stats.pagi !== undefined) ratings.PAGI = stats.pagi;
    if (stats.pawr !== undefined) ratings.PAWR = stats.pawr;
    if (stats.pcth !== undefined) ratings.PCTH = stats.pcth;
    if (stats.pcar !== undefined) ratings.PCAR = stats.pcar;
    if (stats.pthp !== undefined) ratings.PTHP = stats.pthp;
    if (stats.pkpw !== undefined) ratings.PKPW = stats.pkpw;
    if (stats.pkac !== undefined) ratings.PKAC = stats.pkac;
    if (stats.pkrt !== undefined) ratings.PKRT = stats.pkrt;
    // Default PKRT to 1 if not in CSV (kick return is rarely tracked)
    if (ratings.PKRT === undefined) ratings.PKRT = 1;
    if (stats.prbk !== undefined) ratings.PRBK = stats.prbk;
    if (stats.ppbk !== undefined) ratings.PPBK = stats.ppbk;
    if (stats.ptak !== undefined) ratings.PTAK = stats.ptak;
    if (stats.pbtk !== undefined) ratings.PBTK = stats.pbtk;
    if (stats.pjmp !== undefined) ratings.PJMP = stats.pjmp;
    if (stats.pinj !== undefined) ratings.PINJ = stats.pinj;
    if (stats.psta !== undefined) ratings.PSTA = stats.psta;
    if (stats.ptgh !== undefined) ratings.PTGH = stats.ptgh;
    // Trucking - CSV uses ptrk, OVR calc expects PLTR
    if (stats.ptrk !== undefined) {
      ratings.PTRK = stats.ptrk;
      (ratings as any).PLTR = stats.ptrk;
    }

    // Additional rating attributes with OVR calculator field code mappings
    // Many CSV field codes differ from what OVRWeightsCalculator expects

    // ChangeOfDirection - CSV uses pcod, OVR calc expects PELU
    if (stats.pcod !== undefined) {
      ratings.PCOD = stats.pcod;
      (ratings as any).PELU = stats.pcod;
    }
    if (stats.pbcv !== undefined) ratings.PBCV = stats.pbcv;

    // StiffArm - CSV uses pstf, OVR calc expects PLSA
    if (stats.pstf !== undefined) {
      ratings.PSTF = stats.pstf;
      (ratings as any).PLSA = stats.pstf;
    }

    // SpinMove - CSV uses pspm, OVR calc expects PLSM
    if (stats.pspm !== undefined) {
      ratings.PSPM = stats.pspm;
      (ratings as any).PLSM = stats.pspm;
    }

    // JukeMove - CSV uses pjum, OVR calc expects PLJM
    if (stats.pjum !== undefined) {
      ratings.PJUM = stats.pjum;
      (ratings as any).PLJM = stats.pjum;
    }

    // ImpactBlocking - CSV uses pibl, OVR calc expects PLIB
    if (stats.pibl !== undefined) {
      ratings.PIBL = stats.pibl;
      (ratings as any).PLIB = stats.pibl;
    }

    // RunBlockPower - CSV uses prbp, OVR calc expects PRBS
    if (stats.prbp !== undefined) {
      ratings.PRBP = stats.prbp;
      (ratings as any).PRBS = stats.prbp;
    }
    if (stats.prbf !== undefined) ratings.PRBF = stats.prbf;

    // PassBlockPower - CSV uses ppbp, OVR calc expects PPBS
    if (stats.ppbp !== undefined) {
      ratings.PPBP = stats.ppbp;
      (ratings as any).PPBS = stats.ppbp;
    }
    if (stats.ppbf !== undefined) ratings.PPBF = stats.ppbf;

    // LeadBlock - CSV uses pldb, OVR calc expects PLBK
    if (stats.pldb !== undefined) {
      ratings.PLDB = stats.pldb;
      (ratings as any).PLBK = stats.pldb;
    }

    // BreakSack - CSV uses pbrs, OVR calc expects PBSK
    if (stats.pbrs !== undefined) {
      ratings.PBRS = stats.pbrs;
      (ratings as any).PBSK = stats.pbrs;
    }
    if (stats.ptup !== undefined) ratings.PTUP = stats.ptup;

    // PowerMoves - CSV uses ppwm, OVR calc expects PLPM
    if (stats.ppwm !== undefined) {
      ratings.PPWM = stats.ppwm;
      (ratings as any).PLPM = stats.ppwm;
    }

    // FinesseMoves - CSV uses pfnm, OVR calc expects PFMS
    if (stats.pfnm !== undefined) {
      ratings.PFNM = stats.pfnm;
      (ratings as any).PFMS = stats.pfnm;
    }

    // BlockShedding - CSV uses pbsh, OVR calc expects PBSG
    if (stats.pbsh !== undefined) {
      ratings.PBSH = stats.pbsh;
      (ratings as any).PBSG = stats.pbsh;
    }

    // Pursuit - CSV uses ppur, OVR calc expects PLPU
    if (stats.ppur !== undefined) {
      ratings.PPUR = stats.ppur;
      (ratings as any).PLPU = stats.ppur;
    }

    // PlayRecognition - CSV uses pprc, OVR calc expects PLPR
    if (stats.pprc !== undefined) {
      ratings.PPRC = stats.pprc;
      (ratings as any).PLPR = stats.pprc;
    }

    // ManCoverage - CSV uses pmcv, OVR calc expects PLMC
    if (stats.pmcv !== undefined) {
      ratings.PMCV = stats.pmcv;
      (ratings as any).PLMC = stats.pmcv;
    }

    // ZoneCoverage - CSV uses pzcv, OVR calc expects PLZC
    if (stats.pzcv !== undefined) {
      ratings.PZCV = stats.pzcv;
      (ratings as any).PLZC = stats.pzcv;
    }

    // SpectacularCatch - CSV uses pspc, OVR calc expects PLSC
    if (stats.pspc !== undefined) {
      ratings.PSPC = stats.pspc;
      (ratings as any).PLSC = stats.pspc;
    }

    // CatchInTraffic - CSV uses pcit, OVR calc expects PLCI
    if (stats.pcit !== undefined) {
      ratings.PCIT = stats.pcit;
      (ratings as any).PLCI = stats.pcit;
    }

    // ShortRouteRunning - CSV uses psrr, OVR calc expects SRRN
    if (stats.psrr !== undefined) {
      ratings.PSRR = stats.psrr;
      (ratings as any).SRRN = stats.psrr;
    }
    if (stats.pmrr !== undefined) ratings.PMRR = stats.pmrr;
    if (stats.pdrr !== undefined) ratings.PDRR = stats.pdrr;

    // HitPower - CSV uses phtp, OVR calc expects PLHT
    if (stats.phtp !== undefined) {
      ratings.PHTP = stats.phtp;
      (ratings as any).PLHT = stats.phtp;
    }

    // Press - CSV uses pprs, OVR calc expects PLPE
    if (stats.pprs !== undefined) {
      ratings.PPRS = stats.pprs;
      (ratings as any).PLPE = stats.pprs;
    }

    // Release - CSV uses prel, OVR calc expects PLRL
    if (stats.prel !== undefined) {
      ratings.PREL = stats.prel;
      (ratings as any).PLRL = stats.prel;
    }
    if (stats.ptas !== undefined) ratings.PTAS = stats.ptas;
    if (stats.ptam !== undefined) ratings.PTAM = stats.ptam;
    if (stats.ptad !== undefined) ratings.PTAD = stats.ptad;
    if (stats.ppla !== undefined) ratings.PPLA = stats.ppla;
    if (stats.ptor !== undefined) ratings.PTOR = stats.ptor;

    // BreakTackle - CSV uses pbtk, OVR calc expects PBKT
    if (stats.pbtk !== undefined) {
      (ratings as any).PBKT = stats.pbtk;
    }

    // CRITICAL: Find the BEST archetype for this player's ratings
    // Madden assigns the archetype that produces the HIGHEST OVR
    // This ensures our OVR matches what the game calculates
    // Pass isDraftClass=true because draft classes use divisor 11.1 instead of 10
    const bestArchetypeResult = ovrWeightsCalculator.findBestArchetype(ratings, stats.position, true);

    if (bestArchetypeResult) {
      ratings.POVR = bestArchetypeResult.ovr;
      // Store the archetype ID for the file writer
      (ratings as any).ARCHETYPE_ID = bestArchetypeResult.archetypeId;
      (ratings as any).ARCHETYPE_NAME = bestArchetypeResult.archetype;
    } else {
      // Fallback: use CSV archetype if best archetype detection failed
      const archetypeForCalc = stats.archetypeDetailed !== undefined ?
        String(stats.archetypeDetailed) : stats.archetype;
      ratings.POVR = this.calculateOVRFromAttributes(ratings, stats.position, archetypeForCalc);
    }

    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    const logFile = path.join(app.getPath('temp'), 'madden-generator-debug.log');
    fs.appendFileSync(logFile, `[MaddenRatingGenerator] ${stats.playerName}: CSV OVR=${stats.povr}, Best Archetype=${bestArchetypeResult?.archetype || 'fallback'}, Final OVR=${ratings.POVR}\n`);

    return ratings as PlayerRatings;
  }

  /**
   * Scale ratings based on wAV difference between prospect and comparables
   */
  private scaleRatingsByWAV(baseRatings: PlayerRatings, wAVRatio: number): PlayerRatings {
    // Clamp ratio to reasonable range (0.7 - 1.3)
    const clampedRatio = Math.max(0.7, Math.min(1.3, wAVRatio));

    const scaled: Partial<PlayerRatings> = {};

    // Scale all attributes except injury/stamina
    for (const [attr, value] of Object.entries(baseRatings)) {
      if (typeof value !== 'number') continue;

      // Don't scale injury, stamina, or toughness (these are more random)
      if (['PINJ', 'PSTA', 'PTGH'].includes(attr)) {
        scaled[attr as keyof PlayerRatings] = value;
        continue;
      }

      // Scale the attribute
      let scaledValue = Math.round(value * clampedRatio);

      // Keep within Madden range (40-99)
      scaledValue = Math.max(40, Math.min(99, scaledValue));

      scaled[attr as keyof PlayerRatings] = scaledValue;
    }

    // Recalculate OVR
    scaled.POVR = baseRatings.POVR ? Math.round(baseRatings.POVR * clampedRatio) : 65;
    scaled.POVR = Math.max(55, Math.min(99, scaled.POVR));

    return scaled as PlayerRatings;
  }

  /**
   * Calculate OVR from attributes using the official Madden archetype-based formula
   * Draft classes use divisor 11.1 instead of standard 10
   */
  private calculateOVRFromAttributes(ratings: Partial<PlayerRatings>, position: string, archetype?: string): number {
    // Use the official Madden OVR weights calculator for accurate OVR
    // Pass isDraftClass=true because this is used for draft class generation
    if (ovrWeightsCalculator.isInitialized()) {
      const ovr = ovrWeightsCalculator.calculateOVR(ratings, position, archetype, true);
      console.log(`[MaddenRatingGenerator] Calculated OVR using draft class formula (divisor 11.1): ${ovr} for position ${position}`);
      return ovr;
    }

    // Fallback to simple average if weights not loaded
    console.warn('[MaddenRatingGenerator] OVR weights not loaded, using fallback calculation');
    const keyAttrs = this.getKeyAttributes(position);
    const values = keyAttrs
      .map(attr => ratings[attr as keyof PlayerRatings] || 0)
      .filter(v => v > 0);

    if (values.length === 0) return 65;

    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.round(avg);
  }

  /**
   * Get key attributes for OVR calculation by position
   */
  private getKeyAttributes(position: string): string[] {
    const keyAttrsByPosition: { [key: string]: string[] } = {
      'QB': ['PTAD', 'PTAM', 'PTAS', 'PTHP', 'PAWR', 'PTUP'],
      'HB': ['PSPD', 'PACC', 'PAGI', 'PCAR', 'PBCV', 'PBKT', 'PELU'],
      'FB': ['PRBK', 'PPBK', 'PSTR', 'PBKT', 'PLTR'],
      'WR': ['PSPD', 'PACC', 'PCTH', 'PLCI', 'PDRR', 'PMRR', 'SRRN'],
      'TE': ['PCTH', 'PLCI', 'PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'LT': ['PRBK', 'PPBK', 'PSTR', 'PAWR', 'PAGI'],
      'LG': ['PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'C': ['PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'RG': ['PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'RT': ['PRBK', 'PPBK', 'PSTR', 'PAWR', 'PAGI'],
      'LEDG': ['PFMS', 'PLPM', 'PBSG', 'PTAK', 'PAWR', 'PLPU'],
      'REDG': ['PFMS', 'PLPM', 'PBSG', 'PTAK', 'PAWR', 'PLPU'],
      'DT': ['PBSG', 'PLPM', 'PSTR', 'PTAK', 'PAWR'],
      'NT': ['PBSG', 'PLPM', 'PSTR', 'PTAK', 'PAWR'],
      'SAM': ['PTAK', 'PLPU', 'PLPR', 'PLMC', 'PLZC', 'PBSG'],
      'Mike': ['PTAK', 'PLPU', 'PLPR', 'PLMC', 'PLZC'],
      'WILL': ['PTAK', 'PLPU', 'PLPR', 'PLMC', 'PLZC', 'PSPD'],
      'CB': ['PSPD', 'PACC', 'PAGI', 'PLMC', 'PLZC', 'PLPE'],
      'FS': ['PSPD', 'PACC', 'PLZC', 'PLPR', 'PTAK', 'PLPU'],
      'SS': ['PTAK', 'PLHT', 'PLZC', 'PLPR', 'PSPD', 'PLPU'],
      'K': ['PKAC', 'PKPR'],
      'P': ['PKAC', 'PKPR'],
      'LS': ['PSTR', 'PAWR']
    };

    return keyAttrsByPosition[position] || ['PSPD', 'PSTR', 'PAWR'];
  }
}
