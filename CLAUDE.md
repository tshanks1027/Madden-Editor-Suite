# CLAUDE.md

# ⚠️ MANDATORY - READ THIS FIRST BEFORE ANY ACTION ⚠️

## CRITICAL RULES - ENFORCED AT ALL TIMES

**BEFORE responding to ANY user request, you MUST:**

1. **READ THIS ENTIRE CLAUDE.MD FILE** - Every time, no exceptions
2. **CHECK SESSION DEBUG LOG** - Read `session-debug.log` to see recent activity and errors
3. **CHECK TECH STACK** - It is LOCKED, verify before any changes
4. **STAY IN PLAN MODE** - For all code changes, propose first
5. **USE RESEARCH AGENT** - For ANY parsing/file I/O work, research existing implementations FIRST
6. **WAIT FOR APPROVAL** - After proposing approach, wait for explicit "proceed" or "approved"

---

## LOCKED TECH STACK - NO CHANGES ALLOWED WITHOUT EXPLICIT APPROVAL

**Current Stack:**
- ✅ **Vanilla JavaScript** - Renderer uses pure JS (NO React, NO Vue, NO Angular, NO frameworks)
- ✅ **Handsontable 16.1.1** - Data grid component (NOT AG-Grid, NOT any other grid)
- ✅ **Electron 38.1.2** - Desktop application framework
- ✅ **Playwright** - E2E automated testing
- ✅ **Vite 5** - Build tool and development server
- ✅ **TypeScript 4.5** - Type-safe JavaScript (main process only)

**Dependencies Available:**
- madden-franchise@3.8.0 - Binary parsing (see RESEARCH_FINDINGS.md)
- bit-buffer - Binary operations
- SQLite3 - Local database for lookups
- Sharp - Image processing

❌ **FORBIDDEN:** Adding React, Vue, Angular, or ANY new framework
❌ **FORBIDDEN:** Changing from Handsontable to another grid
❌ **FORBIDDEN:** Adding new dependencies without explicit approval

---

## ABSOLUTE RULES

### Rule 1: NO FILE DELETIONS
- **NEVER delete ANY file without explicit permission for that specific file**
- If you think a file is unnecessary, **ASK FIRST**, show contents, explain why
- User will decide - you cannot override

### Rule 2: RESEARCH BEFORE IMPLEMENTATION
- **BEFORE writing parsers, IPC handlers, or complex logic:**
  1. Use Task agent (general-purpose) to research existing implementations
  2. Check RESEARCH_FINDINGS.md for documented solutions
  3. Create markdown document with findings
  4. Show user the research
  5. Wait for approval to proceed
- **NO "I'll just write it from scratch"** - always use reference implementations

### Rule 3: NEVER BYPASS WORKFLOW
- Follow the exact workflow defined in WORKFLOW.md
- Each phase has agent handoffs (coding → testing → packaging → optimization → git)
- **DO NOT skip steps** - testing agent MUST run before user testing
- **DO NOT commit** without explicit user approval

### Rule 4: PLAN MODE FOR CODE CHANGES
- Stay in plan mode for ANY file edits/creation
- Propose your approach with file list and changes
- Wait for "approved" or "proceed" before executing
- If user says "no" or raises concerns, STOP and revise

### Rule 5: ATTRIBUTION AND DOCUMENTATION
- When using code from reference implementations, **ANNOTATE source**
- Add comments like: `// Source: madden-franchise by bep713 (MIT License)`
- Update ERROR_LOG.md when fixing issues
- Update RELEASE_NOTES.md when completing features

---

## DEVELOPMENT WORKFLOW

**Your workflow for EVERY feature:**

```
1. User Request → You read CLAUDE.md (this file)
2. Research (if needed) → Task agent researches, creates findings doc
3. Plan Mode → Propose approach, list files to change
4. User Approval → Wait for "proceed" or "approved"
5. Implementation → Write code
6. Testing Agent → Playwright runs automated tests
   - If FAIL → back to step 5
   - If PASS → continue
7. User Testing → User manually verifies
   - If issues → back to step 5
   - If confirmed working → continue
8. Packaging Agent → Test electron-forge package
   - If issues → back to step 5
   - If success → continue
9. Optimizer Agent → Check for code issues
   - If issues found → fix them
   - If clean → continue
10. Git Commit → User says "commit this" → Git agent commits
```

**DO NOT skip steps. DO NOT proceed without approval.**

---

## REFERENCE DOCUMENTATION

**Always check these files BEFORE starting work:**

- **RESEARCH_FINDINGS.md** - All available tools, parsers, reference code
- **WORKFLOW.md** - Detailed workflow with agent configurations
- **MASTER_PLAN.md** - 8 phases of development with acceptance criteria
- **ERROR_LOG.md** - Known issues and solutions
- **RELEASE_NOTES.md** - Completed features and versions

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Start development server with hot reload
- `npm run dev` - Alias for npm start
- `npm run build` - Full build with typecheck, lint, test, and package
- `npm run typecheck` - TypeScript type checking
- `npm run lint` - ESLint code linting
- `npm run lint:fix` - Fix linting issues automatically
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

### Building and Packaging
- `npm run package` - Create platform-specific package
- `npm run make` - Create distributable packages
- `npm run publish` - Publish the application
- `npm run clean` - Clean build artifacts

## Architecture

