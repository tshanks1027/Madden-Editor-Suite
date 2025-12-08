/**
 * Editor Tracking IPC Handlers
 *
 * IPC handlers for the EditorTrackingService.
 * Enables renderer to track players added to roster/draft and check for duplicates.
 */

import { ipcMain } from 'electron';
import { editorTrackingService, TrackPlayerInput } from '../services/EditorTrackingService';

/**
 * Handle: editor-tracking:track-player
 * Track a player that has been added to roster or draft
 */
ipcMain.handle('editor-tracking:track-player', async (
  event,
  player: TrackPlayerInput,
  target: 'roster' | 'draft'
) => {
  try {
    const tracked = editorTrackingService.trackPlayer(player, target);
    return { success: true, data: tracked };
  } catch (error) {
    console.error('[editor-tracking] Error tracking player:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: editor-tracking:is-tracked
 * Check if a player is already tracked
 */
ipcMain.handle('editor-tracking:is-tracked', async (
  event,
  firstName: string,
  lastName: string,
  position: string,
  target: 'roster' | 'draft'
) => {
  try {
    const isTracked = editorTrackingService.isTracked(firstName, lastName, position, target);
    const player = isTracked ? editorTrackingService.getTrackedPlayer(firstName, lastName, position, target) : null;
    return { success: true, isTracked, player };
  } catch (error) {
    console.error('[editor-tracking] Error checking if tracked:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: editor-tracking:get-tracked
 * Get all tracked players for a target
 */
ipcMain.handle('editor-tracking:get-tracked', async (event, target: 'roster' | 'draft') => {
  try {
    const players = editorTrackingService.getTracked(target);
    return { success: true, players };
  } catch (error) {
    console.error('[editor-tracking] Error getting tracked players:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: editor-tracking:get-tracked-keys
 * Get all tracked player keys (for exclusion in queries)
 */
ipcMain.handle('editor-tracking:get-tracked-keys', async (event, target: 'roster' | 'draft') => {
  try {
    const keys = editorTrackingService.getTrackedKeys(target);
    return { success: true, keys };
  } catch (error) {
    console.error('[editor-tracking] Error getting tracked keys:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: editor-tracking:get-count
 * Get count of tracked players
 */
ipcMain.handle('editor-tracking:get-count', async (event, target: 'roster' | 'draft') => {
  try {
    const count = editorTrackingService.getTrackedCount(target);
    return { success: true, count };
  } catch (error) {
    console.error('[editor-tracking] Error getting count:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: editor-tracking:clear
 * Clear all tracking for a target
 */
ipcMain.handle('editor-tracking:clear', async (event, target: 'roster' | 'draft') => {
  try {
    editorTrackingService.clearTracking(target);
    return { success: true };
  } catch (error) {
    console.error('[editor-tracking] Error clearing tracking:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: editor-tracking:clear-all
 * Clear all tracking (both roster and draft)
 */
ipcMain.handle('editor-tracking:clear-all', async () => {
  try {
    editorTrackingService.clearAll();
    return { success: true };
  } catch (error) {
    console.error('[editor-tracking] Error clearing all tracking:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: editor-tracking:remove
 * Remove a specific player from tracking
 */
ipcMain.handle('editor-tracking:remove', async (
  event,
  firstName: string,
  lastName: string,
  position: string,
  target: 'roster' | 'draft'
) => {
  try {
    const removed = editorTrackingService.removeTracked(firstName, lastName, position, target);
    return { success: true, removed };
  } catch (error) {
    console.error('[editor-tracking] Error removing tracked player:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: editor-tracking:get-position-counts
 * Get position counts for tracked players
 */
ipcMain.handle('editor-tracking:get-position-counts', async (event, target: 'roster' | 'draft') => {
  try {
    const counts = editorTrackingService.getPositionCounts(target);
    return { success: true, counts };
  } catch (error) {
    console.error('[editor-tracking] Error getting position counts:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: editor-tracking:import-existing
 * Import existing players from loaded roster/draft into tracking
 */
ipcMain.handle('editor-tracking:import-existing', async (
  event,
  players: Array<{ firstName: string; lastName: string; position: string; povr?: number }>,
  target: 'roster' | 'draft'
) => {
  try {
    const count = editorTrackingService.importExisting(players, target);
    return { success: true, imported: count };
  } catch (error) {
    console.error('[editor-tracking] Error importing existing:', error);
    return { success: false, error: String(error) };
  }
});

console.log('[editor-tracking-handlers] Registered all editor tracking IPC handlers');
