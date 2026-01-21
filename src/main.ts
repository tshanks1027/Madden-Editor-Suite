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
import './main/ipc/coach-database-handlers';
import './main/ipc/editor-tracking-handlers';
import './main/ipc/player-data-fill-handlers';
import { setMainWindowForFill } from './main/ipc/player-data-fill-handlers';
import { registerCreatorHandlers } from './main/ipc/creator-handlers';
import { registerDebugHandlers } from './main/ipc/debug-handlers';
import { registerRatingHandlers } from './main/ipc/rating-handlers';
import { registerUpdateHandlers } from './main/ipc/update-handlers';
import { registerPGHEHandlers } from './main/ipc/pghe-handlers';
import { registerFrostyHandlers } from './main/ipc/frosty-handlers';
import { registerPortraitMappingHandlers } from './main/ipc/portrait-mapping-handlers';
import { registerCustomPortraitHandlers } from './main/ipc/custom-portrait-handlers';
import { registerCustomCoachPortraitHandlers } from './main/ipc/custom-coach-portrait-handlers';
import { registerLogoHandlers } from './main/ipc/logo-handlers';
import { updateChecker } from './main/services/UpdateChecker';
import { portraitSpriteService } from './main/services/PortraitSpriteService';
import { coachPortraitService } from './main/services/CoachPortraitService';
import { sessionDebugLogger } from './main/utils/DebugLogger';

// Register creator handlers
registerCreatorHandlers();
registerDebugHandlers();
registerRatingHandlers();
registerUpdateHandlers();
registerPGHEHandlers();
registerFrostyHandlers();
registerPortraitMappingHandlers();
registerCustomPortraitHandlers();
registerCustomCoachPortraitHandlers();
registerLogoHandlers();

// Register window focus handler - simple focus without visual disruption
// Used to ensure keyboard input works after various operations
ipcMain.handle('window:focus', async () => {
  const windows = BrowserWindow.getAllWindows();
  const focusedWindow = windows.find(w => !w.isDestroyed());
  if (focusedWindow) {
    // Simple focus - no blur/refocus which causes visual flash
    focusedWindow.focus();
    focusedWindow.webContents.focus();
    return { success: true };
  }
  return { success: false, error: 'No window available' };
});

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let databaseWindow: BrowserWindow | null = null;

// Handler to open database browser in separate window
ipcMain.handle('window:open-database', async (_event, mode?: 'roster' | 'draft') => {

  // If window already exists and is not destroyed, focus it and send mode
  if (databaseWindow && !databaseWindow.isDestroyed()) {
    databaseWindow.focus();
    // Send the mode to the existing window
    if (mode) {
      databaseWindow.webContents.send('database:set-mode', mode);
    }
    return { success: true, alreadyOpen: true };
  }

  // Create new database browser window
  databaseWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    title: 'Player Database Browser',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the database browser page with mode as query param
  const modeParam = mode ? `?mode=${mode}` : '';
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // In dev mode, load from vite server
    // The dev server URL is like http://localhost:3000/ - append the page name
    const baseUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL.endsWith('/')
      ? MAIN_WINDOW_VITE_DEV_SERVER_URL
      : MAIN_WINDOW_VITE_DEV_SERVER_URL + '/';
    databaseWindow.loadURL(baseUrl + 'database-browser.html' + modeParam);
  } else {
    // In production, load from file
    databaseWindow.loadFile(
      path.join(__dirname, '../renderer/database-browser.html'),
      { query: mode ? { mode } : {} }
    );
  }

  databaseWindow.on('closed', () => {
    databaseWindow = null;
  });

  return { success: true };
});

const createWindow = (): void => {
  const fs = require('fs');
  console.log('[main] === CREATING MAIN WINDOW ===');
  console.log('[main] DIAGNOSTIC: __dirname =', __dirname);
  console.log('[main] DIAGNOSTIC: app.getAppPath() =', app.getAppPath());
  console.log('[main] DIAGNOSTIC: app.isPackaged =', app.isPackaged);
  console.log('[main] DIAGNOSTIC: process.cwd() =', process.cwd());
  console.log('[main] DIAGNOSTIC: MAIN_WINDOW_VITE_DEV_SERVER_URL =', MAIN_WINDOW_VITE_DEV_SERVER_URL);

  // List files in renderer directory
  const rendererDir = path.join(__dirname, '../renderer');
  console.log('[main] DIAGNOSTIC: Checking renderer dir:', rendererDir);
  try {
    if (fs.existsSync(rendererDir)) {
      const files = fs.readdirSync(rendererDir);
      console.log('[main] DIAGNOSTIC: Renderer dir contents:', files.filter((f: string) => f.endsWith('.html')));
    } else {
      console.log('[main] DIAGNOSTIC: Renderer dir does NOT exist');
    }
  } catch (e) {
    console.log('[main] DIAGNOSTIC: Error reading renderer dir:', e);
  }

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
    console.log('[main] Loading main window from DEV URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const mainHtmlPath = path.join(__dirname, '../renderer/index.html');
    console.log('[main] DIAGNOSTIC: mainHtmlPath =', mainHtmlPath);
    console.log('[main] DIAGNOSTIC: index.html exists =', fs.existsSync(mainHtmlPath));
    console.log('[main] Loading main window from FILE:', mainHtmlPath);
    mainWindow.loadFile(mainHtmlPath);
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

  // Set main window reference for player data fill progress events
  if (mainWindow) {
    setMainWindowForFill(mainWindow);
  }

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