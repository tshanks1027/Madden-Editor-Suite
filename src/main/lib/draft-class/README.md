# Draft Class Parser Library

**Version:** 1.0.0 (Prototype)
**Status:** ⚠️ Development - Requires Offset Calibration
**Author:** Madden Editor Suite Team
**License:** MIT

## Overview

A complete draft class parsing library for Madden NFL draft class files (FBCHUNKS format) with support for both Madden 25 (gzip) and Madden 26 (zstd) compression formats.

### Features

- ✅ FBCHUNKS file format validation
- ✅ Game version detection (Madden 25/26)
- ✅ Compression auto-detection (gzip/zstd/none)
- ✅ Header parsing (signature, version, year, product)
- ✅ JSON visual data extraction
- ⚠️ Binary attribute parsing (prototype - needs calibration)
- ❌ Write support (not yet implemented)

## Quick Start

### Installation

This library is built into the Madden Editor Suite. No separate installation required.

For standalone use:
```javascript
const { readDraftClass, validateDraftClass } = require('./DraftClassParser');
```

### Basic Usage

```javascript
const { readDraftClass, validateDraftClass } = require('./DraftClassParser');

// Validate a draft class file
const validation = validateDraftClass('./CAREERDRAFT-2026DRAFT7RND');
console.log(validation.valid); // true/false

// Read draft class
const draftClass = readDraftClass('./CAREERDRAFT-2026DRAFT7RND');
console.log(`Loaded ${draftClass.prospects.length} players`);
console.log(`Game Version: Madden ${draftClass.header.gameVersion}`);

// Access player data
const firstPlayer = draftClass.prospects[0];
console.log(`${firstPlayer.firstName} ${firstPlayer.lastName}`);
console.log(`Position: ${firstPlayer.position}, Overall: ${firstPlayer.overall}`);
```

## API Reference

### Main Functions

#### `readDraftClass(input)`

Parse a draft class file.

**Parameters:**
- `input` - String (file path) or Buffer

**Returns:** Object with structure:
```javascript
{
  header: {
    signature: "FBCHUNKS",
    version: 1,
    year: 2025,
    product: "Madden-26-RL1-8310191",
    gameVersion: 26,
    compressionType: "none",
    dataStartOffset: 76
  },
  prospects: [
    {
      index: 0,
      offset: 76,
      firstName: "John",
      lastName: "Doe",
      position: 0,
      overall: 75,
      // ... 90+ more attributes
      visuals: { /* JSON object */ }
    }
  ],
  meta: {
    fileSize: 1954750,
    prospectCount: 452,
    estimatedProspects: 452,
    compressionDetected: "none"
  }
}
```

#### `validateDraftClass(input)`

Validate draft class file format.

**Parameters:**
- `input` - String (file path) or Buffer

**Returns:** Object with validation results:
```javascript
{
  valid: true,
  signature: "FBCHUNKS",
  version: 1,
  year: 2025,
  product: "Madden-26-RL1-8310191",
  compressionType: "none",
  fileSize: 1954750
}
```

#### `getDraftClassInfo(input)`

Get summary information without full parse.

**Parameters:**
- `input` - String (file path) or Buffer

**Returns:** Object with summary data including sample prospects

#### `exportToJSON(input, outputPath)`

Export draft class to JSON file.

**Parameters:**
- `input` - String (file path) or Buffer
- `outputPath` - String (JSON file path)

**Returns:** Parsed draft class object

#### `getAttributeDefinitions()`

Get attribute definitions for UI rendering.

**Returns:** Object with field definitions by category (personal, ratings, draft)

### Utility Classes

#### `FileParser`

Binary buffer parsing with automatic offset tracking.

```javascript
const FileParser = require('./FileParser');

const parser = new FileParser(buffer);
const byte = parser.readByte();        // uint8
const short = parser.readUShort();     // uint16 LE
const int = parser.readUInt();         // uint32 LE
const str = parser.readSizedString(30); // Fixed-length string

parser.offset = 0x100; // Manual offset control
```

**Methods:**
- `readBytes(length)` - Read raw bytes
- `readByte()` - Read uint8
- `readUShort(bigEndian)` - Read uint16
- `readUInt(bigEndian)` - Read uint32
- `readNullTerminatedString(encoding)` - Read until null byte
- `readSizedString(length, encoding)` - Read fixed-length string
- `pad(alignment)` - Align offset to boundary
- `peekBytes(length)` - Read without advancing offset
- `canRead(length)` - Check if bytes available

**Properties:**
- `offset` - Get/set current position
- `remaining` - Bytes remaining in buffer
- `isEOF` - Check if at end of buffer

#### `Decompressor`

Compression detection and decompression.

```javascript
const { decompress, detectCompression } = require('./Decompressor');

// Auto-detect compression type
const type = detectCompression(buffer); // 'gzip', 'zstd', or 'none'

// Decompress
const decompressed = decompress(buffer); // Auto-detects type
// or
const decompressed = decompress(buffer, 'gzip'); // Force specific type
```

