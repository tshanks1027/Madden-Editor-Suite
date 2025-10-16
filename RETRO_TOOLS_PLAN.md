# Retro Tools Suite - All-in-One Historical Franchise Editor

## Vision

Create an all-in-one retro franchise editor that replaces the 7 separate tools from the 1994 Mod V2 with a single integrated solution. Users can set a target year (e.g., 1994, 2005, etc.) and the tool automatically handles all historical adjustments.

## Reference: 1994 Mod V2 Tools

**Location:** `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 25\Mods\1994 Mods\1994 Mod V2\Tools`

### Current Separate Tools (Manual Workflow)
1. **handleTeamNames.exe** - Updates team names by era (Redskins→Commanders, Oilers→Titans)
2. **seasonYearSetup.exe** - Sets the correct season year in franchise
3. **HandleRetroPicks.exe** - Adjusts draft picks for non-existent teams
4. **transferRetroSchedule.exe** - Sets era-appropriate schedules
5. **bodyTypeFixV1.0.exe** - Fixes body types for 300+ lb players
6. **commentaryIdFixV1.2.exe** - Fixes commentary names
7. **trimFreeAgents.exe** - Trims FA pool for draft class loading

### Problems with Current Approach
- **7 separate tools** - Users must run them in specific order
- **Manual every offseason** - Easy to forget steps
- **No automation** - Each tool runs independently
- **Error prone** - Missing a step breaks the franchise
- **Poor UX** - Command-line tools with no GUI

## Our Solution: Integrated Retro Manager

### One Tool, Multiple Features

**UI Design:**
```
┌─────────────────────────────────────────────────────┐
│  Retro Franchise Manager                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Target Season Year: [1994]  ◄►                    │
│                                                     │
│  Features to Apply:                                 │
│  ☑ Historical Team Names                           │
│  ☑ Era-Appropriate Schedules                       │
│  ☑ Non-Existent Team Draft Adjustments             │
│  ☑ Historical Coaching Staffs                      │
│  ☑ Body Type Fixes (300+ lb players)               │
│  ☑ Commentary ID Fixes                             │
│  ☑ Trim Free Agent Pool                            │
│                                                     │
│  [Apply All Changes]  [Preview Changes]            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Feature Breakdown

#### 1. Historical Team Names
**Years Affected:**
- **1996+**: Ravens (before = non-existent)
- **1997+**: Redskins → Commanders (2020+)
- **1997+**: Oilers → Titans (1999+)
- **1995+**: Jaguars (before = non-existent)
- **1995+**: Panthers (before = non-existent)
- **2002+**: Texans (before = non-existent)
- **1970+**: AFL teams merged

**Implementation:**
- Lookup table: Year → Team names/abbreviations
- Auto-update team table in franchise file
- Display warning for non-existent teams

#### 2. Historical Schedules
**Data Source:** Pro Football Reference historical schedules
- Scrape schedules for 1960-2024
- Store in SQLite database
- Apply correct schedule based on target year
- Handle non-existent teams (give them bye weeks)

#### 3. Draft Pick Adjustments
**Logic:**
- Non-existent teams draft at END of each round
- Prevents Ravens/Jaguars/Panthers/Texans from robbing talent before they existed
- Automatically adjusts pick order in draft table

#### 4. Historical Coaching Staffs
**NEW FEATURE - Requires Data Scraping**

**Data to Scrape:**
- Coach names (Head Coach, OC, DC)
- Team assignments by year (1960-2024)
- Coach ratings/schemes (if available)
- Coach photos/portraits (if available)

**Sources:**
- Pro Football Reference: https://www.pro-football-reference.com/coaches/
- Historical coaching records by year
- Scheme data (from community resources)

**Implementation:**
- Scrape coach data → CSV
- Load into SQLite database
- Auto-assign coaches based on target year
- Update COCH table in franchise file

#### 5. Body Type Fixes
**Issue:** Players over 300 lbs appear skinny
**Solution:**
- Scan PLAY table for PWGT (weight) > 300
- Auto-correct body type field
- Apply on save

#### 6. Commentary ID Fixes
**Issue:** Players called by wrong names
**Solution:**
- Use PID lookup to match player names to commentary IDs
- Auto-assign based on similar names
- Show unmatched players for manual assignment

#### 7. Free Agent Trimming
**Issue:** Too many FAs prevent draft class loading
**Solution:**
- Count current FAs
- If > threshold (e.g., 1500), trim to target (e.g., 800)
- Keep highest rated FAs, remove lowest

## Phase 1: Coach Data Scraping (START HERE)

### Coach Scraper Specification

**Objective:** Scrape historical NFL coaching data for 1960-2024

**Data Fields:**
```csv
Last Name,First Name,Team,Year,Position,Record,Playoff Record,League
Reid,Andy,Eagles,1999,HC,5-11,,NFL
Reid,Andy,Eagles,2000,HC,11-5,1-1,NFL
Reid,Andy,Eagles,2001,HC,11-5,1-1,NFL
...
```

**Position Types:**
- HC (Head Coach) - REQUIRED
- OC (Offensive Coordinator) - If available
- DC (Defensive Coordinator) - If available

**Scraping Strategy:**

1. **Team-by-year approach**
   - Iterate through 1960-2024
   - For each year, scrape all 32 teams (or fewer for early years)
   - URL pattern: `https://www.pro-football-reference.com/teams/{TEAM}/{YEAR}.htm`

