# Editor Enhancements: Birthday, Archetype, Auto-Calculating OVR, and Scroll Editing

**Date:** 2025-01-04
**Status:** Design Complete, Ready for Implementation
**Scope:** Roster Editor, Draft Class Editor, Draft Class Creator, Roster Creator

## Overview

This enhancement adds missing functionality to editors and generators that will serve as foundation for future generator overhauls:

1. **Birthday/Age System** - Display, edit, and calculate player ages
2. **Archetype System** - Position-specific archetypes with formula multipliers
3. **Auto-Calculating OVR** - Use actual Madden formulas for accurate ratings
4. **Scroll Editing** - Mouse wheel increment/decrement and dropdown cycling
5. **Generator Updates** - Generate archetypes and birthdays for historical players

## Design Decisions

### Key Principles

- **Incremental Enhancement:** Add features one-by-one to existing codebase without major refactoring
- **File Format Compliance:** Store data as files require (IDs, encoded values) but display user-friendly in UI
- **Auto-Recalculation:** Secondary ratings recalculate automatically when base attributes change (no button needed)
- **Dual Calculator System:** Keep stats-based `RatingCalculator` for historical generation, add attribute-based `MaddenFormulaCalculator` for editors
- **User Experience:** No lock icons on calculated fields, smooth scroll editing like reference editor

### Reference Implementation

Using `C:\Users\tshan\Downloads\MaddenRosterEditor-MREv1.1` as reference for:
- Madden formula structure with archetype multipliers
- Scroll editing behavior (wheel increment, dropdown cycling)
- Formula evaluation approach

## Architecture

### 1. Data Layer Foundation

#### Birthday Storage & Conversion

**File Storage:**
- Draft class files: `birthDate` as UShort (2 bytes, encoded as YYYYMMDD integer)
- Roster files: Similar encoded format

**Display Format:**
- UI shows: "MM/DD/YYYY" (date picker)
- Calculated field: Age (read-only, based on current date or draft year)

**Converter Functions:**

```typescript
// In src/main/services/utils/dateConverter.ts

export class DateConverter {
  /**
   * Convert encoded birthday to display format
   * @param encoded - YYYYMMDD as integer (e.g., 19980315)
   * @returns Date string "MM/DD/YYYY" or null if invalid
   */
  static encodedToDisplay(encoded: number): string | null {
    if (!encoded || encoded < 19000101 || encoded > 20991231) return null;

    const year = Math.floor(encoded / 10000);
    const month = Math.floor((encoded % 10000) / 100);
    const day = encoded % 100;

    return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
  }

  /**
   * Convert display format to encoded birthday
   * @param display - Date string "MM/DD/YYYY"
   * @returns Encoded YYYYMMDD integer
   */
  static displayToEncoded(display: string): number {
    const [month, day, year] = display.split('/').map(Number);
    return (year * 10000) + (month * 100) + day;
  }

  /**
   * Calculate age from birthday
   * @param encoded - YYYYMMDD as integer
   * @param asOfYear - Year to calculate age as of (default: current year)
   * @returns Age in years
   */
  static calculateAge(encoded: number, asOfYear?: number): number {
    const birthYear = Math.floor(encoded / 10000);
    const currentYear = asOfYear || new Date().getFullYear();
    return currentYear - birthYear;
  }
}
```

#### Archetype Storage & Conversion

**File Storage:**
- Draft class files: `archetype` as Byte (1 byte, numeric ID 0-255)
- Position-specific archetype IDs

**Display Format:**
- UI shows: Human-readable names in dropdown (e.g., "Field General", "Scrambler")

**Archetype Lookup:**

