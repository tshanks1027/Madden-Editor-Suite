# Testing Strategy - Madden Editor Suite

This document defines what tests are valuable for this project, what to avoid, and how to ensure reliability.

## Test Categories

### Unit Tests (Jest)

**What to Test:**
- Service layer logic (`src/main/services/`)
  - `RosterCreatorService` - Historical roster generation
  - `DraftClassService` - M25/M26 conversion
  - `PortraitSpriteService` - Sprite sheet operations
  - `LookupService` - CSV caching
  - `RatingCalculator` - OVR calculation formulas

- Utility functions
  - Field value parsing
  - Data validation
  - Type conversions

- IPC handler logic (unit test the handler functions, not the IPC channel)

**What NOT to Test:**
- Vendored libraries (`src/main/lib/`) - already tested upstream
- Electron framework code
- Third-party npm packages

**Configuration:**
- Framework: Jest with ts-jest preset
- Environment: jsdom
- Timeout: 10 seconds (may need increase for file operations)
- Coverage threshold: 85% (branches, functions, lines, statements)

### Integration Tests

**What to Test:**
- File parse → edit → save cycles
  - Load roster → modify player → save → reload → verify
  - Load draft class → modify prospect → save → reload → verify
  - Load franchise → modify team → save → reload → verify

- Service layer interactions
  - `CreatorService` → `ScraperService` → `RosterCreatorService` workflow
  - Lookup data loaded → IPC handler uses it → renderer displays it

**Critical Workflows:**
1. Roster Generator: Web scrape → generate players → create roster file → verify file loads in Madden
2. Draft Class Converter: Load M25 → convert → save M26 → verify file loads in Madden
3. Portrait Management: Load sprite sheet → map PID → display in grid → verify image data

### E2E Tests (Playwright)

**What to Test:**
- App launch and window creation
- File loading through UI (open dialog → select file → verify loaded)
- User actions: click, type, select dropdown, navigate pages
- File saving through UI (modify data → save dialog → verify file created)
- Multi-window scenarios (main window + franchise editor)

**Existing Tests:**
- `tests/e2e/roster-load.spec.js` - Loads roster file, verifies console logs
- `tests/e2e/franchise-save-reload.spec.js` - Tests franchise save/reload cycle

**Configuration:**
- Framework: Playwright for Electron
- Timeout: 60 seconds (app launch is slow)
- Workers: 1 (CRITICAL - Electron cannot run parallel tests)
- Headless: false (need to see Electron window)
- Retries: 1 on local, 2 in CI

### Performance Tests

**What to Benchmark:**
- 27,680+ player roster loading time (target: < 3 seconds)
- Handsontable rendering with 3500+ rows (target: < 2 seconds)
- Portrait sprite sheet initialization (124MB, target: < 5 seconds)
- Puppeteer scraping (200MB+ memory overhead, target: complete before timeout)

**Current State:** No formal performance tests, relies on manual validation

## Coverage Expectations

### Current Coverage Thresholds (Jest)
```
global:
  branches: 85%
  functions: 85%
  lines: 85%
  statements: 85%
```

### Files Excluded from Coverage
- `src/**/*.d.ts` - Type definitions
- `src/main.ts` - Electron app entry point
- `src/preload.ts` - Security bridge (tested via E2E)

### Areas Needing More Coverage
1. **Service layer**: Currently no unit tests found for services
2. **IPC handlers**: Logic inside handlers should have unit tests
3. **Renderer utilities**: Field validation, OVR calculation client-side

## Known Test Pitfalls

### Playwright / E2E Issues

1. **Single Worker Requirement**
   - **Issue:** Parallel test execution causes Electron process conflicts
   - **Fix:** `workers: 1` in `playwright.config.js` (already configured)
   - **Prevention:** Never change workers setting

2. **File Operation Timeouts**
   - **Issue:** Loading/saving 6.4KB roster files can exceed default timeout
   - **Fix:** `timeout: 60000` for tests, `actionTimeout: 15000` for actions
   - **Prevention:** Always use generous timeouts for file I/O

3. **Electron Process Lingering**
   - **Issue:** After test failure, Electron process may not close
   - **Fix:** Manually kill with `taskkill /F /IM electron.exe` (Windows)
   - **Prevention:** Use proper teardown in test fixtures

4. **Console Log Capture**
   - **Issue:** Console logs from Electron need explicit capture setup
   - **Fix:** Use `page.on('console', msg => ...)` in tests
   - **Prevention:** Set up in beforeEach() hook

### Jest / Unit Test Issues

1. **Missing Setup File**
   - **Issue:** `jest.config.js` references `tests/setup.ts` which doesn't exist
   - **Fix:** Create `tests/setup.ts` with basic environment setup
   - **Prevention:** Verify all referenced files exist after config changes

2. **Module Resolution**
   - **Issue:** Jest doesn't recognize `@/*` path aliases by default
   - **Fix:** `moduleNameMapper` in jest.config.js (already configured)
   - **Prevention:** Test imports after adding new path aliases

