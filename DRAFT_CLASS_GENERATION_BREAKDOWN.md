# Draft Class Generation Logic - Current Implementation

## Overview
The draft class generation system scrapes data from Pro-Football-Reference.com and converts it into Madden-ready player files. The process combines web scraping, data enrichment, rating calculation, and lookup matching.

**Location**: `src/main/services/CreatorService.ts` - `generateDraftClass()` method (lines 669-921)

---

## Current Workflow (Step-by-Step)

### Step 1: Scrape Drafted Players (CSV Export)
**Method**: `scraperService.scrapeDraftClassCSV(year)`
- Scrapes PFR draft page CSV export (MUCH faster than HTML parsing)
- Gets all drafted players (rounds 1-7, typically ~250-260 players)
- **Data Retrieved**:
  - Name
  - Position
  - Round & Pick
  - College
  - Team (drafting team)
  - Career Stats: Games (G), Starts (St), Approximate Value (wAV), ProBowls (PB), All-Pro (AP1)

### Step 2: Enrich with Hall of Fame Data
**Method**: `scraperService.scrapeHOFFromWikipedia(year)`
- Scrapes Wikipedia HOF list
- Creates Map: playerName -> isHOF (boolean)
- **Purpose**: Mark HOF players for special treatment (X-Factor dev trait, stat boosts)
- **Bonus**: HOF data includes height, weight, homeState (saves scraping time!)

### Step 3: Merge Combine Data (2000+)
**Method**: `scraperService.scrapeCombineData(year)`
- Scrapes PFR combine results (2000+ only)
- Gets **REAL** height/weight measurements
- **Data Retrieved**:
  - Height (e.g., "6-3")
  - Weight (lbs)
  - 40-yard dash, bench press, etc. (currently unused)

### Step 4: Scrape Bio Data (HOF + Top 75)
**Method**: `scraperService.scrapePlayerBio(prospect.name)`
- **Priority 1**: All Hall of Famers (must be accurate!)
- **Priority 2**: Top 75 players by career stats
  - Scoring formula: `(Games × 1) + (Starts × 2) + (AV × 5)`
  - Catches late-round gems like Tom Brady (R6, Pick 199)
- **Data Retrieved**:
  - Home State (birthplace city/state)
  - Height/Weight (if not from combine)

### Step 5: Limit Players (Testing Mode)
- **Production**: All ~250-260 drafted players
- **Testing Mode**: 5 players per round × 7 rounds = 35 players

### Step 6: Scrape UDFAs (Undrafted Free Agents)
**Method**: `scraperService.scrapeUndraftedFreeAgents(year)`
- Scrapes players who went undrafted but signed with teams
- Typically 30-50 notable UDFAs per year
- **Testing Mode**: Limited to 3 UDFAs

### Step 7: Generate Filler Players
**Method**: `generateFillerPlayers(count, year)`
- Target total: **400 players** (production) or **40** (testing)
- Fills roster with generic players (random names, positions, ratings)
- **Purpose**: Madden requires 380-400 prospects for draft classes

### Step 8: Convert to Madden Players
**For each prospect** (drafted + UDFA + filler):

#### 8A. Map Position
`mapPosition(prospect.position)` → Returns:
- `name`: Madden position (e.g., "HB", "LEDG", "SAM")
- `code`: Position ID (0-21)

**Example mappings**:
- RB/HB → HB (code 1)
- DE → LEDG (code 10) or REDG (code 11)
- LB/OLB → SAM (code 13)

#### 8B. Generate Ratings
**Two paths**:

1. **If has career stats** (Games, wAV, etc.):
   - `ratingCalculator.calculateRatings(stats)` - Converts career stats to Madden ratings
   - See `RatingCalculator.ts` for formulas

2. **If no stats** (late-round picks, UDFAs):
   - `generateDefaultRatings(prospect)` - Based on draft position
   - Example: Round 1 Pick 1 = ~78-82 OVR, Round 7 = ~58-65 OVR

**Post-processing**:
- `fillMissingRatings()` - Ensures no blank ratings (default 30, or 1 for kickReturn)
- `capRatingsByPosition()` - Caps rookie ratings (no 99 OVR rookies!)

#### 8C. Parse Name
```javascript
const nameParts = prospect.name.split(' ');
const firstName = nameParts[0] || 'John';
const lastName = nameParts.slice(1).join(' ') || 'Doe';
```

#### 8D. Generate Jersey Number
`generateJerseyNumber(position)` - Realistic by position:
- QB: 1-19
- RB: 20-49
- WR/TE: 10-19, 80-89
- OL: 50-79
- DL/LB: 40-59, 90-99
- DB: 20-49
- K/P: 1-19

