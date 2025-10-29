# Research: Sinthros/madden-franchise-utils

**Research Date:** October 26, 2025
**Repository:** https://github.com/Sinthros/madden-franchise-utils
**Purpose:** Understand enum field handling, reference field patterns, and franchise file operations

---

## Executive Summary

Sinthros/madden-franchise-utils is a comprehensive toolkit (62+ utilities) built on top of bep713's madden-franchise library v4.1.2. **Key Finding: They rely ENTIRELY on madden-franchise library's built-in enum handling** - there is NO custom enum conversion logic in their codebase.

### Critical Insight
**Enum fields are handled transparently by madden-franchise library:**
- Scripts write enum values as **STRING NAMES** (e.g., `'ForAllHits'`, `'Aggressive'`, `'Average'`)
- Scripts read enum values as **STRING NAMES** from player records
- NO conversion between display names and numeric IDs is visible in application code
- The madden-franchise library handles all binary serialization automatically

---

## Repository Overview

### Technology Stack
- **madden-franchise:** ^4.1.2 (core parsing library by bep713)
- **Node.js:** JavaScript runtime
- **PapaParse:** ^5.4.1 (CSV parsing)
- **XLSX:** ^0.18.5 (Excel file operations)
- **Other:** Cheerio, Lodash, Puppeteer, string-similarity

### Project Structure
```
madden-franchise-utils/
├── Utils/
│   ├── FranchiseUtils.js (128KB - core helper functions)
│   ├── FranchiseTableId.js (table ID constants)
│   ├── ScheduleFunctions.js
│   └── characterVisualsLookups/
├── [62 utility directories]
│   ├── updatePlayersWithLookup/
│   ├── massTraitEdit/
│   ├── getSchemaValues/
│   ├── getFtcReferences/
│   └── ... (58 more utilities)
└── package.json
```

---

## Enum Field Handling

### Pattern 1: Direct String Assignment
**From `massTraitEdit.js`:**
```javascript
// Writing enum fields - NO conversion needed
playerTable.records[i]['TRAIT_COVER_BALL'] = 'ForAllHits';
playerTable.records[i]['TRAIT_SENSE_PRESSURE'] = 'Average';
playerTable.records[i]['TRAIT_FORCE_PASS'] = 'Ideal';
playerTable.records[i]['TRAIT_PLAY_BALL'] = 'Aggressive';

// Writing boolean fields
playerTable.records[i]['TRAIT_HIGHMOTOR'] = true;
playerTable.records[i]['TRAIT_CLUTCH'] = true;
```

**Key Observation:**
- Enum values are assigned as **plain strings**
- No `parseInt()`, no lookup tables, no conversion functions
- madden-franchise library handles the binary encoding automatically

### Pattern 2: Reading Enum Fields
**From `massTraitEdit.js`:**
```javascript
// Reading enum fields - returns STRING NAMES
const playerPosition = playerTable.records[i]['Position'];
const playerDevelopmentTrait = playerTable.records[i]['TraitDevelopment'];

// Direct comparison with string values
if (playerPosition === 'QB') {
  // Handle QB logic
}

if (starPlayers.includes(playerDevelopmentTrait)) {
  // starPlayers = ['Star','SuperStar','XFactor']
  playerTable.records[i]['TRAIT_HIGHMOTOR'] = true;
}
```

**Key Observation:**
- Enum fields READ as **string values**
- Can be compared directly with string literals
- No need to look up numeric IDs

### Pattern 3: Bulk Field Updates from Excel
**From `updatePlayersWithLookup.js`:**
```javascript
// Direct assignment from Excel to player records
updateColumns.forEach(column => {
    playerTable.records[i][column] = lookupData[row][column];
});
```

**Key Observation:**
- Values from Excel (including enums) are assigned DIRECTLY
- No conversion layer between Excel data and franchise file
- Assumes Excel contains **string names**, not numeric IDs

