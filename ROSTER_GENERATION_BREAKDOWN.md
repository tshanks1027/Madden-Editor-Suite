# ROSTER GENERATION - Complete Logic Breakdown

## Overview
**Method**: `generateRoster(year: number, teams: string[], maxPlayers: number = 3000)`
**Purpose**: Generate complete historical rosters by scraping Pro Football Reference for team rosters and player stats
**Output**: ~3000 players (53 per team + free agents)

---

## Current Workflow

### Phase 1: Pre-Processing (Lines 1289-1302)

#### Step 1.1: Load Hall of Fame Players
```typescript
const hofPlayers = await scraperService.getHOFPlayersByYear(year);
// Returns: Map<string, boolean> with player names who were active in this year
```

**Purpose**: Identify HOF players for rating boosts and X-Factor dev traits

#### Step 1.2: Load HOF Lookup Data
```typescript
(scraperService as any).loadHOFLookup();
const hofLookup = (scraperService as any).hofLookup;
```

**Purpose**: Get HOF player college data (more accurate than scraped data)

#### Step 1.3: Load Pro Bowl Players
```typescript
const proBowlers = await scraperService.scrapeProBowl(year);
// Returns: Map<string, boolean> with Pro Bowl players for this year
```

**Purpose**: Apply Pro Bowl rating boosts (80-90 OVR tier)

---

### Phase 2: Team Roster Generation (Lines 1304-1674)

**For each team in teams array:**

#### Step 2.1: Check Team Existence
```typescript
const teamExisted = scraperService.teamExistedInYear(teamAbbr, year);
```

**Outcomes:**
- **Team DID NOT exist** → Generate 53 fictional players with 30-40 OVR (for retro franchise mode)
- **Team DID exist** → Proceed to scraping

#### Step 2.2: Scrape Team Roster (if team existed)
```typescript
roster = await scraperService.scrapeTeamRoster(teamAbbr, year);
// Returns: Array of PlayerStats with basic info
```

**Data scraped:**
- Name
- Position
- Height (e.g., "6-3")
- Weight (lbs)
- College
- Age
- Jersey number
- Years Pro

**Fallback**: If 0 players returned, generate 53 fictional players

#### Step 2.3: Scrape Team Stats
```typescript
const teamStats = await scraperService.scrapeTeamStats(teamAbbr, year);
// Returns: Map<string, PlayerStats> with stats by player name
```

**Data scraped:**
- **Passing**: completions, attempts, yards, TDs, INTs
- **Rushing**: attempts, yards, TDs
- **Receiving**: receptions, yards, TDs, targets
- **Defense**: tackles, sacks, forced fumbles, INTs, pass deflections

#### Step 2.4: Merge Stats into Roster
```typescript
for (const player of roster) {
  const stats = teamStats.get(player.name);
  if (stats) {
    // Merge all stats into player object
    player.passCompletions = stats.passCompletions;
    // ... etc
  }
}
```

**Result**: ~60-80% of roster gets stats merged (starters + backups with playing time)

---

### Phase 3: Player Processing (Lines 1430-1598)

**For each player in roster:**

#### Step 3.1: Parse Player Data
- Extract first name / last name
- Check if HOF (for college lookup and boost)
- Get college (prefer HOF data if available)
- Map position to modern Madden position

#### Step 3.2: Calculate Ratings
```typescript
const ratings = isNonExistentTeam
  ? this.generateFillerRatings(mappedPosition.name, true) // 30-40 OVR
  : ratingCalculator.calculateRatings(playerStats); // Stats-based ratings
```

**Rating Calculator Logic** (from `RatingCalculator.ts`):
- Uses player stats to calculate position-appropriate ratings
- Passing stats → THP, TAS, TAM, TAD, etc.
- Rushing stats → CAR, BCV, BTK, TRK, etc.
- Receiving stats → CTH, CIT, SPC, SRR, etc.
- Defense stats → TAK, HTP, PMV, BSH, MCV, ZCV, etc.

#### Step 3.3: Apply Rating Boosts (Tiered System)

**Tier 1: Hall of Famers (85-99 OVR)**
```typescript
if (isHOF) {
  this.applyHOFBoost(ratings, mappedPosition.name, playerStats);
  devTrait = 3; // X-Factor
}
```