#### 8E. Calculate Age
`calculateAge(year, round)` - Rookies are typically 21-23:
- Round 1-2: 21-22 (younger prospects)
- Round 3-5: 22-23
- Round 6-7: 23-24 (often older)

#### 8F. Parse/Generate Height
```javascript
const heightInches = prospect.height
  ? parseHeight(prospect.height)    // "6-3" → 75 inches
  : generateHeight(position);       // Position default (e.g., QB 75", RB 70")
```

#### 8G. Get/Validate Weight
- If scraped weight is unrealistic (>400, <150, or 0):
  - Use `getDefaultWeight(position)` (e.g., QB 220, DT 310)
- Convert to Madden format: `actualWeight - 160` (Madden stores offset)

#### 8H. Match PID (Portrait ID)
**Method**: `matchPID(firstName, lastName, year, position, college)`

**Current Logic** (uses FullData_Lookup.csv):
1. Find all candidates with matching first+last name
2. If 1 match → Use it
3. If multiple matches → Disambiguate:
   - **Strategy 1**: Match by year + position
   - **Strategy 2**: Match by year only
   - **Strategy 3**: Match by position only
   - **Strategy 4**: Use first candidate (fallback)
4. If no match → `assignGenericFace()` (see below)

**⚠️ PROBLEM**: FullData_Lookup.csv only has ~14,879 players (incomplete)

#### 8I. Assign Generic Face (if no real PID)
**Method**: `assignGenericFace(firstName, lastName, position)`

**Logic**:
- Uses NFL demographics to assign race-appropriate generic face
- **Position-based probability**:
  - QB/K/P: 50% White (Category 1), 50% Black (Category 7)
  - OL/TE: 40% White, 60% Black/Mixed
  - Skill positions (WR/RB/CB/S): 70% Black-Medium, 15% Black-Light, 10% Black-Dark, 5% Mixed

**Generic Face Categories**:
- Category 1: 41 Caucasian faces
- Category 2: 63 African American Light faces
- Category 3: 38 African American Dark faces
- Category 5: 94 Hispanic/Latino faces
- Category 6: 98 Mixed/Multi-Racial faces
- Category 7: 164 African American Medium faces (default)

**Returns**: Random PID from `PID_Portrait_Mapping.csv` matching the target portrait

#### 8J. Match College
**Method**: `matchCollege(collegeName)`
- Fuzzy matches college name to college ID
- Uses `college_lookup.csv` (e.g., Alabama = 4, No College = 265)

#### 8K. Match/Generate Home State
```javascript
const generatedState = generateHomeState(); // Random state (weighted by population)
const homeStateId = prospect.homeState?.trim()
  ? matchHomeState(prospect.homeState)  // Convert scraped state to ID
  : matchHomeState(generatedState);     // Use generated state
```

**Returns**: State ID (e.g., 0 for Alabama, 4 for California)

#### 8L. Determine Dev Trait
**Method**: `determineDevTrait(round, pick, overall, isHOF)`

**Logic**:
- **X-Factor** (3): Hall of Famers ONLY
- **Superstar** (2): Round 1-2 picks with 80+ OVR, or HOF candidates
- **Star** (1): Round 1-3 picks with 75+ OVR
- **Normal** (0): Everyone else

#### 8M. Determine Body Type
**Method**: `determineBodyType(position, weight, height)`
- Returns body type code (0-3) based on position + build
- Example: Heavy OL = 3, Athletic WR = 0

---

## Current Lookup Files Used

### 1. **PID_lookup.csv** (DEPRECATED)
- **Format**: `PSXP,Player Pic`
  - Example: `3389,Emlen Tunnell (R)`
- **Usage**: Originally for PID matching, but deprecated
- **Problem**: PSXP is just an ID number, not useful for name matching

### 2. **FullData_Lookup.csv** (PRIMARY FOR PID)
- **Format**: `Last Name,First Name,College/Univ,Round,Pick,Draft Class,Position,PhotoID,Player Assets ID,CommID,PresID,PLPO,...`
- **Size**: ~14,879 players
- **Usage**: Main source for PID matching with disambiguation
- **Problem**: Only 14,879 players (missing many historical players)

### 3. **PID_Portrait_Mapping.csv**
- **Format**: `PID,Type,Portrait`
  - Example: `1234,generic,plpo_generic_7_042`
- **Usage**: Maps PIDs to generic face portraits
- **Size**: Hundreds of entries (all generic faces)

### 4. **college_lookup.csv**
- **Format**: `CollegeID,CollegeName`
  - Example: `4,Alabama`