### Pattern 4: Schema-Based Enum Introspection
**From `getSchemaValues.js`:**
```javascript
// Access field metadata from schema
const fieldOffset = record._fields[actualColumnName].offset;
const { enum: enumField, isReference, type, minValue, maxValue, maxLength } = fieldOffset;

// Extract all valid enum member names
if (enumField) {
  console.log(`The field ${actualColumnName} has an enum of valid values:`);
  const csvString = '"' + enumField._members.map(member => member._name).join('","') + '"';
  console.log(csvString);
}
```

**Key Observation:**
- Enum definitions are accessible through `record._fields[fieldName].offset.enum`
- Each enum has `_members` array with `_name` property for display names
- This is madden-franchise library's schema structure

---

## Reference Field Handling

### Binary Reference Pattern
**From `FranchiseUtils.js`:**
```javascript
// Import from madden-franchise library
const { getBinaryReferenceData } = require('madden-franchise').utilService;

// Binary conversion utilities (local helpers)
function bin2Dec(binary) {
  return parseInt(binary, 2);
}

function dec2bin(dec) {
  return (dec >>> 0).toString(2);
}
```

### Reference Resolution Pattern
**From `getFtcReferences.js`:**
```javascript
// Step 1: Get binary reference from table record
const binReference = getBinaryReferenceData(currentTableId, record.index);

// Step 2: Convert to decimal (matches assetTable reference)
const assetReference = FranchiseUtils.bin2Dec(binReference);

// Step 3: Look up asset ID from asset table
const assetId = allAssets.find(obj => obj.reference === assetReference)?.assetId;

// Step 4: Convert asset ID back to binary if needed
const finalBin = FranchiseUtils.dec2bin(assetId, 2);
```

**Key Observations:**
- References are **32-bit binary values** split into:
  - First 15 bits: Table ID
  - Last 17 bits: Row index
- `getBinaryReferenceData()` is provided by madden-franchise library
- Resolution requires looking up in target table (e.g., assetTable, teamTable)

### Team Reference Example
**From `FranchiseUtils.js` (deletePlayer function):**
```javascript
// Get player's binary reference
const currentPlayerBinary = getBinaryReferenceData(playerTable.header.tableId, record.index);

// Get team's binary reference
const teamBinary = getBinaryReferenceData(teamTable.header.tableId, teamRow);

// References are compared as binary strings
if (teamRecord.MarketedPlayers === currentPlayerBinary) {
  // Update team's reference
  teamRecord.MarketedPlayers = ZERO_REF;
}
```

---

## Franchise File Operations

### Loading Franchise Files
**From `FranchiseUtils.js`:**
```javascript
function init(validYears, options = {}) {
  const Franchise = require('madden-franchise');

  // Prompt user to select file
  const filePath = selectFranchiseFileSync();

  // Load franchise file
  const franchise = new Franchise(filePath, {
    schemaOverride: true,
    autoParse: true
  });

  return franchise;
}

// Get game-specific table mappings
function getTablesObject(franchise) {
  const gameYear = parseInt(franchise.schema.meta.gameYear);

  // Route to correct table ID mapping
  if (gameYear === YEARS.M19) return tables.M19;
  if (gameYear === YEARS.M20) return tables.M20;
  // ... etc for M21-M26

  return tables.M26; // Latest
}
```

### Reading Table Records
**From `FranchiseUtils.js`:**
```javascript
async function readTableRecords(tables) {
  // Read multiple tables in parallel
  const promises = tables.map(table => table.readRecords());
  await Promise.all(promises);
}

// Merge multiple player tables (for years with split tables)
franchise.on('ready', async function() {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const freeAgentTable = franchise.getTableByUniqueId(tables.freeAgentTable);

  await readTableRecords([playerTable, freeAgentTable]);

  // Access records directly
  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    const player = playerTable.records[i];
    // ... process player
  }
});
```

### Saving Changes
**From multiple utilities:**
```javascript
async function saveFranchiseFile(franchise) {
  await franchise.save();
  console.log("Franchise file saved successfully.");
}
```

