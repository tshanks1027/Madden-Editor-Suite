# Madden Franchise Editor - Complete Architecture Research

**Source:** madden-franchise-editor v4.5.9 (extracted from installed app)
**Date:** 2025-10-26
**Purpose:** Understand complete franchise editing approach for Phase 5 implementation

---

## 1. EXECUTIVE SUMMARY

The madden-franchise-editor uses the **madden-franchise v3.4.1** library (we have v3.8.0) as its core parsing engine. Their architecture is:

- **Main Process:** Electron main.js handles IPC, file watching, window management
- **Worker Process:** Hidden background window (optional, mostly unused in current version)
- **Renderer Process:** Pure JavaScript + Handsontable 11.1.0 for table editing
- **Library:** madden-franchise handles ALL binary parsing, schema loading, enum conversions, and file saving
- **UI Pattern:** Tab-based navigation with service-oriented architecture

**Key Finding:** They do NOT manually handle enum conversions in renderer - the madden-franchise library does everything!

---

## 2. FILE STRUCTURE MAP

```
madden-franchise-editor/
├── main.js                          # Electron main process
├── renderer/
│   ├── index.html                   # Welcome/home screen
│   ├── table-editor.html            # Main table editor UI
│   ├── schedule.html                # Schedule editor (specialized view)
│   ├── ability-editor.html          # Ability editor (specialized view)
│   ├── schema-viewer.html           # Schema inspection
│   ├── schema-manager.html          # Schema selection/management
│   ├── welcome.html                 # File opening screen
│   ├── js/
│   │   ├── index.js                 # Entry point
│   │   ├── franchise/               # Franchise data models (thin wrappers)
│   │   │   ├── FranchiseTable.js    # Table wrapper (just stores offsets)
│   │   │   ├── FranchiseOffset.js   # Offset wrapper (name, type, offset, length)
│   │   │   ├── FranchiseSchedule.js # Schedule-specific logic
│   │   │   └── FranchiseGame.js     # Game-specific logic
│   │   └── services/                # Business logic services
│   │       ├── navigationService.js # Tab management, file loading
│   │       ├── tableEditorService.js # Table editing orchestration
│   │       ├── welcomeService.js    # File opening, recent files
│   │       ├── scheduleService.js   # Schedule editing logic
│   │       ├── externalDataService.js # Excel import/export
│   │       ├── pinnedTableService.js # Pinned tables feature
│   │       ├── referenceViewerService.js # Reference navigation
│   │       ├── recentFileService.js # Recent files management
│   │       ├── savedSchemaService.js # Schema caching
│   │       └── table-editor/        # Table editor components
│   │           ├── TableEditorWrapper.js  # Main wrapper class
│   │           ├── TableEditorView.js     # Handsontable view
│   │           ├── Loader.js              # Loading UI
│   │           ├── ExternalDataHandler.js # Import/export handler
│   │           └── custom-renderers/      # Custom cell renderers
│   │               ├── reference/
│   │               │   ├── ReferenceRenderer.js  # Binary ref to clickable link
│   │               │   └── ReferenceEditor.js    # Edit reference cells
│   │               └── binary-blob/
│   │                   ├── BinaryBlobRenderer.js # Table3 data display
│   │                   └── BinaryBlobEditor.js   # Table3 data editing
│   └── data/                        # Static lookup data
│       ├── teamData.json            # NFL teams (schedules use this)
│       ├── dayOfWeekData.json       # Day of week enum
│       ├── seasonWeekData.json      # Week types
│       ├── navigation.json          # Tab navigation config
│       └── offsets.json             # Custom offset overrides
└── node_modules/
    └── madden-franchise/            # Core library (v3.4.1)
        ├── FranchiseFile.js         # Main file parser
        ├── FranchiseFileTable.js    # Table parser
        ├── FranchiseFileRecord.js   # Record parser
        ├── FranchiseFileField.js    # Field parser (ENUM MAGIC HERE!)
        ├── FranchiseEnum.js         # Enum definition
        ├── FranchiseEnumValue.js    # Enum member
        ├── FranchiseSchema.js       # Schema loader
        └── services/
            ├── utilService.js       # Binary utilities
            └── schemaPicker.js      # Schema selection
```