- **Usage**: Fuzzy match college names to IDs

### 5. **state_lookup.csv**
- **Format**: `StateID,StateName`
  - Example**: `0,Alabama` / `4,California`
- **Usage**: Convert state abbreviations/names to IDs

---

## Problems with Current System

### Problem 1: Incomplete PID Data
- **FullData_Lookup.csv**: Only 14,879 players
- **MASTER_LOOKUP_FINAL.csv**: 26,034 players (76% more!)
- **Missing**: ~11,155 historical players (43% of database)

### Problem 2: No Draft Stats in Lookup
Current lookups DON'T have:
- Career Games (G)
- Career Starts (St)
- Approximate Value (wAV)
- Pro Bowls (PB)
- All-Pro selections (AP1)

**Impact**: Must scrape PFR for EVERY draft class generation (slow!)

### Problem 3: Limited Enrichment Data
Current lookups lack:
- PAM (Player Assets) - only 678 matches (2.6%)
- CommID (Commentary ID) - 0 matches
- PLPO - limited data
- Wiki/PFR image URLs

### Problem 4: No AFL Support
- FullData_Lookup doesn't distinguish AFL players
- Causes PID mismatches for 1960-1969 AFL era

---

## How MASTER_LOOKUP_FINAL.csv Improves This

### New Data Available:
| Column | Current Coverage | MASTER_LOOKUP Coverage |
|--------|-----------------|----------------------|
| **Total Players** | 14,879 | 26,034 (+76%) |
| **PhotoID** | 14,879 | 4,299 (16.5% of 26K) |
| **Height** | Variable | 11,509 (44.2%) |
| **Weight** | Variable | 11,505 (44.2%) |
| **PAM Folders** | Not in lookup | 678 (2.6%) |
| **Draft Stats** | NOT INCLUDED | **To, AP1, PB, St, wAV** ✅ |
| **League** | Not tracked | **NFL/AFL** ✅ |

### Benefits:

1. **More PID Matches**:
   - MASTER_LOOKUP has 26,034 players vs 14,879 (76% more)
   - Better coverage of 1936-2025 draft history

2. **Career Stats Pre-loaded**:
   - **To** (Career End Year)
   - **AP1** (All-Pro selections)
   - **PB** (Pro Bowl selections)
   - **St** (Career Starts)
   - **wAV** (Weighted Approximate Value)
   - **Impact**: Can calculate ratings WITHOUT scraping PFR!

3. **Height/Weight Pre-populated**:
   - 11,509 players with height (vs scraping each one)
   - 11,505 players with weight
   - **Impact**: Reduces bio scraping from ~75 to ~10-20 players

4. **AFL Support**:
   - 2,786 AFL players (1960-1969) properly tagged
   - Prevents PID mismatches for AFL era

5. **Round/Pick Data**:
   - All 26,034 players have draft position
   - **1960 AFL**: Properly handles missing Round/Pick (only file without)

---

## Recommended Improvements

### Phase 1: Switch to MASTER_LOOKUP_FINAL.csv

**Changes**:
1. Replace `FullData_Lookup.csv` loading with `MASTER_LOOKUP_FINAL.csv`
2. Update `matchPID()` to use new format:
   ```typescript
   // OLD format:
   // Last Name, First Name, College/Univ, Round, Pick, Draft Class, Position, PhotoID, ...

   // NEW format (same, but MORE players):
   // Last Name, First Name, College/Univ, Round, Pick, Draft Class, Position, PhotoID, Player Assets ID, CommID, PLPO, Height, Weight, From, To, AP1, PB, St, wAV, League, Race, Home State, Wiki_Image_URL, PFR_Image_URL
   ```

3. Add AFL disambiguation:
   ```typescript
   if (draftYear >= 1960 && draftYear <= 1969) {
     // Check League field to avoid confusing NFL/AFL players
     const aflMatch = candidates.find(c =>
       c.entry.league === 'AFL' &&
       c.entry.draftClass === String(draftYear)
     );
     if (aflMatch) return aflMatch.pid;
   }
   ```

### Phase 2: Use Pre-loaded Career Stats

**Current**: Scrape career stats from PFR draft page
**New**: Load from MASTER_LOOKUP columns: `To, AP1, PB, St, wAV`

**Changes**:
```typescript
// After matching player in MASTER_LOOKUP:
const lookupEntry = masterLookup.get(matchedPID);
if (lookupEntry) {
  prospect.careerGames = parseInt(lookupEntry.St) || 0; // Starts ≈ Games
  prospect.careerStarts = parseInt(lookupEntry.St) || 0;
  prospect.careerAV = parseFloat(lookupEntry.wAV) || 0;
  prospect.proBowls = parseInt(lookupEntry.PB) || 0;
  prospect.allPro = parseInt(lookupEntry.AP1) || 0;
  prospect.careerEndYear = parseInt(lookupEntry.To) || 0;
}
```