---

## Table Relationship Patterns

### Table ID Constants
**From `FranchiseTableId.js`:**
```javascript
// Each game year has different table IDs
const M26 = {
  playerTable: 4221,
  teamTable: 4219,
  coachTable: 4213,
  ownerTable: 4217,
  characterVisualsTable: 4212,
  stadiumFtcTable: 4274,
  // ... 40+ more tables
};
```

### Accessing Related Tables
**From various utilities:**
```javascript
// Get tables using unique IDs
const tables = FranchiseUtils.getTablesObject(franchise);
const playerTable = franchise.getTableByUniqueId(tables.playerTable);
const teamTable = franchise.getTableByUniqueId(tables.teamTable);

// Access by name or ID also supported
const teamTableById = franchise.getTableById(4219);
const teamTableByName = franchise.getTableByName('Team');
```

### Relationship Navigation
**Pattern: Player -> Team**
```javascript
// Player has TeamIndex field (enum/reference)
const teamIndex = playerTable.records[i]['TeamIndex'];

// Look up team by index
const teamRecord = teamTable.records[teamIndex];
```

**Pattern: Team -> Player (via binary reference)**
```javascript
// Team has binary reference to marketed player
const playerBinaryRef = teamRecord.MarketedPlayers;

// Extract table ID and row index from 32-bit reference
const tableId = bin2Dec(playerBinaryRef.slice(0, 15));
const rowIndex = bin2Dec(playerBinaryRef.slice(15));

// Access player
const player = playerTable.records[rowIndex];
```

---

## Comparison to madden-franchise-editor

### Similarities
1. **Both use madden-franchise library** (bep713)
   - Sinthros: v4.1.2
   - madden-franchise-editor: v3.8.0 (we use this)

2. **Both rely on schema-based enum handling**
   - NO custom enum conversion logic
   - Read/write enum fields as strings
   - Library handles binary encoding

3. **Both use getBinaryReferenceData() for references**
   - Imported from madden-franchise library
   - Same 32-bit reference format (15-bit table ID + 17-bit row index)

### Differences

| Aspect | Sinthros | madden-franchise-editor (us) |
|--------|----------|------------------------------|
| **Version** | madden-franchise v4.1.2 | madden-franchise v3.8.0 |
| **Architecture** | CLI utilities (62 scripts) | Electron GUI app |
| **Data Input** | Excel/CSV files | Interactive grid editing |
| **Target Users** | Developers/scripters | End users (non-technical) |
| **Game Years** | M19-M26 (all years) | M24-M26 focus |
| **Table IDs** | Separate constants per year | Needs game year detection |

### Better Approach Analysis

**Sinthros Advantages:**
- ✅ **Simpler code** - Direct string assignment for enums
- ✅ **No conversion layer** - Let library handle binary encoding
- ✅ **Excel-friendly** - Users can prepare data in spreadsheets
- ✅ **Well-documented** - 62+ working examples

**Our Advantages:**
- ✅ **GUI interface** - More accessible to casual users
- ✅ **Real-time validation** - Handsontable for data editing
- ✅ **Visual feedback** - See changes immediately
- ✅ **Portrait integration** - Player photo display

---

## Code Examples We Can Learn From

### Example 1: Simple Enum Field Update
```javascript
// NO lookup tables needed - just assign strings directly
playerTable.records[i]['Position'] = 'QB';
playerTable.records[i]['College'] = 'Alabama';
playerTable.records[i]['State'] = 'Alabama';
playerTable.records[i]['TraitDevelopment'] = 'SuperStar';
```

### Example 2: Reading Enum Members from Schema
```javascript
// Get all valid values for an enum field
const fieldOffset = record._fields['College'].offset;
const enumField = fieldOffset.enum;

// Extract all college names
const allColleges = enumField._members.map(member => member._name);
// Returns: ['Alabama', 'Auburn', 'LSU', ...]
```

