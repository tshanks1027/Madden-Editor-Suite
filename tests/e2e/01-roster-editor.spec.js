/**
 * Roster Editor E2E Tests
 *
 * Tests for Phase 1: Roster Editor functionality
 * - Opening roster files
 * - Displaying players in Handsontable
 * - Editing player attributes
 * - Saving roster files
 */

const { test, expect } = require('@playwright/test');
const {
  launchElectronApp,
  closeElectronApp,
  waitForElement,
  captureConsoleLogs,
  takeScreenshot,
  waitForStatus,
  isErrorModalVisible,
  getErrorMessage,
} = require('./helpers/electron-launcher');

const {
  getTestFilePath,
  testFileExists,
  listTestFiles,
  handleFileDialog,
  verifyMaddenFileSignature,
} = require('./helpers/file-helpers');

const {
  waitForHandsontable,
  getRowCount,
  getColumnCount,
  getCellValue,
  setCellValue,
  getColumnHeaders,
  getPlayerCount,
  getVisibleFieldsCount,
  toggleShowAllColumns,
  editCellViaUI,
  verifyCellValue,
  findColumnByHeader,
} = require('./helpers/table-helpers');

let electronApp;
let page;
let consoleLogs;

test.beforeAll(async () => {
  // List available test files
  console.log('\n📁 Available test files:');
  const testFiles = listTestFiles();
  testFiles.forEach(file => {
    console.log(`  - ${file.name} (${file.sizeFormatted})`);
  });
});

test.beforeEach(async () => {
  // Launch Electron app before each test
  const result = await launchElectronApp();
  electronApp = result.electronApp;
  page = result.page;

  // Start capturing console logs
  consoleLogs = captureConsoleLogs(page);

  // Take screenshot of initial state
  await takeScreenshot(page, 'app-initial-state');
});

test.afterEach(async () => {
  // Take screenshot of final state
  await takeScreenshot(page, 'app-final-state');

  // Log console messages
  console.log(`\n📝 Console logs (${consoleLogs.length} messages):`);
  consoleLogs.forEach(log => {
    console.log(`  [${log.type}] ${log.text}`);
  });

  // Close Electron app after each test
  await closeElectronApp(electronApp);
});

// ============================================================================
// Test Suite: App Launch and Initial State
// ============================================================================

test.describe('App Launch', () => {
  test('should launch successfully and show main UI', async () => {
    // Verify main elements are visible
    await waitForElement(page, '#app');
    await waitForElement(page, '#openFileBtn');
    await waitForElement(page, '#rosterGrid');

    // Verify no errors on launch
    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);

    // Verify status is "Ready"
    const status = await page.textContent('#statusText');
    expect(status).toContain('Ready');
  });

  test('should display empty state when no file loaded', async () => {
    // Check for empty state message
    const emptyState = await page.$('.empty-state');
    expect(emptyState).toBeTruthy();

    // Verify empty state text
    const emptyText = await page.textContent('.empty-title');
    expect(emptyText).toContain('No players loaded');
  });

  test('should have all UI controls visible', async () => {
    // Verify controls exist
    await waitForElement(page, '#openFileBtn');
    await waitForElement(page, '#positionFilter');
    await waitForElement(page, '#showAllColumns');

    // Save button should be hidden initially
    const saveBtn = await page.$('#saveRosterBtn');
    const isVisible = await saveBtn.isVisible();
    expect(isVisible).toBe(false);
  });
});

// ============================================================================
// Test Suite: File Operations
// ============================================================================

test.describe('File Operations', () => {
  test('should open file dialog when clicking Open File button', async () => {
    // Click Open File button
    await page.click('#openFileBtn');

    // Wait a moment for dialog (will be mocked in actual implementation)
    await page.waitForTimeout(500);

    // For now, just verify button was clicked
    await takeScreenshot(page, 'file-dialog-opened');
  });

  test.skip('should load ROSTER-Official file successfully', async () => {
    // This test is skipped until parser is implemented
    // Will be enabled in Phase 1 implementation

    const testFile = 'ROSTER-Official';

    // Verify test file exists
    expect(testFileExists(testFile)).toBe(true);

    // Verify file has correct Madden signature
    const signature = verifyMaddenFileSignature(testFile);
    expect(signature.isValid).toBe(true);

    // TODO: Implement file loading via IPC
    // await handleFileDialog(electronApp, testFile);
    // await page.click('#openFileBtn');

    // Wait for loading
    // await waitForStatus(page, 'Loading file...');
    // await waitForStatus(page, 'Loaded');

    // Verify players loaded
    // const playerCount = await getPlayerCount(page);
    // expect(playerCount).toBeGreaterThan(3000);

    await takeScreenshot(page, 'roster-loaded');
  });

  test.skip('should display error for invalid file format', async () => {
    // Test invalid file handling
    // TODO: Implement after parser is added
  });

  test.skip('should save roster file with modifications', async () => {
    // Test saving functionality
    // TODO: Implement after save feature is added
  });
});

// ============================================================================
// Test Suite: Data Display
// ============================================================================

