import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

// No custom module path configuration needed
// Electron Forge puts node_modules at resources/node_modules where Node expects them
console.log('[main] __dirname:', __dirname);
console.log('[main] app.isPackaged:', app.isPackaged);

// Catch all uncaught errors to prevent silent crashes
process.on('uncaughtException', (error) => {
  console.error('===== UNCAUGHT EXCEPTION =====');
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  console.error('==============================');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('===== UNHANDLED REJECTION =====');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('===============================');
});

// Import IPC handlers
import './main/ipc/parser-handlers';
import './main/ipc/file-handlers';
import './main/ipc/lookup-handlers';
import './main/ipc/draft-class-handlers';
import './main/ipc/roster-creator-handlers';
import './main/ipc/roster-generator-handlers';
import './main/ipc/portrait-handlers';
import './main/ipc/shell-handlers';
import './main/ipc/presentation-id-fix-handlers';
import './main/ipc/retro-editor-handlers';
import './main/ipc/database-handlers';
import './main/ipc/editor-tracking-handlers';
import { registerCreatorHandlers } from './main/ipc/creator-handlers';
import { registerDebugHandlers } from './main/ipc/debug-handlers';
import { registerRatingHandlers } from './main/ipc/rating-handlers';
import { registerUpdateHandlers } from './main/ipc/update-handlers';
import { updateChecker } from './main/services/UpdateChecker';
import { portraitSpriteService } from './main/services/PortraitSpriteService';
import { coachPortraitService } from './main/services/CoachPortraitService';
import { sessionDebugLogger } from './main/utils/DebugLogger';

// Register creator handlers
registerCreatorHandlers();
registerDebugHandlers();
registerRatingHandlers();
registerUpdateHandlers();

// Register window focus handler - used to restore OS-level focus after native dialogs
// Windows has focus theft prevention that can leave webContents without keyboard input
// even when the window appears focused. Blur-then-focus simulates DevTools open/close
// which reliably restores keyboard input.
let windowFocusPending = false;
let windowFocusTimeout: ReturnType<typeof setTimeout> | null = null;

ipcMain.handle('window:focus', async () => {
  // Debounce: if a focus operation is pending, skip this call
  if (windowFocusPending) {
    console.log('[main] window:focus IPC - skipping (debounced)');
    return { success: true, debounced: true };
  }

  // Clear any pending timeout
  if (windowFocusTimeout) {
    clearTimeout(windowFocusTimeout);
    windowFocusTimeout = null;
  }

  windowFocusPending = true;
  console.log('[main] window:focus IPC called');

  try {
    const windows = BrowserWindow.getAllWindows();
    const focusedWindow = windows.find(w => !w.isDestroyed());
    if (focusedWindow) {
      // CRITICAL: On Windows, after native dialogs (alert/confirm), the webContents
      // can lose keyboard input even though it appears focused. Opening DevTools
      // fixes this, so we simulate that by blurring then refocusing.

      // 1. Focus the app itself first (steal: true forces focus)
      app.focus({ steal: true });

      // 2. BLUR the window first - this is the key to resetting Windows focus state
      focusedWindow.blur();

      // 3. Small delay to let Windows process the blur
      await new Promise(resolve => setTimeout(resolve, 50));

      // 4. Now focus everything fresh
      focusedWindow.show();
      focusedWindow.focus();
      focusedWindow.moveTop();

      // 5. Focus webContents for keyboard input
      focusedWindow.webContents.focus();

      // 6. Another small delay
      await new Promise(resolve => setTimeout(resolve, 50));

      // 7. Final webContents focus to ensure keyboard works
      focusedWindow.webContents.focus();

      console.log('[main] Window focused successfully (blur-refocus method)');
      return { success: true };
    }
    console.log('[main] No window to focus');
    return { success: false, error: 'No window available' };
  } finally {
    // Reset debounce after a delay to allow subsequent calls
    windowFocusTimeout = setTimeout(() => {
      windowFocusPending = false;
    }, 300);
  }
});

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the index.html
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../renderer/index.html')
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(async () => {
  // Clear session debug log on startup
  sessionDebugLogger.clear();
  console.log('[main] Session debug log cleared and ready');

  createWindow();

  // Initialize portrait sprite service
  try {
    await portraitSpriteService.initialize();
    console.log('[main] Portrait sprite service initialized');
  } catch (error) {
    console.error('[main] Failed to initialize portrait sprite service:', error);
  }

  // Initialize coach portrait service
  try {
    await coachPortraitService.initialize();
    console.log('[main] Coach portrait service initialized');
  } catch (error) {
    console.error('[main] Failed to initialize coach portrait service:', error);
  }

  // Start checking for updates (checks immediately, then every 4 hours)
  updateChecker.startPeriodicChecks((updateInfo) => {
    console.log('[main] Update available:', updateInfo);
    // Send update notification to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', updateInfo);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Stop update checker
  updateChecker.stopPeriodicChecks();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});