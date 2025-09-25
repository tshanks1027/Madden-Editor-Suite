# Roster File Format (.ros) Specification

## Overview
Roster files contain player data, team assignments, and basic roster information for Madden NFL games. This is the primary file format for the Roster Editor tool.

## File Structure

### Header (32 bytes)
```
Offset | Size | Type    | Field Name    | Description
-------|------|---------|---------------|------------------
0x00   | 4    | char[4] | signature     | "ROS\0" file identifier
0x04   | 4    | uint32  | version       | File format version
0x08   | 4    | uint32  | fileSize      | Total file size in bytes
0x0C   | 4    | uint32  | playerCount   | Number of players in roster
0x10   | 4    | uint32  | teamDataOffset| Offset to team assignment data
0x14   | 4    | uint32  | stringTableOffset | Offset to string table
0x18   | 4    | uint32  | checksum      | CRC32 checksum of data
0x1C   | 4    | uint32  | reserved      | Reserved for future use
```

### Version Information
- **Madden 22**: 0x00000015
- **Madden 23**: 0x00000016
- **Madden 24**: 0x00000017
- **Madden 25**: 0x00000018

## Player Record Structure (188 bytes)

### Basic Information (40 bytes)
```
Offset | Size | Type    | Field Name      | Description
-------|------|---------|-----------------|------------------
0x00   | 4    | uint32  | playerId        | Unique player identifier
0x04   | 4    | uint32  | firstNameOffset | Offset in string table
0x08   | 4    | uint32  | lastNameOffset  | Offset in string table
0x0C   | 4    | uint32  | collegeOffset   | Offset in string table
0x10   | 2    | uint16  | jerseyNumber    | Player's jersey number (0-99)
0x12   | 1    | uint8   | position        | Position ID (see position table)
0x13   | 1    | uint8   | teamId          | Team ID (0-31, 255=Free Agent)
0x14   | 1    | uint8   | age             | Player age
0x15   | 1    | uint8   | yearsExperience | NFL experience in years
0x16   | 2    | uint16  | height          | Height in inches
0x18   | 2    | uint16  | weight          | Weight in pounds
0x1A   | 1    | uint8   | handedness      | 0=Right, 1=Left
0x1B   | 5    | reserved| reserved        | Reserved bytes
```

### Physical Attributes (20 bytes)
```
Offset | Size | Type    | Field Name      | Range | Description
-------|------|---------|-----------------|-------|------------------
0x20   | 1    | uint8   | speed           | 0-99  | Speed rating
0x21   | 1    | uint8   | acceleration    | 0-99  | Acceleration rating
0x22   | 1    | uint8   | strength        | 0-99  | Strength rating
0x23   | 1    | uint8   | agility         | 0-99  | Agility rating
0x24   | 1    | uint8   | jumping         | 0-99  | Jumping rating
0x25   | 1    | uint8   | stamina         | 0-99  | Stamina rating
0x26   | 1    | uint8   | injury          | 0-99  | Injury rating
0x27   | 1    | uint8   | toughness       | 0-99  | Toughness rating
0x28   | 1    | uint8   | awareness       | 0-99  | Awareness rating
0x29   | 1    | uint8   | morale          | 0-99  | Morale rating
0x2A   | 10   | reserved| reserved        | -     | Reserved for expansion
```

### Skill Attributes (Position-Specific, 40 bytes)
```
Offset | Size | Type    | Field Name      | Description
-------|------|---------|-----------------|------------------
0x34   | 1    | uint8   | throwing        | Throwing power (QB)
0x35   | 1    | uint8   | throwAccuracy   | Throwing accuracy (QB)
0x36   | 1    | uint8   | breakTackle     | Break tackle ability (RB/WR)
0x37   | 1    | uint8   | catching        | Catching ability (WR/TE/RB)
0x38   | 1    | uint8   | routeRunning    | Route running (WR/TE)
0x39   | 1    | uint8   | blockShedding   | Block shedding (LB/DL)
0x3A   | 1    | uint8   | tackle          | Tackling ability (DEF)
0x3B   | 1    | uint8   | coverage        | Pass coverage (DEF)
0x3C   | 1    | uint8   | passBlocking    | Pass blocking (OL)
0x3D   | 1    | uint8   | runBlocking     | Run blocking (OL)
0x3E   | 1    | uint8   | kickPower       | Kicking power (K/P)
0x3F   | 1    | uint8   | kickAccuracy    | Kicking accuracy (K/P)
0x40   | 32   | uint8[] | additionalSkills| Position-specific skills
```