---

## 3. CRITICAL ARCHITECTURE PATTERNS

### 3.1 File Loading Workflow

**Location:** `renderer/js/services/navigationService.js:678-699`

```javascript
function createNewFranchiseFile(file) {
  let newFile;

  // madden-franchise library handles EVERYTHING
  newFile = new FranchiseFile(file, {
    'schemaDirectory': savedSchemaService.getSchemaPath()
  });

  newFile.once('error', pickSchema);
  newFile.on('ready', () => {
    newFile.off('error', pickSchema);
  });

  return newFile;
}
```

**What happens:**
1. FranchiseFile reads binary data
2. Detects file type (compressed/uncompressed, format)
3. Extracts schema metadata from file
4. Loads matching schema from disk
5. Parses all tables with schema
6. Emits 'ready' event when done

**Our implementation should do the same!**

---

### 3.2 Table Editing Workflow

**Location:** `renderer/js/services/table-editor/TableEditorView.js`

#### Loading a table:

```javascript
// Line 240-292: Table selection handler
this.tableSelector.on('selectr.change', (option) => {
    const tableId = parseInt(this.tableSelector.getValue(true).value);
    const table = this.file.getTableById(tableId);

    // madden-franchise reads records
    table.readRecords().then((table) => {
        loadTable(table);  // Display in Handsontable
        this.hot.selectCell(this.rowIndexToSelect, this.columnIndexToSelect);
    });
});
```

#### Formatting table data for Handsontable:

```javascript
// Line 328-335: Convert records to flat objects
_formatTable(table) {
    return table.records.map((record) => {
        return record.fieldsArray.reduce((accumulator, currentValue) => {
            accumulator[currentValue.key] = currentValue.value;  // ← VALUE IS ALREADY FORMATTED!
            return accumulator;
        }, {});
    });
}
```

#### Setting up columns:

```javascript
// Line 353-367: Column configuration
_formatColumns(table) {
    return table.offsetTable.map((offset) => {
        return {
            'data': offset.name,
            'renderer': getRendererType(offset),  // Reference, blob, dropdown, or text
            'wordWrap': false,
            'editor': offset.enum || offset.type === 'bool' ? 'dropdown' : 'text',
            'source': offset.enum
                ? offset.enum.members.map((member) => member.name)  // ← Enum names for dropdown!
                : offset.type === 'bool' ? ['true', 'false'] : []
        };
    });
}
```

**KEY INSIGHT:**
- `offset.enum` is a FranchiseEnum object populated by madden-franchise library
- `offset.enum.members` is an array of FranchiseEnumValue objects
- Each member has `name`, `value`, `unformattedValue`
- College field IS an enum - madden-franchise handles lookup automatically!

---

### 3.3 Enum Field Handling (THE CRITICAL PART!)

**Location:** `node_modules/madden-franchise/FranchiseFileField.js`

#### Reading enum value (Line 252-270):

```javascript
_parseFieldValue(unformatted, offset) {
    if (offset.enum) {
        // Read raw binary bits
        const enumUnformattedValue = utilService.dec2bin(
            unformatted.getBits(offset.offset, offset.length),
            offset.enum._maxLength
        );

        try {
            // Find enum member by binary value
            const theEnum = offset.enum.getMemberByUnformattedValue(enumUnformattedValue);

            if (theEnum) {
                return theEnum.name;  // Return "Alabama" instead of "0000001"
            }
        } catch (err) {
            // If not found, return binary
        }

        return enumUnformattedValue;
    }
    // ... other types
}
```

#### Writing enum value (Line 107-126):

```javascript
set value(value) {
    if (this.offset.enum) {
        try {
            // Find enum by name (e.g., "Alabama")
            let theEnum = this._getEnumFromValue(value);

            // Convert to decimal for storage
            const decimalEquivalent = utilService.bin2dec(theEnum.unformattedValue);
            this._unformattedValue.setBits(this.offset.offset, decimalEquivalent, this.offset.length);
            this._value = theEnum.name;
        } catch (err) {
            // Handle invalid enum
            if (utilService.stringOnlyContainsBinaryDigits(value)) {
                this._value = value;
                this._unformattedValue.setBits(this.offset.offset, value, this.offset.length);
            } else {
                this._value = null;
                throw err;
            }
        }
    }
    // ... other types
}
```

