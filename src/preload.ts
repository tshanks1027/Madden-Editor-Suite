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
    saveRosterFile: (filePath: string, players: any[], originalData: any, options?: { clearInjuries?: boolean }) =>
      ipcRenderer.invoke('parser:save-roster-file', filePath, players, originalData, options),
    getPlayerEquipment: (playerIndex: number) =>
      ipcRenderer.invoke('parser:get-player-equipment', playerIndex),
    setPlayerEquipment: (playerIndex: number, equipment: Record<string, string>) =>
      ipcRenderer.invoke('parser:set-player-equipment', playerIndex, equipment),
    getEquipmentOptions: () =>
      ipcRenderer.invoke('parser:get-equipment-options')
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
      ipcRenderer.invoke('file:exists', filePath),
    getDataPath: (relativePath: string) =>
      ipcRenderer.invoke('file:get-data-path', relativePath)
  },

  // Path APIs (convenience wrappers)
  path: {
    getDataPath: (relativePath: string) =>
      ipcRenderer.invoke('file:get-data-path', relativePath)
  },

  // App APIs
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },

  // Lookup APIs
  lookup: {
    isReady: () => ipcRenderer.invoke('lookup:is-ready'),
    reload: () => ipcRenderer.invoke('lookup:reload'),
    getStatus: () => ipcRenderer.invoke('lookup:get-status'),
    getDropdownOptions: (fileName: string) => ipcRenderer.invoke('lookup:get-dropdown-options', fileName),
    getPIDPortraitMapping: () => ipcRenderer.invoke('lookup:get-pid-portrait-mapping'),
    getPIDLookup: () => ipcRenderer.invoke('lookup:get-pid-lookup'),
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
    getFacePickerMapping: () => ipcRenderer.invoke('lookup:get-face-picker-mapping'),
    // Commentary ID lookup by last name
    getCommentaryId: (lastName: string) => ipcRenderer.invoke('lookup:get-commentary-id', lastName)
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
    generateDraftClass: (year: number, testingMode = false, ratingMode = 'semi-historical') =>
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
    generateRoster: (year: number, teams: string[], ratingMode = 'semi-historical') =>
      ipcRenderer.invoke('creator:generate-roster', year, teams, ratingMode),
    testScraper: (year: number) =>
      ipcRenderer.invoke('creator:test-scraper', year)
  },

  // Scraper APIs (season-based stats scraping)
  scraper: {
    // Scrape all stats for a season (passing, rushing, receiving, defense)
    scrapeSeasonStats: (year: number) =>
      ipcRenderer.invoke('scraper:scrape-season-stats', year),
    // Get one player's stats (with optional position/team for disambiguation)
    getPlayerStats: (playerName: string, year: number, position?: string, team?: string) =>
      ipcRenderer.invoke('scraper:get-player-stats', playerName, year, position, team),
    // Get all matching players for disambiguation UI
    getAllMatches: (playerName: string, year: number) =>
      ipcRenderer.invoke('scraper:get-all-matches', playerName, year),
    // Check what years are cached
    getCachedSeasons: () =>
      ipcRenderer.invoke('scraper:get-cached-seasons'),
    // Clear cache if needed
    clearCache: () =>
      ipcRenderer.invoke('scraper:clear-cache')
  },

  // Roster Creator APIs
  rosterCreator: {
    generate: (year: number, templatePath: string, ratingMode = 'semi-historical') =>
      ipcRenderer.invoke('roster-creator:generate', year, templatePath, ratingMode),
    save: (players: any[], templatePath: string, outputPath: string, year?: number) =>
      ipcRenderer.invoke('roster-creator:save', players, templatePath, outputPath, year),
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
    calculateOVRForArchetypes: (attributes: any, position: string) =>
      ipcRenderer.invoke('rating:calculate-ovr-for-archetypes', attributes, position),
    birthdayToDisplay: (encoded: number) =>
      ipcRenderer.invoke('rating:birthday-to-display', encoded),
    birthdayToEncoded: (display: string) =>
      ipcRenderer.invoke('rating:birthday-to-encoded', display),
    calculateAge: (encoded: number, asOfYear?: number) =>
      ipcRenderer.invoke('rating:calculate-age', encoded, asOfYear),
    calculateOVRAdjustments: (currentAttributes: any, targetOVR: number, position: string, archetype?: string) =>
      ipcRenderer.invoke('rating:calculate-ovr-adjustments', currentAttributes, targetOVR, position, archetype),
    getArchetypeWeights: (archetypeName: string) =>
      ipcRenderer.invoke('rating:get-archetype-weights', archetypeName),
    // Archetype sync - ensures roster archetypes match what Madden assigns
    syncArchetypeFromAttributes: (player: any, position: string) =>
      ipcRenderer.invoke('rating:sync-archetype-from-attributes', player, position),
    determineArchetype: (player: any, position: string) =>
      ipcRenderer.invoke('rating:determine-archetype', player, position),
    adjustAttributesForArchetype: (player: any, targetArchetype: string, position: string, baseOVR?: number) =>
      ipcRenderer.invoke('rating:adjust-attributes-for-archetype', player, targetArchetype, position, baseOVR),
    validateArchetypeConsistency: (player: any, position: string) =>
      ipcRenderer.invoke('rating:validate-archetype-consistency', player, position),
    // Batch recalculate OVR for all players (uses correct game formula)
    recalculateOVRBatch: (players: any[]) =>
      ipcRenderer.invoke('rating:recalculate-ovr-batch', players),
    // Find best archetype and OVR for a player (mimics game behavior)
    findBestOVR: (attributes: any, position: string) =>
      ipcRenderer.invoke('rating:find-best-ovr', attributes, position)
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
    initialize: () => ipcRenderer.invoke('portrait:initialize'),
    getByPLPO: (plpoKey: string) => ipcRenderer.invoke('portrait:get-image-data-by-plpo', plpoKey),
    getByPID: (pid: number) => ipcRenderer.invoke('portrait:get-image-data-by-pid', pid),
    getImageDataByPam: (pamCode: string) => ipcRenderer.invoke('portrait:get-image-data-by-pam', pamCode),
    // Get image data for any PID - handles both standard (via sprite) and custom (12000+) portraits
    getImageDataByPid: async (pid: number) => {
      const CUSTOM_PORTRAIT_PID_START = 12000;
      if (pid >= CUSTOM_PORTRAIT_PID_START) {
        // Custom portrait - get from custom portrait service
        return ipcRenderer.invoke('custom-portrait:get', pid);
      } else {
        // Standard portrait - get from sprite service
        return ipcRenderer.invoke('portrait:get-image-data-by-pid', pid);
      }
    },
    // Export sprite sheet portrait as DDS (shows folder dialog)
    exportDdsByPid: (pid: number) =>
      ipcRenderer.invoke('portrait:export-dds-by-pid', pid),
    // Export sprite sheet portrait as DDS to specific path
    exportDdsToPath: (pid: number, outputPath: string) =>
      ipcRenderer.invoke('portrait:export-dds-by-pid-to-path', pid, outputPath),
    // Batch export multiple sprite sheet portraits as DDS
    exportBatchDds: (pids: number[]) =>
      ipcRenderer.invoke('portrait:export-batch-dds', pids),
    // Get all PIDs that have sprite sheet portraits
    getAllPids: () =>
      ipcRenderer.invoke('portrait:get-all-pids'),
    // Search sprite sheet portraits with thumbnails
    searchWithImages: (query: string, limit?: number) =>
      ipcRenderer.invoke('portrait:search-with-images', query, limit)
  },

  // Coach Portrait APIs
  coachPortrait: {
    initialize: () => ipcRenderer.invoke('coach-portrait:initialize'),
    getByPID: (pid: number) => ipcRenderer.invoke('coach-portrait:get-by-pid', pid),
    getImageDataByPID: (pid: number) => ipcRenderer.invoke('coach-portrait:get-image-data-by-pid', pid),
    hasPortrait: (pid: number) => ipcRenderer.invoke('coach-portrait:has-portrait', pid),
    exportBatchDds: (pids: number[]) => ipcRenderer.invoke('coach-portrait:export-batch-dds', pids),
    searchWithImages: (query: string, limit?: number) =>
      ipcRenderer.invoke('coach-portrait:search-with-images', query, limit),
    getAllWithImages: (limit?: number) =>
      ipcRenderer.invoke('coach-portrait:get-all-with-images', limit)
  },

  // Gear Image APIs
  gear: {
    getAtlas: () => ipcRenderer.invoke('gear:get-atlas'),
    getImage: (imageName: string) => ipcRenderer.invoke('gear:get-image', imageName)
  },

  // Era Equipment APIs (mass equipment assignment by year)
  equipment: {
    getEraEquipment: (year: number, position: string) =>
      ipcRenderer.invoke('equipment:get-era-equipment', year, position),
    getEraOptions: (year: number) =>
      ipcRenderer.invoke('equipment:get-era-options', year),
    getEraBracket: (year: number) =>
      ipcRenderer.invoke('equipment:get-era-bracket', year)
  },

  // Custom Portrait APIs (user-uploaded portraits, PID 12000+)
  customPortrait: {
    import: (filePath: string, metadata?: { playerName?: string; year?: number }) =>
      ipcRenderer.invoke('custom-portrait:import', filePath, metadata),
    importDialog: () =>
      ipcRenderer.invoke('custom-portrait:import-dialog'),
    importMultipleDialog: (metadata?: { year?: number }) =>
      ipcRenderer.invoke('custom-portrait:import-multiple-dialog', metadata),
    get: (pid: number) =>
      ipcRenderer.invoke('custom-portrait:get', pid),
    list: () =>
      ipcRenderer.invoke('custom-portrait:list'),
    listByYear: (year: number) =>
      ipcRenderer.invoke('custom-portrait:list-by-year', year),
    delete: (pid: number) =>
      ipcRenderer.invoke('custom-portrait:delete', pid),
    updateMetadata: (pid: number, metadata: { playerName?: string; databasePlayerId?: number; year?: number }) =>
      ipcRenderer.invoke('custom-portrait:update-metadata', pid, metadata),
    exportDds: (pid: number) =>
      ipcRenderer.invoke('custom-portrait:export-dds', pid),
    exportDdsToPath: (pid: number, outputPath: string) =>
      ipcRenderer.invoke('custom-portrait:export-dds-to-path', pid, outputPath),
    exportBatch: (pids: number[]) =>
      ipcRenderer.invoke('custom-portrait:export-batch', pids),
    exportByYear: (year: number) =>
      ipcRenderer.invoke('custom-portrait:export-by-year', year),
    exportAll: () =>
      ipcRenderer.invoke('custom-portrait:export-all'),
    getNextPid: () =>
      ipcRenderer.invoke('custom-portrait:get-next-pid'),
    has: (pid: number) =>
      ipcRenderer.invoke('custom-portrait:has', pid),
    count: () =>
      ipcRenderer.invoke('custom-portrait:count'),
    getByPlayerId: (playerId: number) =>
      ipcRenderer.invoke('custom-portrait:get-by-player-id', playerId),
    getByName: (firstName: string, lastName: string) =>
      ipcRenderer.invoke('custom-portrait:get-by-name', firstName, lastName),
    generateSpriteSheets: (options?: { year?: number; prefix?: string }) =>
      ipcRenderer.invoke('custom-portrait:generate-sprite-sheets', options),
    getAvailableYears: () =>
      ipcRenderer.invoke('custom-portrait:get-available-years')
  },

  // Custom Coach Portrait APIs (user-uploaded coach portraits, PID 500+)
  customCoachPortrait: {
    import: (filePath: string, metadata?: { coachName?: string; year?: number }) =>
      ipcRenderer.invoke('custom-coach-portrait:import', filePath, metadata),
    importDialog: () =>
      ipcRenderer.invoke('custom-coach-portrait:import-dialog'),
    importMultipleDialog: (metadata?: { year?: number }) =>
      ipcRenderer.invoke('custom-coach-portrait:import-multiple-dialog', metadata),
    get: (pid: number) =>
      ipcRenderer.invoke('custom-coach-portrait:get', pid),
    list: () =>
      ipcRenderer.invoke('custom-coach-portrait:list'),
    listByYear: (year: number) =>
      ipcRenderer.invoke('custom-coach-portrait:list-by-year', year),
    delete: (pid: number) =>
      ipcRenderer.invoke('custom-coach-portrait:delete', pid),
    updateMetadata: (pid: number, metadata: { coachName?: string; databaseCoachId?: number; year?: number }) =>
      ipcRenderer.invoke('custom-coach-portrait:update-metadata', pid, metadata),
    exportDds: (pid: number) =>
      ipcRenderer.invoke('custom-coach-portrait:export-dds', pid),
    exportBatch: (pids: number[]) =>
      ipcRenderer.invoke('custom-coach-portrait:export-batch', pids),
    exportAll: () =>
      ipcRenderer.invoke('custom-coach-portrait:export-all'),
    getNextPid: () =>
      ipcRenderer.invoke('custom-coach-portrait:get-next-pid'),
    has: (pid: number) =>
      ipcRenderer.invoke('custom-coach-portrait:has', pid),
    count: () =>
      ipcRenderer.invoke('custom-coach-portrait:count'),
    getByCoachId: (coachId: number) =>
      ipcRenderer.invoke('custom-coach-portrait:get-by-coach-id', coachId),
    getAvailableYears: () =>
      ipcRenderer.invoke('custom-coach-portrait:get-available-years')
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
    createBackup: (filePath: string) => ipcRenderer.invoke('retro:create-backup', filePath),
    closeFile: (filePath: string) => ipcRenderer.invoke('retro:close-file', filePath),
    applyAllChanges: (filePath: string, year: number, options?: { applyTeams?: boolean; applyAbbreviations?: boolean }) =>
      ipcRenderer.invoke('retro:apply-all-changes', filePath, year, options),
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
    applySalaryCap: (filePath: string, year: number, options?: { createBackup?: boolean }) =>
      ipcRenderer.invoke('retro:apply-salary-cap', filePath, year, options),
    applyEraContracts: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-era-contracts', filePath, year),
    setPlaceholderCoaches: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:set-placeholder-coaches', filePath, year),
    replaceFACoaches: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:replace-fa-coaches', filePath, year),

    // NFL Records APIs
    getNFLRecordsPreview: (year: number) =>
      ipcRenderer.invoke('retro:get-nfl-records-preview', year),
    applyNFLRecords: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-nfl-records', filePath, year),

    // Historical Stats APIs
    getHistoricalStatsPreview: (year: number) =>
      ipcRenderer.invoke('retro:get-historical-stats-preview', year),
    applyHistoricalStats: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-historical-stats', filePath, year),

    // Stadium APIs
    getStadiumPreview: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:get-stadium-preview', filePath, year),
    applyStadiumNames: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-stadium-names', filePath, year),

    // Team Schemes APIs
    getSchemePreview: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:get-scheme-preview', filePath, year),
    applyTeamSchemes: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-team-schemes', filePath, year),

    // Uniform APIs
    getUniformsForYear: (year: number) =>
      ipcRenderer.invoke('retro:get-uniforms-for-year', year),
    getUniformPreviewSummary: (year: number) =>
      ipcRenderer.invoke('retro:get-uniform-preview-summary', year),
    applyUniforms: (year: number) =>
      ipcRenderer.invoke('retro:apply-uniforms', year),

    // Expansion/Relocation APIs
    getExpansionEvent: (year: number) =>
      ipcRenderer.invoke('retro:get-expansion-event', year),
    getAllExpansionEvents: () =>
      ipcRenderer.invoke('retro:get-all-expansion-events'),
    executeRelocation: (filePath: string, sourceTeamIndex: number, destTeamIndex: number) =>
      ipcRenderer.invoke('retro:execute-relocation', filePath, sourceTeamIndex, destTeamIndex),
    prepareExpansionDraft: (filePath: string, expansionEvent: any) =>
      ipcRenderer.invoke('retro:prepare-expansion-draft', filePath, expansionEvent),
    getEligiblePlayers: (filePath: string, expansionEvent: any, rosterPath?: string) =>
      ipcRenderer.invoke('retro:get-eligible-players', filePath, expansionEvent, rosterPath),
    autoProtectPlayers: (players: any[], maxProtected: number) =>
      ipcRenderer.invoke('retro:auto-protect-players', players, maxProtected),
    executeExpansionDraft: (filePath: string, selections: any[], expansionTeamIndices?: number[]) =>
      ipcRenderer.invoke('retro:execute-expansion-draft', filePath, selections, expansionTeamIndices),

    // Expansion roster cleanup - move inactive team players to FA
    moveInactivePlayersToFA: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:move-inactive-players-to-fa', filePath, year),

    // League history cleanup - clear Super Bowl history for historical years
    clearLeagueHistory: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:clear-league-history', filePath, year),

    // Single atomic operation to apply changes AND save
    applyAndSave: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-and-save', filePath, year),

    // Single atomic operation to apply changes AND save to a new location
    applyAndSaveAs: (originalPath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-and-save-as', originalPath, year),

    // THE CORRECT APPROACH: Gather all wizard data, then apply ALL changes at once and save
    // This is called ONCE at the end of the wizard with all collected data
    applyAllAndSave: (config: {
      sourcePath: string;
      saveAs: boolean; // true = show save dialog, false = overwrite source
      year: number;
      options: {
        teams?: boolean;
        abbreviations?: boolean;
        schedule?: boolean;
        coaches?: boolean;
        salaryCap?: boolean;
        stadiums?: boolean;
        schemes?: boolean;
        uniforms?: boolean;
        expansion?: boolean;
      };
      expansionEvent?: any;
      expansionDraftSelections?: Array<{ playerRecordIndex: number; newTeamIndex: number }>;
      expansionTeamIndices?: number[]; // Team indices for clearing rosters before expansion draft
    }) => ipcRenderer.invoke('retro:apply-all-and-save', config),

    // Commentary Fix APIs
    getCommentaryPreview: (filePath: string) =>
      ipcRenderer.invoke('retro:get-commentary-preview', filePath),
    applyCommentaryFix: (filePath: string) =>
      ipcRenderer.invoke('retro:apply-commentary-fix', filePath),

    // Coach Database APIs
    getFACoaches: (filePath: string) =>
      ipcRenderer.invoke('retro:get-fa-coaches', filePath),
    getTeamCoaches: (filePath: string) =>
      ipcRenderer.invoke('retro:get-team-coaches', filePath),
    searchCoachDatabase: (query: string, year: number, limit?: number) =>
      ipcRenderer.invoke('retro:search-coach-database', query, year, limit),
    debugListCustomCoaches: () =>
      ipcRenderer.invoke('retro:debug-list-custom-coaches'),
    replaceFACoach: (filePath: string, faCoachIndex: number, dbCoach: any, year: number) =>
      ipcRenderer.invoke('retro:replace-fa-coach', filePath, faCoachIndex, dbCoach, year),

    // Equipment APIs
    applyEquipment: (filePath: string, year: number) =>
      ipcRenderer.invoke('retro:apply-equipment', filePath, year)
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
    deletePlayerSeason: (originalId: number, year: number) =>
      ipcRenderer.invoke('database:delete-player-season', originalId, year),
    deleteCustomPlayerSeason: (customPlayerId: number, year: number) =>
      ipcRenderer.invoke('database:delete-custom-player-season', customPlayerId, year),

    // Appearance edit operations
    saveAppearanceEdit: (originalPlayerId: number, edits: any) =>
      ipcRenderer.invoke('database:save-appearance-edit', originalPlayerId, edits),
    getAppearanceEdit: (originalPlayerId: number) =>
      ipcRenderer.invoke('database:get-appearance-edit', originalPlayerId),
    getAllCustomPids: () =>
      ipcRenderer.invoke('database:get-all-custom-pids'),

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

    // Equipment edit operations (per player per year)
    saveEquipmentEdit: (originalPlayerId: number, year: number, equipment: { [slot: string]: string }) =>
      ipcRenderer.invoke('database:save-equipment-edit', originalPlayerId, year, equipment),
    getEquipmentEdit: (originalPlayerId: number, year: number) =>
      ipcRenderer.invoke('database:get-equipment-edit', originalPlayerId, year),
    getEquipmentEditsForPlayer: (originalPlayerId: number) =>
      ipcRenderer.invoke('database:get-equipment-edits-for-player', originalPlayerId),
    getAllEquipmentEditsForYear: (year: number) =>
      ipcRenderer.invoke('database:get-all-equipment-edits-for-year', year),

    // Trait edit operations (per player per year)
    saveTraitEdit: (originalPlayerId: number, year: number, traits: { [traitName: string]: boolean | number }) =>
      ipcRenderer.invoke('database:save-trait-edit', originalPlayerId, year, traits),
    getTraitEdit: (originalPlayerId: number, year: number) =>
      ipcRenderer.invoke('database:get-trait-edit', originalPlayerId, year),
    getTraitEditsForPlayer: (originalPlayerId: number) =>
      ipcRenderer.invoke('database:get-trait-edits-for-player', originalPlayerId),
    getAllTraitEditsForYear: (year: number) =>
      ipcRenderer.invoke('database:get-all-trait-edits-for-year', year),

    // Player archetype operations (player-level, constant across all seasons)
    getPlayerArchetype: (playerId: number) =>
      ipcRenderer.invoke('database:get-player-archetype', playerId),
    savePlayerArchetype: (playerId: number, archetype: string, archetypeId?: number) =>
      ipcRenderer.invoke('database:save-player-archetype', playerId, archetype, archetypeId),

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
    saveCustomPlayerSeasonAllYears: (customPlayerId: number, edits: any, options?: { incrementAge?: boolean }) =>
      ipcRenderer.invoke('database:save-custom-player-season-all-years', customPlayerId, edits, options),

    // Hide/unhide player operations
    hidePlayer: (playerId: number) =>
      ipcRenderer.invoke('database:hide-player', playerId),
    unhidePlayer: (playerId: number) =>
      ipcRenderer.invoke('database:unhide-player', playerId),
    getHiddenPlayers: () =>
      ipcRenderer.invoke('database:get-hidden-players'),
    getHiddenPlayersDetails: () =>
      ipcRenderer.invoke('database:get-hidden-players-details'),
    isPlayerHidden: (playerId: number) =>
      ipcRenderer.invoke('database:is-player-hidden', playerId),
    hideAllBlankPlayers: () =>
      ipcRenderer.invoke('database:hide-all-blank-players'),

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

    // Career stats operations (from scraped PFR database)
    // draftYear and position help disambiguate players with the same name
    getCareerStats: (firstName: string, lastName: string, draftYear?: number, position?: string) =>
      ipcRenderer.invoke('database:get-career-stats', firstName, lastName, draftYear, position),
    getCareerStatsByYear: (firstName: string, lastName: string, year: number) =>
      ipcRenderer.invoke('database:get-career-stats-by-year', firstName, lastName, year),
    calculateRatingFromStats: (options: {
      stats: any,
      position: string,
      year: number,
      targetYear?: number,
      playerAge?: number,
      achievements?: {
        proBowlYears?: number[],
        allPro1stYears?: number[],
        allPro2ndYears?: number[],
        isHOF?: boolean,
        draftRound?: number
      }
    }) =>
      ipcRenderer.invoke('database:calculate-rating-from-stats', options),
    distributeOVRToRatings: (options: { ovr: number, position: string }) =>
      ipcRenderer.invoke('database:distribute-ovr-to-ratings', options),
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
    importCsv: (csvContent: string) => ipcRenderer.invoke('database:import-csv', csvContent),

    // Bio save from roster/draft editor (right-click save to database)
    savePlayerBio: (playerData: {
      firstName: string;
      lastName: string;
      draftYear: number;
      pid?: number;
      pam?: string;
      race?: number;
      bodyType?: string;
      handedness?: number;
      height?: number;
      weight?: number;
      college?: number;
      homeState?: number;
    }) => ipcRenderer.invoke('database:save-player-bio', playerData),

    // Cross-window communication (database browser -> main window)
    sendPlayerToMainWindow: (internalId: number, target: 'roster' | 'draft', options?: { teamId?: number; year?: number | null }) =>
      ipcRenderer.invoke('database:send-player-to-main', internalId, target, options),
    onPlayerFromBrowser: (callback: (internalId: number, target: 'roster' | 'draft', options?: { teamId?: number; year?: number | null }) => void) => {
      ipcRenderer.on('database:player-from-browser', (_event, internalId, target, options) => callback(internalId, target, options));
    },

    // Debug handler for Warren Moon issue
    debugWarrenMoon: () => ipcRenderer.invoke('database:debug-warren-moon'),

    // Debug handler for user edits diagnostic
    debugUserEdits: (year: number) => ipcRenderer.invoke('database:debug-user-edits', year),

    // Draft class push to database
    analyzeDraftClassPush: (prospects: any[], draftYear: number) =>
      ipcRenderer.invoke('database:analyze-draft-class-push', prospects, draftYear),
    executeDraftClassPush: (
      analysis: any,
      resolutions: any[],
      options?: {
        overwriteExistingSeasons?: boolean;
        fillEmptyBioFields?: boolean;
        pushMode?: 'all' | 'ratings';
        bioFieldOptions?: Record<string, boolean>;
      }
    ) =>
      ipcRenderer.invoke('database:execute-draft-class-push', analysis, resolutions, options),

    // Roster push to database
    analyzeRosterPush: (players: any[], seasonYear: number) =>
      ipcRenderer.invoke('database:analyze-roster-push', players, seasonYear),
    executeRosterPush: (
      analysis: any,
      resolutions: any[],
      options?: {
        pushMode?: 'all' | 'ratings';
        bioFieldOptions?: {
          team?: boolean;
          jersey?: boolean;
          archetype?: boolean;
          position?: boolean;
          college?: boolean;
          height?: boolean;
          weight?: boolean;
          homeState?: boolean;
          race?: boolean;
          bodyType?: boolean;
          handedness?: boolean;
          pid?: boolean;
          pam?: boolean;
        };
        overwriteExistingSeasons?: boolean;
        fillEmptyBioFields?: boolean;
      }
    ) =>
      ipcRenderer.invoke('database:execute-roster-push', analysis, resolutions, options),

    // Merge duplicate players
    mergePlayers: (primaryPlayerId: number, secondaryPlayerIds: number[], isCustomMerge: boolean) =>
      ipcRenderer.invoke('database:merge-players', primaryPlayerId, secondaryPlayerIds, isCustomMerge)
  },

  // Coach Database APIs (Edit coach database, custom coaches)
  coachDatabase: {
    // Coach edit operations (edits to original database coaches)
    saveCoachEdit: (originalId: number, edits: any) =>
      ipcRenderer.invoke('coach-database:save-coach-edit', originalId, edits),
    getCoachEdit: (originalId: number) =>
      ipcRenderer.invoke('coach-database:get-coach-edit', originalId),
    hasCoachEdit: (originalId: number) =>
      ipcRenderer.invoke('coach-database:has-coach-edit', originalId),
    resetCoach: (originalId: number) =>
      ipcRenderer.invoke('coach-database:reset-coach', originalId),

    // Coach appearance edit operations
    saveAppearanceEdit: (originalCoachId: number, edits: any) =>
      ipcRenderer.invoke('coach-database:save-appearance-edit', originalCoachId, edits),
    getAppearanceEdit: (originalCoachId: number) =>
      ipcRenderer.invoke('coach-database:get-appearance-edit', originalCoachId),

    // Coach season edit operations
    saveSeasonEdit: (originalCoachId: number, year: number, edits: any) =>
      ipcRenderer.invoke('coach-database:save-season-edit', originalCoachId, year, edits),
    getSeasonEdit: (originalCoachId: number, year: number) =>
      ipcRenderer.invoke('coach-database:get-season-edit', originalCoachId, year),
    getSeasonEditsForCoach: (originalCoachId: number) =>
      ipcRenderer.invoke('coach-database:get-season-edits-for-coach', originalCoachId),
    saveSeasonEditAllYears: (originalCoachId: number, edits: any, options?: { careerFrom?: number, careerTo?: number }) =>
      ipcRenderer.invoke('coach-database:save-season-edit-all-years', originalCoachId, edits, options),

    // Custom coach operations
    createCustomCoach: (coach: any) =>
      ipcRenderer.invoke('coach-database:create-custom-coach', coach),
    updateCustomCoach: (id: number, updates: any) =>
      ipcRenderer.invoke('coach-database:update-custom-coach', id, updates),
    getCustomCoach: (id: number) =>
      ipcRenderer.invoke('coach-database:get-custom-coach', id),
    getAllCustomCoaches: () =>
      ipcRenderer.invoke('coach-database:get-all-custom-coaches'),
    deleteCustomCoach: (id: number) =>
      ipcRenderer.invoke('coach-database:delete-custom-coach', id),
    searchCustomCoaches: (query: string, limit?: number) =>
      ipcRenderer.invoke('coach-database:search-custom-coaches', query, limit),

    // Custom coach season operations
    saveCustomCoachSeason: (customCoachId: number, year: number, season: any) =>
      ipcRenderer.invoke('coach-database:save-custom-coach-season', customCoachId, year, season),
    getCustomCoachSeason: (customCoachId: number, year: number) =>
      ipcRenderer.invoke('coach-database:get-custom-coach-season', customCoachId, year),
    getCustomCoachSeasons: (customCoachId: number) =>
      ipcRenderer.invoke('coach-database:get-custom-coach-seasons', customCoachId),
    saveCustomCoachSeasonAllYears: (customCoachId: number, edits: any) =>
      ipcRenderer.invoke('coach-database:save-custom-coach-season-all-years', customCoachId, edits),

    // Hide/unhide coach operations
    hideCoach: (coachId: number) =>
      ipcRenderer.invoke('coach-database:hide-coach', coachId),
    unhideCoach: (coachId: number) =>
      ipcRenderer.invoke('coach-database:unhide-coach', coachId),
    getHiddenCoaches: () =>
      ipcRenderer.invoke('coach-database:get-hidden-coaches'),
    isCoachHidden: (coachId: number) =>
      ipcRenderer.invoke('coach-database:is-coach-hidden', coachId),

    // Reset operations
    resetAllEdits: () => ipcRenderer.invoke('coach-database:reset-all-edits'),
    resetAllCustomCoaches: () => ipcRenderer.invoke('coach-database:reset-all-custom'),

    // Statistics
    getStats: () => ipcRenderer.invoke('coach-database:get-stats'),

    // Merged data access (original + user edits)
    getMergedCoach: (coachId: number) =>
      ipcRenderer.invoke('coach-database:get-merged-coach', coachId),
    getMergedCoachSeason: (coachId: number, year: number) =>
      ipcRenderer.invoke('coach-database:get-merged-coach-season', coachId, year),

    // Search operations
    searchCoaches: (options?: { query?: string; position?: string; includeHidden?: boolean; limit?: number; offset?: number }) =>
      ipcRenderer.invoke('coach-database:search-coaches', options || {}),
    getAllCoaches: () =>
      ipcRenderer.invoke('coach-database:get-all-coaches'),
    getCoachByName: (lastName: string, firstName: string) =>
      ipcRenderer.invoke('coach-database:get-coach-by-name', lastName, firstName),

    // Coach appearance options (GenericHeadAssetName from MFT data)
    getHeadAssetOptions: () =>
      ipcRenderer.invoke('coach-database:get-head-asset-options'),

    // Coach PAM options (for PAM-only picker)
    getPamOptions: () =>
      ipcRenderer.invoke('coach-database:get-pam-options'),

    // Retro coach data (historical coaching data)
    getRetroCoachData: (year: number) =>
      ipcRenderer.invoke('coach-database:get-retro-coach-data', year),
    getAvailableRetroYears: () =>
      ipcRenderer.invoke('coach-database:get-available-retro-years'),

    // Generic portrait options (race-coded generic coach faces)
    getGenericPortraits: () =>
      ipcRenderer.invoke('coach-database:get-generic-portraits'),

    // Retro coach import
    importRetroCoaches: () =>
      ipcRenderer.invoke('coach-database:import-retro-coaches'),
    getRetroImportStatus: () =>
      ipcRenderer.invoke('coach-database:get-retro-import-status'),
    clearAllCoaches: () =>
      ipcRenderer.invoke('coach-database:clear-all-coaches'),

    // Migration/repair operations
    migrateStrandedPortraits: () =>
      ipcRenderer.invoke('coach-database:migrate-stranded-portraits')
  },

  // Window APIs (focus restoration after native dialogs, multi-window support)
  window: {
    focus: () => ipcRenderer.invoke('window:focus'),
    openDatabase: (mode?: 'roster' | 'draft') => ipcRenderer.invoke('window:open-database', mode),
    onSetMode: (callback: (mode: 'roster' | 'draft') => void) => {
      ipcRenderer.on('database:set-mode', (_event, mode) => callback(mode));
    }
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
  },

  // Frosty Export APIs (FMT-compatible file generation for throwback mods)
  frosty: {
    exportPlayer: (player: { firstName: string; lastName: string; pid: string; race?: number; team?: string }, outputDir: string) =>
      ipcRenderer.invoke('frosty:export-player', player, outputDir),
    exportBatch: (players: Array<{ firstName: string; lastName: string; pid: string; race?: number; team?: string }>, outputDir: string) =>
      ipcRenderer.invoke('frosty:export-batch', players, outputDir),
    getGenericFace: (race: number) =>
      ipcRenderer.invoke('frosty:get-generic-face', race),
    selectOutputFolder: () =>
      ipcRenderer.invoke('frosty:select-output-folder'),
    generatePortraitName: (firstName: string, lastName: string) =>
      ipcRenderer.invoke('frosty:generate-portrait-name', firstName, lastName)
  },

  // Portrait Mapping APIs (year-based portrait assignment for throwback mods)
  portraitMapping: {
    // Initialize the recyclable PID service
    init: () => ipcRenderer.invoke('portrait-mapping:init'),
    // Get counts of recyclable PIDs
    getRecyclableCount: () => ipcRenderer.invoke('portrait-mapping:getRecyclableCount'),
    // Generate mapping for a year (draft class, roster, or both)
    generate: (year: number, mode: 'draft' | 'roster' | 'both') =>
      ipcRenderer.invoke('portrait-mapping:generate', year, mode),
    // Get existing mapping for a year
    get: (year: number) => ipcRenderer.invoke('portrait-mapping:get', year),
    // Get years with existing mappings
    getAvailableYears: () => ipcRenderer.invoke('portrait-mapping:getAvailableYears')
  },

  // Portrait Import/Export API (controlled portrait assignment with Frosty export)
  portraitImport: {
    // Initialize portrait import service
    init: () => ipcRenderer.invoke('portrait-import:init'),
    // Import portraits from folder (shows dialog)
    importFromFolder: (year: number, type: 'draft' | 'roster') =>
      ipcRenderer.invoke('portrait-import:importFromFolder', year, type),
    // Import from specific path (no dialog)
    importFromPath: (folderPath: string, year: number, type: 'draft' | 'roster') =>
      ipcRenderer.invoke('portrait-import:importFromPath', folderPath, year, type),
    // Get assignments for a year
    getAssignments: (year: number, type?: 'draft' | 'roster') =>
      ipcRenderer.invoke('portrait-import:getAssignments', year, type),
    // Assign a player to a specific PLPO slot
    assignToSlot: (historicalPlayer: string, year: number, type: 'draft' | 'roster', newPLPO: string) =>
      ipcRenderer.invoke('portrait-import:assignToSlot', historicalPlayer, year, type, newPLPO),
    // Swap assignments between two players
    swapAssignments: (player1: string, player2: string, year: number, type: 'draft' | 'roster') =>
      ipcRenderer.invoke('portrait-import:swapAssignments', player1, player2, year, type),
    // Auto-assign by race for better matching
    autoAssignByRace: (year: number, type: 'draft' | 'roster') =>
      ipcRenderer.invoke('portrait-import:autoAssignByRace', year, type),
    // Get available slots (optionally filtered by race)
    getAvailableSlots: (year: number, type: 'draft' | 'roster', race?: number) =>
      ipcRenderer.invoke('portrait-import:getAvailableSlots', year, type, race),
    // Clear assignments for a year
    clearAssignments: (year: number, type?: 'draft' | 'roster') =>
      ipcRenderer.invoke('portrait-import:clearAssignments', year, type)
  },

  portraitExport: {
    // Export portraits for Frosty (shows folder dialog)
    exportForFrosty: (year: number, type?: 'draft' | 'roster') =>
      ipcRenderer.invoke('portrait-export:exportForFrosty', year, type),
    // Export to specific path (no dialog)
    exportToPath: (year: number, outputPath: string, type?: 'draft' | 'roster') =>
      ipcRenderer.invoke('portrait-export:exportToPath', year, outputPath, type),
    // Get export preview
    getPreview: (year: number, type?: 'draft' | 'roster') =>
      ipcRenderer.invoke('portrait-export:getPreview', year, type),
    // Get manifest only
    getManifest: (year: number, type?: 'draft' | 'roster') =>
      ipcRenderer.invoke('portrait-export:getManifest', year, type)
  },

  // Team Logo APIs (logo import/export for Frosty/MFT integration)
  logo: {
    // Get teams for a specific year with logo info
    getTeamsForYear: (year: number) =>
      ipcRenderer.invoke('logo:getTeamsForYear', year),
    // Get all abbreviations needing custom logos
    getAbbreviationsNeedingLogos: () =>
      ipcRenderer.invoke('logo:getAbbreviationsNeedingLogos'),
    // Get available logo types
    getLogoTypes: () =>
      ipcRenderer.invoke('logo:getLogoTypes'),
    // Import a logo file (shows dialog)
    importLogo: (abbreviation: string, logoType: string) =>
      ipcRenderer.invoke('logo:importLogo', abbreviation, logoType),
    // Import logo from path (no dialog)
    importLogoFromPath: (abbreviation: string, logoType: string, sourcePath: string) =>
      ipcRenderer.invoke('logo:importLogoFromPath', abbreviation, logoType, sourcePath),
    // Get path to a specific logo
    getLogoPath: (abbreviation: string, logoType: string) =>
      ipcRenderer.invoke('logo:getLogoPath', abbreviation, logoType),
    // Check if logo exists
    hasLogo: (abbreviation: string, logoType: string) =>
      ipcRenderer.invoke('logo:hasLogo', abbreviation, logoType),
    // Get all logos for a team
    getLogosForTeam: (abbreviation: string) =>
      ipcRenderer.invoke('logo:getLogosForTeam', abbreviation),
    // Delete a logo
    deleteLogo: (abbreviation: string, logoType: string) =>
      ipcRenderer.invoke('logo:deleteLogo', abbreviation, logoType),
    // Export logos for Frosty (shows dialog)
    exportForFrosty: (year: number) =>
      ipcRenderer.invoke('logo:exportForFrosty', year),
    // Export to specific path (no dialog)
    exportForFrostyToPath: (year: number, outputDir: string) =>
      ipcRenderer.invoke('logo:exportForFrostyToPath', year, outputDir),
    // Export logos for MFT (shows dialog)
    exportForMFT: (year: number) =>
      ipcRenderer.invoke('logo:exportForMFT', year),
    // Get logo summary stats
    getSummary: () =>
      ipcRenderer.invoke('logo:getSummary'),

    // Logo Scraper APIs (Wikimedia Commons)
    // Search for available logos on Wikimedia
    scrapeSearch: (abbreviations: string[]) =>
      ipcRenderer.invoke('logo:scrapeSearch', abbreviations),
    // Scrape a single team logo
    scrapeSingle: (abbreviation: string, year?: number) =>
      ipcRenderer.invoke('logo:scrapeSingle', abbreviation, year),
    // Scrape all logos for a year
    scrapeForYear: (year: number, abbreviations: string[]) =>
      ipcRenderer.invoke('logo:scrapeForYear', year, abbreviations),
    // List all downloaded logos
    listDownloaded: () =>
      ipcRenderer.invoke('logo:listDownloaded'),
    // Check if scraped logo exists
    hasScrapedLogo: (abbreviation: string) =>
      ipcRenderer.invoke('logo:hasScrapedLogo', abbreviation),
    // Get path to scraped logo
    getScrapedLogoPath: (abbreviation: string) =>
      ipcRenderer.invoke('logo:getScrapedLogoPath', abbreviation),
    // Get logos base path
    getLogosBasePath: () =>
      ipcRenderer.invoke('logo:getLogosBasePath')
  }
});