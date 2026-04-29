/**
 * Equipment Assignment Service
 *
 * Assigns era-appropriate equipment to players based on year and position.
 * Uses data from equipment-years.json to determine valid options for each era.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface EquipmentAssignment {
  [slotName: string]: string | null;
}

interface EraDefaults {
  helmet: string[] | null;
  shoes: string[];
  gloves: string[];
  linemanGloves?: string[];
  notes?: string;
}

interface EquipmentYearsData {
  eraDefaults: { [era: string]: EraDefaults };
  positionDefaults: { [position: string]: any };
  shoulderPads: { evolution: { [era: string]: any }; positionTendencies: { [position: string]: any } };
  armSleeves: { evolution: { [era: string]: any }; positionTendencies: { [position: string]: any } };
  tapeTrends: { evolution: { [era: string]: any }; positionTendencies: { [position: string]: any }; tapeTypes: { [key: string]: any } };
}

// Equipment field names (matching parser API)
const EQUIPMENT_FIELDS = {
  HELMET: 'Helmet',
  LEFT_SHOE: 'LeftShoe',
  RIGHT_SHOE: 'RightShoe',
  LEFT_GLOVE: 'LeftGlove',
  RIGHT_GLOVE: 'RightGlove',
  LEFT_SLEEVE: 'LeftSleeve',
  RIGHT_SLEEVE: 'RightSleeve',
  LEFT_SPATS: 'LeftSpats',
  RIGHT_SPATS: 'RightSpats',
  LEFT_ELBOW: 'LeftElbow',
  RIGHT_ELBOW: 'RightElbow',
  // New era-appropriate fields
  VISOR: 'Visor',
  JERSEY_STYLE: 'JerseyStyle',
  NECKPAD: 'Neckpad',
  SHOULDER_PADS: 'ShoulderPads',
  GUARDIAN_CAP: 'GuardianCap',
};

// Map positions to their categories for equipment selection
const SKILL_POSITIONS = ['QB', 'RB', 'HB', 'FB', 'WR', 'TE', 'CB', 'S', 'FS', 'SS'];
const LINEMAN_POSITIONS = ['OL', 'C', 'LG', 'RG', 'LT', 'RT', 'DL', 'DT', 'LE', 'RE', 'NT'];
const LINEBACKER_POSITIONS = ['LB', 'MLB', 'LOLB', 'ROLB', 'ILB', 'OLB'];
const KICKER_POSITIONS = ['K', 'P'];

class EquipmentAssignmentService {
  private equipmentData: EquipmentYearsData | null = null;
  private isLoaded = false;

  /**
   * Get the data directory path (works in both dev and packaged app)
   */
  private getDataPath(): string {
    if (app.isPackaged) {
      return path.join(app.getAppPath(), '.vite', 'build', 'data');
    }
    // In dev mode, app.getAppPath() returns the project root
    return path.join(app.getAppPath(), 'data');
  }

  /**
   * Load equipment-years.json data
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) return;

    const dataPath = path.join(this.getDataPath(), 'equipment-years.json');
    console.log('[EquipmentAssignmentService] Loading data from:', dataPath);

    try {
      const data = fs.readFileSync(dataPath, 'utf-8');
      this.equipmentData = JSON.parse(data);
      this.isLoaded = true;
      console.log('[EquipmentAssignmentService] Loaded equipment data successfully');
    } catch (error) {
      console.error('[EquipmentAssignmentService] Failed to load equipment data:', error);
      throw error;
    }
  }

  /**
   * Get the era bracket for a given year
   */
  getEraBracket(year: number): string {
    if (year < 1970) return '1970-1979';
    if (year <= 1979) return '1970-1979';
    if (year <= 1989) return '1980-1989';
    if (year <= 1999) return '1990-1999';
    if (year <= 2007) return '2000-2007';
    if (year <= 2013) return '2008-2013';
    if (year <= 2016) return '2014-2016';
    if (year <= 2019) return '2017-2019';
    if (year <= 2022) return '2020-2022';
    return '2023-2025';
  }

  /**
   * Random selection from array
   */
  private randomFrom<T>(arr: T[] | null): T | null {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Get probability for item based on likelihood string
   */
  private getLikelihoodProbability(likelihood: string): number {
    switch (likelihood) {
      case 'very_high': return 0.85;
      case 'high': return 0.70;
      case 'medium': return 0.50;
      case 'moderate': return 0.40;
      case 'low': return 0.20;
      case 'very_common': return 0.80;
      case 'common': return 0.60;
      case 'uncommon': return 0.30;
      case 'rare': return 0.15;
      case 'very_rare': return 0.05;
      case 'none':
      case 'never':
        return 0;
      default: return 0.30;
    }
  }

  /**
   * Get era-appropriate visor
   * - Before 1990: No visors
   * - 1990-1999: Low chance (~10%) of clear visor only
   * - 2000+: Increasing chance based on era
   */
  private getEraVisor(year: number): string {
    // No visors before 1990
    if (year < 1990) {
      return 'GearVisor_None';
    }

    // 1990-1999: Very rare, only clear
    if (year < 2000) {
      if (Math.random() < 0.10) {
        return 'GearVisor_visorClear';
      }
      return 'GearVisor_None';
    }

    // 2000-2009: Emerging, mostly clear
    if (year < 2010) {
      if (Math.random() < 0.30) {
        return Math.random() < 0.8 ? 'GearVisor_visorClear' : 'GearVisor_visorDark';
      }
      return 'GearVisor_None';
    }

    // 2010-2019: Common, more variety
    if (year < 2020) {
      if (Math.random() < 0.50) {
        const roll = Math.random();
        if (roll < 0.5) return 'GearVisor_visorClear';
        if (roll < 0.8) return 'GearVisor_visorDark';
        return 'GearVisor_visorOakley_clear';
      }
      return 'GearVisor_None';
    }

    // 2020+: Very common, full variety including Oakley Prizm
    if (Math.random() < 0.60) {
      const visors = [
        'GearVisor_visorClear',
        'GearVisor_visorDark',
        'GearVisor_visorDarkLight',
        'GearVisor_visorOakley_clear',
        'GearVisor_visorOakley_Dark',
        'GearVisor_visorOakley_DarkLight',
        'GearVisor_visorOakley_Prizm'
      ];
      return this.randomFrom(visors) || 'GearVisor_visorClear';
    }
    return 'GearVisor_None';
  }

  /**
   * Get era-appropriate jersey style
   * - 1970-1989: Long sleeves (100%)
   * - 1990-1999: Mix of Long (60%) and Standard (40%)
   * - 2000+: Mix trending toward Tight in modern era
   */
  private getEraJerseyStyle(year: number): string {
    // 1970s and 1980s: Long sleeves were standard
    if (year < 1990) {
      return 'Gear_JerseyStyle_SleeveLong';
    }

    // 1990-1999: Transition era
    if (year < 2000) {
      return Math.random() < 0.60 ? 'Gear_JerseyStyle_SleeveLong' : 'Gear_JerseyStyle_SleeveStandard';
    }

    // 2000-2009: Standard becoming norm
    if (year < 2010) {
      const roll = Math.random();
      if (roll < 0.20) return 'Gear_JerseyStyle_SleeveLong';
      if (roll < 0.80) return 'Gear_JerseyStyle_SleeveStandard';
      return 'Gear_JerseyStyle_SleeveTight';
    }

    // 2010-2019: Tight sleeves emerging
    if (year < 2020) {
      const roll = Math.random();
      if (roll < 0.10) return 'Gear_JerseyStyle_SleeveLong';
      if (roll < 0.50) return 'Gear_JerseyStyle_SleeveStandard';
      return 'Gear_JerseyStyle_SleeveTight';
    }

    // 2020+: Tight sleeves dominant
    const roll = Math.random();
    if (roll < 0.05) return 'Gear_JerseyStyle_SleeveLong';
    if (roll < 0.30) return 'Gear_JerseyStyle_SleeveStandard';
    return 'Gear_JerseyStyle_SleeveTight';
  }

  /**
   * Get era-appropriate neckpad (cowboy collar / neck roll)
   * - 1970s: High chance (50%) for LB/Lineman/FB
   * - 1980s: Medium chance (30%) for same positions
   * - 1990-2005: Lower chance (15%)
   * - 2006+: Very rare (5%)
   */
  private getEraNeckpad(year: number, position: string): string {
    // Only LB, Linemen, and FB typically wore neck rolls
    const neckpadPositions = [...LINEBACKER_POSITIONS, ...LINEMAN_POSITIONS, 'FB'];
    if (!neckpadPositions.includes(position)) {
      return 'GearNeckpad_None';
    }

    let chance: number;
    if (year < 1980) {
      chance = 0.50;
    } else if (year < 1990) {
      chance = 0.30;
    } else if (year < 2006) {
      chance = 0.15;
    } else {
      chance = 0.05;
    }

    if (Math.random() < chance) {
      // 70% cowboy collar, 30% butterfly
      return Math.random() < 0.70 ? 'GearNeckpad_CowboyCollarNeckRoll' : 'GearNeckpad_ButterflyNeckRoll';
    }

    return 'GearNeckpad_None';
  }

  /**
   * Get era-appropriate Guardian Cap
   * - Before 2021: Not available
   * - 2021+: Optional (mostly none, rarely used in games)
   */
  private getEraGuardianCap(year: number): string {
    // Guardian caps weren't used until 2022 preseason, keep them rare
    if (year < 2022) {
      return 'GuardianCap_None';
    }
    // Even in modern era, very rare in actual games
    return 'GuardianCap_None';
  }

  /**
   * Get position-appropriate gloves for era
   * Updated with QB-specific rules: no tape on throwing hand
   */
  private getPositionGloves(position: string, eraGloves: string[] | null, year: number, linemanGloves?: string[] | null): { left: string; right: string } {
    if (!eraGloves) return { left: 'GearHand_None', right: 'GearHand_None' };

    // QBs - special handling: NEVER tape on throwing hand (right), very rare on left
    if (position === 'QB') {
      // QB throwing hand (right) - NEVER has tape/gloves
      // QB non-throwing hand (left) - very rare tape (5%)
      const leftHand = Math.random() < 0.05 ? 'GearHand_tapedHandNormal_White' : 'GearHand_None';
      return { left: leftHand, right: 'GearHand_None' };
    }

    // Kickers - no gloves
    if (KICKER_POSITIONS.includes(position)) {
      return { left: 'GearHand_None', right: 'GearHand_None' };
    }

    // For other positions, use existing logic but return both hands
    const glove = this.getPositionGlovesSingle(position, eraGloves, year, linemanGloves);
    return { left: glove, right: glove };
  }

  /**
   * Internal helper for single glove selection (non-QB positions)
   */
  private getPositionGlovesSingle(position: string, eraGloves: string[] | null, year: number, linemanGloves?: string[] | null): string {
    if (!eraGloves) return 'GearHand_None';

    // Pre-2000 era - taped hands very common for linemen
    if (year < 2000) {
      // Linemen and linebackers heavily taped hands
      if (LINEMAN_POSITIONS.includes(position) || LINEBACKER_POSITIONS.includes(position)) {
        // Use linemanGloves if available, otherwise filter regular gloves
        const gloveOptions = linemanGloves || eraGloves.filter(g => g.includes('tapedHand'));
        // 70% chance for linemen to have taped hands in vintage eras
        if (Math.random() < 0.70) {
          return this.randomFrom(gloveOptions) || 'GearHand_None';
        }
        return 'GearHand_None';
      }
      // Most skill positions no gloves in vintage era
      if (Math.random() < 0.10) {
        return this.randomFrom(eraGloves.filter(g => g.includes('tapedHand')));
      }
      return 'GearHand_None';
    }

    // 2000-2010 - gloves becoming common for skill positions
    if (year < 2010) {
      if (SKILL_POSITIONS.includes(position) && position !== 'QB') {
        if (Math.random() < 0.50) {
          return this.randomFrom(eraGloves.filter(g => !g.includes('None'))) || this.randomFrom(eraGloves);
        }
      }
      if (LINEMAN_POSITIONS.includes(position)) {
        if (Math.random() < 0.50) {
          return this.randomFrom(eraGloves.filter(g => g.includes('DTack') || g.includes('HyperBeast') || g.includes('tapedHand'))) || 'GearHand_None';
        }
      }
      return Math.random() < 0.3 ? this.randomFrom(eraGloves) : 'GearHand_None';
    }

    // Modern era - gloves are standard for most positions
    if (SKILL_POSITIONS.includes(position) && position !== 'QB') {
      // 85%+ chance of wearing receiver gloves
      if (Math.random() < 0.85) {
        return this.randomFrom(eraGloves.filter(g =>
          g.includes('VaporJet') || g.includes('Superbad') || g.includes('VaporKnit') ||
          g.includes('FlyLock') || g.includes('Adizero') || g.includes('F6') || g.includes('F9')
        )) || this.randomFrom(eraGloves);
      }
    }

    // Linemen - high chance of D-Tack style gloves
    if (LINEMAN_POSITIONS.includes(position)) {
      if (Math.random() < 0.75) {
        return this.randomFrom(eraGloves.filter(g =>
          g.includes('DTack') || g.includes('HyperBeast') || g.includes('Impact') || g.includes('Combat')
        )) || this.randomFrom(eraGloves);
      }
    }

    // Linebackers - mixed
    if (LINEBACKER_POSITIONS.includes(position)) {
      if (Math.random() < 0.65) {
        return this.randomFrom(eraGloves);
      }
    }

    return this.randomFrom(eraGloves);
  }

  /**
   * Get position-appropriate shoes for era
   */
  private getPositionShoes(position: string, eraShoes: string[]): string | null {
    if (!eraShoes || eraShoes.length === 0) return null;

    // Linemen prefer high-cut shoes
    if (LINEMAN_POSITIONS.includes(position)) {
      const highShoes = eraShoes.filter(s =>
        s.includes('_high_') || s.includes('_High_') || s.includes('ForceSavage') || s.includes('Nasty')
      );
      if (highShoes.length > 0 && Math.random() < 0.70) {
        return this.randomFrom(highShoes);
      }
    }

    // CBs and skill positions prefer low-cut for agility
    if (['CB', 'WR', 'RB', 'HB', 'S', 'FS', 'SS'].includes(position)) {
      const lowShoes = eraShoes.filter(s =>
        s.includes('_low_') || s.includes('_Low_') || s.includes('VaporUntouchable') || s.includes('VaporEdge')
      );
      if (lowShoes.length > 0 && Math.random() < 0.70) {
        return this.randomFrom(lowShoes);
      }
    }

    return this.randomFrom(eraShoes);
  }

  /**
   * Get era-appropriate sleeves for position
   */
  private getEraSleeve(year: number, position: string): string | null {
    if (!this.equipmentData) return null;

    const sleeveTendencies = this.equipmentData.armSleeves?.positionTendencies?.[position];
    if (!sleeveTendencies) return null;

    // Pre-2005: No compression sleeves existed
    if (year < 2005) {
      // Maybe elbow pads for linemen
      if (LINEMAN_POSITIONS.includes(position) && Math.random() < 0.30) {
        return 'GearArm_ElbowPad_White';
      }
      return null;
    }

    // 2005-2010: Sleeves emerging
    if (year < 2010) {
      const prob = this.getLikelihoodProbability(sleeveTendencies.likelihood || 'medium') * 0.5;
      if (Math.random() < prob) {
        return 'GearArm_Sleeve_Compression_White';
      }
      return null;
    }

    // 2010+: Sleeves common for skill positions
    const prob = this.getLikelihoodProbability(sleeveTendencies.likelihood || 'medium');
    if (Math.random() < prob) {
      // Randomly pick sleeve color
      const colors = ['White', 'Black', 'Team'];
      const color = this.randomFrom(colors);
      if (year >= 2015) {
        return `GearArm_Sleeve_ShooterStyle_${color}`;
      }
      return `GearArm_Sleeve_Compression_${color}`;
    }

    return null;
  }

  /**
   * Get era-appropriate tape for position
   */
  private getEraTape(year: number, position: string): { wrist: string | null; finger: string | null; spats: string | null } {
    if (!this.equipmentData) return { wrist: null, finger: null, spats: null };

    const tapeTendencies = this.equipmentData.tapeTrends?.positionTendencies?.[position];
    const evolution = this.equipmentData.tapeTrends?.evolution;

    let result = { wrist: null as string | null, finger: null as string | null, spats: null as string | null };

    if (!tapeTendencies || !evolution) return result;

    // Get era evolution data
    let eraKey: string;
    if (year < 1980) eraKey = '1970-1979';
    else if (year < 1990) eraKey = '1980-1989';
    else if (year < 2000) eraKey = '1990-1999';
    else if (year < 2010) eraKey = '2000-2009';
    else if (year < 2020) eraKey = '2010-2019';
    else eraKey = '2020-2025';

    const eraData = evolution[eraKey];
    if (!eraData) return result;

    // Spats (very era-specific)
    if (year < 1990) {
      const spatProb = eraKey === '1970-1979' ? 0.40 : 0.25;
      if (Math.random() < spatProb && !KICKER_POSITIONS.includes(position) && position !== 'QB') {
        result.spats = 'GearFootwear_Spats_White';
      }
    }

    // Finger tape (linemen heavy users)
    if (LINEMAN_POSITIONS.includes(position)) {
      const fingerProb = this.getLikelihoodProbability(tapeTendencies.fingerTape || 'moderate');
      if (Math.random() < fingerProb) {
        result.finger = year >= 1995 && Math.random() < 0.3 ? 'GearHand_tapedHandFinger_Black' : 'GearHand_tapedHandFinger_White';
      }
    }

    // Wrist tape (era dependent)
    if (!KICKER_POSITIONS.includes(position) && position !== 'QB') {
      const wristLikelihood = eraData.wristTape || 'moderate';
      const wristProb = this.getLikelihoodProbability(wristLikelihood) * 0.5; // Scale down
      if (Math.random() < wristProb) {
        result.wrist = year >= 1995 && Math.random() < 0.3 ? 'GearHand_tapedHandNormal_Black' : 'GearHand_tapedHandNormal_White';
      }
    }

    return result;
  }

  /**
   * Get shoulder pad size for era and position
   */
  private getShoulderPadSize(year: number, position: string): string {
    if (!this.equipmentData) return 'Medium_Pads';

    const tendencies = this.equipmentData.shoulderPads?.positionTendencies?.[position];

    // Kickers always small
    if (KICKER_POSITIONS.includes(position)) {
      return 'Small_Pads';
    }

    // Pre-2000: Large pads for everyone
    if (year < 2000) {
      return 'Large_Pads';
    }

    // 2000-2010: Transition era
    if (year < 2010) {
      if (SKILL_POSITIONS.includes(position) && position !== 'TE') {
        return 'Medium_Pads';
      }
      return 'Large_Pads';
    }

    // Modern era
    if (LINEMAN_POSITIONS.includes(position)) {
      return 'Medium_Pads';
    }
    if (LINEBACKER_POSITIONS.includes(position)) {
      return 'Medium_Pads';
    }
    // Skill positions
    return 'Small_Pads';
  }

  /**
   * Get era-appropriate equipment for a player
   * Now includes: visor, jersey style, neckpad, shoulder pads, guardian cap
   */
  async getEraEquipment(year: number, position: string): Promise<EquipmentAssignment> {
    await this.initialize();

    if (!this.equipmentData) {
      throw new Error('Equipment data not loaded');
    }

    const era = this.getEraBracket(year);
    const eraDefaults = this.equipmentData.eraDefaults[era];

    if (!eraDefaults) {
      console.warn(`[EquipmentAssignmentService] No era defaults for ${era}`);
      return {};
    }

    const equipment: EquipmentAssignment = {};

    // Helmet
    const helmet = this.randomFrom(eraDefaults.helmet);
    if (helmet) {
      equipment[EQUIPMENT_FIELDS.HELMET] = helmet;
    }

    // Shoes (same for both feet)
    const shoe = this.getPositionShoes(position, eraDefaults.shoes);
    if (shoe) {
      equipment[EQUIPMENT_FIELDS.LEFT_SHOE] = shoe;
      equipment[EQUIPMENT_FIELDS.RIGHT_SHOE] = shoe;
    }

    // Gloves (pass linemanGloves for vintage era linemen)
    // Now returns { left, right } for QB-specific handling
    const gloves = this.getPositionGloves(position, eraDefaults.gloves, year, eraDefaults.linemanGloves);
    equipment[EQUIPMENT_FIELDS.LEFT_GLOVE] = gloves.left;
    equipment[EQUIPMENT_FIELDS.RIGHT_GLOVE] = gloves.right;

    // Sleeves (random per arm for variety)
    const leftSleeve = this.getEraSleeve(year, position);
    const rightSleeve = Math.random() < 0.7 ? leftSleeve : this.getEraSleeve(year, position); // 70% same, 30% different
    if (leftSleeve) equipment[EQUIPMENT_FIELDS.LEFT_SLEEVE] = leftSleeve;
    if (rightSleeve) equipment[EQUIPMENT_FIELDS.RIGHT_SLEEVE] = rightSleeve;

    // Tape (finger tape replaces gloves if applied)
    const tape = this.getEraTape(year, position);

    // If finger tape, it overrides gloves for linemen/physical positions
    if (tape.finger && (LINEMAN_POSITIONS.includes(position) || LINEBACKER_POSITIONS.includes(position))) {
      // Keep glove setting, finger tape is separate visual
    }

    // Spats (both feet)
    if (tape.spats) {
      equipment[EQUIPMENT_FIELDS.LEFT_SPATS] = tape.spats;
      equipment[EQUIPMENT_FIELDS.RIGHT_SPATS] = tape.spats;
    }

    // ====== NEW ERA-APPROPRIATE EQUIPMENT ======

    // Visor - no visors before 1990, increasing after
    equipment[EQUIPMENT_FIELDS.VISOR] = this.getEraVisor(year);

    // Jersey Style - long sleeves in 70s/80s, trending to tight in modern era
    equipment[EQUIPMENT_FIELDS.JERSEY_STYLE] = this.getEraJerseyStyle(year);

    // Neckpad (Cowboy Collar) - common in 70s/80s for LB/Linemen/FB
    equipment[EQUIPMENT_FIELDS.NECKPAD] = this.getEraNeckpad(year, position);

    // Shoulder Pads - large in vintage eras, small in modern
    equipment[EQUIPMENT_FIELDS.SHOULDER_PADS] = this.getShoulderPadSize(year, position);

    // Guardian Cap - only available 2022+, always set to none
    equipment[EQUIPMENT_FIELDS.GUARDIAN_CAP] = this.getEraGuardianCap(year);

    return equipment;
  }

  /**
   * Get era options for preview UI
   */
  async getEraOptions(year: number): Promise<{
    era: string;
    helmet: string[] | null;
    shoes: string[];
    gloves: string[];
    sleeves: string;
    spats: string;
    shoulderPads: string;
    visor: string;
    jerseyStyle: string;
    neckpad: string;
    guardianCap: string;
    notes: string;
  }> {
    await this.initialize();

    if (!this.equipmentData) {
      throw new Error('Equipment data not loaded');
    }

    const era = this.getEraBracket(year);
    const eraDefaults = this.equipmentData.eraDefaults[era];
    const summary = this.equipmentData.eraDefaults[era]?.notes || '';

    // Get decade for summary
    const decadeKey = year < 1980 ? '1970s' :
                      year < 1990 ? '1980s' :
                      year < 2000 ? '1990s' :
                      year < 2010 ? '2000s' :
                      year < 2020 ? '2010s' : '2020s';

    return {
      era,
      helmet: eraDefaults?.helmet || null,
      shoes: eraDefaults?.shoes || [],
      gloves: eraDefaults?.gloves || [],
      sleeves: year < 2005 ? 'None/Elbow pads' : year < 2015 ? 'Compression sleeves' : 'Shooter sleeves',
      spats: year < 1990 ? 'Common (white)' : year < 2000 ? 'Declining' : 'None',
      shoulderPads: year < 2000 ? 'Large' : year < 2010 ? 'Medium' : 'Small (skill) / Medium (line)',
      visor: year < 1990 ? 'None' : year < 2000 ? 'Rare (clear only)' : year < 2020 ? 'Common' : 'Very common (Oakley Prizm)',
      jerseyStyle: year < 1990 ? 'Long sleeves' : year < 2010 ? 'Standard' : 'Tight',
      neckpad: year < 1990 ? 'Common (LB/Line/FB)' : year < 2006 ? 'Declining' : 'Rare',
      guardianCap: year < 2022 ? 'Not available' : 'Optional (rare in games)',
      notes: summary
    };
  }
}

export const equipmentAssignmentService = new EquipmentAssignmentService();
