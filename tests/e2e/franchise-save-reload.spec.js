/**
 * Franchise Save/Reload Test
 *
 * Tests the critical save handler functionality:
 * 1. Load a franchise file
 * 2. Edit a player's data
 * 3. Save the file
 * 4. Reload the file
 * 5. Verify changes persisted
 *
 * Source: Phase A implementation (RESEARCH-SYNTHESIS-COMPLETE.md)
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Franchise Save/Reload Cycle', () => {
  let electronApp;
  let window;
  const testFranchiseFile = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden Files', 'Madden 26', 'Tools', 'CAREER-DOUGFLUTIE');
  const backupFile = testFranchiseFile + '.backup';
  const consoleLogs = [];

  test.beforeAll(async () => {
    // Create backup of test file
    if (fs.existsSync(testFranchiseFile)) {
      fs.copyFileSync(testFranchiseFile, backupFile);
      console.log('[Test] Created backup:', backupFile);
    }

    // Launch Electron app
    electronApp = await electron.launch({
      args: ['.vite/build/main.js'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    window = await electronApp.firstWindow();

    // Set viewport for consistent testing
    await window.setViewportSize({ width: 1920, height: 1080 });

    // Capture console logs
    window.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      console.log(`[RENDERER] ${text}`);
    });

    // Wait for app to be ready
    await window.waitForLoadState('domcontentloaded');
    await window.screenshot({ path: 'test-reports/franchise-save-01-app-loaded.png' });
  });

  test.afterAll(async () => {
    // Restore original file
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, testFranchiseFile);
      fs.unlinkSync(backupFile);
      console.log('[Test] Restored original file from backup');
    }

    // Save console logs
    const logPath = 'test-reports/franchise-save-console.log';
    fs.writeFileSync(logPath, consoleLogs.join('\n'), 'utf-8');
    console.log('[Test] Console logs saved to:', logPath);

    // Close app
    await electronApp.close();
  });

  test('should save and reload franchise file with edits persisting', async () => {
    console.log('[Test] Starting save/reload test...');

    // Step 1: Navigate to Franchise Editor
    await window.evaluate(() => {
      const franchiseBtn = document.querySelector('[data-section="franchise"]');
      if (franchiseBtn) franchiseBtn.click();
    });

    await window.waitForTimeout(1000);
    await window.screenshot({ path: 'test-reports/franchise-save-02-franchise-tab.png' });

    // Step 2: Load franchise file
    console.log('[Test] Loading franchise file:', testFranchiseFile);

    const loadResult = await window.evaluate(async (filePath) => {
      try {
        // Manually trigger load (simulating file selection)
        const editor = window.franchiseEditor;
        if (!editor) {
          throw new Error('Franchise editor not initialized');
        }

        // Load the file using the internal method
        const metadata = await window.electronAPI.franchise.loadFile(filePath);
        if (!metadata.success) {
          throw new Error('Failed to load metadata: ' + metadata.error);
        }

        const playerResult = await window.electronAPI.franchise.getTableData(filePath, 'Player');
        if (!playerResult.success) {
          throw new Error('Failed to load players: ' + playerResult.error);
        }

        editor.currentFile = filePath;
        editor.franchiseData.players = playerResult.records;
        editor.filteredPlayers = [...playerResult.records];

        console.log('[Test] Loaded', playerResult.count, 'players');

        // Get first player's name before edit
        const firstPlayer = playerResult.records[0];
        return {
          success: true,
          playerCount: playerResult.count,
          firstPlayerBefore: {
            firstName: firstPlayer.PFNA,
            lastName: firstPlayer.PLNA,
            overall: firstPlayer.POVR
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, testFranchiseFile);

    expect(loadResult.success).toBe(true);
    console.log('[Test] Loaded', loadResult.playerCount, 'players');
    console.log('[Test] First player before edit:', JSON.stringify(loadResult.firstPlayerBefore));

    await window.waitForTimeout(1000);
    await window.screenshot({ path: 'test-reports/franchise-save-03-file-loaded.png' });

    // Step 3: Switch to Players tab and edit a player
    await window.evaluate(() => {
      const playersTab = document.querySelector('[data-tab="players"]');
      if (playersTab) playersTab.click();
    });

    await window.waitForTimeout(2000);
    await window.screenshot({ path: 'test-reports/franchise-save-04-players-tab.png' });

    const originalName = loadResult.firstPlayerBefore.firstName;
    const testName = 'TESTNAME' + Date.now();

    console.log('[Test] Editing first player name:', originalName, '→', testName);

    const editResult = await window.evaluate(async (newName) => {
      try {
        const editor = window.franchiseEditor;
        if (!editor.franchiseData.players || editor.franchiseData.players.length === 0) {
          throw new Error('No players loaded');
        }

        // Edit the first player's first name
        const firstPlayer = editor.franchiseData.players[0];
        const oldName = firstPlayer.PFNA;
        firstPlayer.PFNA = newName;

        console.log('[Test] Changed player name:', oldName, '→', newName);

        return {
          success: true,
          oldName: oldName,
          newName: newName
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, testName);

    expect(editResult.success).toBe(true);
    console.log('[Test] Edit applied:', editResult.oldName, '→', editResult.newName);

    await window.waitForTimeout(1000);

    // Step 4: Save the file
    console.log('[Test] Saving franchise file...');

    const saveResult = await window.evaluate(async () => {
      try {
        const editor = window.franchiseEditor;
        const updates = editor.franchiseData.players;

        console.log('[Test] Calling save with', updates.length, 'players');

        const result = await window.electronAPI.franchise.saveFile(
          editor.currentFile,
          updates,
          editor.currentFile
        );

        return result;
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(saveResult.success).toBe(true);
    console.log('[Test] Save result:', saveResult);

    await window.waitForTimeout(2000);
    await window.screenshot({ path: 'test-reports/franchise-save-05-saved.png' });

    // Step 5: Reload the file
    console.log('[Test] Reloading franchise file to verify persistence...');

    const reloadResult = await window.evaluate(async (filePath) => {
      try {
        const editor = window.franchiseEditor;

        // Reload player data
        const playerResult = await window.electronAPI.franchise.getTableData(filePath, 'Player');
        if (!playerResult.success) {
          throw new Error('Failed to reload players: ' + playerResult.error);
        }

        editor.franchiseData.players = playerResult.records;
        editor.filteredPlayers = [...playerResult.records];

        // Get first player's name after reload
        const firstPlayer = playerResult.records[0];
        return {
          success: true,
          firstPlayerAfter: {
            firstName: firstPlayer.PFNA,
            lastName: firstPlayer.PLNA,
            overall: firstPlayer.POVR
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, testFranchiseFile);

    expect(reloadResult.success).toBe(true);
    console.log('[Test] First player after reload:', JSON.stringify(reloadResult.firstPlayerAfter));

    await window.waitForTimeout(1000);
    await window.screenshot({ path: 'test-reports/franchise-save-06-reloaded.png' });

    // Step 6: Verify the edit persisted
    expect(reloadResult.firstPlayerAfter.firstName).toBe(testName);
    console.log('[Test] ✅ SUCCESS: Edit persisted through save/reload cycle!');
    console.log('[Test] Expected:', testName);
    console.log('[Test] Got:', reloadResult.firstPlayerAfter.firstName);
  });
});
