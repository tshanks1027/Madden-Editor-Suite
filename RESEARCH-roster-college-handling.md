# Research: Roster Editor College Field Handling

## CRITICAL DISCOVERY

**The franchise save handler is completely missing update logic!** It doesn't accept player data from the renderer and doesn't update any field values before saving. This explains why ALL edits fail to persist, not just the College field.

See Section 8 for full details and implementation plan.

---

## Data Flow Comparison

### Roster Editor (WORKING)
```
User edits data in grid
    ↓
Click Save
    ↓
Renderer: collects updated player data
    ↓
IPC: parser:save-roster-file(filePath, players, originalData)
    ↓
RosterParser: loads file
    ↓
RosterParser: updates record.fields[fieldName].value for each player
    ↓
RosterParser: calls helper.save(filePath)
    ↓
✅ Changes persisted to file
```

### Franchise Editor (BROKEN)
```
User edits data in grid
    ↓
Click Save
    ↓
Renderer: calls saveFile(filePath, filePath) ← NO PLAYER DATA!
    ↓
IPC: franchise:save-file(filePath, savePath) ← NO PLAYERS PARAM!
    ↓
FranchiseHandler: loads file
    ↓
FranchiseHandler: ❌ SKIPS UPDATE STEP ❌
    ↓
FranchiseHandler: calls franchise.save(filePath)
    ↓
❌ Original data saved, no changes applied
```

---

## Executive Summary

The roster editor successfully handles the College field (PCOL) by:
1. **Reading raw numeric values** from roster files (0-493 range)
2. **Using a hardcoded lookup table** in the renderer for display
3. **Storing values as plain integers** (no binary conversion needed for rosters)
4. **Writing values back as integers** to the file

**Key Finding**: Roster files store College as a simple integer field, whereas franchise files store it as an enum reference that appears as a 32-bit binary string when enum conversion fails.

---

## 1. How College Field is Read from Roster Files

### Location: `src/main/parsers/RosterParser.js`

**Lines 52-62: Reading player data from PLAY table**

```javascript
// Extract player data
const players = [];
for (const record of playerTable.records) {
  const player = {};

  // Convert TDB2 fields to plain object
  for (const fieldName in record.fields) {
    player[fieldName] = record.fields[fieldName].value;
  }

  players.push(player);
}
```

**Key Points:**
- Uses `MaddenRosterHelper` from madden-franchise library (bep713)
- Reads from `PLAY` table in roster file
- Extracts `record.fields[fieldName].value` directly
- **No special processing for PCOL** - it's just read as-is from the field value
- Returns as plain JavaScript object with all fields

**Data Format in Roster Files:**
- PCOL is stored as a **simple integer** (0-493)
- Example: `player.PCOL = 4` means Alabama (college ID 4)
- **No binary encoding, no enum conversion needed**

---

## 2. Renderer Display Logic

### Location: `src/renderer/data/field-definitions.js`

**Line 17: Field definition**

```javascript
'PCOL': {
  display: 'College',
  shortDisplay: 'College',
  type: 'lookup',
  editable: true,
  width: 100,
  lookup: 'colleges'
}
```

**Lines 208-288: Hardcoded college lookup data**

```javascript
const collegeData = [
  [0, 'Blank'], [1, 'Abilene Christian'], [2, 'Air Force'], [3, 'Akron'], [4, 'Alabama'],
  [5, 'Alabama A&M'], [6, 'Alabama State'], [7, 'Alcorn State'], [8, 'Appalachian State'],
  [9, 'Arizona'], [10, 'Arizona State'], [11, 'Arkansas'], [12, 'Arkansas Pine Bluff'],
  // ... 493 total colleges
  [493, 'Barton']
];

collegeData.forEach(([id, name]) => {
  if (name && name.trim()) {
    LOOKUP_DATA.colleges.set(id, name.trim());
  }
});
```

**How it works:**
1. Hardcoded array of `[id, name]` pairs embedded in field-definitions.js
2. Loaded into `LOOKUP_DATA.colleges` Map at startup
3. Used for dropdown options and display rendering

