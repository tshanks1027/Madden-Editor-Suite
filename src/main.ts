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
import { registerCreatorHandlers } from './main/ipc/creator-handlers';

// Register creator handlers
registerCreatorHandlers();

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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});