test.describe('Data Display', () => {
  test.skip('should display players in Handsontable grid', async () => {
    // TODO: Enable after parser implementation

    // Load test file
    // ... file loading code ...

    // Wait for Handsontable to initialize
    await waitForHandsontable(page);

    // Verify table has data
    const rowCount = await getRowCount(page);
    expect(rowCount).toBeGreaterThan(0);

    const colCount = await getColumnCount(page);
    expect(colCount).toBeGreaterThan(0);

    // Verify column headers
    const headers = await getColumnHeaders(page);
    expect(headers).toContain('Name');
    expect(headers).toContain('Position');
    expect(headers).toContain('Overall');

    await takeScreenshot(page, 'handsontable-populated');
  });

  test.skip('should show correct player count in UI', async () => {
    // TODO: Enable after parser implementation

    // Load file and get player count
    const uiPlayerCount = await getPlayerCount(page);
    const tableRowCount = await getRowCount(page);

    expect(uiPlayerCount).toBe(tableRowCount);
  });

  test.skip('should toggle between basic and all fields', async () => {
    // TODO: Enable after parser implementation

    // Get initial column count
    const basicFieldsCount = await getColumnCount(page);

    // Toggle "Show All Columns"
    await toggleShowAllColumns(page, true);

    // Verify more columns shown
    const allFieldsCount = await getColumnCount(page);
    expect(allFieldsCount).toBeGreaterThan(basicFieldsCount);

    // Verify UI updates
    const visibleFields = await getVisibleFieldsCount(page);
    expect(visibleFields).toBe(allFieldsCount);

    // Toggle back
    await toggleShowAllColumns(page, false);

    // Verify returns to basic view
    const backToBasic = await getColumnCount(page);
    expect(backToBasic).toBe(basicFieldsCount);

    await takeScreenshot(page, 'fields-toggled');
  });
});

// ============================================================================
// Test Suite: Data Editing
// ============================================================================

test.describe('Data Editing', () => {
  test.skip('should edit player attribute value', async () => {
    // TODO: Enable after parser implementation

    // Load file
    // ... file loading code ...

    // Find "Speed" column
    const speedColIndex = await findColumnByHeader(page, 'Speed');
    expect(speedColIndex).toBeGreaterThanOrEqual(0);

    // Get original value
    const originalValue = await getCellValue(page, 0, speedColIndex);

    // Edit value
    const newValue = 99;
    await setCellValue(page, 0, speedColIndex, newValue);

    // Verify value changed
    const updatedValue = await getCellValue(page, 0, speedColIndex);
    expect(updatedValue).toBe(newValue);

    await takeScreenshot(page, 'cell-edited');
  });

  test.skip('should validate attribute ranges', async () => {
    // TODO: Enable after validation implementation

    // Try to set invalid value (e.g., 150 for speed)
    // Verify validation error shown
    // Verify value reverts or shows error
  });

  test.skip('should handle dropdown fields (Position, Team)', async () => {
    // TODO: Enable after dropdown implementation

    // Test editing Position field
    // Test editing Team field
    // Verify dropdown shows correct options
    // Verify selection updates cell value
  });
});

// ============================================================================
// Test Suite: Save Functionality
// ============================================================================

test.describe('Save Functionality', () => {
  test.skip('should enable save button after editing', async () => {
    // TODO: Enable after save feature implementation

    // Load file
    // Edit a field
    // Verify save button becomes visible/enabled
  });

  test.skip('should save file and persist changes', async () => {
    // TODO: Enable after save implementation

    // Load file
    // Edit field
    // Click save
    // Re-open file
    // Verify edit persisted
  });

  test.skip('should create backup before saving', async () => {
    // TODO: Enable after backup feature implementation

    // Load file
    // Edit and save
    // Verify backup file created
  });
});

// ============================================================================
// Test Suite: Error Handling
// ============================================================================

test.describe('Error Handling', () => {
  test('should display error modal when needed', async () => {
    // Trigger an error (no parser yet, so skip actual error)
    // For now, just verify error modal exists in DOM
    const errorModal = await page.$('#errorModal');
    expect(errorModal).toBeTruthy();
  });

  test.skip('should handle corrupted files gracefully', async () => {
    // TODO: Implement after parser is added

    // Try to load corrupted/invalid file
    // Verify error message shown
    // Verify app doesn't crash
    // Verify can recover and load valid file
  });

  test.skip('should show user-friendly error messages', async () => {
    // TODO: Implement after error handling is complete

    // Trigger various errors
    // Verify messages are user-friendly (not stack traces)
    // Verify suggested actions provided
  });
});

// ============================================================================
// Test Suite: Performance
// ============================================================================

test.describe('Performance', () => {
  test.skip('should load large roster file within 5 seconds', async () => {
    // TODO: Enable after parser implementation

    const startTime = Date.now();

    // Load large roster file
    // ... file loading code ...

    await waitForHandsontable(page);

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
    console.log(`📊 Load time: ${loadTime}ms`);
  });

  test.skip('should render table without lag', async () => {
    // TODO: Enable after implementation

    // Load file
    // Scroll through table
    // Verify smooth scrolling (no frame drops)
    // Measure render time
  });
});

// ============================================================================
// Test Suite: Integration
// ============================================================================

test.describe('Integration', () => {
  test.skip('should complete full workflow: Open → Edit → Save → Reload', async () => {
    // TODO: Enable after all features implemented

    // 1. Open roster file
    // 2. Verify loaded correctly
    // 3. Edit multiple fields
    // 4. Save file
    // 5. Close and re-open file
    // 6. Verify all edits persisted

    await takeScreenshot(page, 'full-workflow-complete');
  });
});
