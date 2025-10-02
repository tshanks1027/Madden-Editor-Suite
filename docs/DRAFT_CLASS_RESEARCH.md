# Madden NFL Draft Class Research

## Executive Summary

This document provides comprehensive research on how Madden NFL draft classes are stored, whether they can be edited standalone, and what would be required to implement draft class editing functionality. Research conducted January 2025.

**Key Findings:**
- Draft classes exist in two formats: standalone `.mdc` files and franchise-embedded data
- Draft classes use the same TDB/TDB2 binary format as franchise and roster files
- Draft classes require exactly 257 players (hardcoded requirement)
- Standalone editing is technically possible but has reliability issues
- madden-franchise library can read/write franchise files containing draft class data
- No dedicated draft class export/import functionality exists in madden-franchise library

---

## File Format Information

### 1. Standalone Draft Class Files (.mdc)

**File Extension:** `.mdc` (Madden Draft Class)

**Format Structure:**
- Uses the same binary TDB/TDB2 format as franchise and roster files
- Contains compressed data using ZLIB deflate compression
- Binary structure requires **exactly 257 players** (no more, no less)
- Little-endian byte order
- Variable-length strings with null terminators

**File Signatures:**
- Legacy format: `TDB\0` (TDB files)
- Modern format: `TDB\x02` (TDB2 files with compression)

**Technical Details:**
- Can be opened and edited using Excel or spreadsheet programs (though not recommended)
- Binary structure makes manual editing error-prone
- Each player record follows the same structure as Player table in franchise files

### 2. Franchise-Embedded Draft Classes

**Location:** Within franchise save files (`.fra` extension or no extension)

**Storage Method:**
- Draft class data is stored in tables within the franchise file structure
- Tables include:
  - `Player` table - contains all player data including draft prospects
  - `DraftPlayer` table - draft-specific player metadata
  - `DraftPick` table - draft pick information
  - Related tables for draft settings, team needs, etc.

**File Structure:**
- Franchise files use ZLIB deflate compression
- Unpacks to uncompressed franchise database containing all franchise information
- Everything structured in tables with index lists, records, and optional second records tables
- Index list defines offsets for each field in the records table

**Binary Data Format:**
- Most field values read as bits and converted to formatted values
- Example: Player's Awareness rating shows as `64` but stored as 7 bits with value `1000000`
- String fields: table1 data contains offset to string in table2 data
- Blob fields: table1 data contains offset to blob in table3 data

---

## Table Structures

### Player Table Structure

Based on madden-franchise library and research:

**Key Fields (varies by game year):**
- `FirstName` - String (up to 30 characters)
- `LastName` - String (up to 30 characters)
- `Position` - Enum (QB, RB, WR, etc.)
- `Age` - Integer
- `Overall` - Integer (0-99)
- `AwarenessRating` - Integer (0-127, stored as 7 bits)
- `SpeedRating` - Integer (0-99)
- `StrengthRating` - Integer (0-99)
- `AccelerationRating` - Integer (0-99)
- Plus 300+ additional fields for attributes, ratings, traits, etc.

**Draft-Specific Fields:**
- `DraftRound` - Integer (1-7)
- `DraftPick` - Integer (1-32 per round)
- `DraftClass` - Integer (current year or future year)
- `YearsPro` - Integer (0 for rookies)
- `College` - String
- `DraftPosition` - Integer

### DraftPlayer Table Structure

**Purpose:** Contains draft-specific metadata for players

**Key Fields:**
- Reference to Player table
- Draft projection data
- Scout grades
- Player interviews
- Combine results
- College statistics
- Team needs matching

### DraftPick Table Structure

**Purpose:** Tracks draft pick ownership and trades

**Key Fields:**
- Pick number
- Round
- Team owner
- Original team
- Trade information

---

## Schema Information

### Schema Files Location

Madden includes schema definitions accessible using tools like Frosty Editor:

**File Name:** `franchise-schemas.ftx`
**Location:** `common -> franchise` in Legacy viewer

**Schema Purpose:**
- Defines human-readable field names for each table
- Specifies data types (int, string, bool, enum, reference, blob)
- Defines min/max values, max string lengths
- Lists field indices and offsets

