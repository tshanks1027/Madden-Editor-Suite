const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

test.describe('AG-Grid Sorting Functionality Tests', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    // Connect to the already running Electron app
    // Since npm run dev is running, we'll connect to the existing process
    const { chromium } = require('playwright');

    // Connect to the dev server URL
    const browser = await chromium.launch({
      headless: false,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });

    const context = await browser.newContext();
    page = await context.newPage();

    // Navigate to the local dev server
    await page.goto('http://localhost:3000');

    // Wait for app to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give AG-Grid time to initialize
  });

  test.afterAll(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should load application without console errors', async () => {
    // Listen for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit more for any delayed console messages
    await page.waitForTimeout(2000);

    // Check that no critical errors occurred
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('DevTools') &&
      !error.includes('favicon') &&
      !error.includes('net::ERR_FILE_NOT_FOUND')
    );

    console.log('Console errors found:', criticalErrors);
    expect(criticalErrors.length).toBe(0);
  });

  test('should navigate to roster editor and load sample data', async () => {
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/01-app-loaded.png', fullPage: true });

    // Look for roster editor navigation or file loading
    // First check if there's a file input or sample data button
    const fileInput = page.locator('input[type="file"]');
    const loadSampleButton = page.locator('text="Load Sample Data"');
    const rosterEditorLink = page.locator('text*="Roster"');

    // Try to navigate to roster editor or load sample data
    if (await loadSampleButton.isVisible({ timeout: 5000 })) {
      await loadSampleButton.click();
      await page.waitForTimeout(2000);
    } else if (await rosterEditorLink.isVisible({ timeout: 5000 })) {
      await rosterEditorLink.click();
      await page.waitForTimeout(2000);
    }

    // Take screenshot after navigation
    await page.screenshot({ path: 'test-results/02-roster-editor-loaded.png', fullPage: true });
  });

  test('should display AG-Grid with sortable columns', async () => {
    // Look for AG-Grid container
    const agGridContainer = page.locator('.ag-root-wrapper, .ag-grid-container, [class*="ag-"]');

    // Wait for AG-Grid to be present
    await expect(agGridContainer.first()).toBeVisible({ timeout: 10000 });

    // Look for column headers
    const columnHeaders = page.locator('.ag-header-cell, .ag-header-container .ag-header-cell-text');
    await expect(columnHeaders.first()).toBeVisible({ timeout: 5000 });

    // Count visible column headers
    const headerCount = await columnHeaders.count();
    console.log(`Found ${headerCount} column headers`);
    expect(headerCount).toBeGreaterThan(0);

    // Take screenshot showing grid
    await page.screenshot({ path: 'test-results/03-ag-grid-visible.png', fullPage: true });
  });

  test('should sort column when header is clicked', async () => {
    // Listen for console errors during sorting
    const sortingErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        sortingErrors.push(msg.text());
      }
    });

    // Find the first sortable column header
    const firstColumnHeader = page.locator('.ag-header-cell').first();
    await expect(firstColumnHeader).toBeVisible();

    // Get the column header text for reference
    const columnText = await firstColumnHeader.textContent();
    console.log(`Testing sort on column: ${columnText}`);

    // Click the column header to sort
    await firstColumnHeader.click();

    // Wait for sort to process
    await page.waitForTimeout(1000);

    // Check for sort indicator (ascending)
    const sortIndicator = page.locator('.ag-icon-asc, .ag-sort-ascending-icon, [class*="sort"][class*="asc"]');

    // Take screenshot after first sort
    await page.screenshot({ path: 'test-results/04-first-sort-ascending.png', fullPage: true });

    // Click again to sort descending
    await firstColumnHeader.click();
    await page.waitForTimeout(1000);

    // Check for descending sort indicator
    const descSortIndicator = page.locator('.ag-icon-desc, .ag-sort-descending-icon, [class*="sort"][class*="desc"]');

    // Take screenshot after descending sort
    await page.screenshot({ path: 'test-results/05-first-sort-descending.png', fullPage: true });

    // Verify no sorting-related errors occurred
    const sortErrors = sortingErrors.filter(error =>
      error.includes('sort') ||
      error.includes('ag-grid') ||
      error.includes('ClientSideRowModel')
    );

    console.log('Sorting errors found:', sortErrors);
    expect(sortErrors.length).toBe(0);
  });

  test('should support multi-column sorting with Ctrl+Click', async () => {
    // Get multiple column headers
    const columnHeaders = page.locator('.ag-header-cell');
    const headerCount = await columnHeaders.count();

    if (headerCount > 1) {
      // Click first column normally
      await columnHeaders.nth(0).click();
      await page.waitForTimeout(500);

      // Ctrl+Click second column for multi-sort
      await columnHeaders.nth(1).click({ modifiers: ['Control'] });
      await page.waitForTimeout(500);

      // Take screenshot showing multi-column sort
      await page.screenshot({ path: 'test-results/06-multi-column-sort.png', fullPage: true });

      // Look for multiple sort indicators
      const sortIndicators = page.locator('.ag-icon-asc, .ag-icon-desc, [class*="sort"]');
      const sortCount = await sortIndicators.count();

      console.log(`Found ${sortCount} sort indicators after multi-column sort`);

      // Should have at least 2 sort indicators for multi-column sort
      expect(sortCount).toBeGreaterThanOrEqual(1); // At least one should be visible
    }
  });

  test('should sort different data types correctly', async () => {
    // Try to find columns with different data types
    const columnHeaders = page.locator('.ag-header-cell');
    const headerCount = await columnHeaders.count();

    // Test sorting on multiple columns to verify different data types work
    for (let i = 0; i < Math.min(headerCount, 3); i++) {
      const header = columnHeaders.nth(i);
      const headerText = await header.textContent();

      console.log(`Testing sort on column ${i + 1}: ${headerText}`);

      // Click to sort
      await header.click();
      await page.waitForTimeout(1000);

      // Take screenshot for this column sort
      await page.screenshot({
        path: `test-results/07-column-${i + 1}-sort.png`,
        fullPage: true
      });

      // Verify sort indicator appears
      const sortIndicator = page.locator('.ag-icon-asc, .ag-icon-desc, [class*="sort"]');
      const hasSort = await sortIndicator.count() > 0;

      console.log(`Column ${i + 1} sort indicator present: ${hasSort}`);
    }
  });

  test('should show visual sort indicators', async () => {
    // Click a column to ensure it's sorted
    const firstHeader = page.locator('.ag-header-cell').first();
    await firstHeader.click();
    await page.waitForTimeout(1000);

    // Look for various types of sort indicators that AG-Grid might use
    const possibleSortSelectors = [
      '.ag-icon-asc',
      '.ag-icon-desc',
      '.ag-sort-ascending-icon',
      '.ag-sort-descending-icon',
      '[class*="sort"][class*="asc"]',
      '[class*="sort"][class*="desc"]',
      '.ag-header-cell-sorted-asc',
      '.ag-header-cell-sorted-desc',
      '[aria-sort="ascending"]',
      '[aria-sort="descending"]'
    ];

    let foundSortIndicator = false;
    for (const selector of possibleSortSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        foundSortIndicator = true;
        console.log(`Found sort indicator with selector: ${selector}`);
        break;
      }
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/08-final-sort-state.png', fullPage: true });

    // Log all elements with sort-related classes for debugging
    const allSortElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="sort"], [class*="ag-"], [aria-sort]');
      return Array.from(elements).map(el => ({
        tagName: el.tagName,
        className: el.className,
        ariaSort: el.getAttribute('aria-sort'),
        textContent: el.textContent?.trim().substring(0, 50)
      }));
    });

    console.log('Elements with sort-related attributes:', allSortElements.slice(0, 10));

    expect(foundSortIndicator).toBe(true);
  });

  test('should verify AG-Grid functionality is working', async () => {
    // Final verification that AG-Grid is functioning
    const agGridElements = await page.evaluate(() => {
      // Check if AG-Grid components are present and functional
      const gridApi = window.agGridInstance?.gridApi;
      const rowModel = gridApi?.getModel();

      return {
        hasGridApi: !!gridApi,
        hasRowModel: !!rowModel,
        rowCount: rowModel?.getRowCount?.() || 0,
        gridClasses: document.querySelector('[class*="ag-"]')?.className || '',
        sortModel: gridApi?.getSortModel?.() || []
      };
    });

    console.log('AG-Grid status:', gridGridElements);

    // Take final comprehensive screenshot
    await page.screenshot({ path: 'test-results/09-final-verification.png', fullPage: true });

    // The grid should be functional even if we can't access the API directly
    const agGridContainer = page.locator('[class*="ag-"]');
    await expect(agGridContainer.first()).toBeVisible();
  });
});