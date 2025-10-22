# MASTER_LOOKUP Integration - Implementation Plan

## Overview
Four major improvements to draft class generation using MASTER_LOOKUP_FINAL.csv:
1. **Race Detection & Generic Face Matching**
2. **wAV-Based Rating Tiers with Position Scaling**
3. **Historical Position Mapping (1936-1980s)**
4. **AFL/NFL Draft Combination (1960-1969)**

---

## Improvement 1: Race Detection & Generic Face Matching

### Current Problem:
- Generic face assignment uses **position-based probability** (QB 50% white, WR 80% black)
- **No actual race data** - purely statistical guessing
- MASTER_LOOKUP has a **Race column** we can use!

### MASTER_LOOKUP Race Column:
**Example values from template** (Row 2 - Deion Sanders):
```
Race: "African Dark"
```

**Likely values** (need to verify in actual data):
- "African Dark" / "African American Dark" / "Black Dark"
- "African Light" / "African American Light" / "Black Light"
- "African Medium" / "African American Medium" / "Black Medium"
- "Caucasian" / "White"
- "Hispanic" / "Latino"
- "Asian"
- "Mixed" / "Multi-Racial"
- (Empty) - Unknown

### Implementation Plan:

#### Step 1: Analyze MASTER_LOOKUP Race Distribution
First, let's see what race values actually exist in the data:

```python
# Script: analyze_race_data.py
import pandas as pd
from collections import Counter

df = pd.read_csv('MASTER_LOOKUP_FINAL.csv')

# Count race distribution
race_counts = Counter(df['Race'].dropna())
print("Race Distribution in MASTER_LOOKUP:")
for race, count in race_counts.most_common():
    print(f"  {race}: {count} ({count/len(df)*100:.1f}%)")

# Show coverage
total = len(df)
with_race = df['Race'].notna().sum()
print(f"\nCoverage: {with_race}/{total} ({with_race/total*100:.1f}%)")

# Sample entries by race
print("\nSample entries by race:")
for race in race_counts.keys():
    sample = df[df['Race'] == race].head(2)
    print(f"\n{race}:")
    for _, row in sample.iterrows():
        print(f"  {row['First Name']} {row['Last Name']} ({row['Draft Class']} {row['Position']})")
```

#### Step 2: Map Race Values to Generic Face Categories

**Generic Face Categories** (from PID_Portrait_Mapping.csv):
- **Category 1**: 41 Caucasian faces (`plpo_generic_1_001` to `plpo_generic_1_041`)
- **Category 2**: 63 African American Light faces
- **Category 3**: 38 African American Dark faces
- **Category 5**: 94 Hispanic/Latino faces
- **Category 6**: 98 Mixed/Multi-Racial faces
- **Category 7**: 164 African American Medium faces

**Mapping**:
```typescript
interface RaceMapping {
  raceValue: string;
  genericCategory: number;
  description: string;
}

const RACE_TO_CATEGORY: RaceMapping[] = [
  // African American variations
  { raceValue: 'African Dark', genericCategory: 3, description: 'African American - Dark' },
  { raceValue: 'African American Dark', genericCategory: 3, description: 'African American - Dark' },
  { raceValue: 'Black Dark', genericCategory: 3, description: 'African American - Dark' },

  { raceValue: 'African Light', genericCategory: 2, description: 'African American - Light' },
  { raceValue: 'African American Light', genericCategory: 2, description: 'African American - Light' },
  { raceValue: 'Black Light', genericCategory: 2, description: 'African American - Light' },

  { raceValue: 'African Medium', genericCategory: 7, description: 'African American - Medium' },
  { raceValue: 'African American Medium', genericCategory: 7, description: 'African American - Medium' },
  { raceValue: 'Black Medium', genericCategory: 7, description: 'African American - Medium' },
  { raceValue: 'African American', genericCategory: 7, description: 'African American - Medium (default)' },
  { raceValue: 'Black', genericCategory: 7, description: 'African American - Medium (default)' },

  // Caucasian variations
  { raceValue: 'Caucasian', genericCategory: 1, description: 'Caucasian/White' },
  { raceValue: 'White', genericCategory: 1, description: 'Caucasian/White' },

  // Hispanic/Latino
  { raceValue: 'Hispanic', genericCategory: 5, description: 'Hispanic/Latino' },
  { raceValue: 'Latino', genericCategory: 5, description: 'Hispanic/Latino' },

  // Mixed/Multi-Racial
  { raceValue: 'Mixed', genericCategory: 6, description: 'Mixed/Multi-Racial' },
  { raceValue: 'Multi-Racial', genericCategory: 6, description: 'Mixed/Multi-Racial' },
  { raceValue: 'Biracial', genericCategory: 6, description: 'Mixed/Multi-Racial' },

  // Asian (use Category 6 as closest match)
  { raceValue: 'Asian', genericCategory: 6, description: 'Asian (mapped to Mixed)' },
  { raceValue: 'Pacific Islander', genericCategory: 6, description: 'Pacific Islander (mapped to Mixed)' }
];
```

#### Step 3: Update `assignGenericFace()` Method