**_getEnumFromValue helper (Line 228-249):**

```javascript
_getEnumFromValue(value) {
    // Try by name first (e.g., "Alabama")
    const enumName = this.offset.enum.getMemberByName(value);
    if (enumName) return enumName;

    // Try by formatted value (e.g., "1")
    const formattedEnum = this.offset.enum.getMemberByValue(value);
    if (formattedEnum) return formattedEnum;

    // Try by unformatted binary (e.g., "0000001")
    const unformattedEnum = this.offset.enum.getMemberByUnformattedValue(value);
    if (unformattedEnum) return unformattedEnum;

    // Default to first member
    return this.offset.enum.members[0];
}
```

**CONCLUSION:** We should NOT build our own lookup system. The madden-franchise library already does this!

---

### 3.4 Reference Field Handling

**Location:** `renderer/js/services/table-editor/custom-renderers/reference/ReferenceRenderer.js`

References are stored as 32-bit binary strings with structure:
- Bit 0: `otherTableFlag` (0 = reference, 1 = not a reference)
- Bits 2-15: Table ID (13 bits)
- Bits 16-31: Record index (16 bits)

```javascript
// Line 8-44: Reference rendering
renderer(instance, td, row, col, prop, value, cellProperties) {
    if (value && value.length === 32) {
        const otherTableFlag = value[0];

        if (otherTableFlag === '0') {
            // Parse reference
            const tableId = utilService.bin2dec(value.substring(2,15));
            const recordIndex = utilService.bin2dec(value.substring(16));
            const table = this.tableEditorWrapper.file.getTableById(tableId);

            // Create clickable link
            const referenceLink = document.createElement('a');
            referenceLink.innerHTML = `${table.name} - ${recordIndex}`;

            referenceLink.addEventListener('click', (event) => {
                // Navigate to referenced record
                this.tableEditorWrapper.selectedTableEditor.tableSelector.setValue(table.header.tableId);
            });

            td.appendChild(referenceLink);
        }
    }
    return td;
}
```

**Pattern:** Binary reference → Parse → Display as "TableName - RowIndex" → Click to navigate

---

### 3.5 Save/Update Workflow

**Location:** `renderer/js/services/table-editor/TableEditorView.js:53-106`

```javascript
_processChanges(changes, source) {
    if (changes && source !== 'onEmpty') {
        // Disable auto-save temporarily
        const flipSaveOnChange = this.file.settings.saveOnChange;
        this.file.settings.saveOnChange = false;

        changes.forEach((change) => {
            const recordIndex = this.hot.toPhysicalRow(change[0]);
            const key = change[1];
            const newValue = change[3];

            const colNumber = this.selectedTable.offsetTable.findIndex((offset) => offset.name === key);

            try {
                const record = this.selectedTable.records[recordIndex];
                let field = record.fields[key];

                // madden-franchise handles conversion and validation!
                field.value = newValue;

                // If library rejected value, update UI
                if (field.value !== newValue) {
                    this.hot.setDataAtCell(recordIndex, colNumber, field.value);
                }
            } catch (err) {
                // Revert on error
                this.hot.setDataAtCell(recordIndex, colNumber, oldValue);
                console.warn(err);
            }
        });

        // Save if auto-save enabled
        if (flipSaveOnChange) {
            this.file.save();
            this.file.settings.saveOnChange = true;
        }
    }
}
```

**Saving the file (navigationService.js:438-446):**

```javascript
ipcRenderer.on('save-file', function () {
    navigationService.currentlyOpenedFile.data.save();  // ← madden-franchise handles everything!
});

ipcRenderer.on('save-file-sync', function () {
    navigationService.currentlyOpenedFile.data.save(null, {
        sync: true
    });
});
```

**CRITICAL:** No custom update loop needed! The library tracks changes and regenerates binary on save.

---

## 4. TABLE RELATIONSHIP PATTERNS

