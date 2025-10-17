# Roster Generation Improvements - Session Summary

## ✅ Completed This Session

### 1. Draft Class Fixes (Committed)
- Fixed HOF tag removal from player names in MASTER_LOOKUP
- Capped rookie OVR at 80 (was 90)
- Rebuilt MASTER_LOOKUP_FINAL.csv with clean names (26,011 players)

### 2. JT-SW Roster Scraper (Committed)
- **Added**: `scrapeTeamRosterFromJTSW()` method in ScraperService.ts
- **Primary scraper**: JT-SW (cleaner HTML tables)
- **Fallback**: PFR scraper if JT-SW fails
- **Auto-removes** HOF indicators (*) from names

### 3. Team History Lookup (Committed)
- **Created**: `data/lookups/team_history.json`
- **Contains**:
  - AFL teams list (1960-1969)
  - NFL teams list (1960-1969)
  - Team relocations (Dallas Texans → KC Chiefs, etc.)
  - JT-SW to PFR team name mappings

### 4. Helper Methods Added (Not Yet Committed)
- **`calculateProRatedWAV()`**: Pro-rate career wAV based on years played so far
  - Prevents rookies from being rated as GOATs
  - Example: Tom Brady 2001 (Year 1) = 11 wAV, not 244 wAV
- **`findPlayerInMASTERLookup()`**: Find players by name + active year range
  - Searches MASTER_LOOKUP for players active in specific season
  - Falls back to draft year if From/To not available

---

## 🚧 Remaining Work - generateRoster() Improvements

The `generateRoster()` method (lines ~1680-1950 in CreatorService.ts) needs to be updated with all 7 improvements from draft class generation.

### Current Workflow
```
1. Load HOF players for year
2. Load Pro Bowl players for year
3. For each team:
   a. Scrape roster from PFR (name, position, height, weight, college, age, jersey, years pro)
   b. Scrape team stats from PFR (passing, rushing, receiving, defense)
   c. Merge stats into roster
   d. For each player:
      - Calculate ratings from stats
      - Apply HOF/Pro Bowl/Strong Stats boosts (BINARY)
      - Match PID
      - Match college
      - Generate home state
      - Determine dev trait (HOF = X-Factor, else rating-based)
   e. Pad roster to 53 players if needed
4. Generate free agents to reach 3000 total
```

### New Workflow (What Needs to Be Implemented)
```
1. Load MASTER_LOOKUP
2. Load team_history.json
3. Filter teams by AFL/NFL if year 1960-1969 and league parameter provided
4. Load HOF players for year (KEEP - still useful)
5. Load Pro Bowl players for year (KEEP - still useful)
6. For each team:
   a. **USE JT-SW SCRAPER PRIMARY** (name + position only)
   b. Scrape PFR stats as fallback
   c. For each player:
      i. **MATCH TO MASTER_LOOKUP** by name + year range
      ii. **EXTRACT FROM MASTER_LOOKUP**:
          - wAV, From, To (for pro-rating)
          - Height, Weight (if missing from scrape)
          - Race (for generic face)
          - League (for AFL/NFL filtering)
          - Draft Class (for years pro calculation)
      iii. **CALCULATE PRO-RATED wAV**:
           - totalYears = To - From + 1
           - yearsPlayed = roster_year - From + 1
           - proRatedWAV = calculateProRatedWAV(careerWAV, totalYears, yearsPlayed)
      iv. **USE HISTORICAL POSITION MAPPING**:
           - mappedPosition = mapHistoricalPosition(position, year, weight, height)
      v. **GENERATE RATINGS FROM wAV**:
           - if (proRatedWAV > 0):
               ratings = generateRatingsFromWAV(proRatedWAV, position, false)
           - else:
               ratings = ratingCalculator.calculateRatings(stats) // Fallback to stats
      vi. **CALCULATE DEV TRAIT FROM wAV**:
           - Use wAV tier instead of HOF yes/no
           - devTrait = determineDevTrait(round, pick, ratings.overall, isHOF, proRatedWAV)
      vii. **CALCULATE YEARS PRO FROM DRAFT YEAR**:
            - draftYear = entry['Draft Class']
            - yearsPro = roster_year - draftYear
      viii. **EXTRACT RACE FOR GENERIC FACE**:
             - raceData = entry['Race']
             - matchedPID = assignGenericFace(firstName, lastName, position, raceData)
   d. Pad roster to 53 if needed
7. Generate free agents
```