**New logic**:
```typescript
/**
 * Assign appropriate generic face PID based on player race data
 * Uses Race column from MASTER_LOOKUP if available
 * Falls back to position-based probability if race unknown
 */
private assignGenericFace(
  firstName: string,
  lastName: string,
  position?: string,
  raceData?: string  // NEW PARAMETER
): number {

  // Priority 1: Use race data from MASTER_LOOKUP if available
  if (raceData && raceData.trim()) {
    const targetCategory = this.mapRaceToCategory(raceData);

    if (targetCategory > 0) {
      console.log(`[CreatorService] Using race data for "${firstName} ${lastName}": "${raceData}" -> Category ${targetCategory}`);
      return this.getRandomGenericFaceFromCategory(targetCategory);
    }
  }

  // Priority 2: Fall back to position-based probability (existing logic)
  console.log(`[CreatorService] No race data for "${firstName} ${lastName}", using position-based assignment`);
  let targetCategory = 7; // Default to Black-Medium

  if (position) {
    const pos = position.toUpperCase();

    if (['QB', 'K', 'P', 'LS'].includes(pos)) {
      targetCategory = Math.random() < 0.5 ? 1 : 7;
    }
    // ... rest of existing logic
  }

  return this.getRandomGenericFaceFromCategory(targetCategory);
}

/**
 * Map race string to generic face category
 * Returns category number (1-7) or 0 if unknown
 */
private mapRaceToCategory(raceValue: string): number {
  const normalized = raceValue.toLowerCase().trim();

  // Check each mapping (case-insensitive, partial match)
  for (const mapping of RACE_TO_CATEGORY) {
    if (normalized.includes(mapping.raceValue.toLowerCase())) {
      return mapping.genericCategory;
    }
  }

  return 0; // Unknown race
}

/**
 * Get random generic face PID from specified category
 * (Extract existing logic from assignGenericFace)
 */
private getRandomGenericFaceFromCategory(category: number): number {
  const categoryRanges: {[key: number]: {min: number, max: number, count: number}} = {
    1: {min: 1, max: 41, count: 41},
    2: {min: 1, max: 63, count: 63},
    3: {min: 1, max: 38, count: 38},
    5: {min: 1, max: 94, count: 94},
    6: {min: 2, max: 98, count: 98},
    7: {min: 1, max: 164, count: 164}
  };

  const range = categoryRanges[category];
  if (!range) return 0;

  const faceNum = Math.floor(Math.random() * range.count) + range.min;
  const targetPortrait = `plpo_generic_${category}_${String(faceNum).padStart(3, '0')}`;

  // Find PID that maps to this portrait
  const pidPortraitPath = path.join(__dirname, '../../data/lookups/PID_Portrait_Mapping.csv');
  try {
    const csvContent = fs.readFileSync(pidPortraitPath, 'utf-8');
    const lines = csvContent.split('\n');

    const matchingPIDs: number[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [pidStr, type, portrait] = line.split(',');
      if (portrait && portrait.trim() === targetPortrait) {
        const pid = parseInt(pidStr);
        if (!isNaN(pid)) {
          matchingPIDs.push(pid);
        }
      }
    }

    if (matchingPIDs.length > 0) {
      return matchingPIDs[Math.floor(Math.random() * matchingPIDs.length)];
    }
  } catch (error) {
    console.error(`[CreatorService] Error loading generic face mapping:`, error);
  }

  return 0; // Fallback
}
```

#### Step 4: Update Player Generation to Use Race Data

In `generateDraftClass()`, after matching PID:
```typescript
// Get race data from MASTER_LOOKUP
let raceData: string | undefined;
const lookupEntry = masterLookup.get(matchedPID);
if (lookupEntry && lookupEntry.Race) {
  raceData = lookupEntry.Race;
}

// Match PID from lookup table with disambiguation
let matchedPID = this.matchPID(firstName, lastName, year, mappedPosition.name, prospect.college);

// If no real portrait found, assign appropriate generic face WITH race data
if (matchedPID === 0) {
  matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name, raceData);
}
```

### Expected Results:
- **Before**: Generic faces based on position probability (QB 50% white, WR 80% black)
- **After**: Generic faces based on actual race data from MASTER_LOOKUP
- **Accuracy**: Should dramatically improve visual accuracy for historical players
- **Coverage**: Will have race data for players in MASTER_LOOKUP with Race field populated

---

## Improvement 2: wAV-Based Rating Tiers with Position Scaling

### Current Problem:
- Ratings based on **draft position only** (Round 1 Pick 1 = 78-82 OVR)
- Doesn't account for **career performance** (Tom Brady R6 P199 = 99 OVR in reality!)
- **wAV (Weighted Approximate Value)** is perfect metric for this

### wAV Understanding:
**What is wAV?**
- **Weighted Approximate Value** - Pro Football Reference's measure of player impact
- Accounts for: Games played, starts, Pro Bowls, All-Pros, championships
- **Scale**: 0 (backup who never played) to 200+ (Hall of Fame legends)

**Example wAV values**:
- Tom Brady: **244** (highest all-time)
- Jerry Rice: **208**
- Peyton Manning: **187**
- Barry Sanders: **158**
- Average Pro Bowler: **50-80**
- Average Starter: **20-40**
- Backup/Bust: **0-10**

### Rating Tier System Design:

#### Tier Definitions (Based on wAV):
```typescript
interface RatingTier {
  name: string;
  minWAV: number;
  maxWAV: number;
  baseOVR: number;      // Starting OVR for this tier
  ovrRange: number;     // +/- range for variation
  devTraitWeight: number; // Multiplier for dev trait probability
}

const WAV_TIERS: RatingTier[] = [
  // Tier 0: Hall of Fame Legends (wAV 150+)
  {
    name: 'Hall of Fame Legend',
    minWAV: 150,
    maxWAV: 999,
    baseOVR: 85,
    ovrRange: 5,      // 80-90 OVR
    devTraitWeight: 3.0  // 100% X-Factor if HOF
  },

  // Tier 1: Elite Players (wAV 100-149)
  {
    name: 'Elite',
    minWAV: 100,
    maxWAV: 149,
    baseOVR: 82,
    ovrRange: 4,      // 78-86 OVR
    devTraitWeight: 2.5  // High chance Superstar/X-Factor
  },

  // Tier 2: Pro Bowl Players (wAV 60-99)
  {
    name: 'Pro Bowl',
    minWAV: 60,
    maxWAV: 99,
    baseOVR: 77,
    ovrRange: 5,      // 72-82 OVR
    devTraitWeight: 2.0  // Likely Star/Superstar
  },

  // Tier 3: Quality Starters (wAV 30-59)
  {
    name: 'Quality Starter',
    minWAV: 30,
    maxWAV: 59,
    baseOVR: 72,
    ovrRange: 5,      // 67-77 OVR
    devTraitWeight: 1.5  // Some Star potential
  },

  // Tier 4: Average Starters (wAV 15-29)
  {
    name: 'Average Starter',
    minWAV: 15,
    maxWAV: 29,
    baseOVR: 68,
    ovrRange: 4,      // 64-72 OVR
    devTraitWeight: 1.0  // Mostly Normal
  },

  // Tier 5: Backups/Role Players (wAV 5-14)
  {
    name: 'Backup',
    minWAV: 5,
    maxWAV: 14,
    baseOVR: 63,
    ovrRange: 4,      // 59-67 OVR
    devTraitWeight: 0.5  // Rarely Star
  },

  // Tier 6: Busts (wAV 0-4)
  {
    name: 'Bust',
    minWAV: 0,
    maxWAV: 4,
    baseOVR: 58,
    ovrRange: 5,      // 53-63 OVR
    devTraitWeight: 0.1  // Almost never Star
  }
];
```

#### Position Scaling Factors:
Different positions have different OVR expectations:
```typescript
interface PositionScaling {
  position: string;
  modifier: number;  // Multiplier for OVR (1.0 = neutral)
  explanation: string;
}

const POSITION_SCALING: { [key: string]: PositionScaling } = {
  // Premium positions (harder to find elite talent)
  'QB': { position: 'QB', modifier: 1.05, explanation: 'QB premium' },
  'LEDG': { position: 'LEDG', modifier: 1.03, explanation: 'Elite pass rusher premium' },
  'REDG': { position: 'REDG', modifier: 1.03, explanation: 'Elite pass rusher premium' },
  'LT': { position: 'LT', modifier: 1.02, explanation: 'Blind side protector premium' },
  'CB': { position: 'CB', modifier: 1.02, explanation: 'Elite coverage premium' },

  // Standard positions
  'HB': { position: 'HB', modifier: 1.0, explanation: 'Standard scaling' },
  'WR': { position: 'WR', modifier: 1.0, explanation: 'Standard scaling' },
  'TE': { position: 'TE', modifier: 1.0, explanation: 'Standard scaling' },
  'RT': { position: 'RT', modifier: 1.0, explanation: 'Standard scaling' },
  'LG': { position: 'LG', modifier: 1.0, explanation: 'Standard scaling' },
  'C': { position: 'C', modifier: 1.0, explanation: 'Standard scaling' },
  'RG': { position: 'RG', modifier: 1.0, explanation: 'Standard scaling' },
  'DT': { position: 'DT', modifier: 1.0, explanation: 'Standard scaling' },
  'SAM': { position: 'SAM', modifier: 1.0, explanation: 'Standard scaling' },
  'Mike': { position: 'Mike', modifier: 1.0, explanation: 'Standard scaling' },
  'WILL': { position: 'WILL', modifier: 1.0, explanation: 'Standard scaling' },
  'FS': { position: 'FS', modifier: 1.0, explanation: 'Standard scaling' },
  'SS': { position: 'SS', modifier: 1.0, explanation: 'Standard scaling' },

  // Devalued positions (easier to find talent)
  'FB': { position: 'FB', modifier: 0.97, explanation: 'Fullback devaluation' },
  'K': { position: 'K', modifier: 0.95, explanation: 'Kicker devaluation' },
  'P': { position: 'P', modifier: 0.95, explanation: 'Punter devaluation' },
  'LS': { position: 'LS', modifier: 0.93, explanation: 'Long snapper devaluation' }
};
```

#### Implementation:

```typescript
/**
 * Calculate base OVR from wAV (career performance)
 * Includes position scaling
 * @param wAV - Weighted Approximate Value from MASTER_LOOKUP
 * @param position - Player position (for scaling)
 * @param isHOF - Hall of Fame flag (overrides to high tier)
 * @returns Base OVR (before attribute distribution)
 */
private calculateBaseOVRFromWAV(wAV: number, position: string, isHOF: boolean = false): number {
  // HOF players always get elite tier
  if (isHOF && wAV < 150) {
    wAV = 150; // Boost to HOF tier minimum
  }

  // Find appropriate tier
  let tier = WAV_TIERS[WAV_TIERS.length - 1]; // Default to lowest tier
  for (const t of WAV_TIERS) {
    if (wAV >= t.minWAV && wAV <= t.maxWAV) {
      tier = t;
      break;
    }
  }

  // Calculate base OVR with variation
  const variation = (Math.random() * 2 - 1) * tier.ovrRange; // Random +/- range
  let baseOVR = tier.baseOVR + variation;

  // Apply position scaling
  const scaling = POSITION_SCALING[position];
  if (scaling) {
    baseOVR *= scaling.modifier;
    console.log(`[CreatorService] Position scaling for ${position}: ${scaling.modifier}x (${scaling.explanation})`);
  }

  // Clamp to valid range (50-90 for rookies)
  baseOVR = Math.max(50, Math.min(90, Math.round(baseOVR)));

  console.log(`[CreatorService] wAV ${wAV} -> Tier "${tier.name}" -> Base OVR ${baseOVR} (position: ${position})`);

  return baseOVR;
}

/**
 * Update dev trait calculation to use wAV tiers
 */
private determineDevTrait(
  round: number,
  pick: number,
  overall: number,
  isHOF: boolean,
  wAV?: number  // NEW PARAMETER
): number {
  // HOF players always get X-Factor
  if (isHOF) {
    return 3; // X-Factor
  }

  // Use wAV tier if available
  if (wAV !== undefined && wAV > 0) {
    // Find tier
    let tier = WAV_TIERS[WAV_TIERS.length - 1];
    for (const t of WAV_TIERS) {
      if (wAV >= t.minWAV && wAV <= t.maxWAV) {
        tier = t;
        break;
      }
    }

    // Roll for dev trait based on tier weight
    const roll = Math.random();

    if (tier.devTraitWeight >= 3.0) {
      return 3; // X-Factor (HOF tier)
    } else if (tier.devTraitWeight >= 2.5 && roll < 0.7) {
      return 3; // X-Factor (70% for Elite tier)
    } else if (tier.devTraitWeight >= 2.0 && roll < 0.5) {
      return 2; // Superstar (50% for Pro Bowl tier)
    } else if (tier.devTraitWeight >= 1.5 && roll < 0.3) {
      return 2; // Superstar (30% for Quality Starter)
    } else if (tier.devTraitWeight >= 1.0 && roll < 0.2) {
      return 1; // Star (20% for Average Starter)
    } else if (tier.devTraitWeight >= 0.5 && roll < 0.1) {
      return 1; // Star (10% for Backups)
    }

    return 0; // Normal (everyone else)
  }

  // Fallback to old draft position logic if no wAV
  if (round === 1 && overall >= 80) {
    return 2; // Superstar
  } else if (round <= 2 && overall >= 75) {
    return 1; // Star
  } else if (round <= 3 && overall >= 72) {
    return 1; // Star
  }

  return 0; // Normal
}
```

#### Usage in `generateDraftClass()`:

```typescript
// After loading player from MASTER_LOOKUP:
const lookupEntry = masterLookup.get(matchedPID);
let wAV: number | undefined;
if (lookupEntry && lookupEntry.wAV) {
  wAV = parseFloat(lookupEntry.wAV);
}

// Calculate base OVR from wAV
const baseOVR = wAV
  ? this.calculateBaseOVRFromWAV(wAV, mappedPosition.name, prospect.isHallOfFamer)
  : this.generateDefaultRatings(prospect).overall; // Fallback for pre-1936 or no data

// Generate ratings (use RatingCalculator if stats available, else distribute from baseOVR)
const ratings = stats && (stats.passAttempts || stats.rushAttempts || stats.receptions || stats.tackles)
  ? ratingCalculator.calculateRatings(stats)
  : this.distributeRatingsFromBaseOVR(baseOVR, mappedPosition.name); // NEW METHOD

// Determine dev trait using wAV
const devTrait = this.determineDevTrait(prospect.round, prospect.pick, baseOVR, prospect.isHallOfFamer, wAV);
```

### Expected Results:
- **Tom Brady** (R6 P199, wAV 244): 85-90 OVR, X-Factor dev trait
- **Jerry Rice** (R1 P16, wAV 208): 85-90 OVR, X-Factor dev trait
- **JaMarcus Russell** (R1 P1, wAV 2): 58-63 OVR, Normal dev trait (proper bust!)
- **Ryan Leaf** (R1 P2, wAV 4): 60-65 OVR, Normal dev trait (proper bust!)

---

## Improvement 3: Historical Position Mapping

### Problem:
Positions have evolved significantly:
- **1936-1950s**: B (Back), E (End), T (Tackle), G (Guard), C (Center)
- **1960s-1970s**: HB/FB split, DE/DT distinction, LB emergence
- **1980s-1990s**: 3-4 vs 4-3, nickel/dime packages
- **2000s+**: Modern position specialization