**Important Notes:**
- Schema lists every index for each table but not in file order
- Different game years have different schemas (breaking changes)
- madden-franchise library includes bundled schemas for supported games
- Schema-less editing possible but dangerous (causes crashes)

### Supported Game Years (madden-franchise library)

| Game | Support Level | Notes |
|------|---------------|-------|
| Madden 19 | Full | Complete schema and editing support |
| Madden 20 | Full | Complete schema and editing support |
| Madden 21 | Full | Complete schema and editing support |
| Madden 22 | Full | Complete schema and editing support |
| Madden 23 | Full | Complete schema and editing support |
| Madden 24 | Full | Complete schema and editing support |
| Madden 25 | Full | Complete schema and editing support |
| Madden 26 | Partial | Everything except CharacterVisuals |

---

## Draft Class Storage: Standalone vs Franchise-Embedded

### Standalone Draft Class Files (.mdc)

**Advantages:**
- Portable and shareable
- Can be imported into multiple franchises
- Can be created externally and distributed
- Smaller file size (only draft class data)

**Disadvantages:**
- Must contain exactly 257 players
- Limited tool support for direct editing
- Reliability issues when importing (community reports)
- Format may change between game versions
- Cannot be edited in-game directly

**Import Process:**
1. Franchise must be in "retirement stage" of offseason
2. Navigate to Home screen → Choose Draft Class → Import Local File
3. Select .mdc file
4. Do not advance past retirement until import completes
5. Verify all 257 players imported correctly

### Franchise-Embedded Draft Classes

**Advantages:**
- Integrated with franchise save
- Can be edited using franchise editors
- More stable and reliable
- Supports in-game draft class customization
- No 257-player requirement (dynamically generated)

**Disadvantages:**
- Not portable between franchise saves
- Larger file size (entire franchise data)
- Must edit entire franchise file
- Cannot be easily shared

**Access Method:**
1. Load franchise file using madden-franchise library
2. Access Player table: `franchise.getTableByName('Player')`
3. Filter for draft class players
4. Edit player attributes
5. Save franchise file

---

## Existing Tools and Methods

### 1. madden-franchise Library (bep713)

**GitHub:** https://github.com/bep713/madden-franchise
**NPM Package:** `madden-franchise` v3.8.0
**License:** MIT

**Capabilities:**
- Read and write Madden franchise files (Madden 19-26)
- Parse binary TDB/TDB2 format
- Access all tables including Player, DraftPlayer, DraftPick
- Edit field values with automatic type conversion
- Save modified franchise files
- Schema-based editing with type safety

**API Example:**
```javascript
const Franchise = require('madden-franchise');

// Load franchise file
let franchise = await Franchise.create('./franchise.fra');

// Access Player table
let playerTable = franchise.getTableByName('Player');

// Read records (can specify fields to load)
await playerTable.readRecords(['FirstName', 'LastName', 'Position', 'Overall']);

// Filter for draft class players (YearsPro === 0)
let draftPlayers = playerTable.records.filter(r => r.YearsPro === 0);

// Edit player
draftPlayers[0].FirstName = 'John';
draftPlayers[0].LastName = 'Madden';
draftPlayers[0].Overall = 99;

// Save franchise file
await franchise.save();
```

**Limitations for Draft Classes:**
- No dedicated draft class export to .mdc format
- No dedicated draft class import from .mdc format
- No built-in draft class validation (257 player requirement)
- Must work with entire franchise file
- Cannot create standalone .mdc files

### 2. madden-file-tools Library

**GitHub:** https://github.com/bep713/madden-file-tools
**NPM Package:** `madden-file-tools`
**License:** MIT

**Capabilities:**
- Parse TDB and TDB2 files (legacy and modern formats)
- Read roster files (Madden 19-26)
- Read AST archive files
- Handle compressed and uncompressed formats
- Binary reading utilities (BinaryReader.js)
- File format validation (TDBFileValidator.js)

**Relevant Classes:**
- `TDBHelper` - Load/save TDB files
- `MaddenRosterHelper` - Load/save roster files (M19+)
- `TDBParser` - Stream-based TDB parsing
- `TDB2Parser` - Stream-based TDB2 parsing
- `TDBWriter` - Write TDB files
- `TDB2Writer` - Write TDB2 files