---

## Implementation Steps

### Step 1: Update generateRoster() Signature
```typescript
async generateRoster(
  year: number,
  teams: string[],
  maxPlayers: number = 3000,
  league?: string  // NEW: 'afl', 'nfl', or 'combined'
): Promise<GeneratedPlayer[]>
```

### Step 2: Load MASTER_LOOKUP and Team History at Start
```typescript
console.log(`[CreatorService] Generating roster for ${year} with ${teams.length} teams (league: ${league || 'all'})`);

// Load MASTER_LOOKUP
const masterLookup = this.loadMasterLookup();

// Load team history
const teamHistoryPath = path.join(__dirname, '../../data/lookups/team_history.json');
const teamHistory = JSON.parse(fs.readFileSync(teamHistoryPath, 'utf-8'));

// Filter teams by AFL/NFL if year 1960-1969
if (league && year >= 1960 && year <= 1969) {
  const aflTeams = teamHistory.afl_teams['1960-1969'];
  const nflTeams = teamHistory.nfl_teams['1960-1969'];

  if (league.toLowerCase() === 'afl') {
    teams = teams.filter(t => aflTeams.includes(t.toLowerCase()));
  } else if (league.toLowerCase() === 'nfl') {
    teams = teams.filter(t => nflTeams.includes(t.toLowerCase()));
  }
  // 'combined' means use all teams (no filtering)
}
```

### Step 3: Use JT-SW Scraper as Primary
```typescript
// Instead of:
roster = await scraperService.scrapeTeamRoster(teamAbbr, year);

// Use:
roster = await scraperService.scrapeTeamRosterFromJTSW(teamAbbr, year);
```

### Step 4: Match Players to MASTER_LOOKUP and Apply Improvements
Replace the player processing loop (lines ~1730-1850) with:

