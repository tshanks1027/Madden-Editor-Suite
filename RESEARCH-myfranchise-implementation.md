# MyFranchise Application Implementation Research

**Research Date:** October 27, 2025
**Application Version:** 1.4.6 (Madden 25)
**Installation Location:** C:\Program Files\MyFranchise\
**Author:** TheBleedingRed21

---

## Executive Summary

MyFranchise is a comprehensive Madden 25 franchise file editor built with Vue.js 2 and Electron. It uses the `madden-franchise@3.5.0` library (by bep713) for binary file parsing and provides extensive editing capabilities for franchise mode save files. This research documents their complete implementation to inform our Phase 5 franchise editor development.

**Key Finding:** MyFranchise provides a feature-rich, production-ready reference implementation that we can learn from while building our own M26 editor with Vanilla JS + Handsontable.

---

## 1. Technology Stack Analysis

### Frontend Framework
- **Vue.js 2.5.16** - Component-based UI framework
- **Vue Router 3.0.1** - Client-side routing for multi-page navigation
- **Vuex 3.0.1** - Centralized state management
- **Vuex-Electron 1.0.0** - Vuex persistence for Electron

### UI Components
- **v-datatable-light 0.8.2** - Data table component (NOT Handsontable)
- **vue-carousel 0.18.0** - Carousel/slider components
- **vue-slick-carousel 1.0.6** - Alternative carousel
- **vue-sortable 0.1.3** - Drag-and-drop sorting
- **vuedraggable 2.24.3** - Drag-and-drop lists
- **vue2-transitions 0.3.0** - Animation transitions

### Icon Library
- **@fortawesome/fontawesome-svg-core 1.2.36**
- **@fortawesome/free-solid-svg-icons 5.15.4**
- **@fortawesome/vue-fontawesome 2.0.6**

### Backend/Main Process
- **Electron** (version not in package.json, likely Electron 10-12 based on build date)
- **madden-franchise 3.5.0** - Binary franchise file parser
- **sqlite3 5.1.6** - Local database for lookups and caching
- **papaparse 5.3.1** - CSV parsing
- **promise-worker 2.0.1** - Web worker management
- **workerpool 6.2.0** - Thread pool for heavy operations

### Utilities
- **electron-log 4.4.5** - Logging system
- **electron-updater 4.6.1** - Auto-update functionality
- **save 2.4.0** - File saving utilities

### Build System
- Webpack (inferred from minified output)
- Production build minified and bundled

---

## 2. Application Architecture

### File Structure (Extracted from app.asar)
```
dist/electron/
├── main.js              (1.3MB minified) - Main Electron process
├── renderer.js          (6.1MB minified) - Vue.js frontend application
├── index.html           - Single-page application entry
├── fonts/               - Font assets
├── imgs/                - Image assets
└── static/              - Lookup data and configuration
    ├── MyFranchiseTemplate.db  (82KB) - SQLite database template
    ├── colleges.json            (265KB) - College lookup data
    ├── attributes.json          - Player attributes metadata
    ├── positions.json           - Position definitions
    ├── abilities.json           (267KB) - Player abilities
    ├── equipment.json           (26KB) - Equipment options
    ├── injuries.json            (13KB) - Injury types
    ├── talentTrees.json         (115KB) - Coach talent trees
    ├── ovrweights.json          (75KB) - Overall rating formulas
    ├── coachAppearance.json     - Coach visual customization
    ├── allPlayerVisuals.json    (170KB) - Player visual data
    ├── allCoachVisuals.json     (24KB) - Coach visual data
    ├── LeaguePastAwards.json    (55KB) - Historical awards
    ├── LeaguePastHistory.json   (36KB) - Historical stats
    ├── HistoricalSeasonStats.json (26MB!) - Massive historical dataset
    ├── weatherData.json         (45KB) - Weather system data
    ├── draft/
    │   └── DraftProfile.json
    ├── fantasy/
    │   └── FantasyPoints.json
    ├── historical/
    ├── progression/
    ├── trades/
    ├── uiFormLookups/
    │   └── uiSelectForm.json    (21KB) - UI form definitions
    ├── visualLookups/
    │   └── characterVisualFunctions.js
    └── worker/
        ├── worker.js
        ├── workerConstants.js
        └── workerUtils.js
```

### Data Flow Pattern

1. **File Loading:**
   - User selects franchise file → Main process
   - Main process uses `madden-franchise@3.5.0` to parse
   - Parsed data sent to renderer via IPC
   - Renderer stores in Vuex state
   - SQLite database used for lookups (colleges, positions, etc.)

