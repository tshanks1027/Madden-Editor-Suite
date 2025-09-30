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

class MaddenEditorApp {
    constructor() {
        this.currentTool = 'roster';
        this.currentFile = null;
        this.players = [];
        this.lookupReady = false;
        this.selectedPosition = '';
        this.showAllColumns = false;
        this.disableChangeEvents = false;

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
        document.getElementById('positionFilter').addEventListener('change', (e) => {
            this.selectedPosition = e.target.value;
            this.filterPlayers();
        });

        document.getElementById('showAllColumns').addEventListener('change', (e) => {
            this.showAllColumns = e.target.checked;
            this.updateVisibleFields();
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
        try {
            if (typeof window.electronAPI !== 'undefined') {
                // Use Electron dialog API to get the full file path
                const result = await window.electronAPI.file.openDialog([
                    { name: 'All Files', extensions: ['*'] },
                    { name: 'Roster Files', extensions: [] }
                ]);

                if (result.success && result.filePath) {
                    await this.loadRosterFile(result.filePath);
                } else if (result.canceled) {
                    console.log('File selection canceled');
                } else if (result.error) {
                    this.showError(`Failed to open file: ${result.error}`);
                }
            } else {
                // Fallback for testing without Electron
                console.warn('Electron API not available - using HTML file input fallback');
                document.getElementById('fileInput').click();
            }
        } catch (error) {
            console.error('Error opening file dialog:', error);
            this.showError(`Failed to open file dialog: ${error.message}`);
        }
    }

    async loadRosterFile(filePath) {
        if (!filePath) return;

        this.setStatus('Loading file...');
        this.showLoading(true);

        try {
            const fileName = filePath.replace(/^.*[\\/]/, ''); // Extract filename from path
            console.log('Loading roster file:', fileName, 'Path:', filePath);

            // Update UI
            this.setCurrentFile(filePath);

            // Use real parser from backend
            if (typeof window.electronAPI !== 'undefined') {
                console.log('Loading roster file using real parser...');
                const result = await window.electronAPI.parser.parseRosterFile(filePath);
                console.log('Parse result:', result);

                if (result.success && result.data) {
                    // Extract players from the parse result
                    this.players = result.data.players || [];
                    this.originalData = result.data; // Store for saving

                    this.renderRoster();
                    this.setStatus(`Loaded ${this.players.length} players from ${fileName}`);
                } else {
                    throw new Error(result.error || 'Unknown parsing error');
                }
            } else {
                // Fallback to sample data for testing without Electron
                console.log('Electron API not available - loading sample data for testing');
                this.loadSampleData();
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
                return fieldDef.display;
            });
        } else {
            // For basic fields mode, extract from tuple structure
            fieldCodes = visibleFields.map(field => Array.isArray(field) ? field[0] : field);
            displayNames = visibleFields.map(field => Array.isArray(field) ? field[1] : getFieldDefinition(field).display);
        }

        // Prepare data and columns for Handsontable
        const data = this.players.map(player => {
            return fieldCodes.map(fieldName => {
                return this.getPlayerFieldValue(player, fieldName);
            });
        });

        const columns = fieldCodes.map(fieldName => {
            const fieldDef = getFieldDefinition(fieldName);
            let columnConfig = {
                width: fieldDef.width,
                readOnly: !fieldDef.editable,
                allowInvalid: false
            };

            // Configure column type and editor based on field type
            if (fieldDef.type === 'lookup' && fieldDef.lookup) {
                // Dropdown for lookup fields
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
                // Special handling for PID field with custom renderer
                columnConfig = {
                    ...columnConfig,
                    type: 'text',
                    renderer: this.pidRenderer.bind(this),
                    readOnly: false,  // Override to ensure it's editable
                    validator: fieldDef.editable ? (value, callback) => {
                        const validation = validateFieldValue(fieldName, value);
                        callback(validation.isValid);
                    } : undefined
                };
            } else if (fieldName === 'PLAYERPIC') {
                // Special handling for Player Pic field with custom renderer
                columnConfig = {
                    ...columnConfig,
                    type: 'text',
                    renderer: this.playerPicRenderer.bind(this),
                    readOnly: false  // Make it editable with autocomplete
                };
            } else if (fieldDef.type === 'numeric') {
                // Numeric fields
                columnConfig = {
                    ...columnConfig,
                    type: 'numeric',
                    format: '0',
                    validator: fieldDef.editable ? (value, callback) => {
                        const validation = validateFieldValue(fieldName, value);
                        callback(validation.isValid);
                    } : undefined
                };
            } else {
                // Text fields
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

        // Initialize Handsontable with proper validation and editing
        this.hotTable = new Handsontable(hotContainer, {
            data: data,
            colHeaders: displayNames,
            columns: columns,
            rowHeaders: true,
            width: '100%',
            height: '100%',
            licenseKey: 'non-commercial-and-evaluation',

            // Styling to match MyFranchise
            className: 'madden-grid',

            // Grid behavior
            stretchH: 'none',
            autoColumnSize: false,
            manualColumnResize: true,
            manualRowResize: false,

            // Selection
            selectionMode: 'multiple',
            outsideClickDeselects: false,

            // Scrolling
            scrollH: true,
            scrollV: true,

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
                return {
                    renderer: this.customCellRenderer,
                    className: fieldDef.editable ? 'editable-cell' : 'readonly-cell'
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

            // Setup PID event listeners after rendering
            afterRender: () => {
                this.setupPIDEventListeners();
            }
        });

        this.updateStats();
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
        // Use default renderer first
        Handsontable.renderers.TextRenderer.apply(this, arguments);

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
            if (oldValue !== newValue && this.players[row] && this.currentFieldMapping) {
                const fieldName = this.currentFieldMapping[colIndex];
                const fieldDef = getFieldDefinition(fieldName);

                if (fieldDef.editable) {
                    let convertedValue = newValue;

                    // Handle lookup fields - convert display name back to ID
                    if (fieldDef.type === 'lookup' && fieldDef.lookup) {
                        const options = getLookupOptions(fieldDef.lookup);
                        const option = options.find(opt => opt.label === newValue);
                        convertedValue = option ? option.value : 0;
                    } else if (fieldDef.type === 'numeric') {
                        // Convert numeric values
                        convertedValue = parseInt(newValue) || 0;
                    } else if (fieldDef.type === 'autocomplete' && fieldDef.lookup === 'pids') {
                        // Handle Player Pic autocomplete - convert name to PID and store as text
                        const pid = getPIDFromName(newValue);
                        if (pid !== null) {
                            // Valid player name selected, update corresponding PID
                            this.players[row]['PSXP'] = pid;
                            this.updateGridCell(row, 'PSXP', pid);
                        }
                        // Always store the display name as-is for Player Pic
                        convertedValue = newValue;
                    }
                    // Text fields keep their value as-is

                    // Update the player data
                    this.players[row][fieldName] = convertedValue;

                    // Handle PID -> Player Pic sync (when PID changes, update Player Pic)
                    if (fieldName === 'PSXP') {
                        const playerName = getPlayerNameFromPID(convertedValue);
                        this.players[row]['PLAYERPIC'] = playerName;
                        this.updateGridCell(row, 'PLAYERPIC', playerName);
                    }

                    console.log(`Updated player ${row} ${fieldName}: ${oldValue} -> ${newValue} (stored as ${convertedValue})`);
                }
            }
        });
    }

    /**
     * Update a specific grid cell without triggering change events
     */
    updateGridCell(row, fieldName, value) {
        if (!this.rosterGrid || !this.currentFieldMapping) return;

        const colIndex = this.currentFieldMapping.indexOf(fieldName);
        if (colIndex === -1) return;

        // Temporarily disable change events to prevent recursion
        this.disableChangeEvents = true;

        // For PLAYERPIC field, we need special handling since it's computed from PSXP
        if (fieldName === 'PLAYERPIC') {
            // Don't update the grid directly - it will be recomputed during next refresh
            // Instead, trigger a refresh of this specific cell
            setTimeout(() => {
                // Force re-render of this specific cell
                this.rosterGrid.render();
                this.disableChangeEvents = false;
            }, 0);
        } else {
            // For other fields, update the cell normally
            this.rosterGrid.setDataAtCell(row, colIndex, value, 'internal');
            setTimeout(() => {
                this.disableChangeEvents = false;
            }, 0);
        }
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

    filterPlayers() {
        // TODO: Implement position filtering
        this.renderRoster();
    }

    updateVisibleFields() {
        // Re-render the roster with new field visibility
        this.renderRoster();
        this.updateStats();
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

        this.setStatus('Saving roster...');
        this.showLoading(true);

        try {
            if (typeof window.electronAPI !== 'undefined') {
                // Create backup first
                console.log('Creating backup...');
                const backupResult = await window.electronAPI.file.createBackup(this.currentFile);

                if (backupResult.success && backupResult.backupPath) {
                    console.log('Backup created:', backupResult.backupPath);
                } else if (backupResult.skipped) {
                    console.log('Backup skipped (new file)');
                }

                // Save the roster file
                console.log('Saving roster file...');
                const saveResult = await window.electronAPI.parser.saveRosterFile(
                    this.currentFile,
                    this.players,
                    this.originalData
                );

                if (saveResult.success) {
                    this.setStatus('Roster saved successfully');
                    console.log('Roster saved successfully');
                } else {
                    throw new Error(saveResult.error || 'Unknown save error');
                }
            } else {
                // Simulate save for testing
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.setStatus('Roster saved (simulation)');
                console.log('Roster saved (simulation - no Electron API)');
            }
        } catch (error) {
            console.error('Error saving roster:', error);
            this.showError(`Failed to save roster: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        document.getElementById('loadingIndicator').style.display = show ? 'flex' : 'none';
        document.getElementById('loadingText').textContent = show ? 'Loading...' : '';
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
});

// Export for ES6 module use
export default MaddenEditorApp;