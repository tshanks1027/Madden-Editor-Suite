# Architecture - Madden Editor Suite

This document describes the system design, major components, and how they interact.

## System Overview

Madden Editor Suite is a multi-process Electron desktop application for editing Madden NFL files. It combines:
- **Electron** for cross-platform desktop app framework
- **Vite** for fast TypeScript compilation and bundling
- **Handsontable** for data grid editing
- **Puppeteer** for web scraping historical rosters
- **Vendored parsers** for Madden file formats

---

## Multi-Process Architecture

### 1. Main Process (`src/main.ts`)

**Runtime:** Node.js backend

**Responsibilities:**
- App lifecycle management (launch, quit, window creation)
- File I/O operations (read/write roster/draft class/franchise files)
- IPC (Inter-Process Communication) routing
- Service initialization (portrait sprites, lookups, etc.)
- Auto-update checking

**Key Files:**
- `src/main.ts` - Entry point, registers IPC handlers
- `src/main/ipc/*.ts` - IPC handler modules
- `src/main/services/*.ts` - Business logic services
- `src/main/lib/` - Vendored Madden file parsers

### 2. Preload Script (`src/preload.ts`)

**Runtime:** Isolated Node.js context

**Responsibilities:**
- Security boundary between main and renderer
- Exposes safe APIs via `contextBridge`
- All renderer → main communication MUST go through preload
- Prevents direct Node.js access from renderer

**Why Critical:**
- Electron's `contextIsolation` requires it
- Prevents XSS attacks from accessing Node APIs
- Defines the contract between processes

### 3. Renderer Process

**Runtime:** Chromium browser

**Responsibilities:**
- UI rendering (HTML/CSS/vanilla JavaScript)
- User interaction handling
- Data grid display (Handsontable)
- Calls main process via `window.electronAPI.*`

**Key Files:**
- `src/renderer/index.html` - Main editor (roster/draft class/creators)
- `src/renderer/franchise-editor.html` - Franchise management UI
- `src/renderer/js/app.js` - Main editor logic (vanilla JS, 2300+ lines)
- `src/renderer/js/franchise-editor.js` - Franchise editor logic
- `src/renderer/js/draft-wizard.js` - Draft class generator wizard
- `src/renderer/js/roster-wizard.js` - Historical roster generator wizard

**No Framework:**
- Uses vanilla JavaScript, not React/Vue/Angular
- Direct DOM manipulation
- Handsontable for grids

---

## Major Components

### Parser Layer (`src/main/lib/`)

**Vendored Libraries (NOT npm packages):**

1. **madden-file-tools** (`lib/helpers/MaddenRosterHelper.js`)
   - Parses Madden FBCHUNKS roster files
   - TDB2 binary format support
   - Source: https://github.com/bep713/madden-file-tools
   - License: MIT
   - Why vendored: Customized for this project, uses CommonJS require()

2. **madden-draft-class** (`lib/draft-class/`)
   - M25/M26 draft class file parsing
   - Compression/decompression
   - Binary structure parsing
   - M25→M26 conversion
   - Why vendored: Customized, not maintained upstream

**Usage:**
```javascript
// Roster parsing
const MaddenRosterHelper = require('./lib/helpers/MaddenRosterHelper');
const helper = new MaddenRosterHelper();
const file = await helper.load(filePath);

// Draft class parsing
const { M26Parser } = require('./lib/draft-class/M26Parser');
const parser = new M26Parser(filePath);
const prospects = parser.parse();
```

**NPM Package Parsers:**
- `madden-franchise` (v4.1.2) - Franchise file parsing
- `madden-draft-class-tools` (v1.1.0) - Draft class utilities

---

### Service Layer (`src/main/services/`)

**Core Services:**

1. **RosterCreatorService.ts**
   - Historical roster generation from web-scraped data
   - Orchestrates: web scrape → player generation → roster file creation
   - Uses Puppeteer for pro-football-reference.com scraping
   - Memory intensive (200MB+ for Puppeteer)

2. **DraftClassService.ts**
   - M25/M26 draft class conversion
   - Prospect data manipulation
   - Order tracking for sorted prospects
   - Template loading for M26 structure

3. **PortraitSpriteService.ts**
   - Player portrait sprite sheet management
   - Optimized from 1.8GB individual images to 124MB sprite sheet
   - Loads `data/portrait-atlas.json` for sprite coordinates
   - Maps PID (PhotoID) to sprite sheet position
   - Returns base64 image data for Handsontable

4. **CoachPortraitService.ts**
   - Coach portrait sprite sheet management (separate from players)
   - Uses `data/coach-atlas.json`
   - Similar sprite sheet optimization