```typescript
// In src/main/services/utils/archetypeService.ts

interface ArchetypeOption {
  id: number;
  name: string;
  position: string;
  description?: string;
}

export class ArchetypeService {
  private static archetypes: ArchetypeOption[] = [
    // QB Archetypes (0-3)
    { id: 0, name: 'Field General', position: 'QB', description: 'High awareness and accuracy' },
    { id: 1, name: 'Scrambler', position: 'QB', description: 'Mobile with good speed' },
    { id: 2, name: 'Strong Arm', position: 'QB', description: 'High throw power' },
    { id: 3, name: 'Improviser', position: 'QB', description: 'Agile with good throw on run' },

    // HB Archetypes (4-6)
    { id: 4, name: 'Power Back', position: 'HB', description: 'Strong with good carrying' },
    { id: 5, name: 'Elusive Back', position: 'HB', description: 'High agility and juke' },
    { id: 6, name: 'Receiving Back', position: 'HB', description: 'Good catching and route running' },

    // WR Archetypes (7-9)
    { id: 7, name: 'Deep Threat', position: 'WR', description: 'High speed and deep route' },
    { id: 8, name: 'Possession', position: 'WR', description: 'Good catching and route running' },
    { id: 9, name: 'Slot', position: 'WR', description: 'Agile with good short routes' },

    // Add remaining positions...
  ];

  /**
   * Get archetype options for a position
   */
  static getArchetypesForPosition(position: string): ArchetypeOption[] {
    return this.archetypes.filter(a => a.position === position);
  }

  /**
   * Get archetype name by ID
   */
  static getArchetypeName(id: number): string {
    return this.archetypes.find(a => a.id === id)?.name || 'Unknown';
  }

  /**
   * Get archetype ID by name
   */
  static getArchetypeId(name: string): number {
    return this.archetypes.find(a => a.name === name)?.id || 0;
  }
}
```

### 2. Madden Formula Calculator

**New Service:** `src/main/services/rating-modes/MaddenFormulaCalculator.ts`

**Purpose:** Calculate secondary ratings and OVR using actual Madden formulas with archetype multipliers

**Formula File Format:**
Port from reference editor's `Formulas_and_Methods.txt`:

```
Quarterbacks

Overall
=PRODUCT(AWR*0.16+THP*0.16+SAC*0.12+MAC*0.12+DAC*0.10+TOR*0.04+SPD*0.03+RUN*0.02+AGI*0.02+STR*0.02+INJ*0.01+STA*0.01)

Ball Carrier Vision
=PRODUCT(IF(OR(Archetype="Scrambler", Archetype="Improviser"), AWR*0.2+CAR*0.4+BTK*0.2+SPD*0.2, AWR*0.2+CAR*0.6+BTK*0.2))

[more formulas...]
```

**Implementation:**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface FormulaContext {
  [attribute: string]: number | string;
  Archetype?: string;
}

interface PositionFormulas {
  [ratingName: string]: string;
}

export class MaddenFormulaCalculator {
  private formulas: Map<string, PositionFormulas> = new Map();

  constructor() {
    this.loadFormulas();
  }

  /**
   * Load formulas from Formulas_and_Methods.txt
   */
  private loadFormulas(): void {
    const formulaPath = app.isPackaged
      ? path.join(app.getAppPath(), 'data', 'formulas', 'Formulas_and_Methods.txt')
      : path.join(__dirname, '../../data/formulas/Formulas_and_Methods.txt');

    const content = fs.readFileSync(formulaPath, 'utf-8');

    // Parse position sections
    const positionSections = content.split(/\n([A-Za-z\s]+)\n\n/);

    for (let i = 1; i < positionSections.length; i += 2) {
      const positionName = positionSections[i].trim();
      const formulasText = positionSections[i + 1];

      // Map display names to Madden positions
      const positionMap: { [key: string]: string } = {
        'Quarterbacks': 'QB',
        'Halfback': 'HB',
        'Wide Receiver': 'WR',
        'Tight End': 'TE',
        'Offensive Line': 'OL',
        'Defensive Linemen': 'DT',
        'Linebackers': 'LB',
        'Cornerbacks': 'CB',
        'Safeties': 'S'
      };

      const position = positionMap[positionName] || positionName;
      const positionFormulas: PositionFormulas = {};

      // Parse rating formulas
      const ratingMatches = formulasText.matchAll(/([A-Za-z\s]+)\n\n\s*=(.*)/g);
      for (const match of ratingMatches) {
        const ratingName = match[1].trim().replace(/\s+/g, '');
        const formula = match[2].trim();
        positionFormulas[ratingName] = this.translateFormula(formula);
      }

      this.formulas.set(position, positionFormulas);
    }
  }

