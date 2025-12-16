/**
 * Madden Editor Suite - Main Application JavaScript
 * Vanilla JavaScript implementation inspired by MyFranchise architecture
 */

import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';
// Expose Handsontable globally for use in non-module scripts (e.g., draft-wizard.js)
window.Handsontable = Handsontable;

// Import AG-Grid for main roster table
import { createGrid } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
    initializeAGGridRoster,
    updateAGGridData,
    destroyAGGrid,
    applyHeaderColors
} from './ag-grid-roster-complete.js';

// Import wizard scripts to ensure they're bundled by Vite
import './draft-wizard.js';
import './roster-wizard.js';
import '../update-notification.js';

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
    getPIDFromPLPO,
    getPlayerNameFromPID,
    searchPIDNames,
    getBodyTypeFromWeight,
    storedWeightToActual,
    BODY_TYPE_NAMES
} from '../data/field-definitions.js';
import { NFL_TEAMS, getAllTeams, getTeamById } from '../data/team-data.js';

// Clear session log on renderer load (handles hot reload in dev mode)
if (typeof window.electronAPI !== 'undefined' && window.electronAPI.debug) {
    window.electronAPI.debug.clearSessionLog()
        .then(() => console.log('[App] Session debug log cleared'))
        .catch(err => console.error('[App] Failed to clear session log:', err));
}

// Intercept console.log to send to session log
(function() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = function(...args) {
        originalLog.apply(console, args);
        try {
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            window.electronAPI?.debug?.sessionLog(`[LOG] ${message}`);
        } catch (e) {
            // Silently fail if IPC not ready
        }
    };

    console.error = function(...args) {
        originalError.apply(console, args);
        try {
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            window.electronAPI?.debug?.sessionLog(`[ERROR] ${message}`);
        } catch (e) {
            // Silently fail if IPC not ready
        }
    };

    console.warn = function(...args) {
        originalWarn.apply(console, args);
        try {
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            window.electronAPI?.debug?.sessionLog(`[WARN] ${message}`);
        } catch (e) {
            // Silently fail if IPC not ready
        }
    };
})();

