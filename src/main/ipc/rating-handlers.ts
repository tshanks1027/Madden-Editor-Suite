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

  console.log('[RatingHandlers] Rating handlers registered successfully');
}
