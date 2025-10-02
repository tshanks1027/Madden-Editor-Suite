# Draft Class Implementation Plan

## Executive Summary

This document outlines the implementation plan for adding draft class editing capabilities to the Madden Editor Suite. Based on analysis of the CAREERDRAFT-2026DRAFT7RND file and research into available tools, we have identified the file format structure and determined the best approach for implementation.

## File Analysis Results

### TASK 1: CAREERDRAFT File Analysis

**File Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\Madden Files\CAREERDRAFT-2026DRAFT7RND`

**File Size**: 1,954,750 bytes (1.9 MB)

#### File Format Identification

The file uses the **FBCHUNKS** format, a container format used by EA Sports for Madden 26 draft class files.

**Header Structure** (52 bytes):
```
Offset  Size  Type      Description
------  ----  --------  -----------
0x00    8     ASCII     Signature: "FBCHUNKS"
0x08    1     uint8     Version: 1
0x09    1     uint8     Flags: 0
0x0A    2     uint16LE  Header size: 52 bytes
0x0C    4     padding   Reserved
0x0E    4     uint32LE  Uncompressed size: 1,954,680 bytes
0x12    4     uint32LE  Compressed size: 1,954,732 bytes
0x16    2     uint16LE  Year: 2025
0x18    8     uint8[]   Months: [8, 0, 11, 0, 12, 0, 18, 0]
0x20    4     uint32LE  CRC32: 0xc000b
0x24    12    string    Version string: "Madden-26-RL1-8310191"
```

**First 100 bytes (hex)**:
```
46 42 43 48 55 4e 4b 53 01 00 34 00 00 00 78 d3
1d 00 ac d3 1d 00 e9 07 08 00 0b 00 0c 00 12 00
1a 00 4d 61 64 64 65 6e 2d 32 36 2d 52 4c 31 2d
38 33 31 30 31 39 31 00 00 00 00 00 00 00 04 00
00 00 92 01 00 00 7b 22 62 6f 64 79 54 79 70 65
22 3a 22 48 65 61 76 79 22 2c 22 67 65 6e 65 72
69 63 48 65
```

#### Data Content Structure

**Data Section** (starts at offset 52):

The data section contains **character visual/appearance data in JSON format**, not traditional TDB2 database tables. This is a significant finding.

**Structure**:
1. A version identifier string ("191")
2. Multiple JSON objects containing player appearance data
3. Each JSON object includes:
   - `bodyType`: Player body type (e.g., "Heavy")
   - `genericHeadName`: Head model reference (e.g., "gen_5_M_M_005")
   - `loadouts`: Array of equipment loadout configurations
     - `loadoutCategory`: Equipment category (e.g., "Head")
     - `loadoutType`: Type specification
     - `loadoutElements`: Array of visual elements with tags

**Sample JSON Structure**:
```json
{
  "bodyType": "Heavy",
  "genericHeadName": "gen_5_M_M_005",
  "loadouts": [
    {
      "loadoutCategory": "Head",
      "loadoutType": "Head",
      "loadoutElements": [
        {
          "blends": [{}],
          "itemInstanceTag": "Head_SkinDetails_None",
          ...
        }
      ]
    }
  ]
}
```

#### Key Findings

1. **Not a TDB2 Database**: Unlike roster files (ROSTER-Official), the CAREERDRAFT file does NOT contain a TDB2 binary database with PLAY table
2. **No Player Table**: No PLAY, TEAM, COACH, or other traditional Madden database tables were found
3. **Visual Data Only**: The file appears to contain only character visual/appearance data for draft prospects
4. **Uncompressed Data**: Despite the header indicating "compressed size", the actual data section is NOT zlib-compressed
5. **JSON-Based**: The payload is primarily JSON-formatted appearance definitions

#### File Format Validation

Using TDBFileValidator approach:
- **Signature**: "FBCHUNKS" (0x46424348554E4B53)
- **Not Compatible With**: MaddenRosterHelper (expects TDB2 format with zlib compression)
- **Not Compatible With**: Standard TDB2Parser (no TDB2 signature found)
- **Format Type**: Custom FBCHUNKS container with JSON payload

#### Number of Players

**Unable to determine from file analysis** - The file structure does not contain a player count header. The JSON data appears to be a continuous stream of appearance definitions. To count players, we would need to:
1. Parse the entire JSON stream
2. Identify individual player appearance objects
3. Count distinct objects

**Estimated approach**: Parse JSON objects incrementally and count valid appearance definitions.

## TASK 2: ea-cdb-tools Research

**Repository**: https://github.com/WiiExpertise/ea-cdb-tools

### Overview

**Purpose**: "A tool to merge or split EA Sports combined database (CDB) files, typically used for roster and CharacterVisuals data"

**Language**: JavaScript (95.7%), Batchfile (4.3%)

**License**: Not explicitly specified in repository

### File Format Support

ea-cdb-tools supports the **CDB (Combined Database)** format used in Madden NFL 25 and newer:

- **CDB Format**: Combines TDB (player/roster data) and H2 (character visuals) into a single file
- **TDB Component**: Traditional database format (player attributes, ratings, etc.)
- **H2 Component**: Character visual data format

### CDB File Structure

**Header** (18 bytes minimum):
```
Offset  Size  Type      Description
------  ----  --------  -----------
0x00    2     ASCII     Magic bytes: "CD"
0x02    2     uint16    Version (typically 1)
0x04    4     uint32    TDB Offset
0x08    4     uint32    TDB Size
0x0C    4     uint32    H2 Offset
0x10    4     uint32    H2 Size
```

### Operations Supported

1. **Split CDB**: Extracts TDB and H2 into separate files
   - Input: CDB file
   - Output: `.db` file (TDB data) and `.h2` file (H2 visuals)

2. **Merge DB/H2**: Combines separate files back into CDB
   - Input: `.db` file and `.h2` file
   - Output: CDB file with standard header

### Key Implementation Details

**Parsing Approach**:
1. Read and validate magic bytes ('CD')
2. Check version (warns if not version 1)
3. Extract TDB offset and size from header
4. Extract H2 offset and size from header
5. Read TDB data block
6. Read H2 data block
7. Write to separate files or combine as needed

**File Operations**:
- Uses Node.js `fs` module for file I/O
- Synchronous file reading
- Buffer-based parsing
- Interactive CLI for user input

### Draft Class Support

**Not explicitly documented**. However:
- The tool mentions "roster and CharacterVisuals data"
- CDB format is used in Madden 25+
- The CAREERDRAFT file we analyzed is NOT in CDB format (uses FBCHUNKS instead)

### Applicability to Our Project

**Limited Direct Applicability**:
1. **Different Format**: CAREERDRAFT uses FBCHUNKS, not CDB format
2. **No Magic Bytes Match**: Our file starts with "FBCHUNKS", not "CD"
3. **Different Structure**: CAREERDRAFT doesn't have separate TDB/H2 sections

**Potentially Useful Concepts**:
1. **Container Pattern**: Understanding how EA packages data (header + payload sections)
2. **Split/Merge Operations**: Pattern for working with combined file formats
3. **Buffer Parsing**: Techniques for reading binary headers and extracting sections

**Code Reuse Potential**: Low - The formats are too different to directly reuse ea-cdb-tools code

### Dependencies

- Node.js runtime
- nexe (for executable creation)
- Python 3.9 and NASM (for build process only)

### Portability to JavaScript

**Already in JavaScript** - The tool is written entirely in JavaScript, so no porting needed. However, the parsing logic is specific to CDB format and would need significant modification for FBCHUNKS format.

## TASK 3: Implementation Plan

### Overall Assessment

Based on the file analysis and tool research, we have determined:

1. **CAREERDRAFT is NOT parseable with existing tools**
   - madden-file-tools (MaddenRosterHelper) cannot parse FBCHUNKS format
   - ea-cdb-tools is designed for CDB format, not FBCHUNKS
   - Standard TDB2Parser cannot handle the JSON payload structure

2. **File contains visual/appearance data only**
   - No player attributes (ratings, skills, etc.)
   - No traditional database tables
   - JSON-based character customization data

3. **Draft class functionality requires additional files**
   - CAREERDRAFT provides appearance data
   - Player attributes likely stored in a separate file or embedded in franchise saves
   - Full draft class editing requires handling multiple file types

### Key Questions Requiring Further Investigation

Before implementing draft class support, we need to answer:

1. **Where is the player attribute data?**
   - Is there a separate `.db` file with player ratings?
   - Are attributes stored in the franchise save file?
   - Does Madden 26 use a different draft class format than previous versions?

2. **What is the relationship between visual data and player data?**
   - How does the game link appearance JSON to player records?
   - Is there an ID or index system?
   - What files need to be modified together?

3. **How does draft class import work in-game?**
   - Does the game expect FBCHUNKS format?
   - Are there validation checks we need to pass?
   - What's the complete file structure for a working draft class?

### Recommended Implementation Approach

#### Phase 1: Research & Discovery (CURRENT PHASE)

**Status**: COMPLETE

**Deliverables**:
- ✅ CAREERDRAFT file format identified (FBCHUNKS)
- ✅ Data structure analyzed (JSON appearance data)
- ✅ Existing tools evaluated (madden-file-tools, ea-cdb-tools)
- ✅ Implementation plan created (this document)

#### Phase 2: FBCHUNKS Parser Development

**Goal**: Create a parser that can read and write FBCHUNKS format files

**Implementation Steps**:

1. **Create FBCHUNKSFile class** (`src/main/lib/filetypes/FBCHUNKS/FBCHUNKSFile.js`)
   ```javascript
   class FBCHUNKSFile extends File {
     constructor() {
       super();
       this.signature = 'FBCHUNKS';
       this.version = 1;
       this.headerSize = 52;
       this.uncompressedSize = 0;
       this.compressedSize = 0;
       this.year = 0;
       this.months = [];
       this.crc32 = 0;
       this.versionString = '';
       this.data = null; // JSON payload
     }
   }
   ```

2. **Create FBCHUNKSParser stream** (`src/main/lib/streams/FBCHUNKSParser.js`)
   - Read 52-byte header
   - Parse header fields
   - Extract data section
   - Parse JSON objects
   - Handle multiple JSON objects in stream

3. **Create FBCHUNKSWriter stream** (`src/main/lib/streams/FBCHUNKSWriter.js`)
   - Build 52-byte header
   - Calculate CRC32 of data
   - Write header + data
   - Update size fields

4. **Add validation** (`src/main/parsers/FileFormatDetector.js`)
   ```javascript
   function detectFormat(buffer) {
     const signature = buffer.subarray(0, 8).toString('ascii');
     if (signature === 'FBCHUNKS') {
       return 'FBCHUNKS';
     }
     // ... other formats
   }
   ```

**Code Example - Reading FBCHUNKS**:
```javascript
const fs = require('fs');