2. **Data Display:**
   - Vue components read from Vuex store
   - v-datatable-light renders editable tables
   - Lookup data joined from JSON files and SQLite

3. **Data Editing:**
   - User edits in v-datatable
   - Changes tracked in Vuex mutations
   - Validation against schemas and enums

4. **Saving:**
   - Renderer sends changed records to main process
   - Main process updates franchise file object
   - `madden-franchise` library writes binary file
   - File saved with proper compression

---

## 3. Supported Franchise Tables

Based on extracted constants from `renderer.js`, MyFranchise supports **~100 franchise tables**:

### Core Tables
- **playerTable** (1612938518)
- **teamTable** (637929298)
- **coachTable** (1860529246)
- **rosterTable** (1126708202)
- **depthChartTable** (797195324)
- **depthChartPlayerTable** (889352590)

### Player Management
- **freeAgentTable** (3717720305)
- **retiredPlayerTable** (2140088667)
- **hallOfFamePlayerTable** (2752828393)
- **practiceSquadTable** (1504607832)
- **draftClassTable** (786598926)

### Contract/Salary
- **playerContractTable** (728038538)
- **contractOfferTable** (2808779617)
- **salaryBonusIntTable** (2228202903)
- **salaryInfoTable** (3759217828)

### Staff Tables
- **ownerTable** (2357578975)
- **scoutsTable** (4003749334)
- **teamScoutTable** (1925975938)
- **freeAgentCoachTable** (2912348295)
- **retiredCoachTable** (2068722924)
- **hallOfFameCoachTable** (1455634092)
- **staffPersonContractTable** (674348040)

### Season/Schedule
- **seasonInfoTable** (3123991521)
- **seasonGameTable** (1607878349)
- **pendingSeasonGameTable** (2877284424)
- **seasonGameRequestTable** (2943829712)

### Draft System
- **draftPickTable** (2546719563)
- **draftPickArrayTable** (2295354658)
- **mockDraftTable** (1729882776)
- **mockDraftArrayTable** (1675294511)
- **draftInfoTable** (1709168449)
- **draftManagerTable** (4051979813)
- **draftPickEventTable** (2996999973)
- **draftedPlayersArrayTable** (943806295)

### Statistics (Extensive!)
- **gameStatsTable** (3646354758)
- **gameOffKPReturnStatsTable**, **gameOffStatsTable**, **gameOLineStatsTable**
- **gameDefStatsTable**, **gameKickingStatsTable**, **gameDefKPReturnStatsTable**
- **seasonStatsTable** (3856160076)
- **seasonOffKPReturnStatsTable**, **seasonOffStatsTable**, **seasonOLineStatsTable**
- **seasonDefStatsTable**, **seasonKickingStatsTable**, **seasonDefKPReturnStatsTable**
- **careerOffKPReturnStatsTable**, **careerOffStatsTable**, **careerOLineStatsTable**
- **careerDefStatsTable**, **careerKickingStatsTable**, **careerDefKPReturnStatsTable**
- **teamStatsTable**, **teamGameStatsTable**, **teamSeasonStatsTable**

### League History
- **yearSummaryArray** (2073486305)
- **yearSummary** (2592669074)
- **leagueHistoryArray** (2466957052)
- **leagueHistoryAward** (2655641637)
- **currentAwardTable** (1868257145)
- **playerAwardTable** (657983086)
- **coachAwardTable** (3027881868)
- **LeaguePastAwards**, **LeaguePastHistory**, **HistoricalSeasonStats**

### Transactions
- **playerTransactionTable** (2590627814)
- **coachTransactionTable** (2701814500)
- **reSignTable** (846670960)
- **negotiationTable** (298416424)

### Advanced Features
- **mainSigAbilityTable** (2421474727)
- **secondarySigAbilityTable** (4217885853)
- **signatureArrayTable** (1691308264)
- **activeTalentTreeTable** (1386036480)
- **talentNodeStatusTable** (4148550679)
- **talentNodeStatusArrayTable** (2516681065)
- **talentSubTreeStatusTable** (1725084110)
- **coachTalentEffects** (2084066789)

### Visuals/Appearance
- **characterVisualsTable** (1429178382)

### Stadium/Environment
- **stadiumTable** (2511317894)
- **weatherData** (JSON file)

### Social Features
- **storyTable** (53507767)
- **tweetTable** (2206445889)
- **twitterHandles** (JSON file)

### Pro Bowl
- **proBowlRosterTable** (1567581167)

