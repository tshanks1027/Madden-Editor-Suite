# Team Roster Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build team-specific roster view that loads players by TeamIndex, allows editing, and **saves changes to Madden 26 franchise files with verified save integrity**.

**Architecture:** Extend existing franchise-editor.js and franchise-handlers.ts structure. Uses existing `loadFranchiseFile()` flow, existing Handsontable patterns, existing save methods. Adds team cards → team detail → roster grid with inline editing.

**Tech Stack:** TypeScript (backend), Vanilla JS (frontend), Handsontable (existing), madden-franchise library (existing with gameYearOverride: 26)

**Critical Save Requirements:**
- Test EVERY save in Madden 26 after implementation
- Use existing `Franchise.create(filePath, { gameYearOverride: 26 })` pattern
- Create backups before every save
- Validate all changes before applying
- Preserve all binary references and table structures

---

## Task 1: Add Backend Handler for Team Roster Loading

**Files:**
- Modify: `src/main/ipc/franchise-handlers.ts` (add after existing handlers, around line 500)

**Context:** This file already has `franchise:load-file` and `franchise:select-file` handlers. We're adding a new handler that filters players by TeamIndex.

**Step 1: Add get-team-roster IPC handler**

Add this function after the existing handlers (around line 500, before any export statements):

```typescript
/**
 * Get all players for a specific team
 */
ipcMain.handle('franchise:get-team-roster', async (event, { filePath, teamIndex }) => {
  try {
    console.log(`[Franchise] Loading roster for team ${teamIndex} from ${filePath}`);

    const Franchise = require('madden-franchise');
    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    // Get Team table (use index 1 for M26)
    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1];
    await teamTable.readRecords();

    // Find the team
    const team = teamTable.records.find(r => !r.isEmpty && r.TeamIndex === teamIndex);
    if (!team) {
      throw new Error(`Team with index ${teamIndex} not found`);
    }

    // Get Player table
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    // Filter players by TeamIndex
    const teamPlayers = playerTable.records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => !record.isEmpty && record.TeamIndex === teamIndex)
      .map(({ record, index }) => ({
        recordIndex: index,
        firstName: record.FirstName || '',
        lastName: record.LastName || '',
        position: record.Position || '',
        overall: record.Overall,
        age: record.Age || 0,
        yearsPro: record.YearsPro || 0,
        jerseyNum: record.JerseyNum || 0,
        contractStatus: record.ContractStatus || '',
        college: record.College || '',
        teamIndex: record.TeamIndex
      }));

    console.log(`[Franchise] Found ${teamPlayers.length} players for team ${teamIndex}`);

    return {
      success: true,
      teamInfo: {
        teamIndex: team.TeamIndex,
        displayName: team.DisplayName || team.LongName || 'Unknown',
        city: team.City || '',
        abbreviation: team.TEAM_ABBR || ''
      },
      players: teamPlayers
    };
  } catch (error) {
    console.error('[Franchise] Error loading team roster:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
```

**Step 2: Register handler in registerFranchiseHandlers**

No changes needed - `ipcMain.handle` auto-registers. But verify the function is placed before `export function registerFranchiseHandlers()`.

**Step 3: Test with Node script**

Create test file: `test-team-roster-handler.js`

```javascript
const { app } = require('electron');
const path = require('path');

// Simulate the IPC call
async function testTeamRosterHandler() {
  const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST');

  const Franchise = require('madden-franchise');
  const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

  const teamTables = franchise.getAllTablesByName('Team');
  const teamTable = teamTables[1];
  await teamTable.readRecords();

  const team = teamTable.records.find(r => !r.isEmpty && r.TeamIndex === 14);
  console.log('Team:', team.DisplayName);

  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  const teamPlayers = playerTable.records
    .filter(r => !r.isEmpty && r.TeamIndex === 14);

  console.log(`Found ${teamPlayers.length} players`);
  console.log('First 3 players:');
  teamPlayers.slice(0, 3).forEach(p => {
    console.log(`  ${p.FirstName} ${p.LastName} - ${p.Position}`);
  });
}

testTeamRosterHandler().catch(console.error);
```

Run: `node test-team-roster-handler.js`
Expected: Prints team name and 3 players

**Step 4: Test save integrity (CRITICAL)**

Before committing, verify the handler doesn't break existing saves:

```bash
# Run the app
npm start

# In the app:
# 1. Load your test franchise
# 2. Make NO changes
# 3. Click Save (using existing save functionality)
# 4. Close app
# 5. Open Madden 26
# 6. Load franchise
# Expected: Franchise loads without corruption
```

**Step 5: Commit**