class FBCHUNKSParser {
  static parse(filePath) {
    const buffer = fs.readFileSync(filePath);

    // Parse header
    const header = {
      signature: buffer.subarray(0, 8).toString('ascii'),
      version: buffer.readUInt8(8),
      flags: buffer.readUInt8(9),
      headerSize: buffer.readUInt16LE(10),
      uncompressedSize: buffer.readUInt32LE(14),
      compressedSize: buffer.readUInt32LE(18),
      year: buffer.readUInt16LE(22),
      months: Array.from(buffer.subarray(24, 32)),
      crc32: buffer.readUInt32LE(26),
      versionString: buffer.subarray(36, 52).toString('utf8').replace(/\0/g, '')
    };

    // Extract data
    const data = buffer.subarray(header.headerSize);

    // Parse JSON objects
    const appearances = parseAppearanceData(data);

    return {
      header,
      appearances
    };
  }

  static parseAppearanceData(data) {
    // Parse JSON stream
    // Handle multiple objects
    // Return array of appearance definitions
  }
}
```

**Files to Create**:
- `src/main/lib/filetypes/FBCHUNKS/FBCHUNKSFile.js`
- `src/main/lib/streams/FBCHUNKSParser.js`
- `src/main/lib/streams/FBCHUNKSWriter.js`
- `src/main/lib/tests/unit/FBCHUNKSFile.spec.js`

**Dependencies**: None (uses built-in Node.js modules only)

#### Phase 3: Locate Player Attribute Data

**Goal**: Find where draft class player attributes (ratings, skills) are stored

**Investigation Tasks**:

1. **Check for companion files**
   - Look for `.db` files alongside CAREERDRAFT
   - Check for CDB files that might contain the draft class
   - Examine franchise save structure for embedded draft data

2. **Analyze game file structure**
   - Use Frosty Editor to inspect game files
   - Check for draft class table definitions
   - Look for schema files that define draft player structure

3. **Test import process**
   - Import the CAREERDRAFT file in-game
   - Monitor file system for created/modified files
   - Identify all files involved in draft class import

4. **Community research**
   - Check Madden modding forums (FootballIdiot, Operation Sports)
   - Look for draft class editing tools or documentation
   - Contact bep713 or other madden-franchise developers

**Expected Outcomes**:
- Location of player attribute data identified
- File format(s) for attributes documented
- Relationship between appearance and attributes understood

#### Phase 4: Draft Class Editor UI

**Goal**: Create UI for editing draft class appearance data

**Implementation Steps**:

1. **Draft Class Service** (`src/main/services/DraftClassService.ts`)
   ```typescript
   class DraftClassService {
     async loadDraftClass(filePath: string): Promise<DraftClass> {
       const file = FBCHUNKSParser.parse(filePath);
       return new DraftClass(file);
     }

     async saveDraftClass(draftClass: DraftClass, filePath: string): Promise<void> {
       const file = draftClass.toFBCHUNKSFile();
       FBCHUNKSWriter.write(file, filePath);
     }
   }
   ```

2. **IPC Handlers** (`src/main/ipc/draft-class-handlers.ts`)
   ```typescript
   ipcMain.handle('draft-class:load', async (event, filePath) => {
     return await draftClassService.loadDraftClass(filePath);
   });

   ipcMain.handle('draft-class:save', async (event, draftClass, filePath) => {
     await draftClassService.saveDraftClass(draftClass, filePath);
   });
   ```

3. **Frontend Component** (`src/renderer/components/DraftClassEditor.tsx`)
   - File selection dialog
   - Player list display (Handsontable grid)
   - Appearance data editor
   - JSON viewer/editor for raw data
   - Save functionality

4. **Field Definitions** (`src/renderer/data/draft-class-fields.js`)
   ```javascript
   export const DRAFT_CLASS_APPEARANCE_FIELDS = [
     { key: 'bodyType', label: 'Body Type', type: 'dropdown',
       options: ['Lean', 'Athletic', 'Heavy', 'Stocky'] },
     { key: 'genericHeadName', label: 'Head Model', type: 'text' },
     { key: 'skinTone', label: 'Skin Tone', type: 'number' },
     // ... more fields
   ];
   ```

**Files to Create**:
- `src/main/services/DraftClassService.ts`
- `src/main/ipc/draft-class-handlers.ts`
- `src/renderer/components/DraftClassEditor.tsx`
- `src/renderer/data/draft-class-fields.js`

**UI Mockup**:
```
+--------------------------------------------------+
| Draft Class Editor                               |
+--------------------------------------------------+
| File: CAREERDRAFT-2026DRAFT7RND              [X] |
+--------------------------------------------------+
| [Player List]                                    |
| +----------------------------------------------+ |
| | #  | Name        | Position | Body Type     | |
| +----------------------------------------------+ |
| | 1  | (Unknown)   | (Unknown)| Heavy         | |
| | 2  | (Unknown)   | (Unknown)| Athletic      | |
| | 3  | (Unknown)   | (Unknown)| Lean          | |
| +----------------------------------------------+ |
|                                                  |
| [Appearance Details]                             |
| Body Type: [Heavy         v]                     |
| Head Model: [gen_5_M_M_005]                     |
| Skin Tone: [42          ]                        |
|                                                  |
| [Equipment Loadouts]                             |
| Category: [Head] Type: [Head]                    |
| Item: [Head_SkinDetails_None]                    |
|                                                  |
| [Save] [Export JSON] [Import JSON]               |
+--------------------------------------------------+
```

#### Phase 5: Full Draft Class Support (FUTURE)

**Prerequisites**:
- Phase 3 complete (player attributes located)
- Additional file formats parsed
- Understanding of draft class import mechanism

**Implementation**:
1. Parse player attribute files (TDB2/CDB/other)
2. Link appearance data to player attributes
3. Implement full player editing (ratings, skills, bio)
4. Handle multiple file coordination
5. Validate draft class completeness
6. Test in-game import

### Files That Need to Be Created/Modified

#### New Files to Create

**FBCHUNKS Parser**:
- `src/main/lib/filetypes/FBCHUNKS/FBCHUNKSFile.js`
- `src/main/lib/filetypes/FBCHUNKS/FBCHUNKSAppearance.js`
- `src/main/lib/streams/FBCHUNKSParser.js`
- `src/main/lib/streams/FBCHUNKSWriter.js`
- `src/main/lib/tests/unit/FBCHUNKS/FBCHUNKSFile.spec.js`
- `src/main/lib/tests/unit/FBCHUNKS/FBCHUNKSParser.spec.js`

**Services**:
- `src/main/services/DraftClassService.ts`
- `src/main/ipc/draft-class-handlers.ts`

**UI Components**:
- `src/renderer/components/DraftClassEditor.tsx`
- `src/renderer/components/AppearanceEditor.tsx`
- `src/renderer/data/draft-class-fields.js`

**Tests**:
- `tests/e2e/draft-class.spec.js`
- `tests/unit/DraftClassService.spec.ts`

#### Files to Modify

**Format Detection**:
- `src/main/parsers/TDBFileValidator.js` - Add FBCHUNKS detection
- `src/main/parsers/BinaryReader.js` - Add FBCHUNKS read methods

**Main Process**:
- `src/main.ts` - Register draft class IPC handlers
- `src/preload.ts` - Expose draft class API to renderer

**UI Navigation**:
- `src/renderer/js/app.js` - Add draft class editor route
- Navigation menu - Add "Draft Class Editor" option

**Documentation**:
- `README.md` - Add draft class editing documentation
- `RELEASE_NOTES.md` - Document draft class feature

### Dependencies Needed

**No New Dependencies Required**

The FBCHUNKS format can be parsed using Node.js built-in modules:
- `fs` - File system operations
- `buffer` - Binary data handling
- JSON parsing - Built-in `JSON.parse()`

Existing dependencies cover all needs:
- Electron - IPC and file dialogs
- Handsontable - Data grid display
- TypeScript - Type safety
- Vite - Build tooling

**Optional Enhancement Dependencies**:
- `json-schema` - For validating appearance JSON structure
- `ajv` - JSON schema validator (if needed)

### Code Examples

#### Example 1: Parsing FBCHUNKS Header

```javascript
// src/main/lib/streams/FBCHUNKSParser.js

