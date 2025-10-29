# Draft Class Integration Research

**Date:** 2025-10-27
**Purpose:** Research existing draft class editor implementation for integration with franchise editor
**Status:** Complete

---

## Executive Summary

The Madden Editor Suite contains a fully functional draft class parsing and editing system that operates on standalone draft class files (FBCHUNKS format). This research documents the architecture, key files, methods, and data structures to enable integration with the franchise editor.

### Key Findings

1. **Two Separate Formats:**
   - **Standalone Draft Class Files:** FBCHUNKS format (M25 uses gzip, M26 uses zstd)
   - **Franchise-Embedded Draft Classes:** TDB/TDB2 format within franchise save files (Player table)

2. **Standalone Draft Class System is Fully Implemented:**
   - Complete read/write support for both M25 and M26 formats
   - IPC handlers for load, save, validate, export, convert operations
   - TypeScript service layer (DraftClassService)
   - Specialized parsers for M25 and M26 with different binary structures

3. **Franchise Draft Class System is NOT Implemented:**
   - No dedicated handlers for editing draft classes within franchise files
   - No UI for franchise draft class editing
   - Franchise handlers only support generic Player table updates
   - Would require madden-franchise library integration

---

## Architecture Overview

### System Flow

```
Renderer (UI)
    ↓ (IPC)
Draft Class Handlers (draft-class-handlers.ts)
    ↓
DraftClassService (DraftClassService.ts)
    ↓
Version Detection → M25 or M26?
    ↓                    ↓
M25: madden-draft-class-tools    M26: Custom Parser/Writer
    (npm package)                (M26Parser.js, M26Writer.js)
    ↓                    ↓
FileParser + Decompressor (gzip/zstd)
    ↓
Binary Draft Class File (FBCHUNKS format)
```

---

## File Locations and Purposes

### 1. Core Parser Infrastructure

#### `src/main/lib/draft-class/DraftClassParser.js`
**Purpose:** Main API for reading and writing draft class files
**Key Methods:**
- `readDraftClass(input: string|Buffer): Object` - Parse draft class file
- `writeDraftClass(draftClass, outputPath)` - NOT IMPLEMENTED (throws error)
- `validateDraftClass(input): Object` - Check file format validity
- `getDraftClassInfo(input): Object` - Get metadata without full parse
- `exportToJSON(input, outputPath)` - Export to JSON
- `getAttributeDefinitions(): Object` - Get UI field definitions

**Dependencies:**
- FileParser - Binary buffer parsing
- Decompressor - gzip/zstd decompression
- draftClassFunctions - Prospect parsing logic

**Data Returned:**
```javascript
{
  header: {
    signature: 'FBCHUNKS',
    version: number,
    year: number,
    product: string,
    gameVersion: 'M25'|'M26',
    compressionType: 'gzip'|'zstd'|'none',
    dataStartOffset: number
  },
  prospects: Array<Prospect>,
  meta: {
    fileSize: number,
    prospectCount: number,
    estimatedProspects: number,
    compressionDetected: string
  }
}
```

#### `src/main/lib/draft-class/draftClassFunctions.js`
**Purpose:** Low-level prospect parsing and binary structure definitions
**Key Methods:**
- `parseHeader(parser: FileParser): Object` - Parse FBCHUNKS header
- `parseProspects(parser, header): Array` - Parse all prospects in file
- `parseProspect(parser, index): Object` - Parse single 4322-byte prospect record (M25)
- `parseVisualData(visualData: Buffer): Object` - Parse JSON appearance data
- `parseAttributeData(attributeData: Buffer): Object` - Parse 226-byte binary attributes
- `detectMaddenVersion(header): number` - Detect game version (25, 26, etc.)

**Format Constants:**
```javascript
const MAX_ENTRY_SIZE = 0x10E2;        // 4322 bytes per player (M25)
const MAX_VISUALS_SIZE = 0x1000;      // 4096 bytes per visual JSON
const MAX_PLAYER_DATA_SIZE = 0xE2;    // 226 bytes per player attributes

// String field lengths
const FIRST_NAME = 0x11;   // 17 bytes
const LAST_NAME = 0x15;    // 21 bytes
const HOME_TOWN = 0x1B;    // 27 bytes
const ASSET_NAME = 0x2A;   // 42 bytes
```

