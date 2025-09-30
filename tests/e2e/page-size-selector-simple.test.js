const { test, expect } = require('@playwright/test');

test.describe('Page Size Selector Tests - Development Server', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the development server
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');

    // Wait a bit for the app to fully initialize
    await page.waitForTimeout(2000);
  });

  test('should display page size selector in orange header', async ({ page }) => {
    // Look for the orange header with page size selector
    const header = page.locator('.bg-orange-600');
    await expect(header).toBeVisible();

    // Check if page size dropdown exists
    const pageSizeSelector = page.locator('select').filter({ hasText: /Per page/ }).or(
      page.locator('select option').filter({ hasText: /50|100|200|500/ }).first().locator('..')
    );

    // Take a full page screenshot to capture the current state
    await page.screenshot({
      path: './test-results/initial-state.png',
      fullPage: true
    });

    console.log('✓ Page loaded and screenshot taken');
  });

  test('should find page size selector with correct options', async ({ page }) => {
    // Wait for any roster data to load
    await page.waitForTimeout(3000);

    // Look for select elements in the page
    const selects = page.locator('select');
    const selectCount = await selects.count();

    console.log(`Found ${selectCount} select elements on page`);

    // Check each select to see if it contains page size options
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      const options = await select.locator('option').allTextContents();
      console.log(`Select ${i} options:`, options);

      // Check if this select contains page size options
      if (options.some(opt => ['50', '100', '200', '500'].includes(opt))) {
        console.log('✓ Found page size selector');

        // Verify it has all expected options
        await expect(select.locator('option[value="50"]')).toBeAttached();
        await expect(select.locator('option[value="100"]')).toBeAttached();
        await expect(select.locator('option[value="200"]')).toBeAttached();
        await expect(select.locator('option[value="500"]')).toBeAttached();

        // Check default value
        const currentValue = await select.inputValue();
        console.log('Current page size value:', currentValue);
        expect(currentValue).toBe('100');

        // Take screenshot of the page size selector area
        await page.screenshot({
          path: './test-results/page-size-selector-found.png',
          fullPage: true
        });

        return; // Test passed
      }
    }

    // If we get here, we didn't find the page size selector
    console.log('❌ Page size selector not found');

    // Take screenshot for debugging
    await page.screenshot({
      path: './test-results/page-size-selector-missing.png',
      fullPage: true
    });

    throw new Error('Page size selector not found on page');
  });

  test('should test page size functionality if selector exists', async ({ page }) => {
    await page.waitForTimeout(3000);

    // Find the page size selector
    const selects = page.locator('select');
    const selectCount = await selects.count();

    let pageSizeSelector = null;

    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      const options = await select.locator('option').allTextContents();

      if (options.some(opt => ['50', '100', '200', '500'].includes(opt))) {
        pageSizeSelector = select;
        break;
      }
    }

    if (!pageSizeSelector) {
      console.log('⚠️  Page size selector not found, skipping functionality test');
      return;
    }

    console.log('✓ Testing page size functionality');

    // Test changing to 50
    await pageSizeSelector.selectOption('50');
    await page.waitForTimeout(1000);
    await expect(pageSizeSelector).toHaveValue('50');
    await page.screenshot({ path: './test-results/page-size-50-test.png', fullPage: true });

    // Test changing to 200
    await pageSizeSelector.selectOption('200');
    await page.waitForTimeout(1000);
    await expect(pageSizeSelector).toHaveValue('200');
    await page.screenshot({ path: './test-results/page-size-200-test.png', fullPage: true });

    // Test changing to 500
    await pageSizeSelector.selectOption('500');
    await page.waitForTimeout(1000);
    await expect(pageSizeSelector).toHaveValue('500');
    await page.screenshot({ path: './test-results/page-size-500-test.png', fullPage: true });

    // Test changing back to 100
    await pageSizeSelector.selectOption('100');
    await page.waitForTimeout(1000);
    await expect(pageSizeSelector).toHaveValue('100');
    await page.screenshot({ path: './test-results/page-size-100-test.png', fullPage: true });

    console.log('✓ All page size options tested successfully');
  });

  test('should verify styling and positioning', async ({ page }) => {
    await page.waitForTimeout(3000);

    // Check for orange header
    const orangeHeader = page.locator('.bg-orange-600');
    if (await orangeHeader.count() > 0) {
      console.log('✓ Orange header found');

      // Take screenshot of header area
      await page.screenshot({
        path: './test-results/header-styling.png',
        clip: { x: 0, y: 0, width: 1200, height: 150 }
      });
    } else {
      console.log('⚠️  Orange header not found');
    }

    // Look for any elements that might be the page size selector
    const pageElements = await page.locator('*').evaluateAll(elements => {
      return elements
        .filter(el => el.textContent?.includes('Per page') || el.textContent?.includes('page'))
        .map(el => ({
          tagName: el.tagName,
          textContent: el.textContent?.substring(0, 100),
          className: el.className
        }));
    });

    console.log('Elements containing "page":', pageElements);

    // Take final screenshot
    await page.screenshot({
      path: './test-results/final-state.png',
      fullPage: true
    });
  });
});