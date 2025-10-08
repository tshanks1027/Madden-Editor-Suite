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

  // Lookup APIs
  lookup: {
    isReady: () => ipcRenderer.invoke('lookup:is-ready'),
    reload: () => ipcRenderer.invoke('lookup:reload'),
    getDropdownOptions: (fileName: string) => ipcRenderer.invoke('lookup:get-dropdown-options', fileName)
  },

  // Draft Class APIs
  draftClass: {
    load: (filePath: string) =>
      ipcRenderer.invoke('draft-class:load', filePath),
    save: (savePath: string, draftClassData: any) =>
      ipcRenderer.invoke('draft-class:save', savePath, draftClassData),
    exportJSON: (filePath: string, outputPath: string) =>
      ipcRenderer.invoke('draft-class:export-json', filePath, outputPath),
    validate: (filePath: string) =>
      ipcRenderer.invoke('draft-class:validate', filePath),
    getInfo: (filePath: string) =>
      ipcRenderer.invoke('draft-class:get-info', filePath),
    getAttributeDefs: () =>
      ipcRenderer.invoke('draft-class:get-attribute-defs'),
    convertM25toM26: (inputPath: string, outputPath: string, templatePath: string) =>
      ipcRenderer.invoke('draft-class:convert-m25-to-m26', inputPath, outputPath, templatePath)
  }
});