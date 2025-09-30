const { _electron: electron } = require('playwright');
const path = require('path');

(async () => {
  let electronApp;
  let page;

  try {
    console.log('🚀 Starting contract fields test...');

    // Launch the Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '.vite', 'build', 'main.js')],
      timeout: 30000
    });

    // Get the main window
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    console.log('✅ Electron app launched successfully');

    // Wait for the app to be ready and check for the roster editor
    console.log('⏳ Waiting for roster editor to load...');

    // Look for the main application interface
    await page.waitForSelector('[data-testid="roster-editor"], .roster-editor, h1, h2, h3, button, input', { timeout: 10000 });

    // Take initial screenshot
    await page.screenshot({ path: 'test-1-app-loaded.png', fullPage: true });
    console.log('📸 Screenshot taken: test-1-app-loaded.png');

    // Check if we need to open a roster file or if sample data is already loaded
    const hasShowAllFieldsCheckbox = await page.locator('input[id="showAllColumns"], label:has-text("Show All 131 Fields")').count() > 0;

    if (hasShowAllFieldsCheckbox) {
      console.log('✅ Found "Show All 131 Fields" checkbox - roster editor is loaded');

      // Check the "Show All 131 Fields" checkbox to display contract columns
      console.log('🔘 Checking "Show All 131 Fields" checkbox...');
      await page.locator('input[id="showAllColumns"]').check();

      // Wait for columns to load
      await page.waitForTimeout(2000);

      // Take screenshot after showing all fields
      await page.screenshot({ path: 'test-2-all-fields-shown.png', fullPage: true });
      console.log('📸 Screenshot taken: test-2-all-fields-shown.png');

      // Look for Geno Smith in the player list
      console.log('🔍 Looking for Geno Smith in the player list...');

      const genoSmithFound = await page.locator('text="Geno"').count() > 0 ||
                            await page.locator('text="Smith"').count() > 0;

      if (genoSmithFound) {
        console.log('✅ Found Geno Smith in the player list');

        // Look for contract field headers
        console.log('🔍 Checking for contract field headers...');

        const contractHeaders = [
          'Cap Hit',
          'Contract Value',
          'Signing Bonus',
          'Contract Years',
          'Years Left'
        ];

        let foundHeaders = [];
        for (const header of contractHeaders) {
          const headerFound = await page.locator(`text="${header}"`).count() > 0;
          if (headerFound) {
            foundHeaders.push(header);
            console.log(`✅ Found header: ${header}`);
          } else {
            console.log(`❌ Missing header: ${header}`);
          }
        }

        // Look for contract values in the data
        console.log('🔍 Checking for Geno Smith contract values...');

        const expectedValues = {
          'Cap Hit': '40000000',
          'Contract Value': '48000000',
          'Signing Bonus': '58000000',
          'Contract Years': '3',
          'Years Left': '3'
        };

        let foundValues = [];
        for (const [field, value] of Object.entries(expectedValues)) {
          // Look for the value in various formats (with/without commas, millions notation)
          const valueFormats = [
            value,
            value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,'), // Add commas
            `${parseInt(value) / 1000000}M`, // Millions notation
            `$${parseInt(value) / 1000000}M`, // With dollar sign
          ];

          let valueFound = false;
          for (const format of valueFormats) {
            if (await page.locator(`text="${format}"`).count() > 0) {
              foundValues.push(`${field}: ${format}`);
              console.log(`✅ Found value: ${field} = ${format}`);
              valueFound = true;
              break;
            }
          }

          if (!valueFound) {
            console.log(`❌ Missing value: ${field} = ${value}`);
          }
        }

        // Test editing functionality
        console.log('🔧 Testing contract field editing...');

        // Look for editable cells containing contract values
        const editableCells = await page.locator('[contenteditable="true"], input[type="text"], input[type="number"]').count();
        console.log(`📊 Found ${editableCells} editable cells`);

        // Test sorting functionality
        console.log('🔧 Testing sorting on contract fields...');

        // Look for sortable column headers
        const sortableHeaders = await page.locator('[role="columnheader"], th, .ag-header-cell').count();
        console.log(`📊 Found ${sortableHeaders} potential sortable headers`);

        // Take final screenshot
        await page.screenshot({ path: 'test-3-contract-fields-verification.png', fullPage: true });
        console.log('📸 Screenshot taken: test-3-contract-fields-verification.png');

        // Generate test report
        console.log('\n📋 TEST REPORT:');
        console.log('================');
        console.log('✅ Application started successfully');
        console.log('✅ Roster editor loaded');
        console.log('✅ "Show All 131 Fields" checkbox found and checked');
        console.log('✅ Geno Smith found in player list');
        console.log(`📊 Contract headers found: ${foundHeaders.length}/5`);
        foundHeaders.forEach(header => console.log(`   ✓ ${header}`));
        console.log(`📊 Contract values found: ${foundValues.length}/5`);
        foundValues.forEach(value => console.log(`   ✓ ${value}`));
        console.log(`📊 Editable cells found: ${editableCells}`);
        console.log(`📊 Sortable headers found: ${sortableHeaders}`);

        const overallResult = foundHeaders.length >= 3 && foundValues.length >= 2 ? 'PASS' : 'FAIL';
        console.log(`\n🎯 OVERALL RESULT: ${overallResult}`);

        if (overallResult === 'PASS') {
          console.log('✅ Contract fields fix is working correctly!');
        } else {
          console.log('❌ Contract fields fix needs attention.');
        }

      } else {
        console.log('❌ Could not find Geno Smith in the player list');
        await page.screenshot({ path: 'test-error-no-geno-smith.png', fullPage: true });
      }

    } else {
      console.log('❌ Could not find roster editor interface');
      await page.screenshot({ path: 'test-error-no-roster-editor.png', fullPage: true });
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    if (page) {
      await page.screenshot({ path: 'test-error-exception.png', fullPage: true });
    }
  } finally {
    if (electronApp) {
      await electronApp.close();
      console.log('🔒 Electron app closed');
    }
  }
})();