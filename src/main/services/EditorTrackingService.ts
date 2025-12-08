/**
 * EditorTrackingService
 *
 * Tracks players added to roster/draft editors to prevent duplicates.
 * Uses firstName|lastName|position as the deduplication key.
 * Keeps track of the best version (highest POVR) for multi-year players.
 */

export interface TrackedPlayer {
  key: string;                    // "firstName|lastName|position"
  firstName: string;
  lastName: string;
  position: string;
  internalId: number;
  year: number;
  addedTo: 'roster' | 'draft';
  povr: number;
  addedAt: number;                // Timestamp
}

export interface TrackPlayerInput {
  firstName: string;
  lastName: string;
  position: string;
  internalId: number;
  year: number;
  povr: number;
}

class EditorTrackingService {
  private rosterPlayers: Map<string, TrackedPlayer> = new Map();
  private draftPlayers: Map<string, TrackedPlayer> = new Map();

  /**
   * Generate deduplication key from player info
   */
  private generateKey(firstName: string, lastName: string, position: string): string {
    // Normalize: lowercase, trim
    const fn = (firstName || '').toLowerCase().trim();
    const ln = (lastName || '').toLowerCase().trim();
    const pos = (position || '').toUpperCase().trim();
    return `${fn}|${ln}|${pos}`;
  }

  /**
   * Get the appropriate map for the target
   */
  private getMap(target: 'roster' | 'draft'): Map<string, TrackedPlayer> {
    return target === 'roster' ? this.rosterPlayers : this.draftPlayers;
  }

  /**
   * Track a player that has been added to roster or draft
   */
  trackPlayer(player: TrackPlayerInput, target: 'roster' | 'draft'): TrackedPlayer {
    const key = this.generateKey(player.firstName, player.lastName, player.position);
    const map = this.getMap(target);

    const tracked: TrackedPlayer = {
      key,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      internalId: player.internalId,
      year: player.year,
      addedTo: target,
      povr: player.povr || 0,
      addedAt: Date.now()
    };

    // Check if already exists - keep higher POVR
    const existing = map.get(key);
    if (existing && existing.povr >= tracked.povr) {
      console.log(`[EditorTrackingService] Player ${player.firstName} ${player.lastName} already tracked with higher POVR (${existing.povr} vs ${tracked.povr})`);
      return existing;
    }

    map.set(key, tracked);
    console.log(`[EditorTrackingService] Tracked player: ${player.firstName} ${player.lastName} (${player.position}) to ${target}, POVR: ${player.povr}`);
    return tracked;
  }

  /**
   * Check if a player is already tracked
   */
  isTracked(firstName: string, lastName: string, position: string, target: 'roster' | 'draft'): boolean {
    const key = this.generateKey(firstName, lastName, position);
    return this.getMap(target).has(key);
  }

  /**
   * Get a tracked player by name and position
   */
  getTrackedPlayer(firstName: string, lastName: string, position: string, target: 'roster' | 'draft'): TrackedPlayer | null {
    const key = this.generateKey(firstName, lastName, position);
    return this.getMap(target).get(key) || null;
  }

  /**
   * Get all tracked players for a target
   */
  getTracked(target: 'roster' | 'draft'): TrackedPlayer[] {
    return Array.from(this.getMap(target).values());
  }

  /**
   * Get all tracked player keys (for exclusion in queries)
   */
  getTrackedKeys(target: 'roster' | 'draft'): string[] {
    return Array.from(this.getMap(target).keys());
  }

  /**
   * Get count of tracked players
   */
  getTrackedCount(target: 'roster' | 'draft'): number {
    return this.getMap(target).size;
  }

  /**
   * Clear all tracking for a target (call when loading new file)
   */
  clearTracking(target: 'roster' | 'draft'): void {
    this.getMap(target).clear();
    console.log(`[EditorTrackingService] Cleared tracking for ${target}`);
  }

  /**
   * Clear all tracking (both roster and draft)
   */
  clearAll(): void {
    this.rosterPlayers.clear();
    this.draftPlayers.clear();
    console.log('[EditorTrackingService] Cleared all tracking');
  }

  /**
   * Remove a specific player from tracking
   */
  removeTracked(firstName: string, lastName: string, position: string, target: 'roster' | 'draft'): boolean {
    const key = this.generateKey(firstName, lastName, position);
    const map = this.getMap(target);
    if (map.has(key)) {
      map.delete(key);
      console.log(`[EditorTrackingService] Removed tracking for ${firstName} ${lastName} (${position}) from ${target}`);
      return true;
    }
    return false;
  }

  /**
   * Get the best version of a player across all tracked years
   * Useful when deciding which version to keep
   */
  getBestVersion(firstName: string, lastName: string, position: string, target: 'roster' | 'draft'): TrackedPlayer | null {
    const key = this.generateKey(firstName, lastName, position);
    return this.getMap(target).get(key) || null;
  }

  /**
   * Get position counts for tracked players
   * Returns: { QB: 2, HB: 3, WR: 4, ... }
   */
  getPositionCounts(target: 'roster' | 'draft'): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const player of this.getMap(target).values()) {
      const pos = player.position.toUpperCase();
      counts[pos] = (counts[pos] || 0) + 1;
    }
    return counts;
  }

  /**
   * Import existing players from roster/draft grid into tracking
   * Call this when a file is loaded to track existing players
   */
  importExisting(players: Array<{ firstName: string; lastName: string; position: string; povr?: number }>, target: 'roster' | 'draft'): number {
    let imported = 0;
    for (const player of players) {
      if (player.firstName && player.lastName && player.position) {
        this.trackPlayer({
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          internalId: 0, // Unknown for imported
          year: 0,       // Unknown for imported
          povr: player.povr || 0
        }, target);
        imported++;
      }
    }
    console.log(`[EditorTrackingService] Imported ${imported} existing players to ${target} tracking`);
    return imported;
  }
}

// Export singleton instance
export const editorTrackingService = new EditorTrackingService();