**Prospect Structure (M25):**
```
[0x0000 - 0x0FFF] Visual JSON data (4096 bytes, gzip compressed)
[0x1000 - 0x10E1] Binary attribute data (226 bytes)
Total: 4322 bytes per prospect
```

**Attribute Parsing (Sequential Binary Reads):**
```javascript
// Personal info (strings)
firstName (17 bytes)
lastName (21 bytes)
homeState (1 byte)
homeTown (27 bytes)

// Demographics
college (2 bytes uint16)
birthDate (2 bytes uint16)
age (1 byte)
heightInches (1 byte)
weight (2 bytes uint16, offset by 160)

// Position/draft
position (1 byte)
archetype (1 byte)
jerseyNum (1 byte)
draftable (1 byte)
draftPick (2 bytes uint16)
draftRound (1 byte)

// Ratings (all 1 byte each, sequential)
overall, acceleration, agility, awareness, ballCarrierVision,
blockShedding, breakSack, breakTackle, carrying, catching,
catchInTraffic, changeOfDirection, finesseMoves, hitPower,
impactBlocking, injury, jukeMove, jumping, kickAccuracy,
kickPower, kickReturn, leadBlock, manCoverage, passBlockFinesse,
passBlockPower, passBlock, personality, playAction, playRecognition,
powerMoves, pressCoverage, pursuit, release, shortRouteRunning,
mediumRouteRunning, deepRouteRunning, runBlockFinesse, runBlockPower,
runBlock, runningStyle, spectacularCatch, speed, spinMove, stamina,
stiffArm, strength, tackle, throwAccuracyDeep, throwAccuracyMid,
throwAccuracy, throwAccuracyShort, throwOnTheRun, throwPower,
throwUnderPressure, toughness, trucking, zoneCoverage, morale

// Traits (all 1 byte each)
26 trait fields

// Other attributes
devTrait (1 byte)
traitPredictability (1 byte)
unkByte2 (1 byte)
genericHead (2 bytes uint16)
handedness (2 bytes uint16)
portraitId (2 bytes uint16)
qbStyle, qbStance, unk3-6, visMoveType, unk8 (all 1 byte)
commentaryId (2 bytes uint16)
assetName (42 bytes string)
```

#### `src/main/lib/draft-class/M26Parser.js`
**Purpose:** Madden 26-specific parser (different binary structure than M25)
**Key Methods:**
- `parseM26Prospects(buffer, header): Array` - Parse M26 prospects
- `parseM26AttributeData(attributeData): Object` - Parse M26 binary attributes

**M26 Differences:**
```javascript
const BLOCK_SIZE = 4296;              // 4296 bytes per prospect (not 4322!)
const ATTRIBUTE_OFFSET = 0x1000;      // Attributes at +4096 offset
const totalProspects = 402;           // Fixed capacity in M26

// M26 uses different byte offsets for attributes
// Examples:
speed: 0x7B (not sequential like M25)
throwPower: 0x86
injury: 0x60
PID (portraitId): 0x92 (uint16LE)

// M26 header starts at 0x46 (not 0x4C like M25)
```

**M26 Structure:**
```
Each prospect = exactly ONE 4296-byte block:
[0x0000 - 0x0FFF] Visual JSON (uncompressed or zstd)
[0x1000 - 0x10E1] Binary attributes (226 bytes, DIFFERENT offsets than M25)
```

**Key M26 Fields:**
- `PID` - Portrait ID (uint16 at offset 0x92)
- `PEPS` - Player Equipment Preset System (from visuals.genericHeadName or visuals.assetName)
- Binary assetName field at offset 0x9E (42 bytes) for real player assets

#### `src/main/lib/draft-class/M26Writer.js`
**Purpose:** Write prospect data to M26 binary format
**Key Methods:**
- `writeM26DraftClass(originalBuffer, prospects, header): Buffer` - Main writer
- `writeM26AttributeData(buffer, offset, prospect)` - Write binary attributes
- `updateM26VisualJSON(buffer, blockStart, prospect)` - Update JSON visuals

