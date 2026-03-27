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

### Issue: Game crashes after simming with historical schedule

**Symptoms:**
- Apply historical schedule using Retro Editor (e.g., 1995 season)
- Loading the franchise file may work
- Simulating ANY week causes Madden to crash
- Crash happens during simulation

**Root Cause (Updated 2025-01):**
- Setting `SeasonWeekType` to `OffSeason` (8) causes Madden to crash
- Setting team references to all zeros (`'00000000000000000000000000000000'`) also causes crashes
- Any modification to game slots that Madden doesn't expect will cause instability

**What DOES NOT work:**
```typescript
// WRONG - OffSeason causes crash:
setGameField(franchiseRecord, 'SeasonWeekType', 'OffSeason');
franchiseRecord.HomeTeam = '00000000000000000000000000000000';
franchiseRecord.AwayTeam = '00000000000000000000000000000000';

// WRONG - PreSeason also doesn't help with extra regular season slots:
setGameField(franchiseRecord, 'SeasonWeekType', SEASON_WEEK_TYPES.PreSeason);
```

**CORRECT Solution:**
Do NOT modify extra game slots at all. Leave them untouched with their original matchups.

```typescript
// For weeks beyond historical season (e.g., week 18 when historical is 17 weeks):
// Just SKIP these games - don't modify them at all
if (historicalWeekNum > maxHistoricalWeek) {
  console.log(`SKIPPING games beyond historical season - leaving untouched`);
  // Do NOT modify these games
  continue;
}

// For extra game slots within a week (when era had fewer games):
if (franchiseGames.length > historicalGames.length) {
  // Do NOT modify the extra slots - leave them as-is
  console.log(`SKIPPING extra slots - leaving untouched`);
}
```

**Prevention:**
- Never set SeasonWeekType to OffSeason for regular season game slots
- Never set team references to all-zeros
- Leave extra game slots UNTOUCHED - don't modify them at all
- Test sim at least 2 weeks after any schedule-related changes

**Fixed In:** RetroEditorService.ts `applyHistoricalSchedule()` method (Jan 2025)

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

### Issue: Expansion/Relocation "Player table not found" error

**Symptoms:**
- Apply 1996 Browns→Ravens relocation via Retro Editor
- Console shows: `Relocation result: {"success":false,"playersTransferred":0,"playerNames":[],"error":"Player table not found"}`
- Expansion drafts (1976, 1999, etc.) fail silently with same error

**Root Cause:**
- `TABLE_IDS.playerTable` was set to `432457634` (incorrect ID)
- Actual Player table ID in M26 franchise files is `4222`
- Found via `franchise-table-list.txt` dump: `Player ID: 4222 Records: 3043/3960`

**Solution:**
1. Fix the TABLE_ID:
```typescript
// In RetroEditorService.ts TABLE_IDS constant:
playerTable: 4222,  // NOT 432457634
```

2. Use `getTableByName()` fallback for robustness:
```typescript
// Get player table - try by name first, then by ID
let playerTable = franchise.getTableByName('Player');
if (!playerTable) {
  playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
}
if (!playerTable) {
  throw new Error('Player table not found');
}
```

**Prevention:**
- When adding new table IDs, verify against `franchise-table-list.txt` dump
- Always use `getTableByName()` as primary lookup with ID as fallback
- Pattern matches how Team, Coach, Stadium tables are accessed

**Fixed In:** RetroEditorService.ts - TABLE_IDS.playerTable and all player table lookups

---

### Issue: Inactive teams (Browns 1996-98) still appear in preseason

**Symptoms:**
- Apply 1996 retro settings
- Roster transfer works (74 players moved to Ravens)
- Browns still appear in preseason schedule games
- Browns should be completely inactive 1996-1998

**Root Cause:**
- Code to handle inactive teams in preseason exists (lines ~1838-1958)
- BUT it was inside `if (!SKIP_PRESEASON)` guard
- `SKIP_PRESEASON = true` (to not apply historical preseason data)
- This accidentally skipped the inactive team handling too

**Solution:**
Remove the `if (!SKIP_PRESEASON)` guard from the inactive team handling section:
```typescript
// WRONG - skips inactive team handling:
if (!SKIP_PRESEASON) {
  // Get teams that didn't exist...
  // Replace inactive teams in preseason...
}

// CORRECT - always handle inactive teams:
{
  // Get teams that didn't exist...
  // Replace inactive teams in preseason...
}
```

