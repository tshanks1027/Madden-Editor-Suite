import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import started from 'electron-squirrel-startup';

// Import IPC handlers
import './ipc/file-handlers';
import './ipc/parser-handlers';
import './ipc/database-handlers';
import './ipc/settings-handlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

const isDevelopment = process.env.NODE_ENV === 'development';

const createWindow = (): void => {
  // Create the browser window with Madden-inspired styling
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: 'default',
    frame: true,
    backgroundColor: '#0a0a0a', // Madden dark theme
    show: false, // Don't show until ready-to-show
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Enable dev tools in development
      devTools: isDevelopment,
    },
    icon: path.join(__dirname, '../../assets/icons/app.ico'), // App icon
  });

  // Create application menu
  createApplicationMenu();

  // Load the index.html of the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    // Open DevTools in development mode
    if (isDevelopment) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in default browser
    if (url.startsWith('http')) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Security: Prevent new window creation
  mainWindow.webContents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    require('electron').shell.openExternal(navigationUrl);
  });
};

const createApplicationMenu = (): void => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Roster...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              title: 'Open Roster File',
              filters: [
                { name: 'Roster Files', extensions: ['ros'] },
                { name: 'All Files', extensions: ['*'] }
              ],
              properties: ['openFile']
            });

            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('file-opened', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Open Franchise...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              title: 'Open Franchise File',
              filters: [
                { name: 'Franchise Files', extensions: ['fra'] },
                { name: 'All Files', extensions: ['*'] }
              ],
              properties: ['openFile']
            });

            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('file-opened', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Roster Editor',
          click: () => {
            mainWindow?.webContents.send('navigate-to-tool', 'roster');
          }
        },
        {
          label: 'Draft Class Editor',
          click: () => {
            mainWindow?.webContents.send('navigate-to-tool', 'draft');
          }
        },
        {
          label: 'Uniform Editor',
          click: () => {
            mainWindow?.webContents.send('navigate-to-tool', 'uniform');
          }
        },
        { type: 'separator' },
        {
          label: 'All Tools...',
          click: () => {
            mainWindow?.webContents.send('navigate-to-tool', 'home');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            require('electron').shell.openExternal('https://github.com/user/madden-editor-suite/docs');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/user/madden-editor-suite/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'About Madden Editor Suite',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Madden Editor Suite',
              message: 'Madden Editor Suite',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\n\nProfessional Madden NFL file editor with 17+ specialized tools.`,
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// App event handlers
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (navigationEvent, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      navigationEvent.preventDefault();
    }
  });
});

// Handle certificate errors in development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDevelopment) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Global IPC handlers
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('app:get-path', (event, name: string) => {
  return app.getPath(name as any);
});

ipcMain.handle('dialog:show-open', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow!, options);
  return result;
});

ipcMain.handle('dialog:show-save', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, options);
  return result;
});

ipcMain.handle('dialog:show-message', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow!, options);
  return result;
});

// Export main window for IPC handlers
export { mainWindow };
