# Franchise File Roster Structure

## Overview

This document describes how player-team associations work in Madden franchise files, based on analysis of MFT (Madden Franchise Tool) and actual franchise files.

## Key Tables

### Team Table (UniqueId 637929298)
- Contains 37 records (32 NFL teams + AFC/NFC/FA + empty slots)
- **Record position ≠ TeamIndex**
- Each team has a `TeamIndex` field (0-31 for NFL teams, 32 for special)
- Each team has a `Roster` reference field pointing to a roster array

Example mapping:
```
records[0]  = 49ers (TeamIndex=14)
records[1]  = Bears (TeamIndex=0)
records[4]  = Broncos (TeamIndex=3)
records[5]  = Browns (TeamIndex=4)
records[30] = Ravens (TeamIndex=24)
```

### Player Table
- Contains ~3000-4000 player records
- Each player has a `TeamIndex` field
- **This is the PRIMARY mechanism for team association**
- Player.TeamIndex=4 means player is on Browns
- Player.TeamIndex=24 means player is on Ravens
- Player.TeamIndex=32 means Free Agent

### Roster Array Table (Player[])
- Table ID varies by file (5907 or 5897 seen)
- Team.Roster reference points to a row in this table
- Each row contains Player0...Player99 reference fields
- **Secondary structure - Player.TeamIndex is primary**

## How to Transfer Players Between Teams

### MFT Approach (Recommended)
MFT uses `Player.TeamIndex` as the primary association:

```javascript
// From leagueEditorService.js
employablePeople.forEach((person) => {
    const team = searchObjects.find((obj) => {
        return obj instanceof Team && obj.teamIndex === person.teamIndex;
    });
});
```

### Simple Transfer (e.g., Browns → Ravens)
1. Find all players where `Player.TeamIndex = 4` (Browns)
2. Change their `TeamIndex` to `24` (Ravens)
3. Done!

### Roster Swap (e.g., Browns ↔ Ravens)
1. Find all players with `TeamIndex = 4` (Browns) → temporarily mark
2. Find all players with `TeamIndex = 24` (Ravens) → change to 4
3. Change all temporarily marked players to 24

### Key Points
- **Do NOT rely on roster array indices matching team indices**
- **Do NOT hardcode roster array table IDs**
- **Player.TeamIndex is the authoritative source**
- MFT ignores roster arrays for team associations

## Team Index Reference

| Team | TeamIndex | Team Record Index |
|------|-----------|-------------------|
| Bears | 0 | 1 |
| Bengals | 1 | 2 |
| Bills | 2 | 3 |
| Broncos | 3 | 4 |
| Browns | 4 | 5 |
| Buccaneers | 5 | 6 |
| Cardinals | 6 | 7 |
| Chargers | 7 | 10 |
| Chiefs | 8 | 11 |
| Colts | 9 | 12 |
| Cowboys | 10 | 14 |
| Dolphins | 11 | 15 |
| Eagles | 12 | 16 |
| Falcons | 13 | 17 |
| 49ers | 14 | 0 |
| Giants | 15 | 19 |
| Jaguars | 16 | 21 |
| Jets | 17 | 22 |
| Lions | 18 | 23 |
| Packers | 19 | 25 |
| Panthers | 20 | 26 |
| Patriots | 21 | 27 |
| Raiders | 22 | 28 |
| Rams | 23 | 29 |
| Ravens | 24 | 30 |
| Commanders | 25 | 13 |
| Saints | 26 | 31 |
| Seahawks | 27 | 32 |
| Steelers | 28 | 33 |
| Titans | 29 | 34 |
| Vikings | 30 | 35 |
| Texans | 31 | 34 |
| FA/AFC/NFC | 32 | 8,9,18 |

## Common Mistakes

1. **Using TeamIndex as array index**: Team records are NOT sorted by TeamIndex
2. **Hardcoding table IDs**: Roster array table ID varies between files
3. **Ignoring Player.TeamIndex**: This is the primary association, not roster arrays
4. **One-way moves vs swaps**: Relocations need proper roster handling
