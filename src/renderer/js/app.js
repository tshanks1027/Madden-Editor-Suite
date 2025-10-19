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

        // Back to all teams button
        document.getElementById('backToAllTeams').addEventListener('click', () => {
            this.exitTeamView();
        });

        document.getElementById('saveRosterBtn').addEventListener('click', () => {
            this.saveRoster();
        });

        // Draft class controls
        document.getElementById('open-draft-btn').addEventListener('click', async () => {
            await this.openDraftClassDialog();
        });

        document.getElementById('save-draft-btn').addEventListener('click', () => {
            this.saveDraftClass();
        });

        document.getElementById('export-draft-json-btn').addEventListener('click', () => {
            this.exportDraftJSON();
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
        if (selectDraftTemplateBtn) {
            selectDraftTemplateBtn.addEventListener('click', async () => {
                const result = await window.electronAPI.file.openDialog(null);
                if (result.success && result.filePath && !result.canceled) {
                    document.getElementById('draftTemplate').value = result.filePath;
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

        // Draft Class Creator event listeners
        const generateDraftBtn = document.getElementById('generateDraftBtn');
        if (generateDraftBtn) {
            generateDraftBtn.addEventListener('click', async () => {
                await this.generateDraftClass();
            });
        }

        const saveGeneratedDraftBtn = document.getElementById('saveGeneratedDraft');
        if (saveGeneratedDraftBtn) {
            saveGeneratedDraftBtn.addEventListener('click', async () => {
                await this.saveGeneratedDraftClass();
            });
        }

        const loadIntoDraftEditorBtn = document.getElementById('loadIntoDraftEditor');
        if (loadIntoDraftEditorBtn) {
            loadIntoDraftEditorBtn.addEventListener('click', async () => {
                await this.loadGeneratedDraftIntoEditor();
            });
        }

        // Roster Creator event listeners
        const generateRosterBtn = document.getElementById('generateRosterBtn');
        if (generateRosterBtn) {
            console.log('[App] Roster generate button found, adding click listener');
            generateRosterBtn.addEventListener('click', async () => {
                console.log('[App] Generate roster button clicked!');
                await this.generateRoster();
            });
        } else {
            console.error('[App] Generate roster button NOT found!');
        }

        const loadIntoRosterEditorBtn = document.getElementById('loadIntoRosterEditor');
        if (loadIntoRosterEditorBtn) {
            loadIntoRosterEditorBtn.addEventListener('click', async () => {
                await this.loadGeneratedRosterIntoEditor();
            });
        }

        const saveGeneratedRosterBtn = document.getElementById('saveGeneratedRoster');
        if (saveGeneratedRosterBtn) {
            saveGeneratedRosterBtn.addEventListener('click', async () => {
                await this.saveGeneratedRoster();
            });
        }

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
        console.log('[Portrait Loading] PSXP index in fieldCodes:', psxpIndex, 'fieldCodes:', fieldCodes.slice(0, 10));
        let portraitsToLoad = 0;
        let portraitsLoaded = 0;

        if (psxpIndex !== -1) {
            console.log('[Portrait Loading] Starting loop for', paginatedPlayers.length, 'players');
            paginatedPlayers.forEach((player, idx) => {
                const pid = this.getPlayerFieldValue(player, 'PSXP');
                if (idx < 2) console.log(`[Portrait Loading] Player ${idx} PID:`, pid);
                if (pid) {
                    const plpoKey = this.getPlpoFromPID(pid);
                    if (idx < 2) console.log(`[Portrait Loading] Player ${idx} PLPO:`, plpoKey, 'Cached:', this.portraitCache.has(plpoKey));
                    if (plpoKey && !this.portraitCache.has(plpoKey)) {
                        // Mark as loading and fetch
                        console.log(`[Portrait Loading] Fetching for ${plpoKey}`);
                        this.portraitCache.set(plpoKey, 'loading');
                        portraitsToLoad++;

                        window.electronAPI.portrait.getByPLPO(plpoKey).then(imageData => {
                            console.log(`[Portrait Loading] SUCCESS ${plpoKey}`);
                            this.portraitCache.set(plpoKey, imageData);
                            portraitsLoaded++;

                            // When all portraits loaded, re-render table once
                            if (portraitsLoaded === portraitsToLoad && this.hotTable) {
                                this.hotTable.render();
                            }
                        }).catch(() => {
                            this.portraitCache.set(plpoKey, null);
                            portraitsLoaded++;

                            // When all portraits loaded (even failures), re-render
                            if (portraitsLoaded === portraitsToLoad && this.hotTable) {
                                this.hotTable.render();
                            }
                        });
                    }
                }
            });

            // If all portraits already in cache, trigger re-render after table init
            if (portraitsToLoad === 0) {
                setTimeout(() => {
                    if (this.hotTable) {
                        this.hotTable.render();
                    }
                }, 100);
            }
        }

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

        console.log('[Portrait] Setting up portrait column');

        // Create portrait renderer function (MUST be synchronous for Handsontable)
        const portraitRenderer = (instance, td, row, col, prop, value, cellProperties) => {
            // Clear cell and set up styling
            td.innerHTML = '';
            td.style.padding = '2px';
            td.style.textAlign = 'center';
            td.style.verticalAlign = 'middle';
            td.style.backgroundColor = '#1a1a1a';

            // Get PID from the row data
            const rowData = instance.getDataAtRow(row);
            const psxpIndex = this.currentFieldMapping.indexOf('PSXP');
            // currentFieldMapping already accounts for portrait column offset
            const pid = psxpIndex !== -1 ? rowData[psxpIndex] : null;

            if (row < 2) console.log(`[Portrait Renderer] Row ${row}: psxpIndex=${psxpIndex}, pid=${pid}, rowData length=${rowData?.length}`);

            if (!pid) {
                if (row < 2) console.log(`[Portrait Renderer] Row ${row}: NO PID, returning empty`);
                return td;
            }

            // Get PLPO key from PID
            const plpoKey = this.getPlpoFromPID(pid);

            if (row < 2) console.log(`[Portrait Renderer] Row ${row}: plpoKey=${plpoKey}, inCache=${this.portraitCache.has(plpoKey)}`);

            if (!plpoKey) {
                if (row < 2) console.log(`[Portrait Renderer] Row ${row}: NO PLPO, returning empty`);
                return td;
            }

            // ONLY use cache - never trigger new loads during render
            if (this.portraitCache.has(plpoKey)) {
                const imageData = this.portraitCache.get(plpoKey);
                if (row < 2) console.log(`[Portrait Renderer] Row ${row}: imageData type=${typeof imageData}, length=${imageData?.length}, is loading=${imageData === 'loading'}`);
                if (imageData && imageData !== 'loading') {
                    const img = document.createElement('img');
                    img.src = imageData;
                    img.style.width = '64px';
                    img.style.height = '64px';
                    img.style.objectFit = 'cover';
                    td.appendChild(img);
                    if (row < 2) console.log(`[Portrait Renderer] Row ${row}: IMAGE ADDED`);
                } else if (imageData === 'loading') {
                    // Still loading
                    td.textContent = '...';
                    td.style.fontSize = '12px';
                    td.style.color = '#666';
                    if (row < 2) console.log(`[Portrait Renderer] Row ${row}: Showing loading...`);
                }
            } else {
                if (row < 2) console.log(`[Portrait Renderer] Row ${row}: NOT IN CACHE`);
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
                // Special handling for POVR (Overall Rating) - calculated dynamically
                columnConfig = {
                    ...columnConfig,
                    type: 'numeric',
                    format: '0',
                    width: 70,
                    readOnly: true,  // Overall is calculated, not editable
                    renderer: this.ovrRenderer.bind(this)  // Custom renderer that calculates OVR
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

        console.log('[DEBUG] columns array length:', columns.length);
        console.log('[DEBUG] columns[0]:', columns[0]);
        console.log('[DEBUG] columns[0].renderer:', columns[0].renderer);
        console.log('[DEBUG] columns[1]:', columns[1]);

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
        console.log('[Portrait] About to create Handsontable');
        console.log('[Portrait] Data rows:', data.length);
        console.log('[Portrait] Columns count:', columns.length);
        console.log('[Portrait] First data row:', data[0]);
        console.log('[Portrait] First column config:', columns[0]);
        console.log('[Portrait] First column has renderer?', typeof columns[0].renderer);

        // DEBUG: Find and log PSXP column configuration
        const psxpColumnIndex = columns.findIndex(col => {
            const fieldIndex = col.data - 1; // -1 because col.data is offset by portrait column
            return fieldIndex >= 0 && this.currentFieldMapping[fieldIndex] === 'PSXP';
        });
        console.log('[DEBUG PSXP] PSXP column index:', psxpColumnIndex);
        if (psxpColumnIndex !== -1) {
            console.log('[DEBUG PSXP] PSXP column config:', JSON.stringify(columns[psxpColumnIndex], null, 2));
            console.log('[DEBUG PSXP] Has renderer?', typeof columns[psxpColumnIndex].renderer);
            console.log('[DEBUG PSXP] Has editor?', columns[psxpColumnIndex].editor);
            console.log('[DEBUG PSXP] Has type?', columns[psxpColumnIndex].type);
            console.log('[DEBUG PSXP] ReadOnly?', columns[psxpColumnIndex].readOnly);
        }

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
            fixedColumnsStart: 3, // Freeze Portrait, First Name, and Last Name columns
            preventOverflow: 'horizontal', // Prevent column misalignment during scroll

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
                console.log('[DEBUG beforeChange] Source:', source, 'Changes count:', changes ? changes.length : 0);
                if (changes && changes.length > 0) {
                    console.log('[DEBUG beforeChange] First change:', changes[0]);
                }
            },
            afterChange: (changes, source) => {
                console.log('[DEBUG afterChange] Source:', source, 'Changes count:', changes ? changes.length : 0);
                if (changes && changes.length > 0) {
                    console.log('[DEBUG afterChange] First change:', changes[0]);
                }
                if (source !== 'loadData' && changes) {
                    this.handlePlayerDataChange(changes);

                    // Re-render portrait when PID (PSXP) changes
                    changes.forEach(([row, col, oldValue, newValue]) => {
                        const fieldName = this.currentFieldMapping[col]; // currentFieldMapping already has portrait at index 0
                        if (fieldName === 'PSXP' && newValue !== oldValue) {
                            console.log(`[Portrait Update] PID changed to ${newValue} on row ${row}`);

                            // Fetch portrait for new PID
                            const plpoKey = this.getPlpoFromPID(parseInt(newValue));
                            if (plpoKey && !this.portraitCache.has(plpoKey)) {
                                console.log(`[Roster] Fetching portrait for new PID ${newValue} (PLPO: ${plpoKey})`);
                                this.portraitCache.set(plpoKey, 'loading');

                                window.electronAPI.portrait.getByPLPO(plpoKey).then(imageData => {
                                    console.log(`[Roster] Portrait fetched for ${plpoKey}`);
                                    this.portraitCache.set(plpoKey, imageData);
                                    // Re-render to show the new portrait
                                    if (this.hotTable && !this.hotTable.isDestroyed) {
                                        this.hotTable.render();
                                    }
                                }).catch((error) => {
                                    console.error(`[Roster] Failed to fetch portrait for ${plpoKey}:`, error);
                                    this.portraitCache.set(plpoKey, null);
                                    if (this.hotTable && !this.hotTable.isDestroyed) {
                                        this.hotTable.render();
                                    }
                                });
                            } else {
                                // Portrait already in cache or no PLPO found, just re-render
                                console.log(`[Portrait Update] Portrait already cached or no PLPO, re-rendering`);
                                this.hotTable.render();
                            }
                        }
                    });
                }
            },

            // Clear status on selection
            afterSelectionEnd: () => {
                this.setStatus('Ready');
            },

            // Setup PID event listeners and header click handlers after rendering
            afterRender: () => {
                console.log('[DEBUG] afterRender: Checking column 0 config');
                if (this.hotTable && !this.hotTable.isDestroyed) {
                    try {
                        const col0Config = this.hotTable.getCellMeta(0, 0);
                        console.log('[DEBUG] afterRender: Column 0 cell meta:', col0Config);
                        console.log('[DEBUG] afterRender: Column 0 renderer:', col0Config.renderer);
                    } catch (e) {
                        console.log('[DEBUG] afterRender: Could not get cell meta (table may be destroyed)');
                    }
                }
                this.setupPIDEventListeners();
                this.setupHeaderClickHandlers();
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
                                console.log('[DEBUG] afterLoadData: Could not auto-size (table may be destroyed)');
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
                    console.log('[DEBUG] Force initial sizing: Could not auto-size (table may be destroyed)');
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
    /**
     * Portrait renderer - displays player portrait based on PID
     * This is a read-only column that renders an image from the portrait service
     */
    portraitRenderer(instance, td, row, col, prop, value, cellProperties) {
        console.log('[Portrait] portraitRenderer called for row', row);

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
     * Custom renderer for POVR (Overall Rating) - calculates dynamically based on other ratings
     * Uses position-specific weighted formulas to calculate the overall rating
     */
    ovrRenderer(instance, td, row, col, prop, value, cellProperties) {
        // Get the full player data for this row
        const rowData = instance.getDataAtRow(row);

        // Get position index
        const posIndex = this.currentFieldMapping.indexOf('PPOS');
        const position = posIndex !== -1 ? rowData[posIndex] : null;

        if (!position) {
            // No position available, show the stored value
            Handsontable.renderers.NumericRenderer.apply(this, arguments);
            td.style.backgroundColor = 'var(--gray-medium)';
            td.style.color = 'var(--gray-text)';
            return td;
        }

        // Build ratings object from current row data
        const ratings = this.buildRatingsFromRow(rowData);

        // Calculate overall rating asynchronously
        window.electronAPI.rating.calculateOverall(ratings, position)
            .then(calculatedOVR => {
                // Update the cell with calculated OVR
                td.textContent = calculatedOVR;
                td.style.backgroundColor = 'var(--gray-dark)';  // Darker to show it's calculated
                td.style.color = 'var(--primary-orange)';  // Orange to highlight it's special
                td.style.fontWeight = 'bold';
                td.style.border = '1px solid var(--border-color)';
                td.style.fontSize = '0.875rem';
                td.style.textAlign = 'center';

                // Add title with explanation
                td.title = 'Calculated Overall Rating (based on position-specific attribute weights)';
            })
            .catch(error => {
                console.error('[ovrRenderer] Error calculating OVR:', error);
                // Fallback to stored value
                td.textContent = value || '-';
                td.style.backgroundColor = 'var(--gray-medium)';
                td.style.color = 'var(--gray-text)';
            });

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
            td.style.backgroundColor = 'var(--gray-medium)';
            td.style.color = 'var(--gray-text)';
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
                td.style.backgroundColor = 'var(--gray-dark)';  // Darker to show it's calculated
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
                td.style.backgroundColor = 'var(--gray-medium)';
                td.style.color = 'var(--gray-text)';
            });

        return td;
    }

    /**
     * Get PLPO key from PID number
     * Uses the PID_lookup.csv to find first name and last name, then creates PLPO key
     */
    getPlpoFromPID(pid) {
        if (!pid || !window.lookupData || !window.lookupData.plpos) {
            return null;
        }

        // Direct PID -> PLPO lookup from FullData_Lookup.csv
        const plpoKey = window.lookupData.plpos.get(pid);
        return plpoKey || null;
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

        // Apply search filter
        if (this.rosterSearchTerm) {
            filtered = filtered.filter(player => {
                const firstName = (player.PFNA || '').toLowerCase();
                const lastName = (player.PLNA || '').toLowerCase();
                const fullName = `${firstName} ${lastName}`;
                return fullName.includes(this.rosterSearchTerm);
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
        const visibleFields = getVisibleFields(false);

        document.getElementById('playerCount').textContent = `${playerCount} players`;
        document.getElementById('visibleFields').textContent = `${visibleFields.length} visible fields`;
    }

    async saveRoster() {
        if (!this.currentFile) {
            this.showError('No file path specified');
            return;
        }

        // Check if this is a generated roster (no original buffer data)
        const isGeneratedRoster = !this.originalData || !this.originalData._originalBuffer;

        if (isGeneratedRoster) {
            // Use roster creator save method for generated rosters
            console.log('[app.js] This is a generated roster - using roster creator save');
            return await this.saveGeneratedRosterFromEditor();
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

            // Update UI
            document.getElementById('draft-file-name').textContent = filePath.split(/[/\\]/).pop();
            document.getElementById('draft-file-stats').textContent =
                `${result.data.prospects.length} prospects | Year: ${result.data.header.year}`;

            // Enable buttons
            document.getElementById('save-draft-btn').disabled = false;
            document.getElementById('export-draft-json-btn').disabled = false;

            // Create grid
            this.createDraftGrid(result.data.prospects);

            console.log('Draft class loaded successfully:', result.data.prospects.length, 'prospects');
        } catch (error) {
            console.error('Error loading draft class:', error);
            this.showError(`Failed to load draft class: ${error.message}`);
        }
    }

    createDraftGrid(prospects) {
        const container = document.getElementById('draft-grid-container');

        // Clear existing grid
        if (this.draftGrid) {
            this.draftGrid.destroy();
        }

        // Set container to allow overflow scrolling
        container.style.width = '100%';
        container.style.height = 'calc(100vh - 200px)';
        container.style.overflow = 'auto';  // Enable both horizontal and vertical scrolling

        // Store original prospect data with numeric IDs
        this.originalProspectData = prospects.map(p => ({...p}));

        // Pre-load portraits for all prospects in batch
        let portraitsToLoad = 0;
        let portraitsLoaded = 0;

        prospects.forEach(prospect => {
            if (prospect.PID) {
                const plpoKey = this.getPlpoFromPID(prospect.PID);
                if (plpoKey && !this.portraitCache.has(plpoKey)) {
                    // Mark as loading and fetch
                    this.portraitCache.set(plpoKey, 'loading');
                    portraitsToLoad++;

                    window.electronAPI.portrait.getByPLPO(plpoKey).then(imageData => {
                        this.portraitCache.set(plpoKey, imageData);
                        portraitsLoaded++;

                        // When all portraits loaded, re-render table once
                        if (portraitsLoaded === portraitsToLoad && this.draftGrid) {
                            this.draftGrid.render();
                        }
                    }).catch(() => {
                        this.portraitCache.set(plpoKey, null);
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
        const transformedProspects = prospects.map(prospect => {
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
            if (prospect.PID && window.lookupData && window.lookupData.pidsCapitalized) {
                const capitalizedName = window.lookupData.pidsCapitalized.get(prospect.PID);
                if (capitalizedName) {
                    playerPic = capitalizedName;
                }
            }

            // Debug: Log first prospect to check visuals
            if (prospects.indexOf(prospect) === 0) {
                console.log('[Draft Class] First prospect visuals:', prospect.visuals);
                console.log('[Draft Class] Body Type:', bodyType);
                console.log('[Draft Class] PID:', prospect.PID);
                console.log('[Draft Class] PEPS:', peps);
                console.log('[Draft Class] Player Pic:', playerPic);
            }

            // Create clean object with ONLY the properties needed for Handsontable
            // Do NOT use spread operator - it can copy extra/corrupted properties from M25→M26 conversion
            return {
                // Portrait (for display only)
                portrait: '',  // Placeholder, rendered from PID

                // Personal Info
                firstName: prospect.firstName,
                lastName: prospect.lastName,
                homeTown: prospect.homeTown || '',
                homeState: getLookupValue('states', prospect.homeState) || prospect.homeState,
                college: getLookupValue('colleges', prospect.college) || prospect.college,
                age: prospect.age,
                heightInches: prospect.heightInches,
                weight: prospect.weight,
                position: getLookupValue('positions', prospect.position) || prospect.position,
                archetype: prospect.archetype,
                jerseyNum: prospect.jerseyNum,

                // Draft Info
                draftable: prospect.draftable,
                draftPick: prospect.draftPick,
                draftRound: prospect.draftRound,
                devTrait: ['Normal', 'Star', 'Superstar', 'X-Factor'][prospect.devTrait] || prospect.devTrait,

                // IDs and Assets
                PID: prospect.PID,
                PEPS: peps,
                bodyType: ['Lean', 'Athletic', 'Muscular', 'Stocky'][bodyType] || bodyType,
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
        });

        // Get lookup options for dropdowns
        const positionOptions = getLookupOptions('positions').map(opt => opt.label);
        const collegeOptions = getLookupOptions('colleges').map(opt => opt.label);
        const stateOptions = getLookupOptions('states').map(opt => opt.label);
        const devTraitOptions = ['Normal', 'Star', 'Superstar', 'X-Factor'];
        const bodyTypeOptions = ['Lean', 'Athletic', 'Muscular', 'Stocky'];  // Match backend: 0=Lean, 1=Athletic, 2=Muscular, 3=Stocky
        // Use capitalized names for player pic autocomplete
        const playerPicOptions = Array.from(window.lookupData.pidsCapitalized.values()).concat(['Generic Face']);

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

        // Custom renderer for draft position - ALWAYS display current row position (1-indexed)
        // Position is NOT stored - it's calculated from the row's physical position in the grid
        const draftPositionRenderer = function(instance, td, row, col, prop, value, cellProperties) {
            // Always display the current physical row position (row numbers are 0-indexed, display as 1-indexed)
            const displayValue = row + 1;
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

            // Get PID from the row data using physical row
            const rowData = instance.getSourceDataAtRow(physicalRow);
            const pid = rowData ? rowData.PID : null;

            if (!pid) {
                return td;
            }

            // Get PLPO key from PID
            const plpoKey = this.getPlpoFromPID(pid);

            if (!plpoKey) {
                return td;
            }

            // ONLY use cache - never trigger new loads during render
            if (this.portraitCache.has(plpoKey)) {
                const imageData = this.portraitCache.get(plpoKey);
                if (imageData && imageData !== 'loading') {
                    const img = document.createElement('img');
                    img.src = imageData;
                    img.style.width = '64px';
                    img.style.height = '64px';
                    img.style.objectFit = 'cover';
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
            // Portrait column (Second column)
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
            { data: 'jerseyNum', title: 'Jersey #', width: 80, type: 'numeric' },
            { data: 'college', title: 'College', width: 150, type: 'dropdown', source: collegeOptions, strict: true, allowInvalid: false, renderer: dropdownRenderer },
            { data: 'age', title: 'Age', width: 50, type: 'numeric' },
            { data: 'homeState', title: 'State', width: 100, type: 'dropdown', source: stateOptions, strict: true, allowInvalid: false, renderer: dropdownRenderer },
            { data: 'PID', title: 'PID', width: 70, type: 'numeric' },
            { data: 'playerPic', title: 'Player Pic', width: 150, type: 'autocomplete', source: playerPicOptions, strict: false, allowInvalid: true },
            { data: 'PEPS', title: 'Asset ID (PEPS)', width: 200, type: 'text' },
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

        this.draftGrid = new Handsontable(container, {
            data: transformedProspects,
            columns: draftColumns,
            colHeaders: true,
            rowHeaders: true,
            height: 'calc(100vh - 200px)',
            rowHeights: 70, // Set row height to accommodate 64px portraits
            licenseKey: 'non-commercial-and-evaluation',
            stretchH: 'none',  // Allow horizontal scrolling instead of stretching columns
            autoColumnSize: true,  // Enable auto column sizing
            manualColumnResize: true,
            manualRowResize: true,
            filters: false,  // Disable filters (they require dropdownMenu)
            dropdownMenu: false,  // Disable dropdown menu (removes filter arrows)
            contextMenu: true,
            fixedColumnsStart: 5,  // Freeze first 5 columns (Draft Pos, Portrait, Last Name, First Name, Position)
            preventOverflow: 'horizontal', // Prevent column misalignment during scroll
            manualRowMove: true, // Enable row dragging for reordering
            renderAllRows: false, // Use virtual scrolling
            viewportRowRenderingOffset: 100, // Render extra rows to prevent misalignment
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
                if (this.draftGrid && !this.draftGrid.isDestroyed) {
                    try {
                        window.electronAPI.debug.sessionLog('[SORT] BEFORE sort - First 5 rows: ' + JSON.stringify(this.draftGrid.getSourceData().slice(0, 5).map(r => ({
                            firstName: r.firstName,
                            lastName: r.lastName,
                            devTrait: r.devTrait,
                            position: r.position
                        })), null, 2));
                    } catch (e) {
                        console.log('[Draft] beforeColumnSort: Could not access data (table may be destroyed)');
                    }
                }
            },
            afterColumnSort: (currentSortConfig, destinationSortConfigs) => {
                if (this.draftGrid && !this.draftGrid.isDestroyed) {
                    try {
                        window.electronAPI.debug.sessionLog('[SORT] AFTER sort - First 5 rows: ' + JSON.stringify(this.draftGrid.getSourceData().slice(0, 5).map(r => ({
                            firstName: r.firstName,
                            lastName: r.lastName,
                            devTrait: r.devTrait,
                            position: r.position
                        })), null, 2));

                        // Force re-render to update portraits after sort
                        console.log('[Draft] afterColumnSort: Forcing render to update portraits');
                        this.draftGrid.render();
                    } catch (e) {
                        console.log('[Draft] afterColumnSort: Could not access data (table may be destroyed)');
                    }
                }
            },
            afterRowMove: (movedRows, finalIndex, dropIndex, movePossible, orderChanged) => {
                // Just re-render to update the position numbers (they're calculated from row position)
                if (orderChanged && this.draftGrid && !this.draftGrid.isDestroyed) {
                    try {
                        this.draftGrid.render();
                        console.log('[Draft Editor] Draft order updated - rows reordered');
                    } catch (e) {
                        console.log('[Draft] afterRowMove: Could not render (table may be destroyed)');
                    }
                }
            },
            beforeChange: (changes, source) => {
                // When a dropdown value is changed, keep it as the friendly name
                // This prevents it from being converted back to a number
                if (!changes) return;

                changes.forEach(([row, prop, oldValue, newValue]) => {
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
                        const plpoKey = this.getPlpoFromPID(parseInt(newValue));
                        if (plpoKey && !this.portraitCache.has(plpoKey)) {
                            console.log(`[Draft] Fetching portrait for new PID ${newValue} (PLPO: ${plpoKey})`);
                            this.portraitCache.set(plpoKey, 'loading');

                            window.electronAPI.portrait.getByPLPO(plpoKey).then(imageData => {
                                console.log(`[Draft] Portrait fetched successfully for ${plpoKey}, data length:`, imageData ? imageData.length : 'null');
                                this.portraitCache.set(plpoKey, imageData);
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
                                console.error(`[Draft] Failed to fetch portrait for ${plpoKey}:`, error);
                                this.portraitCache.set(plpoKey, null);
                                if (this.draftGrid && !this.draftGrid.isDestroyed) {
                                    this.draftGrid.render();
                                }
                            });
                        } else if (plpoKey) {
                            // Portrait already in cache, just re-render to update
                            console.log(`[Draft] Portrait already cached for PID ${newValue}`);
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
                        console.log(`Player Pic changed from "${oldValue}" to "${newValue}", looking up PID...`);
                        console.log('Available keys in pidsByName:', Array.from(window.lookupData.pidsByName.keys()).slice(0, 5));

                        if (newValue === 'Generic Face' || !newValue) {
                            console.log('Generic Face selected, not changing PID');
                            return;
                        }
                        const pid = window.lookupData.pidsByName.get(newValue);
                        console.log(`Lookup result for "${newValue}": ${pid}`);
                        if (pid) {
                            console.log(`Setting PID to: ${pid}`);
                            this.draftGrid.setDataAtRowProp(row, 'PID', pid, 'pic_sync');
                        } else {
                            console.log(`No PID found for player: ${newValue}`);
                            // Try case-insensitive search
                            for (const [name, id] of window.lookupData.pidsByName.entries()) {
                                if (name.toLowerCase() === newValue.toLowerCase()) {
                                    console.log(`Found case-insensitive match: ${name} -> ${id}`);
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
                    // Convert body type name to ID (Lean=0, Athletic=1, Muscular=2, Stocky=3)
                    bodyType: ['Lean', 'Athletic', 'Muscular', 'Stocky'].indexOf(prospect.bodyType) !== -1
                        ? ['Lean', 'Athletic', 'Muscular', 'Stocky'].indexOf(prospect.bodyType)
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
                console.log('  PEPS:', updatedProspects[0].PEPS);
                console.log('  bodyType:', updatedProspects[0].bodyType);
                console.log('  Has visuals?:', !!updatedProspects[0].visuals);
                if (updatedProspects[0].visuals) {
                    console.log('  visuals.genericHeadName:', updatedProspects[0].visuals.genericHeadName);
                }
            }

            // Grid data is already in draft order (no sorting needed)
            // The order of rows in the grid IS the draft order
            console.log('[Save] Using grid order for draft class (prospects already in correct order)');

            // Save via IPC
            // Pass complete draft class data (prevents data loss when saving over same file)
            const draftClassData = {
                header: this.currentDraftClass.header,
                prospects: updatedProspects,
                _originalBuffer: this.currentDraftClass._originalBuffer,
                _version: this.currentDraftClass._version || 'M25'
            };

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

        // Update grid with filtered data
        this.draftGrid.loadData(filtered);
    }

    // ===== CREATOR METHODS =====

    /**
     * Generate Draft Class from web scraping
     */
    async generateDraftClass() {
        const yearInput = document.getElementById('draftYear');
        const year = parseInt(yearInput.value);
        const testingModeCheckbox = document.getElementById('testingMode');
        const testingMode = testingModeCheckbox ? testingModeCheckbox.checked : false;

        if (!year || year < 1936 || year > 2030) {
            this.showError('Please enter a valid draft year (1936-2030)');
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
        progressText.textContent = testingMode ?
            `Generating test class (~40 players)...` :
            `Scraping ${year} draft class data...`;

        try {
            console.log(`[Creator] Generating draft class for ${year} (Testing Mode: ${testingMode})`);

            // Call IPC to generate draft class with testing mode flag
            progressBar.style.width = '30%';
            const result = await window.electronAPI.creator.generateDraftClass(year, testingMode);

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

            // Call IPC to generate roster (this will take 10-15 minutes)
            const result = await window.electronAPI.rosterCreator.generate(year, templatePath);

            // Remove progress listener
            window.electronAPI.rosterCreator.removeProgressListener();

            if (!result.success) {
                throw new Error(result.error || 'Failed to generate roster');
            }

            console.log(`[Creator] Generated ${result.players.length} players`);
            console.log(`[Creator] HOF players: ${result.stats.hofPlayers}`);
            console.log(`[Creator] Average OVR: ${result.stats.averageOVR}`);

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
                contextMenu: true,
                stretchH: 'none', // Don't stretch columns, use defined widths
                width: '100%', // Ensure full width
                autoWrapRow: true,
                autoWrapCol: true,
                renderAllRows: false, // Use virtual scrolling
                viewportRowRenderingOffset: 100, // Render extra rows to prevent misalignment
                fixedColumnsStart: 4, // Freeze first 4 columns (Draft Pos, First, Last, Pos) to prevent alignment issues
                preventOverflow: 'horizontal', // Prevent horizontal overflow causing misalignment
                manualRowMove: true, // Enable row dragging for reordering
                afterRowMove: (movedRows, finalIndex, dropIndex, movePossible, orderChanged) => {
                    // Just re-render to update the position numbers (they're calculated from row position)
                    if (orderChanged) {
                        this.draftCreatorGrid.render();
                        console.log('[Draft Creator] Draft order updated - rows reordered');
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
                contextMenu: true,
                stretchH: 'none', // Don't stretch columns, use defined widths
                renderAllRows: false, // Use virtual scrolling
                viewportRowRenderingOffset: 100, // Render extra rows to prevent misalignment
                fixedColumnsStart: 3, // Freeze first 3 columns (Last, First, Pos) to prevent alignment issues
                preventOverflow: 'horizontal' // Prevent horizontal overflow causing misalignment
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

            // Convert generated players to draft prospect format
            // NOTE: draftPosition is NOT stored - it's calculated from row order in the grid
            const prospects = this.generatedDraftPlayers.map((player, index) => ({
                // Basic Info
                firstName: player.firstName,
                lastName: player.lastName,
                position: player.positionCode, // Use numeric code for draft class
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

                // Position-specific attributes (use || 0 for numeric fields)
                throwPower: player.ratings.throwPower || 0,
                throwAccuracyShort: player.ratings.throwAccuracyShort || 0,
                throwAccuracyMid: player.ratings.throwAccuracyMid || 0,
                throwAccuracyDeep: player.ratings.throwAccuracyDeep || 0,
                throwOnTheRun: player.ratings.throwOnTheRun || 0,
                throwUnderPressure: player.ratings.throwUnderPressure || 0,
                playAction: player.ratings.playAction || 0,
                breakSack: player.ratings.breakSack || 0,

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

                // Visuals
                PID: player.PID || 0,
                PEPS: player.PEPS || null,
                bodyType: player.bodyType || 1,

                // Draft info (optional, can be filled in editor)
                round: 0,
                pick: 0,
                draftTeam: 0,
                homeState: player.homeState || 0
            }));

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

            // Create grid with generated data
            this.createDraftGrid(prospects);

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

            // DEBUG: Log first player's field names
            if (this.generatedRosterPlayers.length > 0) {
                const firstPlayer = this.generatedRosterPlayers[0];
                console.log('[Creator] First player data:');
                console.log('  - Field names:', Object.keys(firstPlayer));
                console.log('  - PFNA (First Name):', firstPlayer.PFNA);
                console.log('  - PLNA (Last Name):', firstPlayer.PLNA);
                console.log('  - PPOS (Position):', firstPlayer.PPOS);
                console.log('  - PSPD (Speed):', firstPlayer.PSPD);
                console.log('  - PCOL (College):', firstPlayer.PCOL);
                console.log('  - PPID (PID):', firstPlayer.PPID);
                console.log('  - POVR (Overall):', firstPlayer.POVR);
                console.log('  - Full first player:', JSON.stringify(firstPlayer, null, 2));
            }

            // Switch to roster editor tab
            this.switchTool('roster');

            // Store the generated players as the current roster data
            this.players = this.generatedRosterPlayers;

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

            // Update UI
            const fileStatus = document.getElementById('fileStatus');
            if (fileStatus) {
                fileStatus.textContent = `Generated Roster (${this.players.length} players) - Ready to save`;
            }

            // Show save button
            const saveButton = document.getElementById('saveRosterBtn');
            if (saveButton) {
                saveButton.style.display = 'inline-block';
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