**Impact**:
- **Eliminates** need to scrape draft page CSV for stats
- **Faster** draft class generation (1-2 minutes vs 5-10 minutes)
- **More reliable** (pre-validated data)

### Phase 3: Use Pre-loaded Height/Weight

**Current**: Scrape combine data (2000+) + bio pages (HOF + top 75)
**New**: Load from MASTER_LOOKUP columns: `Height, Weight`

**Changes**:
```typescript
// After matching player in MASTER_LOOKUP:
const lookupEntry = masterLookup.get(matchedPID);
if (lookupEntry && lookupEntry.Height) {
  prospect.height = `${Math.floor(lookupEntry.Height / 12)}-${lookupEntry.Height % 12}`; // Convert inches to "6-3" format
}
if (lookupEntry && lookupEntry.Weight) {
  prospect.weight = parseInt(lookupEntry.Weight);
}
```

**Impact**:
- **Reduces** bio scraping from ~75 to ~10-20 players
- **Covers** 44% of players (11,509 with height, 11,505 with weight)
- **Faster** generation (saves 2-3 minutes)

### Phase 4: Use Pre-loaded Home State

**Current**: Scrape bio pages OR generate random state
**New**: Load from MASTER_LOOKUP column: `Home State`

**Changes**:
```typescript
// After matching player in MASTER_LOOKUP:
const lookupEntry = masterLookup.get(matchedPID);
if (lookupEntry && lookupEntry['Home State']) {
  // Parse "City, State" format (e.g., "Fort Myers, Florida")
  const parts = lookupEntry['Home State'].split(',');
  if (parts.length === 2) {
    prospect.homeState = parts[1].trim(); // "Florida"
  }
}
```

**Impact**:
- **More accurate** home states (vs random generation)
- **Reduces** bio scraping needs

### Phase 5: Add PAM (Player Assets) Support

**New column available**: `Player Assets ID` (678 entries, 2.6%)

**Usage**:
```typescript
const lookupEntry = masterLookup.get(matchedPID);
if (lookupEntry && lookupEntry['Player Assets ID']) {
  player.PEPS = lookupEntry['Player Assets ID']; // e.g., "sanders_Deion_10888"
}
```

**Impact**:
- **Real player assets** for ~678 legendary players
- **Better visuals** (custom faces, hair, tattoos)

---

## Expected Performance Gains

### Current System (without MASTER_LOOKUP):
1. Scrape draft CSV: ~30 seconds
2. Scrape HOF data: ~10 seconds
3. Scrape combine data: ~20 seconds (2000+ only)
4. Scrape bio data (75 players): **~3-4 minutes** (slow!)
5. Generate players: ~10 seconds
**Total: ~5-6 minutes**

### With MASTER_LOOKUP_FINAL.csv:
1. Load MASTER_LOOKUP: ~1 second
2. Match players: ~5 seconds
3. Scrape bio data (10-20 players): **~30-60 seconds** (only for gaps!)
4. Generate players: ~10 seconds
**Total: ~1-2 minutes** (67-80% faster!)

### Additional Benefits:
- **More accurate** ratings (pre-validated career stats)
- **Better PID matches** (76% more players in database)
- **AFL support** (prevents mismatches for 1960-1969)
- **Reduced scraping** (less prone to rate limiting/errors)

---

## Next Steps

1. **Test MASTER_LOOKUP loading** in CreatorService.ts
2. **Update matchPID()** to use new lookup format
3. **Add pre-loaded stats** (To, AP1, PB, St, wAV)
4. **Add pre-loaded measurements** (Height, Weight, Home State)
5. **Benchmark performance** (before/after comparison)
6. **Add PAM support** (optional, for legendary players)

---

## File References

- **Draft Class Generation**: `src/main/services/CreatorService.ts` (lines 669-921)
- **PID Matching**: `src/main/services/CreatorService.ts` (lines 119-187)
- **Generic Face Assignment**: `src/main/services/CreatorService.ts` (lines 206-291)
- **Rating Calculator**: `src/main/services/RatingCalculator.ts`
- **Scraper Service**: `src/main/services/ScraperService.ts`
- **New Lookup**: `data/lookups/MASTER_LOOKUP_FINAL.csv` (26,034 players)
- **Old Lookup**: `data/lookups/FullData_Lookup.csv` (14,879 players)