```bash
git add src/main/ipc/franchise-handlers.ts test-team-roster-handler.js
git commit -m "feat(franchise): add team roster loading IPC handler

- Add franchise:get-team-roster handler
- Filters players by TeamIndex using Player.TeamIndex field
- Returns team info + player array with recordIndex for saves
- Uses existing Franchise.create() pattern with gameYearOverride: 26
- Tested with 49ers (TeamIndex 14)
- Verified existing save functionality still works

🤖 Generated with Claude Code"
```

---

## Task 2: Add Preload API for Team Roster

**Files:**
- Modify: `src/preload.ts` (add to `franchise` object in `contextBridge.exposeInMainWorld`)

**Step 1: Add getTeamRoster to preload API**

Find the `franchise` object in `contextBridge.exposeInMainWorld('electronAPI', ...)` and add:

```typescript
franchise: {
  // ... existing methods ...

  getTeamRoster: (filePath: string, teamIndex: number) =>
    ipcRenderer.invoke('franchise:get-team-roster', { filePath, teamIndex }),
}
```

**Step 2: Verify preload builds without errors**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/preload.ts
git commit -m "feat(preload): expose getTeamRoster API

Allows renderer to request team-specific roster data

🤖 Generated with Claude Code"
```

---

## Task 3: Add Team Cards Grid UI

**Files:**
- Modify: `src/renderer/franchise-editor.html` (add after tools-content div, before scripts)

**Step 1: Add team cards container HTML**

Add this HTML after the closing `</div>` of `tools-content` and before the `<script>` tags:

```html
<!-- Team Cards Grid View -->
<div id="team-cards-view" class="team-cards-view" style="display: none;">
  <div class="team-cards-header">
    <h2>Select a Team</h2>
    <button id="back-to-roster-btn" class="btn btn-secondary">
      <i class="fas fa-arrow-left"></i> Back to Full Roster
    </button>
  </div>

  <div id="team-cards-grid" class="team-cards-grid">
    <!-- Team cards will be populated by JavaScript -->
  </div>
</div>
```

**Step 2: Add CSS for team cards**

Add to `src/renderer/styles/main.css` (at end of file):

```css
/* Team Cards Grid */
.team-cards-view {
  padding: 20px;
}

.team-cards-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.team-cards-header h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.team-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  max-width: 1400px;
}

.team-card {
  background: #fff;
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.team-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  border-color: #007bff;
}

.team-card-name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.team-card-city {
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
}

.team-card-abbr {
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 1px;
}
```

**Step 3: Verify HTML/CSS loads without errors**

Run: `npm start`
Navigate to franchise editor
Expected: No console errors, team cards view exists (hidden)

**Step 4: Commit**

```bash
git add src/renderer/franchise-editor.html src/renderer/styles/main.css
git commit -m "feat(ui): add team cards grid structure

- Add team cards container HTML
- Add team card grid CSS
- Hidden by default, will populate with JS

🤖 Generated with Claude Code"
```

---

## Task 4: Populate Team Cards with Data

**Files:**
- Modify: `src/renderer/js/franchise-editor.js`

**Step 1: Add showTeamCards method**

Add this method to the `FranchiseEditor` class (after `setupEventListeners()`):

```javascript
/**
 * Show team cards grid view
 */
showTeamCards() {
    console.log('[FranchiseEditor] Showing team cards view');

    // Hide other views
    document.getElementById('tools-content').style.display = 'none';
    document.getElementById('team-cards-view').style.display = 'block';

    // Populate team cards
    this.populateTeamCards();
}

/**
 * Populate team cards from NFL_TEAMS data
 */
populateTeamCards() {
    const cardsContainer = document.getElementById('team-cards-grid');
    cardsContainer.innerHTML = '';

    const teams = getAllTeams();

    teams.forEach(team => {
        const card = document.createElement('div');
        card.className = 'team-card';
        card.dataset.teamIndex = team.teamIndex;

        // Apply team colors
        card.style.borderColor = team.primaryColor;
        card.style.background = `linear-gradient(135deg, ${team.primaryColor}15, ${team.secondaryColor}15)`;

        card.innerHTML = `
            <div class="team-card-name">${team.displayName}</div>
            <div class="team-card-city">${team.city}</div>
            <div class="team-card-abbr">${team.abbreviation}</div>
        `;

        card.addEventListener('click', () => {
            this.openTeamView(parseInt(card.dataset.teamIndex, 10));
        });

        cardsContainer.appendChild(card);
    });

    console.log(`[FranchiseEditor] Populated ${teams.length} team cards`);
}
```

**Step 2: Add button to show team cards**

Find the tools toolbar in `franchise-editor.html` and add a button:

```html
<button id="show-teams-btn" class="btn btn-primary">
    <i class="fas fa-users"></i> View Teams