const fs = require('fs');

class FBCHUNKSParser {
  static parseHeader(buffer) {
    if (buffer.length < 52) {
      throw new Error('Buffer too small for FBCHUNKS header');
    }

    const signature = buffer.subarray(0, 8).toString('ascii');
    if (signature !== 'FBCHUNKS') {
      throw new Error(`Invalid FBCHUNKS signature: ${signature}`);
    }

    return {
      signature,
      version: buffer.readUInt8(8),
      flags: buffer.readUInt8(9),
      headerSize: buffer.readUInt16LE(10),
      padding: buffer.readUInt32LE(12),
      uncompressedSize: buffer.readUInt32LE(14),
      compressedSize: buffer.readUInt32LE(18),
      year: buffer.readUInt16LE(22),
      months: Array.from(buffer.subarray(24, 32)),
      crc32: buffer.readUInt32LE(26),
      versionString: buffer.subarray(36, 52)
        .toString('utf8')
        .replace(/\0/g, '')
        .trim()
    };
  }

  static parse(filePath) {
    const buffer = fs.readFileSync(filePath);
    const header = this.parseHeader(buffer);
    const data = buffer.subarray(header.headerSize);

    return {
      header,
      data
    };
  }
}

module.exports = FBCHUNKSParser;
```

#### Example 2: Parsing Appearance JSON Data

```javascript
// src/main/lib/filetypes/FBCHUNKS/FBCHUNKSAppearance.js