### 4.1 Navigation Pattern

They use a "breadcrumb navigation" pattern:

```javascript
// TableEditorView stores navigation history
this.navSteps = [];  // Array of {tableId, recordIndex, column}

// When clicking a reference, add to nav steps
this.navSteps.push({
    'tableId': table.header.tableId,
    'recordIndex': recordIndex,
    'column': 0
});

// Back button pops from nav steps
backLink.addEventListener('click', () => {
    if (this.navSteps.length >= 2) {
        this.navSteps.pop();
        const navStep = this.navSteps[this.navSteps.length - 1];
        this.tableSelector.setValue(navStep.tableId);
    }
});
```

### 4.2 Pinned Tables Feature

Users can pin frequently-used tables for quick access:

```javascript
// pinnedTableService.js stores pins per game year
{
    "24": [
        {"tableId": 4178, "tableName": "Player"},
        {"tableId": 4180, "tableName": "Team"}
    ]
}
```

### 4.3 Multi-Tab Support

They support multiple table editor tabs (like browser tabs):

```javascript
// Each tab stores:
- tableId: Currently viewed table
- tableRow: Last selected row
- tableColumn: Last selected column
- tabHistory: Navigation history for this tab

// When switching tabs, restore state
tableEditorWrapper.selectedTableEditor.navSteps = activeTab.tabHistory;
```

---

## 5. FRANCHISE FILE STRUCTURE (from madden-franchise library)

### 5.1 File Header (First 82 bytes)

```
0x00-0x03: File signature (SPBF, ASTO, or SPEX)
0x04-0x07: Asset table offset
0x24-0x27: Asset table entry count
0x52+:     Compressed data (if compressed)
```

### 5.2 Table Structure

Each table has:

1. **Table Header (~127+ bytes)**
   - Table ID (4 bytes)
   - Table name (variable length string)
   - Record count, record size, capacity
   - Offset table pointer
   - Table2/Table3 pointers (if present)

2. **Table 1 - Main Records**
   - Fixed-size binary records
   - Bit-packed fields based on schema

3. **Table 2 - String Data (optional)**
   - Variable-length strings referenced from Table 1

4. **Table 3 - Binary Blob Data (optional)**
   - Large binary data (images, etc.) referenced from Table 1

### 5.3 Empty Record Management

**CRITICAL PATTERN:** Empty records form a linked list!

```javascript
// First 4 bytes of empty record:
// Bits 0: Always '0' (reference flag)
// Bits 2-15: ALWAYS 0 (table ID = 0 means empty)
// Bits 16-31: Index of NEXT empty record

// Example empty record chain:
// Record 5 → points to Record 12
// Record 12 → points to Record 20
// Record 20 → points to 65535 (end of chain)

// Header.nextRecordToUse = 5 (first available)
```

When unemptying a record, you must:
1. Update `nextRecordToUse` to skip this record
2. Update previous empty record to point to next empty record
3. Recalculate empty record map

---

## 6. SCHEMA SYSTEM

### 6.1 Schema Structure

Schemas are JSON files describing table structure:

```json
{
  "meta": {
    "gameYear": 24,
    "major": 1,
    "minor": 0
  },
  "tables": {
    "Player": {
      "attributes": [
        {
          "name": "FirstName",
          "type": "string",
          "maxLength": 32
        },
        {
          "name": "College",
          "type": "College",  // ← References "College" enum
          "enum": true
        },
        {
          "name": "TeamIndex",
          "type": "int",
          "isReference": true,
          "referenceTable": "Team"
        }
      ]
    }
  },
  "enums": {
    "College": {
      "members": [
        {"name": "None", "value": 0},
        {"name": "Alabama", "value": 1},
        {"name": "Clemson", "value": 2}
        // ... 300+ colleges
      ]
    }
  }
}
```

### 6.2 Schema Loading

**Location:** `node_modules/madden-franchise/FranchiseFile.js:108-137`

