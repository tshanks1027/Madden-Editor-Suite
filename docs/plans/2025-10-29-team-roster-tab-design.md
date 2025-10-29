# Team Roster Tab Design

**Date:** 2025-10-29
**Status:** Approved for Implementation
**Scope:** Phase 1 - Team Roster View Only (Depth Chart & Coaches deferred)

## Overview

Build a team-specific roster view in the franchise editor that allows users to:
1. Select a team and view all players on that roster
2. Edit player attributes directly
3. **Save changes back to franchise file** (Madden 26 compatible)

## Critical Constraint

**SAVE INTEGRITY IS PARAMOUNT** - Every design decision must ensure Madden 26 can load the modified file without corruption.

## Architecture

### Data Flow

```
User clicks team card in UI
  ↓
FranchiseEditor.openTeamView(teamIndex)
  ↓
IPC: franchise:get-team-roster
  ↓
franchise-handlers.ts: Load players WHERE Player.TeamIndex === teamIndex
  ↓
Return player data with FULL records (not just display fields)
  ↓
FranchiseEditor renders in Handsontable
  ↓
User edits player attributes
  ↓
Changes tracked in pendingChanges array
  ↓
User clicks Save
  ↓
IPC: franchise:save-changes
  ↓
franchise-handlers.ts: Apply changes + validate + franchise.save()
```

### File Structure

**IPC Handlers** (`src/main/ipc/franchise-handlers.ts`):
- `franchise:get-team-roster` - Load team's players
  - Input: `{ teamIndex: number }`
  - Output: `{ players: PlayerRecord[], teamInfo: TeamInfo }`
  - Implementation: Filter `Player` table by `TeamIndex`

- `franchise:save-changes` - Save all pending changes
  - Input: `{ changes: Change[], filePath: string }`
  - Output: `{ success: boolean, error?: string }`
  - Implementation: Apply changes to records, validate, call `franchise.save()`

**Frontend** (`src/renderer/js/franchise-editor.js`):
- `openTeamView(teamIndex)` - Switch to team detail view
- `renderTeamRoster(players)` - Create Handsontable grid
- Track changes in `this.pendingChanges`

**HTML** (`src/renderer/franchise-editor.html`):
- Add team detail panel (hidden by default)
- Tabbed interface structure (only roster tab active for Phase 1)

## Key Findings from Research

### What Works in Madden 26
1. **Team Table Access**: `franchise.getAllTablesByName('Team')[1]` (index 1, not 0)
2. **Player Filtering**: `Player.TeamIndex` field reliably identifies team membership
3. **Binary References**: Use `field.referenceData` from `fieldsArray`, not manual binary decoding
4. **Coach Access**: `Coach` table with `TeamIndex`, `Position`, contract fields

### What's Problematic
1. **Roster/Depth Chart Arrays**: Referenced table IDs (5907, 5879) don't exist via `getTableByUniqueId()`
2. **Array Table Access**: M26 uses different array table structure than M25

### Workaround Strategy
- **Phase 1**: Use `Player.TeamIndex` for roster (proven to work)
- **Phase 2** (Future): Research depth chart access with working M26 editor as reference

## Save Strategy

### Change Tracking
```typescript
interface Change {
    table: 'Player' | 'Coach' | 'Team';
    recordIndex: number;
    field: string;
    oldValue: any;
    newValue: any;
}

// In FranchiseEditor
this.pendingChanges: Change[] = [];
```

### Save Process
1. User clicks Save button
2. Frontend sends all `pendingChanges` to backend
3. Backend:
   - Loads franchise file
   - Finds each record by index
   - Applies field changes
   - **Validates all references still valid**
   - Calls `franchise.save(filePath)`
4. Returns success/error to frontend
5. Frontend clears `pendingChanges` on success

### Validation Rules
- Never modify table structure
- Preserve all binary references
- Don't change record indices
- Validate enum values (Position, ContractStatus, etc.)
- Check numeric ranges (Overall 40-99, Age 21-40, etc.)

## UI Components

### Team Card Grid (Home View)
- 32 team cards with team colors
- Shows: Logo, Team Name, Record (if available)
- Click → opens team detail view