**Key Insight:**
- SKIP_PRESEASON should only control applying historical preseason data
- Inactive team handling must ALWAYS run, even with SKIP_PRESEASON=true
- Browns 1996-98 are handled via `brownsSpecialCase.inactiveYears`

**Fixed In:** RetroEditorService.ts `applyHistoricalSchedule()` - line ~1842

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

### Issue: Team relocation moves WRONG teams (Broncos instead of Browns)

**Symptoms:**
- Execute 1996 Browns→Ravens relocation via Retro Editor
- Console shows "74 players transferred"
- BUT the wrong teams are affected!
- Broncos roster gets emptied (should be Browns)
- Players end up on Rams (should be Ravens)

**Root Cause:**
The Team table and Player[] roster array table are NOT indexed by TeamIndex!

```
Team table record ordering (NOT sorted by TeamIndex):
  records[0]: TeamIndex=14 (SF/49ers)
  records[1]: TeamIndex=0 (CHI/Bears)
  records[4]: TeamIndex=3 (DEN/Broncos)  ← We used records[4]!
  records[5]: TeamIndex=4 (CLE/Browns)   ← Should have used this!
  records[29]: TeamIndex=23 (STL/Rams)   ← We used records[24]!
  records[30]: TeamIndex=24 (BAL/Ravens) ← Should have used this!
```

The code was doing `rosterArrayTable.records[teamIndex]` where teamIndex=4 (Browns).
But records[4] = Broncos (TeamIndex=3), NOT Browns!

**Solution:**
Build a TeamIndex → record position mapping FIRST, then use it:

```typescript
// Build mapping from TeamIndex to actual record position
const teamIndexToRecordPosition = new Map<number, number>();
const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
await teamTable.readRecords();

for (let i = 0; i < teamTable.records.length; i++) {
  const team = teamTable.records[i];
  if (team && !team.isEmpty && team.TeamIndex !== undefined && team.TeamIndex < 32) {
    teamIndexToRecordPosition.set(team.TeamIndex, i);
  }
}

// Use the mapping for roster array access
const sourceRecordIdx = teamIndexToRecordPosition.get(sourceTeamIndex);
const destRecordIdx = teamIndexToRecordPosition.get(destTeamIndex);

const sourceRoster = rosterArrayTable.records[sourceRecordIdx];
const destRoster = rosterArrayTable.records[destRecordIdx];
```

**Key Discovery:**
- Team table records are NOT sorted by TeamIndex
- Roster array table (ID 5907) uses the SAME record ordering as Team table
- Both tables have ~37 records with some EMPTY slots (records[20], records[24])
- TeamIndex values 0-31 represent NFL teams, TeamIndex 32 = special (FA, AFC, NFC)

**Prevention:**
- NEVER use teamIndex directly as array index
- Always build TeamIndex → record position mapping first
- Test with debug-team-indices.js script before any relocation code changes

**Debug Script:** `debug-team-indices.js` - Run this to verify team mappings

**Fixed In:** RetroEditorService.ts `executeRelocation()` method - now uses proper index mapping

---

### Issue: Team relocation not actually moving rosters in-game

**Symptoms:**
- Execute 1996 Browns→Ravens relocation via Retro Editor
- Console shows "74 players transferred"
- In-game, Browns still have their original roster
- Ravens still have their original roster
- TeamIndex changes aren't reflected in actual gameplay

**Root Cause:**
Madden reads team rosters from the **Player[] array table (ID 5907)**, NOT from `player.TeamIndex`. Each team has a row in table 5907 containing Player0..Player99 reference fields pointing to actual player records.

The original code only changed `player.TeamIndex` which is metadata that doesn't affect gameplay rosters.

**Solution:**
Rewrite `executeRelocation()` to manipulate BOTH:
1. The Player[] roster array table (ID 5907) - this is what the game actually reads
2. The player.TeamIndex field - for data consistency

```typescript
// Get Player[] roster array table
const ROSTER_ARRAY_TABLE_ID = 5907;
const rosterArrayTable = franchise.getTableById(ROSTER_ARRAY_TABLE_ID);
await rosterArrayTable.readRecords();

const sourceRoster = rosterArrayTable.records[sourceTeamIndex];
const destRoster = rosterArrayTable.records[destTeamIndex];

// Copy player refs from source to dest
for (let i = 0; i < sourceOriginalSize; i++) {
  const destField = destRoster._fieldsArray[i];
  destField.value = sourcePlayerRefs[i];  // 32-bit binary ref
}
destRoster.arraySize = sourcePlayerRefs.length;

// Clear source roster
for (let i = 0; i < sourceOriginalSize; i++) {
  const srcField = sourceRoster._fieldsArray[i];
  srcField.value = '00000000000000000000000000000000';  // Empty ref
}
sourceRoster.arraySize = 0;
```