### Requests/Workflow
- **advanceStageRequestTable**, **advanceStageRequestArrayTable**
- **manageRosterRequestTable**, **manageStaffRequestTable**, **manageTeamRequestTable**
- **scoutingRequestTable**, **practiceRequestTable**, **minicampRequestTable**
- **startDraftRequestTable**, **draftRecapRequestTable**, **mockDraftRequestTable**
- **cutDayRequestTable**, **playoffBracketRequestTable**, **leagueHistoryRequestTable**
- **retirementRequestTable**, **makeContractOfferRequestTable**
- **requestArrayTable**, **requestServerTable**

### Settings
- **teamSettingTable** (3073982847)
- **autoSubSliderTable** (1533677710)
- **franchiseUserTable** (3429237668)
- **franchiseUsersArray** (899004536)

### Training/Progression
- **focusTrainingTable** (80738141)
- **drillCompletedTable** (1015040736)
- **miniGameCompletedArrayTable** (4095723150)

### Marketing
- **playerMerchTable** (2046620302)
- **marketedPlayersArrayTable** (4041136953)
- **topMarketedPlayers** (3036818244)

### Core Franchise
- **franchiseTable** (2684583414)
- **divisionTeamTable** (853026208)
- **divisionTable** (177707037)
- **rosterInfoTable** (2907326382)

---

## 4. Enum/Field Handling Patterns

### College Field Handling

**Data Source:** `static/colleges.json` (265KB, ~500+ colleges)

```json
{
  "AssetId": 2147485391,
  "Name": "Abilene Christian",
  "Size": "Small",
  "COLLEGE_ID": 1,
  "UniformID": 0,
  "COLLEGE_TEAM_ID": 0,
  "Division": "Other",
  "Subdivision": "FCS",
  "IsElite": false,
  "Region": "Central",
  "COLLEGE_CONFERENCE": "Southwest",
  "Conference": "Other",
  "TEAM_BACKGROUNDCOLORR": 83,
  "TEAM_BACKGROUNDCOLORG": 28,
  "TEAM_BACKGROUNDCOLORB": 121
}
```

**Key Insight:** They store the numeric `COLLEGE_ID` in the franchise file but display the college `Name` via lookup. The colleges.json includes:
- Full name display
- Color schemes (RGB values)
- Conference/Division metadata
- Size classification
- Elite status

### Position Field Handling

**Data Source:** `static/positions.json`

```json
{
  "ShortName": "QB",
  "LongName": "Quarterback",
  "Order": 0
}
```

**Pattern:** Store numeric position ID, display using short or long name based on context.

### Attributes/Ratings Handling

**Data Source:** `static/attributes.json`

```json
{
  "ShortName": "SPD",
  "LongName": "Speed",
  "DefaultValue": "Speed",
  "Value": "SpeedRating"
}
```

**Key Insight:**
- `ShortName` = "SPD" (display in tight spaces)
- `LongName` = "Speed" (display in headers)
- `Value` = "SpeedRating" (actual field name in franchise schema)

### Abilities System

**Data Source:** `static/abilities.json` (267KB)

Complex JSON structure mapping abilities to positions with eligibility rules. Example structure inferred from size - likely maps ability IDs to:
- Ability name
- Position eligibility
- Tier (X-Factor, Superstar, etc.)
- Requirements

### Overall Rating Calculation

**Data Source:** `static/ovrweights.json` (75KB)

**Key Code Pattern** (from minified renderer.js):

```javascript
calculateEditedOverall:function(e){
  var t=0,a="",n=g[e.Position],i=!0,c=!1,d=void 0;
  try{
    for(var u,p,_=l()(A);!(i=(u=_.next()).done);i=!0)
      if((p=u.value).Pos===n){
        var m=0,f=p?o()(p).slice(4,55):null;
        if(null!=f)
          for(var h in e)
            if(f.includes(h)){
              m+=(e[h]-p.DesiredLow)/(p.DesiredHigh-p.DesiredLow)*(p[h]/p.Sum)
            }
        var v=r(s(99*m,99));
        v>t&&(t=v,a=p.Archetype)
      }
  }catch(e){c=!0,d=e}finally{try{!i&&_.return&&_.return()}finally{if(c)throw d}}
  return{newOverall:t,newArchetype:a}
}
```

**Translation:**
1. Get position-specific archetype weights
2. For each attribute:
   - Normalize value: `(value - DesiredLow) / (DesiredHigh - DesiredLow)`
   - Apply weight: `normalized * (weight / Sum)`
   - Accumulate
3. Scale to 0-99
4. Return best archetype match

**This is LIVE overall calculation** - updates as user edits ratings!

### UI Form System