### Technology Stack
- **Electron 38.1.2** - Desktop application framework
- **Vite 5** - Build tool and development server
- **TypeScript 4.5** - Type-safe JavaScript
- **Vanilla JavaScript** - Renderer process uses pure JS + Handsontable
- **Handsontable** - Data grid component (NOT AG-Grid)
- **SQLite3** - Local database for lookups
- **Sharp** - Image processing

### Project Structure
```
src/
├── main/                    # Electron main process
│   ├── ipc/                # IPC handlers for renderer communication
│   │   ├── parser-handlers.ts    # File parsing operations
│   │   ├── lookup-handlers.ts    # Lookup system operations
│   │   └── file-handlers.ts      # File I/O operations
│   ├── parsers/            # Binary file parsers
│   │   ├── BinaryReader.js       # Binary reading utilities
│   │   └── TDBFileValidator.js   # TDB format validation
│   └── services/           # Business logic services
├── renderer/               # Frontend (Electron renderer)
│   ├── js/                 # Vanilla JavaScript application code
│   │   └── app.js          # Main application logic
│   ├── data/               # Field definitions and lookup data
│   └── hooks/              # React-style hooks (if using React)
└── shared/                 # Shared types and utilities
    └── types/              # TypeScript type definitions
```

### Key Files
- **src/main.ts** - Main Electron process entry point
- **src/preload.ts** - Preload script exposing APIs to renderer
- **src/renderer/js/app.js** - Main frontend application
- **src/main/parsers/BinaryReader.js** - Binary file reading utilities
- **src/main/parsers/TDBFileValidator.js** - Madden file format detection
- **src/main/ipc/parser-handlers.ts** - File parsing IPC handlers

### Data Flow
1. **File Selection**: Frontend → IPC → File handlers
2. **File Parsing**: File handlers → Parser handlers → Binary readers → Frontend
3. **Data Display**: Frontend uses Handsontable for data grid display
4. **Data Editing**: Handsontable → Frontend validation → Player data updates
5. **File Saving**: Frontend → IPC → Parser handlers → Binary writers

## Important Patterns

### IPC Communication
- All file operations go through IPC handlers
- Use `window.electronAPI` in renderer for main process communication
- Parser operations are asynchronous and return promises

### File Parsing
- Files are validated using TDBFileValidator before parsing
- BinaryReader handles low-level binary operations
- Parser handlers contain format-specific parsing logic
- Fallback to sample data if parsing fails

### Error Handling
- Always wrap IPC calls in try-catch blocks
- Display user-friendly error messages
- Log detailed error information to console
- Maintain application state even when operations fail

## Development Guidelines

### Module System
- Main process uses ES6 imports (`import`/`export`)
- Parser files (BinaryReader, TDBFileValidator) use ES6 exports
- Avoid mixing CommonJS (`require`) with ES6 imports

### File Structure Conventions
- Keep binary parsers in `src/main/parsers/`
- IPC handlers go in `src/main/ipc/`
- Frontend JavaScript in `src/renderer/js/`
- Shared types in `src/shared/types/`

### Testing
- Use Jest for unit tests
- Test binary parsing logic thoroughly
- Mock Electron APIs for renderer tests
- Maintain test coverage above 80%

## Debug Logging System

### Session Debug Log
- **Location**: `%APPDATA%/madden-editor-suite/session-debug.log` (Windows) or `~/Library/Application Support/madden-editor-suite/session-debug.log` (Mac)
- **Purpose**: Captures ALL console.log output from renderer process automatically
- **Lifecycle**: Cleared on EVERY app startup - only contains current session data
- **Access**: Use Read tool to access log file directly - NO need for user to copy/paste anymore
- **Usage**:
  - ALWAYS read this file FIRST when debugging user-reported issues
  - Contains timestamped entries with full context
  - Includes [SORT DEBUG], [LOAD], [SAVE], and other tagged debug messages

### How to Read Session Log
```bash
# Get the log file path first (will tell you exact location for this user)
# Then use Read tool with that path
Read(logPath)
```

### Writing to Session Log from Renderer
```javascript
// In renderer code (app.js), use this instead of console.log for debugging:
window.electronAPI.debug.sessionLog('[TAG] Your debug message here');
```

### Scraper Debug Log
- **Location**: `%APPDATA%/madden-editor-suite/scraper-debug.log`
- **Purpose**: Roster generation and web scraping debug output
- **NOT cleared automatically** - persists across sessions

---

## Common Issues

### Module Import Errors
If you see "Cannot find module" errors:
1. Check that ES6 imports/exports are used consistently
2. Verify file paths are correct relative to importing file
3. Ensure Vite configuration includes necessary files

### Electron App Not Starting
1. Check main.ts for syntax errors
2. Verify preload.ts exposes required APIs
3. Ensure all IPC handlers are registered
4. Check console for detailed error messages

### Parser Not Working
1. Verify TDBFileValidator and BinaryReader imports
2. Check file path resolution in IPC handlers
3. Test with known good Madden files
4. Review parser-handlers.ts for errors

## Madden File Formats

### Supported Formats
- **TDB Legacy** - Original format with "TDB\0" signature
- **TDB2 Compressed** - zlib-compressed format
- **TDB2 Uncompressed** - "TDB\x02" signature
- **FBCH** - Modern Madden format with "FBCH" signature

### File Extensions
- Madden files often have NO file extension
- Examples: "ROSTER-Official", "CAREER-DRAFT", etc.
- Use file content validation instead of extension checking

### Binary Structure
- Little-endian byte order
- Variable-length strings with null terminators
- Multiple table structures within single file
- Requires binary reader for proper parsing