class FBCHUNKSAppearance {
  static parseAppearanceData(dataBuffer) {
    const appearances = [];
    let offset = 0;

    // Skip initial version string (null-terminated)
    while (offset < dataBuffer.length && dataBuffer[offset] !== 0) {
      offset++;
    }
    offset++; // Skip null terminator

    // Skip padding
    offset += 8; // Skip 8 bytes of padding

    // Read count of appearances
    const count = dataBuffer.readUInt32LE(offset);
    offset += 4;

    // Read size of JSON data
    const jsonSize = dataBuffer.readUInt32LE(offset);
    offset += 4;

    // Extract JSON string
    const jsonString = dataBuffer.subarray(offset, offset + jsonSize).toString('utf8');

    // Parse JSON
    try {
      const appearanceData = JSON.parse(jsonString);
      appearances.push(appearanceData);
    } catch (err) {
      console.error('Failed to parse appearance JSON:', err);
    }

    // Continue parsing if there are more appearances
    // (This is a simplified example - actual implementation needs to handle multiple objects)

    return appearances;
  }

  static serializeAppearance(appearance) {
    const json = JSON.stringify(appearance);
    const jsonBuffer = Buffer.from(json, 'utf8');

    // Build appearance data block
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32LE(jsonBuffer.length, 0);

    return Buffer.concat([sizeBuffer, jsonBuffer]);
  }
}

