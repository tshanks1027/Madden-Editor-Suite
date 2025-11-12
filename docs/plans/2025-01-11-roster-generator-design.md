# Roster Generator Design

**Date:** 2025-01-11
**Status:** Design Complete - Ready for Implementation
**Author:** Design validated with user through brainstorming process

## Overview

The Roster Generator is a new feature that creates complete Madden rosters using real historical player data from `ROSTER_lookup.csv` (101,486 player records spanning 1970-2024). Unlike the Draft Class Generator, which generates prospects, the Roster Generator creates playable rosters for specific years or combines the best players from multiple years into all-time/decade rosters.

## Key Requirements

### Data Sources
- **Template:** `data/Templates/ROSTER-Official` (M26 binary format)
- **Player Data:** `data/lookups/ROSTER_lookup.csv` (101,486 records with Year column)
- **Generic Faces:** `data/lookups/PID_Portrait_Mapping.csv` (reused from draft class generator)
- **Archetypes:** `data/lookups/archetype_lookup.csv` (numeric 0-67 mapping)

### Generation Modes

1. **Single Year Mode**
   - Generate complete roster for one year (e.g., 1985)
   - Include all players from that season
   - Backfill with free agents from previous 5 years
   - Final roster size: Match template size (54-57 players typical)

2. **All-Time Mode**
   - Select BEST players from year range (e.g., 2000-2009)
   - Combine into ONE roster (not multiple files)
   - Apply position limits for realistic composition
   - Deduplicate by PID (keep highest POVR version)
   - Use "didn't make cut" players as free agents

3. **All-Decade Mode** (Future)
   - Similar to All-Time but decade-specific (1980s, 1990s, etc.)

### Rating Mode
- **Only one mode:** Use real Madden ratings from CSV
- **Missing/Zero Ratings:** Apply 30-50 range with variance
- No random/variance/historical modes like draft class generator

### Critical Error Prevention

Based on issues encountered in draft class generator, the following must be enforced:

1. **Archetype Type Safety**
   - Archetype MUST be stored as NUMERIC (0-67), never string
   - Display as text in UI via archetype_lookup.csv mapping
   - Save as numeric value to M26 file
   - Validate range before saving

2. **Template Loading/Buffer Integrity**
   - Always load ROSTER-Official template file
   - Ensure `_originalBuffer` (Buffer) is attached to roster data
   - Ensure `_version: 'M26'` is set
   - Never create roster without loading template first

3. **Generic Face Assignment**
   - Reuse PID_Portrait_Mapping.csv logic from draft class generator
   - Assign valid generic PID/PAM if player has missing portrait data
   - Validate PID/PAM values before saving

## Architecture

### New Components

```
RosterGeneratorService (src/main/services/RosterGeneratorService.ts)
├── initialize() - Load and cache ROSTER_lookup.csv by year
├── generateSingleYear() - Generate roster for one year
├── generateAllTime() - Generate all-time roster from year range
├── selectBestByPosition() - Apply position limits and select best players
├── addFreeAgents() - Backfill with historical free agents
├── enrichPlayer() - Fill missing data, assign generic faces, validate archetype
├── fillMissingRatings() - Apply 30-50 range with variance
├── assignGenericPID() - Lookup generic PID from PID_Portrait_Mapping.csv
├── assignGenericPAM() - Lookup generic PAM from PID_Portrait_Mapping.csv
├── parseArchetype() - Convert archetype to numeric 0-67
└── getTemplateRosterSize() - Determine target roster size from template

roster-generator-handlers.ts (src/main/ipc/roster-generator-handlers.ts)
├── roster-generator:generate - Generate roster with specified options
├── roster-generator:validate-year - Check if year has data
└── roster-generator:get-stats - Return roster composition stats

roster-wizard.js (src/renderer/js/roster-wizard.js)
├── Wizard Step 1: Mode Selection
├── Wizard Step 2: Year Selection
├── Wizard Step 3: Preview & Generate
└── Wizard Step 4: Actions (Load into Editor / Save to File)
```

### Integration Points

- **Parallel to CreatorService:** RosterGeneratorService is a new standalone service, not extending CreatorService
- **Wizard Pattern:** Follows same UI pattern as draft-wizard.js for consistency
- **IPC Layer:** New handlers in roster-generator-handlers.ts, registered in main.ts
- **Preload API:** New `rosterGenerator` namespace in preload.ts

## Roster Composition Rules

