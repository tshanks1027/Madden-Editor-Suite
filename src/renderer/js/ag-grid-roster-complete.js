/**
 * Complete AG-Grid Roster Table Implementation
 * Full replacement for Handsontable with all features
 */

import { createGrid, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import {
    getFieldDefinition,
    getLookupValue,
    TEAM_MAPPINGS
} from '../data/field-definitions.js';
import { FastSelectEditor } from './FastSelectEditor.js';

// Team colors for row styling
const TEAM_COLORS = {
    'ARI': { primary: '#97233F', secondary: '#FFB612' },  // Cardinals: Cardinal red / Gold
    'ATL': { primary: '#A71930', secondary: '#000000' },  // Falcons: Red / Black
    'BAL': { primary: '#241773', secondary: '#000000' },  // Ravens: Purple / Black
    'BUF': { primary: '#00338D', secondary: '#C60C30' },  // Bills: Royal blue / Red
    'CAR': { primary: '#0085CA', secondary: '#101820' },  // Panthers: Process blue / Black
    'CHI': { primary: '#C83803', secondary: '#0B162A' },  // Bears: Orange / Navy
    'CIN': { primary: '#FB4F14', secondary: '#000000' },  // Bengals: Orange / Black
    'CLE': { primary: '#311D00', secondary: '#FF3C00' },  // Browns: Brown / Orange
    'DAL': { primary: '#003594', secondary: '#869397' },  // Cowboys: Navy blue / Silver
    'DEN': { primary: '#FB4F14', secondary: '#002244' },  // Broncos: Orange / Navy
    'DET': { primary: '#0076B6', secondary: '#B0B7BC' },  // Lions: Honolulu blue / Silver
    'GB': { primary: '#203731', secondary: '#FFB612' },   // Packers: Dark green / Gold
    'HOU': { primary: '#03202F', secondary: '#A71930' },  // Texans: Deep steel blue / Red
    'IND': { primary: '#003A70', secondary: '#A2AAAD' },  // Colts: Speed blue / Silver
    'JAX': { primary: '#006778', secondary: '#D7A22A' },  // Jaguars: Teal / Gold
    'KC': { primary: '#E31837', secondary: '#FFB81C' },   // Chiefs: Red / Gold
    'LV': { primary: '#000000', secondary: '#A5ACAF' },   // Raiders: Black / Silver
    'LAC': { primary: '#0080C6', secondary: '#FFC20E' },  // Chargers: Powder blue / Gold
    'LAR': { primary: '#003594', secondary: '#FFA300' },  // Rams: Royal blue / Sol
    'MIA': { primary: '#008E97', secondary: '#FC4C02' },  // Dolphins: Aqua / Orange
    'MIN': { primary: '#4F2683', secondary: '#FFC62F' },  // Vikings: Purple / Gold
    'NE': { primary: '#002244', secondary: '#C60C30' },   // Patriots: Navy / Red
    'NO': { primary: '#D3BC8D', secondary: '#101820' },   // Saints: Old gold / Black
    'NYG': { primary: '#0B2265', secondary: '#A71930' },  // Giants: Blue / Red
    'NYJ': { primary: '#125740', secondary: '#FFFFFF' },  // Jets: Gotham green / White
    'PHI': { primary: '#004C54', secondary: '#A5ACAF' },  // Eagles: Midnight green / Silver
    'PIT': { primary: '#FFB612', secondary: '#101820' },  // Steelers: Gold / Black
    'SF': { primary: '#AA0000', secondary: '#B3995D' },   // 49ers: Red / Gold
    'SEA': { primary: '#002244', secondary: '#69BE28' },  // Seahawks: College navy / Action green
    'TB': { primary: '#D50A0A', secondary: '#FF7900' },   // Buccaneers: Red / Pewter orange
    'TEN': { primary: '#00295B', secondary: '#0C2340' },  // Titans: Navy blue / Titans blue
    'WAS': { primary: '#5A1438', secondary: '#FFB612' }   // Commanders: Burgundy / Gold
};

// Register AG-Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Portrait Cell Renderer - shows player portraits with click-to-view-card
 */
class PortraitCellRenderer {
    init(params) {
        const { app, data } = params;

        this.eGui = document.createElement('div');
        this.eGui.className = 'portrait-cell';
        this.eGui.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            cursor: pointer;
            padding: 2px;
        `;

        const player = data;
        const pid = player ? player.PSXP : null;

        if (pid !== null && pid !== undefined) {
            const cacheKey = `pid_${pid}`;

            if (app.portraitCache.has(cacheKey)) {
                const imageData = app.portraitCache.get(cacheKey);
                if (imageData && imageData !== 'loading') {
                    const img = document.createElement('img');
                    img.src = imageData;
                    img.style.cssText = 'width: 64px; height: 64px; object-fit: cover; cursor: context-menu;';
                    img.alt = 'Player Portrait';
                    this.eGui.appendChild(img);
                } else {
                    this.eGui.innerHTML = '<div style="width:64px;height:64px;background:#333;display:flex;align-items:center;justify-content:center;font-size:32px;">👤</div>';
                }
            } else {
                this.eGui.innerHTML = '<div style="width:64px;height:64px;background:#333;display:flex;align-items:center;justify-content:center;font-size:32px;">👤</div>';
            }
        } else {
            this.eGui.innerHTML = '<div style="width:64px;height:64px;background:#333;display:flex;align-items:center;justify-content:center;font-size:32px;">👤</div>';
        }

        // Click handler to show player card
        this.eGui.addEventListener('click', () => {
            const rowIndex = params.node.rowIndex;
            app.showPlayerCard(rowIndex);
        });

        // Right-click context menu for face picker
        this.eGui.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (player) {
                app.openGenericFacePicker(player, params.node.rowIndex);
            }
        });
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        return false; // Force re-create on data change
    }

    destroy() {
        // Cleanup
    }
}

/**
 * Row Number Cell Renderer - clickable row numbers for player cards
 */
class RowNumberCellRenderer {
    init(params) {
        const { app } = params;

        this.eGui = document.createElement('div');
        this.eGui.className = 'row-number-cell';
        this.eGui.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            cursor: pointer;
            font-weight: 500;
            color: #e0e0e0;
        `;

        this.eGui.textContent = (params.node.rowIndex + 1).toString();

        // Click handler to show player card
        this.eGui.addEventListener('click', () => {
            const rowIndex = params.node.rowIndex;
            app.showPlayerCard(rowIndex);
        });
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        this.eGui.textContent = (params.node.rowIndex + 1).toString();
        return true;
    }

    destroy() {
        // Cleanup
    }
}

export function createAGGridColumns(visibleFields, displayNames, fieldCodes, app) {
    const columnDefs = [];

    // Debug: Log the fields being passed in
    console.log('[AG-Grid] Creating columns with:', {
        fieldCodesCount: fieldCodes.length,
        displayNamesCount: displayNames.length,
        fieldCodes: fieldCodes,
        displayNames: displayNames
    });

    // DIAGNOSTIC: Check pidLookup availability
    console.log('[AG-Grid DIAGNOSTIC] app.pidLookup exists?', !!app.pidLookup);
    console.log('[AG-Grid DIAGNOSTIC] window.lookupData exists?', !!window.lookupData);
    console.log('[AG-Grid DIAGNOSTIC] window.lookupData.pidsCapitalized exists?', !!window.lookupData?.pidsCapitalized);
    if (window.lookupData?.pidsCapitalized) {
        console.log('[AG-Grid DIAGNOSTIC] pidsCapitalized has', window.lookupData.pidsCapitalized.size, 'entries');
        const firstThree = Array.from(window.lookupData.pidsCapitalized.entries()).slice(0, 3);
        console.log('[AG-Grid DIAGNOSTIC] First 3 PIDs:', firstThree);
    }

    // Row number column (pinned left, first column)
    columnDefs.push({
        headerName: '',
        field: '_rowNumber',
        width: 50,
        pinned: 'left',
        lockPosition: true,
        cellRenderer: RowNumberCellRenderer,
        cellRendererParams: { app },
        sortable: false,
        filter: false,
        editable: false,
        suppressHeaderMenuButton: true,
        suppressHeaderContextMenu: true,
        cellStyle: { padding: '0' }
    });

    // Portrait column (pinned left, second column)
    columnDefs.push({
        headerName: '📷',
        field: '_portrait',
        width: 80,
        pinned: 'left',
        lockPosition: true,
        cellRenderer: PortraitCellRenderer,
        cellRendererParams: { app },
        sortable: false,
        filter: false,
        editable: false,
        suppressHeaderMenuButton: true,
        suppressHeaderContextMenu: true,
        cellStyle: { padding: '2px' }
    });

    // Create columns for each field (skip empty fields)
    fieldCodes.forEach((fieldName, index) => {
        // Skip empty field names
        if (!fieldName || fieldName.trim() === '') {
            console.log(`[AG-Grid] Skipping empty field at index ${index}`);
            return;
        }

        const fieldDef = getFieldDefinition(fieldName);
        const displayName = displayNames[index];

        // Skip columns with empty display names
        if (!displayName || displayName.trim() === '') {
            console.log(`[AG-Grid] Skipping field with empty display name at index ${index}: field="${fieldName}"`);
            return;
        }

        console.log(`[AG-Grid] Creating column ${index}: field="${fieldName}", display="${displayName}", hasData=${fieldDef ? 'yes' : 'NO'}`);

        const colDef = {
            headerName: displayName,
            headerTooltip: fieldDef.display || displayName, // Full name on hover
            field: fieldName,
            editable: !fieldDef.readOnly,
            sortable: true,
            filter: true,
            resizable: true,
            suppressHeaderMenuButton: true,
            suppressHeaderContextMenu: true,
            // Auto-size columns based on content
            autoHeaderHeight: true,
            wrapHeaderText: false
        };

        // Rating columns (0-99 numeric fields) - width fits 3-char header, centered
        if (fieldDef.type === 'numeric' && fieldDef.min === 0 && fieldDef.max === 99) {
            colDef.width = 55;
            colDef.minWidth = 55;
            colDef.maxWidth = 70;
            colDef.cellStyle = { textAlign: 'center' };
            colDef.headerClass = 'ag-header-center';
        }

        // HGT, WGT, YRS columns - same compact width, centered
        if (fieldName === 'PHGT' || fieldName === 'PWGT' || fieldName === 'PYRP') {
            colDef.width = 55;
            colDef.minWidth = 55;
            colDef.maxWidth = 70;
            colDef.cellStyle = { textAlign: 'center' };
            colDef.headerClass = 'ag-header-center';
        }

        // PAM column - wide enough for values like "plpo_generic_1_001"
        if (fieldName === 'PEPS') {
            colDef.width = 180;
            colDef.minWidth = 150;
        }

        // Pin Last Name and First Name columns to the left
        if (fieldName === 'PLNA' || fieldName === 'PFNA') {
            colDef.pinned = 'left';
            colDef.lockPosition = true;
        }

        // Handle field types
        if (fieldDef.type === 'autocomplete' && fieldName === 'PLAYERPIC') {
            console.log('[AG-Grid] Configuring PLAYERPIC column (virtual field reading from PSXP)');

            // PLAYERPIC is a virtual display field - the actual PID is stored in PSXP
            // We need to read from PSXP and display the player name
            const pidMap = window.lookupData?.pidsCapitalized || new Map();

            // Get list of player names for the dropdown
            const playerNames = Array.from(pidMap.values()).sort();

            // Use valueGetter to read from PSXP field
            colDef.valueGetter = (params) => {
                if (!params.data) return null;
                const pid = params.data.PSXP;
                if (!pid) return null;
                const playerName = pidMap.get(parseInt(pid));
                return playerName || 'Generic Face';
            };

            // Use valueSetter to write back to PSXP field
            colDef.valueSetter = (params) => {
                const newName = params.newValue;
                console.log('[AG-Grid PLAYERPIC] valueSetter - New name:', newName);

                // Find PID by name
                let newPid = null;
                for (const [pid, name] of pidMap.entries()) {
                    if (name === newName) {
                        newPid = pid;
                        break;
                    }
                }

                console.log('[AG-Grid PLAYERPIC] valueSetter - Found PID:', newPid);

                if (newPid !== null) {
                    params.data.PSXP = newPid;
                    return true;
                }
                return false;
            };

            // Use FastSelectEditor with player names (replaces slow native select)
            colDef.cellEditor = FastSelectEditor;
            colDef.cellEditorParams = {
                values: playerNames
            };

            colDef.editable = true;
            console.log('[AG-Grid] PLAYERPIC column configured with', playerNames.length, 'player names');
        } else if (fieldDef.type === 'lookup' && fieldDef.lookup) {
            console.log(`[AG-Grid] Configuring lookup column ${fieldName}:`, {
                type: fieldDef.type,
                lookup: fieldDef.lookup,
                hasOptions: !!fieldDef.options,
                optionCount: fieldDef.options?.length,
                readOnly: fieldDef.readOnly
            });

            // Dropdown editor for lookup fields (position, team, college, etc.)
            if (fieldDef.options && fieldDef.options.length > 0) {
                colDef.editable = true;

                console.log(`[DEBUG DROPDOWN ${fieldName}] Has options:`, fieldDef.options.length);
                console.log(`[DEBUG DROPDOWN ${fieldName}] First 3 options:`, fieldDef.options.slice(0, 3));

                // Build lookup maps
                const valueToDisplay = {};
                const displayToValue = {};
                fieldDef.options.forEach(opt => {
                    valueToDisplay[opt.value] = opt.display;
                    displayToValue[opt.display] = opt.value;
                });

                // Value getter to convert ID to display name
                colDef.valueGetter = (params) => {
                    const id = params.data[fieldName];
                    const display = valueToDisplay[id] || id;
                    console.log(`[DEBUG DROPDOWN ${fieldName}] valueGetter: ${id} -> ${display}`);
                    return display;
                };

                // Editor: FastSelectEditor with display names (replaces slow native select)
                colDef.cellEditor = FastSelectEditor;
                colDef.cellEditorParams = {
                    values: fieldDef.options.map(opt => opt.display)
                };

                // Value setter to convert display name back to ID
                colDef.valueSetter = (params) => {
                    const displayName = params.newValue;
                    const id = displayToValue[displayName];
                    console.log(`[DEBUG DROPDOWN ${fieldName}] valueSetter: ${displayName} -> ${id}`);
                    if (id !== undefined) {
                        params.data[fieldName] = id;
                        return true;
                    }
                    return false;
                };

                // Add dropdown visual indicator
                colDef.cellRenderer = (params) => {
                    const value = params.value || '';
                    return `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 8px;">
                        <span>${value}</span>
                        <span style="color: #999; font-size: 12px;">▼</span>
                    </div>`;
                };

                // Add onCellEditingStarted callback to debug editor opening
                colDef.onCellEditingStarted = (params) => {
                    console.log(`[DEBUG DROPDOWN ${fieldName}] Cell editing STARTED`);
                    console.log(`[DEBUG DROPDOWN ${fieldName}]   Cell editor:`, params.cellEditor);
                    console.log(`[DEBUG DROPDOWN ${fieldName}]   Current value:`, params.value);
                };

                colDef.onCellEditingStopped = (params) => {
                    console.log(`[DEBUG DROPDOWN ${fieldName}] Cell editing STOPPED`);
                    console.log(`[DEBUG DROPDOWN ${fieldName}]   New value:`, params.value);
                };

                console.log(`[AG-Grid]   Configured ${fieldName} dropdown with ${fieldDef.options.length} options`);
            } else {
                // No dropdown options - just display human-readable names
                colDef.valueFormatter = (params) => {
                    return getLookupValue(fieldDef.lookup, params.value) || params.value;
                };
            }
        } else if (fieldDef.type === 'number' || fieldDef.type === 'numeric') {
            // Number editor with validation
            colDef.type = 'numericColumn';
            colDef.filter = 'agNumberColumnFilter';
            colDef.cellEditor = 'agNumberCellEditor';
            colDef.cellEditorParams = {
                min: fieldDef.min,
                max: fieldDef.max,
                precision: 0
            };
            // Validation
            colDef.valueSetter = (params) => {
                let newValue = parseInt(params.newValue);
                if (isNaN(newValue)) return false;
                if (fieldDef.min !== undefined && newValue < fieldDef.min) newValue = fieldDef.min;
                if (fieldDef.max !== undefined && newValue > fieldDef.max) newValue = fieldDef.max;
                params.data[fieldName] = newValue;
                return true;
            };
        } else if (fieldDef.type === 'text') {
            colDef.filter = 'agTextColumnFilter';
            colDef.cellEditor = 'agTextCellEditor';
        }

        columnDefs.push(colDef);
    });

    return columnDefs;
}

/**
 * Initialize AG-Grid roster table
 */
export function initializeAGGridRoster(app, container, players, visibleFields, displayNames, fieldCodes) {
    // Clear container
    container.innerHTML = '';

    // Create column definitions
    const columnDefs = createAGGridColumns(visibleFields, displayNames, fieldCodes, app);

    // Grid options
    const gridOptions = {
        theme: 'legacy', // Use legacy theming to work with ag-grid.css
        columnDefs: columnDefs,
        rowData: players,
        defaultColDef: {
            resizable: true,
            sortable: true,
            filter: true,
            editable: false,
            // Only set text color - let CSS handle row backgrounds
            cellStyle: (params) => {
                // When filtering by team, use team colors on row backgrounds via getRowStyle
                // Here we only set text color
                if (!app.selectedTeamId) {
                    // Main page - white text
                    return {
                        color: '#FFFFFF'
                    };
                }
                // Team-filtered page - white text
                return {
                    color: '#FFFFFF'
                };
            }
        },
        // Apply row background colors based on team filter
        getRowStyle: (params) => {
            // When filtering by a specific team, apply team color to row background
            if (app.selectedTeamId && params.data && params.data.TGID) {
                const teamAbbr = TEAM_MAPPINGS[params.data.TGID];
                const teamColors = TEAM_COLORS[teamAbbr];
                if (teamColors) {
                    return { backgroundColor: teamColors.primary };
                }
            }
            // For main page (all teams), use default CSS row backgrounds (dark theme)
            return null;
        },
        rowHeight: 70,
        headerHeight: 40,
        animateRows: false, // Disable for performance
        rowSelection: 'single',
        suppressRowClickSelection: false,
        enableCellTextSelection: true,
        suppressCellFocus: true, // Disable cell focus to prevent white highlight

        // Tooltips - enableBrowserTooltips required for headerTooltip to work
        enableBrowserTooltips: true,

        // Editing
        singleClickEdit: false,
        stopEditingWhenCellsLoseFocus: true,

        // Events
        onCellValueChanged: (event) => {
            console.log('[AG-Grid] Cell value changed:', event.colDef.field, '=', event.newValue);

            // Mark file as modified
            app.hasUnsavedChanges = true;
            app.updateSaveButton();

            // Update the original player object
            const rowIndex = event.node.rowIndex;
            const filteredIndex = app.paginatedPlayerIndices ? app.paginatedPlayerIndices[rowIndex] : rowIndex;
            const actualPlayer = app.filteredPlayers[filteredIndex];

            if (actualPlayer) {
                const fieldName = event.colDef.field;
                actualPlayer[fieldName] = event.newValue;

                // Find in main players array and update
                const playerIndex = app.players.findIndex(p => p === actualPlayer);
                if (playerIndex !== -1) {
                    app.players[playerIndex][fieldName] = event.newValue;
                }
            }
        },

        onRowClicked: (event) => {
            // Row number clicks handled separately via custom row header renderer
        },

        // Selection is handled purely by CSS using .ag-row-selected class
        // No custom onSelectionChanged handler needed

        onGridReady: (params) => {
            console.log('[AG-Grid] Grid ready, player count:', players.length);
            // Auto-size all columns to fit content
            params.api.autoSizeAllColumns(false);

            // Apply header colors
            applyHeaderColors(app, container);
        }
    };

    // Create grid
    const gridApi = createGrid(container, gridOptions);

    // Store reference
    app.agGrid = gridApi;
    app.agGridOptions = gridOptions;

    return gridApi;
}

/**
 * Apply header colors based on team selection
 */
export function applyHeaderColors(app, container) {
    console.log('[DEBUG applyHeaderColors] Function called');
    console.log('[DEBUG applyHeaderColors] app.selectedTeamId:', app.selectedTeamId);
    console.log('[DEBUG applyHeaderColors] app.filteredPlayers length:', app.filteredPlayers?.length);

    // Select ALL header-related elements including pinned and scrollable containers
    const headerElements = container.querySelectorAll(
        '.ag-header, .ag-header-row, .ag-header-viewport, .ag-header-container, ' +
        '.ag-header-cell, .ag-pinned-left-header, .ag-pinned-right-header, ' +
        '.ag-header-cell-comp-wrapper, .ag-header-group-cell'
    );
    console.log('[DEBUG applyHeaderColors] Found header elements:', headerElements.length);

    let bgColor, textColor;

    // Main page (all teams) - BLACK background, ORANGE text
    if (!app.selectedTeamId) {
        bgColor = '#000000';
        textColor = '#ffa726';
        console.log('[DEBUG applyHeaderColors] Using main page colors (black bg, orange text)');
    } else {
        // Team page - TEAM PRIMARY COLOR background, TEAM SECONDARY COLOR text
        // Get first player's team to determine team color
        const firstPlayer = app.filteredPlayers && app.filteredPlayers.length > 0 ? app.filteredPlayers[0] : null;
        console.log('[DEBUG applyHeaderColors] First player:', firstPlayer ? `TGID=${firstPlayer.TGID}` : 'null');

        if (firstPlayer && firstPlayer.TGID) {
            const teamAbbr = TEAM_MAPPINGS[firstPlayer.TGID];
            console.log('[DEBUG applyHeaderColors] Team abbreviation:', teamAbbr);

            const teamColors = TEAM_COLORS[teamAbbr];
            console.log('[DEBUG applyHeaderColors] Team colors:', teamColors);

            if (teamColors) {
                bgColor = teamColors.primary;  // TEAM PRIMARY COLOR background
                textColor = teamColors.secondary;  // TEAM SECONDARY COLOR text
                console.log('[DEBUG applyHeaderColors] Using team colors - BG:', bgColor, 'Text:', textColor);
            } else {
                // Fallback
                bgColor = '#000000';
                textColor = '#ffa726';
                console.log('[DEBUG applyHeaderColors] No team colors found, using fallback');
            }
        } else {
            // Fallback
            bgColor = '#000000';
            textColor = '#ffa726';
            console.log('[DEBUG applyHeaderColors] No first player, using fallback');
        }
    }

    // Inject dynamic CSS to override AG-Grid theme styles
    // This is needed because AG-Grid's CSS variables in .ag-theme-alpine have higher specificity
    const styleId = 'ag-grid-dynamic-header-colors';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
    }

    // Use highly specific CSS rules to override the theme
    styleEl.textContent = `
        #rosterGrid.ag-theme-alpine .ag-header,
        #rosterGrid.ag-theme-alpine .ag-header-viewport,
        #rosterGrid.ag-theme-alpine .ag-header-container,
        #rosterGrid.ag-theme-alpine .ag-header-row,
        #rosterGrid.ag-theme-alpine .ag-header-cell,
        #rosterGrid.ag-theme-alpine .ag-pinned-left-header,
        #rosterGrid.ag-theme-alpine .ag-pinned-right-header,
        #rosterGrid.ag-theme-alpine .ag-header-group-cell {
            background-color: ${bgColor} !important;
            background: ${bgColor} !important;
        }
        #rosterGrid.ag-theme-alpine .ag-header-cell-text,
        #rosterGrid.ag-theme-alpine .ag-header-cell-label {
            color: ${textColor} !important;
        }
    `;
    console.log('[DEBUG applyHeaderColors] Injected dynamic CSS with BG:', bgColor, 'Text:', textColor);

    // Also set CSS variables on container as backup
    container.style.setProperty('--ag-header-background-color', bgColor);
    container.style.setProperty('--ag-header-foreground-color', textColor);

    // Update selection colors CSS variables
    // For team pages, use team secondary color as selection background
    // For main page, use orange
    let selectionBgColor, selectionTextColor;
    if (!app.selectedTeamId) {
        // Main page - orange selection
        selectionBgColor = '#ffa726';
        selectionTextColor = '#000000';
    } else {
        // Team page - use team secondary color for selection
        const firstPlayer = app.filteredPlayers && app.filteredPlayers.length > 0 ? app.filteredPlayers[0] : null;
        if (firstPlayer && firstPlayer.TGID) {
            const teamAbbr = TEAM_MAPPINGS[firstPlayer.TGID];
            const teamColors = TEAM_COLORS[teamAbbr];
            if (teamColors) {
                selectionBgColor = teamColors.secondary;
                // Determine text color based on secondary color brightness
                // If secondary is dark (black), use white text; if light, use black text
                const isSecondaryDark = teamColors.secondary === '#000000' ||
                    teamColors.secondary.toLowerCase() === '#000' ||
                    teamColors.secondary === '#101820' ||
                    teamColors.secondary === '#1a1a1a';
                selectionTextColor = isSecondaryDark ? '#FFFFFF' : '#000000';
            } else {
                selectionBgColor = '#ffa726';
                selectionTextColor = '#000000';
            }
        } else {
            selectionBgColor = '#ffa726';
            selectionTextColor = '#000000';
        }
    }

    // Apply selection colors to CSS variables on the grid container
    container.style.setProperty('--selection-bg-color', selectionBgColor);
    container.style.setProperty('--selection-text-color', selectionTextColor);
    console.log(`[AG-Grid] Applied selection colors - BG: ${selectionBgColor}, Text: ${selectionTextColor}`);

    console.log(`[AG-Grid] Applied header colors - BG: ${bgColor}, Text: ${textColor}`);
}

/**
 * Update AG-Grid data (for filters/sorting/pagination)
 */
export function updateAGGridData(app, newPlayers) {
    if (app.agGrid) {
        app.agGrid.setGridOption('rowData', newPlayers);
    }
}

/**
 * Destroy AG-Grid
 */
export function destroyAGGrid(app) {
    if (app.agGrid) {
        app.agGrid.destroy();
        app.agGrid = null;
        app.agGridOptions = null;
    }
}