module.exports = FBCHUNKSAppearance;
```

#### Example 3: Draft Class Service

```typescript
// src/main/services/DraftClassService.ts

import { FBCHUNKSParser } from '../lib/streams/FBCHUNKSParser';
import { FBCHUNKSWriter } from '../lib/streams/FBCHUNKSWriter';
import { FBCHUNKSAppearance } from '../lib/filetypes/FBCHUNKS/FBCHUNKSAppearance';

export interface DraftClassAppearance {
  bodyType: string;
  genericHeadName: string;
  loadouts: Array<{
    loadoutCategory: string;
    loadoutType: string;
    loadoutElements: any[];
  }>;
}

export interface DraftClass {
  filePath: string;
  year: number;
  versionString: string;
  appearances: DraftClassAppearance[];
}

export class DraftClassService {
  async loadDraftClass(filePath: string): Promise<DraftClass> {
    console.log('[DraftClassService] Loading draft class:', filePath);

    try {
      const parsed = FBCHUNKSParser.parse(filePath);
      const appearances = FBCHUNKSAppearance.parseAppearanceData(parsed.data);

      console.log('[DraftClassService] Loaded', appearances.length, 'appearances');

      return {
        filePath,
        year: parsed.header.year,
        versionString: parsed.header.versionString,
        appearances
      };
    } catch (error) {
      console.error('[DraftClassService] Failed to load draft class:', error);
      throw new Error(`Failed to load draft class: ${error.message}`);
    }
  }

