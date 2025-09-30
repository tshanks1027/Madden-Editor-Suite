const { test, expect } = require('@playwright/test');

test.describe('AG-Grid Sorting Comprehensive Debug', () => {
  test('Debug complete sorting flow with sample data', async ({ page }) => {
    console.log('🔍 STARTING COMPREHENSIVE SORTING DEBUG');

    try {
      // Navigate to the Electron app
      await page.goto('http://localhost:3000');
      console.log('✅ Page loaded successfully');

      // Skip the splash screen by waiting for it to disappear
      try {
        await page.waitForSelector('.splash-screen', { timeout: 3000 });
        console.log('⏳ Splash screen detected, waiting for it to disappear...');
        await page.waitForSelector('.splash-screen', { state: 'detached', timeout: 5000 });
        console.log('✅ Splash screen disappeared');
      } catch (e) {
        console.log('ℹ️ No splash screen detected or already gone');
      }

      // Wait for the main app to load
      await page.waitForSelector('header', { timeout: 10000 });
      console.log('✅ Main app header loaded');

      // Check if we're in the "No players loaded" state
      const noPlayersText = await page.locator('text=No players loaded').count();
      if (noPlayersText > 0) {
        console.log('⚠️ Application is in "No players loaded" state');

        // Wait for lookup system to initialize (this should trigger sample data generation)
        console.log('⏳ Waiting for lookup system to initialize...');

        // Check if "Initializing lookup system..." text appears
        const initializingText = await page.locator('text=Initializing lookup system').count();
        if (initializingText > 0) {
          console.log('📡 Lookup system is initializing...');
          await page.waitForSelector('text=Initializing lookup system', { state: 'detached', timeout: 30000 });
          console.log('✅ Lookup system initialization complete');
        }

        // Wait a bit more for sample data to be generated
        await page.waitForTimeout(2000);

        // Check again if we still have no players
        const stillNoPlayers = await page.locator('text=No players loaded').count();
        if (stillNoPlayers > 0) {
          console.log('❌ Still no players after lookup initialization');

          // Take a screenshot for debugging
          await page.screenshot({
            path: 'no-players-debug.png',
            fullPage: true
          });

          // Check for any error messages
          const errorMessages = await page.locator('.bg-red-900, .text-red-500, .error').allTextContents();
          if (errorMessages.length > 0) {
            console.log('❌ Error messages found:', errorMessages);
          }

          // Check console for errors
          const logs = [];
          page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));

          throw new Error('Sample data was not generated after lookup initialization');
        }
      }

      // Now wait for the AG-Grid to appear
      console.log('⏳ Waiting for AG-Grid to appear...');
      await page.waitForSelector('.ag-theme-alpine', { timeout: 15000 });
      console.log('✅ AG-Grid container found');

      // Wait for grid headers to load
      await page.waitForSelector('.ag-header-cell', { timeout: 10000 });
      console.log('✅ AG-Grid headers loaded');

      // Get all header cells and analyze them
      const headerCells = await page.locator('.ag-header-cell').all();
      console.log(`✅ Found ${headerCells.length} header cells`);

      // Detailed analysis of each header
      for (let i = 0; i < Math.min(headerCells.length, 8); i++) {
        const headerCell = headerCells[i];
        const headerText = await headerCell.textContent();
        const classes = await headerCell.getAttribute('class');
        const cursor = await headerCell.evaluate(el => window.getComputedStyle(el).cursor);

        console.log(`📋 Header ${i + 1}: "${headerText}"`);
        console.log(`   Classes: ${classes}`);
        console.log(`   Cursor: ${cursor}`);
        console.log(`   Sortable: ${classes?.includes('ag-header-cell-sortable') ? 'YES' : 'NO'}`);
      }

      // Test clicking on sortable headers
      const sortableHeaders = await page.locator('.ag-header-cell-sortable').all();
      console.log(`🎯 Found ${sortableHeaders.length} sortable headers`);

      if (sortableHeaders.length === 0) {
        console.log('❌ NO SORTABLE HEADERS FOUND - This is the main issue!');

        // Check if sortable: true is being applied in column definitions
        const gridInfo = await page.evaluate(() => {
          const gridElement = document.querySelector('.ag-theme-alpine');
          if (gridElement) {
            // Try to get grid API
            const gridWrapper = gridElement.querySelector('.ag-root-wrapper');
            if (gridWrapper && window.agGrid) {
              return {
                hasAgGrid: true,
                hasGridApi: !!gridWrapper.__agGridReact,
                elementClasses: gridElement.className
              };
            }
          }
          return { hasAgGrid: false };
        });

        console.log('🔍 Grid info:', JSON.stringify(gridInfo, null, 2));

        // Take screenshot for analysis
        await page.screenshot({
          path: 'no-sortable-headers.png',
          fullPage: true
        });

        throw new Error('No sortable headers found - sortable property not being applied');
      }

      // Test clicking on the first sortable header
      const firstSortableHeader = sortableHeaders[0];
      const headerText = await firstSortableHeader.textContent();
      console.log(`🖱️ Testing click on: "${headerText}"`);

      // Listen for console messages during click
      const consoleMessages = [];
      page.on('console', msg => {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
        console.log(`🖥️ BROWSER: ${msg.type()}: ${msg.text()}`);
      });

      // First click (should sort ascending)
      await firstSortableHeader.click();
      console.log('✅ First click completed');

      await page.waitForTimeout(1000);

      // Check for sort indicators
      const sortAsc = await page.locator('.ag-icon-asc, .ag-icon-small-up').count();
      const sortDesc = await page.locator('.ag-icon-desc, .ag-icon-small-down').count();
      const sortedHeaders = await page.locator('.ag-header-cell-sorted-asc, .ag-header-cell-sorted-desc').count();

      console.log(`📊 After first click:`);
      console.log(`   Sort ASC icons: ${sortAsc}`);
      console.log(`   Sort DESC icons: ${sortDesc}`);
      console.log(`   Sorted header classes: ${sortedHeaders}`);

      if (sortAsc === 0 && sortDesc === 0 && sortedHeaders === 0) {
        console.log('❌ NO SORT INDICATORS FOUND - Sorting is not working!');

        // Check if the column definition has sortable: false somehow
        const columnAnalysis = await page.evaluate(() => {
          const gridElement = document.querySelector('.ag-theme-alpine');
          if (gridElement && gridElement.__agGridReact) {
            const api = gridElement.__agGridReact.api;
            if (api && api.getColumnDefs) {
              const columnDefs = api.getColumnDefs();
              return columnDefs.slice(0, 5).map(col => ({
                field: col.field,
                headerName: col.headerName,
                sortable: col.sortable
              }));
            }
          }
          return [];
        });

        console.log('🔍 Column definitions analysis:', JSON.stringify(columnAnalysis, null, 2));
      } else {
        console.log('✅ Sort indicators found - sorting is working!');
      }

      // Second click (should sort descending)
      console.log('🖱️ Testing second click for descending sort...');
      await firstSortableHeader.click();
      await page.waitForTimeout(1000);

      const sortAsc2 = await page.locator('.ag-icon-asc, .ag-icon-small-up').count();
      const sortDesc2 = await page.locator('.ag-icon-desc, .ag-icon-small-down').count();

      console.log(`📊 After second click:`);
      console.log(`   Sort ASC icons: ${sortAsc2}`);
      console.log(`   Sort DESC icons: ${sortDesc2}`);

      // Test multi-column sorting with Ctrl+Click
      if (sortableHeaders.length > 1) {
        console.log('🖱️ Testing Ctrl+Click for multi-column sorting...');
        const secondHeader = sortableHeaders[1];
        const secondHeaderText = await secondHeader.textContent();
        console.log(`🖱️ Ctrl+clicking on: "${secondHeaderText}"`);

        await secondHeader.click({ modifiers: ['Control'] });
        await page.waitForTimeout(1000);

        const multiSortHeaders = await page.locator('.ag-header-cell-sorted-asc, .ag-header-cell-sorted-desc').count();
        console.log(`📊 Multi-sort headers: ${multiSortHeaders}`);
      }

      // Final screenshot
      await page.screenshot({
        path: 'sorting-test-complete.png',
        fullPage: true
      });

      console.log('✅ Sorting test completed successfully');
      console.log('📝 Console messages captured:', consoleMessages.length);

    } catch (error) {
      console.error('❌ Error during sorting test:', error);

      // Take error screenshot
      try {
        await page.screenshot({
          path: 'sorting-test-error.png',
          fullPage: true
        });
        console.log('📸 Error screenshot saved');
      } catch (screenshotError) {
        console.error('Failed to take error screenshot:', screenshotError);
      }

      throw error;
    }
  });
});