**Key Discovery:**
- `field.value` has both getter and setter
- `record.arraySize` is directly settable
- Empty reference value is 32 bits of zeros
- `playerTable.getBinaryReferenceToRecord(rowIndex)` creates valid reference values

**Prevention:**
- When moving players between teams, ALWAYS update the Player[] array table
- TeamIndex alone does NOT affect gameplay rosters
- Test roster changes in-game, not just via console logs

**Fixed In:** RetroEditorService.ts `executeRelocation()` method - now manipulates table 5907

---

### Issue: Players moved to Free Agency don't appear in-game

**Symptoms:**
- Execute relocation (e.g., Browns→Ravens)
- Original Ravens players should go to Free Agency
- Set `TeamIndex = 32` for those players
- In-game, players don't appear in Free Agent list
- They're invisible/missing from the game

**Root Cause:**
Free Agency requires BOTH:
1. `TeamIndex = 32` (marks player as free agent)
2. `ContractStatus = "FreeAgent"` (enables player visibility in FA screens)

The code was only setting `TeamIndex = 32` but leaving `ContractStatus = "Signed"`. Players with `ContractStatus = "Signed"` and `TeamIndex = 32` are essentially orphaned - they belong to no team but aren't visible as free agents either.

**Schema Discovery:**
```
ContractStatus: PlayerContractStatus (enum)
  Valid values: ["Drafted","FirstActive_","FirstOnTeam_","Signed","Expiring",
                 "RestrictedFreeAgents","LastOnTeam_","PracticeSquad","Draft",
                 "FreeAgent","LastActive_","Retired","Created","Deleted",
                 "None","Extended","Restructured"]
```

**Evidence:**
```
Original file (working FA):
  TeamIndex=32 + ContractStatus=Signed: 2 players
  TeamIndex=32 + ContractStatus=FreeAgent: 1116 players

After broken relocation:
  TeamIndex=32 + ContractStatus=Signed: 66 players (64 Ravens + 2 original)
  TeamIndex=32 + ContractStatus=FreeAgent: 1116 players (unchanged!)
```

**Solution (COMPLETE - all fields required):**
```typescript
// WRONG - players become invisible:
player.TeamIndex = 32;

// CORRECT - players appear in Free Agency:
// Must set ALL of these fields to match actual FA players:
player.TeamIndex = 32;
player.ContractStatus = 'FreeAgent';
player.ContractLength = 0;
player.ContractYear = 0;
player.PLYR_CONSECYEARSWITHTEAM = 0;  // CRITICAL - consecutive years with team must be 0
player.PLYR_ISCAPTAIN = false;         // FA players are not captains
// Clear all salary/bonus years
for (let i = 0; i < 8; i++) {
  player[`ContractSalary${i}`] = 0;
  player[`ContractBonus${i}`] = 0;
}
```

**Research Evidence (Jan 2025):**
Compared visible FA players (Shaq Mason, Stephon Gilmore) vs invisible moved players (Bryce Young, Trevor Lawrence):
- All had TeamIndex=32, ContractStatus=FreeAgent, ContractLength=0
- DIFFERENCE: PLYR_CONSECYEARSWITHTEAM was 0 for visible, 2/4 for invisible
- Clearing PLYR_CONSECYEARSWITHTEAM makes moved players visible in FA

**How to find schema information:**
1. Schema files are in `node_modules/madden-franchise/data/schemas/26/M26_677_0.gz`
2. Extract with `gunzip -c M26_677_0.gz > M26_677_0.json`
3. Parse JSON to find field definitions and enum values
4. Schema contains 334 Player fields and 314 Team fields with all enums

**Prevention:**
- When moving players to FA, ALWAYS set BOTH TeamIndex AND ContractStatus
- Check schema for any enum field before setting values
- Test FA visibility in-game, not just by reading file data
- Schema is the authoritative source for field definitions

**Fixed In:** RetroEditorService.ts `executeRelocation()` method - now sets ContractStatus='FreeAgent'

---