2. **Coach page approach**
   - Get list of all coaches: `https://www.pro-football-reference.com/coaches/`
   - For each coach, scrape their career history
   - URL pattern: `https://www.pro-football-reference.com/coaches/{COACH_ID}.htm`

**Recommended:** Team-by-year approach (more reliable)

**Save-as-you-go features:**
- Append to `data/lookups/coach_lookup.csv` after each year
- Checkpoint file: `data/lookups/coach-scraper-checkpoint.json`
- Progress file: `data/lookups/coach-scraper-progress.txt`
- PAUSE support: Create `data/lookups/COACH_PAUSE` to stop gracefully

**Error handling:**
- 5 retries with exponential backoff
- 30-second timeout per request
- 2-second delay between requests
- Continue on errors (skip missing data)

**Expected runtime:** 3-4 hours for all teams/years

### File: `scripts/build-coach-lookup.js`

```javascript
// Node.js scraper using Puppeteer
// Similar to build-enhanced-lookup.js but for coaches

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_FILE = path.join(__dirname, '../data/lookups/coach_lookup.csv');
const CHECKPOINT_FILE = path.join(__dirname, '../data/lookups/coach-scraper-checkpoint.json');
const PROGRESS_FILE = path.join(__dirname, '../data/lookups/coach-scraper-progress.txt');
const PAUSE_FILE = path.join(__dirname, '../data/lookups/COACH_PAUSE');

// Team abbreviations for PFR URLs
const NFL_TEAMS = [
    'crd', 'atl', 'rav', 'buf', 'car', 'chi', 'cin', 'cle',
    'dal', 'den', 'det', 'gnb', 'htx', 'clt', 'jax', 'kan',
    'rai', 'sdg', 'ram', 'mia', 'min', 'nwe', 'nor', 'nyg',
    'nyj', 'phi', 'pit', 'sfo', 'sea', 'tam', 'oti', 'was'
];

// AFL teams for 1960-1969
const AFL_TEAMS = {
    'buf': [1960, 1969],
    'bos': [1960, 1970], // Boston Patriots → New England Patriots
    'nyj': [1960, 1969],
    'mia': [1966, 1969],
    'kan': [1960, 1969],
    'sdg': [1960, 1969],
    'rai': [1960, 1969],
    'den': [1960, 1969]
};

// Years to scrape
const START_YEAR = 1960;
const END_YEAR = 2024;

// Main scraper function
async function scrapeCoachData() {
    console.log('=== Building Coach Lookup ===\n');
    console.log(`Scraping ${END_YEAR - START_YEAR + 1} years (${START_YEAR}-${END_YEAR})\n`);

    // Load checkpoint if exists
    let checkpoint = loadCheckpoint();
    let startYear = checkpoint.year || START_YEAR;

    // Initialize CSV if starting fresh
    if (!checkpoint.year && !fs.existsSync(OUTPUT_FILE)) {
        initializeCSV();
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        for (let year = startYear; year <= END_YEAR; year++) {
            // Check for pause file
            if (fs.existsSync(PAUSE_FILE)) {
                console.log('\n⏸ PAUSE file detected - stopping gracefully...');
                saveCheckpoint({ year });
                break;
            }

            console.log(`\n[${year}] Scraping coaches for ${year} season...`);

            const teams = getTeamsForYear(year);
            let coachesFound = 0;

            for (const team of teams) {
                try {
                    const coaches = await scrapeTeamCoaches(page, team, year);
                    if (coaches.length > 0) {
                        appendCoachesToCSV(coaches);
                        coachesFound += coaches.length;
                    }
                    await sleep(2000); // Rate limiting
                } catch (error) {
                    console.error(`  Error scraping ${team} ${year}:`, error.message);
                }
            }

            console.log(`  Found ${coachesFound} coaches for ${year}`);
            saveCheckpoint({ year: year + 1 });
            updateProgress(year, coachesFound);
        }

        console.log('\n=== Coach scraping complete! ===');
    } finally {
        await browser.close();
    }
}

// Helper functions
function loadCheckpoint() {
    if (fs.existsSync(CHECKPOINT_FILE)) {
        return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    }
    return {};
}

function saveCheckpoint(data) {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function initializeCSV() {
    const header = 'Last Name,First Name,Team,Year,Position,Record,Playoff Record,League\n';
    fs.writeFileSync(OUTPUT_FILE, header);
}

function getTeamsForYear(year) {
    // Return appropriate teams based on year (handle AFL, expansions, etc.)
    // Implementation needed
}

async function scrapeTeamCoaches(page, team, year) {
    // Scrape coaches for a specific team/year
    // Implementation needed
    return [];
}

function appendCoachesToCSV(coaches) {
    // Append coaches to CSV file
    // Implementation needed
}

function updateProgress(year, count) {
    // Write progress to text file
    // Implementation needed
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run scraper
scrapeCoachData().catch(console.error);
```