</button>
```

**Step 3: Add event listener for show teams button**

In `setupEventListeners()` method, add:

```javascript
// Show teams button
const showTeamsBtn = document.getElementById('show-teams-btn');
if (showTeamsBtn) {
    showTeamsBtn.addEventListener('click', () => this.showTeamCards());
}

// Back to roster button
const backToRosterBtn = document.getElementById('back-to-roster-btn');
if (backToRosterBtn) {
    backToRosterBtn.addEventListener('click', () => {
        document.getElementById('team-cards-view').style.display = 'none';
        document.getElementById('tools-content').style.display = 'block';
    });
}
```

**Step 4: Test team cards display**

Run: `npm start`
Load a franchise file
Click "View Teams" button
Expected: See 32 team cards with colors

**Step 5: Commit**

```bash
git add src/renderer/js/franchise-editor.js src/renderer/franchise-editor.html
git commit -m "feat(ui): populate team cards with NFL teams

- Add showTeamCards() and populateTeamCards() methods
- Apply team colors to cards
- Add View Teams button
- Wire up click handlers

🤖 Generated with Claude Code"
```

---

## Task 5: Create Team Detail View UI

**Files:**
- Modify: `src/renderer/franchise-editor.html`

**Step 1: Add team detail view HTML**

Add after the `team-cards-view` div:

```html
<!-- Team Detail View -->
<div id="team-detail-view" class="team-detail-view" style="display: none;">
  <div class="team-detail-header">
    <div class="team-detail-info">
      <button id="back-to-teams-btn" class="btn btn-secondary">
        <i class="fas fa-arrow-left"></i> Back to Teams
      </button>
      <h2 id="team-detail-name">Team Name</h2>
    </div>
    <div class="team-detail-actions">
      <button id="team-save-btn" class="btn btn-success" disabled>
        <i class="fas fa-save"></i> Save Changes
      </button>
    </div>
  </div>

  <!-- Tabs for different team views -->
  <div class="team-detail-tabs">
    <button class="team-tab active" data-team-tab="roster">
      <i class="fas fa-users"></i> Roster
    </button>
    <button class="team-tab" data-team-tab="depth" disabled>
      <i class="fas fa-chart-line"></i> Depth Chart (Phase 2)
    </button>
    <button class="team-tab" data-team-tab="coaches" disabled>
      <i class="fas fa-clipboard-user"></i> Coaches (Phase 2)
    </button>
  </div>

  <!-- Tab content -->
  <div class="team-detail-content">
    <div id="team-roster-tab" class="team-tab-content active">
      <div id="team-roster-grid"></div>
    </div>
    <div id="team-depth-tab" class="team-tab-content">
      <p>Depth chart editing coming in Phase 2</p>
    </div>
    <div id="team-coaches-tab" class="team-tab-content">
      <p>Coach management coming in Phase 2</p>
    </div>
  </div>
</div>
```

**Step 2: Add CSS for team detail view**

Add to `src/renderer/styles/main.css`:

```css
/* Team Detail View */
.team-detail-view {
  padding: 20px;
}

.team-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #ddd;
}

.team-detail-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.team-detail-info h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}

.team-detail-actions {
  display: flex;
  gap: 10px;
}

.team-detail-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid #ddd;
}

.team-tab {
  padding: 12px 24px;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 16px;
  color: #666;
  transition: all 0.2s ease;
}

.team-tab:hover:not(:disabled) {
  color: #007bff;
  border-bottom-color: #007bff;
}

.team-tab.active {
  color: #007bff;
  border-bottom-color: #007bff;
  font-weight: 600;
}

.team-tab:disabled {
  color: #ccc;
  cursor: not-allowed;
}

.team-tab-content {
  display: none;
}

.team-tab-content.active {
  display: block;
}

#team-roster-grid {
  min-height: 400px;
}
```

**Step 3: Verify UI renders**

Run: `npm start`
Expected: Team detail view HTML exists (hidden)

**Step 4: Commit**

```bash
git add src/renderer/franchise-editor.html src/renderer/styles/main.css
git commit -m "feat(ui): add team detail view structure

- Add team detail header with save button
- Add tabbed interface (roster/depth/coaches)
- Add roster grid container
- Phase 2 tabs disabled

🤖 Generated with Claude Code"
```

---

## Task 6: Implement openTeamView Method

**Files:**
- Modify: `src/renderer/js/franchise-editor.js`

**Step 1: Add openTeamView method**

Add this method to `FranchiseEditor` class:

```javascript
/**
 * Open team detail view for a specific team
 */
