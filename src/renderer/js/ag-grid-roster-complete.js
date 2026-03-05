/**
 * Complete AG-Grid Roster Table Implementation
 * Full replacement for Handsontable with all features
 */

import { createGrid, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import {
    getFieldDefinition,
    getLookupValue,
    getLookupOptions,
    TEAM_MAPPINGS,
    POSITION_MAPPINGS,
    onBodyTypeChange,
    onWeightChange,
    storedWeightToActual,
    BODY_TYPE_NAMES
} from '../data/field-definitions.js';
import { FastSelectEditor } from './FastSelectEditor.js';
import { getTeamById } from '../data/team-data.js';

// Flag to prevent recursive OVR change handling and skip OVR recalc during adjustment
let _isAdjustingOVR = false;

// Team colors for row styling
const TEAM_COLORS = {
    'ARI': { primary: '#97233F', secondary: '#FFB612' },  // Cardinals: Cardinal red / Gold
    'ATL': { primary: '#A71930', secondary: '#000000', headerText: '#FFFFFF' },  // Falcons: Red / Black, white header text
    'BAL': { primary: '#241773', secondary: '#9E7C0C', headerText: '#9E7C0C' },  // Ravens: Purple / Gold header, purple selection text
    'BUF': { primary: '#00338D', secondary: '#C60C30' },  // Bills: Royal blue / Red
    'CAR': { primary: '#0085CA', secondary: '#101820', headerText: '#FFFFFF' },  // Panthers: Process blue / Black, white header text
    'CHI': { primary: '#0B162A', secondary: '#C83803' },  // Bears: Navy / Orange (Matched team-data.js)
    'CIN': { primary: '#000000', secondary: '#FB4F14', headerText: '#FB4F14' },  // Bengals: Black / Orange (Swapped for dark header)
    'CLE': { primary: '#311D00', secondary: '#FF3C00' },  // Browns: Brown / Orange
    'DAL': { primary: '#003594', secondary: '#869397' },  // Cowboys: Navy blue / Silver
    'DEN': { primary: '#002244', secondary: '#FB4F14', headerText: '#FFFFFF' },  // Broncos: Navy / Orange (Swapped for dark header)
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
    'NO': { primary: '#101820', secondary: '#D3BC8D', headerText: '#D3BC8D' },   // Saints: Black / Old gold, gold header text
    'NYG': { primary: '#0B2265', secondary: '#A71930' },  // Giants: Blue / Red
    'NYJ': { primary: '#125740', secondary: '#FFFFFF' },  // Jets: Gotham green / White
    'PHI': { primary: '#004C54', secondary: '#A5ACAF' },  // Eagles: Midnight green / Silver
    'PIT': { primary: '#101820', secondary: '#FFB612', headerText: '#FFB612' },  // Steelers: Black / Gold, gold header text
    'SF': { primary: '#AA0000', secondary: '#B3995D' },   // 49ers: Red / Gold
    'SEA': { primary: '#002244', secondary: '#69BE28' },  // Seahawks: College navy / Action green
    'TB': { primary: '#D50A0A', secondary: '#FF7900' },   // Buccaneers: Red / Pewter orange
    'TEN': { primary: '#00295B', secondary: '#4B92DB', headerText: '#4B92DB', selectionText: '#C8102E' },  // Titans: Navy / Baby blue header, red selection text
    'WAS': { primary: '#5A1438', secondary: '#FFB612' },  // Commanders: Burgundy / Gold
    'FA': { primary: '#002244', secondary: '#C60C30', headerText: '#C60C30' }   // Free Agents: Blue bg / Red header, blue selection text
};

// Register AG-Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Portrait Cell Renderer - shows player portraits with click-to-view-card
 */
class PortraitCellRenderer {
    init(params) {
        this.params = params;
        this.app = params.app;
        this.eGui = document.createElement('div');
        this.renderContent();
    }

    renderContent() {
        const params = this.params;
        const app = this.app;
        // CRITICAL: Always read fresh data from params.data, not a stale closure
        const player = params.data;
        const pid = player ? player.PSXP : null;

        this.eGui.className = 'portrait-cell';
        this.eGui.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            cursor: pointer;
            padding: 2px;
            position: relative;
        `;
        this.eGui.innerHTML = ''; // Clear previous content

        // Portrait display: ALWAYS use PID-based lookup
        // PAM (PEPS) only affects in-game face model, not displayed portrait
        // This allows users to set generic PAM while keeping real player portraits
        const hasValidPid = pid && pid > 0;
        const cacheKey = hasValidPid ? `pid_${pid}` : `pid_0`;

        const hasCache = app.portraitCache.has(cacheKey);
        const imageData = hasCache ? app.portraitCache.get(cacheKey) : null;
        const isLoading = imageData === 'loading';
        const hasData = imageData && imageData !== 'loading' && imageData.length > 100;

        // Debug log for first 10 rows
        if (params.node.rowIndex < 10) {
            console.log(`[CellRenderer] Row ${params.node.rowIndex} PID ${pid}: cache=${hasCache}, loading=${isLoading}, hasData=${hasData}, dataLen=${imageData ? imageData.length : 0}`);
        }

        if (hasData) {
            const img = document.createElement('img');
            img.src = imageData;
            img.style.cssText = 'width: 64px; height: 64px; object-fit: cover; cursor: context-menu;';
            img.alt = 'Player Portrait';
            this.eGui.appendChild(img);
        } else {
            this.eGui.innerHTML = '<div style="width:64px;height:64px;background:#333;display:flex;align-items:center;justify-content:center;font-size:32px;">👤</div>';
        }

        // Check for injury status by looking up PGID in the INJY table
        // Injuries are stored in separate INJY table, linked by PGID field
        const pgid = player ? player.PGID : null;
        const isInjured = pgid && app.injuredPGIDs && app.injuredPGIDs.has(pgid);

        if (isInjured) {
            const injuryIcon = document.createElement('div');
            injuryIcon.className = 'injury-indicator';
            injuryIcon.innerHTML = '🏥';
            injuryIcon.title = `Injured (PGID: ${pgid})`;
            injuryIcon.style.cssText = `
                position: absolute;
                bottom: 4px;
                right: 4px;
                background: rgba(220, 53, 69, 0.9);
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                cursor: help;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            `;
            this.eGui.appendChild(injuryIcon);
        }

        // Click handler to show player card - use arrow function to get fresh data
        this.eGui.onclick = () => {
            const currentPlayer = this.params.data;
            if (currentPlayer) {
                app.openPlayerCard(currentPlayer, this.params.node.rowIndex);
            }
        };

        // Right-click context menu for face picker - use arrow function to get fresh data
        this.eGui.oncontextmenu = (e) => {
            e.preventDefault();
            const currentPlayer = this.params.data;
            if (currentPlayer) {
                app.openGenericFacePicker(currentPlayer, this.params.node.rowIndex);
            }
        };
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        // Update params reference and re-render with fresh data
        this.params = params;
        this.renderContent();
        return true; // Tell AG-Grid we handled the refresh
    }

    destroy() {
        // Cleanup event handlers
        if (this.eGui) {
            this.eGui.onclick = null;
            this.eGui.oncontextmenu = null;
        }
    }
}

/**
 * PAM Cell Renderer - shows PAM value with right-click to open PAM picker
 */
class PAMCellRenderer {
    init(params) {
        const { app } = params;

        this.eGui = document.createElement('div');
        this.eGui.className = 'pam-cell';
        this.eGui.style.cssText = `
            display: flex;
            align-items: center;
            height: 100%;
            cursor: context-menu;
            padding: 0 8px;
            font-size: 12px;
            color: #e0e0e0;
        `;

        const player = params.data;
        const pamValue = player ? player.PEPS : null;

        this.eGui.textContent = pamValue || '';
        this.eGui.title = 'Right-click to select generic PAM';

        // Right-click context menu for PAM picker
        this.eGui.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (player && app && app.openPAMPicker) {
                app.openPAMPicker(player, params.node.rowIndex);
            }
        });
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        const player = params.data;
        const pamValue = player ? player.PEPS : null;
        this.eGui.textContent = pamValue || '';
        return true;
    }

    destroy() {
        // Cleanup
    }
}

/**
 * Player Name Cell Renderer - shows initials circle + full name (V2 mockup style)
 * Uses CSS classes from roster-editor-v2.css
 */
class PlayerNameCellRenderer {
    init(params) {
        const player = params.data;
        const firstName = player?.PFNA || '';
        const lastName = player?.PLNA || '';
        const initials = `${firstName.charAt(0) || ''}${lastName.charAt(0) || ''}`.toUpperCase() || '??';

        this.eGui = document.createElement('div');
        this.eGui.className = 'player-cell-v2';

        this.eGui.innerHTML = `
            <div class="player-avatar-v2">${initials}</div>
            <span class="player-name-v2">${firstName} ${lastName}</span>
        `;
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        return false;
    }
}

/**
 * OVR Cell Renderer - color-coded overall rating (V2 mockup style)
 * Uses CSS classes from roster-editor-v2.css
 */
class OVRCellRenderer {
    init(params) {
        const ovr = parseInt(params.value) || 0;

        this.eGui = document.createElement('span');
        this.eGui.className = 'ovr-cell-v2 ' + this.getOvrClass(ovr);
        this.eGui.textContent = ovr.toString();
    }

    getOvrClass(ovr) {
        if (ovr >= 90) return 'elite';   // Bright green
        if (ovr >= 80) return 'good';    // Yellow-green
        if (ovr >= 70) return 'avg';     // Yellow
        if (ovr >= 60) return 'below';   // Orange
        return 'poor';                    // Red
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        const ovr = parseInt(params.value) || 0;
        this.eGui.className = 'ovr-cell-v2 ' + this.getOvrClass(ovr);
        this.eGui.textContent = ovr.toString();
        return true;
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

        // Click handler to show player card - pass actual player data, not index
        const player = params.data;
        this.eGui.addEventListener('click', () => {
            if (player) {
                app.openPlayerCard(player, params.node.rowIndex);
            }
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
            // Check editable property from field definitions (default to true for most fields)
            editable: fieldDef.editable !== false,
            singleClickEdit: true, // Enable single-click editing for all columns
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
            // Note: cellRenderer set after type handling to avoid being overwritten
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
                const pid = parseInt(params.data.PSXP) || 0;
                if (!pid) return null;

                // First check if PID exists in the lookup
                const playerName = pidMap.get(pid);
                if (playerName) {
                    return playerName;
                }

                // Custom portrait PIDs (12000+) or unknown PIDs - use player's actual name
                const CUSTOM_PORTRAIT_PID_START = 12000;
                if (pid >= CUSTOM_PORTRAIT_PID_START) {
                    const lastName = params.data.PLNA || '';
                    const firstName = params.data.PFNA || '';
                    if (lastName || firstName) {
                        return `${lastName}, ${firstName}`;
                    }
                    return `Custom (${pid})`;
                }

                // Unknown PID not in lookup - show the PID number
                return `PID: ${pid}`;
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

            // CRITICAL: Prevent AG-Grid from intercepting keyboard events during editing
            // Without this, AG-Grid may eat keypress/input events
            colDef.suppressKeyboardEvent = (params) => {
                // When editing, suppress ALL keyboard events so they go to the editor input
                return params.editing;
            };

            // FIX: Add filter support for PLAYERPIC column
            // filterValueGetter uses the same logic as valueGetter so searches work on player names
            colDef.filter = 'agTextColumnFilter';
            colDef.filterValueGetter = (params) => {
                if (!params.data) return null;
                const pid = parseInt(params.data.PSXP) || 0;
                if (!pid) return null;
                const playerName = pidMap.get(pid);
                if (playerName) return playerName;
                // Custom portrait PIDs or unknown - return player's name
                const CUSTOM_PORTRAIT_PID_START = 12000;
                if (pid >= CUSTOM_PORTRAIT_PID_START) {
                    const lastName = params.data.PLNA || '';
                    const firstName = params.data.PFNA || '';
                    if (lastName || firstName) return `${lastName}, ${firstName}`;
                    return `Custom (${pid})`;
                }
                return `PID: ${pid}`;
            };

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
            // NOTE: PLTY is what franchise reads (PLTY is the archetype field)
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

                console.log(`[AG-Grid]   Configured ${fieldName} dropdown with ${fieldDef.options.length} options`);
            } else {
                // No inline options - use getLookupOptions() to build lookup maps dynamically
                // This ensures State, Position, College, etc. display properly when players are added
                const lookupOptions = getLookupOptions(fieldDef.lookup);
                const valueToDisplay = {};
                const displayToValue = {};
                lookupOptions.forEach(opt => {
                    valueToDisplay[opt.value] = opt.label;
                    displayToValue[opt.label] = opt.value;
                });

                console.log(`[AG-Grid] Dynamic lookup ${fieldName} (${fieldDef.lookup}): ${lookupOptions.length} options`);

                // Value getter to convert ID to display name (CRITICAL: ensures proper display)
                colDef.valueGetter = (params) => {
                    const id = params.data[fieldName];
                    const display = valueToDisplay[id];
                    // Return display name if found, otherwise return raw value
                    return display !== undefined ? display : id;
                };

                // Make editable with dropdown if options exist and field is editable
                if (lookupOptions.length > 0 && !fieldDef.readOnly) {
                    colDef.editable = true;
                    colDef.singleClickEdit = true;
                    colDef.cellEditor = FastSelectEditor;
                    colDef.cellEditorParams = {
                        values: lookupOptions.map(opt => opt.label)
                    };

                    // Value setter to convert display name back to ID
                    colDef.valueSetter = (params) => {
                        const displayName = params.newValue;
                        const id = displayToValue[displayName];
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
                }
            }
        } else if (fieldDef.type === 'number' || fieldDef.type === 'numeric') {
            // Number editor with validation
            colDef.type = 'numericColumn';
            colDef.filter = 'agNumberColumnFilter';
            colDef.cellEditor = 'agNumberCellEditor';
            colDef.editable = true; // Enable editing for numeric columns
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

        // PAM (PEPS) column - add right-click for PAM picker AFTER type handling
        // This must come after text type handling to not be overwritten
        if (fieldName === 'PEPS') {
            colDef.cellRenderer = PAMCellRenderer;
            colDef.cellRendererParams = { app };
            console.log('[AG-Grid] PEPS column configured with PAMCellRenderer for right-click picker');
        }

        // OVR (POVR) column - color-coded overall rating
        if (fieldName === 'POVR') {
            colDef.cellRenderer = OVRCellRenderer;
            console.log('[AG-Grid] POVR column configured with OVRCellRenderer');
        }

        // CRITICAL: Ensure every editable column has a cellEditor
        // AG-Grid v34 may not provide default editors automatically
        if (colDef.editable && !colDef.cellEditor && !colDef.cellEditorSelector) {
            // Determine appropriate editor based on field type
            if (fieldDef.type === 'numeric' || fieldDef.type === 'number') {
                colDef.cellEditor = 'agNumberCellEditor';
                colDef.cellEditorParams = {
                    min: fieldDef.min,
                    max: fieldDef.max,
                    precision: 0
                };
            } else {
                colDef.cellEditor = 'agTextCellEditor';
            }
            console.log(`[AG-Grid] Added default ${colDef.cellEditor} to editable column ${fieldName}`);
        }

        columnDefs.push(colDef);
    });

    return columnDefs;
}

/**
 * Initialize AG-Grid roster table
 */
export function initializeAGGridRoster(app, container, players, visibleFields, displayNames, fieldCodes) {
    // CRITICAL: Clean up any orphaned FastSelectEditor dropdowns
    // These can block clicks if not properly removed when the editor is destroyed
    const orphanedDropdowns = document.querySelectorAll('.fast-select-editor__dropdown');
    if (orphanedDropdowns.length > 0) {
        console.log('[AG-Grid] Cleaning up', orphanedDropdowns.length, 'orphaned dropdown(s)');
        orphanedDropdowns.forEach(dropdown => {
            if (dropdown.parentNode) {
                dropdown.parentNode.removeChild(dropdown);
            }
        });
    }

    // Also clean up any orphaned OVR modals that might be blocking
    const orphanedModals = document.querySelectorAll('#ag-ovr-adjustment-modal');
    if (orphanedModals.length > 0) {
        console.log('[AG-Grid] Cleaning up', orphanedModals.length, 'orphaned modal(s)');
        orphanedModals.forEach(modal => modal.remove());
    }

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
            editable: true, // Enable editing by default - columns can override to false
            singleClickEdit: true, // Enable single-click editing globally
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
        // CRITICAL: Use singleClickEdit: true globally for consistent behavior
        // This prevents the timing issue where clicking cell B while editing cell A
        // causes the edit stop to interfere with the new edit start
        singleClickEdit: true,
        stopEditingWhenCellsLoseFocus: true,

        // Events

        // Handle cell editing stopped - ensure focus returns to grid for seamless editing flow
        onCellEditingStopped: (event) => {
            console.log('[AG-Grid] Cell editing stopped:', event.colDef?.field);
            // Use setTimeout to allow the click event to complete before restoring focus
            setTimeout(() => {
                const activeEl = document.activeElement;
                const gridEl = container.querySelector('.ag-root-wrapper');
                // If focus is lost (on body or outside container), restore it to the grid
                if (activeEl === document.body || !container.contains(activeEl)) {
                    if (gridEl) {
                        // ACTUALLY restore focus - the old code just logged
                        gridEl.setAttribute('tabindex', '0');
                        gridEl.focus();
                        console.log('[AG-Grid] Focus restored to grid after edit');
                    }
                }
            }, 50);
        },

        // Handle cell clicks - manually start editing if cell is editable
        onCellClicked: (event) => {
            console.log('[AG-Grid] CELL CLICKED:', {
                field: event.colDef?.field,
                editable: event.colDef?.editable,
                singleClickEdit: event.colDef?.singleClickEdit,
                cellEditor: event.colDef?.cellEditor,
                value: event.value,
                rowIndex: event.rowIndex
            });

            // WORKAROUND: Manually start editing if the column is editable
            // BUT skip if column already has singleClickEdit (to avoid double-edit)
            // AG-Grid v34 may not automatically start editing on single click for some columns
            if (event.colDef?.editable && !event.colDef?.singleClickEdit) {
                console.log('[AG-Grid] Starting edit manually for:', event.colDef.field);
                event.api.startEditingCell({
                    rowIndex: event.rowIndex,
                    colKey: event.colDef.field
                });
            }
        },

        // Handle sort changes - let AG-Grid handle sorting, just track state
        onSortChanged: (event) => {
            // Just store the sort state for persistence - let AG-Grid handle actual sorting
            const sortModel = event.api.getColumnState().filter(c => c.sort);
            console.log('[AG-Grid] onSortChanged:', sortModel);

            if (sortModel.length === 0) {
                app.sortColumns = [];
            } else {
                const sortCol = sortModel[0];
                app.sortColumns = [{ column: sortCol.colId, order: sortCol.sort }];
                console.log(`[AG-Grid] Sort state stored: ${sortCol.colId} ${sortCol.sort}`);
            }
            // Don't call renderRoster() - let AG-Grid handle sorting internally
            // This prevents the grid from being destroyed and recreated
        },

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
            // Use event.node.data as fallback - paginatedPlayerIndices may be stale when players added via applyTransaction
            const actualPlayer = app.filteredPlayers?.[filteredIndex] || event.node.data;

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

                // CRITICAL FIX: Find in main players array and update
                // First try by reference (fast), then fallback to PGID (reliable)
                let playerIndex = app.players.findIndex(p => p === actualPlayer);

                // CRITICAL: If reference equality fails (common after imports), find by PGID
                if (playerIndex === -1 && actualPlayer.PGID !== undefined) {
                    playerIndex = app.players.findIndex(p => p.PGID === actualPlayer.PGID);
                    if (playerIndex !== -1) {
                        console.log(`[AG-Grid] Found player by PGID fallback: ${actualPlayer.PFNA} ${actualPlayer.PLNA} (PGID: ${actualPlayer.PGID})`);
                    }
                }

                if (playerIndex !== -1) {
                    app.players[playerIndex][fieldName] = valueToStore;
                    // Debug logging for key fields
                    if (['PHAN', 'PROL', 'PCBT', 'PWGT', 'POVR', 'PEPS'].includes(fieldName)) {
                        console.log(`[AG-Grid DEBUG] Updated app.players[${playerIndex}].${fieldName} = ${valueToStore}`);
                    }
                } else {
                    // CRITICAL: Player not found in app.players - this is a bug that causes data loss!
                    console.error(`[AG-Grid] *** CRITICAL: Player ${actualPlayer.PFNA} ${actualPlayer.PLNA} NOT FOUND in app.players! Edit will NOT be saved! ***`);
                    console.error(`[AG-Grid] Player PGID: ${actualPlayer.PGID}, app.players.length: ${app.players.length}`);
                    // Force add the actualPlayer to app.players to prevent data loss
                    app.players.push(actualPlayer);
                    console.log(`[AG-Grid] Added missing player to app.players (now ${app.players.length} players)`);
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

                // ========== AUTO-RECALCULATE OVR WHEN RATINGS CHANGE ==========
                const ratingFields = ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PJMP', 'PAWR', 'PBCV', 'PCAR', 'PCTH',
                    'PTHP', 'PTAS', 'PTAM', 'PTAD', 'PTOR', 'PTUP', 'PPLA', 'PBSK',
                    'PPBK', 'PRBK', 'PLBK', 'PLIB', 'PPBF', 'PPBS', 'PRBF', 'PRBS',
                    'PTAK', 'PLHT', 'PLMC', 'PLZC', 'PLPR', 'PLPU', 'PLPM', 'PFMS',
                    'PBSG', 'PLPE', 'PBKT', 'PLTR', 'PELU', 'PLJM', 'PLSM', 'PLSA',
                    'PLSC', 'PLCI', 'PLRL', 'PDRR', 'PMRR', 'SRRN', 'PKPR', 'PKAC', 'PKRT',
                    'PSTA', 'PINJ', 'PTGH'];

                // Skip OVR recalculation if we're in the middle of adjusting ratings for a target OVR
                // (the _isAdjustingOVR flag is set by handleAGGridOVRChange)
                console.log(`[AG-Grid DEBUG] Rating change check: field=${fieldName}, isRating=${ratingFields.includes(fieldName)}, changed=${event.newValue !== event.oldValue}, _isAdjustingOVR=${_isAdjustingOVR}`);
                if (ratingFields.includes(fieldName) && event.newValue !== event.oldValue && !_isAdjustingOVR) {
                    console.log(`[AG-Grid] Rating field ${fieldName} changed from ${event.oldValue} to ${event.newValue}, recalculating OVR...`);

                    // Build attributes from player data
                    const attributes = {};
                    for (const field of ratingFields) {
                        if (actualPlayer[field] !== undefined) {
                            attributes[field] = parseInt(actualPlayer[field]) || 50;
                        }
                    }

                    // Debug: log key rating values being used
                    console.log(`[AG-Grid OVR DEBUG] Key ratings for recalc: PPBK=${attributes.PPBK}, PPBF=${attributes.PPBF}, PPBS=${attributes.PPBS}, PAWR=${attributes.PAWR}`);

                    // Get position name
                    const positionId = actualPlayer.PPOS;
                    const positionName = POSITION_MAPPINGS[positionId] || 'QB';

                    // Calculate OVR using BEST archetype (matches what game does)
                    // The game auto-assigns the archetype that produces the highest OVR
                    console.log(`[AG-Grid] Calculating OVR for ALL archetypes of ${positionName} to find best match...`);
                    if (window.electronAPI && window.electronAPI.rating && window.electronAPI.rating.calculateOVRForArchetypes) {
                        window.electronAPI.rating.calculateOVRForArchetypes(attributes, positionName)
                            .then(results => {
                                if (!results || results.length === 0) {
                                    console.error('[AG-Grid] No archetypes returned for position:', positionName);
                                    return;
                                }

                                // Results are sorted by OVR descending - first is the best
                                const bestArchetype = results[0];
                                const newOVR = bestArchetype.ovr;
                                const newArchetypeId = bestArchetype.id;
                                const newArchetypeName = bestArchetype.name;

                                const oldOVR = parseInt(actualPlayer.POVR) || 50;
                                const oldArchetypeId = actualPlayer.PLTY;
                                const displayedOVR = parseInt(event.data.POVR) || 50;

                                console.log(`[AG-Grid] Best archetype: ${newArchetypeName} (ID: ${newArchetypeId}) with OVR: ${newOVR}`);
                                console.log(`[AG-Grid] OVR change: ${displayedOVR} → ${newOVR}, Archetype: ${oldArchetypeId} → ${newArchetypeId}`);

                                // Update OVR in ALL data sources
                                actualPlayer.POVR = newOVR;
                                event.data.POVR = newOVR;
                                if (playerIndex !== -1) {
                                    app.players[playerIndex].POVR = newOVR;
                                }

                                // Also update archetype if it changed
                                if (newArchetypeId !== oldArchetypeId) {
                                    console.log(`[AG-Grid] Auto-updating archetype: ${oldArchetypeId} → ${newArchetypeId} (${newArchetypeName})`);
                                    actualPlayer.PLTY = newArchetypeId;
                                    actualPlayer.ARCHETYPE = newArchetypeName;
                                    event.data.PLTY = newArchetypeId;
                                    event.data.ARCHETYPE = newArchetypeName;
                                    if (playerIndex !== -1) {
                                        app.players[playerIndex].PLTY = newArchetypeId;
                                        app.players[playerIndex].ARCHETYPE = newArchetypeName;
                                    }
                                }

                                // Also update filteredPlayers
                                const filteredIdx = app.filteredPlayers ? app.filteredPlayers.findIndex(p =>
                                    (p.PFNA === actualPlayer.PFNA && p.PLNA === actualPlayer.PLNA) || p === actualPlayer
                                ) : -1;
                                if (filteredIdx !== -1 && app.filteredPlayers) {
                                    app.filteredPlayers[filteredIdx].POVR = newOVR;
                                    if (newArchetypeId !== oldArchetypeId) {
                                        app.filteredPlayers[filteredIdx].PLTY = newArchetypeId;
                                        app.filteredPlayers[filteredIdx].ARCHETYPE = newArchetypeName;
                                    }
                                }

                                // Refresh the OVR and archetype cells in the grid
                                const columnsToRefresh = ['POVR'];
                                if (newArchetypeId !== oldArchetypeId) {
                                    columnsToRefresh.push('PLTY');
                                }
                                event.api.refreshCells({
                                    rowNodes: [event.node],
                                    columns: columnsToRefresh,
                                    force: true
                                });

                                // Also update the card view OVR display
                                const cardOvrEl = document.getElementById('cardPlayerOVR');
                                if (cardOvrEl) {
                                    cardOvrEl.textContent = newOVR;
                                }

                                // Update currentPlayerCardData if it exists
                                if (app.currentPlayerCardData) {
                                    app.currentPlayerCardData.POVR = newOVR;
                                    if (newArchetypeId !== oldArchetypeId) {
                                        app.currentPlayerCardData.PLTY = newArchetypeId;
                                        app.currentPlayerCardData.ARCHETYPE = newArchetypeName;
                                    }
                                }
                            })
                            .catch(err => {
                                console.error('[AG-Grid] OVR calculation FAILED:', err);
                            });
                    } else {
                        console.error('[AG-Grid] calculateOVRForArchetypes API not available!');
                    }
                }
                // ========== END AUTO-RECALCULATE OVR ==========

                // ========== ARCHETYPE CHANGE → ADJUST RATINGS ==========
                if (fieldName === 'PLTY' || fieldName === 'ARCHETYPE') {
                    const positionId = actualPlayer.PPOS;
                    const positionName = POSITION_MAPPINGS[positionId] || 'QB';
                    const newArchetypeId = actualPlayer.PLTY;
                    const currentOVR = parseInt(actualPlayer.POVR) || 75;

                    // Get archetype name for the new ID
                    if (window.electronAPI && window.electronAPI.rating && window.electronAPI.rating.getArchetypeName) {
                        window.electronAPI.rating.getArchetypeName(newArchetypeId, positionName)
                            .then(archetypeName => {
                                console.log(`[AG-Grid] Archetype changed to ${archetypeName} (${newArchetypeId}), adjusting ratings...`);

                                // Call adjustAttributesForArchetype to get suggested ratings
                                if (window.electronAPI.rating.adjustAttributesForArchetype) {
                                    window.electronAPI.rating.adjustAttributesForArchetype(actualPlayer, archetypeName, positionName, currentOVR)
                                        .then(adjustedPlayer => {
                                            if (adjustedPlayer) {
                                                // List of rating fields to potentially update
                                                const ratingFieldsToUpdate = ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PJMP', 'PAWR', 'PBCV', 'PCAR', 'PCTH',
                                                    'PTHP', 'PTAS', 'PTAM', 'PTAD', 'PTOR', 'PTUP', 'PPLA', 'PBSK',
                                                    'PPBK', 'PRBK', 'PLBK', 'PLIB', 'PPBF', 'PPBS', 'PRBF', 'PRBS',
                                                    'PTAK', 'PLHT', 'PLMC', 'PLZC', 'PLPR', 'PLPU', 'PLPM', 'PFMS',
                                                    'PBSG', 'PLPE', 'PBKT', 'PLTR', 'PELU', 'PLJM', 'PLSM', 'PLSA',
                                                    'PLSC', 'PLCI', 'PLRL', 'PDRR', 'PMRR', 'SRRN', 'PKPR', 'PKAC', 'PKRT'];

                                                const changedColumns = [];
                                                for (const field of ratingFieldsToUpdate) {
                                                    if (adjustedPlayer[field] !== undefined && adjustedPlayer[field] !== actualPlayer[field]) {
                                                        actualPlayer[field] = adjustedPlayer[field];
                                                        event.data[field] = adjustedPlayer[field];
                                                        if (playerIndex !== -1) {
                                                            app.players[playerIndex][field] = adjustedPlayer[field];
                                                        }
                                                        changedColumns.push(field);
                                                    }
                                                }

                                                // Also update OVR if changed
                                                if (adjustedPlayer.POVR !== undefined && adjustedPlayer.POVR !== actualPlayer.POVR) {
                                                    actualPlayer.POVR = adjustedPlayer.POVR;
                                                    event.data.POVR = adjustedPlayer.POVR;
                                                    if (playerIndex !== -1) {
                                                        app.players[playerIndex].POVR = adjustedPlayer.POVR;
                                                    }
                                                    changedColumns.push('POVR');
                                                }

                                                if (changedColumns.length > 0) {
                                                    console.log(`[AG-Grid] Updated ${changedColumns.length} fields for archetype ${archetypeName}`);
                                                    event.api.refreshCells({
                                                        rowNodes: [event.node],
                                                        columns: changedColumns,
                                                        force: true
                                                    });
                                                }
                                            }
                                        })
                                        .catch(err => {
                                            console.warn('[AG-Grid] Could not adjust ratings for archetype:', err);
                                        });
                                }
                            })
                            .catch(err => {
                                console.warn('[AG-Grid] Could not get archetype name:', err);
                            });
                    }
                }
                // ========== END ARCHETYPE CHANGE ==========

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

                    // Load new portrait into cache (only if not already cached)
                    if (pid && window.electronAPI && window.electronAPI.portrait) {
                        const cacheKey = `pid_${pid}`;
                        const cachedPortrait = app.portraitCache.get(cacheKey);

                        // Only load if not already in cache (face picker may have already loaded it)
                        if (!cachedPortrait || cachedPortrait === 'loading') {
                            window.electronAPI.portrait.getByPID(pid).then(imageData => {
                                if (imageData && imageData.length > 0) {
                                    app.portraitCache.set(cacheKey, imageData);
                                    console.log('[AG-Grid] Portrait cached for PID:', pid);
                                }
                                // Refresh portrait and PLAYERPIC cells for this row
                                event.api.refreshCells({
                                    rowNodes: [event.node],
                                    columns: ['_portrait', 'PLAYERPIC'],
                                    force: true
                                });
                            }).catch(err => {
                                console.error('[AG-Grid] Error loading portrait:', err);
                                // Still refresh to show placeholder
                                event.api.refreshCells({
                                    rowNodes: [event.node],
                                    columns: ['_portrait', 'PLAYERPIC'],
                                    force: true
                                });
                            });
                        } else {
                            // Portrait already in cache, just refresh the display
                            console.log('[AG-Grid] Portrait already cached for PID:', pid);
                            event.api.refreshCells({
                                rowNodes: [event.node],
                                columns: ['_portrait', 'PLAYERPIC'],
                                force: true
                            });
                        }
                    } else {
                        // No PID, refresh to clear portrait and PLAYERPIC
                        event.api.refreshCells({
                            rowNodes: [event.node],
                            columns: ['_portrait', 'PLAYERPIC'],
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
                    const player = event.data;
                    if (player) {
                        app.openPlayerCard(player, rowIndex);
                    }
                } else if (action === 'save-bio-to-db') {
                    // Save bio info to database
                    const player = event.data;
                    const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim();

                    // Collect all player data for the modal
                    const playerData = {
                        firstName: player.PFNA,
                        lastName: player.PLNA,
                        pid: player.PSXP,
                        pam: player.PEPS,
                        race: player.PLRC,
                        bodyType: player.PCBT,
                        handedness: player.PHAN,
                        height: player.PHGT,
                        weight: player.PWGT,
                        college: player.PCOL,
                        homeState: player.PHSN
                    };

                    console.log('[AG-Grid] Player data for bio save:', playerData);

                    // Show modal with checkboxes
                    app.showBioSaveModal(playerName, playerData, (selectedData) => {
                        if (!selectedData) return; // User cancelled

                        console.log('[AG-Grid] Saving selected bio data:', JSON.stringify(selectedData, null, 2));
                        console.log('[AG-Grid] Calling savePlayerBio API...');

                        // Save to database
                        window.electronAPI.database.savePlayerBio(selectedData)
                            .then(result => {
                                console.log('[AG-Grid] savePlayerBio result:', result);
                                if (result.success) {
                                    app.showToast(`Saved bio for ${playerName} to database`, 'success');
                                } else {
                                    app.showToast(`Failed: ${result.error}`, 'error');
                                }
                            })
                            .catch(err => {
                                console.error('[AG-Grid] Error saving bio:', err);
                                app.showToast(`Error: ${err.message}`, 'error');
                            });
                    });
                } else if (action === 'change-portrait') {
                    // Open generic face picker to change both PID and PAM
                    const player = event.data;
                    console.log('[AG-Grid] Opening face picker for player:', player.PFNA, player.PLNA);
                    app.openGenericFacePicker(player, rowIndex);
                } else if (action === 'set-3d-face') {
                    // Open PAM picker to set 3D face only (keep portrait PID)
                    const player = event.data;
                    console.log('[AG-Grid] Opening PAM picker for player:', player.PFNA, player.PLNA);
                    app.openPAMPicker(player, rowIndex);
                } else if (action === 'delete-multiple') {
                    // Enable multi-delete mode
                    console.log('[AG-Grid] Entering multi-delete mode');
                    enterMultiDeleteMode(app, 'roster');
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

        // Update logo circle when selection changes (All Players view only)
        onSelectionChanged: (event) => {
            // Only update logo on All Players view (no team filter)
            if (app.selectedTeamId) return;

            const selectedRows = event.api.getSelectedRows();
            const logoEl = document.getElementById('v2TeamLogo');
            if (!logoEl) return;

            if (selectedRows.length > 0) {
                const player = selectedRows[0];
                const teamId = player.TGID;
                const nflLogoHtml = '<img src="https://static.www.nfl.com/image/upload/v1554321393/league/nvfr7ogywskqrfaiu38m.svg" alt="NFL logo">';

                // Get team data for logo and color
                const team = getTeamById(teamId);

                if (team && team.logo) {
                    logoEl.innerHTML = `<img src="${team.logo}" alt="Team logo">`;
                    logoEl.style.background = `linear-gradient(145deg, ${team.secondary}, ${team.secondary}99)`;
                } else if (app.getTeamLogoUrl) {
                    const logoUrl = app.getTeamLogoUrl(teamId);
                    if (logoUrl) {
                        logoEl.innerHTML = `<img src="${logoUrl}" alt="Team logo">`;
                    } else {
                        logoEl.innerHTML = nflLogoHtml;
                    }
                } else {
                    logoEl.innerHTML = nflLogoHtml;
                }
            } else {
                // No selection - show NFL logo with default gold
                logoEl.innerHTML = '<img src="https://static.www.nfl.com/image/upload/v1554321393/league/nvfr7ogywskqrfaiu38m.svg" alt="NFL logo">';
                logoEl.style.background = 'linear-gradient(145deg, #ffa726, #ffa72699)';
            }
        },

        onGridReady: (params) => {
            console.log('[AG-Grid] Grid ready, player count:', players.length);

            // Only auto-size if no saved state exists
            const hasSavedState = localStorage.getItem('rosterGridColumnState');
            if (!hasSavedState) {
                params.api.autoSizeAllColumns(false);
            }

            // Apply header colors
            applyHeaderColors(app, container);

            // Click-to-deselect: clicking anywhere outside a grid row deselects
            // Store handler reference so it can be removed on grid destroy
            if (app._agGridClickHandler) {
                document.removeEventListener('click', app._agGridClickHandler);
            }
            app._agGridClickHandler = (e) => {
                // Guard against destroyed grid
                if (!params.api || params.api.isDestroyed?.()) {
                    return;
                }

                // Check if click was on a row element or UI elements that shouldn't deselect
                const clickedRow = e.target.closest('.ag-row');
                const clickedHeader = e.target.closest('.ag-header');
                const clickedMenu = e.target.closest('.ag-menu, .context-menu, #grid-context-menu');
                const clickedPopup = e.target.closest('.ag-popup, .modal, .dialog, [role="dialog"]');
                const clickedButton = e.target.closest('button, .btn');
                // CRITICAL: Don't deselect when clicking on cell editing elements
                const clickedEdit = e.target.closest('.ag-cell-edit-wrapper, .ag-cell-inline-editing, .fast-select-editor, .fast-select-editor__dropdown, .ag-text-field-input, .ag-cell-editor, input, select, textarea');

                // If click was NOT on a row, header, menu, popup, button, or edit element, deselect all
                if (!clickedRow && !clickedHeader && !clickedMenu && !clickedPopup && !clickedButton && !clickedEdit) {
                    params.api.deselectAll();
                }
            };
            document.addEventListener('click', app._agGridClickHandler);

            // Copy/Paste handlers for spreadsheet-like functionality
            // Store handler reference so it can be removed on grid destroy
            if (app._agGridKeyHandler) {
                document.removeEventListener('keydown', app._agGridKeyHandler);
            }
            app._agGridKeyHandler = (e) => {
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
            };
            document.addEventListener('keydown', app._agGridKeyHandler);

            // Restore saved column widths if available
            const savedState = localStorage.getItem('rosterGridColumnState');
            if (savedState) {
                try {
                    const columnState = JSON.parse(savedState);
                    params.api.applyColumnState({ state: columnState, applyOrder: true });
                    console.log('[AG-Grid] Restored saved column widths');
                } catch (e) {
                    console.warn('[AG-Grid] Failed to restore column state:', e);
                }
            }
        },

        onColumnResized: (params) => {
            // Save when user finishes dragging
            if (params.finished) {
                const columnState = params.api.getColumnState();
                localStorage.setItem('rosterGridColumnState', JSON.stringify(columnState));
                console.log('[AG-Grid] Saved column widths');
            }
        },

        onColumnMoved: (params) => {
            const columnState = params.api.getColumnState();
            localStorage.setItem('rosterGridColumnState', JSON.stringify(columnState));
            console.log('[AG-Grid] Saved column order');
        }
    };

    // Create grid
    const gridApi = createGrid(container, gridOptions);

    // Store reference
    app.agGrid = gridApi;
    app.agGridOptions = gridOptions;

    // Expose to window for card view integration
    window.rosterGridApi = gridApi;

    // Notify card view of data change
    if (typeof window.notifyCardViewDataChanged === 'function') {
        window.notifyCardViewDataChanged();
    }

    // Apply initial sort state from app.sortColumns if any
    if (app.sortColumns && app.sortColumns.length > 0) {
        const columnState = app.sortColumns.map((sortCol, index) => ({
            colId: sortCol.column,
            sort: sortCol.order, // 'asc' or 'desc'
            sortIndex: index
        }));
        console.log('[AG-Grid] Applying initial sort state:', columnState);
        gridApi.applyColumnState({
            state: columnState,
            defaultState: { sort: null }
        });
    }

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

    let bgColor, textColor, secondaryColor;

    // Main page (all teams) - BLACK background, ORANGE text
    if (!app.selectedTeamId) {
        bgColor = '#000000';
        textColor = '#ffa726';
        secondaryColor = null;
        console.log('[DEBUG applyHeaderColors] Using main page colors (black bg, orange text)');
    } else {
        // Team page - TEAM PRIMARY COLOR background, TEAM SECONDARY COLOR text
        // Get first player's team to determine team color
        const firstPlayer = app.filteredPlayers && app.filteredPlayers.length > 0 ? app.filteredPlayers[0] : null;
        console.log('[DEBUG applyHeaderColors] TEAM PAGE - selectedTeamId:', app.selectedTeamId);
        console.log('[DEBUG applyHeaderColors] First player TGID:', firstPlayer?.TGID);

        if (firstPlayer && firstPlayer.TGID) {
            const teamAbbr = TEAM_MAPPINGS[firstPlayer.TGID];
            console.log('[DEBUG applyHeaderColors] TEAM_MAPPINGS[' + firstPlayer.TGID + '] =', teamAbbr);

            const teamColors = TEAM_COLORS[teamAbbr];
            console.log('[DEBUG applyHeaderColors] TEAM_COLORS["' + teamAbbr + '"] =', JSON.stringify(teamColors));

            if (teamColors) {
                bgColor = teamColors.primary;
                secondaryColor = teamColors.secondary;
                textColor = teamColors.headerText || teamColors.secondary;
                console.log('>>> HEADER BG (solid): ' + bgColor + ', TEXT: ' + textColor);
            } else {
                bgColor = '#000000';
                secondaryColor = null;
                textColor = '#e0e0e0';
                console.log('[DEBUG applyHeaderColors] NO TEAM COLORS FOUND for abbr:', teamAbbr);
            }
        } else {
            bgColor = '#000000';
            secondaryColor = null;
            textColor = '#e0e0e0';
            console.log('[DEBUG applyHeaderColors] No first player or TGID');
        }
    }

    // For team pages, use SOLID primary color (no gradient)
    // For main page (all teams), use solid black
    const isTeamPage = app.selectedTeamId;
    // Header is always solid primary color - NO gradient
    const headerBgStyle = bgColor;
    console.log('[DEBUG applyHeaderColors] Using solid color:', headerBgStyle);

    // DIRECTLY set inline styles on DOM elements - this CANNOT be overridden by CSS
    const headerEl = container.querySelector('.ag-header');
    const headerViewport = container.querySelector('.ag-header-viewport');
    const headerContainer = container.querySelector('.ag-header-container');
    const headerRows = container.querySelectorAll('.ag-header-row');
    const pinnedLeft = container.querySelector('.ag-pinned-left-header');
    const pinnedRight = container.querySelector('.ag-pinned-right-header');
    const headerCells = container.querySelectorAll('.ag-header-cell');
    const headerTexts = container.querySelectorAll('.ag-header-cell-text, .ag-header-cell-label');

    console.log('>>> Found elements: header=' + !!headerEl + ', viewport=' + !!headerViewport + ', rows=' + headerRows.length + ', cells=' + headerCells.length);

    // Apply gradient to main header elements
    [headerEl, headerViewport, headerContainer, pinnedLeft, pinnedRight].forEach(el => {
        if (el) {
            el.style.setProperty('background', headerBgStyle, 'important');
        }
    });

    // Header rows get gradient too
    headerRows.forEach(el => {
        if (el) {
            el.style.setProperty('background', headerBgStyle, 'important');
        }
    });

    // Header cells MUST be transparent so gradient shows through
    headerCells.forEach(el => {
        if (el) {
            el.style.setProperty('background', 'transparent', 'important');
        }
    });

    // Set text color on header text elements (for already-rendered elements)
    headerTexts.forEach(el => {
        if (el) {
            el.style.setProperty('color', textColor, 'important');
        }
    });

    // Inject dynamic CSS rule for ALL header text (including scrollable columns rendered later)
    let headerTextStyle = document.getElementById('dynamic-header-text-style');
    if (!headerTextStyle) {
        headerTextStyle = document.createElement('style');
        headerTextStyle.id = 'dynamic-header-text-style';
        document.head.appendChild(headerTextStyle);
    }
    headerTextStyle.textContent = `
        .ag-header-cell-text,
        .ag-header-cell-label,
        .ag-header-group-cell-label,
        .roster-editor-v2 .ag-header-cell-text,
        .roster-editor-v2 .ag-header-cell-label,
        #rosterGrid .ag-header-cell-text,
        #rosterGrid .ag-header-cell-label {
            color: ${textColor} !important;
            text-shadow:
                -1px -1px 0 #000,
                1px -1px 0 #000,
                -1px 1px 0 #000,
                1px 1px 0 #000,
                2px 2px 4px rgba(0, 0, 0, 0.5) !important;
        }
    `;

    // Verify styles were applied
    if (headerEl) {
        console.log('>>> ACTUAL headerEl.style.background:', headerEl.style.background);
    }
    console.log('>>> APPLIED: BG=' + headerBgStyle + ', Text=' + textColor);

    // Set CSS variables directly on the .ag-theme-alpine element (the actual grid wrapper)
    // This is where AG-Grid's CSS looks for the variable
    const themeEl = container.querySelector('.ag-theme-alpine');
    if (themeEl) {
        themeEl.style.setProperty('--ag-header-background-color', headerBgStyle);
        themeEl.style.setProperty('--ag-header-foreground-color', textColor);
        console.log('>>> Set CSS vars on .ag-theme-alpine element');
    }

    // Also set on container and document root as fallback
    container.style.setProperty('--ag-header-background-color', headerBgStyle);
    container.style.setProperty('--ag-header-foreground-color', textColor);
    document.documentElement.style.setProperty('--ag-header-background-color', headerBgStyle);
    document.documentElement.style.setProperty('--ag-header-foreground-color', textColor);

    // Also set team colors on document root for CSS rules that use var(--team-primary/secondary)
    if (isTeamPage && secondaryColor) {
        document.documentElement.style.setProperty('--team-primary', bgColor);
        document.documentElement.style.setProperty('--team-secondary', secondaryColor);
        console.log('[DEBUG applyHeaderColors] Set CSS vars - primary:', bgColor, 'secondary:', secondaryColor);
    }

    // Update selection colors CSS variables
    // For team pages, use team secondary color as selection background
    // For main page, use orange
    let selectionBgColor, selectionTextColor;
    if (!app.selectedTeamId) {
        // Main page - neutral selection
        selectionBgColor = '#333333'; // Neutral dark grey
        selectionTextColor = '#ffffff';
    } else {
        // Team page - use team secondary color for selection
        const firstPlayer = app.filteredPlayers && app.filteredPlayers.length > 0 ? app.filteredPlayers[0] : null;
        if (firstPlayer && firstPlayer.TGID) {
            const teamAbbr = TEAM_MAPPINGS[firstPlayer.TGID];
            const teamColors = TEAM_COLORS[teamAbbr];
            if (teamColors) {
                // Use team PRIMARY color for selection (User Request: Prevent Gold/Yellow selections)
                selectionBgColor = teamColors.primary;

                // Ensure high contrast text for selection
                selectionTextColor = '#ffffff';
            } else {
                selectionBgColor = '#333333'; // Neutral dark grey
                selectionTextColor = '#ffffff';
            }
        } else {
            selectionBgColor = '#333333'; // Neutral dark grey
            selectionTextColor = '#ffffff';
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
        // Get current sort state directly from grid to preserve it
        const currentSortState = app.agGrid.getColumnState().filter(c => c.sort);
        console.log('[AG-Grid] Updating data, preserving sort state:', currentSortState);

        app.agGrid.setGridOption('rowData', newPlayers);

        // Restore sort state if it was set
        if (currentSortState.length > 0) {
            // Small delay to ensure data is loaded before applying sort
            setTimeout(() => {
                app.agGrid.applyColumnState({
                    state: currentSortState,
                    defaultState: { sort: null }
                });
                console.log('[AG-Grid] Sort state restored after data update');
            }, 0);
        }
    }
}

/**
 * Destroy AG-Grid
 */
export function destroyAGGrid(app) {
    // CRITICAL: Remove document-level event listeners to prevent accumulation
    if (app._agGridClickHandler) {
        document.removeEventListener('click', app._agGridClickHandler);
        app._agGridClickHandler = null;
    }
    if (app._agGridKeyHandler) {
        document.removeEventListener('keydown', app._agGridKeyHandler);
        app._agGridKeyHandler = null;
    }

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
    // Prevent recursive calls
    if (_isAdjustingOVR) {
        console.log('[AG-Grid OVR] Skipping recursive call');
        return;
    }
    _isAdjustingOVR = true;

    console.log('[AG-Grid OVR] handleAGGridOVRChange called:', oldOVR, '->', newOVR);

    // Get position name from position ID (M26 codes)
    const positionMap = {
        0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
        8: 'RG', 9: 'RT', 10: 'LEDG', 11: 'REDG', 12: 'DT', 13: 'SAM', 14: 'MIKE',
        15: 'WILL', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
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

    // DEBUG: Log what attributes were collected
    const attrCount = Object.keys(attributes).length;
    console.log(`[AG-Grid OVR] Collected ${attrCount} attributes from player`);
    if (attrCount === 0) {
        console.log('[AG-Grid OVR] WARNING: No attributes found! Player keys:', Object.keys(player).slice(0, 20));
    } else {
        // Log a few key attributes for OT position (PPBK, PRBK, PSTR)
        console.log(`[AG-Grid OVR] Sample attrs: PPBK=${attributes.PPBK}, PRBK=${attributes.PRBK}, PSTR=${attributes.PSTR}, PSPD=${attributes.PSPD}`);
    }

    // Get archetype if available (PLTY is what franchise reads)
    const archetype = player.PLTY !== undefined ? player.PLTY : undefined;
    console.log(`[AG-Grid OVR] Archetype from player.PLTY: ${archetype}`);

    try {
        // Call the backend to calculate adjustments
        console.log('[AG-Grid OVR] Calling calculateOVRAdjustments...');
        const result = await window.electronAPI.rating.calculateOVRAdjustments(
            attributes, newOVR, position, archetype
        );
        console.log('[AG-Grid OVR] Result:', result);

        if (!result) {
            console.log('[AG-Grid OVR] No result returned from backend');
            return;
        }

        // Check if target is already achieved (no adjustments needed)
        if (Object.keys(result.adjustments).length === 0) {
            // The player's current ratings already produce the target OVR
            console.log(`[AG-Grid OVR] Ratings already achieve OVR ${result.newOVR} - no adjustments needed`);

            // If the displayed OVR differs from calculated, this means POVR was stale
            // Just update the display to show the correct calculated OVR
            if (result.newOVR !== newOVR) {
                console.log(`[AG-Grid OVR] Note: Target ${newOVR} differs from calculated ${result.newOVR}`);
            }

            // The OVR change has already been applied to the cell, so we're done
            _isAdjustingOVR = false;
            return;
        }

        // AUTO-APPLY adjustments instead of showing dialog
        // This ensures attributes are scaled when OVR is changed
        console.log(`[AG-Grid OVR] Auto-applying ${Object.keys(result.adjustments).length} rating adjustments to achieve OVR ${result.newOVR}`);

        // Find the player in all data stores
        const playerIndex = app.players.findIndex(p =>
            (p.PFNA === player.PFNA && p.PLNA === player.PLNA) || p === player
        );
        const filteredIndex = app.filteredPlayers ? app.filteredPlayers.findIndex(p =>
            (p.PFNA === player.PFNA && p.PLNA === player.PLNA) || p === player
        ) : -1;

        const changedColumns = [];
        for (const [fieldCode, adj] of Object.entries(result.adjustments)) {
            const newValue = adj.suggested;

            // Update ALL data sources to ensure consistency
            player[fieldCode] = newValue;
            node.data[fieldCode] = newValue;

            // Update app.players
            if (playerIndex !== -1) {
                app.players[playerIndex][fieldCode] = newValue;
            }

            // Update app.filteredPlayers (critical for OVR recalculation)
            if (filteredIndex !== -1 && app.filteredPlayers) {
                app.filteredPlayers[filteredIndex][fieldCode] = newValue;
            }

            changedColumns.push(fieldCode);
            console.log(`[AG-Grid OVR] ${adj.name}: ${adj.current} → ${newValue}`);
        }

        // Also update POVR to the achieved OVR in all data sources
        const achievedOVR = result.newOVR;
        player.POVR = achievedOVR;
        node.data.POVR = achievedOVR;
        if (playerIndex !== -1) {
            app.players[playerIndex].POVR = achievedOVR;
        }
        if (filteredIndex !== -1 && app.filteredPlayers) {
            app.filteredPlayers[filteredIndex].POVR = achievedOVR;
        }
        changedColumns.push('POVR');

        // Refresh the changed cells in the grid
        if (changedColumns.length > 0 && gridApi) {
            gridApi.refreshCells({
                rowNodes: [node],
                columns: changedColumns,
                force: true
            });
        }

        // Mark as having unsaved changes
        app.hasUnsavedChanges = true;
        if (app.updateSaveButton) {
            app.updateSaveButton();
        }

        console.log(`[AG-Grid OVR] Successfully adjusted ${changedColumns.length} attributes for ${playerName}`);

    } catch (error) {
        console.error('[AG-Grid OVR] Error calculating adjustments:', error);
    } finally {
        // Always reset the flag
        _isAdjustingOVR = false;
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
                    <button id="ag-ovr-close-btn" class="close-btn">×</button>
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

    // Helper to restore focus to grid after modal closes
    const restoreFocusToGrid = () => {
        setTimeout(() => {
            const gridContainer = document.querySelector('.ag-root-wrapper');
            if (gridContainer) {
                gridContainer.focus();
                console.log('[AG-Grid] Focus restored to grid after modal close');
            }
        }, 50);
    };

    // Close button (X) handler
    document.getElementById('ag-ovr-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        modal.remove();
        restoreFocusToGrid();
    });

    // Apply adjustments handler
    document.getElementById('ag-apply-adjustments-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        applyAGGridOVRAdjustments(node, player, adjustments, app, gridApi);
        modal.remove();
        restoreFocusToGrid();
    });

    // Keep OVR only handler (just close - OVR already changed)
    document.getElementById('ag-keep-ovr-only-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        modal.remove();
        restoreFocusToGrid();
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
        restoreFocusToGrid();
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            restoreFocusToGrid();
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

// =============================================
// ROSTER PUSH TO DATABASE
// =============================================

/**
 * Open the Push to Database dialog for roster
 */
export async function openRosterPushToDatabaseDialog(app) {
    // Get all players from app.filteredPlayers (full roster, not just visible grid rows)
    const players = app.filteredPlayers || app.players || [];

    if (players.length === 0) {
        console.error('[Push to DB] No roster loaded');
        alert('No players to push. Load a roster file first.');
        return;
    }

    // Determine season year from file name or fallback to current year
    // Extract just the filename (not full path) to avoid matching years from directory names
    let seasonYear = new Date().getFullYear();
    // FIXED: Use app.currentFile (the actual property) instead of app.rosterFilePath (doesn't exist)
    if (app.currentFile) {
        // Get just the filename from the full path
        const fileName = app.currentFile.split(/[/\\]/).pop() || '';
        console.log(`[Push to DB] Extracting year from filename: "${fileName}"`);

        // Try to find a year in the filename (prioritize ROSTER-YYYY pattern)
        const rosterYearMatch = fileName.match(/ROSTER[_-]?(\d{4})/i);
        const genericYearMatch = fileName.match(/(\d{4})/);

        const yearMatch = rosterYearMatch || genericYearMatch;
        if (yearMatch) {
            const extractedYear = parseInt(yearMatch[1]);
            if (extractedYear >= 1936 && extractedYear <= 2100) {
                seasonYear = extractedYear;
                console.log(`[Push to DB] Extracted year ${seasonYear} from filename`);
            }
        }
    }

    console.log(`[Push to DB] Analyzing ${players.length} players for year ${seasonYear}`);

    // DEBUG: Check player objects before sending to backend
    if (players.length > 0) {
        const firstPlayer = players[0];
        const allKeys = Object.keys(firstPlayer);
        // Check ALL 4-character codes that look like ratings (start with P or S, 4 chars)
        const allRatingKeys = allKeys.filter(k => k.length === 4 && (k.startsWith('P') || k.startsWith('S')));
        console.log(`[Push to DB] FRONTEND CHECK - First player: ${firstPlayer.PFNA} ${firstPlayer.PLNA}`);
        console.log(`[Push to DB] FRONTEND CHECK - Total keys: ${allKeys.length}`);
        console.log(`[Push to DB] FRONTEND CHECK - ALL rating-like keys (${allRatingKeys.length}): ${allRatingKeys.join(', ')}`);
        console.log(`[Push to DB] FRONTEND CHECK - Sample values: POVR=${firstPlayer.POVR}, PSPD=${firstPlayer.PSPD}, PSTA=${firstPlayer.PSTA}, PBKT=${firstPlayer.PBKT}, PLTR=${firstPlayer.PLTR}`);

        // DEBUG: Specifically check bio fields that aren't pushing
        console.log(`[Push to DB] BIO FIELDS CHECK - First player ${firstPlayer.PFNA} ${firstPlayer.PLNA}:`);
        console.log(`  - PHGT (height): ${firstPlayer.PHGT} (type: ${typeof firstPlayer.PHGT})`);
        console.log(`  - PWGT (weight): ${firstPlayer.PWGT} (type: ${typeof firstPlayer.PWGT})`);
        console.log(`  - PHSN (homeState): ${firstPlayer.PHSN} (type: ${typeof firstPlayer.PHSN})`);
        console.log(`  - PCOL (college): ${firstPlayer.PCOL} (type: ${typeof firstPlayer.PCOL})`);
        console.log(`  - PHTN (hometown): ${firstPlayer.PHTN} (type: ${typeof firstPlayer.PHTN})`);
        console.log(`  - PLRC (race): ${firstPlayer.PLRC} (type: ${typeof firstPlayer.PLRC})`);
        console.log(`  - PCBT (bodyType): ${firstPlayer.PCBT} (type: ${typeof firstPlayer.PCBT})`);
        console.log(`  - PHAN (handedness): ${firstPlayer.PHAN} (type: ${typeof firstPlayer.PHAN})`);
    }

    // Show year selection dialog first
    const yearSelectHTML = `
        <div id="roster-push-db-year-modal" class="modal-overlay" style="z-index: 100001;">
            <div class="modal-content" style="padding: 30px; max-width: 400px;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Push Roster to Database</h2>
                    <button id="roster-push-db-year-close-btn" class="close-btn" style="font-size: 24px; background: none; border: none; color: #999; cursor: pointer;">×</button>
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="roster-push-db-year-input" style="display: block; margin-bottom: 8px; font-weight: bold;">
                        Season Year:
                    </label>
                    <input type="number" id="roster-push-db-year-input" value="${seasonYear}" min="1936" max="2100"
                        style="width: 100%; padding: 10px; font-size: 16px; border: 1px solid #555; border-radius: 4px; background: #1a1a1a; color: #fff;">
                    <p style="color: #888; font-size: 12px; margin-top: 8px;">
                        This will be the season year for the player ratings, team assignments, and jersey numbers in the database.
                    </p>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="roster-push-db-year-cancel-btn" style="padding: 10px 20px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="roster-push-db-year-continue-btn" style="padding: 10px 20px; background: #2196F3; border: none; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">Continue</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', yearSelectHTML);

    const yearModal = document.getElementById('roster-push-db-year-modal');
    const yearInput = document.getElementById('roster-push-db-year-input');

    // Focus the input
    yearInput.focus();
    yearInput.select();

    // Close handlers
    const closeYearModal = () => yearModal.remove();
    document.getElementById('roster-push-db-year-close-btn').addEventListener('click', closeYearModal);
    document.getElementById('roster-push-db-year-cancel-btn').addEventListener('click', closeYearModal);
    yearModal.addEventListener('click', (e) => {
        if (e.target === yearModal) closeYearModal();
    });

    // Continue handler
    document.getElementById('roster-push-db-year-continue-btn').addEventListener('click', async () => {
        const selectedYear = parseInt(yearInput.value);
        if (isNaN(selectedYear) || selectedYear < 1936 || selectedYear > 2100) {
            alert('Please enter a valid year between 1936 and 2100');
            return;
        }

        closeYearModal();
        await analyzeAndShowRosterPushDialog(app, players, selectedYear);
    });

    // Enter key to continue
    yearInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('roster-push-db-year-continue-btn').click();
        }
    });
}

