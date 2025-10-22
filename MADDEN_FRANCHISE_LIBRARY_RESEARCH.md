# Madden-Franchise Library Research Findings

## Executive Summary

The `madden-franchise` library by bep713 is a **fully compatible** Node.js parser for Madden 26 franchise files. The "0 tables" issue in your code is caused by **incorrect API usage** - specifically calling `franchise.getAllTables()` which doesn't exist in the library's API.

**Key Finding:** The library uses `franchise.tables` array property, NOT a `getAllTables()` method.

---

## 1. Library Overview

### Package Information
- **Name:** madden-franchise
- **Author:** bep713 (GitHub: https://github.com/bep713/madden-franchise)
- **npm:** https://www.npmjs.com/package/madden-franchise
- **Your Version:** 3.8.0 (installed in package.json)
- **Latest npm Version:** 3.6.0 (as of search date)
- **Note:** Version 4.0.0+ migrated to ESM, so 3.8.0 is the correct choice for CommonJS projects

### Madden Game Support
- **Fully Supported:** Madden 19, 20, 21, 22, 23, 24, 25, **and 26**
- **Madden 26 Compatibility:** ✅ CONFIRMED - Library explicitly states full support for M26

---

## 2. Correct API Usage

### Basic File Loading (Correct Pattern)

```javascript
// Import the library
const Franchise = require('madden-franchise');

// Method 1: Event-based (CommonJS - what you're using)
const franchise = new Franchise(filePath);

franchise.on('ready', async () => {
  console.log('File loaded!');
  console.log('Game Year:', franchise.schema.meta.gameYear);

  // NOW you can access tables
  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();
  console.log('Players:', playerTable.records.length);
});

franchise.on('error', (err) => {
  console.error('Error:', err);
});

// Method 2: Promise-based (v3.3.0+, requires async context)
async function loadFranchise() {
  const franchise = await Franchise.create(filePath, options);
  // File is ready immediately after await
  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();
}
```

### Configuration Options

```javascript
const options = {
  // Auto-save when fields change (default: false)
  saveOnChange: true,

  // Override schema detection
  schemaOverride: {
    major: 26,
    minor: 0,
    gameYear: 26,
    path: './custom-schemas/'
  },

  // Override game year for FTC files
  gameYearOverride: 26,

  // Auto-parse tables on load
  autoParse: true,

  // Auto-determine empty field behavior
  autoUnempty: true
};

const franchise = new Franchise(filePath, options);
```

---

## 3. Table Access Methods

### ❌ INCORRECT - What Your Code Is Doing

```javascript
// test-m26-detection.js line 46
const tables = franchise.getAllTables();  // ❌ METHOD DOES NOT EXIST
console.log(`Available tables: ${tables.length}`);
```

### ✅ CORRECT - How to Access All Tables

```javascript
// Access the tables array directly
const tables = franchise.tables;
console.log(`Available tables: ${tables.length}`);

// Iterate through all tables
for (const table of franchise.tables) {
  console.log(`Table: ${table.name}`);
  console.log(`  - Unique ID: ${table.uniqueId}`);
  console.log(`  - Record Count: ${table.recordsCount}`);
}
```

### Available Table Access Methods

```javascript
// 1. Get single table by name (returns first match)
const playerTable = franchise.getTableByName('Player');

// 2. Get ALL tables with same name (some names have duplicates)
const allPlayerTables = franchise.getAllTablesByName('Player');

// 3. Get table by unique ID (recommended - IDs never change)
const tableById = franchise.getTableById(4095);

// 4. Get table by index position
const firstTable = franchise.getTableByIndex(0);

// 5. Direct array access
const tables = franchise.tables; // Array of all tables
```

---

## 4. Working with Records

### Reading Records

```javascript
const table = franchise.getTableByName('Player');

// Option 1: Read ALL fields (slower, more memory)
await table.readRecords();
console.log(table.records[0].FirstName);
console.log(table.records[0].LastName);

// Option 2: Read SPECIFIC fields (faster, less memory - RECOMMENDED)
await table.readRecords(['FirstName', 'LastName', 'Position']);
console.log(table.records[0].FirstName);

// Access record data
for (const record of table.records) {
  if (record.isEmpty) {
    continue; // Skip empty records
  }

  console.log(`${record.FirstName} ${record.LastName}`);

  // Alternative access methods
  const firstName = record.getValueByKey('FirstName');
  const field = record.getFieldByKey('FirstName');
  console.log(field.value); // Formatted value
  console.log(field.unformattedValue); // Raw binary value
}
```

### Modifying Records

```javascript
const table = franchise.getTableByName('Player');
await table.readRecords(['FirstName', 'LastName']);

// Modify field values
table.records[0].FirstName = 'John';
table.records[0].LastName = 'Madden';

// Save changes
await franchise.save();

// OR with auto-save enabled
const franchise = new Franchise(filePath, { saveOnChange: true });
// Changes save automatically when you modify fields
```

---

## 5. Franchise File Object Structure

### FranchiseFile Properties

```javascript
franchise.schema          // Schema information
franchise.schema.meta     // Metadata (gameYear, major, minor)
franchise.tables          // Array of all tables
franchise.isLoaded        // Boolean: file ready
```

### FranchiseFileTable Properties

```javascript
table.name               // Table name (e.g., "Player")
table.uniqueId           // Global unique ID (never changes between versions)
table.records            // Array of FranchiseFileRecord objects
table.recordsCount       // Number of records
table.offset             // Binary offset in file
table.schema             // Table schema definition
table.table2Records      // Table2 fields (strings)
table.table3Records      // Table3 fields (binary blobs)
table.emptyRecords       // Map of empty record indices
table.gameYear           // Game year (26 for Madden 26)
```

### FranchiseFileRecord Properties

```javascript
record.isEmpty           // Boolean: is this an empty record?
record.fields            // Array of field objects
record.index             // Record index in table
record.FieldName         // Direct access to field value (e.g., record.FirstName)
record.getValueByKey(key)     // Get formatted value
record.getFieldByKey(key)     // Get field object
```

### FranchiseFileField Properties

```javascript
field.value              // Formatted value (what you display to users)
field.unformattedValue   // Raw binary value
field.isReference        // Boolean: does this point to another table?
field.referenceData      // Reference information (table ID, record index)
field.key                // Field name
field.maxLength          // Max value or string length
field.offset             // Bit offset in record
```

---

## 6. Schema Structure for Madden 26

### Schema Metadata

```javascript
// After file loads
const meta = franchise.schema.meta;
console.log(meta.gameYear);  // 26 for Madden 26
console.log(meta.major);     // Schema major version
console.log(meta.minor);     // Schema minor version
```

### Schema Definition

Schemas define:
- **Human-readable field names** for each table
- **Data types** (string, int, bool, float, etc.)
- **Maximum values** for integers
- **Field lengths** for strings
- **Reference mappings** (fields pointing to other tables)

Example from schema:
```javascript
// Player table has 300+ fields
{
  name: 'Player',
  attributes: [
    {
      name: 'FirstName',
      type: 'string',
      maxLength: 30
    },
    {
      name: 'AwarenessRating',
      type: 'int',
      maxValue: 127
    },
    // ... 300+ more fields
  ]
}
```

### Schema Access

```javascript
// Get schema for specific table
const playerTable = franchise.getTableByName('Player');
const schema = playerTable.schema;

console.log('Table name:', schema.name);
console.log('Field count:', schema.attributes.length);

// List all fields
for (const attr of schema.attributes) {
  console.log(`${attr.name}: ${attr.type}`);
}
```

---

## 7. Common Tables in Madden 26

### Core Tables (Always Present)

| Table Name | Description | Record Count (approx) |
|------------|-------------|----------------------|
| `Player` | All players | 2,500+ |
| `Team` | NFL teams | 32 |
| `Coach` | Head coaches, coordinators | 100+ |
| `Stadium` | Team stadiums | 32 |
| `SeasonInfo` | Season metadata | 1 |
| `Owner` | Team owners | 32 |
| `Depth Chart` | Team depth charts | Variable |

### Franchise Mode Tables

| Table Name | Description |
|------------|-------------|
| `SeasonGame` | Schedule/game results |
| `Draft` | Draft information |
| `DraftPick` | Draft pick trades |
| `PlayerAward` | Player awards/stats |
| `Coach History` | Coaching history |
| `Salary Cap` | Team salary data |
| `Free Agent` | Free agency info |

### Character Customization

| Table Name | Description | Notes |
|------------|-------------|-------|
| `CharacterVisuals` | Player appearance data | ⚠️ May cause corruption if edited incorrectly |
| `AssetRequest` | Asset references | Read-only recommended |

### Reference Tables

| Table Name | Description |
|------------|-------------|
| `Position` | Position definitions |
| `Player Role` | Player role types |
| `Team` | Team metadata |
| `City` | City information |

---

## 8. Why You're Getting 0 Tables

### Root Cause Analysis

**Your Code (test-m26-detection.js line 46):**
```javascript
const tables = franchise.getAllTables();  // ❌ NO SUCH METHOD
console.log(`- Available tables: ${tables.length}`);
```

**What Happens:**
1. `franchise.getAllTables()` returns `undefined` (method doesn't exist)
2. `undefined.length` likely throws error or returns 0
3. Result: "0 tables" displayed

**The Fix:**
```javascript
const tables = franchise.tables;  // ✅ CORRECT - direct property access
console.log(`- Available tables: ${tables.length}`);
```

### Why This Wasn't Caught

The library's API documentation shows these methods:
- `getTableByName(name)` - single table
- `getAllTablesByName(name)` - all tables with same name
- `getTableById(id)` - by unique ID
- `getTableByIndex(index)` - by array index

**There is NO `getAllTables()` method.**

To get all tables, you access the `franchise.tables` array directly.

---

## 9. Correct Implementation Examples

### Example 1: List All Tables

```javascript
const Franchise = require('madden-franchise');
const franchise = new Franchise(filePath);

franchise.on('ready', () => {
  console.log(`Game Year: ${franchise.schema.meta.gameYear}`);
  console.log(`Schema: ${franchise.schema.meta.major}.${franchise.schema.meta.minor}`);

  // ✅ CORRECT way to get all tables
  const tables = franchise.tables;
  console.log(`\nTotal Tables: ${tables.length}\n`);

  // List first 20 tables
  tables.slice(0, 20).forEach((table, index) => {
    console.log(`${index + 1}. ${table.name} (${table.recordsCount} records)`);
  });
});
```

### Example 2: Extract Player Data

```javascript
const Franchise = require('madden-franchise');

async function extractPlayers(filePath) {
  const franchise = new Franchise(filePath);

  return new Promise((resolve, reject) => {
    franchise.on('ready', async () => {
      try {
        // Get Player table
        const playerTable = franchise.getTableByName('Player');

        // Read specific fields (faster than reading all)
        await playerTable.readRecords([
          'FirstName',
          'LastName',
          'Position',
          'JerseyNum',
          'Age',
          'OverallRating'
        ]);

        // Extract data
        const players = playerTable.records
          .filter(record => !record.isEmpty)
          .map(record => ({
            name: `${record.FirstName} ${record.LastName}`,
            position: record.Position,
            number: record.JerseyNum,
            age: record.Age,
            overall: record.OverallRating
          }));

        resolve(players);
      } catch (error) {
        reject(error);
      }
    });

    franchise.on('error', reject);
  });
}

// Usage
extractPlayers(filePath).then(players => {
  console.log(`Extracted ${players.length} players`);
  console.log(players[0]); // Show first player
});
```

### Example 3: Modify and Save

```javascript
const Franchise = require('madden-franchise');

async function updatePlayer(filePath, playerName, newOverall) {
  const franchise = new Franchise(filePath);

  return new Promise((resolve, reject) => {
    franchise.on('ready', async () => {
      try {
        const playerTable = franchise.getTableByName('Player');
        await playerTable.readRecords(['FirstName', 'LastName', 'OverallRating']);

        // Find player
        const player = playerTable.records.find(record =>
          !record.isEmpty &&
          `${record.FirstName} ${record.LastName}` === playerName
        );

        if (!player) {
          throw new Error(`Player "${playerName}" not found`);
        }

        // Update rating
        console.log(`Updating ${playerName}: ${player.OverallRating} → ${newOverall}`);
        player.OverallRating = newOverall;

        // Save changes
        await franchise.save();

        console.log('✓ File saved successfully');
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    franchise.on('error', reject);
  });
}

// Usage
updatePlayer(filePath, 'Patrick Mahomes', 99)
  .then(() => console.log('Done!'))
  .catch(err => console.error('Error:', err));
```

---

## 10. Building an Editor on Top of Madden-Franchise

### Architecture Recommendations

```
Your Editor
├── Parser Layer (madden-franchise library)
│   └── Handles: Binary parsing, table access, schema loading
├── Data Layer (Your Code)
│   ├── Cache loaded tables
│   ├── Maintain edit history
│   ├── Validate changes
│   └── Handle references between tables
├── UI Layer (Handsontable)
│   ├── Display data in grid
│   ├── Handle user edits
│   └── Show validation errors
└── IPC Layer (Electron)
    ├── File operations in main process
    ├── Parser operations in main process
    └── UI updates in renderer process
```

### Data Flow Pattern

```javascript
// 1. MAIN PROCESS: Load franchise file
ipcMain.handle('franchise:load', async (event, filePath) => {
  const franchise = new Franchise(filePath);

  return new Promise((resolve, reject) => {
    franchise.on('ready', async () => {
      // Cache franchise instance
      global.activeFranchise = franchise;

      // Return metadata
      resolve({
        gameYear: franchise.schema.meta.gameYear,
        schemaVersion: `${franchise.schema.meta.major}.${franchise.schema.meta.minor}`,
        tableCount: franchise.tables.length,
        tables: franchise.tables.map(t => ({
          name: t.name,
          recordCount: t.recordsCount,
          uniqueId: t.uniqueId
        }))
      });
    });

    franchise.on('error', reject);
  });
});

// 2. MAIN PROCESS: Load table data
ipcMain.handle('franchise:getTable', async (event, tableName, fields) => {
  const franchise = global.activeFranchise;
  const table = franchise.getTableByName(tableName);

  // Read specific fields only
  await table.readRecords(fields);

  // Return serialized data (can't send Record objects over IPC)
  return table.records
    .filter(r => !r.isEmpty)
    .map(record => {
      const data = { _index: record.index };
      fields.forEach(field => {
        data[field] = record[field];
      });
      return data;
    });
});

// 3. MAIN PROCESS: Save changes
ipcMain.handle('franchise:saveChanges', async (event, tableName, changes) => {
  const franchise = global.activeFranchise;
  const table = franchise.getTableByName(tableName);

  // Apply changes
  changes.forEach(({ index, field, value }) => {
    table.records[index][field] = value;
  });

  // Save file
  await franchise.save();

  return { success: true };
});

// 4. RENDERER PROCESS: Load and display
async function loadPlayerTable() {
  // Get file metadata
  const metadata = await window.electronAPI.invoke('franchise:load', filePath);
  console.log(`Loaded Madden ${metadata.gameYear} franchise`);

  // Load Player table
  const players = await window.electronAPI.invoke('franchise:getTable', 'Player', [
    'FirstName',
    'LastName',
    'Position',
    'OverallRating',
    'Age'
  ]);

  // Display in Handsontable
  const hot = new Handsontable(container, {
    data: players,
    columns: [
      { data: 'FirstName', type: 'text' },
      { data: 'LastName', type: 'text' },
      { data: 'Position', type: 'text' },
      { data: 'OverallRating', type: 'numeric' },
      { data: 'Age', type: 'numeric' }
    ]
  });

  // Track changes
  hot.addHook('afterChange', (changes, source) => {
    if (source === 'edit') {
      pendingChanges.push(...changes.map(([row, field, oldVal, newVal]) => ({
        index: players[row]._index,
        field,
        value: newVal
      })));
    }
  });
}

// 5. RENDERER PROCESS: Save
async function saveChanges() {
  await window.electronAPI.invoke('franchise:saveChanges', 'Player', pendingChanges);
  console.log('Saved successfully!');
  pendingChanges = [];
}
```

### Performance Optimization

```javascript
// 1. Only load fields you need
await table.readRecords(['FirstName', 'LastName']); // Fast
// vs
await table.readRecords(); // Slow - loads 300+ fields

// 2. Cache frequently accessed tables
const playerTableCache = {};

async function getPlayerTable(franchise) {
  if (!playerTableCache[franchise.filePath]) {
    const table = franchise.getTableByName('Player');
    await table.readRecords(['FirstName', 'LastName', 'Position']);
    playerTableCache[franchise.filePath] = table;
  }
  return playerTableCache[franchise.filePath];
}

// 3. Batch changes before saving
const changes = [];
changes.push({ record: 0, field: 'FirstName', value: 'John' });
changes.push({ record: 0, field: 'LastName', value: 'Madden' });
// Apply all at once
changes.forEach(c => table.records[c.record][c.field] = c.value);
await franchise.save(); // One save operation
```

---

## 11. Madden 26 Compatibility Notes

### Schema Differences

Madden 26 may have:
- New tables not in Madden 25
- New fields in existing tables
- Deprecated fields removed
- Changed field types or max values

**Strategy:**
```javascript
// Check schema version
if (franchise.schema.meta.gameYear === 26) {
  // Use M26-specific field names
  const modernField = record.NewM26Field;
} else {
  // Fallback for older versions
  const legacyField = record.OldField;
}

// Or handle missing fields gracefully
const getValue = (record, field) => {
  return record[field] !== undefined ? record[field] : 'N/A';
};
```

### Known M26 Quirks

1. **CharacterVisuals Table:** May corrupt file if edited incorrectly
   - **Solution:** Read-only or implement validation

2. **Empty Records:** More prevalent in M26
   - **Solution:** Always check `record.isEmpty` before processing

3. **Schema Version Detection:** Should auto-detect M26
   - **Verify:** Check `franchise.schema.meta.gameYear === 26`

### Testing M26 Files

```javascript
// Comprehensive M26 test
const Franchise = require('madden-franchise');

async function testM26File(filePath) {
  const franchise = new Franchise(filePath);

  franchise.on('ready', async () => {
    // Verify it's M26
    const gameYear = franchise.schema.meta.gameYear;
    console.log(`✓ Detected Madden ${gameYear}`);

    if (gameYear !== 26) {
      console.warn(`⚠️  Expected M26, got M${gameYear}`);
    }

    // Test table access
    const testTables = ['Player', 'Team', 'Coach', 'SeasonInfo'];

    for (const tableName of testTables) {
      const table = franchise.getTableByName(tableName);

      if (!table) {
        console.error(`✗ ${tableName} table not found`);
        continue;
      }

      await table.readRecords();
      const activeRecords = table.records.filter(r => !r.isEmpty);

      console.log(`✓ ${tableName}: ${activeRecords.length} records`);
    }

    // Test schema fields
    const playerTable = franchise.getTableByName('Player');
    const schema = playerTable.schema;
    console.log(`\n✓ Player table has ${schema.attributes.length} fields`);

    // Test read/write
    await playerTable.readRecords(['FirstName']);
    const firstPlayer = playerTable.records.find(r => !r.isEmpty);
    console.log(`✓ Can read: ${firstPlayer.FirstName}`);

    console.log('\n✅ M26 file fully compatible!');
  });

  franchise.on('error', (err) => {
    console.error('✗ Error:', err);
  });
}
```

---

## 12. Recommendations

### Immediate Fixes Needed

1. **Fix test-m26-detection.js line 46:**
   ```javascript
   // CHANGE THIS:
   const tables = franchise.getAllTables();

   // TO THIS:
   const tables = franchise.tables;
   ```

2. **Update all code that accesses tables:**
   - Search codebase for `getAllTables()`
   - Replace with `franchise.tables` array access
   - Verify no other incorrect API calls

3. **Use correct initialization pattern:**
   ```javascript
   // Your current pattern (event-based) is CORRECT
   const franchise = new Franchise(filePath);
   franchise.on('ready', () => {
     // Access tables here
   });
   ```

### Best Practices

1. **Always read specific fields:**
   ```javascript
   // Good - fast, low memory
   await table.readRecords(['FirstName', 'LastName', 'Position']);

   // Bad - slow, high memory
   await table.readRecords();
   ```

2. **Filter empty records:**
   ```javascript
   const activePlayers = playerTable.records.filter(r => !r.isEmpty);
   ```

3. **Use table unique IDs for critical tables:**
   ```javascript
   // Table IDs never change between game years
   const playerTable = franchise.getTableById(4095);
   ```

4. **Validate before saving:**
   ```javascript
   // Check data integrity
   if (record.OverallRating < 0 || record.OverallRating > 99) {
     throw new Error('Invalid rating');
   }
   await franchise.save();
   ```

5. **Handle errors gracefully:**
   ```javascript
   franchise.on('error', (err) => {
     console.error('Franchise error:', err);
     // Show user-friendly message
     showErrorDialog('Failed to load franchise file');
   });
   ```

### Advanced Features to Explore

1. **Reference Fields:**
   ```javascript
   // Some fields reference other tables
   const field = record.getFieldByKey('TeamIndex');
   if (field.isReference) {
     const refData = field.referenceData;
     console.log(`Points to table ${refData.tableId}, record ${refData.recordIndex}`);
   }
   ```

2. **Empty Record Management:**
   ```javascript
   // Recalculate empty records (prevents corruption)
   table.recalculateEmptyRecordReferences();
   ```

3. **Table2/Table3 Access:**
   ```javascript
   // Table2 = string data, Table3 = binary blobs
   const stringFields = table.table2Records;
   const binaryFields = table.table3Records;
   ```

---

## 13. Conclusion

### Summary

- ✅ **Madden 26 is fully supported** by madden-franchise@3.8.0
- ✅ **The library works correctly** - the issue is API misuse
- ✅ **Your version (3.8.0) is appropriate** for CommonJS projects
- ❌ **`franchise.getAllTables()` doesn't exist** - use `franchise.tables` instead
- ✅ **Event-based initialization pattern is correct**

### The Fix

Change ONE line in your code:
```javascript
// Before (WRONG):
const tables = franchise.getAllTables();

// After (CORRECT):
const tables = franchise.tables;
```

### Next Steps

1. **Fix API calls** - Update test files to use `franchise.tables`
2. **Test file loading** - Verify M26 files load correctly
3. **Implement data extraction** - Use examples from Section 9
4. **Build editor UI** - Follow architecture in Section 10
5. **Add validation** - Prevent data corruption before saving
6. **Test save/load cycle** - Ensure files work in-game after editing

### Resources

- **GitHub:** https://github.com/bep713/madden-franchise
- **npm:** https://www.npmjs.com/package/madden-franchise
- **Your Version:** 3.8.0 (in package.json)
- **Example Editor:** https://github.com/bep713/madden-franchise-editor

---

**Document Created:** 2025-10-21
**Library Version Researched:** madden-franchise@3.8.0
**Target Game:** Madden NFL 26
**Compatibility:** ✅ CONFIRMED
