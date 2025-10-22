/**
 * Franchise Editor - Full-featured franchise file editor
 * ES6 Module with Handsontable integration
 */

import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';
import {
    getFieldDefinition,
    getVisibleFields,
    validateFieldValue,
    POSITION_MAPPINGS,
    TEAM_MAPPINGS,
    LOOKUP_DATA,
    loadLookupData,
    getLookupOptions,
    getLookupValue,
    getPIDFromName,
    getPlayerNameFromPID,
    searchPIDNames
} from '../data/field-definitions.js';
import { NFL_TEAMS, getAllTeams, getTeamById } from '../data/team-data.js';

class FranchiseEditor {
    constructor() {
        this.currentFile = null;
        this.franchiseData = {
            teams: [],
            players: [],
            coaches: [],
            draftClass: [],
            seasonInfo: null,
            metadata: null
        };
        this.isRetroMode = false;
        this.lookupReady = false;

        // Handsontable instances
        this.rosterGrid = null;
        this.draftGrid = null;
        this.freeAgentsGrid = null;
        this.teamRosterGrid = null;
        this.coachesGrid = null;

        // Trade state
        this.tradeState = {
            teamA: { players: [], picks: [] },
            teamB: { players: [], picks: [] }
        };

        // Current view state
        this.currentView = 'home'; // home, team-detail
        this.currentTeamIndex = null;

        // Field mappings for grids
        this.currentFieldMapping = [];

        // Roster filtering and pagination
        this.filteredPlayers = [];
        this.paginatedPlayers = [];
        this.currentPage = 1;
        this.rowsPerPage = 100;
        this.totalPages = 1;
        this.selectedTeamId = null;
        this.selectedPosition = '';
        this.searchTerm = '';
        this.sortColumns = [];

        // Portrait cache (PLPO key -> base64 data URL)
        this.portraitCache = new Map();
    }

    async init() {
        console.log('[Franchise Editor] Initializing...');

        // Load lookup data
        try {
            await loadLookupData();
            this.lookupReady = true;
            console.log('[Franchise Editor] Lookup data loaded');
        } catch (error) {
            console.error('[Franchise Editor] Failed to load lookup data:', error);
        }

        // Check if retro mode
        const urlParams = new URLSearchParams(window.location.search);
        this.isRetroMode = urlParams.get('retro') === 'true';

        if (this.isRetroMode) {
            const retroTab = document.querySelector('.tool-tab[data-tab="retro"]');
            if (retroTab) retroTab.style.display = 'flex';
        }

        this.setupEventListeners();
        this.updateStatus('Ready - Load a franchise file to begin');
    }

