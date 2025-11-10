/**
 * Madden Formula Calculator
 *
 * Calculates secondary ratings and OVR using actual Madden formulas with archetype multipliers.
 * Based on reverse-engineered formulas from Madden game files.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface FormulaContext {
  [attribute: string]: number | string;
  Archetype?: string;
}

interface PositionFormulas {
  [ratingName: string]: string;
}

export class MaddenFormulaCalculator {
  private formulas: Map<string, PositionFormulas> = new Map();
  private initialized: boolean = false;

  constructor() {
    try {
      this.loadFormulas();
      this.initialized = true;
      console.log('[MaddenFormulaCalculator] Initialized successfully');
    } catch (error) {
      console.error('[MaddenFormulaCalculator] Failed to initialize:', error);
      this.initialized = false;
    }
  }

  /**
   * Check if calculator is ready to use
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Load formulas from madden-formulas.txt
   */
  private loadFormulas(): void {
    let formulaPath: string;

    if (app.isPackaged) {
      formulaPath = path.join(app.getAppPath(), 'data', 'formulas', 'madden-formulas.txt');
    } else {
      // In dev mode, compiled files are in .vite/build/services/rating-modes/
      // Need to go up 2 levels to reach .vite/build/, then into data/formulas/
      formulaPath = path.join(__dirname, '../../data/formulas/madden-formulas.txt');
    }

    console.log('[MaddenFormulaCalculator] Loading formulas from:', formulaPath);

    if (!fs.existsSync(formulaPath)) {
      throw new Error(`Formula file not found: ${formulaPath}`);
    }

    const content = fs.readFileSync(formulaPath, 'utf-8');

    if (!content) {
      throw new Error('Formula file is empty or could not be read');
    }

    // Parse position sections
    const lines = content.split('\n');
    let currentPosition: string | null = null;
    let currentRatingName: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) {
        continue;
      }

      // Check if this is a position header (no = sign, not indented)
      if (!line.startsWith('=') && !line.startsWith('\t') && !line.includes('=')) {
        currentPosition = this.mapPositionName(line);
        if (!this.formulas.has(currentPosition)) {
          this.formulas.set(currentPosition, {});
        }
        console.log(`[MaddenFormulaCalculator] Found position: ${currentPosition}`);
        continue;
      }

      // Check if this is a rating name (no = sign)
      if (!line.startsWith('=') && currentPosition) {
        currentRatingName = line;
        continue;
      }

      // Check if this is a formula (starts with =)
      if (line.startsWith('=') && currentPosition && currentRatingName) {
        const formula = line.substring(1); // Remove leading =
        const translatedFormula = this.translateFormula(formula);

        const positionFormulas = this.formulas.get(currentPosition);
        if (positionFormulas) {
          positionFormulas[currentRatingName] = translatedFormula;
          console.log(`[MaddenFormulaCalculator] Loaded formula for ${currentPosition} - ${currentRatingName}`);
        }
      }
    }

    console.log('[MaddenFormulaCalculator] Loaded formulas for positions:', Array.from(this.formulas.keys()));
  }

  /**
   * Map position display names to Madden position codes
   */
  private mapPositionName(name: string): string {
    const mapping: { [key: string]: string } = {
      'Quarterbacks': 'QB',
      'Quarterback': 'QB',
      'Halfback': 'HB',
      'Halfbacks': 'HB',
      'Fullback': 'FB',
      'Fullbacks': 'FB',
      'Wide Receiver': 'WR',
      'Wide Receivers': 'WR',
      'Tight End': 'TE',
      'Tight Ends': 'TE',
      'Offensive Line': 'OL',
      'Offensive Linemen': 'OL',
      'Defensive Line': 'DT',
      'Defensive Linemen': 'DT',
      'Linebackers': 'LB',
      'Linebacker': 'LB',
      'Cornerbacks': 'CB',
      'Cornerback': 'CB',
      'Safeties': 'S',
      'Safety': 'S',
      'Kicker': 'K',
      'Kickers': 'K',
      'Punter': 'P',
      'Punters': 'P',
    };

    return mapping[name] || name;
  }

  /**
   * Translate Excel-style formula to evaluatable JavaScript
   */
  private translateFormula(formula: string): string {
    // Convert IF(condition, true_val, false_val) to ternary
    // Handle nested IF statements
    formula = formula.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/g, '($1 ? $2 : $3)');

    // Convert OR(a,b,c) to (a || b || c)
    formula = formula.replace(/OR\(([^)]+)\)/g, (match, conditions) => {
      const parts = conditions.split(',').map((c: string) => c.trim());
      return `(${parts.join(' || ')})`;
    });

    // Convert AND(a,b,c) to (a && b && c)
    formula = formula.replace(/AND\(([^)]+)\)/g, (match, conditions) => {
      const parts = conditions.split(',').map((c: string) => c.trim());
      return `(${parts.join(' && ')})`;
    });

    // Convert string comparisons: Archetype="Value" to Archetype==="Value"
    formula = formula.replace(/(\w+)="([^"]+)"/g, '$1==="$2"');

    // Convert string comparisons: Archetype='Value' to Archetype==='Value'
    formula = formula.replace(/(\w+)='([^']+)'/g, '$1==="$2"');

    return formula;
  }

  /**
   * Evaluate a formula with player data context
   */
  private evaluateFormula(formula: string, context: FormulaContext): number {
    try {
      // Create evaluation context with all attributes defaulting to 0
      const safeContext: { [key: string]: number | string } = {
        ...context,
        Archetype: context.Archetype || '',
      };

      // Replace undefined attributes with 0
      Object.keys(safeContext).forEach(key => {
        if (safeContext[key] === undefined || safeContext[key] === null) {
          safeContext[key] = 0;
        }
      });

      // Create function to evaluate formula
      const func = new Function(...Object.keys(safeContext), `"use strict"; return ${formula};`);
      const result = func(...Object.values(safeContext));

      // Clamp to Madden rating range (40-99)
      return Math.round(Math.max(40, Math.min(99, result)));
    } catch (error) {
      console.error(`[MaddenFormulaCalculator] Error evaluating formula: ${formula}`, error);
      console.error('[MaddenFormulaCalculator] Context:', context);
      return 65; // Default fallback
    }
  }

  /**
   * Calculate all secondary ratings for a player
   */
  calculateSecondaryRatings(
    position: string,
    baseAttributes: FormulaContext,
    archetype?: string
  ): { [rating: string]: number } {
    if (!this.initialized) {
      console.error('[MaddenFormulaCalculator] Calculator not initialized');
      return {};
    }

    // Map position to formula position group
    const formulaPosition = this.mapPlayerPositionToFormulaPosition(position);
    const positionFormulas = this.formulas.get(formulaPosition);

    if (!positionFormulas) {
      console.warn(`[MaddenFormulaCalculator] No formulas found for position: ${position} (mapped to ${formulaPosition})`);
      return {};
    }

    const context: FormulaContext = {
      ...baseAttributes,
      Archetype: archetype || '',
    };

    const results: { [rating: string]: number } = {};

    // Calculate all ratings except Overall
    for (const [ratingName, formula] of Object.entries(positionFormulas)) {
      if (ratingName !== 'Overall') {
        results[ratingName] = this.evaluateFormula(formula, context);
      }
    }

    return results;
  }

  /**
   * Calculate OVR for a player
   */
  calculateOVR(position: string, attributes: FormulaContext, archetype?: string): number {
    if (!this.initialized) {
      console.error('[MaddenFormulaCalculator] Calculator not initialized');
      return 65;
    }

    // Map position to formula position group
    const formulaPosition = this.mapPlayerPositionToFormulaPosition(position);
    const positionFormulas = this.formulas.get(formulaPosition);

    if (!positionFormulas || !positionFormulas['Overall']) {
      console.warn(`[MaddenFormulaCalculator] No OVR formula found for position: ${position} (mapped to ${formulaPosition})`);
      return 65;
    }

    const context: FormulaContext = {
      ...attributes,
      Archetype: archetype || '',
    };

    return this.evaluateFormula(positionFormulas['Overall'], context);
  }

  /**
   * Map specific Madden positions to formula position groups
   */
  private mapPlayerPositionToFormulaPosition(position: string): string {
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
      'LE': 'DT',
      'RE': 'DT',
      'DT': 'DT',
      'NT': 'DT',
      'LOLB': 'LB',
      'MLB': 'LB',
      'ROLB': 'LB',
      'CB': 'CB',
      'FS': 'S',
      'SS': 'S',
      'K': 'K',
      'P': 'P',
    };

    return mapping[position] || position;
  }

  /**
   * Get all available positions with formulas
   */
  getAvailablePositions(): string[] {
    return Array.from(this.formulas.keys());
  }

  /**
   * Get all rating names for a position
   */
  getRatingNamesForPosition(position: string): string[] {
    const formulaPosition = this.mapPlayerPositionToFormulaPosition(position);
    const positionFormulas = this.formulas.get(formulaPosition);

    if (!positionFormulas) {
      return [];
    }

    return Object.keys(positionFormulas);
  }

  /**
   * Check if a position has formulas
   */
  hasFormulas(position: string): boolean {
    const formulaPosition = this.mapPlayerPositionToFormulaPosition(position);
    return this.formulas.has(formulaPosition);
  }
}

// Export singleton instance
export const maddenFormulaCalculator = new MaddenFormulaCalculator();