**Data Source:** `static/uiFormLookups/uiSelectForm.json`

```json
{
  "Row": 0,
  "AssetId": 2147498979,
  "Binary": "10000000000000000011101111100011",
  "Title": "Force Advance",
  "IsSubmittable": false,
  "Commands": "00000000000000000000000000000001"
}
```

Maps binary flags to UI form actions and workflows.

---

## 5. UI/UX Structure (Inferred)

### Navigation Pattern

Based on Vue Router usage and table support, likely navigation structure:

```
Home/Dashboard
├── Players
│   ├── Roster
│   ├── Free Agents
│   ├── Retired Players
│   ├── Hall of Fame
│   └── Practice Squad
├── Teams
│   ├── Team Info
│   ├── Depth Charts
│   ├── Team Settings
│   └── Stadiums
├── Coaches
│   ├── Active Coaches
│   ├── Free Agent Coaches
│   ├── Retired Coaches
│   └── Talent Trees
├── Draft
│   ├── Draft Class
│   ├── Draft Picks
│   ├── Mock Draft
│   └── Draft Results
├── Schedule/Season
│   ├── Season Games
│   ├── Season Info
│   └── Playoff Bracket
├── Contracts
│   ├── Player Contracts
│   ├── Contract Offers
│   ├── Re-Sign Players
│   └── Salary Info
├── Statistics
│   ├── Game Stats
│   ├── Season Stats
│   ├── Career Stats
│   └── Team Stats
├── History
│   ├── League History
│   ├── Awards
│   ├── Transactions
│   └── Year Summaries
└── Advanced
    ├── Abilities/X-Factors
    ├── Visuals/Appearance
    ├── Weather
    ├── Stories/Tweets
    └── Settings
```

### Table UI Pattern (Inferred)

**v-datatable-light** provides:
- Sortable columns
- Inline editing
- Filtering/search
- Pagination
- Column visibility toggles

**Likely Features:**
- Search bar above table
- Column header click to sort
- Filter dropdowns for enum fields
- Cell click to edit
- Tab/Enter to navigate cells
- Validation feedback on blur
- Bulk edit capabilities
- Export to CSV (papaparse)

### Player Card Pattern (Code Evidence)

From minified code, found player stat display components with:
- Position-specific stat layouts (QB, HB, WR, etc.)
- Regular season vs postseason tabs
- Calculated stats (averages, percentages)
- Career totals
- Team colors/branding

```javascript
case"QB":
  var t=["CMP","ATT","CMP%","YDS","AVG","TD","INT","LNG","SACK","RATE"]
```

### Team Branding Pattern

**Color Functions** (from minified code):

```javascript
GetTeamPrimaryColor:function(e){
  var t=e.TEAM_BACKGROUNDCOLORR,
      a=e.TEAM_BACKGROUNDCOLORG,
      r=e.TEAM_BACKGROUNDCOLORB;
  return 20>t&&(t=20),20>a&&(a=20),20>r&&(r=20),
    "rgba("+t+", "+a+", "+r+", 1)"
}
```

**They dynamically apply team colors throughout the UI!**

---

## 6. Save/Update Workflow

### Change Tracking Pattern

**Vuex Store Pattern:**
1. Load franchise file → commit initial state
2. User edits → commit mutations
3. Mutations mark records as "dirty"
4. Save button enabled when dirty records exist

### Saving Process (Inferred)

```
1. User clicks "Save"
2. Renderer gathers all dirty records from Vuex
3. Sends IPC message to main process:
   - Changed table IDs
   - Changed record indices
   - Changed field values
4. Main process:
   - Iterates dirty records
   - Updates franchise file object via madden-franchise API
   - Calls file.save()
5. Success callback:
   - Clear dirty flags in Vuex
   - Show success notification
6. Error callback:
   - Preserve dirty state
   - Show error dialog
   - Allow retry
```

### Web Workers for Heavy Operations

**Using `promise-worker` and `workerpool`:**
- Parsing large files
- Calculating overall ratings for all players
- Statistical aggregations
- Export operations

**Pattern:**
```javascript
// Main thread
worker.postMessage({ action: 'calculateAllOveralls', players: [...] })

// Worker thread
onmessage = (e) => {
  if (e.data.action === 'calculateAllOveralls') {
    const results = e.data.players.map(p => calculateOverall(p))
    postMessage({ results })
  }
}
```

### SQLite Database Usage

**`MyFranchiseTemplate.db` (82KB)**

Likely stores:
- College lookup cache
- Position mappings
- Equipment options
- User preferences
- Recently opened files
- Custom presets

