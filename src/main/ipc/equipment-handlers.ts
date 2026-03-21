/**
 * Equipment Assignment IPC Handlers
 *
 * Handles IPC requests for era-appropriate equipment assignment.
 */

import { ipcMain } from 'electron';
import { equipmentAssignmentService } from '../services/EquipmentAssignmentService';

/**
 * Register equipment-related IPC handlers
 */
export function registerEquipmentHandlers(): void {
  console.log('[EquipmentHandlers] Registering handlers...');

  /**
   * Get era equipment assignment for a single player
   */
  ipcMain.handle('equipment:get-era-equipment', async (_event, year: number, position: string) => {
    try {
      const equipment = await equipmentAssignmentService.getEraEquipment(year, position);
      return { success: true, equipment };
    } catch (error) {
      console.error('[EquipmentHandlers] Error getting era equipment:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Get era options for preview UI
   */
  ipcMain.handle('equipment:get-era-options', async (_event, year: number) => {
    try {
      const options = await equipmentAssignmentService.getEraOptions(year);
      return { success: true, ...options };
    } catch (error) {
      console.error('[EquipmentHandlers] Error getting era options:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Get era bracket for a year
   */
  ipcMain.handle('equipment:get-era-bracket', async (_event, year: number) => {
    try {
      const era = equipmentAssignmentService.getEraBracket(year);
      return { success: true, era };
    } catch (error) {
      console.error('[EquipmentHandlers] Error getting era bracket:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  console.log('[EquipmentHandlers] Handlers registered');
}
