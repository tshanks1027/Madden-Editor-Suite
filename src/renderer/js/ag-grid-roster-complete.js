/**
 * Complete AG-Grid Roster Table Implementation
 * Full replacement for Handsontable with all features
 */

import { createGrid, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import {
    getFieldDefinition,
    getLookupValue,
    TEAM_MAPPINGS,
    onBodyTypeChange,
    onWeightChange,
    storedWeightToActual,
    BODY_TYPE_NAMES
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
        const pam = player ? player.PEPS : null;

        // Check if this is a generic face based on PAM
        const isGenericPam = pam && typeof pam === 'string' &&
            (pam.startsWith('gen_') || pam.startsWith('plpo_generic_') || pam.includes('generic'));

        // Use PAM-based cache key for generic faces, PID-based for real faces
        const cacheKey = isGenericPam ? `pam_${pam}` : `pid_${pid}`;

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
            colDef.singleClickEdit = true; // Allow single click to edit
            console.log('[AG-Grid] PLAYERPIC column configured with', playerNames.length, 'player names');
        } else if (fieldDef.type === 'archetype') {
            console.log('[AG-Grid] Configuring ARCHETYPE column with position-dependent dropdown');

            // Archetype is position-dependent - options vary by player position
            // Store archetypes by position for quick lookup
            const archetypesByPosition = {};
            const archetypeIdToName = {};
            const archetypeNameToId = {};

            // Pre-load archetypes for all positions
            const positions = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
                'LEDG', 'REDG', 'DT', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS', 'K', 'P', 'LS'];

            // Load archetypes async during grid setup
            (async () => {
                for (const pos of positions) {
                    try {
                        const archetypes = await window.electronAPI.rating.getArchetypes(pos);
                        archetypesByPosition[pos] = archetypes;
                        // Build ID<->Name mappings
                        archetypes.forEach(arch => {
                            archetypeIdToName[arch.id] = arch.name;
                            archetypeNameToId[arch.name] = arch.id;
                        });
                    } catch (e) {
                        console.error(`[AG-Grid] Failed to load archetypes for ${pos}:`, e);
                    }
                }
                console.log('[AG-Grid] Archetypes loaded for all positions');
            })();

            // Position ID to name mapping for lookup
            const posIdToName = {
                0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C', 8: 'RG', 9: 'RT',
                10: 'LEDG', 11: 'REDG', 12: 'DT', 13: 'SAM', 14: 'Mike', 15: 'WILL', 16: 'CB', 17: 'FS', 18: 'SS',
                19: 'K', 20: 'P', 21: 'LS'
            };

            // Value getter: display archetype name from ARCHETYPE field or look up from PLTY
            colDef.valueGetter = (params) => {
                if (!params.data) return '';
                // Prefer pre-calculated ARCHETYPE display name
                if (params.data.ARCHETYPE) return params.data.ARCHETYPE;
                // Fall back to looking up from PLTY
                const archetypeId = params.data.PLTY;
                if (archetypeId !== undefined && archetypeId !== null) {
                    return archetypeIdToName[archetypeId] || `Archetype #${archetypeId}`;
                }
                return '';
            };

            // Value setter: convert archetype name back to ID and store in PLTY
            colDef.valueSetter = (params) => {
                const archetypeName = params.newValue;
                const archetypeId = archetypeNameToId[archetypeName];
                console.log(`[AG-Grid ARCHETYPE] valueSetter: "${archetypeName}" -> ID ${archetypeId}`);
                if (archetypeId !== undefined) {
                    params.data.PLTY = archetypeId;
                    params.data.ARCHETYPE = archetypeName; // Update display field too
                    return true;
                }
                return false;
            };

            // Custom cell editor that gets options based on player position
            colDef.cellEditorSelector = (params) => {
                const posId = params.data.PPOS;
                const posName = posIdToName[posId] || 'QB';
                const archetypes = archetypesByPosition[posName] || [];
                const values = archetypes.map(a => a.name);

                console.log(`[AG-Grid ARCHETYPE] Opening editor for position ${posName}, ${values.length} options`);

                return {
                    component: FastSelectEditor,
                    params: { values }
                };
            };

            colDef.editable = true;
            colDef.singleClickEdit = true;

            // Add dropdown visual indicator
            colDef.cellRenderer = (params) => {
                const value = params.value || '';
                return `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 8px;">
                    <span>${value}</span>
                    <span style="color: #999; font-size: 12px;">▼</span>
                </div>`;
            };

            console.log('[AG-Grid] ARCHETYPE column configured with position-dependent dropdown');
        } else if (fieldDef.type === 'lookup' && fieldDef.lookup) {
            // Extra debug for key fields
            if (['PROL', 'PCBT', 'PHAN'].includes(fieldName)) {
                console.log(`[AG-Grid] *** KEY LOOKUP COLUMN: ${fieldName} ***`);
            }
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
                colDef.singleClickEdit = true; // Open dropdown on single click

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

            // Apply display transform (e.g., PWGT: stored + 160 = displayed)
            if (fieldDef.transform && fieldDef.transform.display) {
                colDef.valueGetter = (params) => {
                    const rawValue = params.data[fieldName];
                    if (rawValue === undefined || rawValue === null) return rawValue;
                    return fieldDef.transform.display(rawValue);
                };
            }

            // Validation and save transform
            colDef.valueSetter = (params) => {
                let newValue = parseInt(params.newValue);
                if (isNaN(newValue)) return false;
                if (fieldDef.min !== undefined && newValue < fieldDef.min) newValue = fieldDef.min;
                if (fieldDef.max !== undefined && newValue > fieldDef.max) newValue = fieldDef.max;

                // Apply save transform (e.g., PWGT: displayed - 160 = stored)
                if (fieldDef.transform && fieldDef.transform.save) {
                    newValue = fieldDef.transform.save(newValue);
                }

                params.data[fieldName] = newValue;
                return true;
            };
        } else if (fieldDef.type === 'text') {
            colDef.filter = 'agTextColumnFilter';
            colDef.cellEditor = 'agTextCellEditor';
            colDef.editable = true;
            colDef.singleClickEdit = true; // Allow single click to edit text fields
            console.log(`[AG-Grid] Text column ${fieldName} configured with agTextCellEditor`);
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
        // Note: suppressCellFocus removed to allow cell focus for copy/paste

        // Tooltips - enableBrowserTooltips required for headerTooltip to work
        enableBrowserTooltips: true,

        // Editing
        singleClickEdit: false,
        stopEditingWhenCellsLoseFocus: true,

        // Events
        onCellEditingStarted: (event) => {
            console.log('[AG-Grid] onCellEditingStarted:', {
                field: event.colDef.field,
                value: event.value,
                editable: event.colDef.editable,
                cellEditor: event.colDef.cellEditor
            });
            // Capture OVR before editing so we can detect changes
            if (event.colDef.field === 'POVR') {
                event.node.data._previousOVR = event.value;
                console.log('[AG-Grid] Started editing OVR, captured previous:', event.value);
            }
        },

        onCellValueChanged: (event) => {
            console.log('[AG-Grid] Cell value changed:', event.colDef.field, '=', event.newValue, ', old=', event.oldValue);

            // Debug logging for key lookup fields
            const fieldName = event.colDef.field;
            if (['PHAN', 'PROL', 'PCBT'].includes(fieldName)) {
                console.log(`[AG-Grid DEBUG] ${fieldName} changed:`);
                console.log(`  event.newValue (display): ${event.newValue}`);
                console.log(`  event.data[${fieldName}] (stored ID): ${event.data[fieldName]}`);
                console.log(`  Player: ${event.data.PFNA} ${event.data.PLNA}`);
            }

            // Mark file as modified
            app.hasUnsavedChanges = true;
            const saveBtn = document.getElementById('saveRosterBtn');
            if (saveBtn) saveBtn.style.display = 'inline-block';

            // Update the original player object
            const rowIndex = event.node.rowIndex;
            const filteredIndex = app.paginatedPlayerIndices ? app.paginatedPlayerIndices[rowIndex] : rowIndex;
            const actualPlayer = app.filteredPlayers[filteredIndex];

            if (actualPlayer) {
                const fieldName = event.colDef.field;
                const fieldDef = getFieldDefinition(fieldName);

                // IMPORTANT: For fields with transforms (like PWGT), we need to get the stored value
                // BEFORE updating actualPlayer, because event.data may be the same reference
                let storedWeightForLinking = null;
                if (fieldName === 'PWGT' && fieldDef.transform && fieldDef.transform.save) {
                    // Get the stored value by applying the save transform to the displayed value
                    storedWeightForLinking = fieldDef.transform.save(parseInt(event.newValue));
                    console.log(`[AG-Grid] PWGT: displayed=${event.newValue}, stored=${storedWeightForLinking}`);
                }

                // Determine what value to store in player data
                // For lookup fields: use the ID from event.data (set by valueSetter)
                // For numeric fields with transforms: use the transformed (stored) value
                // For other fields: use event.newValue
                let valueToStore;
                if (fieldDef.type === 'lookup' || fieldDef.type === 'archetype') {
                    valueToStore = event.data[fieldName];
                } else if (fieldDef.transform && fieldDef.transform.save) {
                    // Numeric fields with transforms - store the transformed value
                    valueToStore = fieldDef.transform.save(parseInt(event.newValue));
                } else {
                    valueToStore = event.newValue;
                }

                actualPlayer[fieldName] = valueToStore;

                // Find in main players array and update
                const playerIndex = app.players.findIndex(p => p === actualPlayer);
                if (playerIndex !== -1) {
                    app.players[playerIndex][fieldName] = valueToStore;
                    // Debug logging for key fields
                    if (['PHAN', 'PROL', 'PCBT', 'PWGT'].includes(fieldName)) {
                        console.log(`[AG-Grid DEBUG] Updated app.players[${playerIndex}].${fieldName} = ${valueToStore}`);
                    }
                }

                // ========== BODY TYPE / WEIGHT LINKING ==========
                // When body type changes, update weight to match
                if (fieldName === 'PCBT') {
                    const newBodyType = valueToStore; // Numeric ID (0-4)
                    const position = actualPlayer.PPOS;
                    const newStoredWeight = onBodyTypeChange(newBodyType, position);
                    const newActualWeight = storedWeightToActual(newStoredWeight);

                    console.log(`[AG-Grid] Body type changed to ${BODY_TYPE_NAMES[newBodyType]} (${newBodyType}), auto-updating weight to ${newActualWeight} lbs (stored: ${newStoredWeight})`);

                    // Update weight in player data (stored value)
                    actualPlayer.PWGT = newStoredWeight;
                    event.data.PWGT = newStoredWeight;
                    if (playerIndex !== -1) {
                        app.players[playerIndex].PWGT = newStoredWeight;
                    }

                    // Refresh the weight cell to show updated value
                    event.api.refreshCells({
                        rowNodes: [event.node],
                        columns: ['PWGT'],
                        force: true
                    });
                }

                // When weight changes, update body type to match
                if (fieldName === 'PWGT' && storedWeightForLinking !== null) {
                    const position = actualPlayer.PPOS;
                    const newBodyType = onWeightChange(storedWeightForLinking, position);
                    const oldBodyType = actualPlayer.PCBT;
                    const actualWeight = storedWeightToActual(storedWeightForLinking);

                    console.log(`[AG-Grid] Weight changed: actual=${actualWeight}, stored=${storedWeightForLinking}, position=${position}, newBodyType=${newBodyType}, oldBodyType=${oldBodyType}`);

                    // Only update body type if it actually changed
                    if (newBodyType !== oldBodyType) {
                        console.log(`[AG-Grid] Auto-updating body type from ${BODY_TYPE_NAMES[oldBodyType] || oldBodyType} to ${BODY_TYPE_NAMES[newBodyType]}`);

                        // Update body type in player data
                        actualPlayer.PCBT = newBodyType;
                        event.data.PCBT = newBodyType;
                        if (playerIndex !== -1) {
                            app.players[playerIndex].PCBT = newBodyType;
                        }

                        // Refresh the body type cell to show updated value
                        event.api.refreshCells({
                            rowNodes: [event.node],
                            columns: ['PCBT'],
                            force: true
                        });
                    }
                }
                // ========== END BODY TYPE / WEIGHT LINKING ==========

                // Handle OVR changes - prompt to adjust ratings
                if (fieldName === 'POVR') {
                    console.log('[AG-Grid] POVR field changed, processing...');
                    const newOVR = parseInt(event.newValue);
                    // Get old value - try event.oldValue first, fallback to stored value
                    let oldOVR = parseInt(event.oldValue);
                    if (isNaN(oldOVR) && event.node.data._previousOVR !== undefined) {
                        oldOVR = event.node.data._previousOVR;
                        console.log('[AG-Grid] Using _previousOVR fallback:', oldOVR);
                    }
                    console.log('[AG-Grid] OVR change - old:', oldOVR, 'new:', newOVR);
                    if (!isNaN(newOVR) && newOVR >= 0 && newOVR <= 99) {
                        if (isNaN(oldOVR) || oldOVR !== newOVR) {
                            console.log('[AG-Grid] Calling handleAGGridOVRChange');
                            handleAGGridOVRChange(event.node, actualPlayer, oldOVR || 0, newOVR, app, event.api);
                        }
                    }
                }

                // If PLAYERPIC or PSXP changed, refresh the portrait column AND update race
                if (fieldName === 'PLAYERPIC' || fieldName === 'PSXP') {
                    const pid = actualPlayer.PSXP;
                    console.log('[AG-Grid] PID changed, refreshing portrait for PID:', pid);

                    // Update race for BLBM GENR/SKNT assignment when PID changes
                    if (pid && window.electronAPI && window.electronAPI.lookup && window.electronAPI.lookup.getRaceByPID) {
                        window.electronAPI.lookup.getRaceByPID(pid).then(race => {
                            if (race !== null) {
                                // Update the player's _race field for BLBM update on save
                                actualPlayer._race = race;
                                const playerIndex = app.players.findIndex(p => p === actualPlayer);
                                if (playerIndex !== -1) {
                                    app.players[playerIndex]._race = race;
                                }
                                console.log(`[AG-Grid] Updated _race to ${race} for PID ${pid}`);
                            }
                        }).catch(err => {
                            console.warn(`[AG-Grid] Could not get race for PID ${pid}:`, err);
                        });
                    }

                    // Load new portrait into cache
                    if (pid && window.electronAPI && window.electronAPI.portrait) {
                        const cacheKey = `pid_${pid}`;
                        window.electronAPI.portrait.getByPID(pid).then(imageData => {
                            if (imageData && imageData.length > 0) {
                                app.portraitCache.set(cacheKey, imageData);
                                console.log('[AG-Grid] Portrait cached for PID:', pid);
                            }
                            // Refresh portrait cell for this row
                            event.api.refreshCells({
                                rowNodes: [event.node],
                                columns: ['_portrait'],
                                force: true
                            });
                        }).catch(err => {
                            console.error('[AG-Grid] Error loading portrait:', err);
                            // Still refresh to show placeholder
                            event.api.refreshCells({
                                rowNodes: [event.node],
                                columns: ['_portrait'],
                                force: true
                            });
                        });
                    } else {
                        // No PID, refresh to clear portrait
                        event.api.refreshCells({
                            rowNodes: [event.node],
                            columns: ['_portrait'],
                            force: true
                        });
                    }
                }
            }
        },

        onRowClicked: (event) => {
            // Row number clicks handled separately via custom row header renderer
        },

        // Context menu handler for right-click
        onCellContextMenu: (event) => {
            event.event.preventDefault();

            const contextMenu = document.getElementById('grid-context-menu');
            if (!contextMenu) return;

            // Store the row data for later use
            contextMenu.dataset.rowIndex = event.rowIndex;
            contextMenu.dataset.editorType = 'roster';

            // Position the menu at the mouse location
            const mouseEvent = event.event;
            contextMenu.style.left = `${mouseEvent.clientX}px`;
            contextMenu.style.top = `${mouseEvent.clientY}px`;
            contextMenu.style.display = 'block';

            // Handle menu item clicks
            const handleMenuClick = (e) => {
                const action = e.target.closest('.context-menu-item')?.dataset.action;
                if (!action) return;

                const rowIndex = parseInt(contextMenu.dataset.rowIndex);

                if (action === 'delete-player') {
                    // Get the player from the event data (captured in closure)
                    const player = event.data;
                    console.log('[AG-Grid] Delete requested for player:', player);

                    if (!player) {
                        console.error('[AG-Grid] No player data found for deletion');
                        return;
                    }

                    const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim() || 'this player';

                    if (confirm(`Are you sure you want to delete ${playerName}?`)) {
                        // Find and remove from app.players array using a unique identifier
                        // Use multiple fields to ensure we find the right player
                        const playerIndex = app.players.findIndex(p =>
                            p === player ||
                            (p.PFNA === player.PFNA && p.PLNA === player.PLNA && p.TGID === player.TGID && p.PPOS === player.PPOS)
                        );

                        console.log('[AG-Grid] Found player at index:', playerIndex, 'of', app.players.length);

                        if (playerIndex !== -1) {
                            // Remove from main array
                            app.players.splice(playerIndex, 1);
                            console.log('[AG-Grid] Spliced player, remaining:', app.players.length);

                            // Also remove from filtered array
                            const filteredIndex = app.filteredPlayers.findIndex(p =>
                                p === player ||
                                (p.PFNA === player.PFNA && p.PLNA === player.PLNA && p.TGID === player.TGID && p.PPOS === player.PPOS)
                            );
                            if (filteredIndex !== -1) {
                                app.filteredPlayers.splice(filteredIndex, 1);
                            }

                            // Refresh the grid with updated data
                            app.agGrid.setGridOption('rowData', [...app.filteredPlayers]);

                            // Mark as modified
                            app.hasUnsavedChanges = true;
                            const saveBtn = document.getElementById('saveRosterBtn');
                            if (saveBtn) saveBtn.style.display = 'inline-block';

                            console.log('[AG-Grid] Player deleted successfully, remaining:', app.players.length);
                        } else {
                            console.error('[AG-Grid] Could not find player in array to delete');
                        }
                    }
                } else if (action === 'view-player-card') {
                    app.showPlayerCard(rowIndex);
                }

                // Hide menu
                contextMenu.style.display = 'none';
                contextMenu.removeEventListener('click', handleMenuClick);
            };

            contextMenu.addEventListener('click', handleMenuClick);

            // Hide menu when clicking elsewhere
            const hideMenu = (e) => {
                if (!contextMenu.contains(e.target)) {
                    contextMenu.style.display = 'none';
                    document.removeEventListener('click', hideMenu);
                    contextMenu.removeEventListener('click', handleMenuClick);
                }
            };
            setTimeout(() => document.addEventListener('click', hideMenu), 0);
        },

        // Selection is handled purely by CSS using .ag-row-selected class
        // No custom onSelectionChanged handler needed

        onGridReady: (params) => {
            console.log('[AG-Grid] Grid ready, player count:', players.length);
            // Auto-size all columns to fit content
            params.api.autoSizeAllColumns(false);

            // Apply header colors
            applyHeaderColors(app, container);

            // Copy/Paste handlers for spreadsheet-like functionality
            document.addEventListener('keydown', (e) => {
                // Only handle if grid container is focused or contains active element
                if (!container.contains(document.activeElement) &&
                    document.activeElement !== document.body) {
                    return;
                }

                // Guard against destroyed grid - check if API still exists and grid is not destroyed
                if (!params.api || params.api.isDestroyed?.()) {
                    return;
                }

                const focusedCell = params.api.getFocusedCell();
                if (!focusedCell) return;

                // Ctrl+C - Copy current cell value
                if (e.ctrlKey && e.key === 'c' && !e.shiftKey) {
                    const rowNode = params.api.getDisplayedRowAtIndex(focusedCell.rowIndex);
                    if (rowNode) {
                        const value = params.api.getValue(focusedCell.column, rowNode);
                        if (value !== null && value !== undefined) {
                            navigator.clipboard.writeText(String(value)).then(() => {
                                console.log('[AG-Grid] Copied:', value);
                            }).catch(err => console.error('[AG-Grid] Copy failed:', err));
                        }
                    }
                }

                // Ctrl+Shift+C - Copy entire row
                if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                    e.preventDefault();
                    const rowNode = params.api.getDisplayedRowAtIndex(focusedCell.rowIndex);
                    if (rowNode && rowNode.data) {
                        // Deep copy the row data
                        app.copiedRowData = JSON.parse(JSON.stringify(rowNode.data));
                        console.log('[AG-Grid] Copied entire row:', app.copiedRowData.firstName, app.copiedRowData.lastName);

                        // Visual feedback - briefly flash the row
                        const rowElement = document.querySelector(`[row-index="${focusedCell.rowIndex}"]`);
                        if (rowElement) {
                            rowElement.style.transition = 'background-color 0.2s';
                            const originalBg = rowElement.style.backgroundColor;
                            rowElement.style.backgroundColor = '#4CAF50';
                            setTimeout(() => {
                                rowElement.style.backgroundColor = originalBg;
                            }, 200);
                        }
                    }
                }

                // Ctrl+V - Paste (supports multi-row from spreadsheet)
                if (e.ctrlKey && e.key === 'v' && !e.shiftKey) {
                    e.preventDefault();

                    navigator.clipboard.readText().then(text => {
                        if (!text) return;

                        // Split by newlines (handles both \n and \r\n from spreadsheets)
                        const lines = text.split(/\r?\n/).filter(line => line !== '');

                        const startRowIndex = focusedCell.rowIndex;
                        const colId = focusedCell.column.getColId();
                        const colDef = focusedCell.column.getColDef();

                        // Only paste to editable columns
                        if (!colDef.editable) {
                            console.log('[AG-Grid] Column not editable:', colId);
                            return;
                        }

                        let pastedCount = 0;
                        const totalRows = params.api.getDisplayedRowCount();

                        // Paste each line to consecutive rows
                        lines.forEach((line, idx) => {
                            const targetRowIndex = startRowIndex + idx;
                            if (targetRowIndex >= totalRows) return;

                            const rowNode = params.api.getDisplayedRowAtIndex(targetRowIndex);
                            if (!rowNode) return;

                            // Handle tab-separated values (take first column only for single-column paste)
                            const value = line.split('\t')[0];

                            // Update the cell
                            rowNode.setDataValue(colId, value);
                            pastedCount++;

                            // Update the underlying player data
                            const filteredIndex = app.paginatedPlayerIndices ?
                                app.paginatedPlayerIndices[targetRowIndex] : targetRowIndex;
                            const actualPlayer = app.filteredPlayers[filteredIndex];
                            if (actualPlayer) {
                                actualPlayer[colId] = value;
                                const playerIndex = app.players.findIndex(p => p === actualPlayer);
                                if (playerIndex !== -1) {
                                    app.players[playerIndex][colId] = value;
                                }
                            }
                        });

                        if (pastedCount > 0) {
                            console.log('[AG-Grid] Pasted', pastedCount, 'cells');
                            app.hasUnsavedChanges = true;
                            // Show the save button (no updateSaveButton method, just DOM manipulation)
                            const saveBtn = document.getElementById('saveRosterBtn');
                            if (saveBtn) saveBtn.style.display = 'inline-block';
                            params.api.refreshCells({ force: true });
                        }
                    }).catch(err => console.error('[AG-Grid] Paste failed:', err));
                }

                // Ctrl+Shift+V - Paste entire row
                if (e.ctrlKey && e.shiftKey && e.key === 'V') {
                    e.preventDefault();

                    if (!app.copiedRowData) {
                        console.log('[AG-Grid] No row data copied');
                        return;
                    }

                    const rowNode = params.api.getDisplayedRowAtIndex(focusedCell.rowIndex);
                    if (!rowNode || !rowNode.data) return;

                    // Get the target row's underlying player data
                    const targetRowIndex = focusedCell.rowIndex;
                    const filteredIndex = app.paginatedPlayerIndices ?
                        app.paginatedPlayerIndices[targetRowIndex] : targetRowIndex;
                    const actualPlayer = app.filteredPlayers[filteredIndex];

                    if (!actualPlayer) {
                        console.log('[AG-Grid] Could not find target player');
                        return;
                    }

                    // Copy all properties except identity fields that should remain unique
                    const excludeFields = ['index', 'originalIndex', 'visuals', 'draftPosition'];
                    const copiedData = app.copiedRowData;

                    for (const key of Object.keys(copiedData)) {
                        if (excludeFields.includes(key)) continue;

                        // Update grid row data
                        rowNode.data[key] = copiedData[key];

                        // Update the actual player object
                        actualPlayer[key] = copiedData[key];

                        // Update in main players array
                        const playerIndex = app.players.findIndex(p => p === actualPlayer);
                        if (playerIndex !== -1) {
                            app.players[playerIndex][key] = copiedData[key];
                        }
                    }

                    // Refresh the grid to show changes
                    params.api.refreshCells({ rowNodes: [rowNode], force: true });

                    // Mark as modified
                    app.hasUnsavedChanges = true;
                    const saveBtn = document.getElementById('saveRosterBtn');
                    if (saveBtn) saveBtn.style.display = 'inline-block';

                    console.log('[AG-Grid] Pasted row data to row', targetRowIndex);

                    // Visual feedback - briefly flash the row
                    const rowElement = document.querySelector(`[row-index="${targetRowIndex}"]`);
                    if (rowElement) {
                        rowElement.style.transition = 'background-color 0.2s';
                        const originalBg = rowElement.style.backgroundColor;
                        rowElement.style.backgroundColor = '#2196F3';
                        setTimeout(() => {
                            rowElement.style.backgroundColor = originalBg;
                        }, 200);
                    }
                }
            });
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

/**
 * Handle OVR change in AG-Grid - prompt user to adjust ratings
 */
async function handleAGGridOVRChange(node, player, oldOVR, newOVR, app, gridApi) {
    console.log('[AG-Grid OVR] handleAGGridOVRChange called:', oldOVR, '->', newOVR);

    // Get position name from position ID
    const positionMap = {
        0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
        8: 'RG', 9: 'RT', 10: 'LE', 11: 'RE', 12: 'DT', 13: 'LOLB', 14: 'MLB',
        15: 'ROLB', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
    };
    const position = positionMap[player.PPOS] || 'QB';
    const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim() || 'Unknown Player';

    console.log('[AG-Grid OVR] Position:', position, 'Player:', playerName);

    // Build attributes object from the player
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
    const archetype = player.PLTY !== undefined ? player.PLTY : undefined;

    try {
        // Call the backend to calculate adjustments
        console.log('[AG-Grid OVR] Calling calculateOVRAdjustments...');
        const result = await window.electronAPI.rating.calculateOVRAdjustments(
            attributes, newOVR, position, archetype
        );
        console.log('[AG-Grid OVR] Result:', result);

        if (!result || Object.keys(result.adjustments).length === 0) {
            console.log('[AG-Grid OVR] No adjustments calculated');
            return;
        }

        // Show the adjustment dialog
        showAGGridOVRAdjustmentDialog(node, player, playerName, oldOVR, newOVR, result, app, gridApi);

    } catch (error) {
        console.error('[AG-Grid OVR] Error calculating adjustments:', error);
    }
}

/**
 * Show dialog asking user if they want to apply rating adjustments
 */
function showAGGridOVRAdjustmentDialog(node, player, playerName, oldOVR, newOVR, result, app, gridApi) {
    const { adjustments, newOVR: achievedOVR, archetype } = result;
    const delta = newOVR - oldOVR;
    const direction = delta > 0 ? 'increase' : 'decrease';

    // Build the adjustment list HTML
    let adjustmentHTML = '';
    const sortedAdjustments = Object.entries(adjustments)
        .sort((a, b) => b[1].weight - a[1].weight);

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
        <div id="ag-ovr-adjustment-modal" class="modal-overlay" style="z-index: 100001;">
            <div class="modal-content ovr-adjustment-modal">
                <div class="modal-header">
                    <h2>Adjust Ratings for OVR Change?</h2>
                    <button class="close-btn" onclick="document.getElementById('ag-ovr-adjustment-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p class="player-info">
                        <strong>${playerName}</strong> - ${archetype || 'Default Archetype'}
                    </p>
                    <p class="ovr-change">
                        OVR: <span class="old-ovr">${oldOVR}</span>
                        <span class="arrow">→</span>
                        <span class="new-ovr">${newOVR}</span>
                        <span class="${direction === 'increase' ? 'positive-change' : 'negative-change'}">
                            (${delta > 0 ? '+' : ''}${delta})
                        </span>
                    </p>
                    <p class="achieved-ovr">Achieved OVR with these adjustments: <strong>${achievedOVR}</strong></p>
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
                    <button id="ag-apply-adjustments-btn" class="ovr-dialog-btn ovr-dialog-btn-apply">Apply Adjustments</button>
                    <button id="ag-keep-ovr-only-btn" class="ovr-dialog-btn ovr-dialog-btn-keep">Keep OVR Only</button>
                    <button id="ag-cancel-ovr-btn" class="ovr-dialog-btn ovr-dialog-btn-cancel">Cancel</button>
                </div>
            </div>
        </div>
    `;

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('ag-ovr-adjustment-modal');

    // Apply adjustments handler
    document.getElementById('ag-apply-adjustments-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        applyAGGridOVRAdjustments(node, player, adjustments, app, gridApi);
        modal.remove();
    });

    // Keep OVR only handler (just close - OVR already changed)
    document.getElementById('ag-keep-ovr-only-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        modal.remove();
    });

    // Cancel handler - revert OVR to old value
    document.getElementById('ag-cancel-ovr-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        player.POVR = oldOVR;
        node.setDataValue('POVR', oldOVR);
        // Also update in app.players
        const playerIndex = app.players.findIndex(p => p === player);
        if (playerIndex !== -1) {
            app.players[playerIndex].POVR = oldOVR;
        }
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
 * Apply the calculated rating adjustments to the player in AG-Grid
 */
function applyAGGridOVRAdjustments(node, player, adjustments, app, gridApi) {
    const changes = [];

    for (const [fieldCode, adj] of Object.entries(adjustments)) {
        // Update player data
        player[fieldCode] = adj.suggested;

        // Update grid cell
        node.setDataValue(fieldCode, adj.suggested);

        // Update in app.players
        const playerIndex = app.players.findIndex(p => p === player);
        if (playerIndex !== -1) {
            app.players[playerIndex][fieldCode] = adj.suggested;
        }

        changes.push(`${adj.name}: ${adj.current} → ${adj.suggested}`);
    }

    console.log(`[AG-Grid OVR] Applied ${changes.length} rating changes:`, changes);

    // Refresh the affected cells
    if (gridApi) {
        gridApi.refreshCells({ rowNodes: [node], force: true });
    }
}