### Location: `src/renderer/js/app.js`

**Line 1381: Display conversion**

```javascript
case 'PCOL':
  return getLookupValue('colleges', player.PCOL);
```

**Line 4854: Player card display**

```javascript
const college = getLookupValue('colleges', playerData.PCOL) || '--';
```

**Lines 4910-4921: Player card college dropdown**

```javascript
// Get colleges from LOOKUP_DATA (imported from field-definitions.js)
if (LOOKUP_DATA && LOOKUP_DATA.colleges && LOOKUP_DATA.colleges.size > 0) {
  const sortedColleges = Array.from(LOOKUP_DATA.colleges.entries())
    .sort((a, b) => a[1].localeCompare(b[1]));

  sortedColleges.forEach(([collegeId, collegeName]) => {
    const option = document.createElement('option');
    option.value = collegeId;
    option.textContent = collegeName;
    if (parseInt(collegeId) === parseInt(playerData.PCOL)) {
      option.selected = true;
    }
    collegeSelect.appendChild(option);
  });
}
```

**How Display Works:**
1. Raw PCOL value (0-493) is read from file
2. `getLookupValue('colleges', player.PCOL)` looks up name in Map
3. Dropdown shows college name, stores college ID
4. No conversion between formats - just ID → Name lookup

---

## 3. How College Field is Written Back to Roster Files

### Location: `src/main/parsers/RosterParser.js`

**Lines 163-187: Updating player records**

```javascript
for (let i = 0; i < players.length && i < playerTable.records.length; i++) {
  const record = playerTable.records[i];
  const playerData = players[i];

  // Update each field (exclude PLAYERPIC - it's a virtual field for display only)
  for (const fieldName in playerData) {
    if (fieldName === 'PLAYERPIC') {
      continue; // Skip virtual field
    }
    if (record.fields[fieldName]) {
      const oldValue = record.fields[fieldName].value;
      const newValue = playerData[fieldName];
      record.fields[fieldName].value = newValue;

      // Log PEPS changes
      if (fieldName === 'PEPS' && oldValue !== newValue) {
        console.log(`[RosterParser] Player ${i}: PEPS changed from "${oldValue}" to "${newValue}"`);
      }

      fieldsUpdated++;
    }
  }
}
```

**Lines 192-193: Saving via MaddenRosterHelper**

```javascript
// Save using MaddenRosterHelper
await helper.save(filePath);
```

**How Writing Works:**
1. Frontend sends updated player data with `PCOL: 4` (integer)
2. RosterParser loops through all fields
3. Sets `record.fields[fieldName].value = newValue` directly
4. **No conversion needed** - integer is written as-is
5. MaddenRosterHelper writes binary file with updated values

---

## 4. Data Format Summary

### Roster Files (WORKING)
- **Storage**: Plain integer field (0-493)
- **Reading**: `record.fields['PCOL'].value` returns integer
- **Display**: Integer looked up in hardcoded Map
- **Writing**: Integer written back to `record.fields['PCOL'].value`
- **No special handling needed**

### Franchise Files (BROKEN - CURRENT ISSUE)

From `src/main/ipc/franchise-handlers.ts` (lines 224-252):

```javascript
// Handle binary string fallback from failed enum conversion
// Binary strings like "10000000000000000000011110110000" indicate enum lookup failed
if (typeof value === 'string' && value.match(/^[01]{32}$/)) {
  // Convert binary string to integer
  const binaryInt = parseInt(value, 2);

  // Extract ID by masking off high bit (0x80000000)
  const enumIndex = binaryInt & 0x7FFFFFFF;

  // For College field, use CSV lookup
  if (field.key === 'College') {
    const collegeName = colleges.get(enumIndex);
    if (collegeName) {
      value = collegeName;
      console.log(`[Franchise] College binary → CSV lookup: ${enumIndex} -> ${value}`);
    }
  }
}
```

