/**
 * Madden Editor Suite - Main Application JavaScript
 * Vanilla JavaScript implementation inspired by MyFranchise architecture
 */

import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';
import {
    getFieldDefinition,
    getVisibleFields,
    validateFieldValue,
    POSITION_MAPPINGS,
    TEAM_MAPPINGS,
    loadLookupData,
    getLookupOptions,
    getLookupValue,
    getPIDFromName,
    getPlayerNameFromPID,
    searchPIDNames
} from '../data/field-definitions.js';
import { NFL_TEAMS, getAllTeams, getTeamById } from '../data/team-data.js';

class MaddenEditorApp {
    constructor() {
        this.currentTool = 'roster';
        this.currentFile = null;
        this.players = [];
        this.filteredPlayers = []; // Filtered/sorted view of players
        this.lookupReady = false;
        this.selectedPosition = '';
        this.selectedTeamId = null; // null = all teams, number = specific team
        this.showAllColumns = false;
        this.disableChangeEvents = false;

        // Pagination settings
        this.currentPage = 1;
        this.rowsPerPage = 100;
        this.totalPages = 1;

        // Sorting state
        this.sortColumns = []; // Array of {column: fieldName, order: 'asc'|'desc'}

        this.init();
    }

    async init() {
        console.log('Initializing Madden Editor Suite...');

        // Show splash screen for 2 seconds
        setTimeout(() => {
            this.hideSplashScreen();
        }, 2000);

        // Load lookup data first
        await loadLookupData();

        // Initialize lookup system
        await this.initializeLookup();

        // Setup event listeners
        this.setupEventListeners();

        // Populate team dropdown
        this.populateTeamDropdown();

        // Don't load sample data - app should start blank until file is loaded
        this.players = [];
        this.renderRoster();

        console.log('Application initialized successfully');
    }

