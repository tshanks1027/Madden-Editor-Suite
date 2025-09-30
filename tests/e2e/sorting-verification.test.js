const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('RosterGrid Sorting Functionality Tests', () => {
  let electronApp;
  let window;

  test.beforeAll(async ({ playwright }) => {
    // Launch Electron app (check if built version exists, fallback to development)
    const builtAppPath = path.join(__dirname, '../../out/madden-editor-suite-win32-x64/madden-editor-suite.exe');
    const devPath = path.join(__dirname, '../../');

    try {
      // Try built version first
      electronApp = await playwright._electron.launch({
        args: [builtAppPath],
        timeout: 30000
      });
    } catch (error) {
      console.log('Built app not available, trying dev mode...');
      // Fall back to dev mode
      electronApp = await playwright._electron.launch({
        args: [devPath],
        env: {
          ...process.env,
          NODE_ENV: 'development'
        },
        timeout: 30000
      });
    }

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should load roster editor and display grid with sortable columns', async () => {
    // Navigate to roster editor
    await window.click('[data-testid="roster-editor-button"]');

    // Wait for roster grid to load
    await window.waitForSelector('.ag-grid-container', { timeout: 15000 });

    // Take initial screenshot
    await window.screenshot({
      path: './test-results/sorting-initial-grid.png',
      fullPage: true
    });

    // Check that AG-Grid is loaded
    const gridContainer = window.locator('.ag-grid-container');
    await expect(gridContainer).toBeVisible();

    // Check for column headers
    const headers = window.locator('.ag-header-cell');
    const headerCount = await headers.count();
    console.log(`Found ${headerCount} column headers`);

    expect(headerCount).toBeGreaterThan(0);
  });

  test('should have sortable column headers (basic sorting setup)', async () => {
    // Navigate to roster editor
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 15000 });

    // Get all column headers
    const headers = window.locator('.ag-header-cell');
    const headerCount = await headers.count();

    // Check each header for sortable functionality
    for (let i = 0; i < Math.min(headerCount, 10); i++) { // Limit to first 10 headers
      const header = headers.nth(i);
      const headerText = await header.locator('.ag-header-cell-text').textContent();

      // Check if header has sortable class or attributes
      const classes = await header.getAttribute('class');
      const role = await header.getAttribute('role');

      console.log(`Header ${i}: "${headerText}" - Classes: ${classes}, Role: ${role}`);

      // Headers should be clickable (role=columnheader) for sorting
      expect(role).toBe('columnheader');
    }

    // Take screenshot of headers
    await window.screenshot({
      path: './test-results/sorting-column-headers.png',
      clip: { x: 0, y: 0, width: 1200, height: 150 }
    });
  });

  test('should test basic single-column sorting by clicking headers', async () => {
    // Navigate to roster editor
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 15000 });

    // Wait for data to load completely
    await window.waitForTimeout(2000);

    // Find a text-based column to test (like player name)
    const nameHeader = window.locator('.ag-header-cell').filter({ hasText: /Name|Player|PLNA/ }).first();

    if (await nameHeader.count() > 0) {
      console.log('Testing sorting on name/player column...');

      // Get initial order of first few player names
      const initialRows = await window.locator('.ag-row').first().locator('.ag-cell').allTextContents();
      console.log('Initial first row data:', initialRows.slice(0, 5));

      // Click the header to sort
      await nameHeader.click();

      // Wait for sort to complete
      await window.waitForTimeout(1500);

      // Take screenshot after first sort
      await window.screenshot({
        path: './test-results/sorting-after-first-click.png',
        fullPage: true
      });

      // Get new order
      const sortedRows = await window.locator('.ag-row').first().locator('.ag-cell').allTextContents();
      console.log('After first sort first row data:', sortedRows.slice(0, 5));

      // Click again to reverse sort
      await nameHeader.click();
      await window.waitForTimeout(1500);

      // Take screenshot after second sort
      await window.screenshot({
        path: './test-results/sorting-after-second-click.png',
        fullPage: true
      });

      const reverseSortedRows = await window.locator('.ag-row').first().locator('.ag-cell').allTextContents();
      console.log('After second sort first row data:', reverseSortedRows.slice(0, 5));

      // Check if sorting actually changed the order
      const sortingWorked = JSON.stringify(initialRows) !== JSON.stringify(sortedRows) ||
                          JSON.stringify(sortedRows) !== JSON.stringify(reverseSortedRows);

      console.log('Sorting appears to be working:', sortingWorked);

      if (!sortingWorked) {
        console.log('⚠️  WARNING: Sorting may not be working - data order unchanged');
      }
    } else {
      console.log('No name/player column found for sorting test');
    }
  });

  test('should check for sort indicators/arrows on headers', async () => {
    // Navigate to roster editor
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 15000 });
    await window.waitForTimeout(2000);

    // Find any column header and click it
    const firstHeader = window.locator('.ag-header-cell').first();
    await firstHeader.click();
    await window.waitForTimeout(1000);

    // Look for sort indicators
    const sortAscending = window.locator('.ag-sort-ascending-icon, .ag-icon-asc, [class*="sort"][class*="asc"]');
    const sortDescending = window.locator('.ag-sort-descending-icon, .ag-icon-desc, [class*="sort"][class*="desc"]');
    const sortNone = window.locator('.ag-sort-none-icon, .ag-icon-none');

    const ascCount = await sortAscending.count();
    const descCount = await sortDescending.count();
    const noneCount = await sortNone.count();

    console.log(`Sort indicators found - Ascending: ${ascCount}, Descending: ${descCount}, None: ${noneCount}`);

    // Take screenshot focused on header area to see sort indicators
    await window.screenshot({
      path: './test-results/sorting-indicators-check.png',
      clip: { x: 0, y: 0, width: 1200, height: 200 }
    });

    // Click again to change sort direction
    await firstHeader.click();
    await window.waitForTimeout(1000);

    // Check indicators again
    const ascCount2 = await sortAscending.count();
    const descCount2 = await sortDescending.count();

    console.log(`After second click - Ascending: ${ascCount2}, Descending: ${descCount2}`);

    // Take another screenshot
    await window.screenshot({
      path: './test-results/sorting-indicators-after-second-click.png',
      clip: { x: 0, y: 0, width: 1200, height: 200 }
    });
  });

  test('should test multi-column sorting with Ctrl+Click', async () => {
    // Navigate to roster editor
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 15000 });
    await window.waitForTimeout(2000);

    // Find two different column headers
    const headers = window.locator('.ag-header-cell');
    const headerCount = await headers.count();

    if (headerCount >= 2) {
      const firstHeader = headers.nth(0);
      const secondHeader = headers.nth(1);

      // Click first header normally
      await firstHeader.click();
      await window.waitForTimeout(1000);

      // Take screenshot after first sort
      await window.screenshot({
        path: './test-results/multi-sort-first-column.png',
        clip: { x: 0, y: 0, width: 1200, height: 400 }
      });

      // Ctrl+Click second header for multi-column sort
      await secondHeader.click({ modifiers: ['Control'] });
      await window.waitForTimeout(1000);

      // Take screenshot after multi-column sort
      await window.screenshot({
        path: './test-results/multi-sort-two-columns.png',
        clip: { x: 0, y: 0, width: 1200, height: 400 }
      });

      // Check if multiple sort indicators are visible
      const sortIndicators = window.locator('[class*="sort"][class*="asc"], [class*="sort"][class*="desc"], .ag-sort-ascending-icon, .ag-sort-descending-icon');
      const indicatorCount = await sortIndicators.count();

      console.log(`Multi-column sort indicators found: ${indicatorCount}`);

      if (indicatorCount < 2) {
        console.log('⚠️  WARNING: Multi-column sorting may not be working - expected 2+ sort indicators');
      }
    }
  });

  test('should test sorting on different data types', async () => {
    // Navigate to roster editor
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 15000 });
    await window.waitForTimeout(2000);

    // Get all headers and test different ones
    const headers = window.locator('.ag-header-cell');
    const headerCount = await headers.count();

    // Test up to 5 different columns to see sorting behavior on different data types
    for (let i = 0; i < Math.min(headerCount, 5); i++) {
      const header = headers.nth(i);
      const headerText = await header.locator('.ag-header-cell-text').textContent();

      console.log(`Testing sorting on column: "${headerText}"`);

      // Get some cell values before sorting
      const cellValues = await window.locator('.ag-row').first().locator('.ag-cell').nth(i).textContent();
      console.log(`Sample value before sort: "${cellValues}"`);

      // Click to sort
      await header.click();
      await window.waitForTimeout(1000);

      // Get cell values after sorting
      const sortedCellValues = await window.locator('.ag-row').first().locator('.ag-cell').nth(i).textContent();
      console.log(`Sample value after sort: "${sortedCellValues}"`);

      // Take screenshot for each column sort test
      await window.screenshot({
        path: `./test-results/sorting-column-${i}-${headerText?.replace(/[^a-zA-Z0-9]/g, '') || 'unknown'}.png`,
        clip: { x: 0, y: 0, width: 1200, height: 400 }
      });
    }
  });

  test('should check browser console for sorting-related errors', async () => {
    const consoleMessages = [];
    const consoleErrors = [];

    // Listen for console messages
    window.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to roster editor
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 15000 });
    await window.waitForTimeout(2000);

    // Perform several sorting operations
    const headers = window.locator('.ag-header-cell');
    const headerCount = await headers.count();

    for (let i = 0; i < Math.min(headerCount, 3); i++) {
      await headers.nth(i).click();
      await window.waitForTimeout(500);
    }

    // Wait a bit more to catch any delayed errors
    await window.waitForTimeout(2000);

    // Report console messages
    console.log('\n=== CONSOLE MESSAGES DURING SORTING ===');
    consoleMessages.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg}`);
    });

    console.log('\n=== CONSOLE ERRORS DURING SORTING ===');
    if (consoleErrors.length === 0) {
      console.log('✅ No console errors detected during sorting operations');
    } else {
      consoleErrors.forEach((error, index) => {
        console.log(`❌ Error ${index + 1}: ${error}`);
      });
    }

    // Take final screenshot
    await window.screenshot({
      path: './test-results/sorting-final-state.png',
      fullPage: true
    });

    // Log summary
    console.log('\n=== SORTING TEST SUMMARY ===');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`Headers found: ${headerCount}`);
  });
});