```javascript
parse() {
    // Read expected schema from file header
    const schemaMeta = this.expectedSchemaVersion;  // {gameYear: 24, major: 1, minor: 0}

    // Pick matching schema file
    const schemaPath = schemaPickerService.pick(
        this._gameYear,
        schemaMeta.major,
        schemaMeta.minor,
        this.settings
    ).path;

    // Load and parse schema
    this.schemaList = new FranchiseSchema(schemaPath, {
        extraSchemas: this.settings.extraSchemas
    });

    this.schemaList.on("schemas:done", () => {
        // Apply schemas to tables
        this.tables.forEach((table) => {
            const schema = this.schemaList.getSchema(table.name);
            if (schema) {
                table.schema = schema;  // ← Populates offset.enum objects!
            }
        });

        this.emit("ready");
    });
}
```

**CRITICAL:** When `table.schema = schema` is set, the madden-franchise library:
1. Parses schema attributes
2. Creates OffsetTableEntry objects
3. Loads enum definitions from schema
4. Populates `offset.enum` with FranchiseEnum objects containing all members
5. No manual lookup needed!

---

## 7. UI PATTERNS

### 7.1 Handsontable Configuration

```javascript
// TableEditorView.js:26-42
this.hot = new Handsontable(this.baseContainer, {
    width: '100%',
    height: '100%',
    rowHeaders: true,  // Show row numbers
    manualRowResize: true,
    manualColumnResize: true,
    currentRowClassName: 'active-row',
    licenseKey: 'non-commercial-and-evaluation',
    afterChange: this._processChanges.bind(this),
    afterSelection: this._processSelection.bind(this),
    contextMenu: contextMenuService.getContextMenu(this),
    rowHeaders: function (index) {
        return index;  // Row number = record index
    }
});
```

### 7.2 Custom Cell Renderers

They use custom renderers for:

1. **References** - Display as "TableName - RowIndex" clickable link
2. **Binary Blobs** - Display first 100 chars + edit button
3. **Enums** - Handled by Handsontable dropdown (no custom renderer needed!)
4. **Booleans** - Handled by Handsontable dropdown (true/false)

**Pattern:**

```javascript
columns: [{
    data: 'FieldName',
    renderer: this.customRenderer.bind(this),  // Only if needed
    editor: 'dropdown',  // For enums/bools
    source: enumMembers  // Dropdown options
}]
```

### 7.3 Loading States

They use a full-screen loader:

```javascript
utilService.show(this.loader);  // Show spinner

setTimeout(() => {
    // Do expensive work (table.readRecords(), etc.)
    utilService.hide(this.loader);  // Hide spinner
}, 100);
```

**Why setTimeout?** Allows UI thread to render loader before blocking on work.

---

## 8. IMPORT/EXPORT PATTERNS

### 8.1 Excel Export

**Location:** `renderer/js/services/externalDataService.js:25-54`

```javascript
exportTableData: function (options, table) {
    return new Promise((resolve, reject) => {
        // Headers from offset table
        let headers = table.offsetTable.map((offset) => offset.name);

        // Data from records (using _value = raw unformatted value)
        const data = table.records.map((record) => {
            return record.fieldsArray.map((field) => field._value);
        });

        // Create workbook
        let wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet([headers].concat(data), {
            'skipHeader': true
        });
        xlsx.utils.book_append_sheet(wb, ws);

        // Write file
        xlsx.writeFile(wb, options.outputFilePath);
        resolve();
    });
}
```

**KEY:** They export `_value` (raw binary/unformatted) not `value` (formatted). This preserves exact binary values.

### 8.2 Excel Import

```javascript
importTableData: function (options) {
    return new Promise((resolve, reject) => {
        const wb = xlsx.readFile(options.inputFilePath);
        resolve(xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
            'raw': false  // Return as strings
        }));
    });
}
```

Then apply to records:

```javascript
trimmedTable.forEach((record, index) => {
    let franchiseRecord = tableEditorService.selectedTable.records[index];

    Object.keys(record).forEach((key) => {
        if (franchiseRecord[key] !== record[key]) {
            franchiseRecord[key] = record[key];  // ← Triggers field.value setter
        }
    });
});
```

---

## 9. CRITICAL TABLES FOR FRANCHISE EDITING

Based on their navigation config and code, these are the critical tables:

### 9.1 Core Tables