**Draft Class Applicability:**
- .mdc files use same TDB/TDB2 format as rosters
- Could theoretically parse .mdc files same way as rosters
- Would need custom logic for 257-player validation
- No existing draft class specific helpers

**Example Usage:**
```javascript
const MaddenRosterHelper = require('madden-file-tools/helpers/MaddenRosterHelper');

const helper = new MaddenRosterHelper();
await helper.load('./ROSTER-Official');

// File is now loaded with all tables accessible
const file = helper.file;
const playerTable = file.PLAY; // Player table

// Read records
await playerTable.readRecords();

// Modify players
playerTable.records[0].fields['POVR'].value = 99;

// Save
await helper.save('./ROSTER-Modified');
```

### 3. madden-franchise-editor (bep713)

**GitHub:** https://github.com/bep713/madden-franchise-editor
**Type:** GUI Desktop Application
**Supported Games:** Madden 19-20 (may work with newer versions)

**Features:**
- Schedule Editor - UI for changing franchise schedules
- Table Editor - Raw editing of any value in any table
- Unpacks franchise files using ZLIB deflate
- Visual interface for franchise file editing

**Draft Class Functionality:**
- Can edit Player table containing draft class data
- Can filter and search for draft prospects
- No dedicated draft class export/import
- Community reports: "Cannot reliably export/import or even edit draft classes"

**Limitation:** Draft class export/import not reliably supported

### 4. Legacy Tools (Madden 12-15)

**NZA's Editor V1.3/2.0:**
- Supported .mdc export/import
- Last supported Madden 15/NCAA 14
- Not compatible with modern Madden versions

**Xanathol's Editor:**
- Draft class editing for older Madden versions
- No longer maintained

**MaddenAMP:**
- Roster and draft class editor
- Limited support for modern versions
- Community reports mixed results

### 5. Other Community Tools

**franchiseToRosterV0.3.exe:**
- Found in Madden 25 tools directory
- Converts franchise data to roster format
- May support draft class extraction (unconfirmed)

---

## Standalone Draft Class Editing - Technical Feasibility

### Is Standalone Editing Technically Possible?

**YES**, but with significant caveats:

### Technical Requirements

1. **File Format Parsing:**
   - Implement TDB/TDB2 parser (can use madden-file-tools)
   - Handle ZLIB compression/decompression
   - Parse binary data structures
   - Read player records from tables

2. **Player Validation:**
   - Enforce exactly 257 players
   - Validate player attributes (ratings 0-99, positions valid, etc.)
   - Check required fields are populated
   - Ensure referential integrity

3. **Schema Management:**
   - Load appropriate schema for game year
   - Map field names to binary offsets
   - Handle data type conversions
   - Support schema version differences

4. **File Writing:**
   - Serialize player data to binary format
   - Apply ZLIB compression
   - Write correct file headers
   - Calculate checksums (if required)

### Implementation Approach

**Option 1: Use madden-franchise library**

Pros:
- Full franchise file support
- Schema management built-in
- Type-safe editing
- Well-tested code

Cons:
- Cannot create standalone .mdc files
- Must work with entire franchise file
- Overhead of loading full franchise

**Option 2: Use madden-file-tools library**

Pros:
- Direct TDB/TDB2 parsing
- Could handle .mdc files
- Lighter weight than madden-franchise
- More control over file structure

Cons:
- No draft class specific helpers
- Must implement schema loading
- Must implement validation logic
- More low-level work required

**Option 3: Hybrid approach**

Use madden-file-tools for file I/O, implement custom draft class validation and management layer:

```javascript
const MaddenRosterHelper = require('madden-file-tools/helpers/MaddenRosterHelper');

class DraftClassHelper {
  async load(filePath) {
    // Use MaddenRosterHelper to parse .mdc file (same format as roster)
    this.helper = new MaddenRosterHelper();
    await this.helper.load(filePath);
    this.file = this.helper.file;

    // Validate 257 players
    const playerTable = this.file.PLAY;
    await playerTable.readRecords();

    if (playerTable.records.length !== 257) {
      throw new Error(`Draft class must have exactly 257 players, found ${playerTable.records.length}`);
    }

    return this.file;
  }

  async save(outputPath) {
    // Validate before saving
    this.validateDraftClass();

    // Use helper to save
    await this.helper.save(outputPath);
  }

  validateDraftClass() {
    const playerTable = this.file.PLAY;

    // Check player count
    if (playerTable.records.length !== 257) {
      throw new Error('Invalid player count');
    }

    // Validate each player
    for (let record of playerTable.records) {
      // Check required fields
      if (!record.FirstName || !record.LastName) {
        throw new Error('Player missing required fields');
      }

      // Validate ratings
      if (record.Overall < 0 || record.Overall > 99) {
        throw new Error('Invalid overall rating');
      }

      // Additional validation...
    }
  }

  exportToJSON() {
    // Export draft class to JSON format for easier editing
    const playerTable = this.file.PLAY;
    return playerTable.records.map(r => ({
      firstName: r.FirstName,
      lastName: r.LastName,
      position: r.Position,
      overall: r.Overall,
      // ... all other fields
    }));
  }

  importFromJSON(players) {
    // Import draft class from JSON
    if (players.length !== 257) {
      throw new Error('Must provide exactly 257 players');
    }

    const playerTable = this.file.PLAY;

    for (let i = 0; i < players.length; i++) {
      playerTable.records[i].FirstName = players[i].firstName;
      playerTable.records[i].LastName = players[i].lastName;
      playerTable.records[i].Position = players[i].position;
      playerTable.records[i].Overall = players[i].overall;
      // ... set all other fields
    }
  }
}

// Usage
const draftClass = new DraftClassHelper();
await draftClass.load('./my-draft-class.mdc');

// Export to JSON for editing
const players = draftClass.exportToJSON();
// ... edit players ...

// Import back
draftClass.importFromJSON(players);

// Save
await draftClass.save('./modified-draft-class.mdc');
```

### Challenges and Gotchas

1. **257 Player Requirement:**
   - Hardcoded in game engine
   - Creating/deleting players requires careful management
   - Empty slots must still exist as valid player records

2. **Schema Versioning:**
   - Schemas change between game years
   - Field names, offsets, data types can change
   - Must detect game year and use correct schema

3. **Referential Integrity:**
   - Player records may reference other tables
   - Team assignments, contract data, etc.
   - Must ensure references are valid

4. **Binary Corruption:**
   - Small mistakes in binary writing cause crashes
   - Checksums must be correct
   - Offsets must be precise

5. **Game Version Compatibility:**
   - .mdc files from M24 may not work in M25
   - Format changes between versions
   - Need per-version handling

6. **Community Reports:**
   - Users report reliability issues with .mdc editing
   - Some edited files fail to import
   - Cause often unclear (schema mismatch? corruption?)

---

## What Would Be Required to Implement

### Minimum Viable Product (MVP)

**Goal:** Edit draft class players within a franchise file

**Requirements:**
1. Load franchise file using madden-franchise library
2. Display Player table filtered for draft class players
3. Edit player attributes (name, position, ratings)
4. Validate changes
5. Save franchise file

**Estimated Effort:** 2-3 weeks for experienced developer