async openTeamView(teamIndex) {
    console.log(`[FranchiseEditor] Opening team view for team ${teamIndex}`);

    if (!this.currentFile) {
        this.showError('No franchise file loaded');
        return;
    }

    try {
        this.updateStatus('Loading team roster...');

        // Call IPC to get team roster
        const result = await window.electronAPI.franchise.getTeamRoster(this.currentFile, teamIndex);

        if (!result.success) {
            throw new Error(result.error || 'Failed to load team roster');
        }

        // Store team data
        this.currentTeamIndex = teamIndex;
        this.currentTeamInfo = result.teamInfo;
        this.currentTeamPlayers = result.players;

        // Switch to team detail view
        document.getElementById('team-cards-view').style.display = 'none';
        document.getElementById('team-detail-view').style.display = 'block';

        // Update header
        document.getElementById('team-detail-name').textContent = result.teamInfo.displayName;

        // Render team roster grid
        this.renderTeamRosterGrid(result.players);

        this.updateStatus(`Loaded ${result.players.length} players for ${result.teamInfo.displayName}`);
    } catch (error) {
        console.error('[FranchiseEditor] Error opening team view:', error);
        this.showError(`Failed to load team: ${error.message}`);
    }
}
```

**Step 2: Add back to teams button handler**

In `setupEventListeners()`, add:

```javascript
// Back to teams button
const backToTeamsBtn = document.getElementById('back-to-teams-btn');
if (backToTeamsBtn) {
    backToTeamsBtn.addEventListener('click', () => {
        document.getElementById('team-detail-view').style.display = 'none';
        document.getElementById('team-cards-view').style.display = 'block';
    });
}
```

**Step 3: Test team view opens**

Run: `npm start`
Load franchise file
Click "View Teams"
Click a team card
Expected: Team detail view opens, header shows team name

**Step 4: Commit**

```bash
git add src/renderer/js/franchise-editor.js
git commit -m "feat(team): implement openTeamView method

- Calls franchise:get-team-roster IPC
- Stores team data in editor state
- Switches to team detail view
- Updates header with team name

🤖 Generated with Claude Code"
```

---

## Task 7: Render Team Roster in Handsontable

**Files:**
- Modify: `src/renderer/js/franchise-editor.js`

**Step 1: Add renderTeamRosterGrid method**

Add this method to `FranchiseEditor` class:

```javascript
/**
 * Render team roster in Handsontable grid
 */
renderTeamRosterGrid(players) {
    console.log(`[FranchiseEditor] Rendering team roster grid with ${players.length} players`);

    const container = document.getElementById('team-roster-grid');

    // Destroy existing grid if it exists
    if (this.teamRosterGrid) {
        this.teamRosterGrid.destroy();
    }

    // Define columns
    const columns = [
        { data: 'position', title: 'Pos', width: 60, type: 'text' },
        { data: 'firstName', title: 'First Name', width: 120, type: 'text' },
        { data: 'lastName', title: 'Last Name', width: 120, type: 'text' },
        { data: 'overall', title: 'OVR', width: 60, type: 'numeric' },
        { data: 'jerseyNum', title: '#', width: 50, type: 'numeric' },
        { data: 'age', title: 'Age', width: 60, type: 'numeric' },
        { data: 'yearsPro', title: 'Exp', width: 60, type: 'numeric' },
        { data: 'contractStatus', title: 'Status', width: 100, type: 'text' }
    ];

    // Create Handsontable instance
    this.teamRosterGrid = new Handsontable(container, {
        data: players,
        columns: columns,
        colHeaders: true,
        rowHeaders: true,
        height: 600,
        licenseKey: 'non-commercial-and-evaluation',
        stretchH: 'all',
        manualColumnResize: true,
        manualRowResize: false,
        contextMenu: true,
        filters: true,
        dropdownMenu: true,
        columnSorting: true,
        afterChange: (changes, source) => {
            if (source !== 'loadData' && changes) {
                this.handleTeamRosterChange(changes);
            }
        }
    });

    console.log('[FranchiseEditor] Team roster grid rendered');
}
```

**Step 2: Add handleTeamRosterChange stub**

Add this method (we'll implement change tracking next):

```javascript
/**
 * Handle changes to team roster grid
 */
handleTeamRosterChange(changes) {
    console.log('[FranchiseEditor] Roster changes detected:', changes);
    // TODO: Track changes for save
}
```

**Step 3: Test roster grid renders**

Run: `npm start`
Load franchise
View teams → Click a team
Expected: See roster grid with player data

**Step 4: Commit**

```bash
git add src/renderer/js/franchise-editor.js
git commit -m "feat(team): render team roster in Handsontable

- Create Handsontable grid for team roster
- Display position, name, OVR, jersey, age, exp, status
- Enable sorting and filtering
- Add afterChange handler stub

🤖 Generated with Claude Code"
```

---

## Task 8: Implement Change Tracking

**Files:**
- Modify: `src/renderer/js/franchise-editor.js`

**Step 1: Add pendingChanges property to constructor**

In `FranchiseEditor` constructor, add:

```javascript
// Change tracking for team roster
this.pendingChanges = [];
```

**Step 2: Implement handleTeamRosterChange**

Replace the stub with:

```javascript
/**
 * Handle changes to team roster grid
 */