  /**
   * Translate Excel-style formula to evaluatable JavaScript
   */
  private translateFormula(formula: string): string {
    // Remove leading =
    formula = formula.replace(/^=/, '');

    // Convert PRODUCT() - just remove wrapper
    formula = formula.replace(/^PRODUCT\((.*)\)$/, '$1');

    // Convert IF(condition, true_val, false_val) to ternary
    formula = formula.replace(/IF\((.*?),\s*(.*?),\s*(.*?)\)/g, '($1 ? $2 : $3)');

    // Convert OR(a,b,c) to (a || b || c)
    formula = formula.replace(/OR\((.*?)\)/g, (match, conditions) => {
      const parts = conditions.split(',').map((c: string) => c.trim());
      return `(${parts.join(' || ')})`;
    });

    // Convert string comparisons: Archetype="Value" to Archetype==="Value"
    formula = formula.replace(/(\w+)="(.*?)"/g, '$1==="$2"');

    return formula;
  }

  /**
   * Evaluate a formula with player data context
   */
  private evaluateFormula(formula: string, context: FormulaContext): number {
    try {
      // Create safe evaluation context
      const func = new Function(...Object.keys(context), `return ${formula};`);
      const result = func(...Object.values(context));

      // Clamp to Madden rating range
      return Math.round(Math.max(40, Math.min(99, result)));
    } catch (error) {
      console.error(`[MaddenFormulaCalculator] Error evaluating formula: ${formula}`, error);
      return 65; // Default fallback
    }
  }

  /**
   * Calculate all secondary ratings for a player
   */
  calculateSecondaryRatings(
    position: string,
    baseAttributes: FormulaContext,
    archetype?: string
  ): { [rating: string]: number } {
    const positionFormulas = this.formulas.get(position);
    if (!positionFormulas) {
      console.warn(`[MaddenFormulaCalculator] No formulas found for position: ${position}`);
      return {};
    }

    const context: FormulaContext = {
      ...baseAttributes,
      Archetype: archetype || ''
    };

    const results: { [rating: string]: number } = {};

    for (const [ratingName, formula] of Object.entries(positionFormulas)) {
      results[ratingName] = this.evaluateFormula(formula, context);
    }

    return results;
  }

  /**
   * Calculate OVR for a player
   */
  calculateOVR(position: string, attributes: FormulaContext, archetype?: string): number {
    const positionFormulas = this.formulas.get(position);
    if (!positionFormulas || !positionFormulas['Overall']) {
      return 65; // Default fallback
    }

    const context: FormulaContext = {
      ...attributes,
      Archetype: archetype || ''
    };

    return this.evaluateFormula(positionFormulas['Overall'], context);
  }
}
```

**Integration Points:**
- Keep existing `RatingCalculator` for stats-based historical generation
- Use `MaddenFormulaCalculator` in editors for auto-recalculation
- Expose via IPC handler for renderer processes

### 3. UI Enhancements - Auto-Calculation

**Auto-Recalculation Flow:**

1. User edits base attribute (SPD, STR, AGI, AWR, etc.)
2. Handsontable `afterChange` hook detects change
3. Call `MaddenFormulaCalculator` to recalculate secondary ratings
4. Update affected cells in table
5. Recalculate OVR based on new secondary ratings

**Implementation in Handsontable:**

```javascript
// In src/renderer/js/app.js (Draft Class Editor)
// In src/renderer/js/franchise-editor.js (similar for franchise)