### Position Limits

Players are selected by POVR (overall rating) within position-specific limits:

```typescript
const positionLimits = {
  // Offense
  QB: 3,
  RB: 4,
  FB: 1,
  WR: 5,
  TE: 3,

  // Offensive Line
  LT: 2,
  LG: 2,
  C: 2,
  RG: 2,
  RT: 2,

  // Defensive Line
  LEDG: 2,  // Left Edge (not LE)
  REDG: 3,  // Right Edge (not RE)
  DT: 3,

  // Linebackers
  Will: 2,  // Weakside (not LOLB)
  MLB: 3,
  Sam: 2,   // Strongside (not ROLB)

  // Secondary
  CB: 5,
  FS: 2,
  SS: 2,

  // Special Teams
  K: 1,
  P: 1
};
```

### Additional Players

After applying position limits:

1. **Add 1 KR Specialist:** Select by KR rating (highest KR value)
2. **Add 3-4 Best Remaining:** Select by POVR regardless of position
3. **Final Roster Size:** 54-57 players

### Free Agent Logic

#### Single Year Mode
```typescript
async addFreeAgents(year: number, currentRoster: Player[]): Promise<Player[]> {
  const currentPIDs = new Set(currentRoster.map(p => p.PID));
  const freeAgents = [];

  // Look back 5 years for FA candidates
  for (let y = year - 5; y < year; y++) {
    const yearPlayers = this.rosterData.get(y) || [];
    const candidates = yearPlayers.filter(p =>
      !currentPIDs.has(p.PID) &&  // Not already on roster
      p.Age < 40 &&                // Reasonable age
      p.POVR >= 65                 // Minimum quality threshold
    );
    freeAgents.push(...candidates);
  }

  const targetSize = await this.getTemplateRosterSize();
  const needed = targetSize - currentRoster.length;

  const bestFAs = freeAgents
    .sort((a, b) => b.POVR - a.POVR)
    .slice(0, needed);

  return [...currentRoster, ...bestFAs];
}
```

#### All-Time/Decade Mode
- Use players who didn't make position cuts as free agent pool
- Sort by POVR and fill to template size
- Already deduplicated by PID in selectBestByPosition()

### Deduplication Strategy

For all-time/decade rosters, prevent the same player appearing multiple times:

```typescript
selectBestByPosition(players: Player[]): Player[] {
  // Step 1: Deduplicate by PID
  const uniquePlayers = new Map<number, Player>();

  players.forEach(p => {
    const existing = uniquePlayers.get(p.PID);
    // Keep highest POVR version if duplicate PID found
    if (!existing || p.POVR > existing.POVR) {
      uniquePlayers.set(p.PID, p);
    }
  });

  // Step 2: Apply position limits
  const roster = [];
  const deduped = Array.from(uniquePlayers.values());

  Object.entries(positionLimits).forEach(([pos, limit]) => {
    const posPlayers = deduped
      .filter(p => p.Position === pos)
      .sort((a, b) => b.POVR - a.POVR)
      .slice(0, limit);
    roster.push(...posPlayers);
  });

  return roster;
}
```

**Example:** If Tom Brady appears in years 2000, 2001, 2002, ..., 2009 with varying POVRs, only the version with the highest POVR is included in the 2000s all-decade roster.

## Data Enrichment

### Player Enrichment Pipeline

```typescript
private enrichPlayer(csvPlayer: any): Player {
  return {
    ...csvPlayer,

    // 1. Fill missing ratings with 30-50 range + variance
    ratings: this.fillMissingRatings(csvPlayer),

    // 2. Assign generic PID if missing
    PID: csvPlayer.PID || this.assignGenericPID(csvPlayer.Position),

    // 3. Assign generic PAM if missing
    PAM: csvPlayer.PAM || this.assignGenericPAM(csvPlayer.Position),

    // 4. PEPS matches PAM
    PEPS: csvPlayer.PAM || this.assignGenericPAM(csvPlayer.Position),

    // 5. Parse archetype to NUMERIC (0-67), validate range
    archetype: this.parseArchetype(csvPlayer.Archetype),

    // 6. Skin tone: Default 1, fallback to 2
    skinTone: csvPlayer.skinTone || 1,

    // 7. Determine body type based on position/weight
    bodyType: this.determineBodyType(csvPlayer)
  };
}
```

### Rating Fill Logic

For missing or zero ratings:

