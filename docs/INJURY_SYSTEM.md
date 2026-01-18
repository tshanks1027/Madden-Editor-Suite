# Madden Roster Injury System

## Overview

Player injuries in Madden roster files (TDB2/FBCHUNKS format) are stored in a **separate INJY table**, NOT in player fields within the PLAY table.

## Research Date
January 18, 2026

## Key Finding

**PCSA is NOT injury status** - it contains salary/contract values (e.g., Fred Warner = 1605, which is $16.05M).

Injuries are tracked through a separate `INJY` table that links to players via `PGID` (Player Game ID).

## Tables Involved

### PLAY Table (Player Data)
- Contains player attributes, ratings, contract info
- `PGID` field = Player Game ID (unique identifier)
- Does NOT contain injury status

### INJY Table (Injury Data)
- Contains injury records for injured players
- Links to PLAY via `PGID`
- If a player's PGID is in INJY table → they are injured

## INJY Table Fields

| Field | Type | Description | Example Values |
|-------|------|-------------|----------------|
| PGID | number | Player Game ID - links to PLAY.PGID | 13203 (Fred Warner) |
| TGID | number | Team Game ID | 15 (49ers) |
| INIR | number | Injured Reserve flag | 1 = on IR |
| INJL | number | Injury Length | 253 = season-ending, 124, 104, 84 = shorter |
| INJT | number | Injury Type code | 4, 61, 64, 75, etc. (different injuries) |
| INJS | number | Injury Severity | 6, 7, 8 |
| INSI | number | Unknown (always 2) | 2 |
| INJR | number | Unknown (always 0) | 0 |
| INTW | number | Weeks injured? | Variable |

## Implementation Requirements

### To Show Injury Indicator:
1. When loading roster, also load INJY table
2. Build a `Set<number>` of injured PGIDs from INJY table
3. When rendering grid row, check if `player.PGID` is in the injured Set
4. If yes, show injury indicator icon

### To Remove a Single Player's Injury:
1. Find the INJY record where `PGID === player.PGID`
2. Delete that record from the INJY table
3. When saving, the INJY table will be smaller

### To Remove All Injuries:
1. Clear all records from the INJY table
2. Or iterate and delete each record

## Sample Data (49ers Injuries)

| Player | PGID | INIR | INJL | INJT |
|--------|------|------|------|------|
| Fred Warner | 13203 | 1 | 253 | 4 |
| Nick Bosa | 20565 | 1 | 253 | 61 |
| Brandon Aiyuk | 21069 | 1 | 253 | 51 |
| Trent Taylor | 12743 | 1 | 253 | 34 |
| Jacob Cowing | 14663 | 1 | 124 | 75 |

## Code Changes Required

### 1. RosterParser.js
- Load INJY table alongside PLAY table
- Return injuries array or Set of injured PGIDs

### 2. app.js
- Store injured PGIDs Set
- Pass to grid renderer

### 3. ag-grid-roster-complete.js
- PortraitCellRenderer: Check `player.PGID` against injured Set
- Show indicator if injured

### 4. Injury Removal
- Need IPC handler to modify INJY table
- Or store INJY data and rebuild on save

## WRONG Previous Assumption

PCSA was incorrectly assumed to be "Contract Status" with values like "InjuredReserve".

**PCSA is actually a salary amount** (numeric, in thousands).
- Fred Warner: PCSA = 1605 ($16.05M?)
- Kyle Juszczyk: PCSA = 103 ($1.03M?)

This explains why checking for string values like "InjuredReserve" never matched anything.
