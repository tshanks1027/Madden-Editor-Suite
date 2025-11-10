/**
 * Archetype Assigner
 *
 * Assigns archetypes to historical players based on career stats or physical attributes.
 * Used when ALL_PLAYER_LOOKUP.csv lacks archetype data for a player.
 *
 * Algorithm:
 * 1. Load player's career stats from ROSTER_lookup.csv (if available)
 * 2. Analyze stats to determine playstyle (e.g., Power Back vs Receiving Back)
 * 3. If no stats: use body type (height/weight combinations)
 * 4. Return simplified archetype name + detailed archetype ID
 */

import { playerDataService, HistoricalPlayer, RookieStats } from './PlayerDataService';
import { archetypeService } from '../utils/archetypeService';

interface ArchetypeResult {
  name: string;         // Simplified name (e.g., "Power Back")
  id: number;           // Madden archetype ID
  confidence: number;   // 0-100 confidence score
  method: 'stats' | 'body' | 'default'; // How it was determined
}

export class ArchetypeAssigner {

  /**
   * Assign archetype to a player
   */
  async assignArchetype(player: HistoricalPlayer): Promise<ArchetypeResult> {
    // Normalize position for archetype service
    const normalizedPosition = this.normalizePosition(player.position);

    // Try stats-based assignment first
    if (player.draftClass) {
      const statsArchetype = await this.assignFromStats(player);
      if (statsArchetype) {
        return statsArchetype;
      }
    }

    // Fallback to body-type assignment
    if (player.height && player.weight) {
      return this.assignFromBodyType(normalizedPosition, player.height, player.weight);
    }

    // Last resort: default archetype for position
    return this.getDefaultArchetype(normalizedPosition);
  }

  /**
   * Normalize position name for archetype service
   * LEDG/REDG -> LE/RE, SAM/Mike/WILL -> LOLB/MLB/ROLB
   */
  private normalizePosition(position: string): string {
    const positionMap: { [key: string]: string } = {
      'LEDG': 'LE',
      'REDG': 'RE',
      'SAM': 'LOLB',
      'Mike': 'MLB',
      'WILL': 'ROLB',
      'EDGE': 'LE', // Generic edge -> left end
      'LB': 'MLB'   // Generic linebacker -> middle
    };

    return positionMap[position] || position;
  }

  /**
   * Assign archetype based on career stats
   */
  private async assignFromStats(player: HistoricalPlayer): Promise<ArchetypeResult | null> {
    if (!player.name || !player.draftClass) {
      return null;
    }

    // Get rookie stats (first year data)
    const rookieStats = await playerDataService.getRookieStats(player.name, player.draftClass);
    if (!rookieStats) {
      return null;
    }

    // Analyze by position
    switch (player.position) {
      case 'QB':
        return this.analyzeQBStats(rookieStats);
      case 'HB':
        return this.analyzeHBStats(rookieStats);
      case 'WR':
        return this.analyzeWRStats(rookieStats);
      case 'TE':
        return this.analyzeTEStats(rookieStats);
      case 'LEDG':
      case 'REDG':
        return this.analyzeEDGEStats(rookieStats);
      case 'DT':
      case 'NT':
        return this.analyzeDTStats(rookieStats);
      case 'SAM':
      case 'Mike':
      case 'WILL':
        return this.analyzeLBStats(rookieStats);
      case 'CB':
        return this.analyzeCBStats(rookieStats);
      case 'FS':
      case 'SS':
        return this.analyzeSafetyStats(rookieStats);
      default:
        return null;
    }
  }