1. **Player** - Player attributes, ratings, stats
2. **Team** - Team data (name, city, cap space, etc.)
3. **Coach** - Coach data
4. **Owner** - Owner data (franchise mode)
5. **SeasonInfo** - Current season/week info
6. **SeasonGame** - Schedule data
7. **Depth** - Depth charts
8. **Roster** - Player-team relationships

### 9.2 Reference Relationships

```
Player.TeamIndex → Team
Player.College → College enum (300+ values)
Player.Position → Position enum
Player.PLYR_PORTRAIT → Portrait ID (integer)
Team.TeamIndex → Self-reference
SeasonGame.HomeTeam → Team
SeasonGame.AwayTeam → Team
```

### 9.3 Table Types

- **Regular Tables:** Fixed fields (Player, Team, etc.)
- **Array Tables:** Arrays of primitives (int[], bool[], etc.)
- **Reference Tables:** Store foreign keys
- **Enum Tables:** Store enum values (stored as integers, displayed as names)

---

## 10. DIFFERENCES FROM OUR CURRENT IMPLEMENTATION

### 10.1 What We're Doing Wrong

❌ **We're trying to build our own lookup system**
- College lookup in lookup-service.ts
- Manual conversion of binary → readable values
- Separate lookup tables in SQLite

✅ **Should do instead:**
- Use madden-franchise library enum system
- Schema already has College enum with 300+ members
- field.value automatically converts!

❌ **We're building custom parsers (M26Parser.js)**
- Should use FranchiseFile from madden-franchise
- Only customize if format is completely different

❌ **We're manually handling save logic**
- Should use file.save() from madden-franchise
- Library handles binary regeneration

### 10.2 What We Can Learn

✅ **Tab-based navigation** - Better UX than single table view
✅ **Pinned tables** - Quick access to common tables
✅ **Reference navigation** - Breadcrumb trail, back button
✅ **Schema management** - Let users pick schema if needed
✅ **Multi-window architecture** - Main + worker (optional)

---

## 11. RECOMMENDED CHANGES FOR OUR PROJECT

### 11.1 Immediate Changes (Phase 5)

1. **Use madden-franchise library for ALL parsing**
   ```javascript
   const FranchiseFile = require('madden-franchise');

   // In IPC handler:
   const file = new FranchiseFile(filePath, {
       schemaDirectory: path.join(__dirname, '../data/schemas')
   });

   file.on('ready', () => {
       // file.tables[0].records[0].fields['College'].value → "Alabama"
       event.reply('file-loaded', {
           tables: file.tables.map(t => ({
               id: t.header.tableId,
               name: t.name,
               recordCount: t.header.recordCount
           }))
       });
   });
   ```

2. **Remove custom lookup system**
   - Delete lookup-service.ts logic for College/State/etc.
   - Delete ALL_PLAYER_LOOKUP.csv (or use only for name lookups)
   - Schema enums replace lookups!

3. **Update field-definitions.js**
   ```javascript
   // OLD (manual lookup):
   { name: 'College', type: 'lookup', lookupTable: 'colleges' }

   // NEW (use schema):
   { name: 'College', type: 'enum' }  // Schema provides enum!
   ```

4. **Simplify franchise-handlers.ts**
   ```javascript
   // OLD:
   ipcMain.handle('load-franchise', async (event, filePath) => {
       const parser = new M26Parser();
       const data = parser.parse(filePath);
       // ... manual field processing
   });

   // NEW:
   ipcMain.handle('load-franchise', async (event, filePath) => {
       return new Promise((resolve, reject) => {
           const file = new FranchiseFile(filePath);
           file.on('ready', () => {
               resolve({
                   tables: file.tables.map(formatTable)
               });
           });
           file.on('error', reject);
       });
   });
   ```

5. **Update Handsontable columns**
   ```javascript
   // TableEditorView pattern:
   const columns = table.offsetTable.map((offset) => {
       return {
           data: offset.name,
           editor: offset.enum ? 'dropdown' : 'text',
           source: offset.enum ? offset.enum.members.map(m => m.name) : undefined
       };
   });
   ```

### 11.2 Architecture Changes

