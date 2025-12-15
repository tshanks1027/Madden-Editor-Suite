/**
 * IPC Handlers for PGHE (Generic Face) Lookup Service
 */

import { ipcMain } from 'electron';
import { pgheLookupService } from '../services/PGHELookupService';

export function registerPGHEHandlers(): void {
  /**
   * Initialize the PGHE lookup service
   */
  ipcMain.handle('pghe:initialize', async () => {
    await pgheLookupService.initialize();
    return { success: true };
  });

  /**
   * Get a random generic face for a given race
   * Returns: { pghe, pfcg, gpan, psxp (PID), skinTone, genr }
   */
  ipcMain.handle('pghe:getRandomByRace', async (_event, race: number) => {
    await pgheLookupService.initialize();
    const skinTone = pgheLookupService.raceToSkinTone(race);
    const entry = pgheLookupService.getRandomBySkinTone(skinTone);
    return entry;
  });

  /**
   * Get all generic faces for a given skin tone
   */
  ipcMain.handle('pghe:getAllBySkinTone', async (_event, skinTone: number) => {
    await pgheLookupService.initialize();
    return pgheLookupService.getAllBySkinTone(skinTone);
  });

  /**
   * Get generic face by PGHE index (face picker number)
   */
  ipcMain.handle('pghe:getByPGHE', async (_event, pghe: number) => {
    await pgheLookupService.initialize();
    return pgheLookupService.getByPGHE(pghe);
  });

  /**
   * Get generic face by PID
   */
  ipcMain.handle('pghe:getByPID', async (_event, pid: number) => {
    await pgheLookupService.initialize();
    return pgheLookupService.getByPID(pid);
  });

  /**
   * Check if a PID is a generic face PID
   */
  ipcMain.handle('pghe:isGenericPID', async (_event, pid: number) => {
    await pgheLookupService.initialize();
    return pgheLookupService.isGenericFacePID(pid);
  });

  /**
   * Get all generic faces
   */
  ipcMain.handle('pghe:getAll', async () => {
    await pgheLookupService.initialize();
    return pgheLookupService.getAll();
  });

  /**
   * Map race to skin tone
   */
  ipcMain.handle('pghe:raceToSkinTone', async (_event, race: number) => {
    return pgheLookupService.raceToSkinTone(race);
  });

  console.log('[PGHE Handlers] Registered');
}