```typescript
for (let i = 0; i < roster.length; i++) {
  const playerStats = roster[i];

  // Parse name
  const nameParts = playerStats.name.split(' ');
  const firstName = nameParts[0] || 'John';
  const lastName = nameParts.slice(1).join(' ') || 'Doe';

  // **FIND PLAYER IN MASTER_LOOKUP**
  const lookupEntry = this.findPlayerInMASTERLookup(firstName, lastName, year);

  let proRatedWAV = 0;
  let weight = playerStats.weight || 0;
  let heightInches = 0;
  let raceData: string | undefined = undefined;
  let draftYear: number | undefined = undefined;

  if (lookupEntry) {
    // Extract career wAV
    const careerWAV = parseFloat(lookupEntry['wAV']) || 0;
    const from = parseInt(lookupEntry['From']) || year;
    const to = parseInt(lookupEntry['To']) || year;

    // **CALCULATE PRO-RATED wAV**
    const totalYears = to - from + 1;
    const yearsPlayed = year - from + 1;
    proRatedWAV = this.calculateProRatedWAV(careerWAV, totalYears, yearsPlayed);

    // Get height/weight from MASTER_LOOKUP if missing
    if (!weight && lookupEntry['Weight']) {
      weight = parseInt(lookupEntry['Weight']) || 0;
    }
    if (lookupEntry['Height']) {
      heightInches = parseInt(lookupEntry['Height']) || 0;
    }

    // Get race data
    raceData = lookupEntry['Race'] || undefined;

    // Get draft year for years pro calculation
    draftYear = parseInt(lookupEntry['Draft Class']) || undefined;
  }

  // **HISTORICAL POSITION MAPPING**
  const mappedPosition = this.mapHistoricalPosition(
    playerStats.position,
    year,
    weight,
    heightInches
  );

  // **GENERATE RATINGS FROM wAV (PRIMARY) OR STATS (FALLBACK)**
  let ratings: MaddenRatings;
  if (proRatedWAV > 0) {
    // Use wAV-based ratings
    ratings = this.generateRatingsFromWAV(proRatedWAV, mappedPosition.name, false);
  } else {
    // Fallback to stats-based ratings
    ratings = ratingCalculator.calculateRatings(playerStats);
  }

  // Fill missing ratings
  this.fillMissingRatings(ratings, mappedPosition.name);

  // Cap ratings by position
  this.capRatingsByPosition(ratings, mappedPosition.name);

  // **CALCULATE YEARS PRO FROM DRAFT YEAR**
  let yearsPro = 0;
  if (draftYear) {
    yearsPro = year - draftYear;
  } else if (playerStats.yearsPro !== undefined) {
    yearsPro = playerStats.yearsPro;
  } else {
    yearsPro = playerStats.age ? Math.max(0, playerStats.age - 22) : 0;
  }

  // Parse height if needed
  if (heightInches === 0 && playerStats.height) {
    heightInches = this.parseHeight(playerStats.height);
  }
  if (heightInches === 0) {
    heightInches = this.generateHeight(mappedPosition.name);
  }

  // Get weight from defaults if still missing
  if (weight === 0) {
    weight = this.getDefaultWeight(mappedPosition.name);
  }

  // Calculate age
  const age = playerStats.age || (yearsPro > 0 ? 22 + yearsPro : 22);

  // Jersey number
  const jerseyNum = playerStats.jerseyNumber || this.generateJerseyNumber(mappedPosition.name);

  // **MATCH PID WITH RACE DATA**
  let matchedPID = this.matchPID(firstName, lastName, draftYear, mappedPosition.name, playerStats.college);
  if (matchedPID === 0) {
    matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name, raceData);
  }

  // Match college
  const matchedCollege = this.matchCollege(playerStats.college || 'Unknown');

  // Generate home state
  const homeStateId = this.matchHomeState(this.generateHomeState());

  // **DETERMINE DEV TRAIT FROM wAV**
  const devTrait = this.determineDevTrait(
    undefined, // round
    undefined, // pick
    ratings.overall,
    isHOF,
    proRatedWAV  // Use pro-rated wAV instead of full career
  );

  // Convert weight to Madden format
  const maddenWeight = this.convertWeightToMaddenFormat(weight);

  // Create player
  const player: GeneratedPlayer = {
    firstName,
    lastName,
    position: mappedPosition.name,
    positionCode: mappedPosition.code,
    college: matchedCollege,
    team: teamAbbr.toUpperCase(),
    jerseyNum,
    age,
    heightInches,
    weight: maddenWeight,
    homeState: homeStateId,
    devTrait,
    ratings,
    PID: matchedPID,
    PEPS: null,
    bodyType: this.determineBodyType(mappedPosition.name, weight, heightInches),
    yearsPro,
    _sourceStats: playerStats
  };

  generatedPlayers.push(player);
}
```

### Step 5: Update IPC Handler
In `src/main/ipc/creator-handlers.ts`:

```typescript
ipcMain.handle('creator:generate-roster', async (event, year: number, teams: string[], league?: string) => {
  try {
    console.log(`[CreatorHandlers] Generating roster for ${year} (${teams.length} teams, league: ${league || 'all'})`);

    const { creatorService } = await import('../services/CreatorService');
    const players = await creatorService.generateRoster(year, teams, 3000, league);

    return {
      success: true,
      players,
      count: players.length
    };
  } catch (error: any) {
    console.error('[CreatorHandlers] Error generating roster:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
```

---

## Testing Plan

### Test 1: 1987 49ers Roster
```
Input: year=1987, teams=['sfo']
Expected:
- Jerry Rice (Year 3): OVR 72-77 (pro-rated wAV ~31)
- Joe Montana (Year 9): OVR 80-85 (pro-rated wAV ~80)
- Ronnie Lott: X-Factor dev trait (HOF tier)
```

### Test 2: 2001 Patriots Roster
```
Input: year=2001, teams=['nwe']
Expected:
- Tom Brady (Year 1): OVR 68-72 (pro-rated wAV ~11)
- NOT 90 OVR (full career wAV = 244)
```

### Test 3: 1965 Chiefs Roster (AFL)
```
Input: year=1965, teams=['kan'], league='afl'
Expected:
- Only AFL teams in roster
- Historical positions mapped (E → WR/TE/DE)
```

---

## Next Session Continuation

The helper methods are complete and ready. The main implementation work is updating the `generateRoster()` method following the pseudocode above. This is a large but straightforward refactor that applies all 7 improvements from draft class generation to roster generation.

**Estimated Lines to Change**: ~200 lines in generateRoster() method
**Complexity**: Medium (mostly applying existing patterns from draft class generation)
**Risk**: Low (all helper methods tested in draft class generation)
