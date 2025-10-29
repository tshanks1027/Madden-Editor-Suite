# RESEARCH SYNTHESIS: Complete Franchise Editor Implementation Plan

**Date:** 2025-10-26
**Purpose:** Synthesize all research findings into actionable implementation plan
**Context:** Phase 5 - Franchise Editor (18 days behind schedule)

---

## Executive Summary

After comprehensive research of 4 reference implementations (our roster editor, madden-franchise-editor, Sinthros/madden-franchise-utils, MyFranchise), we now have a complete understanding of how to build a professional franchise editor for Madden 26.

**Key Insight:** We've been overcomplicating things. The madden-franchise library already handles 90% of the complexity (binary parsing, schema loading, enum conversion). We just need to use it properly and add lookup-based display for professional UX.

---

## Research Task Results Summary

### Task 1: Our Roster Editor Analysis
**Document:** `RESEARCH-roster-college-handling.md`

**Critical Finding:** 🔴 **BLOCKER IDENTIFIED**
- Franchise save handler is completely broken
- Missing the update loop that applies UI edits to records
- RosterParser.js has the working pattern to copy

**Working Save Pattern:**
```javascript
// RosterParser.js - WORKING IMPLEMENTATION
for (let i = 0; i < players.length; i++) {
  const record = playerTable.records[i];
  for (const fieldName in players[i]) {
    if (record.fields[fieldName]) {
      record.fields[fieldName].value = players[i][fieldName];
    }
  }
}
```

### Task 2: madden-franchise-editor Analysis
**Document:** `RESEARCH-madden-franchise-editor-architecture.md`

**Critical Finding:** Schema-based enum conversion is built-in
- NO custom lookup tables needed
- NO manual enum conversions needed
- Library returns enum names automatically ("Alabama", not IDs)
- Only need custom rendering for references and binary blobs

**Architecture Pattern:**
```
Main Process → IPC → madden-franchise library
Renderer → Handsontable → Custom renderers (only for references)
```

**Key Code Pattern:**
```javascript
// Library automatically converts enums!
field.value  // Returns "Alabama" (if schema loaded)
field._value // Returns raw binary

// For dropdowns, extract from schema:
const enumValues = offset.enum.members.map(m => m.name);
```

### Task 3: Sinthros Utils Analysis
**Document:** `RESEARCH-sinthros-franchise-utils.md`

**Critical Finding:** String assignment works directly
```javascript
// Write enum fields as strings
player['College'] = 'Alabama';
player['Position'] = 'QB';
player['State'] = 'Alabama';

// Library handles binary encoding automatically
await file.save();
```

**Schema Introspection Pattern:**
```javascript
function getEnumValues(table, fieldName) {
  const record = table.records[0];
  const fieldOffset = record._fields[fieldName]?.offset;
  return fieldOffset?.enum?._members.map(m => m._name) || [];
}
```

### Task 4: Binary String Root Cause Analysis
**Document:** `RESEARCH-binary-string-root-cause.md`

**Critical Finding:** FALSE ALARM - Already working correctly!
- Session logs show numeric IDs (`"PCOL":255`), NOT binary strings
- Binary strings likely from draft class parser (different system)
- Current franchise implementation returning correct values
- CSV lookup system properly configured

**When Binary Strings Appear:**
Only when enum schema has empty members array (`enum._members = []`)

### Task 5: MyFranchise Implementation
**Documents:** `RESEARCH-myfranchise-implementation.md`, `MYFRANCHISE-KEY-FINDINGS.md`

**Critical Finding:** Lookup-based display is THE key UX feature
- Store numeric IDs in file (CollegeId = 1)
- Display human names via JSON lookups ("Abilene Christian")
- Edit via dropdowns showing names
- Save numeric ID back

**Lookup Files Available:**
- `colleges.json` (265KB) - ~500 colleges with names, conferences, colors
- `positions.json` - All positions (QB, HB, WR, etc.)
- `attributes.json` - Rating metadata
- `ovrweights.json` (75KB) - Overall rating calculation formulas

---

## Critical Issues Identified

### Issue 1: Broken Save Handler (BLOCKER)
**File:** `src/main/ipc/franchise-handlers.ts`
**Problem:** Missing update loop - saves NO changes at all
**Impact:** ALL editing functionality blocked
**Fix:** Copy pattern from RosterParser.js

### Issue 2: Raw ID Display (UX)
**File:** `src/renderer/js/franchise-editor.js`
**Problem:** Shows IDs (255) instead of names ("West Virginia")
**Impact:** Editor feels unprofessional, hard to use
**Fix:** Implement LookupService with JSON files from MyFranchise

