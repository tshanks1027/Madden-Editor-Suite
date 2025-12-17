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
    getCoachLookup: () => ipcRenderer.invoke('lookup:get-coach-lookup'),
    // Race lookup for BLBM GENR/SKNT assignment
    getRaceByPID: (pid: number) => ipcRenderer.invoke('lookup:get-race-by-pid', pid),
    // GENR catalog for validating face picker selections
    getValidGenrSet: () => ipcRenderer.invoke('lookup:get-valid-genr-set'),
    // Verified portrait->GENR mapping (268 faces that work correctly in-game)
    getVerifiedPortraitGenrMapping: () => ipcRenderer.invoke('lookup:get-verified-portrait-genr-mapping'),
    // Face picker # -> GENR/SKNT mapping (264 definitive faces from ROSTER-GENHEADTEST)
    getFacePickerMapping: () => ipcRenderer.invoke('lookup:get-face-picker-mapping')
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
      ipcRenderer.invoke('draft-class:convert-m25-to-m26', inputPath, outputPath, templatePath),
    loadTemplate: () =>
      ipcRenderer.invoke('draft-class:load-template')
  },

  // Creator APIs (web scraping and rating generation)
  creator: {
    generateDraftClass: (year: number, testingMode: boolean = false, ratingMode: string = 'semi-historical') =>
      ipcRenderer.invoke('creator:generate-draft-class', year, testingMode, ratingMode),
    generateDraftClassV2: (options: {
      year?: number;
      decade?: number;
      ratingMode: 'random' | 'variance' | 'madden';
      includeUFAs?: boolean;
      testingMode?: boolean;
      league?: string;
    }) =>
      ipcRenderer.invoke('creator:generate-draft-class-v2', options),
    generateDecadeDraftClass: (startYear: number, endYear: number) =>
      ipcRenderer.invoke('creator:generate-decade-draft-class', startYear, endYear),
    generateRoster: (year: number, teams: string[], ratingMode: string = 'semi-historical') =>
      ipcRenderer.invoke('creator:generate-roster', year, teams, ratingMode),
    testScraper: (year: number) =>
      ipcRenderer.invoke('creator:test-scraper', year)
  },

  // Roster Creator APIs
  rosterCreator: {
    generate: (year: number, templatePath: string, ratingMode: string = 'semi-historical') =>
      ipcRenderer.invoke('roster-creator:generate', year, templatePath, ratingMode),
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

  // Roster Generator APIs
  rosterGenerator: {
    generate: (options: {
      mode: 'single-year' | 'all-time' | 'all-decade';
      year?: number;
      startYear?: number;
      endYear?: number;
    }) =>
      ipcRenderer.invoke('roster-generator:generate', options),
    validateYear: (year: number) =>
      ipcRenderer.invoke('roster-generator:validate-year', year),
    getAvailableYears: () =>
      ipcRenderer.invoke('roster-generator:get-available-years'),
    getStats: (players: any[]) =>
      ipcRenderer.invoke('roster-generator:get-stats', players),
    save: (players: any[], templatePath: string, outputPath: string) =>
      ipcRenderer.invoke('roster-generator:save', players, templatePath, outputPath)
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
      ipcRenderer.invoke('rating:calculate-overall', ratings, position),
    calculateSecondary: (position: string, attributes: any, archetype?: string) =>
      ipcRenderer.invoke('rating:calculate-secondary', position, attributes, archetype),
    calculateOVRMadden: (position: string, attributes: any, archetype?: string) =>
      ipcRenderer.invoke('rating:calculate-ovr-madden', position, attributes, archetype),
    getArchetypes: (position: string) =>
      ipcRenderer.invoke('rating:get-archetypes', position),
    getArchetypeName: (id: number, position: string) =>
      ipcRenderer.invoke('rating:get-archetype-name', id, position),
    getArchetypeId: (name: string, position: string) =>
      ipcRenderer.invoke('rating:get-archetype-id', name, position),
    birthdayToDisplay: (encoded: number) =>
      ipcRenderer.invoke('rating:birthday-to-display', encoded),
    birthdayToEncoded: (display: string) =>
      ipcRenderer.invoke('rating:birthday-to-encoded', display),
    calculateAge: (encoded: number, asOfYear?: number) =>
      ipcRenderer.invoke('rating:calculate-age', encoded, asOfYear),
    calculateOVRAdjustments: (currentAttributes: any, targetOVR: number, position: string, archetype?: string) =>
      ipcRenderer.invoke('rating:calculate-ovr-adjustments', currentAttributes, targetOVR, position, archetype),
    getArchetypeWeights: (archetypeName: string) =>
      ipcRenderer.invoke('rating:get-archetype-weights', archetypeName)
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
    getByPID: (pid: number) => ipcRenderer.invoke('portrait:get-image-data-by-pid', pid),
    getImageDataByPam: (pamCode: string) => ipcRenderer.invoke('portrait:get-image-data-by-pam', pamCode)
  },

  // Coach Portrait APIs
  coachPortrait: {
    initialize: () => ipcRenderer.invoke('coach-portrait:initialize'),
    getByPID: (pid: number) => ipcRenderer.invoke('coach-portrait:get-by-pid', pid),
    getImageDataByPID: (pid: number) => ipcRenderer.invoke('coach-portrait:get-image-data-by-pid', pid),
    hasPortrait: (pid: number) => ipcRenderer.invoke('coach-portrait:has-portrait', pid)
  },

  // PGHE Generic Face APIs
  pghe: {
    initialize: () => ipcRenderer.invoke('pghe:initialize'),
    getRandomByRace: (race: number) => ipcRenderer.invoke('pghe:getRandomByRace', race),
    getAllBySkinTone: (skinTone: number) => ipcRenderer.invoke('pghe:getAllBySkinTone', skinTone),
    getByPGHE: (pghe: number) => ipcRenderer.invoke('pghe:getByPGHE', pghe),
    getByPID: (pid: number) => ipcRenderer.invoke('pghe:getByPID', pid),
    isGenericPID: (pid: number) => ipcRenderer.invoke('pghe:isGenericPID', pid),
    getAll: () => ipcRenderer.invoke('pghe:getAll'),
    raceToSkinTone: (race: number) => ipcRenderer.invoke('pghe:raceToSkinTone', race)
  },

  // Shell APIs
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  },

  // Presentation ID Fix APIs
  presentationIdFix: {
    getEnabled: () => ipcRenderer.invoke('presentation-id-fix:get-enabled'),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('presentation-id-fix:set-enabled', enabled),
    getExePath: () => ipcRenderer.invoke('presentation-id-fix:get-exe-path'),
    setExePath: (exePath: string) => ipcRenderer.invoke('presentation-id-fix:set-exe-path', exePath),
    exeExists: () => ipcRenderer.invoke('presentation-id-fix:exe-exists'),
    test: (testFilePath?: string) => ipcRenderer.invoke('presentation-id-fix:test', testFilePath)
  },

  // Retro Editor APIs (Franchise file retro modifications)
  retro: {
    selectFile: () => ipcRenderer.invoke('retro:select-file'),
    loadFile: (filePath: string) => ipcRenderer.invoke('retro:load-file', filePath),
    getAvailableYears: () => ipcRenderer.invoke('retro:get-available-years'),
    previewChanges: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:preview-changes', filePath, year),
    setSeasonYear: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:set-season-year', filePath, year),
    updateTeamNames: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:update-team-names', filePath, year),
    reorderDraftPicks: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:reorder-draft-picks', filePath, year),
    getTeamList: (filePath: string) => ipcRenderer.invoke('retro:get-team-list', filePath),
    saveFile: (filePath: string) => ipcRenderer.invoke('retro:save-file', filePath),
    saveFileAs: (originalPath: string) => ipcRenderer.invoke('retro:save-file-as', originalPath),
    closeFile: (filePath: string) => ipcRenderer.invoke('retro:close-file', filePath),
    applyAllChanges: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-all-changes', filePath, year),
    dumpTables: (filePath: string) =>
      ipcRenderer.invoke('retro:dump-tables', filePath),
    debugTeamTable: (filePath: string) =>
      ipcRenderer.invoke('retro:debug-team-table', filePath),

    // Schedule APIs
    getSeasonInfo: (year: number) =>
      ipcRenderer.invoke('retro:get-season-info', year),
    hasScheduleData: (year: number) =>
      ipcRenderer.invoke('retro:has-schedule-data', year),
    getAvailableScheduleYears: () =>
      ipcRenderer.invoke('retro:get-available-schedule-years'),
    getSchedulePreview: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:get-schedule-preview', filePath, year),
    applySchedule: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-schedule', filePath, year),

    // Coach APIs
    hasCoachData: (year: number) =>
      ipcRenderer.invoke('retro:has-coach-data', year),
    getCoachPreview: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:get-coach-preview', filePath, year),
    applyCoaches: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-coaches', filePath, year),

    // Salary Cap APIs
    getSalaryCap: (year: number) =>
      ipcRenderer.invoke('retro:get-salary-cap', year),
    applySalaryCap: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-salary-cap', filePath, year),

    // Stadium APIs
    getStadiumPreview: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:get-stadium-preview', filePath, year),
    applyStadiumNames: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-stadium-names', filePath, year),

    // Team Schemes APIs
    getSchemePreview: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:get-scheme-preview', filePath, year),
    applyTeamSchemes: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-team-schemes', filePath, year)
  },

  // User Database APIs (Edit player database, custom players, CSV import)
  database: {
    // Service status
    isReady: () => ipcRenderer.invoke('database:is-ready'),

    // Player edit operations (edits to original database players)
    savePlayerEdit: (originalId: number, edits: any) =>
      ipcRenderer.invoke('database:save-player-edit', originalId, edits),
    getPlayerEdit: (originalId: number) =>
      ipcRenderer.invoke('database:get-player-edit', originalId),
    hasPlayerEdit: (originalId: number) =>
      ipcRenderer.invoke('database:has-player-edit', originalId),
    resetPlayer: (originalId: number) =>
      ipcRenderer.invoke('database:reset-player', originalId),
    clearPlayerSeasons: (originalId: number) =>
      ipcRenderer.invoke('database:clear-player-seasons', originalId),

    // Appearance edit operations
    saveAppearanceEdit: (originalPlayerId: number, edits: any) =>
      ipcRenderer.invoke('database:save-appearance-edit', originalPlayerId, edits),
    getAppearanceEdit: (originalPlayerId: number) =>
      ipcRenderer.invoke('database:get-appearance-edit', originalPlayerId),

    // Season edit operations
    saveSeasonEdit: (originalPlayerId: number, year: number, edits: any) =>
      ipcRenderer.invoke('database:save-season-edit', originalPlayerId, year, edits),
    getSeasonEdit: (originalPlayerId: number, year: number) =>
      ipcRenderer.invoke('database:get-season-edit', originalPlayerId, year),
    getSeasonEditsForPlayer: (originalPlayerId: number) =>
      ipcRenderer.invoke('database:get-season-edits-for-player', originalPlayerId),
    // Apply edits to ALL seasons (for change-all-years feature)
    saveSeasonEditAllYears: (originalPlayerId: number, edits: any, options?: { incrementAge?: boolean }) =>
      ipcRenderer.invoke('database:save-season-edit-all-years', originalPlayerId, edits, options),

    // Custom player operations
    createCustomPlayer: (player: any) =>
      ipcRenderer.invoke('database:create-custom-player', player),
    updateCustomPlayer: (id: number, updates: any) =>
      ipcRenderer.invoke('database:update-custom-player', id, updates),
    getCustomPlayer: (id: number) =>
      ipcRenderer.invoke('database:get-custom-player', id),
    getAllCustomPlayers: () =>
      ipcRenderer.invoke('database:get-all-custom-players'),
    deleteCustomPlayer: (id: number) =>
      ipcRenderer.invoke('database:delete-custom-player', id),
    searchCustomPlayers: (query: string, limit?: number) =>
      ipcRenderer.invoke('database:search-custom-players', query, limit),

    // Custom player season operations
    saveCustomPlayerSeason: (customPlayerId: number, year: number, season: any) =>
      ipcRenderer.invoke('database:save-custom-player-season', customPlayerId, year, season),
    getCustomPlayerSeason: (customPlayerId: number, year: number) =>
      ipcRenderer.invoke('database:get-custom-player-season', customPlayerId, year),
    getCustomPlayerSeasons: (customPlayerId: number) =>
      ipcRenderer.invoke('database:get-custom-player-seasons', customPlayerId),

    // Reset operations
    resetAllEdits: () => ipcRenderer.invoke('database:reset-all-edits'),
    resetAllCustomPlayers: () => ipcRenderer.invoke('database:reset-all-custom-players'),
    resetAll: () => ipcRenderer.invoke('database:reset-all'),

    // Backup & restore
    createBackup: () => ipcRenderer.invoke('database:create-backup'),
    restoreBackup: (backupPath: string) =>
      ipcRenderer.invoke('database:restore-backup', backupPath),
    getBackupList: () => ipcRenderer.invoke('database:get-backup-list'),

    // Statistics
    getStats: () => ipcRenderer.invoke('database:get-stats'),
    getEditedPlayerIds: () => ipcRenderer.invoke('database:get-edited-player-ids'),

    // Merged data access (original + user edits)
    getMergedPlayer: (internalId: number) =>
      ipcRenderer.invoke('database:get-merged-player', internalId),
    getMergedPlayerSeason: (internalId: number, year: number) =>
      ipcRenderer.invoke('database:get-merged-player-season', internalId, year),

    // Search operations
    searchPlayers: (query: string, options?: { limit?: number; position?: string; draftYearFrom?: number; draftYearTo?: number }) =>
      ipcRenderer.invoke('database:search-players', query, options),
    getAllPlayers: (options?: { offset?: number; limit?: number }) =>
      ipcRenderer.invoke('database:get-all-players', options),

    // Transfer operations (roster/draft)
    getPlayerForRoster: (internalId: number, year: number) =>
      ipcRenderer.invoke('database:get-player-for-roster', internalId, year),
    getPlayerForDraft: (internalId: number, year: number) =>
      ipcRenderer.invoke('database:get-player-for-draft', internalId, year),
    getPlayerAvailableYears: (internalId: number) =>
      ipcRenderer.invoke('database:get-player-available-years', internalId),
    getPlayerSeasonYears: (internalId: number) =>
      ipcRenderer.invoke('database:get-player-season-years', internalId),
    getPlayersForFill: (options: {
      target: 'roster' | 'draft';
      yearFrom: number;
      yearTo: number;
      excludeKeys: string[];
      positionNeeds: Record<string, number>;
    }) => ipcRenderer.invoke('database:get-players-for-fill', options),

    // CSV Import operations
    selectCsvFile: () => ipcRenderer.invoke('database:select-csv-file'),
    validateCsv: (csvContent: string) => ipcRenderer.invoke('database:validate-csv', csvContent),
    importCsv: (csvContent: string) => ipcRenderer.invoke('database:import-csv', csvContent)
  },

  // Window APIs (focus restoration after native dialogs)
  window: {
    focus: () => ipcRenderer.invoke('window:focus')
  },

  // Editor Tracking APIs (duplicate prevention for roster/draft building)
  editorTracking: {
    trackPlayer: (player: { firstName: string; lastName: string; position: string; internalId: number; year: number; povr: number }, target: 'roster' | 'draft') =>
      ipcRenderer.invoke('editor-tracking:track-player', player, target),
    isTracked: (firstName: string, lastName: string, position: string, target: 'roster' | 'draft') =>
      ipcRenderer.invoke('editor-tracking:is-tracked', firstName, lastName, position, target),
    getTracked: (target: 'roster' | 'draft') =>
      ipcRenderer.invoke('editor-tracking:get-tracked', target),
    getTrackedKeys: (target: 'roster' | 'draft') =>
      ipcRenderer.invoke('editor-tracking:get-tracked-keys', target),
    getCount: (target: 'roster' | 'draft') =>
      ipcRenderer.invoke('editor-tracking:get-count', target),
    clear: (target: 'roster' | 'draft') =>
      ipcRenderer.invoke('editor-tracking:clear', target),
    clearAll: () =>
      ipcRenderer.invoke('editor-tracking:clear-all'),
    remove: (firstName: string, lastName: string, position: string, target: 'roster' | 'draft') =>
      ipcRenderer.invoke('editor-tracking:remove', firstName, lastName, position, target),
    getPositionCounts: (target: 'roster' | 'draft') =>
      ipcRenderer.invoke('editor-tracking:get-position-counts', target),
    importExisting: (players: Array<{ firstName: string; lastName: string; position: string; povr?: number }>, target: 'roster' | 'draft') =>
      ipcRenderer.invoke('editor-tracking:import-existing', players, target)
  },

  // Player Data Fill APIs (PFR scraping for missing bio data)
  playerFill: {
    // Preview what data would be filled for a player
    preview: (playerId: number, playerInfo?: {
      firstName: string;
      lastName: string;
      hometown?: string;
      homeState?: string;
      height?: number;
      weight?: number;
      college?: string;
      draftYear?: number;
      draftRound?: string;
      draftPick?: number;
      careerFrom?: number;
      careerTo?: number;
    }) =>
      ipcRenderer.invoke('player-fill:preview', playerId, playerInfo),

    // Fill missing data for a single player
    fillSingle: (playerId: number, playerInfo?: {
      firstName: string;
      lastName: string;
      hometown?: string;
      homeState?: string;
      height?: number;
      weight?: number;
      college?: string;
      draftYear?: number;
      draftRound?: string;
      draftPick?: number;
      careerFrom?: number;
      careerTo?: number;
    }) =>
      ipcRenderer.invoke('player-fill:fill-single', playerId, playerInfo),

    // Scan database for players with missing data
    scanMissing: (limit?: number) =>
      ipcRenderer.invoke('player-fill:scan-missing', limit),

    // Batch fill missing data for multiple players
    batchFill: (options: { missingField?: string; limit?: number; playerIds?: number[] }) =>
      ipcRenderer.invoke('player-fill:batch-fill', options),

    // Cancel ongoing batch operation
    cancelBatch: () =>
      ipcRenderer.invoke('player-fill:cancel-batch'),

    // Listen for progress events
    onProgress: (callback: (data: {
      current: number;
      total: number;
      playerName: string;
      status: 'searching' | 'filling' | 'complete' | 'error' | 'cancelled';
      message?: string;
    }) => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('player-fill:progress', listener);
      // Return cleanup function
      return () => ipcRenderer.removeListener('player-fill:progress', listener);
    }
  }
});