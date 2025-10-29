# MyFranchise Research - Key Actionable Findings

**Quick Reference Guide for Implementing "Close to MyFranchise" Features**

---

## 1. Most Important Discovery: Lookup-Based Enum Display

### The Pattern

**Storage:** Numeric ID in binary file (e.g., `CollegeId = 1`)
**Display:** Human-readable name via lookup (e.g., "Abilene Christian")

### Their Implementation (M25)

```javascript
// They have colleges.json with ~500 entries:
{
  "COLLEGE_ID": 1,
  "Name": "Abilene Christian",
  "Conference": "Southwest",
  "Region": "Central"
}

// In UI, they display "Abilene Christian" but save 1
```

### What We Need to Do (M26)

1. **Extract M26 college data** from schema or generate it
2. **Create lookup service** in main process
3. **Update Handsontable columns** to use dropdowns with names
4. **Save IDs, display names** transparently

---

## 2. Live Overall Calculation (Impressive Feature)

### What It Does

As user edits any rating (SPD, STR, etc.), the Overall rating **recalculates instantly** based on position-specific formulas.

### The Formula

```javascript
For each attribute:
  normalized = (value - minValue) / (maxValue - minValue)
  weighted = normalized * (attributeWeight / totalWeights)
  sum += weighted

overall = Math.round(Math.min(sum * 99, 99))
```

### Their Data File

`ovrweights.json` (75KB) contains formulas for every position + archetype combination:

```json
{
  "Pos": "QB",
  "Archetype": "QB_FieldGeneral",
  "DesiredHigh": 96,
  "DesiredLow": 46,
  "SpeedRating": 0.2,
  "ThrowPowerRating": 2.5,
  "ThrowAccuracyMidRating": 1.8,
  "Sum": 10
}
```

### Implementation Priority

**Recommendation:** Medium priority - impressive but complex for M26 (formulas may differ)

---

## 3. Multi-Table Support (Expected by Users)

### What They Support

~100 tables including:
- Player (active roster)
- Free Agent
- Retired Player
- Coach
- Free Agent Coach
- Depth Chart
- Team
- Draft Class
- Contracts
- Statistics (game, season, career)

### What We Should Add (Priority Order)

1. **HIGH:** Coach table (relatively simple, expected feature)
2. **HIGH:** Free Agent table (just another player table view)
3. **MEDIUM:** Depth Chart (shows starters/backups)
4. **MEDIUM:** Contract display (read-only is fine)
5. **LOW:** Statistics (read-only, complex)

---

## 4. Enhanced Filtering (Easy Wins)

### What They Have

- Position filter (dropdown)
- Team filter (dropdown)
- Overall range filter (slider)
- Name search (text input)
- Age range filter
- Contract status filter

### What We Should Add (Next Sprint)

```javascript
// Add above Handsontable:
<div class="filters">
  <select id="position-filter">
    <option value="">All Positions</option>
    <option value="0">QB</option>
    <option value="1">HB</option>
    <!-- ... -->
  </select>

  <select id="team-filter">
    <option value="">All Teams</option>
    <!-- Populate from teams -->
  </select>

  <input type="number" id="ovr-min" placeholder="Min OVR">
  <input type="number" id="ovr-max" placeholder="Max OVR">
</div>
```

Then filter Handsontable data on change.

---

## 5. Team Color Theming (Polish Feature)

### What They Do

Dynamically apply team colors to UI elements based on RGB values stored in franchise file:

```javascript
GetTeamPrimaryColor: function(team) {
  const r = Math.max(team.TEAM_BACKGROUNDCOLORR, 20);
  const g = Math.max(team.TEAM_BACKGROUNDCOLORG, 20);
  const b = Math.max(team.TEAM_BACKGROUNDCOLORB, 20);
  return `rgba(${r}, ${g}, ${b}, 1)`;
}
```

### Implementation

Low priority but impressive visual polish. Can color-code table rows by team.

---

## 6. Web Workers for Heavy Operations

### What They Use

- `promise-worker 2.0.1` - Async worker communication
- `workerpool 6.2.0` - Thread pool management

### When They Use It

- Parsing large franchise files
- Calculating overall for all players
- Statistical aggregations
- Export operations

### Should We Use It?

**Maybe** - if franchise loading is slow (>2 seconds), offload to worker.

---

## 7. Validation Patterns

### What They Validate

