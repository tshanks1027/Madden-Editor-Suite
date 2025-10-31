# PID-Based Portrait Mapping Plan

## Problem
Currently portraits are mapped by PLPO name, which causes inconsistencies because player names can vary (Jr., II, apostrophes, periods, spacing). PIDs are numerical and always consistent.

## Goal
Map sprites directly to PID numbers instead of PLPO names.

## CSV Files
1. **PID_Portrait_Mapping.csv** - Maps PID → PLPO sprite ID
   - Example: `6183,real,plpo_AllenLarry`

2. **PID_lookup.csv** - Maps PID → Player Name
   - Example: `6183,Larry Allen`

## Requirements for Roster/Draft Class Editors

**NOT generators - they work differently**

When loading a roster or draft class:

### Column Layout
- **Column 2 (Portrait):** Load sprite using PID directly
  - Read PSXP header → get PID
  - Use PID → load sprite (no name matching)

- **Column 3-4 (First/Last Name):** Load from roster data
  - Can be different from PID's actual player name
  - Users mod these, so they don't always match

- **Column 5 (PID):** Show PSXP value
  - The actual PID number

- **Column 6 (Player Pic):** Show player name for this PID
  - Use PID → look up name in PID_lookup.csv
  - Example: PID 6183 → "Larry Allen"

### Key Rules
- **NO fallbacks, NO smart matching** - just direct PID lookups
- Names can mismatch (columns 3-4 vs column 6) - this is expected
- Sprites mapped to PID numbers, not PLPO names
- Numbers are reliable, names have variations

## Implementation Tasks

1. **Update PortraitSpriteService** (src/main/services/PortraitSpriteService.ts)
   - Load PID_Portrait_Mapping.csv
   - Build Map<PID number, AtlasEntry> in addition to existing PLPO map
   - Add `getPortraitByPID(pid: number)` method

2. **Add getByPID IPC handler** (src/main/ipc/portrait-handlers.ts)
   - Add IPC handler that calls `portraitSpriteService.getPortraitByPID(pid)`

3. **Update preload.ts**
   - Expose `window.electronAPI.portrait.getByPID(pid)` API

4. **Load PID_lookup.csv** (src/renderer/data/field-definitions.js)
   - Load PID_lookup.csv on startup
   - Store in `LOOKUP_DATA.pidToName` map
   - Use for Player Pic column (column 6)

5. **Update portrait loading** (src/renderer/js/app.js)
   - Change from `window.electronAPI.portrait.getByPLPO(plpo)`
   - To `window.electronAPI.portrait.getByPID(pid)`
   - Cache key: `pid_${pid}`

6. **Clean up fallback logic**
   - Remove `getPlpoFromPID()` function and its 7 uses
   - Remove any smart matching or fallback logic
   - Only use direct PID lookups

7. **Update Player Pic column**
   - Use PID → lookup name in PID_lookup.csv
   - Show player name (not PLPO sprite ID)

## Expected Result

If PSXP = 10884 and it maps to "Fran Murray":
- Column 2: Shows Fran Murray's face sprite
- Column 3-4: Shows "Codrington Brandon" (user-edited data - can mismatch)
- Column 5: Shows 10884
- Column 6: Shows "Fran Murray" (from PID_lookup.csv)

If mapping is wrong, it will be visible and can be fixed in CSV files.