**Writing Strategy:**
1. Copy original buffer to preserve structure
2. For each prospect:
   - Write binary attributes at block_start + 0x1000
   - Update visual JSON if PEPS/bodyType changed
   - Handle real vs generic assets differently
3. Return modified buffer

**PEPS Handling:**
```javascript
// Generic assets (e.g., "gen_7_B_G_005")
// → Write to visuals.genericHeadName in JSON

// Real player assets (e.g., "WilliamsCaleb_14500")
// → Write to binary assetName field at offset 0x9E (42 bytes)
// → Keep genericHeadName as fallback
```

#### `src/main/lib/draft-class/M25toM26Converter.js`
**Purpose:** Convert M25 draft class files to M26 format
**Key Method:**
- `convertM25toM26(inputPath, outputPath, templatePath): Object`

**Conversion Strategy:**
1. Parse M25 file using madden-draft-class-tools
2. Load M26 template file (user-provided)
3. Map M25 fields to M26 format:
   - `portraitId` → `PID`
   - `assetName` → `PEPS`
4. Overwrite template's prospect data using M26Writer
5. Save as M26 file

**Why Template Required:**
- Avoids compression/format issues
- Ensures valid M26 structure
- Only modifies prospect data, preserves file structure

#### `src/main/lib/draft-class/FileParser.js`
**Purpose:** Binary buffer parsing utility with offset tracking
**Key Methods:**
- `readBytes(length): Buffer` - Read raw bytes
- `readByte(): number` - Read uint8
- `readUShort(bigEndian?): number` - Read uint16
- `readUInt(bigEndian?): number` - Read uint32
- `readSizedString(length, encoding?): string` - Read fixed-length string
- `readNullTerminatedString(encoding?): string` - Read until null byte
- `canRead(length): boolean` - Check if bytes available
- `pad(alignment)` - Align offset to boundary

**Usage Pattern:**
```javascript
const parser = new FileParser(buffer);
const firstName = parser.readSizedString(0x11); // Auto-advances offset
const age = parser.readByte(); // Auto-advances offset
```

#### `src/main/lib/draft-class/Decompressor.js`
**Purpose:** Handle gzip (M25) and zstd (M26) decompression
**Key Methods:**
- `detectCompression(buffer): string` - Returns 'gzip', 'zstd', or 'none'
- `decompress(compressedData, compressionType?): Buffer` - Auto-detect and decompress
- `decompressGzip(compressedData): Buffer` - M25 decompression
- `decompressZstd(compressedData): Buffer` - M26 decompression (uses fzstd)
- `compressGzip(data): Buffer` - For writing M25 files
- `compressZstd(data): Buffer` - For writing M26 files (uses fzstd)

**Magic Bytes:**
```javascript
GZIP_MAGIC = [0x1F, 0x8B]
ZSTD_MAGIC = [0x28, 0xB5, 0x2F, 0xFD]
```

---

### 2. Service Layer

#### `src/main/services/DraftClassService.ts`
**Purpose:** High-level draft class operations, version detection, orchestration
**Key Methods:**

**Load:**
- `loadDraftClass(filePath: string): Promise<any>`
  - Auto-detects M25 vs M26
  - Routes to appropriate parser
  - Returns unified data structure with `_originalBuffer` and `_version`

**Save:**
- `saveDraftClass(filePath: string, draftClassData: any): Promise<boolean>`
  - Uses `_version` field to determine format
  - M25: Uses madden-draft-class-tools writer
  - M26: Uses M26Writer

**Validation:**
- `validateDraftClass(filePath: string): Promise<any>`
  - Checks FBCHUNKS signature
  - Detects version
  - Returns validation result

**Info:**
- `getDraftClassInfo(filePath: string): Promise<any>`
  - Returns metadata without full parse
  - Includes prospect count, version, file size

**Export:**
- `exportToJSON(filePath: string, outputPath: string): Promise<boolean>`
  - Parses draft class and writes JSON