**Advantage:** Faster lookups than parsing JSON repeatedly.

---

## 7. M25 vs M26 Differences & Applicability

### File Format Compatibility

**Madden 25 (MyFranchise):**
- Uses `madden-franchise@3.5.0`
- Supports TDB2 compressed format
- Schema version specific to M25

**Madden 26 (Our Editor):**
- Uses `madden-franchise@3.8.0` (newer)
- Same TDB2 compressed format
- Schema version M26 (different field offsets/names)

### Key Structural Differences

| Aspect | M25 | M26 | Impact |
|--------|-----|-----|--------|
| madden-franchise version | 3.5.0 | 3.8.0 | Schema updates, new fields |
| Table count | ~100 tables | ~100+ tables | Similar scope |
| College field | Numeric enum | Numeric enum | Same pattern |
| Position field | Numeric enum | Numeric enum | Same pattern |
| Overall calculation | Formula-based | Formula-based | Weights differ |
| Binary format | TDB2 compressed | TDB2 compressed | Compatible |

### What WILL Work from M25 Procedures

✅ **Core Architecture:**
- File loading via madden-franchise library
- Table iteration and record editing
- Lookup-based enum display
- Save workflow with dirty tracking
- IPC communication pattern

✅ **Data Patterns:**
- College stored as numeric ID, displayed via lookup
- Position stored as numeric ID, displayed via lookup
- Ratings stored as 0-99 integers
- Binary format reading/writing

✅ **UI/UX Patterns:**
- Table-based editing
- Position-specific views
- Overall rating calculation
- Team color theming
- Multi-tab navigation

### What WILL NOT Work Directly

❌ **Specific Values:**
- M25 college IDs ≠ M26 college IDs (requires M26 schema)
- M25 overall weights ≠ M26 overall weights
- M25 ability IDs ≠ M26 ability IDs

❌ **New M26 Features:**
- Any new tables added in M26
- New fields in existing tables
- Changed field offsets

❌ **Deprecated M25 Features:**
- Any tables removed in M26

### Migration Strategy

**We CAN adopt:**
1. ✅ Overall architecture (Electron + madden-franchise)
2. ✅ Lookup-based enum display pattern
3. ✅ Change tracking and save workflow
4. ✅ Table selection and navigation
5. ✅ Live overall calculation concept

**We MUST customize:**
1. ⚠️ Schema files for M26 (use madden-franchise@3.8.0 schemas)
2. ⚠️ Overall rating formulas (extract from M26 game files)
3. ⚠️ College/enum lookup files (generate from M26 schemas)
4. ⚠️ Table IDs (may differ in M26)
5. ⚠️ Field names (check M26 schema documentation)

---

## 8. Feature Comparison to Our Phase 5 Goals

### Phase 5: Franchise Editor Scope

**Our Planned Features:**
- Load/save M26 franchise files
- Edit Player table
- Edit Team table
- Edit Coach table (maybe)
- Basic filtering and search
- Handsontable-based grid

**MyFranchise Feature Set:**

| Feature | MyFranchise (M25) | Our Phase 5 (M26) | Notes |
|---------|-------------------|-------------------|-------|
| **Core Tables** |||
| Player editing | ✅ Full support | ✅ Planned | Match scope |
| Team editing | ✅ Full support | ✅ Planned | Match scope |
| Coach editing | ✅ Full support | ⚠️ Maybe | Consider adding |
| Depth chart | ✅ Yes | ❌ Not planned | Future phase? |
| **Roster Management** |||
| Free agents | ✅ Yes | ❌ Not planned | Easy to add |
| Practice squad | ✅ Yes | ❌ Not planned | Future phase |
| Retired players | ✅ Yes | ❌ Not planned | Low priority |
| Hall of Fame | ✅ Yes | ❌ Not planned | Low priority |
| **Contracts/Salary** |||
| Player contracts | ✅ Yes | ❌ Not planned | Consider adding |
| Salary cap | ✅ Yes | ❌ Not planned | Advanced feature |
| Contract offers | ✅ Yes | ❌ Not planned | Advanced feature |
| **Draft System** |||
| Draft class | ✅ Full support | ✅ Separate tool | We have this! |
| Draft picks | ✅ Yes | ❌ Not planned | Future phase |
| Mock draft | ✅ Yes | ❌ Not planned | Low priority |
| **Statistics** |||
| Game stats | ✅ View/edit | ❌ Not planned | Read-only? |
| Season stats | ✅ View/edit | ❌ Not planned | Complex feature |
| Career stats | ✅ View/edit | ❌ Not planned | Very complex |
| **Advanced Features** |||
| Abilities/X-Factors | ✅ Full support | ❌ Not planned | M26 may differ |
| Coach talents | ✅ Full support | ❌ Not planned | Complex system |
| Player visuals | ✅ Full support | ❌ Not planned | Separate tool? |
| Weather system | ✅ Yes | ❌ Not planned | Low priority |
| Stories/tweets | ✅ Yes | ❌ Not planned | Low priority |
| **UI Features** |||
| Multi-table nav | ✅ Full routing | ⚠️ Basic tabs | Improve UX |
| Search/filter | ✅ Advanced | ✅ Planned | Match capability |
| Sorting | ✅ Multi-column | ✅ Planned | Handsontable has this |
| Inline editing | ✅ Cell-level | ✅ Planned | Handsontable has this |
| Bulk operations | ✅ Likely | ❌ Not planned | Nice to have |
| Export/import | ✅ CSV export | ❌ Not planned | Easy to add |
| Auto-save | ❓ Unknown | ❌ Not planned | Consider adding |
| Undo/redo | ❓ Unknown | ❌ Not planned | Complex but valuable |
| **Data Enhancements** |||
| College display | ✅ Name lookup | ✅ Planned | Match pattern |
| Position display | ✅ Name lookup | ✅ Planned | Match pattern |
| Team colors | ✅ Dynamic theming | ❌ Not planned | Nice polish |
| Overall calc | ✅ Live calculation | ❌ Not planned | **HIGHLY RECOMMEND** |
| Validation | ✅ Field validation | ⚠️ Basic | Improve this |

