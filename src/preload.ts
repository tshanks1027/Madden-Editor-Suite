import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload Script
 *
 * Exposes safe IPC APIs to the renderer process.
 * Maintains security by using contextBridge with contextIsolation.
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // Parser APIs
  parser: {
    parseRosterFile: (filePath: string) =>
      ipcRenderer.invoke('parser:parse-roster-file', filePath),
    saveRosterFile: (filePath: string, players: any[], originalData: any) =>
      ipcRenderer.invoke('parser:save-roster-file', filePath, players, originalData)
  },

  // File APIs
  file: {
    openDialog: (filters?: any[]) =>
      ipcRenderer.invoke('file:open-dialog', filters),
    saveDialog: (defaultPath?: string) =>
      ipcRenderer.invoke('file:save-dialog', defaultPath),
    createBackup: (filePath: string) =>
      ipcRenderer.invoke('file:create-backup', filePath),
    read: (filePath: string) =>
      ipcRenderer.invoke('file:read', filePath),
    write: (filePath: string, data: any) =>
      ipcRenderer.invoke('file:write', filePath, data),
    exists: (filePath: string) =>
      ipcRenderer.invoke('file:exists', filePath)
  },

  // Lookup APIs (if needed later)
  lookup: {
    isReady: () => ipcRenderer.invoke('lookup:is-ready'),
    reload: () => ipcRenderer.invoke('lookup:reload')
  }
});