**Functions:**
- `detectCompression(buffer)` - Detect compression type
- `decompress(buffer, type)` - Decompress data
- `decompressGzip(buffer)` - Gzip decompression (Madden 25)
- `decompressZstd(buffer)` - Zstd decompression (Madden 26) ⚠️
- `compressGzip(buffer)` - Gzip compression

**Constants:**
- `GZIP_MAGIC` - Buffer([0x1F, 0x8B])
- `ZSTD_MAGIC` - Buffer([0x28, 0xB5, 0x2F, 0xFD])

## File Format

### FBCHUNKS Container

```
Offset  Size  Type      Description
------  ----  --------  -----------
0x00    8     ASCII     Signature: "FBCHUNKS"
0x08    1     uint8     Version (1)
0x09    ...   varies    Header metadata
0x16    2     uint16    Year (little-endian)
0x18    ...   varies    Additional metadata
0x22    30    string    Product string (e.g., "Madden-26-RL1-8310191")
0x4C    ...   varies    Player data section
```

### Player Records

**Structure:** Variable-length records (~4322 bytes each)

Each player record contains:
1. **Visual Data** - JSON object (variable length)
   - Body type, head model, equipment loadouts
2. **Binary Attributes** - Fixed-size binary data
   - Name, position, ratings, physical stats

### Compression Support

| Game Version | Compression | Magic Bytes | Status |
|--------------|-------------|-------------|--------|
| Madden 25 | gzip | 0x1F 0x8B | ✅ Supported |
| Madden 26 (uncompressed) | none | N/A | ✅ Supported |
| Madden 26 (compressed) | zstd | 0x28 0xB5 0x2F 0xFD | ⚠️ Partial |

## Attribute List

### Personal Information (9 fields)
- firstName, lastName, homeTown
- position, age, heightInches, weight
- college, jerseyNum

### Ratings (60+ fields, 0-99 scale)
- overall, speed, acceleration, strength, awareness
- agility, jumping, stamina, injury, toughness
- throwPower, throwAccuracy (short/mid/deep)
- carrying, breakTackle, trucking, jukeMove, spinMove
- catching, catchInTraffic, spectacularCatch
- passBlock, runBlock, impactBlocking
- tackle, hitPower, pursuit, playRecognition
- manCoverage, zoneCoverage, pressCoverage
- And 40+ more...

### Draft Information (3 fields)
- draftRound (1-7)
- draftPick (1-32)
- draftable (0/1)

### Visual Data (JSON)
- bodyType ("Heavy", "Lean", "Athletic", "Stocky")
- genericHeadName (head model reference)
- loadouts (equipment/customization array)

**Total:** 90+ attributes per player

## Known Issues

### 1. Attribute Offsets Need Calibration ⚠️

The current attribute parsing uses estimated offsets that may not be accurate. This causes buffer overflow errors.

**Status:** Prototype implementation
**Solution:** Compare with madden-draft-class-tools to get exact offsets

### 2. Variable-Length Records Not Handled

Player records are not exactly 4322 bytes due to variable-length JSON sections.

**Status:** Fixed-size parsing implemented
**Solution:** Implement dynamic record boundary detection

### 3. Zstd Decompression Requires Library

Madden 26 compressed files use zstd, which requires additional library.

**Status:** Placeholder implementation
**Solution:** Install `fflate` or `@toondepauw/node-zstd`

### 4. Write Support Not Implemented

Writing draft class files is not yet supported.

**Status:** Not implemented
**Solution:** Implement after read parsing is 100% accurate

## Development

### Testing

```bash
# Run test parser
node test-parser.js

# Examine file structure
node examine-file.js
```

### Test Files

Located in: `C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\Madden Files\`

- `CAREERDRAFT-2026DRAFT7RND` - Madden 26 (1,954,750 bytes, 452 players)

### Test Results

See: `docs/DRAFT_CLASS_PARSE_TEST.md` for comprehensive test report

## Next Steps

### Phase 1 - Complete Parsing (HIGH PRIORITY)
1. Install madden-draft-class-tools as reference
2. Calibrate attribute offsets
3. Implement variable-length record detection
4. Achieve 100% accurate parsing

### Phase 2 - Compression Support (MEDIUM PRIORITY)
1. Install fflate library
2. Complete zstd decompression
3. Test with compressed files
4. Add compression round-trip tests

### Phase 3 - Write Support (LOW PRIORITY)
1. Implement after parsing is perfect
2. Add file backup functionality
3. Test extensively before production

## References

### Source Code
- **madden-franchise** by bep713 (MIT) - Compression strategies
- **madden-draft-class-tools** by WiiExpertise (GPL-3.0) - Draft class parsing

### Documentation
- `docs/MADDEN_25_VS_26_COMPATIBILITY.md` - Format analysis
- `docs/DRAFT_CLASS_INTEGRATION_STRATEGY.md` - Integration plan
- `docs/DRAFT_CLASS_PARSE_TEST.md` - Test results

## License

MIT License

## Contributing

This is a prototype implementation. Contributions welcome, especially:
- Accurate attribute offset mappings
- Zstd decompression implementation
- Write support
- Additional test files

---

**Status:** ✅ Header parsing working, ⚠️ Attribute parsing needs calibration
**Last Updated:** October 2, 2025
