/**
 * Roster File Loading E2E Test
 *
 * This test:
 * 1. Launches the Electron app
 * 2. Loads a ROSTER-Official file
 * 3. Captures all console logs (both main and renderer)
 * 4. Saves logs to test-reports/console-logs.txt
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROSTER_FILE_PATH = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';

test('Load ROSTER-Official and capture console logs', async () => {
  const consoleLogs = [];

  // Launch Electron app
  const electronApp = await electron.launch({
    args: ['.vite/build/main.js'],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });

  // Get the first window
  const window = await electronApp.firstWindow();

  // Capture console logs from renderer process
  window.on('console', msg => {
    const logEntry = `[RENDERER] ${msg.type()}: ${msg.text()}`;
    console.log(logEntry);
    consoleLogs.push(logEntry);
  });

  // Capture console logs from main process (if available)
  electronApp.on('console', msg => {
    const logEntry = `[MAIN] ${msg.type()}: ${msg.text()}`;
    console.log(logEntry);
    consoleLogs.push(logEntry);
  });

  // Wait for app to be ready
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000); // Give app time to initialize

  // Take screenshot of initial state
  await window.screenshot({ path: 'test-reports/01-app-loaded.png' });

  console.log('[TEST] Attempting to load file via IPC:', ROSTER_FILE_PATH);

  // Directly call the parser via IPC (bypass file dialog)
  const result = await window.evaluate(async (filePath) => {
    try {
      console.log('[TEST-EVAL] Calling parser.parseRosterFile with:', filePath);
      const parseResult = await window.electronAPI.parser.parseRosterFile(filePath);
      console.log('[TEST-EVAL] Parse result:', parseResult);
      return { success: true, result: parseResult };
    } catch (error) {
      console.error('[TEST-EVAL] Parse error:', error.message);
      return { success: false, error: error.message };
    }
  }, ROSTER_FILE_PATH);

  console.log('[TEST] Parse result:', result);

  // Wait for all logs to finish
  await window.waitForTimeout(3000);

  // Check if file loaded (look for error or success indicators)
  const hasError = await window.locator('text=/error/i').count() > 0;
  const hasTable = await window.locator('.handsontable').count() > 0;

  // Take screenshot after file load attempt
  await window.screenshot({ path: 'test-reports/02-after-file-load.png' });

  console.log('[TEST] Has error:', hasError);
  console.log('[TEST] Has table:', hasTable);

  // Wait a bit more for all console logs to finish
  await window.waitForTimeout(2000);

  // Save all console logs to file
  const logsPath = path.join('test-reports', 'console-logs.txt');
  fs.mkdirSync('test-reports', { recursive: true });
  fs.writeFileSync(logsPath, consoleLogs.join('\n'));

  console.log(`[TEST] Saved ${consoleLogs.length} console log entries to ${logsPath}`);

  // Close app
  await electronApp.close();

  // Assert we got some logs
  expect(consoleLogs.length).toBeGreaterThan(0);
});
