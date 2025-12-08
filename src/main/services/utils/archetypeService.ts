/**
 * Archetype Service
 *
 * Manages player archetypes with GLOBAL ID mapping (IDs 0-67).
 *
 * IMPORTANT: Archetype IDs are GLOBAL across all positions in M26,
 * NOT position-specific. Each archetype has a unique ID from 0-67.
 * Example: ID 0 = "QB Field General", ID 32 = "OT Power", ID 59 = "S Hybrid"
 */

export interface ArchetypeOption {
  id: number;
  name: string;
}

export class ArchetypeService {
  // Global archetype mapping (ID 0-67)
  // Source: MaddenRosterEditor config.json
  private static globalArchetypeMap: Map<number, string> = new Map([
    // QB Archetypes (0-4)
    [0, 'QB Field General'],
    [1, 'QB Strong Arm'],
    [2, 'QB Improviser'],
    [3, 'QB Scrambler'],
    [4, 'QB Pure Scrambler'],

    // HB Archetypes (5-11)
    [5, 'HB Power Back'],
    [6, 'HB Elusive Back'],
    [7, 'HB Receiving Back'],
    [8, 'HB Power Blocking'],
    [9, 'HB Power Receiving'],
    [10, 'HB Elusive Power'],
    [11, 'HB Elusive Receiving'],

    // FB Archetypes (12-13)
    [12, 'FB Blocking'],
    [13, 'FB Utility'],

    // WR Archetypes (14-21)
    [14, 'WR Deep Threat'],
    [15, 'WR Playmaker'],
    [16, 'WR Physical Route Runner'],
    [17, 'WR Shifty Route Runner'],
    [18, 'WR Physical Blocker'],
    [19, 'WR Gadget Receiver'],
    [20, 'WR Physical'],
    [21, 'WR Slot'],

    // TE Archetypes (22-26)
    [22, 'TE Blocking'],
    [23, 'TE Vertical Threat'],
    [24, 'TE Physical Route Runner'],
    [25, 'TE Possession Blocking'],
    [26, 'TE Possession'],

    // C Archetypes (27-30)
    [27, 'C Pass Protector'],
    [28, 'C Power'],
    [29, 'C Well-Rounded'],
    [30, 'C Agile'],

    // OT Archetypes (31-34)
    [31, 'OT Pass Protector'],
    [32, 'OT Power'],
    [33, 'OT Well-Rounded'],
    [34, 'OT Agile'],

    // G Archetypes (35-38)
    [35, 'G Pass Protector'],
    [36, 'G Well-Rounded'],
    [37, 'G Power'],
    [38, 'G Agile'],

    // DE Archetypes (39-42)
    [39, 'DE Smaller Speed Rusher'],
    [40, 'DE Power Rusher'],
    [41, 'DE Pure Power'],
    [42, 'DE Run Stopper'],

    // DT Archetypes (43-46)
    [43, 'DT Nose Tackle'],
    [44, 'DT Pure Power'],
    [45, 'DT Speed Rusher'],
    [46, 'DT Power Rusher'],

    // OLB Archetypes (47-50)
    [47, 'OLB Speed Rusher'],
    [48, 'OLB Power Rusher'],
    [49, 'OLB Pass Coverage'],
    [50, 'OLB Run Stopper'],

    // MLB Archetypes (51-53)
    [51, 'MLB Field General'],
    [52, 'MLB Pass Coverage'],
    [53, 'MLB Run Stopper'],

    // CB Archetypes (54-57)
    [54, 'CB Man-to-Man'],
    [55, 'CB Slot'],
    [56, 'CB Zone'],
    [57, 'CB Hybrid Corner'],

    // S Archetypes (58-60)
    [58, 'S Zone'],
    [59, 'S Hybrid'],
    [60, 'S Run Support'],

    // Special Teams Archetypes (61-66)
    [61, 'KP Accurate'],
    [62, 'KP Power'],
    [63, 'KR Balanced'],
    [64, 'PR Balanced'],
    [65, 'LS Power'],
    [66, 'LS Accurate'],

    // Gadget (67)
    [67, 'GAD Gadget']
  ]);

  // Reverse mapping (name -> ID)
  private static nameToIdMap: Map<string, number> = new Map(
    Array.from(this.globalArchetypeMap.entries()).map(([id, name]) => [name, id])
  );

  // Simplified Madden 26 archetype name mappings
  // Maps simplified names (used in CSV files) to their corresponding detailed names
  private static simplifiedNameMap: Map<string, string[]> = new Map([
    ['Field General', ['QB Field General', 'MLB Field General']],
    ['Strong Arm', ['QB Strong Arm']],
    ['Improviser', ['QB Improviser']],
    ['Scrambler', ['QB Scrambler', 'QB Pure Scrambler']],
    ['Power Back', ['HB Power Back', 'HB Power Blocking', 'HB Power Receiving']],
    ['Elusive Back', ['HB Elusive Back', 'HB Elusive Power', 'HB Elusive Receiving']],
    ['Receiving', ['HB Receiving Back', 'FB Utility', 'TE Receiving']],
    ['Blocking', ['FB Blocking', 'TE Blocking', 'TE Possession Blocking']],
    ['Deep Threat', ['WR Deep Threat', 'WR Physical']],
    ['Playmaker', ['WR Playmaker', 'WR Slot']],
    ['Physical', ['WR Physical Route Runner', 'WR Physical Blocker']],
    ['Slot', ['WR Shifty Route Runner', 'WR Gadget Receiver', 'CB Slot']],
    ['Vertical Threat', ['TE Vertical Threat']],
    ['Possession', ['TE Physical Route Runner', 'TE Possession']],
    ['Pass Protector', ['C Pass Protector', 'OT Pass Protector', 'G Pass Protector']],
    ['Power', ['C Power', 'OT Power', 'G Power', 'KP Power', 'LS Power']],
    ['Agile', ['C Well-Rounded', 'C Agile', 'OT Well-Rounded', 'OT Agile', 'G Well-Rounded', 'G Agile']],
    ['Speed Rusher', ['DE Smaller Speed Rusher', 'DT Speed Rusher', 'OLB Speed Rusher']],
    ['Power Rusher', ['DE Power Rusher', 'DT Pure Power', 'DT Power Rusher', 'OLB Power Rusher']],
    ['Run Stopper', ['DE Run Stopper', 'OLB Run Stopper', 'MLB Run Stopper']],
    ['Nose', ['DT Nose Tackle']],
    ['Pass Coverage', ['OLB Pass Coverage', 'MLB Pass Coverage']],
    ['Man To Man', ['CB Man-to-Man', 'CB Hybrid Corner']],
    ['Zone', ['CB Zone', 'S Zone']],
    ['Hybrid', ['S Hybrid']],
    ['Run Support', ['S Run Support']],
    ['Accurate', ['KP Accurate', 'LS Accurate']],
  ]);