### Issue 3: Limited Table Support
**Current:** Only Player table
**Needed:** Player, Coach, Free Agent, Team (minimum)
**Impact:** Can't call it a "Franchise Editor" with 1 table
**Fix:** Add tab navigation for multiple tables

---

## The Complete Picture: How Franchise Files Work

### File Structure
```
Franchise File (Binary)
├── Header (TDB, FBCH, etc.)
├── Schema Definition
│   ├── Table definitions
│   ├── Field definitions
│   └── Enum definitions (College, Position, State, etc.)
└── Tables
    ├── Player (3000+ records)
    ├── Coach (500+ records)
    ├── Team (32 records)
    ├── FreeAgent (1000+ records)
    ├── SeasonGame (256+ records)
    ├── SeasonInfo (1 record)
    └── ~100 more tables
```

### How madden-franchise Library Works

1. **Loading:**
   ```javascript
   const file = new FranchiseFile(filePath, {
     gameYearOverride: 26
   });

   file.on('ready', () => {
     // Schema loaded
     // Enums populated
     // Tables ready
   });
   ```

2. **Reading:**
   ```javascript
   const playerTable = file.getTableByName('Player');
   await playerTable.readRecords();

   for (const record of playerTable.records) {
     const college = record.College;  // Returns "Alabama" (or numeric if enum empty)
     const firstName = record.FirstName;  // Returns string
     const speed = record.SpeedRating;  // Returns number
   }
   ```

3. **Writing:**
   ```javascript
   record.College = 'LSU';  // String assignment works!
   record.SpeedRating = 95;
   ```

4. **Saving:**
   ```javascript
   await file.save();  // Library regenerates binary
   ```

### Enum Field Handling (The Tricky Part)

**Schema defines enums:**
```json
{
  "name": "College",
  "type": "enum",
  "enum": {
    "name": "College",
    "members": [
      {"name": "Abilene Christian", "value": 1},
      {"name": "Air Force", "value": 2},
      // ... 500 more
    ]
  }
}
```

**Three scenarios:**

1. **✅ Schema has enum members (M25, M24, M23, etc.):**
   - `field.value` returns name: "Alabama"
   - Can assign by name: `field.value = "LSU"`

2. **⚠️ Schema has empty enum members (M26?):**
   - `field.value` returns binary string: "10000000011111"
   - Need manual lookup via CSV/JSON

3. **❌ Field not an enum:**
   - `field.value` returns raw value (string, number, etc.)

### Reference Field Handling

**Reference fields point to other tables:**
```javascript
// TeamIndex is a reference: bits encode table ID + row index
const teamIndex = record.TeamIndex;  // Returns 775553050 (binary)

// Decode:
const tableId = (teamIndex >> 15) & 0x7FFF;  // Bits 15-29
const rowIndex = teamIndex >> 15;  // Bits 15-31

// Follow reference:
const team = file.getTableById(tableId).records[rowIndex];
```

---

## Implementation Strategy

### Phase A: Fix Save Handler (1-2 days)
**Priority:** 🔴 CRITICAL BLOCKER

1. Modify `franchise:save-file` IPC handler to accept player data
2. Add update loop (copy from RosterParser.js)
3. Test save/reload cycle with Playwright
4. Verify no data corruption

**Code Changes:**
```typescript
// src/main/ipc/franchise-handlers.ts
ipcMain.handle('franchise:save-file', async (_event, filePath: string, updates: any[], savePath?: string) => {
  const franchise = await Franchise.create(filePath, {
    gameYearOverride: 26
  });

  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  // ✅ ADD THIS UPDATE LOOP
  for (let i = 0; i < updates.length; i++) {
    const record = playerTable.records[i];
    for (const fieldName in updates[i]) {
      if (record[fieldName] !== undefined) {
        record[fieldName] = updates[i][fieldName];
      }
    }
  }

  await franchise.save(savePath || filePath);

  return { success: true };
});
```

**Acceptance Criteria:**
- ✅ Change a player's name, save, reload → name persists
- ✅ Change 10 fields, save, reload → all persist
- ✅ Load in Madden 26 → no corruption
- ✅ Playwright test passes

### Phase B: Implement Lookup System (2-3 days)
**Priority:** 🟡 HIGH (Major UX improvement)

1. Copy MyFranchise JSON lookup files to our project
2. Create `LookupService.ts` to load and query lookups
3. Update Handsontable columns to use dropdown with names
4. Add IPC handlers for lookup data
5. Test with Playwright

**Files to Create:**
```
src/main/data/lookups/
├── colleges.json (copy from MyFranchise)
├── positions.json (copy from MyFranchise)
└── states.json (create for M26)

src/main/services/
└── LookupService.ts (new)
```