**Current MASTER_LOOKUP positions need mapping!**

### Position Evolution Timeline:

#### Era 1: Early Football (1936-1949)
**Positions in MASTER_LOOKUP**:
- **B** (Back) → Could be QB, HB, FB, or DB
- **BB** (Blocking Back) → FB
- **TB** (Tailback) → HB
- **WB** (Wingback) → HB or WR
- **FB** (Fullback) → FB or HB
- **E** (End) → TE or WR or DE
- **T** (Tackle) → OT or DT
- **G** (Guard) → OG
- **C** (Center) → C
- **DB** (Defensive Back) → CB or S

**Mapping Logic**:
```typescript
const ERA1_POSITIONS: { [key: string]: PositionMapping } = {
  // Backs (offense and defense were mixed!)
  'B': {
    primary: 'HB',
    alternates: ['QB', 'FB', 'CB', 'FS'],
    logic: 'Weight-based: <200 lbs → HB/CB, 200-215 → QB/FS, 215+ → FB',
    notes: 'Two-way players - check career stats to determine'
  },
  'BB': { primary: 'FB', alternates: [], logic: 'Blocking back = modern fullback' },
  'TB': { primary: 'HB', alternates: [], logic: 'Tailback = ball carrier' },
  'WB': { primary: 'WR', alternates: ['HB'], logic: 'Wingback → modern slot WR or 3rd down back' },
  'FB': { primary: 'FB', alternates: ['HB'], logic: 'Fullback, but could be primary rusher' },

  // Ends (offense and defense!)
  'E': {
    primary: 'TE',
    alternates: ['WR', 'LEDG', 'REDG'],
    logic: 'Weight-based: <230 lbs → WR, 230-260 → TE, 260+ → DE',
    notes: 'Two-way players - check if OL/DL weight'
  },

  // Line (offense and defense!)
  'T': {
    primary: 'LT',
    alternates: ['RT', 'DT'],
    logic: 'Weight-based: 240-280 → OT, 280+ → DT',
    notes: 'Tackles played both ways'
  },
  'G': { primary: 'LG', alternates: ['RG'], logic: 'Guards always offense' },
  'C': { primary: 'C', alternates: [], logic: 'Center unchanged' },

  // Defense
  'DB': {
    primary: 'CB',
    alternates: ['FS', 'SS'],
    logic: 'Speed-based: Faster → CB, Bigger → S',
    notes: 'DBs covered all receivers'
  }
};
```

#### Era 2: Modern Positions Emerge (1950-1969)
**New positions**:
- **QB** - Distinct from HB/FB
- **FL** (Flanker) → WR
- **SE** (Split End) → WR
- **DE** - Distinct from DT
- **LB** - Linebacker position emerges
- **CB** / **S** - DB specialization

**Mapping**:
```typescript
const ERA2_POSITIONS: { [key: string]: PositionMapping } = {
  'FL': { primary: 'WR', alternates: [], logic: 'Flanker = wide receiver' },
  'SE': { primary: 'WR', alternates: [], logic: 'Split end = wide receiver' },
  'DE': { primary: 'LEDG', alternates: ['REDG'], logic: 'Defensive end' },
  'DT': { primary: 'DT', alternates: [], logic: 'Defensive tackle' },
  'LB': { primary: 'SAM', alternates: ['Mike', 'WILL'], logic: 'Generic linebacker' },
  'MLB': { primary: 'Mike', alternates: [], logic: 'Middle linebacker' },
  'OLB': { primary: 'SAM', alternates: ['WILL'], logic: 'Outside linebacker' }
};
```

#### Era 3: Modern Specialization (1970-1989)
**New positions**:
- **NT** (Nose Tackle) → DT
- **ILB** (Inside Linebacker) → Mike
- **FS** / **SS** - Safety specialization
- **RCB** / **LCB** - Cornerback sides

#### Era 4: Current Era (1990+)
- All modern positions exist

### Implementation:

```typescript
interface PositionMapping {
  primary: string;           // Default modern position
  alternates: string[];      // Alternative positions
  logic: string;            // Decision logic
  weightThreshold?: number; // Weight cutoff for alternates
  notes?: string;           // Additional context
}

/**
 * Map historical position to modern Madden position
 * Uses year, position code, and player attributes to determine best fit
 * @param historicalPosition - Position from MASTER_LOOKUP (e.g., "B", "E", "T")
 * @param year - Draft year (determines era)
 * @param weight - Player weight (helps disambiguate)
 * @param height - Player height (helps with position fit)
 * @returns Modern position name and code
 */
private mapHistoricalPosition(
  historicalPosition: string,
  year: number,
  weight?: number,
  height?: number
): { name: string; code: number } {

  // Modern positions (1990+) - use existing mapPosition
  if (year >= 1990) {
    return this.mapPosition(historicalPosition);
  }

  const pos = historicalPosition.toUpperCase().trim();

  // Era 1: Early Football (1936-1949)
  if (year >= 1936 && year < 1950) {
    switch (pos) {
      case 'B':
        // Weight-based logic
        if (weight) {
          if (weight < 200) return { name: 'HB', code: 1 };      // Speedy back
          if (weight < 215) return { name: 'QB', code: 0 };      // Average QB size
          return { name: 'FB', code: 2 };                         // Bigger back
        }
        return { name: 'HB', code: 1 }; // Default

      case 'BB':
        return { name: 'FB', code: 2 }; // Blocking back

      case 'TB':
        return { name: 'HB', code: 1 }; // Tailback

      case 'WB':
        return { name: 'WR', code: 3 }; // Wingback -> modern WR

      case 'E':
        // Weight-based: light = WR, medium = TE, heavy = DE
        if (weight) {
          if (weight < 230) return { name: 'WR', code: 3 };
          if (weight < 260) return { name: 'TE', code: 4 };
          return { name: 'LEDG', code: 10 }; // Defensive end
        }
        return { name: 'TE', code: 4 }; // Default to TE

      case 'T':
        // Weight-based: lighter = OT, heavier = DT
        if (weight && weight >= 280) {
          return { name: 'DT', code: 12 }; // Defensive tackle
        }
        return { name: 'LT', code: 5 }; // Default to offensive tackle

      case 'G':
        return { name: 'LG', code: 6 }; // Guard

      case 'C':
        return { name: 'C', code: 7 }; // Center

      case 'DB':
        // Height-based: taller = S, shorter = CB
        if (height && height >= 72) {
          return { name: 'FS', code: 17 }; // Safety
        }
        return { name: 'CB', code: 16 }; // Default to cornerback
    }
  }

  // Era 2: Modern Positions Emerge (1950-1989)
  if (year >= 1950 && year < 1990) {
    switch (pos) {
      case 'FL':
      case 'SE':
        return { name: 'WR', code: 3 }; // Flanker/Split End = WR

      case 'DE':
        return { name: 'LEDG', code: 10 }; // Defensive end

      case 'NT':
        return { name: 'DT', code: 12 }; // Nose tackle = DT

      case 'ILB':
        return { name: 'Mike', code: 14 }; // Inside LB = Mike

      case 'RCB':
      case 'LCB':
        return { name: 'CB', code: 16 }; // Right/Left CB
    }
  }

  // Fallback: Use modern mapping
  return this.mapPosition(historicalPosition);
}
```

### Usage in `generateDraftClass()`:

```typescript
// Map position with historical support
const mappedPosition = this.mapHistoricalPosition(
  prospect.position,
  year,
  prospect.weight,
  heightInches
);

console.log(`[CreatorService] Historical position mapping: "${prospect.position}" (${year}) -> ${mappedPosition.name}`);
```

### Expected Results:
- **1940 "B" (Back), 190 lbs**: Maps to HB
- **1940 "B" (Back), 220 lbs**: Maps to FB
- **1940 "E" (End), 220 lbs**: Maps to WR
- **1940 "E" (End), 250 lbs**: Maps to TE
- **1940 "E" (End), 270 lbs**: Maps to LEDG (DE)
- **1940 "T" (Tackle), 260 lbs**: Maps to LT
- **1940 "T" (Tackle), 290 lbs**: Maps to DT

---

## Improvement 4: AFL/NFL Draft Combination (1960-1969)

### Problem:
- **1960-1969**: AFL and NFL were separate leagues with separate drafts
- **MASTER_LOOKUP has League field** to distinguish AFL vs NFL
- Users should have option to:
  1. **Generate AFL only** (1960-1969 AFL draft)
  2. **Generate NFL only** (1960-1969 NFL draft)
  3. **Generate Combined** (both leagues, 400+ players)

### AFL/NFL History:
- **1960**: AFL founded (8 teams)
- **1960-1969**: Competing leagues, separate drafts
- **1966**: AFL-NFL merger announced (effective 1970)
- **1967-1969**: Common draft begins
- **1970**: Full merger (NFL becomes AFC/NFC)

**Draft Sizes**:
- **NFL**: ~280 picks per year (14 teams × 20 rounds)
- **AFL**: ~160 picks per year (8 teams × 20 rounds)
- **Combined**: ~440 players

### Implementation:

#### Step 1: Add League Filter to UI

**HTML** (`src/renderer/index.html`):
```html
<!-- Draft Class Creator Section -->
<div class="form-group">
  <label for="draftYear">Draft Year:</label>
  <input type="number" id="draftYear" min="1936" max="2025" value="2024">
</div>

<!-- NEW: League Selection (only show for 1960-1969) -->
<div class="form-group" id="leagueSelectionGroup" style="display: none;">
  <label for="leagueSelection">League:</label>
  <select id="leagueSelection">
    <option value="combined">Combined (AFL + NFL)</option>
    <option value="nfl">NFL Only</option>
    <option value="afl">AFL Only</option>
  </select>
  <small class="form-text">
    1960-1969: AFL and NFL were separate leagues. Choose which to generate.
  </small>
</div>

<script>
// Show/hide league selection based on year
document.getElementById('draftYear').addEventListener('change', (e) => {
  const year = parseInt(e.target.value);
  const leagueGroup = document.getElementById('leagueSelectionGroup');

  if (year >= 1960 && year <= 1969) {
    leagueGroup.style.display = 'block';
  } else {
    leagueGroup.style.display = 'none';
  }
});
</script>
```