5. **LookupService.ts**
   - CSV file caching on app startup
   - Provides dropdown options (colleges, positions, teams, states)
   - Manages 27,680+ player lookup (ALL_PLAYER_LOOKUP.csv)
   - Critical for performance: cache prevents re-reading CSVs

6. **RatingCalculator.ts**
   - OVR (Overall Rating) calculation formulas
   - Secondary rating calculations
   - Archetype-specific logic
   - Position-specific weightings

7. **ScraperService.ts**
   - Puppeteer-based web scraping
   - Headless browser control
   - Error handling for network failures

8. **UpdateChecker.ts**
   - GitHub API integration for release checking
   - Notifies user of new versions
   - Optional auto-download

---

### IPC Handler Layer (`src/main/ipc/`)

**Handler Modules (all registered in src/main.ts):**

- `parser-handlers.ts` - Roster file parsing/saving
- `draft-class-handlers.ts` - Draft class operations
- `franchise-handlers.ts` - Franchise file operations
- `creator-handlers.ts` - Web scraping for historical data
- `roster-creator-handlers.ts` - Historical roster generation
- `roster-generator-handlers.ts` - Historical roster generator (newer)
- `lookup-handlers.ts` - Dropdown data and CSV mappings
- `portrait-handlers.ts` - Player portrait retrieval
- `file-handlers.ts` - File system operations (open/save dialogs)
- `window-handlers.ts` - Multi-window management
- `update-handlers.ts` - Auto-update checking
- `rating-handlers.ts` - OVR calculation
- `debug-handlers.ts` - Debug logging

**IPC Flow:**
```
Renderer (app.js)
  ↓ window.electronAPI.parser.parseRosterFile(path)
Preload (preload.ts)
  ↓ ipcRenderer.invoke('parser:parse-roster-file', path)
Handler (parser-handlers.ts)
  ↓ calls RosterParser.parseRosterFile(path)
Service/Parser
  ↓ returns parsed data
Handler
  ↓ returns to renderer
```

---

### UI Layer (`src/renderer/`)