**Tier 2: Pro Bowlers (80-90 OVR)**
```typescript
else if (isProBowler) {
  this.applyProBowlBoost(ratings, mappedPosition.name, playerStats);
}
```

**Tier 3: Strong Stats (75-85 OVR)**
```typescript
else if (this.hasStrongStats(playerStats, mappedPosition.name)) {
  this.applyStrongStatsBoost(ratings, mappedPosition.name);
}
```

**Tier 4: Average/Backup Players**
- No boost applied
- Ratings remain as calculated (65-75 OVR typically)

**Tier 5: Weak/No Stats**
- Ratings remain low (50-65 OVR)

#### Step 3.4: Match Player Portrait (PID)
```typescript
let matchedPID = this.matchPID(firstName, lastName, undefined, mappedPosition.name, collegeName);

if (matchedPID === 0) {
  matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name);
}
```

**Notes:**
- No draft year available (unlike draft class generation)
- Generic face assignment uses position-based probability

#### Step 3.5: Create GeneratedPlayer Object
```typescript
const player: GeneratedPlayer = {
  firstName, lastName,
  position: mappedPosition.name,
  positionCode: mappedPosition.code,
  college: matchedCollege,
  team: teamAbbr.toUpperCase(),
  jerseyNum, age, heightInches, weight: maddenWeight,
  homeState: homeStateId,
  devTrait, ratings,
  PID: matchedPID,
  PEPS: null,
  bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
  yearsPro,
  _sourceStats: playerStats
};
```

---

### Phase 4: Roster Padding (Lines 1600-1674)

**If team has <53 players:**
```typescript
const playersNeeded = targetRosterSize - teamPlayerCount;
const fillerRoster = this.generateFictionalRoster(teamAbbr, playersNeeded);
```

**Filler Player Generation:**
- Randomly generated names
- Position-appropriate height/weight
- Low ratings (50-65 OVR)
- Dev trait: 15% Star for young players (age ≤23), otherwise Normal

---

### Phase 5: Free Agent Pool (Lines 1687-1774)

```typescript
const freeAgentsNeeded = Math.max(0, targetTotalPlayers - teamPlayerCount);
```

**Purpose**: Pad roster to maxPlayers (3000) to match template roster size

**Free Agent Generation:**
- Randomly generated names
- Varied positions
- Low ratings (50-70 OVR)
- Dev trait: 10% Star for young FAs (age ≤23)
- Team code: 'FA'
- Years Pro: 0-2 randomly

---

## Data Sources

### Pro Football Reference (PFR)
- **Team Roster Page**: Basic player info (name, position, height, weight, college, age, jersey, years pro)
- **Team Stats Page**: Season stats (passing, rushing, receiving, defense)
- **Pro Bowl Page**: List of Pro Bowl selections for the year

### Internal Lookups
- **HOF Lookup**: Hall of Fame player data with accurate college info
- **PID Lookup**: Player portrait IDs (matched by name + position + college)
- **College Lookup**: Valid Madden college IDs
- **Home State Lookup**: US state codes
- **Generic Face Mapping**: PID_Portrait_Mapping.csv for generic faces

---

## Current Problems & Limitations

### 1. **No MASTER_LOOKUP Integration**
- **Problem**: Not using the 26,034-player MASTER_LOOKUP database
- **Impact**: Missing wAV data, league info, height/weight for older players
- **Solution**: Integrate MASTER_LOOKUP like draft class generation

### 2. **Position Mapping Issues**
- **Problem**: No historical position mapping for pre-1990 rosters
- **Impact**: Players with "B", "E", "T" positions get incorrect modern positions
- **Solution**: Use `mapHistoricalPosition()` instead of `mapPosition()`

### 3. **Rating System Issues**
- **Problem**: Rating boosts are binary (HOF/Pro Bowl/Strong Stats/None)
- **Impact**: Can't differentiate between elite HOFers (Jerry Rice) vs good HOFers
- **Solution**: Use wAV-based rating tiers like draft class generation

### 4. **No Race Detection**
- **Problem**: Generic face assignment uses position-based probability only
- **Impact**: Less accurate generic face assignment
- **Solution**: Add raceData parameter from MASTER_LOOKUP