1. **Adopt service-oriented architecture**
   ```
   src/renderer/js/services/
   ├── franchiseService.js      # Wraps madden-franchise
   ├── tableEditorService.js    # Table editing logic
   ├── navigationService.js     # Tab management
   └── utilService.js           # Utilities
   ```

2. **Use event-driven pattern**
   ```javascript
   file.on('ready', handleReady);
   file.on('saving', showSavingIndicator);
   file.on('saved', hideSavingIndicator);
   file.on('change', markAsModified);
   ```

3. **Implement navigation history**
   ```javascript
   // Track user navigation
   navHistory = [];

   // When clicking reference
   navHistory.push({ tableId, recordIndex, column });

   // Back button
   const prev = navHistory.pop();
   navigateToRecord(prev);
   ```

### 11.3 UI Improvements

1. **Add table selector dropdown** (like they have)
   - Shows all tables with IDs
   - Search functionality
   - Recent tables

2. **Add pinned tables** (user favorites)
   - Store in user preferences
   - Quick access sidebar

3. **Add multi-tab support** (future)
   - Open multiple tables
   - Switch between views
   - Preserve state per tab

4. **Add reference navigation**
   - Clickable reference cells
   - Navigate to referenced record
   - Back button to return

---

## 12. CODE EXAMPLES TO ADAPT

### 12.1 File Loading Pattern

```javascript
// From navigationService.js - ADAPT THIS
function loadFranchiseFile(filePath) {
    const file = new FranchiseFile(filePath, {
        schemaDirectory: path.join(app.getPath('userData'), 'schemas')
    });

    file.once('error', (err) => {
        // Schema missing or wrong version
        showSchemaSelector(file.expectedSchemaVersion);
    });

    file.on('ready', () => {
        // File loaded successfully
        displayTableList(file.tables);
    });

    file.on('saving', () => {
        showStatus('Saving...');
    });

    file.on('saved', () => {
        showStatus('Saved!', 2000);
    });

    return file;
}
```

### 12.2 Table Display Pattern

```javascript
// From TableEditorView.js - ADAPT THIS
function displayTable(table) {
    // Read records (lazy loaded)
    table.readRecords().then(() => {
        // Format data for Handsontable
        const data = table.records.map((record) => {
            const row = {};
            record.fieldsArray.forEach((field) => {
                row[field.key] = field.value;  // Already formatted!
            });
            return row;
        });

        // Format headers
        const headers = table.offsetTable.map(offset => offset.name);

        // Format columns
        const columns = table.offsetTable.map((offset) => {
            const col = {
                data: offset.name,
                renderer: 'text',
                editor: 'text'
            };

            // Enum fields get dropdown
            if (offset.enum) {
                col.editor = 'dropdown';
                col.source = offset.enum.members.map(m => m.name);
            }

            // Bool fields get dropdown
            if (offset.type === 'bool') {
                col.editor = 'dropdown';
                col.source = ['true', 'false'];
            }

            // Reference fields get custom renderer
            if (offset.isReference) {
                col.renderer = renderReference;
                col.editor = false;  // Read-only (or custom editor)
            }

            return col;
        });

        // Update Handsontable
        hot.updateSettings({
            data: data,
            colHeaders: headers,
            columns: columns
        });
    });
}
```

### 12.3 Save Pattern

```javascript
// From TableEditorView.js - ADAPT THIS
function onCellChange(changes, source) {
    if (!changes || source === 'loadData') return;

    // Disable auto-save temporarily
    const autoSave = file.settings.saveOnChange;
    file.settings.saveOnChange = false;

    changes.forEach(([row, prop, oldVal, newVal]) => {
        try {
            const record = table.records[row];
            const field = record.fields[prop];

            // madden-franchise validates and converts
            field.value = newVal;

            // If rejected, revert in UI
            if (field.value !== newVal) {
                hot.setDataAtCell(row, hot.propToCol(prop), field.value, 'revert');
            }
        } catch (err) {
            // Invalid value, revert
            hot.setDataAtCell(row, hot.propToCol(prop), oldVal, 'revert');
            showError(`Invalid value: ${err.message}`);
        }
    });

    // Re-enable auto-save
    file.settings.saveOnChange = autoSave;

    // Save if enabled
    if (autoSave) {
        file.save();
    }
}
```

