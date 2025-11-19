# Known Issues - Madden Editor Suite

This document records solutions to problems that have been solved before. Check here FIRST when encountering bugs.

## Index

- [M26 Draft Class Save Errors](#m26-draft-class-save-errors)
- [Data Format Mismatches](#data-format-mismatches)
- [Display and Rendering Bugs](#display-and-rendering-bugs)
- [Data Persistence Issues](#data-persistence-issues)
- [Handsontable Sorting Issues](#handsontable-sorting-issues)
- [Packaging and Distribution Issues](#packaging-and-distribution-issues)

---

## M26 Draft Class Save Errors

### Issue: M26 draft files fail to save with "argument must be a string" error

**Symptoms:**
- Generated draft class file appears to save successfully
- File won't load in Madden 26
- Console shows: `TypeError: argument must be a string`
- Error occurs in M26Writer during PEPS field processing

**Root Cause:**
1. PEPS field wasn't type-checked before writing (commit f1e358f)
2. Missing M25 header in generated M26 files (commit 2d0a124)
3. firstName/lastName/archetype had type inconsistencies (commit 3d1a194)

**Solution:**
```javascript
// In M26Writer.js - Add type checking for PEPS field
if (typeof prospect.PEPS !== 'string') {
  prospect.PEPS = String(prospect.PEPS || '');
}

// Ensure M25 header is present
const header = Buffer.from('M25', 'utf8');
// Write header before draft class data
```

**Prevention:**
- Add unit tests for PEPS field type conversion
- Validate all draft class headers in DraftClassService
- Use TypeScript strict mode for type safety

**Fixed In:** Commits f1e358f, 2d0a124, 3d1a194

---

## Data Format Mismatches

### Issue: Archetype doesn't persist after draft class generation

**Symptoms:**
- Generated prospects have undefined/null archetypes when loaded
- Archetype dropdown shows blank in editor
- Console shows archetype assignment but value doesn't save

**Root Cause:**
- Archetype was assigned as string name but saved as numeric ID
- CSV lookup has different format than in-memory representation (commit 093ce6a)
- Mismatch between `archetype` (display name) and archetype ID (numeric)

**Solution:**
```javascript
// Use archetypeDetailed from CSV lookup
const archetypeData = lookupService.getArchetypeForPosition(position);
prospect.archetype = archetypeData.id; // Use numeric ID, not name

// Ensure consistent format throughout pipeline
```

**Prevention:**
- Add type validation in RatingCalculator
- Document archetype field format in field-definitions.js
- Create integration test: generate → save → reload → verify archetype

**Fixed In:** Commit 093ce6a

---

### Issue: Position and team data format inconsistencies

**Symptoms:**
- Position shows as number instead of name in UI
- Team dropdown has wrong values
- Data looks correct in console but wrong in grid

**Root Cause:**
- Position codes are numeric (0-21) but UI expects strings ("QB", "WR")
- Team IDs are 1-32 (not 0-31) due to Madden indexing
- CSV data has mixed string/numeric formats (commits d92831d, d1e2736)

**Solution:**
```javascript
// Always convert position codes before display
const positionName = POSITION_MAP[positionCode] || 'Unknown';

// Team IDs are 1-based, not 0-based
const teamName = TEAM_MAP[teamId] || 'Unknown'; // teamId starts at 1
```

**Prevention:**
- Centralize position/team mapping in lookup service
- Add validation for position/team ID ranges
- Document the 1-based vs 0-based indexing

**Fixed In:** Commits d92831d, d1e2736

---

## Display and Rendering Bugs

### Issue: Archetype display bug after sorting by position

**Symptoms:**
- Wrong archetype shown for player after column sort
- Archetype renderer shows data from different row
- Sorting by position column causes data misalignment

**Root Cause:**
- Index mismatch between Handsontable data array and custom renderer
- Position codes were sorted numerically but renderer expected original index
- Renderer was using row index instead of data lookup (commits 44153ff, 20cf24d, c0e527e)

**Solution:**
```javascript
// Convert position codes to names BEFORE sorting
const paginatedPlayers = this.filteredPlayers.map(player => ({
  ...player,
  _positionName: POSITION_MAP[player.PPOS] || 'Unknown'
}));

// In renderer: Use getDataAtCell() instead of direct index
const archetype = instance.getDataAtCell(row, archetypeColumnIndex);
```

**Prevention:**
- Rebuild Handsontable view after any data mutation
- Use Handsontable's data access methods, not direct array indexing
- Add E2E test: sort column → verify data still matches

**Fixed In:** Commits 44153ff, 20cf24d, c0e527e

---

### Issue: Handsontable table "snaps left" unexpectedly

**Symptoms:**
- Table horizontally scrolls to leftmost position when clicking columns
- Scroll position not maintained after edits
- Frustrating user experience

**Root Cause:**
- `preventOverflow: 'horizontal'` setting was too aggressive
- Handsontable's internal scroll management conflicting with custom logic

**Solution:**
```javascript
// In Handsontable config
preventOverflow: false, // Allow natural scrolling
```

**Prevention:**
- Test scroll behavior after Handsontable config changes
- Document any preventOverflow setting changes

**Fixed In:** Recent work (not yet committed)

---

## Data Persistence Issues

### Issue: Player order not persisted after sorting in draft class

**Symptoms:**
- Players revert to original order when draft class reloaded
- UI sort changes display but not underlying file
- Sorting appears to work but doesn't save

**Root Cause:**
- Sort changes display order but not the actual data array
- DraftClassService didn't track order changes (commit d5eddec)
- Save operation used original unsorted array

**Solution:**
```javascript
// In DraftClassService - track order
this.playerOrder = [...sortedIndices]; // Store sort order

// On save - persist order to file
prospects.forEach((prospect, index) => {
  prospect.order = this.playerOrder[index];
});
```

**Prevention:**
- Always persist UI state to backing data
- Add integration test: sort → save → reload → verify order
- Document that display order must be synchronized with data order

**Fixed In:** Commit d5eddec

---

## Handsontable Sorting Issues

### Issue: OVR column won't sort when clicked

**Symptoms:**
- Clicking OVR (Overall Rating) column header does nothing
- Other columns sort fine
- Console shows click events detected but no sort action

**Root Cause:**
- App uses CUSTOM sorting system via `toggleColumnSort()` function
- Enabling Handsontable's built-in `columnSorting: true` conflicts with custom sorting
- Sort was working but data wasn't reaching Handsontable for display

**Solution:**
```javascript
// In Handsontable config
columnSorting: false, // DISABLE built-in sorting (we use custom)
multiColumnSorting: false,

// Use document-level event delegation for header clicks
document.addEventListener('click', (e) => {
  const header = e.target.closest('.sortable-header');
  if (header) {
    this.toggleColumnSort(header.dataset.field, e.shiftKey);
  }
});
```

**Debug Process:**
1. Added logging to verify click events detected ✓
2. Verified `toggleColumnSort()` was called ✓
3. Verified `sortColumns` array was set correctly ✓
4. Verified Handsontable re-rendering ✓
5. **Found:** Sort WAS working, data was sorted, but UI didn't update
6. **Cause:** Need to verify sorted data reaches Handsontable

**Prevention:**
- Never enable Handsontable's built-in sorting (conflicts with custom system)
- Always verify data flow: filter → sort → paginate → Handsontable
- Add E2E test for column sorting

**Fixed In:** Document-level event delegation (commit ac8c898), recent debugging work

---

## Packaging and Distribution Issues

### Issue: Saved roster files are 2.4KB instead of 6.4KB

**Symptoms:**
- App saves roster file successfully
- File size is 2.4KB instead of expected 6.4KB
- File won't load in Madden 26 (corrupted)

**Root Cause:**
- `nul` file in Windows project directory interferes with file I/O operations
- When Node.js tries to write, `nul` file redirect breaks the stream

**Solution:**
```bash
# Delete nul file from project
del nul

# Pre-package check automatically detects this now
npm run package  # Will fail if nul file exists
```

**Prevention:**
- Pre-package script checks for `nul` file (already implemented)
- Never commit `nul` file to git
- Add `**/nul` to .gitignore (already done)

**Fixed In:** Pre-package check script

---

### Issue: "Cannot find module 'bit-buffer'" in packaged app

**Symptoms:**
- App works in development (`npm start`)
- Packaged app crashes with "Cannot find module 'bit-buffer'"
- Same for stream-parser, crc-32

**Root Cause:**
- Required binary parsing modules not copied to `.vite/build/node_modules/`
- Vite doesn't automatically bundle CommonJS dependencies

**Solution:**
```javascript
// In vite.main.config.ts - Copy required modules
{
  name: 'copy-required-modules',
  closeBundle: async () => {
    const modules = ['bit-buffer', 'stream-parser', 'crc-32'];
    for (const mod of modules) {
      await fs.copy(
        path.join(__dirname, 'node_modules', mod),
        path.join(__dirname, '.vite/build/node_modules', mod)
      );
    }
  }
}
```

**Prevention:**
- Verify `.vite/build/node_modules/` contains all required modules
- Test packaged app before distribution
- Pre-package check verifies dependencies in package.json

**Fixed In:** vite.main.config.ts plugin

---

### Issue: App works from `out/` but not from extracted ZIP

**Symptoms:**
- Packaged app runs from `out/Madden Editor Suite-win32-x64/`
- Extracted ZIP version crashes or shows errors
- File paths or data files missing

**Root Cause:**
- Hardcoded paths like `C:\Users\tshan\` in code
- Missing data files in package
- File path resolution assumes development structure

**Solution:**
```javascript
// Use app.getAppPath() for all file paths
const dataPath = path.join(app.getAppPath(), 'data', 'lookups');

// Check if packaged for conditional logic
if (app.isPackaged) {
  // Production paths
} else {
  // Development paths
}
```

**Prevention:**
- Pre-package check scans for hardcoded user paths
- Always test extracted ZIP in different location
- Use relative paths or app.getAppPath()

**Fixed In:** Pre-package check, path resolution in main.ts

---

## Debugging Patterns

### Pattern: Add extensive logging first, then fix

**When Applied:**
- M26 draft class saves (commits with "debug: Add logging")
- Handsontable sorting issues (recent work)
- Portrait rendering problems

**Why Effective:**
- Confirms assumptions about code execution
- Reveals actual vs expected values
- Identifies exactly where data transform breaks

**Best Practice:**
```javascript
console.log('[ComponentName] ===== START OPERATION =====');
console.log('[ComponentName] Input:', JSON.stringify(input));
// ... operation ...
console.log('[ComponentName] Output:', JSON.stringify(output));
console.log('[ComponentName] ===== END OPERATION =====');
```

---

## Related Documentation

- `TESTING_STRATEGY.md` - Reliable vs unreliable tests
- `PROJECT_SETUP.md` - Build and packaging workflow
- `ARCHITECTURE.md` - System design and dependencies