**Convert:**
- `convertM25toM26(inputPath, outputPath, templatePath): Promise<any>`
  - Converts M25 to M26 using template

**Version Detection:**
```javascript
function detectMaddenVersion(filePath: string): 'M25' | 'M26' | 'unknown' {
  // Read fileName field at offset 0x22
  // Check for "Madden-25" or "Madden-26"
}
```

**Field Mapping (M25 → Unified):**
```javascript
// M25 uses different field names
portraitId → PID
assetName → PEPS (with fallback to visuals.genericHeadName)
```

---

### 3. IPC Layer

#### `src/main/ipc/draft-class-handlers.ts`
**Purpose:** IPC communication between renderer and draft class service
**Registered Handlers:**

**load:**
```typescript
ipcMain.handle('draft-class:load', async (event, filePath: string) => {
  const result = await draftClassService.loadDraftClass(filePath);
  return { success: true, data: result.data };
});
```

**save:**
```typescript
ipcMain.handle('draft-class:save', async (event, savePath: string, draftClassData: any) => {
  await draftClassService.saveDraftClass(savePath, draftClassData);
  return { success: true };
});
```

**export-json:**
```typescript
ipcMain.handle('draft-class:export-json', async (event, filePath: string, outputPath: string) => {
  await draftClassService.exportToJSON(filePath, outputPath);
  return { success: true };
});
```

**validate:**
```typescript
ipcMain.handle('draft-class:validate', async (event, filePath: string) => {
  return await draftClassService.validateDraftClass(filePath);
});
```

**get-info:**
```typescript
ipcMain.handle('draft-class:get-info', async (event, filePath: string) => {
  return await draftClassService.getDraftClassInfo(filePath);
});
```

**convert-m25-to-m26:**
```typescript
ipcMain.handle('draft-class:convert-m25-to-m26', async (event, inputPath, outputPath, templatePath) => {
  return await draftClassService.convertM25toM26(inputPath, outputPath, templatePath);
});
```

**Registered in:** `src/main.ts` line 28: `import './main/ipc/draft-class-handlers';`

---

### 4. Type Definitions

#### `src/shared/types/draft-class.ts`
**Purpose:** TypeScript interfaces for draft class data structures

**Key Interfaces:**

**Prospect:**
```typescript
interface Prospect {
  // Position
  index: number;
  offset: number;

  // Visuals (JSON)
  visuals: ProspectVisuals | null;

  // Personal
  firstName: string;
  lastName: string;
  homeState: number;
  homeTown: string;
  college: number;
  birthDate: number;
  age: number;
  heightInches: number;
  weight: number;

  // Draft
  position: number;
  archetype: number;
  jerseyNum: number;
  draftable: number;
  draftPick: number;
  draftRound: number;

  // Ratings (60 attributes)
  overall: number;
  speed: number;
  acceleration: number;
  strength: number;
  awareness: number;
  // ... 55 more rating fields

  // Traits (26 fields)
  traitBigHitter: number;
  traitClutch: number;
  // ... 24 more trait fields

  // Other
  devTrait: number;
  genericHead: number;
  handedness: number;
  portraitId: number;
  qbStyle: number;
  qbStance: number;
  visMoveType: number;
  commentaryId: number;
  assetName: string;
}
```

**DraftClassHeader:**
```typescript
interface DraftClassHeader {
  signature: string;          // "FBCHUNKS"
  version: number;            // Header version
  year: number;               // Draft year
  product: string;            // "Madden-25", "Madden-26", etc.
  gameVersion: number | null; // 25, 26, etc.
  compressionType: string;    // 'gzip', 'zstd', 'none'
  dataStartOffset: number;    // Where prospect data begins
}
```

**DraftClassData:**
```typescript
interface DraftClassData {
  header: DraftClassHeader;
  prospects: Prospect[];
  meta: {
    fileSize: number;
    prospectCount: number;
    estimatedProspects: number;
    compressionDetected: string;
  };
}
```