### Team Detail View
Single team focus with tabs:
- **Roster Tab** (Phase 1) - Player grid with editing
- **Depth Chart Tab** (Phase 2 - placeholder)
- **Coaches Tab** (Phase 2 - placeholder)

### Roster Grid (Handsontable)
Columns:
- Position (dropdown)
- First Name (text)
- Last Name (text)
- Overall (number, 40-99)
- Jersey # (number, 0-99)
- Contract Status (dropdown)
- Years Pro (number)
- Age (number, 21-40)

Features:
- Sortable by any column
- Filter by position
- Search by name
- Inline editing with validation
- Unsaved changes indicator

## Implementation Phases

### Phase 1: Team Roster Tab (Current Scope)
- [ ] Add team card grid to home view
- [ ] Implement `franchise:get-team-roster` handler
- [ ] Build team detail view UI
- [ ] Create Handsontable roster grid
- [ ] Implement change tracking
- [ ] Implement save with validation
- [ ] Test save/load cycle in Madden 26

### Phase 2: Depth Chart & Coaches (Future)
- Research working M26 depth chart access
- Implement depth chart editor
- Implement coach management
- Test complete team management workflow

## Testing Strategy

### Critical Tests
1. **Save/Load Cycle**:
   - Edit player in app
   - Save file
   - Load in Madden 26
   - Verify change persisted

2. **Data Integrity**:
   - Modify multiple players
   - Save
   - Reload in app
   - Verify all changes correct

3. **Validation**:
   - Try invalid values (Overall = 100)
   - Verify rejection
   - Try valid values
   - Verify acceptance

### Manual Testing Checklist
- [ ] Can load team roster
- [ ] Can edit player attributes
- [ ] Changes show in UI immediately
- [ ] Unsaved indicator works
- [ ] Save button enabled when changes exist
- [ ] Save completes without errors
- [ ] Madden 26 loads saved file
- [ ] Changes visible in Madden 26

## Risk Mitigation

### Primary Risk: Save Corruption
**Mitigation:**
- Always backup file before save
- Validate all changes before applying
- Test with Madden 26 after every code change
- Use exact patterns from working editors

### Secondary Risk: Performance
**Mitigation:**
- Paginate large rosters (>100 players)
- Lazy load team data (only when viewed)
- Cache team info to avoid re-parsing

## Success Criteria

Phase 1 is complete when:
1. ✅ User can select any NFL team
2. ✅ All team players load correctly
3. ✅ User can edit any player attribute
4. ✅ Changes save to franchise file
5. ✅ Madden 26 can load modified file
6. ✅ All changes persist in Madden 26

## Future Enhancements (Out of Scope)

- Depth chart editing
- Coach hiring/firing
- Trade interface from team view
- Salary cap management
- Draft pick management
- Team settings (playbook, scheme, etc.)

---

## Technical Notes

### Madden 26 Franchise Library Usage

```javascript
// Load franchise (always use gameYearOverride for M26)
const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

// Get Team table (use index 1)
const teamTable = franchise.getAllTablesByName('Team')[1];
await teamTable.readRecords();

// Filter real teams
const teams = teamTable.records.filter(r => !r.isEmpty);

// Get Player table
const playerTable = franchise.getTableByName('Player');
await playerTable.readRecords();

// Filter players by team
const teamPlayers = playerTable.records.filter(p =>
    !p.isEmpty && p.TeamIndex === targetTeamIndex
);

// Save changes
franchise.save(filePath);
```

### Binary Reference Pattern

```javascript
// WRONG: Manual binary decoding
const tableId = parseInt(binary.substring(0, 16), 2); // ❌

// RIGHT: Use library's referenceData
const field = record.fieldsArray.find(f => f.key === 'FieldName');
const { tableId, rowNumber } = field.referenceData; // ✅
```

## Open Questions

1. **Roster Array Tables**: Why don't tables 5907/5879 exist? Need to research if:
   - Library initialization is different for M26
   - Tables are created dynamically
   - Different API method needed

2. **Depth Chart Access**: How do working M26 editors handle depth charts?
   - Check if MyFranchise supports M26
   - Find other M26 franchise editors
   - Contact madden-franchise library maintainer

These questions don't block Phase 1 (team roster) but must be answered for Phase 2.