  // Position-specific archetype lists (for dropdowns)
  // Includes both old position names (MLB, LOLB, etc.) and M26 names (MIKE, SAM, LEDG, etc.)
  private static archetypesByPosition: Map<string, number[]> = new Map([
    ['QB', [0, 1, 2, 3, 4]],
    ['HB', [5, 6, 7, 8, 9, 10, 11]],
    ['FB', [12, 13]],
    ['WR', [14, 15, 16, 17, 18, 19, 20, 21]],
    ['TE', [22, 23, 24, 25, 26]],
    ['C', [27, 28, 29, 30]],
    ['LT', [31, 32, 33, 34]],
    ['LG', [35, 36, 37, 38]],
    ['RG', [35, 36, 37, 38]],
    ['RT', [31, 32, 33, 34]],
    // Old DE names
    ['LE', [39, 40, 41, 42]],
    ['RE', [39, 40, 41, 42]],
    // M26 Edge Rusher names
    ['LEDG', [39, 40, 41, 42]],
    ['REDG', [39, 40, 41, 42]],
    ['DT', [43, 44, 45, 46]],
    // Old LB names
    ['LOLB', [47, 48, 49, 50]],
    ['MLB', [51, 52, 53]],
    ['ROLB', [47, 48, 49, 50]],
    // M26 LB names
    ['SAM', [47, 48, 49, 50]],
    ['MIKE', [51, 52, 53]],
    ['Mike', [51, 52, 53]],  // Handle case variation
    ['WILL', [47, 48, 49, 50]],
    ['CB', [54, 55, 56, 57]],
    ['FS', [58, 59, 60]],
    ['SS', [58, 59, 60]],
    ['K', [61, 62]],
    ['P', [61, 62]],
    ['KR', [63]],
    ['PR', [64]],
    ['LS', [65, 66]],
  ]);

  /**
   * Get archetype name by GLOBAL ID
   * @param id - Global archetype ID (0-67)
   * @param position - Player position (kept for backward compatibility but not used)
   * @returns Archetype name or null if not found
   */
  static getArchetypeName(id: number, position?: string): string {
    return this.globalArchetypeMap.get(id) || `Unknown Archetype (ID ${id})`;
  }

  /**
   * Get archetype ID by name
   * @param name - Archetype name (simplified or full)
   * @param position - Player position (required for simplified names)
   * @returns Global archetype ID or 0 if not found
   */
  static getArchetypeId(name: string, position?: string): number {
    // Try direct lookup first (for full names)
    const directId = this.nameToIdMap.get(name);
    if (directId !== undefined) {
      return directId;
    }

    // Try simplified name lookup
    const possibleNames = this.simplifiedNameMap.get(name);
    if (!possibleNames || !position) {
      return 0;
    }

    // Find the archetype that matches both the simplified name AND the position
    for (const fullName of possibleNames) {
      const id = this.nameToIdMap.get(fullName);
      if (id !== undefined && this.isValidArchetypeIdForPosition(id, position)) {
        return id;
      }
    }

    // Fallback: return first match even if position doesn't match perfectly
    const firstMatch = this.nameToIdMap.get(possibleNames[0]);
    return firstMatch ?? 0;
  }

  /**
   * Get archetype options for a specific position
   * @param position - Player position
   * @returns Array of valid archetypes for that position
   */
  static getArchetypesForPosition(position: string): ArchetypeOption[] {
    const archetypeIds = this.archetypesByPosition.get(position) || [];

    return archetypeIds.map(id => ({
      id,
      name: this.globalArchetypeMap.get(id) || `Unknown (ID ${id})`
    }));
  }

  /**
   * Get archetype by ID
   */
  static getArchetypeById(id: number): ArchetypeOption | undefined {
    const name = this.globalArchetypeMap.get(id);
    if (!name) return undefined;

    return { id, name };
  }

  /**
   * Check if an archetype ID is valid
   */
  static isValidArchetypeId(id: number): boolean {
    return this.globalArchetypeMap.has(id);
  }

  /**
   * Check if an archetype ID is valid for a specific position
   */
  static isValidArchetypeIdForPosition(id: number, position: string): boolean {
    const validIds = this.archetypesByPosition.get(position) || [];
    return validIds.includes(id);
  }

  /**
   * Get default archetype ID for a position
   */
  static getDefaultArchetypeForPosition(position: string): number {
    const validIds = this.archetypesByPosition.get(position) || [];
    return validIds[0] ?? 0;
  }
}

// Export singleton instance for convenience
export const archetypeService = ArchetypeService;
