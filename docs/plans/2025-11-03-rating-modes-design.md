# Rating Modes System Design

**Date:** 2025-11-03
**Status:** Approved for Implementation
**Author:** Claude Code + tshanks1027

## Overview

Add three rating generation modes to Draft Class and Roster Generators:
1. **Random Mode**: Completely random ratings
2. **Semi-Historical Mode**: Current web scraping approach
3. **Realistic Mode**: RowdyRandy's draft-tier-based system

## Problem Statement

Currently, generators only use web-scraped stats (semi-historical). Users need:
- Random generation for variety
- Realistic draft-class ratings based on RowdyRandy's proven system using draft position → OVR tiers

## RowdyRandy's System Analysis

RowdyRandy's Excel template (`Copy of Rating Tools.xlsx`) contains:

### Draft Rating Guidelines
Position-specific OVR ranges by draft tier:

| Tier | QB | HB | WR | TE | OL | EDGE | IDL | LB | CB | S | ST |
|------|----|----|----|----|----|----|-----|----|----|---|-----|
| Generational | 78-80 | 82-84 | 79-81 | 78-80 | 79-81 | 78-80 | 78-80 | 78-80 | 79-81 | 78-80 | 82-84 |
| Top 5 | 72-74 | 76-78 | 73-75 | 72-74 | 73-75 | 72-74 | 72-74 | 72-74 | 73-75 | 72-74 | 76-78 |
| Round 1 | 70-72 | 74-76 | 70-73 | 70-72 | 70-73 | 70-72 | 70-72 | 70-72 | 70-73 | 70-72 | 74-76 |
| Round 1-2 | 67-71 | 70-74 | 68-71 | 67-71 | 68-71 | 67-71 | 67-71 | 67-71 | 68-71 | 67-71 | 70-74 |
| Round 2-3 | 64-67 | 67-71 | 66-69 | 64-67 | 66-69 | 64-67 | 64-67 | 64-67 | 66-69 | 64-67 | 67-71 |
| Round 3-4 | 61-65 | 64-68 | 64-67 | 61-65 | 64-67 | 61-65 | 61-65 | 61-65 | 64-67 | 61-65 | 64-68 |
| Day 3 | 58-62 | 61-65 | 62-65 | 58-62 | 62-65 | 58-62 | 58-62 | 58-62 | 62-65 | 58-62 | 61-65 |
| UDFA | 54-59 | 57-62 | 60-63 | 54-59 | 60-63 | 54-59 | 54-59 | 54-59 | 60-63 | 54-59 | 57-62 |

**Key insights:**
- HBs rate ~4-6 points higher than QBs for same tier
- Speed positions (HB, WR, CB) get higher ratings
- Position matters more than draft slot

### What's Missing

RowdyRandy's template provides:
- ✅ Target OVR by draft tier + position
- ✅ Speed from 40-yard dash time
- ❌ Individual attribute generation (SPD, STR, ACC, AWR, etc.)

**Solution:** Reverse-engineer attributes using our existing `RatingCalculator.ts`:
1. Given target OVR + Speed
2. Generate realistic key attributes (8-10 per position)
3. Calculate remaining attributes to hit target OVR

## Architecture

### File Structure

```
src/main/services/rating-modes/
├── index.ts                          // Exports
├── RatingModeFactory.ts              // Factory pattern
├── IRatingGenerator.ts               // Interface
├── RandomRatingGenerator.ts          // Mode 1
├── HistoricalRatingGenerator.ts      // Mode 2 (wrapper for current)
├── RealisticRatingGenerator.ts       // Mode 3 (RowdyRandy)
└── data/
    ├── rowdy-randy-tiers.json        // Draft tier → OVR mappings
    └── position-attribute-ranges.json // Attribute ranges per position
```

### IRatingGenerator Interface

```typescript
export interface IRatingGenerator {
  generateRatings(player: PlayerData, context: RatingContext): Promise<PlayerRatings>;
}

export interface RatingContext {
  draftPosition?: number;      // For realistic mode
  draftRound?: number;          // For realistic mode
  careerStats?: any;            // For historical mode
  fortyTime?: number;           // For speed calculation
  position: string;             // Required
  age?: number;
}

export interface PlayerRatings {
  // All ~50 Madden ratings
  POVR: number;
  PSPD: number;
  PSTR: number;
  // ... etc
}
```

### RatingModeFactory

```typescript
export enum RatingMode {
  RANDOM = 'random',
  SEMI_HISTORICAL = 'semi-historical',
  REALISTIC = 'realistic'
}

export class RatingModeFactory {
  static create(mode: RatingMode): IRatingGenerator {
    switch (mode) {
      case RatingMode.RANDOM:
        return new RandomRatingGenerator();
      case RatingMode.SEMI_HISTORICAL:
        return new HistoricalRatingGenerator();
      case RatingMode.REALISTIC:
        return new RealisticRatingGenerator();
    }
  }
}
```

## Implementation Details

### Mode 1: Random Rating Generator

```typescript
export class RandomRatingGenerator implements IRatingGenerator {
  async generateRatings(player: PlayerData, context: RatingContext): Promise<PlayerRatings> {
    const ranges = this.getPositionRanges(context.position);

    const ratings = {};
    for (const [attr, range] of Object.entries(ranges)) {
      ratings[attr] = this.randomInRange(range.min, range.max);
    }

    // Calculate OVR using RatingCalculator
    ratings.POVR = await this.calculateOVR(ratings, context.position);

    return ratings;
  }
}
```

### Mode 2: Historical Rating Generator

Wrapper around existing scraping logic:

```typescript
export class HistoricalRatingGenerator implements IRatingGenerator {
  async generateRatings(player: PlayerData, context: RatingContext): Promise<PlayerRatings> {
    // Call existing ScraperService logic
    // Return formatted ratings
  }
}
```

