import { contextBridge, ipcRenderer } from 'electron';
import { LookupAPI } from './main/ipc/lookup-handlers';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  file: {
    openFile: (filters?: Electron.FileFilter[]) =>
      ipcRenderer.invoke('file:open', filters),
    saveFile: (filePath: string, data: Buffer) =>
      ipcRenderer.invoke('file:save', filePath, data),
    validateMaddenFile: (filePath: string) =>
      ipcRenderer.invoke('file:validate-madden-file', filePath),
    createBackup: (filePath: string) =>
      ipcRenderer.invoke('file:create-backup', filePath),
    restoreBackup: (backupPath: string, originalPath: string) =>
      ipcRenderer.invoke('file:restore-backup', backupPath, originalPath)
  },

  // Parser operations
  parser: {
    parseRosterFile: (filePath: string) =>
      ipcRenderer.invoke('parser:parse-roster-file', filePath),
    parsePlayerRecord: (data: Buffer, offset: number) =>
      ipcRenderer.invoke('parser:parse-player-record', data, offset),
    buildRosterFile: (players: any[], metadata: any) =>
      ipcRenderer.invoke('parser:build-roster-file', players, metadata)
  },

  // Lookup system
  lookup: {
    getDisplayName: (fileName: string, id: number) =>
      ipcRenderer.invoke('lookup:get-display-name', fileName, id),
    getNumericId: (fileName: string, displayName: string) =>
      ipcRenderer.invoke('lookup:get-numeric-id', fileName, displayName),
    getDropdownOptions: (fileName: string) =>
      ipcRenderer.invoke('lookup:get-dropdown-options', fileName),
    isReady: () =>
      ipcRenderer.invoke('lookup:is-ready'),
    reload: () =>
      ipcRenderer.invoke('lookup:reload'),
    getStatus: () =>
      ipcRenderer.invoke('lookup:get-status'),
    getPositionFields: (position: string) =>
      ipcRenderer.invoke('lookup:get-position-fields', position)
  },

  // Application info
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    quit: () => ipcRenderer.invoke('app:quit')
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      file: {
        openFile: (filters?: Electron.FileFilter[]) => Promise<string | undefined>;
        saveFile: (filePath: string, data: Buffer) => Promise<boolean>;
        validateMaddenFile: (filePath: string) => Promise<{ valid: boolean; type?: string; error?: string }>;
        createBackup: (filePath: string) => Promise<string>;
        restoreBackup: (backupPath: string, originalPath: string) => Promise<boolean>;
      };
      parser: {
        parseRosterFile: (filePath: string) => Promise<any>;
        parsePlayerRecord: (data: Buffer, offset: number) => Promise<any>;
        buildRosterFile: (players: any[], metadata: any) => Promise<Buffer>;
      };
      lookup: LookupAPI;
      app: {
        getVersion: () => Promise<string>;
        quit: () => Promise<void>;
      };
    };
  }
}