**Franchise File Issues:**
- **Storage**: Enum reference (32-bit value with enum index)
- **Reading**: Returns binary string when enum members are empty/missing
- **Current Workaround**: Parse binary string, extract index, lookup in CSV
- **Display**: Works (shows college name)
- **Writing**: **BROKEN** - needs to convert back to enum reference format

---

## 5. Key Differences Between Roster and Franchise Formats

| Aspect | Roster Files | Franchise Files |
|--------|-------------|-----------------|
| **Field Type** | Plain integer field | Enum reference field |
| **Raw Value** | `4` (integer) | `"10000000000000000000011110110000"` (binary string) |
| **Parsing Needed** | None | Parse binary, mask high bit |
| **Lookup Source** | Hardcoded Map | CSV file (`data/lookups/college_lookup.csv`) |
| **Write Format** | Integer | Enum reference (must reconstruct binary) |
| **Working?** | ✅ Yes | ❌ Write broken (read works with workaround) |

---

## 6. CSV Lookup File

### Location: `src/main/ipc/franchise-handlers.ts`

**Lines 17-42: Loading college lookup**

```javascript
function loadCollegeLookup(): Map<number, string> {
  if (collegeMap) return collegeMap;

  collegeMap = new Map();

  try {
    // Path resolution for development vs production
    const csvPath = path.join(__dirname, '..', '..', 'data', 'lookups', 'college_lookup.csv');

    if (!fs.existsSync(csvPath)) {
      console.error('[Franchise] College lookup CSV not found at:', csvPath);
      return collegeMap;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    for (const line of lines) {
      const [idStr, name] = line.split(',').map(s => s.trim());
      const id = parseInt(idStr);

      if (!isNaN(id) && name) {
        collegeMap.set(id, name);
      }
    }

    console.log(`[Franchise] Loaded ${collegeMap.size} colleges from CSV`);
  } catch (error) {
    console.error('[Franchise] Error loading college lookup:', error);
  }

  return collegeMap;
}
```

**CSV Format:**
```
0,Blank
1,Abilene Christian
2,Air Force
3,Akron
4,Alabama
...
493,Barton
```

**Usage:**
- Loaded once at module initialization
- Used to convert enum index → college name for display
- **NOT used for writing** (this is the problem!)

---

## 7. Solution Strategy for Franchise Files

### Current Read Flow (WORKING)
1. Read field value → Get binary string (enum lookup failed)
2. Parse binary string to integer
3. Mask off high bit: `enumIndex = binaryInt & 0x7FFFFFFF`
4. Look up college name in CSV: `colleges.get(enumIndex)`
5. Display college name

### Needed Write Flow (BROKEN - NEEDS IMPLEMENTATION)
1. User selects college name from dropdown
2. **Convert college name → enum index** (reverse lookup in CSV)
3. **Reconstruct binary format**: `binaryValue = enumIndex | 0x80000000`
4. **Write binary value** to field (not the name!)

### Implementation Plan

**Option A: Write Integer Directly (SIMPLE - TRY FIRST)**
```javascript
// In franchise save handler
if (field.key === 'College') {
  // Get college ID from dropdown (0-493)
  const collegeId = parseInt(playerData.PCOL);

  // Try writing as plain integer (like roster)
  record.College = collegeId;
}
```

**Option B: Reconstruct Enum Format (PROPER)**
```javascript
// In franchise save handler
if (field.key === 'College') {
  // Get college ID from lookup
  const collegeId = parseInt(playerData.PCOL);

  // Reconstruct enum reference with high bit set
  const enumValue = collegeId | 0x80000000;

  // Write as enum reference
  record.fields['College'].value = enumValue;
}
```

**Option C: Use madden-franchise API (BEST)**
```javascript
// Check if madden-franchise supports enum writing
if (record.fields['College'].setEnum) {
  record.fields['College'].setEnum(collegeId);
} else {
  // Fallback to Option B
}
```

---

## 8. CRITICAL DISCOVERY: Franchise Save Handler is Empty!

### Current Franchise Save Handler
**Location**: `src/main/ipc/franchise-handlers.ts` lines 364-392