### Mode 3: Realistic Rating Generator (RowdyRandy)

```typescript
export class RealisticRatingGenerator implements IRatingGenerator {
  private tiers: Map<string, DraftTier[]>; // Loaded from JSON

  async generateRatings(player: PlayerData, context: RatingContext): Promise<PlayerRatings> {
    // Step 1: Determine draft tier from position
    const tier = this.getDraftTier(context.draftPosition, context.draftRound);

    // Step 2: Get target OVR range for position + tier
    const ovrRange = this.tiers.get(context.position)?.[tier];
    const targetOVR = this.randomInRange(ovrRange.min, ovrRange.max);

    // Step 3: Generate Speed from 40 time (if available)
    const speed = context.fortyTime
      ? this.fortyTimeToSpeed(context.fortyTime)
      : this.randomInRange(70, 95);

    // Step 4: Generate key attributes using position archetype
    const keyAttrs = this.generateKeyAttributes(context.position, targetOVR, speed);

    // Step 5: Fill remaining attributes to reach target OVR
    const allRatings = this.fillRemainingAttributes(
      keyAttrs,
      targetOVR,
      context.position
    );

    return allRatings;
  }

  private getDraftTier(position: number, round: number): string {
    // Map draft position/round to tier
    if (position <= 5) return 'Top 5';
    if (round === 1) return 'Round 1';
    if (round <= 2) return 'Round 1-2';
    if (round <= 3) return 'Round 2-3';
    if (round <= 4) return 'Round 3-4';
    if (round <= 7) return 'Day 3';
    return 'UDFA';
  }

  private fillRemainingAttributes(
    keyAttrs: Partial<PlayerRatings>,
    targetOVR: number,
    position: string
  ): PlayerRatings {
    // Use RatingCalculator in reverse
    // Adjust key attributes iteratively until OVR matches target
    // Generate remaining non-OVR attributes using position ranges
  }
}
```

### Data Files

**rowdy-randy-tiers.json:**
```json
{
  "QB": {
    "Generational": { "min": 78, "max": 80 },
    "Top 5": { "min": 72, "max": 74 },
    "Round 1": { "min": 70, "max": 72 },
    ...
  },
  "HB": {
    "Generational": { "min": 82, "max": 84 },
    ...
  }
}
```

**position-attribute-ranges.json:**
```json
{
  "QB": {
    "key_attributes": ["PTAD", "PTAM", "PTAS", "PTHP", "PAWR"],
    "ranges": {
      "PTAD": { "min": 60, "max": 95 },
      "PSPD": { "min": 60, "max": 85 },
      ...
    }
  },
  "HB": {
    "key_attributes": ["PSPD", "PACC", "PAGI", "PCAR", "PBCV"],
    ...
  }
}
```

## UI Changes

### Draft Class Generator Tab (index.html)

Add radio button group before "Generate Draft Class" button:

```html
<div class="rating-mode-selector">
  <label>Rating Generation Mode:</label>
  <div class="radio-group">
    <label>
      <input type="radio" name="draftClassRatingMode" value="random">
      Random
    </label>
    <label>
      <input type="radio" name="draftClassRatingMode" value="semi-historical" checked>
      Semi-Historical (Web Scraping)
    </label>
    <label>
      <input type="radio" name="draftClassRatingMode" value="realistic">
      Realistic (RowdyRandy)
    </label>
  </div>
</div>
```

### Roster Generator Tab

Same radio button pattern.

### Styling (main.css)

```css
.rating-mode-selector {
  margin: 1rem 0;
  padding: 1rem;
  background: #2a2a2a;
  border-radius: 6px;
}

.rating-mode-selector label {
  font-weight: 500;
  margin-bottom: 0.5rem;
  display: block;
}

.radio-group {
  display: flex;
  gap: 1.5rem;
}

.radio-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}
```

## Integration Points

### DraftClassService

```typescript
async generateDraftClass(year: number, ratingMode: RatingMode) {
  const generator = RatingModeFactory.create(ratingMode);

  for (const prospect of prospects) {
    const context: RatingContext = {
      draftPosition: prospect.overallPick,
      draftRound: prospect.round,
      position: prospect.position,
      fortyTime: prospect.fortyTime
    };

    const ratings = await generator.generateRatings(prospect, context);
    Object.assign(prospect, ratings);
  }
}
```

### RosterCreatorService

Similar integration, with context adapted for historical roster data.

## Testing Strategy

1. **Unit Tests** (Jest):
   - Test each rating generator independently
   - Verify OVR calculations match expected ranges
   - Test tier mapping logic

2. **Integration Tests**:
   - Generate full draft class with each mode
   - Verify all players have valid ratings (0-99)
   - Check OVR distribution matches expected curves

3. **Manual Testing**:
   - Generate draft classes with all 3 modes
   - Compare OVR distributions
   - Verify realistic mode produces draft-tier-appropriate ratings

## Open Questions

1. **40-yard dash to Speed conversion**: Need formula (likely linear interpolation)
2. **Reverse OVR calculation**: May need iterative adjustment algorithm
3. **Dev trait assignment**: RowdyRandy uses AV; we might need simplified logic for draft classes

## Success Criteria

- ✅ User can select rating mode via radio buttons
- ✅ Random mode produces valid random ratings
- ✅ Semi-historical mode works identically to current system
- ✅ Realistic mode produces OVRs matching RowdyRandy's draft tier guidelines
- ✅ All modes work for both Draft Class and Roster generators
- ✅ No breaking changes to existing functionality

## Future Enhancements

- Allow custom tier definitions (user can upload their own Excel)
- Add "Mixed" mode (combine historical stats with realistic tiers)
- Add archetype-based generation (Speed HB vs Power HB)