**Code Implementation:**
```typescript
// src/main/services/LookupService.ts
export class LookupService {
  private colleges: Map<number, string>;
  private positions: Map<number, string>;

  constructor() {
    this.loadColleges();
    this.loadPositions();
  }

  getCollegeName(id: number): string {
    return this.colleges.get(id) || `Unknown College (${id})`;
  }

  getCollegeOptions(): Array<{value: number, label: string}> {
    return Array.from(this.colleges.entries()).map(([value, label]) => ({
      value,
      label
    }));
  }
}
```

**Acceptance Criteria:**
- ✅ College column shows "Alabama" instead of 4
- ✅ Position column shows "QB" instead of 0
- ✅ Dropdown editors show all valid options
- ✅ Saving converts names back to IDs correctly

### Phase C: Multi-Table Support (2-3 days)
**Priority:** 🟢 MEDIUM (Complete Phase 5 scope)

1. Add Coach table support
2. Add Free Agent table support (same as Player)
3. Implement tab navigation (Player / Coach / Free Agents)
4. Test each table independently

**Code Changes:**
```typescript
// src/main/ipc/franchise-handlers.ts - Already generic!
ipcMain.handle('franchise:get-table-data', async (_event, filePath: string, tableName: string) => {
  // This handler already supports ANY table name
  // Just call it with 'Coach' or 'FreeAgent'
});
```

**UI Changes:**
```javascript
// src/renderer/js/franchise-editor.js
const tabs = [
  { name: 'Players', table: 'Player' },
  { name: 'Coaches', table: 'Coach' },
  { name: 'Free Agents', table: 'FreeAgent' }
];

function switchTab(tabName) {
  const table = tabs.find(t => t.name === tabName).table;
  loadTableData(currentFilePath, table);
}
```

**Acceptance Criteria:**
- ✅ Players tab shows Player table
- ✅ Coaches tab shows Coach table
- ✅ Free Agents tab shows FreeAgent table
- ✅ All tabs support editing and saving

### Phase D: Filtering & Polish (2-3 days)
**Priority:** 🟢 MEDIUM (Professional UX)

1. Add position filter dropdown
2. Add team filter dropdown
3. Add OVR range filter (min/max)
4. Add search by name
5. Add export to CSV

**Acceptance Criteria:**
- ✅ Filter by position: Show only QBs
- ✅ Filter by team: Show only 49ers
- ✅ Filter by OVR: Show only 85+ rated players
- ✅ Search finds players by name
- ✅ Export button creates CSV file

---

## Recommended Approach

### Week 1: Critical Path
**Goal:** Get basic editing working

- **Day 1-2:** Fix save handler (Phase A)
- **Day 3:** Test save/reload cycle thoroughly
- **Day 4-5:** Implement lookup system (Phase B start)

### Week 2: Professional UX
**Goal:** Make it feel professional

- **Day 1-2:** Complete lookup system (Phase B finish)
- **Day 3:** Add multi-table support (Phase C)
- **Day 4-5:** Add filtering (Phase D)

### Total Timeline: 8-10 days
**Realistic completion:** ~Week of Nov 4

This catches us up on the 18-day backlog and completes Phase 5!

---

## Testing Strategy

### Playwright Tests to Create

1. **`franchise-save-edit-reload.spec.js`**
   - Load franchise file
   - Edit player name
   - Save file
   - Reload file
   - Verify name persisted
   - **CRITICAL:** This test MUST pass before moving forward

2. **`franchise-college-lookup.spec.js`**
   - Load franchise file
   - Verify College column shows names (not IDs)
   - Edit college via dropdown
   - Verify ID saved correctly

3. **`franchise-multi-table.spec.js`**
   - Load franchise file
   - Switch to Coach tab
   - Verify coaches load
   - Switch to Free Agent tab
   - Verify free agents load

4. **`franchise-filtering.spec.js`**
   - Load franchise file
   - Apply position filter
   - Verify only QBs shown
   - Clear filter
   - Verify all players shown

---

## Architecture Recommendations

### Current Architecture
```
Main Process (TypeScript)
├── main.ts - Entry point
└── ipc/
    └── franchise-handlers.ts - IPC handlers

Renderer Process (Vanilla JS)
├── js/
│   └── franchise-editor.js - UI logic
└── franchise-editor.html

madden-franchise library
└── node_modules/madden-franchise/
```

### Recommended Architecture
```
Main Process (TypeScript)
├── main.ts - Entry point
├── ipc/
│   └── franchise-handlers.ts - IPC handlers (ADD UPDATE LOOP)
└── services/
    └── LookupService.ts - NEW: Lookup system

Renderer Process (Vanilla JS)
├── js/
│   ├── franchise-editor.js - UI logic (ADD TABS)
│   └── filters.js - NEW: Filtering logic
└── franchise-editor.html (ADD TAB NAVIGATION)

Data
└── data/lookups/
    ├── colleges.json - NEW: College lookup
    ├── positions.json - NEW: Position lookup
    └── states.json - NEW: State lookup
```