#### Step 2: Update IPC Handler

**File**: `src/main/ipc/creator-handlers.ts`
```typescript
ipcMain.handle('creator:generateDraftClass', async (event, year: number, testingMode: boolean, league?: string) => {
  try {
    console.log(`[IPC] Generating draft class: year=${year}, testing=${testingMode}, league=${league || 'all'}`);

    const players = await creatorService.generateDraftClass(year, testingMode, league);

    return {
      success: true,
      players,
      count: players.length
    };
  } catch (error: any) {
    console.error('[IPC] Error generating draft class:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
```

#### Step 3: Update `generateDraftClass()` Method

```typescript
/**
 * Generate a draft class from web-scraped data
 * Includes drafted players + undrafted free agents (UDFAs)
 * @param year - Draft year
 * @param testingMode - If true, limit to ~40 players for faster testing
 * @param league - League filter: 'nfl', 'afl', or 'combined' (default: auto-detect)
 * @returns Array of generated prospects
 */
async generateDraftClass(
  year: number,
  testingMode: boolean = false,
  league?: string  // NEW PARAMETER
): Promise<GeneratedPlayer[]> {
  console.log(`[CreatorService] Generating draft class for ${year} (Testing: ${testingMode}, League: ${league || 'auto'})`);

  // Auto-detect league filter based on year
  let leagueFilter: string | undefined = league;
  if (!leagueFilter) {
    if (year >= 1960 && year <= 1969) {
      leagueFilter = 'combined'; // Default to combined for AFL/NFL era
    } else {
      leagueFilter = 'nfl'; // Pre-1960 = NFL only, Post-1970 = merged NFL
    }
  }

  console.log(`[CreatorService] League filter: ${leagueFilter}`);

  // ... existing scraping logic ...

  // Step 1: Scrape drafted prospects using CSV export
  let draftedProspects = await scraperService.scrapeDraftClassCSV(year);
  console.log(`[CreatorService] Scraped ${draftedProspects.length} total drafted prospects`);

  // Filter by league if AFL/NFL era
  if (year >= 1960 && year <= 1969 && leagueFilter !== 'combined') {
    const beforeFilter = draftedProspects.length;

    // Load MASTER_LOOKUP to get League field for each player
    const masterLookup = this.loadMasterLookup(); // NEW METHOD

    draftedProspects = draftedProspects.filter(prospect => {
      const nameParts = prospect.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      // Find player in MASTER_LOOKUP
      const lookupKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()}`;
      const lookupEntry = Array.from(masterLookup.values()).find(entry =>
        entry.firstName.toLowerCase() === firstName.toLowerCase() &&
        entry.lastName.toLowerCase() === lastName.toLowerCase() &&
        entry.draftClass === String(year)
      );

      if (!lookupEntry) {
        console.warn(`[CreatorService] No MASTER_LOOKUP entry for ${prospect.name} (${year})`);
        return true; // Include if unknown
      }

      // Filter by league
      const playerLeague = lookupEntry.league?.toUpperCase();
      const targetLeague = leagueFilter?.toUpperCase();

      return playerLeague === targetLeague;
    });

    console.log(`[CreatorService] Filtered ${leagueFilter} players: ${beforeFilter} -> ${draftedProspects.length}`);
  }

  // ... rest of generation logic ...
}
```

#### Step 4: Add `loadMasterLookup()` Method

```typescript
/**
 * Load MASTER_LOOKUP_FINAL.csv into memory
 * Format: Last Name,First Name,College/Univ,Round,Pick,Draft Class,Position,PhotoID,Player Assets ID,CommID,PLPO,Height,Weight,From,To,AP1,PB,St,wAV,League,Race,Home State,Wiki_Image_URL,PFR_Image_URL
 */
private masterLookupCache?: Map<string, any>;

private loadMasterLookup(): Map<string, any> {
  if (this.masterLookupCache) {
    return this.masterLookupCache;
  }

  this.masterLookupCache = new Map<string, any>();

  try {
    const masterLookupPath = path.join(__dirname, '../../data/lookups/MASTER_LOOKUP_FINAL.csv');
    const csvContent = fs.readFileSync(masterLookupPath, 'utf-8');
    const lines = csvContent.split('\n');

    // Parse header
    const header = lines[0].split(',').map(h => h.trim());

    // Parse rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      const entry: any = {};

      for (let j = 0; j < header.length; j++) {
        entry[header[j]] = values[j]?.trim() || '';
      }

      // Create key: "firstname lastname draftclass"
      const key = `${entry['First Name'].toLowerCase()} ${entry['Last Name'].toLowerCase()} ${entry['Draft Class']}`;
      this.masterLookupCache.set(key, entry);
    }

    console.log(`[CreatorService] Loaded ${this.masterLookupCache.size} players from MASTER_LOOKUP_FINAL.csv`);
  } catch (error) {
    console.error('[CreatorService] Failed to load MASTER_LOOKUP_FINAL.csv:', error);
  }

  return this.masterLookupCache;
}
```

### Expected Results:

**1965 Combined (AFL + NFL)**:
- ~280 NFL players (14 teams)
- ~160 AFL players (8 teams)
- **Total: ~440 players**

**1965 NFL Only**:
- ~280 NFL players
- Filters out Joe Namath, Lance Alworth, etc. (AFL stars)

**1965 AFL Only**:
- ~160 AFL players
- Filters out Dick Butkus, Gale Sayers, etc. (NFL stars)

**User Experience**:
1. Select year 1965
2. UI shows "League" dropdown (Combined / NFL / AFL)
3. Select "Combined" → Gets full 440-player draft
4. Select "AFL Only" → Gets 160 AFL prospects
5. Select "NFL Only" → Gets 280 NFL prospects

---

## Testing Plan

### Test 1: Race Detection
```typescript
// Test script: test_race_detection.ts
const testPlayers = [
  { name: 'Deion Sanders', expectedRace: 'African Dark', expectedCategory: 3 },
  { name: 'Tom Brady', expectedRace: 'Caucasian', expectedCategory: 1 },
  { name: 'Tony Gonzalez', expectedRace: 'Hispanic', expectedCategory: 5 }
];