  /**
   * Analyze QB stats to determine archetype
   */
  private analyzeQBStats(stats: RookieStats): ArchetypeResult | null {
    // Check for mobility (rushing stats)
    const rushYards = stats['RUSH_YARDS'] || 0;
    const rushAttempts = stats['RUSH_ATT'] || 0;

    // Scrambler: High rushing production
    if (rushYards > 300 || rushAttempts > 50) {
      return {
        name: 'Scrambler',
        id: archetypeService.getArchetypeId('Scrambler', 'QB'),
        confidence: 80,
        method: 'stats'
      };
    }

    // Field General: High completion % or passing yards
    const completionPct = (stats['PASS_COMP'] || 0) / Math.max(1, stats['PASS_ATT'] || 1);
    const passYards = stats['PASS_YARDS'] || 0;

    if (completionPct > 0.65 || passYards > 3500) {
      return {
        name: 'Field General',
        id: archetypeService.getArchetypeId('Field General', 'QB'),
        confidence: 75,
        method: 'stats'
      };
    }

    // Default: Strong Arm
    return {
      name: 'Strong Arm',
      id: archetypeService.getArchetypeId('Strong Arm', 'QB'),
      confidence: 60,
      method: 'stats'
    };
  }

  /**
   * Analyze HB stats to determine archetype
   */
  private analyzeHBStats(stats: RookieStats): ArchetypeResult | null {
    const rushYards = stats['RUSH_YARDS'] || 0;
    const rushAttempts = stats['RUSH_ATT'] || 0;
    const receptions = stats['REC'] || 0;
    const recYards = stats['REC_YARDS'] || 0;

    // Receiving Back: High reception count
    if (receptions > 40 || (recYards > 400 && rushAttempts < 150)) {
      return {
        name: 'Receiving Back',
        id: archetypeService.getArchetypeId('Receiving Back', 'HB'),
        confidence: 80,
        method: 'stats'
      };
    }

    // Speed Back: High yards per carry
    const ypc = rushYards / Math.max(1, rushAttempts);
    if (ypc > 4.8) {
      return {
        name: 'Speed Back',
        id: archetypeService.getArchetypeId('Speed Back', 'HB'),
        confidence: 75,
        method: 'stats'
      };
    }

    // Power Back: High volume, lower YPC
    if (rushAttempts > 200) {
      return {
        name: 'Power Back',
        id: archetypeService.getArchetypeId('Power Back', 'HB'),
        confidence: 70,
        method: 'stats'
      };
    }

    // Default: Elusive Back
    return {
      name: 'Elusive Back',
      id: archetypeService.getArchetypeId('Elusive Back', 'HB'),
      confidence: 60,
      method: 'stats'
    };
  }

  /**
   * Analyze WR stats to determine archetype
   */
  private analyzeWRStats(stats: RookieStats): ArchetypeResult | null {
    const receptions = stats['REC'] || 0;
    const recYards = stats['REC_YARDS'] || 0;
    const ypc = recYards / Math.max(1, receptions);

    // Deep Threat: High yards per catch
    if (ypc > 15) {
      return {
        name: 'Deep Threat',
        id: archetypeService.getArchetypeId('WR', 'Deep Threat'),
        confidence: 80,
        method: 'stats'
      };
    }

    // Slot Receiver: High volume, lower YPC
    if (receptions > 70 && ypc < 13) {
      return {
        name: 'Slot',
        id: archetypeService.getArchetypeId('WR', 'Slot'),
        confidence: 75,
        method: 'stats'
      };
    }

    // Default: Route Runner
    return {
      name: 'Route Runner',
      id: archetypeService.getArchetypeId('WR', 'Route Runner'),
      confidence: 60,
      method: 'stats'
    };
  }

  /**
   * Analyze TE stats to determine archetype
   */
  private analyzeTEStats(stats: RookieStats): ArchetypeResult | null {
    const receptions = stats['REC'] || 0;
    const recYards = stats['REC_YARDS'] || 0;

    // Receiving TE: High receiving production
    if (receptions > 40 || recYards > 500) {
      return {
        name: 'Receiving TE',
        id: archetypeService.getArchetypeId('TE', 'Receiving'),
        confidence: 80,
        method: 'stats'
      };
    }

    // Default: Blocking TE
    return {
      name: 'Blocking TE',
      id: archetypeService.getArchetypeId('TE', 'Blocking'),
      confidence: 60,
      method: 'stats'
    };
  }