### Example 3: Binary Reference Utilities
```javascript
// Helper functions (local - not in madden-franchise)
function bin2Dec(binary) {
  return parseInt(binary, 2);
}

function dec2bin(dec) {
  return (dec >>> 0).toString(2);
}

// Usage with madden-franchise's getBinaryReferenceData
const { getBinaryReferenceData } = require('madden-franchise').utilService;
const binRef = getBinaryReferenceData(tableId, rowIndex);
const decimalRef = bin2Dec(binRef);
```

### Example 4: Multi-Table Operations
```javascript
// Read multiple tables in parallel
const playerTable = franchise.getTableByUniqueId(tables.playerTable);
const teamTable = franchise.getTableByUniqueId(tables.teamTable);

await Promise.all([
  playerTable.readRecords(),
  teamTable.readRecords()
]);

// Now both tables are ready to use
```

---

## Key Findings for Our Implementation

### 1. Enum Handling Strategy
**Current Approach (Complex):**
- We might be building custom enum lookup tables
- Converting between numeric IDs and display names manually
- Maintaining separate mapping files

**Recommended Approach (Simple):**
```javascript
// JUST USE STRINGS - madden-franchise handles everything
player['College'] = 'Alabama';  // ✅ This works!
player['State'] = 'Alabama';    // ✅ This works!
player['Position'] = 'QB';       // ✅ This works!

// Read values as strings
const college = player['College'];  // Returns: 'Alabama'
```

### 2. Schema Introspection
**We can dynamically build dropdowns:**
```javascript
// Get enum members for any field
function getEnumValues(table, fieldName) {
  const record = table.records[0];
  const fieldOffset = record._fields[fieldName].offset;

  if (fieldOffset.enum) {
    return fieldOffset.enum._members.map(m => m._name);
  }
  return [];
}

// Usage:
const colleges = getEnumValues(playerTable, 'College');
// Build dropdown in Handsontable with these values
```

### 3. Field Type Detection
**Auto-detect field types for validation:**
```javascript
function getFieldType(table, fieldName) {
  const record = table.records[0];
  const fieldOffset = record._fields[fieldName].offset;

  if (fieldOffset.enum) return 'enum';
  if (fieldOffset.isReference) return 'reference';
  if (fieldOffset.type === 'bool') return 'boolean';
  if (fieldOffset.type === 'string') return 'string';
  if (['int', 's_int', 'uint', 'float'].includes(fieldOffset.type)) {
    return 'number';
  }
  return 'unknown';
}
```

### 4. Reference Field Handling
**Keep it simple for now:**
```javascript
// TeamIndex is actually an enum (0-32), not a binary reference
player['TeamIndex'] = 0;  // Cardinals
player['TeamIndex'] = 32; // Free Agent

// For TRUE binary references (e.g., MarketedPlayers):
const { getBinaryReferenceData } = require('madden-franchise').utilService;
const binRef = getBinaryReferenceData(tableId, rowIndex);
```

---

## Recommendations

### Immediate Actions

1. **Simplify Enum Handling**
   - Remove custom enum lookup tables (if we built any)
   - Use string values directly for College, State, Position fields
   - Trust madden-franchise library to handle conversion

2. **Use Schema Introspection**
   - Build dropdown options from `enum._members`
   - Auto-detect field types from schema
   - Validate input based on schema constraints

3. **Verify Our Library Version**
   - We use madden-franchise v3.8.0
   - Sinthros uses v4.1.2
   - Check if enum handling differs between versions
   - Consider updating if v4.1.2 is stable

4. **Test String Assignment**
   - Create test script that writes enum fields as strings
   - Load in Madden 26 to verify data is correct
   - Compare with numeric ID approach (if we have one)

### Code Cleanup Opportunities

1. **Remove complexity:**
   - Delete custom enum conversion functions
   - Remove lookup JSON files for enums (College, State, etc.)
   - Simplify field update logic