handleTeamRosterChange(changes) {
    console.log('[FranchiseEditor] Roster changes detected:', changes);

    changes.forEach(([row, prop, oldValue, newValue]) => {
        if (oldValue === newValue) return;

        const player = this.currentTeamPlayers[row];

        // Add change to pending changes
        this.pendingChanges.push({
            table: 'Player',
            recordIndex: player.recordIndex,
            field: this.mapFieldNameToFranchiseField(prop),
            oldValue,
            newValue
        });
    });

    // Enable save button if there are changes
    this.updateSaveButtonState();

    console.log(`[FranchiseEditor] ${this.pendingChanges.length} pending changes`);
}

/**
 * Map frontend field names to franchise table field names
 */
mapFieldNameToFranchiseField(frontendField) {
    const fieldMap = {
        'firstName': 'FirstName',
        'lastName': 'LastName',
        'position': 'Position',
        'overall': 'Overall',
        'age': 'Age',
        'yearsPro': 'YearsPro',
        'jerseyNum': 'JerseyNum',
        'contractStatus': 'ContractStatus'
    };

    return fieldMap[frontendField] || frontendField;
}

/**
 * Update save button enabled/disabled state
 */
updateSaveButtonState() {
    const saveBtn = document.getElementById('team-save-btn');
    if (saveBtn) {
        saveBtn.disabled = this.pendingChanges.length === 0;

        if (this.pendingChanges.length > 0) {
            saveBtn.innerHTML = `<i class="fas fa-save"></i> Save Changes (${this.pendingChanges.length})`;
        } else {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
    }
}
```

**Step 3: Test change tracking**

Run: `npm start`
Load franchise → View teams → Open team
Edit a player's name or OVR
Expected: Save button enables, shows count of changes

**Step 4: Commit**

```bash
git add src/renderer/js/franchise-editor.js
git commit -m "feat(team): implement change tracking for roster edits

- Track all changes in pendingChanges array
- Map frontend field names to franchise fields
- Update save button state with change count
- Log changes to console

🤖 Generated with Claude Code"
```

---

## Task 9: Add Backend Save Handler (CRITICAL - SAVE INTEGRITY)

**Files:**
- Modify: `src/main/ipc/franchise-handlers.ts`

**Context:** This is the MOST CRITICAL task. The save handler must preserve all franchise file integrity for Madden 26. We'll use the same pattern as existing franchise save code.

**Step 1: Add save-team-changes IPC handler**

Add after the existing handlers (use same Franchise.create pattern as existing code):

```typescript
/**
 * Save team roster changes to franchise file
 */
ipcMain.handle('franchise:save-team-changes', async (event, { filePath, changes }) => {
  try {
    console.log(`[Franchise] Saving ${changes.length} changes to ${filePath}`);

    // Backup file first
    const backupPath = `${filePath}.backup`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`[Franchise] Created backup: ${backupPath}`);

    const Franchise = require('madden-franchise');
    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    // Get Player table
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    // Apply changes
    let appliedCount = 0;
    for (const change of changes) {
      if (change.table === 'Player') {
        const record = playerTable.records[change.recordIndex];
        if (record && !record.isEmpty) {
          // Validate field exists
          if (record[change.field] === undefined) {
            console.warn(`[Franchise] Field ${change.field} not found on record ${change.recordIndex}`);
            continue;
          }

          // Apply change
          record[change.field] = change.newValue;
          appliedCount++;
          console.log(`[Franchise] Applied: Player[${change.recordIndex}].${change.field} = ${change.newValue}`);
        } else {
          console.warn(`[Franchise] Record ${change.recordIndex} not found or empty`);
        }
      }
    }

    // Save franchise file
    await franchise.save(filePath);
    console.log(`[Franchise] Saved ${appliedCount} changes to franchise file`);

    return {
      success: true,
      appliedCount,
      totalChanges: changes.length
    };
  } catch (error) {
    console.error('[Franchise] Error saving team changes:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
```

**Step 2: Add to preload API**

In `src/preload.ts`, add to `franchise` object:

```typescript
saveTeamChanges: (filePath: string, changes: any[]) =>
  ipcRenderer.invoke('franchise:save-team-changes', { filePath, changes }),
```

**Step 3: Test save handler (manual Node script)**

Create `test-save-changes.js`:

```javascript
const path = require('path');
const fs = require('fs');

async function testSaveChanges() {
  const Franchise = require('madden-franchise');
  const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST');

  // Backup
  fs.copyFileSync(filePath, `${filePath}.test-backup`);

  const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });
  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  // Find a player
  const player = playerTable.records.find(r => !r.isEmpty && r.FirstName);
  console.log('Before:', player.FirstName, player.LastName, 'Age:', player.Age);

  // Make a change
  player.Age = 25;

  // Save
  await franchise.save(filePath);
  console.log('Saved!');

  // Reload and verify
  const franchise2 = await Franchise.create(filePath, { gameYearOverride: 26 });
  const playerTable2 = franchise2.getTableByName('Player');
  await playerTable2.readRecords();
  const player2 = playerTable2.records[playerTable.records.indexOf(player)];
  console.log('After:', player2.FirstName, player2.LastName, 'Age:', player2.Age);

  // Restore backup
  fs.copyFileSync(`${filePath}.test-backup`, filePath);
  console.log('Restored backup');
}

testSaveChanges().catch(console.error);
```

Run: `node test-save-changes.js`
Expected: Shows before/after age change, saves and verifies

**Step 4: Commit**

```bash
git add src/main/ipc/franchise-handlers.ts src/preload.ts test-save-changes.js
git commit -m "feat(franchise): add team roster save handler

- Add franchise:save-team-changes IPC handler
- Backup file before save
- Apply changes to Player table records
- Save and return applied count
- Add preload API method

🤖 Generated with Claude Code"
```

---

## Task 10: Wire Up Save Button

**Files:**
- Modify: `src/renderer/js/franchise-editor.js`

**Step 1: Add saveTeamChanges method**

Add to `FranchiseEditor` class:

```javascript
/**
 * Save team roster changes
 */
async saveTeamChanges() {
    if (this.pendingChanges.length === 0) {
        this.showError('No changes to save');
        return;
    }

    if (!this.currentFile) {
        this.showError('No franchise file loaded');
        return;
    }

    try {
        this.updateStatus(`Saving ${this.pendingChanges.length} changes...`);

        const result = await window.electronAPI.franchise.saveTeamChanges(
            this.currentFile,
            this.pendingChanges
        );

        if (!result.success) {
            throw new Error(result.error || 'Failed to save changes');
        }

        // Clear pending changes
        this.pendingChanges = [];
        this.updateSaveButtonState();

        this.updateStatus(`Saved ${result.appliedCount} changes successfully`);
        this.showSuccess(`Saved ${result.appliedCount} changes to franchise file`);
    } catch (error) {
        console.error('[FranchiseEditor] Error saving team changes:', error);
        this.showError(`Failed to save: ${error.message}`);
    }
}

/**
 * Show success message (add if not exists)
 */
showSuccess(message) {
    // Simple alert for now, can be replaced with toast notification
    alert(message);
}
```

**Step 2: Add save button event listener**

In `setupEventListeners()`, add:

```javascript
// Team save button
const teamSaveBtn = document.getElementById('team-save-btn');
if (teamSaveBtn) {
    teamSaveBtn.addEventListener('click', () => this.saveTeamChanges());
}
```

**Step 3: Test complete save flow**

Run: `npm start`
Load franchise
View teams → Open team
Edit player (change age or name)
Click "Save Changes"
Expected: Success message, save button disables

**Step 4: Verify changes in Madden 26 (MANDATORY)**

**Test 1: Single attribute change**
1. Run: `npm start`
2. Load your test franchise (CAREER-TEST or similar)
3. Note a player's current age (e.g., "John Smith, Age 24")
4. View Teams → Click team → Find player
5. Change age from 24 → 25
6. Click "Save Changes"
7. Wait for success message
8. Close app completely
9. Open Madden 26
10. Load the franchise
11. Navigate to that player
12. Expected: Age shows 25

**Test 2: Multiple attributes**
1. Run: `npm start`
2. Load franchise
3. Open team
4. Change player: Age 24→25, Jersey 12→13, YearsPro 2→3
5. Save
6. Close app
7. Open Madden 26, load franchise
8. Expected: ALL three changes present

**Test 3: Franchise still playable**
1. In Madden 26 with edited franchise loaded
2. Play a game
3. Advance week
4. Expected: No crashes, franchise progresses normally

**Step 5: Commit**

```bash
git add src/renderer/js/franchise-editor.js
git commit -m "feat(team): wire up save button to save changes

- Add saveTeamChanges() method
- Call franchise:save-team-changes IPC
- Clear pending changes on success
- Show success/error messages
- Tested with Madden 26 save/load cycle

🤖 Generated with Claude Code"
```

---

## Task 11: Add Tab Switching for Team Detail View

**Files:**
- Modify: `src/renderer/js/franchise-editor.js`

**Step 1: Add team tab switching in setupEventListeners**

In `setupEventListeners()`, add:

```javascript
// Team detail tabs
document.querySelectorAll('.team-tab[data-team-tab]').forEach(tab => {
    tab.addEventListener('click', (e) => {
        if (tab.disabled) return;

        const tabName = tab.dataset.teamTab;

        // Update active tab
        document.querySelectorAll('.team-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show corresponding content
        document.querySelectorAll('.team-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`team-${tabName}-tab`).classList.add('active');
    });
});
```

**Step 2: Test tab switching**

Run: `npm start`
Load franchise → Open team
Click between Roster/Depth Chart/Coaches tabs
Expected: Only Roster tab is functional, others show placeholder text

**Step 3: Commit**

```bash
git add src/renderer/js/franchise-editor.js
git commit -m "feat(team): add tab switching for team detail view

- Wire up team tab click handlers
- Switch active tab and content
- Depth Chart and Coaches tabs remain disabled (Phase 2)

🤖 Generated with Claude Code"
```

---

## Task 12: Add Validation for Player Edits

**Files:**
- Modify: `src/renderer/js/franchise-editor.js`

**Step 1: Add validation to renderTeamRosterGrid**

Modify the Handsontable configuration in `renderTeamRosterGrid()` to add validators:

```javascript
// Update columns with validators
const columns = [
    {
        data: 'position',
        title: 'Pos',
        width: 60,
        type: 'text'
    },
    {
        data: 'firstName',
        title: 'First Name',
        width: 120,
        type: 'text',
        validator: (value, callback) => {
            if (!value || value.trim().length === 0) {
                callback(false);
            } else {
                callback(true);
            }
        }
    },
    {
        data: 'lastName',
        title: 'Last Name',
        width: 120,
        type: 'text',
        validator: (value, callback) => {
            if (!value || value.trim().length === 0) {
                callback(false);
            } else {
                callback(true);
            }
        }
    },
    {
        data: 'overall',
        title: 'OVR',
        width: 60,
        type: 'numeric',
        validator: (value, callback) => {
            const num = parseInt(value, 10);
            callback(!isNaN(num) && num >= 40 && num <= 99);
        }
    },
    {
        data: 'jerseyNum',
        title: '#',
        width: 50,
        type: 'numeric',
        validator: (value, callback) => {
            const num = parseInt(value, 10);
            callback(!isNaN(num) && num >= 0 && num <= 99);
        }
    },
    {
        data: 'age',
        title: 'Age',
        width: 60,
        type: 'numeric',
        validator: (value, callback) => {
            const num = parseInt(value, 10);
            callback(!isNaN(num) && num >= 21 && num <= 40);
        }
    },
    {
        data: 'yearsPro',
        title: 'Exp',
        width: 60,
        type: 'numeric',
        validator: (value, callback) => {
            const num = parseInt(value, 10);
            callback(!isNaN(num) && num >= 0 && num <= 25);
        }
    },
    {
        data: 'contractStatus',
        title: 'Status',
        width: 100,
        type: 'text'
    }
];
```

**Step 2: Test validation**

Run: `npm start`
Load franchise → Open team
Try to set:
- Overall to 100 (should fail - max 99)
- Age to 15 (should fail - min 21)
- Jersey to -1 (should fail - min 0)
Expected: Invalid cells highlighted in red, can't save

**Step 3: Commit**

```bash
git add src/renderer/js/franchise-editor.js
git commit -m "feat(team): add validation for player attribute edits

- Validate Overall (40-99)
- Validate Age (21-40)
- Validate Jersey # (0-99)
- Validate Years Pro (0-25)
- Validate names not empty
- Invalid cells highlighted red

🤖 Generated with Claude Code"
```

---

## Task 13: Final Testing and Documentation

**Files:**
- Create: `docs/TEAM_ROSTER_USAGE.md`

**Step 1: Create usage documentation**

```markdown
# Team Roster Tab Usage Guide

## Overview

The Team Roster tab allows you to view and edit players for a specific NFL team in your franchise file.

## How to Use

### 1. Load Franchise File

Click "Load File" and select your Madden 26 franchise file.

### 2. View Teams

Click the "View Teams" button in the toolbar to see all 32 NFL teams.

### 3. Select a Team

Click on any team card to open the team detail view.

### 4. Edit Players

In the Roster tab:
- Click any cell to edit player attributes
- Valid ranges:
  - Overall: 40-99
  - Age: 21-40
  - Jersey #: 0-99
  - Years Pro: 0-25
- Invalid values will be highlighted in red

### 5. Save Changes

When you've made edits:
- The "Save Changes" button will enable and show the count of pending changes
- Click "Save Changes" to write to the franchise file
- A backup is automatically created (filename.backup)
- Changes are immediately persisted

### 6. Verify in Madden 26

1. Close the editor
2. Open Madden 26
3. Load your franchise
4. Navigate to the team and player you edited
5. Verify the changes are present

## Limitations (Phase 1)

- **Depth Chart editing**: Not yet available (Phase 2)
- **Coach management**: Not yet available (Phase 2)
- **Roster moves**: Cannot move players between teams yet
- **Contract editing**: Not yet available

## Troubleshooting

### Changes not saving
- Check console for errors (F12)
- Verify file isn't read-only
- Ensure backup has disk space

### Madden 26 won't load franchise
- Restore from backup (.backup file)
- Check that you're using gameYearOverride: 26
- Verify all changes were valid (no 0 refs, invalid enums)

### Player data looks wrong
- Reload the team view
- Check if filtering is applied
- Verify franchise file version matches M26

## Technical Notes

- Uses `Player.TeamIndex` for filtering
- Saves use `madden-franchise` library's `.save()` method
- Backups created before every save
- Changes tracked in memory until save
```

**Step 2: Create manual test checklist**

Create `docs/plans/team-roster-test-checklist.md`:

```markdown
# Team Roster Tab Test Checklist

## Pre-Testing Setup
- [ ] Have a test franchise file (CAREER-TEST or similar)
- [ ] Know a player's current stats for verification
- [ ] Have Madden 26 closed

## Functional Tests

### Load and Display
- [ ] Load franchise file successfully
- [ ] Click "View Teams" shows 32 team cards
- [ ] Team cards show correct names and colors
- [ ] Click a team card opens team detail view
- [ ] Team name shows in header
- [ ] Roster grid displays with all players
- [ ] Player count matches expected roster size

### Editing
- [ ] Can edit First Name
- [ ] Can edit Last Name
- [ ] Can edit Overall rating
- [ ] Can edit Age
- [ ] Can edit Jersey Number
- [ ] Can edit Years Pro
- [ ] Invalid Overall (100) rejected
- [ ] Invalid Age (15) rejected
- [ ] Invalid Jersey (-1) rejected

### Change Tracking
- [ ] Save button disabled initially
- [ ] Save button enables after edit
- [ ] Save button shows change count
- [ ] Multiple edits increase count correctly

### Saving
- [ ] Click Save shows "saving" status
- [ ] Save completes without errors
- [ ] Success message appears
- [ ] Save button disables after save
- [ ] Backup file created (.backup extension)

### Madden 26 Integration
- [ ] Close editor after save
- [ ] Open Madden 26
- [ ] Load edited franchise
- [ ] Navigate to edited player
- [ ] Verify edit persisted (e.g., age changed)
- [ ] Play a game (optional stress test)
- [ ] Franchise still functional

### Navigation
- [ ] "Back to Teams" returns to team cards
- [ ] "Back to Roster" returns to full roster (if button exists)
- [ ] Tab switching works (Roster tab)
- [ ] Depth Chart tab shows Phase 2 message
- [ ] Coaches tab shows Phase 2 message

## Edge Cases
- [ ] Edit then navigate away without saving (data lost)
- [ ] Edit, save, edit again, save again
- [ ] Edit multiple teams in one session
- [ ] Load different franchise file mid-session
- [ ] Very large roster (60+ players)

## Performance
- [ ] Team cards render in < 1 second
- [ ] Team detail opens in < 2 seconds
- [ ] Roster grid scrolls smoothly
- [ ] Save completes in < 3 seconds

## Error Handling
- [ ] Invalid franchise file shows error
- [ ] Missing player data handled gracefully
- [ ] Save failure shows error message
- [ ] Backup creation failure handled

## Pass Criteria

All checkboxes must be checked for Phase 1 to be considered complete.
```

**Step 3: Run full manual test**

Go through the test checklist and verify all items pass.

**Step 4: Commit documentation**

```bash
git add docs/TEAM_ROSTER_USAGE.md docs/plans/team-roster-test-checklist.md
git commit -m "docs: add team roster usage guide and test checklist

- Create user-facing usage documentation
- Create comprehensive test checklist
- Document limitations and troubleshooting
- Provide Madden 26 verification steps

🤖 Generated with Claude Code"
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete team roster tab Phase 1

Implemented team-specific roster view:
- Team cards grid with all 32 NFL teams
- Team detail view with roster Handsontable grid
- Inline editing with validation (OVR, Age, Jersey, etc.)
- Change tracking and save functionality
- Automatic backups before save
- Madden 26 save/load verified

Architecture:
- IPC: franchise:get-team-roster, franchise:save-team-changes
- Frontend: Team cards → Detail view → Roster grid
- Uses Player.TeamIndex for filtering
- Saves via madden-franchise library

Phase 2 (deferred):
- Depth chart editing
- Coach management
- Multi-team roster moves

Tested with Madden 26 - all changes persist correctly.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2025-10-29-team-roster-tab-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