afterChange: function(changes, source) {
  if (!changes || source === 'loadData') return;

  const instance = this;
  const baseAttributes = ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PJMP', 'PAWR',
                          'PTAD', 'PTAM', 'PTAS', 'PTHP', /* etc */];

  // Check if any base attribute changed
  const needsRecalc = changes.some(([row, prop]) =>
    baseAttributes.includes(prop)
  );

  if (!needsRecalc) return;

  // Batch recalculate all affected rows
  const rowsToRecalc = new Set(changes.map(([row]) => row));

  for (const row of rowsToRecalc) {
    const position = instance.getDataAtRowProp(row, 'position');
    const archetype = instance.getDataAtRowProp(row, 'archetype');

    // Gather current attributes
    const attributes = {};
    baseAttributes.forEach(attr => {
      attributes[attr] = instance.getDataAtRowProp(row, attr);
    });

    // Call backend to recalculate
    window.electronAPI.ratings.calculateSecondaryRatings(position, attributes, archetype)
      .then(secondaryRatings => {
        // Update secondary rating cells
        const updates = [];
        for (const [rating, value] of Object.entries(secondaryRatings)) {
          updates.push([row, rating, value]);
        }

        // Also recalculate OVR
        return window.electronAPI.ratings.calculateOVR(position, {
          ...attributes,
          ...secondaryRatings
        }, archetype).then(ovr => {
          updates.push([row, 'POVR', ovr]);
          instance.setDataAtRowProp(updates);
        });
      });
  }
}
```

**New Columns:**

```javascript
// Birthday column
{
  data: 'birthDate',
  title: 'Birthday',
  type: 'date',
  dateFormat: 'MM/DD/YYYY',
  correctFormat: true,
  renderer: function(instance, td, row, col, prop, value, cellProperties) {
    // Convert encoded value to display format
    const displayValue = value ? DateConverter.encodedToDisplay(value) : '';
    td.textContent = displayValue;
    return td;
  }
}

// Age column (read-only, calculated)
{
  data: 'age',
  title: 'Age',
  type: 'numeric',
  readOnly: true,
  renderer: function(instance, td, row, col, prop, value, cellProperties) {
    const birthDate = instance.getDataAtRowProp(row, 'birthDate');
    const age = birthDate ? DateConverter.calculateAge(birthDate) : '';
    td.textContent = age;
    td.style.backgroundColor = '#2a2a2a'; // Darker to indicate read-only
    return td;
  }
}

// Archetype column (position-specific dropdown)
{
  data: 'archetype',
  title: 'Archetype',
  type: 'dropdown',
  source: function(query, process) {
    // Get position for this row
    const row = this.instance.getSelectedLast()?.[0];
    const position = this.instance.getDataAtRowProp(row, 'position');

    // Get archetypes for this position
    window.electronAPI.lookups.getArchetypes(position)
      .then(archetypes => {
        const names = archetypes.map(a => a.name);
        process(names);
      });
  }
}
```

### 4. Scroll Editing Improvements

**Mouse Wheel Handlers:**

```javascript
// In Handsontable config (app.js, franchise-editor.js)

afterOnCellMouseDown: function(event, coords, TD) {
  const instance = this;

  // Add wheel listener for focused cell
  const wheelHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const cellMeta = instance.getCellMeta(coords.row, coords.col);
    const currentValue = instance.getDataAtCell(coords.row, coords.col);

    if (cellMeta.type === 'numeric') {
      // Numeric: increment/decrement
      const delta = e.shiftKey ? 5 : 1; // Shift = fast scroll
      const direction = e.deltaY < 0 ? 1 : -1;
      const newValue = (currentValue || 0) + (delta * direction);

      // Respect min/max
      const min = cellMeta.min !== undefined ? cellMeta.min : 0;
      const max = cellMeta.max !== undefined ? cellMeta.max : 99;
      const clampedValue = Math.max(min, Math.min(max, newValue));

      instance.setDataAtCell(coords.row, coords.col, clampedValue);

    } else if (cellMeta.type === 'dropdown') {
      // Dropdown: cycle through options
      const options = Array.isArray(cellMeta.source)
        ? cellMeta.source
        : cellMeta.source(null, (opts) => opts); // Handle function source

      const currentIndex = options.indexOf(currentValue);
      const direction = e.deltaY < 0 ? 1 : -1;
      const newIndex = (currentIndex + direction + options.length) % options.length;

      instance.setDataAtCell(coords.row, coords.col, options[newIndex]);
    }
  };

  // Attach listener
  TD.addEventListener('wheel', wheelHandler, { passive: false });

  // Clean up on mouse leave or cell deselect
  const cleanup = () => {
    TD.removeEventListener('wheel', wheelHandler);
  };

  TD.addEventListener('mouseleave', cleanup, { once: true });
  instance.addHook('afterDeselect', cleanup);
}
```

**Smooth Scrolling CSS:**

```css
/* In src/renderer/styles/main.css */

