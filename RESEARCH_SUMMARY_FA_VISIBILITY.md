# Comprehensive Research Summary: Free Agent Visibility in Madden Franchise Files

## Overview

This document summarizes extensive research conducted on Madden franchise file structure, specifically investigating why players moved to Free Agency via external tools (like MFT or Madden Editor Suite) show up in those tools but NOT in the actual game.

---

## ROOT CAUSE FOUND

**The FA array (Player[] table 5930) must be updated when releasing players to Free Agency.**

The game uses a dedicated Free Agent player array (table 5930) referenced by:
- `Franchise.FreeAgents` → table 5930, row 0
- `League.FreeAgents` → table 5930, row 0

When MFT releases a player to FA, it adds them to this array. Our tools do NOT.

---

## What We Were Doing (Incomplete)

When releasing a player to Free Agency, we were:
- ✅ Setting `TeamIndex = 32` (FA team)
- ✅ Setting `ContractStatus = 'FreeAgent'`
- ✅ Clearing contract fields (`ContractLength = 0`, salaries, bonuses)
- ✅ Setting `PLYR_CONSECYEARSWITHTEAM = 0`
- ✅ Setting `PLYR_ISCAPTAIN = false`
- ✅ Removing player from team's roster array

**But we were NOT:**
- ❌ Adding the player to the FA array (table 5930)

---

## FA Array Structure

### Table Details
- **Table ID**: 5930
- **Table Name**: Player[]
- **Unique ID**: 3717720305
- **Record Capacity**: 1 (single array record)
- **Max Array Size**: 3500 players

### Array Contents
The FA array contains references to ALL free agent players:
- Current size: 1117 players (matches exactly with FreeAgent count in Player table)
- All FA players are in this array
- Example: Shaq Mason (visible FA) is at position 397

### References to FA Array
Found 7 references in franchise file:
1. `Franchise[0].FreeAgents` → table 5930, row 0 (**PRIMARY**)
2. `League[0].FreeAgents` → table 5930, row 0 (**PRIMARY**)
3. `FranchiseServer_CutDaysFlow[0].FreeAgents` → table 5930, row 0
4. `DepthChartReorderTransaction[0].FreeAgents` → table 5930, row 0
5. `DataSource[24].Data` → table 5930, row 0
6. `DataSource[39].Data` → table 5930, row 0
7. `UpdatePlayerGrades[0].PlayerGradeEval` → table 5930, row 0

---

## How Team Rosters vs FA Array Work

### Regular Team Roster (Example: Kansas City Chiefs)
- Team 8 (KC) has a `Roster` field referencing table 5907, row 9
- That roster array contains 66 player references
- All 66 players with `TeamIndex=8` are in this array

### FA "Team" (Team 32)
- Team 32 has 3 entries: AFC (Pro Bowl), NFC (Pro Bowl), FA
- The FA entry's `Roster` field is **NULL** (`tableId=0`)
- FA players are NOT in a "team roster" - they are in the **FA array** instead

### Key Insight
- Signed players: Listed in Player table + team's roster array
- Free agents: Listed in Player table + **FA array (table 5930)**

---

## Complete Solution

When releasing a player to Free Agency:

1. **Update Player table fields** (already doing):
   - `TeamIndex = 32`
   - `ContractStatus = 'FreeAgent'`
   - `ContractLength = 0`
   - `ContractSalary0-7 = 0`
   - `ContractBonus0-7 = 0`
   - `PLYR_CONSECYEARSWITHTEAM = 0`
   - `PLYR_ISCAPTAIN = false`

2. **Remove from team roster array** (already doing):
   - Get team's `Roster` reference
   - Remove player from the array
   - Update `arraySize`

3. **ADD to FA array** (NOT DOING - THE FIX):
   - Get table 5930 (FA array)
   - Get row 0 (the single array record)
   - Add player reference to next available slot
   - Update `arraySize`

---

## Franchise File Structure Details

### Total Tables: 2571

**Tables by Category:**
- Player-related: 244 tables
- Team-related: 185 tables
- Roster-related: 18 tables
- Contract-related: 61 tables
- Salary-related: 31 tables
- Free Agent-related: 30 tables
- Schedule-related: 222 tables
- Draft-related: 811 tables
- Coach-related: 62 tables
- Stadium-related: 14 tables
- History-related: 196 tables

### Key Player[] Tables

| Table ID | Purpose | Records with Data | Total Players |
|----------|---------|------------------|---------------|
| 5907 | Team rosters | 32 arrays | 2043 players |
| 5930 | **FA array** | 1 array | 1117 players |
| 5878 | Unknown | 1120 arrays | 3693 players |
| 5562 | Unknown | 278 arrays | 3058 players |

---

## Player Table Fields

### Key Fields for FA Status

| Field | Signed Player | Free Agent |
|-------|--------------|------------|
| TeamIndex | 0-31 | 32 |
| ContractStatus | Signed | FreeAgent |
| ContractLength | 1-7 | 0 |
| ContractYear | 0-6 | 0 |
| ContractSalary0-7 | Various | 0 |
| ContractBonus0-7 | Various | 0 |
| PLYR_CONSECYEARSWITHTEAM | Years | 0 |
| PLYR_ISCAPTAIN | true/false | false |
| PrevTeamIndex | Previous | 32 |
| ReleaseRating | Rating | Rating |
| TradeStatus | Various | None |

---

## Code Location

### Current Implementation (src/main/services/RetroEditorService.ts)

The current code handles:
- Line 511-563: `removePlayerFromRosterArray()` - removes from team roster
- Line 575-604: `addPlayerToRosterArray()` - adds to team roster
- Line 734-753: `releasePlayerToFA()` - sets fields, removes from roster

**Missing**: No function to add players to FA array (table 5930)

### Required Addition

Need to add a function like:
```typescript
async addPlayerToFAArray(franchise, playerIndex) {
  // Get FA array (table 5930)
  // Add player reference
  // Update arraySize
}
```

And call it when:
1. Releasing a player to FA
2. Moving players to FA during expansion team setup
3. Any other FA-related operations

---

## Verification Tests Run

1. **FA Array Match Test**: arraySize=1117 matches exactly with FreeAgent count
2. **Shaq Mason Test**: Known visible FA found at position 397 in array
3. **Complete Sync Test**: 0 FA players missing from array, 0 non-FA players in array

---

## External Resources

- [MyMaddenFranchise GitHub](https://github.com/Bowersrd/MyMaddenFranchise24Release)
- [madden-franchise Library](https://github.com/bep713/madden-franchise)
- [madden-franchise-editor](https://github.com/bep713/madden-franchise-editor)
- [FootballIdiot Forums](https://www.footballidiot.com/forum/)

---

## Conclusion

**ROOT CAUSE**: Players released to FA are not added to the FA array (table 5930).

**SOLUTION**: Add `addPlayerToFAArray()` function and call it whenever releasing players to FA.

This explains why:
- MFT works (it updates the FA array)
- Our tools don't work (we don't update the FA array)
- Players show up in tools but not in-game (tools read Player table fields, game reads FA array)

---

*Research conducted: January 2026*
*Files analyzed: CAREER-Testing*
*Total tables analyzed: 2571*
*Root cause identified: FA array (table 5930) not being updated*