2. **Add schema utilities:**
   ```javascript
   // src/main/services/schema-service.ts
   export function getEnumValues(table: any, fieldName: string): string[] {
     const record = table.records[0];
     const fieldOffset = record._fields[fieldName]?.offset;
     return fieldOffset?.enum?._members.map(m => m._name) || [];
   }

   export function getFieldConstraints(table: any, fieldName: string) {
     const record = table.records[0];
     const fieldOffset = record._fields[fieldName]?.offset;
     return {
       type: fieldOffset.type,
       isEnum: !!fieldOffset.enum,
       isReference: fieldOffset.isReference,
       minValue: fieldOffset.minValue,
       maxValue: fieldOffset.maxValue,
       maxLength: fieldOffset.maxLength
     };
   }
   ```

3. **Update field definitions:**
   ```javascript
   // src/renderer/data/field-definitions.js
   // BEFORE: Manual type definitions
   { field: 'College', type: 'dropdown', source: collegeList }

   // AFTER: Schema-driven (populated at runtime)
   { field: 'College', type: 'enum' }  // Auto-populate from schema
   ```

### Testing Strategy

1. **Create test script:**
   ```javascript
   // test-enum-string-assignment.js
   const Franchise = require('madden-franchise');

   const franchise = new Franchise('path/to/franchise');

   franchise.on('ready', async () => {
     const playerTable = franchise.getTableByUniqueId(4221);
     await playerTable.readRecords();

     // Test: Assign enum as string
     playerTable.records[0]['College'] = 'Alabama';
     playerTable.records[0]['State'] = 'Alabama';
     playerTable.records[0]['Position'] = 'QB';

     // Save and verify
     await franchise.save();

     // Reload and check
     await playerTable.readRecords();
     console.log('College:', playerTable.records[0]['College']); // Should be 'Alabama'
   });
   ```

2. **Verify in Madden 26:**
   - Load modified franchise file
   - Check player page shows correct College/State/Position
   - Verify no corruption or errors

---

## Comparison Summary

| Feature | Sinthros Approach | Our Current Approach | Recommended |
|---------|-------------------|----------------------|-------------|
| **Enum Values** | String names | Unknown (needs research) | **String names** |
| **Conversion Logic** | None (library handles it) | May have custom logic | **Remove custom logic** |
| **Schema Access** | Uses `enum._members` | May hardcode lists | **Use schema** |
| **Reference Fields** | `getBinaryReferenceData()` | Needs research | **Use library function** |
| **Field Types** | Auto-detect from schema | May hardcode types | **Use schema** |

---

## Conclusion

**Sinthros/madden-franchise-utils demonstrates that enum handling is MUCH SIMPLER than we might have thought:**

1. ✅ **No conversion needed** - Write strings, read strings
2. ✅ **madden-franchise handles it** - Binary encoding is transparent
3. ✅ **Schema provides metadata** - Enum members, constraints, types
4. ✅ **62+ working utilities** - Proven pattern across many use cases

**Next Steps:**
1. Verify our madden-franchise v3.8.0 has same enum behavior
2. Simplify our enum handling if we built custom conversion
3. Use schema introspection for dropdowns and validation
4. Test string assignment in actual M26 franchise file

**Files to Review in Our Codebase:**
- Check if we have custom enum lookup files
- Review how franchise-handlers.ts reads/writes player fields
- Verify lookup-service.ts isn't doing unnecessary conversions
- Test if string assignment already works in our version

---

## References

- **Repository:** https://github.com/Sinthros/madden-franchise-utils
- **Library:** madden-franchise v4.1.2 by bep713
- **Key Files Analyzed:**
  - `Utils/FranchiseUtils.js` (128KB)
  - `massTraitEdit/massTraitEdit.js`
  - `getSchemaValues/getSchemaValues.js`
  - `updatePlayersWithLookup/updatePlayersWithLookup.js`
  - `getFtcReferences/getFtcReferences.js`