  async saveDraftClass(draftClass: DraftClass, outputPath?: string): Promise<void> {
    const savePath = outputPath || draftClass.filePath;
    console.log('[DraftClassService] Saving draft class to:', savePath);

    try {
      await FBCHUNKSWriter.write(draftClass, savePath);
      console.log('[DraftClassService] Draft class saved successfully');
    } catch (error) {
      console.error('[DraftClassService] Failed to save draft class:', error);
      throw new Error(`Failed to save draft class: ${error.message}`);
    }
  }
}
```

#### Example 4: IPC Handler

```typescript
// src/main/ipc/draft-class-handlers.ts

import { ipcMain } from 'electron';
import { DraftClassService } from '../services/DraftClassService';

const draftClassService = new DraftClassService();

export function registerDraftClassHandlers() {
  ipcMain.handle('draft-class:load', async (event, filePath: string) => {
    console.log('[IPC] draft-class:load', filePath);
    return await draftClassService.loadDraftClass(filePath);
  });

  ipcMain.handle('draft-class:save', async (event, draftClass: any, outputPath?: string) => {
    console.log('[IPC] draft-class:save', draftClass.filePath);
    await draftClassService.saveDraftClass(draftClass, outputPath);
  });

  ipcMain.handle('draft-class:export-json', async (event, draftClass: any, outputPath: string) => {
    console.log('[IPC] draft-class:export-json', outputPath);
    const fs = require('fs').promises;
    await fs.writeFile(outputPath, JSON.stringify(draftClass.appearances, null, 2), 'utf8');
  });

  ipcMain.handle('draft-class:import-json', async (event, jsonPath: string) => {
    console.log('[IPC] draft-class:import-json', jsonPath);
    const fs = require('fs').promises;
    const json = await fs.readFile(jsonPath, 'utf8');
    return JSON.parse(json);
  });
}
```

#### Example 5: Frontend Usage

```typescript
// src/renderer/components/DraftClassEditor.tsx