.handsontable .wtHolder {
  scroll-behavior: smooth;
}

/* Disable smooth scroll during fast drag/wheel */
.handsontable .wtHolder.fast-scroll {
  scroll-behavior: auto;
}
```

### 5. Generator Updates

**Draft Class Creator - Add Archetypes:**

```typescript
// In src/main/services/CreatorService.ts

private assignArchetype(position: string, ratings: any): number {
  // Map of position -> archetype rules
  const archetypeRules: { [pos: string]: Array<{ id: number; name: string; condition: (r: any) => boolean }> } = {
    'QB': [
      { id: 0, name: 'Field General', condition: (r) => r.PAWR > 85 && r.PTAD > 80 },
      { id: 1, name: 'Scrambler', condition: (r) => r.PSPD > 85 && r.PAGI > 80 },
      { id: 2, name: 'Strong Arm', condition: (r) => r.PTHP > 90 && r.PTAD < 85 },
      { id: 3, name: 'Improviser', condition: (r) => r.PAGI > 80 && r.PTOR > 75 },
    ],
    'HB': [
      { id: 4, name: 'Power Back', condition: (r) => r.PSTR > 80 && r.PCAR > 85 },
      { id: 5, name: 'Elusive Back', condition: (r) => r.PAGI > 85 && r.PJMP > 80 },
      { id: 6, name: 'Receiving Back', condition: (r) => r.PCTH > 80 && r.SRRN > 75 },
    ],
    'WR': [
      { id: 7, name: 'Deep Threat', condition: (r) => r.PSPD > 90 && r.PLSM > 80 },
      { id: 8, name: 'Possession', condition: (r) => r.PCTH > 85 && r.SRRN > 80 },
      { id: 9, name: 'Slot', condition: (r) => r.PAGI > 85 && r.SRRN > 80 },
    ],
    // Add remaining positions...
  };

  const rules = archetypeRules[position];
  if (!rules) return 0; // Default archetype

  // Find first matching rule
  const match = rules.find(rule => rule.condition(ratings));
  return match?.id || 0;
}

// Update generateProspect method
private async generateProspect(entry: PlayerLookupEntry, targetOVR: number): Promise<any> {
  // ... existing rating generation code ...

  // Add archetype
  const archetype = this.assignArchetype(entry.position, ratings);

  // Add birthday (generate realistic age 20-23)
  const birthDate = this.generateBirthday(entry.draftYear);

  return {
    ...existingProspectData,
    archetype,
    birthDate
  };
}

private generateBirthday(draftYear: number): number {
  // Generate age between 20-23 years old at draft time
  const age = Math.floor(Math.random() * 4) + 20;
  const birthYear = draftYear - age;

  // Random month and day
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1; // Safe for all months

  // Encode as YYYYMMDD
  return (birthYear * 10000) + (month * 100) + day;
}
```

**Roster Creator - Similar Updates:**

```typescript
// In src/main/services/RosterCreatorService.ts