```javascript
ipcMain.handle('franchise:save-file', async (_event, filePath: string, savePath: string) => {
  console.log('[Franchise] Saving file to:', savePath);

  try {
    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26
    });

    // Save the franchise file
    await new Promise((resolve, reject) => {
      franchise.save(savePath, (err: any) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    console.log('[Franchise] File saved successfully');

    return {
      success: true
    };
  } catch (error: any) {
    console.error('[Franchise] Error saving file:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
```

**THE PROBLEM:**
- The save handler **does NOT accept player data** from the renderer!
- It just loads the file and saves it immediately (no changes applied!)
- There is **NO update logic** like RosterParser has
- This explains why **ALL edits fail to save**, not just College field!

### Compare to Working Roster Save Handler
**Location**: `src/main/parsers/RosterParser.js` lines 114-204

```javascript
async function saveRosterFile(filePath, players, originalData) {
  // ... (see full code in section 3)

  // Update player values in the TDB2 file
  const playerTable = file.PLAY;

  for (let i = 0; i < players.length && i < playerTable.records.length; i++) {
    const record = playerTable.records[i];
    const playerData = players[i];

    // Update each field
    for (const fieldName in playerData) {
      if (record.fields[fieldName]) {
        record.fields[fieldName].value = playerData[fieldName];
      }
    }
  }

  // Then save
  await helper.save(filePath);
}
```

**What Roster Does Right:**
1. Accepts `players` array with updated data
2. Loops through each player
3. Updates `record.fields[fieldName].value` for each field
4. **THEN** saves the file

**What Franchise Save is Missing:**
1. ❌ No `players` parameter
2. ❌ No update loop
3. ❌ No field value assignment
4. ✅ Only has file save (which saves unchanged data!)

---

## 9. Root Cause Analysis

**The franchise editor save is completely broken**, not just for College field!

The save handler needs to be completely rewritten to:
1. Accept updated player data from renderer
2. Load the franchise file
3. Get the Player table
4. Update each player's field values
5. Handle enum fields (like College) specially
6. Save the file

---

## 10. Next Steps (REVISED)

### Step 1: Implement Franchise Save Handler (CRITICAL)

**Based on RosterParser pattern, implement:**

```javascript
ipcMain.handle('franchise:save-file', async (_event, filePath: string, savePath: string, players: any[]) => {
  console.log('[Franchise] Saving file to:', savePath);
  console.log('[Franchise] Player count:', players.length);

  try {
    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26
    });

    // Get Player table
    const playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      throw new Error('Player table not found');
    }

    await playerTable.readRecords();
    const activeRecords = playerTable.records.filter((r: any) => !r.isEmpty);

    console.log('[Franchise] Updating', players.length, 'player records');

    // Update each player's fields
    for (let i = 0; i < players.length && i < activeRecords.length; i++) {
      const record = activeRecords[i];
      const playerData = players[i];

      // Map field codes to franchise field names
      const FIELD_MAPPING = {
        'PFNA': 'FirstName', 'PLNA': 'LastName', 'PPOS': 'Position',
        'PAGE': 'Age', 'PJEN': 'JerseyNum', 'TGID': 'TeamIndex',
        'PCOL': 'College', 'PHTN': 'Hometown', 'PHSN': 'HomeState',
        // ... add all other fields
      };

      // Update each field
      for (const fieldCode in playerData) {
        const franchiseField = FIELD_MAPPING[fieldCode] || fieldCode;

        if (record[franchiseField] !== undefined) {
          let value = playerData[fieldCode];

          // Special handling for College enum
          if (franchiseField === 'College') {
            // Try writing as plain integer first (Option A)
            value = parseInt(value);

            // If that doesn't work, may need to reconstruct enum:
            // value = parseInt(value) | 0x80000000;
          }

          record[franchiseField] = value;
        }
      }
    }

    // Save the franchise file
    await new Promise((resolve, reject) => {
      franchise.save(savePath, (err: any) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    console.log('[Franchise] File saved successfully');

    return {
      success: true
    };
  } catch (error: any) {
    console.error('[Franchise] Error saving file:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
```