- Rating range: 0-99
- Enum values: Must be valid college/position ID
- Contract values: Salary caps
- Age: Reasonable ranges
- Position-specific: Can't have high throwing stats on a DT

### What We Should Add

```javascript
hot.addHook('beforeChange', (changes, source) => {
  changes.forEach(change => {
    const [row, prop, oldValue, newValue] = change;

    // Range validation for ratings
    if (isRatingField(prop)) {
      if (newValue < 0 || newValue > 99) {
        change[3] = Math.max(0, Math.min(99, newValue));
        showWarning(`${prop} must be 0-99`);
      }
    }

    // Enum validation
    if (prop === 'CollegeId') {
      if (!lookupService.hasCollege(newValue)) {
        change[3] = oldValue;
        showError('Invalid college ID');
      }
    }
  });
});
```

---

## 8. Immediate Next Steps

### This Week

1. **Copy their college lookup data** (temp-myfranchise-extract/dist/electron/static/colleges.json)
2. **Adapt for M26** (check if college IDs match, update if needed)
3. **Create LookupService.ts** in src/main/services/
4. **Update Handsontable columns** to display college names
5. **Test with a few players**

### Next Week

6. Add position name display (same pattern)
7. Add team name display
8. Implement position filter dropdown
9. Implement team filter dropdown
10. Add overall range filter

### Next Sprint

11. Add Coach table support
12. Add Free Agent table support
13. Add tab navigation (Player / Coach / Free Agents)
14. Improve error handling and validation

---

## 9. Code Snippets to Copy

### Lookup Service Pattern

```typescript
// src/main/services/LookupService.ts
import * as fs from 'fs';
import * as path from 'path';

interface College {
  COLLEGE_ID: number;
  Name: string;
  Conference?: string;
  Region?: string;
}

interface Position {
  ShortName: string;
  LongName: string;
  Order: number;
}

export class LookupService {
  private colleges: Map<number, College> = new Map();
  private positions: Map<number, Position> = new Map();

  async initialize() {
    await this.loadColleges();
    await this.loadPositions();
  }

  private async loadColleges() {
    const filePath = path.join(__dirname, '../../data/lookups/colleges.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    data.forEach((college: College) => {
      this.colleges.set(college.COLLEGE_ID, college);
    });
  }

  private async loadPositions() {
    const filePath = path.join(__dirname, '../../data/lookups/positions.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    data.forEach((pos: Position, index: number) => {
      this.positions.set(index, pos);
    });
  }

  getCollegeName(id: number): string {
    return this.colleges.get(id)?.Name ?? 'Unknown';
  }

  getPositionName(id: number): string {
    return this.positions.get(id)?.ShortName ?? '??';
  }

  getCollegeOptions(): { value: number; label: string }[] {
    return Array.from(this.colleges.values())
      .map(c => ({ value: c.COLLEGE_ID, label: c.Name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  getPositionOptions(): { value: number; label: string }[] {
    return Array.from(this.positions.values())
      .map((p, idx) => ({ value: idx, label: p.ShortName }))
      .sort((a, b) => a.value - b.value);
  }
}

export const lookupService = new LookupService();
```

### IPC Handler for Lookups

```typescript
// src/main/ipc/lookup-handlers.ts
import { ipcMain } from 'electron';
import { lookupService } from '../services/LookupService';

export function registerLookupHandlers() {
  ipcMain.handle('lookup:getCollegeName', (event, collegeId: number) => {
    return lookupService.getCollegeName(collegeId);
  });

  ipcMain.handle('lookup:getCollegeOptions', () => {
    return lookupService.getCollegeOptions();
  });

  ipcMain.handle('lookup:getPositionName', (event, positionId: number) => {
    return lookupService.getPositionName(positionId);
  });

  ipcMain.handle('lookup:getPositionOptions', () => {
    return lookupService.getPositionOptions();
  });
}
```

### Preload API Exposure

```typescript
// src/preload.ts (add to existing contextBridge)
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs
  lookup: {
    getCollegeName: (id: number) => ipcRenderer.invoke('lookup:getCollegeName', id),
    getCollegeOptions: () => ipcRenderer.invoke('lookup:getCollegeOptions'),
    getPositionName: (id: number) => ipcRenderer.invoke('lookup:getPositionName', id),
    getPositionOptions: () => ipcRenderer.invoke('lookup:getPositionOptions'),
  }
});
```

### Handsontable Dropdown Column