class MaddenEditorApp {
    constructor() {
        this.currentTool = 'roster';
        this.currentFile = null;
        this.players = [];
        this.filteredPlayers = []; // Filtered/sorted view of players
        this.lookupReady = false;
        this.selectedPosition = '';
        this.selectedTeamId = null; // null = all teams, number = specific team
        this.rosterSearchTerm = ''; // Search term for roster editor
        this.collegeSearchTerm = ''; // College search term for roster editor
        this.pidSearchTerm = ''; // PID search term for roster editor
        this.emptyFieldFilter = ''; // Empty field filter ('position', 'college', 'pid')
        this.draftSearchTerm = ''; // Search term for draft class editor
        this.disableChangeEvents = false;

        // Pagination settings
        this.currentPage = 1;
        this.rowsPerPage = 100;
        this.totalPages = 1;

        // Sorting state
        this.sortColumns = []; // Array of {column: fieldName, order: 'asc'|'desc'}

        // Draft class state
        this.currentDraftClass = null;
        this.currentDraftFilePath = null;
        this.draftGrid = null;
        this.selectedDraftRound = ''; // Selected round filter for draft class editor

        // Portrait cache - persists across renders for performance
        this.portraitCache = new Map();

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
        if (this.players.length === 0) {
            this.renderRoster();
        }

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
            console.log('[TEAM FILTER] Change event fired, value:', e.target.value);
            const teamId = e.target.value ? parseInt(e.target.value) : null;
            console.log('[TEAM FILTER] Parsed teamId:', teamId);
            this.selectedTeamId = teamId;
            this.enterTeamView(teamId);
        });

        document.getElementById('positionFilter').addEventListener('change', (e) => {
            console.log('[POSITION FILTER] Change event fired, value:', e.target.value);
            this.selectedPosition = e.target.value;
            console.log('[POSITION FILTER] selectedPosition set to:', this.selectedPosition);
            console.log('[POSITION FILTER] Calling filterPlayers()...');
            this.filterPlayers();
        });

        // Roster search input
        document.getElementById('rosterSearchInput').addEventListener('input', (e) => {
            this.rosterSearchTerm = e.target.value.toLowerCase().trim();
            this.filterPlayers();
        });

        // College search input (optional - may not exist)
        const collegeSearch = document.getElementById('collegeSearchInput');
        if (collegeSearch) {
            collegeSearch.addEventListener('input', (e) => {
                this.collegeSearchTerm = e.target.value.toLowerCase().trim();
                this.filterPlayers();
            });
        }

        // PID search input (optional - may not exist)
        const pidSearch = document.getElementById('pidSearchInput');
        if (pidSearch) {
            pidSearch.addEventListener('input', (e) => {
                this.pidSearchTerm = e.target.value.trim();
                this.filterPlayers();
            });
        }

        // Empty field filter (optional - may not exist)
        const emptyFilter = document.getElementById('emptyFieldFilter');
        if (emptyFilter) {
            emptyFilter.addEventListener('change', (e) => {
                this.emptyFieldFilter = e.target.value;
                this.filterPlayers();
            });
        }

        // Back to all teams button
        document.getElementById('backToAllTeams').addEventListener('click', () => {
            this.exitTeamView();
        });

        document.getElementById('saveRosterBtn').addEventListener('click', () => {
            this.saveRoster();
        });

        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            this.exportRosterCSV();
        });

        document.getElementById('importCsvBtn').addEventListener('click', () => {
            this.importRosterCSV();
        });

        // Draft class controls
        document.getElementById('open-draft-btn').addEventListener('click', async () => {
            await this.openDraftClassDialog();
        });

        document.getElementById('save-draft-btn').addEventListener('click', () => {
            this.saveDraftClass();
        });

        document.getElementById('export-draft-json-btn').addEventListener('click', () => {
            this.exportDraftCSV();
        });

        document.getElementById('import-draft-csv-btn').addEventListener('click', () => {
            this.importDraftCSV();
        });

        document.getElementById('draftRoundFilter').addEventListener('change', (e) => {
            this.selectedDraftRound = e.target.value;
            this.filterDraftProspects();
        });

        document.getElementById('draftPositionFilter').addEventListener('change', (e) => {
            this.selectedDraftPosition = e.target.value;
            this.filterDraftProspects();
        });

        // Draft search input
        document.getElementById('draftSearchInput').addEventListener('input', (e) => {
            this.draftSearchTerm = e.target.value.toLowerCase().trim();
            this.filterDraftProspects();
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

        // Generic face picker modal
        document.getElementById('closeGenericFacePicker').addEventListener('click', () => {
            this.closeGenericFacePicker();
        });

        document.getElementById('genericFacePickerModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeGenericFacePicker();
            }
        });

        // Fix Faces button - assigns verified GENR values to generic face players
        const fixFacesBtn = document.getElementById('fixGenericFacesBtn');
        if (fixFacesBtn) {
            fixFacesBtn.addEventListener('click', () => {
                this.fixGenericFaces();
            });
        }

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

        // Creator screen event listeners
        const selectRosterTemplateBtn = document.getElementById('selectRosterTemplate');
        if (selectRosterTemplateBtn) {
            selectRosterTemplateBtn.addEventListener('click', async () => {
                const result = await window.electronAPI.file.openDialog(null);
                if (result.success && result.filePath && !result.canceled) {
                    const templateInput = document.getElementById('rosterTemplate');
                    templateInput.value = result.filePath;
                    // Trigger change event to re-validate
                    templateInput.dispatchEvent(new Event('change'));
                    console.log('[App] Roster template file selected:', result.filePath);
                }
            });
        }

        const selectDraftTemplateBtn = document.getElementById('selectDraftTemplate');
        const draftTemplateInput = document.getElementById('draftTemplate');

        if (selectDraftTemplateBtn && draftTemplateInput) {
            // Restore last selected template from localStorage
            const savedTemplatePath = localStorage.getItem('lastDraftTemplate');
            if (savedTemplatePath) {
                draftTemplateInput.value = savedTemplatePath;
                console.log('[App] Restored draft template path:', savedTemplatePath);
            }

            selectDraftTemplateBtn.addEventListener('click', async () => {
                const result = await window.electronAPI.file.openDialog(null);
                if (result.success && result.filePath && !result.canceled) {
                    draftTemplateInput.value = result.filePath;
                    // Save to localStorage for next time
                    localStorage.setItem('lastDraftTemplate', result.filePath);
                    console.log('[App] Saved draft template path to localStorage:', result.filePath);
                }
            });
        }

        // M25→M26 Converter event listeners
        const selectM25DraftBtn = document.getElementById('selectM25Draft');
        if (selectM25DraftBtn) {
            selectM25DraftBtn.addEventListener('click', async () => {
                // Use separate directory memory for source files
                const lastSourceDir = localStorage.getItem('m25SourceDirectory');
                const result = await window.electronAPI.file.openDialog(lastSourceDir ? lastSourceDir : null);
                if (result.success && result.filePath && !result.canceled) {
                    document.getElementById('m25DraftFile').value = result.filePath;
                    // Store full path and directory separately
                    localStorage.setItem('m25DraftPath', result.filePath);
                    const dir = result.filePath.substring(0, result.filePath.lastIndexOf('\\'));
                    localStorage.setItem('m25SourceDirectory', dir);
                    // Update filename display
                    const filename = result.filePath.substring(result.filePath.lastIndexOf('\\') + 1);
                    const filenameDisplay = document.getElementById('m25DraftFilename');
                    if (filenameDisplay) filenameDisplay.textContent = filename;
                    this.checkConverterReady();
                }
            });
        }

        const selectM26TemplateBtn = document.getElementById('selectM26Template');
        if (selectM26TemplateBtn) {
            selectM26TemplateBtn.addEventListener('click', async () => {
                // Use destination directory memory for M26 template (it's also a M26 file)
                const lastDestDir = localStorage.getItem('m26DestinationDirectory');
                const result = await window.electronAPI.file.openDialog(lastDestDir ? lastDestDir : null);
                if (result.success && result.filePath && !result.canceled) {
                    document.getElementById('m26TemplateFile').value = result.filePath;
                    localStorage.setItem('m26TemplatePath', result.filePath);
                    // Update the destination directory memory from template selection too
                    const dir = result.filePath.substring(0, result.filePath.lastIndexOf('\\'));
                    localStorage.setItem('m26DestinationDirectory', dir);
                    // Update filename display
                    const filename = result.filePath.substring(result.filePath.lastIndexOf('\\') + 1);
                    const filenameDisplay = document.getElementById('m26TemplateFilename');
                    if (filenameDisplay) {
                        filenameDisplay.textContent = filename;
                        filenameDisplay.style.color = '#2196F3';
                    }
                    this.checkConverterReady();
                }
            });
        }

        const selectM26OutputBtn = document.getElementById('selectM26Output');
        if (selectM26OutputBtn) {
            selectM26OutputBtn.addEventListener('click', async () => {
                // Use separate directory memory for destination files
                const lastDestDir = localStorage.getItem('m26DestinationDirectory');
                const result = await window.electronAPI.file.saveDialog(lastDestDir ? lastDestDir : null);
                if (result.success && result.filePath && !result.canceled) {
                    document.getElementById('m26OutputFile').value = result.filePath;
                    // Store full path and directory separately
                    localStorage.setItem('m26OutputPath', result.filePath);
                    const dir = result.filePath.substring(0, result.filePath.lastIndexOf('\\'));
                    localStorage.setItem('m26DestinationDirectory', dir);
                    // Update filename display
                    const filename = result.filePath.substring(result.filePath.lastIndexOf('\\') + 1);
                    const filenameDisplay = document.getElementById('m26OutputFilename');
                    if (filenameDisplay) filenameDisplay.textContent = filename;
                    this.checkConverterReady();
                }
            });
        }

        const convertBtn = document.getElementById('convertM25ToM26Btn');
        if (convertBtn) {
            convertBtn.addEventListener('click', () => {
                this.convertM25toM26Streamlined();
            });
        }

        // Wizard event handlers are now in draft-wizard.js and roster-wizard.js

        // Enable/disable generate buttons based on input
        const draftYearInput = document.getElementById('draftYear');
        if (draftYearInput) {
            draftYearInput.addEventListener('input', () => {
                const year = parseInt(draftYearInput.value);
                if (generateDraftBtn) {
                    generateDraftBtn.disabled = !year || year < 1936 || year > 2030;
                }
            });
        }

        const rosterYearInput = document.getElementById('rosterYear');
        const rosterTemplateInput = document.getElementById('rosterTemplate');
        if (rosterYearInput && rosterTemplateInput) {
            const checkRosterReady = () => {
                const year = parseInt(rosterYearInput.value);
                const template = rosterTemplateInput.value;
                console.log(`[App] Roster validation - Year: ${year}, Template: ${template ? 'SET' : 'NOT SET'}`);
                if (generateRosterBtn) {
                    const shouldDisable = !year || year < 1920 || year > 2025 || !template;
                    generateRosterBtn.disabled = shouldDisable;
                    console.log(`[App] Generate roster button ${shouldDisable ? 'DISABLED' : 'ENABLED'}`);
                }
            };
            rosterYearInput.addEventListener('input', checkRosterReady);
            rosterTemplateInput.addEventListener('change', checkRosterReady);
            checkRosterReady(); // Check on load
        }

        // Load saved paths from localStorage
        this.loadConverterPaths();
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

        // CRITICAL FIX: Reset wizard state when switching to generator tools
        // This ensures wizards start fresh and don't stay stuck on results step
        if (toolName === 'create-roster' && window.rosterWizard && typeof window.rosterWizard.restart === 'function') {
            console.log('[App] Resetting roster wizard state on tool switch');
            window.rosterWizard.restart();
        } else if (toolName === 'create-draft' && window.draftWizard && typeof window.draftWizard.restart === 'function') {
            console.log('[App] Resetting draft wizard state on tool switch');
            window.draftWizard.restart();
        }
    }

    async openFileDialog() {
        console.log('[app.js] ===== OPEN FILE DIALOG =====');
        try {
            if (typeof window.electronAPI !== 'undefined') {
                console.log('[app.js] Step 1: Calling file.openDialog()...');
                const result = await window.electronAPI.file.openDialog(null);
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

    /**
     * Create a new empty roster from scratch
     * Allows users to build a roster entirely from the database
     */
    createNewRoster() {
        console.log('[app.js] Creating new empty roster');

        // Clear existing data
        this.players = [];
        this.filteredPlayers = [];
        this.originalData = null;
        this.currentFile = null;

        // Set flag so renderRoster creates grid even with no players
        this._isNewRoster = true;

        // Clear tracking for fresh roster
        if (window.electronAPI && window.electronAPI.editorTracking) {
            window.electronAPI.editorTracking.clear('roster');
        }

        // Update UI - show all roster buttons
        const fileNameEl = document.getElementById('fileName');
        const currentFileEl = document.getElementById('currentFile');
        const exportBtn = document.getElementById('exportCsvBtn');
        const importBtn = document.getElementById('importCsvBtn');
        const fillDbBtn = document.getElementById('fillFromDbRosterBtn');
        const saveBtn = document.getElementById('saveRosterBtn');

        if (fileNameEl) fileNameEl.textContent = 'New Roster (unsaved)';
        if (currentFileEl) currentFileEl.style.display = 'flex';
        if (exportBtn) exportBtn.style.display = 'inline-flex';
        if (importBtn) importBtn.style.display = 'inline-flex';
        if (fillDbBtn) fillDbBtn.style.display = 'inline-flex';
        if (saveBtn) saveBtn.style.display = 'inline-flex';

        console.log('[createEmptyRoster] Buttons shown');

        // Reset pagination
        this.currentPage = 1;

        // Render empty grid (will create AG-Grid even though players is empty)
        this.renderRoster();

        this.setStatus('New roster created - use Player Database to add players');
        console.log('[app.js] New empty roster created');
    }

    async loadRosterFile(filePath) {
        if (!filePath) return;

        // Reset new roster flag when loading a file
        this._isNewRoster = false;

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

                    // Pre-process calculated fields (Archetype) to avoid [object Promise] in grid
                    this.updateLoadingProgress('Converting archetypes...', 80);
                    this.players = await Promise.all(this.players.map(async player => {
                        // Convert Archetype (async IPC call)
                        if (player.PLTY !== undefined && player.PLTY !== null && player.PPOS !== undefined) {
                            try {
                                const position = POSITION_MAPPINGS[player.PPOS] || player.PPOS;
                                player.ARCHETYPE = await window.electronAPI.rating.getArchetypeName(player.PLTY, position);
                            } catch (e) {
                                player.ARCHETYPE = `Archetype #${player.PLTY}`;
                            }
                        } else {
                            player.ARCHETYPE = '';
                        }

                        return player;
                    }));

                    // Normalize body types based on weights on load
                    this.updateLoadingProgress('Normalizing body types...', 85);
                    this.normalizeBodyTypes();

                    // Reset pagination
                    this.currentPage = 1;

                    this.updateLoadingProgress('Rendering grid...', 90);
                    this.renderRoster();
                    this.setStatus(`Loaded ${this.players.length} players from ${fileName}`);

                    // Enable Fix Faces button when roster is loaded
                    const fixFacesBtn = document.getElementById('fixGenericFacesBtn');
                    if (fixFacesBtn) {
                        fixFacesBtn.style.display = 'inline-flex';
                    }
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

        // Show file info and all roster buttons
        const fileNameEl = document.getElementById('fileName');
        const currentFileEl = document.getElementById('currentFile');
        const exportBtn = document.getElementById('exportCsvBtn');
        const importBtn = document.getElementById('importCsvBtn');
        const fillDbBtn = document.getElementById('fillFromDbRosterBtn');
        const saveBtn = document.getElementById('saveRosterBtn');

        if (fileNameEl) fileNameEl.textContent = fileName;
        if (currentFileEl) currentFileEl.style.display = 'flex';
        if (exportBtn) exportBtn.style.display = 'inline-flex';
        if (importBtn) importBtn.style.display = 'inline-flex';
        if (fillDbBtn) fillDbBtn.style.display = 'inline-flex';
        if (saveBtn) saveBtn.style.display = 'inline-flex';

        console.log('[setCurrentFile] Buttons shown:', {
            exportBtn: exportBtn ? 'found' : 'NOT FOUND',
            importBtn: importBtn ? 'found' : 'NOT FOUND',
            fillDbBtn: fillDbBtn ? 'found' : 'NOT FOUND',
            saveBtn: saveBtn ? 'found' : 'NOT FOUND'
        });
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

    /**
     * Normalize body types based on weights for all players
     * This ensures body types match weights when a roster is loaded
     */
    normalizeBodyTypes() {
        let updatedCount = 0;

        for (const player of this.players) {
            if (player.PWGT === undefined || player.PWGT === null) continue;

            // PWGT is stored as (actual - 160), so convert to actual weight
            const actualWeight = storedWeightToActual(player.PWGT);
            const position = player.PPOS;
            const correctBodyType = getBodyTypeFromWeight(actualWeight, position);
            const currentBodyType = player.PCBT;

            if (correctBodyType !== currentBodyType) {
                const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim();
                if (updatedCount < 10) {
                    console.log(`[normalizeBodyTypes] ${playerName}: weight=${actualWeight}lbs, pos=${position}, body ${BODY_TYPE_NAMES[currentBodyType] || currentBodyType} -> ${BODY_TYPE_NAMES[correctBodyType]}`);
                }
                player.PCBT = correctBodyType;
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            console.log(`[normalizeBodyTypes] Fixed ${updatedCount} players with incorrect body types`);
            this.hasUnsavedChanges = true;
            const saveBtn = document.getElementById('saveRosterBtn');
            if (saveBtn) saveBtn.style.display = 'inline-block';
        } else {
            console.log('[normalizeBodyTypes] All body types already correct');
        }
    }

    renderRoster(scrollLeft = 0) {
        console.log('[renderRoster] START - sortColumns:', JSON.stringify(this.sortColumns));
        const container = document.getElementById('rosterGrid');

        // Store scroll position to restore after table creation
        this.pendingScrollLeft = scrollLeft;

        // Even if no players, we need to initialize the grid for adding players
        // Only show empty state if we haven't explicitly created a new roster
        if (this.players.length === 0 && !this._isNewRoster) {
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
        if (this.players.length > 0) {
            const beforePOVR = this.players.slice(0, 3).map(p => p.POVR);
            console.log('[renderRoster] BEFORE applyFiltersAndSort - first 3 players POVR:', beforePOVR);
        }
        this.applyFiltersAndSort();
        if (this.filteredPlayers.length > 0) {
            const afterPOVR = this.filteredPlayers.slice(0, 3).map(p => p.POVR);
            console.log('[renderRoster] AFTER applyFiltersAndSort - first 3 filtered players POVR:', afterPOVR);
        }

        // Destroy existing table
        if (this.hotTable && !this.hotTable.isDestroyed) {
            this.hotTable.destroy();
            this.hotTable = null;
        }
        if (this.agGrid) {
            destroyAGGrid(this);
        }

        // Clear container
        container.innerHTML = '';

        // Get visible fields (always use default field order)
        const visibleFields = getVisibleFields(false);

        // Extract field codes and display names from the visible fields
        let fieldCodes, displayNames;
        {
            // For basic fields mode, extract from tuple structure
            fieldCodes = visibleFields.map(field => Array.isArray(field) ? field[0] : field);
            displayNames = visibleFields.map(field => {
                const fieldName = Array.isArray(field) ? field[0] : field;
                const fieldDef = getFieldDefinition(fieldName);
                return fieldDef.shortDisplay || fieldDef.display;
            });
        }

        // Store field mapping for CSV export (with empty string for portrait column at index 0)
        this.currentFieldMapping = ['', ...fieldCodes];

        // Calculate pagination using filteredPlayers
        this.totalPages = Math.ceil(this.filteredPlayers.length / this.rowsPerPage);
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = Math.min(startIndex + this.rowsPerPage, this.filteredPlayers.length);
        const paginatedPlayers = this.filteredPlayers.slice(startIndex, endIndex);

        // Store paginated player indices for mapping back to filteredPlayers
        this.paginatedPlayerIndices = paginatedPlayers.map(player =>
            this.filteredPlayers.indexOf(player)
        );

        // Pre-load all portraits for this page in batch
        const psxpIndex = fieldCodes.indexOf('PSXP');
        let portraitsToLoad = 0;
        let portraitsLoaded = 0;

        if (psxpIndex !== -1) {
            paginatedPlayers.forEach((player) => {
                const pid = this.getPlayerFieldValue(player, 'PSXP');
                const pam = this.getPlayerFieldValue(player, 'PEPS'); // PAM/PEPS for generic face
                const plpl = this.getPlayerFieldValue(player, 'PLPL'); // 0=generic, 100=real

                // Check if this is a generic face based on PAM
                const isGenericPam = pam && typeof pam === 'string' &&
                    (pam.startsWith('gen_') || pam.startsWith('plpo_generic_') || pam.includes('generic'));

                // Allow PID 0 (blank silhouette)
                if (pid !== null && pid !== undefined) {
                    // Use PAM as cache key for generic faces, PID for real faces
                    // This ensures we show the correct generic portrait when PAM is updated
                    const cacheKey = isGenericPam ? `pam_${pam}` : `pid_${pid}`;

                    if (!this.portraitCache.has(cacheKey)) {
                        // Mark as loading and fetch
                        this.portraitCache.set(cacheKey, 'loading');
                        portraitsToLoad++;

                        // For generic faces, load by PAM directly
                        if (isGenericPam) {
                            // PAM is already in gen_ format
                            window.electronAPI.portrait.getImageDataByPam(pam).then((pamImageData) => {
                                if (pamImageData && pamImageData.length > 0) {
                                    this.portraitCache.set(cacheKey, pamImageData);
                                } else {
                                    this.portraitCache.set(cacheKey, null);
                                }
                                portraitsLoaded++;
                                if (portraitsLoaded === portraitsToLoad) {
                                    if (this.agGrid) {
                                        this.agGrid.refreshCells({ force: true });
                                    } else if (this.hotTable) {
                                        this.hotTable.render();
                                    }
                                }
                            }).catch((error) => {
                                console.error(`Error loading PAM portrait for ${pam}:`, error);
                                this.portraitCache.set(cacheKey, null);
                                portraitsLoaded++;
                                if (portraitsLoaded === portraitsToLoad) {
                                    if (this.agGrid) {
                                        this.agGrid.refreshCells({ force: true });
                                    } else if (this.hotTable) {
                                        this.hotTable.render();
                                    }
                                }
                            });
                        } else {
                            // For real faces, load by PID
                            window.electronAPI.portrait.getByPID(pid).then(async (imageData) => {
                                if (imageData && imageData.length > 0) {
                                    this.portraitCache.set(cacheKey, imageData);
                                } else {
                                    this.portraitCache.set(cacheKey, null);
                                }
                                portraitsLoaded++;
                                if (portraitsLoaded === portraitsToLoad) {
                                    if (this.agGrid) {
                                        this.agGrid.refreshCells({ force: true });
                                    } else if (this.hotTable) {
                                        this.hotTable.render();
                                    }
                                }
                            }).catch((error) => {
                                console.error(`Error loading portrait for PID ${pid}:`, error);
                                this.portraitCache.set(cacheKey, null);
                                portraitsLoaded++;
                                if (portraitsLoaded === portraitsToLoad) {
                                    if (this.agGrid) {
                                        this.agGrid.refreshCells({ force: true });
                                    } else if (this.hotTable) {
                                        this.hotTable.render();
                                    }
                                }
                            });
                        }
                    }
                }
            });

            // If all portraits already in cache, trigger re-render after table init
            if (portraitsToLoad === 0) {
                setTimeout(() => {
                    if (this.agGrid) {
                        this.agGrid.refreshCells({ force: true });
                    } else if (this.hotTable) {
                        this.hotTable.render();
                    }
                }, 100);
            }
        }

        // Initialize AG-Grid roster table
        console.log('[renderRoster] Initializing AG-Grid with', paginatedPlayers.length, 'players');
        initializeAGGridRoster(this, container, paginatedPlayers, visibleFields, displayNames, fieldCodes);

        this.updateStats();
        this.updatePaginationUI();
    }

    // OLD HANDSONTABLE CODE BELOW - KEEPING FOR REFERENCE, REMOVE LATER
    _oldRenderRosterHandsontable_REMOVE_ME() {
        // Prepare data and columns for Handsontable (only current page)
        const data = paginatedPlayers.map(player => {
            // Add portrait placeholder as first column (will be rendered from PID)
            return [
                '', // Portrait column placeholder
                ...fieldCodes.map(fieldName => {
                    return this.getPlayerFieldValue(player, fieldName);
                })
            ];
        });

        // DEBUG: Check what data Handsontable is receiving
        const povrIndex = fieldCodes.indexOf('POVR');
        if (povrIndex !== -1) {
            const firstFivePOVR = data.slice(0, 5).map(row => row[povrIndex + 1]); // +1 because portrait is first
            const paginatedPOVR = paginatedPlayers.slice(0, 5).map(p => p.POVR);
            console.log('[renderRoster] 🎯 DATA BEING SENT TO HANDSONTABLE - First 5 POVR values:', JSON.stringify(firstFivePOVR));
            console.log('[renderRoster] 🎯 Paginated players first 5 POVR:', JSON.stringify(paginatedPOVR));
            console.log('[renderRoster] 🎯 filteredPlayers first 5 POVR:', JSON.stringify(this.filteredPlayers.slice(0, 5).map(p => p.POVR)));
        }

        // Create portrait renderer function (MUST be synchronous for Handsontable)
        const portraitRenderer = (instance, td, row, col, prop, value, cellProperties) => {
            // Clear cell and set up styling
            td.innerHTML = '';
            td.style.padding = '2px';
            td.style.textAlign = 'center';
            td.style.verticalAlign = 'middle';
            td.style.backgroundColor = '#1a1a1a';

            // Get player data from the actual player object (not grid data which is a copy)
            // Use pagination mapping: grid row -> actual filteredPlayers index
            const playerIndex = this.paginatedPlayerIndices ? this.paginatedPlayerIndices[row] : row;
            const player = this.filteredPlayers[playerIndex];
            const pid = player ? player.PSXP : null;
            const pam = player ? player.PEPS : null;

            // Check for null/undefined, but allow PID 0 (blank silhouette)
            if (pid === null || pid === undefined) {
                return td;
            }

            // Check if this is a generic face based on PAM
            const isGenericPam = pam && typeof pam === 'string' &&
                (pam.startsWith('gen_') || pam.startsWith('plpo_generic_') || pam.includes('generic'));

            // Use PAM as cache key for generic faces, PID for real faces
            const cacheKey = isGenericPam ? `pam_${pam}` : `pid_${pid}`;

            // ONLY use cache - never trigger new loads during render
            if (this.portraitCache.has(cacheKey)) {
                const imageData = this.portraitCache.get(cacheKey);
                if (imageData && imageData !== 'loading') {
                    const img = document.createElement('img');
                    img.src = imageData;
                    img.style.width = '64px';
                    img.style.height = '64px';
                    img.style.objectFit = 'cover';
                    img.style.cursor = 'context-menu';

                    // Add right-click context menu for generic face picker
                    img.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        // Use mapped player index for context menu
                        const playerIndex = this.paginatedPlayerIndices ? this.paginatedPlayerIndices[row] : row;
                        const player = this.filteredPlayers[playerIndex];
                        if (player) {
                            this.openGenericFacePicker(player, row);
                        }
                    });

                    td.appendChild(img);
                } else if (imageData === 'loading') {
                    // Still loading
                    td.textContent = '...';
                    td.style.fontSize = '12px';
                    td.style.color = '#666';
                }
            }

            return td;
        };

        // Build field columns first
        const fieldColumns = fieldCodes.map((fieldName, index) => {
                const fieldDef = getFieldDefinition(fieldName);
                let columnConfig = {
                    data: index + 1, // +1 because index 0 is portrait column
                    readOnly: !fieldDef.editable,
                    allowInvalid: false
                };

            // Configure column type and editor based on field type
            // IMPORTANT: Check specific field names FIRST before generic type checks
            if (fieldName === 'PLAYERPIC') {
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
            } else if (fieldName === 'POVR') {
                // Special handling for POVR (Overall Rating) - editable with adjustment prompt
                columnConfig = {
                    ...columnConfig,
                    type: 'numeric',
                    format: '0',
                    width: 70,
                    readOnly: false,  // Allow editing OVR
                    renderer: this.ovrRenderer.bind(this)  // Custom renderer for OVR display
                };
            } else if (fieldDef.type === 'lookup' && fieldDef.lookup) {
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
            } else if (fieldDef.type === 'numeric') {
                // Numeric fields - use field width if specified, otherwise let autoColumnSize handle it
                columnConfig = {
                    ...columnConfig,
                    type: 'numeric',
                    format: '0',
                    validator: fieldDef.editable ? (value, callback) => {
                        const validation = validateFieldValue(fieldName, value);
                        callback(validation.isValid);
                    } : undefined
                };

                // Only set fixed width if field definition specifies one (for stat columns)
                if (fieldDef.width !== undefined) {
                    columnConfig.width = fieldDef.width;
                }
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

        // NOW construct the final columns array with portrait first
        const columns = [
            {
                data: 0, // Portrait column data index
                readOnly: true,
                width: 80,
                renderer: portraitRenderer
            },
            ...fieldColumns
        ];

        // Store field mapping for data changes (add empty for portrait column)
        this.currentFieldMapping = ['', ...fieldCodes];

        // Create custom column headers with tooltips and sort indicators
        const colHeaders = (colIndex) => {
            // Portrait column (index 0)
            if (colIndex === 0) {
                return '<span title="Player Portrait">📷</span>';
            }

            // Adjust index for field columns (subtract 1 to account for portrait column)
            const fieldIndex = colIndex - 1;
            const fieldName = fieldCodes[fieldIndex];
            const fieldDef = getFieldDefinition(fieldName);
            const displayName = displayNames[fieldIndex];

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
            rowHeights: 70, // Set row height to accommodate 64px portraits

            // Column sorting - DISABLED (we use custom sorting via toggleColumnSort)
            columnSorting: false,
            multiColumnSorting: false,

            // Selection
            selectionMode: 'multiple',
            outsideClickDeselects: false,

            // Scrolling
            scrollH: true,
            scrollV: true,

            // Disable frozen columns to prevent snap-left scrolling issues
            fixedColumnsStart: 0,  // No frozen columns
            preventOverflow: false,  // Allow natural scrolling

            // Fix row alignment issues with fixed columns during vertical scroll
            renderAllRows: false, // Use virtual scrolling
            viewportRowRenderingOffset: 100, // Render extra rows to prevent misalignment

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
                // Column 0 is portrait - use portrait renderer
                if (col === 0) {
                    return {
                        renderer: portraitRenderer,
                        className: 'readonly-cell'
                    };
                }

                const fieldName = this.currentFieldMapping[col];
                const fieldDef = getFieldDefinition(fieldName);

                // PSXP and POVR have custom renderers defined in columns config - don't override them
                if (fieldName === 'PSXP' || fieldName === 'POVR') {
                    return {}; // Return empty object to use column config
                }

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
            beforeChange: (changes, source) => {
                // Hook for validation if needed
            },
            afterChange: (changes, source) => {
                if (source !== 'loadData' && source !== 'GenericFacePicker' && source !== 'ovrAdjustment' && changes) {
                    this.handlePlayerDataChange(changes);

                    // Handle OVR changes - prompt to adjust ratings
                    changes.forEach(([row, col, oldValue, newValue]) => {
                        const fieldName = this.currentFieldMapping[col];
                        console.log('[OVR Check] Field:', fieldName, 'Old:', oldValue, 'New:', newValue);
                        if (fieldName === 'POVR' && newValue !== oldValue && oldValue !== null) {
                            const targetOVR = parseInt(newValue);
                            console.log('[OVR Change] Detected OVR change:', oldValue, '->', targetOVR);
                            if (!isNaN(targetOVR) && targetOVR >= 0 && targetOVR <= 99) {
                                console.log('[OVR Change] Calling handleOVRChange');
                                this.handleOVRChange(row, oldValue, targetOVR);
                            }
                        }
                    });

                    // Re-render portrait when PID (PSXP) changes
                    changes.forEach(([row, col, oldValue, newValue]) => {
                        const fieldName = this.currentFieldMapping[col]; // currentFieldMapping already has portrait at index 0
                        if (fieldName === 'PSXP' && newValue !== oldValue) {
                            const pid = parseInt(newValue);
                            const cacheKey = `pid_${pid}`;

                            // Update race for BLBM GENR/SKNT assignment
                            window.electronAPI.lookup.getRaceByPID(pid).then(race => {
                                if (race !== null) {
                                    // Update the player's _race field for BLBM update on save
                                    const actualPlayerIndex = this.getActualPlayerIndex(row);
                                    if (actualPlayerIndex !== -1 && this.players[actualPlayerIndex]) {
                                        this.players[actualPlayerIndex]._race = race;
                                        console.log(`[PID Change] Updated _race to ${race} for row ${row} (player index ${actualPlayerIndex})`);
                                    }
                                }
                            }).catch(err => {
                                console.warn(`[PID Change] Could not get race for PID ${pid}:`, err);
                            });

                            if (!this.portraitCache.has(cacheKey)) {
                                this.portraitCache.set(cacheKey, 'loading');

                                window.electronAPI.portrait.getByPID(pid).then(imageData => {
                                    if (imageData && imageData.length > 0) {
                                        this.portraitCache.set(cacheKey, imageData);
                                    } else {
                                        this.portraitCache.set(cacheKey, null);
                                    }
                                    if (this.hotTable && !this.hotTable.isDestroyed) {
                                        this.hotTable.render();
                                    }
                                }).catch((error) => {
                                    console.error(`Error loading portrait for PID ${pid}:`, error);
                                    this.portraitCache.set(cacheKey, null);
                                    if (this.hotTable && !this.hotTable.isDestroyed) {
                                        this.hotTable.render();
                                    }
                                });
                            } else {
                                // Portrait already in cache, just re-render
                                this.hotTable.render();
                            }
                        }
                    });
                }
            },

            // Highlight entire row on selection
            afterSelection: (row, column, row2, column2, preventScrolling, selectionLayerLevel) => {
                if (!this.hotTable) return;

                // Remove previous row highlights from all clones
                const container = this.hotTable.rootElement;
                if (container) {
                    const previousHighlights = container.querySelectorAll('tr.row-selected');
                    previousHighlights.forEach(tr => tr.classList.remove('row-selected'));

                    // Add highlight to selected row(s) in ALL clones (frozen + scrollable)
                    for (let r = Math.min(row, row2); r <= Math.max(row, row2); r++) {
                        // Target all Handsontable clones: master (scrollable), clone_left (frozen), etc.
                        const clones = ['.ht_master', '.ht_clone_left', '.ht_clone_top', '.ht_clone_top_left_corner'];
                        clones.forEach(cloneClass => {
                            const clone = container.querySelector(cloneClass);
                            if (clone) {
                                const rowElement = clone.querySelector(`tbody tr:nth-child(${r + 1})`);
                                if (rowElement) {
                                    rowElement.classList.add('row-selected');
                                }
                            }
                        });
                    }
                }
            },

            // Clear status on selection
            afterSelectionEnd: () => {
                this.setStatus('Ready');
            },

            // Setup PID event listeners and header click handlers after rendering
            afterRender: (isForced) => {
                // CRITICAL FIX: Only run expensive setup ONCE on initial load
                // Running on every render causes massive slowdown - every click triggers render
                // which triggers setup which adds event listeners - this compounds to freeze

                // Restore scroll position IMMEDIATELY on first render if pending
                if (this.pendingScrollLeft > 0) {
                    try {
                        const holder = this.hotTable.view?._wt?.wtTable?.holder;
                        if (holder) {
                            holder.scrollLeft = this.pendingScrollLeft;
                            console.log('[afterRender] Restored scrollLeft to:', this.pendingScrollLeft);
                        }
                    } catch (e) {
                        console.error('[afterRender] Error restoring scroll:', e);
                    }
                    this.pendingScrollLeft = 0; // Clear after restoring
                }

                if (!this.initialSetupComplete) {
                    console.log('[afterRender] Running initial setup...');
                    this.setupRowHoverHandlers();
                    this.setupPIDEventListeners();
                    this.setupScrollWheelEditing();
                    this.setupHeaderClickHandlers();
                    this.initialSetupComplete = true;
                    console.log('[afterRender] Initial setup complete - will not run again');
                }
            },


            // Auto-size columns after loading
            afterLoadData: () => {
                if (this.hotTable && !this.hotTable.isDestroyed) {
                    // Force column resize to fit content
                    setTimeout(() => {
                        if (this.hotTable && !this.hotTable.isDestroyed) {
                            try {
                                const autoColumnSizePlugin = this.hotTable.getPlugin('autoColumnSize');
                                if (autoColumnSizePlugin) {
                                    // Clear cache first to ensure fresh calculation
                                    autoColumnSizePlugin.clearCache();
                                    autoColumnSizePlugin.calculateAllColumnsWidth();
                                }
                                this.hotTable.render();
                            } catch (e) {
                            }
                        }
                    }, 100);
                }
            }
        });

        // Setup floating scrollbar for roster grid
        this.setupFloatingScrollbar(hotContainer);

        // Force initial column sizing
        setTimeout(() => {
            if (this.hotTable && !this.hotTable.isDestroyed) {
                try {
                    const autoColumnSizePlugin = this.hotTable.getPlugin('autoColumnSize');
                    if (autoColumnSizePlugin) {
                        autoColumnSizePlugin.clearCache();
                        autoColumnSizePlugin.calculateAllColumnsWidth();
                    }
                    this.hotTable.render();
                } catch (e) {
                }
            }
        }, 200);

        this.updateStats();
        this.updatePaginationUI();
    }

    getPlayerFieldValue(player, fieldName) {
        const fieldDef = getFieldDefinition(fieldName);

        // DEBUG: Log first 5 field reads to see what's being requested
        if (!this._fieldReadCount) this._fieldReadCount = 0;
        if (this._fieldReadCount < 5) {
            console.log(`[getPlayerFieldValue] Field: ${fieldName}, Value in player: ${player[fieldName]}, FieldDef type: ${fieldDef?.type}, FieldDef lookup: ${fieldDef?.lookup}`);
            this._fieldReadCount++;
        }

        // Handle PYRP (Years Pro) - if undefined or null, return 0 instead of NaN
        if (fieldName === 'PYRP') {
            const value = player[fieldName];
            return (value !== undefined && value !== null) ? value : 0;
        }

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

        // Handle direct field mappings FIRST (for pre-calculated fields like BIRTHDAY, ARCHETYPE)
        if (player[fieldName] !== undefined) {
            return player[fieldName];
        }

        // Handle calculated fields (e.g., TOTAL_SALARY) - only if not already pre-calculated
        if (fieldDef.type === 'calculated' && fieldDef.calculate) {
            return fieldDef.calculate(player);
        }

        // Handle fields with transform for display (salary/bonus in millions)
        if (fieldDef.transform && fieldDef.transform.display && player[fieldName] !== undefined) {
            return fieldDef.transform.display(player[fieldName]);
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
        td.style.backgroundColor = '#1a1612';
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
     * Handle OVR change - prompt user to adjust ratings based on new OVR
     * @param {number} row - Grid row index
     * @param {number} oldOVR - Previous OVR value
     * @param {number} targetOVR - New target OVR
     */
    async handleOVRChange(row, oldOVR, targetOVR) {
        // Get the actual player
        const filteredIndex = this.paginatedPlayerIndices[row];
        const actualPlayer = this.filteredPlayers[filteredIndex];
        const actualPlayerIndex = this.players.indexOf(actualPlayer);

        if (actualPlayerIndex === -1 || !this.players[actualPlayerIndex]) {
            console.warn('[OVR Change] Could not find player for row', row);
            return;
        }

        const player = this.players[actualPlayerIndex];
        const position = player['PPOS'] !== undefined ?
            this.getPositionNameFromId(player['PPOS']) :
            (player['position'] || 'QB');
        const playerName = `${player['PFNA'] || player['firstName'] || ''} ${player['PLNA'] || player['lastName'] || ''}`.trim();

        // Build attributes object for the calculator
        const attributes = {};
        const ratingFields = ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PJMP', 'PAWR', 'PBCV', 'PCAR', 'PCTH',
            'PTHP', 'PTAS', 'PTAM', 'PTAD', 'PTOR', 'PTUP', 'PPLA', 'PBSK',
            'PPBK', 'PRBK', 'PLBK', 'PLIB', 'PPBF', 'PPBS', 'PRBF', 'PRBS',
            'PTAK', 'PLHT', 'PLMC', 'PLZC', 'PLPR', 'PLPU', 'PLPM', 'PFMS',
            'PBSG', 'PLPE', 'PBKT', 'PLTR', 'PELU', 'PLJM', 'PLSM', 'PLSA',
            'PLSC', 'PLCI', 'PLRL', 'PDRR', 'PMRR', 'SRRN', 'PKPR', 'PKAC', 'PKRT',
            'PSTA', 'PINJ', 'PTGH'];

        for (const field of ratingFields) {
            if (player[field] !== undefined) {
                attributes[field] = parseInt(player[field]) || 50;
            }
        }

        // Get archetype if available
        const archetype = player['PLTY'] !== undefined ? player['PLTY'] : undefined;

        try {
            // Call the backend to calculate adjustments
            const result = await window.electronAPI.rating.calculateOVRAdjustments(
                attributes, targetOVR, position, archetype
            );

            if (!result || Object.keys(result.adjustments).length === 0) {
                // No adjustments needed or couldn't calculate
                console.log('[OVR Change] No adjustments calculated');
                return;
            }

            // Show the adjustment dialog
            this.showOVRAdjustmentDialog(row, actualPlayerIndex, playerName, oldOVR, targetOVR, result);

        } catch (error) {
            console.error('[OVR Change] Error calculating adjustments:', error);
        }
    }

    /**
     * Show dialog asking user if they want to apply rating adjustments
     */
    showOVRAdjustmentDialog(row, playerIndex, playerName, oldOVR, targetOVR, result) {
        const { adjustments, newOVR, archetype } = result;
        const delta = targetOVR - oldOVR;
        const direction = delta > 0 ? 'increase' : 'decrease';

        // Build the adjustment list HTML
        let adjustmentHTML = '';
        const sortedAdjustments = Object.entries(adjustments)
            .sort((a, b) => b[1].weight - a[1].weight); // Sort by weight (most important first)

        for (const [fieldCode, adj] of sortedAdjustments) {
            const change = adj.suggested - adj.current;
            const changeStr = change > 0 ? `+${change}` : `${change}`;
            const changeClass = change > 0 ? 'positive-change' : 'negative-change';
            adjustmentHTML += `
                <tr>
                    <td>${adj.name}</td>
                    <td class="current-value">${adj.current}</td>
                    <td class="arrow">→</td>
                    <td class="suggested-value">${adj.suggested}</td>
                    <td class="${changeClass}">${changeStr}</td>
                </tr>
            `;
        }

        // Create modal HTML
        const modalHTML = `
            <div id="ovr-adjustment-modal" class="modal-overlay">
                <div class="modal-content ovr-adjustment-modal">
                    <div class="modal-header">
                        <h2>Adjust Ratings for OVR Change?</h2>
                        <button class="close-btn" onclick="document.getElementById('ovr-adjustment-modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <p class="player-info">
                            <strong>${playerName}</strong> - ${archetype || 'Default Archetype'}
                        </p>
                        <p class="ovr-change">
                            OVR: <span class="old-ovr">${oldOVR}</span>
                            <span class="arrow">→</span>
                            <span class="new-ovr">${targetOVR}</span>
                            <span class="${direction === 'increase' ? 'positive-change' : 'negative-change'}">
                                (${delta > 0 ? '+' : ''}${delta})
                            </span>
                        </p>
                        <p class="achieved-ovr">Achieved OVR with these adjustments: <strong>${newOVR}</strong></p>
                        <div class="adjustment-table-container">
                            <table class="adjustment-table">
                                <thead>
                                    <tr>
                                        <th>Attribute</th>
                                        <th>Current</th>
                                        <th></th>
                                        <th>New</th>
                                        <th>Change</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${adjustmentHTML}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="apply-adjustments-btn" class="btn btn-primary">Apply Adjustments</button>
                        <button id="keep-ovr-only-btn" class="btn btn-secondary">Keep OVR Only</button>
                        <button id="cancel-ovr-btn" class="btn btn-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('ovr-adjustment-modal');

        // Apply adjustments handler
        document.getElementById('apply-adjustments-btn').addEventListener('click', () => {
            this.applyOVRAdjustments(row, playerIndex, adjustments);
            modal.remove();
        });

        // Keep OVR only handler (just close - OVR already changed)
        document.getElementById('keep-ovr-only-btn').addEventListener('click', () => {
            modal.remove();
        });

        // Cancel handler - revert OVR to old value
        document.getElementById('cancel-ovr-btn').addEventListener('click', () => {
            this.players[playerIndex]['POVR'] = oldOVR;
            this.updateGridCell(row, 'POVR', oldOVR);
            modal.remove();
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Apply the calculated rating adjustments to the player
     */
    applyOVRAdjustments(row, playerIndex, adjustments) {
        const changes = [];

        for (const [fieldCode, adj] of Object.entries(adjustments)) {
            // Update player data
            this.players[playerIndex][fieldCode] = adj.suggested;

            // Update grid cell
            this.updateGridCell(row, fieldCode, adj.suggested);

            changes.push(`${adj.name}: ${adj.current} → ${adj.suggested}`);
        }

        console.log(`[OVR Adjustment] Applied ${changes.length} rating changes:`, changes);

        // Re-render the grid to show updated values
        if (this.hotTable && !this.hotTable.isDestroyed) {
            this.hotTable.render();
        }
    }

    /**
     * Get position name from position ID
     */
    getPositionNameFromId(posId) {
        const posMap = {
            0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
            8: 'RG', 9: 'RT', 10: 'LE', 11: 'RE', 12: 'DT', 13: 'LOLB', 14: 'MLB',
            15: 'ROLB', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
        };
        return posMap[posId] || 'QB';
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
    /**
     * Portrait renderer - displays player portrait based on PID
     * This is a read-only column that renders an image from the portrait service
     */
    portraitRenderer(instance, td, row, col, prop, value, cellProperties) {
        // TEMPORARY TEST - just show "TEST" to verify renderer is working
        td.innerHTML = 'TEST';
        td.style.padding = '2px';
        td.style.textAlign = 'center';
        td.style.verticalAlign = 'middle';
        td.style.backgroundColor = '#ff0000'; // Red background to make it obvious
        td.style.color = '#ffffff'; // White text

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

    /**
     * Custom renderer for POVR (Overall Rating) - displays the stored value
     */
    ovrRenderer(instance, td, row, col, prop, value, cellProperties) {
        // Display the stored POVR value directly
        td.textContent = value || '-';
        td.style.backgroundColor = '#1a1612';
        td.style.color = 'var(--primary-orange)';
        td.style.fontWeight = 'bold';
        td.style.border = '1px solid var(--border-color)';
        td.style.fontSize = '0.875rem';
        td.style.textAlign = 'center';
        td.title = 'Overall Rating';

        return td;
    }

    /**
     * Build a ratings object from a row's data
     * Maps the current field mapping to rating attributes
     */
    buildRatingsFromRow(rowData) {
        const ratings = {};

        // Map of field names to rating properties
        const fieldMapping = {
            'PACC': 'acceleration',
            'PAGI': 'agility',
            'PAWR': 'awareness',
            'PBCV': 'ballCarrierVision',
            'PBKS': 'blockShedding',
            'PBKT': 'breakTackle',
            'PBRK': 'breakSack',
            'PCAR': 'carrying',
            'PCTH': 'catching',
            'PCIT': 'catchInTraffic',
            'PCOD': 'changeOfDirection',
            'PDRR': 'deepRouteRunning',
            'PFMS': 'finesseMoves',
            'PHIP': 'hitPower',
            'PIBK': 'impactBlocking',
            'PINJ': 'injury',
            'PJMP': 'jumping',
            'PJKM': 'jukeMove',
            'PKAC': 'kickAccuracy',
            'PKPW': 'kickPower',
            'PKRT': 'kickReturn',
            'PLDB': 'leadBlock',
            'PLNS': 'longSnap',
            'PMCV': 'manCoverage',
            'PMRR': 'mediumRouteRunning',
            'PPBF': 'passBlockFinesse',
            'PPBS': 'passBlockPower',
            'PPBK': 'passBlock',
            'PPLA': 'playAction',
            'PPLR': 'playRecognition',
            'PPOW': 'powerMoves',
            'PPRC': 'pressCoverage',
            'PPUR': 'pursuit',
            'PRBF': 'runBlockFinesse',
            'PRBS': 'runBlockPower',
            'PRBK': 'runBlock',
            'PREL': 'release',
            'PSPC': 'spectacularCatch',
            'PSPD': 'speed',
            'PSPM': 'spinMove',
            'PSTM': 'stamina',
            'PSTA': 'stiffArm',
            'PSTR': 'strength',
            'PSRR': 'shortRouteRunning',
            'PTAK': 'tackle',
            'PTGH': 'toughness',
            'PTAD': 'throwAccuracyDeep',
            'PTAM': 'throwAccuracyMid',
            'PTAS': 'throwAccuracyShort',
            'PTOR': 'throwOnTheRun',
            'PTHP': 'throwPower',
            'PTUP': 'throwUnderPressure',
            'PTRK': 'trucking',
            'PZCV': 'zoneCoverage'
        };

        // Extract rating values from row data
        for (const [fieldName, ratingKey] of Object.entries(fieldMapping)) {
            const fieldIndex = this.currentFieldMapping.indexOf(fieldName);
            if (fieldIndex !== -1) {
                const value = rowData[fieldIndex];
                if (value !== null && value !== undefined && value !== '') {
                    ratings[ratingKey] = parseInt(value) || 0;
                }
            }
        }

        return ratings;
    }

    /**
     * Custom renderer for OVR column in draft class grid
     * Calculates overall dynamically using position-specific formulas
     */
    draftOvrRenderer(instance, td, row, col, prop, value, cellProperties) {
        // Get the source data object for this row
        const rowData = instance.getSourceDataAtRow(row);

        if (!rowData || !rowData.position) {
            // No position available, show the stored value
            Handsontable.renderers.NumericRenderer.apply(this, arguments);
            td.style.backgroundColor = '#1a1612';
            td.style.color = 'var(--gray-text)';
            return td;
        }

        // MADDEN MODE FIX: If there's a stored overall value (from Madden CSV data),
        // display it directly instead of calculating it
        if (rowData.overall !== undefined && rowData.overall !== null) {
            // Debug logging for first 5 players
            if (row < 5) {
                console.log(`[draftOvrRenderer] Row ${row}: ${rowData.firstName} ${rowData.lastName} - Using stored OVR: ${rowData.overall}`);
            }

            // Use the stored value directly (from CSV rookie ratings)
            Handsontable.renderers.NumericRenderer.apply(this, arguments);
            td.textContent = rowData.overall;
            td.style.backgroundColor = '#1a1612';
            td.style.color = '#fff';
            td.title = 'Overall Rating from Madden CSV data (actual rookie rating)';
            return td;
        }

        // Build ratings object from row data (draft class uses direct property names)
        const ratings = {
            acceleration: rowData.acceleration,
            agility: rowData.agility,
            awareness: rowData.awareness,
            ballCarrierVision: rowData.ballCarrierVision,
            blockShedding: rowData.blockShedding,
            breakTackle: rowData.breakTackle,
            breakSack: rowData.breakSack,
            carrying: rowData.carrying,
            catching: rowData.catching,
            catchInTraffic: rowData.catchInTraffic,
            changeOfDirection: rowData.changeOfDirection,
            deepRouteRunning: rowData.deepRouteRunning,
            finesseMoves: rowData.finesseMoves,
            hitPower: rowData.hitPower,
            impactBlocking: rowData.impactBlocking,
            injury: rowData.injury,
            jumping: rowData.jumping,
            jukeMove: rowData.jukeMove,
            kickAccuracy: rowData.kickAccuracy,
            kickPower: rowData.kickPower,
            kickReturn: rowData.kickReturn,
            leadBlock: rowData.leadBlock,
            longSnap: rowData.longSnap,
            manCoverage: rowData.manCoverage,
            mediumRouteRunning: rowData.mediumRouteRunning,
            passBlock: rowData.passBlock,
            passBlockFinesse: rowData.passBlockFinesse,
            passBlockPower: rowData.passBlockPower,
            playAction: rowData.playAction,
            playRecognition: rowData.playRecognition,
            powerMoves: rowData.powerMoves,
            pressCoverage: rowData.pressCoverage,
            pursuit: rowData.pursuit,
            release: rowData.release,
            runBlock: rowData.runBlock,
            runBlockFinesse: rowData.runBlockFinesse,
            runBlockPower: rowData.runBlockPower,
            shortRouteRunning: rowData.shortRouteRunning,
            spectacularCatch: rowData.spectacularCatch,
            speed: rowData.speed,
            spinMove: rowData.spinMove,
            stamina: rowData.stamina,
            stiffArm: rowData.stiffArm,
            strength: rowData.strength,
            tackle: rowData.tackle,
            throwAccuracyDeep: rowData.throwAccuracyDeep,
            throwAccuracyMid: rowData.throwAccuracyMid,
            throwAccuracyShort: rowData.throwAccuracyShort,
            throwOnTheRun: rowData.throwOnTheRun,
            throwPower: rowData.throwPower,
            throwUnderPressure: rowData.throwUnderPressure,
            toughness: rowData.toughness,
            trucking: rowData.trucking,
            zoneCoverage: rowData.zoneCoverage
        };

        // Calculate overall rating asynchronously
        window.electronAPI.rating.calculateOverall(ratings, rowData.position)
            .then(calculatedOVR => {
                // Update the cell with calculated OVR
                td.textContent = calculatedOVR;
                td.style.backgroundColor = '#1a1612';  // Darker to show it's calculated
                td.style.color = 'var(--primary-orange)';  // Orange to highlight it's special
                td.style.fontWeight = 'bold';
                td.style.border = '1px solid var(--border-color)';
                td.style.fontSize = '0.875rem';
                td.style.textAlign = 'center';

                // Add title with explanation
                td.title = 'Calculated Overall Rating (based on position-specific attribute weights)';
            })
            .catch(error => {
                console.error('[draftOvrRenderer] Error calculating OVR:', error);
                // Fallback to stored value
                td.textContent = value || '-';
                td.style.backgroundColor = '#1a1612';
                td.style.color = 'var(--gray-text)';
            });

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
            0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG',
            7: 'C', 8: 'RG', 9: 'RT', 10: 'LEDG', 11: 'REDG', 12: 'DT',
            13: 'SAM', 14: 'Mike', 15: 'WILL', 16: 'CB', 17: 'FS', 18: 'SS',
            19: 'K', 20: 'P', 21: 'LS'
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

        // Apply search filter
        if (this.rosterSearchTerm) {
            filtered = filtered.filter(player => {
                const firstName = (player.PFNA || '').toLowerCase();
                const lastName = (player.PLNA || '').toLowerCase();
                const fullName = `${firstName} ${lastName}`;
                return fullName.includes(this.rosterSearchTerm);
            });
        }

        // Apply college filter
        if (this.collegeSearchTerm) {
            filtered = filtered.filter(player => {
                const college = getLookupValue('colleges', player.PCOL) || '';
                return college.toLowerCase().includes(this.collegeSearchTerm);
            });
        }

        // Apply PID filter
        if (this.pidSearchTerm) {
            const pidValue = parseInt(this.pidSearchTerm, 10);
            if (!isNaN(pidValue)) {
                filtered = filtered.filter(player => {
                    return player.PSXP === pidValue;
                });
            } else {
                // If not a number, try to match as string prefix/contains
                filtered = filtered.filter(player => {
                    return String(player.PSXP || 0).includes(this.pidSearchTerm);
                });
            }
        }

        // Apply empty field filter
        if (this.emptyFieldFilter) {
            filtered = filtered.filter(player => {
                switch (this.emptyFieldFilter) {
                    case 'position':
                        // Empty position (PPOS is 0, null, undefined, or maps to empty string)
                        const position = getLookupValue('positions', player.PPOS);
                        return !player.PPOS || player.PPOS === 0 || !position || position === '';
                    case 'college':
                        // Empty college (PCOL is 0, null, undefined, or maps to empty string)
                        const college = getLookupValue('colleges', player.PCOL);
                        return !player.PCOL || player.PCOL === 0 || !college || college === '';
                    case 'pid':
                        // Empty PID (PSXP is 0, null, or undefined)
                        return !player.PSXP || player.PSXP === 0;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        console.log('[applyFiltersAndSort] About to apply sorting, sortColumns:', JSON.stringify(this.sortColumns));
        const beforeSort = filtered.slice(0, 5).map(p => p.POVR);
        console.log('[applyFiltersAndSort] BEFORE sort - first 5 POVR values:', beforeSort);
        if (this.sortColumns.length > 0) {
            console.log('[applyFiltersAndSort] Sorting array of', filtered.length, 'players by', this.sortColumns.map(s => s.column).join(', '));

            let comparisonCount = 0;
            filtered.sort((a, b) => {
                // Multi-column sort - check each sort column in order
                for (const sortCol of this.sortColumns) {
                    const fieldName = sortCol.column;
                    const valueA = this.getPlayerFieldValue(a, fieldName);
                    const valueB = this.getPlayerFieldValue(b, fieldName);

                    // Log first 3 comparisons for debugging
                    if (comparisonCount < 3) {
                        console.log(`[SORT COMPARE #${comparisonCount}] Field: ${fieldName}, A: ${valueA} (${typeof valueA}), B: ${valueB} (${typeof valueB})`);
                        comparisonCount++;
                    }

                    // Compare values
                    let comparison = 0;

                    // Handle empty values and NaN
                    if (valueA === '' || valueA === null || valueA === undefined || (typeof valueA === 'number' && isNaN(valueA))) {
                        comparison = 1;
                    } else if (valueB === '' || valueB === null || valueB === undefined || (typeof valueB === 'number' && isNaN(valueB))) {
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
            const afterSort = filtered.slice(0, 5).map(p => p.POVR);
            console.log('[applyFiltersAndSort] AFTER sort - first 5 POVR values:', afterSort);
            console.log('[applyFiltersAndSort] ⚠️ DID VALUES CHANGE?', JSON.stringify(beforeSort), '=>', JSON.stringify(afterSort));
        }

        // Store filtered and sorted result
        this.filteredPlayers = filtered;
        console.log('[applyFiltersAndSort] Stored in this.filteredPlayers, count:', this.filteredPlayers.length);
    }

    setupScrollWheelEditing(table = this.hotTable, fieldMapping = this.currentFieldMapping) {
        if (!table) return;

        const container = table.rootElement;
        if (!container) return;

        // Use unique handler keys for each table
        const handlerKey = table === this.hotTable ? '_scrollWheelHandler' : '_draftScrollWheelHandler';
        const selectionHandlerKey = table === this.hotTable ? '_scrollWheelSelectionHandler' : '_draftScrollWheelSelectionHandler';
        const lockedCellKey = table === this.hotTable ? '_lockedCell' : '_draftLockedCell';
        const setupCompleteKey = table === this.hotTable ? '_scrollWheelSetupComplete' : '_draftScrollWheelSetupComplete';

        // Only set up once - don't re-run on every afterRender
        if (this[setupCompleteKey]) {
            return;
        }

        // Initialize locked cell tracker
        this[lockedCellKey] = null;

        // Remove existing listeners to avoid duplicates
        if (this[handlerKey]) {
            window.removeEventListener('wheel', this[handlerKey], { capture: true });
        }

        // Use Handsontable's afterSelectionEnd hook to detect cell clicks
        if (this[selectionHandlerKey]) {
            table.removeHook('afterSelectionEnd', this[selectionHandlerKey]);
        }

        this[selectionHandlerKey] = (row, col, row2, col2) => {
            // Only handle single cell selection
            if (row !== row2 || col !== col2) {
                this[lockedCellKey] = null;
                return;
            }

            // Check if clicking on same cell (toggle lock)
            if (this[lockedCellKey] &&
                this[lockedCellKey].row === row &&
                this[lockedCellKey].col === col) {
                // Unlock the cell
                this[lockedCellKey] = null;
            } else {
                // Lock the new cell
                this[lockedCellKey] = { row, col };
            }
        };

        table.addHook('afterSelectionEnd', this[selectionHandlerKey]);

        // Wheel handler - intercept ALL wheel events on window to prevent page scroll when locked
        this[handlerKey] = (e) => {
            // Check if a cell is locked - if not, allow normal scrolling
            if (!this[lockedCellKey]) {
                return;
            }

            // Cell is locked - STOP ALL SCROLLING IMMEDIATELY at the window level
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const { row, col } = this[lockedCellKey];

            // Verify the locked cell is still selected
            const selected = table.getSelected();
            if (!selected || selected.length !== 1) {
                this[lockedCellKey] = null;
                return;
            }

            const [selRow, selCol, selRow2, selCol2] = selected[0];
            if (selRow !== row || selCol !== col || selRow !== selRow2 || selCol !== selCol2) {
                // Selection changed, unlock
                this[lockedCellKey] = null;
                return;
            }

            // Get field name for this column
            let fieldName, fieldDef;
            if (fieldMapping && fieldMapping[col]) {
                // Roster editor: use field mapping
                fieldName = fieldMapping[col];
                fieldDef = getFieldDefinition(fieldName);
            } else {
                // Draft class editor: get column meta directly
                const colMeta = table.getCellMeta(row, col);
                if (!colMeta || colMeta.readOnly) return;

                // For draft class, handle type directly from column definition
                const currentValue = table.getDataAtCell(row, col);

                // Simple scroll direction - one click = one change
                const direction = e.deltaY > 0 ? -1 : 1;
                let newValue = currentValue;

                if (colMeta.type === 'numeric') {
                    const step = e.shiftKey ? 10 : 1;
                    newValue = (parseInt(currentValue) || 0) + (direction * step);
                    if (newValue !== currentValue) {
                        table.setDataAtCell(row, col, newValue);
                    }
                } else if (colMeta.type === 'dropdown' && colMeta.source) {
                    const options = colMeta.source;
                    const currentIndex = options.indexOf(currentValue);
                    let newIndex = currentIndex + direction;
                    if (newIndex < 0) newIndex = options.length - 1;
                    if (newIndex >= options.length) newIndex = 0;
                    newValue = options[newIndex];
                    if (newValue !== currentValue) {
                        table.setDataAtCell(row, col, newValue);
                    }
                }
                return;
            }

            if (!fieldDef || !fieldDef.editable) return;

            const currentValue = table.getDataAtCell(row, col);

            // Simple scroll direction - one click = one change
            const direction = e.deltaY > 0 ? -1 : 1;
            let newValue = currentValue;

            // Handle different field types
            if (fieldDef.type === 'numeric') {
                // Numeric fields: increment/decrement
                const step = e.shiftKey ? 10 : 1;
                newValue = (parseInt(currentValue) || 0) + (direction * step);

                // Respect min/max bounds
                if (fieldDef.min !== undefined && newValue < fieldDef.min) {
                    newValue = fieldDef.min;
                }
                if (fieldDef.max !== undefined && newValue > fieldDef.max) {
                    newValue = fieldDef.max;
                }
            } else if (fieldDef.type === 'lookup' && fieldDef.lookup) {
                // Lookup fields: cycle through options
                const options = getLookupOptions(fieldDef.lookup);
                if (options && options.length > 0) {
                    // Find current value by LABEL (display name), not value (numeric ID)
                    const currentIndex = options.findIndex(opt => opt.label === currentValue);
                    let newIndex = currentIndex + direction;

                    // Wrap around
                    if (newIndex < 0) newIndex = options.length - 1;
                    if (newIndex >= options.length) newIndex = 0;

                    // Set the new LABEL (display name)
                    newValue = options[newIndex].label;
                }
            } else if (fieldDef.type === 'autocomplete' && fieldDef.lookup === 'pids') {
                // Player Pic autocomplete: cycle through PID names (only one at a time)
                const allNames = Array.from(LOOKUP_DATA.pidNames.values());
                if (allNames.length > 0) {
                    const currentIndex = allNames.findIndex(n => n.fullName === currentValue);
                    let newIndex = currentIndex + direction;

                    // Wrap around
                    if (newIndex < 0) newIndex = allNames.length - 1;
                    if (newIndex >= allNames.length) newIndex = 0;

                    newValue = allNames[newIndex].fullName;
                }
            }

            // Update cell if value changed
            if (newValue !== currentValue) {
                table.setDataAtCell(row, col, newValue);
            }
        };

        // Add to WINDOW with capture to intercept before it reaches the page
        window.addEventListener('wheel', this[handlerKey], { passive: false, capture: true });

        // Mark setup as complete
        this[setupCompleteKey] = true;
    }

    setupPlayerCardScrollWheelEditing() {
        const modal = document.getElementById('playerCardModal');
        if (!modal) return;

        // Remove existing listener to avoid duplicates
        if (this._playerCardScrollWheelHandler) {
            modal.removeEventListener('wheel', this._playerCardScrollWheelHandler);
        }

        this._playerCardScrollWheelHandler = (e) => {
            // Only handle if target is an input or select element
            const target = e.target;
            if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'SELECT')) return;

            // Skip read-only or disabled inputs
            if (target.readOnly || target.disabled) return;

            // Only handle number inputs and selects
            if (target.tagName === 'INPUT' && target.type !== 'number') return;

            // PREVENT DEFAULT SCROLL - this is key!
            e.preventDefault();
            e.stopPropagation();

            const delta = Math.sign(e.deltaY);
            const change = delta > 0 ? -1 : 1;

            if (target.tagName === 'INPUT' && target.type === 'number') {
                // Numeric input: increment/decrement
                const step = e.shiftKey ? 10 : 1;
                let currentValue = parseInt(target.value) || 0;
                let newValue = currentValue + (change * step);

                // Respect min/max bounds
                const min = target.min !== '' ? parseInt(target.min) : undefined;
                const max = target.max !== '' ? parseInt(target.max) : undefined;

                if (min !== undefined && newValue < min) {
                    newValue = min;
                }
                if (max !== undefined && newValue > max) {
                    newValue = max;
                }

                target.value = newValue;
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'SELECT') {
                // Select dropdown: cycle through options
                const options = Array.from(target.options);
                if (options.length === 0) return;

                const currentIndex = target.selectedIndex;
                let newIndex = currentIndex + change;

                // Wrap around
                if (newIndex < 0) newIndex = options.length - 1;
                if (newIndex >= options.length) newIndex = 0;

                target.selectedIndex = newIndex;
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        modal.addEventListener('wheel', this._playerCardScrollWheelHandler, { passive: false });
        console.log('[Scroll Wheel] Event listener attached to player card modal');
    }

    setupHeaderClickHandlers() {
        // Use event delegation on DOCUMENT to ensure we catch all clicks
        // This works even if headers are in a separate Handsontable container

        // Remove old listener if it exists to prevent duplicates
        if (this._headerClickHandler) {
            document.removeEventListener('click', this._headerClickHandler);
        }

        // Create and store the handler function
        this._headerClickHandler = (e) => {
            console.log('[CLICK] Document click detected, target:', e.target.tagName, 'class:', e.target.className);

            // Check if click was on or inside a sortable header
            const header = e.target.closest('.sortable-header');
            console.log('[CLICK] Closest sortable-header:', header ? header.tagName : 'NULL', header ? header.dataset.field : '');

            if (!header) return;

            // Make sure this is from our roster table
            const isInRosterGrid = header.closest('#rosterGrid, #handsontable-container');
            console.log('[CLICK] Is in roster grid/handsontable container:', !!isInRosterGrid);

            if (!isInRosterGrid) return;

            const fieldName = header.dataset.field;
            const isShiftKey = e.shiftKey;
            console.log('[HEADER CLICK] Field:', fieldName, 'Shift:', isShiftKey);

            // Handle column sort
            this.toggleColumnSort(fieldName, isShiftKey);
        };

        // Add the new listener to document
        document.addEventListener('click', this._headerClickHandler);
        console.log('[SETUP] Header click handler attached to document');

        // Still set cursor on headers when they appear
        const headers = document.querySelectorAll('.sortable-header');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
        });
        console.log('[SETUP] Found', headers.length, 'sortable headers');

        // ========================================
        // Player Card - Row Header Click Handler
        // ========================================

        // Remove old row header click listener if it exists
        if (this._rowHeaderClickHandler) {
            document.removeEventListener('click', this._rowHeaderClickHandler);
        }

        // Create and store the row header click handler
        this._rowHeaderClickHandler = (e) => {
            // Check multiple possible row header selectors
            let rowHeader = null;

            // Try different selectors for row headers
            if (e.target.matches('th.rowHeader')) {
                rowHeader = e.target;
            } else if (e.target.closest('th.rowHeader')) {
                rowHeader = e.target.closest('th.rowHeader');
            } else if (e.target.matches('.ht_clone_left th')) {
                rowHeader = e.target;
            } else if (e.target.closest('.ht_clone_left th')) {
                rowHeader = e.target.closest('.ht_clone_left th');
            }

            if (!rowHeader) {
                // Debug: log what was clicked
                if (e.target.matches('th') || e.target.closest('th')) {
                    console.log('[Player Card Debug] Clicked a TH but not recognized as row header:', e.target);
                }
                return;
            }

            console.log('[Player Card] Row header clicked:', rowHeader.textContent);

            // Get the row index from the row header
            const row = parseInt(rowHeader.textContent.trim()) - 1; // Row headers are 1-indexed

            if (isNaN(row) || row < 0) {
                console.log('[Player Card] Invalid row number:', rowHeader.textContent);
                return;
            }

            // Get player data for this row using Handsontable's getSourceDataAtRow
            // This correctly handles sorted/filtered data
            if (this.hotTable && !this.hotTable.isDestroyed) {
                const playerData = this.hotTable.getSourceDataAtRow(row);
                console.log('[Player Card Debug] Row:', row);
                console.log('[Player Card Debug] playerData type:', typeof playerData);
                console.log('[Player Card Debug] playerData is array:', Array.isArray(playerData));
                if (Array.isArray(playerData)) {
                    console.log('[Player Card Debug] Array length:', playerData.length, 'First items:', playerData.slice(0, 5));
                } else if (playerData && typeof playerData === 'object') {
                    console.log('[Player Card Debug] Object keys:', Object.keys(playerData).slice(0, 10));
                    console.log('[Player Card Debug] Sample values:', {
                        PFNA: playerData.PFNA,
                        PLNA: playerData.PLNA,
                        FirstName: playerData.FirstName,
                        LastName: playerData.LastName
                    });
                }

                if (playerData && Array.isArray(playerData)) {
                    // Handsontable returns row as array. Extract last name and first name.
                    // Based on logs: ["","Amegadjie","Kiran",9999,"Kiran Amegadjie"]
                    // Index 1 = Last Name, Index 2 = First Name
                    const lastName = playerData[1];
                    const firstName = playerData[2];

                    // Find the actual player object by matching names
                    const actualPlayer = this.players.find(p =>
                        p.PLNA === lastName && p.PFNA === firstName
                    );

                    if (actualPlayer) {
                        const playerIndex = this.players.indexOf(actualPlayer);
                        console.log('[Player Card] Opening card - Player:', actualPlayer.PFNA, actualPlayer.PLNA, 'Index:', playerIndex);
                        this.openPlayerCard(actualPlayer, playerIndex);
                    } else {
                        console.log('[Player Card] Could not find player:', firstName, lastName);
                    }
                } else {
                    console.log('[Player Card] No player data for row:', row);
                }
            } else {
                console.log('[Player Card] Handsontable not available');
            }
        };

        // Add row header click listener to document
        document.addEventListener('click', this._rowHeaderClickHandler);
        console.log('[SETUP] Row header click handler attached for player cards');

        // Style row headers to show they're clickable - try multiple selectors
        const rowHeaderSelectors = [
            '.ht_clone_left th.rowHeader',
            '.ht_clone_left th',
            'th.rowHeader',
            '.ht_clone_left .htCore tbody th'
        ];

        let rowHeaders = [];
        for (const selector of rowHeaderSelectors) {
            const headers = document.querySelectorAll(selector);
            if (headers.length > 0) {
                rowHeaders = headers;
                console.log('[SETUP] Found', headers.length, 'row headers using selector:', selector);
                break;
            }
        }

        rowHeaders.forEach(header => {
            header.style.cursor = 'pointer';
            header.title = 'Click to view player card';
        });

        if (rowHeaders.length === 0) {
            console.warn('[SETUP] No row headers found! Player cards may not work.');
        }
    }

    /**
     * Setup hover handlers to highlight entire rows across frozen and scrollable sections
     */
    setupRowHoverHandlers() {
        if (!this.hotTable || !this.hotTable.rootElement) return;

        const container = this.hotTable.rootElement;
        const clones = ['.ht_master', '.ht_clone_left', '.ht_clone_top', '.ht_clone_top_left_corner'];

        clones.forEach(cloneClass => {
            const clone = container.querySelector(cloneClass);
            if (!clone) return;

            const tbody = clone.querySelector('tbody');
            if (!tbody) return;

            // Add event delegation for row hover
            tbody.addEventListener('mouseenter', (e) => {
                const tr = e.target.closest('tr');
                if (!tr) return;

                // Get row index
                const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
                if (rowIndex < 0) return;

                // Add hover class to same row in all clones
                clones.forEach(cls => {
                    const c = container.querySelector(cls);
                    if (c) {
                        const targetRow = c.querySelector(`tbody tr:nth-child(${rowIndex + 1})`);
                        if (targetRow) {
                            targetRow.classList.add('row-hover');
                        }
                    }
                });
            }, true);

            tbody.addEventListener('mouseleave', (e) => {
                const tr = e.target.closest('tr');
                if (!tr) return;

                // Remove hover class from all rows in all clones
                clones.forEach(cls => {
                    const c = container.querySelector(cls);
                    if (c) {
                        const rows = c.querySelectorAll('tbody tr.row-hover');
                        rows.forEach(r => r.classList.remove('row-hover'));
                    }
                });
            }, true);
        });
    }

    toggleColumnSort(fieldName, isMultiColumn) {
        console.log('[SORT] toggleColumnSort called - field:', fieldName, 'multi:', isMultiColumn);
        console.log('[SORT] Current sortColumns:', JSON.stringify(this.sortColumns));

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

        // Save scroll position before re-render
        let scrollLeft = 0;
        if (this.hotTable && !this.hotTable.isDestroyed) {
            // Try multiple ways to get scroll position
            const holder = this.hotTable.view?._wt?.wtTable?.holder;
            if (holder) {
                scrollLeft = holder.scrollLeft;
                console.log('[toggleColumnSort] Got scrollLeft from holder:', scrollLeft);
            } else {
                console.log('[toggleColumnSort] Could not find holder');
            }
        }
        console.log('[toggleColumnSort] Final scroll position to save:', scrollLeft);

        // Reset to first page and re-render
        this.currentPage = 1;
        this.renderRoster(scrollLeft);
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

        // Build options
        const optionsHtml = teams.map(team =>
            `<option value="${team.id}">${team.fullName}</option>`
        ).join('');

        teamFilter.innerHTML = '<option value="">All Teams</option>' + optionsHtml;

        // Skip custom dropdown for team filter - use native
        teamFilter.dataset.customDropdown = 'skip';

        // Initialize other custom dropdowns
        if (window.initCustomDropdowns) {
            this.customDropdowns = window.initCustomDropdowns();
        }
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

        // Update header colors after grid is rendered
        const container = document.getElementById('rosterGrid');
        if (container) {
            applyHeaderColors(this, container);
        }
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

        // Update header colors after grid is rendered
        const container = document.getElementById('rosterGrid');
        if (container) {
            applyHeaderColors(this, container);
        }
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
        const visibleFields = getVisibleFields(false);

        document.getElementById('playerCount').textContent = `${playerCount} players`;
        document.getElementById('visibleFields').textContent = `${visibleFields.length} visible fields`;
    }

    async saveRoster() {
        // Check if this is a generated roster (no currentFile but has originalBuffer)
        const isGeneratedRoster = !this.currentFile && this.originalData && this.originalData._originalBuffer;

        if (isGeneratedRoster) {
            // Use roster creator save method for generated rosters
            console.log('[app.js] This is a generated roster - using roster creator save');
            return await this.saveGeneratedRosterFromRosterWizard();
        }

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

                // PRE-SAVE SYNC: Ensure all assignedGenr/assignedSknt/assignedRace values from filteredPlayers are in this.players
                // This handles cases where AG-Grid updates might not be on the same object references
                // NOTE: Using non-underscore property names because IPC strips underscore-prefixed properties!
                let syncedCount = 0;
                for (const filteredPlayer of this.filteredPlayers) {
                    if (filteredPlayer.assignedGenr || filteredPlayer.assignedSknt !== undefined || filteredPlayer.assignedRace !== undefined) {
                        // Find matching player in this.players by PGID (unique identifier)
                        const mainPlayer = this.players.find(p => p.PGID === filteredPlayer.PGID);
                        if (mainPlayer && mainPlayer !== filteredPlayer) {
                            if (filteredPlayer.assignedGenr) mainPlayer.assignedGenr = filteredPlayer.assignedGenr;
                            if (filteredPlayer.assignedSknt !== undefined) mainPlayer.assignedSknt = filteredPlayer.assignedSknt;
                            if (filteredPlayer.assignedRace !== undefined) mainPlayer.assignedRace = filteredPlayer.assignedRace;
                            syncedCount++;
                        }
                    }
                }
                if (syncedCount > 0) {
                    console.log(`[app.js] PRE-SAVE SYNC: Synced ${syncedCount} players' assignedGenr/assignedSknt/assignedRace from filteredPlayers`);
                }

                // DEBUG: Check if assignedGenr and assignedSknt are present before sending
                const playersWithGenr = this.players.filter(p => p.assignedGenr);
                const playersWithSknt = this.players.filter(p => p.assignedSknt !== undefined);
                console.log(`[app.js] DEBUG: Before save - ${playersWithGenr.length} players have assignedGenr, ${playersWithSknt.length} have assignedSknt`);
                if (playersWithGenr.length > 0) {
                    console.log('[app.js] DEBUG: Sample:', playersWithGenr[0].PFNA, playersWithGenr[0].PLNA, 'assignedGenr=', playersWithGenr[0].assignedGenr, 'assignedSknt=', playersWithGenr[0].assignedSknt);
                }

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
                    // Debug info from GenericFaceService
                    console.log('[SAVE DEBUG] GenericFaceService loaded:', saveResult.genericFaceServiceLoaded);
                    console.log('[SAVE DEBUG] BLBM players updated:', saveResult.blbmUpdated);
                    console.log('[SAVE DEBUG] BTYP synced:', saveResult.btypSynced);
                    if (saveResult.blbmError) {
                        console.error('[SAVE DEBUG] BLBM error:', saveResult.blbmError);
                    }
                    if (!saveResult.genericFaceServiceLoaded) {
                        console.error('[SAVE DEBUG] *** WARNING: GenericFaceService failed to load! Generic faces NOT fixed! ***');
                    }
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

    async exportRosterCSV() {
        if (!this.players || this.players.length === 0) {
            this.showError('No roster data to export');
            return;
        }

        try {
            // Get visible field codes from current field mapping (excluding portrait column)
            const fieldCodes = this.currentFieldMapping.filter(f => f !== '');

            if (fieldCodes.length === 0) {
                this.showError('No fields to export');
                return;
            }

            // Get friendly display names for headers
            const friendlyHeaders = fieldCodes.map(fieldCode => {
                const fieldDef = getFieldDefinition(fieldCode);
                return fieldDef.display || fieldCode;
            });

            // Build CSV content
            const rows = [];

            // Row 1: Metadata comment with field codes
            rows.push(`# FIELD_CODES: ${fieldCodes.join(',')}`);

            // Row 2: Friendly headers
            rows.push(friendlyHeaders.join(','));

            // Rows 3+: Player data
            for (const player of this.filteredPlayers) {
                const rowData = fieldCodes.map(fieldCode => {
                    const value = this.getPlayerFieldValue(player, fieldCode);
                    // Escape values containing commas or quotes
                    if (value === null || value === undefined) return '';
                    const strValue = String(value);
                    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                        return `"${strValue.replace(/"/g, '""')}"`;
                    }
                    return strValue;
                });
                rows.push(rowData.join(','));
            }

            const csvContent = rows.join('\n');

            // Trigger download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);

            const fileName = this.currentFile ?
                this.currentFile.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') + '.csv' :
                'roster.csv';

            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.setStatus(`Exported ${this.filteredPlayers.length} players to CSV`);
            console.log(`Exported ${this.filteredPlayers.length} players with ${fieldCodes.length} fields`);

        } catch (error) {
            console.error('Error exporting CSV:', error);
            this.showError(`Failed to export CSV: ${error.message}`);
        }
    }

    async importRosterCSV() {
        if (!this.players || this.players.length === 0) {
            this.showError('Please load a roster file before importing CSV');
            return;
        }

        try {
            // Create file input for CSV
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const csvContent = event.target.result;
                        const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);

                        if (lines.length < 3) {
                            this.showError('Invalid CSV format: needs metadata and header rows');
                            return;
                        }

                        // Parse metadata row (field codes)
                        const metadataLine = lines[0];
                        if (!metadataLine.startsWith('# FIELD_CODES:')) {
                            this.showError('Invalid CSV format: missing field codes metadata row');
                            return;
                        }

                        const fieldCodes = metadataLine.replace('# FIELD_CODES:', '').trim().split(',');
                        console.log(`Importing CSV with ${fieldCodes.length} fields:`, fieldCodes);

                        // Skip friendly headers row (line 1)
                        // Parse data rows starting from line 2
                        let importedCount = 0;
                        let errors = [];

                        for (let i = 2; i < lines.length; i++) {
                            const dataLine = lines[i];
                            if (!dataLine) continue;

                            // Simple CSV parsing (handles quoted values)
                            const values = this.parseCSVLine(dataLine);

                            if (values.length !== fieldCodes.length) {
                                errors.push(`Row ${i-1}: column count mismatch (expected ${fieldCodes.length}, got ${values.length})`);
                                continue;
                            }

                            // Row index for updating (i-2 because we skip 2 header rows)
                            const rowIndex = i - 2;

                            if (rowIndex >= this.filteredPlayers.length) {
                                console.warn(`Row ${rowIndex}: exceeds filtered player count, skipping`);
                                break;
                            }

                            const player = this.filteredPlayers[rowIndex];

                            // Track if PID changed (for portrait reload)
                            let pidChanged = false;
                            let newPID = null;

                            // Update player fields
                            fieldCodes.forEach((fieldCode, colIndex) => {
                                const value = values[colIndex];
                                if (value !== '' && value !== null) {
                                    // Convert value to appropriate type
                                    const fieldDef = getFieldDefinition(fieldCode);
                                    let convertedValue = value;

                                    if (fieldDef.type === 'number' || fieldDef.type === 'numeric') {
                                        convertedValue = parseFloat(value);
                                        if (isNaN(convertedValue)) convertedValue = 0;

                                        // Check for weight transform (display = stored + 160)
                                        if (fieldCode === 'PWGT' && fieldDef.transform && fieldDef.transform.save) {
                                            convertedValue = fieldDef.transform.save(convertedValue);
                                        }
                                        // Check for salary transforms (divide by 100 when saving)
                                        else if (fieldCode.startsWith('PSA') || fieldCode === 'PSBO') {
                                            if (fieldDef.transform && fieldDef.transform.save) {
                                                convertedValue = fieldDef.transform.save(convertedValue);
                                            }
                                        }
                                    } else if (fieldDef.type === 'lookup') {
                                        // Convert display name back to ID
                                        convertedValue = this.reverseLookup(fieldDef.lookup, value);
                                        if (convertedValue === null) {
                                            errors.push(`Row ${rowIndex + 1}, ${fieldDef.display}: Unknown value "${value}"`);
                                            return; // Skip this field
                                        }
                                    } else if (fieldDef.type === 'autocomplete' && fieldCode === 'PLAYERPIC') {
                                        // PLAYERPIC is a display field - convert name to PID and update PSXP
                                        const pid = getPIDFromName(value);
                                        if (pid !== null) {
                                            player['PSXP'] = pid;
                                            pidChanged = true;
                                            newPID = pid;
                                        }
                                        convertedValue = value; // Keep the name for display
                                    }

                                    player[fieldCode] = convertedValue;

                                    // Track PID changes for portrait reload
                                    if (fieldCode === 'PSXP') {
                                        pidChanged = true;
                                        newPID = convertedValue;
                                    }
                                }
                            });

                            // Reload portrait if PID changed
                            if (pidChanged && newPID !== null) {
                                const cacheKey = `pid_${newPID}`;
                                this.portraitCache.set(cacheKey, 'loading');

                                window.electronAPI.portrait.getByPID(newPID).then(imageData => {
                                    if (imageData && imageData.length > 0) {
                                        this.portraitCache.set(cacheKey, imageData);
                                    } else {
                                        this.portraitCache.set(cacheKey, null);
                                    }
                                }).catch((error) => {
                                    console.error(`Error loading portrait for PID ${newPID}:`, error);
                                    this.portraitCache.set(cacheKey, null);
                                });
                            }

                            importedCount++;
                        }

                        // Re-render the grid to show updated data and portraits
                        this.renderRoster();

                        if (errors.length > 0) {
                            console.warn('Import completed with errors:', errors);
                            this.setStatus(`Imported ${importedCount} players with ${errors.length} errors (check console)`);
                        } else {
                            this.setStatus(`Successfully imported ${importedCount} players from CSV`);
                        }

                        console.log(`CSV import complete: ${importedCount} players updated`);

                    } catch (error) {
                        console.error('Error parsing CSV:', error);
                        this.showError(`Failed to import CSV: ${error.message}`);
                    }
                };

                reader.readAsText(file);
            };

            input.click();

        } catch (error) {
            console.error('Error importing CSV:', error);
            this.showError(`Failed to import CSV: ${error.message}`);
        }
    }

    parseCSVLine(line) {
        const values = [];
        let currentValue = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    currentValue += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of value
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }

        // Add last value
        values.push(currentValue);

        return values;
    }

    /**
     * Reverse lookup - convert display value back to ID
     * @param {string} lookupType - Type of lookup (positions, teams, colleges, states)
     * @param {string} displayValue - The display value to find
     * @returns {number|null} The ID or null if not found
     */
    reverseLookup(lookupType, displayValue) {
        if (!displayValue || displayValue === '') return null;

        // Get the appropriate lookup map
        let lookupMap;
        switch (lookupType) {
            case 'positions':
                lookupMap = LOOKUP_DATA.positions;
                break;
            case 'teams':
                lookupMap = LOOKUP_DATA.teams;
                break;
            case 'colleges':
                lookupMap = LOOKUP_DATA.colleges;
                break;
            case 'states':
                lookupMap = LOOKUP_DATA.states;
                break;
            case 'pids':
                lookupMap = LOOKUP_DATA.pids;
                break;
            default:
                console.warn(`Unknown lookup type: ${lookupType}`);
                return null;
        }

        if (!lookupMap) {
            console.warn(`Lookup map not found for type: ${lookupType}`);
            return null;
        }

        // Search through the map to find matching value
        for (const [id, name] of lookupMap.entries()) {
            if (name === displayValue) {
                return id;
            }
        }

        // Not found
        return null;
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

    // ========================================
    // Generic Face Picker Methods
    // ========================================

    async openGenericFacePicker(player, rowIndex) {
        const modal = document.getElementById('genericFacePickerModal');
        const grid = document.getElementById('genericFaceGrid');

        // Store current player context
        this.currentFacePickerPlayer = player;
        this.currentFacePickerRowIndex = rowIndex;

        // Show modal
        modal.style.display = 'flex';

        // Show loading state
        grid.innerHTML = '<div class="loading-spinner">Loading generic faces...</div>';

        try {
            // Lazy-load generic faces
            const genericFaces = await this.loadGenericFaces();

            if (genericFaces.length === 0) {
                grid.innerHTML = '<div class="loading-spinner">No generic faces found</div>';
                return;
            }

            // Clear grid and populate with faces
            grid.innerHTML = '';

            // Create placeholder image for loading state
            const placeholderSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj4uLi48L3RleHQ+PC9zdmc+';

            // Load faces in batches to prevent UI freeze
            const BATCH_SIZE = 10;  // Smaller batches for smoother UI
            let currentIndex = 0;

            const loadBatch = () => {
                const endIndex = Math.min(currentIndex + BATCH_SIZE, genericFaces.length);

                for (let i = currentIndex; i < endIndex; i++) {
                    const face = genericFaces[i];
                    const faceItem = document.createElement('div');
                    faceItem.className = 'generic-face-item';
                    faceItem.dataset.pid = face.pid;

                    // Create image with placeholder
                    const img = document.createElement('img');
                    img.alt = `Generic Face ${face.pid}`;
                    img.src = placeholderSvg;

                    const pidLabel = document.createElement('div');
                    pidLabel.className = 'generic-face-pid';
                    pidLabel.textContent = `PID ${face.pid}`;

                    faceItem.appendChild(img);
                    faceItem.appendChild(pidLabel);

                    // Click handler to select this face
                    // Pass verified GENR/SKNT values directly for exact face matching
                    faceItem.addEventListener('click', () => {
                        this.selectGenericFace(face.pid, face.portrait, face._verifiedGenr, face._verifiedSknt);
                    });

                    grid.appendChild(faceItem);

                    // Load portrait asynchronously without blocking UI
                    // Hide faces that don't have portraits in the atlas
                    window.electronAPI.portrait.getByPID(face.pid).then(imageData => {
                        if (imageData && imageData.length > 0) {
                            img.src = imageData;
                        } else {
                            // No portrait available - hide this face from picker
                            faceItem.style.display = 'none';
                        }
                    }).catch(error => {
                        console.error(`Failed to load portrait for PID ${face.pid}:`, error);
                        // Hide on error too
                        faceItem.style.display = 'none';
                    });
                }

                currentIndex = endIndex;

                // Schedule next batch if there are more faces
                if (currentIndex < genericFaces.length) {
                    requestAnimationFrame(loadBatch);
                }
            };

            // Start loading batches
            loadBatch();

        } catch (error) {
            console.error('Error loading generic faces:', error);
            grid.innerHTML = '<div class="loading-spinner">Error loading generic faces</div>';
        }
    }

    async loadGenericFaces() {
        try {
            // Get the VERIFIED portrait->GENR mapping (268 faces that work correctly in-game)
            // This mapping was extracted by comparing working roster files
            let verifiedMapping = {};
            try {
                verifiedMapping = await window.electronAPI.lookup.getVerifiedPortraitGenrMapping();
                console.log(`[loadGenericFaces] Loaded ${Object.keys(verifiedMapping).length} verified portrait->GENR mappings`);
            } catch (e) {
                console.error('[loadGenericFaces] Could not load verified mapping:', e);
            }

            // Get PID_Portrait_Mapping.csv data for portrait images
            const mapping = await window.electronAPI.lookup.getPIDPortraitMapping();

            // Filter to only type='generic' entries
            const allGenericFaces = mapping.filter(entry => entry.type === 'generic');

            // CRITICAL: Only include portraits that exist in our verified mapping
            // These are the 268 faces that have correct GENR values and work in-game
            const verifiedPortraits = new Set(Object.keys(verifiedMapping));
            const validGenericFaces = allGenericFaces.filter(face => verifiedPortraits.has(face.portrait));

            console.log(`[loadGenericFaces] Filtered from ${allGenericFaces.length} to ${validGenericFaces.length} faces with verified GENR mappings`);

            // Deduplicate by portrait - keep only first PID for each unique face appearance
            // This ensures each face shows once even if multiple PIDs share the same portrait
            const seenPortraits = new Set();
            const uniqueFaces = [];

            for (const face of validGenericFaces) {
                if (!seenPortraits.has(face.portrait)) {
                    seenPortraits.add(face.portrait);
                    // Attach the verified GENR/SKNT directly to the face object
                    const verifiedData = verifiedMapping[face.portrait];
                    face._verifiedGenr = verifiedData?.genr;
                    face._verifiedSknt = verifiedData?.sknt;
                    uniqueFaces.push(face);
                }
            }

            // Sort by skin tone category (1-7) for better organization
            uniqueFaces.sort((a, b) => {
                const toneA = parseInt(a.portrait.match(/plpo_generic_(\d+)_/)?.[1] || '0');
                const toneB = parseInt(b.portrait.match(/plpo_generic_(\d+)_/)?.[1] || '0');
                return toneA - toneB;
            });

            console.log(`Loaded ${allGenericFaces.length} total generic entries, filtered to ${uniqueFaces.length} unique verified faces`);

            return uniqueFaces;
        } catch (error) {
            console.error('Error loading generic faces from CSV:', error);
            return [];
        }
    }

    async selectGenericFace(pid, portrait = null, verifiedGenr = null, verifiedSknt = null) {
        console.log(`[GenericFacePicker] ===== START selectGenericFace(${pid}, portrait=${portrait}, verifiedGenr=${verifiedGenr}, verifiedSknt=${verifiedSknt}) =====`);

        // Prevent double-execution if already processing
        if (this.isSelectingGenericFace) {
            console.warn('[GenericFacePicker] Already processing a face selection, ignoring duplicate call');
            return;
        }

        this.isSelectingGenericFace = true;

        try {
            if (!this.currentFacePickerPlayer) {
                console.error('[GenericFacePicker] No player context for face selection');
                return;
            }

        const gridRowIndex = this.currentFacePickerRowIndex;
        console.log(`[GenericFacePicker] Grid row index: ${gridRowIndex}`);
        console.log(`[GenericFacePicker] Player object keys:`, Object.keys(this.currentFacePickerPlayer));

        // Determine which grid and data array we're working with
        const isRoster = 'PSXP' in this.currentFacePickerPlayer;
        const isDraft = 'PID' in this.currentFacePickerPlayer;
        console.log(`[GenericFacePicker] isRoster: ${isRoster}, isDraft: ${isDraft}`);

        const grid = isRoster ? this.agGrid : (isDraft ? this.draftGrid : null);
        const dataArray = isRoster ? this.filteredPlayers : (isDraft ? this.draftProspects : null);

        console.log(`[GenericFacePicker] Grid exists: ${!!grid}`);
        console.log(`[GenericFacePicker] DataArray exists: ${!!dataArray}, length: ${dataArray ? dataArray.length : 'N/A'}`);

        if (!grid) {
            console.error('[GenericFacePicker] Grid is missing');
            console.error(`  - this.agGrid: ${!!this.agGrid}`);
            console.error(`  - this.draftGrid: ${!!this.draftGrid}`);
            return;
        }

        // For Handsontable (draft mode only), check if destroyed
        if (isDraft && grid.isDestroyed) {
            console.error('[GenericFacePicker] Draft grid is destroyed');
            return;
        }

        if (!dataArray) {
            console.error('[GenericFacePicker] Data array is missing');
            console.error(`  - this.filteredPlayers: ${!!this.filteredPlayers}`);
            console.error(`  - this.draftProspects: ${!!this.draftProspects}`);
            return;
        }

        // CRITICAL: Get the player data from AG-Grid's row node directly
        // This works for both paginated players AND newly added players (via applyTransaction)
        let player;
        if (isRoster && this.agGrid) {
            // Get the row node from AG-Grid by display index
            const rowNode = this.agGrid.getDisplayedRowAtIndex(gridRowIndex);
            if (rowNode && rowNode.data) {
                player = rowNode.data;
                console.log(`[GenericFacePicker] Got player from AG-Grid rowNode at index ${gridRowIndex}:`, player.PFNA, player.PLNA);
            } else {
                // Fallback to pagination mapping if rowNode not found
                let actualDataIndex = gridRowIndex;
                if (this.paginatedPlayerIndices && this.paginatedPlayerIndices[gridRowIndex] !== undefined) {
                    actualDataIndex = this.paginatedPlayerIndices[gridRowIndex];
                    console.log(`[GenericFacePicker] Mapped grid row ${gridRowIndex} to data index ${actualDataIndex} via paginatedPlayerIndices`);
                }
                player = dataArray[actualDataIndex];
            }
        } else {
            // Non-roster (draft class) - use direct index
            player = dataArray[gridRowIndex];
        }

        if (!player) {
            console.error(`[GenericFacePicker] No player found at grid index ${gridRowIndex}`);
            console.error(`  - dataArray.length: ${dataArray.length}`);
            console.error(`  - paginatedPlayerIndices: ${this.paginatedPlayerIndices}`);
            return;
        }

        console.log(`[GenericFacePicker] Found player:`, player.PFNA || player.firstName, player.PLNA || player.lastName);

        // Find the PID and Player Pic column indices using field mapping
        let pidColumnIndex = -1;
        let playerPicColumnIndex = -1;

        console.log(`[GenericFacePicker] Looking for PID and Player Pic columns...`);

        if (isRoster) {
            // For roster, look for PSXP and PLAYERPIC fields in currentFieldMapping
            // currentFieldMapping is ['', 'field1', 'field2', ...] where '' is portrait column at index 0
            console.log(`[GenericFacePicker] this.currentFieldMapping exists: ${!!this.currentFieldMapping}`);
            console.log(`[GenericFacePicker] currentFieldMapping:`, this.currentFieldMapping);

            if (this.currentFieldMapping) {
                pidColumnIndex = this.currentFieldMapping.indexOf('PSXP');
                playerPicColumnIndex = this.currentFieldMapping.indexOf('PLAYERPIC');
                console.log(`[GenericFacePicker] PSXP column index: ${pidColumnIndex}`);
                console.log(`[GenericFacePicker] PLAYERPIC column index: ${playerPicColumnIndex}`);
            } else {
                console.error(`[GenericFacePicker] ERROR: currentFieldMapping is undefined/null!`);
            }
        } else if (isDraft) {
            // For draft class, PID field should be in the columns
            const colHeaders = grid.getColHeader();
            pidColumnIndex = colHeaders.indexOf('PID');
            playerPicColumnIndex = colHeaders.indexOf('Player Pic');
            console.log(`[GenericFacePicker] Draft PID column index: ${pidColumnIndex}`);
            console.log(`[GenericFacePicker] Draft Player Pic column index: ${playerPicColumnIndex}`);
        }

        console.log(`[GenericFacePicker] FINAL PID column index: ${pidColumnIndex}, Player Pic: ${playerPicColumnIndex}`);

        // Update player PID - handle both roster (PSXP) and draft class (PID) fields
        // Also look up and update race based on the generic face's race
        let newRace = null;
        try {
            newRace = await window.electronAPI.lookup.getRaceByPID(pid);
            console.log(`[GenericFacePicker] Looked up race for PID ${pid}: ${newRace}`);
        } catch (err) {
            console.warn(`[GenericFacePicker] Could not get race for PID ${pid}:`, err);
        }

        if (isRoster) {
            // Roster player - update the actual player object in filteredPlayers
            const oldPID = player.PSXP;
            const oldRace = player.PLRC;
            player.PSXP = pid;
            player.PLAYERPIC = 'Generic Face'; // Update Player Pic field

            // CRITICAL: Set PEPS (PAM) to GENR format for in-game face assignment
            // Use verifiedGenr if available, otherwise convert portrait key to GENR format
            const pepsValue = verifiedGenr || (portrait ? portrait.replace('plpo_generic_', 'gen_') : null);
            if (pepsValue) {
                player.PEPS = pepsValue;
                console.log(`[GenericFacePicker] Set player.PEPS to "${pepsValue}"`);
            }

            // CRITICAL: Use VERIFIED GENR/SKNT values for exact face matching
            // These are the 268 faces that work correctly in-game
            // NOTE: Using non-underscore property names because IPC strips underscore-prefixed properties!
            let genrValue = null;
            if (verifiedGenr && verifiedSknt !== null) {
                // Use the verified values directly - these are guaranteed to work in-game
                player.assignedGenr = verifiedGenr;
                player.assignedSknt = verifiedSknt;
                genrValue = verifiedGenr;
                console.log(`[GenericFacePicker] Set VERIFIED assignedGenr="${verifiedGenr}", assignedSknt=${verifiedSknt}`);
            } else if (portrait && portrait.includes('generic_')) {
                // Fallback: Convert portrait name to GENR format (for non-verified faces)
                genrValue = portrait.replace('plpo_generic_', 'gen_');
                player.assignedGenr = genrValue;

                // Extract SKNT from the first number in the portrait name
                const skntMatch = portrait.match(/generic_(\d+)/);
                if (skntMatch) {
                    player.assignedSknt = parseInt(skntMatch[1]);
                }

                console.log(`[GenericFacePicker] Set FALLBACK assignedGenr="${genrValue}", assignedSknt=${player.assignedSknt} from portrait "${portrait}"`);
            }

            // CRITICAL: Sync assignedGenr/assignedSknt/PEPS to this.players array to ensure persistence
            if (genrValue) {
                const playerIndex = this.players.indexOf(player);
                if (playerIndex >= 0) {
                    this.players[playerIndex].assignedGenr = player.assignedGenr;
                    this.players[playerIndex].assignedSknt = player.assignedSknt;
                    this.players[playerIndex].PEPS = player.PEPS;
                    this.players[playerIndex].PSXP = player.PSXP;
                    console.log(`[GenericFacePicker] Synced to this.players[${playerIndex}] - PEPS="${player.PEPS}", PSXP=${player.PSXP}`);
                } else {
                    // Fallback: search by unique identifier (PSXP + name combination)
                    const originalPlayer = this.players.find(p =>
                        p.PFNA === player.PFNA && p.PLNA === player.PLNA &&
                        (p.PSXP === player.PSXP || p.PSXP === oldPID)
                    );
                    if (originalPlayer) {
                        originalPlayer.assignedGenr = player.assignedGenr;
                        originalPlayer.assignedSknt = player.assignedSknt;
                        originalPlayer.PEPS = player.PEPS;
                        originalPlayer.PSXP = player.PSXP;
                        console.log(`[GenericFacePicker] Synced to this.players via name/PID search - PEPS="${player.PEPS}", PSXP=${player.PSXP}`);
                    } else {
                        console.warn(`[GenericFacePicker] Could not find player in this.players to sync assignedGenr/assignedSknt/PEPS!`);
                    }
                }
            }

            if (newRace !== null) {
                player.PLRC = newRace;
                player.assignedRace = newRace; // Also update assignedRace for BLBM GENR/SKNT assignment
            }

            // CRITICAL: Set PGHE (Player Generic Head) for the face model
            // PGHE controls which face MODEL appears in-game (values 1-290)
            const blackPGHEs = [6, 42, 57, 64, 79, 89, 101, 102, 108, 114, 131, 138, 143, 148, 160, 161, 164, 190, 209, 210, 211, 224, 230, 255, 257, 267, 274, 280];
            const whitePGHEs = [11, 12, 18, 24, 50, 54, 55, 56, 85, 90, 146, 154, 155, 158, 176, 202, 212, 227, 239, 243, 245, 253, 256, 264, 290];
            const sharedPGHEs = [1, 7, 21, 25, 27, 34, 36, 53, 59, 62, 67, 77, 84, 93, 99, 100, 109, 119, 120, 128, 132, 139, 142, 147, 157, 162, 183, 188, 200, 232, 246, 247, 261, 271, 273, 278, 282, 286, 287, 288];

            const raceForPGHE = newRace !== null ? newRace : (player.PLRC ?? 7);
            let pghePool;
            if (raceForPGHE === 7) {
                pghePool = [...blackPGHEs, ...sharedPGHEs];
            } else if (raceForPGHE === 1) {
                pghePool = [...whitePGHEs, ...sharedPGHEs];
            } else {
                pghePool = sharedPGHEs;
            }

            const oldPGHE = player.PGHE;
            player.PGHE = pghePool[Math.floor(Math.random() * pghePool.length)];
            console.log(`[GenericFacePicker] Set PGHE from ${oldPGHE} to ${player.PGHE} (race=${raceForPGHE})`);

            // Sync PGHE to this.players array
            const pghePlayerIndex = this.players.indexOf(player);
            if (pghePlayerIndex >= 0) {
                this.players[pghePlayerIndex].PGHE = player.PGHE;
            } else {
                const originalPlayer = this.players.find(p =>
                    p.PFNA === player.PFNA && p.PLNA === player.PLNA
                );
                if (originalPlayer) {
                    originalPlayer.PGHE = player.PGHE;
                }
            }

            console.log(`[GenericFacePicker] Updated player.PSXP from ${oldPID} to ${pid}`);
            console.log(`[GenericFacePicker] Updated player.PLAYERPIC to "Generic Face"`);
            if (newRace !== null) {
                console.log(`[GenericFacePicker] Updated player.PLRC from ${oldRace} to ${newRace}`);
            }
        } else if (isDraft) {
            // Draft class prospect - update the actual prospect object in draftProspects
            const oldPID = player.PID;
            player.PID = pid;
            console.log(`[GenericFacePicker] Updated player.PID from ${oldPID} to ${pid}`);
        }

        console.log(`[GenericFacePicker] Data updates complete. Updating grid immediately...`);

        // PERFORMANCE FIX: Don't await portrait loading - update grid immediately
        // Load portrait in background, cell will show "loading..." then auto-update when ready
        // CRITICAL: For generic faces, use PAM-based cache key (matches grid renderer logic)
        const pepsValue = verifiedGenr || (portrait ? portrait.replace('plpo_generic_', 'gen_') : null);
        const cacheKey = pepsValue ? `pam_${pepsValue}` : `pid_${pid}`;

        if (!this.portraitCache.has(cacheKey)) {
            console.log(`[GenericFacePicker] Starting portrait load in background: ${cacheKey}`);
            this.portraitCache.set(cacheKey, 'loading');

            // Load in background (no await)
            // For generic faces, load by PAM; for real faces, load by PID
            const loadPromise = pepsValue
                ? window.electronAPI.portrait.getImageDataByPam(pepsValue)
                : window.electronAPI.portrait.getByPID(pid);

            loadPromise.then(imageData => {
                if (imageData && imageData.length > 0) {
                    this.portraitCache.set(cacheKey, imageData);
                    console.log(`[GenericFacePicker] Portrait loaded in background, length: ${imageData.length}`);
                    // Re-render to show the loaded portrait
                    if (isRoster && this.agGrid) {
                        // AG-Grid: refresh cells to update portrait display
                        this.agGrid.refreshCells({ force: true });
                    } else if (isDraft && grid && !grid.isDestroyed) {
                        // Handsontable: render the grid
                        grid.render();
                    }
                } else {
                    this.portraitCache.set(cacheKey, null);
                    console.warn(`[GenericFacePicker] No portrait data for ${cacheKey}`);
                }
            }).catch(error => {
                console.error(`[GenericFacePicker] Error loading portrait:`, error);
                this.portraitCache.set(cacheKey, null);
            });
        } else {
            console.log(`[GenericFacePicker] Portrait already in cache: ${cacheKey}`);
        }

        console.log(`[GenericFacePicker] Updating grid display...`);

        if (isRoster && this.agGrid) {
            // AG-Grid: Get the row node and update data through API (not direct modification)
            // This ensures AG-Grid detects the change and properly refreshes
            const rowNode = this.agGrid.getDisplayedRowAtIndex(gridRowIndex);
            if (rowNode) {
                // Update via AG-Grid API - this triggers proper cell refresh
                rowNode.setDataValue('PSXP', pid);
                rowNode.setDataValue('PLAYERPIC', 'Generic Face');
                // CRITICAL: Use GENR format for PEPS (PAM), not portrait key format
                const gridPepsValue = verifiedGenr || (portrait ? portrait.replace('plpo_generic_', 'gen_') : null);
                if (gridPepsValue) {
                    rowNode.setDataValue('PEPS', gridPepsValue);
                }
                if (newRace !== null) {
                    rowNode.setDataValue('PLRC', newRace);
                }
                console.log(`[GenericFacePicker] Updated row via setDataValue: PSXP=${pid}, PLAYERPIC=Generic Face, PEPS=${gridPepsValue}, PLRC=${newRace}`);

                // Force refresh the portrait column specifically
                this.agGrid.refreshCells({
                    rowNodes: [rowNode],
                    columns: ['_portrait'],
                    force: true
                });
                console.log(`[GenericFacePicker] Portrait cell refreshed for row ${gridRowIndex}`);
            } else {
                console.error(`[GenericFacePicker] Could not find row node at index ${gridRowIndex}`);
            }
        } else if (isDraft) {
            // Handsontable: Use setDataAtCell to update the grid
            const changes = [];

            // Update portrait cell (column 0) - just set row index to trigger portrait renderer
            changes.push([gridRowIndex, 0, gridRowIndex]);

            // Update PID column if found
            if (pidColumnIndex >= 0) {
                changes.push([gridRowIndex, pidColumnIndex, pid]);
                console.log(`[GenericFacePicker] Queuing PID update: row ${gridRowIndex}, col ${pidColumnIndex}, value ${pid}`);
            }

            // Update Player Pic column if found
            if (playerPicColumnIndex >= 0) {
                changes.push([gridRowIndex, playerPicColumnIndex, 'Generic Face']);
                console.log(`[GenericFacePicker] Queuing Player Pic update: row ${gridRowIndex}, col ${playerPicColumnIndex}, value "Generic Face"`);
            }

            // Apply all changes in one batch
            if (changes.length > 0 && !grid.isDestroyed) {
                grid.setDataAtCell(changes, null, null, 'GenericFacePicker');
                console.log(`[GenericFacePicker] Applied ${changes.length} cell updates via setDataAtCell`);
            }
        }

        // Close modal after updates
        console.log(`[GenericFacePicker] Closing modal...`);
        this.closeGenericFacePicker();
        console.log(`[GenericFacePicker] Complete - portrait and PID updated, no freeze`);

        console.log(`[GenericFacePicker] ===== DONE =====`);

        } finally {
            // Clear the processing flag
            this.isSelectingGenericFace = false;
        }
    }

    closeGenericFacePicker() {
        document.getElementById('genericFacePickerModal').style.display = 'none';
        this.currentFacePickerPlayer = null;
        this.currentFacePickerRowIndex = null;
    }

    /**
     * Fix generic faces - looks up correct race from database and assigns proper GENR/SKNT
     * Uses PGHE lookup from game's streameddata.DB to assign proper generic faces.
     * Each generic face has its own PID (PSXP) - we assign that PID to the player.
     * Sets: PSXP (PID), PEPS (GENR), assignedGenr, assignedSknt, assignedRace
     * GenericFaceService.updateBLBMForGenericFaces() applies BLBM changes on save.
     * Works on both ROSTER files and DRAFT CLASS files.
     */
    async fixGenericFaces() {
        // Determine data source: roster (this.players) or draft class (this.currentDraftClass)
        const isDraftClass = this.currentDraftClass && this.currentDraftClass.prospects && this.currentDraftClass.prospects.length > 0;
        const isRoster = this.players && this.players.length > 0;

        if (!isDraftClass && !isRoster) {
            this.showError('No roster or draft class loaded. Please load a file first.');
            return;
        }

        const dataSource = isDraftClass ? this.currentDraftClass.prospects : this.players;
        const dataType = isDraftClass ? 'draft class' : 'roster';

        console.log(`[FixFaces] Starting PGHE-based face assignment on ${dataType}...`);
        console.log(`[FixFaces] Processing ${dataSource.length} ${isDraftClass ? 'prospects' : 'players'}`);

        // Initialize PGHE service
        try {
            await window.electronAPI.pghe.initialize();
            console.log('[FixFaces] PGHE service initialized');
        } catch (e) {
            console.error('[FixFaces] Failed to initialize PGHE service:', e);
            this.showError('Failed to initialize generic face service');
            return;
        }

        let fixedCount = 0;
        let skippedReal = 0;
        let noRaceFound = 0;
        let failedAssignment = 0;

        // DEBUG: Log first 5 entries BEFORE fix
        console.log(`[FixFaces] BEFORE - First 5 ${isDraftClass ? 'prospects' : 'players'}:`);
        for (let i = 0; i < Math.min(5, dataSource.length); i++) {
            const p = dataSource[i];
            if (isDraftClass) {
                console.log(`  ${i}: ${p.firstName} ${p.lastName} - PID=${p.PID}, PEPS="${p.PEPS}"`);
            } else {
                console.log(`  ${i}: ${p.PFNA} ${p.PLNA} - PID=${p.PSXP}, PLPL=${p.PLPL}, PEPS="${p.PEPS}", PLRC=${p.PLRC}`);
            }
        }

        for (const entry of dataSource) {
            // Get field values based on data type (roster vs draft class)
            const plpl = isDraftClass ? 0 : (entry.PLPL ?? 0); // Draft class = all generic by default
            const peps = entry.PEPS ?? '';
            const existingPid = isDraftClass ? entry.PID : entry.PSXP;
            const playerName = isDraftClass
                ? `${entry.firstName || ''} ${entry.lastName || ''}`.trim()
                : `${entry.PFNA || ''} ${entry.PLNA || ''}`.trim();

            // Determine if this is a generic face player
            // For roster: PLPL=0 means generic face, PLPL=100 means real face scan
            // For draft class: check if PAM is a real player PAM or generic
            const isGenericFace = isDraftClass
                ? (!peps || peps.startsWith('gen_') || peps.includes('generic') || existingPid === 0)
                : (plpl === 0 || plpl === '0');

            // Check if PAM is for a real player (not generic)
            const hasRealPAM = peps && typeof peps === 'string' && peps.length > 0 &&
                               !peps.startsWith('gen_') && !peps.includes('generic');

            // Skip players with REAL faces (has real PAM or PLPL != 0) - don't touch their PID
            if (!isGenericFace || hasRealPAM) {
                skippedReal++;
                continue;
            }

            // Get race from player's data
            let race = isDraftClass ? (entry.race || entry.skinTone) : entry.PLRC;

            // If no race on player, try to look up from database using existing PID
            if (!race || race === 0) {
                if (existingPid) {
                    try {
                        race = await window.electronAPI.lookup.getRaceByPID(existingPid);
                    } catch (e) {
                        // Silent fail
                    }
                }
            }

            if (!race || race === 0) {
                noRaceFound++;
                // Default to middle skin tone (4) if nothing found
                race = 4;
            }

            // Use PGHE service to get a random face for this race
            // Race 1-7 maps directly to skin tone 1-7
            let pgheEntry = null;
            try {
                pgheEntry = await window.electronAPI.pghe.getRandomByRace(race);
            } catch (e) {
                console.error(`[FixFaces] Failed to get PGHE for race ${race}:`, e);
            }

            if (!pgheEntry) {
                failedAssignment++;
                console.warn(`[FixFaces] No PGHE entry found for ${playerName}, race=${race}`);
                continue;
            }

            // Assign the PGHE face to this player/prospect
            // Set ALL fields from PGHE lookup (PGHE, PFCG, GPAN, GSLP, PSXP, CPVF)

            if (isDraftClass) {
                // Draft class uses different field names
                entry.PID = pgheEntry.psxp;      // CRITICAL: Set PID to PGHE entry's PID
                entry.PEPS = pgheEntry.genr;     // Set PEPS (PAM) to the GENR value

                // Update visuals.genericHeadName if visuals object exists
                if (entry.visuals) {
                    entry.visuals.genericHeadName = pgheEntry.genr;
                    entry.visuals.skinTone = pgheEntry.skinTone;
                }

                // Store PGHE matched set for saving
                entry.assignedPghe = pgheEntry.pghe;
                entry.assignedPfcg = pgheEntry.pfcg;
                entry.assignedGpan = pgheEntry.gpan;
                entry.assignedGslp = pgheEntry.gslp;
                entry.assignedPghePid = pgheEntry.psxp;
                entry.assignedCpvf = pgheEntry.cpvf;
                entry.assignedGenr = pgheEntry.genr;
                entry.assignedSknt = pgheEntry.skinTone;
                entry.race = race;
                entry.skinTone = pgheEntry.skinTone;

                // Update playerPic for grid display
                entry.playerPic = 'Generic Face';
            } else {
                // Roster uses PSXP, PLPL, PLRC field names
                entry.PSXP = pgheEntry.psxp;     // CRITICAL: Set PSXP to PGHE entry's PID
                entry.PEPS = pgheEntry.genr;     // Set PEPS (PAM) to the GENR value
                entry.PGHE = pgheEntry.pghe;     // Set PGHE (face picker index)

                // Store ALL PGHE data for GenericFaceService
                entry.assignedPghe = pgheEntry.pghe;
                entry.assignedPfcg = pgheEntry.pfcg;
                entry.assignedGpan = pgheEntry.gpan;
                entry.assignedGslp = pgheEntry.gslp;
                entry.assignedPghePid = pgheEntry.psxp;
                entry.assignedCpvf = pgheEntry.cpvf;
                entry.assignedGenr = pgheEntry.genr;
                entry.assignedSknt = pgheEntry.skinTone;
                entry.assignedRace = race;

                // Update PLRC to match the assigned skin tone
                entry.PLRC = race;

                // Update PLAYERPIC to show it's a generic face
                entry.PLAYERPIC = 'Generic Face';
            }

            fixedCount++;

            if (fixedCount <= 10) {
                console.log(`[FixFaces] ${playerName}: race=${race} -> PGHE=${pgheEntry.pghe}, PFCG="${pgheEntry.pfcg}", PSXP=${pgheEntry.psxp}, GENR="${pgheEntry.genr}", SKNT=${pgheEntry.skinTone}`);
            }
        }

        // DEBUG: Log first 5 entries AFTER fix
        console.log(`[FixFaces] AFTER - First 5 ${isDraftClass ? 'prospects' : 'players'}:`);
        for (let i = 0; i < Math.min(5, dataSource.length); i++) {
            const p = dataSource[i];
            if (isDraftClass) {
                console.log(`  ${i}: ${p.firstName} ${p.lastName} - PID=${p.PID}, PEPS="${p.PEPS}"`);
            } else {
                console.log(`  ${i}: ${p.PFNA} ${p.PLNA} - PID=${p.PSXP}, PLPL=${p.PLPL}, PEPS="${p.PEPS}", PLRC=${p.PLRC}`);
            }
        }

        console.log(`[FixFaces] Clearing portrait cache and reloading...`);

        // Clear ALL portrait cache to force reload with new PID values
        if (this.portraitCache) {
            this.portraitCache.clear();
        }

        // Force reload portraits for current page
        await this.reloadCurrentPagePortraits();

        // Refresh the appropriate grid
        if (isDraftClass && this.draftGrid) {
            this.draftGrid.render();
        } else if (this.hot) {
            this.hot.render();
        } else if (this.agGrid) {
            this.agGrid.refreshCells({ force: true });
        }

        const saveTarget = isDraftClass ? 'draft class' : 'roster';
        const msg = `Fixed ${fixedCount} ${isDraftClass ? 'prospects' : 'players'} with PGHE generic faces.\n\n` +
                    `Skipped ${skippedReal} with real PAM.\n` +
                    `${noRaceFound} had no race data (used default).\n` +
                    `${failedAssignment} failed to find matching face.\n\n` +
                    `SAVE the ${saveTarget} to apply changes!`;

        console.log('[FixFaces]', msg);
        alert(msg);
    }

    /**
     * Reload portraits for the current page of players
     * Used after Fix Faces to show updated generic faces
     */
    async reloadCurrentPagePortraits() {
        // Use filteredPlayers if available, otherwise use players
        const playersToLoad = this.filteredPlayers && this.filteredPlayers.length > 0
            ? this.filteredPlayers
            : this.players;

        if (!playersToLoad || playersToLoad.length === 0) return;

        // Load first 100 players (visible on screen typically)
        const paginatedPlayers = playersToLoad.slice(0, 100);

        console.log(`[reloadCurrentPagePortraits] Loading portraits for ${paginatedPlayers.length} players (from ${playersToLoad.length} total)`);

        const loadPromises = [];

        for (const player of paginatedPlayers) {
            const pid = player.PSXP;
            const pam = player.PEPS;

            // Check if this is a generic face based on PAM
            const isGenericPam = pam && typeof pam === 'string' &&
                (pam.startsWith('gen_') || pam.startsWith('plpo_generic_') || pam.includes('generic'));

            // Use PAM as cache key for generic faces, PID for real faces
            const cacheKey = isGenericPam ? `pam_${pam}` : `pid_${pid}`;

            // Skip if already in cache
            if (this.portraitCache.has(cacheKey)) continue;

            this.portraitCache.set(cacheKey, 'loading');

            if (isGenericPam) {
                // Load by PAM for generic faces (PAM is already in gen_ format)
                const promise = window.electronAPI.portrait.getImageDataByPam(pam)
                    .then((imageData) => {
                        this.portraitCache.set(cacheKey, imageData || null);
                    })
                    .catch((err) => {
                        console.error(`Error loading PAM portrait ${pam}:`, err);
                        this.portraitCache.set(cacheKey, null);
                    });
                loadPromises.push(promise);
            } else if (pid !== null && pid !== undefined) {
                // Load by PID for real faces
                const promise = window.electronAPI.portrait.getByPID(pid)
                    .then((imageData) => {
                        this.portraitCache.set(cacheKey, imageData || null);
                    })
                    .catch((err) => {
                        console.error(`Error loading PID portrait ${pid}:`, err);
                        this.portraitCache.set(cacheKey, null);
                    });
                loadPromises.push(promise);
            }
        }

        // Wait for all portraits to load
        await Promise.all(loadPromises);
        console.log(`[reloadCurrentPagePortraits] Loaded ${loadPromises.length} portraits`);
    }

    // ========================================
    // Draft Class Methods
    // ========================================

    async openDraftClassDialog() {
        try {
            if (typeof window.electronAPI !== 'undefined') {
                const result = await window.electronAPI.file.openDialog(null);

                if (result.success && result.filePath) {
                    await this.loadDraftClass(result.filePath);
                } else if (result.error) {
                    this.showError(`Failed to open file: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Error opening draft class dialog:', error);
            this.showError(`Error opening file dialog: ${error.message}`);
        }
    }

    async loadDraftClass(filePath) {
        try {
            console.log('Loading draft class:', filePath);

            const result = await window.electronAPI.draftClass.load(filePath);

            if (!result.success) {
                throw new Error(result.error || 'Failed to load draft class');
            }

            this.currentDraftClass = result.data;
            this.currentDraftFilePath = filePath;

            // Pre-calculate round for ALL prospects immediately
            // This ensures filterDraftProspects works correctly even before grid is fully rendered
            result.data.prospects.forEach((prospect, index) => {
                if (prospect.round === undefined || prospect.round === null) {
                    const draftPosition = prospect.draftPosition !== undefined ? prospect.draftPosition : index;
                    const pickNum = draftPosition + 1;
                    if (pickNum <= 224) {
                        prospect.round = Math.floor((pickNum - 1) / 32) + 1;
                    } else {
                        prospect.round = 8; // UFA
                    }
                }
            });
            console.log(`[Draft] Pre-calculated rounds for ${result.data.prospects.length} prospects`);
            console.log(`[Draft] Round distribution:`, {
                round1: result.data.prospects.filter(p => p.round === 1).length,
                round2: result.data.prospects.filter(p => p.round === 2).length,
                round3: result.data.prospects.filter(p => p.round === 3).length,
                round4: result.data.prospects.filter(p => p.round === 4).length,
                round5: result.data.prospects.filter(p => p.round === 5).length,
                round6: result.data.prospects.filter(p => p.round === 6).length,
                round7: result.data.prospects.filter(p => p.round === 7).length,
                ufa: result.data.prospects.filter(p => p.round === 8).length
            });

            // Update UI
            document.getElementById('draft-file-name').textContent = filePath.split(/[/\\]/).pop();
            document.getElementById('draft-file-stats').textContent =
                `${result.data.prospects.length} prospects | Year: ${result.data.header.year}`;

            // Enable buttons
            document.getElementById('save-draft-btn').disabled = false;
            document.getElementById('export-draft-json-btn').disabled = false;
            document.getElementById('import-draft-csv-btn').disabled = false;
            document.getElementById('fillFromDbDraftBtn').disabled = false;

            // Create grid (await to ensure it completes)
            await this.createDraftGrid(result.data.prospects);

            console.log('Draft class loaded successfully:', result.data.prospects.length, 'prospects');
        } catch (error) {
            console.error('Error loading draft class:', error);
            this.showError(`Failed to load draft class: ${error.message}`);
        }
    }

    /**
     * Create a new empty draft class from scratch
     * Allows users to build a draft class entirely from the database
     */
    createNewDraftClass() {
        console.log('[app.js] Creating new empty draft class');

        // Create default header with current year
        const currentYear = new Date().getFullYear();
        this.currentDraftClass = {
            header: {
                year: currentYear,
                version: 26,
                prospectCount: 0
            },
            prospects: []
        };
        this.currentDraftFilePath = null;

        // Clear tracking for fresh draft
        if (window.electronAPI && window.electronAPI.editorTracking) {
            window.electronAPI.editorTracking.clear('draft');
        }

        // Update UI
        document.getElementById('draft-file-name').textContent = 'New Draft Class (unsaved)';
        document.getElementById('draft-file-stats').textContent = `0 prospects | Year: ${currentYear}`;

        // Enable buttons
        document.getElementById('save-draft-btn').disabled = false;
        document.getElementById('export-draft-json-btn').disabled = false;
        document.getElementById('import-draft-csv-btn').disabled = false;
        document.getElementById('fillFromDbDraftBtn').disabled = false;

        // Create empty grid
        this.createDraftGrid([]);

        this.setStatus('New draft class created - use Player Database to add prospects');
        console.log('[app.js] New empty draft class created');
    }

    async createDraftGrid(prospects) {

        const container = document.getElementById('draft-grid-container');

        // Clear existing grid
        if (this.draftGrid) {
            this.draftGrid.destroy();
        }

        // Set container dimensions - Handsontable will handle its own scrolling
        // Let CSS flex handle the container sizing, just set overflow and position
        container.style.width = '100%';
        container.style.overflow = 'hidden';  // Let Handsontable manage scrolling internally
        container.style.position = 'relative'; // Required for Handsontable positioning

        // Calculate actual available height dynamically
        // This accounts for header, toolbar, and filter controls properly
        const toolPanel = document.getElementById('draft-tool');
        const toolHeader = toolPanel.querySelector('.tool-header');
        const filterControls = toolPanel.querySelector('.filter-controls');
        const headerHeight = toolHeader ? toolHeader.offsetHeight : 0;
        const filterHeight = filterControls ? filterControls.offsetHeight : 0;
        const appHeader = document.querySelector('.app-header');
        const appHeaderHeight = appHeader ? appHeader.offsetHeight : 0;
        const totalOffset = appHeaderHeight + headerHeight + filterHeight + 20; // 20px padding
        const gridHeight = `calc(100vh - ${totalOffset}px)`;

        // Store original prospect data with numeric IDs
        this.originalProspectData = prospects.map(p => ({...p}));

        // Pre-load portraits for all prospects in batch
        let portraitsToLoad = 0;
        let portraitsLoaded = 0;

        prospects.forEach(prospect => {
            if (prospect.PID !== null && prospect.PID !== undefined) {
                const cacheKey = `pid_${prospect.PID}`;
                if (!this.portraitCache.has(cacheKey)) {
                    // Mark as loading and fetch
                    this.portraitCache.set(cacheKey, 'loading');
                    portraitsToLoad++;

                    window.electronAPI.portrait.getByPID(prospect.PID).then(imageData => {
                        this.portraitCache.set(cacheKey, imageData);
                        portraitsLoaded++;

                        // When all portraits loaded, re-render table once
                        if (portraitsLoaded === portraitsToLoad && this.draftGrid) {
                            this.draftGrid.render();
                        }
                    }).catch(() => {
                        this.portraitCache.set(cacheKey, null);
                        portraitsLoaded++;

                        // When all portraits loaded (even failures), re-render
                        if (portraitsLoaded === portraitsToLoad && this.draftGrid) {
                            this.draftGrid.render();
                        }
                    });
                }
            }
        });

        // Transform prospect data: convert numeric IDs to friendly names for dropdown fields
        // Pre-convert birthday and archetype async to avoid rendering issues
        const transformedProspects = await Promise.all(prospects.map(async prospect => {
            // Use PEPS from backend (already mapped from assetName or genericHeadName)
            // Backend correctly prioritizes assetName (player-specific) over genericHeadName
            let peps = prospect.PEPS || null;

            // Extract Body Type from visuals JSON or direct property (for generated players)
            let bodyType = null;
            if (prospect.visuals && prospect.visuals.bodyType !== undefined) {
                bodyType = prospect.visuals.bodyType;
            } else if (prospect.bodyType !== undefined) {
                bodyType = prospect.bodyType;
            }

            // Look up player name from PID for the "Player Pic" column
            let playerPic = 'Generic Face';

            // Handle PID=0 case (show blank)
            if (prospect.PID === 0) {
                playerPic = '';
            } else if (prospect.PID && window.lookupData && window.lookupData.pidsCapitalized) {
                const capitalizedName = window.lookupData.pidsCapitalized.get(prospect.PID);
                if (capitalizedName) {
                    playerPic = capitalizedName;
                }
            }

            // Fallback to PEPS if lookup failed (for generic faces)
            if (playerPic === 'Generic Face' && prospect.PEPS) {
                playerPic = prospect.PEPS;
            }

            // Pre-convert birthday to display format
            let birthdayDisplay = '';
            if (prospect.birthDate && prospect.birthDate > 0) {
                try {
                    birthdayDisplay = await window.electronAPI.rating.birthdayToDisplay(prospect.birthDate);
                } catch (error) {
                    console.error('[Draft Class] Error converting birthday:', error);
                    birthdayDisplay = '';
                }
            }

            // Pre-convert archetype ID to name based on position
            let archetypeDisplay = '';
            const position = getLookupValue('positions', prospect.position) || prospect.position;

            // Check if archetype is already a string (from future draft generator)
            if (typeof prospect.archetype === 'string' && prospect.archetype !== '') {
                archetypeDisplay = prospect.archetype;
            }
            // Otherwise convert numeric ID to name
            else if (typeof prospect.archetype === 'number' && prospect.archetype >= 0) {
                try {
                    archetypeDisplay = await window.electronAPI.rating.getArchetypeName(prospect.archetype, position);
                } catch (error) {
                    console.error('[Draft Class] Error converting archetype:', error);
                    archetypeDisplay = `Archetype #${prospect.archetype}`;
                }
            }

            // Debug: Log first 5 prospects to check data
            if (prospects.indexOf(prospect) < 5) {
                const prospectNum = prospects.indexOf(prospect) + 1;
                console.log(`[Draft Class] Prospect #${prospectNum}: ${prospect.firstName} ${prospect.lastName}`);
                console.log(`  Position: ${position} (raw: ${prospect.position})`);
                console.log(`  Archetype: ${prospect.archetype} -> "${archetypeDisplay}" (type: ${typeof archetypeDisplay}, empty: ${archetypeDisplay === ''})`);
                console.log(`  BirthDate: ${prospect.birthDate} -> "${birthdayDisplay}"`);
                console.log(`  Age: ${prospect.age}`);
            }

            // Create clean object with ONLY the properties needed for Handsontable
            // Do NOT use spread operator - it can copy extra/corrupted properties from M25→M26 conversion
            const rowData = {
                // Portrait (for display only)
                portrait: '',  // Placeholder, rendered from PID

                // Personal Info
                firstName: prospect.firstName,
                lastName: prospect.lastName,
                homeTown: prospect.homeTown || '',
                homeState: getLookupValue('states', prospect.homeState) || prospect.homeState,
                college: getLookupValue('colleges', prospect.college) || prospect.college,
                birthDate: birthdayDisplay,  // Pre-converted display format
                birthDateRaw: prospect.birthDate,  // Store raw value for saving
                age: prospect.age,
                heightInches: prospect.heightInches,
                weight: prospect.weight,
                position: position,  // Use the already-looked-up position
                archetype: archetypeDisplay || 'EMPTY',  // Store display name for rendering
                jerseyNum: prospect.jerseyNum,

                // Draft Info
                draftable: prospect.draftable,
                draftPick: prospect.draftPick,
                draftRound: prospect.draftRound,
                pick: prospect.pick,
                devTrait: ['Normal', 'Star', 'Superstar', 'X-Factor'][prospect.devTrait] || prospect.devTrait,

                // IDs and Assets
                PID: prospect.PID,
                PEPS: peps,
                commentaryId: prospect.commentaryId || prospect.commID || 0, // Presentation ID for in-game commentary
                // Body type is now a string from backend ("Thin", "Muscular", "Heavy", or null/undefined for "Standard")
                bodyType: bodyType === null || bodyType === undefined ? 'Standard'
                    : typeof bodyType === 'number' ? ['Standard', 'Thin', 'Muscular', 'Heavy'][bodyType] || 'Standard'
                    : bodyType,
                playerPic: playerPic,

                // All stat fields (explicit list to avoid corruption)
                speed: prospect.speed,
                acceleration: prospect.acceleration,
                agility: prospect.agility,
                strength: prospect.strength,
                awareness: prospect.awareness,
                jumping: prospect.jumping,
                stamina: prospect.stamina,
                changeOfDirection: prospect.changeOfDirection,
                toughness: prospect.toughness,
                carrying: prospect.carrying,
                ballCarrierVision: prospect.ballCarrierVision,
                breakTackle: prospect.breakTackle,
                trucking: prospect.trucking,
                stiffArm: prospect.stiffArm,
                spinMove: prospect.spinMove,
                jukeMove: prospect.jukeMove,
                catching: prospect.catching,
                catchInTraffic: prospect.catchInTraffic,
                spectacularCatch: prospect.spectacularCatch,
                shortRouteRunning: prospect.shortRouteRunning,
                mediumRouteRunning: prospect.mediumRouteRunning,
                deepRouteRunning: prospect.deepRouteRunning,
                release: prospect.release,
                throwPower: prospect.throwPower,
                throwAccuracyShort: prospect.throwAccuracyShort,
                throwAccuracyMid: prospect.throwAccuracyMid,
                throwAccuracyDeep: prospect.throwAccuracyDeep,
                throwOnTheRun: prospect.throwOnTheRun,
                throwUnderPressure: prospect.throwUnderPressure,
                playAction: prospect.playAction,
                breakSack: prospect.breakSack,
                passBlock: prospect.passBlock,
                passBlockPower: prospect.passBlockPower,
                passBlockFinesse: prospect.passBlockFinesse,
                runBlock: prospect.runBlock,
                runBlockPower: prospect.runBlockPower,
                runBlockFinesse: prospect.runBlockFinesse,
                leadBlock: prospect.leadBlock,
                impactBlocking: prospect.impactBlocking,
                injury: prospect.injury,
                tackle: prospect.tackle,
                hitPower: prospect.hitPower,
                powerMoves: prospect.powerMoves,
                finesseMoves: prospect.finesseMoves,
                blockShedding: prospect.blockShedding,
                pursuit: prospect.pursuit,
                playRecognition: prospect.playRecognition,
                manCoverage: prospect.manCoverage,
                zoneCoverage: prospect.zoneCoverage,
                pressCoverage: prospect.pressCoverage,
                kickPower: prospect.kickPower,
                kickAccuracy: prospect.kickAccuracy,
                kickReturn: prospect.kickReturn,
                longSnap: prospect.longSnap,
                overall: prospect.overall,

                // Metadata
                visuals: prospect.visuals,
                draftPosition: prospect.draftPosition !== undefined ? prospect.draftPosition : prospects.indexOf(prospect),
                index: prospects.indexOf(prospect)
            };

            // Use existing round if available (preserves round=0 for UDFAs)
            // Only calculate round if not provided
            if (prospect.round !== undefined && prospect.round !== null) {
                rowData.round = prospect.round;
            } else {
                // Calculate round based on draft position (0-indexed, so add 1 to get pick number)
                // 32 picks per round, rounds 1-7 (picks 1-224), rest are UFA (round 8)
                const pickNum = rowData.draftPosition + 1; // Convert 0-indexed position to 1-indexed pick
                if (pickNum <= 224) {
                    rowData.round = Math.floor((pickNum - 1) / 32) + 1;
                } else {
                    rowData.round = 8; // UFA
                }
                // Store calculated round back to original prospect
                prospect.round = rowData.round;
            }

            return rowData;
        }));


        // Get lookup options for dropdowns
        const positionOptions = getLookupOptions('positions').map(opt => opt.label);
        const collegeOptions = getLookupOptions('colleges').map(opt => opt.label);
        const stateOptions = getLookupOptions('states').map(opt => opt.label);
        const devTraitOptions = ['Normal', 'Star', 'Superstar', 'X-Factor'];
        const bodyTypeOptions = ['Standard', 'Thin', 'Muscular', 'Heavy'];  // CORRECT Madden M26 format - Standard is default (no bodyType field)
        // Use capitalized names for player pic autocomplete
        const playerPicOptions = Array.from(window.lookupData.pidsCapitalized.values()).concat(['Generic Face']);

        // Archetype cache - position-specific archetypes loaded on demand
        const archetypeCache = new Map();

        // Custom renderer for lookup columns - ensures friendly names are always displayed
        const dropdownRenderer = function(instance, td, row, col, prop, value, cellProperties) {
            // Convert numeric values to friendly names if needed
            let displayValue = value;

            if (typeof value === 'number') {
                if (prop === 'position') {
                    displayValue = getLookupValue('positions', value) || value;
                } else if (prop === 'college') {
                    displayValue = getLookupValue('colleges', value) || value;
                } else if (prop === 'homeState') {
                    displayValue = getLookupValue('states', value) || value;
                } else if (prop === 'devTrait') {
                    displayValue = ['Normal', 'Star', 'Superstar', 'X-Factor'][value] || value;
                }
            }

            // Update the actual data to friendly name so sorting works correctly
            if (displayValue !== value) {
                const sourceData = instance.getSourceDataAtRow(row);
                if (sourceData) {
                    sourceData[prop] = displayValue;
                }
            }

            // Use dropdown renderer with the friendly name
            Handsontable.renderers.DropdownRenderer.apply(this, [instance, td, row, col, prop, displayValue, cellProperties]);
        };

        // Custom renderer for draft position - display actual draft pick number (1-402+)
        // Uses the draftPosition from the source data (0-indexed), displays as 1-indexed
        const draftPositionRenderer = function(instance, td, row, col, prop, value, cellProperties) {
            // Get the actual draftPosition from the source data
            const physicalRow = instance.toPhysicalRow(row);
            const sourceData = instance.getSourceDataAtRow(physicalRow);
            const draftPos = (sourceData && sourceData.draftPosition !== undefined) ? sourceData.draftPosition : row;

            // Display as 1-indexed (draftPosition is 0-indexed in data)
            const displayValue = draftPos + 1;

            Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, displayValue, cellProperties]);
            td.style.textAlign = 'center';
            td.style.fontWeight = 'bold';
            td.style.backgroundColor = '#f0f0f0'; // Light gray background to indicate calculated field
        };

        // Portrait renderer for draft class
        const draftPortraitRenderer = (instance, td, row, col, prop, value, cellProperties) => {
            // Clear cell and set up styling
            td.innerHTML = '';
            td.style.padding = '2px';
            td.style.textAlign = 'center';
            td.style.verticalAlign = 'middle';
            td.style.backgroundColor = '#1a1a1a';

            // Get the physical (source) row index to account for sorting/filtering
            const physicalRow = instance.toPhysicalRow(row);

            // Get PID and PAM from the row data using physical row
            const rowData = instance.getSourceDataAtRow(physicalRow);
            const pid = rowData ? rowData.PID : null;
            const pam = rowData ? rowData.PEPS : null;

            if (!pid || pid === 0) {
                return td;
            }

            // Check if this is a generic face based on PAM
            const isGenericPam = pam && typeof pam === 'string' &&
                (pam.startsWith('gen_') || pam.startsWith('plpo_generic_') || pam.includes('generic'));

            // Use PAM-based cache key for generic faces, PID-based for real faces
            const cacheKey = isGenericPam ? `pam_${pam}` : `pid_${pid}`;

            // ONLY use cache - never trigger new loads during render
            if (this.portraitCache.has(cacheKey)) {
                const imageData = this.portraitCache.get(cacheKey);
                if (imageData && imageData !== 'loading') {
                    const img = document.createElement('img');
                    img.src = imageData;
                    img.style.width = '64px';
                    img.style.height = '64px';
                    img.style.objectFit = 'cover';
                    img.style.cursor = 'context-menu';

                    // Add right-click context menu for generic face picker
                    img.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        // Get the actual prospect from the data array, not rowData which might be a copy
                        const prospect = this.draftProspects && this.draftProspects[physicalRow];
                        if (prospect) {
                            this.openGenericFacePicker(prospect, physicalRow);
                        }
                    });

                    td.appendChild(img);
                } else if (imageData === 'loading') {
                    // Still loading
                    td.textContent = '...';
                    td.style.fontSize = '12px';
                    td.style.color = '#666';
                }
            }

            return td;
        };

        // Birthday renderer - displays pre-converted birthday (already in MM/DD/YYYY format)
        const birthdayRenderer = function(instance, td, row, col, prop, value, cellProperties) {
            td.innerHTML = '';
            td.style.textAlign = 'center';
            td.textContent = value || '';  // Value is already in display format
            return td;
        };

        // Age renderer - displays age from data (read-only)
        const ageRenderer = function(instance, td, row, col, prop, value, cellProperties) {
            td.innerHTML = '';
            td.style.textAlign = 'center';
            td.style.backgroundColor = '#2a2a2a'; // Darker to indicate read-only
            td.textContent = value || '';  // Value is already calculated
            return td;
        };

        // Archetype renderer - displays archetype name (value is already converted)
        const archetypeRenderer = function(instance, td, row, col, prop, value, cellProperties) {
            td.innerHTML = '';
            td.style.textAlign = 'left';

            // Debug: Log value type and content for first 5 rows
            if (row < 5) {
                console.log(`[Archetype Renderer] Row ${row}: value = ${JSON.stringify(value)}, type = ${typeof value}`);
            }

            // If value is a number, convert it to archetype name using position
            if (typeof value === 'number') {
                if (row < 5) {
                    console.warn(`[Archetype Renderer] Row ${row}: Received number ${value} instead of string! Attempting conversion...`);
                }

                // Get the physical row to access source data
                const physicalRow = instance.toPhysicalRow(row);
                const sourceData = instance.getSourceDataAtRow(physicalRow);

                // Get position from the CURRENT row data using getDataAtCell (works after sorting)
                // Find the position column index first
                const positionColIndex = instance.propToCol('position');
                let positionValue = instance.getDataAtCell(row, positionColIndex);

                // After sorting, position might be a numeric code instead of a name
                // Use POSITION_MAPPINGS to convert code to name if needed
                if (typeof positionValue === 'number' || !isNaN(Number(positionValue))) {
                    positionValue = POSITION_MAPPINGS[positionValue] || positionValue;
                }

                if (row < 5) {
                    console.log(`[Archetype Renderer] Row ${row}: physicalRow=${physicalRow}, positionCol=${positionColIndex}, position="${positionValue}" (type: ${typeof positionValue})`);
                }

                if (positionValue && positionValue !== '0') {
                    const position = String(positionValue);

                    // Show "Loading..." while converting
                    td.textContent = 'Loading...';
                    td.style.color = '#999';

                    // Try to convert archetype ID to name
                    window.electronAPI.rating.getArchetypeName(value, position).then(name => {
                        if (row < 5) {
                            console.log(`[Archetype Renderer] Row ${row}: IPC returned "${name}" for position "${position}"`);
                        }
                        if (name && name !== 'Unknown' && name !== '') {
                            // Update the source data so future renders use the string
                            if (sourceData) {
                                sourceData.archetype = name;
                            }
                            td.textContent = name;
                            td.style.color = '';
                        } else {
                            if (row < 5) {
                                console.warn(`[Archetype Renderer] Row ${row}: IPC returned invalid name, showing fallback`);
                            }
                            td.textContent = `Archetype #${value}`;
                            td.style.color = '#ff6666';
                        }
                    }).catch(err => {
                        console.error(`[Archetype Renderer] Row ${row}: Failed to convert archetype:`, err);
                        td.textContent = `Archetype #${value}`;
                        td.style.color = '#ff6666';
                    });
                } else {
                    console.error(`[Archetype Renderer] Row ${row}: Missing position value!`, { positionValue, sourceData });
                    td.textContent = `Archetype #${value}`;
                    td.style.color = '#ff6666';  // Red to indicate problem
                }
            } else {
                td.textContent = value || '';  // Value should be display format
            }

            return td;
        };

        // Map draft class field names to roster editor field names and create columns
        // Following FIELD_ORDER from field-definitions.js, excluding contract fields
        const draftColumns = [
            // Draft Position (First column - for reordering) - displays as 1-indexed but stores as 0-indexed
            // Editable so users can type a position to move the row there
            {
                data: 'draftPosition',
                title: 'Draft Pos',
                width: 90,
                type: 'numeric',
                readOnly: false,
                renderer: draftPositionRenderer,
                validator: function(value, callback) {
                    const maxPos = this.instance.countRows();
                    // Convert from 1-indexed input to 0-indexed for validation
                    const zeroIndexed = value - 1;
                    if (value >= 1 && value <= maxPos) {
                        callback(true);
                    } else {
                        callback(false);
                    }
                }
            },
            // Round column (calculated from pick number)
            {
                data: 'round',
                title: 'Round',
                width: 70,
                type: 'numeric',
                readOnly: true,
                renderer: function(instance, td, row, col, prop, value, cellProperties) {
                    td.innerHTML = '';
                    td.style.textAlign = 'center';
                    td.style.backgroundColor = '#2a2a2a';

                    // Debug: Log first 3 rows to see what value we're getting
                    if (row < 3) {
                        console.log(`[Round Renderer] Row ${row}: value = ${value} (type: ${typeof value})`);
                    }

                    if (value === 8) {
                        td.textContent = 'UFA';
                        td.style.color = '#888';
                    } else if (value) {
                        td.textContent = value;
                    } else {
                        td.textContent = '';
                        if (row < 3) {
                            console.warn(`[Round Renderer] Row ${row}: No round value!`);
                        }
                    }
                    return td;
                }
            },
            // Portrait column (Third column)
            {
                data: 'portrait',
                title: '📷',
                width: 80,
                readOnly: true,
                renderer: draftPortraitRenderer.bind(this),
                columnSorting: false  // Disable sorting on portrait column
            },
            // Personal Info (Next 3 columns frozen)
            { data: 'lastName', title: 'Last Name', width: 100, type: 'text', editor: 'text' },
            { data: 'firstName', title: 'First Name', width: 100, type: 'text', editor: 'text' },
            { data: 'position', title: 'Pos', width: 90, type: 'dropdown', source: positionOptions, strict: true, allowInvalid: false, renderer: dropdownRenderer },
            {
                data: 'archetype',
                title: 'Archetype',
                width: 200,
                type: 'dropdown',
                source: async function(query, process) {
                    // Get position from current row data
                    const row = this.row;
                    const instance = this.instance;
                    const positionColIndex = instance.propToCol('position');
                    let positionValue = instance.getDataAtCell(row, positionColIndex);

                    // Convert position ID to name if numeric
                    if (typeof positionValue === 'number' || !isNaN(Number(positionValue))) {
                        positionValue = POSITION_MAPPINGS[positionValue] || 'QB';
                    }

                    const posName = positionValue || 'QB';

                    // Fetch archetypes for this position
                    try {
                        const archetypes = await window.electronAPI.rating.getArchetypes(posName);
                        const options = archetypes.map(a => a.name);
                        process(options);
                    } catch (e) {
                        console.error('[Draft Archetype] Error loading archetypes:', e);
                        process(['Loading failed...']);
                    }
                },
                strict: true,
                allowInvalid: false,
                renderer: archetypeRenderer
            },
            { data: 'jerseyNum', title: 'Jersey #', width: 80, type: 'numeric' },
            { data: 'college', title: 'College', width: 150, type: 'dropdown', source: collegeOptions, strict: true, allowInvalid: false, renderer: dropdownRenderer },
            { data: 'age', title: 'Age', width: 50, type: 'numeric', renderer: ageRenderer },
            { data: 'homeState', title: 'State', width: 100, type: 'dropdown', source: stateOptions, strict: true, allowInvalid: false, renderer: dropdownRenderer },
            { data: 'PID', title: 'PID', width: 70, type: 'numeric' },
            { data: 'playerPic', title: 'Player Pic', width: 150, type: 'autocomplete', source: playerPicOptions, strict: false, allowInvalid: true },
            { data: 'PEPS', title: 'Asset ID (PEPS)', width: 200, type: 'text' },
            { data: 'commentaryId', title: 'Pres ID', width: 80, type: 'numeric' },
            { data: 'bodyType', title: 'Body Type', width: 110, type: 'dropdown', source: bodyTypeOptions, allowInvalid: true, renderer: dropdownRenderer },

            // Overall (calculated field using position-specific formulas) - FIRST STAT
            { data: 'overall', title: 'OVR', width: 70, type: 'numeric', readOnly: true, renderer: this.draftOvrRenderer.bind(this) },

            // Ratings (in roster field order)
            { data: 'acceleration', title: 'ACC', width: 70, type: 'numeric' },
            { data: 'agility', title: 'AGI', width: 70, type: 'numeric' },
            { data: 'awareness', title: 'AWR', width: 70, type: 'numeric' },
            { data: 'breakTackle', title: 'BTK', width: 70, type: 'numeric' },
            { data: 'ballCarrierVision', title: 'BCV', width: 70, type: 'numeric' },
            { data: 'blockShedding', title: 'BSH', width: 70, type: 'numeric' },
            { data: 'breakSack', title: 'BSK', width: 70, type: 'numeric' },
            { data: 'carrying', title: 'CAR', width: 70, type: 'numeric' },
            { data: 'catchInTraffic', title: 'CIT', width: 80, type: 'numeric' },
            { data: 'catching', title: 'CTH', width: 70, type: 'numeric' },
            { data: 'deepRouteRunning', title: 'DRR', width: 70, type: 'numeric' },
            { data: 'changeOfDirection', title: 'COD', width: 70, type: 'numeric' },
            { data: 'finesseMoves', title: 'FMV', width: 70, type: 'numeric' },
            { data: 'hitPower', title: 'POW', width: 70, type: 'numeric' },
            { data: 'impactBlocking', title: 'IBL', width: 70, type: 'numeric' },
            { data: 'injury', title: 'INJ', width: 70, type: 'numeric' },
            { data: 'jukeMove', title: 'JKM', width: 70, type: 'numeric' },
            { data: 'jumping', title: 'JMP', width: 70, type: 'numeric' },
            { data: 'kickAccuracy', title: 'KAC', width: 70, type: 'numeric' },
            { data: 'kickPower', title: 'KPW', width: 70, type: 'numeric' },
            { data: 'kickReturn', title: 'KR', width: 70, type: 'numeric' },
            { data: 'longSnap', title: 'LS', width: 70, type: 'numeric' },
            { data: 'leadBlock', title: 'LBK', width: 70, type: 'numeric' },
            { data: 'manCoverage', title: 'MCV', width: 70, type: 'numeric' },
            { data: 'mediumRouteRunning', title: 'MRR', width: 70, type: 'numeric' },
            { data: 'passBlock', title: 'PBK', width: 70, type: 'numeric' },
            { data: 'passBlockFinesse', title: 'PBF', width: 80, type: 'numeric' },
            { data: 'passBlockPower', title: 'PBS', width: 80, type: 'numeric' },
            { data: 'playAction', title: 'PAC', width: 70, type: 'numeric' },
            { data: 'powerMoves', title: 'PMV', width: 70, type: 'numeric' },
            { data: 'pressCoverage', title: 'PRS', width: 70, type: 'numeric' },
            { data: 'pursuit', title: 'PUR', width: 70, type: 'numeric' },
            { data: 'playRecognition', title: 'PRC', width: 70, type: 'numeric' },
            { data: 'release', title: 'RLS', width: 70, type: 'numeric' },
            { data: 'runBlock', title: 'RBK', width: 70, type: 'numeric' },
            { data: 'runBlockFinesse', title: 'RBF', width: 80, type: 'numeric' },
            { data: 'runBlockPower', title: 'RBS', width: 80, type: 'numeric' },
            { data: 'shortRouteRunning', title: 'SRR', width: 70, type: 'numeric' },
            { data: 'spectacularCatch', title: 'SPC', width: 70, type: 'numeric' },
            { data: 'speed', title: 'SPD', width: 70, type: 'numeric' },
            { data: 'spinMove', title: 'SPM', width: 70, type: 'numeric' },
            { data: 'stamina', title: 'STA', width: 70, type: 'numeric' },
            { data: 'stiffArm', title: 'SFA', width: 70, type: 'numeric' },
            { data: 'strength', title: 'STR', width: 70, type: 'numeric' },
            { data: 'tackle', title: 'TAK', width: 70, type: 'numeric' },
            { data: 'throwAccuracyDeep', title: 'TAD', width: 70, type: 'numeric' },
            { data: 'throwAccuracyMid', title: 'TAM', width: 70, type: 'numeric' },
            { data: 'throwAccuracyShort', title: 'TAS', width: 70, type: 'numeric' },
            { data: 'throwOnTheRun', title: 'TOR', width: 70, type: 'numeric' },
            { data: 'throwPower', title: 'THP', width: 70, type: 'numeric' },
            { data: 'throwUnderPressure', title: 'TUP', width: 70, type: 'numeric' },
            { data: 'toughness', title: 'TGH', width: 70, type: 'numeric' },
            { data: 'trucking', title: 'TRK', width: 70, type: 'numeric' },
            { data: 'zoneCoverage', title: 'ZCV', width: 70, type: 'numeric' },

            // Physical
            { data: 'heightInches', title: 'Height', width: 70, type: 'numeric' },
            { data: 'weight', title: 'Weight', width: 70, type: 'numeric' },

            // Dev Trait (editable in draft class)
            { data: 'devTrait', title: 'Dev Trait', width: 110, type: 'dropdown', source: devTraitOptions, allowInvalid: false, renderer: dropdownRenderer }
        ];

        // Debug: Log counts to identify where data might be truncated
        console.log(`[Draft Grid DEBUG] Input prospects: ${prospects.length}`);
        console.log(`[Draft Grid DEBUG] Transformed prospects: ${transformedProspects.length}`);
        console.log(`[Draft Grid DEBUG] First 5 prospects:`, transformedProspects.slice(0, 5).map(p => `${p.firstName} ${p.lastName}`));
        console.log(`[Draft Grid DEBUG] Last 5 prospects:`, transformedProspects.slice(-5).map(p => `${p.firstName} ${p.lastName}`));
        console.log(`[Draft Grid DEBUG] Prospect at index 107:`, transformedProspects[107] ? `${transformedProspects[107].firstName} ${transformedProspects[107].lastName}` : 'N/A');
        console.log(`[Draft Grid DEBUG] Prospect at index 108:`, transformedProspects[108] ? `${transformedProspects[108].firstName} ${transformedProspects[108].lastName}` : 'N/A');
        console.log(`[Draft Grid DEBUG] Prospect at index 200:`, transformedProspects[200] ? `${transformedProspects[200].firstName} ${transformedProspects[200].lastName}` : 'N/A');
        console.log(`[Draft Grid DEBUG] Grid height:`, gridHeight);

        this.draftGrid = new Handsontable(container, {
            data: transformedProspects,
            columns: draftColumns,
            colHeaders: true,
            rowHeaders: true,
            height: gridHeight,  // Use dynamically calculated height
            rowHeights: 70, // Set row height to accommodate 64px portraits
            licenseKey: 'non-commercial-and-evaluation',
            stretchH: 'none',  // Allow horizontal scrolling instead of stretching columns
            autoColumnSize: true,  // Enable auto column sizing
            manualColumnResize: true,
            manualRowResize: true,
            filters: false,  // Disable filters (they require dropdownMenu)
            dropdownMenu: false,  // Disable dropdown menu (removes filter arrows)
            contextMenu: {
                items: {
                    'delete_player': {
                        name: '🗑️ Delete Player',
                        callback: (key, selection) => {
                            const row = selection[0].start.row;
                            const data = this.draftGrid.getSourceData();
                            const player = data[row];
                            const playerName = `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'this player';

                            if (confirm(`Are you sure you want to delete ${playerName}?`)) {
                                // Remove the row
                                this.draftGrid.alter('remove_row', row, 1);

                                // Update draft positions for remaining players
                                const updatedData = this.draftGrid.getSourceData();
                                updatedData.forEach((p, idx) => {
                                    p.draftPosition = idx + 1;
                                    p.round = Math.floor(idx / 32) + 1;
                                });

                                this.draftGrid.render();
                                this.hasUnsavedChanges = true;
                                this.updateSaveButton();
                                console.log('[Draft Editor] Player deleted, remaining:', updatedData.length);
                            }
                        }
                    },
                    'separator1': '---------',
                    'copy': { name: 'Copy' },
                    'cut': { name: 'Cut' },
                    'separator2': '---------',
                    'undo': { name: 'Undo' },
                    'redo': { name: 'Redo' }
                }
            },
            selectionMode: 'multiple',
            fixedColumnsStart: 6,  // Freeze first 6 columns (Draft Pos, Round, Portrait, Last Name, First Name, Position)
            preventOverflow: false,  // Changed from 'horizontal' - allow natural scrolling to prevent snap-left
            manualRowMove: true, // Enable row dragging for reordering
            renderAllRows: true, // Render all rows - virtual scrolling causes scroll issues with 402 prospects
            // viewportRowRenderingOffset: 100, // Not needed when renderAllRows is true
            columnSorting: {
                indicator: true,
                headerAction: true,
                compareFunctionFactory: function(sortOrder, columnMeta) {
                    // Custom comparator that handles both string and numeric values
                    return function(value, nextValue) {
                        // Ensure we're comparing strings for dropdown columns
                        const val1 = String(value || '');
                        const val2 = String(nextValue || '');

                        if (sortOrder === 'asc') {
                            return val1.localeCompare(val2);
                        } else {
                            return val2.localeCompare(val1);
                        }
                    };
                }
            },
            beforeColumnSort: (currentSortConfig, destinationSortConfigs) => {
                console.log('===== BEFORE SORT =====');
                console.log('Sort config:', JSON.stringify(destinationSortConfigs));
                if (this.draftGrid && !this.draftGrid.isDestroyed) {
                    const data = this.draftGrid.getSourceData();
                    console.log('First 5 rows BEFORE sort:');
                    for (let i = 0; i < Math.min(5, data.length); i++) {
                        console.log(`Row ${i}: archetype = "${data[i].archetype}" (type: ${typeof data[i].archetype}), archetypeRaw = ${data[i].archetypeRaw}`);
                    }
                }
            },
            afterColumnSort: (currentSortConfig, destinationSortConfigs) => {
                console.log('===== AFTER SORT =====');
                if (this.draftGrid && !this.draftGrid.isDestroyed) {
                    try {
                        const data = this.draftGrid.getSourceData();
                        console.log('First 5 rows AFTER sort:');
                        for (let i = 0; i < Math.min(5, data.length); i++) {
                            console.log(`Row ${i}: archetype = "${data[i].archetype}" (type: ${typeof data[i].archetype}), archetypeRaw = ${data[i].archetypeRaw}`);
                        }

                        window.electronAPI.debug.sessionLog('[SORT] AFTER sort - First 5 rows: ' + JSON.stringify(data.slice(0, 5).map(r => ({
                            firstName: r.firstName,
                            lastName: r.lastName,
                            devTrait: r.devTrait,
                            position: r.position,
                            archetype: r.archetype,
                            archetypeType: typeof r.archetype
                        })), null, 2));

                        // Don't force re-render - Handsontable already re-renders after sort
                        // Forcing render with 471+ players causes freezing due to portrait re-rendering
                        console.log('[Draft] afterColumnSort: Sort complete (skipping manual render)');
                        // this.draftGrid.render(); // DISABLED - causes freeze with large draft classes
                    } catch (e) {
                        console.log('[Draft] afterColumnSort: Could not access data (table may be destroyed)');
                    }
                }
            },
            afterRowMove: (movedRows, finalIndex, dropIndex, movePossible, orderChanged) => {
                // Update draft positions and rounds after reordering
                if (orderChanged && this.draftGrid && !this.draftGrid.isDestroyed) {
                    try {
                        console.log('[Draft Editor] Rows reordered - updating draft positions and rounds');

                        // Get all source data
                        const allData = this.draftGrid.getSourceData();

                        // Update draftPosition and round for ALL rows based on their new position
                        allData.forEach((row, index) => {
                            // Update draftPosition (0-indexed)
                            row.draftPosition = index;

                            // Recalculate round based on new pick number
                            const pickNum = index + 1; // Convert to 1-indexed
                            if (pickNum <= 224) {
                                row.round = Math.floor((pickNum - 1) / 32) + 1;
                            } else {
                                row.round = 8; // UFA
                            }

                            // Also update the original prospect object if it exists
                            if (this.currentDraftClass && this.currentDraftClass.prospects) {
                                const originalProspect = this.currentDraftClass.prospects.find(
                                    p => p.firstName === row.firstName && p.lastName === row.lastName
                                );
                                if (originalProspect) {
                                    originalProspect.draftPosition = index;
                                    originalProspect.round = row.round;
                                }
                            }
                        });

                        // Re-render to show updated positions and rounds
                        this.draftGrid.render();
                        console.log('[Draft Editor] Draft positions and rounds updated successfully');
                    } catch (e) {
                        console.error('[Draft] afterRowMove: Error updating positions:', e);
                    }
                }
            },
            // Highlight entire row on selection
            afterSelection: (row, column, row2, column2, preventScrolling, selectionLayerLevel) => {
                if (!this.draftGrid) return;

                // Remove previous row highlights from all clones
                const container = this.draftGrid.rootElement;
                if (container) {
                    const previousHighlights = container.querySelectorAll('tr.row-selected');
                    previousHighlights.forEach(tr => tr.classList.remove('row-selected'));

                    // Add highlight to selected row(s) in ALL clones (frozen + scrollable)
                    for (let r = Math.min(row, row2); r <= Math.max(row, row2); r++) {
                        const clones = ['.ht_master', '.ht_clone_left', '.ht_clone_top', '.ht_clone_top_left_corner'];
                        clones.forEach(cloneClass => {
                            const clone = container.querySelector(cloneClass);
                            if (clone) {
                                const rowElement = clone.querySelector(`tbody tr:nth-child(${r + 1})`);
                                if (rowElement) {
                                    rowElement.classList.add('row-selected');
                                }
                            }
                        });
                    }
                }
            },
            beforeChange: (changes, source) => {
                // When a dropdown value is changed, keep it as the friendly name
                // This prevents it from being converted back to a number
                if (!changes) return;

                changes.forEach(([row, prop, oldValue, newValue]) => {
                    // Debug: Log archetype changes
                    if (prop === 'archetype') {
                        console.log(`[beforeChange] Row ${row}, archetype: "${oldValue}" (${typeof oldValue}) -> "${newValue}" (${typeof newValue}), source: ${source}`);
                    }

                    // Position, college, homeState, devTrait should stay as friendly names
                    // They will be converted back to IDs during save

                    // Handle draft position changes - move the row to the new position
                    if (prop === 'draftPosition' && source !== 'loadData') {
                        if (this.draftGrid && !this.draftGrid.isDestroyed) {
                            try {
                                // Convert from 1-indexed user input to 0-indexed row position
                                const targetRow = newValue - 1;
                                const currentRow = row; // Use visual row index

                                if (targetRow !== currentRow && targetRow >= 0 && targetRow < this.draftGrid.countRows()) {
                                    // Use Handsontable's plugin to move the row
                                    const plugin = this.draftGrid.getPlugin('manualRowMove');
                                    plugin.moveRow(currentRow, targetRow);

                                    // Prevent the default value change since we're moving the row (position is calculated, not stored)
                                    return false;
                                }
                            } catch (e) {
                                console.log('[Draft] beforeChange: Could not move row (table may be destroyed)');
                            }
                        }
                    }
                });
            },
            afterGetColHeader: (col, TH) => {
                // Add tooltips with full stat names
                const statTooltips = {
                    'ACC': 'Acceleration', 'AGI': 'Agility', 'AWR': 'Awareness', 'BTK': 'Break Tackle',
                    'BCV': 'Ball Carrier Vision', 'BSH': 'Block Shedding', 'BSK': 'Break Sack',
                    'CAR': 'Carrying', 'CIT': 'Catch In Traffic', 'CTH': 'Catching',
                    'DRR': 'Deep Route Running', 'COD': 'Change Of Direction', 'FMV': 'Finesse Moves',
                    'POW': 'Hit Power', 'IBL': 'Impact Blocking', 'INJ': 'Injury',
                    'JKM': 'Juke Move', 'JMP': 'Jumping', 'KAC': 'Kick Accuracy', 'KPW': 'Kick Power',
                    'KR': 'Kick Return', 'LBK': 'Lead Block', 'MCV': 'Man Coverage',
                    'MRR': 'Medium Route Running', 'PBK': 'Pass Block', 'PBF': 'Pass Block Finesse',
                    'PBS': 'Pass Block Power', 'PAC': 'Play Action', 'PMV': 'Power Moves',
                    'PRS': 'Press Coverage', 'PUR': 'Pursuit', 'PRC': 'Play Recognition',
                    'RLS': 'Release', 'RBK': 'Run Block', 'RBF': 'Run Block Finesse',
                    'RBS': 'Run Block Power', 'SRR': 'Short Route Running', 'SPC': 'Spectacular Catch',
                    'SPD': 'Speed', 'SPM': 'Spin Move', 'STA': 'Stamina', 'SFA': 'Stiff Arm',
                    'STR': 'Strength', 'TAK': 'Tackle', 'TAD': 'Throw Accuracy Deep',
                    'TAM': 'Throw Accuracy Mid', 'TAS': 'Throw Accuracy Short', 'TOR': 'Throw On Run',
                    'THP': 'Throw Power', 'TUP': 'Throw Under Pressure', 'TGH': 'Toughness',
                    'TRK': 'Trucking', 'ZCV': 'Zone Coverage', 'OVR': 'Overall'
                };

                const headerText = TH.textContent.trim();
                if (statTooltips[headerText]) {
                    TH.title = statTooltips[headerText];
                }
            },
            afterChange: (changes, source) => {
                if (!changes || source === 'loadData' || source === 'pid_sync' || source === 'pic_sync') return;

                // Two-way sync between PID and Player Pic
                changes.forEach(([row, prop, oldValue, newValue]) => {
                    if (prop === 'PID' && newValue !== oldValue) {
                        // PID changed - update Player Pic AND fetch portrait
                        console.log(`PID changed to ${newValue}, looking up player name...`);
                        const playerPic = window.lookupData.pidsCapitalized.get(parseInt(newValue)) || 'Generic Face';
                        console.log(`Setting Player Pic to: ${playerPic}`);
                        this.draftGrid.setDataAtRowProp(row, 'playerPic', playerPic, 'pid_sync');

                        // Fetch portrait for new PID
                        const pid = parseInt(newValue);
                        const cacheKey = `pid_${pid}`;
                        if (!this.portraitCache.has(cacheKey)) {
                            console.log(`[Draft] Fetching portrait for new PID ${pid}`);
                            this.portraitCache.set(cacheKey, 'loading');

                            window.electronAPI.portrait.getByPID(pid).then(imageData => {
                                console.log(`[Draft] Portrait fetched successfully for PID ${pid}, data length:`, imageData ? imageData.length : 'null');
                                this.portraitCache.set(cacheKey, imageData);
                                // Re-render the specific cell in the portrait column (column 1)
                                if (this.draftGrid && !this.draftGrid.isDestroyed) {
                                    console.log(`[Draft] Rendering portrait cell at row ${row}, col 1`);
                                    // Force render of the entire table to update portrait
                                    setTimeout(() => {
                                        if (this.draftGrid && !this.draftGrid.isDestroyed) {
                                            this.draftGrid.render();
                                        }
                                    }, 100);
                                }
                            }).catch((error) => {
                                console.error(`[Draft] Failed to fetch portrait for PID ${pid}:`, error);
                                this.portraitCache.set(cacheKey, null);
                                if (this.draftGrid && !this.draftGrid.isDestroyed) {
                                    this.draftGrid.render();
                                }
                            });
                        } else {
                            // Portrait already in cache, just re-render to update
                            console.log(`[Draft] Portrait already cached for PID ${pid}`);
                            if (this.draftGrid && !this.draftGrid.isDestroyed) {
                                setTimeout(() => {
                                    if (this.draftGrid && !this.draftGrid.isDestroyed) {
                                        this.draftGrid.render();
                                    }
                                }, 100);
                            }
                        }
                    } else if (prop === 'playerPic' && newValue !== oldValue) {
                        // Player Pic changed - update PID
                        if (newValue === 'Generic Face' || !newValue) {
                            return;
                        }
                        const pid = window.lookupData.pidsByName.get(newValue);
                        if (pid) {
                            this.draftGrid.setDataAtRowProp(row, 'PID', pid, 'pic_sync');
                        } else {
                            // Try case-insensitive search
                            for (const [name, id] of window.lookupData.pidsByName.entries()) {
                                if (name.toLowerCase() === newValue.toLowerCase()) {
                                    this.draftGrid.setDataAtRowProp(row, 'PID', id, 'pic_sync');
                                    break;
                                }
                            }
                        }
                    }
                });
            }
        });

        // Setup floating scrollbar for draft class grid
        this.setupFloatingScrollbar(container);

        // Setup scroll wheel editing for draft class
        this.setupScrollWheelEditing(this.draftGrid, null);

        // Pre-load portraits for draft class prospects
        const draftPortraitsToLoad = [];

        transformedProspects.forEach((prospect) => {
            if (!prospect.PID || prospect.PID === 0) {
                return;
            }

            const pid = parseInt(prospect.PID);
            const pam = prospect.PEPS;

            // Check if this is a generic face based on PAM
            const isGenericPam = pam && typeof pam === 'string' &&
                (pam.startsWith('gen_') || pam.startsWith('plpo_generic_') || pam.includes('generic'));

            const cacheKey = isGenericPam ? `pam_${pam}` : `pid_${pid}`;

            if (!this.portraitCache.has(cacheKey)) {
                draftPortraitsToLoad.push({ pid, pam, isGenericPam, cacheKey });
            }
        });

        // Load portraits in parallel - by PAM for generic faces, by PID for real faces
        const loadPromises = draftPortraitsToLoad.map(({ pid, pam, isGenericPam, cacheKey }) => {
            this.portraitCache.set(cacheKey, 'loading');

            if (isGenericPam) {
                return window.electronAPI.portrait.getImageDataByPam(pam)
                    .then((imageData) => {
                        this.portraitCache.set(cacheKey, imageData || null);
                    })
                    .catch(() => {
                        this.portraitCache.set(cacheKey, null);
                    });
            } else {
                return window.electronAPI.portrait.getByPID(pid)
                    .then((imageData) => {
                        this.portraitCache.set(cacheKey, imageData || null);
                    })
                    .catch(() => {
                        this.portraitCache.set(cacheKey, null);
                    });
            }
        });

        // Wait for all portraits to load, then render once
        Promise.all(loadPromises).then(() => {
            if (this.draftGrid && !this.draftGrid.isDestroyed) {
                this.draftGrid.render();
            }
        });
    }

    /**
     * Setup floating horizontal scrollbar that stays at the bottom of the viewport
     * @param {HTMLElement} gridContainer - The container where Handsontable is rendered
     */
    setupFloatingScrollbar(gridContainer) {
        // Create floating scrollbar elements
        const floatingScrollbarContainer = document.createElement('div');
        floatingScrollbarContainer.className = 'floating-scrollbar-container';

        // Spacer to match frozen columns width
        const floatingScrollbarSpacer = document.createElement('div');
        floatingScrollbarSpacer.className = 'floating-scrollbar-spacer';

        // Scrollable area
        const floatingScrollbarScrollArea = document.createElement('div');
        floatingScrollbarScrollArea.className = 'floating-scrollbar-scroll-area';

        const floatingScrollbarContent = document.createElement('div');
        floatingScrollbarContent.className = 'floating-scrollbar-content';

        floatingScrollbarScrollArea.appendChild(floatingScrollbarContent);
        floatingScrollbarContainer.appendChild(floatingScrollbarSpacer);
        floatingScrollbarContainer.appendChild(floatingScrollbarScrollArea);

        // Insert into the grid container
        gridContainer.appendChild(floatingScrollbarContainer);

        // Find the Handsontable holder (the actual scrollable element)
        const htHolder = gridContainer.querySelector('.wtHolder');

        if (!htHolder) {
            console.warn('[Floating Scrollbar] Could not find Handsontable holder');
            return;
        }

        // Function to sync scrollbar width with grid total width
        const updateScrollbarWidth = () => {
            // Get frozen columns width
            const frozenClone = gridContainer.querySelector('.ht_clone_left');
            const frozenWidth = frozenClone ? frozenClone.offsetWidth : 0;

            // Set spacer width to match frozen columns
            floatingScrollbarSpacer.style.width = `${frozenWidth}px`;

            // Set scrollable content width to match grid scroll width
            const scrollWidth = htHolder.scrollWidth;
            floatingScrollbarContent.style.width = `${scrollWidth}px`;
        };

        // Sync floating scrollbar with Handsontable horizontal scroll
        htHolder.addEventListener('scroll', () => {
            floatingScrollbarScrollArea.scrollLeft = htHolder.scrollLeft;
        });

        // Sync Handsontable scroll with floating scrollbar
        floatingScrollbarScrollArea.addEventListener('scroll', () => {
            htHolder.scrollLeft = floatingScrollbarScrollArea.scrollLeft;
        });

        // Update scrollbar width when grid is rendered/resized
        updateScrollbarWidth();

        // Use ResizeObserver to detect when grid width changes
        const resizeObserver = new ResizeObserver(() => {
            updateScrollbarWidth();
        });
        resizeObserver.observe(htHolder);

        // Also observe frozen columns for width changes
        const frozenClone = gridContainer.querySelector('.ht_clone_left');
        if (frozenClone) {
            resizeObserver.observe(frozenClone);
        }

        // Also update on window resize
        window.addEventListener('resize', updateScrollbarWidth);
    }

    async saveDraftClass() {
        try {
            if (!this.currentDraftClass || !this.draftGrid) {
                this.showError('No draft class loaded');
                return;
            }

            // Get save location
            const result = await window.electronAPI.file.saveDialog('CAREERDRAFT-EDITED');

            if (!result.success || result.canceled) {
                return;
            }

            // Get updated data from grid INCLUDING user edits (has friendly names)
            const gridData = this.draftGrid.getSourceData();

            // Debug: Log first prospect to see what we're getting
            if (gridData.length > 0) {
                console.log('[Save] First prospect data from grid:');
                console.log('  firstName:', gridData[0].firstName, `(type: ${typeof gridData[0].firstName})`);
                console.log('  lastName:', gridData[0].lastName, `(type: ${typeof gridData[0].lastName})`);
                console.log('  PEPS:', gridData[0].PEPS);
                console.log('  bodyType:', gridData[0].bodyType);
                console.log('  throwPower:', gridData[0].throwPower);
                console.log('  injury:', gridData[0].injury);
                console.log('  jerseyNum:', gridData[0].jerseyNum);
                console.log('  Has visuals in gridData?:', !!gridData[0].visuals);
                if (gridData[0].visuals) {
                    console.log('  gridData visuals.genericHeadName:', gridData[0].visuals.genericHeadName);
                }
            }

            // Convert friendly names back to numeric IDs
            const updatedProspects = gridData.map((prospect, index) => {
                const originalProspect = this.originalProspectData[index];

                // Build updated prospect object
                const updated = {
                    ...prospect,
                    // CRITICAL: Set draftPick based on row index (1-indexed)
                    // The game reads prospects by block position, so block 0 = pick 1
                    // This ensures the saved order matches the grid display order
                    draftPick: index + 1,
                    // Convert position name to ID
                    position: getLookupOptions('positions').find(opt => opt.label === prospect.position)?.value ?? originalProspect.position,
                    // Convert college name to ID
                    college: getLookupOptions('colleges').find(opt => opt.label === prospect.college)?.value ?? originalProspect.college,
                    // Convert state name to ID
                    homeState: getLookupOptions('states').find(opt => opt.label === prospect.homeState)?.value ?? originalProspect.homeState,
                    // Convert dev trait name to ID
                    devTrait: ['Normal', 'Star', 'Superstar', 'X-Factor'].indexOf(prospect.devTrait) !== -1
                        ? ['Normal', 'Star', 'Superstar', 'X-Factor'].indexOf(prospect.devTrait)
                        : originalProspect.devTrait,
                    // Archetype: keep as numeric ID from original data (archetype field is display string only)
                    archetype: originalProspect.archetype,
                    // Keep body type as string (M26Writer expects strings: "Thin", "Muscular", "Heavy", or null for Standard)
                    // "Standard" maps to null (don't write bodyType field, uses Standard_BodyType in loadouts)
                    bodyType: prospect.bodyType === 'Standard' ? null
                        : ['Thin', 'Muscular', 'Heavy'].includes(prospect.bodyType) ? prospect.bodyType
                        : originalProspect.bodyType,
                    // Explicitly preserve PEPS from grid
                    PEPS: prospect.PEPS
                };

                // CRITICAL FIX: Update visuals.genericHeadName and bodyType to match edited values
                // The M26Writer reads from visuals JSON, not from the top-level fields
                // If gridData doesn't have visuals, get it from originalProspectData
                if (!updated.visuals && originalProspect.visuals) {
                    updated.visuals = { ...originalProspect.visuals };
                }

                // ALWAYS update visuals to match PEPS/bodyType from grid (even if null)
                // This ensures M26Writer has the correct values to write
                if (updated.visuals) {
                    // Update genericHeadName from PEPS (use prospect.PEPS from grid, or fallback to original)
                    updated.visuals.genericHeadName = prospect.PEPS !== undefined ? prospect.PEPS : (originalProspect.PEPS || originalProspect.visuals?.genericHeadName);
                    console.log(`[Save] Updated visuals.genericHeadName for prospect ${index + 1}: ${updated.visuals.genericHeadName}`);

                    // Update bodyType from grid or original
                    if (prospect.bodyType !== undefined) {
                        updated.visuals.bodyType = prospect.bodyType;
                        console.log(`[Save] Updated visuals.bodyType for prospect ${index + 1}: ${prospect.bodyType}`);
                    }
                }

                return updated;
            });

            // Debug: Log first prospect being sent to backend
            if (updatedProspects.length > 0) {
                console.log('[Save] First prospect being sent to backend:');
                console.log('  firstName:', updatedProspects[0].firstName, `(type: ${typeof updatedProspects[0].firstName})`);
                console.log('  lastName:', updatedProspects[0].lastName, `(type: ${typeof updatedProspects[0].lastName})`);
                console.log('  PEPS:', updatedProspects[0].PEPS);
                console.log('  bodyType:', updatedProspects[0].bodyType);
                console.log('  archetype:', updatedProspects[0].archetype, `(type: ${typeof updatedProspects[0].archetype})`);
                console.log('  Has visuals?:', !!updatedProspects[0].visuals);
                if (updatedProspects[0].visuals) {
                    console.log('  visuals.genericHeadName:', updatedProspects[0].visuals.genericHeadName);
                }
            }

            // Grid data is already in draft order (no sorting needed)
            // The order of rows in the grid IS the draft order
            console.log('[Save] Using grid order for draft class (prospects already in correct order)');
            console.log('[Save] Total prospects to save:', updatedProspects.length);

            // Log first 5 prospects with key data including QB attributes
            for (let i = 0; i < Math.min(5, updatedProspects.length); i++) {
                const p = updatedProspects[i];
                console.log(`[Save] Prospect #${i + 1}: ${p.firstName} ${p.lastName}`);
                console.log(`  position: ${p.position}`);
                console.log(`  speed: ${p.speed}`);
                console.log(`  awareness: ${p.awareness}`);
                console.log(`  throwPower: ${p.throwPower}`);
                console.log(`  throwAccuracyDeep: ${p.throwAccuracyDeep}`);
                console.log(`  throwAccuracyMid: ${p.throwAccuracyMid}`);
                console.log(`  throwAccuracyShort: ${p.throwAccuracyShort}`);
                console.log(`  throwOnTheRun: ${p.throwOnTheRun}`);
                console.log(`  throwUnderPressure: ${p.throwUnderPressure}`);
                console.log(`  college: ${p.college}`);
                // Log all rating-related keys
                const ratingKeys = Object.keys(p).filter(k =>
                  k.includes('throw') || k.includes('speed') || k.includes('acceleration') ||
                  k.includes('awareness') || k.includes('PSPD') || k.includes('PTAD') || k.includes('PTHP')
                );
                console.log(`  Rating-related keys: ${ratingKeys.join(', ')}`);
            }

            // Save via IPC
            // Pass complete draft class data (prevents data loss when saving over same file)
            const draftClassData = {
                header: this.currentDraftClass.header,
                prospects: updatedProspects,
                _originalBuffer: this.currentDraftClass._originalBuffer,
                _version: this.currentDraftClass._version || 'M25'
            };

            console.log('[Save] draftClassData._version:', draftClassData._version);
            console.log('[Save] draftClassData.header:', JSON.stringify(draftClassData.header));
            console.log('[Save] draftClassData._originalBuffer length:', draftClassData._originalBuffer?.length || 'NULL');

            const saveResult = await window.electronAPI.draftClass.save(
                result.filePath,
                draftClassData
            );

            if (!saveResult.success) {
                throw new Error(saveResult.error || 'Failed to save draft class');
            }

            console.log('Draft class saved successfully');
            alert('Draft class saved successfully!');
        } catch (error) {
            console.error('Error saving draft class:', error);
            this.showError(`Failed to save draft class: ${error.message}`);
        }
    }

    async exportDraftJSON() {
        try {
            if (!this.currentDraftFilePath) {
                this.showError('No draft class loaded');
                return;
            }

            const result = await window.electronAPI.file.saveDialog(
                this.currentDraftFilePath.replace(/[^.]+$/, 'json')
            );

            if (!result.success || result.canceled) {
                return;
            }

            const exportResult = await window.electronAPI.draftClass.exportJSON(
                this.currentDraftFilePath,
                result.filePath
            );

            if (!exportResult.success) {
                throw new Error(exportResult.error || 'Failed to export JSON');
            }

            console.log('Draft class exported to JSON');
            alert('Draft class exported successfully!');
        } catch (error) {
            console.error('Error exporting JSON:', error);
            this.showError(`Failed to export JSON: ${error.message}`);
        }
    }

    async exportDraftCSV() {
        try {
            if (!this.draftGrid) {
                this.showError('No draft class loaded');
                return;
            }

            const data = this.draftGrid.getSourceData();
            if (!data || data.length === 0) {
                this.showError('No draft class data to export');
                return;
            }

            // Define columns to export (excluding portrait which is a rendered column)
            const exportColumns = [
                { data: 'draftPosition', title: 'Draft Position' },
                { data: 'draftRound', title: 'Round' },
                { data: 'lastName', title: 'Last Name' },
                { data: 'firstName', title: 'First Name' },
                { data: 'position', title: 'Position' },
                { data: 'archetype', title: 'Archetype' },
                { data: 'jerseyNum', title: 'Jersey #' },
                { data: 'college', title: 'College' },
                { data: 'age', title: 'Age' },
                { data: 'homeState', title: 'State' },
                { data: 'PID', title: 'PID' },
                { data: 'playerPic', title: 'Player Pic' },
                { data: 'PEPS', title: 'Asset ID (PEPS)' },
                { data: 'bodyType', title: 'Body Type' },
                { data: 'overall', title: 'OVR' },
                { data: 'acceleration', title: 'ACC' },
                { data: 'agility', title: 'AGI' },
                { data: 'awareness', title: 'AWR' },
                { data: 'breakTackle', title: 'BTK' },
                { data: 'ballCarrierVision', title: 'BCV' },
                { data: 'blockShedding', title: 'BSH' },
                { data: 'breakSack', title: 'BSK' },
                { data: 'carrying', title: 'CAR' },
                { data: 'catchInTraffic', title: 'CIT' },
                { data: 'catching', title: 'CTH' },
                { data: 'deepRouteRunning', title: 'DRR' },
                { data: 'changeOfDirection', title: 'COD' },
                { data: 'finesseMoves', title: 'FMV' },
                { data: 'hitPower', title: 'POW' },
                { data: 'impactBlocking', title: 'IBL' },
                { data: 'injury', title: 'INJ' },
                { data: 'jukeMove', title: 'JKM' },
                { data: 'jumping', title: 'JMP' },
                { data: 'kickAccuracy', title: 'KAC' },
                { data: 'kickPower', title: 'KPW' },
                { data: 'kickReturn', title: 'KR' },
                { data: 'longSnap', title: 'LS' },
                { data: 'leadBlock', title: 'LBK' },
                { data: 'manCoverage', title: 'MCV' },
                { data: 'mediumRouteRunning', title: 'MRR' },
                { data: 'passBlock', title: 'PBK' },
                { data: 'passBlockFinesse', title: 'PBF' },
                { data: 'passBlockPower', title: 'PBS' },
                { data: 'playAction', title: 'PAC' },
                { data: 'powerMoves', title: 'PMV' },
                { data: 'pressCoverage', title: 'PRS' },
                { data: 'pursuit', title: 'PUR' },
                { data: 'playRecognition', title: 'PRC' },
                { data: 'release', title: 'RLS' },
                { data: 'runBlock', title: 'RBK' },
                { data: 'runBlockFinesse', title: 'RBF' },
                { data: 'runBlockPower', title: 'RBS' },
                { data: 'shortRouteRunning', title: 'SRR' },
                { data: 'spectacularCatch', title: 'SPC' },
                { data: 'speed', title: 'SPD' },
                { data: 'spinMove', title: 'SPM' },
                { data: 'stamina', title: 'STA' },
                { data: 'stiffArm', title: 'SFA' },
                { data: 'strength', title: 'STR' },
                { data: 'tackle', title: 'TAK' },
                { data: 'throwAccuracyDeep', title: 'TAD' },
                { data: 'throwAccuracyMid', title: 'TAM' },
                { data: 'throwAccuracyShort', title: 'TAS' },
                { data: 'throwOnTheRun', title: 'TOR' },
                { data: 'throwPower', title: 'THP' },
                { data: 'throwUnderPressure', title: 'TUP' },
                { data: 'toughness', title: 'TGH' },
                { data: 'trucking', title: 'TRK' },
                { data: 'zoneCoverage', title: 'ZCV' },
                { data: 'heightInches', title: 'Height' },
                { data: 'weight', title: 'Weight' },
                { data: 'devTrait', title: 'Dev Trait' }
            ];

            // Build CSV content
            const rows = [];

            // Header row with friendly titles
            rows.push(exportColumns.map(col => col.title).join(','));

            // Data rows
            for (const prospect of data) {
                const rowData = exportColumns.map(col => {
                    const value = prospect[col.data];
                    // Escape values containing commas or quotes
                    if (value === null || value === undefined) return '';
                    const strValue = String(value);
                    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                        return `"${strValue.replace(/"/g, '""')}"`;
                    }
                    return strValue;
                });
                rows.push(rowData.join(','));
            }

            const csvContent = rows.join('\n');

            // Trigger download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);

            const fileName = this.currentDraftFilePath ?
                this.currentDraftFilePath.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') + '.csv' :
                'draft_class.csv';

            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.setStatus(`Exported ${data.length} prospects to CSV`);
            console.log(`Exported ${data.length} prospects to CSV`);

        } catch (error) {
            console.error('Error exporting draft CSV:', error);
            this.showError(`Failed to export CSV: ${error.message}`);
        }
    }

    async importDraftCSV() {
        try {
            if (!this.draftGrid) {
                this.showError('Please create or open a draft class first');
                return;
            }

            // Create file input for CSV
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const csvContent = event.target.result;
                        const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);

                        if (lines.length < 2) {
                            this.showError('Invalid CSV format: needs header and data rows');
                            return;
                        }

                        // Parse header row to get column order
                        const headers = this.parseCSVLine(lines[0]);
                        console.log('[Draft Import] Headers:', headers);

                        // Column mapping from CSV headers to prospect properties
                        const columnMap = {
                            'Draft Position': 'draftPosition',
                            'Round': 'draftRound',
                            'Last Name': 'lastName',
                            'First Name': 'firstName',
                            'Position': 'position',
                            'Archetype': 'archetype',
                            'Jersey #': 'jerseyNum',
                            'College': 'college',
                            'Age': 'age',
                            'State': 'homeState',
                            'PID': 'PID',
                            'Player Pic': 'playerPic',
                            'Asset ID (PEPS)': 'PEPS',
                            'Body Type': 'bodyType',
                            'OVR': 'overall',
                            'ACC': 'acceleration',
                            'AGI': 'agility',
                            'AWR': 'awareness',
                            'BTK': 'breakTackle',
                            'BCV': 'ballCarrierVision',
                            'BSH': 'blockShedding',
                            'BSK': 'breakSack',
                            'CAR': 'carrying',
                            'CIT': 'catchInTraffic',
                            'CTH': 'catching',
                            'DRR': 'deepRouteRunning',
                            'COD': 'changeOfDirection',
                            'FMV': 'finesseMoves',
                            'POW': 'hitPower',
                            'IBL': 'impactBlocking',
                            'INJ': 'injury',
                            'JKM': 'jukeMove',
                            'JMP': 'jumping',
                            'KAC': 'kickAccuracy',
                            'KPW': 'kickPower',
                            'KR': 'kickReturn',
                            'LS': 'longSnap',
                            'LBK': 'leadBlock',
                            'MCV': 'manCoverage',
                            'MRR': 'mediumRouteRunning',
                            'PBK': 'passBlock',
                            'PBF': 'passBlockFinesse',
                            'PBS': 'passBlockPower',
                            'PAC': 'playAction',
                            'PMV': 'powerMoves',
                            'PRS': 'pressCoverage',
                            'PUR': 'pursuit',
                            'PRC': 'playRecognition',
                            'RLS': 'release',
                            'RBK': 'runBlock',
                            'RBF': 'runBlockFinesse',
                            'RBS': 'runBlockPower',
                            'SRR': 'shortRouteRunning',
                            'SPC': 'spectacularCatch',
                            'SPD': 'speed',
                            'SPM': 'spinMove',
                            'STA': 'stamina',
                            'SFA': 'stiffArm',
                            'STR': 'strength',
                            'TAK': 'tackle',
                            'TAD': 'throwAccuracyDeep',
                            'TAM': 'throwAccuracyMid',
                            'TAS': 'throwAccuracyShort',
                            'TOR': 'throwOnTheRun',
                            'THP': 'throwPower',
                            'TUP': 'throwUnderPressure',
                            'TGH': 'toughness',
                            'TRK': 'trucking',
                            'ZCV': 'zoneCoverage',
                            'Height': 'heightInches',
                            'Weight': 'weight',
                            'Dev Trait': 'devTrait'
                        };

                        // Build header index map
                        const headerIndex = {};
                        headers.forEach((h, i) => {
                            const propName = columnMap[h];
                            if (propName) {
                                headerIndex[propName] = i;
                            }
                        });

                        console.log('[Draft Import] Property mapping:', headerIndex);

                        // Get current data from grid
                        const currentData = this.draftGrid.getSourceData();
                        let updatedCount = 0;
                        let errors = [];

                        // Process each data row
                        for (let i = 1; i < lines.length; i++) {
                            const values = this.parseCSVLine(lines[i]);
                            if (values.length === 0) continue;

                            // Get draft position to match with existing row
                            const draftPosIdx = headerIndex['draftPosition'];
                            const draftPos = draftPosIdx !== undefined ? parseInt(values[draftPosIdx]) : i - 1;

                            // Find matching row in grid by draft position
                            const rowIndex = currentData.findIndex(p => p.draftPosition === draftPos);
                            if (rowIndex === -1) {
                                errors.push(`Row ${i}: No matching draft position ${draftPos}`);
                                continue;
                            }

                            const prospect = currentData[rowIndex];

                            // Update each field
                            Object.entries(headerIndex).forEach(([prop, colIdx]) => {
                                const value = values[colIdx];
                                if (value !== undefined && value !== '') {
                                    // Convert numeric fields
                                    if (['overall', 'acceleration', 'agility', 'awareness', 'speed', 'strength',
                                         'catching', 'carrying', 'tackle', 'injury', 'stamina', 'jumping',
                                         'throwPower', 'kickPower', 'kickAccuracy', 'age', 'jerseyNum',
                                         'draftPosition', 'draftRound', 'heightInches', 'weight', 'PID',
                                         'blockShedding', 'breakTackle', 'ballCarrierVision', 'breakSack',
                                         'catchInTraffic', 'deepRouteRunning', 'changeOfDirection', 'finesseMoves',
                                         'hitPower', 'impactBlocking', 'jukeMove', 'kickReturn', 'longSnap',
                                         'leadBlock', 'manCoverage', 'mediumRouteRunning', 'passBlock',
                                         'passBlockFinesse', 'passBlockPower', 'playAction', 'powerMoves',
                                         'pressCoverage', 'pursuit', 'playRecognition', 'release', 'runBlock',
                                         'runBlockFinesse', 'runBlockPower', 'shortRouteRunning', 'spectacularCatch',
                                         'spinMove', 'stiffArm', 'throwAccuracyDeep', 'throwAccuracyMid',
                                         'throwAccuracyShort', 'throwOnTheRun', 'throwUnderPressure', 'toughness',
                                         'trucking', 'zoneCoverage'].includes(prop)) {
                                        const numVal = parseFloat(value);
                                        if (!isNaN(numVal)) {
                                            prospect[prop] = numVal;
                                        }
                                    } else {
                                        prospect[prop] = value;
                                    }
                                }
                            });

                            updatedCount++;
                        }

                        // Update the grid
                        this.draftGrid.loadData(currentData);

                        if (errors.length > 0) {
                            console.warn('[Draft Import] Errors:', errors);
                        }

                        this.setStatus(`Imported ${updatedCount} prospects from CSV`);
                        console.log(`[Draft Import] Updated ${updatedCount} prospects`);

                    } catch (error) {
                        console.error('[Draft Import] Error:', error);
                        this.showError(`Failed to import CSV: ${error.message}`);
                    }
                };

                reader.readAsText(file);
            };

            input.click();

        } catch (error) {
            console.error('Error importing draft CSV:', error);
            this.showError(`Failed to import CSV: ${error.message}`);
        }
    }

    // Load saved converter paths from localStorage
    loadConverterPaths() {
        const m25Path = localStorage.getItem('m25DraftPath');
        const m26TemplatePath = localStorage.getItem('m26TemplatePath');
        const m26OutputPath = localStorage.getItem('m26OutputPath');

        if (m25Path && document.getElementById('m25DraftFile')) {
            document.getElementById('m25DraftFile').value = m25Path;
            // Update filename display
            const filename = m25Path.substring(m25Path.lastIndexOf('\\') + 1);
            const filenameDisplay = document.getElementById('m25DraftFilename');
            if (filenameDisplay) filenameDisplay.textContent = filename;
        }
        if (m26TemplatePath && document.getElementById('m26TemplateFile')) {
            document.getElementById('m26TemplateFile').value = m26TemplatePath;
            // Update filename display
            const filename = m26TemplatePath.substring(m26TemplatePath.lastIndexOf('\\') + 1);
            const filenameDisplay = document.getElementById('m26TemplateFilename');
            if (filenameDisplay) {
                filenameDisplay.textContent = filename;
                filenameDisplay.style.color = '#2196F3';
            }
        } else {
            // Reset to default if no path
            const filenameDisplay = document.getElementById('m26TemplateFilename');
            if (filenameDisplay) {
                filenameDisplay.textContent = 'No template selected';
                filenameDisplay.style.color = '#999';
            }
        }
        if (m26OutputPath && document.getElementById('m26OutputFile')) {
            document.getElementById('m26OutputFile').value = m26OutputPath;
            // Update filename display
            const filename = m26OutputPath.substring(m26OutputPath.lastIndexOf('\\') + 1);
            const filenameDisplay = document.getElementById('m26OutputFilename');
            if (filenameDisplay) filenameDisplay.textContent = filename;
        }

        this.checkConverterReady();
    }

    // Check if all converter fields are filled and enable/disable convert button
    checkConverterReady() {
        const m25File = document.getElementById('m25DraftFile')?.value;
        const m26Template = document.getElementById('m26TemplateFile')?.value;
        const m26Output = document.getElementById('m26OutputFile')?.value;
        const convertBtn = document.getElementById('convertM25ToM26Btn');

        if (convertBtn) {
            convertBtn.disabled = !(m25File && m26Template && m26Output);
        }
    }

    // Streamlined converter using the dedicated converter screen
    async convertM25toM26Streamlined() {
        try {
            const m25File = document.getElementById('m25DraftFile').value;
            const m26Template = document.getElementById('m26TemplateFile').value;
            const m26Output = document.getElementById('m26OutputFile').value;

            if (!m25File || !m26Template || !m26Output) {
                this.showError('Please select all required files');
                return;
            }

            // Show progress
            const progressDiv = document.getElementById('conversionProgress');
            const progressBar = document.getElementById('conversionProgressBar');
            const progressText = document.getElementById('conversionProgressText');

            if (progressDiv) progressDiv.style.display = 'block';
            if (progressBar) progressBar.style.width = '50%';
            if (progressText) progressText.textContent = 'Converting M25 to M26...';

            console.log('[Convert] M25 input file:', m25File);
            console.log('[Convert] M26 template file:', m26Template);
            console.log('[Convert] M26 output file:', m26Output);

            // Convert with template
            const convertResult = await window.electronAPI.draftClass.convertM25toM26(
                m25File,
                m26Output,
                m26Template
            );

            if (!convertResult.success) {
                throw new Error(convertResult.error || 'Failed to convert draft class');
            }

            // Update progress
            if (progressBar) progressBar.style.width = '100%';
            if (progressText) progressText.textContent = 'Conversion complete!';

            console.log('[Convert] Conversion successful');
            console.log(`  Prospects: ${convertResult.prospectCount}`);
            console.log(`  Input size: ${convertResult.inputSize} bytes`);
            console.log(`  Output size: ${convertResult.outputSize} bytes`);

            // Hide progress after delay
            setTimeout(() => {
                if (progressDiv) progressDiv.style.display = 'none';
                if (progressBar) progressBar.style.width = '0%';
            }, 2000);

            alert(`M25 to M26 conversion successful!\n\nProspects: ${convertResult.prospectCount}\nSaved to: ${m26Output}`);

        } catch (error) {
            console.error('[Convert] Error:', error);

            // Hide progress
            const progressDiv = document.getElementById('conversionProgress');
            if (progressDiv) progressDiv.style.display = 'none';

            this.showError(`Failed to convert M25 to M26: ${error.message}`);
        }
    }

    async convertM25toM26() {
        try {
            // Prompt user to select M25 file
            const inputResult = await window.electronAPI.file.openDialog(null);

            if (!inputResult.success || inputResult.canceled) {
                return;
            }

            const inputPath = inputResult.filePath;
            console.log('[Convert] M25 input file:', inputPath);

            // Prompt user to select M26 template file
            alert('Step 2: Select a Madden 26 draft class file to use as template\n(This provides the correct M26 file structure)');
            const templateResult = await window.electronAPI.file.openDialog(null);

            if (!templateResult.success || templateResult.canceled) {
                return;
            }

            const templatePath = templateResult.filePath;
            console.log('[Convert] M26 template file:', templatePath);

            // Generate default output filename (append -M26)
            const defaultOutputName = inputPath.replace(/([^\\\/]+)$/, '$1-M26');

            // Prompt user for output location
            const outputResult = await window.electronAPI.file.saveDialog(defaultOutputName);

            if (!outputResult.success || outputResult.canceled) {
                return;
            }

            const outputPath = outputResult.filePath;
            console.log('[Convert] M26 output file:', outputPath);

            // Show converting message
            alert('Converting M25 to M26... This may take a moment.');

            // Convert with template
            const convertResult = await window.electronAPI.draftClass.convertM25toM26(
                inputPath,
                outputPath,
                templatePath
            );

            if (!convertResult.success) {
                throw new Error(convertResult.error || 'Failed to convert draft class');
            }

            console.log('[Convert] Conversion successful');
            console.log(`  Prospects: ${convertResult.prospectCount}`);
            console.log(`  Input size: ${convertResult.inputSize} bytes`);
            console.log(`  Output size: ${convertResult.outputSize} bytes`);

            alert(`M25 to M26 conversion successful!\n\nProspects: ${convertResult.prospectCount}\nOutput: ${outputPath}`);

        } catch (error) {
            console.error('[Convert] Error:', error);
            this.showError(`Failed to convert M25 to M26: ${error.message}`);
        }
    }

    filterDraftProspects() {
        if (!this.currentDraftClass || !this.draftGrid) {
            return;
        }

        const allProspects = this.currentDraftClass.prospects;
        let filtered = [...allProspects];

        // Apply round filter
        if (this.selectedDraftRound) {
            if (this.selectedDraftRound === 'ufa') {
                // UFA = round 8 or higher (picks beyond 224)
                filtered = filtered.filter(prospect => {
                    const round = prospect.round || 0;
                    return round >= 8;
                });
            } else {
                // Specific round (1-7)
                const targetRound = parseInt(this.selectedDraftRound);
                filtered = filtered.filter(prospect => {
                    return prospect.round === targetRound;
                });
            }
        }

        // Apply position filter
        if (this.selectedDraftPosition) {
            filtered = filtered.filter(prospect => {
                const position = getLookupValue('positions', prospect.position);
                return position === this.selectedDraftPosition;
            });
        }

        // Apply search filter
        if (this.draftSearchTerm) {
            filtered = filtered.filter(prospect => {
                const firstName = (prospect.firstName || '').toLowerCase();
                const lastName = (prospect.lastName || '').toLowerCase();
                const fullName = `${firstName} ${lastName}`;
                return fullName.includes(this.draftSearchTerm);
            });
        }

        // Sort by round and pick when showing all rounds, or just by draftPosition within a single round
        if (!this.selectedDraftRound) {
            // When showing all rounds, sort by round first, then by draft position
            filtered.sort((a, b) => {
                const roundA = a.round || 999; // Put players without round at end
                const roundB = b.round || 999;

                if (roundA !== roundB) {
                    return roundA - roundB;
                }

                // Within same round, sort by draft position
                const posA = a.draftPosition !== undefined ? a.draftPosition : 999;
                const posB = b.draftPosition !== undefined ? b.draftPosition : 999;
                return posA - posB;
            });
        } else {
            // When filtering to a specific round, sort by draft position
            filtered.sort((a, b) => {
                const posA = a.draftPosition !== undefined ? a.draftPosition : 999;
                const posB = b.draftPosition !== undefined ? b.draftPosition : 999;
                return posA - posB;
            });
        }

        // Update grid with filtered data
        this.draftGrid.loadData(filtered);
    }

    // ===== CREATOR METHODS =====

    /**
     * Generate Draft Class from web scraping
     */
    async generateDraftClass() {
        const yearInput = document.getElementById('draftYear');
        const draftClassTypeSelect = document.getElementById('draftClassType');
        const year = parseInt(yearInput.value);
        const draftClassType = draftClassTypeSelect ? draftClassTypeSelect.value : 'single';

        // Get selected rating mode
        const ratingModeRadio = document.querySelector('input[name="draftClassRatingMode"]:checked');
        const ratingMode = ratingModeRadio ? ratingModeRadio.value : 'semi-historical';
        console.log(`[Creator] Using rating mode: ${ratingMode}`);

        // Determine if this is a decade class
        const isDecadeClass = draftClassType !== 'single';
        let decadeStart, decadeEnd;

        if (isDecadeClass) {
            // Extract decade from value like "1990s"
            decadeStart = parseInt(draftClassType.substring(0, 4));
            decadeEnd = decadeStart + 9;
        }

        if (!isDecadeClass && (!year || year < 1936 || year > 2030)) {
            this.showError('Please enter a valid draft year (1936-2030) or select a decade class');
            return;
        }

        // Show progress
        const progressDiv = document.getElementById('draftGenerateProgress');
        const progressBar = document.getElementById('draftProgressBar');
        const progressText = document.getElementById('draftProgressText');
        const generateBtn = document.getElementById('generateDraftBtn');

        progressDiv.style.display = 'block';
        generateBtn.disabled = true;
        progressBar.style.width = '10%';
        progressText.textContent = isDecadeClass ?
            `Generating ${draftClassType} decade class (best players from ${decadeStart}-${decadeEnd})...` :
            `Scraping ${year} draft class data...`;

        try {
            console.log(`[Creator] Generating draft class for ${year} (Type: ${draftClassType})`);

            // Call IPC to generate draft class with decade info if applicable
            progressBar.style.width = '30%';
            const result = isDecadeClass ?
                await window.electronAPI.creator.generateDecadeDraftClass(decadeStart, decadeEnd) :
                await window.electronAPI.creator.generateDraftClass(year, false, ratingMode);

            if (!result.success) {
                throw new Error(result.error || 'Failed to generate draft class');
            }

            console.log(`[Creator] Generated ${result.count} players`);

            progressBar.style.width = '70%';
            progressText.textContent = 'Displaying preview...';

            // Store generated players
            this.generatedDraftPlayers = result.players;

            // Show preview step
            await this.showDraftPreview(result.players);

            progressBar.style.width = '100%';
            progressText.textContent = 'Complete!';

            setTimeout(() => {
                progressDiv.style.display = 'none';
                generateBtn.disabled = false;
            }, 1000);

        } catch (error) {
            console.error('[Creator] Error generating draft class:', error);
            this.showError(`Failed to generate draft class: ${error.message}`);
            progressDiv.style.display = 'none';
            generateBtn.disabled = false;
        }
    }

    /**
     * Generate Roster from web scraping
     */
    async generateRoster() {
        const yearInput = document.getElementById('rosterYear');
        const templateInput = document.getElementById('rosterTemplate');
        const year = parseInt(yearInput.value);
        const templatePath = templateInput.value;

        if (!year || year < 1920 || year > 2025) {
            this.showError('Please enter a valid season year (1920-2025)');
            return;
        }

        if (!templatePath) {
            this.showError('Please select a roster template file');
            return;
        }

        // Show progress
        const progressDiv = document.getElementById('rosterGenerateProgress');
        const progressBar = document.getElementById('rosterProgressBar');
        const progressText = document.getElementById('rosterProgressText');
        const currentTeamText = document.getElementById('rosterCurrentTeam');
        const generateBtn = document.getElementById('generateRosterBtn');

        progressDiv.style.display = 'block';
        generateBtn.disabled = true;
        progressBar.style.width = '5%';
        progressText.textContent = `Starting roster generation for ${year}...`;
        currentTeamText.textContent = '';

        try {
            console.log(`[Creator] Generating roster for ${year}`);

            // Set up progress listener
            window.electronAPI.rosterCreator.onProgress((data) => {
                progressBar.style.width = `${data.progress}%`;
                progressText.textContent = data.message;
                // Show current team being processed
                if (data.currentTeam) {
                    currentTeamText.textContent = `Processing: ${data.currentTeam}`;
                } else {
                    currentTeamText.textContent = '';
                }
                console.log(`[Creator] Progress: ${data.progress}% - ${data.message}${data.currentTeam ? ` (${data.currentTeam})` : ''}`);
            });

            // Get selected rating mode
            const ratingMode = document.querySelector('input[name="rosterRatingMode"]:checked')?.value || 'semi-historical';
            console.log(`[Creator] Using rating mode: ${ratingMode}`);

            // Call IPC to generate roster (this will take 10-15 minutes)
            const result = await window.electronAPI.rosterCreator.generate(year, templatePath, ratingMode);

            // Remove progress listener
            window.electronAPI.rosterCreator.removeProgressListener();

            if (!result.success) {
                throw new Error(result.error || 'Failed to generate roster');
            }

            console.log(`[Creator] Generated ${result.players.length} players`);
            console.log(`[Creator] HOF players: ${result.stats.hofPlayers}`);
            console.log(`[Creator] Average OVR: ${result.stats.averageOVR}`);

            // DEBUG: Log PEPS/PAM values for first 5 players
            console.log(`[Creator] ========== PEPS/PAM DEBUG ==========`);
            result.players.slice(0, 5).forEach((p, i) => {
                console.log(`[Creator] Player ${i + 1}: ${p.PFNA} ${p.PLNA} - PEPS="${p.PEPS}", PLPL=${p.PLPL}, PGHE=${p.PGHE}, PSKI=${p.PSKI}`);
            });
            console.log(`[Creator] =====================================`);

            progressBar.style.width = '100%';
            progressText.textContent = `Complete! Generated ${result.players.length} players`;

            // Store generated players
            this.generatedRosterPlayers = result.players;
            this.generatedRosterStats = result.stats;

            // Show preview step
            await this.showRosterPreview(result.players);

            setTimeout(() => {
                progressDiv.style.display = 'none';
                generateBtn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('[Creator] Error generating roster:', error);
            this.showError(`Failed to generate roster: ${error.message}`);
            progressDiv.style.display = 'none';
            generateBtn.disabled = false;
            // Remove progress listener on error
            window.electronAPI.rosterCreator.removeProgressListener();
        }
    }

    /**
     * Show draft class preview in Handsontable grid
     */
    async showDraftPreview(players) {
        const previewStep = document.getElementById('draftPreviewStep');
        const previewContainer = document.getElementById('draftPreviewGrid');
        const previewCount = document.getElementById('draftPreviewCount');

        // Show preview step
        previewStep.style.display = 'block';
        previewCount.textContent = `${players.length} players generated - Ready to load into Draft Class Editor`;

        // DEBUG: Log first player data AS RECEIVED from IPC
        if (players.length > 0) {
            const firstPlayer = players[0];
            console.log(`[Frontend] ========== FIRST PLAYER RECEIVED FROM IPC ==========`);
            console.log(`[Frontend] Name: ${firstPlayer.firstName} ${firstPlayer.lastName}`);
            console.log(`[Frontend] Position: ${firstPlayer.position} (code ${firstPlayer.positionCode})`);
            console.log(`[Frontend] College ID: ${firstPlayer.college}, HomeState ID: ${firstPlayer.homeState}, Body Type: ${firstPlayer.bodyType}`);
            console.log(`[Frontend] Raw ratings object:`, firstPlayer.ratings);
            console.log(`[Frontend] COD: ${firstPlayer.ratings?.changeOfDirection}, TGH: ${firstPlayer.ratings?.toughness}, LS: ${firstPlayer.ratings?.longSnap}`);
            console.log(`[Frontend] PBS: ${firstPlayer.ratings?.passBlockPower}, PBF: ${firstPlayer.ratings?.passBlockFinesse}`);
            console.log(`[Frontend] RBS: ${firstPlayer.ratings?.runBlockPower}, RBF: ${firstPlayer.ratings?.runBlockFinesse}`);
            console.log(`[Frontend] ======================================================`);
        }

        // Convert players to grid data with ALL ratings
        // NOTE: draftPosition is NOT stored - it's calculated from row order in the grid
        const gridData = players.map((player, index) => {
            const r = player.ratings;
            return {
                // Basic Info
                firstName: player.firstName,
                lastName: player.lastName,
                position: player.position,
                college: player.college,
                homeState: player.homeState,
                age: player.age,
                heightInches: player.heightInches,
                weight: player.weight,
                jerseyNum: player.jerseyNum,
                devTrait: ['Normal', 'Star', 'Superstar', 'X-Factor'][player.devTrait] || 'Normal',
                bodyType: player.bodyType,
                PID: player.PID,

                // Core Physical
                overall: r.overall,
                speed: r.speed,
                acceleration: r.acceleration,
                agility: r.agility,
                changeOfDirection: r.changeOfDirection || '-',
                strength: r.strength,
                awareness: r.awareness,
                jumping: r.jumping,
                stamina: r.stamina,
                injury: r.injury,
                toughness: r.toughness || '-',

                // QB Attributes
                throwPower: r.throwPower || '-',
                throwAccShort: r.throwAccuracyShort || '-',
                throwAccMid: r.throwAccuracyMid || '-',
                throwAccDeep: r.throwAccuracyDeep || '-',
                throwOnRun: r.throwOnTheRun || '-',
                throwUnderPress: r.throwUnderPressure || '-',
                playAction: r.playAction || '-',
                breakSack: r.breakSack || '-',

                // Ball Carrier
                carrying: r.carrying || '-',
                bcVision: r.ballCarrierVision || '-',
                breakTackle: r.breakTackle || '-',
                trucking: r.trucking || '-',
                stiffArm: r.stiffArm || '-',
                spinMove: r.spinMove || '-',
                jukeMove: r.jukeMove || '-',

                // Receiving
                catching: r.catching || '-',
                catchInTraffic: r.catchInTraffic || '-',
                specCatch: r.spectacularCatch || '-',
                shortRoute: r.shortRouteRunning || '-',
                medRoute: r.mediumRouteRunning || '-',
                deepRoute: r.deepRouteRunning || '-',
                release: r.release || '-',

                // Blocking
                passBlock: r.passBlock || '-',
                passBlockPower: r.passBlockPower || '-',
                passBlockFinesse: r.passBlockFinesse || '-',
                runBlock: r.runBlock || '-',
                runBlockPower: r.runBlockPower || '-',
                runBlockFinesse: r.runBlockFinesse || '-',
                leadBlock: r.leadBlock || '-',
                impactBlock: r.impactBlocking || '-',

                // Defense
                tackle: r.tackle || '-',
                hitPower: r.hitPower || '-',
                powerMoves: r.powerMoves || '-',
                finesseMoves: r.finesseMoves || '-',
                blockShed: r.blockShedding || '-',
                pursuit: r.pursuit || '-',
                playRec: r.playRecognition || '-',
                manCov: r.manCoverage || '-',
                zoneCov: r.zoneCoverage || '-',
                pressCov: r.pressCoverage || '-',

                // Special Teams
                kickPower: r.kickPower || '-',
                kickAcc: r.kickAccuracy || '-',
                kickReturn: r.kickReturn || '-',
                longSnap: r.longSnap || '-'
            };
        });

        // DEBUG: Log first row of gridData AFTER mapping
        if (gridData.length > 0) {
            const firstRow = gridData[0];
            console.log(`[Frontend] ========== FIRST ROW AFTER MAPPING ==========`);
            console.log(`[Frontend] Name: ${firstRow.firstName} ${firstRow.lastName}`);
            console.log(`[Frontend] College: ${firstRow.college}, HomeState: ${firstRow.homeState}, Body Type: ${firstRow.bodyType}`);
            console.log(`[Frontend] COD: ${firstRow.changeOfDirection}, TGH: ${firstRow.toughness}, LS: ${firstRow.longSnap}`);
            console.log(`[Frontend] PBS: ${firstRow.passBlockPower}, PBF: ${firstRow.passBlockFinesse}`);
            console.log(`[Frontend] RBS: ${firstRow.runBlockPower}, RBF: ${firstRow.runBlockFinesse}`);
            console.log(`[Frontend] ====================================================`);
        }

        // Custom renderer for draft position - display as 1-indexed
        // Draft position renderer - ALWAYS display current row position (1-indexed)
        // Position is NOT stored - it's calculated from the row's physical position in the grid
        const draftPosRenderer = function(instance, td, row, col, prop, value, cellProperties) {
            // Always display the current physical row position (row numbers are 0-indexed, display as 1-indexed)
            const displayValue = row + 1;
            Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, displayValue, cellProperties]);
            td.style.textAlign = 'center';
            td.style.fontWeight = 'bold';
            td.style.backgroundColor = '#f0f0f0'; // Light gray background to indicate calculated field
        };

        // Define all columns with readable headers
        const columns = [
            // Draft Position (for reordering) - displays as 1-indexed but stores as 0-indexed
            // Editable so users can type a position to move the row there
            {
                data: 'draftPosition',
                header: 'Draft Pos',
                width: 80,
                type: 'numeric',
                renderer: draftPosRenderer,
                readOnly: false,
                validator: function(value, callback) {
                    const maxPos = this.instance.countRows();
                    if (value >= 1 && value <= maxPos) {
                        callback(true);
                    } else {
                        callback(false);
                    }
                }
            },
            // Basic Info
            { data: 'firstName', header: 'First', width: 70 },
            { data: 'lastName', header: 'Last', width: 90 },
            { data: 'position', header: 'Pos', width: 45 },
            { data: 'college', header: 'College', width: 110 },
            { data: 'age', header: 'Age', width: 40, type: 'numeric' },
            { data: 'heightInches', header: 'Ht"', width: 40, type: 'numeric' },
            { data: 'weight', header: 'Wt', width: 45, type: 'numeric' },
            { data: 'jerseyNum', header: '#', width: 40, type: 'numeric' },
            { data: 'devTrait', header: 'Dev', width: 75 },
            { data: 'bodyType', header: 'Body', width: 50, type: 'numeric' },
            { data: 'PID', header: 'PID', width: 50, type: 'numeric' },

            // Core Physical
            { data: 'overall', header: 'OVR', width: 45, type: 'numeric' },
            { data: 'speed', header: 'SPD', width: 45, type: 'numeric' },
            { data: 'acceleration', header: 'ACC', width: 45, type: 'numeric' },
            { data: 'agility', header: 'AGI', width: 45, type: 'numeric' },
            { data: 'strength', header: 'STR', width: 45, type: 'numeric' },
            { data: 'awareness', header: 'AWR', width: 45, type: 'numeric' },
            { data: 'jumping', header: 'JMP', width: 45, type: 'numeric' },
            { data: 'stamina', header: 'STA', width: 45, type: 'numeric' },
            { data: 'injury', header: 'INJ', width: 45, type: 'numeric' },

            // QB Attributes
            { data: 'throwPower', header: 'THP', width: 45 },
            { data: 'throwAccShort', header: 'TAS', width: 45 },
            { data: 'throwAccMid', header: 'TAM', width: 45 },
            { data: 'throwAccDeep', header: 'TAD', width: 45 },
            { data: 'throwOnRun', header: 'TOR', width: 45 },
            { data: 'throwUnderPress', header: 'TUP', width: 45 },
            { data: 'playAction', header: 'PAC', width: 45 },
            { data: 'breakSack', header: 'BSK', width: 45 },

            // Ball Carrier
            { data: 'carrying', header: 'CAR', width: 45 },
            { data: 'bcVision', header: 'BCV', width: 45 },
            { data: 'breakTackle', header: 'BTK', width: 45 },
            { data: 'trucking', header: 'TRK', width: 45 },
            { data: 'stiffArm', header: 'SFA', width: 45 },
            { data: 'spinMove', header: 'SPM', width: 45 },
            { data: 'jukeMove', header: 'JKM', width: 45 },

            // Receiving
            { data: 'catching', header: 'CTH', width: 45 },
            { data: 'catchInTraffic', header: 'CIT', width: 45 },
            { data: 'specCatch', header: 'SPC', width: 45 },
            { data: 'shortRoute', header: 'SRR', width: 45 },
            { data: 'medRoute', header: 'MRR', width: 45 },
            { data: 'deepRoute', header: 'DRR', width: 45 },
            { data: 'release', header: 'RLS', width: 45 },

            // Blocking
            { data: 'passBlock', header: 'PBK', width: 45 },
            { data: 'runBlock', header: 'RBK', width: 45 },
            { data: 'leadBlock', header: 'LBK', width: 45 },
            { data: 'impactBlock', header: 'IBL', width: 45 },

            // Defense
            { data: 'tackle', header: 'TAK', width: 45 },
            { data: 'hitPower', header: 'POW', width: 45 },
            { data: 'powerMoves', header: 'PMV', width: 45 },
            { data: 'finesseMoves', header: 'FMV', width: 45 },
            { data: 'blockShed', header: 'BSH', width: 45 },
            { data: 'pursuit', header: 'PUR', width: 45 },
            { data: 'playRec', header: 'PRC', width: 45 },
            { data: 'manCov', header: 'MCV', width: 45 },
            { data: 'zoneCov', header: 'ZCV', width: 45 },
            { data: 'pressCov', header: 'PRS', width: 45 },

            // Special Teams
            { data: 'kickPower', header: 'KPW', width: 45 },
            { data: 'kickAcc', header: 'KAC', width: 45 },
            { data: 'kickReturn', header: 'KR', width: 45 }
        ];

        // Initialize Handsontable if needed
        if (!this.draftCreatorGrid) {
            this.draftCreatorGrid = new Handsontable(previewContainer, {
                data: gridData,
                colHeaders: columns.map(col => col.header),
                columns: columns.map(col => ({
                    data: col.data,
                    type: col.type || 'text',
                    width: col.width,
                    renderer: col.renderer,
                    readOnly: col.readOnly !== undefined ? col.readOnly : true,
                    validator: col.validator
                })),
                rowHeaders: true,
                height: 500,
                licenseKey: 'non-commercial-and-evaluation',
                manualColumnResize: true,
                filters: true,
                dropdownMenu: true,
                contextMenu: {
                    items: {
                        'delete_player': {
                            name: '🗑️ Delete Player',
                            callback: (key, selection) => {
                                const row = selection[0].start.row;
                                const data = this.draftCreatorGrid.getSourceData();
                                const player = data[row];
                                const playerName = `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'this player';

                                if (confirm(`Are you sure you want to delete ${playerName}?`)) {
                                    // Remove the row
                                    this.draftCreatorGrid.alter('remove_row', row, 1);

                                    // Update draft positions for remaining players
                                    const updatedData = this.draftCreatorGrid.getSourceData();
                                    updatedData.forEach((p, idx) => {
                                        p.draftPosition = idx + 1;
                                        p.round = Math.floor(idx / 32) + 1;
                                    });

                                    this.draftCreatorGrid.render();
                                    console.log('[Draft Creator] Player deleted, remaining:', updatedData.length);
                                }
                            }
                        },
                        'separator1': '---------',
                        'copy': { name: 'Copy' },
                        'cut': { name: 'Cut' },
                        'separator2': '---------',
                        'undo': { name: 'Undo' },
                        'redo': { name: 'Redo' }
                    }
                },
                selectionMode: 'multiple',
                stretchH: 'none', // Don't stretch columns, use defined widths
                width: '100%', // Ensure full width
                autoWrapRow: true,
                autoWrapCol: true,
                renderAllRows: false, // Use virtual scrolling
                viewportRowRenderingOffset: 100, // Render extra rows to prevent misalignment
                fixedColumnsStart: 4, // Freeze first 4 columns (Draft Pos, First, Last, Pos) to prevent alignment issues
                preventOverflow: false, // Allow natural scrolling to prevent snap-left issues
                manualRowMove: true, // Enable row dragging for reordering
                afterRowMove: (movedRows, finalIndex, dropIndex, movePossible, orderChanged) => {
                    // Update draft positions and rounds after reordering
                    if (orderChanged && this.draftCreatorGrid && !this.draftCreatorGrid.isDestroyed) {
                        try {
                            console.log('[Draft Creator] Rows reordered - updating draft positions and rounds');

                            // Get all source data
                            const allData = this.draftCreatorGrid.getSourceData();

                            // Update draftPosition and round for ALL rows based on their new position
                            allData.forEach((row, index) => {
                                // Update draftPosition (0-indexed)
                                row.draftPosition = index;

                                // Recalculate round based on new pick number
                                const pickNum = index + 1; // Convert to 1-indexed
                                if (pickNum <= 224) {
                                    row.round = Math.floor((pickNum - 1) / 32) + 1;
                                } else {
                                    row.round = 8; // UFA
                                }
                            });

                            // Re-render to show updated positions and rounds
                            this.draftCreatorGrid.render();
                            console.log('[Draft Creator] Draft positions and rounds updated successfully');
                        } catch (e) {
                            console.error('[Draft Creator] afterRowMove: Error updating positions:', e);
                        }
                    }
                },
                // Highlight entire row on selection
                afterSelection: (row, column, row2, column2, preventScrolling, selectionLayerLevel) => {
                    if (!this.draftCreatorGrid) return;

                    const container = this.draftCreatorGrid.rootElement;
                    if (container) {
                        const previousHighlights = container.querySelectorAll('tr.row-selected');
                        previousHighlights.forEach(tr => tr.classList.remove('row-selected'));

                        for (let r = Math.min(row, row2); r <= Math.max(row, row2); r++) {
                            const clones = ['.ht_master', '.ht_clone_left', '.ht_clone_top', '.ht_clone_top_left_corner'];
                            clones.forEach(cloneClass => {
                                const clone = container.querySelector(cloneClass);
                                if (clone) {
                                    const rowElement = clone.querySelector(`tbody tr:nth-child(${r + 1})`);
                                    if (rowElement) {
                                        rowElement.classList.add('row-selected');
                                    }
                                }
                            });
                        }
                    }
                },
                beforeChange: (changes, source) => {
                    if (!changes) return;

                    changes.forEach(([row, prop, oldValue, newValue]) => {
                        // Handle draft position changes - move the row to the new position
                        if (prop === 'draftPosition' && source !== 'loadData') {
                            // Convert from 1-indexed user input to 0-indexed row position
                            const targetRow = newValue - 1;
                            const currentRow = row; // Use visual row index

                            if (targetRow !== currentRow && targetRow >= 0 && targetRow < this.draftCreatorGrid.countRows()) {
                                // Use Handsontable's plugin to move the row
                                const plugin = this.draftCreatorGrid.getPlugin('manualRowMove');
                                plugin.moveRow(currentRow, targetRow);

                                // Prevent the default value change since we're moving the row (position is calculated, not stored)
                                return false;
                            }
                        }
                    });
                }
            });
        } else {
            this.draftCreatorGrid.loadData(gridData);
        }
    }

    /**
     * Show roster preview in Handsontable grid
     */
    async showRosterPreview(players) {
        const previewStep = document.getElementById('rosterPreviewStep');
        const previewContainer = document.getElementById('rosterPreviewGrid');
        const previewCount = document.getElementById('rosterPreviewCount');

        // Show preview step
        previewStep.style.display = 'block';

        // Display stats
        const hofCount = players.filter(p => p.isHallOfFamer).length;
        previewCount.textContent = `${players.length} players generated (${hofCount} Hall of Famers)`;

        // Convert players to grid data
        const gridData = players.map(player => {
            return {
                // Basic Info
                firstName: player.PFNA,
                lastName: player.PLNA,
                position: player.PPOS,
                team: player.TGID,
                age: player.PAGE,
                jersey: player.PJEN,
                height: Math.floor(player.PHGT / 12) + '-' + (player.PHGT % 12),
                weight: player.PWGT,
                college: player.PCOL,
                isHOF: player.isHallOfFamer ? 'Yes' : 'No',

                // Face/Appearance fields
                PAM: player.PEPS || '-',
                faceType: player.PLPL === 100 ? 'Real' : 'Generic',
                PGHE: player.PGHE || '-',
                PSKI: player.PSKI || '-',

                // Core Ratings
                overall: player.POVR,
                speed: player.PSPD,
                acceleration: player.PACC,
                agility: player.PAGI,
                strength: player.PSTR,
                awareness: player.PAWR,
                jumping: player.PJMP,
                stamina: player.PSTA,
                injury: player.PINJ,
                toughness: player.PTGH,

                // Position-specific attributes (will show '-' if not present)
                throwPower: player.PTHP || '-',
                throwAccShort: player.PTHA || '-',
                throwAccMid: player.PTHM || '-',
                throwAccDeep: player.PTHD || '-',
                carrying: player.PCAR || '-',
                breakTackle: player.PBTK || '-',
                catching: player.PCTH || '-',
                catchInTraffic: player.PCIT || '-',
                routeRunning: player.PRTE || '-',
                release: player.PREL || '-',
                runBlock: player.PRBK || '-',
                passBlock: player.PLBK || '-',
                tackling: player.PTAK || '-',
                hitPower: player.PHTP || '-',
                powerMoves: player.PPOW || '-',
                finesseMoves: player.PFMS || '-',
                blockShedding: player.PBSH || '-',
                manCoverage: player.PMCV || '-',
                zoneCoverage: player.PZCV || '-',
                press: player.PPRS || '-',
                kickPower: player.PKPW || '-',
                kickAccuracy: player.PKAC || '-',

                // Additional Ball Carrier
                stiffArm: player.PSFA || '-',
                spinMove: player.PSPM || '-',
                jukeMove: player.PJKM || '-',
                trucking: player.PTRK || '-',
                bcVision: player.PBCV || '-',

                // Additional Receiving
                specCatch: player.PSPC || '-',
                shortRoute: player.PSRR || '-',
                medRoute: player.PMRR || '-',
                deepRoute: player.PDRR || '-',

                // Additional Blocking
                leadBlock: player.PLBK || '-',
                impactBlock: player.PIBL || '-',

                // Additional Passing
                throwOnRun: player.PTHO || '-',
                throwUnderPress: player.PTHU || '-',
                playAction: player.PPLA || '-',
                breakSack: player.PBSK || '-',

                // Additional Defense
                pursuit: player.PPUR || '-',
                playRec: player.PPRC || '-',

                // Special Teams
                kickReturn: player.PKRT || '-',

                // Roster-specific fields
                heightInches: player.PHGT,
                positionCode: player.PPOS, // Position code is already in PPOS field
                devTrait: player.PDEV !== undefined ? ['Normal', 'Star', 'Superstar', 'X-Factor'][player.PDEV] || 'Normal' : '-'
            };
        });

        // Define all columns (same as draft preview)
        const columns = [
            // Basic Info
            { data: 'firstName', header: 'First', width: 70 },
            { data: 'lastName', header: 'Last', width: 90 },
            { data: 'position', header: 'Pos', width: 45 },
            { data: 'positionCode', header: 'Code', width: 45, type: 'numeric' },
            { data: 'team', header: 'Team', width: 50 },
            { data: 'college', header: 'College', width: 110 },
            { data: 'age', header: 'Age', width: 40, type: 'numeric' },
            { data: 'heightInches', header: 'Ht"', width: 40, type: 'numeric' },
            { data: 'weight', header: 'Wt', width: 45, type: 'numeric' },
            { data: 'devTrait', header: 'Dev', width: 75 },

            // Face/Appearance
            { data: 'PAM', header: 'PAM', width: 150 },
            { data: 'faceType', header: 'Face', width: 60 },
            { data: 'PGHE', header: 'Head', width: 45, type: 'numeric' },
            { data: 'PSKI', header: 'Skin', width: 45, type: 'numeric' },

            // Core Physical
            { data: 'overall', header: 'OVR', width: 45, type: 'numeric' },
            { data: 'speed', header: 'SPD', width: 45, type: 'numeric' },
            { data: 'acceleration', header: 'ACC', width: 45, type: 'numeric' },
            { data: 'agility', header: 'AGI', width: 45, type: 'numeric' },
            { data: 'strength', header: 'STR', width: 45, type: 'numeric' },
            { data: 'awareness', header: 'AWR', width: 45, type: 'numeric' },
            { data: 'jumping', header: 'JMP', width: 45, type: 'numeric' },
            { data: 'stamina', header: 'STA', width: 45, type: 'numeric' },
            { data: 'injury', header: 'INJ', width: 45, type: 'numeric' },

            // QB Attributes
            { data: 'throwPower', header: 'THP', width: 45 },
            { data: 'throwAccShort', header: 'TAS', width: 45 },
            { data: 'throwAccMid', header: 'TAM', width: 45 },
            { data: 'throwAccDeep', header: 'TAD', width: 45 },
            { data: 'throwOnRun', header: 'TOR', width: 45 },
            { data: 'throwUnderPress', header: 'TUP', width: 45 },
            { data: 'playAction', header: 'PAC', width: 45 },
            { data: 'breakSack', header: 'BSK', width: 45 },

            // Ball Carrier
            { data: 'carrying', header: 'CAR', width: 45 },
            { data: 'bcVision', header: 'BCV', width: 45 },
            { data: 'breakTackle', header: 'BTK', width: 45 },
            { data: 'trucking', header: 'TRK', width: 45 },
            { data: 'stiffArm', header: 'SFA', width: 45 },
            { data: 'spinMove', header: 'SPM', width: 45 },
            { data: 'jukeMove', header: 'JKM', width: 45 },

            // Receiving
            { data: 'catching', header: 'CTH', width: 45 },
            { data: 'catchInTraffic', header: 'CIT', width: 45 },
            { data: 'specCatch', header: 'SPC', width: 45 },
            { data: 'shortRoute', header: 'SRR', width: 45 },
            { data: 'medRoute', header: 'MRR', width: 45 },
            { data: 'deepRoute', header: 'DRR', width: 45 },
            { data: 'release', header: 'RLS', width: 45 },

            // Blocking
            { data: 'passBlock', header: 'PBK', width: 45 },
            { data: 'runBlock', header: 'RBK', width: 45 },
            { data: 'leadBlock', header: 'LBK', width: 45 },
            { data: 'impactBlock', header: 'IBL', width: 45 },

            // Defense
            { data: 'tackling', header: 'TAK', width: 45 },
            { data: 'hitPower', header: 'POW', width: 45 },
            { data: 'powerMoves', header: 'PMV', width: 45 },
            { data: 'finesseMoves', header: 'FMV', width: 45 },
            { data: 'blockShedding', header: 'BSH', width: 45 },
            { data: 'pursuit', header: 'PUR', width: 45 },
            { data: 'playRec', header: 'PRC', width: 45 },
            { data: 'manCoverage', header: 'MCV', width: 45 },
            { data: 'zoneCoverage', header: 'ZCV', width: 45 },
            { data: 'press', header: 'PRS', width: 45 },

            // Special Teams
            { data: 'kickPower', header: 'KPW', width: 45 },
            { data: 'kickAccuracy', header: 'KAC', width: 45 },
            { data: 'kickReturn', header: 'KR', width: 45 },

            // HOF Indicator
            { data: 'isHOF', header: 'HOF', width: 50 }
        ];

        // Initialize Handsontable if needed
        if (!this.rosterCreatorGrid) {
            this.rosterCreatorGrid = new Handsontable(previewContainer, {
                data: gridData,
                colHeaders: columns.map(col => col.header),
                columns: columns.map(col => ({
                    data: col.data,
                    type: col.type || 'text',
                    width: col.width
                })),
                rowHeaders: true,
                height: 500,
                licenseKey: 'non-commercial-and-evaluation',
                manualColumnResize: true,
                filters: true,
                dropdownMenu: true,
                contextMenu: {
                    items: {
                        'delete_player': {
                            name: '🗑️ Delete Player',
                            callback: (key, selection) => {
                                const row = selection[0].start.row;
                                const data = this.rosterCreatorGrid.getSourceData();
                                const player = data[row];
                                const playerName = `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'this player';

                                if (confirm(`Are you sure you want to delete ${playerName}?`)) {
                                    // Remove the row
                                    this.rosterCreatorGrid.alter('remove_row', row, 1);
                                    this.rosterCreatorGrid.render();
                                    console.log('[Roster Creator] Player deleted, remaining:', this.rosterCreatorGrid.getSourceData().length);
                                }
                            }
                        },
                        'separator1': '---------',
                        'copy': { name: 'Copy' },
                        'cut': { name: 'Cut' },
                        'separator2': '---------',
                        'undo': { name: 'Undo' },
                        'redo': { name: 'Redo' }
                    }
                },
                selectionMode: 'multiple',
                stretchH: 'none', // Don't stretch columns, use defined widths
                renderAllRows: false, // Use virtual scrolling
                viewportRowRenderingOffset: 100, // Render extra rows to prevent misalignment
                fixedColumnsStart: 3, // Freeze first 3 columns (Last, First, Pos) to prevent alignment issues
                preventOverflow: false, // Allow natural scrolling to prevent snap-left issues
                // Highlight entire row on selection
                afterSelection: (row, column, row2, column2, preventScrolling, selectionLayerLevel) => {
                    if (!this.rosterCreatorGrid) return;

                    const container = this.rosterCreatorGrid.rootElement;
                    if (container) {
                        const previousHighlights = container.querySelectorAll('tr.row-selected');
                        previousHighlights.forEach(tr => tr.classList.remove('row-selected'));

                        for (let r = Math.min(row, row2); r <= Math.max(row, row2); r++) {
                            const clones = ['.ht_master', '.ht_clone_left', '.ht_clone_top', '.ht_clone_top_left_corner'];
                            clones.forEach(cloneClass => {
                                const clone = container.querySelector(cloneClass);
                                if (clone) {
                                    const rowElement = clone.querySelector(`tbody tr:nth-child(${r + 1})`);
                                    if (rowElement) {
                                        rowElement.classList.add('row-selected');
                                    }
                                }
                            });
                        }
                    }
                }
            });
        } else {
            this.rosterCreatorGrid.loadData(gridData);
        }
    }

    /**
     * Save generated draft class
     */
    async saveGeneratedDraftClass() {
        if (!this.generatedDraftPlayers || this.generatedDraftPlayers.length === 0) {
            this.showError('No draft class data to save');
            return;
        }

        try {
            // Open save dialog
            const result = await window.electronAPI.file.saveDialog('CAREERDRAFT-CUSTOM');

            if (result.canceled || !result.filePath) {
                console.log('Save canceled by user');
                return;
            }

            console.log('[Creator] Saving draft class to:', result.filePath);
            this.showError('Save functionality not yet implemented. Generated data is ready!');

            // TODO: Implement actual file writing
            // Will need to use template file and write binary data

        } catch (error) {
            console.error('[Creator] Error saving draft class:', error);
            this.showError(`Failed to save: ${error.message}`);
        }
    }

    /**
     * Load generated draft class into the Draft Class Editor tab
     */
    async loadGeneratedDraftIntoEditor() {
        if (!this.generatedDraftPlayers || this.generatedDraftPlayers.length === 0) {
            this.showError('No draft class data to load');
            return;
        }

        try {
            console.log('[Creator] Loading generated draft class into editor');

            // Get template file path from the file selector
            const templatePath = document.getElementById('draftTemplate')?.value;
            let templateData = null;

            console.log(`[Creator] Template file path from input: "${templatePath}"`);

            if (templatePath && templatePath.trim() !== '') {
                console.log('[Creator] Loading template file for buffer:', templatePath);

                // Load the template file to get _originalBuffer and _version
                const templateResult = await window.electronAPI.draftClass.load(templatePath);

                if (!templateResult.success) {
                    throw new Error(`Failed to load template file: ${templateResult.error}`);
                }

                templateData = templateResult.data;
                console.log(`[Creator] Template loaded: ${templateData._version}, buffer size: ${templateData._originalBuffer?.length || 0}`);
            } else {
                console.error('[Creator] ⚠️ NO TEMPLATE FILE SELECTED!');
                console.error('[Creator] You must select a template draft class file before generating.');
                console.error('[Creator] Use the "Select Draft Template" button in the generator tab.');

                // Show error to user
                this.showError('Please select a template draft class file before generating.\n\nUse the "Select Draft Template" button to choose an existing M26 draft class file as a template.');
                return;
            }

            // Backend now generates ALL 402 prospects (drafted + UFAs)
            // Copy visuals from template and update with generated player data
            console.log(`[Creator] Converting ${this.generatedDraftPlayers.length} generated players to draft format`);
            console.log(`[Creator] Template has ${templateData.prospects.length} prospect slots with visuals`);

            const prospects = this.generatedDraftPlayers.map((player, index) => {
                // Get template prospect's visuals (for M26Writer to update)
                const templateVisuals = templateData.prospects[index]?.visuals || null;

                // CRITICAL: Update template visuals' bodyType to match our generated bodyType
                if (templateVisuals && player.bodyType) {
                    templateVisuals.bodyType = player.bodyType;
                }

                return {
                // Basic Info
                firstName: player.firstName,
                lastName: player.lastName,
                position: player.positionCode, // Use numeric code for draft class
                archetype: player.archetype,   // CRITICAL: Include archetype ID (0=FieldGeneral, etc.)
                college: player.college || 'Unknown',
                jerseyNum: player.jerseyNum,
                age: player.age,
                yearsPro: 0,
                heightInches: player.heightInches,
                weight: player.weight,

                // Dev Trait
                devTrait: player.devTrait,

                // Ratings - map from GeneratedPlayer ratings to prospect format
                overall: player.ratings.overall,
                speed: player.ratings.speed,
                acceleration: player.ratings.acceleration,
                agility: player.ratings.agility,
                strength: player.ratings.strength,
                awareness: player.ratings.awareness,
                jumping: player.ratings.jumping || 70,
                stamina: player.ratings.stamina || 85,
                injury: player.ratings.injury || 90,

                // Core Physical (missing from before)
                changeOfDirection: player.ratings.changeOfDirection || 0,
                toughness: player.ratings.toughness || 0,

                // Position-specific attributes
                // QB throwing attributes need higher defaults (they affect OVR heavily)
                throwPower: player.ratings.throwPower || 75,
                throwAccuracyShort: player.ratings.throwAccuracyShort || 70,
                throwAccuracyMid: player.ratings.throwAccuracyMid || 68,
                throwAccuracyDeep: player.ratings.throwAccuracyDeep || 65,
                throwOnTheRun: player.ratings.throwOnTheRun || 65,
                throwUnderPressure: player.ratings.throwUnderPressure || 65,  // CRITICAL: Was 0, caused OVR to drop 10+ points
                playAction: player.ratings.playAction || 65,
                breakSack: player.ratings.breakSack || 60,  // CRITICAL: Was 0, caused OVR to drop significantly

                carrying: player.ratings.carrying || 0,
                ballCarrierVision: player.ratings.ballCarrierVision || 0,
                breakTackle: player.ratings.breakTackle || 0,
                trucking: player.ratings.trucking || 0,
                stiffArm: player.ratings.stiffArm || 0,
                spinMove: player.ratings.spinMove || 0,
                jukeMove: player.ratings.jukeMove || 0,

                catching: player.ratings.catching || 0,
                catchInTraffic: player.ratings.catchInTraffic || 0,
                spectacularCatch: player.ratings.spectacularCatch || 0,
                shortRouteRunning: player.ratings.shortRouteRunning || 0,
                mediumRouteRunning: player.ratings.mediumRouteRunning || 0,
                deepRouteRunning: player.ratings.deepRouteRunning || 0,
                release: player.ratings.release || 0,

                passBlock: player.ratings.passBlock || 0,
                passBlockPower: player.ratings.passBlockPower || 0,
                passBlockFinesse: player.ratings.passBlockFinesse || 0,
                runBlock: player.ratings.runBlock || 0,
                runBlockPower: player.ratings.runBlockPower || 0,
                runBlockFinesse: player.ratings.runBlockFinesse || 0,
                leadBlock: player.ratings.leadBlock || 0,
                impactBlocking: player.ratings.impactBlocking || 0,

                tackle: player.ratings.tackle || 0,
                hitPower: player.ratings.hitPower || 0,
                powerMoves: player.ratings.powerMoves || 0,
                finesseMoves: player.ratings.finesseMoves || 0,
                blockShedding: player.ratings.blockShedding || 0,
                pursuit: player.ratings.pursuit || 0,
                playRecognition: player.ratings.playRecognition || 0,
                manCoverage: player.ratings.manCoverage || 0,
                zoneCoverage: player.ratings.zoneCoverage || 0,
                pressCoverage: player.ratings.pressCoverage || 0,

                kickPower: player.ratings.kickPower || 0,
                kickAccuracy: player.ratings.kickAccuracy || 0,
                kickReturn: player.ratings.kickReturn || 0,
                longSnap: player.ratings.longSnap || 0,

                // Visuals - CRITICAL: Include template visuals so M26Writer can update them
                PID: player.PID || 0,
                PEPS: player.PEPS || null,
                bodyType: player.bodyType || 1,
                visuals: templateVisuals, // Copy template visuals structure

                // Draft info (optional, can be filled in editor)
                round: 0,
                pick: 0,
                draftTeam: 0,
                homeState: player.homeState || 0
                };
            });

            console.log(`[Creator] Converted ${prospects.length} total prospects (drafted + UFAs)`);

            // Set up draft class data structure
            // If we have template data, use its buffer and version for saving
            this.currentDraftClass = {
                prospects: prospects,
                header: templateData ? {
                    ...templateData.header,
                    prospectCount: prospects.length  // Update count to match generated prospects
                } : {
                    year: new Date().getFullYear() + 1, // Next year
                    prospectCount: prospects.length
                },
                // Include template's buffer and version if available (needed for M26 saves)
                _originalBuffer: templateData?._originalBuffer,
                _version: templateData?._version
            };

            this.currentDraftFilePath = templateData ?
                `${templatePath.split(/[/\\]/).pop()} (${prospects.length} generated prospects)` :
                `Generated Draft Class (${prospects.length} prospects)`;

            // Switch to draft tab
            this.switchTool('draft');

            // Update UI
            const displayName = templateData ?
                `${templatePath.split(/[/\\]/).pop()} (${prospects.length} generated prospects)` :
                `Generated Draft Class (${prospects.length} prospects)`;

            document.getElementById('draft-file-name').textContent = displayName;
            document.getElementById('draft-file-stats').textContent =
                `${prospects.length} prospects | Year: ${this.currentDraftClass.header.year}`;

            // Enable buttons
            document.getElementById('save-draft-btn').disabled = false;
            document.getElementById('export-draft-json-btn').disabled = false;
            document.getElementById('import-draft-csv-btn').disabled = false;
            document.getElementById('fillFromDbDraftBtn').disabled = false;

            // Pre-calculate round for ALL prospects immediately
            prospects.forEach((prospect, index) => {
                if (prospect.round === undefined || prospect.round === null) {
                    const draftPosition = prospect.draftPosition !== undefined ? prospect.draftPosition : index;
                    const pickNum = draftPosition + 1;
                    if (pickNum <= 224) {
                        prospect.round = Math.floor((pickNum - 1) / 32) + 1;
                    } else {
                        prospect.round = 8; // UFA
                    }
                }
            });
            console.log(`[Creator] Pre-calculated rounds for ${prospects.length} prospects`);

            // Create grid with generated data
            await this.createDraftGrid(prospects);

            console.log('[Creator] Successfully loaded generated draft class into editor');
            this.setStatus(`Loaded ${prospects.length} generated prospects into Draft Class Editor`);

        } catch (error) {
            console.error('[Creator] Error loading draft class into editor:', error);
            this.showError(`Failed to load into editor: ${error.message}`);
        }
    }

    /**
     * Save generated roster from editor (after loading into editor and potentially editing)
     */
    async saveGeneratedRosterFromEditor() {
        try {
            // Open save dialog
            const result = await window.electronAPI.file.saveDialog('ROSTER-CUSTOM');

            if (result.canceled || !result.filePath) {
                console.log('[app.js] Save canceled by user');
                return;
            }

            console.log('[app.js] Saving generated roster from editor to:', result.filePath);

            // Get template file path (stored when we loaded the generated roster)
            const templatePath = this.currentFile;

            if (!templatePath || templatePath.trim() === '') {
                this.showError('Template file path is missing. Cannot save generated roster.');
                return;
            }

            // Call backend to save roster
            console.log('[app.js] Calling rosterCreator.save with template:', templatePath);
            const saveResult = await window.electronAPI.rosterCreator.save(
                this.players, // Use current player data from editor
                templatePath,
                result.filePath
            );

            if (!saveResult.success) {
                throw new Error(saveResult.error || 'Failed to save roster');
            }

            console.log('[app.js] Generated roster saved successfully!');
            this.setStatus('Roster saved successfully');
            alert(`Roster saved successfully!\n\n✅ ${this.players.length} players saved to:\n${result.filePath}\n\nYou can now load this roster file in Madden 26.`);

        } catch (error) {
            console.error('[app.js] Error saving generated roster from editor:', error);
            this.showError(`Failed to save: ${error.message}`);
        }
    }

    /**
     * Save generated roster from Roster Wizard
     * Uses rosterCreator.save which creates NEW roster files from template
     */
    async saveGeneratedRosterFromRosterWizard() {
        try {
            console.log('[app.js] Saving roster from wizard...');

            // Open save dialog
            const result = await window.electronAPI.file.saveDialog('ROSTER-GENERATED');

            if (result.canceled || !result.filePath) {
                console.log('[app.js] Save canceled by user');
                return;
            }

            console.log('[app.js] Saving generated roster to:', result.filePath);
            console.log('[app.js] Using rosterCreator.save (creates new roster from template)');
            console.log('[app.js] Player count:', this.players.length);

            // The backend will resolve this relative to app.getAppPath()
            // Use a sentinel value that the backend will recognize
            const templatePath = 'ROSTER-Official';  // Backend will resolve to data/Templates/ROSTER-Official
            console.log('[app.js] Template: ROSTER-Official (backend will resolve path)');

            // Use rosterCreator.save which creates NEW roster files from scratch
            // This is the correct method for generated rosters (not parser.saveRosterFile which edits existing)
            const saveResult = await window.electronAPI.rosterCreator.save(
                this.players,
                templatePath,
                result.filePath
            );

            if (!saveResult.success) {
                throw new Error(saveResult.error || 'Failed to save roster');
            }

            console.log('[app.js] Generated roster saved successfully!');
            this.setStatus('Roster saved successfully');
            this.hasUnsavedChanges = false;
            alert(`Roster saved successfully!\n\n✅ ${this.players.length} players saved to:\n${result.filePath}\n\nYou can now load this roster file in Madden 26.`);

        } catch (error) {
            console.error('[app.js] Error saving generated roster from wizard:', error);
            this.showError(`Failed to save: ${error.message}`);
        }
    }

    /**
     * Save generated roster
     */
    async saveGeneratedRoster() {
        if (!this.generatedRosterPlayers || this.generatedRosterPlayers.length === 0) {
            this.showError('No roster data to save');
            return;
        }

        try {
            // Open save dialog
            const result = await window.electronAPI.file.saveDialog('ROSTER-CUSTOM');

            if (result.canceled || !result.filePath) {
                console.log('Save canceled by user');
                return;
            }

            console.log('[Creator] Saving roster to:', result.filePath);

            // Get template file path from the file selector
            const templatePath = document.getElementById('rosterTemplate')?.value;

            if (!templatePath || templatePath.trim() === '') {
                this.showError('Template file path is missing. Please select a template roster file first.');
                return;
            }

            // Call backend to save roster
            console.log('[Creator] Calling backend save with template:', templatePath);
            const saveResult = await window.electronAPI.rosterCreator.save(
                this.generatedRosterPlayers,
                templatePath,
                result.filePath
            );

            if (!saveResult.success) {
                throw new Error(saveResult.error || 'Failed to save roster');
            }

            console.log('[Creator] Roster saved successfully!');
            alert(`Roster saved successfully!\n\n✅ ${this.generatedRosterPlayers.length} players saved to:\n${result.filePath}\n\nYou can now load this roster file in Madden 26.`);

        } catch (error) {
            console.error('[Creator] Error saving roster:', error);
            this.showError(`Failed to save: ${error.message}`);
        }
    }

    /**
     * Load generated roster into the Roster Editor tab
     */
    async loadGeneratedRosterIntoEditor() {
        if (!this.generatedRosterPlayers || this.generatedRosterPlayers.length === 0) {
            this.showError('No roster data to load');
            return;
        }

        try {
            console.log('[Creator] Loading roster into editor...');
            console.log(`[Creator] ${this.generatedRosterPlayers.length} players ready`);

            // DEBUG: Find key players and show their team assignments
            const keyPlayers = ['Montana', 'Unitas', 'Brady', 'Rice', 'Payton'];
            console.log('[Creator] ===== KEY PLAYER SEARCH =====');
            keyPlayers.forEach(name => {
                const found = this.generatedRosterPlayers.filter(p =>
                    p.PLNA && p.PLNA.toLowerCase().includes(name.toLowerCase())
                );
                if (found.length > 0) {
                    found.forEach(p => {
                        console.log(`[Creator] FOUND: ${p.PFNA} ${p.PLNA} - Team ID: ${p.TGID}, OVR: ${p.POVR}, POS: ${p.PPOS}`);
                    });
                } else {
                    console.log(`[Creator] NOT FOUND: ${name}`);
                }
            });
            console.log('[Creator] ===========================');

            // Switch to roster editor tab
            this.switchTool('roster');

            // Store the generated players as the current roster data (DEEP COPY to avoid reference issues)
            this.players = JSON.parse(JSON.stringify(this.generatedRosterPlayers));

            // Set current file to template path (so save knows where to write)
            const templatePath = document.getElementById('rosterTemplate')?.value;
            if (templatePath && templatePath.trim() !== '') {
                this.currentFile = templatePath;
                console.log('[Creator] Set currentFile to template path:', this.currentFile);
            } else {
                console.warn('[Creator] No template path found - save may not work');
            }

            // Store empty original data (we don't have original roster data)
            this.originalData = {
                _version: 'M26',
                _originalBuffer: null,
                teams: []
            };

            // Render the roster in the editor grid (this method handles Handsontable setup)
            this.renderRoster();

            // Update UI - show all roster buttons
            const fileNameEl = document.getElementById('fileName');
            const currentFileEl = document.getElementById('currentFile');
            const exportBtn = document.getElementById('exportCsvBtn');
            const importBtn = document.getElementById('importCsvBtn');
            const fillDbBtn = document.getElementById('fillFromDbRosterBtn');
            const saveBtn = document.getElementById('saveRosterBtn');

            if (fileNameEl) fileNameEl.textContent = 'Generated Roster (unsaved)';
            if (currentFileEl) currentFileEl.style.display = 'flex';
            if (exportBtn) exportBtn.style.display = 'inline-flex';
            if (importBtn) importBtn.style.display = 'inline-flex';
            if (fillDbBtn) fillDbBtn.style.display = 'inline-flex';
            if (saveBtn) saveBtn.style.display = 'inline-flex';

            console.log('[loadGeneratedRoster] Buttons shown');

            const fileStatus = document.getElementById('fileStatus');
            if (fileStatus) {
                fileStatus.textContent = `Generated Roster (${this.players.length} players) - Ready to save`;
            }

            // Show success message
            alert(
                `Roster Loaded Successfully!\n\n` +
                `✅ ${this.players.length} players loaded into editor\n` +
                `✅ ${this.generatedRosterStats.hofPlayers} Hall of Famers\n` +
                `✅ Average OVR: ${this.generatedRosterStats.averageOVR}\n\n` +
                `You can now edit players in the Roster Editor tab.\n` +
                `Click "Save Roster" when ready to save.`
            );

            console.log('[Creator] Roster loaded into editor successfully');

        } catch (error) {
            console.error('[Creator] Error loading roster into editor:', error);
            this.showError(`Failed to load roster into editor: ${error.message}`);
        }
    }

    // ========================================
    // Player Card Methods
    // ========================================

    /**
     * Show player card for a specific row index (bridge method for AG-Grid)
     */
    showPlayerCard(rowIndex) {
        // Get player data from paginated/filtered players array
        const playerIndex = this.paginatedPlayerIndices ? this.paginatedPlayerIndices[rowIndex] : rowIndex;
        const playerData = this.filteredPlayers[playerIndex];

        if (!playerData) {
            console.error(`[showPlayerCard] No player found at row index ${rowIndex}`);
            return;
        }

        // Call the existing openPlayerCard method
        this.openPlayerCard(playerData, rowIndex);
    }

    openPlayerCard(playerData, rowIndex) {
        // Store current player data for saving
        this.currentPlayerCardData = playerData;
        this.currentPlayerCardRow = rowIndex;

        // Populate player card with data
        const position = getLookupValue('positions', playerData.PPOS) || 'FA';
        const team = getLookupValue('teams', playerData.TGID) || 'Free Agent';
        const college = getLookupValue('colleges', playerData.PCOL) || '--';

        // Apply team colors to player card
        const teamData = getTeamById(playerData.TGID);
        const root = document.documentElement;
        const modal = document.getElementById('playerCardModal');

        if (teamData && teamData.primary && teamData.secondary) {
            root.style.setProperty('--card-team-primary', teamData.primary);
            root.style.setProperty('--card-team-secondary', teamData.secondary);
            modal.classList.add('team-colored-card');
        } else {
            // Fallback to default orange colors
            root.style.setProperty('--card-team-primary', '#ff8c00');
            root.style.setProperty('--card-team-secondary', '#ff7700');
            modal.classList.add('team-colored-card');
        }

        // Header section - display only
        document.getElementById('playerCardNumber').textContent = playerData.PJEN || '0';
        document.getElementById('playerCardName').textContent = `${playerData.PFNA || ''} ${playerData.PLNA || 'Unknown'}`.trim();
        document.getElementById('playerCardPosition').textContent = position;
        document.getElementById('playerCardTeam').textContent = team;
        document.getElementById('playerCardOverall').textContent = playerData.POVR || '0';

        // Portrait section
        const pid = playerData.PSXP;
        const cacheKey = pid ? `pid_${parseInt(pid)}` : null;
        const portraitImg = document.getElementById('playerCardPortrait');

        if (cacheKey && this.portraitCache.has(cacheKey)) {
            const imageData = this.portraitCache.get(cacheKey);
            if (imageData && imageData !== 'loading') {
                portraitImg.src = imageData;
                portraitImg.style.display = 'block';
            } else {
                portraitImg.style.display = 'none';
            }
        } else {
            portraitImg.style.display = 'none';
        }

        // Populate PID dropdown for portrait selection
        const pidSelect = document.getElementById('playerCardPIDSelect');
        pidSelect.innerHTML = '<option value="">Select Portrait...</option>';

        if (window.lookupData && window.lookupData.pidsCapitalized) {
            const sortedPIDs = Array.from(window.lookupData.pidsCapitalized.entries())
                .sort((a, b) => a[1].localeCompare(b[1]));

            sortedPIDs.forEach(([pidValue, playerName]) => {
                const option = document.createElement('option');
                option.value = pidValue;
                option.textContent = playerName;
                if (parseInt(pidValue) === parseInt(pid)) {
                    option.selected = true;
                }
                pidSelect.appendChild(option);
            });
        }

        // Player info section - editable inputs
        document.getElementById('playerCardAge').value = playerData.PAGE || '';
        document.getElementById('playerCardYearsPro').value = playerData.PYRP !== undefined ? playerData.PYRP : '';
        document.getElementById('playerCardHeight').value = playerData.PHGT || '';
        document.getElementById('playerCardWeight').value = playerData.PWGT ? playerData.PWGT + 160 : '';

        // Populate college dropdown
        const collegeSelect = document.getElementById('playerCardCollege');
        collegeSelect.innerHTML = '';

        // Get colleges from LOOKUP_DATA (imported from field-definitions.js)
        if (LOOKUP_DATA && LOOKUP_DATA.colleges && LOOKUP_DATA.colleges.size > 0) {
            const sortedColleges = Array.from(LOOKUP_DATA.colleges.entries())
                .sort((a, b) => a[1].localeCompare(b[1]));

            sortedColleges.forEach(([collegeId, collegeName]) => {
                const option = document.createElement('option');
                option.value = collegeId;
                option.textContent = collegeName;
                if (parseInt(collegeId) === parseInt(playerData.PCOL)) {
                    option.selected = true;
                }
                collegeSelect.appendChild(option);
            });
        } else {
            // Fallback if LOOKUP_DATA not loaded yet
            const option = document.createElement('option');
            option.value = playerData.PCOL || '';
            option.textContent = college;
            option.selected = true;
            collegeSelect.appendChild(option);
        }

        document.getElementById('playerCardJersey').value = playerData.PJEN || '';

        // Contract section - editable
        document.getElementById('playerCardContractYears').value = playerData.PCON || 0;
        document.getElementById('playerCardYearsLeft').value = playerData.PCYL || 0;
        document.getElementById('playerCardBonus').value = playerData.PSBO ? (playerData.PSBO / 100).toFixed(1) : 0;

        // Yearly salaries (stored in hundredths, displayed in millions)
        for (let i = 0; i <= 6; i++) {
            const salaryField = `PSA${i}`;
            const salaryInput = document.getElementById(`playerCardSalary${i}`);
            if (salaryInput) {
                salaryInput.value = playerData[salaryField] ? (playerData[salaryField] / 100).toFixed(1) : 0;
            }
        }

        // Calculate and display total salary
        this.updateContractTotalDisplay(playerData);

        // Add event listeners for salary inputs to update total on change
        this.setupContractSalaryListeners();

        // Ratings section - populate based on position
        this.populatePlayerRatings(playerData, position);

        // Setup scroll wheel editing for player card
        this.setupPlayerCardScrollWheelEditing();

        // Show modal
        document.getElementById('playerCardModal').style.display = 'flex';
    }

    closePlayerCard() {
        const modal = document.getElementById('playerCardModal');
        modal.style.display = 'none';
        modal.classList.remove('team-colored-card');

        // Clean up scroll wheel listener
        if (this._playerCardScrollWheelHandler) {
            modal.removeEventListener('wheel', this._playerCardScrollWheelHandler);
        }
    }

    savePlayerCard() {
        if (!this.currentPlayerCardData || this.currentPlayerCardRow === undefined) {
            console.error('[Player Card] No player data to save');
            return;
        }

        // Get updated values from inputs
        // CRITICAL: Never allow age=0, height=0, or jersey=0 - these cause game issues
        const ageInput = parseInt(document.getElementById('playerCardAge').value);
        const age = isNaN(ageInput) || ageInput < 21 ? (this.currentPlayerCardData.PAGE || 25) : Math.min(45, ageInput);
        const yearsPro = parseInt(document.getElementById('playerCardYearsPro').value) || 0;
        const heightInput = parseInt(document.getElementById('playerCardHeight').value);
        const height = isNaN(heightInput) || heightInput < 60 ? (this.currentPlayerCardData.PHGT || 72) : heightInput;
        const weight = parseInt(document.getElementById('playerCardWeight').value) || 160;
        const college = parseInt(document.getElementById('playerCardCollege').value) || 0;
        const jerseyInput = parseInt(document.getElementById('playerCardJersey').value);
        const jersey = isNaN(jerseyInput) || jerseyInput < 1 ? (this.currentPlayerCardData.PJEN || 1) : jerseyInput;
        const pid = parseInt(document.getElementById('playerCardPIDSelect').value) || this.currentPlayerCardData.PSXP;

        // Update player data
        this.currentPlayerCardData.PAGE = age;
        this.currentPlayerCardData.PYRP = yearsPro;
        this.currentPlayerCardData.PHGT = height;
        this.currentPlayerCardData.PWGT = weight - 160; // Weight is stored as offset from 160
        this.currentPlayerCardData.PCOL = college;
        this.currentPlayerCardData.PJEN = jersey;
        this.currentPlayerCardData.PSXP = pid;

        // Update contract data (values stored in hundredths, inputs in millions)
        const contractYears = parseInt(document.getElementById('playerCardContractYears').value) || 0;
        const yearsLeft = parseInt(document.getElementById('playerCardYearsLeft').value) || 0;
        const bonus = parseFloat(document.getElementById('playerCardBonus').value) || 0;

        this.currentPlayerCardData.PCON = contractYears;
        this.currentPlayerCardData.PCYL = yearsLeft;
        this.currentPlayerCardData.PSBO = Math.round(bonus * 100); // Convert from millions to hundredths

        // Update yearly salaries
        for (let i = 0; i <= 6; i++) {
            const salaryInput = document.getElementById(`playerCardSalary${i}`);
            if (salaryInput) {
                const salaryValue = parseFloat(salaryInput.value) || 0;
                this.currentPlayerCardData[`PSA${i}`] = Math.round(salaryValue * 100); // Convert from millions to hundredths
            }
        }

        // Update ratings from editable inputs
        if (this.currentPlayerCardRatings) {
            Object.keys(this.originalPlayerCardRatings).forEach(fieldCode => {
                const input = document.getElementById(`playerCardRating_${fieldCode}`);
                if (input) {
                    this.currentPlayerCardData[fieldCode] = parseInt(input.value) || 0;
                }
            });
        }

        // Get the OVR that's currently displayed in the player card header
        // This is the delta-based calculated OVR that the user has been seeing
        const ovrDisplay = document.getElementById('playerCardOverall');
        const displayedOVR = ovrDisplay ? parseInt(ovrDisplay.textContent) || this.currentPlayerCardData.POVR : this.currentPlayerCardData.POVR;
        const oldOVR = this.originalPlayerCardPOVR || this.currentPlayerCardData.POVR;

        if (displayedOVR !== oldOVR) {
            this.currentPlayerCardData.POVR = displayedOVR;
            console.log(`[Player Card] Updated OVR: ${oldOVR} → ${displayedOVR}`);
        }

        // Find the player in the filteredPlayers and players arrays and update
        // The currentPlayerCardRow might be the paginated index, we need to find the actual player
        const playerIndex = this.paginatedPlayerIndices ? this.paginatedPlayerIndices[this.currentPlayerCardRow] : this.currentPlayerCardRow;

        // Update in filteredPlayers
        if (this.filteredPlayers && this.filteredPlayers[playerIndex]) {
            this.filteredPlayers[playerIndex] = this.currentPlayerCardData;
        }

        // Also find and update in the main players array
        const mainPlayerIndex = this.players.findIndex(p =>
            p.PFNA === this.currentPlayerCardData.PFNA &&
            p.PLNA === this.currentPlayerCardData.PLNA &&
            p.Year === this.currentPlayerCardData.Year
        );
        if (mainPlayerIndex !== -1) {
            this.players[mainPlayerIndex] = this.currentPlayerCardData;
        }

        // Update AG-Grid if it's being used
        if (window.agGridApi) {
            // Get the row node and update its data
            const rowNode = window.agGridApi.getRowNode(String(playerIndex));
            if (rowNode) {
                rowNode.setData(this.currentPlayerCardData);
                console.log('[Player Card] Updated AG-Grid row:', playerIndex);
            } else {
                // Force a full refresh if we can't find the row node
                window.agGridApi.refreshCells();
                console.log('[Player Card] Refreshed AG-Grid cells');
            }
        }

        // Also re-render Handsontable if it exists
        if (this.hotTable && !this.hotTable.isDestroyed) {
            this.hotTable.render();
            console.log('[Player Card] Saved changes for Handsontable row:', this.currentPlayerCardRow);
        }

        // Close the modal
        this.closePlayerCard();
    }

    updatePlayerCardPortrait(newPid) {
        if (!newPid) {
            return;
        }

        const pid = parseInt(newPid);
        const cacheKey = `pid_${pid}`;
        const portraitImg = document.getElementById('playerCardPortrait');

        if (this.portraitCache.has(cacheKey)) {
            const imageData = this.portraitCache.get(cacheKey);
            if (imageData && imageData !== 'loading') {
                portraitImg.src = imageData;
                portraitImg.style.display = 'block';
            } else {
                portraitImg.style.display = 'none';
            }
        } else {
            // Portrait not in cache, fetch it by PID
            portraitImg.style.display = 'none';
            this.portraitCache.set(cacheKey, 'loading');

            window.electronAPI.portrait.getByPID(pid).then(imageData => {
                this.portraitCache.set(cacheKey, imageData);
                // Update portrait if still on same player
                const currentPid = document.getElementById('playerCardPIDSelect').value;
                if (parseInt(currentPid) === pid) {
                    portraitImg.src = imageData;
                    portraitImg.style.display = 'block';
                }
            }).catch((error) => {
                console.error(`[Player Card] Failed to fetch portrait for PID ${pid}:`, error);
                this.portraitCache.set(cacheKey, null);
            });
        }
    }

    formatHeight(heightInches) {
        if (!heightInches) return '--';
        const feet = Math.floor(heightInches / 12);
        const inches = heightInches % 12;
        return `${feet}'${inches}"`;
    }

    calculateTotalSalary(playerData) {
        const salaryFields = ['PSA0', 'PSA1', 'PSA2', 'PSA3', 'PSA4', 'PSA5', 'PSA6'];
        let total = 0;
        for (const field of salaryFields) {
            if (playerData[field]) {
                total += playerData[field];
            }
        }
        return total > 0 ? (total / 100).toFixed(1) : '--';
    }

    updateContractTotalDisplay() {
        // Calculate total from the input fields
        let total = 0;
        for (let i = 0; i <= 6; i++) {
            const salaryInput = document.getElementById(`playerCardSalary${i}`);
            if (salaryInput) {
                total += parseFloat(salaryInput.value) || 0;
            }
        }
        // Add signing bonus to total
        const bonusInput = document.getElementById('playerCardBonus');
        if (bonusInput) {
            total += parseFloat(bonusInput.value) || 0;
        }
        const totalDisplay = document.getElementById('playerCardTotalSalary');
        if (totalDisplay) {
            totalDisplay.textContent = total > 0 ? `$${total.toFixed(1)}M` : '--';
        }
    }

    setupContractSalaryListeners() {
        // Remove any existing listeners first
        for (let i = 0; i <= 6; i++) {
            const salaryInput = document.getElementById(`playerCardSalary${i}`);
            if (salaryInput) {
                salaryInput.removeEventListener('input', this._contractInputHandler);
            }
        }
        const bonusInput = document.getElementById('playerCardBonus');
        if (bonusInput) {
            bonusInput.removeEventListener('input', this._contractInputHandler);
        }

        // Create bound handler
        this._contractInputHandler = () => this.updateContractTotalDisplay();

        // Add listeners to salary inputs
        for (let i = 0; i <= 6; i++) {
            const salaryInput = document.getElementById(`playerCardSalary${i}`);
            if (salaryInput) {
                salaryInput.addEventListener('input', this._contractInputHandler);
            }
        }
        // Add listener to bonus input
        if (bonusInput) {
            bonusInput.addEventListener('input', this._contractInputHandler);
        }
    }

    getRatingClass(value) {
        if (value >= 90) return 'elite';
        if (value >= 80) return 'great';
        if (value >= 70) return 'good';
        if (value >= 60) return 'average';
        return 'poor';
    }

    populatePlayerRatings(playerData, position) {
        const ratingsContainer = document.getElementById('playerCardRatings');
        ratingsContainer.innerHTML = '';

        // Store original ratings for delta-based OVR calculation
        // This preserves the stored OVR and only adjusts based on changes
        this.originalPlayerCardRatings = {};

        // Define position-specific key ratings (matches OVR formula attributes)
        // These are the attributes that directly affect OVR calculation for each position
        const positionRatings = {
            // QB OVR: PAWR*0.16 + PTHP*0.16 + PTAS*0.12 + PTAM*0.12 + PTAD*0.10 + PTOR*0.04 + PSPD*0.03 + PCAR*0.02 + PAGI*0.02 + PSTR*0.02 + PINJ*0.01 + PSTA*0.01
            // Added PTUP (Throw Under Pressure) and PBSK (Break Sack) which are key QB stats
            'QB': ['PAWR', 'PTHP', 'PTAS', 'PTAM', 'PTAD', 'PTOR', 'PTUP', 'PBSK', 'PSPD', 'PCAR', 'PAGI', 'PSTR'],
            // HB OVR: PSPD*0.20 + PACC*0.10 + PAGI*0.08 + PCAR*0.10 + PBCV*0.08 + PBKT*0.08 + PSTR*0.06 + PELU*0.06 + PCTH*0.04 + PAWR*0.08 + PSTA*0.04 + PINJ*0.03 + PJMP*0.03 + PTGH*0.02
            'HB': ['PSPD', 'PACC', 'PAGI', 'PCAR', 'PBCV', 'PBKT', 'PSTR', 'PELU', 'PCTH', 'PAWR'],
            'FB': ['PSPD', 'PACC', 'PAGI', 'PCAR', 'PBCV', 'PBKT', 'PSTR', 'PELU', 'PCTH', 'PAWR'],
            // WR OVR: PSPD*0.18 + PCTH*0.12 + PLCI*0.10 + PAWR*0.10 + PACC*0.08 + PAGI*0.08 + SRRN*0.06 + PDRR*0.06 + PMRR*0.06 + PLSC*0.04 + PJMP*0.04 + PSTR*0.03 + PLRL*0.03 + PSTA*0.02
            'WR': ['PSPD', 'PCTH', 'PLCI', 'PAWR', 'PACC', 'PAGI', 'SRRN', 'PDRR', 'PMRR', 'PLSC'],
            // TE OVR: PSPD*0.08 + PCTH*0.10 + PLCI*0.08 + PAWR*0.08 + PACC*0.06 + PAGI*0.06 + PRBK*0.10 + PPBK*0.10 + PSTR*0.08 + SRRN*0.05 + PMRR*0.05 + PDRR*0.05 + PJMP*0.04 + PLRL*0.03 + PSTA*0.02 + PINJ*0.02
            'TE': ['PCTH', 'PRBK', 'PPBK', 'PSTR', 'PAWR', 'PLCI', 'PSPD', 'PACC', 'PAGI', 'SRRN'],
            // OL OVR: PSTR*0.20 + PRBK*0.20 + PPBK*0.20 + PAWR*0.15 + PAGI*0.10 + PACC*0.05 + PSTA*0.05 + PINJ*0.05
            'LT': ['PSTR', 'PRBK', 'PPBK', 'PAWR', 'PAGI', 'PACC'],
            'LG': ['PSTR', 'PRBK', 'PPBK', 'PAWR', 'PAGI', 'PACC'],
            'C': ['PSTR', 'PRBK', 'PPBK', 'PAWR', 'PAGI', 'PACC'],
            'RG': ['PSTR', 'PRBK', 'PPBK', 'PAWR', 'PAGI', 'PACC'],
            'RT': ['PSTR', 'PRBK', 'PPBK', 'PAWR', 'PAGI', 'PACC'],
            // DL OVR: PSTR*0.15 + PTAK*0.12 + PBSG*0.12 + PAWR*0.10 + PLPR*0.10 + PFMS*0.08 + PLPM*0.08 + PSPD*0.06 + PACC*0.05 + PAGI*0.05 + PLPU*0.04 + PSTA*0.03 + PINJ*0.02
            'LEDG': ['PSTR', 'PTAK', 'PBSG', 'PAWR', 'PLPR', 'PFMS', 'PLPM', 'PSPD', 'PACC', 'PAGI'],
            'REDG': ['PSTR', 'PTAK', 'PBSG', 'PAWR', 'PLPR', 'PFMS', 'PLPM', 'PSPD', 'PACC', 'PAGI'],
            'DT': ['PSTR', 'PTAK', 'PBSG', 'PAWR', 'PLPR', 'PFMS', 'PLPM', 'PSPD', 'PACC', 'PAGI'],
            // LB OVR: PTAK*0.15 + PLPR*0.12 + PAWR*0.10 + PLPU*0.10 + PBSG*0.08 + PLHT*0.08 + PSPD*0.07 + PACC*0.06 + PAGI*0.06 + PLZC*0.05 + PLMC*0.05 + PSTR*0.04 + PSTA*0.02 + PINJ*0.02
            'SAM': ['PTAK', 'PLPR', 'PAWR', 'PLPU', 'PBSG', 'PLHT', 'PSPD', 'PACC', 'PAGI', 'PLZC'],
            'MIKE': ['PTAK', 'PLPR', 'PAWR', 'PLPU', 'PBSG', 'PLHT', 'PSPD', 'PACC', 'PAGI', 'PLZC'],
            'WILL': ['PTAK', 'PLPR', 'PAWR', 'PLPU', 'PBSG', 'PLHT', 'PSPD', 'PACC', 'PAGI', 'PLZC'],
            // CB OVR: PSPD*0.15 + PLMC*0.12 + PLZC*0.12 + PAWR*0.10 + PLPR*0.10 + PACC*0.08 + PAGI*0.08 + PLPE*0.06 + PCTH*0.05 + PLPU*0.05 + PTAK*0.04 + PSTA*0.03 + PINJ*0.02
            'CB': ['PSPD', 'PLMC', 'PLZC', 'PAWR', 'PLPR', 'PACC', 'PAGI', 'PLPE', 'PCTH', 'PLPU'],
            // Safety OVR: PLZC*0.14 + PAWR*0.12 + PLPR*0.10 + PLPU*0.10 + PTAK*0.09 + PSPD*0.08 + PLHT*0.07 + PACC*0.06 + PAGI*0.06 + PLMC*0.06 + PSTR*0.04 + PSTA*0.04 + PINJ*0.04
            'FS': ['PLZC', 'PAWR', 'PLPR', 'PLPU', 'PTAK', 'PSPD', 'PLHT', 'PACC', 'PAGI', 'PLMC'],
            'SS': ['PLZC', 'PAWR', 'PLPR', 'PLPU', 'PTAK', 'PSPD', 'PLHT', 'PACC', 'PAGI', 'PLMC'],
            // K/P OVR: PKAC*0.50 + PKPR*0.30 + PAWR*0.15 + PINJ*0.05
            'K': ['PKAC', 'PKPR', 'PAWR'],
            'P': ['PKAC', 'PKPR', 'PAWR'],
            'LS': ['PSTR', 'PAWR']
        };

        // Get ratings for this position, default to common ratings
        const ratings = positionRatings[position] || ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PAWR', 'PCTH', 'PTAK'];

        // Store the current ratings list for saving later
        this.currentPlayerCardRatings = ratings;

        // Store original POVR for delta-based calculation
        this.originalPlayerCardPOVR = playerData.POVR || 50;

        // Create rating items with editable inputs
        ratings.forEach(fieldCode => {
            const fieldDef = getFieldDefinition(fieldCode);
            const value = playerData[fieldCode] || 0;
            const ratingClass = this.getRatingClass(value);

            // Store original value for delta calculation
            this.originalPlayerCardRatings[fieldCode] = value;

            const ratingItem = document.createElement('div');
            ratingItem.className = 'rating-item';

            // Create label
            const label = document.createElement('div');
            label.className = 'rating-label';
            label.textContent = fieldDef.shortDisplay || fieldDef.display;

            // Create editable input
            const input = document.createElement('input');
            input.type = 'number';
            input.className = `rating-value ${ratingClass}`;
            input.id = `playerCardRating_${fieldCode}`;
            input.value = value;
            input.min = 0;
            input.max = 99;
            input.dataset.fieldCode = fieldCode;

            // Update color class and OVR on input change
            input.addEventListener('input', (e) => {
                const newValue = parseInt(e.target.value) || 0;
                const newClass = this.getRatingClass(newValue);
                e.target.className = `rating-value ${newClass}`;

                // Update OVR in real-time using delta-based calculation
                this.updatePlayerCardOVR();
            });

            ratingItem.appendChild(label);
            ratingItem.appendChild(input);
            ratingsContainer.appendChild(ratingItem);
        });
    }

    updatePlayerCardOVR() {
        if (!this.currentPlayerCardData || !this.currentPlayerCardRatings) {
            console.log('[updatePlayerCardOVR] No data or ratings, returning');
            return;
        }

        // Delta-based OVR calculation:
        // 1. Start with the original stored OVR from the CSV
        // 2. Calculate the weighted delta based on attribute changes
        // 3. Add delta to original OVR
        // This preserves the stored OVR and only adjusts based on user changes

        // Position-specific attribute weights for delta calculation
        // These should match the OVR formula weights
        const positionWeights = {
            'QB': { PAWR: 0.16, PTHP: 0.16, PTAS: 0.12, PTAM: 0.12, PTAD: 0.10, PTOR: 0.04, PTUP: 0.04, PBSK: 0.03, PSPD: 0.03, PCAR: 0.02, PAGI: 0.02, PSTR: 0.02 },
            'HB': { PSPD: 0.20, PACC: 0.10, PAGI: 0.08, PCAR: 0.10, PBCV: 0.08, PBKT: 0.08, PSTR: 0.06, PELU: 0.06, PCTH: 0.04, PAWR: 0.08 },
            'FB': { PSPD: 0.20, PACC: 0.10, PAGI: 0.08, PCAR: 0.10, PBCV: 0.08, PBKT: 0.08, PSTR: 0.06, PELU: 0.06, PCTH: 0.04, PAWR: 0.08 },
            'WR': { PSPD: 0.18, PCTH: 0.12, PLCI: 0.10, PAWR: 0.10, PACC: 0.08, PAGI: 0.08, SRRN: 0.06, PDRR: 0.06, PMRR: 0.06, PLSC: 0.04 },
            'TE': { PCTH: 0.10, PRBK: 0.10, PPBK: 0.10, PSTR: 0.08, PAWR: 0.08, PLCI: 0.08, PSPD: 0.08, PACC: 0.06, PAGI: 0.06, SRRN: 0.05 },
            'LT': { PSTR: 0.20, PRBK: 0.20, PPBK: 0.20, PAWR: 0.15, PAGI: 0.10, PACC: 0.05 },
            'LG': { PSTR: 0.20, PRBK: 0.20, PPBK: 0.20, PAWR: 0.15, PAGI: 0.10, PACC: 0.05 },
            'C': { PSTR: 0.20, PRBK: 0.20, PPBK: 0.20, PAWR: 0.15, PAGI: 0.10, PACC: 0.05 },
            'RG': { PSTR: 0.20, PRBK: 0.20, PPBK: 0.20, PAWR: 0.15, PAGI: 0.10, PACC: 0.05 },
            'RT': { PSTR: 0.20, PRBK: 0.20, PPBK: 0.20, PAWR: 0.15, PAGI: 0.10, PACC: 0.05 },
            'LEDG': { PSTR: 0.15, PTAK: 0.12, PBSG: 0.12, PAWR: 0.10, PLPR: 0.10, PFMS: 0.08, PLPM: 0.08, PSPD: 0.06, PACC: 0.05, PAGI: 0.05 },
            'REDG': { PSTR: 0.15, PTAK: 0.12, PBSG: 0.12, PAWR: 0.10, PLPR: 0.10, PFMS: 0.08, PLPM: 0.08, PSPD: 0.06, PACC: 0.05, PAGI: 0.05 },
            'DT': { PSTR: 0.15, PTAK: 0.12, PBSG: 0.12, PAWR: 0.10, PLPR: 0.10, PFMS: 0.08, PLPM: 0.08, PSPD: 0.06, PACC: 0.05, PAGI: 0.05 },
            'SAM': { PTAK: 0.15, PLPR: 0.12, PAWR: 0.10, PLPU: 0.10, PBSG: 0.08, PLHT: 0.08, PSPD: 0.07, PACC: 0.06, PAGI: 0.06, PLZC: 0.05 },
            'MIKE': { PTAK: 0.15, PLPR: 0.12, PAWR: 0.10, PLPU: 0.10, PBSG: 0.08, PLHT: 0.08, PSPD: 0.07, PACC: 0.06, PAGI: 0.06, PLZC: 0.05 },
            'WILL': { PTAK: 0.15, PLPR: 0.12, PAWR: 0.10, PLPU: 0.10, PBSG: 0.08, PLHT: 0.08, PSPD: 0.07, PACC: 0.06, PAGI: 0.06, PLZC: 0.05 },
            'CB': { PSPD: 0.15, PLMC: 0.12, PLZC: 0.12, PAWR: 0.10, PLPR: 0.10, PACC: 0.08, PAGI: 0.08, PLPE: 0.06, PCTH: 0.05, PLPU: 0.05 },
            'FS': { PLZC: 0.14, PAWR: 0.12, PLPR: 0.10, PLPU: 0.10, PTAK: 0.09, PSPD: 0.08, PLHT: 0.07, PACC: 0.06, PAGI: 0.06, PLMC: 0.06 },
            'SS': { PLZC: 0.14, PAWR: 0.12, PLPR: 0.10, PLPU: 0.10, PTAK: 0.09, PSPD: 0.08, PLHT: 0.07, PACC: 0.06, PAGI: 0.06, PLMC: 0.06 },
            'K': { PKAC: 0.50, PKPR: 0.30, PAWR: 0.15 },
            'P': { PKAC: 0.50, PKPR: 0.30, PAWR: 0.15 }
        };

        // Get position from player data
        const position = this.currentPlayerCardData.Position ||
            (this.currentPlayerCardData.PPOS !== undefined ? this.getPositionName(this.currentPlayerCardData.PPOS) : null);

        if (!position) {
            console.log('[updatePlayerCardOVR] No position found');
            return;
        }

        const weights = positionWeights[position] || {};

        // Calculate weighted delta from attribute changes
        let ovrDelta = 0;
        const changes = [];

        Object.keys(this.originalPlayerCardRatings).forEach(fieldCode => {
            const input = document.getElementById(`playerCardRating_${fieldCode}`);
            if (input) {
                const originalValue = this.originalPlayerCardRatings[fieldCode] || 0;
                const currentValue = parseInt(input.value) || 0;
                const attrDelta = currentValue - originalValue;

                if (attrDelta !== 0) {
                    const weight = weights[fieldCode] || 0.05; // Default weight if not in formula
                    const weightedDelta = attrDelta * weight;
                    ovrDelta += weightedDelta;
                    changes.push(`${fieldCode}: ${originalValue} -> ${currentValue} (delta: ${attrDelta}, weight: ${weight}, contribution: ${weightedDelta.toFixed(2)})`);
                }
            }
        });

        // Calculate new OVR: original + delta
        const originalOVR = this.originalPlayerCardPOVR || 50;
        const newOVR = Math.max(0, Math.min(99, Math.round(originalOVR + ovrDelta)));

        console.log('[updatePlayerCardOVR] Position:', position);
        console.log('[updatePlayerCardOVR] Original OVR:', originalOVR);
        console.log('[updatePlayerCardOVR] Changes:', changes.length > 0 ? changes.join(', ') : 'None');
        console.log('[updatePlayerCardOVR] Total delta:', ovrDelta.toFixed(2));
        console.log('[updatePlayerCardOVR] New OVR:', newOVR);

        // Update OVR display in the header
        const ovrDisplay = document.getElementById('playerCardOverall');
        if (ovrDisplay) {
            ovrDisplay.textContent = newOVR;
        }

        // Also update the cached player data so it's saved correctly
        this.currentPlayerCardData.POVR = newOVR;
    }

    getPositionName(ppos) {
        const positionMap = {
            0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
            8: 'RG', 9: 'RT', 10: 'LEDG', 11: 'REDG', 12: 'DT', 13: 'SAM', 14: 'MIKE',
            15: 'WILL', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
        };
        return positionMap[ppos] || null;
    }
}