for (const player of testPlayers) {
  const lookupEntry = masterLookup.get(player.name);
  const category = mapRaceToCategory(lookupEntry.Race);
  console.log(`${player.name}: ${lookupEntry.Race} -> Category ${category} (expected ${player.expectedCategory})`);
}
```

### Test 2: wAV Ratings
```typescript
// Test wAV-based rating tiers
const testCases = [
  { name: 'Tom Brady', wAV: 244, expectedOVR: '85-90', expectedDev: 'X-Factor' },
  { name: 'JaMarcus Russell', wAV: 2, expectedOVR: '58-63', expectedDev: 'Normal' },
  { name: 'Ryan Leaf', wAV: 4, expectedOVR: '58-63', expectedDev: 'Normal' }
];

for (const test of testCases) {
  const ovr = calculateBaseOVRFromWAV(test.wAV, 'QB', false);
  console.log(`${test.name} (wAV ${test.wAV}): OVR ${ovr} (expected ${test.expectedOVR})`);
}
```

### Test 3: Historical Positions
```typescript
// Test 1940 position mappings
const test1940 = [
  { pos: 'B', weight: 190, expected: 'HB' },
  { pos: 'B', weight: 220, expected: 'FB' },
  { pos: 'E', weight: 220, expected: 'WR' },
  { pos: 'E', weight: 270, expected: 'LEDG' },
  { pos: 'T', weight: 260, expected: 'LT' },
  { pos: 'T', weight: 290, expected: 'DT' }
];

for (const test of test1940) {
  const mapped = mapHistoricalPosition(test.pos, 1940, test.weight);
  console.log(`1940 ${test.pos} (${test.weight} lbs): ${mapped.name} (expected ${test.expected})`);
}
```

### Test 4: AFL/NFL Filtering
```typescript
// Test 1965 draft with different league filters
const results = {
  combined: await generateDraftClass(1965, false, 'combined'),
  nfl: await generateDraftClass(1965, false, 'nfl'),
  afl: await generateDraftClass(1965, false, 'afl')
};

console.log(`1965 Combined: ${results.combined.length} players`);
console.log(`1965 NFL Only: ${results.nfl.length} players`);
console.log(`1965 AFL Only: ${results.afl.length} players`);

// Check for Joe Namath (AFL) in each result
const namath = {
  combined: results.combined.find(p => p.lastName === 'Namath'),
  nfl: results.nfl.find(p => p.lastName === 'Namath'),
  afl: results.afl.find(p => p.lastName === 'Namath')
};

console.log(`Joe Namath in Combined: ${namath.combined ? 'YES' : 'NO'}`);
console.log(`Joe Namath in NFL: ${namath.nfl ? 'YES' : 'NO'}`);
console.log(`Joe Namath in AFL: ${namath.afl ? 'YES' : 'NO'}`);
```

---

## Summary of Changes

### Files to Modify:
1. **`src/main/services/CreatorService.ts`**:
   - Add `RACE_TO_CATEGORY` mapping
   - Update `assignGenericFace()` to use race data
   - Add `calculateBaseOVRFromWAV()` method
   - Add `mapHistoricalPosition()` method
   - Add `loadMasterLookup()` method
   - Update `generateDraftClass()` to support league filter
   - Update `determineDevTrait()` to use wAV

2. **`src/renderer/index.html`**:
   - Add league selection dropdown
   - Add JavaScript to show/hide based on year

3. **`src/main/ipc/creator-handlers.ts`**:
   - Update IPC handler to accept league parameter

### New Python Scripts:
1. **`scripts/analyze_race_data.py`** - Analyze race distribution in MASTER_LOOKUP

### Expected Performance:
- **Race Accuracy**: 80-90% (vs 60-70% position-based guessing)
- **Rating Accuracy**: 90%+ (wAV is career-proven metric)
- **Position Accuracy (historical)**: 85%+ (vs 50% guessing)
- **AFL/NFL Support**: 100% (proper league filtering)

---

## Next Steps:
1. Run `analyze_race_data.py` to see actual race values in MASTER_LOOKUP
2. Implement race detection system
3. Implement wAV-based ratings
4. Implement historical position mapping
5. Implement AFL/NFL filtering
6. Test with 1965, 1975, 1985, 1995, 2005 draft classes
7. Validate results vs reality
