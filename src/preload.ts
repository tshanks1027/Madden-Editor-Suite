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
    openDialog: (defaultPath?: string) =>
      ipcRenderer.invoke('file:open-dialog', defaultPath),
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
    getDropdownOptions: (fileName: string) => ipcRenderer.invoke('lookup:get-dropdown-options', fileName),
    getPIDPortraitMapping: () => ipcRenderer.invoke('lookup:get-pid-portrait-mapping'),
    // Coach lookup methods
    getCoachPAMOptions: () => ipcRenderer.invoke('lookup:get-coach-pam-options'),
    getCoachByPID: (pid: number) => ipcRenderer.invoke('lookup:get-coach-by-pid', pid),
    getCoachPIDFromPAM: (pam: string) => ipcRenderer.invoke('lookup:get-coach-pid-from-pam', pam),
    getCoachPAMFromPID: (pid: number) => ipcRenderer.invoke('lookup:get-coach-pam-from-pid', pid),
    getCoachLookup: () => ipcRenderer.invoke('lookup:get-coach-lookup')
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
  },

  // Creator APIs (web scraping and rating generation)
  creator: {
    generateDraftClass: (year: number, testingMode: boolean = false) =>
      ipcRenderer.invoke('creator:generate-draft-class', year, testingMode),
    generateDecadeDraftClass: (startYear: number, endYear: number) =>
      ipcRenderer.invoke('creator:generate-decade-draft-class', startYear, endYear),
    generateRoster: (year: number, teams: string[]) =>
      ipcRenderer.invoke('creator:generate-roster', year, teams),
    testScraper: (year: number) =>
      ipcRenderer.invoke('creator:test-scraper', year)
  },

  // Roster Creator APIs
  rosterCreator: {
    generate: (year: number, templatePath: string) =>
      ipcRenderer.invoke('roster-creator:generate', year, templatePath),
    save: (players: any[], templatePath: string, outputPath: string) =>
      ipcRenderer.invoke('roster-creator:save', players, templatePath, outputPath),
    validateYear: (year: number) =>
      ipcRenderer.invoke('roster-creator:validate-year', year),
    getStats: (players: any[]) =>
      ipcRenderer.invoke('roster-creator:get-stats', players),
    // Listen for progress updates
    onProgress: (callback: (data: { progress: number; message: string; currentTeam?: string }) => void) =>
      ipcRenderer.on('roster-creator:progress', (_event, data) => callback(data)),
    // Remove progress listener
    removeProgressListener: () =>
      ipcRenderer.removeAllListeners('roster-creator:progress')
  },

  // Debug APIs
  debug: {
    getLog: () => ipcRenderer.invoke('debug:get-log'),
    getLogPath: () => ipcRenderer.invoke('debug:get-log-path'),
    clearLog: () => ipcRenderer.invoke('debug:clear-log'),
    sessionLog: (message: string) => ipcRenderer.invoke('debug:session-log', message),
    getSessionLogPath: () => ipcRenderer.invoke('debug:get-session-log-path'),
    clearSessionLog: () => ipcRenderer.invoke('debug:clear-session-log')
  },

  // Rating APIs
  rating: {
    calculateOverall: (ratings: any, position: string) =>
      ipcRenderer.invoke('rating:calculate-overall', ratings, position)
  },

  // Update APIs
  update: {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    // Listen for update notifications
    onUpdateAvailable: (callback: (updateInfo: any) => void) =>
      ipcRenderer.on('update-available', (_event, updateInfo) => callback(updateInfo)),
    // Remove update listener
    removeUpdateListener: () =>
      ipcRenderer.removeAllListeners('update-available')
  },

  // Portrait APIs
  portrait: {
    getByPLPO: (plpoKey: string) => ipcRenderer.invoke('portrait:get-image-data-by-plpo', plpoKey),
    getByPID: (pid: number) => ipcRenderer.invoke('portrait:get-image-data-by-pid', pid)
  },

  // Coach Portrait APIs
  coachPortrait: {
    initialize: () => ipcRenderer.invoke('coach-portrait:initialize'),
    getByPID: (pid: number) => ipcRenderer.invoke('coach-portrait:get-by-pid', pid),
    getImageDataByPID: (pid: number) => ipcRenderer.invoke('coach-portrait:get-image-data-by-pid', pid),
    hasPortrait: (pid: number) => ipcRenderer.invoke('coach-portrait:has-portrait', pid)
  }
});