import React, { useState } from 'react';

export const DraftClassEditor: React.FC = () => {
  const [draftClass, setDraftClass] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLoadDraftClass = async () => {
    setLoading(true);
    try {
      // Open file dialog
      const filePath = await window.electronAPI.showOpenDialog({
        filters: [{ name: 'Draft Class', extensions: ['*'] }]
      });

      if (filePath) {
        const loaded = await window.electronAPI.invoke('draft-class:load', filePath);
        setDraftClass(loaded);
      }
    } catch (error) {
      console.error('Failed to load draft class:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraftClass = async () => {
    if (!draftClass) return;

    setLoading(true);
    try {
      await window.electronAPI.invoke('draft-class:save', draftClass);
      alert('Draft class saved successfully!');
    } catch (error) {
      console.error('Failed to save draft class:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="draft-class-editor">
      <h1>Draft Class Editor</h1>

      <div className="toolbar">
        <button onClick={handleLoadDraftClass} disabled={loading}>
          Load Draft Class
        </button>
        <button onClick={handleSaveDraftClass} disabled={!draftClass || loading}>
          Save Draft Class
        </button>
      </div>

      {draftClass && (
        <div className="draft-class-info">
          <p><strong>Year:</strong> {draftClass.year}</p>
          <p><strong>Version:</strong> {draftClass.versionString}</p>
          <p><strong>Appearances:</strong> {draftClass.appearances.length}</p>
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}
    </div>
  );
};
```

### Risk Assessment

#### High Risk Items

1. **Incomplete Draft Class Data**
   - **Risk**: CAREERDRAFT may not contain all necessary data for draft class editing
   - **Mitigation**: Complete Phase 3 investigation before full implementation
   - **Impact**: May need to support multiple file types or formats

2. **Unknown File Relationships**
   - **Risk**: Appearance data may be linked to player attributes in unknown ways
   - **Mitigation**: Thorough testing with game import/export
   - **Impact**: Could break in-game draft class functionality

3. **Version Compatibility**
   - **Risk**: FBCHUNKS format may change between Madden versions
   - **Mitigation**: Version detection and handling
   - **Impact**: Need to maintain multiple format versions

#### Medium Risk Items

1. **JSON Parsing Complexity**
   - **Risk**: Appearance JSON may have complex nested structures
   - **Mitigation**: Incremental parsing with error handling
   - **Impact**: More development time needed

2. **CRC32 Validation**
   - **Risk**: Game may validate CRC32 and reject modified files
   - **Mitigation**: Properly calculate and update CRC32 on save
   - **Impact**: Files may not load in-game if CRC is wrong

3. **Performance with Large Files**
   - **Risk**: 2MB files with JSON parsing may be slow
   - **Mitigation**: Stream-based parsing, lazy loading
   - **Impact**: UI responsiveness issues

#### Low Risk Items

1. **UI Implementation**
   - **Risk**: Complex appearance editing interface
   - **Mitigation**: Start with simple JSON editor, enhance incrementally
   - **Impact**: Reduced user-friendliness initially

2. **Testing Coverage**
   - **Risk**: Limited test files available
   - **Mitigation**: Create synthetic test files, use community resources
   - **Impact**: Bugs may surface in production use

### Testing Strategy

#### Unit Tests

1. **FBCHUNKSParser**
   - Parse valid FBCHUNKS file
   - Handle invalid signatures
   - Handle truncated files
   - Parse header fields correctly

2. **FBCHUNKSAppearance**
   - Parse JSON appearance data
   - Handle malformed JSON
   - Serialize appearance data
   - Validate appearance structure

3. **DraftClassService**
   - Load draft class successfully
   - Handle file not found
   - Save draft class successfully
   - Validate modified data

#### Integration Tests

1. **Full Parse/Write Cycle**
   - Load CAREERDRAFT-2026DRAFT7RND
   - Modify appearance data
   - Save to new file
   - Re-load and verify changes persisted

2. **IPC Communication**
   - Main process handlers respond correctly
   - Renderer can invoke handlers
   - Error messages propagate properly

#### End-to-End Tests

1. **UI Workflow**
   - Open draft class editor
   - Load draft class file
   - View appearance data
   - Export JSON
   - Import JSON
   - Save changes
   - Verify file on disk

2. **In-Game Testing** (Manual)
   - Load modified draft class in Madden 26
   - Verify appearances display correctly
   - Test draft class import
   - Verify no corruption

### Success Criteria

#### Phase 2 Success Criteria

- ✅ FBCHUNKS files can be parsed without errors
- ✅ Header fields are correctly extracted
- ✅ JSON appearance data is successfully parsed
- ✅ Files can be written with valid CRC32
- ✅ Round-trip parse/write preserves data integrity
- ✅ Unit tests pass with 80%+ coverage

#### Phase 3 Success Criteria

- ✅ Player attribute data location identified
- ✅ File format for attributes documented
- ✅ Link between appearance and attributes understood
- ✅ Test files available for development

#### Phase 4 Success Criteria

- ✅ UI can load and display draft class data
- ✅ Appearance data is editable
- ✅ Changes can be saved successfully
- ✅ JSON export/import works correctly
- ✅ E2E tests pass

#### Phase 5 Success Criteria

- ✅ Full player editing (ratings + appearance) works
- ✅ Multiple file coordination successful
- ✅ In-game import loads modified draft class
- ✅ No data corruption or crashes
- ✅ All attributes display correctly in-game

### Timeline Estimate

**Phase 2 (FBCHUNKS Parser)**: 1-2 weeks
- Parser implementation: 3-4 days
- Writer implementation: 2-3 days
- Testing: 2-3 days
- Documentation: 1-2 days

**Phase 3 (Attribute Location)**: 1-3 weeks (highly variable)
- File investigation: 3-5 days
- Community research: 2-4 days
- Testing: 2-3 days
- May require community engagement time

**Phase 4 (UI Implementation)**: 2-3 weeks
- Service layer: 3-4 days
- IPC handlers: 2-3 days
- UI components: 5-7 days
- Testing: 3-4 days
- Polish: 2-3 days

**Phase 5 (Full Support)**: 3-4 weeks
- Attribute parsing: 4-5 days
- Multi-file coordination: 3-4 days
- Full editor UI: 5-7 days
- In-game testing: 3-4 days
- Bug fixes: 3-5 days

**Total Estimate**: 7-12 weeks (depending on Phase 3 complexity)

## Conclusion

The CAREERDRAFT-2026DRAFT7RND file uses the FBCHUNKS container format and contains only character visual/appearance data in JSON format. Unlike roster files, it does not contain a TDB2 database with player attributes (ratings, skills, etc.).

**Key Takeaways**:

1. **Custom Format**: FBCHUNKS is not supported by existing tools (madden-file-tools, ea-cdb-tools)
2. **Visual Data Only**: File contains appearance JSON, not gameplay attributes
3. **Additional Research Needed**: Player attributes must be located before full draft class support
4. **Phased Approach**: Implement FBCHUNKS parser first, then investigate complete draft class structure

**Recommended Next Steps**:

1. **Immediate**: Implement Phase 2 (FBCHUNKS parser) to handle appearance data
2. **Short-term**: Conduct Phase 3 (attribute location) investigation
3. **Medium-term**: Build Phase 4 (UI) for appearance editing
4. **Long-term**: Complete Phase 5 (full support) after understanding complete structure

**ea-cdb-tools Verdict**: Limited applicability to our project. The tool handles CDB format (for Madden 25+ roster files), but our CAREERDRAFT file uses a different FBCHUNKS format. Some conceptual patterns (header parsing, container extraction) are useful, but direct code reuse is not feasible.

## References

- **Test File**: `C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\Madden Files\CAREERDRAFT-2026DRAFT7RND`
- **madden-file-tools**: `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 26\Tools\Head Coach Editor\resources\node_modules\madden-file-tools`
- **ea-cdb-tools**: https://github.com/WiiExpertise/ea-cdb-tools
- **RESEARCH_FINDINGS.md**: `C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\madden-editor-suite\RESEARCH_FINDINGS.md`

---

**Document Version**: 1.0
**Date**: 2025-10-02
**Author**: Claude Code (Anthropic)
**Status**: Complete - Ready for Implementation
