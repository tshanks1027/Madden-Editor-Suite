# Draft Class Generation - Optimization Plan

## Current Problem
**Draft class generation is SLOW** because it scrapes Pro Football Reference for every player, even though we have 90%+ of the data in MASTER_LOOKUP_FINAL.csv already!

### Current Flow (SLOW):
```
User: Generate 2000 draft
↓
Scrape PFR CSV export → 241 players (30-60 seconds)
↓
Scrape HOF data (5-10 seconds)
↓
Scrape combine data (10-20 seconds)
↓
Scrape bio data for top 75 players (60-120 seconds)
↓
Process players with MASTER_LOOKUP enhancements
↓
Total: 2-4 MINUTES
```

## Proposed Solution

### New Flow (FAST):
```
User: Generate 2000 draft
↓
Load from MASTER_LOOKUP_FINAL.csv → 241 players (INSTANT!)
↓
Check for missing data (height/weight for recent players)
↓
Fallback scrape ONLY for missing data (5-10 seconds for ~10-20 players)
↓
Process players with all enhancements
↓
Total: 5-15 SECONDS (90%+ faster!)
```

---

## What We Have in MASTER_LOOKUP

### Columns Available:
- ✅ **Last Name** - Always present
- ✅ **First Name** - Always present
- ✅ **College/Univ** - 95%+ coverage
- ✅ **Round** - Always present (except 1960 AFL)
- ✅ **Pick** - Always present (except 1960 AFL)
- ✅ **Draft Class** - Always present
- ✅ **Position** - Always present
- ✅ **PhotoID** - 40%+ coverage (for players with custom faces)
- ✅ **Player Assets ID** - 10%+ coverage (PAM folders)
- ❌ **CommID** - Sparse
- ❌ **PLPO** - Sparse
- ⚠️ **Height** - 60%+ coverage (inches format)
- ⚠️ **Weight** - 60%+ coverage (lbs)
- ✅ **From** - First year played (60%+ coverage)
- ✅ **To** - Last year played (80%+ coverage)
- ✅ **AP1** - All-Pro selections (80%+ coverage)
- ✅ **PB** - Pro Bowl selections (80%+ coverage)
- ✅ **St** - Starts (60%+ coverage)
- ✅ **wAV** - Career wAV (90%+ coverage) **← KEY METRIC**
- ✅ **League** - NFL/AFL (100% for 1960-1969)
- ❌ **Race** - Empty (0% coverage)
- ❌ **Home State** - Sparse
- ❌ **Wiki_Image_URL** - Sparse
- ❌ **PFR_Image_URL** - Sparse

### What's MISSING (Need Scraping Fallback):
- **Height/Weight** for ~40% of players (especially recent 2000+ drafts)
- **Home State** (can generate randomly)
- **Race** (can use position-based probability)
- **Jersey Numbers** (can generate by position)
- **Age** (can calculate from draft year: typically 21-23)

---

## Implementation Plan

### New Method: `generateDraftClassFromLookup()`

