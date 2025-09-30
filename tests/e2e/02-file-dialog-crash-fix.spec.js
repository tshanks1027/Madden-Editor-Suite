/**
 * File Dialog Crash Fix Test
 *
 * Verifies that clicking "Open File" button doesn't crash the app.
 * Tests the BrowserWindow.fromWebContents fix in file-handlers.ts
 */

const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

let electronApp;
let window;

test.beforeEach(async () => {
  console.log('\n[TEST] Launching Electron app...');

  // Launch Electron app
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../../.vite/build/main.js')],
    timeout: 60000
  });

  // Get the first window
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  console.log('[TEST] Window loaded');

  // Wait for app to be ready
  await window.waitForSelector('#openFileBtn', { timeout: 30000 });
  console.log('[TEST] App ready - Open File button visible');
});

test.afterEach(async () => {
  if (electronApp) {
    await electronApp.close();
    console.log('[TEST] App closed\n');
  }
});

test('File Dialog - Click Open File without crash', async () => {
  console.log('[TEST] ===== FILE DIALOG CRASH TEST =====');

  // Capture console messages
  const logs = [];
  window.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log(`[APP] ${text}`);
  });

  // Take screenshot before click
  await window.screenshot({ path: 'test-results/dialog-01-before-click.png' });
  console.log('[TEST] Screenshot: Before clicking Open File');

  // Verify app is responsive before click
  const statusBefore = await window.textContent('#statusText');
  console.log('[TEST] Status before click:', statusBefore);

  // Click Open File button
  console.log('[TEST] Clicking #openFileBtn...');
  await window.click('#openFileBtn');

  // Wait for dialog (it will open natively)
  await window.waitForTimeout(2000);
  console.log('[TEST] Waited 2s for dialog');

  // Take screenshot after click
  await window.screenshot({ path: 'test-results/dialog-02-after-click.png' });
  console.log('[TEST] Screenshot: After clicking Open File');

  // CRITICAL: Verify app still exists (didn't crash)
  const appStillExists = await window.$('#app');
  expect(appStillExists).not.toBeNull();
  console.log('[TEST] ✅ App still exists - no crash detected');

  // Verify window is still responsive
  const windowTitle = await window.title();
  console.log('[TEST] Window title:', windowTitle);

  // Check for error modal
  const errorModal = await window.$('#errorModal');
  if (errorModal) {
    const isVisible = await errorModal.isVisible();
    expect(isVisible).toBe(false);
    console.log('[TEST] ✅ No error modal shown');
  }

  // Press Escape to close dialog
  console.log('[TEST] Pressing Escape to close dialog...');
  await window.keyboard.press('Escape');
  await window.waitForTimeout(500);

  // Verify app is still responsive after closing dialog
  const statusAfter = await window.textContent('#statusText');
  console.log('[TEST] Status after dialog closed:', statusAfter);

  // Take final screenshot
  await window.screenshot({ path: 'test-results/dialog-03-final.png' });
  console.log('[TEST] Screenshot: Final state');

  // Print all debug logs
  console.log('[TEST] Captured console logs:');
  logs.forEach((log, i) => {
    console.log(`  ${i + 1}. ${log}`);
  });

  console.log('[TEST] ✅ TEST PASSED - File dialog opens without crash');
});

test('File Dialog - Verify debug logging', async () => {
  console.log('[TEST] ===== DEBUG LOGGING TEST =====');

  const logs = [];
  window.on('console', msg => {
    logs.push(msg.text());
  });

  // Click Open File
  await window.click('#openFileBtn');
  await window.waitForTimeout(1000);

  // Close dialog
  await window.keyboard.press('Escape');
  await window.waitForTimeout(500);

  // Check for our debug logs
  const hasAppLog = logs.some(log => log.includes('[app.js]'));
  const hasFileHandlerLog = logs.some(log => log.includes('[file-handlers]'));

  console.log('[TEST] Found [app.js] logs:', hasAppLog);
  console.log('[TEST] Found [file-handlers] logs:', hasFileHandlerLog);

  expect(hasAppLog).toBe(true);
  console.log('[TEST] ✅ Debug logging working');
});
