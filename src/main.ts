import { app, BrowserWindow } from 'electron';
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