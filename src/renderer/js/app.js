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
    TEAM_MAPPINGS
} from '../data/field-definitions.js';

class MaddenEditorApp {
    constructor() {
        this.currentTool = 'roster';
        this.currentFile = null;
        this.players = [];
        this.lookupReady = false;
        this.selectedPosition = '';
        this.showAllColumns = false;

        this.init();
    }

    async init() {
        console.log('Initializing Madden Editor Suite...');

        // Show splash screen for 2 seconds
        setTimeout(() => {
            this.hideSplashScreen();
        }, 2000);

        // Initialize lookup system
        await this.initializeLookup();

        // Setup event listeners
        this.setupEventListeners();

        // Initialize with sample data if no file loaded
        this.loadSampleData();

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
        document.getElementById('openFileBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
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

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.setStatus('Loading file...');
        this.showLoading(true);

        try {
            // For now, just use the file name and load sample data
            // File validation will be implemented when Electron APIs are working
            const fileName = file.name;
            console.log('Selected file:', fileName);

            // Update UI
            this.setCurrentFile(fileName);

            // Load sample data for now
            console.log('Loading sample data (file parsing not yet implemented)');
            this.loadSampleData();

            this.renderRoster();
            this.setStatus(`Loaded ${this.players.length} players from ${fileName}`);

        } catch (error) {
            console.error('Error loading file:', error);
            this.showError(`Failed to load file: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
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
                TGID: 1, // Bears
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
                PSXP: 0
            },
            {
                PGID: 2,
                PLNA: 'Johnson',
                PFNA: 'Mike',
                PPOS: 1, // HB
                TGID: 2, // Bengals
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
                PSXP: 0
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
            return {
                type: fieldDef.type === 'numeric' ? 'numeric' : 'text',
                width: fieldDef.width,
                readOnly: !fieldDef.editable,
                format: fieldDef.type === 'numeric' ? '0' : undefined,
                validator: fieldDef.editable ? (value, callback) => {
                    const validation = validateFieldValue(fieldName, value);
                    callback(validation.isValid);
                } : undefined,
                allowInvalid: false
            };
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
            }
        });

        this.updateStats();
    }

    getPlayerFieldValue(player, fieldName) {
        // Handle direct field mappings first
        if (player[fieldName] !== undefined) {
            return player[fieldName];
        }

        // Handle special computed fields
        switch (fieldName) {
            case 'Position':
            case 'PPOS':
                return POSITION_MAPPINGS[player.PPOS] || 'Unknown';
            case 'Team':
            case 'TGID':
                return TEAM_MAPPINGS[player.TGID] || 'Unknown';
            case 'Overall':
            case 'POVR':
                return player.POVR || 0;
            case 'Age':
            case 'PAGE':
                return player.PAGE || 0;
            case 'Height':
            case 'PHGT':
                return player.PHGT || 0;
            case 'Weight':
            case 'PWGT':
                return player.PWGT || 0;
            case 'Speed':
            case 'PSPD':
                return player.PSPD || 0;
            case 'Acceleration':
            case 'PACC':
                return player.PACC || 0;
            case 'Strength':
            case 'PSTR':
                return player.PSTR || 0;
            case 'Agility':
            case 'PAGI':
                return player.PAGI || 0;
            case 'Awareness':
            case 'PAWR':
                return player.PAWR || 0;
            case 'Injury':
            case 'PINJ':
                return player.PINJ || 0;
            case 'College':
            case 'PCOL':
                return player.PCOL ? `College ${player.PCOL}` : 'Unknown';
            case 'State':
            case 'PHSN':
                return player.PHSN ? `State ${player.PHSN}` : 'Unknown';
            case 'Jump':
            case 'PJMP':
                return player.PJMP || 0;
            case 'Stamina':
            case 'PSTA':
                return player.PSTA || 0;
            case 'Carrying':
            case 'PCAR':
                return player.PCAR || 0;
            case 'Catching':
            case 'PCTH':
                return player.PCTH || 0;
            default:
                // Return 0 for unknown numeric fields, empty string for others
                return 0;
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
        // Update player data based on Handsontable changes
        changes.forEach(([row, colIndex, oldValue, newValue]) => {
            if (oldValue !== newValue && this.players[row] && this.currentFieldMapping) {
                const fieldName = this.currentFieldMapping[colIndex];
                const fieldDef = getFieldDefinition(fieldName);

                if (fieldDef.editable) {
                    // Convert value based on field type
                    let convertedValue = newValue;
                    if (fieldDef.type === 'numeric') {
                        convertedValue = parseInt(newValue) || 0;
                    }

                    // Map field name to player property
                    const playerProp = this.getPlayerPropertyName(fieldName);
                    if (playerProp) {
                        this.players[row][playerProp] = convertedValue;
                        console.log(`Updated player ${row} ${fieldName} (${playerProp}): ${oldValue} -> ${convertedValue}`);
                    }
                }
            }
        });
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

        this.setStatus('Saving roster...');
        this.showLoading(true);

        try {
            if (typeof window.electronAPI !== 'undefined') {
                // Create backup first
                await window.electronAPI.file.createBackup(this.currentFile);

                // Build updated roster file
                const rosterBuffer = await window.electronAPI.parser.buildRosterFile(
                    this.players,
                    { version: 26 }
                );

                // Save the file
                await window.electronAPI.file.saveFile(this.currentFile, rosterBuffer);

                this.setStatus('Roster saved successfully');
                console.log('Roster saved successfully');
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