---

## 13. SCHEMA FILES NEEDED

We need M25/M26 schema files. They're stored as JSON:

```
data/schemas/
├── 25_1_0.json          # M25 schema v1.0
├── 25_1_1.json          # M25 schema v1.1
├── 26_1_0.json          # M26 schema v1.0
└── 26_1_1.json          # M26 schema v1.1
```

**How to get schemas:**
1. Check madden-franchise repo for included schemas
2. Use their schema-generation-service to extract from files
3. Use community-shared schemas from Discord

**Schema contains:**
- All table definitions
- All field types and offsets
- All enum definitions (College, State, Position, etc.)
- Reference relationships

---

## 14. TESTING APPROACH

They use a TestUtility class for E2E testing:

```javascript
// test-utils/TestUtility.js
class TestUtility {
    constructor(welcomeService, tableEditorWrapper) {
        // Automated testing hooks
    }
}
```

**We should add similar:**
1. Playwright tests for file loading
2. Playwright tests for table editing
3. Playwright tests for save/load round-trip
4. Unit tests for field conversions

---

## 15. PORTRAIT HANDLING

**CRITICAL FINDING:** They do NOT handle portraits in the table editor!

Portrait ID is just an integer field (PLYR_PORTRAIT). Portrait images come from separate AST files, which they process separately in the worker service (currently disabled).

**For Phase 5:**
- Display PLYR_PORTRAIT as integer
- Future: Load portrait atlas from AST files
- Future: Display portrait thumbnail in custom renderer

---

## 16. FINAL RECOMMENDATIONS

### DO:
✅ Use madden-franchise library for ALL file operations
✅ Use schema enums instead of custom lookup system
✅ Adopt their service-oriented architecture
✅ Use event-driven pattern for file operations
✅ Add navigation history for references
✅ Add table selector with search
✅ Use custom renderers only where needed (references, blobs)

### DON'T:
❌ Build custom binary parsers (use FranchiseFile)
❌ Build custom lookup tables (use schema enums)
❌ Manually handle save logic (use file.save())
❌ Try to handle portraits in table editor (separate feature)
❌ Over-complicate UI (start with single table view, add tabs later)

### PHASED APPROACH:

**Phase 5A - Core Functionality (Now):**
1. Replace M26Parser with FranchiseFile
2. Remove lookup-service (use schema enums)
3. Display one table at a time
4. Basic save/load

**Phase 5B - Enhanced Navigation:**
1. Add table selector dropdown
2. Add navigation history (back button)
3. Add reference click navigation
4. Add pinned tables

**Phase 5C - Advanced Features:**
1. Multi-tab support
2. Import/export Excel
3. Schema management UI
4. Portrait integration

---

## 17. KEY FILES TO STUDY FURTHER

If you need more detail on specific features:

1. **Enum handling:** `node_modules/madden-franchise/FranchiseFileField.js:107-270`
2. **Reference handling:** `renderer/js/services/table-editor/custom-renderers/reference/ReferenceRenderer.js`
3. **Save logic:** `node_modules/madden-franchise/FranchiseFile.js:267-328`
4. **Table display:** `renderer/js/services/table-editor/TableEditorView.js:220-414`
5. **File loading:** `renderer/js/services/navigationService.js:535-699`

---

## CONCLUSION

The madden-franchise-editor's success comes from **leveraging the madden-franchise library fully** instead of reimplementing its features. They focus on UI/UX while letting the library handle binary parsing, schema management, enum conversions, and file saving.

**We should do the same.**

Our current approach of building custom parsers and lookup systems is unnecessary complexity. By adopting their architecture pattern and using madden-franchise v3.8.0 properly, we can build a complete franchise editor much faster with less code and fewer bugs.

**Next Steps:**
1. Review this document with user
2. Get approval to refactor franchise-handlers.ts
3. Remove custom lookup system
4. Implement FranchiseFile-based loading
5. Test with M25/M26 franchise files
6. Iterate on UI patterns

---

**END OF RESEARCH DOCUMENT**
