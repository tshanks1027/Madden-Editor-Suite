# Known Issues - Madden Editor Suite

This document records solutions to problems that have been solved before. Check here FIRST when encountering bugs.

## Index

- [Retro Editor Issues](#retro-editor-issues)
- [M26 Draft Class Save Errors](#m26-draft-class-save-errors)
- [Data Format Mismatches](#data-format-mismatches)
- [Display and Rendering Bugs](#display-and-rendering-bugs)
- [Data Persistence Issues](#data-persistence-issues)
- [Handsontable Sorting Issues](#handsontable-sorting-issues)
- [Packaging and Distribution Issues](#packaging-and-distribution-issues)

---

## Retro Editor Issues

### Issue: Game crashes after simming more than one week with historical schedule

**Symptoms:**
- Apply historical schedule using Retro Editor (e.g., 1990 season)
- Sim week 1 works fine
- Sim week 2 or beyond causes Madden to crash
- Crash happens during simulation, not immediately

**Root Cause:**
- Historical eras had fewer games per season (14-16 games vs modern 17 games)
- When applying schedule, extra game slots beyond historical data were set to null team references
- Code was setting `HomeTeam` and `AwayTeam` to `'00000000000000000000000000000000'`
- Madden crashes when trying to dereference these null team references during simulation

**Locations in Code:**
1. `RetroEditorService.ts` lines ~1040-1050: Weeks beyond historical season end
2. `RetroEditorService.ts` lines ~1090-1100: Extra game slots within a week (when era had fewer games/week)

**Solution:**
Set `SeasonWeekType` to `PreSeason` (0) for unused game slots. This tells Madden to skip these games during regular season simulation.

```typescript
// WRONG - causes crash:
franchiseRecord.HomeTeam = '00000000000000000000000000000000';
franchiseRecord.AwayTeam = '00000000000000000000000000000000';

// ALSO WRONG - record.empty() doesn't exist in the library:
if (typeof franchiseRecord.empty === 'function') {
  franchiseRecord.empty();  // Never runs - method doesn't exist!
}

// CORRECT - mark as PreSeason so Madden skips during regular season sim:
setGameField(franchiseRecord, 'SeasonWeekType', SEASON_WEEK_TYPES.PreSeason);
```

**Prevention:**
- Never set team references to all-zeros in franchise files
- Mark unused game slots as PreSeason (SeasonWeekType = 0)
- Test sim beyond week 1 after any schedule-related changes

**Fixed In:** RetroEditorService.ts `applyHistoricalSchedule()` method

---

### Issue: Schedule changes not persisting - franchise file not saved

**Symptoms:**
- Apply historical schedule via Retro Editor
- Changes appear to succeed (console shows games modified)
- In-game schedule is unchanged (still shows 18 weeks for 2004)
- "Nothing fucking changed" after applying schedule

**Root Cause:**
- `applyHistoricalSchedule()` method modified the franchise object in memory
- **BUT never called `franchise.save(filePath)` to persist changes**
- All modifications were thrown away when the method returned

**Solution:**
```typescript
// In applyHistoricalSchedule() - ADD save call before return:
console.log(`[RetroEditorService] Saving franchise file...`);
await franchise.save(filePath);
console.log(`[RetroEditorService] Franchise file saved successfully`);
```

**Prevention:**
- ALWAYS check that file operations end with a save call
- Look for pattern: modify data → return (missing save!)
- Add explicit save logging so it's obvious when save occurs

**Fixed In:** RetroEditorService.ts `applyHistoricalSchedule()` method, line ~1128

---

### Issue: Schedule shows 18 weeks instead of 17 for pre-2021 seasons

**Symptoms:**
- 2004 season shows 18 weeks in-game
- 2011 Throwback mod correctly shows 17 weeks
- Historical schedule should have 17 weeks (16 games + bye weeks)

**Root Cause:**
- Madden displays weeks based on max SeasonWeek with RegularSeason type
- 2011 Throwback uses 0-indexed weeks: Weeks 0-16 = RegularSeason, Week 17 = OffSeason
- Historical schedule JSON uses 1-indexed: Weeks 1-17
- Code was mapping Madden Week 17 → Historical Week 17 → RegularSeason games exist
- Result: max RegularSeason week = 17 → displayed as 18 weeks

**Solution:**
Shift week numbers by 1 to match 2011 Throwback pattern:
```typescript
// Map Madden week to historical week (shift by +1)
// Madden week 0 = Historical week 1, Madden week 16 = Historical week 17
const historicalWeekNum = maddenWeekNum + 1;

// For weeks beyond historical season, mark as OffSeason (type 8)
if (historicalWeekNum > maxHistoricalWeek) {
  setGameField(franchiseRecord, 'SeasonWeekType', SEASON_WEEK_TYPES.OffSeason);
}
```

**Key Values:**
- SeasonWeekType enum: PreSeason=0, RegularSeason=1, ..., OffSeason=8
- 2011 Throwback uses OffSeason (8) for Week 17, not PreSeason (0)
- NflseasonWeekCount in 2011 Throwback = 23 (includes preseason + playoffs)

**Fixed In:** RetroEditorService.ts `applyHistoricalSchedule()` method

---

### Issue: "name.toLowerCase is not a function" error when setting enum fields

**Symptoms:**
- Schedule application fails with error: `TypeError: name.toLowerCase is not a function`
- Error occurs when setting SeasonWeekType or other enum fields
- Some schedules work (e.g., 2004) while others fail (e.g., 1980)

**Root Cause:**
The madden-franchise library's `getMemberByName()` function (line 930 in index.cjs) expects a STRING parameter:
```javascript
getMemberByName(name) {
    return this._members.find((member) => {
        return member.name.toLowerCase() === name.toLowerCase(); // <-- Crashes if name is a number!
    });
}
```

When setting an enum field, the library calls `_getEnumFromValue(value)` which first tries `getMemberByName(value)`. If you pass a NUMERIC value (like `8` for OffSeason), the code does `name.toLowerCase()` where `name` is `8`, which crashes because numbers don't have a `toLowerCase()` method.

**Solution:**
ALWAYS pass STRING values for enum fields, never numeric values:
```typescript
// WRONG - causes crash:
setGameField(franchiseRecord, 'SeasonWeekType', 8);
record.SeasonWeekType = 8;
record.Field_53 = 8;

// CORRECT - use string enum names:
setGameField(franchiseRecord, 'SeasonWeekType', 'OffSeason');
record.SeasonWeekType = 'OffSeason';
record.Field_53 = 'OffSeason';  // Even for generic fields!
```

The library will correctly look up the enum member by name and convert it to the binary representation.

**Prevention:**
- Always use string enum values when setting fields in franchise files
- In `setGameField` function, convert numeric values to string names before passing to the record
- Add type checking/conversion for all enum-type fields

**Fixed In:** RetroEditorService.ts `setGameField()` function - now converts numeric values to string enum names

---

### Issue: Preseason schedule not being applied - week number mismatch

**Symptoms:**
- Apply historical schedule with preseason games
- Regular season applies correctly
- Console shows "No franchise preseason slots for week 1, 2, 3, 4"
- Preseason games unchanged in franchise file

**Root Cause:**
- Historical schedule JSON uses 1-indexed weeks (1, 2, 3, 4 for preseason)
- Madden franchise file uses 0-indexed weeks (0, 1, 2, 3 for preseason)
- Code was looking up `franchisePreseasonByWeek.get(1)` but Madden stores it as week 0

**Solution:**
```typescript
// Convert historical week (1-based) to Madden week (0-based)
const maddenWeekNum = historicalWeekNum - 1;
const franchiseGames = franchisePreseasonByWeek.get(maddenWeekNum);
```

**Key Pattern:**
- Same pattern as regular season: `const historicalWeekNum = maddenWeekNum + 1`
- For lookup: `maddenWeekNum = historicalWeekNum - 1`
- Both preseason and regular season use 0-indexed weeks in Madden

**Fixed In:** RetroEditorService.ts `applyHistoricalSchedule()` preseason section

---

### Issue: Schedule not applied - wrong TABLE_IDS.gameTable

**Symptoms:**
- Apply historical schedule via Retro Editor
- Console shows "Could not find SeasonGame table!" or falls back to getTableByName
- Schedule appears unchanged in game
- Team abbreviations show as numbers in schedule screen

**Root Cause:**
TABLE_IDS.gameTable was set to wrong value:
- **WRONG:** 2816609684 (doesn't exist in M26 franchise files)
- **CORRECT:** 1607878349 (actual SeasonGame table uniqueId)

The code fell back to `getTableByName('SeasonGame')` which does return the correct table, but other issues in the team mapping caused incorrect schedule application.

**Solution:**
```typescript
// In RetroEditorService.ts TABLE_IDS:
const TABLE_IDS = {
  // ...
  gameTable: 1607878349, // SeasonGame table - verified with check-table-ids.js
  // ...
};
```

**How to verify table IDs:**
```javascript
// Run this to check actual table IDs in a franchise file:
const gameTable = franchise.getTableByName('SeasonGame');
console.log('SeasonGame uniqueId:', gameTable.header?.uniqueId);
```

**Prevention:**
- Always verify TABLE_IDS match actual franchise file tables before using them
- Add logging when table lookup falls back to getTableByName
- Create verification script: `check-table-ids.js`

**Fixed In:** RetroEditorService.ts line 42 (TABLE_IDS.gameTable)

---

### Issue: Week skipping in franchise - simmed 1 week, jumped to 3

**Symptoms:**
- Apply historical schedule using Retro Editor
- Start franchise mode and sim 1 week
- Game skips multiple weeks (e.g., sim week 1, lands on week 3)
- Or weeks complete instantly without proper simulation

**Root Cause:**
- When applying a schedule to existing game slots, the GameStatus field was NOT being reset
- Old game slots may have GameStatus = "HomeWon" or "AwayWon" from previous simulations
- Madden sees these games as already completed and skips to the next unplayed week
- The RetroEditorService was updating HomeTeam, AwayTeam, SeasonWeekType but NOT GameStatus

**Locations in Code:**
1. `RetroEditorService.ts` line ~1207-1209: Regular season game application
2. `RetroEditorService.ts` line ~1396-1397: Preseason game application

**Solution:**
```typescript
// When applying a game, ALWAYS reset GameStatus to 'Unplayed'
franchiseRecord.HomeTeam = homeTeamRef;
franchiseRecord.AwayTeam = awayTeamRef;
setGameField(franchiseRecord, 'SeasonWeekType', 'RegularSeason');
// ADD THIS LINE - critical for proper week progression:
franchiseRecord.GameStatus = 'Unplayed';
```

**GameStatus Valid Values:**
- `'Unplayed'` - Game hasn't been simmed yet (what we want for new schedule)
- `'HomeWon'` - Home team won (simmed game)
- `'AwayWon'` - Away team won (simmed game)
- `'Invalid_'` - Cancelled/invalid game (e.g., Hall of Fame game)
- `'Unscheduled'` - Slot not used

**Prevention:**
- When modifying any game records, always consider GameStatus
- Test by checking week structure before/after: `check-week-state.js`
- Compare with working 2011 Throwback file structure

**Fixed In:** RetroEditorService.ts `applyHistoricalSchedule()` method - lines 1208-1209, 1396-1397

---

### Issue: User stuck on wrong team during preseason (e.g., Raiders instead of Cowboys)

**Symptoms:**
- User selects Cowboys as their team
- When pressing "Play Game" in preseason, game shows Raiders game instead
- After simming through preseason, regular season works correctly
- Happens on fresh franchise files, not just retro-edited ones

**Root Cause:**
High-index game slots (around idx 344-355) are "Hall of Fame" type games that have:
1. The user's team set as HomeTeam (correctly)
2. AwayTeam with an **incorrect team reference prefix** (e.g., `001001110000100000000000` instead of `001011100011101000000000`)

These games have SeasonGameNum=0 (first game of week) and SeasonWeekType=PreSeason, so Madden selects them as the game to play. But the broken AwayTeam reference causes the game to display incorrectly or fall back to a different game.

**Example of bad game:**
```
idx=344: SF @ DAL (USER HOME)
  HomeTeam: 00101110001110100000000000001110 (prefix correct, DAL)
  AwayTeam: 00100111000010000000000000000000 (prefix WRONG!)
  SeasonGameNum: 0
  SeasonWeekType: PreSeason
  GameStatus: Unplayed
```

**Solution:**
Find all games where team reference prefix doesn't match the file's correct prefix (from FranchiseUser.Team), and mark them as Invalid_/OffSeason:

```typescript
const homePrefix = record.HomeTeam?.slice(0, 24);
const awayPrefix = record.AwayTeam?.slice(0, 24);
const nullRef = '000000000000000000000000';

const homeBad = homePrefix && homePrefix !== correctPrefix && homePrefix !== nullRef;
const awayBad = awayPrefix && awayPrefix !== correctPrefix && awayPrefix !== nullRef;

if (homeBad || awayBad) {
  record.GameStatus = 'Invalid_';
  record.SeasonWeekType = 'OffSeason';
}
```

**Prevention:**
- The RetroEditorService now automatically fixes bad team reference prefixes when applying schedules
- Always verify team reference prefixes match before saving franchise files
- Test script: `check-high-index-games.js`

**Fixed In:** RetroEditorService.ts `applyHistoricalSchedule()` method - added bad team ref detection

---

## M26 Draft Class Save Errors

### Issue: M26 draft files fail to save with "argument must be a string" error

**Symptoms:**
- Generated draft class file appears to save successfully
- File won't load in Madden 26
- Console shows: `TypeError: argument must be a string`
- Error occurs in M26Writer during PEPS field processing

**Root Cause:**
1. PEPS field wasn't type-checked before writing (commit f1e358f)
2. Missing M25 header in generated M26 files (commit 2d0a124)
3. firstName/lastName/archetype had type inconsistencies (commit 3d1a194)

**Solution:**
```javascript
// In M26Writer.js - Add type checking for PEPS field
if (typeof prospect.PEPS !== 'string') {
  prospect.PEPS = String(prospect.PEPS || '');
}

// Ensure M25 header is present
const header = Buffer.from('M25', 'utf8');
// Write header before draft class data
```

**Prevention:**
- Add unit tests for PEPS field type conversion
- Validate all draft class headers in DraftClassService
- Use TypeScript strict mode for type safety

**Fixed In:** Commits f1e358f, 2d0a124, 3d1a194

---

## Data Format Mismatches

### Issue: Archetype doesn't persist after draft class generation

**Symptoms:**
- Generated prospects have undefined/null archetypes when loaded
- Archetype dropdown shows blank in editor
- Console shows archetype assignment but value doesn't save

**Root Cause:**
- Archetype was assigned as string name but saved as numeric ID
- CSV lookup has different format than in-memory representation (commit 093ce6a)
- Mismatch between `archetype` (display name) and archetype ID (numeric)

**Solution:**
```javascript
// Use archetypeDetailed from CSV lookup
const archetypeData = lookupService.getArchetypeForPosition(position);
prospect.archetype = archetypeData.id; // Use numeric ID, not name

// Ensure consistent format throughout pipeline
```

**Prevention:**
- Add type validation in RatingCalculator
- Document archetype field format in field-definitions.js
- Create integration test: generate → save → reload → verify archetype

**Fixed In:** Commit 093ce6a

---

### Issue: Position and team data format inconsistencies

**Symptoms:**
- Position shows as number instead of name in UI
- Team dropdown has wrong values
- Data looks correct in console but wrong in grid

**Root Cause:**
- Position codes are numeric (0-21) but UI expects strings ("QB", "WR")
- Team IDs are 1-32 (not 0-31) due to Madden indexing
- CSV data has mixed string/numeric formats (commits d92831d, d1e2736)

**Solution:**
```javascript
// Always convert position codes before display
const positionName = POSITION_MAP[positionCode] || 'Unknown';

// Team IDs are 1-based, not 0-based
const teamName = TEAM_MAP[teamId] || 'Unknown'; // teamId starts at 1
```

**Prevention:**
- Centralize position/team mapping in lookup service
- Add validation for position/team ID ranges
- Document the 1-based vs 0-based indexing

**Fixed In:** Commits d92831d, d1e2736

---

## Display and Rendering Bugs

### Issue: Archetype display bug after sorting by position

**Symptoms:**
- Wrong archetype shown for player after column sort
- Archetype renderer shows data from different row
- Sorting by position column causes data misalignment

**Root Cause:**
- Index mismatch between Handsontable data array and custom renderer
- Position codes were sorted numerically but renderer expected original index
- Renderer was using row index instead of data lookup (commits 44153ff, 20cf24d, c0e527e)

**Solution:**
```javascript
// Convert position codes to names BEFORE sorting
const paginatedPlayers = this.filteredPlayers.map(player => ({
  ...player,
  _positionName: POSITION_MAP[player.PPOS] || 'Unknown'
}));

// In renderer: Use getDataAtCell() instead of direct index
const archetype = instance.getDataAtCell(row, archetypeColumnIndex);
```

**Prevention:**
- Rebuild Handsontable view after any data mutation
- Use Handsontable's data access methods, not direct array indexing
- Add E2E test: sort column → verify data still matches

**Fixed In:** Commits 44153ff, 20cf24d, c0e527e

---

### Issue: Handsontable table "snaps left" unexpectedly

**Symptoms:**
- Table horizontally scrolls to leftmost position when clicking columns
- Scroll position not maintained after edits
- Frustrating user experience

**Root Cause:**
- `preventOverflow: 'horizontal'` setting was too aggressive
- Handsontable's internal scroll management conflicting with custom logic

**Solution:**
```javascript
// In Handsontable config
preventOverflow: false, // Allow natural scrolling
```

**Prevention:**
- Test scroll behavior after Handsontable config changes
- Document any preventOverflow setting changes

**Fixed In:** Recent work (not yet committed)

---

## Data Persistence Issues

### Issue: Player order not persisted after sorting in draft class

**Symptoms:**
- Players revert to original order when draft class reloaded
- UI sort changes display but not underlying file
- Sorting appears to work but doesn't save

**Root Cause:**
- Sort changes display order but not the actual data array
- DraftClassService didn't track order changes (commit d5eddec)
- Save operation used original unsorted array

**Solution:**
```javascript
// In DraftClassService - track order
this.playerOrder = [...sortedIndices]; // Store sort order

// On save - persist order to file
prospects.forEach((prospect, index) => {
  prospect.order = this.playerOrder[index];
});
```

**Prevention:**
- Always persist UI state to backing data
- Add integration test: sort → save → reload → verify order
- Document that display order must be synchronized with data order

**Fixed In:** Commit d5eddec

---

## Handsontable Sorting Issues

### Issue: OVR column won't sort when clicked

**Symptoms:**
- Clicking OVR (Overall Rating) column header does nothing
- Other columns sort fine
- Console shows click events detected but no sort action

**Root Cause:**
- App uses CUSTOM sorting system via `toggleColumnSort()` function
- Enabling Handsontable's built-in `columnSorting: true` conflicts with custom sorting
- Sort was working but data wasn't reaching Handsontable for display

**Solution:**
```javascript
// In Handsontable config
columnSorting: false, // DISABLE built-in sorting (we use custom)
multiColumnSorting: false,

// Use document-level event delegation for header clicks
document.addEventListener('click', (e) => {
  const header = e.target.closest('.sortable-header');
  if (header) {
    this.toggleColumnSort(header.dataset.field, e.shiftKey);
  }
});
```

**Debug Process:**
1. Added logging to verify click events detected ✓
2. Verified `toggleColumnSort()` was called ✓
3. Verified `sortColumns` array was set correctly ✓
4. Verified Handsontable re-rendering ✓
5. **Found:** Sort WAS working, data was sorted, but UI didn't update
6. **Cause:** Need to verify sorted data reaches Handsontable

**Prevention:**
- Never enable Handsontable's built-in sorting (conflicts with custom system)
- Always verify data flow: filter → sort → paginate → Handsontable
- Add E2E test for column sorting

**Fixed In:** Document-level event delegation (commit ac8c898), recent debugging work

---

## Packaging and Distribution Issues

### Issue: Saved roster files are 2.4KB instead of 6.4KB

**Symptoms:**
- App saves roster file successfully
- File size is 2.4KB instead of expected 6.4KB
- File won't load in Madden 26 (corrupted)

**Root Cause:**
- `nul` file in Windows project directory interferes with file I/O operations
- When Node.js tries to write, `nul` file redirect breaks the stream

**Solution:**
```bash
# Delete nul file from project
del nul

# Pre-package check automatically detects this now
npm run package  # Will fail if nul file exists
```

**Prevention:**
- Pre-package script checks for `nul` file (already implemented)
- Never commit `nul` file to git
- Add `**/nul` to .gitignore (already done)

**Fixed In:** Pre-package check script

---

### Issue: "Cannot find module 'bit-buffer'" in packaged app

**Symptoms:**
- App works in development (`npm start`)
- Packaged app crashes with "Cannot find module 'bit-buffer'"
- Same for stream-parser, crc-32

**Root Cause:**
- Required binary parsing modules not copied to `.vite/build/node_modules/`
- Vite doesn't automatically bundle CommonJS dependencies

**Solution:**
```javascript
// In vite.main.config.ts - Copy required modules
{
  name: 'copy-required-modules',
  closeBundle: async () => {
    const modules = ['bit-buffer', 'stream-parser', 'crc-32'];
    for (const mod of modules) {
      await fs.copy(
        path.join(__dirname, 'node_modules', mod),
        path.join(__dirname, '.vite/build/node_modules', mod)
      );
    }
  }
}
```

**Prevention:**
- Verify `.vite/build/node_modules/` contains all required modules
- Test packaged app before distribution
- Pre-package check verifies dependencies in package.json

**Fixed In:** vite.main.config.ts plugin

---

### Issue: App works from `out/` but not from extracted ZIP

**Symptoms:**
- Packaged app runs from `out/Madden Editor Suite-win32-x64/`
- Extracted ZIP version crashes or shows errors
- File paths or data files missing

**Root Cause:**
- Hardcoded paths like `C:\Users\tshan\` in code
- Missing data files in package
- File path resolution assumes development structure

**Solution:**
```javascript
// Use app.getAppPath() for all file paths
const dataPath = path.join(app.getAppPath(), 'data', 'lookups');

// Check if packaged for conditional logic
if (app.isPackaged) {
  // Production paths
} else {
  // Development paths
}
```

**Prevention:**
- Pre-package check scans for hardcoded user paths
- Always test extracted ZIP in different location
- Use relative paths or app.getAppPath()

**Fixed In:** Pre-package check, path resolution in main.ts

---

## Debugging Patterns

### Pattern: Add extensive logging first, then fix

**When Applied:**
- M26 draft class saves (commits with "debug: Add logging")
- Handsontable sorting issues (recent work)
- Portrait rendering problems

**Why Effective:**
- Confirms assumptions about code execution
- Reveals actual vs expected values
- Identifies exactly where data transform breaks

**Best Practice:**
```javascript
console.log('[ComponentName] ===== START OPERATION =====');
console.log('[ComponentName] Input:', JSON.stringify(input));
// ... operation ...
console.log('[ComponentName] Output:', JSON.stringify(output));
console.log('[ComponentName] ===== END OPERATION =====');
```

---

## Related Documentation

- `TESTING_STRATEGY.md` - Reliable vs unreliable tests
- `PROJECT_SETUP.md` - Build and packaging workflow
- `ARCHITECTURE.md` - System design and dependencies