### Career Statistics (48 bytes)
```
Offset | Size | Type    | Field Name      | Description
-------|------|---------|-----------------|------------------
0x60   | 4    | uint32  | gamesPlayed     | Total games played
0x64   | 4    | uint32  | gamesStarted    | Total games started
0x68   | 4    | uint32  | passingYards    | Career passing yards
0x6C   | 4    | uint32  | passingTDs      | Career passing touchdowns
0x70   | 4    | uint32  | rushingYards    | Career rushing yards
0x74   | 4    | uint32  | rushingTDs      | Career rushing touchdowns
0x78   | 4    | uint32  | receivingYards  | Career receiving yards
0x7C   | 4    | uint32  | receivingTDs    | Career receiving touchdowns
0x80   | 4    | uint32  | tackles         | Career tackles (defense)
0x84   | 4    | uint32  | sacks           | Career sacks
0x88   | 4    | uint32  | interceptions   | Career interceptions
0x8C   | 4    | uint32  | forcedFumbles   | Career forced fumbles
0x90   | 16   | reserved| reserved        | Reserved for additional stats
```

### Appearance Data (40 bytes)
```
Offset | Size | Type    | Field Name      | Description
-------|------|---------|-----------------|------------------
0xA0   | 4    | uint32  | faceId          | Face model ID
0xA4   | 1    | uint8   | skinTone        | Skin tone (0-7)
0xA5   | 1    | uint8   | bodyType        | Body type (0-3)
0xA6   | 1    | uint8   | helmetStyle     | Preferred helmet style
0xA7   | 1    | uint8   | facemaskStyle   | Preferred facemask style
0xA8   | 1    | uint8   | visorType       | Visor type (0-3)
0xA9   | 1    | uint8   | mouthpiece      | Mouthpiece type
0xAA   | 1    | uint8   | neckRoll        | Neck roll presence (0/1)
0xAB   | 1    | uint8   | sleeves         | Sleeve length
0xAC   | 1    | uint8   | wristband       | Wristband type
0xAD   | 1    | uint8   | gloves          | Glove style
0xAE   | 1    | uint8   | shoes           | Shoe style
0xAF   | 1    | uint8   | ankleTrape      | Ankle tape presence (0/1)
0xB0   | 16   | reserved| reserved        | Reserved for future equipment
```

## Position IDs

### Offense
```
ID | Position | Full Name
---|----------|----------
0  | QB       | Quarterback
1  | HB       | Halfback
2  | FB       | Fullback
3  | WR       | Wide Receiver
4  | TE       | Tight End
5  | LT       | Left Tackle
6  | LG       | Left Guard
7  | C        | Center
8  | RG       | Right Guard
9  | RT       | Right Tackle
```

### Defense
```
ID | Position | Full Name
---|----------|----------
10 | LE       | Left End
11 | DT       | Defensive Tackle
12 | RE       | Right End
13 | LOLB     | Left Outside Linebacker
14 | MLB      | Middle Linebacker
15 | ROLB     | Right Outside Linebacker
16 | CB       | Cornerback
17 | FS       | Free Safety
18 | SS       | Strong Safety
```

### Special Teams
```
ID | Position | Full Name
---|----------|----------
19 | K        | Kicker
20 | P        | Punter
21 | LS       | Long Snapper
22 | KR       | Kick Returner
23 | PR       | Punt Returner
```