**AttributeDefinition:**
```typescript
interface AttributeDefinition {
  key: string;           // 'firstName', 'speed', etc.
  label: string;         // Display label
  type: string;          // 'string', 'number', 'boolean'
  min?: number;          // Min value
  max?: number;          // Max value
  category?: string;     // Grouping
  editable?: boolean;    // Is editable?
  description?: string;  // Help text
}
```

---

### 5. Preload API

#### `src/preload.ts`
**Draft Class API Exposed to Renderer:**

```typescript
draftClass: {
  load: (filePath) => ipcRenderer.invoke('draft-class:load', filePath),
  save: (savePath, draftClassData) => ipcRenderer.invoke('draft-class:save', savePath, draftClassData),
  exportJSON: (filePath, outputPath) => ipcRenderer.invoke('draft-class:export-json', filePath, outputPath),
  validate: (filePath) => ipcRenderer.invoke('draft-class:validate', filePath),
  getInfo: (filePath) => ipcRenderer.invoke('draft-class:get-info', filePath),
  getAttributeDefinitions: () => ipcRenderer.invoke('draft-class:get-attribute-defs'),
  convertM25toM26: (inputPath, outputPath, templatePath) =>
    ipcRenderer.invoke('draft-class:convert-m25-to-m26', inputPath, outputPath, templatePath)
}
```

**Usage in Renderer:**
```javascript
// Load draft class
const result = await window.electronAPI.draftClass.load(filePath);
if (result.success) {
  const { header, prospects } = result.data;
}

// Save draft class
await window.electronAPI.draftClass.save(savePath, draftClassData);
```

---

## Data Structures and Field Mappings

### Prospect Field Count
- **Total attributes per prospect:** 115+ fields
- **Personal info:** 9 fields (name, age, hometown, college, etc.)
- **Draft info:** 6 fields (position, round, pick, etc.)
- **Ratings:** 60 fields (speed, strength, awareness, etc.)
- **Traits:** 26 fields (big hitter, clutch, etc.)
- **Other:** 14 fields (dev trait, portrait, handedness, etc.)
- **Visuals:** JSON object with appearance data

### File Format Comparison

| Aspect | M25 | M26 |
|--------|-----|-----|
| Block Size | 4322 bytes | 4296 bytes |
| Visual Data | 4096 bytes (gzip) | 4096 bytes (zstd/uncompressed) |
| Attribute Data | 226 bytes | 226 bytes |
| Attribute Offsets | Sequential | Non-sequential |
| Header Start | 0x4C | 0x46 |
| Max Prospects | Variable | 402 (fixed) |
| Compression | gzip | zstd |
| Portrait Field | portraitId | PID |
| Asset Field | assetName (in binary) | PEPS (in JSON + binary) |

### Key Field Mappings

**M25 → M26:**
```javascript
// Portrait handling
M25: prospect.portraitId (uint16 in binary)
M26: prospect.PID (uint16 at offset 0x92)

// Asset/face handling
M25: prospect.assetName (42-byte string in binary)
     prospect.visuals.genericHeadName (in JSON)
M26: prospect.PEPS (can be in visuals.genericHeadName OR visuals.assetName)
     Binary assetName field at 0x9E (42 bytes) for real players
     visuals.genericHeadName for generic faces
```

---

## Integration Points for Franchise Editor

### Current State
- **Franchise handlers:** `src/main/ipc/franchise-handlers.ts`
- **Player table access:** Exists, supports generic updates
- **Draft class access:** NOT implemented

### What's Needed for Franchise Draft Class Editing

1. **Use madden-franchise Library:**
   - Already available: `node_modules/madden-franchise@3.8.0`
   - Parse franchise files, access Player table
   - Filter players where `YearsPro = 0` or `DraftClass = current/future`

2. **New IPC Handlers:**
   ```typescript
   // In franchise-handlers.ts
   ipcMain.handle('franchise:get-draft-prospects', async (event, filePath) => {
     // 1. Load franchise file using madden-franchise
     // 2. Get Player table
     // 3. Filter for draft prospects (YearsPro = 0)
     // 4. Return prospect array
   });

   ipcMain.handle('franchise:update-draft-prospect', async (event, filePath, prospectId, updates) => {
     // 1. Load franchise file
     // 2. Find player record by ID
     // 3. Update fields
     // 4. Save franchise file
   });
   ```