### Step 2: Update Renderer to Send Player Data

**Location**: `src/renderer/js/franchise-editor.js` line 1736

**Change from:**
```javascript
const result = await window.electronAPI.franchise.saveFile(this.currentFile, this.currentFile);
```

**Change to:**
```javascript
// Get updated player data from grid
const updatedPlayers = this.hot.getData(); // Or however grid data is accessed

const result = await window.electronAPI.franchise.saveFile(
  this.currentFile,
  this.currentFile,
  updatedPlayers
);
```

### Step 3: Update IPC Handler Type Definition

**Location**: `src/preload.ts`

```typescript
franchise: {
  loadFile: (filePath: string) => Promise<any>,
  getPlayers: (filePath: string, tableName: string) => Promise<any>,
  saveFile: (filePath: string, savePath: string, players: any[]) => Promise<any>, // Add players param
  getColleges: (filePath: string) => Promise<any>
}
```

### Step 4: Test Save Operation

1. Load franchise file
2. Edit a player's name (simple field)
3. Save file
4. Reload file and verify change persisted
5. Then test College field specifically

### Step 5: Handle College Enum Conversion

Once basic save works, add special handling for College:

```javascript
if (franchiseField === 'College') {
  const collegeId = parseInt(value);

  // Option A: Try plain integer
  record.College = collegeId;

  // If that fails, Option B: Reconstruct enum
  // record.College = collegeId | 0x80000000;

  // Or Option C: Use madden-franchise API if available
  // if (record.setFieldValue) {
  //   record.setFieldValue('College', collegeId);
  // }
}
```

---

## Code References

### Files to Modify for Franchise College Writing

1. **`src/main/ipc/franchise-handlers.ts`**
   - Add write handler for College field
   - Implement enum value reconstruction
   - Line ~350 (save handler section)

2. **`src/renderer/js/franchise-editor.js`**
   - Ensure PCOL is sent as integer ID (not name)
   - Already correct at line 986-987

### Files Using College Lookup (Reference)

1. **`src/renderer/data/field-definitions.js`** - Hardcoded lookup (493 colleges)
2. **`src/renderer/js/app.js`** - Roster editor display logic
3. **`src/main/ipc/franchise-handlers.ts`** - CSV lookup for franchise
4. **`data/lookups/college_lookup.csv`** - College ID → Name mapping

---

## Conclusion

### Original Hypothesis (INCORRECT)
Initially thought College field wasn't saving because:
- Roster uses integers, franchise uses enums
- Need special enum conversion for College field

### Actual Root Cause (DISCOVERED)
**The entire franchise save handler is broken!**

The `franchise:save-file` IPC handler:
- ❌ Doesn't accept player data from renderer
- ❌ Doesn't update any field values
- ❌ Just loads and immediately re-saves (no changes applied)
- This explains why **NO edits persist**, not just College

### Roster Editor Works Because:
- `saveRosterFile()` accepts `players` array parameter
- Loops through and updates `record.fields[fieldName].value`
- Then calls `helper.save(filePath)`
- ✅ Complete save implementation

### Franchise Editor Broken Because:
- `franchise:save-file` has **NO update logic whatsoever**
- Missing the entire player data update loop
- Just saves original file unchanged
- ❌ Fundamentally incomplete implementation

### Fix Required (THREE-PART FIX):

1. **Add player data parameter** to `franchise:save-file` handler
2. **Implement update loop** (like RosterParser does)
3. **Handle special fields** (College enum, etc.)

### Priority:
**HIGH** - This is a critical bug affecting all franchise editing, not just College field.

### Implementation Complexity:
**Medium** - Follow RosterParser pattern, but need to:
- Map field codes (PCOL) → franchise fields (College)
- Test enum value writing
- Verify Madden can load saved files

### Test Strategy:
1. Implement basic save with field updates
2. Test simple fields first (FirstName, Age, etc.)
3. Then test enum fields (College, Position, Team)
4. Verify saved file loads in Madden game