---

## 9. Recommendations for "Close to MyFranchise" Goal

### Must-Have Features (To Match User Expectations)

1. **Multi-Table Support** (Priority: HIGH)
   - Add Coach table editing
   - Add Free Agent table
   - Add Depth Chart table
   - Use tab navigation like MyFranchise

2. **Lookup-Based Display** (Priority: HIGH)
   - Implement college name display (not just ID)
   - Implement position name display
   - Load M26 schema-based lookups
   - Cache lookups in memory

3. **Live Overall Calculation** (Priority: MEDIUM)
   - Extract M26 overall formulas
   - Calculate OVR as user edits ratings
   - Show archetype changes
   - Highlight when OVR changes

4. **Enhanced Search/Filter** (Priority: MEDIUM)
   - Position filter dropdown
   - Team filter dropdown
   - Age range filter
   - Overall range filter
   - Name search (already have)

5. **Better Validation** (Priority: MEDIUM)
   - Field range validation (0-99 for ratings)
   - Enum validation (valid college IDs only)
   - Position-specific attribute validation
   - Warning for invalid values

### Nice-to-Have Features (For Polish)

6. **Contract Display** (Priority: LOW)
   - Show contract years/salary in player table
   - Read-only for Phase 5, editable later

7. **Team Color Theming** (Priority: LOW)
   - Apply team colors to rows
   - Color-code by team in multi-team view

8. **Export to CSV** (Priority: LOW)
   - Let users export table to CSV
   - Use papaparse like MyFranchise

9. **Auto-Save** (Priority: LOW)
   - Save every N minutes
   - Backup before save

10. **Undo/Redo** (Priority: LOW)
    - Track change history
    - Allow undo of edits

### Avoid (Out of Scope for Phase 5)

- ❌ Statistics editing (too complex, low value)
- ❌ Draft system (we have separate tool)
- ❌ Abilities/X-Factors (M26 system may differ greatly)
- ❌ Player visuals (separate tool recommended)
- ❌ Stories/tweets (low value)
- ❌ Weather system (not user-facing)

---

## 10. Technical Implementation Guide

### Recommended Development Path

**Phase 5a: Core Editor (Match Our Plan)**
1. ✅ Load M26 franchise files (already working)
2. ✅ Display Player table in Handsontable (already working)
3. ✅ Display Team table (already working)
4. ✅ Basic save functionality (already working)
5. ✅ Field-level editing (already working)

**Phase 5b: Lookup Integration (Key Addition)**
6. ⚠️ Extract M26 schema lookups
   - Generate colleges.json from M26 schema
   - Generate positions.json
   - Generate attributes.json
7. ⚠️ Implement lookup service
   - Load lookups on app start
   - Cache in memory
   - Provide fast lookup functions
8. ⚠️ Update Handsontable columns
   - Use dropdowns for enum fields (College, Position)
   - Display names instead of IDs
   - Save IDs, show names

**Phase 5c: Multi-Table Support**
9. Add Coach table
10. Add Free Agent table
11. Add tab navigation
12. Add table switcher