### Issue: Body Type shows wrong value in editor (display bug)

**Symptoms:**
- File data shows PCBT=4 (Lean) for a player
- Editor UI shows "Heavy" (value 3) instead
- Sorting the grid causes values to appear misaligned
- Body type doesn't match what you set in-game

**Root Cause:**
The `normalizeBodyTypes()` function was called during roster loading, which recalculated body types based on weight and position - overwriting the authoritative BTYP value from the BLBM table.

For example, Quinnen Williams (DT):
- BTYP in BLBM = 4 (Lean) - what the game uses
- RosterParser synced PCBT = 4 (Lean) - correct!
- `normalizeBodyTypes()` saw DT position → forced PCBT = 3 (Heavy) - WRONG!

The function at line 921-923 always returns Heavy (3) for linemen regardless of weight:
```javascript
if (heavyPositions.includes(position)) {
    return 3; // Always Heavy for OL/DT
}
```

**Solution:**
Remove the `normalizeBodyTypes()` call during roster loading. The BTYP value from BLBM (synced to PCBT by RosterParser) is the **authoritative source** - users may intentionally set non-standard body types.

```javascript
// In app.js loadRosterFile() - REMOVED:
// this.normalizeBodyTypes();

// REPLACED WITH:
// NOTE: Body types are synced from BTYP (BLBM table) in RosterParser.js
// We do NOT normalize here because BTYP is authoritative
```

**Key Insight:**
- BTYP in BLBM table = what the game actually reads for body type
- PCBT in PLAY table = display value only, synced from BTYP on load
- Missing BTYP = Standard (0) body type (game default)
- User edits should be preserved, not overwritten by "smart" normalization

**Fixed In:** app.js `loadRosterFile()` method - removed normalizeBodyTypes() call

---

### Issue: Body Type visual doesn't change in-game (ITAN field)

**Symptoms:**
- Change body type in editor (e.g., Lean to Heavy)
- Save file - BTYP and PCBT values are correct
- In-game UI shows "Heavy" but **3D body model is still Lean**
- The label changed but the actual visual didn't

**Root Cause:**
The 3D body mesh is controlled by `ITAN` field in a nested subtable, NOT by BTYP:
```
BLBM → LOUT[1] (LDTY=0) → PINS → SLOT=129 → ITAN
```

Body type ITAN values:
- `Standard_BodyType`
- `Thin_BodyType`
- `Muscular_BodyType`
- `Heavy_BodyType`
- `Lean_BodyType`

**Solution:**
When changing body type, update ALL of these:
1. `PLAY.PCBT` - The body type code (0-4)
2. `BLBM.BTYP` - Body type in appearance data
3. `BLBM.WLBS` - Weight for body sizing
4. `BLBM.LOUT[].PINS.SLOT=129.ITAN` - **The actual 3D mesh control**

```javascript
// In GenericFaceService.js syncBodyTypeForAllPlayers():
const BODY_TYPE_NAMES = ['Standard', 'Thin', 'Muscular', 'Heavy', 'Lean'];
const bodyTypeName = BODY_TYPE_NAMES[pcbt] || 'Standard';
const targetITAN = `${bodyTypeName}_BodyType`;

// Find LOUT → PINS → SLOT=129 and update ITAN
const lout = fields['LOUT']?.value;
for (const loutRec of lout._records) {
  const pins = loutFields?.PINS?.value;
  for (const pinRec of pins._records) {
    if (pinFields?.SLOT?.value === 129) {
      pinFields.ITAN.value = targetITAN;
    }
  }
}
```

**Key Discovery (Jan 2025):**
- BTYP controls the UI label only
- ITAN in LOUT→PINS→SLOT=129 controls the actual 3D body mesh
- Both must be updated for body type to work correctly

**Fixed In:** GenericFaceService.js `syncBodyTypeForAllPlayers()` method

---

### Issue: Body Type changes don't persist for players without BTYP field

**Symptoms:**
- Change body type from Standard (0) to Heavy (3) for Dak Prescott
- Save file
- Reload file - body type is back to Standard
- In-game, body type unchanged

**Root Cause:**
The BLBM table has **variable structure** - different players have different fields:

| Player | Has BTYP? | Original Fields |
|--------|-----------|-----------------|
| Dak Prescott | NO | 12 fields |
| George Pickens | YES | 13 fields |
| In-game edited | YES | 16 fields |

