# Roster Generation Improvements - Remaining Work

## ✅ Completed
1. **Team History Lookup** - AFL/NFL teams, relocations, name mappings
2. **JT-SW Scraper** - Primary scraper with PFR fallback

## 🚧 In Progress - Need to Complete

### 1. wAV Pro-Rating Formula (Years-In Adjustment)
**Problem**: Can't use full career wAV for historical rosters (Tom Brady 2001 shouldn't be rated as GOAT)

**Solution**: Pro-rate wAV based on years played so far
```typescript
// Calculate pro-rated wAV for a player at a specific point in their career
private calculateProRatedWAV(
  careerWAV: number,
  totalYears: number,
  yearsPlayed: number
): number {
  const wAVPerYear = careerWAV / totalYears;
  return wAVPerYear * yearsPlayed;
}
```

**Example**:
- Tom Brady 2001 (Year 1): 244 wAV / 23 years = 10.6 per year → Year 1 = 11 wAV → 68-72 OVR ✅
- Tom Brady 2007 (Year 7): 10.6 * 7 = 74 wAV → 80-85 OVR ✅
- Jerry Rice 1987 (Year 3): 208 wAV / 20 years = 10.4 per year → Year 3 = 31 wAV → 72-77 OVR ✅

**How to get totalYears and yearsPlayed**:
- From MASTER_LOOKUP: `From` (first year) and `To` (last year) columns
- totalYears = To - From + 1
- yearsPlayed = roster_year - From + 1

---

### 2. Apply All 7 Roster Improvements

#### A. MASTER_LOOKUP Integration
**Location**: `CreatorService.ts` - `generateRoster()` method

**Changes Needed**:
1. Load MASTER_LOOKUP at start of roster generation
2. Match scraped players to MASTER_LOOKUP by name
3. Extract: wAV, From, To, Height, Weight, League, Race, Draft Class

```typescript
// After scraping roster from JT-SW/PFR
for (const player of roster) {
  const lookupKey = `${player.firstName.toLowerCase()} ${player.lastName.toLowerCase()}`;

  // Search MASTER_LOOKUP for this player
  const lookupEntry = this.findPlayerInMASTERLookup(lookupKey, year);

  if (lookupEntry) {
    // Get career wAV and pro-rate it
    const careerWAV = parseFloat(lookupEntry['wAV']) || 0;
    const from = parseInt(lookupEntry['From']) || year;
    const to = parseInt(lookupEntry['To']) || year;
    const totalYears = to - from + 1;
    const yearsPlayed = year - from + 1;

    const proRatedWAV = this.calculateProRatedWAV(careerWAV, totalYears, yearsPlayed);

    // Use pro-rated wAV for rating calculation
    ratings = this.generateRatingsFromWAV(proRatedWAV, position, false);
  }
}
```

#### B. Historical Position Mapping
**Location**: Same as A

**Changes Needed**:
- Use `mapHistoricalPosition()` instead of `mapPosition()`
- Pass weight + height from MASTER_LOOKUP for disambiguation

#### C. wAV-Based Rating Tiers
**Location**: Same as A

**Changes Needed**:
- Remove binary HOF/Pro Bowl/Strong Stats boosts
- Use `generateRatingsFromWAV()` with pro-rated wAV
- Apply position scaling (QB 1.05x, K/P 0.95x)

#### D. Race Detection
**Location**: Same as A

**Changes Needed**:
- Extract Race from MASTER_LOOKUP
- Pass to `assignGenericFace()`

#### E. wAV-Based Dev Trait
**Location**: Same as A

**Changes Needed**:
- Replace HOF = X-Factor logic
- Use wAV tier for dev trait (HOF tier → X-Factor, Elite → 70% X-Factor, etc.)

#### F. Calculate Years Pro from Draft Year
**Location**: Same as A

**Changes Needed**:
```typescript
// Get draft year from MASTER_LOOKUP
const draftYear = parseInt(lookupEntry['Draft Class']) || undefined;
if (draftYear) {
  yearsPro = year - draftYear;
} else {
  // Fallback to age estimation
  yearsPro = age > 22 ? age - 22 : 0;
}
```

#### G. AFL/NFL League Filtering
**Location**: `CreatorService.ts` - `generateRoster()` method signature

**Changes Needed**:
1. Add `league?: string` parameter to `generateRoster()`
2. Load team_history.json
3. Filter teams by AFL/NFL for 1960-1969
4. Filter players by League field in MASTER_LOOKUP

---

### 3. Update IPC Handler

**Location**: `src/main/ipc/creator-handlers.ts`

**Changes Needed**:
```typescript
ipcMain.handle('creator:generate-roster', async (event, year: number, teams: string[], league?: string) => {
  try {
    const { creatorService } = await import('../services/CreatorService');
    const players = await creatorService.generateRoster(year, teams, 3000, league);
    // ...
  }
});
```

---

## Testing Plan

### Test 1: 1987 49ers Roster
**Expected**:
- Jerry Rice (Year 3): 72-77 OVR (pro-rated wAV ~31)
- Joe Montana (Year 9): 80-85 OVR (pro-rated wAV ~80)
- Use JT-SW as primary scraper

### Test 2: 2001 Patriots Roster
**Expected**:
- Tom Brady (Year 1): 68-72 OVR (pro-rated wAV ~11)
- NOT 90 OVR (his final career rating)

### Test 3: 1965 Chiefs Roster (AFL)
**Expected**:
- League filter: AFL only
- Historical positions mapped correctly

---

## Implementation Order

1. Add `calculateProRatedWAV()` helper method
2. Add `findPlayerInMASTERLookup()` helper method (searches by name + year range)
3. Update `generateRoster()` to:
   - Accept league parameter
   - Use JT-SW scraper as primary
   - Load MASTER_LOOKUP
   - Match players to MASTER_LOOKUP
   - Calculate pro-rated wAV
   - Use wAV-based rating tiers
   - Apply historical position mapping
   - Extract race data
   - Calculate years pro from draft year
4. Update IPC handler to pass league parameter
5. Test with all 3 test cases

---

## Files to Modify

1. `src/main/services/CreatorService.ts` - Main roster generation logic
2. `src/main/ipc/creator-handlers.ts` - IPC handler for league parameter
3. Test files (after implementation)

---

## Notes

- **JT-SW scraper already implemented** ✅
- **Team history lookup already created** ✅
- **All helper methods from draft class generation can be reused** (mapHistoricalPosition, generateRatingsFromWAV, mapRaceToCategory, etc.)
- **Main work is integrating everything into generateRoster()** and adding pro-rating logic