3. **Field Mapping:**
   - Franchise Player table fields may differ from standalone draft class
   - Need to map FBCHUNKS field names → Franchise field names
   - Example: `portraitId` → `PLYR_PORTRAIT`

4. **UI Integration:**
   - Add "Draft Class" tab to franchise editor
   - Use same Handsontable grid as standalone editor
   - Filter Player table to show only draft prospects

5. **Gotchas:**
   - Franchise files use TDB/TDB2 format (NOT FBCHUNKS)
   - Field names and offsets completely different
   - Must use madden-franchise library's schema system
   - Cannot reuse M25/M26 parsers for franchise files

---

## Important Notes and Gotchas

### 1. Write Support Limitation
**Standalone draft class writing:**
- M25: Uses `madden-draft-class-tools` npm package (write supported)
- M26: Uses custom M26Writer (write supported)
- CRITICAL: Must preserve original buffer when saving M26 files

**`DraftClassParser.writeDraftClass()` NOT IMPLEMENTED:**
```javascript
function writeDraftClass(draftClass, outputPath) {
  throw new Error('writeDraftClass not yet implemented - requires precise binary serialization');
}
```
Instead, use:
- M25: DraftClassService calls madden-draft-class-tools
- M26: DraftClassService calls M26Writer

### 2. Version Detection is Critical
```javascript
// Service detects version BEFORE parsing
const version = detectMaddenVersion(filePath);
if (version === 'M25') {
  // Use madden-draft-class-tools
} else if (version === 'M26') {
  // Use M26Parser
}
```

### 3. Data Preservation
When saving, must preserve:
- Original buffer structure (`_originalBuffer`)
- Version info (`_version`)
- All unchanged prospect data
- File header

### 4. PEPS (Player Equipment Preset System)
Complex handling in M26:
- Generic faces: `"gen_7_B_G_005"` → visuals.genericHeadName
- Real players: `"WilliamsCaleb_14500"` → binary assetName field (offset 0x9E)
- M26Writer checks if asset starts with "GEN_" to decide where to write

### 5. JSON Size Constraints
M26 visual JSON must fit in 4096-byte space:
- Original JSON + null padding = available space
- New JSON must not exceed this space
- M26Writer validates size before writing

### 6. Attribute Offset Differences
M25 uses sequential byte reads, M26 uses specific offsets:
```javascript
// M25 (sequential)
overall = parser.readByte();      // Next byte
acceleration = parser.readByte(); // Next byte

// M26 (specific offsets)
overall = attributeData[0x??];    // Unknown offset
acceleration = attributeData[0x52]; // Fixed offset
```

### 7. No Standalone Draft Class UI
- No dedicated HTML file for draft class editor
- All functionality is backend (parsers, services, IPC)
- UI would need to be added for standalone editor
- Franchise editor UI already exists but doesn't support draft classes

### 8. Franchise vs Standalone Formats
**DO NOT MIX:**
- Standalone: FBCHUNKS format, parsed by DraftClassParser
- Franchise: TDB/TDB2 format, parsed by madden-franchise library
- Field names, offsets, structures are completely different

---

## Usage Examples

### Load Draft Class
```javascript
// Renderer code
const result = await window.electronAPI.draftClass.load(filePath);
if (result.success) {
  const { header, prospects } = result.data;
  console.log(`Loaded ${prospects.length} prospects`);
  console.log(`Game: ${header.product}, Year: ${header.year}`);

  prospects.forEach(p => {
    console.log(`${p.firstName} ${p.lastName} - ${p.position} - ${p.overall} OVR`);
  });
}
```

### Save Draft Class
```javascript
// Renderer code - must pass ENTIRE draftClassData object
// Including _originalBuffer and _version fields
await window.electronAPI.draftClass.save(savePath, draftClassData);
```