### 5. **No League Filtering**
- **Problem**: Can't generate AFL-only or NFL-only rosters for 1960-1969
- **Impact**: Can't create authentic AFL rosters
- **Solution**: Add league parameter and filtering logic

### 6. **Dev Trait Logic**
- **Problem**: HOF = X-Factor, otherwise rating-based
- **Impact**: Doesn't account for career performance (wAV)
- **Solution**: Use wAV-based dev trait calculation

### 7. **Years Pro Calculation**
- **Problem**: Estimated from age (age - 22) when not scraped
- **Impact**: Inaccurate for late-blooming players
- **Solution**: Calculate from draft year in MASTER_LOOKUP

---

## Proposed Improvements (Same as Draft Class)

### 1. **Integrate MASTER_LOOKUP**
- Load MASTER_LOOKUP at start of roster generation
- Use for wAV, height, weight, league, race data
- Match players by name + year (season year)

### 2. **Add wAV-Based Rating Tiers**
- Replace binary rating boosts with 7-tier wAV system
- HOF Legend (150+), Elite (100-149), Pro Bowl (60-99), etc.
- Position scaling (QB 1.05x, K/P 0.95x)

### 3. **Historical Position Mapping**
- Use `mapHistoricalPosition()` for pre-1990 rosters
- Weight/height-based disambiguation for "B", "E", "T" positions

### 4. **Race Detection**
- Extract Race from MASTER_LOOKUP
- Pass to `assignGenericFace()` for accurate generic faces

### 5. **AFL/NFL League Filtering**
- Add league parameter to `generateRoster()`
- Filter teams by league in 1960-1969

### 6. **wAV-Based Dev Trait**
- Use wAV tier for dev trait calculation
- HOF tier → X-Factor, Elite tier → 70% X-Factor, etc.

### 7. **Calculate Years Pro from MASTER_LOOKUP**
- Get draft year from MASTER_LOOKUP
- Calculate: yearsPro = season_year - draft_year
- More accurate than age estimation

---

## Expected Improvements

### Current Results:
- Jerry Rice (1987): 82 OVR, X-Factor (HOF boost)
- Tom Brady (2001): 78 OVR, Normal (no HOF status yet)
- JaMarcus Russell (2007): 72 OVR, Normal

### After wAV Integration:
- Jerry Rice (1987, wAV 208): 88-90 OVR, X-Factor (HOF Legend tier)
- Tom Brady (2001, wAV 244): 65-70 OVR, Star (early career, low wAV so far)
- JaMarcus Russell (2007, wAV 2): 58-63 OVR, Normal (bust tier)

**Accuracy**: Career performance directly informs ratings instead of binary HOF/non-HOF

---

## Testing Plan

### Test 1: 1987 49ers Roster
**Expected**:
- Jerry Rice: 88-90 OVR, X-Factor
- Joe Montana: 85-88 OVR, X-Factor
- Ronnie Lott: 85-88 OVR, X-Factor
- Position: All modern positions correct

### Test 2: 1965 Chiefs Roster (AFL)
**Expected**:
- League filter: AFL only
- Historical positions: "E" (End) mapped to WR/TE based on weight
- wAV-based ratings for career veterans

### Test 3: 1940 Bears Roster
**Expected**:
- Historical positions: "B" → HB/QB/FB (weight-based)
- "E" → WR/TE/DE (weight-based)
- "T" → OT/DT (weight-based)

### Test 4: 2007 Raiders Roster
**Expected**:
- JaMarcus Russell: 58-63 OVR, Normal (wAV 2 = bust tier)
- Randy Moss: 85-88 OVR, X-Factor (wAV 208)

---

## Files to Modify

1. **src/main/services/CreatorService.ts**:
   - Update `generateRoster()` to load MASTER_LOOKUP
   - Add wAV extraction and rating tier logic
   - Use `mapHistoricalPosition()` instead of `mapPosition()`
   - Add race data extraction
   - Add league filtering
   - Update dev trait calculation to use wAV
   - Calculate yearsPro from draft year

2. **src/main/ipc/creator-handlers.ts**:
   - Update IPC handler to accept league parameter

---

## Next Steps

1. Apply same 4 improvements from draft class generation to roster generation
2. Test with 1987, 1965, 1940, 2007 rosters
3. Validate rating accuracy vs real player careers
