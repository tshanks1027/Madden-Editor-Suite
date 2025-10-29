# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Madden Editor Suite** is a professional Electron-based desktop application for editing Madden NFL files. It provides 17+ specialized tools for roster editing, franchise management, draft class creation, and visual customization. The application uses Electron Forge with Vite for building and packaging.

**Key Features:**
- Roster Editor with full player attribute control
- Draft Class Editor and M25→M26 converter
- Historical roster/draft class generator (scrapes pro-football-reference.com)
- Franchise file editor with team management and trade forcing
- Player portrait management using sprite sheets
- Coach portrait management
- Retro Franchise mode for historical season setup

## Architecture

### Electron Process Structure

This is a multi-process Electron app:

1. **Main Process** (`src/main.ts`) - Node.js backend
   - Manages app lifecycle and window creation
   - Loads IPC handlers on startup
   - Initializes portrait sprite services
   - Handles auto-updates

2. **Preload Script** (`src/preload.ts`) - Security bridge
   - Exposes safe APIs to renderer via `contextBridge`
   - All renderer→main communication goes through IPC channels defined here

3. **Renderer Process** - Browser frontend
   - `src/renderer/index.html` - Main editor (roster/draft class/creators)
   - `src/renderer/franchise-editor.html` - Franchise management interface
   - Uses vanilla JavaScript with Handsontable for data grids
   - No React/Vue/Angular - pure DOM manipulation

### IPC Handler Organization

All IPC handlers are in `src/main/ipc/`:
- `parser-handlers.ts` - Roster file parsing
- `draft-class-handlers.ts` - Draft class operations
- `franchise-handlers.ts` - Franchise file operations
- `creator-handlers.ts` - Web scraping for historical data
- `roster-creator-handlers.ts` - Historical roster generation
- `lookup-handlers.ts` - Dropdown data and mappings
- `portrait-handlers.ts` - Player portrait management
- `file-handlers.ts` - File system operations
- `window-handlers.ts` - Multi-window management
- `update-handlers.ts` - Auto-update checking
- `rating-handlers.ts` - OVR calculation
- `debug-handlers.ts` - Debug logging

**Important:** IPC handlers are registered in `src/main.ts`. New handlers must be imported and registered there.

### File Parsing Libraries

The app vendors two critical libraries in `src/main/lib/`:

1. **madden-franchise** (`lib/filetypes/`) - Franchise file parsing
   - TDB/TDB2 database table handling
   - AST file format support
   - EBX/TOC/CAS file support
   - Used via: `const Franchise = require('madden-franchise')`

2. **madden-draft-class** (`lib/draft-class/`) - Draft class file parsing
   - M25/M26 format support
   - Compression/decompression
   - Binary structure parsing
   - M25→M26 conversion

These are **vendored** (not npm packages) because they need CommonJS require() and have been customized.

### Service Layer

Services in `src/main/services/`:
- `lookup-service.ts` - Manages CSV lookup files for dropdowns
- `PortraitSpriteService.ts` - Player portrait sprite sheet handling
- `CoachPortraitService.ts` - Coach portrait management
- `CreatorService.ts` - Orchestrates web scraping
- `ScraperService.ts` - Puppeteer-based scraping
- `RosterCreatorService.ts` - Historical roster generation
- `DraftClassService.ts` - Draft class operations
- `RatingCalculator.ts` - OVR calculation formulas
- `UpdateChecker.ts` - GitHub release checking

### Data Files

`data/lookups/` contains CSV files for dropdowns and mappings:
- `ALL_PLAYER_LOOKUP.csv` - 27,680+ real players with PID/PAM/PLPO mappings
- `Coach_lookup.csv` - Coach PID/PAM mappings
- `college_lookup.csv`, `position_lookup.csv`, `team_lookup.csv`, `state_lookup.csv` - Madden enums
- `PID_Portrait_Mapping.csv` - Generic face mappings

`data/portrait-sprites/` and `data/portrait-atlas.json` contain player portraits (optimized from 1.8GB individuals).
`data/coach-sprites/` and `data/coach-atlas.json` contain coach portraits.

**Important:** These files are copied to build output by Vite plugins and must be accessed using `app.getAppPath()` at runtime.

### Build System

- **Vite** compiles TypeScript and bundles code
- **Electron Forge** packages the app with electron-builder
- **forge.config.ts** - Packaging configuration
- **vite.main.config.ts** - Main process build (copies data/lib to `.vite/build/`)
- **vite.preload.config.ts** - Preload script build
- **vite.renderer.config.ts** - Renderer build (multiple HTML entry points)
- **electron-builder.yml** - NSIS installer configuration

The build copies:
1. CSV files from `data/lookups/` → `.vite/build/data/lookups/`
2. Vendored libs from `src/main/lib/` → `.vite/build/lib/`
3. Required node_modules (bit-buffer, stream-parser, crc-32, fzstd) → `.vite/build/node_modules/`

## Development Commands

