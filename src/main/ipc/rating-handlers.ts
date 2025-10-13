/**
 * Rating Calculation IPC Handlers
 *
 * Handles requests for dynamic overall rating calculations
 */

import { ipcMain } from 'electron';
import { ratingCalculator, MaddenRatings } from '../services/RatingCalculator';

/**
 * Register all rating calculation IPC handlers
 */
export function registerRatingHandlers(): void {
  /**
   * Calculate overall rating from current player ratings
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

  console.log('[RatingHandlers] Rating handlers registered successfully');
}