Players without BTYP in BLBM default to Standard (0). The GenericFaceService only updated BTYP if the field already existed:
```javascript
// WRONG - only updates existing BTYP:
if (fields['BTYP']) {
  fields['BTYP'].value = pcbt;
}
```

**Solution:**
Create the BTYP field when it doesn't exist and user sets a non-Standard body type:

```javascript
// In GenericFaceService.js syncBTYP():
if (fields['BTYP']) {
  // Update existing field
  fields['BTYP'].value = pcbt;
} else if (pcbt !== 0) {
  // CREATE new BTYP field for non-Standard body types
  const newField = new TDB2Field();
  newField.key = 'BTYP';
  newField.type = FIELD_TYPE_INT;
  newField.rawKey = Buffer.from([...utilService.compress6BitString('BTYP'), FIELD_TYPE_INT]);
  newField.value = pcbt;
  newField._isChanged = true;
  fields['BTYP'] = newField;
}
```

**Key Pattern:**
- BTYP only exists for NON-Standard body types in original files
- Missing BTYP = Standard (0) is the game default
- We only need to create BTYP when setting non-Standard values

**Fixed In:** GenericFaceService.js `syncBTYP()` method - now creates BTYP field when needed

---

### Issue: Body Type edits not applying in-game for real players

**Symptoms:**
- Setting a player with a real-life headscan (e.g., Quinnen Williams) to "Heavy" in the editor.
- In-game, the player's body type appears unchanged (e.g., "Lean" or "Standard").
- Edits to created players or players without a headscan work correctly.

**Root Cause:**
Real NFL players have a non-zero `PGID` (Player Geometry ID) field in the `Player` table, which links them to their specific 3D-scanned body model. When this `PGID` is set to any value other than `0`, the game engine **ignores** the `BSHP` (Body Shape) field and renders the scanned model instead.

**Solution:**
To force a body type change on a real player, you must "detach" them from their scanned model by clearing the `PGID`. This logic works for both real and generic players (generic players already have `PGID=0`).

Use this helper function logic when saving body type changes:

```typescript
/**
 * Updates a player's body type ensuring it renders in-game.
 * Handles both Real (scanned) and Generic players correctly.
 */
function updatePlayerBodyType(playerRecord, newBodyType) {
  // 1. Set the Body Shape (BSHP)
  playerRecord.BSHP = newBodyType; // e.g., 'Heavy'

  // 2. CRITICAL: Clear PGID to force the game to use the BSHP value.
  // - For Real Players (PGID != 0): This removes the face scan but allows body editing.
  // - For Generic Players (PGID == 0): This is a no-op and safe.
  if (playerRecord.PGID !== 0) {
    console.log(`Clearing PGID for ${playerRecord.FirstName} ${playerRecord.LastName} to apply body type.`);
    playerRecord.PGID = 0;
  }
}
```

**Important Trade-off:**
Clearing `PGID` will cause real players to **lose their real-life face scan** and revert to a generic face (defined by `PGHE`). This is unavoidable because scanned meshes have fixed body geometry that cannot be modified dynamically.

**Impact on Generic Players:**
This fix is safe for generic players (draft classes, created players). They already have `PGID = 0`, so this logic simply ensures they remain editable.

**Prevention:**
- Any UI component that allows editing `PlayerBodyType` (`BSHP`) must also set `PGID` to `0`.

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

### Issue: Draft class push to database ratings not showing in Player Browser

**Symptoms:**
- Push draft class to database succeeds (shows "X players created/updated")
- Check Player Browser for the pushed year's ratings
- Ratings are missing or all show as 0/null
- Bio fields may be present but all rating fields are empty

**Root Cause (March 2026):**
**Field name mismatch** between DraftClassDatabaseService and UserDatabaseService.

DraftClassDatabaseService was using **legacy field names**:
- `PSTM` (wrong - should be `PSTA` for stamina)
- `PBTK` (wrong - should be `PBKT` for break tackle)
- `PTRK` (wrong - should be `PLTR` for trucking)
- `PCOD` (wrong - should be `PELU` for change of direction)
- And many more...

UserDatabaseService.saveCustomPlayerSeason() iterates over its `RATING_FIELDS` array looking for M26 field names like `PSTA`, `PBKT`, `PLTR`, etc. When passed legacy names like `PBTK: 75`, it didn't find them and stored `null`.