  /**
   * Analyze EDGE stats to determine archetype
   */
  private analyzeEDGEStats(stats: RookieStats): ArchetypeResult | null {
    const sacks = stats['SACKS'] || 0;
    const tackles = stats['TACKLES'] || 0;

    // Speed Rusher: High sacks
    if (sacks > 8) {
      return {
        name: 'Speed Rusher',
        id: archetypeService.getArchetypeId('EDGE', 'Speed Rusher'),
        confidence: 80,
        method: 'stats'
      };
    }

    // Run Stopper: High tackles, lower sacks
    if (tackles > 60 && sacks < 5) {
      return {
        name: 'Run Stopper',
        id: archetypeService.getArchetypeId('EDGE', 'Run Stopper'),
        confidence: 75,
        method: 'stats'
      };
    }

    // Default: Power Rusher
    return {
      name: 'Power Rusher',
      id: archetypeService.getArchetypeId('EDGE', 'Power Rusher'),
      confidence: 60,
      method: 'stats'
    };
  }

  /**
   * Analyze DT stats to determine archetype
   */
  private analyzeDTStats(stats: RookieStats): ArchetypeResult | null {
    const sacks = stats['SACKS'] || 0;
    const tackles = stats['TACKLES'] || 0;

    // Pass Rusher: Higher sacks for DT
    if (sacks > 5) {
      return {
        name: 'Pass Rusher DT',
        id: archetypeService.getArchetypeId('DT', 'Pass Rusher'),
        confidence: 80,
        method: 'stats'
      };
    }

    // Default: Run Stuffer
    return {
      name: 'Run Stuffer',
      id: archetypeService.getArchetypeId('DT', 'Run Stuffer'),
      confidence: 60,
      method: 'stats'
    };
  }

  /**
   * Analyze LB stats to determine archetype
   */
  private analyzeLBStats(stats: RookieStats): ArchetypeResult | null {
    const tackles = stats['TACKLES'] || 0;
    const sacks = stats['SACKS'] || 0;
    const interceptions = stats['INT'] || 0;

    // Pass Coverage: High interceptions
    if (interceptions > 2) {
      return {
        name: 'Pass Coverage LB',
        id: archetypeService.getArchetypeId('LB', 'Pass Coverage'),
        confidence: 80,
        method: 'stats'
      };
    }

    // Speed Rusher: High sacks
    if (sacks > 5) {
      return {
        name: 'Speed Rusher LB',
        id: archetypeService.getArchetypeId('LB', 'Speed Rusher'),
        confidence: 75,
        method: 'stats'
      };
    }

    // Default: Field General
    return {
      name: 'Field General LB',
      id: archetypeService.getArchetypeId('LB', 'Field General'),
      confidence: 60,
      method: 'stats'
    };
  }

  /**
   * Analyze CB stats to determine archetype
   */
  private analyzeCBStats(stats: RookieStats): ArchetypeResult | null {
    const interceptions = stats['INT'] || 0;
    const passDeflections = stats['PD'] || 0;

    // Slot CB: High deflection rate
    if (passDeflections > 10 && interceptions < 3) {
      return {
        name: 'Slot CB',
        id: archetypeService.getArchetypeId('CB', 'Slot'),
        confidence: 75,
        method: 'stats'
      };
    }

    // Default: Man-to-Man
    return {
      name: 'Man-to-Man CB',
      id: archetypeService.getArchetypeId('CB', 'Man-to-Man'),
      confidence: 60,
      method: 'stats'
    };
  }

  /**
   * Analyze Safety stats to determine archetype
   */
  private analyzeSafetyStats(stats: RookieStats): ArchetypeResult | null {
    const tackles = stats['TACKLES'] || 0;
    const interceptions = stats['INT'] || 0;

    // Run Support: High tackles
    if (tackles > 70) {
      return {
        name: 'Run Support Safety',
        id: archetypeService.getArchetypeId('S', 'Run Support'),
        confidence: 80,
        method: 'stats'
      };
    }

    // Zone: High interceptions
    if (interceptions > 3) {
      return {
        name: 'Zone Safety',
        id: archetypeService.getArchetypeId('S', 'Zone'),
        confidence: 75,
        method: 'stats'
      };
    }

    // Default: Hybrid
    return {
      name: 'Hybrid Safety',
      id: archetypeService.getArchetypeId('S', 'Hybrid'),
      confidence: 60,
      method: 'stats'
    };
  }