    hideSplashScreen() {
        const splash = document.getElementById('splash');
        const app = document.getElementById('app');

        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
            app.classList.add('show');
        }, 500);
    }

    async initializeLookup() {
        try {
            this.setStatus('Initializing lookup system...');

            // Check if electronAPI is available
            if (typeof window.electronAPI !== 'undefined') {
                const ready = await window.electronAPI.lookup.isReady();
                this.lookupReady = ready;

                if (!ready) {
                    await window.electronAPI.lookup.reload();
                    const retryReady = await window.electronAPI.lookup.isReady();
                    this.lookupReady = retryReady;
                }
            } else {
                // Fallback for testing without Electron
                console.warn('Electron API not available - using sample data');
                this.lookupReady = true;
            }

            this.setStatus('Ready');
        } catch (error) {
            console.error('Failed to initialize lookup system:', error);
            this.showError('Failed to initialize lookup system');
            this.lookupReady = true; // Continue with limited functionality
        }
    }

    setupEventListeners() {
        // Tool tab switching
        document.querySelectorAll('.tool-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.switchTool(tool);
            });
        });

        // File operations
        document.getElementById('openFileBtn').addEventListener('click', async () => {
            await this.openFileDialog();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // Roster controls
        document.getElementById('teamFilter').addEventListener('change', (e) => {
            const teamId = e.target.value ? parseInt(e.target.value) : null;
            this.selectedTeamId = teamId;
            this.enterTeamView(teamId);
        });

        document.getElementById('positionFilter').addEventListener('change', (e) => {
            this.selectedPosition = e.target.value;
            this.filterPlayers();
        });

        document.getElementById('showAllColumns').addEventListener('change', (e) => {
            this.showAllColumns = e.target.checked;
            this.updateVisibleFields();
        });

        // Back to all teams button
        document.getElementById('backToAllTeams').addEventListener('click', () => {
            this.exitTeamView();
        });

        document.getElementById('saveRosterBtn').addEventListener('click', () => {
            this.saveRoster();
        });

        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeErrorModal();
        });

        // Click outside modal to close
        document.getElementById('errorModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeErrorModal();
            }
        });

        // Pagination controls
        document.getElementById('firstPageBtn').addEventListener('click', () => {
            this.firstPage();
        });

        document.getElementById('prevPageBtn').addEventListener('click', () => {
            this.previousPage();
        });

        document.getElementById('nextPageBtn').addEventListener('click', () => {
            this.nextPage();
        });

        document.getElementById('lastPageBtn').addEventListener('click', () => {
            this.lastPage();
        });

        document.getElementById('goToPageBtn').addEventListener('click', () => {
            const pageInput = document.getElementById('pageInput');
            const targetPage = parseInt(pageInput.value);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= this.totalPages) {
                this.goToPage(targetPage);
                pageInput.value = '';
            }
        });

        document.getElementById('pageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const targetPage = parseInt(e.target.value);
                if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= this.totalPages) {
                    this.goToPage(targetPage);
                    e.target.value = '';
                }
            }
        });
    }

    switchTool(toolName) {
        // Update active tab
        document.querySelectorAll('.tool-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tool="${toolName}"]`).classList.add('active');

        // Update active panel
        document.querySelectorAll('.tool-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${toolName}-tool`).classList.add('active');

        this.currentTool = toolName;
        console.log(`Switched to ${toolName} tool`);
    }

    async openFileDialog() {
        console.log('[app.js] ===== OPEN FILE DIALOG =====');
        try {
            if (typeof window.electronAPI !== 'undefined') {
                console.log('[app.js] Step 1: Calling file.openDialog()...');
                const result = await window.electronAPI.file.openDialog([
                    { name: 'All Files', extensions: ['*'] },
                    { name: 'Roster Files', extensions: [] }
                ]);
                console.log('[app.js] Step 2: Dialog result:', result);

                if (result.success && result.filePath) {
                    console.log('[app.js] Step 3: Calling loadRosterFile()...');
                    await this.loadRosterFile(result.filePath);
                    console.log('[app.js] Step 4: loadRosterFile() completed');
                } else if (result.canceled) {
                    console.log('[app.js] File selection canceled by user');
                } else if (result.error) {
                    console.error('[app.js] Dialog error:', result.error);
                    this.showError(`Failed to open file: ${result.error}`);
                }
            } else {
                console.warn('[app.js] Electron API not available - using HTML file input fallback');
                document.getElementById('fileInput').click();
            }
        } catch (error) {
            console.error('[app.js] ===== ERROR IN OPEN FILE =====');
            console.error('[app.js] Error:', error);
            console.error('[app.js] Stack:', error.stack);
            console.error('[app.js] ===============================');
            this.showError(`Failed to open file dialog: ${error.message}`);
        }
    }

    async loadRosterFile(filePath) {
        if (!filePath) return;

        this.setStatus('Loading file...');
        this.showLoading(true, 'Initializing...', 10);

        try {
            const fileName = filePath.replace(/^.*[\\/]/, ''); // Extract filename from path
            console.log('Loading roster file:', fileName, 'Path:', filePath);

            // Update UI
            this.setCurrentFile(filePath);
            this.updateLoadingProgress('Reading file...', 25);

            // Use real parser from backend
            if (typeof window.electronAPI !== 'undefined') {
                console.log('Loading roster file using real parser...');
                this.updateLoadingProgress('Parsing roster data...', 50);

                const result = await window.electronAPI.parser.parseRosterFile(filePath);
                console.log('Parse result:', result);

                if (result.success && result.data) {
                    this.updateLoadingProgress('Processing players...', 75);

                    // Extract players from the parse result
                    this.players = result.data.players || [];
                    this.originalData = result.data; // Store for saving

                    // Reset pagination
                    this.currentPage = 1;

                    this.updateLoadingProgress('Rendering grid...', 90);
                    this.renderRoster();
                    this.setStatus(`Loaded ${this.players.length} players from ${fileName}`);
                } else {
                    throw new Error(result.error || 'Unknown parsing error');
                }
            } else {
                // Fallback to sample data for testing without Electron
                console.log('Electron API not available - loading sample data for testing');
                this.updateLoadingProgress('Loading sample data...', 75);
                this.loadSampleData();
                this.currentPage = 1;
                this.updateLoadingProgress('Rendering grid...', 90);
                this.renderRoster();
                this.setStatus(`Loaded ${this.players.length} players from ${fileName} (sample data)`);
            }

        } catch (error) {
            console.error('Error loading file:', error);
            this.showError(`Failed to load file: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    async handleFileSelect(event) {
        // Fallback for HTML file input (when Electron API not available)
        const file = event.target.files[0];
        if (!file) return;

        // For HTML file input, we only get the filename, so use sample data
        console.log('Using HTML file input fallback - loading sample data');
        this.setCurrentFile(file.name);
        this.loadSampleData();
        this.renderRoster();
        this.setStatus(`Loaded ${this.players.length} players from ${file.name} (sample data - HTML fallback)`);
    }

    setCurrentFile(filePath) {
        this.currentFile = filePath;
        const fileName = filePath.replace(/^.*[\\/]/, '');

        document.getElementById('fileName').textContent = fileName;
        document.getElementById('currentFile').style.display = 'flex';
        document.getElementById('saveRosterBtn').style.display = 'inline-flex';
    }

    loadSampleData() {
        this.players = [
            {
                PGID: 1,
                PLNA: 'Smith',
                PFNA: 'John',
                PPOS: 0, // QB
                TGID: 1, // ATL
                POVR: 85,
                PAGE: 25,
                PSPD: 80,
                PSTR: 75,
                PAWR: 90,
                PACC: 82,
                PAGI: 78,
                PHGT: 75,
                PWGT: 225,
                PINJ: 95,
                PTHP: 88,
                PTHA: 92,
                PCOL: 4, // Alabama
                PHSN: 8, // Florida
                PSXP: 99, // Tom Brady
                PJEN: 12,
                PHTN: 'Birmingham',
                PYRP: 3,
                PBCV: 85,
                PBSG: 40,
                PBSK: 55,
                PCAR: 45,
                PLCI: 80,
                PCTH: 85,
                PDRR: 88,
                PELU: 75,
                PFMS: 60,
                PLHT: 70,
                PLIB: 45,
                PLJM: 80,
                PJMP: 85,
                PKAC: 30,
                PKPR: 25,
                PKRT: 60,
                PLBK: 40,
                PLMC: 78,
                PMRR: 85,
                PPBK: 35,
                PPBF: 30,
                PPBS: 40,
                PPLA: 92,
                PLPM: 65,
                PLPE: 50,
                PLPU: 60,
                PLRL: 85,
                PRBK: 30,
                PRBF: 25,
                PRBS: 35,
                SRRN: 90,
                PLSC: 88,
                PLSM: 82,
                PSTA: 88,
                PLSA: 75,
                PTAK: 45,
                PTAD: 95,
                PTAM: 92,
                PTAS: 88,
                PTOR: 90,
                PTUP: 88,
                PTGH: 80,
                PLTR: 70,
                PLZC: 60
            },
            {
                PGID: 2,
                PLNA: 'Johnson',
                PFNA: 'Mike',
                PPOS: 1, // HB
                TGID: 2, // BAL
                POVR: 82,
                PAGE: 23,
                PSPD: 92,
                PSTR: 70,
                PAWR: 75,
                PACC: 95,
                PAGI: 90,
                PHGT: 70,
                PWGT: 200,
                PINJ: 88,
                PCAR: 85,
                PCTH: 78,
                PCOL: 10, // Arizona State
                PHSN: 4, // California
                PSXP: 100, // Aaron Rodgers
                PJEN: 22,
                PHTN: 'Los Angeles',
                PYRP: 2,
                PBCV: 80,
                PBSG: 65,
                PBSK: 70,
                PLCI: 78,
                PDRR: 60,
                PELU: 90,
                PFMS: 85,
                PLHT: 75,
                PLIB: 50,
                PLJM: 92,
                PJMP: 88,
                PKAC: 20,
                PKPR: 15,
                PKRT: 85,
                PLBK: 60,
                PLMC: 30,
                PMRR: 65,
                PPBK: 25,
                PPBF: 20,
                PPBS: 30,
                PPLA: 40,
                PLPM: 80,
                PLPE: 35,
                PLPU: 75,
                PLRL: 70,
                PRBK: 20,
                PRBF: 15,
                PRBS: 25,
                SRRN: 70,
                PLSC: 82,
                PLSM: 88,
                PSTA: 85,
                PLSA: 85,
                PTAK: 40,
                PTAD: 35,
                PTAM: 40,
                PTAS: 45,
                PTOR: 50,
                PTUP: 40,
                PTGH: 88,
                PLTR: 90,
                PLZC: 25
            }
        ];

        this.renderRoster();
        this.updateStats();
    }

    renderRoster() {
        const container = document.getElementById('rosterGrid');

        if (this.players.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <h3 class="empty-title">No players loaded</h3>
                    <p class="empty-description">Open a roster file to begin editing</p>
                </div>
            `;
            return;
        }

        // Apply filtering and sorting to get the view
        this.applyFiltersAndSort();

        // Destroy existing Handsontable instance if it exists
        if (this.hotTable) {
            this.hotTable.destroy();
        }

        // Clear container and create Handsontable element
        container.innerHTML = '<div id="handsontable-container" style="height: 100%; background: var(--gray-dark);"></div>';
        const hotContainer = document.getElementById('handsontable-container');

        // Get visible fields based on toggle
        const visibleFields = getVisibleFields(this.showAllColumns);

        // Extract field codes and display names from the visible fields
        let fieldCodes, displayNames;
        if (this.showAllColumns) {
            // For all fields mode, use the export order (simple strings)
            fieldCodes = visibleFields;
            displayNames = visibleFields.map(fieldName => {
                const fieldDef = getFieldDefinition(fieldName);
                return fieldDef.shortDisplay || fieldDef.display;
            });
        } else {
            // For basic fields mode, extract from tuple structure
            fieldCodes = visibleFields.map(field => Array.isArray(field) ? field[0] : field);
            displayNames = visibleFields.map(field => {
                const fieldName = Array.isArray(field) ? field[0] : field;
                const fieldDef = getFieldDefinition(fieldName);
                return fieldDef.shortDisplay || fieldDef.display;
            });
        }

        // Calculate pagination using filteredPlayers
        this.totalPages = Math.ceil(this.filteredPlayers.length / this.rowsPerPage);
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = Math.min(startIndex + this.rowsPerPage, this.filteredPlayers.length);
        const paginatedPlayers = this.filteredPlayers.slice(startIndex, endIndex);

        // Store paginated player indices for mapping back to filteredPlayers
        this.paginatedPlayerIndices = paginatedPlayers.map(player =>
            this.filteredPlayers.indexOf(player)
        );

        // Prepare data and columns for Handsontable (only current page)
        const data = paginatedPlayers.map(player => {
            return fieldCodes.map(fieldName => {
                return this.getPlayerFieldValue(player, fieldName);
            });
        });

        const columns = fieldCodes.map(fieldName => {
            const fieldDef = getFieldDefinition(fieldName);
            let columnConfig = {
                readOnly: !fieldDef.editable,
                allowInvalid: false
            };

            // Configure column type and editor based on field type
            if (fieldDef.type === 'lookup' && fieldDef.lookup) {
                // Dropdown for lookup fields - let autoColumnSize handle width
                const options = getLookupOptions(fieldDef.lookup);
                columnConfig = {
                    ...columnConfig,
                    type: 'dropdown',
                    source: options.map(opt => opt.label),  // Display names for dropdown
                    allowInvalid: false,
                    validator: fieldDef.editable ? (value, callback) => {
                        // Check if the selected value is valid
                        const isValid = options.some(opt => opt.label === value);
                        callback(isValid);
                    } : undefined
                };
            } else if (fieldName === 'PSXP') {
                // Special handling for PID field with custom renderer - fixed width
                columnConfig = {
                    ...columnConfig,
                    type: 'text',
                    width: 50,
                    renderer: this.pidRenderer.bind(this),
                    readOnly: false,  // Override to ensure it's editable
                    validator: fieldDef.editable ? (value, callback) => {
                        const validation = validateFieldValue(fieldName, value);
                        callback(validation.isValid);
                    } : undefined
                };
            } else if (fieldName === 'PLAYERPIC') {
                // Special handling for Player Pic field with autocomplete - let autoColumnSize handle width
                columnConfig = {
                    ...columnConfig,
                    type: 'autocomplete',
                    source: (query, process) => {
                        // Get all player names from PID lookup for autocomplete
                        const results = searchPIDNames(query, 20);
                        process(results.map(r => r.name));
                    },
                    strict: false,  // Allow typing custom values
                    allowInvalid: true,  // Allow invalid values temporarily
                    readOnly: false  // Make it editable
                };
            } else if (fieldDef.type === 'numeric') {
                // Numeric fields - fixed width for stats (1-99 range)
                columnConfig = {
                    ...columnConfig,
                    type: 'numeric',
                    format: '0',
                    width: 50,  // Fixed width for stat columns
                    validator: fieldDef.editable ? (value, callback) => {
                        const validation = validateFieldValue(fieldName, value);
                        callback(validation.isValid);
                    } : undefined
                };
            } else {
                // Text fields - let autoColumnSize handle width
                columnConfig = {
                    ...columnConfig,
                    type: 'text',
                    validator: fieldDef.editable ? (value, callback) => {
                        const validation = validateFieldValue(fieldName, value);
                        callback(validation.isValid);
                    } : undefined
                };
            }

            return columnConfig;
        });

        // Store field mapping for data changes
        this.currentFieldMapping = fieldCodes;

        // Create custom column headers with tooltips and sort indicators
        const colHeaders = (colIndex) => {
            const fieldName = fieldCodes[colIndex];
            const fieldDef = getFieldDefinition(fieldName);
            const displayName = displayNames[colIndex];

            // Check if this column is currently sorted
            const sortInfo = this.sortColumns.find(s => s.column === fieldName);
            const sortIndicator = sortInfo ? (sortInfo.order === 'asc' ? ' ▲' : ' ▼') : '';

            // Return HTML with title attribute for tooltip and sort indicator
            return `<span class="sortable-header" data-field="${fieldName}" title="${fieldDef.display}">${displayName}${sortIndicator}</span>`;
        };

        // Initialize Handsontable with proper validation and editing
        this.hotTable = new Handsontable(hotContainer, {
            data: data,
            colHeaders: colHeaders,
            columns: columns,
            rowHeaders: true,
            width: '100%',
            height: '100%',
            licenseKey: 'non-commercial-and-evaluation',

            // Styling to match MyFranchise
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

            // Column sorting - disable built-in plugins since we handle sorting manually
            columnSorting: false,
            multiColumnSorting: false,

            // Selection
            selectionMode: 'multiple',
            outsideClickDeselects: false,

            // Scrolling
            scrollH: true,
            scrollV: true,

            // Freeze columns
            fixedColumnsStart: 2, // Freeze First Name and Last Name columns

            // Editing
            enterMoves: { row: 1, col: 0 },

            // Context menu
            contextMenu: {
                items: {
                    'copy': {},
                    'cut': {},
                    'paste': {},
                    'separator1': Handsontable.plugins.ContextMenu.SEPARATOR,
                    'undo': {},
                    'redo': {}
                }
            },

            // Custom renderer for better styling
            cells: (row, col) => {
                const fieldName = this.currentFieldMapping[col];
                const fieldDef = getFieldDefinition(fieldName);

                // Add dropdown-cell class for lookup fields
                let cellClass = fieldDef.editable ? 'editable-cell' : 'readonly-cell';
                if (fieldDef.type === 'lookup' && fieldDef.lookup) {
                    cellClass += ' dropdown-cell';
                }

                return {
                    renderer: this.customCellRenderer,
                    className: cellClass
                };
            },

            // Validation messages
            afterValidate: (isValid, value, row, prop, source) => {
                if (!isValid && source !== 'loadData') {
                    const fieldName = this.currentFieldMapping[prop];
                    const validation = validateFieldValue(fieldName, value);
                    if (!validation.isValid) {
                        console.warn(`Invalid ${fieldName}:`, validation.message);
                        this.setStatus(`Invalid ${fieldName}: ${validation.message}`);
                    }
                }
            },

            // Update data when changed
            afterChange: (changes, source) => {
                if (source !== 'loadData' && changes) {
                    this.handlePlayerDataChange(changes);
                }
            },

            // Clear status on selection
            afterSelectionEnd: () => {
                this.setStatus('Ready');
            },

            // Setup PID event listeners and header click handlers after rendering
            afterRender: () => {
                this.setupPIDEventListeners();
                this.setupHeaderClickHandlers();
            },


            // Auto-size columns after loading
            afterLoadData: () => {
                if (this.hotTable) {
                    // Force column resize to fit content
                    setTimeout(() => {
                        const autoColumnSizePlugin = this.hotTable.getPlugin('autoColumnSize');
                        if (autoColumnSizePlugin) {
                            // Clear cache first to ensure fresh calculation
                            autoColumnSizePlugin.clearCache();
                            autoColumnSizePlugin.calculateAllColumnsWidth();
                        }
                        this.hotTable.render();
                    }, 100);
                }
            }
        });

        // Force initial column sizing
        setTimeout(() => {
            if (this.hotTable) {
                const autoColumnSizePlugin = this.hotTable.getPlugin('autoColumnSize');
                if (autoColumnSizePlugin) {
                    autoColumnSizePlugin.clearCache();
                    autoColumnSizePlugin.calculateAllColumnsWidth();
                }
                this.hotTable.render();
            }
        }, 200);

        this.updateStats();
        this.updatePaginationUI();
    }

    getPlayerFieldValue(player, fieldName) {
        const fieldDef = getFieldDefinition(fieldName);

        // Handle lookup fields
        if (fieldDef.type === 'lookup' && fieldDef.lookup) {
            const value = player[fieldName];
            return getLookupValue(fieldDef.lookup, value);
        }

        // Handle PID Player Pic field - convert PID to player name
        if (fieldName === 'PLAYERPIC') {
            const pid = player['PSXP'] || 0;
            return getPlayerNameFromPID(pid);
        }

        // Handle weight conversion: roster value starts at 1 = 160 lbs
        if (fieldName === 'PWGT' && player[fieldName] !== undefined) {
            return player[fieldName] + 159;
        }

        // Handle calculated fields (e.g., TOTAL_SALARY)
        if (fieldDef.type === 'calculated' && fieldDef.calculate) {
            return fieldDef.calculate(player);
        }

        // Handle fields with transform for display (salary/bonus in millions)
        if (fieldDef.transform && fieldDef.transform.display && player[fieldName] !== undefined) {
            return fieldDef.transform.display(player[fieldName]);
        }

        // Handle direct field mappings
        if (player[fieldName] !== undefined) {
            return player[fieldName];
        }

        // Handle special computed fields and fallbacks
        switch (fieldName) {
            case 'PPOS':
                return getLookupValue('positions', player.PPOS);
            case 'TGID':
                return getLookupValue('teams', player.TGID);
            case 'PCOL':
                return getLookupValue('colleges', player.PCOL);
            case 'PHSN':
                return getLookupValue('states', player.PHSN);
            default:
                // Return appropriate default based on field type
                if (fieldDef.type === 'numeric') {
                    return 0;
                } else if (fieldDef.type === 'text') {
                    return '';
                } else {
                    return 'Unknown';
                }
        }
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

        // Apply custom styling to match MyFranchise theme
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

    getBasicColumns() {
        return [
            { title: 'Name', type: 'text', readOnly: true, width: 120 },
            { title: 'Position', type: 'text', readOnly: true, width: 80 },
            { title: 'Overall', type: 'numeric', format: '0', width: 70 },
            { title: 'Age', type: 'numeric', format: '0', width: 60 },
            { title: 'Speed', type: 'numeric', format: '0', width: 70 },
            { title: 'Strength', type: 'numeric', format: '0', width: 80 },
            { title: 'Awareness', type: 'numeric', format: '0', width: 90 },
            { title: 'Acceleration', type: 'numeric', format: '0', width: 90 },
            { title: 'Agility', type: 'numeric', format: '0', width: 70 },
            { title: 'Height', type: 'numeric', format: '0', width: 70 },
            { title: 'Weight', type: 'numeric', format: '0', width: 70 },
            { title: 'Injury', type: 'numeric', format: '0', width: 70 }
        ];
    }

    getAllColumns() {
        // This would include all 131 Madden fields - simplified for now
        const basic = this.getBasicColumns();
        const additional = [
            { title: 'Throw Power', type: 'numeric', format: '0', width: 90 },
            { title: 'Throw Accuracy', type: 'numeric', format: '0', width: 100 },
            { title: 'Carrying', type: 'numeric', format: '0', width: 80 },
            { title: 'Catching', type: 'numeric', format: '0', width: 80 },
            { title: 'College', type: 'text', readOnly: true, width: 100 },
            { title: 'Home State', type: 'text', readOnly: true, width: 100 }
        ];
        return [...basic, ...additional];
    }

    handlePlayerDataChange(changes) {
        // Skip if change events are disabled (to prevent recursion)
        if (this.disableChangeEvents) {
            return;
        }

        // Update player data based on Handsontable changes
        changes.forEach(([row, colIndex, oldValue, newValue]) => {
            // Map from paginated row to filteredPlayers index to players array index
            const filteredIndex = this.paginatedPlayerIndices[row];
            const actualPlayer = this.filteredPlayers[filteredIndex];
            const actualPlayerIndex = this.players.indexOf(actualPlayer);

            if (oldValue !== newValue && this.players[actualPlayerIndex] && this.currentFieldMapping) {
                const fieldName = this.currentFieldMapping[colIndex];
                const fieldDef = getFieldDefinition(fieldName);

                if (fieldDef.editable) {
                    let convertedValue = newValue;

                    // Special handling for PLAYERPIC autocomplete field
                    if (fieldName === 'PLAYERPIC') {
                        // Handle Player Pic autocomplete - convert name to PID
                        const pid = getPIDFromName(newValue);

                        if (pid !== null) {
                            // Valid player name selected, update corresponding PID
                            this.players[actualPlayerIndex]['PSXP'] = pid;
                            // Update the PSXP cell in the grid
                            this.updateGridCell(row, 'PSXP', pid);
                            // Store the valid name
                            convertedValue = newValue;
                            this.players[actualPlayerIndex]['PLAYERPIC'] = convertedValue;
                        } else {
                            // Invalid name typed - revert to original value
                            const originalPID = this.players[actualPlayerIndex]['PSXP'];
                            convertedValue = getPlayerNameFromPID(originalPID);
                            this.players[actualPlayerIndex]['PLAYERPIC'] = convertedValue;
                            // Update the grid to show the reverted value
                            this.updateGridCell(row, 'PLAYERPIC', convertedValue);
                        }
                        return; // Skip normal processing
                    }

                    // Handle lookup fields - convert display name back to ID
                    if (fieldDef.type === 'lookup' && fieldDef.lookup) {
                        const options = getLookupOptions(fieldDef.lookup);
                        const option = options.find(opt => opt.label === newValue);
                        convertedValue = option ? option.value : 0;
                    } else if (fieldDef.type === 'numeric') {
                        // Convert numeric values
                        convertedValue = parseInt(newValue) || 0;

                        // Handle weight conversion: display value 160+ lbs = roster value 1+
                        if (fieldName === 'PWGT') {
                            convertedValue = convertedValue - 159;
                        }

                        // Handle PID changes - update Player Pic automatically
                        if (fieldName === 'PSXP') {
                            const playerName = getPlayerNameFromPID(convertedValue);
                            // Update PLAYERPIC with the looked-up name (or 'Generic Face' if not found)
                            this.players[actualPlayerIndex]['PLAYERPIC'] = playerName;
                            this.updateGridCell(row, 'PLAYERPIC', playerName);
                        }

                        // Apply save transform if defined (e.g., salary/bonus: multiply by 1000)
                        if (fieldDef.transform && fieldDef.transform.save) {
                            convertedValue = fieldDef.transform.save(convertedValue);
                        }
                    }
                    // Text fields keep their value as-is

                    // Update the player data
                    this.players[actualPlayerIndex][fieldName] = convertedValue;
                }
            }
        });
    }

    /**
     * Update a specific grid cell without triggering change events
     */
    updateGridCell(row, fieldName, value) {
        if (!this.hotTable || !this.currentFieldMapping) return;

        const colIndex = this.currentFieldMapping.indexOf(fieldName);
        if (colIndex === -1) return;

        // Temporarily disable change events to prevent recursion
        this.disableChangeEvents = true;

        // Update the cell value
        this.hotTable.setDataAtCell(row, colIndex, value, 'internal');

        setTimeout(() => {
            this.disableChangeEvents = false;
        }, 0);
    }

    // Custom renderer for PID field - renders input with autocomplete
    pidRenderer(instance, td, row, col, prop, value, cellProperties) {
        const rowData = instance.getDataAtRow(row);
        const psxpIndex = this.currentFieldMapping.indexOf('PSXP');
        const picIndex = this.currentFieldMapping.indexOf('PLAYERPIC');
        const currentPID = psxpIndex !== -1 ? rowData[psxpIndex] : '';
        const currentName = getPlayerNameFromPID(currentPID);

        td.innerHTML = `
            <div class="pid-input-container">
                <input type="number"
                       class="pid-number-input"
                       value="${currentPID || ''}"
                       data-row="${row}"
                       data-col="${col}"
                       style="width: 60px; display: inline-block; margin-right: 5px;">
                <input type="text"
                       class="pid-name-input"
                       value="${currentName}"
                       data-row="${row}"
                       data-col="${col}"
                       placeholder="Type player name..."
                       style="width: 120px; display: inline-block;">
                <div class="pid-suggestions" style="display: none; position: absolute; z-index: 1000; background: white; border: 1px solid #ccc; max-height: 200px; overflow-y: auto;"></div>
            </div>
        `;

        return td;
    }

    // Custom renderer for Player Pic field - editable with autocomplete
    playerPicRenderer(instance, td, row, col, prop, value, cellProperties) {
        const rowData = instance.getDataAtRow(row);
        const psxpIndex = this.currentFieldMapping.indexOf('PSXP');
        const currentPID = psxpIndex !== -1 ? rowData[psxpIndex] : '';
        const playerName = getPlayerNameFromPID(currentPID);

        td.innerHTML = `
            <div class="player-pic-container">
                <input type="text"
                       class="player-pic-input"
                       value="${playerName}"
                       data-row="${row}"
                       data-col="${col}"
                       placeholder="Type player name..."
                       style="width: 100%; border: none; background: transparent;">
                <div class="player-pic-suggestions" style="display: none; position: absolute; z-index: 1000; background: white; border: 1px solid #ccc; max-height: 200px; overflow-y: auto;"></div>
            </div>
        `;
        return td;
    }

    // Setup event listeners for PID inputs after grid renders
    setupPIDEventListeners() {
        if (!this.hotTable) return;

        const container = this.hotTable.rootElement;
        if (!container) return;

        // PID number input -> Player name sync (in PSXP column)
        container.querySelectorAll('.pid-number-input').forEach(input => {
            const clone = input.cloneNode(true);
            input.parentNode.replaceChild(clone, input);

            clone.addEventListener('input', (e) => {
                const row = parseInt(e.target.dataset.row);
                const pidValue = parseInt(e.target.value.trim()) || 0;
                const playerName = getPlayerNameFromPID(pidValue) || 'Generic Face';

                // Update the name input in same cell
                const nameInput = e.target.parentElement.querySelector('.pid-name-input');
                if (nameInput) nameInput.value = playerName;

                // Update Player Pic column (separate column)
                const playerPicInput = container.querySelector(`tr:nth-child(${row + 2}) .player-pic-input`);
                if (playerPicInput) playerPicInput.value = playerName;

                // Update underlying data
                this.hotTable.setDataAtCell(row, this.currentFieldMapping.indexOf('PSXP'), pidValue, 'internal');

                // Force re-render of both columns
                this.hotTable.render();
            });
        });

        // PID name input autocomplete (in PSXP column)
        container.querySelectorAll('.pid-name-input').forEach(input => {
            const clone = input.cloneNode(true);
            input.parentNode.replaceChild(clone, input);

            clone.addEventListener('input', (e) => {
                const row = parseInt(e.target.dataset.row);
                const searchText = e.target.value.trim().toLowerCase();
                const suggestionsDiv = e.target.parentElement.querySelector('.pid-suggestions');

                if (searchText.length >= 2) {
                    const suggestions = searchPIDNames(searchText);
                    if (suggestions.length > 0) {
                        suggestionsDiv.innerHTML = suggestions.slice(0, 10).map(name =>
                            `<div class="pid-suggestion" data-name="${name}" style="padding: 5px; cursor: pointer;">${name}</div>`
                        ).join('');
                        suggestionsDiv.style.display = 'block';

                        suggestionsDiv.querySelectorAll('.pid-suggestion').forEach(suggestion => {
                            suggestion.addEventListener('click', () => {
                                const selectedName = suggestion.dataset.name;
                                const pid = getPIDFromName(selectedName);

                                // Update inputs in PSXP column
                                e.target.value = selectedName;
                                const numberInput = e.target.parentElement.querySelector('.pid-number-input');
                                if (numberInput) numberInput.value = pid;

                                // Update Player Pic column
                                const playerPicInput = container.querySelector(`tr:nth-child(${row + 2}) .player-pic-input`);
                                if (playerPicInput) playerPicInput.value = selectedName;

                                // Update underlying data
                                this.hotTable.setDataAtCell(row, this.currentFieldMapping.indexOf('PSXP'), pid, 'internal');

                                suggestionsDiv.style.display = 'none';
                                this.hotTable.render();
                            });
                        });
                    } else {
                        suggestionsDiv.style.display = 'none';
                    }
                } else {
                    suggestionsDiv.style.display = 'none';
                }
            });

            clone.addEventListener('blur', (e) => {
                setTimeout(() => {
                    const suggestionsDiv = e.target.parentElement.querySelector('.pid-suggestions');
                    if (suggestionsDiv) suggestionsDiv.style.display = 'none';
                }, 200);
            });
        });

        // Player Pic column autocomplete (separate column)
        container.querySelectorAll('.player-pic-input').forEach(input => {
            const clone = input.cloneNode(true);
            input.parentNode.replaceChild(clone, input);

            clone.addEventListener('input', (e) => {
                const row = parseInt(e.target.dataset.row);
                const searchText = e.target.value.trim().toLowerCase();
                const suggestionsDiv = e.target.parentElement.querySelector('.player-pic-suggestions');

                if (searchText.length >= 2) {
                    const suggestions = searchPIDNames(searchText);
                    if (suggestions.length > 0) {
                        suggestionsDiv.innerHTML = suggestions.slice(0, 10).map(name =>
                            `<div class="pic-suggestion" data-name="${name}" style="padding: 5px; cursor: pointer;">${name}</div>`
                        ).join('');
                        suggestionsDiv.style.display = 'block';

                        suggestionsDiv.querySelectorAll('.pic-suggestion').forEach(suggestion => {
                            suggestion.addEventListener('click', () => {
                                const selectedName = suggestion.dataset.name;
                                const pid = getPIDFromName(selectedName);

                                // Update Player Pic input
                                e.target.value = selectedName;

                                // Update PSXP column inputs
                                const pidNumberInput = container.querySelector(`tr:nth-child(${row + 2}) .pid-number-input`);
                                const pidNameInput = container.querySelector(`tr:nth-child(${row + 2}) .pid-name-input`);
                                if (pidNumberInput) pidNumberInput.value = pid;
                                if (pidNameInput) pidNameInput.value = selectedName;

                                // Update underlying data
                                this.hotTable.setDataAtCell(row, this.currentFieldMapping.indexOf('PSXP'), pid, 'internal');

                                suggestionsDiv.style.display = 'none';
                                this.hotTable.render();
                            });
                        });
                    } else {
                        suggestionsDiv.style.display = 'none';
                    }
                } else {
                    suggestionsDiv.style.display = 'none';
                }
            });

            clone.addEventListener('blur', (e) => {
                setTimeout(() => {
                    const suggestionsDiv = e.target.parentElement.querySelector('.player-pic-suggestions');
                    if (suggestionsDiv) suggestionsDiv.style.display = 'none';
                }, 200);
            });
        });
    }

    updatePlayerFieldValue(row, fieldName, value) {
        if (!this.players || !this.players[row]) return;

        // Update the player data
        this.players[row][fieldName] = value;

        // Mark as modified
        this.hasUnsavedChanges = true;
        document.getElementById('saveRosterBtn').style.display = 'inline-block';
    }

    getPlayerPropertyName(fieldName) {
        // Map display field names to actual player object properties
        const fieldMap = {
            'Age': 'PAGE',
            'Height': 'PHGT',
            'Weight': 'PWGT',
            'Speed': 'PSPD',
            'Acceleration': 'PACC',
            'Strength': 'PSTR',
            'Agility': 'PAGI',
            'Awareness': 'PAWR',
            'Injury': 'PINJ',
            'Jump': 'PJMP',
            'Stamina': 'PSTA',
            'Carrying': 'PCAR',
            'Catching': 'PCTH',
            'PFNA': 'PFNA',
            'PLNA': 'PLNA'
        };

        return fieldMap[fieldName] || fieldName;
    }

    getPositionName(posId) {
        const positions = {
            0: 'QB', 1: 'HB', 2: 'WR', 3: 'TE', 4: 'LT', 5: 'LG',
            6: 'C', 7: 'RG', 8: 'RT', 9: 'DT', 10: 'LEDG', 11: 'REDG',
            12: 'SAM', 13: 'Mike', 14: 'WILL', 15: 'CB', 16: 'FS', 17: 'SS',
            18: 'K', 19: 'P'
        };
        return positions[posId] || 'Unknown';
    }

    applyFiltersAndSort() {
        // Start with all players
        let filtered = [...this.players];

        // Apply team filter
        if (this.selectedTeamId !== null) {
            filtered = filtered.filter(player => {
                return player.TGID === this.selectedTeamId;
            });
        }

        // Apply position filter
        if (this.selectedPosition) {
            filtered = filtered.filter(player => {
                const position = getLookupValue('positions', player.PPOS);
                return position === this.selectedPosition;
            });
        }

        // Apply sorting
        if (this.sortColumns.length > 0) {
            filtered.sort((a, b) => {
                // Multi-column sort - check each sort column in order
                for (const sortCol of this.sortColumns) {
                    const fieldName = sortCol.column;
                    const valueA = this.getPlayerFieldValue(a, fieldName);
                    const valueB = this.getPlayerFieldValue(b, fieldName);

                    // Compare values
                    let comparison = 0;

                    // Handle empty values
                    if (valueA === '' || valueA === null || valueA === undefined) {
                        comparison = 1;
                    } else if (valueB === '' || valueB === null || valueB === undefined) {
                        comparison = -1;
                    } else if (typeof valueA === 'number' && typeof valueB === 'number') {
                        // Numeric comparison
                        comparison = valueA - valueB;
                    } else {
                        // String comparison (case insensitive)
                        const strA = String(valueA).toLowerCase();
                        const strB = String(valueB).toLowerCase();
                        comparison = strA.localeCompare(strB);
                    }

                    // Apply sort order
                    if (comparison !== 0) {
                        return sortCol.order === 'asc' ? comparison : -comparison;
                    }

                    // If equal, continue to next sort column
                }
                return 0;
            });
        }

        // Store filtered and sorted result
        this.filteredPlayers = filtered;
    }

    setupHeaderClickHandlers() {
        // Add click handlers to sortable headers
        const headers = document.querySelectorAll('.sortable-header');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', (e) => {
                const fieldName = e.target.dataset.field;
                const isShiftKey = e.shiftKey;

                // Handle column sort
                this.toggleColumnSort(fieldName, isShiftKey);
            });
        });
    }

    toggleColumnSort(fieldName, isMultiColumn) {
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
        this.renderRoster();
    }

    filterPlayers() {
        // Reset to first page when filtering
        this.currentPage = 1;
        this.renderRoster();
    }

    updateVisibleFields() {
        // Re-render the roster with new field visibility
        this.renderRoster();
        this.updateStats();
    }

    populateTeamDropdown() {
        const teamFilter = document.getElementById('teamFilter');
        const teams = getAllTeams();

        // Clear existing options (except "All Teams")
        teamFilter.innerHTML = '<option value="">All Teams</option>';

        // Add team options
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.fullName;
            teamFilter.appendChild(option);
        });
    }

    enterTeamView(teamId) {
        if (!teamId) {
            // "All Teams" selected - exit team view
            this.exitTeamView();
            return;
        }

        const team = getTeamById(teamId);
        if (!team) return;

        // Show team header
        const teamHeader = document.getElementById('teamViewHeader');
        const teamName = document.getElementById('teamName');
        const teamLogo = document.getElementById('teamLogo');

        teamHeader.style.display = 'flex';
        teamName.textContent = team.fullName;

        // Set team logo if available
        if (team.logo) {
            teamLogo.innerHTML = `<img src="${team.logo}" alt="${team.fullName} logo" class="team-logo-img">`;
        } else {
            teamLogo.innerHTML = '';
        }

        // Apply team colors
        this.applyTeamColors(team);

        // Filter and render
        this.filterPlayers();
    }

    exitTeamView() {
        // Hide team header
        document.getElementById('teamViewHeader').style.display = 'none';

        // Reset team filter dropdown
        document.getElementById('teamFilter').value = '';
        this.selectedTeamId = null;

        // Reset colors to default
        this.resetColors();

        // Re-render
        this.filterPlayers();
    }

    applyTeamColors(team) {
        const root = document.documentElement;
        root.style.setProperty('--team-primary', team.primary);
        root.style.setProperty('--team-secondary', team.secondary);

        // Apply team colors to header
        const teamHeader = document.getElementById('teamViewHeader');
        teamHeader.style.background = `linear-gradient(135deg, ${team.primary} 0%, ${team.secondary} 100%)`;

        // Apply team colors to data grid container
        const gridContainer = document.getElementById('rosterGrid');
        if (gridContainer) {
            gridContainer.style.background = `linear-gradient(135deg, ${team.primary} 0%, ${team.secondary} 100%)`;
            gridContainer.style.padding = '2px'; // Small padding to show gradient border
            gridContainer.classList.add('team-view-active'); // Enable team-colored selections
        }

        // Apply subtle team-colored overlay to Handsontable
        const hotContainer = gridContainer.querySelector('.handsontable');
        if (hotContainer) {
            hotContainer.style.position = 'relative';
            hotContainer.style.background = '#1a1a1a'; // Keep table dark for readability
        }
    }

    resetColors() {
        const root = document.documentElement;
        root.style.removeProperty('--team-primary');
        root.style.removeProperty('--team-secondary');

        // Reset header
        document.getElementById('teamViewHeader').style.background = '';

        // Reset grid container
        const gridContainer = document.getElementById('rosterGrid');
        if (gridContainer) {
            gridContainer.style.background = '';
            gridContainer.style.padding = '';
            gridContainer.classList.remove('team-view-active'); // Disable team-colored selections
        }

        // Reset Handsontable container
        const hotContainer = gridContainer?.querySelector('.handsontable');
        if (hotContainer) {
            hotContainer.style.background = '';
        }
    }

    updateStats() {
        const playerCount = this.players.length;
        const visibleFields = getVisibleFields(this.showAllColumns);

        document.getElementById('playerCount').textContent = `${playerCount} players`;
        document.getElementById('visibleFields').textContent = `${visibleFields.length} visible fields`;
    }

    async saveRoster() {
        if (!this.currentFile) {
            this.showError('No file path specified');
            return;
        }

        if (!this.originalData) {
            this.showError('No original data available - please reload the file');
            return;
        }

        try {
            if (typeof window.electronAPI !== 'undefined') {
                // Get the directory and default to 'ROSTER-EDITED' filename
                const lastSlash = Math.max(this.currentFile.lastIndexOf('/'), this.currentFile.lastIndexOf('\\'));
                const dir = this.currentFile.substring(0, lastSlash + 1);
                const defaultPath = dir + 'ROSTER-EDITED';

                // Show save dialog
                this.setStatus('Choose save location...');
                const dialogResult = await window.electronAPI.file.saveDialog(defaultPath);

                if (dialogResult.canceled || !dialogResult.filePath) {
                    this.setStatus('Save canceled');
                    return;
                }

                const saveFilePath = dialogResult.filePath;
                console.log('[app.js] User chose save location:', saveFilePath);
                console.log('[app.js] Source file (will NOT be modified):', this.currentFile);

                this.setStatus('Saving roster...');
                this.showLoading(true);

                // Save the roster file directly to user's chosen location
                // NO backup creation - we only write to the chosen file
                console.log('[app.js] Calling saveRosterFile with chosen path...');
                const saveResult = await window.electronAPI.parser.saveRosterFile(
                    saveFilePath,
                    this.players,
                    this.originalData
                );

                if (saveResult.success) {
                    const lastSlash = Math.max(saveFilePath.lastIndexOf('/'), saveFilePath.lastIndexOf('\\'));
                    const fileName = saveFilePath.substring(lastSlash + 1);
                    this.setStatus('Roster saved successfully to ' + fileName);
                    console.log('Roster saved successfully');
                } else {
                    throw new Error(saveResult.error || 'Unknown save error');
                }

                this.showLoading(false);
            } else {
                // Simulate save for testing
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.setStatus('Roster saved (simulation)');
                console.log('Roster saved (simulation - no Electron API)');
            }
        } catch (error) {
            console.error('Error saving roster:', error);
            this.showError(`Failed to save roster: ${error.message}`);
            this.showLoading(false);
        }
    }

    showLoading(show, text = 'Loading...', progress = 0) {
        const indicator = document.getElementById('loadingIndicator');
        const loadingText = document.getElementById('loadingText');
        const loadingBar = document.getElementById('loadingBar');

        indicator.style.display = show ? 'flex' : 'none';
        loadingText.textContent = show ? text : '';

        if (show && progress > 0) {
            loadingBar.style.width = `${Math.min(progress, 100)}%`;
        } else {
            loadingBar.style.width = '0%';
        }
    }

    updateLoadingProgress(text, progress) {
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loadingBar').style.width = `${Math.min(progress, 100)}%`;
    }

    updatePaginationUI() {
        const paginationControls = document.getElementById('paginationControls');
        const paginationInfo = document.getElementById('paginationInfo');
        const currentPageIndicator = document.getElementById('currentPageIndicator');
        const firstPageBtn = document.getElementById('firstPageBtn');
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        const lastPageBtn = document.getElementById('lastPageBtn');
        const pageInput = document.getElementById('pageInput');

        if (this.players.length === 0) {
            paginationControls.style.display = 'none';
            return;
        }

        // Show pagination controls
        paginationControls.style.display = 'flex';

        // Update pagination info
        const startIndex = (this.currentPage - 1) * this.rowsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.rowsPerPage, this.players.length);
        paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${this.players.length} players`;
        currentPageIndicator.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        pageInput.max = this.totalPages;
        pageInput.placeholder = String(this.currentPage);

        // Update button states
        firstPageBtn.disabled = this.currentPage === 1;
        prevPageBtn.disabled = this.currentPage === 1;
        nextPageBtn.disabled = this.currentPage === this.totalPages;
        lastPageBtn.disabled = this.currentPage === this.totalPages;
    }

    goToPage(page) {
        const targetPage = Math.max(1, Math.min(page, this.totalPages));
        if (targetPage !== this.currentPage) {
            this.currentPage = targetPage;
            this.showLoading(true, 'Switching page...', 50);
            setTimeout(() => {
                this.renderRoster();
                this.showLoading(false);
            }, 100);
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    firstPage() {
        this.goToPage(1);
    }

    lastPage() {
        this.goToPage(this.totalPages);
    }

    setStatus(text) {
        document.getElementById('statusText').textContent = text;
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorModal').style.display = 'flex';
    }

    closeErrorModal() {
        document.getElementById('errorModal').style.display = 'none';
    }
}

// Global function for modal close button
function closeErrorModal() {
    if (window.app) {
        window.app.closeErrorModal();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MaddenEditorApp();

    // Debug function for testing PID lookups in browser console
    window.testPIDLookup = function() {
        console.log('=== Testing PID Lookup ===');
        console.log('Testing getPlayerNameFromPID(1):', getPlayerNameFromPID(1));
        console.log('Testing getPlayerNameFromPID(20):', getPlayerNameFromPID(20));
        console.log('Testing getPlayerNameFromPID(999999):', getPlayerNameFromPID(999999));
        console.log('Testing getPIDFromName("Gary Anderson"):', getPIDFromName("Gary Anderson"));
        console.log('Testing getPIDFromName("Morten Andersen"):', getPIDFromName("Morten Andersen"));
        console.log('Testing getPIDFromName("Invalid Name"):', getPIDFromName("Invalid Name"));
        console.log('Testing searchPIDNames("Anderson", 5):', searchPIDNames("Anderson", 5));
        console.log('=== Test Complete ===');
    };
});

// Export for ES6 module use
export default MaddenEditorApp;