**Solution:**
1. Update `RATING_FIELDS` in DraftClassDatabaseService to use correct M26 codes
2. Add `LEGACY_TO_M26_FIELD_MAP` to convert old field names to new
3. Update rating extraction to check both M26 names and legacy names

```typescript
// In DraftClassDatabaseService.ts:
// Added LEGACY_TO_M26_FIELD_MAP
const LEGACY_TO_M26_FIELD_MAP: Record<string, string> = {
  'PSTM': 'PSTA',  // Stamina
  'PBTK': 'PBKT',  // Break Tackle
  'PTRK': 'PLTR',  // Trucking
  // ... etc
};

// In saveSeasonData() and saveSeasonEditData():
// Check for legacy field names and convert to M26 names
for (const [legacyName, m26Name] of Object.entries(LEGACY_TO_M26_FIELD_MAP)) {
  if (prospect[legacyName] !== undefined && !ratings[m26Name]) {
    ratings[m26Name] = prospect[legacyName];
  }
}
```

**Prevention:**
- Always use M26 field codes when saving to UserDatabaseService
- Check field name mapping when adding new database integration features
- Reference UserDatabaseService.RATING_FIELDS as the authoritative field list

**Fixed In:** DraftClassDatabaseService.ts - Updated RATING_FIELDS, added LEGACY_TO_M26_FIELD_MAP, updated saveSeasonData() and saveSeasonEditData()

---

### Issue: Draft class generic faces don't match in-game appearance

**Symptoms:**
- User selects a generic face (e.g., "gen_7_B_N_019") in PAM-only mode for a draft prospect
- Face picker shows correct preview
- In-game, the player's face doesn't match - wrong skin tone, different face entirely
- Face/body skin tone mismatch (face shows one ethnicity, body shows different skin tone)

**Root Cause (Updated March 2026):**
For **DRAFT CLASS FILES**, the game uses ONLY the visuals JSON fields - NOT binary fields.

Research from comparing working vs broken draft class files revealed:

1. **CORRECT draft files have:**
   - `genericHeadName` = "gen_X_..." (string identifier)
   - `skinTone` = number (1-7 matching first digit of face name)
   - `genericHead` = **undefined** (NOT SET!)
   - Binary offset 0x8E = **0** (NOT the numeric face ID)

2. **BROKEN draft files had:**
   - `genericHead` = numeric value (e.g., 8) - WRONG!
   - Binary offset 0x8E = numeric value (e.g., 9, 169) - WRONG!

**Key Finding:**
Draft class files work DIFFERENTLY than roster files:
- **Roster files**: May use genericHead numeric value in visuals JSON
- **Draft class files**: Must have genericHead=undefined, binary 0x8E=0

**Multiple bugs were causing this:**

1. **PAMPicker (app.js)** - Didn't create visuals object if missing:
```javascript
// BUG: Only set if visuals already existed
if (player.visuals) {
    player.visuals.genericHeadName = pamValue;
}

// FIX: Create visuals if missing
if (!player.visuals) {
    player.visuals = {};
}
player.visuals.genericHeadName = pamValue;
```

2. **M26Writer.js** - Was incorrectly setting genericHead:
```javascript
// BUG: Setting genericHead breaks draft classes
visuals.genericHead = genericHeadNum;  // WRONG!

// FIX: Delete genericHead if it exists
if (visuals.genericHead !== undefined) {
    delete visuals.genericHead;  // Must be undefined for draft classes
}
```

3. **M26Writer.js** - Was writing to binary offset 0x8E:
```javascript
// BUG: Writing numeric ID to binary field
buffer.writeUInt16LE(genericHeadNum, offset + 0x8E);  // WRONG!

// FIX: Leave 0x8E at 0 for draft classes
// Binary genericHead at 0x8E should be 0 - game uses visuals JSON only
```

**Verification Method:**
Created comparison script `analyze-correct-visuals.js` to inspect working draft class:
```
Prospect 0: genericHead=undefined, genericHeadName="gen_1_B_N_03", skinTone=1
Prospect 1: genericHead=undefined, genericHeadName="gen_1_B_N_02", skinTone=1
Prospect 2: genericHead=undefined, genericHeadName="gen_1_B_N_011", skinTone=1
...
All prospects: genericHead NOT SET (undefined)
```

**Prevention:**
- Compare working game files before assuming how fields should be set
- Draft classes and rosters have DIFFERENT requirements
- Test face changes in-game, not just in editor preview

**Fixed In:**
- app.js (PAMPicker) - Create visuals object if missing
- M26Writer.js - Remove genericHead from visuals, don't write to 0x8E