## Phase 2: Historical Schedule Scraping

**Similar approach to coaches**
- Scrape schedules from PFR: `https://www.pro-football-reference.com/years/{YEAR}/games.htm`
- Save to: `data/lookups/schedule_lookup.csv`
- Format: Week, Year, Home Team, Away Team, Result

## Phase 3: UI Integration

**New screen in app:** `src/renderer/html/retro-manager.html`

Features:
- Year selector (1960-2024)
- Checkboxes for each feature
- Preview changes before applying
- Backup franchise before modifications
- Progress indicator during processing

## Phase 4: Franchise File Modifications

**Tables to modify:**
- **TEAM** - Team names, abbreviations
- **COCH** - Coach assignments
- **SCHD** - Schedule data
- **PLAY** - Body types, commentary IDs
- **DRFT** - Draft pick order

**Safety:**
- Always backup before modifications
- Validate changes before saving
- Test that modified file loads in-game

## Success Criteria

### Phase 1 Complete When:
- [ ] Coach scraper script created: `scripts/build-coach-lookup.js`
- [ ] Scrapes 1960-2024 coaching data from PFR
- [ ] Outputs to: `data/lookups/coach_lookup.csv`
- [ ] Save-as-you-go with checkpoint system
- [ ] PAUSE file support
- [ ] Handles errors gracefully (5 retries)
- [ ] Completes without crashes
- [ ] CSV has valid data (spot check 5 random years)

### Overall Project Complete When:
- [ ] All 7 features integrated into one tool
- [ ] UI allows selecting target year
- [ ] All modifications apply correctly
- [ ] Modified franchise loads in Madden 25
- [ ] Tests verify historical accuracy
- [ ] User can run entire retro setup in < 5 minutes

## Timeline

**Phase 1 (Coach Scraper):** 1-2 days
- Day 1: Build scraper, test on 1-2 years
- Day 2: Run full scrape, validate data

**Phase 2 (Schedule Scraper):** 1 day
**Phase 3 (UI Integration):** 2-3 days
**Phase 4 (Franchise Modifications):** 3-4 days

**Total:** ~1.5-2 weeks

## Next Steps

1. ✅ Create this plan document
2. ⏭️ Build `scripts/build-coach-lookup.js`
3. ⏭️ Test scraper on years 1994-1995
4. ⏭️ Run full scrape (1960-2024)
5. ⏭️ Validate coach data
6. ⏭️ Move to Phase 2 (schedules)

---

**Created:** 2025-10-16
**Last Updated:** 2025-10-16
**Status:** Phase 1 - Coach Scraper (Not Started)