```javascript
// src/renderer/js/franchise-editor.js

// Load options once on page load
let collegeOptions = [];
let positionOptions = [];

async function initializeLookups() {
  collegeOptions = await window.electronAPI.lookup.getCollegeOptions();
  positionOptions = await window.electronAPI.lookup.getPositionOptions();
}

const columns = [
  {
    data: 'FirstName',
    title: 'First Name'
  },
  {
    data: 'CollegeId',
    title: 'College',
    type: 'dropdown',
    source: collegeOptions.map(o => o.label),
    renderer: async function(instance, td, row, col, prop, value) {
      const name = await window.electronAPI.lookup.getCollegeName(value);
      td.innerHTML = name;
      return td;
    },
    // Convert name back to ID on edit
    beforeChange: function(changes) {
      changes.forEach(change => {
        if (change[1] === 'CollegeId') {
          const selectedName = change[3];
          const option = collegeOptions.find(o => o.label === selectedName);
          if (option) {
            change[3] = option.value;
          }
        }
      });
    }
  },
  {
    data: 'Position',
    title: 'Pos',
    type: 'dropdown',
    source: positionOptions.map(o => o.label),
    renderer: async function(instance, td, row, col, prop, value) {
      const name = await window.electronAPI.lookup.getPositionName(value);
      td.innerHTML = name;
      return td;
    }
  }
];
```

---

## 10. Files to Copy from MyFranchise

### Already Extracted to:
`C:\Users\tshan\Documents\Dev\madden-editor-suite\temp-myfranchise-extract\dist\electron\static\`

### Copy These Files:

1. **colleges.json** (265KB)
   - Copy to: `src/main/data/lookups/colleges-m25.json`
   - Verify IDs match M26 or regenerate from M26 schema

2. **positions.json** (small)
   - Copy to: `src/main/data/lookups/positions.json`
   - Should be identical for M26

3. **attributes.json** (small)
   - Copy to: `src/main/data/lookups/attributes.json`
   - Useful for column metadata

4. **ovrweights.json** (75KB) - OPTIONAL
   - Copy to: `src/main/data/lookups/ovrweights-m25.json`
   - For reference if implementing overall calculation
   - Need M26 version for production use

---

## 11. Testing Checklist

### After Implementing Lookups

- [ ] Load franchise file with players from various colleges
- [ ] Verify college names display correctly (not IDs)
- [ ] Edit a player's college via dropdown
- [ ] Save file and reload
- [ ] Verify college ID saved correctly in binary
- [ ] Verify college name still displays after reload

### After Implementing Filters

- [ ] Filter by position = QB, verify only QBs shown
- [ ] Filter by team, verify only that team shown
- [ ] Filter by OVR range 80-99, verify only high OVR shown
- [ ] Clear filters, verify all players return
- [ ] Combine filters (QB + team + OVR), verify intersection

---

## 12. FAQ: MyFranchise vs Our Editor

**Q: Should we switch from Handsontable to v-datatable-light?**
A: No. Handsontable is more powerful and we're already using it.

**Q: Should we switch from Vanilla JS to Vue.js?**
A: No. That's a complete rewrite. Our tech stack is fine.

**Q: Can we use their lookup JSON files directly?**
A: For M25, yes. For M26, we need to verify/regenerate them.

**Q: How hard is overall calculation?**
A: Medium. Need M26 formulas first. Start with simple version.

**Q: Should we support all 100 tables?**
A: No. Start with Player/Coach/Free Agents (core use cases).

**Q: Will users expect our M26 editor to match MyFranchise M25?**
A: Yes, in core functionality. No, in advanced features (stats, abilities).

**Q: What's the one feature that would make us "feel close"?**
A: **Lookup-based enum display** (college/position names instead of IDs).

---

## Conclusion

**The MyFranchise pattern we MUST adopt:**
- Lookup-based enum display (college, position, team names)

**The MyFranchise features we SHOULD add:**
- Multi-table support (Coach, Free Agents)
- Enhanced filtering (position, team, OVR)
- Better validation

**The MyFranchise features we COULD add later:**
- Live overall calculation (impressive but complex)
- Team color theming (polish)
- Statistics viewing (low priority)

**Our advantage:**
- M26 support (they're M25 only)
- Simpler codebase (Vanilla JS vs Vue.js ecosystem)
- Faster development for core features

**Start here:** Copy colleges.json, implement LookupService, update Handsontable columns. That alone will make a huge UX improvement.