---

### Issue: Generated draft class faces don't match - using template faces

**Symptoms:**
- Generate a draft class using CreatorService (historical draft generator)
- In-game, all players have faces from the TEMPLATE file, not the generated faces
- CreatorService correctly assigns faces via `assignGenericFace()` but in-game shows different faces
- Console logs show correct PEPS values (e.g., "gen_7_B_G_005") but game shows wrong face

**Root Cause:**
When generating draft classes, the code copies `templateVisuals` from the template file's prospects.
But it was NOT updating `templateVisuals.genericHeadName` to match the generated player's `PEPS` value.

The template's `genericHeadName` was being preserved, so when saved:
- `prospect.visuals.genericHeadName` = template's face (e.g., "gen_1_A_B_002")
- `prospect.PEPS` = generated face (e.g., "gen_7_B_G_005")

The save function prioritizes `prospect.visuals?.genericHeadName` over `prospect.PEPS`, so the template face wins.

**Solution (app.js ~ line 10596):**
```javascript
// When copying template visuals, update genericHeadName to match generated PEPS
if (templateVisuals) {
    if (player.PEPS) {
        templateVisuals.genericHeadName = player.PEPS;
        // Also extract and set skin tone from PEPS
        const skinMatch = player.PEPS.match(/^gen_(\d+)_/i);
        if (skinMatch) {
            templateVisuals.skinTone = parseInt(skinMatch[1], 10);
        }
    }
    // ... rest of bodyType update
}
```

**Prevention:**
- When copying template data, always update fields that should differ from template
- Don't assume template values are correct defaults for generated data
- Test generated draft classes in-game, not just in editor

**Fixed In:** app.js - Update templateVisuals.genericHeadName when generating draft classes

---

### Issue: Generated roster players have face/body skin tone mismatch

**Symptoms:**
- Generate a historical roster using RosterCreatorService or RosterGeneratorService
- In-game, players with generic faces show WRONG body skin tone
- Face shows one ethnicity (e.g., white), but arms/body show different skin (e.g., black)
- Looks like a "floating head" effect with mismatched skin tones

**Root Cause (March 2026):**
The `selectGenericFaceByRace()` method returned `{ pid, pam, pghe }` but NOT `pski`.
This caused callers to set PSKI (body skin tone) independently from PAM selection,
resulting in mismatched face/body skin tones.

The comments "DON'T SET PSKI - BLBM handles it" were **WRONG**. PSKI MUST be set
consistently with the PAM value to ensure body skin matches face skin.

**How PSKI relates to PAM:**
- PAM format: `gen_X_Y_Z_NNN` where X = skin tone (1-7)
- Skin tones 1-2 → PSKI = 2 (white body)
- Skin tones 3-4 → PSKI = 0 (mixed/tan body)
- Skin tones 5-7 → PSKI = 1 (black body)

**Solution:**
Modified `selectGenericFaceByRace()` in BOTH services to return PSKI derived from PAM:

```typescript
// RosterCreatorService.ts and RosterGeneratorService.ts
private selectGenericFaceByRace(race: number): { pid: number; pam: string; pghe: number; pski: number } {
  const pam = this.generateGenericHeadName(race);
  const pski = this.getPSKIFromPAM(pam);  // CRITICAL: Derive from PAM
  // ...
  return { pid, pam, pghe, pski };
}

// getPSKIFromPAM extracts skin tone from PAM and maps to PSKI:
private getPSKIFromPAM(pam: string): number {
  const skinTone = parseInt(pam.charAt(4)); // First digit after "gen_"
  if (skinTone <= 2) return 2; // Light skin -> white body
  if (skinTone >= 5) return 1; // Dark skin -> black body
  return 0; // Medium skin -> mixed body
}
```

All callers updated to use returned PSKI:
```typescript
const genericFace = this.selectGenericFaceByRace(race);
player.PSKI = genericFace.pski; // CRITICAL: Use returned PSKI
```

**Prevention:**
- Always derive PSKI from PAM, never set independently
- When PAM is set, PSKI MUST be derived from it
- The face picker (renderer UI) is SEPARATE and not affected by this fix

**Fixed In:**
- RosterCreatorService.ts - `selectGenericFaceByRace()` returns pski, all callers updated
- RosterGeneratorService.ts - `selectGenericFaceByRace()` returns pski, all callers updated

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
