const { test, expect } = require('@playwright/test');

test.describe('Lookup Service Debug', () => {
  test('Debug lookup service initialization', async ({ page }) => {
    console.log('🔍 STARTING LOOKUP SERVICE DEBUG');

    try {
      // Navigate to the Electron app
      await page.goto('http://localhost:3000');
      console.log('✅ Page loaded successfully');

      // Skip splash screen
      try {
        await page.waitForSelector('.splash-screen', { timeout: 3000 });
        await page.waitForSelector('.splash-screen', { state: 'detached', timeout: 5000 });
      } catch (e) {
        console.log('ℹ️ No splash screen detected');
      }

      // Wait for main app to load
      await page.waitForSelector('header', { timeout: 10000 });
      console.log('✅ Main app header loaded');

      // Test the lookup API directly
      console.log('🔧 Testing lookup API directly...');

      const lookupStatus = await page.evaluate(async () => {
        try {
          // Test if electronAPI is available
          if (!window.electronAPI) {
            return { error: 'electronAPI not available' };
          }

          if (!window.electronAPI.lookup) {
            return { error: 'lookup API not available' };
          }

          // Test isReady
          const isReady = await window.electronAPI.lookup.isReady();
          console.log('Lookup isReady:', isReady);

          // Test getStatus
          const status = await window.electronAPI.lookup.getStatus();
          console.log('Lookup status:', status);

          // Test getting dropdown options
          let positionOptions = [];
          try {
            positionOptions = await window.electronAPI.lookup.getDropdownOptions('position_lookup.csv');
            console.log('Position options count:', positionOptions.length);
          } catch (error) {
            console.error('Error getting position options:', error);
          }

          return {
            isReady,
            status,
            positionOptionsCount: positionOptions.length,
            positionOptionsSample: positionOptions.slice(0, 3)
          };
        } catch (error) {
          return { error: error.message, stack: error.stack };
        }
      });

      console.log('📊 Lookup API Test Results:');
      console.log(JSON.stringify(lookupStatus, null, 2));

      // If lookup is not ready, try to reload it
      if (!lookupStatus.isReady) {
        console.log('🔄 Attempting to reload lookup service...');

        const reloadResult = await page.evaluate(async () => {
          try {
            const result = await window.electronAPI.lookup.reload();
            console.log('Reload result:', result);

            // Check status again after reload
            const newStatus = await window.electronAPI.lookup.getStatus();
            console.log('Status after reload:', newStatus);

            return { reloadResult: result, newStatus };
          } catch (error) {
            return { error: error.message };
          }
        });

        console.log('🔄 Reload Results:');
        console.log(JSON.stringify(reloadResult, null, 2));
      }

      // Test file path resolution by checking what the service thinks it's loading
      console.log('📁 Testing file path resolution...');

      // Take a screenshot for visual debugging
      await page.screenshot({
        path: 'lookup-debug-test.png',
        fullPage: true
      });

      console.log('✅ Lookup service debug completed');

    } catch (error) {
      console.error('❌ Error during lookup debug:', error);

      await page.screenshot({
        path: 'lookup-debug-error.png',
        fullPage: true
      });

      throw error;
    }
  });
});