    setupEventListeners() {
        // Load file
        document.getElementById('load-btn').addEventListener('click', () => this.loadFranchiseFile());

        // Save file
        document.getElementById('save-btn').addEventListener('click', () => this.saveFranchise());

        // Tab switching
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Roster filters - team filter navigates to team detail page
        const teamFilter = document.getElementById('franchiseTeamFilter');
        if (teamFilter) {
            teamFilter.addEventListener('change', (e) => {
                const teamId = e.target.value ? parseInt(e.target.value) : null;

                if (teamId !== null) {
                    // Navigate to team detail page
                    console.log('[TEAM FILTER] Navigating to team:', teamId);
                    this.viewTeam(teamId);
                } else {
                    // "All Teams" selected - stay on roster view
                    this.selectedTeamId = null;
                    this.currentPage = 1;
                    this.filterAndRenderRoster();
                }
            });
        }

        const positionFilter = document.getElementById('franchisePositionFilter');
        if (positionFilter) {
            positionFilter.addEventListener('change', (e) => {
                this.selectedPosition = e.target.value;
                this.currentPage = 1;
                this.filterAndRenderRoster();
            });
        }

        const searchInput = document.getElementById('franchiseSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase().trim();
                this.currentPage = 1;
                this.filterAndRenderRoster();
            });
        }

        // Pagination controls
        const firstPage = document.getElementById('franchiseFirstPage');
        if (firstPage) {
            firstPage.addEventListener('click', () => {
                this.currentPage = 1;
                this.filterAndRenderRoster();
            });
        }

        const prevPage = document.getElementById('franchisePrevPage');
        if (prevPage) {
            prevPage.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.filterAndRenderRoster();
                }
            });
        }

        const nextPage = document.getElementById('franchiseNextPage');
        if (nextPage) {
            nextPage.addEventListener('click', () => {
                if (this.currentPage < this.totalPages) {
                    this.currentPage++;
                    this.filterAndRenderRoster();
                }
            });
        }

        const lastPage = document.getElementById('franchiseLastPage');
        if (lastPage) {
            lastPage.addEventListener('click', () => {
                this.currentPage = this.totalPages;
                this.filterAndRenderRoster();
            });
        }
    }

    async loadFranchiseFile() {
        console.log('[Franchise Editor] Loading franchise file...');
        this.updateStatus('Selecting file...');

        try {
            // Select file
            const filePath = await window.electronAPI.franchise.selectFile();
            if (!filePath) {
                this.updateStatus('Ready - No file selected');
                return;
            }

            this.updateStatus('Loading franchise file...');
            console.log('[Franchise Editor] Selected:', filePath);

            // Load franchise metadata
            const metadataResult = await window.electronAPI.franchise.loadFile(filePath);

            if (!metadataResult.success) {
                throw new Error(metadataResult.error);
            }

            this.currentFile = filePath;
            const metadata = metadataResult.metadata;
            this.franchiseData.metadata = metadata;

            console.log('[Franchise Editor] Loaded:', metadata);

            // Update header
            const fileName = metadata.fileName || 'Franchise File';
            document.getElementById('file-name').textContent = fileName;
            document.getElementById('file-details').textContent =
                `M${metadata.gameYear} • Schema ${metadata.schemaVersion} • ${metadata.tables.length} tables`;
            document.getElementById('save-btn').disabled = false;

            // Load franchise data
            await this.loadAllFranchiseData(filePath, metadata);

            this.updateStatus(`Loaded: ${fileName}`);

        } catch (error) {
            console.error('[Franchise Editor] Error:', error);
            alert(`Error loading franchise: ${error.message}`);
            this.updateStatus('Error loading file');
        }
    }

    async loadAllFranchiseData(filePath, metadata) {
        this.updateStatus('Loading teams...');

        // Load teams
        if (metadata.tables.includes('Team')) {
            const teamResult = await window.electronAPI.franchise.getTableData(filePath, 'Team');
            if (teamResult.success) {
                this.franchiseData.teams = teamResult.records;
                console.log(`[Franchise Editor] Loaded ${teamResult.count} teams`);
                this.displayTeams();
                this.populateTradeTeamSelects();
            }
        }

        this.updateStatus('Loading players...');

        // Load players
        if (metadata.tables.includes('Player')) {
            const playerResult = await window.electronAPI.franchise.getTableData(filePath, 'Player');
            if (playerResult.success) {
                // No college conversion needed - franchise parser returns correct numeric IDs
                this.franchiseData.players = playerResult.records;
                console.log(`[Franchise Editor] Loaded ${playerResult.count} players`);

                // Populate team filter
                this.populateTeamFilter();

                // Initialize with all players
                this.filteredPlayers = [...this.franchiseData.players];
                this.currentPage = 1;

                // Calculate total pages
                this.totalPages = Math.ceil(this.filteredPlayers.length / this.rowsPerPage);

                // Update UI and render
                this.updatePaginationUI();
                this.initializeRosterGrid();
            }
        }

        // Load coaches
        if (metadata.tables.includes('Coach')) {
            const coachResult = await window.electronAPI.franchise.getTableData(filePath, 'Coach');
            if (coachResult.success) {
                this.franchiseData.coaches = coachResult.records;
                console.log(`[Franchise Editor] Loaded ${coachResult.count} coaches`);
            }
        }

        // Load draft class if exists
        if (metadata.tables.includes('DraftPick')) {
            const draftResult = await window.electronAPI.franchise.getTableData(filePath, 'DraftPick');
            if (draftResult.success) {
                this.franchiseData.draftClass = draftResult.records;
                console.log(`[Franchise Editor] Loaded ${draftResult.count} draft picks`);
                this.initializeDraftGrid();
            }
        }

        // Initialize free agents grid
        this.initializeFreeAgentsGrid();

        // Update home tab
        this.displayHome(metadata);
    }

    displayHome(metadata) {
        // Update stats
        document.getElementById('total-players').textContent = this.franchiseData.players.length;
        document.getElementById('total-teams').textContent = this.franchiseData.teams.length;
        document.getElementById('current-week').textContent = metadata.currentWeek || 0;
        document.getElementById('game-year').textContent = metadata.gameYear || '--';

        // Update stats season year
        const statsSeason = document.getElementById('stats-season');
        if (statsSeason) statsSeason.textContent = metadata.gameYear || '2025';
    }

    displayTeams() {
        const grid = document.getElementById('teams-grid');
        if (!grid) return;

        grid.innerHTML = '';

        if (!this.franchiseData.teams || this.franchiseData.teams.length === 0) {
            grid.innerHTML = '<p class="status-text">No teams loaded</p>';
            return;
        }

        // Filter out free agents (TeamIndex >= 1009 are free agents/practice squad)
        const realTeams = this.franchiseData.teams.filter(team => {
            const teamId = team.TeamIndex !== undefined ? team.TeamIndex : -1;
            return teamId >= 1 && teamId <= 32; // Only show real NFL teams (1-32), exclude Team 0 placeholder
        });

        // Show team cards with real team data
        realTeams.forEach((team, index) => {
            const teamId = team.TeamIndex !== undefined ? team.TeamIndex : index;
            const teamData = NFL_TEAMS[teamId] || {
                fullName: `Team ${teamId}`,
                abbr: 'UNK',
                primary: '#1a1a1a',
                secondary: '#e98819',
                logo: null
            };

            const wins = team.SeasonWins || team.HomeWin || 0;
            const losses = team.SeasonLosses || team.HomeLoss || 0;
            const ties = team.SeasonTies || team.HomeTie || 0;

            // Get team coaches
            const teamCoaches = this.franchiseData.coaches.filter(c => c.TeamIndex === teamId);
            const headCoach = teamCoaches.find(c => c.Position === 'Head Coach' || c.Position === 0);
            const coachName = headCoach ? `${headCoach.FirstName} ${headCoach.LastName}` : 'No HC';

            // Get team player count
            const teamPlayers = this.franchiseData.players.filter(p => p.TeamIndex === teamId);

            const card = document.createElement('div');
            card.className = 'team-card';
            card.style.background = `linear-gradient(135deg, ${teamData.primary} 0%, ${teamData.secondary} 100%)`;
            card.style.border = `2px solid ${teamData.secondary}`;

            const logoHtml = teamData.logo
                ? `<img src="${teamData.logo}" style="width: 64px; height: 64px; object-fit: contain; margin-bottom: 0.5rem;" alt="${teamData.fullName}">`
                : '<div style="font-size: 2rem; margin-bottom: 0.5rem;">🏈</div>';

            card.innerHTML = `
                ${logoHtml}
                <div style="color: var(--white); font-weight: 600; margin-bottom: 0.5rem; font-size: 1rem;">
                    ${teamData.fullName}
                </div>
                <div style="color: rgba(255,255,255,0.9); font-size: 0.875rem; margin-bottom: 0.25rem;">
                    ${wins}-${losses}${ties > 0 ? '-' + ties : ''}
                </div>
                <div style="color: rgba(255,255,255,0.8); font-size: 0.75rem; margin-bottom: 0.25rem;">
                    HC: ${coachName}
                </div>
                <div style="color: rgba(255,255,255,0.7); font-size: 0.75rem;">
                    ${teamPlayers.length} Players • ${teamCoaches.length} Coaches
                </div>
            `;

            card.addEventListener('click', () => this.viewTeam(index));

            grid.appendChild(card);
        });

        console.log(`[Franchise Editor] Displayed ${realTeams.length} teams`);
    }

    initializeRosterGrid() {
        const container = document.getElementById('franchiseRosterGrid');
        if (!container) {
            console.error('[Franchise Editor] Grid container not found');
            return;
        }

        if (!this.franchiseData.players || this.franchiseData.players.length === 0) {
            console.error('[Franchise Editor] No player data found');
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <h3 class="empty-title">No players loaded</h3>
                    <p class="empty-description">Load a franchise file to view players</p>
                </div>
            `;
            return;
        }

        // Destroy existing grid if present
        if (this.rosterGrid) {
            this.rosterGrid.destroy();
            this.rosterGrid = null;
        }

        // Clear container and create Handsontable element with fixed height
        container.innerHTML = '<div id="franchise-handsontable-container" style="height: 750px; width: 100%; background: var(--gray-dark);"></div>';
        const hotContainer = document.getElementById('franchise-handsontable-container');

        // Paginate filtered players
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = Math.min(startIndex + this.rowsPerPage, this.filteredPlayers.length);
        const paginatedPlayers = this.filteredPlayers.slice(startIndex, endIndex);

        console.log(`[Franchise Editor] Displaying ${paginatedPlayers.length} players (page ${this.currentPage} of ${this.totalPages})`);

        // Get visible fields
        const visibleFields = getVisibleFields(false);

        // Extract field codes and display names
        const fieldCodes = visibleFields.map(field => Array.isArray(field) ? field[0] : field);
        const displayNames = visibleFields.map(field => {
            const fieldName = Array.isArray(field) ? field[0] : field;
            const fieldDef = getFieldDefinition(fieldName);
            return fieldDef.shortDisplay || fieldDef.display;
        });

        // Store field mapping for data changes (add empty for portrait column)
        this.currentFieldMapping = ['', ...fieldCodes];

        console.log('[Franchise Editor] Using', fieldCodes.length, 'visible fields');

        // Pre-load portraits for current page
        this.preloadPortraits(paginatedPlayers);

        // Create mapping from our field codes to franchise field names
        const FIELD_MAPPING = {
            // Personal Info
            'PFNA': 'FirstName',
            'PLNA': 'LastName',
            'PPOS': 'Position',
            'PAGE': 'Age',
            'PJEN': 'JerseyNum',
            'TGID': 'TeamIndex',
            'PCOL': 'College',
            'PHTN': 'PLYR_HOME_TOWN',
            'PHSN': 'PLYR_HOME_STATE',
            'PSXP': 'PresentationId',
            'PLAYERPIC': 'PLYR_ASSETNAME',
            'PEPS': 'PLYR_PORTRAIT',

            // Overall & Dev
            'POVR': 'OverallRating',
            'PYRP': 'YearsPro',

            // Ratings - all end in "Rating" in franchise files
            'PACC': 'AccelerationRating',
            'PAGI': 'AgilityRating',
            'PAWR': 'AwarenessRating',
            'PBKT': 'BreakTackleRating',
            'PBCV': 'BCVisionRating',
            'PBSG': 'BlockSheddingRating',
            'PBSK': 'BreakSackRating',
            'PCAR': 'CarryingRating',
            'PCIT': 'CatchInTrafficRating',
            'PCTH': 'CatchingRating',
            'PDRR': 'DeepRouteRunningRating',
            'PCOD': 'ChangeOfDirectionRating',
            'PFMV': 'FinesseMovesRating',
            'PPOW': 'HitPowerRating',
            'PIBL': 'ImpactBlockingRating',
            'PINJ': 'InjuryRating',
            'PJKM': 'JukeMoveRating',
            'PJMP': 'JumpingRating',
            'PKAC': 'KickAccuracyRating',
            'PKPW': 'KickPowerRating',
            'PKR': 'KickReturnRating',
            'PLS': 'LongSnapRating',
            'PLBK': 'LeadBlockRating',
            'PMCV': 'ManCoverageRating',
            'PMRR': 'MediumRouteRunningRating',
            'PPBK': 'PassBlockRating',
            'PPBF': 'PassBlockFinesseRating',
            'PPBS': 'PassBlockPowerRating',
            'PPAC': 'PlayActionRating',
            'PPMV': 'PowerMovesRating',
            'PPRS': 'PressRating',
            'PPUR': 'PursuitRating',
            'PPRC': 'PlayRecognitionRating',
            'PRLS': 'ReleaseRating',
            'PRBK': 'RunBlockRating',
            'PRBF': 'RunBlockFinesseRating',
            'PRBS': 'RunBlockPowerRating',
            'PSRR': 'ShortRouteRunningRating',
            'PSPC': 'SpectacularCatchRating',
            'PSPD': 'SpeedRating',
            'PSPM': 'SpinMoveRating',
            'PSTA': 'StaminaRating',
            'PSFA': 'StiffArmRating',
            'PSTR': 'StrengthRating',
            'PTAK': 'TackleRating',
            'PTAD': 'ThrowAccuracyDeepRating',
            'PTAM': 'ThrowAccuracyMidRating',
            'PTAS': 'ThrowAccuracyShortRating',
            'PTOR': 'ThrowOnTheRunRating',
            'PTHP': 'ThrowPowerRating',
            'PTUP': 'ThrowUnderPressureRating',
            'PTGH': 'ToughnessRating',
            'PTRK': 'TruckingRating',
            'PZCV': 'ZoneCoverageRating',

            // Additional mappings for franchise-specific codes
            'PHGT': 'Height',
            'PWGT': 'Weight',
            'TOTAL_SALARY': 'TotalSalary',

            // Legacy/alternate rating codes (PL prefix instead of P)
            'PLCI': 'CatchInTrafficRating',
            'PELU': 'InjuryRating',
            'PFMS': 'FinesseMovesRating',
            'PLHT': 'CatchingRating',
            'PLIB': 'ImpactBlockingRating',
            'PLJM': 'JumpingRating',
            'PKPR': 'KickPowerRating',
            'PKRT': 'KickReturnRating',
            'PLMC': 'ManCoverageRating',
            'PPLA': 'PlayActionRating',
            'PLPM': 'PowerMovesRating',
            'PLPE': 'PressRating',
            'PLPU': 'PursuitRating',
            'PLPR': 'PlayRecognitionRating',
            'PLRL': 'ReleaseRating',
            'SRRN': 'ShortRouteRunningRating',
            'PLSC': 'SpectacularCatchRating',
            'PLSM': 'SpinMoveRating',
            'PLSA': 'StiffArmRating',
            'PLTR': 'TruckingRating',
            'PLZC': 'ZoneCoverageRating',
            'PCON': 'ConfidenceRating',
            'PCYL': 'YearsPro',
            'PSBO': 'SigningBonus'
        };

        // Debug: Log first player object to see actual field names
        if (paginatedPlayers.length > 0 && window.electronAPI?.debug?.sessionLog) {
            const firstPlayer = paginatedPlayers[0];
            const keys = Object.keys(firstPlayer);
            window.electronAPI.debug.sessionLog(`[DEBUG] First player has ${keys.length} fields`);

            // Check for all rating fields
            const ratingFields = keys.filter(k => k.includes('Rating'));
            window.electronAPI.debug.sessionLog(`[DEBUG] Found ${ratingFields.length} rating fields: ${ratingFields.slice(0, 20).join(', ')}...`);

            // Log the first 20 field codes we're trying to display
            window.electronAPI.debug.sessionLog(`[DEBUG] First 20 field codes: ${fieldCodes.slice(0, 20).join(', ')}`);

            // Check specific blank fields
            window.electronAPI.debug.sessionLog(`[DEBUG] ChangeOfDirectionRating: ${firstPlayer.ChangeOfDirectionRating}`);
            window.electronAPI.debug.sessionLog(`[DEBUG] FinesseMovesRating: ${firstPlayer.FinesseMovesRating}`);
            window.electronAPI.debug.sessionLog(`[DEBUG] HitPowerRating: ${firstPlayer.HitPowerRating}`);
            window.electronAPI.debug.sessionLog(`[DEBUG] College: ${firstPlayer.College}`);

            // Check ALL field codes for missing mappings
            const unmappedCodes = [];
            const mappedCodes = [];
            fieldCodes.forEach(code => {
                const mappedName = FIELD_MAPPING[code];
                if (!mappedName) {
                    unmappedCodes.push(code);
                } else {
                    const value = firstPlayer[mappedName];
                    if (value !== undefined && value !== null && value !== '') {
                        mappedCodes.push(`${code}->${mappedName}=${value}`);
                    }
                }
            });
            window.electronAPI.debug.sessionLog(`[DEBUG] Found ${unmappedCodes.length} unmapped field codes: ${unmappedCodes.slice(0, 30).join(', ')}${unmappedCodes.length > 30 ? '...' : ''}`);
            window.electronAPI.debug.sessionLog(`[DEBUG] Found ${mappedCodes.length} mapped field codes with values`);
            window.electronAPI.debug.sessionLog(`[DEBUG] Sample mapped codes: ${mappedCodes.slice(0, 10).join(', ')}`);
        }

        // Map franchise player data to match field codes
        // Add portrait column as first column (empty string, renderer will handle it)
        const data = paginatedPlayers.map((player, playerIndex) => {
            const rowData = fieldCodes.map((fieldCode, fieldIndex) => {
                // Use mapping if available
                const franchiseFieldName = FIELD_MAPPING[fieldCode];
                if (franchiseFieldName && player[franchiseFieldName] !== undefined) {
                    return player[franchiseFieldName];
                }

                // Direct match
                if (player[fieldCode] !== undefined) {
                    return player[fieldCode];
                }

                // Debug first player
                if (playerIndex === 0 && fieldIndex < 10 && window.electronAPI?.debug?.sessionLog) {
                    window.electronAPI.debug.sessionLog(`[DEBUG] Field ${fieldCode}: franchiseFieldName=${franchiseFieldName}, value=${player[franchiseFieldName]}, direct=${player[fieldCode]}`);
                }

                // No match found
                return null;
            });

            // Add portrait column as first element
            return ['', ...rowData];
        });

        console.log('[Franchise Editor] Mapped data rows:', data.length);
        console.log('[Franchise Editor] First row has', data[0]?.length, 'columns (including portrait)');
        console.log('[DEBUG] First row sample:', data[0]?.slice(0, 10));

        // Custom renderer for team names
        const teamRenderer = (instance, td, row, col, prop, value, cellProperties) => {
            td.innerHTML = '';
            if (value !== null && value !== undefined) {
                const team = getTeamById(value);
                if (team) {
                    td.textContent = team.fullName;
                } else {
                    td.textContent = value;
                }
            }
            td.style.textAlign = 'left';
            td.style.padding = '4px 8px';
            return td;
        };

        // Custom renderer for college (display college name from ID)
        const collegeRenderer = (instance, td, row, col, prop, value, cellProperties) => {
            Handsontable.renderers.TextRenderer(instance, td, row, col, prop, value, cellProperties);

            if (value !== null && value !== undefined && typeof value === 'number') {
                const collegeName = getLookupValue('colleges', value);
                td.textContent = collegeName || `College ${value}`;
            }
            return td;
        };

        // Build columns - portrait first, then field columns
        const portraitColumn = {
            data: 0,
            readOnly: true,
            width: 80,
            renderer: this.portraitRenderer.bind(this)
        };

        const fieldColumns = fieldCodes.map((fieldName, index) => {
            const fieldDef = getFieldDefinition(fieldName);
            let columnConfig = {
                data: index + 1, // +1 because portrait is column 0
                readOnly: !fieldDef.editable,
                allowInvalid: false
            };

            // Special handling for specific fields
            if (fieldName === 'TGID') {
                // Team field - use custom renderer
                columnConfig = {
                    ...columnConfig,
                    type: 'dropdown',
                    source: getAllTeams().map(t => t.fullName),
                    allowInvalid: false,
                    renderer: teamRenderer
                };
            } else if (fieldName === 'PCOL') {
                // College field - use custom renderer
                const options = getLookupOptions('colleges');
                columnConfig = {
                    ...columnConfig,
                    type: 'dropdown',
                    source: options.map(opt => opt.label),
                    allowInvalid: false,
                    renderer: collegeRenderer
                };
            } else if (fieldName === 'PLAYERPIC') {
                columnConfig = {
                    ...columnConfig,
                    type: 'autocomplete',
                    source: (query, process) => {
                        const results = searchPIDNames(query, 20);
                        process(results.map(r => r.name));
                    },
                    strict: false,
                    allowInvalid: true,
                    readOnly: false
                };
            } else if (fieldName === 'POVR') {
                columnConfig = {
                    ...columnConfig,
                    type: 'numeric',
                    format: '0',
                    width: 70,
                    readOnly: true
                };
            } else if (fieldDef.type === 'lookup' && fieldDef.lookup) {
                const options = getLookupOptions(fieldDef.lookup);
                columnConfig = {
                    ...columnConfig,
                    type: 'dropdown',
                    source: options.map(opt => opt.label),
                    allowInvalid: false
                };
            } else if (fieldDef.type === 'numeric') {
                columnConfig = {
                    ...columnConfig,
                    type: 'numeric',
                    format: '0'
                };
                if (fieldDef.width !== undefined) {
                    columnConfig.width = fieldDef.width;
                }
            } else {
                columnConfig = {
                    ...columnConfig,
                    type: 'text'
                };
            }

            return columnConfig;
        });

        // Combine portrait column with field columns
        const columns = [portraitColumn, ...fieldColumns];

        // Create custom column headers with tooltips and sort indicators
        // Source: Roster editor (HANDSONTABLE_CONFIG_GUIDE.md:209-230)
        const colHeaders = (colIndex) => {
            // Portrait column (index 0)
            if (colIndex === 0) {
                return '<span title="Player Portrait">📷</span>';
            }

            // Adjust index for field columns (subtract 1 to account for portrait column)
            const fieldIndex = colIndex - 1;
            const fieldCode = fieldCodes[fieldIndex];
            const fieldDef = getFieldDefinition(fieldCode);
            const displayName = displayNames[fieldIndex];

            // Check if this column is currently sorted
            const sortInfo = this.sortColumns.find(s => s.column === fieldCode);
            const sortIndicator = sortInfo ? (sortInfo.order === 'asc' ? ' ▲' : ' ▼') : '';

            // Return HTML with title attribute for tooltip and sortable class
            // Use fieldCode (e.g., PCOL) for sorting, not mapped name (e.g., College)
            return `<span class="sortable-header" data-field="${fieldCode}" title="${fieldDef.display}">${displayName}${sortIndicator}</span>`;
        };

        console.log('[Franchise Editor] Creating Handsontable with', columns.length, 'columns (including portrait)');

        if (window.electronAPI?.debug?.sessionLog) {
            window.electronAPI.debug.sessionLog(`[DEBUG] Creating grid with ${data.length} rows and ${columns.length} columns`);
            window.electronAPI.debug.sessionLog(`[DEBUG] Paginated players: ${paginatedPlayers.length}, Current page: ${this.currentPage}, Total pages: ${this.totalPages}`);
        }

        this.rosterGrid = new Handsontable(hotContainer, {
            data: data,
            columns: columns,
            colHeaders: colHeaders,
            rowHeaders: true,
            width: '100%',
            height: 700,
            licenseKey: 'non-commercial-and-evaluation',

            // Styling to match main editor
            className: 'madden-grid',

            // Grid behavior
            stretchH: 'none',
            autoColumnSize: {
                useHeaders: true,
                samplingRatio: 30,
                allowSampleDuplicates: true
            },
            manualColumnResize: true,
            manualRowResize: false,
            rowHeights: 70, // Accommodate 64px portraits

            // Freeze portrait and name columns
            fixedColumnsStart: 3, // Portrait, First Name, Last Name
            preventOverflow: 'horizontal',

            // Selection
            selectionMode: 'multiple',
            outsideClickDeselects: false,

            // Scrolling
            scrollH: true,
            scrollV: true,

            // Scrolling optimization
            renderAllRows: true, // Force render all 100 rows - no virtualization needed
            viewportRowRenderingOffset: 100,

            // Features
            columnSorting: false, // We'll implement custom sorting
            multiColumnSorting: false,
            contextMenu: {
                items: {
                    'copy': {},
                    'cut': {},
                    'paste': {},
                    'separator1': '---------',
                    'undo': {},
                    'redo': {},
                    'make_read_only': {},
                    'alignment': {}
                }
            },

            // Callbacks
            afterChange: (changes, source) => {
                // Source: Ported from roster editor (src/renderer/js/app.js:1227-1259)
                if (source !== 'loadData' && changes) {
                    console.log('[Franchise Roster] Data changed:', changes);

                    // Re-render portrait when PID (PSXP/PresentationId) changes
                    changes.forEach(([row, col, oldValue, newValue]) => {
                        const fieldCode = this.currentFieldMapping[col]; // currentFieldMapping includes portrait at index 0
                        if (fieldCode === 'PSXP' && newValue !== oldValue) {
                            console.log(`[Portrait Update] PID changed to ${newValue} on row ${row}`);

                            // Fetch portrait for new PID
                            const plpoKey = this.getPlpoFromPID(parseInt(newValue));
                            if (plpoKey && !this.portraitCache.has(plpoKey)) {
                                console.log(`[Franchise] Fetching portrait for new PID ${newValue} (PLPO: ${plpoKey})`);
                                this.portraitCache.set(plpoKey, 'loading');

                                window.electronAPI.portrait.getByPLPO(plpoKey).then(imageData => {
                                    console.log(`[Franchise] Portrait fetched for ${plpoKey}`);
                                    this.portraitCache.set(plpoKey, imageData);
                                    // Re-render to show the new portrait
                                    if (this.rosterGrid && !this.rosterGrid.isDestroyed) {
                                        this.rosterGrid.render();
                                    }
                                }).catch((error) => {
                                    console.error(`[Franchise] Failed to fetch portrait for ${plpoKey}:`, error);
                                    this.portraitCache.set(plpoKey, null);
                                    if (this.rosterGrid && !this.rosterGrid.isDestroyed) {
                                        this.rosterGrid.render();
                                    }
                                });
                            } else {
                                // Portrait already in cache or no PLPO found, just re-render
                                console.log(`[Portrait Update] Portrait already cached or no PLPO, re-rendering`);
                                if (this.rosterGrid && !this.rosterGrid.isDestroyed) {
                                    this.rosterGrid.render();
                                }
                            }
                        }
                    });
                }
            },

            // Custom cell styling to match roster editor
            cells: (row, col) => {
                // Column 0 is portrait - use portrait renderer
                if (col === 0) {
                    return {
                        renderer: this.portraitRenderer.bind(this),
                        className: 'readonly-cell'
                    };
                }

                const fieldName = this.currentFieldMapping[col];
                const fieldDef = getFieldDefinition(fieldName);

                // Add dropdown-cell class for lookup fields
                let cellClass = fieldDef.editable ? 'editable-cell' : 'readonly-cell';
                if (fieldDef.type === 'lookup' && fieldDef.lookup) {
                    cellClass += ' dropdown-cell';
                }

                // Use special renderers for specific fields
                if (fieldName === 'PCOL') {
                    return {
                        renderer: collegeRenderer,
                        className: cellClass
                    };
                }

                if (fieldName === 'TGID') {
                    return {
                        renderer: teamRenderer,
                        className: cellClass
                    };
                }

                return {
                    renderer: this.customCellRenderer.bind(this),
                    className: cellClass
                };
            }
        });

        // Show pagination controls
        const paginationControls = document.getElementById('franchisePaginationControls');
        if (paginationControls) {
            paginationControls.style.display = 'block';
        }

        console.log('[Franchise Editor] Roster grid initialized successfully with', paginatedPlayers.length, 'players');

        // Setup click handlers for column sorting
        this.setupHeaderClickHandlers();
    }

    initializeDraftGrid() {
        const container = document.getElementById('draft-panel');
        if (!container) return;

        const panelContent = container.querySelector('.panel-content');
        if (!panelContent) return;

        // Check if draft class is empty or not loaded
        if (!this.franchiseData.draftClass || this.franchiseData.draftClass.length === 0) {
            panelContent.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 4rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🎓</div>
                    <h3 style="color: var(--white); margin-bottom: 1rem; font-size: 1.5rem;">No Draft Class Loaded</h3>
                    <p style="color: var(--gray-text-secondary); font-size: 1.125rem; max-width: 500px; margin: 0 auto;">
                        Load a draft class in-game first, then re-open this franchise file to edit the draft prospects.
                    </p>
                    <div style="margin-top: 2rem; padding: 1rem; background: var(--gray-dark); border-radius: 8px; max-width: 600px; margin-left: auto; margin-right: auto;">
                        <p style="color: var(--gray-text-secondary); font-size: 0.875rem; margin: 0;">
                            💡 <strong style="color: var(--white);">Tip:</strong> Enter Franchise mode, go to the Draft menu, and generate/import a draft class. Save your franchise, then reload it here.
                        </p>
                    </div>
                </div>
            `;
            console.log('[Franchise Editor] No draft class data available');
            return;
        }

        // Clear and set up container with exact same styling as main editor
        panelContent.innerHTML = `
            <div id="draftGrid" style="height: calc(100vh - 200px); background: var(--gray-dark); padding: 1rem;">
                <div id="draft-handsontable-container" style="height: 100%; background: var(--gray-dark);"></div>
            </div>
        `;

        const hotContainer = document.getElementById('draft-handsontable-container');

        // Use EXACT same approach as main roster editor (app.js line 822-833)
        const visibleFields = getVisibleFields(false);

        // Extract field codes and display names
        const fieldCodes = visibleFields.map(field => Array.isArray(field) ? field[0] : field);
        const displayNames = visibleFields.map(field => {
            const fieldName = Array.isArray(field) ? field[0] : field;
            const fieldDef = getFieldDefinition(fieldName);
            return fieldDef.shortDisplay || fieldDef.display;
        });

        console.log('[Franchise Editor] Using', fieldCodes.length, 'visible fields for draft');

        // Create mapping from our field codes to franchise field names (same as roster)
        const FIELD_MAPPING = {
            'PFNA': 'FirstName', 'PLNA': 'LastName', 'PPOS': 'Position', 'PAGE': 'Age',
            'PJEN': 'JerseyNum', 'TGID': 'TeamIndex', 'PCOL': 'College',
            'PHTN': 'PLYR_HOME_TOWN', 'PHSN': 'PLYR_HOME_STATE',
            'PSXP': 'PresentationId', 'PLAYERPIC': 'PLYR_ASSETNAME', 'PEPS': 'PLYR_PORTRAIT',
            'POVR': 'OverallRating', 'PYRP': 'YearsPro',
            'PACC': 'AccelerationRating', 'PAGI': 'AgilityRating', 'PAWR': 'AwarenessRating',
            'PBKT': 'BreakTackleRating', 'PBCV': 'BCVisionRating', 'PBSG': 'BlockSheddingRating',
            'PBSK': 'BreakSackRating', 'PCAR': 'CarryingRating', 'PCIT': 'CatchInTrafficRating',
            'PCTH': 'CatchingRating', 'PDRR': 'DeepRouteRunningRating', 'PCOD': 'ChangeOfDirectionRating',
            'PFMV': 'FinesseMovesRating', 'PPOW': 'HitPowerRating', 'PIBL': 'ImpactBlockingRating',
            'PINJ': 'InjuryRating', 'PJKM': 'JukeMoveRating', 'PJMP': 'JumpingRating',
            'PKAC': 'KickAccuracyRating', 'PKPW': 'KickPowerRating', 'PKR': 'KickReturnRating',
            'PLS': 'LongSnapRating', 'PLBK': 'LeadBlockRating', 'PMCV': 'ManCoverageRating',
            'PMRR': 'MediumRouteRunningRating', 'PPBK': 'PassBlockRating',
            'PPBF': 'PassBlockFinesseRating', 'PPBS': 'PassBlockPowerRating',
            'PPAC': 'PlayActionRating', 'PPMV': 'PowerMovesRating', 'PPRS': 'PressRating',
            'PPUR': 'PursuitRating', 'PPRC': 'PlayRecognitionRating', 'PRLS': 'ReleaseRating',
            'PRBK': 'RunBlockRating', 'PRBF': 'RunBlockFinesseRating', 'PRBS': 'RunBlockPowerRating',
            'PSRR': 'ShortRouteRunningRating', 'PSPC': 'SpectacularCatchRating',
            'PSPD': 'SpeedRating', 'PSPM': 'SpinMoveRating', 'PSTA': 'StaminaRating',
            'PSFA': 'StiffArmRating', 'PSTR': 'StrengthRating', 'PTAK': 'TackleRating',
            'PTAD': 'ThrowAccuracyDeepRating', 'PTAM': 'ThrowAccuracyMidRating',
            'PTAS': 'ThrowAccuracyShortRating', 'PTOR': 'ThrowOnTheRunRating',
            'PTHP': 'ThrowPowerRating', 'PTUP': 'ThrowUnderPressureRating',
            'PTGH': 'ToughnessRating', 'PTRK': 'TruckingRating', 'PZCV': 'ZoneCoverageRating'
        };

        // Map franchise draft data to match field codes
        const data = this.franchiseData.draftClass.map(prospect => {
            return fieldCodes.map(fieldCode => {
                // Use mapping if available
                const franchiseFieldName = FIELD_MAPPING[fieldCode];
                if (franchiseFieldName && prospect[franchiseFieldName] !== undefined) {
                    return prospect[franchiseFieldName];
                }

                // Direct match
                if (prospect[fieldCode] !== undefined) {
                    return prospect[fieldCode];
                }

                // No match found
                return null;
            });
        });

        // Custom renderers (same as roster)
        const teamRenderer = (instance, td, row, col, prop, value, cellProperties) => {
            td.innerHTML = '';
            if (value !== null && value !== undefined) {
                const team = getTeamById(value);
                if (team) {
                    td.textContent = team.fullName;
                } else {
                    td.textContent = value;
                }
            }
            td.style.textAlign = 'left';
            td.style.padding = '4px 8px';
            return td;
        };

        const collegeRenderer = (instance, td, row, col, prop, value, cellProperties) => {
            td.innerHTML = '';
            if (value !== null && value !== undefined) {
                const collegeOptions = getLookupOptions('colleges');
                const matchingCollege = collegeOptions.find(c => c.value === value);
                if (matchingCollege) {
                    td.textContent = matchingCollege.label;
                } else {
                    td.textContent = 'Unknown';
                }
            }
            td.style.textAlign = 'left';
            td.style.padding = '4px 8px';
            return td;
        };

        // Build columns exactly like app.js
        const columns = fieldCodes.map((fieldName, index) => {
            const fieldDef = getFieldDefinition(fieldName);
            let columnConfig = {
                data: index,
                readOnly: !fieldDef.editable,
                allowInvalid: false
            };

            // Special handling for specific fields
            if (fieldName === 'TGID') {
                columnConfig = {
                    ...columnConfig,
                    type: 'dropdown',
                    source: getAllTeams().map(t => t.fullName),
                    allowInvalid: false,
                    renderer: teamRenderer
                };
            } else if (fieldName === 'PCOL') {
                const options = getLookupOptions('colleges');
                columnConfig = {
                    ...columnConfig,
                    type: 'dropdown',
                    source: options.map(opt => opt.label),
                    allowInvalid: false,
                    renderer: collegeRenderer
                };
            } else if (fieldName === 'PLAYERPIC') {
                columnConfig = {
                    ...columnConfig,
                    type: 'autocomplete',
                    source: (query, process) => {
                        const results = searchPIDNames(query, 20);
                        process(results.map(r => r.name));
                    },
                    strict: false,
                    allowInvalid: true,
                    readOnly: false
                };
            } else if (fieldName === 'POVR') {
                columnConfig = {
                    ...columnConfig,
                    type: 'numeric',
                    format: '0',
                    width: 70,
                    readOnly: true
                };
            } else if (fieldDef.type === 'lookup' && fieldDef.lookup) {
                const options = getLookupOptions(fieldDef.lookup);
                columnConfig = {
                    ...columnConfig,
                    type: 'dropdown',
                    source: options.map(opt => opt.label),
                    allowInvalid: false
                };
            } else if (fieldDef.type === 'numeric') {
                columnConfig = {
                    ...columnConfig,
                    type: 'numeric',
                    format: '0'
                };
                if (fieldDef.width !== undefined) {
                    columnConfig.width = fieldDef.width;
                }
            } else {
                columnConfig = {
                    ...columnConfig,
                    type: 'text'
                };
            }

            return columnConfig;
        });

        console.log('[Franchise Editor] Creating Draft Handsontable with', columns.length, 'columns');

        this.draftGrid = new Handsontable(hotContainer, {
            data: data,
            columns: columns,
            colHeaders: displayNames,
            rowHeaders: true,
            width: '100%',
            height: '100%',
            licenseKey: 'non-commercial-and-evaluation',

            // Styling to match main editor
            className: 'madden-grid',

            // Grid behavior
            stretchH: 'none',
            autoColumnSize: {
                useHeaders: true,
                samplingRatio: 30
            },
            manualColumnResize: true,
            manualRowResize: false,

            // Selection
            selectionMode: 'multiple',
            outsideClickDeselects: false,

            // Features
            filters: true,
            dropdownMenu: true,
            contextMenu: {
                items: {
                    'copy': {},
                    'cut': {},
                    'paste': {},
                    'separator1': '---------',
                    'undo': {},
                    'redo': {}
                }
            },
            columnSorting: true,

            // Callbacks
            afterChange: (changes, source) => {
                if (source === 'edit' && changes) {
                    console.log('[Franchise Draft] Data changed:', changes);
                }
            }
        });

        console.log('[Franchise Editor] Draft grid initialized successfully');
    }

    initializeFreeAgentsGrid() {
        const container = document.getElementById('free-agency-panel');
        if (!container) return;

        // Filter free agents (TeamIndex >= 1009)
        const freeAgents = this.franchiseData.players.filter(player => {
            const teamId = player.TeamIndex !== undefined ? player.TeamIndex : -1;
            return teamId >= 1009; // Free agents, practice squad, etc.
        });

        console.log(`[Franchise Editor] Found ${freeAgents.length} free agents`);

        // Clear "Coming Soon" message and create grid container
        const panelContent = container.querySelector('.panel-content');
        if (!panelContent) return;

        panelContent.innerHTML = `
            <div class="content-section">
                <h2 class="section-title">
                    <span class="section-icon">💼</span>
                    Free Agency - Available Players (${freeAgents.length})
                </h2>
                <div style="margin-bottom: 1rem;">
                    <input type="text" id="fa-search" placeholder="Search free agents..."
                           style="padding: 0.5rem; background: var(--gray-dark); border: 1px solid var(--border-color); border-radius: 4px; color: var(--white); width: 300px; margin-right: 1rem;">
                    <select id="fa-position-filter" style="padding: 0.5rem; background: var(--gray-dark); border: 1px solid var(--border-color); border-radius: 4px; color: var(--white);">
                        <option value="">All Positions</option>
                        <option value="QB">QB</option>
                        <option value="HB">HB</option>
                        <option value="FB">FB</option>
                        <option value="WR">WR</option>
                        <option value="TE">TE</option>
                        <option value="LT">LT</option>
                        <option value="LG">LG</option>
                        <option value="C">C</option>
                        <option value="RG">RG</option>
                        <option value="RT">RT</option>
                        <option value="LE">LE</option>
                        <option value="RE">RE</option>
                        <option value="DT">DT</option>
                        <option value="LOLB">LOLB</option>
                        <option value="MLB">MLB</option>
                        <option value="ROLB">ROLB</option>
                        <option value="CB">CB</option>
                        <option value="FS">FS</option>
                        <option value="SS">SS</option>
                        <option value="K">K</option>
                        <option value="P">P</option>
                    </select>
                </div>
                <div id="fa-grid-container" style="height: calc(100vh - 300px); overflow: auto;"></div>
            </div>
        `;

        // Create Handsontable
        const gridContainer = document.getElementById('fa-grid-container');

        const columns = [
            { data: 'FirstName', title: 'First Name', width: 100 },
            { data: 'LastName', title: 'Last Name', width: 100 },
            { data: 'Position', title: 'Pos', width: 60 },
            { data: 'JerseyNum', title: '#', width: 50, type: 'numeric' },
            { data: 'Overall', title: 'OVR', width: 60, type: 'numeric' },
            { data: 'Age', title: 'Age', width: 50, type: 'numeric' },
            { data: 'Speed', title: 'SPD', width: 60, type: 'numeric' },
            { data: 'Strength', title: 'STR', width: 60, type: 'numeric' },
            { data: 'Awareness', title: 'AWR', width: 60, type: 'numeric' },
            { data: 'Agility', title: 'AGI', width: 60, type: 'numeric' },
            { data: 'Acceleration', title: 'ACC', width: 60, type: 'numeric' }
        ];

        this.freeAgentsGrid = new Handsontable(gridContainer, {
            data: freeAgents,
            columns: columns,
            colHeaders: columns.map(col => col.title),
            rowHeaders: true,
            width: '100%',
            height: '100%',
            licenseKey: 'non-commercial-and-evaluation',
            stretchH: 'none',
            autoColumnSize: true,
            manualColumnResize: true,
            filters: true,
            dropdownMenu: true,
            contextMenu: true,
            afterChange: (changes, source) => {
                if (source === 'edit' && changes) {
                    console.log('[Free Agents Grid] Player data changed:', changes);
                    // Mark file as modified
                }
            }
        });

        console.log('[Franchise Editor] Free agents grid initialized');
    }

    viewTeam(teamIndex) {
        console.log('[Franchise Editor] Viewing team:', teamIndex);
        this.currentTeamIndex = teamIndex;
        this.currentView = 'team-detail';

        // Show team detail view
        this.renderTeamDetailPage(teamIndex);
    }

    renderTeamDetailPage(teamIndex) {
        const team = this.franchiseData.teams[teamIndex];
        const teamId = team.TeamIndex !== undefined ? team.TeamIndex : teamIndex;

        // Get team data from NFL_TEAMS
        const teamData = NFL_TEAMS[teamId] || { fullName: `Team ${teamId}`, abbr: 'UNK' };

        // Get team players
        const teamPlayers = this.franchiseData.players.filter(p => p.TeamIndex === teamId);
        const teamCoaches = this.franchiseData.coaches.filter(c => c.TeamIndex === teamId);

        // Create team detail view (replacing teams panel content temporarily)
        const teamsPanel = document.getElementById('teams-panel');
        if (!teamsPanel) return;

        const panelContent = teamsPanel.querySelector('.panel-content');
        if (!panelContent) return;

        panelContent.innerHTML = `
            <div class="content-section">
                <!-- Team Header with Branding -->
                <div style="background: linear-gradient(135deg, ${teamData.primary} 0%, ${teamData.secondary} 100%); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; border: 2px solid ${teamData.secondary};">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            ${teamData.logo ? `<img src="${teamData.logo}" style="width: 64px; height: 64px; object-fit: contain;" alt="${teamData.fullName}">` : ''}
                            <div>
                                <h2 style="color: var(--white); margin: 0; font-size: 1.5rem; font-weight: 600;">${teamData.fullName}</h2>
                                <div style="color: rgba(255,255,255,0.9); font-size: 1rem; margin-top: 0.25rem;">${teamData.abbr} • ${team.SeasonWins || 0}-${team.SeasonLosses || 0}${(team.SeasonTies || 0) > 0 ? '-' + team.SeasonTies : ''}</div>
                            </div>
                        </div>
                        <button class="btn" onclick="franchiseEditor.backToTeamsList()">
                            ← Back to Teams
                        </button>
                    </div>
                </div>

                <!-- Team Stats -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: var(--gray-dark); padding: 1rem; border-radius: 8px; text-align: center; border-left: 3px solid ${teamData.primary};">
                        <div style="font-size: 1.5rem; color: ${teamData.primary};">${team.SeasonWins || 0}</div>
                        <div style="color: var(--gray-text-secondary); font-size: 0.875rem;">Wins</div>
                    </div>
                    <div style="background: var(--gray-dark); padding: 1rem; border-radius: 8px; text-align: center; border-left: 3px solid ${teamData.secondary};">
                        <div style="font-size: 1.5rem; color: ${teamData.secondary};">${team.SeasonLosses || 0}</div>
                        <div style="color: var(--gray-text-secondary); font-size: 0.875rem;">Losses</div>
                    </div>
                    <div style="background: var(--gray-dark); padding: 1rem; border-radius: 8px; text-align: center; border-left: 3px solid ${teamData.primary};">
                        <div style="font-size: 1.5rem; color: ${teamData.primary};">${teamPlayers.length}</div>
                        <div style="color: var(--gray-text-secondary); font-size: 0.875rem;">Players</div>
                    </div>
                    <div style="background: var(--gray-dark); padding: 1rem; border-radius: 8px; text-align: center; border-left: 3px solid ${teamData.secondary};">
                        <div style="font-size: 1.5rem; color: ${teamData.secondary};">${teamCoaches.length}</div>
                        <div style="color: var(--gray-text-secondary); font-size: 0.875rem;">Coaches</div>
                    </div>
                </div>

                <h3 style="color: var(--white); margin: 1.5rem 0 1rem; font-size: 1.125rem;">Team Roster</h3>
                <div id="team-roster-grid" style="height: 400px; overflow: auto;"></div>

                <h3 style="color: var(--white); margin: 1.5rem 0 1rem; font-size: 1.125rem;">Coaching Staff</h3>
                <div id="team-coaches-grid" style="height: 200px; overflow: auto;"></div>
            </div>
        `;

        // Initialize team roster grid
        const rosterContainer = document.getElementById('team-roster-grid');
        const columns = [
            { data: 'FirstName', title: 'First Name', width: 100 },
            { data: 'LastName', title: 'Last Name', width: 100 },
            { data: 'Position', title: 'Pos', width: 60 },
            { data: 'JerseyNum', title: '#', width: 50, type: 'numeric' },
            { data: 'Overall', title: 'OVR', width: 60, type: 'numeric' },
            { data: 'Age', title: 'Age', width: 50, type: 'numeric' },
            { data: 'Speed', title: 'SPD', width: 60, type: 'numeric' },
            { data: 'Strength', title: 'STR', width: 60, type: 'numeric' }
        ];

        this.teamRosterGrid = new Handsontable(rosterContainer, {
            data: teamPlayers,
            columns: columns,
            colHeaders: columns.map(col => col.title),
            rowHeaders: true,
            width: '100%',
            height: '100%',
            licenseKey: 'non-commercial-and-evaluation',
            stretchH: 'none',
            autoColumnSize: true,
            manualColumnResize: true
        });

        // Initialize coaches grid
        const coachesContainer = document.getElementById('team-coaches-grid');
        const coachColumns = [
            { data: 'FirstName', title: 'First Name', width: 100 },
            { data: 'LastName', title: 'Last Name', width: 100 },
            { data: 'Position', title: 'Position', width: 150 },
            { data: 'Age', title: 'Age', width: 60, type: 'numeric' }
        ];

        this.coachesGrid = new Handsontable(coachesContainer, {
            data: teamCoaches,
            columns: coachColumns,
            colHeaders: coachColumns.map(col => col.title),
            rowHeaders: true,
            width: '100%',
            height: '100%',
            licenseKey: 'non-commercial-and-evaluation',
            stretchH: 'none',
            autoColumnSize: true,
            manualColumnResize: true
        });
    }

    backToTeamsList() {
        this.currentView = 'home';
        this.currentTeamIndex = null;

        // Destroy grids if they exist
        if (this.teamRosterGrid) {
            this.teamRosterGrid.destroy();
            this.teamRosterGrid = null;
        }
        if (this.coachesGrid) {
            this.coachesGrid.destroy();
            this.coachesGrid = null;
        }

        // Re-render teams list
        this.displayTeams();
    }

    populateTradeTeamSelects() {
        const teamASelect = document.getElementById('teamA-select');
        const teamBSelect = document.getElementById('teamB-select');

        if (!teamASelect || !teamBSelect) return;

        // Filter to only show real NFL teams (not free agents, not Team 0)
        const realTeams = this.franchiseData.teams.filter(team => {
            const teamId = team.TeamIndex !== undefined ? team.TeamIndex : -1;
            return teamId >= 1 && teamId <= 32; // Exclude Team 0 (placeholder), include 1-32
        });

        realTeams.forEach((team, index) => {
            const teamId = team.TeamIndex !== undefined ? team.TeamIndex : index;
            const teamData = NFL_TEAMS[teamId];
            const teamName = teamData ? teamData.fullName : `Team ${teamId}`;

            const optionA = document.createElement('option');
            optionA.value = teamId;
            optionA.textContent = teamName;
            teamASelect.appendChild(optionA);

            const optionB = document.createElement('option');
            optionB.value = teamId;
            optionB.textContent = teamName;
            teamBSelect.appendChild(optionB);
        });
    }

    // Trade Functions
    addPlayer(side) {
        const team = side === 'A' ? this.tradeState.teamA : this.tradeState.teamB;
        if (team.players.length >= 4) return;

        const playerIndex = team.players.length;
        team.players.push({
            name: `Player ${playerIndex + 1}`,
            overall: 75 + Math.floor(Math.random() * 20),
            position: 'WR'
        });

        this.updateTradeDisplay(side);
        this.calculateTradeInterest();
    }

    addPick(side) {
        const team = side === 'A' ? this.tradeState.teamA : this.tradeState.teamB;
        if (team.picks.length >= 3) return;

        const round = Math.floor(Math.random() * 3) + 1;
        team.picks.push({
            round: round,
            pick: Math.floor(Math.random() * 32) + 1
        });

        this.updateTradeDisplay(side);
        this.calculateTradeInterest();
    }

    removeItem(side, type, index) {
        const team = side === 'A' ? this.tradeState.teamA : this.tradeState.teamB;
        team[type].splice(index, 1);
        this.updateTradeDisplay(side);
        this.calculateTradeInterest();
    }

    updateTradeDisplay(side) {
        const team = side === 'A' ? this.tradeState.teamA : this.tradeState.teamB;
        const container = document.getElementById(`team${side}-items`);
        const warning = document.getElementById(`team${side}-warning`);

        if (!container) return;

        if (team.players.length === 0 && team.picks.length === 0) {
            container.innerHTML = '<div style="color: var(--gray-text-secondary); text-align: center; padding: 2rem;">No items added</div>';
            if (warning) warning.classList.remove('show');
            return;
        }

        let html = '';
        team.players.forEach((player, i) => {
            html += `
                <div class="trade-item">
                    <div class="item-info">
                        <div class="item-name">${player.name}</div>
                        <div class="item-details">${player.position} • OVR ${player.overall}</div>
                    </div>
                    <button class="btn btn-danger" style="padding: 0.25rem 0.5rem;" onclick="franchiseEditor.removeItem('${side}', 'players', ${i})">✕</button>
                </div>
            `;
        });

        team.picks.forEach((pick, i) => {
            html += `
                <div class="trade-item">
                    <div class="item-info">
                        <div class="item-name">Round ${pick.round} Pick</div>
                        <div class="item-details">Pick #${pick.pick}</div>
                    </div>
                    <button class="btn btn-danger" style="padding: 0.25rem 0.5rem;" onclick="franchiseEditor.removeItem('${side}', 'picks', ${i})">✕</button>
                </div>
            `;
        });

        container.innerHTML = html;

        if (warning) {
            if (team.players.length >= 4 && team.picks.length >= 3) {
                warning.classList.add('show');
            } else {
                warning.classList.remove('show');
            }
        }
    }

    calculateTradeInterest() {
        const teamAValue = this.tradeState.teamA.players.reduce((sum, p) => sum + p.overall, 0) +
                           this.tradeState.teamA.picks.reduce((sum, p) => sum + (80 - p.pick * 2 - (p.round - 1) * 20), 0);
        const teamBValue = this.tradeState.teamB.players.reduce((sum, p) => sum + p.overall, 0) +
                           this.tradeState.teamB.picks.reduce((sum, p) => sum + (80 - p.pick * 2 - (p.round - 1) * 20), 0);

        const totalValue = teamAValue + teamBValue;
        if (totalValue === 0) {
            this.setInterest(50, 'Fair Trade', 'fair', 'No items in trade');
            return;
        }

        const percentageA = (teamAValue / totalValue) * 100;

        if (percentageA >= 45 && percentageA <= 55) {
            this.setInterest(percentageA, 'Fair Trade', 'fair', 'This trade would be accepted in-game');
        } else if (percentageA >= 35 && percentageA <= 65) {
            this.setInterest(percentageA, 'Slightly Unbalanced', 'slight', 'This trade might be rejected in-game');
        } else {
            this.setInterest(percentageA, 'Very Lopsided', 'lopsided', '⚠️ This trade would likely be rejected in-game');
        }
    }

    setInterest(percent, text, level, warning) {
        const fill = document.getElementById('interest-fill');
        const interestText = document.getElementById('interest-text');
        const tradeWarning = document.getElementById('trade-warning');

        if (fill) {
            fill.style.width = percent + '%';
            fill.textContent = Math.round(percent) + '%';
            fill.className = 'interest-fill interest-' + level;
        }
        if (interestText) interestText.textContent = text;
        if (tradeWarning) tradeWarning.textContent = warning;
    }

    executeTrade() {
        if (!this.currentFile) {
            alert('Please load a franchise file first');
            return;
        }

        const totalItems = this.tradeState.teamA.players.length + this.tradeState.teamA.picks.length +
                          this.tradeState.teamB.players.length + this.tradeState.teamB.picks.length;

        if (totalItems === 0) {
            alert('Please add items to the trade');
            return;
        }

        alert('Trade executed!\n\nIn the full implementation, this would modify the franchise file.');
    }

    async saveFranchise() {
        if (!this.currentFile) {
            alert('No franchise file loaded');
            return;
        }

        console.log('[Franchise Editor] Saving...');
        this.updateStatus('Saving franchise...');

        try {
            const result = await window.electronAPI.franchise.saveFile(this.currentFile, this.currentFile);

            if (!result.success) {
                throw new Error(result.error);
            }

            console.log('[Franchise Editor] Saved successfully');
            this.updateStatus('Saved successfully');
            alert('Franchise saved successfully!');

        } catch (error) {
            console.error('[Franchise Editor] Save error:', error);
            alert(`Error saving franchise: ${error.message}`);
            this.updateStatus('Error saving');
        }
    }

    switchTab(tabName) {
        console.log('[Franchise Editor] Switching to:', tabName);

        // Update tabs
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Update panels
        document.querySelectorAll('.tool-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        const activePanel = document.getElementById(`${tabName}-panel`);
        if (activePanel) activePanel.classList.add('active');

        // If switching back to teams and we're in detail view, go back to teams list
        if (tabName === 'teams' && this.currentView === 'team-detail') {
            this.backToTeamsList();
        }
    }

    // Portrait system methods
    getPlpoFromPID(pid) {
        // Source: Ported from roster editor (src/renderer/js/app.js:1830-1838)
        // Direct PID -> PLPO lookup from ALLDATA_Lookup.csv
        if (!pid || !window.lookupData || !window.lookupData.plpos) {
            return null;
        }

        const plpoKey = window.lookupData.plpos.get(pid);
        return plpoKey || null;
    }

    // Column sorting methods - ported from roster editor (src/renderer/js/app.js:2099-2269)
    setupHeaderClickHandlers() {
        // Remove old listener if it exists to prevent duplicates
        if (this._headerClickHandler) {
            document.removeEventListener('click', this._headerClickHandler);
        }

        // Create and store the handler function
        this._headerClickHandler = (e) => {
            // Check if click was on or inside a sortable header
            const header = e.target.closest('.sortable-header');
            if (!header) return;

            // Make sure this is from our roster grid
            const isInRosterGrid = header.closest('#franchise-handsontable-container');
            if (!isInRosterGrid) return;

            const fieldName = header.dataset.field;
            const isShiftKey = e.shiftKey;
            console.log('[Franchise] Header click - Field:', fieldName, 'Shift:', isShiftKey);

            // Handle column sort
            this.toggleColumnSort(fieldName, isShiftKey);
        };

        // Add the new listener to document
        document.addEventListener('click', this._headerClickHandler);

        // Set cursor on headers when they appear
        const headers = document.querySelectorAll('.sortable-header');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
        });
    }

    toggleColumnSort(fieldName, isMultiColumn) {
        console.log('[Franchise Sort] Toggle sort - field:', fieldName, 'multi:', isMultiColumn);

        // Find existing sort for this column
        const existingSortIndex = this.sortColumns.findIndex(s => s.column === fieldName);

        if (!isMultiColumn) {
            // Single column sort - clear all other sorts
            if (existingSortIndex >= 0) {
                // Toggle between asc/desc/none
                const currentOrder = this.sortColumns[existingSortIndex].order;
                if (currentOrder === 'asc') {
                    this.sortColumns = [{ column: fieldName, order: 'desc' }];
                } else {
                    // desc -> remove sort
                    this.sortColumns = [];
                }
            } else {
                // Start with ascending
                this.sortColumns = [{ column: fieldName, order: 'asc' }];
            }
        } else {
            // Multi-column sort - add or toggle this column
            if (existingSortIndex >= 0) {
                // Toggle existing column
                const currentOrder = this.sortColumns[existingSortIndex].order;
                if (currentOrder === 'asc') {
                    this.sortColumns[existingSortIndex].order = 'desc';
                } else {
                    // desc -> remove this sort column
                    this.sortColumns.splice(existingSortIndex, 1);
                }
            } else {
                // Add new sort column
                this.sortColumns.push({ column: fieldName, order: 'asc' });
            }
        }

        // Reset to first page and re-render
        this.currentPage = 1;
        this.filterAndRenderRoster();
    }

    async preloadPortraits(players) {
        if (!window.electronAPI || !window.electronAPI.portrait) {
            console.warn('[Portrait] Portrait API not available');
            return;
        }

        console.log('[Portrait DEBUG] Players to process:', players.length);
        console.log('[Portrait DEBUG] First player object:', players[0]);

        let portraitsToLoad = 0;
        let portraitsLoaded = 0;

        players.forEach((player, index) => {
            // Try PLYR_PORTRAIT first (PEPS field), then fall back to PresentationId
            const pid = player.PLYR_PORTRAIT || player.PEPS || player.PresentationId || player.PSXP;

            if (index < 3) {
                console.log(`[Portrait] Player ${index} PLYR_PORTRAIT:`, player.PLYR_PORTRAIT);
                console.log(`[Portrait] Player ${index} PresentationId:`, player.PresentationId);
                console.log(`[Portrait] Player ${index} Using PID:`, pid);
            }

            if (!pid) {
                if (index < 3) console.warn(`[Portrait] Player ${index} has no PID`);
                return;
            }

            // Direct PID -> PLPO lookup (same as roster editor)
            const plpoKey = window.lookupData?.plpos?.get(pid);

            if (index < 3) {
                console.log(`[Portrait] Player ${index} PLPO from lookup:`, plpoKey);
            }

            if (!plpoKey) {
                if (index < 3) console.warn(`[Portrait] Player ${index} PID ${pid} has no PLPO mapping`);
                return;
            }

            // Skip if already in cache
            if (this.portraitCache.has(plpoKey)) return;

            // Mark as loading
            this.portraitCache.set(plpoKey, 'loading');
            portraitsToLoad++;

            // Fetch portrait asynchronously
            window.electronAPI.portrait.getByPLPO(plpoKey)
                .then(imageData => {
                    this.portraitCache.set(plpoKey, imageData);
                    portraitsLoaded++;

                    // Re-render when all loaded
                    if (portraitsLoaded === portraitsToLoad && this.rosterGrid) {
                        this.rosterGrid.render();
                    }
                })
                .catch(error => {
                    console.warn(`[Portrait] Failed to load ${plpoKey}:`, error);
                    this.portraitCache.set(plpoKey, null);
                    portraitsLoaded++;

                    if (portraitsLoaded === portraitsToLoad && this.rosterGrid) {
                        this.rosterGrid.render();
                    }
                });
        });

        console.log(`[Portrait] Pre-loading ${portraitsToLoad} portraits`);
    }

    portraitRenderer(instance, td, row, col, prop, value, cellProperties) {
        td.innerHTML = '';
        td.style.padding = '2px';
        td.style.textAlign = 'center';
        td.style.verticalAlign = 'middle';
        td.style.backgroundColor = '#1a1a1a';

        // Get PID from row data - ONLY use PSXP (PresentationId), NOT PEPS
        // Source: Roster editor uses PSXP as the PID field (src/renderer/js/app.js:1230)
        const rowData = instance.getDataAtRow(row);
        const psxpIndex = this.currentFieldMapping.indexOf('PSXP');
        const pid = psxpIndex !== -1 ? rowData[psxpIndex] : null;

        if (!pid) return td;

        // Direct PID -> PLPO lookup (same as roster editor)
        const plpoKey = this.getPlpoFromPID(parseInt(pid));
        if (!plpoKey) return td;

        // ONLY use cache - never trigger loads during render
        if (this.portraitCache.has(plpoKey)) {
            const imageData = this.portraitCache.get(plpoKey);
            if (imageData && imageData !== 'loading') {
                const img = document.createElement('img');
                img.src = imageData;
                img.style.width = '64px';
                img.style.height = '64px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '4px';
                td.appendChild(img);
            } else if (imageData === 'loading') {
                td.textContent = '...';
                td.style.fontSize = '12px';
                td.style.color = '#666';
            }
        }

        return td;
    }

    customCellRenderer(instance, td, row, col, prop, value, cellProperties) {
        // Use appropriate renderer based on cell type
        if (cellProperties.type === 'dropdown') {
            // Use dropdown renderer for dropdown cells
            Handsontable.renderers.DropdownRenderer.apply(this, arguments);
        } else {
            // Use text renderer for other cells
            Handsontable.renderers.TextRenderer.apply(this, arguments);
        }

        // Apply custom styling to match roster editor
        td.style.backgroundColor = 'var(--gray-medium)';
        td.style.color = 'var(--gray-text)';
        td.style.border = '1px solid var(--border-color)';
        td.style.fontSize = '0.875rem';

        // Highlight selected cells
        if (cellProperties.isSelected) {
            td.style.backgroundColor = 'var(--primary-orange)';
            td.style.color = 'var(--white)';
        }

        // Highlight changed cells
        if (cellProperties.changed) {
            td.style.backgroundColor = 'var(--warning-yellow)';
            td.style.color = 'var(--black)';
        }

        return td;
    }

    // Filtering and pagination methods
    applyFiltersAndSort() {
        let filtered = [...this.franchiseData.players];

        // Team filter
        if (this.selectedTeamId !== null) {
            filtered = filtered.filter(p => p.TeamIndex === this.selectedTeamId);
        }

        // Position filter
        if (this.selectedPosition) {
            filtered = filtered.filter(p => {
                const posValue = p.Position;
                if (posValue === undefined || posValue === null) return false;

                // Get position name from lookup
                const posName = getLookupValue('positions', posValue);
                return posName === this.selectedPosition;
            });
        }

        // Search filter
        if (this.searchTerm) {
            filtered = filtered.filter(p => {
                const firstName = (p.FirstName || '').toLowerCase();
                const lastName = (p.LastName || '').toLowerCase();
                const fullName = `${firstName} ${lastName}`;
                return fullName.includes(this.searchTerm);
            });
        }

        // Apply sorting (ported from roster editor)
        // Need to map field codes to franchise field names
        const FIELD_MAPPING = {
            'PFNA': 'FirstName', 'PLNA': 'LastName', 'PPOS': 'Position', 'PAGE': 'Age',
            'PJEN': 'JerseyNum', 'TGID': 'TeamIndex', 'PCOL': 'College', 'PHTN': 'PLYR_HOME_TOWN',
            'PHSN': 'PLYR_HOME_STATE', 'PSXP': 'PresentationId', 'PLAYERPIC': 'PLYR_ASSETNAME',
            'PEPS': 'PLYR_PORTRAIT', 'POVR': 'OverallRating', 'PYRP': 'YearsPro',
            'PACC': 'AccelerationRating', 'PAGI': 'AgilityRating', 'PAWR': 'AwarenessRating',
            'PBKT': 'BreakTackleRating', 'PBCV': 'BCVisionRating', 'PBSG': 'BlockSheddingRating',
            'PBSK': 'BreakSackRating', 'PCAR': 'CarryingRating', 'PCIT': 'CatchInTrafficRating',
            'PCTH': 'CatchingRating', 'PDRR': 'DeepRouteRunningRating', 'PCOD': 'ChangeOfDirectionRating',
            'PFMV': 'FinesseMovesRating', 'PPOW': 'HitPowerRating', 'PIBL': 'ImpactBlockingRating',
            'PINJ': 'InjuryRating', 'PJKM': 'JukeMoveRating', 'PJMP': 'JumpingRating',
            'PKAC': 'KickAccuracyRating', 'PKPW': 'KickPowerRating', 'PKR': 'KickReturnRating',
            'PLS': 'LongSnapRating', 'PLBK': 'LeadBlockRating', 'PMCV': 'ManCoverageRating',
            'PMRR': 'MediumRouteRunningRating', 'PPBK': 'PassBlockRating', 'PPBF': 'PassBlockFinesseRating',
            'PPBS': 'PassBlockPowerRating', 'PPAC': 'PlayActionRating', 'PPMV': 'PowerMovesRating',
            'PPRS': 'PressRating', 'PPUR': 'PursuitRating', 'PPRC': 'PlayRecognitionRating',
            'PRLS': 'ReleaseRating', 'PRBK': 'RunBlockRating', 'PRBF': 'RunBlockFinesseRating',
            'PRBS': 'RunBlockPowerRating', 'PSRR': 'ShortRouteRunningRating', 'PSPC': 'SpectacularCatchRating',
            'PSPD': 'SpeedRating', 'PSPM': 'SpinMoveRating', 'PSTA': 'StaminaRating',
            'PSFA': 'StiffArmRating', 'PSTR': 'StrengthRating', 'PTAK': 'TackleRating',
            'PTAD': 'ThrowAccuracyDeepRating', 'PTAM': 'ThrowAccuracyMidRating', 'PTAS': 'ThrowAccuracyShortRating',
            'PTOR': 'ThrowOnTheRunRating', 'PTHP': 'ThrowPowerRating', 'PTUP': 'ThrowUnderPressureRating',
            'PTGH': 'ToughnessRating', 'PTRK': 'TruckingRating', 'PZCV': 'ZoneCoverageRating',
            'PHGT': 'Height', 'PWGT': 'Weight', 'TOTAL_SALARY': 'TotalSalary'
        };

        if (this.sortColumns.length > 0) {
            filtered.sort((a, b) => {
                for (const sort of this.sortColumns) {
                    const fieldCode = sort.column;  // Field code from header (e.g., PCOL)
                    const order = sort.order;

                    // Map field code to franchise field name (e.g., PCOL → College)
                    const franchiseFieldName = FIELD_MAPPING[fieldCode] || fieldCode;

                    // Get values
                    let aVal = a[franchiseFieldName];
                    let bVal = b[franchiseFieldName];

                    // Handle nulls/undefined
                    if (aVal == null && bVal == null) continue;
                    if (aVal == null) return order === 'asc' ? 1 : -1;
                    if (bVal == null) return order === 'asc' ? -1 : 1;

                    // Type-specific comparison
                    if (typeof aVal === 'string' && typeof bVal === 'string') {
                        const cmp = aVal.localeCompare(bVal);
                        if (cmp !== 0) return order === 'asc' ? cmp : -cmp;
                    } else {
                        if (aVal < bVal) return order === 'asc' ? -1 : 1;
                        if (aVal > bVal) return order === 'asc' ? 1 : -1;
                    }
                }
                return 0;
            });
        }

        this.filteredPlayers = filtered;
    }

    filterAndRenderRoster() {
        // Apply filters
        this.applyFiltersAndSort();

        // Calculate pagination
        this.totalPages = Math.ceil(this.filteredPlayers.length / this.rowsPerPage);
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
        }

        // Update UI
        this.updatePaginationUI();

        // Re-initialize grid with filtered data
        this.initializeRosterGrid();
    }

    updatePaginationUI() {
        const playerCount = document.getElementById('franchisePlayerCount');
        if (playerCount) {
            playerCount.textContent = `${this.filteredPlayers.length} players`;
        }

        const pageInfo = document.getElementById('franchisePageInfo');
        const pageIndicator = document.getElementById('franchisePageIndicator');
        const pageText = `Page ${this.currentPage} of ${this.totalPages}`;

        if (pageInfo) pageInfo.textContent = pageText;
        if (pageIndicator) pageIndicator.textContent = pageText;

        // Disable/enable pagination buttons
        const firstBtn = document.getElementById('franchiseFirstPage');
        const prevBtn = document.getElementById('franchisePrevPage');
        const nextBtn = document.getElementById('franchiseNextPage');
        const lastBtn = document.getElementById('franchiseLastPage');

        if (firstBtn) firstBtn.disabled = this.currentPage === 1;
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === this.totalPages;
        if (lastBtn) lastBtn.disabled = this.currentPage === this.totalPages;
    }

    populateTeamFilter() {
        const teamFilter = document.getElementById('franchiseTeamFilter');
        if (!teamFilter) return;

        // Clear existing options except "All Teams"
        teamFilter.innerHTML = '<option value="">All Teams</option>';

        // Add real teams (1-32)
        getAllTeams().forEach(team => {
            const option = document.createElement('option');
            option.value = team.TeamIndex;
            option.textContent = team.fullName;
            teamFilter.appendChild(option);
        });
    }

    updateStatus(message) {
        const status = document.getElementById('status-text');
        if (status) {
            status.textContent = message;
        }
        console.log('[Status]', message);
    }

    runPreSeasonSetup() {
        if (!this.currentFile) {
            alert('Please load a franchise file first');
            return;
        }
        alert('Pre-Season Setup\n\nComing soon!\n\nThis will automatically configure:\n• Historical team names and locations\n• Period-accurate schedules\n• Historical coaches');
    }

    runPostDraftCleanup() {
        if (!this.currentFile) {
            alert('Please load a franchise file first');
            return;
        }
        alert('Post-Draft Cleanup\n\nComing soon!\n\nThis will automatically:\n• Assign appropriate body types\n• Configure commentary names\n• Adjust player traits');
    }
}

// Create global instance
const franchiseEditor = new FranchiseEditor();

// Make functions globally accessible for HTML onclick handlers
window.franchiseEditor = franchiseEditor;
window.switchToTab = (tab) => franchiseEditor.switchTab(tab);
window.addPlayer = (side) => franchiseEditor.addPlayer(side);
window.addPick = (side) => franchiseEditor.addPick(side);
window.removeItem = (side, type, index) => franchiseEditor.removeItem(side, type, index);
window.executeTrade = () => franchiseEditor.executeTrade();
window.runPreSeasonSetup = () => franchiseEditor.runPreSeasonSetup();
window.runPostDraftCleanup = () => franchiseEditor.runPostDraftCleanup();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    franchiseEditor.init();
});