## Team IDs

### AFC Teams (0-15)
```
ID | Team      | City          | Abbreviation
---|-----------|---------------|-------------
0  | Patriots  | New England   | NE
1  | Bills     | Buffalo       | BUF
2  | Dolphins  | Miami         | MIA
3  | Jets      | New York      | NYJ
4  | Steelers  | Pittsburgh    | PIT
5  | Ravens    | Baltimore     | BAL
6  | Browns    | Cleveland     | CLE
7  | Bengals   | Cincinnati    | CIN
8  | Colts     | Indianapolis  | IND
9  | Texans    | Houston       | HOU
10 | Titans    | Tennessee     | TEN
11 | Jaguars   | Jacksonville  | JAX
12 | Chiefs    | Kansas City   | KC
13 | Chargers  | Los Angeles   | LAC
14 | Broncos   | Denver        | DEN
15 | Raiders   | Las Vegas     | LV
```

### NFC Teams (16-31)
```
ID | Team      | City          | Abbreviation
---|-----------|---------------|-------------
16 | Cowboys   | Dallas        | DAL
17 | Giants    | New York      | NYG
18 | Eagles    | Philadelphia  | PHI
19 | Commanders| Washington    | WAS
20 | Packers   | Green Bay     | GB
21 | Bears     | Chicago       | CHI
22 | Lions     | Detroit       | DET
23 | Vikings   | Minnesota     | MIN
24 | Saints    | New Orleans   | NO
25 | Falcons   | Atlanta       | ATL
26 | Panthers  | Carolina      | CAR
27 | Buccaneers| Tampa Bay     | TB
28 | 49ers     | San Francisco | SF
29 | Seahawks  | Seattle       | SEA
30 | Rams      | Los Angeles   | LAR
31 | Cardinals | Arizona       | ARI
```

### Special Team IDs
```
ID | Description
---|------------
255| Free Agent
254| Practice Squad
253| Injured Reserve
252| Retired
```

## String Table Format

The string table contains all text data referenced by players:

```
Structure:
├── String Count (4 bytes)
├── String Offsets Array (4 bytes × count)
└── String Data
    ├── String 1: [Length][UTF-8 Data]
    ├── String 2: [Length][UTF-8 Data]
    └── ...
```

### String Format
- **Length**: 1 byte for strings < 255 characters, 4 bytes for longer strings
- **Encoding**: UTF-8 with null termination
- **Padding**: Strings padded to 4-byte alignment

## Team Assignment Data

Each team has a roster section containing:

```
Team Roster Structure:
├── Team ID (1 byte)
├── Player Count (1 byte)
├── Starting Lineup (22 player IDs × 4 bytes)
├── Bench Players (variable × 4 bytes)
└── Practice Squad (10 player IDs × 4 bytes)
```

## File Validation

### Checksum Calculation
```javascript
function calculateChecksum(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return crc ^ 0xFFFFFFFF;
}
```

### Validation Rules
1. **File Size**: Must match header file size field
2. **Player Count**: Must not exceed maximum roster size (3000)
3. **Team Assignments**: All player team IDs must be valid
4. **String References**: All string offsets must be within string table
5. **Attribute Ranges**: All ratings must be within 0-99 range
6. **Position Validation**: Position IDs must be valid for team assignments

## Implementation Notes

### Memory Layout
- Use structure packing to ensure byte-aligned access
- Consider endianness when reading multi-byte values
- Implement bounds checking for all array accesses

### Performance Optimizations
- Load player records on-demand for large rosters
- Cache frequently accessed string data
- Use memory mapping for very large files
- Implement lazy loading for statistical data

### Error Handling
- Validate file signature before processing
- Check version compatibility and warn users
- Gracefully handle corrupted or incomplete files
- Provide detailed error messages for debugging

### Modification Safety
- Always create backups before modifications
- Validate all changes before writing to file
- Recalculate checksum after any modifications
- Use atomic file operations to prevent corruption