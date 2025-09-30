const { test, expect } = require('@playwright/test');

test.describe('AG-Grid Sorting Debug', () => {
  test('Debug column sorting functionality', async ({ page }) => {
    console.log('🔍 STARTING SORTING DEBUG SESSION');

    try {
      // Navigate to the Electron app
      await page.goto('http://localhost:3000');
      console.log('✅ Page loaded successfully');

      // Wait for the app to load
      await page.waitForSelector('.ag-theme-alpine', { timeout: 10000 });
      console.log('✅ AG-Grid container found');

      // Wait for grid to be ready
      await page.waitForSelector('.ag-header-cell', { timeout: 10000 });
      console.log('✅ AG-Grid headers loaded');

      // Get all header cells
      const headerCells = await page.locator('.ag-header-cell').all();
      console.log(`✅ Found ${headerCells.length} header cells`);

      // Check if any header cells are sortable
      for (let i = 0; i < Math.min(headerCells.length, 5); i++) {
        const headerCell = headerCells[i];
        const headerText = await headerCell.textContent();

        // Check classes
        const classes = await headerCell.getAttribute('class');
        console.log(`📋 Header "${headerText}": classes = ${classes}`);

        // Check if sortable class exists
        const isSortable = classes?.includes('ag-header-cell-sortable');
        console.log(`🔍 Header "${headerText}" sortable: ${isSortable}`);

        // Check for cursor style
        const cursor = await headerCell.evaluate(el => window.getComputedStyle(el).cursor);
        console.log(`👆 Header "${headerText}" cursor: ${cursor}`);
      }

      // Try clicking on a specific column header (Last Name / PLNA)
      console.log('🖱️ Attempting to click on column header...');

      // Listen for console events
      page.on('console', msg => {
        console.log(`🖥️ BROWSER CONSOLE: ${msg.type()}: ${msg.text()}`);
      });

      // Listen for page errors
      page.on('pageerror', error => {
        console.log(`❌ PAGE ERROR: ${error.message}`);
      });

      // Try to find and click the first sortable header
      const sortableHeader = await page.locator('.ag-header-cell-sortable').first();

      if (await sortableHeader.count() > 0) {
        const headerText = await sortableHeader.textContent();
        console.log(`🖱️ Clicking on sortable header: "${headerText}"`);

        // Click the header
        await sortableHeader.click();
        console.log('✅ Header clicked');

        // Wait a moment for any changes
        await page.waitForTimeout(1000);

        // Check for sort indicators
        const sortAsc = await page.locator('.ag-icon-asc').count();
        const sortDesc = await page.locator('.ag-icon-desc').count();
        console.log(`📊 Sort indicators: asc=${sortAsc}, desc=${sortDesc}`);

        // Check for any sort-related classes
        const headerWithSort = await page.locator('.ag-header-cell-sorted-asc, .ag-header-cell-sorted-desc').count();
        console.log(`📊 Headers with sort classes: ${headerWithSort}`);

        // Try clicking again for desc sort
        console.log('🖱️ Clicking again for descending sort...');
        await sortableHeader.click();
        await page.waitForTimeout(1000);

        const sortAsc2 = await page.locator('.ag-icon-asc').count();
        const sortDesc2 = await page.locator('.ag-icon-desc').count();
        console.log(`📊 Sort indicators after 2nd click: asc=${sortAsc2}, desc=${sortDesc2}`);

      } else {
        console.log('❌ No sortable headers found!');

        // Check if we can find any headers at all
        const allHeaders = await page.locator('.ag-header-cell').all();
        for (const header of allHeaders) {
          const text = await header.textContent();
          const classes = await header.getAttribute('class');
          console.log(`📋 Found header: "${text}" with classes: ${classes}`);
        }
      }

      // Check grid options by examining the grid instance
      const gridInfo = await page.evaluate(() => {
        // Try to find the grid instance
        const gridElement = document.querySelector('.ag-theme-alpine');
        if (gridElement && gridElement.__agGridReact) {
          const api = gridElement.__agGridReact.api;
          return {
            hasApi: !!api,
            columnDefs: api?.getColumnDefs ? api.getColumnDefs().length : 'unknown',
            rowCount: api?.getDisplayedRowCount ? api.getDisplayedRowCount() : 'unknown'
          };
        }
        return { hasApi: false };
      });

      console.log('🔍 Grid API info:', JSON.stringify(gridInfo, null, 2));

      // Take a screenshot for visual inspection
      await page.screenshot({
        path: 'sorting-debug-screenshot.png',
        fullPage: true
      });
      console.log('📸 Screenshot saved');

    } catch (error) {
      console.error('❌ Error during debugging:', error);

      // Take error screenshot
      try {
        await page.screenshot({
          path: 'sorting-error-screenshot.png',
          fullPage: true
        });
      } catch (screenshotError) {
        console.error('Failed to take error screenshot:', screenshotError);
      }

      throw error;
    }
  });
});