// Global function for modal close button
window.closeErrorModal = function() {
    if (window.app) {
        window.app.closeErrorModal();
    } else {
        // Fallback if app not initialized yet
        const modal = document.getElementById('errorModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MaddenEditorApp();

    // Initialize Draft Wizard V2
    if (window.draftWizard && typeof window.draftWizard.init === 'function') {
        console.log('[App] Initializing Draft Wizard V2...');
        window.draftWizard.init();
    }

    // ========================================
    // Player Card Modal Event Listeners
    // ========================================

    // Close button
    const playerCardCloseBtn = document.querySelector('.player-card-close');
    if (playerCardCloseBtn) {
        playerCardCloseBtn.addEventListener('click', () => {
            if (window.app) {
                window.app.closePlayerCard();
            }
        });
    }

    // Click outside modal to close
    const playerCardModal = document.getElementById('playerCardModal');
    if (playerCardModal) {
        playerCardModal.addEventListener('click', (e) => {
            if (e.target === playerCardModal && window.app) {
                window.app.closePlayerCard();
            }
        });
    }

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.app) {
            const modal = document.getElementById('playerCardModal');
            if (modal && modal.style.display === 'flex') {
                window.app.closePlayerCard();
            }
        }
    });

    // Save button
    const savePlayerCardBtn = document.getElementById('savePlayerCardBtn');
    if (savePlayerCardBtn) {
        savePlayerCardBtn.addEventListener('click', () => {
            if (window.app) {
                window.app.savePlayerCard();
            }
        });
    }

    // PID dropdown change - update portrait
    const pidSelect = document.getElementById('playerCardPIDSelect');
    if (pidSelect) {
        pidSelect.addEventListener('change', (e) => {
            if (window.app) {
                window.app.updatePlayerCardPortrait(e.target.value);
            }
        });
    }

    // Right-click context menu on player card portrait for generic face picker
    const playerCardPortrait = document.getElementById('playerCardPortrait');
    if (playerCardPortrait) {
        playerCardPortrait.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (window.app && window.app.currentPlayerCardData) {
                const player = window.app.currentPlayerCardData;
                const rowIndex = window.app.currentPlayerCardRow;
                window.app.openGenericFacePicker(player, rowIndex);
            }
        });
    }

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

    // ========================================
    // Bug Report Button
    // ========================================
    const reportBugBtn = document.getElementById('reportBugBtn');
    if (reportBugBtn) {
        reportBugBtn.addEventListener('click', () => {
            console.log('[Bug Report] Opening GitHub Issues page');
            window.electronAPI.shell.openExternal('https://github.com/tshanks1027/Madden-Editor-Suite/issues/new/choose');
        });
    }
});

// Export for ES6 module use
export default MaddenEditorApp;