/**
 * Analyze roster players and show the push confirmation dialog
 */
async function analyzeAndShowRosterPushDialog(app, players, seasonYear) {
    // Show loading indicator
    const loadingHTML = `
        <div id="roster-push-db-loading-modal" class="modal-overlay" style="z-index: 100001;">
            <div class="modal-content" style="padding: 30px; text-align: center; max-width: 400px;">
                <h3>Analyzing Roster...</h3>
                <p>Checking for existing players in database for year ${seasonYear}...</p>
                <div style="margin-top: 20px;">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHTML);

    try {
        // Call backend to analyze
        const response = await window.electronAPI.database.analyzeRosterPush(players, seasonYear);

        // Remove loading modal
        document.getElementById('roster-push-db-loading-modal')?.remove();

        if (!response.success) {
            alert(`Error analyzing roster: ${response.error}`);
            return;
        }

        const analysis = response.analysis;
        console.log('[Push to DB] Roster analysis result:', analysis);

        // Show the analysis/confirmation modal
        showRosterPushConfirmationModal(app, analysis, seasonYear);

    } catch (error) {
        document.getElementById('roster-push-db-loading-modal')?.remove();
        console.error('[Push to DB] Error:', error);
        alert(`Error: ${error.message || error}`);
    }
}

/**
 * Show the push confirmation modal with analysis results
 */
function showRosterPushConfirmationModal(app, analysis, seasonYear) {
    const { newPlayers, existingBundled, existingCustom, totalConflicts, hasYearConflicts } = analysis;

    const totalNew = newPlayers.length;
    const totalExisting = existingBundled.length + existingCustom.length;
    const totalPlayers = totalNew + totalExisting;

    // Build conflicts list HTML - card-based design
    let conflictsHTML = '';
    let conflictIndex = 0;
    const allConflicts = [];
    const playersWithConflicts = [];

    // Gather all conflicts from bundled and custom players
    for (const item of [...existingBundled, ...existingCustom]) {
        if (item.conflicts && item.conflicts.length > 0) {
            const firstName = item.player.PFNA || item.player.firstName || '';
            const lastName = item.player.PLNA || item.player.lastName || '';
            const playerName = `${firstName} ${lastName}`.trim();
            const position = POSITION_MAPPINGS[item.player.PPOS] || item.player.position || '?';
            const cardId = `roster-conflict-card-${item.playerIndex}`;

            playersWithConflicts.push({ cardId, playerName });

            // Build conflict rows for this player
            let conflictRowsHTML = '';
            for (const conflict of item.conflicts) {
                const conflictId = `roster_conflict_${conflictIndex}`;
                allConflicts.push({
                    playerIndex: item.playerIndex,
                    field: conflict.field,
                    id: conflictId,
                    cardId: cardId
                });

                conflictRowsHTML += `
                    <div class="conflict-row" style="display: grid; grid-template-columns: 120px 1fr 1fr 180px; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid #333;">
                        <div style="font-weight: bold; color: #aaa;">${conflict.displayName}</div>
                        <div style="background: #2a2a2a; padding: 6px 10px; border-radius: 4px; text-align: center;">
                            <div style="font-size: 11px; color: #888; margin-bottom: 2px;">Current</div>
                            <div style="color: #ff9800;">${conflict.currentValue || '(empty)'}</div>
                        </div>
                        <div style="background: #2a2a2a; padding: 6px 10px; border-radius: 4px; text-align: center;">
                            <div style="font-size: 11px; color: #888; margin-bottom: 2px;">New</div>
                            <div style="color: #4CAF50;">${conflict.newValue || '(empty)'}</div>
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                <input type="radio" name="${conflictId}" value="keep" checked> Keep
                            </label>
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                <input type="radio" name="${conflictId}" value="overwrite"> Use New
                            </label>
                        </div>
                    </div>
                `;
                conflictIndex++;
            }

            // Build player card
            conflictsHTML += `
                <div id="${cardId}" class="conflict-card" style="background: #1e1e1e; border: 1px solid #444; border-radius: 8px; margin-bottom: 12px; overflow: hidden;">
                    <div class="conflict-card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: #252525; border-bottom: 1px solid #444;">
                        <div>
                            <span style="font-weight: bold; font-size: 15px; color: #fff;">${playerName}</span>
                            <span style="color: #888; margin-left: 10px;">${position}</span>
                            <span style="color: #666; margin-left: 10px; font-size: 12px;">${item.conflicts.length} conflict(s)</span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="roster-conflict-keep-all-btn" data-card="${cardId}" style="padding: 5px 12px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                Keep All Current
                            </button>
                            <button class="roster-conflict-use-all-btn" data-card="${cardId}" style="padding: 5px 12px; background: #1a5a1a; border: 1px solid #2a7a2a; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                Use All New
                            </button>
                            <button class="roster-conflict-done-btn" data-card="${cardId}" style="padding: 5px 12px; background: #2196F3; border: none; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                Done
                            </button>
                        </div>
                    </div>
                    <div class="conflict-card-body" style="padding: 10px 15px;">
                        <div class="conflict-grid-header" style="display: grid; grid-template-columns: 120px 1fr 1fr 180px; gap: 10px; padding: 8px 0; border-bottom: 2px solid #444; font-size: 12px; color: #888;">
                            <div>Field</div>
                            <div style="text-align: center;">Database Value</div>
                            <div style="text-align: center;">Roster Value</div>
                            <div style="text-align: center;">Action</div>
                        </div>
                        ${conflictRowsHTML}
                    </div>
                </div>
            `;
        }
    }

    // Build year conflicts warning
    let yearConflictHTML = '';
    if (hasYearConflicts) {
        yearConflictHTML = `
            <div class="warning-box" style="background: #332200; border: 1px solid #664400; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                <strong style="color: #ffaa00;">Warning:</strong> Some players already have ratings for year ${seasonYear}.
                <div style="margin-top: 8px;">
                    <label>
                        <input type="checkbox" id="roster-overwrite-seasons-checkbox" checked>
                        Overwrite existing season ratings for ${seasonYear}
                    </label>
                </div>
            </div>
        `;
    }

    // Build modal HTML
    const modalHTML = `
        <div id="roster-push-db-modal" class="modal-overlay" style="z-index: 100001;">
            <div class="modal-content" style="max-width: 900px; width: 90%; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 1px solid #444;">
                    <h2 style="margin: 0;">Push Roster to Database</h2>
                    <button id="roster-push-db-close-btn" class="close-btn" style="font-size: 24px; background: none; border: none; color: #999; cursor: pointer;">×</button>
                </div>
                <div class="modal-body" style="overflow-y: auto; flex: 1; padding: 15px 0;">
                    <div class="summary-section" style="margin-bottom: 20px;">
                        <h3 style="margin-top: 0;">Summary for ${seasonYear} Season</h3>
                        <p style="color: #aaa; font-size: 13px; margin-bottom: 15px;">
                            This will save player ratings, team assignments, jersey numbers, and archetypes for the ${seasonYear} season.
                        </p>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div style="background: #1a3a1a; padding: 15px; border-radius: 4px; text-align: center;">
                                <div style="font-size: 28px; font-weight: bold; color: #4CAF50;">${totalNew}</div>
                                <div style="color: #aaa;">New Players</div>
                                <div style="color: #666; font-size: 12px;">Will be created</div>
                            </div>
                            <div style="background: #1a2a3a; padding: 15px; border-radius: 4px; text-align: center;">
                                <div style="font-size: 28px; font-weight: bold; color: #2196F3;">${totalExisting}</div>
                                <div style="color: #aaa;">Existing Players</div>
                                <div style="color: #666; font-size: 12px;">Will add/update ${seasonYear} season</div>
                            </div>
                        </div>
                    </div>

                    <!-- Push Options -->
                    <div class="push-options-section" style="margin-top: 20px; margin-bottom: 20px; background: #1a1a1a; padding: 15px; border-radius: 8px; border: 1px solid #333;">
                        <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 16px;">Push Options</h3>

                        <div style="margin-bottom: 15px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
                                <input type="radio" name="roster-push-mode" value="all" checked id="roster-push-mode-all">
                                <span style="font-weight: bold;">All Data</span>
                                <span style="color: #888; font-size: 12px;">- Push ratings, team, jersey, archetype, and selected bio fields</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="radio" name="roster-push-mode" value="ratings" id="roster-push-mode-ratings">
                                <span style="font-weight: bold;">Ratings Only</span>
                                <span style="color: #888; font-size: 12px;">- Only push player ratings for ${seasonYear}</span>
                            </label>
                        </div>

                        <!-- Bio Fields Selection (shown when All Data is selected) -->
                        <div id="roster-bio-fields-section" style="padding: 12px; background: #252525; border-radius: 6px; border: 1px solid #404040;">
                            <div style="font-weight: bold; margin-bottom: 10px; color: #aaa;">Include Bio Fields:</div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-team" checked>
                                    <span>Team Assignment</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-jersey" checked>
                                    <span>Jersey Number</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-archetype" checked>
                                    <span>Archetype</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-position" checked>
                                    <span>Position</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-college" checked>
                                    <span>College</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-height" checked>
                                    <span>Height</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-weight" checked>
                                    <span>Weight</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-homestate" checked>
                                    <span>Home State</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-race" checked>
                                    <span>Race</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-bodytype" checked>
                                    <span>Body Type</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-handedness" checked>
                                    <span>Handedness</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-pid" checked>
                                    <span>PID (Portrait)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="roster-bio-pam" checked>
                                    <span>PAM (3D Face)</span>
                                </label>
                            </div>
                            <div style="margin-top: 10px; display: flex; gap: 10px;">
                                <button id="roster-bio-select-all" style="padding: 4px 12px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">Select All</button>
                                <button id="roster-bio-select-none" style="padding: 4px 12px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">Select None</button>
                            </div>
                        </div>
                    </div>

                    ${yearConflictHTML}

                    <div style="margin-bottom: 15px;">
                        <label>
                            <input type="checkbox" id="roster-fill-empty-bio-checkbox">
                            Only fill empty bio fields (leave unchecked to overwrite existing data)
                        </label>
                    </div>

                    ${totalConflicts > 0 ? `
                        <div class="conflicts-section" style="margin-top: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <h3 style="margin: 0; color: #ff9800;">Bio Field Conflicts (${totalConflicts} across ${playersWithConflicts.length} players)</h3>
                                <div style="display: flex; gap: 8px;">
                                    <button id="roster-conflict-keep-all-global" style="padding: 6px 12px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        Keep All Current
                                    </button>
                                    <button id="roster-conflict-use-all-global" style="padding: 6px 12px; background: #1a5a1a; border: 1px solid #2a7a2a; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        Use All New
                                    </button>
                                </div>
                            </div>
                            <p style="color: #aaa; font-size: 13px; margin-bottom: 15px;">
                                The following players have different values for bio fields. Choose which value to keep, or click "Done" to collapse a player's card.
                            </p>
                            <div class="conflicts-list" style="max-height: 500px; overflow-y: auto; padding-right: 10px;">
                                ${conflictsHTML}
                            </div>
                        </div>
                    ` : ''}

                    ${totalExisting > 0 ? `
                        <div class="existing-details" style="margin-top: 20px;">
                            <details>
                                <summary style="cursor: pointer; color: #2196F3;">Show ${totalExisting} existing player(s) to be updated</summary>
                                <div style="margin-top: 10px; max-height: 250px; overflow-y: auto; background: #1a1a1a; padding: 10px; border-radius: 4px; font-size: 13px;">
                                    ${[...existingBundled, ...existingCustom].map(item => {
        const firstName = item.player.PFNA || item.player.firstName || '';
        const lastName = item.player.PLNA || item.player.lastName || '';
        const name = `${firstName} ${lastName}`.trim();
        const type = item.isCustomPlayer ? '(custom)' : '(bundled)';
        return `<div style="padding: 2px 0;">${name} <span style="color: #666;">${type}</span></div>`;
    }).join('')}
                                </div>
                            </details>
                        </div>
                    ` : ''}

                    ${totalNew > 0 ? `
                        <div class="new-details" style="margin-top: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <h4 style="margin: 0; color: #4CAF50;">${totalNew} New Player(s) to Create</h4>
                                <div style="display: flex; gap: 8px;">
                                    <button id="roster-new-select-all" style="padding: 6px 12px; background: #1a5a1a; border: 1px solid #2a7a2a; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        Select All
                                    </button>
                                    <button id="roster-new-select-none" style="padding: 6px 12px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        Deselect All
                                    </button>
                                </div>
                            </div>
                            <div id="roster-new-players-list" style="max-height: 300px; overflow-y: auto; background: #1a1a1a; padding: 10px; border-radius: 4px; font-size: 13px;">
                                ${newPlayers.map((item, idx) => {
        const firstName = item.player.PFNA || item.player.firstName || '';
        const lastName = item.player.PLNA || item.player.lastName || '';
        const name = `${firstName} ${lastName}`.trim();
        const pos = item.player.PPOS !== undefined ? POSITION_MAPPINGS[item.player.PPOS] : '?';
        const ovr = item.player.POVR || '?';
        return `<label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer;">
                                        <input type="checkbox" class="roster-new-player-checkbox" data-index="${item.playerIndex}" checked>
                                        <span>${name}</span>
                                        <span style="color: #666;">(${pos}, ${ovr} OVR)</span>
                                    </label>`;
    }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 15px; border-top: 1px solid #444;">
                    <button id="roster-push-db-cancel-btn" style="padding: 10px 20px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="roster-push-db-execute-btn" style="padding: 10px 20px; background: #2196F3; border: none; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Push ${totalPlayers} Players to Database
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('roster-push-db-modal');

    // Close handlers
    const closeModal = () => {
        modal.remove();
    };

    document.getElementById('roster-push-db-close-btn').addEventListener('click', closeModal);
    document.getElementById('roster-push-db-cancel-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Conflict card button handlers
    // "Keep All Current" per card
    document.querySelectorAll('.roster-conflict-keep-all-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cardId = btn.dataset.card;
            const card = document.getElementById(cardId);
            if (card) {
                card.querySelectorAll('input[type="radio"][value="keep"]').forEach(radio => {
                    radio.checked = true;
                });
            }
        });
    });

    // "Use All New" per card
    document.querySelectorAll('.roster-conflict-use-all-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cardId = btn.dataset.card;
            const card = document.getElementById(cardId);
            if (card) {
                card.querySelectorAll('input[type="radio"][value="overwrite"]').forEach(radio => {
                    radio.checked = true;
                });
            }
        });
    });

    // "Done" button - collapse/minimize card
    document.querySelectorAll('.roster-conflict-done-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cardId = btn.dataset.card;
            const card = document.getElementById(cardId);
            if (card) {
                const body = card.querySelector('.conflict-card-body');
                if (body.style.display === 'none') {
                    // Expand
                    body.style.display = 'block';
                    btn.textContent = 'Done';
                    card.style.opacity = '1';
                } else {
                    // Collapse
                    body.style.display = 'none';
                    btn.textContent = 'Expand';
                    card.style.opacity = '0.7';
                }
            }
        });
    });

    // Global "Keep All Current"
    const globalKeepAllBtn = document.getElementById('roster-conflict-keep-all-global');
    if (globalKeepAllBtn) {
        globalKeepAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.conflicts-list input[type="radio"][value="keep"]').forEach(radio => {
                radio.checked = true;
            });
        });
    }

    // Global "Use All New"
    const globalUseAllBtn = document.getElementById('roster-conflict-use-all-global');
    if (globalUseAllBtn) {
        globalUseAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.conflicts-list input[type="radio"][value="overwrite"]').forEach(radio => {
                radio.checked = true;
            });
        });
    }

    // Push mode radio handlers - show/hide bio fields section
    const bioFieldsSection = document.getElementById('roster-bio-fields-section');
    document.querySelectorAll('input[name="roster-push-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'ratings') {
                bioFieldsSection.style.display = 'none';
            } else {
                bioFieldsSection.style.display = 'block';
            }
        });
    });

    // Bio fields Select All / Select None buttons
    document.getElementById('roster-bio-select-all')?.addEventListener('click', () => {
        document.querySelectorAll('#roster-bio-fields-section input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
    });

    document.getElementById('roster-bio-select-none')?.addEventListener('click', () => {
        document.querySelectorAll('#roster-bio-fields-section input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
    });

    // New players checkbox handlers
    const executeBtn = document.getElementById('roster-push-db-execute-btn');

    function updateRosterPushButtonText() {
        const checkedCount = document.querySelectorAll('.roster-new-player-checkbox:checked').length;
        const total = totalExisting + checkedCount;
        executeBtn.textContent = `Push ${total} Players to Database`;
    }

    document.getElementById('roster-new-select-all')?.addEventListener('click', () => {
        document.querySelectorAll('.roster-new-player-checkbox').forEach(cb => cb.checked = true);
        updateRosterPushButtonText();
    });

    document.getElementById('roster-new-select-none')?.addEventListener('click', () => {
        document.querySelectorAll('.roster-new-player-checkbox').forEach(cb => cb.checked = false);
        updateRosterPushButtonText();
    });

    document.querySelectorAll('.roster-new-player-checkbox').forEach(cb => {
        cb.addEventListener('change', updateRosterPushButtonText);
    });

    // Execute push handler
    document.getElementById('roster-push-db-execute-btn').addEventListener('click', async () => {
        // Gather resolutions from radio buttons
        const resolutions = [];
        for (const conflict of allConflicts) {
            const keepCurrent = document.querySelector(`input[name="${conflict.id}"]:checked`)?.value === 'keep';
            resolutions.push({
                playerIndex: conflict.playerIndex,
                field: conflict.field,
                keepCurrent
            });
        }

        // Get push mode
        const pushMode = document.querySelector('input[name="roster-push-mode"]:checked')?.value || 'all';

        // Get bio field options (only relevant for "all" mode)
        // Defaults should be TRUE to match checked checkboxes in HTML
        const bioFieldOptions = {
            team: document.getElementById('roster-bio-team')?.checked ?? true,
            jersey: document.getElementById('roster-bio-jersey')?.checked ?? true,
            archetype: document.getElementById('roster-bio-archetype')?.checked ?? true,
            position: document.getElementById('roster-bio-position')?.checked ?? true,
            college: document.getElementById('roster-bio-college')?.checked ?? true,
            height: document.getElementById('roster-bio-height')?.checked ?? true,
            weight: document.getElementById('roster-bio-weight')?.checked ?? true,
            homeState: document.getElementById('roster-bio-homestate')?.checked ?? true,
            race: document.getElementById('roster-bio-race')?.checked ?? true,
            bodyType: document.getElementById('roster-bio-bodytype')?.checked ?? true,
            handedness: document.getElementById('roster-bio-handedness')?.checked ?? true,
            pid: document.getElementById('roster-bio-pid')?.checked ?? true,
            pam: document.getElementById('roster-bio-pam')?.checked ?? true
        };

        // Get other options
        const overwriteExistingSeasons = document.getElementById('roster-overwrite-seasons-checkbox')?.checked ?? true;
        const fillEmptyBioFields = document.getElementById('roster-fill-empty-bio-checkbox')?.checked ?? false;

        // DEBUG: Log bio field options being used
        console.log('[Push to DB] EXECUTE - bioFieldOptions:', bioFieldOptions);
        console.log('[Push to DB] EXECUTE - fillEmptyBioFields:', fillEmptyBioFields);
        console.log('[Push to DB] EXECUTE - pushMode:', pushMode);

        // DEBUG: Log first player in analysis to see if bio fields exist
        if (analysis.existingBundled && analysis.existingBundled.length > 0) {
            const firstBundled = analysis.existingBundled[0];
            console.log('[Push to DB] EXECUTE - First bundled player in analysis:', firstBundled.player?.PFNA, firstBundled.player?.PLNA);
            console.log('[Push to DB] EXECUTE - Player PHGT:', firstBundled.player?.PHGT, 'PWGT:', firstBundled.player?.PWGT, 'PHSN:', firstBundled.player?.PHSN);
            console.log('[Push to DB] EXECUTE - All player keys:', Object.keys(firstBundled.player || {}).join(', '));
        }

        // Get selected new player indices
        const selectedNewIndices = new Set();
        document.querySelectorAll('.roster-new-player-checkbox:checked').forEach(cb => {
            selectedNewIndices.add(parseInt(cb.dataset.index));
        });

        // Filter analysis to only include selected new players
        const filteredAnalysis = {
            ...analysis,
            newPlayers: analysis.newPlayers.filter(item => selectedNewIndices.has(item.playerIndex))
        };

        // Disable button and show progress
        executeBtn.disabled = true;
        executeBtn.textContent = 'Pushing...';

        try {
            const response = await window.electronAPI.database.executeRosterPush(
                filteredAnalysis,
                resolutions,
                { pushMode, bioFieldOptions, overwriteExistingSeasons, fillEmptyBioFields }
            );

            if (response.success && response.result) {
                const result = response.result;
                closeModal();

                // Show success message
                const successHTML = `
                    <div id="roster-push-db-success-modal" class="modal-overlay" style="z-index: 100001;">
                        <div class="modal-content" style="max-width: 400px; text-align: center; padding: 30px;">
                            <div style="font-size: 48px; color: #4CAF50; margin-bottom: 20px;">✓</div>
                            <h2 style="margin: 0 0 15px 0;">Push Complete!</h2>
                            <div style="text-align: left; background: #1a1a1a; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                                    <span>Players Created:</span>
                                    <span style="color: #4CAF50; font-weight: bold;">${result.created}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                                    <span>Players Updated:</span>
                                    <span style="color: #2196F3; font-weight: bold;">${result.updated}</span>
                                </div>
                                ${result.skipped > 0 ? `
                                    <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                                        <span>Skipped:</span>
                                        <span style="color: #888;">${result.skipped}</span>
                                    </div>
                                ` : ''}
                                ${result.errors.length > 0 ? `
                                    <div style="margin-top: 10px; color: #ff5722;">
                                        <strong>Errors:</strong>
                                        <div style="font-size: 12px; max-height: 100px; overflow-y: auto;">
                                            ${result.errors.join('<br>')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                            <button id="roster-push-db-success-close-btn" style="padding: 10px 30px; background: #2196F3; border: none; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">
                                Close
                            </button>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', successHTML);

                document.getElementById('roster-push-db-success-close-btn').addEventListener('click', () => {
                    document.getElementById('roster-push-db-success-modal').remove();
                });

            } else {
                alert(`Push failed: ${response.error}`);
                executeBtn.disabled = false;
                executeBtn.textContent = `Push ${totalPlayers} Players to Database`;
            }

        } catch (error) {
            console.error('[Push to DB] Error:', error);
            alert(`Error: ${error.message || error}`);
            executeBtn.disabled = false;
            executeBtn.textContent = `Push ${totalPlayers} Players to Database`;
        }
    });
}

// =============================================
// MULTI-DELETE MODE
// =============================================

/**
 * Track multi-delete state
 */
let _multiDeleteState = {
    active: false,
    editorType: null, // 'roster' or 'draft'
    originalColumnDefs: null
};

/**
 * Enter multi-delete mode - adds checkbox selection column and shows toolbar
 */
export function enterMultiDeleteMode(app, editorType = 'roster') {
    if (_multiDeleteState.active) {
        console.log('[Multi-Delete] Already in multi-delete mode');
        return;
    }

    const grid = editorType === 'roster' ? app.agGrid : app.draftGrid;
    if (!grid) {
        console.error('[Multi-Delete] No grid available for', editorType);
        return;
    }

    console.log('[Multi-Delete] Entering multi-delete mode for', editorType);

    _multiDeleteState.active = true;
    _multiDeleteState.editorType = editorType;

    // Store original column state for restoration
    _multiDeleteState.originalColumnDefs = grid.getColumnDefs();

    // Add checkbox selection column at the beginning
    const checkboxColumn = {
        headerName: '',
        field: '_multiDeleteCheckbox',
        width: 50,
        pinned: 'left',
        lockPosition: true,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: true,
        sortable: false,
        filter: false,
        editable: false,
        suppressHeaderMenuButton: true,
        suppressHeaderContextMenu: true,
        cellStyle: { padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    };

    // Get current column defs and prepend checkbox column
    const currentColDefs = grid.getColumnDefs();
    const newColDefs = [checkboxColumn, ...currentColDefs];
    grid.setGridOption('columnDefs', newColDefs);

    // Enable row selection mode
    grid.setGridOption('rowSelection', {
        mode: 'multiRow',
        checkboxes: true,
        headerCheckbox: true
    });

    // Show the multi-delete toolbar
    const toolbar = document.getElementById('multi-delete-toolbar');
    if (toolbar) {
        toolbar.style.display = 'flex';
        updateMultiDeleteCount(0);
    }

    // Set up selection changed listener to update count
    const selectionListener = (event) => {
        const selectedRows = event.api.getSelectedRows();
        updateMultiDeleteCount(selectedRows.length);
    };
    grid.addEventListener('selectionChanged', selectionListener);
    _multiDeleteState.selectionListener = selectionListener;

    // Wire up toolbar buttons
    const confirmBtn = document.getElementById('multi-delete-confirm');
    const cancelBtn = document.getElementById('multi-delete-cancel');

    if (confirmBtn) {
        confirmBtn.onclick = () => executeMultiDelete(app, editorType, grid);
    }
    if (cancelBtn) {
        cancelBtn.onclick = () => exitMultiDeleteMode(app, editorType, grid);
    }
}

/**
 * Update the selected count in the toolbar
 */
function updateMultiDeleteCount(count) {
    const countEl = document.getElementById('multi-delete-count');
    if (countEl) {
        countEl.textContent = count;
    }

    // Enable/disable delete button based on selection
    const confirmBtn = document.getElementById('multi-delete-confirm');
    if (confirmBtn) {
        confirmBtn.disabled = count === 0;
        confirmBtn.style.opacity = count === 0 ? '0.5' : '1';
    }
}

/**
 * Execute multi-delete after confirmation
 */
async function executeMultiDelete(app, editorType, grid) {
    const selectedRows = grid.getSelectedRows();
    const count = selectedRows.length;

    if (count === 0) {
        alert('No players selected.');
        return;
    }

    // Show confirmation dialog
    const confirmMsg = `Are you sure you want to delete ${count} player${count > 1 ? 's' : ''}?\n\nThis action cannot be undone.`;
    if (!confirm(confirmMsg)) {
        return;
    }

    console.log(`[Multi-Delete] Deleting ${count} players from ${editorType}`);

    // Determine which arrays to modify based on editor type
    const mainArray = editorType === 'roster' ? app.players : app.draftProspects;
    const filteredArray = editorType === 'roster' ? app.filteredPlayers : app.filteredDraftProspects;

    // Remove selected players from both arrays
    // Create a Set of selected players for efficient lookup
    const selectedSet = new Set(selectedRows);

    // Filter out selected players from main array
    const newMainArray = mainArray.filter(p => !selectedSet.has(p));

    // Filter out selected players from filtered array
    const newFilteredArray = filteredArray ? filteredArray.filter(p => !selectedSet.has(p)) : null;

    // Update the app arrays
    if (editorType === 'roster') {
        app.players = newMainArray;
        app.filteredPlayers = newFilteredArray;
    } else {
        app.draftProspects = newMainArray;
        app.filteredDraftProspects = newFilteredArray;
    }

    console.log(`[Multi-Delete] Removed ${count} players. Remaining: ${newMainArray.length}`);

    // Mark as modified
    app.hasUnsavedChanges = true;
    const saveBtn = document.getElementById(editorType === 'roster' ? 'saveRosterBtn' : 'saveDraftBtn');
    if (saveBtn) saveBtn.style.display = 'inline-block';

    // Exit multi-delete mode and refresh grid
    exitMultiDeleteMode(app, editorType, grid);

    // Refresh the grid with new data
    grid.setGridOption('rowData', [...(newFilteredArray || newMainArray)]);

    // Refresh portraits if roster
    if (editorType === 'roster') {
        setTimeout(() => {
            grid.refreshCells({
                columns: ['_portrait', 'PLAYERPIC'],
                force: true
            });
        }, 100);
    }

    // Show success message
    app.showToast?.(`Deleted ${count} player${count > 1 ? 's' : ''}`, 'success')
        || console.log(`[Multi-Delete] Deleted ${count} player(s)`);
}

/**
 * Exit multi-delete mode - restores original grid state
 */
export function exitMultiDeleteMode(app, editorType, grid) {
    if (!_multiDeleteState.active) {
        return;
    }

    console.log('[Multi-Delete] Exiting multi-delete mode');

    // Remove selection listener
    if (_multiDeleteState.selectionListener) {
        grid.removeEventListener('selectionChanged', _multiDeleteState.selectionListener);
    }

    // Deselect all
    grid.deselectAll();

    // Restore original column definitions (without checkbox column)
    if (_multiDeleteState.originalColumnDefs) {
        grid.setGridOption('columnDefs', _multiDeleteState.originalColumnDefs);
    }

    // Reset row selection to single
    grid.setGridOption('rowSelection', {
        mode: 'singleRow',
        checkboxes: false,
        headerCheckbox: false
    });

    // Hide toolbar
    const toolbar = document.getElementById('multi-delete-toolbar');
    if (toolbar) {
        toolbar.style.display = 'none';
    }

    // Reset state
    _multiDeleteState = {
        active: false,
        editorType: null,
        originalColumnDefs: null,
        selectionListener: null
    };
}