**Code Example:**
```javascript
// main.ts - IPC handler
ipcMain.handle('draft-class:load', async (event, filePath) => {
  try {
    const franchise = await Franchise.create(filePath);
    const playerTable = franchise.getTableByName('Player');

    // Load only necessary fields for performance
    await playerTable.readRecords([
      'FirstName', 'LastName', 'Position', 'College',
      'Overall', 'Speed', 'Strength', 'Awareness',
      'Age', 'Height', 'Weight', 'YearsPro'
    ]);

    // Filter for draft class players (rookies)
    const draftPlayers = playerTable.records
      .filter(r => r.YearsPro === 0 || r.DraftClass === currentYear)
      .map(r => ({
        index: r.index,
        firstName: r.FirstName,
        lastName: r.LastName,
        position: r.Position,
        college: r.College,
        overall: r.Overall,
        speed: r.Speed,
        strength: r.Strength,
        awareness: r.Awareness,
        age: r.Age,
        height: r.Height,
        weight: r.Weight
      }));

    return { success: true, players: draftPlayers };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('draft-class:save', async (event, filePath, changes) => {
  try {
    const franchise = await Franchise.create(filePath);
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    // Apply changes
    for (let change of changes) {
      const player = playerTable.records[change.index];
      player.FirstName = change.firstName;
      player.LastName = change.lastName;
      player.Overall = change.overall;
      // ... apply other changes
    }

    // Save
    await franchise.save();

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### Enhanced Version

**Goal:** Full draft class management including .mdc export/import

**Additional Requirements:**
1. Create standalone .mdc files from franchise
2. Import .mdc files into franchise
3. Validate 257-player requirement
4. Generate draft classes from templates
5. Import/export JSON for external editing
6. Advanced filtering and search
7. Batch editing operations

**Estimated Effort:** 6-8 weeks for experienced developer

**Additional Components:**

```javascript
// draft-class-exporter.ts
class DraftClassExporter {
  async exportFromFranchise(franchisePath, outputPath) {
    // 1. Load franchise
    const franchise = await Franchise.create(franchisePath);
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    // 2. Extract draft class players
    const draftPlayers = playerTable.records.filter(r => r.YearsPro === 0);

    // 3. Pad to 257 if needed
    while (draftPlayers.length < 257) {
      draftPlayers.push(this.createEmptyPlayer());
    }

    // 4. Create new file with just draft class
    // This is the tricky part - need to construct .mdc format
    // May need to use madden-file-tools TDBWriter

    // 5. Write to outputPath
  }

  createEmptyPlayer() {
    // Create minimal valid player record
    return {
      FirstName: 'Empty',
      LastName: 'Slot',
      Position: 'QB',
      Overall: 40,
      // ... all required fields with default values
    };
  }
}

// draft-class-importer.ts
class DraftClassImporter {
  async importToFranchise(mdcPath, franchisePath) {
    // 1. Load .mdc file using madden-file-tools
    const helper = new MaddenRosterHelper();
    await helper.load(mdcPath);

    // 2. Validate 257 players
    const playerTable = helper.file.PLAY;
    await playerTable.readRecords();

    if (playerTable.records.length !== 257) {
      throw new Error('Invalid draft class file');
    }

    // 3. Load franchise file
    const franchise = await Franchise.create(franchisePath);
    const franchisePlayerTable = franchise.getTableByName('Player');
    await franchisePlayerTable.readRecords();

    // 4. Find/create draft class slots in franchise
    // 5. Copy player data from .mdc to franchise
    // 6. Save franchise
  }
}