// Add same assignArchetype() and generateBirthday() methods
// Update createRosterFromDraftClasses() to call these for each player
```

## Implementation Order

### Phase 1: Foundation (Backend Services)
**Estimated: 2-3 hours**

1. Create `src/main/services/utils/dateConverter.ts` with birthday conversion utilities
2. Create `src/main/services/utils/archetypeService.ts` with archetype lookups
3. Create `src/main/services/rating-modes/MaddenFormulaCalculator.ts` with formula evaluation
4. Add `data/formulas/Formulas_and_Methods.txt` formula file
5. Create IPC handlers for new services in `src/main/ipc/rating-handlers.ts`

**Files to create/modify:**
- `src/main/services/utils/dateConverter.ts` (new)
- `src/main/services/utils/archetypeService.ts` (new)
- `src/main/services/rating-modes/MaddenFormulaCalculator.ts` (new)
- `data/formulas/Formulas_and_Methods.txt` (new)
- `src/main/ipc/rating-handlers.ts` (modify - add new handlers)
- `src/preload.ts` (modify - expose new APIs)

### Phase 2: Data Layer
**Estimated: 1-2 hours**

1. Update draft class parser to expose `birthDate` and `archetype` fields
2. Update roster parser to include birthday field
3. Test loading files with new fields

**Files to modify:**
- `src/main/lib/draft-class/draftClassFunctions.js` (verify exposure)
- `src/main/ipc/parser-handlers.ts` (ensure new fields passed to renderer)

### Phase 3: UI Implementation - Draft Class Editor
**Estimated: 3-4 hours**

1. Add new columns to Handsontable config (birthday, age, archetype)
2. Implement auto-recalculation in `afterChange` hook
3. Add scroll wheel handlers in `afterOnCellMouseDown`
4. Update portrait rendering to avoid re-render on sort (already done)
5. Test with 2020 draft class

**Files to modify:**
- `src/renderer/js/app.js` (Handsontable config, hooks)
- `src/renderer/styles/main.css` (smooth scrolling)
- `src/renderer/index.html` (if column definitions in HTML)

### Phase 4: UI Implementation - Roster Editor
**Estimated: 2-3 hours**

1. Similar updates to franchise editor Handsontable config
2. Add scroll wheel handlers
3. Test with roster files

**Files to modify:**
- `src/renderer/js/franchise-editor.js`
- `src/renderer/styles/franchise.css`

### Phase 5: Generator Integration
**Estimated: 2-3 hours**

1. Add `assignArchetype()` method to CreatorService
2. Add `generateBirthday()` method to CreatorService
3. Update `generateProspect()` to set archetype and birthday
4. Similar updates to RosterCreatorService
5. Test generation with 2020 draft class

**Files to modify:**
- `src/main/services/CreatorService.ts`
- `src/main/services/RosterCreatorService.ts`

### Phase 6: Testing & Refinement
**Estimated: 2-3 hours**

1. Verify formulas match reference editor outputs (spot check)
2. Test auto-recalculation performance with 300+ player rosters
3. Validate scroll editing UX
4. Ensure file save/load preserves all new fields
5. Add E2E tests for new features

**Files to create/modify:**
- `tests/e2e/editor-enhancements.spec.js` (new)
- Update existing tests if needed

## Total Estimated Time: 12-18 hours

## Success Criteria

- ✅ Birthday displays correctly in editors (MM/DD/YYYY format)
- ✅ Age calculates automatically from birthday
- ✅ Archetype dropdown shows position-specific options
- ✅ Archetype saves/loads correctly from files
- ✅ Secondary ratings auto-recalculate when base attributes change
- ✅ OVR recalculates automatically using Madden formulas
- ✅ Mouse wheel increments/decrements numeric values
- ✅ Mouse wheel cycles through dropdown options
- ✅ Smooth scrolling works in player lists
- ✅ Generators assign realistic archetypes based on attributes
- ✅ Generators create realistic birthdays (ages 20-23 for draft prospects)
- ✅ All changes persist when saving files
- ✅ No performance degradation with large rosters (300+ players)

## Future Enhancements (Out of Scope)

- **Salary editing:** Complex multi-field system with contract years, bonuses, etc. (defer to separate project)
- **wAV boost for UDFAs:** Boost ratings for overperforming undrafted players in realistic mode
- **Decade dropdown fix:** White text visibility, integration with top 400 filter
- **File picker memory:** Remember last used draft template path

## Notes

- Keep existing `RatingCalculator` for historical stats-based generation
- `MaddenFormulaCalculator` is for editor auto-calculation only
- Reference editor at `C:\Users\tshan\Downloads\MaddenRosterEditor-MREv1.1` contains formula file and scroll editing examples
- Birthday encoded as YYYYMMDD integer (e.g., 19980315 = March 15, 1998)
- Archetype IDs are position-specific (QB: 0-3, HB: 4-6, WR: 7-9, etc.)