```typescript
private fillMissingRatings(player: any): any {
  const ratings = { ...player };
  const ratingFields = [
    'Speed', 'Acceleration', 'Strength', 'Agility',
    'Jumping', 'Stamina', 'Awareness', 'Catching',
    // ... all ~70 rating fields
  ];

  ratingFields.forEach(field => {
    if (!ratings[field] || ratings[field] === 0) {
      // Apply 30-50 range with variance
      const base = 30;
      const range = 20;
      const variance = Math.random() * range;
      ratings[field] = Math.round(base + variance);
    }
  });

  return ratings;
}
```

### Archetype Parsing

Critical for avoiding type errors:

```typescript
private parseArchetype(archetypeValue: any, position: string): number {
  // If already numeric, validate range
  if (typeof archetypeValue === 'number') {
    if (archetypeValue >= 0 && archetypeValue <= 67) {
      return archetypeValue;
    }
    console.warn(`Invalid archetype number: ${archetypeValue}, using default`);
    return this.getDefaultArchetype(position);
  }

  // If string, look up in archetype_lookup.csv
  if (typeof archetypeValue === 'string') {
    const archetypeId = lookupService.getArchetypeId(archetypeValue, position);
    if (archetypeId !== null) {
      return archetypeId;
    }
    console.warn(`Unknown archetype string: ${archetypeValue}, using default`);
    return this.getDefaultArchetype(position);
  }

  // Fallback
  return this.getDefaultArchetype(position);
}
```

### Skin Tone Logic

```typescript
private getSkinTone(player: any): number {
  // Default to 1, fallback to 2
  // Prepares for future where we have hardcoded skin tone data
  return player.skinTone || 1;
}
```

## Wizard UI Flow

### Step 1: Mode Selection

```
┌─────────────────────────────────────────┐
│      Roster Generator - Select Mode      │
├─────────────────────────────────────────┤
│                                         │
│  ○ Single Year                          │
│    Generate roster for one year         │
│                                         │
│  ○ All-Time                             │
│    Combine best players from year range │
│                                         │
│  ○ All-Decade (Future)                  │
│    Best players from specific decade    │
│                                         │
│              [Next →]                   │
└─────────────────────────────────────────┘
```

### Step 2: Year Selection

**Single Year Mode:**
```
┌─────────────────────────────────────────┐
│   Roster Generator - Select Year        │
├─────────────────────────────────────────┤
│                                         │
│  Year: [▼ 1985]                         │
│                                         │
│  Available years: 1970-2024             │
│                                         │
│              [Next →]                   │
└─────────────────────────────────────────┘
```

**All-Time Mode:**
```
┌─────────────────────────────────────────┐
│   Roster Generator - Select Year Range  │
├─────────────────────────────────────────┤
│                                         │
│  Start Year: [▼ 2000]                   │
│  End Year:   [▼ 2009]                   │
│                                         │
│  Range: 2000s (10 years)                │
│                                         │
│              [Next →]                   │
└─────────────────────────────────────────┘
```

### Step 3: Preview & Generate

```
┌─────────────────────────────────────────┐
│   Roster Generator - Preview            │
├─────────────────────────────────────────┤
│                                         │
│  Mode: Single Year (1985)               │
│  Expected Players: 54-57                │
│                                         │
│  Top 10 Players Preview:                │
│  ┌─────────────────────────────────────┐│
│  │ Name         Pos  POVR  Team      ││
│  │ Dan Marino   QB   96    MIA       ││
│  │ Walter Payton RB  95    CHI       ││
│  │ ...                               ││
│  └─────────────────────────────────────┘│
│                                         │
│         [← Back]  [Generate →]          │
└─────────────────────────────────────────┘
```

### Step 4: Actions

```
┌─────────────────────────────────────────┐
│   Roster Generator - Complete           │
├─────────────────────────────────────────┤
│                                         │
│  ✓ Roster Generated Successfully        │
│                                         │
│  Players: 56                            │
│  Year: 1985                             │
│                                         │
│  [Load into Editor]  [Save to File]     │
│                                         │
└─────────────────────────────────────────┘
```

## Service Implementation

### Core Methods