3. **Timeout Too Short for File Operations**
   - **Issue:** Default 10s timeout may be too short for large file parsing
   - **Fix:** Increase `testTimeout` or use `jest.setTimeout()` in individual tests
   - **Prevention:** Benchmark file operations before setting test timeout

### Test Data Issues

1. **Hardcoded User Paths**
   - **Issue:** Test files use `C:\Users\tshan\` hardcoded paths
   - **Fix:** Use relative paths or environment variables
   - **Prevention:** Pre-package check should catch this

2. **Test Files Missing in Package**
   - **Issue:** Test roster/franchise files not bundled with app
   - **Fix:** Keep test data in `tests/fixtures/` and don't package it
   - **Prevention:** Tests are dev-only, never run in production

3. **File Size Verification**
   - **Issue:** Saved roster files are 2.4KB instead of expected 6.4KB
   - **Cause:** `nul` file interference or incorrect save operation
   - **Fix:** Delete `nul` file, use proper MaddenRosterHelper save
   - **Prevention:** Always verify saved file size in tests

## Unreliable / Expensive Tests

### Tests to Avoid

1. **Archetype Renderer Tests After Sorting**
   - **History:** Fixed in commits 44153ff, 20cf24d, c0e527e
   - **Issue:** Index mismatch between Handsontable data and renderer after sort
   - **Reason:** Display bugs fixed, but sorting logic is fragile
   - **Alternative:** Test sorting logic separately from rendering

2. **Draft Class Save Tests (M26 Format)**
   - **History:** Fixed in commits 2d0a124, f1e358f, 3d1a194
   - **Issue:** "argument must be a string" errors, missing M25 headers
   - **Reason:** M26 Writer had type checking issues
   - **Status:** Now stable, but add type validation tests

3. **Rosters with Unusual Archetype Formats**
   - **History:** Fixed in commit 093ce6a
   - **Issue:** String vs numeric archetype ID mismatches
   - **Reason:** CSV data format inconsistencies
   - **Alternative:** Test with normalized test data only

### Expensive Tests (Run Sparingly)

1. **Puppeteer Web Scraping Tests**
   - **Cost:** 200MB+ memory, slow network requests, brittle selectors
   - **When to Run:** Only when scraping logic changes
   - **Alternative:** Mock HTTP responses for unit tests

2. **Full Roster Generation End-to-End**
   - **Cost:** 2000+ players, web scraping, file I/O
   - **When to Run:** Only before release
   - **Alternative:** Test with small subset (100 players)

3. **Portrait Sprite Sheet Loading**
   - **Cost:** 124MB sprite sheet initialization
   - **When to Run:** Only when portrait service changes
   - **Alternative:** Mock sprite service in other tests

## Test Execution Strategy

### Development (Local)

```bash
# Fast feedback: Unit tests only
npm run test:jest

# Watch mode during development
npm run test:watch

# Full E2E before committing
npm test
```

### Pre-Commit

```bash
# Type check + lint + unit tests
npm run typecheck && npm run lint && npm run test:jest
```

### Pre-Package (Before Distribution)

```bash
# Full build validation
npm run typecheck
npm run lint
npm run test:jest
npm test  # E2E tests
npm run package
# Manual testing of packaged app
```

### CI/CD (GitHub Actions)

```bash
# All tests with retries
npm run typecheck
npm run lint
npm run test:coverage
npm test  # Playwright with 2 retries
```

## Common Test Failures

### "Cannot find module 'bit-buffer'"

**Cause:** Required modules not in `node_modules/` for tests

**Fix:** Run `npm install` to restore dependencies

### "Timeout waiting for Electron to start"

**Cause:** Previous Electron process still running

**Fix:**
```bash
# Windows
taskkill /F /IM electron.exe

# Then re-run test
npm test
```

### "Expected file size 6.4KB, got 2.4KB"

**Cause:** `nul` file in project or incomplete save operation

**Fix:**
1. Delete `nul` file from project root
2. Verify `MaddenRosterHelper.save()` completes
3. Check for file I/O errors in console

### Test passes locally but fails in CI

**Cause:** Timing differences, missing dependencies, or environment-specific paths

**Fix:**
- Increase timeouts in CI environment
- Use `app.isPackaged` checks for paths
- Verify all dependencies in `package.json`

## Next Steps for Test Coverage

### Immediate Priorities

1. **Create `tests/setup.ts`** - Fix Jest configuration error
2. **Add Service Unit Tests** - At least smoke tests for critical services
3. **Add More E2E Tests** - Cover draft class editor, franchise editor

### Future Improvements

1. **Performance Benchmarking** - Automated tests for load times
2. **Visual Regression Testing** - Screenshot comparisons for UI
3. **Integration Tests** - Multi-service workflows
4. **Mutation Testing** - Verify test quality with mutations

## Related Documentation

- `PROJECT_SETUP.md` - Build and run instructions
- `KNOWN_ISSUES.md` - Solutions to past test failures
- `CLAUDE.md` - Technical architecture details