**Phase 5d: Enhanced UX**
13. Add position filter
14. Add team filter
15. Add overall range filter
16. Improve error handling

**Phase 5e: Advanced Features (Optional)**
17. Live overall calculation
18. Team color theming
19. Export to CSV
20. Auto-save

### Code Architecture Recommendations

**Lookup Service** (New Module)

```typescript
// C:/Users/tshan/Documents/Dev/madden-editor-suite/src/main/services/LookupService.ts

class LookupService {
  private colleges: Map<number, College>;
  private positions: Map<number, Position>;
  private attributes: Map<string, Attribute>;

  async initialize() {
    // Load from M26 schema or generated JSON files
    this.colleges = await this.loadColleges();
    this.positions = await this.loadPositions();
    this.attributes = await this.loadAttributes();
  }

  getCollegeName(id: number): string {
    return this.colleges.get(id)?.Name ?? 'Unknown';
  }

  getPositionName(id: number): string {
    return this.positions.get(id)?.LongName ?? 'Unknown';
  }

  getCollegeOptions(): { value: number, label: string }[] {
    return Array.from(this.colleges.values()).map(c => ({
      value: c.COLLEGE_ID,
      label: c.Name
    }));
  }
}
```

**Handsontable Column Configuration**

```javascript
// src/renderer/js/franchise-editor.js

const playerColumns = [
  {
    data: 'FirstName',
    title: 'First Name',
    type: 'text'
  },
  {
    data: 'CollegeId',
    title: 'College',
    type: 'dropdown',
    source: lookupService.getCollegeOptions().map(o => o.label),
    renderer: function(instance, td, row, col, prop, value) {
      // Display college name, save college ID
      const collegeName = lookupService.getCollegeName(value);
      td.innerHTML = collegeName;
      return td;
    }
  },
  {
    data: 'Position',
    title: 'Position',
    type: 'dropdown',
    source: lookupService.getPositionOptions().map(o => o.label),
    renderer: function(instance, td, row, col, prop, value) {
      const posName = lookupService.getPositionName(value);
      td.innerHTML = posName;
      return td;
    }
  }
  // ... more columns
];
```

**Overall Calculation** (If Implemented)

```javascript
// src/renderer/js/overall-calculator.js

class OverallCalculator {
  constructor(weights) {
    this.weights = weights; // Load from M26 ovrweights.json
  }

  calculate(player) {
    const archetype = this.weights.find(w =>
      w.Pos === player.Position &&
      w.Archetype === player.PlayerType
    );

    if (!archetype) return player.OverallRating;

    let total = 0;
    for (const attr in player) {
      if (archetype[attr]) {
        const normalized = (player[attr] - archetype.DesiredLow) /
                          (archetype.DesiredHigh - archetype.DesiredLow);
        total += normalized * (archetype[attr] / archetype.Sum);
      }
    }

    return Math.round(Math.min(total * 99, 99));
  }
}

// Hook into Handsontable afterChange
hot.addHook('afterChange', (changes) => {
  changes.forEach(([row, prop, oldValue, newValue]) => {
    if (isRatingField(prop)) {
      const player = hot.getSourceDataAtRow(row);
      const newOvr = calculator.calculate(player);
      if (newOvr !== player.OverallRating) {
        hot.setDataAtRowProp(row, 'OverallRating', newOvr);
      }
    }
  });
});
```

---

## 11. Critical Differences in Approach

### MyFranchise (Vue.js)
- Component-based architecture
- Vuex for state management
- Vue Router for navigation
- v-datatable-light for tables
- Reactive data binding

### Our Editor (Vanilla JS)
- Module-based architecture
- No framework state management
- Tab-based navigation
- Handsontable for tables
- Manual DOM updates

### Bridging the Gap

**State Management Replacement:**
```javascript
// Instead of Vuex, use a simple store pattern
const FranchiseStore = {
  state: {
    players: [],
    teams: [],
    dirty: new Set()
  },

  mutations: {
    setPlayers(players) {
      this.state.players = players;
    },
    markDirty(tableId, recordIndex) {
      this.state.dirty.add(`${tableId}:${recordIndex}`);
    },
    clearDirty() {
      this.state.dirty.clear();
    }
  },

  getters: {
    isDirty() {
      return this.state.dirty.size > 0;
    }
  }
};
```

**Navigation Replacement:**
```javascript
// Instead of Vue Router, use tab click handlers
document.querySelectorAll('.tab-link').forEach(tab => {
  tab.addEventListener('click', (e) => {
    const tableId = e.target.dataset.table;
    loadTable(tableId);
    updateActiveTab(tableId);
  });
});
```