**Main Editor (`index.html` + `app.js`):**
- Handsontable data grid (3500+ rows, virtualized)
- Custom sorting system (NOT Handsontable's built-in)
- Document-level event delegation for header clicks
- Portrait rendering in grid cells
- Field validation and dropdown editors
- Pagination (104 rows per page)

**Franchise Editor (`franchise-editor.html`):**
- Separate window for franchise file management
- Team editing, trade forcing
- Season/week navigation

**Wizards:**
- `draft-wizard.js` - Draft class generation workflow
- `roster-wizard.js` - Historical roster generation workflow

**Key UI Patterns:**
```javascript
// Custom sorting (NOT Handsontable sorting)
toggleColumnSort(fieldName, isMultiColumn) {
  // Updates this.sortColumns
  // Calls renderRoster() to re-render with sorted data
}

// Portrait rendering (synchronous for Handsontable)
portraitRenderer(instance, td, row, col, prop, value, cellProperties) {
  // Use cached portrait data from PortraitSpriteService
  // NEVER trigger async loads during render
}

// Field value mapping
getPlayerFieldValue(player, fieldName) {
  // Handles lookup value conversion (e.g., college ID → name)
}
```

---

## Critical Dependencies

### If Missing → System Breaks

| Dependency | What Breaks | Why Critical |
|------------|-------------|--------------|
| `bit-buffer` | Binary file parsing | TDB2/FBCHUNKS parsing fails |
| `stream-parser` | Large file handling | Roster files can't be read |
| `crc-32` | File integrity checks | Corrupted files not detected |
| `portrait-sprites/` | Player images | Blank portraits in grid |
| `data/lookups/*.csv` | Dropdowns empty | Can't select colleges/teams |
| `lib/helpers/MaddenRosterHelper.js` | Roster parsing | Can't load roster files |
| `lib/draft-class/` | Draft class parsing | Can't load .M26 files |

### Dependency Graph

```
Main Process
├── Electron (38.1.2)
├── madden-franchise (4.1.2) → bit-buffer, stream-parser
├── madden-draft-class-tools (1.1.0)
├── Puppeteer (24.23.0) → Chromium bundle (200MB+)
├── Sharp (0.34.4) → Image processing for portraits
├── SQLite3 (5.1.7) → Database operations
└── Handsontable (16.1.1) → Data grids

Vendored Libraries
├── madden-file-tools → bit-buffer, stream-parser, crc-32
└── madden-draft-class → fzstd (compression)
```

---

## Performance Constraints

### Known Limits

1. **27,680+ Player Lookup CSV**
   - Must be cached on startup (LookupService)
   - Cannot reload on every dropdown change
   - Memory footprint: ~10MB

2. **Handsontable with 3500+ Rows**
   - Must use virtualization (only renders visible rows)
   - Pagination helps: 104 rows per page
   - Sorting entire dataset in-memory before pagination

3. **124MB Portrait Sprite Sheet**
   - Loaded once at startup (PortraitSpriteService)
   - Sprites cached in memory for fast access
   - Optimized from 1.8GB individual files

4. **Puppeteer Headless Browser**
   - 200MB+ memory overhead when running
   - Only used during roster generation
   - Closed after scraping completes

5. **File I/O Timeouts**
   - Roster files: 6.4KB, fast
   - Franchise files: 50MB+, can take 10+ seconds
   - Draft class files: 500KB-2MB, moderate

---

## Data Flow Examples

### Roster Editing Workflow

```
1. User clicks "Open Roster"
   └→ file-handlers.ts opens file dialog
2. User selects ROSTER-Official file
   └→ parser-handlers.ts calls RosterParser.parseRosterFile()
   └→ MaddenRosterHelper (vendored) parses FBCHUNKS binary
   └→ Returns 3500+ player records
3. Renderer displays in Handsontable
   └→ Portrait column calls portraitRenderer()
   └→ PortraitSpriteService returns cached sprites
4. User edits player OVR
   └→ Handsontable afterChange hook
   └→ Updates this.players array
5. User clicks "Save"
   └→ parser-handlers.ts calls RosterParser.saveRosterFile()
   └→ MaddenRosterHelper writes FBCHUNKS binary
   └→ File saved to disk
```

### Historical Roster Generation Workflow

```
1. User opens Roster Generator wizard
2. User selects year (e.g., 2010)
   └→ roster-generator-handlers.ts validates year
3. User clicks "Generate"
   └→ RosterGeneratorService.generate()
   └→ Loads ALL_PLAYER_LOOKUP.csv for that year
   └→ Filters players active in 2010
   └→ Maps to Madden player fields
4. Returns 2000+ players
   └→ Enriches with _position and _sourceTeam display names
5. Renderer displays in wizard grid
6. User clicks "Load into Editor"
   └→ Loads into main editor Handsontable
7. User clicks "Save"
   └→ Creates new M26 roster file with template
```

---

## Security Model

### Electron Security Features

1. **contextIsolation: true**
   - Renderer has no direct Node.js access
   - Must use `window.electronAPI.*`

2. **nodeIntegration: false**
   - Renderer can't use require()
   - Prevents require('fs') attacks

3. **Preload Script**
   - Only exposes whitelisted APIs
   - All IPC calls logged

4. **Content Security Policy**
   - Limits external resources
   - Prevents inline script execution

### File Access Restrictions

- Renderer can't access file system directly
- All file ops go through main process
- File dialogs limit user to specific directories
- No arbitrary file execution

---

## Build Pipeline

### Development

```
npm start
  ↓
Electron Forge starts Vite dev server
  ↓
Vite compiles:
  - main.ts → .vite/build/main.js (main process)
  - preload.ts → .vite/build/preload.js
  - renderer/*.html → served with HMR
  ↓
Electron launches with dev tools
```

### Production

```
npm run package
  ↓
Pre-package check (no hardcoded paths, no nul file)
  ↓
Vite builds:
  - Compiles TypeScript
  - Bundles main/preload
  - Copies data/ to .vite/build/data/
  - Copies lib/ to .vite/build/lib/
  - Copies node_modules (bit-buffer, stream-parser, crc-32)
  ↓
Electron Forge packages:
  - Creates out/Madden Editor Suite-win32-x64/
  - Bundles all resources/
  - Total size: ~1.35GB (53,881 files)
  ↓
7-Zip compresses:
  - Creates dist/Madden-Editor-Suite-Portable.zip
  - Compressed size: ~533MB
```

---

## Maintenance Considerations

### When Upgrading Electron

- Test all IPC handlers still work
- Verify file dialogs still open correctly
- Check Puppeteer compatibility (Chromium version)

### When Upgrading Handsontable

- Test custom sorting still works (columnSorting: false)
- Verify portrait rendering still synchronous
- Check pagination calculations

### When Adding New File Type Support

1. Add parser to `src/main/lib/` or use npm package
2. Create IPC handler in `src/main/ipc/`
3. Expose API in `src/preload.ts`
4. Update renderer to call new API
5. Add to `TESTING_STRATEGY.md`

---

## Related Documentation

- `PROJECT_SETUP.md` - Build and run instructions
- `TESTING_STRATEGY.md` - Testing approach
- `KNOWN_ISSUES.md` - Common problems and solutions
- `CLAUDE.md` - Complete technical reference (1022 lines)