```bash
# Start development server
npm start
npm run dev           # alias

# Build for production
npm run package       # Package with Electron Forge
npm run dist          # Create installer with electron-builder
npm run dist:simple   # Quick build without NSIS installer

# Testing
npm test              # Run Playwright E2E tests
npm run test:jest     # Run Jest unit tests
npm run test:coverage # Coverage report

# Code quality
npm run lint          # ESLint
npm run lint:fix      # Auto-fix linting issues
npm run format        # Prettier format
npm run format:check  # Check formatting
npm run typecheck     # TypeScript type checking

# Utilities
npm run clean         # Remove dist/out/coverage/.vite
```

## Development Workflow

### Adding a New Feature

1. **Identify the layer:**
   - Renderer UI change? Edit `src/renderer/*.html` and `src/renderer/js/*.js`
   - Backend logic? Add service in `src/main/services/`
   - IPC needed? Add handler in `src/main/ipc/` and register in `src/main.ts`
   - Update preload API in `src/preload.ts`

2. **Testing:**
   - E2E tests in `tests/e2e/*.spec.js` (Playwright)
   - Unit tests in `src/main/**/*.test.ts` (Jest)
   - Manual testing: `npm start`

3. **Build verification:**
   - Run `npm run package` to test packaging
   - Check `.vite/build/` contains required files (CSVs, libs)

### Working with Franchise Files

Franchise files use the `madden-franchise` library:

```javascript
const Franchise = require('madden-franchise');
const franchise = new Franchise(filePath);
const tables = await franchise.readFile();
const playerTable = tables.find(t => t.name === 'Player');
const players = playerTable.records;
// Access fields: player.FirstName, player.LastName, player.Overall, etc.
```

**Important:** Field names are PascalCase in the library. Roster files use different field names than franchise files (e.g., `FirstName` vs `firstName`).

### Working with Draft Class Files

Draft class files use the vendored `lib/draft-class/` parser:

```javascript
const { M26Parser } = require('./lib/draft-class/M26Parser');
const parser = new M26Parser(filePath);
const prospects = parser.parse(); // Returns array of prospect objects
```

M25→M26 conversion uses `M25toM26Converter.js` which requires a template M26 file for structure.

### Portrait Management

Player portraits are stored as sprite sheets to reduce size (from 1.8GB to 124MB):

```javascript
import { portraitSpriteService } from './services/PortraitSpriteService';
await portraitSpriteService.initialize();
const imageData = await portraitSpriteService.getPortraitByPLPO('PLPO_1234');
// Returns base64 image data or null
```

Coaches use separate sprite sheets via `CoachPortraitService`.

### Lookup Service

Lookup data for dropdowns is cached on startup:

```javascript
import { lookupService } from './services/lookup-service';
const collegeOptions = await lookupService.getDropdownOptions('college_lookup.csv');
// Returns array of { id, name } objects
```

**Note:** `ALL_PLAYER_LOOKUP.csv` contains full player data, not just names. Use `lookupService.getFullDataByPID(pid)` to get complete player info.

## Common Pitfalls

1. **CSV files not found in packaged app**
   - Ensure `vite.main.config.ts` copies files to `.vite/build/data/lookups/`
   - Use `app.getAppPath()` or `app.isPackaged` checks for path resolution

2. **Require errors for vendored libs**
   - The vendored libs use CommonJS `require()`
   - Ensure `node_modules` subdirectories (bit-buffer, stream-parser) are copied to build

3. **IPC not working**
   - Check handler is imported in `src/main.ts`
   - Check API is exposed in `src/preload.ts`
   - Verify channel names match exactly

4. **Handsontable not rendering**
   - Ensure container has explicit height (flex or fixed)
   - Check data format matches column definitions

5. **Puppeteer crashes in packaged app**
   - Puppeteer is bundled for scraping (historical rosters/draft classes)
   - Don't exclude from packaging in `forge.config.ts`

## File Structure Notes

- **Main window:** `src/renderer/index.html` - Multi-tool editor (roster/draft/creators)
- **Franchise window:** `src/renderer/franchise-editor.html` - Separate franchise management UI
- **Shared data:** Window-to-window communication uses `window-handlers.ts` with shared state
- **Modals:** Player cards and dialogs are inline in HTML, controlled via display toggles

## Madden-Specific Knowledge

### Player IDs

- **PID (PhotoID):** Unique player identifier in roster files
- **PAM (Player Assets):** Asset ID linking to player appearance/portrait
- **PLPO:** Portrait key format (e.g., "PLPO_Brady_Tom")

### Field Mappings

Franchise files and roster files use different field names for the same data:
- Roster: `firstName`, `lastName` → Franchise: `FirstName`, `LastName`
- Roster: `college` (string) → Franchise: `CollegeId` (integer, mapped via college_lookup.csv)

### College ID Mapping

College IDs differ between roster and franchise files. Use `data/franchise-college-mapping.json` for translation when converting between formats.

## Testing Notes

- **E2E tests:** Launch app, load file, verify UI (Playwright)
- **Run tests:** `npm test` (headless) or `npx playwright test --ui` (UI mode)
- **Test reports:** Generated in `test-reports/html/`
- **Screenshots:** Captured in `test-reports/screenshots/` on failure

## Debugging

- **Main process:** Logs to console (visible in terminal when running `npm start`)
- **Renderer process:** Open DevTools (F12 in app window)
- **Session log:** Written to temp file via `debug-handlers.ts`
- **Access log:** `window.electronAPI.debug.getSessionLogPath()`
