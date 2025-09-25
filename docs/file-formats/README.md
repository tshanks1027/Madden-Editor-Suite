# Madden File Format Documentation

## Overview
This document describes the binary file formats used by EA Sports Madden NFL games, focusing on the formats needed for our 17 editing tools.

## File Types Summary

| Extension | Type | Purpose | Tools |
|-----------|------|---------|-------|
| `.ros` | Roster | Player data, team assignments | Roster Editor, Export Tool |
| `.fra` | Franchise | Complete franchise/season data | History Editor, Stats Editor |
| `.dcl` | Draft Class | Draft eligible players | Draft Class Editor, Draft Helper |
| `.uni` | Uniform | Uniform configurations | Uniform Editor |
| `.dds` | Texture | DirectDraw Surface textures | Uniform Editor, Field Editor |
| `.fld` | Field | Stadium field configurations | Field Editor |
| `.coa` | Coach | Coach data and attributes | Coach Editor |
| `.sal` | Salary | Salary cap and contracts | Salary Cap Editor |
| `.sta` | Stats | Statistical records | Stats Editor |
| `.wea` | Weather | Weather configurations | Weather Controls |

## General Binary Structure

### Common Header Format
Most Madden files follow a similar header structure:

```
Offset | Size | Type     | Description
-------|------|----------|------------
0x00   | 4    | char[4]  | File signature/magic number
0x04   | 4    | uint32   | File version
0x08   | 4    | uint32   | File size in bytes
0x0C   | 4    | uint32   | Header size
0x10   | 4    | uint32   | Data section offset
0x14   | 4    | uint32   | Checksum (CRC32)
0x18   | 8    | reserved | Reserved for future use
```

### Data Encoding
- **Byte Order**: Little-endian (Intel format)
- **Strings**: UTF-8 encoded with length prefix
- **Integers**: 32-bit signed/unsigned as specified
- **Floats**: IEEE 754 single-precision (32-bit)
- **Booleans**: 8-bit values (0x00 = false, 0x01 = true)

## File Format Specifications

### Roster Files (.ros)

#### Purpose
Contains player data, attributes, team assignments, and basic roster information.

#### File Structure
```
Header (32 bytes)
├── Signature: "ROS\0"
├── Version: Usually 0x00000018 for recent versions
├── Player Count: Number of players in roster
└── Team Data Offset: Offset to team information

Player Records Section
├── Player Record 1 (Variable size ~200 bytes)
├── Player Record 2
└── ... (Player Count records)

Team Assignment Section
├── Team 1 Player List
├── Team 2 Player List
└── ... (32 teams)

String Table
├── Player Names
├── College Names
└── Other string data
```

#### Player Record Structure
```
Offset | Size | Type    | Description
-------|------|---------|------------
0x00   | 4    | uint32  | Player ID (unique identifier)
0x04   | 4    | uint32  | String table offset for first name
0x08   | 4    | uint32  | String table offset for last name
0x0C   | 2    | uint16  | Jersey number
0x0E   | 1    | uint8   | Position ID
0x0F   | 1    | uint8   | Team ID
0x10   | 1    | uint8   | Age
0x11   | 1    | uint8   | Height (inches)
0x12   | 2    | uint16  | Weight (pounds)
0x14   | 1    | uint8   | Speed rating (0-99)
0x15   | 1    | uint8   | Acceleration rating (0-99)
0x16   | 1    | uint8   | Strength rating (0-99)
0x17   | 1    | uint8   | Awareness rating (0-99)
... (continues with all attributes)
```

### Franchise Files (.fra)

#### Purpose
Complete franchise mode data including historical records, team finances, schedules, and multi-season progression.

#### File Structure
```
Header (64 bytes)
├── Signature: "FRAN"
├── Version: Franchise file version
├── Season Year: Current franchise year
├── Week: Current week in season
├── Sections Count: Number of data sections
└── Section Offsets: Array of section start positions

Roster Section
├── Current rosters for all teams
├── Practice squad players
├── Injured reserve lists
└── Free agent pool

Team Finance Section
├── Salary cap data
├── Contract details
├── Team budgets
└── Revenue information

Statistics Section
├── Season statistics
├── Career statistics
├── Team records
└── Historical data

Schedule Section
├── Regular season schedule
├── Playoff brackets
├── Game results
└── Future games

Settings Section
├── Franchise options
├── Rule modifications
├── Draft settings
└── Trade logic settings
```

### Draft Class Files (.dcl)

#### Purpose
Contains information about draft-eligible players for a specific year.

#### File Structure
```
Header (32 bytes)
├── Signature: "DRAF"
├── Draft Year: Year of the draft class
├── Player Count: Number of draft prospects
└── Scouting Data Offset: Offset to scouting information

Draft Prospect Records
├── Player attributes (similar to roster format)
├── Draft projection data
├── College statistics
└── Combine measurements

Scouting Reports
├── Team-specific scouting grades
├── Position rankings
├── Injury concerns
└── Character assessments
```

### Uniform Files (.uni)

#### Purpose
Defines team uniform configurations including colors, patterns, and texture references.

