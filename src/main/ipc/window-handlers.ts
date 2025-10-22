/**
 * Window Management IPC Handlers
 * Handles opening new windows for franchise editor, etc.
 */

import { ipcMain, BrowserWindow, app } from 'electron';
import * as path from 'path';

// Store franchise windows to avoid duplicates
let franchiseWindow: BrowserWindow | null = null;
let retroFranchiseWindow: BrowserWindow | null = null;

// Store data to pass between windows
let sharedEditorData: { players?: any[]; draftClass?: any[]; type?: string } | null = null;

ipcMain.handle('window:open-franchise', async (_event, isRetro: boolean) => {
  console.log(`[Window] Opening ${isRetro ? 'Retro ' : ''}Franchise Editor`);

  // Check if window already exists
  const existingWindow = isRetro ? retroFranchiseWindow : franchiseWindow;
  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.focus();
    return;
  }

  // Create new window
  const franchiseWin = new BrowserWindow({
    width: 1400,
    height: 900,
    title: `${isRetro ? 'Retro ' : ''}Franchise Editor - Madden Editor Suite`,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Store window reference
  if (isRetro) {
    retroFranchiseWindow = franchiseWin;
  } else {
    franchiseWindow = franchiseWin;
  }

  // Clean up reference when window is closed
  franchiseWin.on('closed', () => {
    if (isRetro) {
      retroFranchiseWindow = null;
    } else {
      franchiseWindow = null;
    }
  });

  // Load the franchise editor HTML with query parameter
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // In development mode
    const url = `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/franchise-editor.html?retro=${isRetro}`;
    await franchiseWin.loadURL(url);
    // franchiseWin.webContents.openDevTools(); // Disabled - open manually with F12 if needed
  } else {
    // In production mode
    const filePath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/franchise-editor.html`);
    await franchiseWin.loadFile(filePath, {
      query: { retro: isRetro.toString() }
    });
  }

  console.log(`[Window] ${isRetro ? 'Retro ' : ''}Franchise Editor opened`);
});

// Handler to open main editor with franchise data
ipcMain.handle('window:open-main-editor', async (_event, data: { players?: any[]; draftClass?: any[]; type: string }) => {
  console.log(`[Window] Opening Main Editor with ${data.type} data`);

  // Store the data to be retrieved by the main editor window
  sharedEditorData = data;

  // Create new main editor window
  const editorWin = new BrowserWindow({
    width: 1600,
    height: 1000,
    title: `${data.type} Editor - Madden Editor Suite`,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the main editor HTML with query parameter indicating franchise mode
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // In development mode
    const url = `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/index.html?franchiseMode=true&type=${data.type}`;
    await editorWin.loadURL(url);
    // editorWin.webContents.openDevTools(); // Disabled - open manually with F12 if needed
  } else {
    // In production mode
    const filePath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    await editorWin.loadFile(filePath, {
      query: { franchiseMode: 'true', type: data.type }
    });
  }

  console.log(`[Window] Main Editor opened with ${data.type} data`);
});

// Handler to get shared editor data
ipcMain.handle('window:get-shared-data', async () => {
  console.log('[Window] Getting shared editor data');
  const data = sharedEditorData;
  sharedEditorData = null; // Clear after retrieval
  return data;
});