```typescript
export class RosterGeneratorService {
  private rosterData: Map<number, Player[]> = new Map();
  private templatePath: string;
  private templateData: any;

  /**
   * Load and cache ROSTER_lookup.csv by year
   */
  async initialize(): Promise<void> {
    const csvPath = path.join(app.getAppPath(), 'data/lookups/ROSTER_lookup.csv');
    const players = await this.parseCsv(csvPath);

    // Group by year for fast lookup
    players.forEach(player => {
      const year = Math.floor(player.Year);
      if (!this.rosterData.has(year)) {
        this.rosterData.set(year, []);
      }
      this.rosterData.get(year).push(player);
    });

    console.log(`Loaded ${players.length} players from ${this.rosterData.size} years`);

    // Load template
    this.templatePath = path.join(app.getAppPath(), 'data/Templates/ROSTER-Official');
    this.templateData = await draftClassService.loadDraftClass(this.templatePath);
  }

  /**
   * Generate roster for single year
   */
  async generateSingleYear(year: number): Promise<any> {
    const players = this.rosterData.get(year) || [];
    if (players.length === 0) {
      throw new Error(`No players found for year ${year}`);
    }

    // Enrich all players
    const enrichedPlayers = players.map(p => this.enrichPlayer(p));

    // Add free agents to reach template size
    const roster = await this.addFreeAgents(year, enrichedPlayers);

    return {
      players: roster,
      _originalBuffer: this.templateData.data._originalBuffer,
      _version: 'M26',
      metadata: {
        year: year,
        mode: 'single-year',
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Generate all-time roster from year range
   */
  async generateAllTime(startYear: number, endYear: number): Promise<any> {
    const allPlayers = [];

    // Collect all players from range
    for (let y = startYear; y <= endYear; y++) {
      const yearPlayers = this.rosterData.get(y) || [];
      allPlayers.push(...yearPlayers);
    }

    if (allPlayers.length === 0) {
      throw new Error(`No players found in year range ${startYear}-${endYear}`);
    }

    // Enrich all players
    const enrichedPlayers = allPlayers.map(p => this.enrichPlayer(p));

    // Select best by position with deduplication
    const selectedPlayers = this.selectBestByPosition(enrichedPlayers);

    // Add KR specialist
    const withKR = this.addKRSpecialist(selectedPlayers, enrichedPlayers);

    // Add 3-4 best remaining
    const roster = this.addBestRemaining(withKR, enrichedPlayers, 3, 4);

    return {
      players: roster,
      _originalBuffer: this.templateData.data._originalBuffer,
      _version: 'M26',
      metadata: {
        startYear: startYear,
        endYear: endYear,
        mode: 'all-time',
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Select best players by position with deduplication
   */
  private selectBestByPosition(players: Player[]): Player[] {
    // Deduplicate by PID first
    const uniquePlayers = new Map<number, Player>();
    players.forEach(p => {
      const existing = uniquePlayers.get(p.PID);
      if (!existing || p.POVR > existing.POVR) {
        uniquePlayers.set(p.PID, p);
      }
    });

    // Apply position limits
    const positionLimits = {
      QB: 3, RB: 4, FB: 1, WR: 5, TE: 3,
      LT: 2, LG: 2, C: 2, RG: 2, RT: 2,
      LEDG: 2, REDG: 3, DT: 3, Will: 2, MLB: 3, Sam: 2,
      CB: 5, FS: 2, SS: 2,
      K: 1, P: 1
    };

    const roster = [];
    const deduped = Array.from(uniquePlayers.values());

    Object.entries(positionLimits).forEach(([pos, limit]) => {
      const posPlayers = deduped
        .filter(p => p.Position === pos)
        .sort((a, b) => b.POVR - a.POVR)
        .slice(0, limit);
      roster.push(...posPlayers);
    });

    return roster;
  }

  /**
   * Add free agents to reach template size (single year mode)
   */
  private async addFreeAgents(year: number, currentRoster: Player[]): Promise<Player[]> {
    const currentPIDs = new Set(currentRoster.map(p => p.PID));
    const freeAgents = [];

    // Look back 5 years
    for (let y = year - 5; y < year; y++) {
      const yearPlayers = this.rosterData.get(y) || [];
      const candidates = yearPlayers
        .map(p => this.enrichPlayer(p))
        .filter(p =>
          !currentPIDs.has(p.PID) &&
          p.Age < 40 &&
          p.POVR >= 65
        );
      freeAgents.push(...candidates);
    }

    const targetSize = await this.getTemplateRosterSize();
    const needed = targetSize - currentRoster.length;

    if (needed <= 0) {
      return currentRoster.slice(0, targetSize);
    }

    const bestFAs = freeAgents
      .sort((a, b) => b.POVR - a.POVR)
      .slice(0, needed);

    return [...currentRoster, ...bestFAs];
  }

  /**
   * Add KR specialist (highest KR rating)
   */
  private addKRSpecialist(roster: Player[], allPlayers: Player[]): Player[] {
    const usedPIDs = new Set(roster.map(p => p.PID));

    const krSpecialist = allPlayers
      .filter(p => !usedPIDs.has(p.PID) && p.KR > 0)
      .sort((a, b) => b.KR - a.KR)[0];

    if (krSpecialist) {
      return [...roster, krSpecialist];
    }

    return roster;
  }

  /**
   * Add 3-4 best remaining players by POVR
   */
  private addBestRemaining(roster: Player[], allPlayers: Player[], min: number, max: number): Player[] {
    const usedPIDs = new Set(roster.map(p => p.PID));
    const targetSize = await this.getTemplateRosterSize();
    const remaining = targetSize - roster.length;
    const count = Math.min(remaining, Math.max(min, Math.min(max, remaining)));

    const bestRemaining = allPlayers
      .filter(p => !usedPIDs.has(p.PID))
      .sort((a, b) => b.POVR - a.POVR)
      .slice(0, count);

    return [...roster, ...bestRemaining];
  }

  /**
   * Determine template roster size
   */
  private async getTemplateRosterSize(): Promise<number> {
    // Parse template to get roster size
    // Typically 53-57 players for Madden rosters
    return this.templateData.data.players?.length || 55;
  }
}
```

