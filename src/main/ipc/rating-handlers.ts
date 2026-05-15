/**
 * Rating Calculation IPC Handlers
 *
 * Handles requests for dynamic overall rating calculations, formula-based calculations,
 * archetype management, and birthday conversions
 */

import { ipcMain } from 'electron';

import { ratingCalculator, MaddenRatings } from '../services/RatingCalculator';
import { maddenFormulaCalculator } from '../services/rating-modes/MaddenFormulaCalculator';
import { ovrWeightsCalculator } from '../services/rating-modes/OVRWeightsCalculator';
import { ArchetypeService, ArchetypeOption } from '../services/utils/archetypeService';
import { DateConverter } from '../services/utils/dateConverter';

/**
 * Register all rating calculation IPC handlers
 */
export function registerRatingHandlers(): void {
  /**
   * Calculate overall rating from current player ratings (legacy stats-based)
   * @param ratings - Partial ratings object from grid
   * @param position - Player position
   * @returns Calculated overall rating
   */
  ipcMain.handle(
    'rating:calculate-overall',
    async (_event, ratings: Partial<MaddenRatings>, position: string): Promise<number> => {
      try {
        console.log(`[RatingHandlers] Calculating OVR for ${position}`);
        return ratingCalculator.recalculateOverall(ratings, position);
      } catch (error: any) {
        console.error('[RatingHandlers] Error calculating overall:', error);
        // Return a fallback overall
        return 50;
      }
    }
  );

  /**
   * Calculate secondary ratings using Madden formulas
   * @param position - Player position
   * @param attributes - Base attributes
   * @param archetype - Optional archetype name
   * @returns Object with calculated secondary ratings
   */
  ipcMain.handle(
    'rating:calculate-secondary',
    async (_event, position: string, attributes: any, archetype?: string): Promise<{ [rating: string]: number }> => {
      try {
        console.log(`[RatingHandlers] Calculating secondary ratings for ${position}${archetype ? ` (${archetype})` : ''}`);
        return maddenFormulaCalculator.calculateSecondaryRatings(position, attributes, archetype);
      } catch (error: any) {
        console.error('[RatingHandlers] Error calculating secondary ratings:', error);
        return {};
      }
    }
  );

  /**
   * Calculate OVR using Madden formulas (uses ovrweights.json archetype-based formula)
   * @param position - Player position
   * @param attributes - All player attributes (field codes like PSPD, PAWR, etc.)
   * @param archetype - Optional archetype name
   * @returns Calculated OVR
   */
  ipcMain.handle(
    'rating:calculate-ovr-madden',
    async (_event, position: string, attributes: any, archetype?: string): Promise<number> => {
      try {
        console.log(`[RatingHandlers] Calculating OVR for ${position}${archetype ? ` (${archetype})` : ''}`);
        // Use the new ovrWeightsCalculator which implements the official Madden archetype-based formula
        return ovrWeightsCalculator.calculateOVR(attributes, position, archetype);
      } catch (error: any) {
        console.error('[RatingHandlers] Error calculating OVR:', error);
        return 50;
      }
    }
  );

  /**
   * Get archetypes for a position
   * @param position - Player position
   * @returns Array of archetype options
   */
  ipcMain.handle(
    'rating:get-archetypes',
    async (_event, position: string): Promise<ArchetypeOption[]> => {
      try {
        return ArchetypeService.getArchetypesForPosition(position);
      } catch (error: any) {
        console.error('[RatingHandlers] Error getting archetypes:', error);
        return [];
      }
    }
  );

  /**
   * Get archetype name by ID and position
   * @param id - Archetype ID
   * @param position - Player position
   * @returns Archetype name
   */
  ipcMain.handle(
    'rating:get-archetype-name',
    async (_event, id: number, position: string): Promise<string> => {
      try {
        const name = ArchetypeService.getArchetypeName(id, position);
        console.log(`[RatingHandlers] getArchetypeName(${id}, ${position}) = "${name}"`);
        return name;
      } catch (error: any) {
        console.error('[RatingHandlers] Error getting archetype name:', error);
        return 'Unknown';
      }
    }
  );

  /**
   * Get archetype ID by name and position
   * @param name - Archetype name
   * @param position - Player position
   * @returns Archetype ID
   */
  ipcMain.handle(
    'rating:get-archetype-id',
    async (_event, name: string, position: string): Promise<number> => {
      try {
        return ArchetypeService.getArchetypeId(name, position);
      } catch (error: any) {
        console.error('[RatingHandlers] Error getting archetype ID:', error);
        return 0;
      }
    }
  );

  /**
   * Convert encoded birthday to display format
   * @param encoded - Encoded birthday (YYYYMMDD integer)
   * @returns Display format (MM/DD/YYYY) or null
   */
  ipcMain.handle(
    'rating:birthday-to-display',
    async (_event, encoded: number): Promise<string | null> => {
      try {
        return DateConverter.encodedToDisplay(encoded);
      } catch (error: any) {
        console.error('[RatingHandlers] Error converting birthday to display:', error);
        return null;
      }
    }
  );

  /**
   * Convert display birthday to encoded format
   * @param display - Display format (MM/DD/YYYY)
   * @returns Encoded birthday (YYYYMMDD integer)
   */
  ipcMain.handle(
    'rating:birthday-to-encoded',
    async (_event, display: string): Promise<number> => {
      try {
        return DateConverter.displayToEncoded(display);
      } catch (error: any) {
        console.error('[RatingHandlers] Error converting birthday to encoded:', error);
        throw error;
      }
    }
  );

  /**
   * Calculate age from birthday
   * @param encoded - Encoded birthday (YYYYMMDD integer)
   * @param asOfYear - Optional year to calculate age as of
   * @returns Age in years
   */
  ipcMain.handle(
    'rating:calculate-age',
    async (_event, encoded: number, asOfYear?: number): Promise<number> => {
      try {
        return DateConverter.calculateAge(encoded, asOfYear);
      } catch (error: any) {
        console.error('[RatingHandlers] Error calculating age:', error);
        return 0;
      }
    }
  );

  /**
   * Calculate rating adjustments needed to achieve a target OVR
   * @param currentAttributes - Player's current attributes (field codes like PSPD, PAWR, etc.)
   * @param targetOVR - Desired OVR to achieve
   * @param position - Player position
   * @param archetype - Optional archetype name
   * @returns Object with suggested adjustments and achieved OVR
   */
  ipcMain.handle(
    'rating:calculate-ovr-adjustments',
    async (
      _event,
      currentAttributes: any,
      targetOVR: number,
      position: string,
      archetype?: string
    ): Promise<{ adjustments: { [fieldCode: string]: { current: number; suggested: number; weight: number; name: string } }; newOVR: number; archetype: string | null } | null> => {
      try {
        console.log(`[RatingHandlers] Calculating OVR adjustments for ${position} to target ${targetOVR}`);
        return ovrWeightsCalculator.calculateAdjustmentsForTargetOVR(currentAttributes, targetOVR, position, archetype);
      } catch (error: any) {
        console.error('[RatingHandlers] Error calculating OVR adjustments:', error);
        return null;
      }
    }
  );

  /**
   * Get archetype weights for UI display
   * @param archetypeName - Full archetype name (e.g., "QB_FieldGeneral")
   * @returns Object with field codes and their weights
   */
  ipcMain.handle(
    'rating:get-archetype-weights',
    async (_event, archetypeName: string): Promise<{ [fieldCode: string]: { name: string; weight: number } } | null> => {
      try {
        return ovrWeightsCalculator.getArchetypeWeights(archetypeName);
      } catch (error: any) {
        console.error('[RatingHandlers] Error getting archetype weights:', error);
        return null;
      }
    }
  );

  /**
   * Calculate OVR for all archetypes of a position with given attributes
   * Returns array of archetypes sorted by OVR (best first)
   * @param attributes - Player's current attributes (field codes like PSPD, PAWR, etc.)
   * @param position - Player position
   * @returns Array of {id, name, ovr} sorted by OVR descending
   */
  ipcMain.handle(
    'rating:calculate-ovr-for-archetypes',
    async (_event, attributes: any, position: string): Promise<{ id: number; name: string; ovr: number }[]> => {
      try {
        console.log(`[RatingHandlers] Calculating OVR for all archetypes of ${position}`);
        const archetypes = ArchetypeService.getArchetypesForPosition(position);

        const results = archetypes.map(arch => {
          // CRITICAL: Pass archetype ID (number) instead of name (string)
          // The ID correctly maps to ovrweights.json via ARCHETYPE_ID_TO_FORMULA
          // e.g., ID 4 ("QB Pure Scrambler") correctly maps to "QB_Scrambler"
          const ovr = ovrWeightsCalculator.calculateOVR(attributes, position, arch.id);
          return {
            id: arch.id,
            name: arch.name,
            ovr: ovr
          };
        });

        // Sort by OVR descending (best archetype first)
        results.sort((a, b) => b.ovr - a.ovr);

        console.log(`[RatingHandlers] Calculated OVRs for ${results.length} archetypes, best: ${results[0]?.name} (${results[0]?.ovr})`);
        return results;
      } catch (error: any) {
        console.error('[RatingHandlers] Error calculating OVR for archetypes:', error);
        return [];
      }
    }
  );

  /**
   * Recalculate OVR for a batch of players
   * Uses the CORRECT game formula from FranchiseUtils.js
   * @param players - Array of player objects with attributes
   * @returns Array of {index, ovr, archetype} for each player
   */
  ipcMain.handle(
    'rating:recalculate-ovr-batch',
    async (_event, players: any[]): Promise<{ index: number; ovr: number; archetype: string | null }[]> => {
      try {
        console.log(`[RatingHandlers] Batch recalculating OVR for ${players.length} players`);
        const results: { index: number; ovr: number; archetype: string | null }[] = [];

        for (let i = 0; i < players.length; i++) {
          const player = players[i];
          const position = player.PPOS;
          // FIX: ONLY use PLTY for archetype - PCBT is body type (pad sizes 0-6), NOT archetype!
          // Using PCBT as fallback caused wrong OVR calculations (e.g., body type 3 = QB_Scrambler archetype)
          const storedArchetype = player.PLTY;

          // Use the STORED archetype for OVR calculation when available.
          // When user sets an archetype and adjusts ratings to hit a specific OVR,
          // recalculation should use that same archetype to get the same result.
          // CRITICAL: 0 IS a valid archetype (QB_FieldGeneral), so only skip if truly undefined/null
          let ovr: number;
          let archetype: string | null = null;

          // Check if PLTY has a real value (including 0 which is valid for QB_FieldGeneral)
          const hasStoredArchetype = storedArchetype !== undefined && storedArchetype !== null;

          if (hasStoredArchetype) {
            // Use stored archetype for calculation
            ovr = ovrWeightsCalculator.calculateOVR(player, position, storedArchetype);

            // CRITICAL: Detect if stored archetype matches player's position
            // If PLTY=0 (QB_FieldGeneral) but player is CB, we need to show the ACTUAL archetype used
            const ARCHETYPE_ID_TO_POS: { [key: number]: string } = {
              0: 'QB', 1: 'QB', 2: 'QB', 3: 'QB', 4: 'QB',  // QB archetypes
              5: 'HB', 6: 'HB', 7: 'HB', 8: 'HB', 9: 'HB', 10: 'HB', 11: 'HB',  // HB archetypes
              12: 'FB', 13: 'FB',  // FB archetypes
              14: 'WR', 15: 'WR', 16: 'WR', 17: 'WR', 18: 'WR', 19: 'WR', 20: 'WR', 21: 'WR',  // WR archetypes
              22: 'TE', 23: 'TE', 24: 'TE', 25: 'TE', 26: 'TE',  // TE archetypes
              27: 'C', 28: 'C', 29: 'C', 30: 'C',  // C archetypes
              31: 'OT', 32: 'OT', 33: 'OT', 34: 'OT',  // OT archetypes (for LT/RT)
              35: 'G', 36: 'G', 37: 'G', 38: 'G',  // G archetypes (for LG/RG)
              39: 'DE', 40: 'DE', 41: 'DE', 42: 'DE',  // DE archetypes (for LE/RE)
              43: 'DT', 44: 'DT', 45: 'DT', 46: 'DT',  // DT archetypes
              47: 'OLB', 48: 'OLB', 49: 'OLB', 50: 'OLB',  // OLB archetypes (for LOLB/ROLB)
              51: 'MLB', 52: 'MLB', 53: 'MLB',  // MLB archetypes
              54: 'CB', 55: 'CB', 56: 'CB', 57: 'CB',  // CB archetypes
              58: 'S', 59: 'S', 60: 'S', 61: 'S',  // S archetypes (for FS/SS)
              62: 'KP', 63: 'KP', 64: 'KP', 65: 'KP', 66: 'KP', 67: 'KP'  // K/P archetypes
            };

            // Map player position to base position for comparison
            const POS_TO_BASE: { [key: string]: string } = {
              'QB': 'QB', 'HB': 'HB', 'FB': 'FB', 'WR': 'WR', 'TE': 'TE',
              'LT': 'OT', 'RT': 'OT', 'LG': 'G', 'RG': 'G', 'C': 'C',
              'LE': 'DE', 'RE': 'DE', 'DT': 'DT',
              'LOLB': 'OLB', 'ROLB': 'OLB', 'MLB': 'MLB',
              'CB': 'CB', 'FS': 'S', 'SS': 'S', 'K': 'KP', 'P': 'KP'
            };

            const archetypePos = ARCHETYPE_ID_TO_POS[storedArchetype];
            const playerBasePos = POS_TO_BASE[position] || position;

            if (archetypePos && archetypePos === playerBasePos) {
              // Archetype matches position - use stored
              archetype = `ID:${storedArchetype}`;
            } else {
              // Mismatch! Use findBestArchetype to get the actual archetype used
              const best = ovrWeightsCalculator.findBestArchetype(player, position);
              if (best) {
                // Get proper display name from ArchetypeService using the archetypeId
                archetype = ArchetypeService.getArchetypeName(best.archetypeId, position);
                // Use the OVR from findBestArchetype since it found the correct archetype
                ovr = best.ovr;
              } else {
                archetype = `ID:${storedArchetype}(MISMATCH)`;
              }
            }
          } else {
            // No stored archetype - DO NOT recalculate, keep stored POVR
            // Recalculating with findBestArchetype can give inconsistent results
            // because our formula may not match Madden's exactly
            ovr = player.POVR || 50;
            archetype = 'KEPT_STORED';
          }

          // Debug logging for first 3 players OR players with significant OVR change OR missing PLTY
          const ovrChange = Math.abs(ovr - (player.POVR || 0));
          const playerName = `${player.PFNA || player.firstName || ''} ${player.PLNA || player.lastName || ''}`.trim();
          const isWatson = playerName.toLowerCase().includes('watson');

          if (i < 3 || ovrChange > 5 || !hasStoredArchetype || isWatson) {
            console.log(`[RatingHandlers] Player ${i}: ${playerName}`);
            console.log(`  Position: ${position}, Stored POVR: ${player.POVR}`);
            console.log(`  PLTY value: ${player.PLTY} (type: ${typeof player.PLTY}), hasStoredArchetype: ${hasStoredArchetype}`);
            console.log(`  PCBT (body type - NOT archetype): ${player.PCBT}`);
            console.log(`  Archetype formula used: ${archetype}`);
            console.log(`  Calculated OVR: ${ovr}, Change from stored: ${ovrChange > 0 ? (ovr > player.POVR ? '+' : '-') + ovrChange : 0}`);
          }

          results.push({
            index: i,
            ovr: ovr,
            archetype: archetype
          });
        }

        console.log(`[RatingHandlers] Batch recalculation complete, sample: first player OVR=${results[0]?.ovr}`);
        return results;
      } catch (error: any) {
        console.error('[RatingHandlers] Error batch recalculating OVR:', error);
        return [];
      }
    }
  );

  /**
   * Find best archetype and recalculate OVR for a player
   * This mimics exactly what the game does - try all archetypes and pick the best
   * @param attributes - Player attributes
   * @param position - Player position
   * @returns {ovr, archetype, archetypeId}
   */
  ipcMain.handle(
    'rating:find-best-ovr',
    async (_event, attributes: any, position: string): Promise<{ ovr: number; archetype: string; archetypeId: number } | null> => {
      try {
        console.log(`[RatingHandlers] Finding best OVR/archetype for ${position}`);
        return ovrWeightsCalculator.findBestArchetype(attributes, position);
      } catch (error: any) {
        console.error('[RatingHandlers] Error finding best OVR:', error);
        return null;
      }
    }
  );

  console.log('[RatingHandlers] Rating handlers registered successfully');
}
