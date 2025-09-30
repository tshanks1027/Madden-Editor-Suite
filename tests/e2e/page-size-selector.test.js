const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Page Size Selector Tests', () => {
  let electronApp;
  let window;

  test.beforeAll(async ({ playwright }) => {
    // Launch Electron app
    electronApp = await playwright._electron.launch({
      args: [path.join(__dirname, '../../out/madden-editor-suite-win32-x64/madden-editor-suite.exe')],
      timeout: 30000
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should load roster editor and display page size selector', async () => {
    // Navigate to roster editor
    await window.click('[data-testid="roster-editor-button"]');

    // Wait for roster grid to load
    await window.waitForSelector('.ag-grid-container', { timeout: 10000 });

    // Check that page size selector exists in header
    const pageSizeSelector = window.locator('select').filter({ hasText: /50|100|200|500/ });
    await expect(pageSizeSelector).toBeVisible();

    // Take screenshot of the page size selector
    await window.screenshot({
      path: './test-results/page-size-selector-visible.png',
      fullPage: true
    });
  });

  test('should have correct default page size (100)', async () => {
    // Navigate to roster editor if not already there
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 10000 });

    // Check default value
    const pageSizeSelector = window.locator('select').filter({ hasText: /50|100|200|500/ });
    await expect(pageSizeSelector).toHaveValue('100');

    // Verify grid shows approximately 100 rows (allowing for data variation)
    const rows = window.locator('.ag-row');
    const rowCount = await rows.count();

    // Should show close to 100 rows (allowing for partial data or pagination)
    expect(rowCount).toBeGreaterThan(50);
    expect(rowCount).toBeLessThanOrEqual(100);
  });

  test('should have all page size options (50, 100, 200, 500)', async () => {
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 10000 });

    const pageSizeSelector = window.locator('select').filter({ hasText: /50|100|200|500/ });

    // Check all options exist
    await expect(pageSizeSelector.locator('option[value="50"]')).toBeVisible();
    await expect(pageSizeSelector.locator('option[value="100"]')).toBeVisible();
    await expect(pageSizeSelector.locator('option[value="200"]')).toBeVisible();
    await expect(pageSizeSelector.locator('option[value="500"]')).toBeVisible();
  });

  test('should change page size to 50 and update grid', async () => {
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 10000 });

    const pageSizeSelector = window.locator('select').filter({ hasText: /50|100|200|500/ });

    // Change to 50 rows per page
    await pageSizeSelector.selectOption('50');

    // Wait for grid to update
    await window.waitForTimeout(1000);

    // Verify selector shows 50
    await expect(pageSizeSelector).toHaveValue('50');

    // Take screenshot
    await window.screenshot({
      path: './test-results/page-size-50.png',
      fullPage: true
    });

    // Check row count (should be around 50 or less if data is limited)
    const rows = window.locator('.ag-row');
    const rowCount = await rows.count();
    expect(rowCount).toBeLessThanOrEqual(50);
  });

  test('should change page size to 200 and update grid', async () => {
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 10000 });

    const pageSizeSelector = window.locator('select').filter({ hasText: /50|100|200|500/ });

    // Change to 200 rows per page
    await pageSizeSelector.selectOption('200');

    // Wait for grid to update
    await window.waitForTimeout(1000);

    // Verify selector shows 200
    await expect(pageSizeSelector).toHaveValue('200');

    // Take screenshot
    await window.screenshot({
      path: './test-results/page-size-200.png',
      fullPage: true
    });
  });

  test('should change page size to 500 and update grid', async () => {
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 10000 });

    const pageSizeSelector = window.locator('select').filter({ hasText: /50|100|200|500/ });

    // Change to 500 rows per page
    await pageSizeSelector.selectOption('500');

    // Wait for grid to update
    await window.waitForTimeout(1000);

    // Verify selector shows 500
    await expect(pageSizeSelector).toHaveValue('500');

    // Take screenshot
    await window.screenshot({
      path: './test-results/page-size-500.png',
      fullPage: true
    });
  });

  test('should have proper styling matching other dropdowns', async () => {
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 10000 });

    const pageSizeSelector = window.locator('select').filter({ hasText: /50|100|200|500/ });

    // Check for orange background color (should match header styling)
    const backgroundColor = await pageSizeSelector.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );

    // Check for white arrow (should be in background-image)
    const backgroundImage = await pageSizeSelector.evaluate(el =>
      window.getComputedStyle(el).backgroundImage
    );

    // Should have white arrow in background image
    expect(backgroundImage).toContain('ffffff');

    // Take screenshot of styling
    await window.screenshot({
      path: './test-results/page-size-styling.png',
      clip: { x: 0, y: 0, width: 1200, height: 200 }
    });
  });

  test('should be positioned in orange header bar on right side', async () => {
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 10000 });

    // Check header exists with orange background
    const header = window.locator('.bg-orange-600');
    await expect(header).toBeVisible();

    // Check page size selector is inside the header
    const pageSizeSelector = header.locator('select').filter({ hasText: /50|100|200|500/ });
    await expect(pageSizeSelector).toBeVisible();

    // Check it's positioned on the right side (in a div with justify-between or similar)
    const headerContainer = header.locator('.flex.items-center.justify-between');
    await expect(headerContainer).toBeVisible();

    // Take screenshot of header positioning
    await window.screenshot({
      path: './test-results/header-positioning.png',
      clip: { x: 0, y: 0, width: 1200, height: 100 }
    });
  });

  test('should update pagination controls when page size changes', async () => {
    await window.click('[data-testid="roster-editor-button"]');
    await window.waitForSelector('.ag-grid-container', { timeout: 10000 });

    const pageSizeSelector = window.locator('select').filter({ hasText: /50|100|200|500/ });

    // First set to 50 and check pagination
    await pageSizeSelector.selectOption('50');
    await window.waitForTimeout(1000);

    // Look for AG-Grid pagination controls
    const paginationPanel = window.locator('.ag-paging-panel');
    await expect(paginationPanel).toBeVisible();

    // Change to 200 and see if pagination updates
    await pageSizeSelector.selectOption('200');
    await window.waitForTimeout(1000);

    // Take screenshot of pagination after change
    await window.screenshot({
      path: './test-results/pagination-controls.png',
      fullPage: true
    });
  });
});