## Testing Considerations

### Unit Tests
- CSV parsing and year grouping
- Position limit enforcement
- Deduplication by PID
- Free agent selection logic
- Rating fill variance
- Archetype numeric conversion

### Integration Tests
- Template loading with buffer/version
- IPC handler communication
- Wizard state transitions
- File save/load roundtrip

### Manual Testing
- Generate 1985 single year roster
- Generate 2000s all-time roster
- Verify roster size (54-57 players)
- Verify no duplicate PIDs
- Verify archetype saved as numeric
- Load generated roster in Madden

## Future Enhancements

1. **All-Decade Presets**
   - 1970s, 1980s, 1990s, 2000s, 2010s, 2020s buttons

2. **Custom Player Selection**
   - UI to manually select/deselect players
   - Drag-and-drop roster building

3. **Team-Specific Rosters**
   - Generate historical rosters for specific franchises
   - "All-Time Steelers", "All-Time Cowboys", etc.

4. **Hardcoded Skin Tone Data**
   - Replace placeholder values with real player skin tone data
   - Update enrichPlayer() to use data source

5. **Body Type Calculation**
   - Implement determineBodyType() based on position/weight/height
   - Map to Madden body type IDs

6. **Export to Multiple Formats**
   - M25 format for backwards compatibility
   - JSON export for external tools

## Implementation Checklist

- [ ] Create `RosterGeneratorService.ts` with all methods
- [ ] Create `roster-generator-handlers.ts` IPC layer
- [ ] Register IPC handlers in `main.ts`
- [ ] Update `preload.ts` with `rosterGenerator` API
- [ ] Create `roster-wizard.js` frontend wizard
- [ ] Add roster wizard UI section to `index.html`
- [ ] Implement CSV parsing and year caching
- [ ] Implement position-based selection with limits
- [ ] Implement free agent lookup logic (5-year lookback)
- [ ] Implement deduplication by PID (keep highest POVR)
- [ ] Implement rating fill logic (30-50 variance)
- [ ] Implement generic PID/PAM assignment (reuse draft class logic)
- [ ] Implement archetype parsing (numeric with validation)
- [ ] Implement KR specialist selection
- [ ] Implement "best 3-4 remaining" selection
- [ ] Add template loading (ROSTER-Official)
- [ ] Add wizard step navigation
- [ ] Add preview table with Handsontable
- [ ] Add "Load into Editor" action
- [ ] Add "Save to File" action
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Manual testing with 1985, 2000s rosters
- [ ] Verify no archetype type errors
- [ ] Verify no buffer/version errors
- [ ] Verify roster loads correctly in Madden

## References

- Draft Class Generator implementation (for error prevention patterns)
- `ROSTER_lookup.csv` structure and field names
- `ROSTER-Official` template format
- `PID_Portrait_Mapping.csv` for generic face assignment
- `archetype_lookup.csv` for archetype ID→name mapping