### Convert M25 to M26
```javascript
const result = await window.electronAPI.draftClass.convertM25toM26(
  'path/to/m25-draft.dat',
  'path/to/output-m26.dat',
  'path/to/m26-template.dat'
);

if (result.success) {
  console.log(`Converted ${result.prospectCount} prospects`);
}
```

### Validate File
```javascript
const validation = await window.electronAPI.draftClass.validate(filePath);
if (validation.valid) {
  console.log(`Valid draft class: ${validation.version}`);
} else {
  console.error(`Invalid: ${validation.error}`);
}
```

---

## Dependencies

### NPM Packages
- `madden-draft-class-tools@latest` - M25 draft class reading/writing
- `fzstd` - Pure JS zstd compression for M26
- `zlib` (built-in Node.js) - gzip compression for M25

### Internal Dependencies
- `madden-franchise@3.8.0` - For franchise file parsing (NOT used for standalone draft classes)
- FileParser, Decompressor, M26Parser, M26Writer (custom implementations)

---

## Next Steps for Franchise Integration

1. **Research madden-franchise Player Table Schema:**
   - Document Player table field names for M25 and M26
   - Map standalone field names to franchise field names
   - Identify draft-specific fields (YearsPro, DraftClass, etc.)

2. **Implement Franchise Draft Class Handlers:**
   - Add handlers to `franchise-handlers.ts`
   - Filter Player table for draft prospects
   - Support CRUD operations on prospects

3. **Create Field Mapping Service:**
   - Map FBCHUNKS ↔ Franchise field names
   - Handle enum conversions (position codes, etc.)
   - Support version differences (M25 vs M26)

4. **Add UI Tab to Franchise Editor:**
   - Add "Draft Class" tab to `franchise-editor.html`
   - Reuse Handsontable grid from main editor
   - Filter view to show only draft prospects

5. **Testing:**
   - Test with real franchise files
   - Verify field mappings are correct
   - Ensure saves don't corrupt franchise data

---

## File Reference Quick List

### Core Files (Standalone Draft Class)
- `src/main/lib/draft-class/DraftClassParser.js` - Main parser API
- `src/main/lib/draft-class/draftClassFunctions.js` - M25 parsing logic
- `src/main/lib/draft-class/M26Parser.js` - M26 parsing logic
- `src/main/lib/draft-class/M26Writer.js` - M26 writing logic
- `src/main/lib/draft-class/M25toM26Converter.js` - Format conversion
- `src/main/lib/draft-class/FileParser.js` - Binary parsing utility
- `src/main/lib/draft-class/Decompressor.js` - Compression handling
- `src/main/services/DraftClassService.ts` - Service layer
- `src/main/ipc/draft-class-handlers.ts` - IPC handlers
- `src/shared/types/draft-class.ts` - TypeScript types
- `src/preload.ts` - Preload API (lines 46-58)

### Franchise Files (For Future Integration)
- `src/main/ipc/franchise-handlers.ts` - Franchise IPC (needs draft class support)
- `node_modules/madden-franchise/` - Franchise file parser library

### Documentation
- `docs/DRAFT_CLASS_RESEARCH.md` - Original research on draft class formats
- `docs/DRAFT_CLASS_IMPLEMENTATION_PLAN.md` - Implementation planning
- `docs/DRAFT_CLASS_INTEGRATION_STRATEGY.md` - Integration strategy
- `docs/DRAFT_CLASS_PARSE_TEST.md` - Parser testing notes
- `docs/DRAFT_CLASS_SERVICE_TEST.md` - Service testing notes

---

## Conclusion

The Madden Editor Suite has a complete, working draft class parsing and editing system for standalone FBCHUNKS files. The architecture is well-structured with clear separation of concerns (parsers → service → IPC → renderer). However, franchise-embedded draft class editing is NOT implemented and would require significant additional work using the madden-franchise library.

**For standalone draft class editing:** System is ready to use
**For franchise draft class editing:** Requires new implementation following the patterns established in the standalone system

---

**Research completed by:** Claude Code
**Session:** 2025-10-27
**File count analyzed:** 12 core files + 5 documentation files
**Lines of code reviewed:** ~3000+ lines