  /**
   * Assign archetype based on body type (height/weight)
   */
  private assignFromBodyType(position: string, height: number, weight: number): ArchetypeResult {
    // Height in inches, weight in pounds

    switch (position) {
      case 'QB':
        // Taller QBs tend to be pocket passers
        if (height >= 76) { // 6'4"+
          return { name: 'Strong Arm', id: archetypeService.getArchetypeId('QB', 'Strong Arm'), confidence: 50, method: 'body' };
        } else {
          return { name: 'Scrambler', id: archetypeService.getArchetypeId('QB', 'Scrambler'), confidence: 50, method: 'body' };
        }

      case 'HB':
        // Heavier HBs = power, lighter = speed
        if (weight >= 220) {
          return { name: 'Power Back', id: archetypeService.getArchetypeId('HB', 'Power Back'), confidence: 55, method: 'body' };
        } else if (weight <= 195) {
          return { name: 'Speed Back', id: archetypeService.getArchetypeId('HB', 'Speed Back'), confidence: 55, method: 'body' };
        } else {
          return { name: 'Elusive Back', id: archetypeService.getArchetypeId('HB', 'Elusive Back'), confidence: 50, method: 'body' };
        }

      case 'WR':
        // Tall WRs = deep threat, short = slot
        if (height >= 75) { // 6'3"+
          return { name: 'Deep Threat', id: archetypeService.getArchetypeId('WR', 'Deep Threat'), confidence: 55, method: 'body' };
        } else if (height <= 70) { // 5'10" or less
          return { name: 'Slot', id: archetypeService.getArchetypeId('WR', 'Slot'), confidence: 55, method: 'body' };
        } else {
          return { name: 'Route Runner', id: archetypeService.getArchetypeId('WR', 'Route Runner'), confidence: 50, method: 'body' };
        }

      case 'TE':
        // Lighter TEs = receiving, heavier = blocking
        if (weight <= 245) {
          return { name: 'Receiving TE', id: archetypeService.getArchetypeId('TE', 'Receiving'), confidence: 55, method: 'body' };
        } else {
          return { name: 'Blocking TE', id: archetypeService.getArchetypeId('TE', 'Blocking'), confidence: 50, method: 'body' };
        }

      case 'LEDG':
      case 'REDG':
        // Lighter EDGEs = speed rusher
        if (weight <= 250) {
          return { name: 'Speed Rusher', id: archetypeService.getArchetypeId('EDGE', 'Speed Rusher'), confidence: 55, method: 'body' };
        } else {
          return { name: 'Power Rusher', id: archetypeService.getArchetypeId('EDGE', 'Power Rusher'), confidence: 50, method: 'body' };
        }

      case 'CB':
        // Taller CBs tend to be press/man-to-man
        if (height >= 72) { // 6'0"+
          return { name: 'Man-to-Man CB', id: archetypeService.getArchetypeId('CB', 'Man-to-Man'), confidence: 55, method: 'body' };
        } else {
          return { name: 'Slot CB', id: archetypeService.getArchetypeId('CB', 'Slot'), confidence: 50, method: 'body' };
        }

      case 'FS':
      case 'SS':
        // Heavier safeties = run support
        if (weight >= 215) {
          return { name: 'Run Support Safety', id: archetypeService.getArchetypeId('S', 'Run Support'), confidence: 55, method: 'body' };
        } else {
          return { name: 'Zone Safety', id: archetypeService.getArchetypeId('S', 'Zone'), confidence: 50, method: 'body' };
        }

      default:
        return this.getDefaultArchetype(position);
    }
  }

  /**
   * Get default archetype for a position
   */
  private getDefaultArchetype(position: string): ArchetypeResult {
    // Just use the first archetype for the position from archetypeService
    const defaultId = archetypeService.getDefaultArchetypeForPosition(position);
    const defaultName = archetypeService.getArchetypeName(defaultId, position);

    return {
      name: defaultName,
      id: defaultId,
      confidence: 40,
      method: 'default'
    };
  }
}

// Export singleton
export const archetypeAssigner = new ArchetypeAssigner();