```typescript
async generateDraftClassFromLookup(
  year: number,
  testingMode: boolean = false,
  league?: string
): Promise<GeneratedPlayer[]> {

  console.log(`[CreatorService] Generating ${year} draft from MASTER_LOOKUP (FAST MODE)`);

  // STEP 1: Load ALL players from MASTER_LOOKUP for this year (INSTANT)
  const masterLookup = this.loadMasterLookup();
  const draftProspects: DraftProspect[] = [];

  masterLookup.forEach((entry, key) => {
    if (entry['Draft Class'] === String(year)) {
      // Apply league filter if needed (1960-1969)
      if (league && year >= 1960 && year <= 1969) {
        if (entry['League']?.toUpperCase() !== league.toUpperCase()) {
          return; // Skip this player
        }
      }

      draftProspects.push({
        name: `${entry['First Name']} ${entry['Last Name']}`,
        position: entry['Position'],
        round: parseInt(entry['Round']) || undefined,
        pick: parseInt(entry['Pick']) || undefined,
        college: entry['College/Univ'],
        height: entry['Height'] ? `${Math.floor(entry['Height'] / 12)}-${entry['Height'] % 12}` : undefined,
        weight: parseInt(entry['Weight']) || undefined,
        // Career stats from MASTER_LOOKUP
        careerGames: parseInt(entry['St']) || undefined,
        careerAV: parseFloat(entry['wAV']) || undefined,
        // HOF status (if AP1 > 0 or wAV > 150, likely HOF)
        isHallOfFamer: (parseInt(entry['AP1']) > 0 || parseFloat(entry['wAV']) > 150)
      });
    }
  });

  console.log(`[CreatorService] Loaded ${draftProspects.length} players from MASTER_LOOKUP`);

  // STEP 2: Identify players missing critical data
  const missingData = draftProspects.filter(p => !p.height || !p.weight);
  console.log(`[CreatorService] ${missingData.length} players missing height/weight`);

  // STEP 3: Fallback scrape ONLY for missing data (if any)
  if (missingData.length > 0 && !testingMode) {
    console.log(`[CreatorService] Scraping missing data for ${missingData.length} players...`);

    // Scrape combine data (has height/weight for recent drafts)
    const combineData = await scraperService.scrapeCombineData(year);

    for (const prospect of missingData) {
      const combMeasurements = combineData.get(prospect.name);
      if (combMeasurements) {
        prospect.height = combMeasurements.height;
        prospect.weight = combMeasurements.weight;
      }
    }

    const stillMissing = draftProspects.filter(p => !p.height || !p.weight).length;
    console.log(`[CreatorService] After scraping, ${stillMissing} players still missing data (will use defaults)`);
  }

  // STEP 4: Process players (same as existing logic)
  const generatedPlayers: GeneratedPlayer[] = [];

  for (const prospect of draftProspects) {
    // Parse name
    const nameParts = prospect.name.split(' ');
    const firstName = nameParts[0] || 'John';
    const lastName = nameParts.slice(1).join(' ') || 'Doe';

    // Get full MASTER_LOOKUP entry for this player
    const lookupKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()} ${year}`;
    const lookupEntry = masterLookup.get(lookupKey);

    // Extract wAV
    let wAV: number | undefined;
    if (lookupEntry && lookupEntry['wAV']) {
      wAV = parseFloat(lookupEntry['wAV']);
    }

    // Get weight and height from lookup
    let weight = prospect.weight || 0;
    let heightInches = 0;

    if (lookupEntry) {
      if (lookupEntry['Weight']) {
        weight = parseInt(lookupEntry['Weight']) || weight;
      }
      if (lookupEntry['Height']) {
        heightInches = parseInt(lookupEntry['Height']) || heightInches;
      }
    }

    // Map position with historical support
    const mappedPosition = this.mapHistoricalPosition(
      prospect.position,
      year,
      weight,
      heightInches
    );

    // Generate ratings using wAV-based tier system
    let ratings: MaddenRatings;
    if (wAV !== undefined && wAV > 0) {
      ratings = this.generateRatingsFromWAV(wAV, mappedPosition.name, prospect.isHallOfFamer);
    } else {
      ratings = this.generateDefaultRatings(prospect);
    }

    // Fill missing ratings
    this.fillMissingRatings(ratings, mappedPosition.name);

    // Cap ratings by position
    this.capRatingsByPosition(ratings, mappedPosition.name);

    // Use defaults if height/weight still missing
    if (heightInches === 0) {
      heightInches = prospect.height
        ? this.parseHeight(prospect.height)
        : this.generateHeight(mappedPosition.name);
    }

    if (weight === 0) {
      weight = this.getDefaultWeight(mappedPosition.name);
    }

    // Calculate age (draft prospects are typically 21-23)
    const age = this.calculateAge(year, prospect.round);

    // Generate jersey number
    const jerseyNum = this.generateJerseyNumber(mappedPosition.name);

    // Match PID
    let matchedPID = this.matchPID(
      firstName,
      lastName,
      year,
      mappedPosition.name,
      prospect.college
    );

    // Get race data for generic face
    const raceData = lookupEntry ? lookupEntry['Race'] : undefined;

    if (matchedPID === 0) {
      matchedPID = this.assignGenericFace(firstName, lastName, mappedPosition.name, raceData);
    }

    // Match college
    const matchedCollege = this.matchCollege(prospect.college || 'Unknown');

    // Generate home state
    const homeStateId = this.matchHomeState(this.generateHomeState());

    // Determine dev trait using wAV
    const devTrait = this.determineDevTrait(
      prospect.round,
      prospect.pick,
      ratings.overall,
      prospect.isHallOfFamer,
      wAV
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
      yearsPro: 0,
      _sourceStats: undefined
    };

    generatedPlayers.push(player);
  }

  console.log(`[CreatorService] Generated ${generatedPlayers.length} players in ${Date.now() - startTime}ms`);

  return generatedPlayers;
}
```

---

## Benefits

### Speed Improvement:
- **Before**: 2-4 minutes (heavy scraping)
- **After**: 5-15 seconds (90%+ faster)

### Data Quality:
- **Same or better** - using authoritative wAV, career stats from PFR database
- **More complete** - 26,034 players vs scraped subset

### Reliability:
- **No web scraping failures** for 90%+ of players
- **No rate limiting** from PFR
- **Works offline** (if MASTER_LOOKUP is cached)

---

## Fallback Strategy

### When to Scrape:
1. **Missing height/weight** for recent players (2000+)
   - Scrape combine data only
   - 5-10 seconds for entire draft class

2. **Missing college** (rare, but possible)
   - Use "Unknown" default

3. **User explicitly requests full scrape** (legacy mode)
   - Add `fullScrape: boolean` parameter
   - If true, use old `generateDraftClass()` method

---

## Migration Plan

### Phase 1: Add New Method (This Session)
- Create `generateDraftClassFromLookup()`
- Keep existing `generateDraftClass()` as fallback
- Test with 1936, 1965, 1987, 2000, 2024 drafts

### Phase 2: Switch Default (Next Session)
- Update IPC handler to call new method by default
- Add UI toggle for "Legacy Mode" (full scrape)
- Document performance improvements

### Phase 3: Deprecate Old Method (Future)
- Mark `generateDraftClass()` as deprecated
- Only use for edge cases or missing data

---

## Testing Plan

### Test Cases:
1. **1936 Draft** (oldest, historical positions)
   - Expected: Instant load, historical position mapping works

2. **1965 Draft** (AFL/NFL split)
   - Expected: Instant load, league filtering works

3. **1987 Draft** (HOF players like Jerry Rice)
   - Expected: Instant load, wAV-based ratings work

4. **2000 Draft** (combine data era)
   - Expected: Instant load, minimal scraping for height/weight

5. **2024 Draft** (most recent)
   - Expected: Instant load, some scraping for recent combine data

---

## Expected Results

### Performance Metrics:
```
1936 Draft: 241 players
- Old method: 120-180 seconds
- New method: 2-5 seconds (97% faster)

2000 Draft: 241 players
- Old method: 150-240 seconds
- New method: 5-15 seconds (95% faster, ~20 scraped for height/weight)

2024 Draft: 257 players
- Old method: 180-300 seconds
- New method: 10-20 seconds (94% faster, ~50 scraped for combine data)
```

### Accuracy:
- **Same or better** - using wAV directly from PFR database
- **More consistent** - no scraping errors or timeouts
- **Complete** - all 26,034 players available

---

## Next Steps

1. Implement `generateDraftClassFromLookup()` method
2. Update IPC handler to route to new method
3. Test with 5 draft years
4. Document performance improvements
5. Add UI toggle for legacy mode (optional)