// draft-class-validator.ts
class DraftClassValidator {
  validate(players) {
    const errors = [];

    // Check count
    if (players.length !== 257) {
      errors.push(`Must have exactly 257 players, found ${players.length}`);
    }

    // Check each player
    for (let i = 0; i < players.length; i++) {
      const player = players[i];

      // Required fields
      if (!player.FirstName) errors.push(`Player ${i}: Missing first name`);
      if (!player.LastName) errors.push(`Player ${i}: Missing last name`);

      // Valid ranges
      if (player.Overall < 0 || player.Overall > 99) {
        errors.push(`Player ${i}: Invalid overall rating`);
      }

      // Valid enums
      const validPositions = ['QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', /* ... */];
      if (!validPositions.includes(player.Position)) {
        errors.push(`Player ${i}: Invalid position`);
      }

      // Additional validation...
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### Full-Featured Implementation

**Goal:** Complete draft class editing suite

**Additional Features:**
1. Draft class generation from college rosters
2. Realistic attribute generation based on archetypes
3. Draft class comparison and merging
4. Historical draft class library
5. Integration with online draft class sharing
6. Auto-update from community sources
7. Draft class quality scoring
8. Duplicate detection
9. Name/college database integration

**Estimated Effort:** 3-4 months for experienced developer

---

## Example Code and References

### Loading a Franchise File (madden-franchise)

```javascript
const Franchise = require('madden-franchise');

// Method 1: New async/await style (v3.3.0+)
async function loadFranchise() {
  const franchise = await Franchise.create('./franchise-file', {
    saveOnChange: false,
    autoParse: true,
    gameYearOverride: 25
  });

  return franchise;
}

// Method 2: Old event-based style (still works)
function loadFranchiseOld() {
  return new Promise((resolve, reject) => {
    const franchise = new Franchise('./franchise-file');

    franchise.on('ready', (file) => {
      resolve(file);
    });

    franchise.on('error', (err) => {
      reject(err);
    });
  });
}
```

### Reading Player Records

```javascript
async function getPlayers(franchise) {
  // Get Player table by unique ID (best method)
  const playerTable = franchise.getTableByUniqueId(4099); // Player table unique ID

  // Or get by name (may have multiple tables with same name)
  // const playerTable = franchise.getTableByName('Player');

  // Read all records with all fields
  await playerTable.readRecords();

  // Or read specific fields only (recommended for performance)
  await playerTable.readRecords([
    'FirstName',
    'LastName',
    'Position',
    'Overall'
  ]);

  // Access records
  for (let record of playerTable.records) {
    console.log(`${record.FirstName} ${record.LastName} - ${record.Position} - ${record.Overall} OVR`);
  }

  return playerTable;
}
```

### Filtering Draft Class Players

```javascript
async function getDraftClass(franchise, draftYear) {
  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords(['FirstName', 'LastName', 'YearsPro', 'DraftClass']);

  // Method 1: Filter by YearsPro (rookies)
  const rookies = playerTable.records.filter(r => r.YearsPro === 0);

  // Method 2: Filter by DraftClass field
  const draftClass = playerTable.records.filter(r => r.DraftClass === draftYear);

  // Method 3: Combine filters
  const currentDraft = playerTable.records.filter(r => {
    return r.YearsPro === 0 && !r.isEmpty && r.ContractStatus !== 'Active';
  });

  return currentDraft;
}
```

### Editing Players

```javascript
async function editPlayer(franchise, playerIndex, changes) {
  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  const player = playerTable.records[playerIndex];

  // Method 1: Direct property access (easiest)
  player.FirstName = changes.firstName;
  player.LastName = changes.lastName;
  player.Overall = changes.overall;

  // Method 2: Using fields (more performant)
  player.fields['FirstName'].value = changes.firstName;
  player.fields['LastName'].value = changes.lastName;
  player.fields['Overall'].value = changes.overall;

  // Save changes
  await franchise.save();
}
```

### Loading Roster File (madden-file-tools)

```javascript
const MaddenRosterHelper = require('madden-file-tools/helpers/MaddenRosterHelper');

async function loadRoster() {
  const helper = new MaddenRosterHelper();
  await helper.load('./ROSTER-Official');

  const file = helper.file;

  // Access Player table (PLAY)
  const playerTable = file.PLAY;

  // For M19-20 (legacy TDB format), must read records first
  if (playerTable.records.length === 0) {
    await playerTable.readRecords();
  }

  // For M21+ (TDB2 format), records already loaded
  console.log(`Loaded ${playerTable.records.length} players`);

  return { helper, file };
}
```

### Parsing Binary Data

```javascript
const TDBParser = require('madden-file-tools/streams/TDBParser');
const fs = require('fs');

async function parseTDBFile(filePath) {
  return new Promise((resolve, reject) => {
    const parser = new TDBParser();
    const readStream = fs.createReadStream(filePath);

    parser.on('end', () => {
      const file = parser.file;
      resolve(file);
    });

    parser.on('error', (err) => {
      reject(err);
    });

    readStream.pipe(parser);
  });
}
```

### Reference: madden-franchise Table Access

```javascript
// Get table by unique ID (recommended)
const table = franchise.getTableByUniqueId(4099); // Player = 4099

// Get table by name (may return first match if multiple)
const table = franchise.getTableByName('Player');

// Get all tables with name
const tables = franchise.getAllTablesByName('Player');

// Get table by index
const table = franchise.getTableByIndex(5);

// Get table by ID (not recommended, IDs can change)
const table = franchise.getTableById(1234);
```

### Reference: Common Table Unique IDs

```
Player: 4099
Team: 4100
Coach: 4101
DraftPick: 4164
Seasons: 4161
SeasonInfo: 4162
League: 4165
```

---

## Conclusion and Recommendations

### Is Standalone Draft Class Editing Possible?

**Yes, technically possible** but with significant limitations:

**Viable Approaches:**
1. ✅ **Franchise-embedded editing** - Edit draft class within franchise files using madden-franchise library (RECOMMENDED)
2. ⚠️ **Standalone .mdc creation** - Possible but requires significant development effort
3. ⚠️ **Standalone .mdc import** - Possible but reliability concerns based on community reports

### Recommended Implementation Path

**Phase 1: Franchise Draft Class Editor** (2-3 weeks)
- Use madden-franchise library
- Load franchise files
- Filter and display draft class players
- Edit player attributes
- Save franchise files
- This provides immediate value with least risk

**Phase 2: Draft Class Export** (1-2 weeks)
- Export draft class from franchise to JSON
- Allow external editing
- Import JSON back to franchise
- Easier than .mdc format, more flexible

**Phase 3: .mdc Support** (3-4 weeks) - OPTIONAL
- Research .mdc format specifics
- Implement export to .mdc from franchise
- Implement import from .mdc to franchise
- Extensive testing required
- May have reliability issues

### Key Takeaways

1. **madden-franchise library is your best friend** - Mature, well-tested, full featured
2. **Start with franchise files** - More reliable than standalone .mdc files
3. **257-player requirement is hardcoded** - Any .mdc file MUST have exactly 257 players
4. **Schema management is critical** - Use built-in schemas, don't try to parse without them
5. **Community tools have limitations** - Even established tools struggle with draft classes
6. **Test extensively** - Binary file corruption is easy, game crashes are common
7. **Consider JSON intermediate format** - Easier to work with than binary

### Resources

**Libraries:**
- madden-franchise: https://github.com/bep713/madden-franchise
- madden-file-tools: https://github.com/bep713/madden-file-tools
- madden-franchise-editor: https://github.com/bep713/madden-franchise-editor

**Community:**
- FootballIdiot Forums: https://www.footballidiot.com/forum/
- Operation Sports Forums: https://forums.operationsports.com/

**Tools:**
- Frosty Editor - Extract schemas from game files
- Hex editors - Debug binary issues

---

## Appendix: File Format Specifications

### TDB File Header Structure

```
Offset | Size | Type   | Description
-------|------|--------|------------
0x00   | 4    | String | Signature ("TDB\0")
0x04   | 4    | Int32  | Version
0x08   | 4    | Int32  | Table count
0x0C   | 4    | Int32  | Unknown
0x10   | ...  | Tables | Table data
```

### TDB2 File Header Structure (Madden 21+)

```
Offset | Size | Type   | Description
-------|------|--------|------------
0x00   | 4    | String | Signature ("TDB\x02")
0x04   | 4    | Int32  | Uncompressed size
0x08   | 4    | Int32  | Compressed size
0x0C   | 4    | Int32  | CRC32 checksum
0x10   | ...  | Data   | ZLIB compressed data
```

### Table Header Structure

```
Offset | Size | Type   | Description
-------|------|--------|------------
0x00   | 4    | Int32  | Table name hash
0x04   | 4    | Int32  | Table size
0x08   | 4    | Int32  | Record count
0x0C   | 4    | Int32  | Record capacity
0x10   | 4    | Int32  | Next record to use
0x14   | 2    | Int16  | Field count
0x16   | ...  | Data   | Offset table + records
```

### Record Structure

Records are variable length based on field definitions in offset table. Each field occupies a specific number of bits at a specific offset within the record.

Example Player Record (simplified):
```
Bits 0-31:   Record index / Empty record next pointer
Bits 32-63:  First name string offset
Bits 64-95:  Last name string offset
Bits 96-102: Overall rating (7 bits)
Bits 103-109: Speed rating (7 bits)
... (300+ more fields)
```

---

*Research compiled: January 2025*
*Author: Claude (Anthropic AI Assistant)*
*For: Madden Editor Suite Development*