**Reactivity Replacement:**
```javascript
// Instead of Vue reactivity, use Handsontable hooks
hot.addHook('afterChange', (changes) => {
  changes.forEach(change => {
    FranchiseStore.mutations.markDirty(tableId, change[0]);
    updateSaveButton();
  });
});
```

---

## 12. Extraction Commands for Reference

### Get College Lookup Data
```bash
# Already have the file
# C:/Users/tshan/Documents/Dev/madden-editor-suite/temp-myfranchise-extract/dist/electron/static/colleges.json
```

### Get Position Definitions
```bash
# Already have the file
# C:/Users/tshan/Documents/Dev/madden-editor-suite/temp-myfranchise-extract/dist/electron/static/positions.json
```

### Get Attribute Metadata
```bash
# Already have the file
# C:/Users/tshan/Documents/Dev/madden-editor-suite/temp-myfranchise-extract/dist/electron/static/attributes.json
```

### Get Overall Weights
```bash
# Already have the file
# C:/Users/tshan/Documents/Dev/madden-editor-suite/temp-myfranchise-extract/dist/electron/static/ovrweights.json
```

**Note:** These are M25 files. We need M26 equivalents, which we can:
1. Extract from M26 game files (if we have them)
2. Generate from `madden-franchise@3.8.0` schemas
3. Manually create by inspecting M26 franchise files

---

## 13. Conclusion & Action Items

### Key Learnings

1. **MyFranchise is comprehensive** - supports ~100 tables with extensive features
2. **Core pattern is adoptable** - lookup-based enum display works for M26
3. **madden-franchise library is key** - handles binary complexity
4. **Live overall calculation is impressive** - users expect this
5. **Multi-table navigation is essential** - single-table editor feels limited

### Recommended Action Plan

**Immediate (This Sprint):**
1. ✅ Review MyFranchise college lookup pattern
2. ⚠️ Extract/generate M26 college lookup file
3. ⚠️ Implement lookup service in our editor
4. ⚠️ Update Handsontable to use college names (not IDs)
5. ⚠️ Add position name display

**Short-term (Next Sprint):**
6. Add Coach table support
7. Add Free Agent table support
8. Implement tab navigation
9. Add position/team filters
10. Improve validation

**Medium-term (Phase 6):**
11. Add live overall calculation
12. Add contract display
13. Add depth chart editing
14. Add team color theming

**Long-term (Phase 7+):**
15. Add statistics viewing (read-only)
16. Add abilities/X-Factors (if M26 schema stable)
17. Add player visuals editor
18. Add export/import features

### Final Assessment

**Can we match MyFranchise?**
- **For M25:** No, it's a mature product with 100+ tables
- **For M26 basics:** Yes, we can match core player/team editing
- **With enhancements:** Yes, we can feel "close to MyFranchise" by adding lookups, multi-table, and filters

**Should we try to match it?**
- **Scope:** Start small (Player/Team/Coach), expand gradually
- **Quality:** Match their lookup pattern and UX polish
- **Focus:** M26 support is our differentiator (they're M25 only)

**User's goal is achievable:** We can build a franchise editor that feels comparable to MyFranchise for M26, using their proven patterns while keeping our Vanilla JS + Handsontable stack.

---

## Appendix: File Locations

### MyFranchise Installation
- **Executable:** `C:\Program Files\MyFranchise\MyFranchise.exe`
- **Extracted Source:** `C:\Users\tshan\Documents\Dev\madden-editor-suite\temp-myfranchise-extract\`

### Key Reference Files
- **Package.json:** `temp-myfranchise-extract/package.json`
- **College Lookup:** `temp-myfranchise-extract/dist/electron/static/colleges.json`
- **Position Lookup:** `temp-myfranchise-extract/dist/electron/static/positions.json`
- **Attributes:** `temp-myfranchise-extract/dist/electron/static/attributes.json`
- **Overall Weights:** `temp-myfranchise-extract/dist/electron/static/ovrweights.json`
- **Abilities:** `temp-myfranchise-extract/dist/electron/static/abilities.json`
- **UI Forms:** `temp-myfranchise-extract/dist/electron/static/uiFormLookups/uiSelectForm.json`

### madden-franchise Library
- **Version:** 3.5.0 (M25)
- **Location:** `temp-myfranchise-extract/node_modules/madden-franchise/`
- **Main File:** `FranchiseFile.js`
- **Our Version:** 3.8.0 (M26 support)

---

**Research completed:** October 27, 2025
**Next step:** Implement lookup service for M26 college/position display
