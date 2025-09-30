/**
 * Electron App Launcher for Playwright Tests
 *
 * Provides utilities for launching and interacting with the Electron app during E2E tests.
 */

const { _electron: electron } = require('playwright');
const path = require('path');

/**
 * Launch the Electron application for testing
 * @returns {Promise<Object>} Object containing electronApp and page
 */
async function launchElectronApp() {
  // Path to the main process entry
  const mainPath = path.join(__dirname, '../../../.vite/build/main.js');

  // Launch Electron app
  const electronApp = await electron.launch({
    args: [mainPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_ENABLE_LOGGING: '1',
    },
    timeout: 60000, // 60 seconds to launch
  });

  // Wait for first window
  const page = await electronApp.firstWindow();

  // Wait for app to be ready
  await page.waitForLoadState('domcontentloaded');

  // Wait for splash screen to disappear and app to show
  try {
    await page.waitForSelector('#app.show', { timeout: 10000 });
  } catch (error) {
    console.warn('App did not show #app.show, continuing anyway...');
  }

  return { electronApp, page };
}

/**
 * Close the Electron application
 * @param {Object} electronApp - The Electron app instance
 */
async function closeElectronApp(electronApp) {
  if (electronApp) {
    await electronApp.close();
  }
}

/**
 * Wait for element to be visible
 * @param {Object} page - Playwright page object
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 */
async function waitForElement(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, {
    state: 'visible',
    timeout
  });
}

/**
 * Get console messages from the app
 * @param {Object} page - Playwright page object
 * @returns {Array} Array of console messages
 */
function captureConsoleLogs(page) {
  const logs = [];

  page.on('console', (msg) => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString(),
    });
  });

  return logs;
}

/**
 * Take a screenshot with a descriptive name
 * @param {Object} page - Playwright page object
 * @param {string} name - Screenshot name
 * @param {string} outputDir - Output directory (default: test-reports/screenshots)
 */
async function takeScreenshot(page, name, outputDir = 'test-reports/screenshots') {
  const fs = require('fs');
  const fullPath = path.join(process.cwd(), outputDir);

  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  const filename = `${name}-${Date.now()}.png`;
  await page.screenshot({
    path: path.join(fullPath, filename),
    fullPage: true
  });

  return filename;
}

/**
 * Wait for status message to appear
 * @param {Object} page - Playwright page object
 * @param {string} expectedText - Expected status text
 * @param {number} timeout - Timeout in ms
 */
async function waitForStatus(page, expectedText, timeout = 5000) {
  await page.waitForFunction(
    (text) => {
      const statusElement = document.getElementById('statusText');
      return statusElement && statusElement.textContent.includes(text);
    },
    expectedText,
    { timeout }
  );
}

/**
 * Check if error modal is visible
 * @param {Object} page - Playwright page object
 * @returns {Promise<boolean>} True if error modal is visible
 */
async function isErrorModalVisible(page) {
  try {
    const modal = await page.$('#errorModal');
    if (!modal) return false;

    const display = await modal.evaluate(el => window.getComputedStyle(el).display);
    return display !== 'none';
  } catch (error) {
    return false;
  }
}

/**
 * Get error message from modal
 * @param {Object} page - Playwright page object
 * @returns {Promise<string|null>} Error message or null
 */
async function getErrorMessage(page) {
  try {
    const isVisible = await isErrorModalVisible(page);
    if (!isVisible) return null;

    return await page.textContent('#errorMessage');
  } catch (error) {
    return null;
  }
}

module.exports = {
  launchElectronApp,
  closeElectronApp,
  waitForElement,
  captureConsoleLogs,
  takeScreenshot,
  waitForStatus,
  isErrorModalVisible,
  getErrorMessage,
};