#### File Structure
```
Header (32 bytes)
├── Signature: "UNIF"
├── Team ID: Which team this uniform belongs to
├── Uniform Set: Home/Away/Alternate identifier
└── Texture Count: Number of associated textures

Color Palette Section
├── Primary Color (RGB + Alpha)
├── Secondary Color (RGB + Alpha)
├── Accent Color (RGB + Alpha)
└── Additional colors (up to 16 total)

Uniform Components
├── Jersey Configuration
│   ├── Base texture reference
│   ├── Number font style
│   ├── Name font style
│   └── Pattern overlay data
├── Helmet Configuration
│   ├── Shell texture reference
│   ├── Facemask color
│   ├── Decal references
│   └── Finish type (matte/gloss/chrome)
├── Pants Configuration
│   ├── Base texture reference
│   ├── Stripe pattern data
│   └── Color zones
└── Accessories
    ├── Sock colors
    ├── Shoe colors
    └── Glove colors

Texture References
├── Texture File Paths
├── UV Mapping Data
└── Material Properties
```

### Texture Files (.dds)

#### Purpose
DirectDraw Surface format textures used for uniforms, fields, and other visual elements.

#### DDS Header Structure
```
Offset | Size | Type    | Description
-------|------|---------|------------
0x00   | 4    | char[4] | "DDS " signature
0x04   | 4    | uint32  | Header size (124 bytes)
0x08   | 4    | uint32  | Flags (indicates what fields are valid)
0x0C   | 4    | uint32  | Height in pixels
0x10   | 4    | uint32  | Width in pixels
0x14   | 4    | uint32  | Pitch or linear size
0x18   | 4    | uint32  | Depth (for volume textures)
0x1C   | 4    | uint32  | Mipmap count
0x20   | 44   | reserved| Reserved for future use
0x4C   | 32   | DDS_PF  | Pixel format structure
0x6C   | 4    | uint32  | Caps flags
0x70   | 4    | uint32  | Caps2 flags
0x74   | 4    | uint32  | Caps3 flags (unused)
0x78   | 4    | uint32  | Caps4 flags (unused)
0x7C   | 4    | reserved| Reserved
```

#### Supported Formats
- **BC1 (DXT1)**: 4:1 compression, no alpha channel
- **BC2 (DXT3)**: 4:1 compression, explicit alpha
- **BC3 (DXT5)**: 4:1 compression, interpolated alpha
- **BC7**: Advanced compression with alpha support

## Parsing Guidelines

### Error Handling
1. **File Validation**: Always validate file signatures and versions
2. **Bounds Checking**: Verify all offsets are within file bounds
3. **Checksum Validation**: Validate file integrity using CRC32
4. **Version Compatibility**: Handle different game versions gracefully

### Performance Considerations
1. **Lazy Loading**: Load large sections on-demand
2. **Memory Management**: Stream large files to avoid memory issues
3. **Caching**: Cache frequently accessed data
4. **Batch Operations**: Process multiple records efficiently

### Modification Safety
1. **Backup Creation**: Always backup original files before modification
2. **Atomic Updates**: Use temporary files for modifications
3. **Validation**: Validate modified data before writing
4. **Checksum Updates**: Recalculate checksums after modifications

## Version Compatibility

### Madden Version Detection
```javascript
const versionMap = {
  0x00000015: 'Madden 22',
  0x00000016: 'Madden 23',
  0x00000017: 'Madden 24',
  0x00000018: 'Madden 25',
};
```

### Format Evolution
- **Madden 20-22**: Older format with 32-bit player IDs
- **Madden 23-24**: Enhanced format with expanded attribute ranges
- **Madden 25+**: Latest format with new uniform system

## Implementation Status

### Completed Parsers
- [ ] Roster File Parser (.ros)
- [ ] Draft Class Parser (.dcl)
- [ ] Basic DDS Texture Parser (.dds)

### In Progress
- [ ] Franchise File Parser (.fra)
- [ ] Uniform File Parser (.uni)

### Planned
- [ ] Coach File Parser (.coa)
- [ ] Salary Cap Parser (.sal)
- [ ] Statistics Parser (.sta)
- [ ] Weather Parser (.wea)
- [ ] Field Configuration Parser (.fld)

## Research Sources

### Community Resources
- **Operation Sports Forums**: Community-driven file format research
- **Madden Modding Discord**: Real-time collaboration with modders
- **Football Outsiders**: Statistical analysis methodologies
- **Pro Football Reference**: Historical data validation

### Technical References
- **Microsoft DDS Documentation**: Official DDS format specification
- **DirectX SDK**: Texture format implementation details
- **Hex Editors**: Binary analysis tools (HxD, 010 Editor)
- **Reverse Engineering Tools**: Disassemblers and debuggers

## Contributing

### Research Guidelines
1. **Document Findings**: All discoveries must be documented with examples
2. **Validate Theories**: Test all assumptions with multiple file samples
3. **Share Progress**: Regular updates to research findings
4. **Community Review**: Peer review of all major discoveries

### File Samples
- Maintain test files for each Madden version
- Include both minimal and complex examples
- Anonymize personal data in shared samples
- Version control all test data