**Key principle:** Keep it simple, leverage the library, add lookups for UX.

---

## What NOT to Do

Based on research, avoid these mistakes:

❌ **Don't build custom binary parsers** - Use madden-franchise library
❌ **Don't build custom enum conversion** - Schema handles it
❌ **Don't use SQLite for lookups** - JSON files are simpler
❌ **Don't hardcode enum lists** - Extract from schema dynamically
❌ **Don't build complex state management** - Keep it simple
❌ **Don't try to implement everything** - Focus on core editing

---

## M25 vs M26 Compatibility

### What Works Across Versions
✅ File loading via madden-franchise library
✅ Table iteration and record access
✅ Field reading and writing
✅ Save workflow
✅ Overall architecture patterns

### What Needs Adaptation
⚠️ College IDs (may differ)
⚠️ Enum members (M26 may have empty enums)
⚠️ New tables/fields in M26
⚠️ Schema version differences

### Solution: Version Detection
```typescript
const gameYear = franchise.schema?.meta?.gameYear;

if (gameYear === 26) {
  // Use JSON lookups (enum may be empty)
} else if (gameYear === 25) {
  // Can rely on schema enums
}
```

---

## Success Metrics

### Phase 5 Acceptance Criteria (from RELEASE_NOTES.md)

- [x] Opens franchise save files ← ALREADY WORKING
- [ ] All teams editable ← NEED MULTI-TABLE (Phase C)
- [ ] Settings modifiable ← FUTURE (SeasonInfo table)
- [ ] Files load in franchise mode ← NEED TESTING
- [ ] No corruption of save data ← NEED SAVE HANDLER FIX (Phase A)

### Our Additional Criteria

- [ ] College names display (not IDs) ← Phase B
- [ ] Position names display (not IDs) ← Phase B
- [ ] Save/reload cycle works ← Phase A
- [ ] Playwright tests pass ← ALL PHASES
- [ ] Coach table editable ← Phase C
- [ ] Free Agent table editable ← Phase C
- [ ] Filtering works ← Phase D

---

## Resources & References

### Research Documents Created
1. `RESEARCH-roster-college-handling.md` - Save handler analysis
2. `RESEARCH-madden-franchise-editor-architecture.md` - M25 editor deep dive
3. `RESEARCH-sinthros-franchise-utils.md` - Utility patterns
4. `RESEARCH-binary-string-root-cause.md` - Enum conversion analysis
5. `RESEARCH-myfranchise-implementation.md` - Complete M25 editor study
6. `MYFRANCHISE-KEY-FINDINGS.md` - Quick reference guide
7. `RESEARCH-SYNTHESIS-COMPLETE.md` - This document

### Extracted Reference Code
- `temp-myfranchise-extract/` - MyFranchise M25 full extraction
  - `dist/electron/static/*.json` - ALL lookup files
  - `dist/electron/` - Vue.js components (reference only)

### Existing Code to Reference
- `src/main/parsers/RosterParser.js` - Working save pattern
- `src/main/ipc/franchise-handlers.ts` - Current implementation
- `src/renderer/js/franchise-editor.js` - UI logic

### External References
- madden-franchise library: https://github.com/bep713/madden-franchise
- Sinthros utils: https://github.com/Sinthros/madden-franchise-utils
- madden-franchise-editor: C:\Users\tshan\AppData\Local\Programs\madden-franchise-editor\

---

## Next Steps

**Immediate:**
1. ✅ Present this synthesis to user
2. ⏳ Get approval to proceed with Phase A (save handler fix)
3. ⏳ Create implementation todo list with TodoWrite
4. ⏳ Begin Phase A implementation

**This Week:**
- Fix save handler
- Test save/reload cycle
- Begin lookup system

**Next Week:**
- Complete lookup system
- Add multi-table support
- Add filtering
- Complete Phase 5!

---

## Conclusion

We now have a **complete understanding** of franchise file editing from 4 different working implementations. The path forward is clear:

1. **Fix the save handler** (copy from RosterParser.js)
2. **Add lookup-based display** (copy from MyFranchise)
3. **Support multiple tables** (already mostly there)
4. **Add filtering** (standard UI pattern)

**Estimated effort:** 8-10 days
**Complexity:** LOW to MEDIUM (we have all the reference code)
**Risk:** LOW (leveraging proven patterns)

The research phase is complete. Time to build!
