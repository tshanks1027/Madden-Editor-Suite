/**
 * Complete AG-Grid Draft Class Table Implementation
 * Full replacement for Handsontable with all features from roster editor
 */

import { createGrid, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import {
    getLookupValue,
    getLookupOptions,
    BODY_TYPE_NAMES,
    onBodyTypeChange,
    onWeightChange,
    storedWeightToActual,
    getWeightFromBodyType,
    isWeightValidForBodyType
} from '../data/field-definitions.js';
import { FastSelectEditor } from './FastSelectEditor.js';
import { getCollegeById, getCollegeByName, NCAA_LOGO, NCAA_COLORS } from '../data/college-data.js';

// Register AG-Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Position mappings for archetype lookups (matches position_lookup.csv - M26 names)
const POSITION_MAPPINGS = {
    0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
    8: 'RG', 9: 'RT', 10: 'LEDG', 11: 'REDG', 12: 'DT', 13: 'SAM', 14: 'Mike',
    15: 'WILL', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
};

// Map M26 position names to archetype lookup names
// Archetypes use old position names (LE, RE, LOLB, MLB, ROLB)
const POSITION_TO_ARCHETYPE_POS = {
    'LEDG': 'LE',
    'REDG': 'RE',
    'SAM': 'LOLB',
    'Mike': 'MIKE',
    'MIKE': 'MIKE',
    'WILL': 'ROLB'
};

/**
 * Build OVR attributes from prospect data
 * MATCHES ROSTER EDITOR EXACTLY: uses || 50 for missing values
 * Roster editor: attributes[field] = parseInt(actualPlayer[field]) || 50
 */
function buildOVRAttributes(prospect) {
    const attributes = {};

    // Mapping from prospect field names to Madden field codes (same codes as roster editor)
    const fieldMap = {
        speed: 'PSPD', acceleration: 'PACC', agility: 'PAGI', strength: 'PSTR',
        jumping: 'PJMP', awareness: 'PAWR', throwPower: 'PTHP', throwAccuracyShort: 'PTAS',
        throwAccuracyMid: 'PTAM', throwAccuracyDeep: 'PTAD', throwOnTheRun: 'PTOR',
        throwUnderPressure: 'PTUP', playAction: 'PPLA', breakSack: 'PBSK',
        passBlock: 'PPBK', runBlock: 'PRBK', leadBlock: 'PLBK', impactBlocking: 'PLIB',
        passBlockFinesse: 'PPBF', passBlockPower: 'PPBS', runBlockFinesse: 'PRBF',
        runBlockPower: 'PRBS', tackle: 'PTAK', hitPower: 'PLHT', manCoverage: 'PLMC',
        zoneCoverage: 'PLZC', playRecognition: 'PLPR', pursuit: 'PLPU',
        powerMoves: 'PLPM', finesseMoves: 'PFMS', blockShed: 'PBSG', blockShedding: 'PBSG',
        pressCoverage: 'PLPE', press: 'PLPE', kickPower: 'PKPR', kickAccuracy: 'PKAC',
        kickReturn: 'PKRT', carrying: 'PCAR', catching: 'PCTH', catchInTraffic: 'PLCI',
        spectacularCatch: 'PLSC', release: 'PLRL', stamina: 'PSTA', injury: 'PINJ',
        toughness: 'PTGH', breakTackle: 'PBKT', trucking: 'PLTR',
        changeOfDirection: 'PELU', elusiveness: 'PELU', spinMove: 'PLSM',
        jukeMoves: 'PLJM', jukeMove: 'PLJM', stiffArm: 'PLSA', bcVision: 'PBCV',
        routeRunningShort: 'SRRN', shortRouteRunning: 'SRRN',
        routeRunningMid: 'PMRR', mediumRouteRunning: 'PMRR',
        routeRunningDeep: 'PDRR', deepRouteRunning: 'PDRR'
    };

    // Match roster editor exactly: attributes[field] = parseInt(value) || 50
    for (const [prospectField, fieldCode] of Object.entries(fieldMap)) {
        attributes[fieldCode] = parseInt(prospect[prospectField]) || 50;
    }

    return attributes;
}

/**
 * Portrait Cell Renderer - shows player portraits with click-to-view-card
 */
class DraftPortraitCellRenderer {
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

        const prospect = data;
        const pid = prospect ? (prospect.PID || 0) : 0;

        // Portrait: ALWAYS use PID (PAM only affects in-game face model)
        // PIDs like 731, 2583 map to generic face portraits
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

        // Click handler to show player card
        this.eGui.addEventListener('click', () => {
            const rowIndex = params.node.rowIndex;
            app.showDraftPlayerCard(rowIndex);
        });

        // Right-click context menu for face picker
        this.eGui.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (prospect) {
                app.openGenericFacePicker(prospect, params.node.rowIndex, 'draft');
            }
        });
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        return false;
    }

    destroy() {}
}

/**
 * PAM Cell Renderer - shows PAM value with right-click to open PAM picker
 */
class DraftPAMCellRenderer {
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

        const prospect = params.data;
        const pamValue = prospect ? prospect.PEPS : null;

        this.eGui.textContent = pamValue || '';
        this.eGui.title = 'Right-click to select generic PAM';

        this.eGui.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (prospect && app && app.openPAMPicker) {
                app.openPAMPicker(prospect, params.node.rowIndex, 'draft');
            }
        });
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        const prospect = params.data;
        const pamValue = prospect ? prospect.PEPS : null;
        this.eGui.textContent = pamValue || '';
        return true;
    }

    destroy() {}
}

/**
 * Draft Position Cell Renderer - shows 1-indexed position, editable
 */
class DraftPositionCellRenderer {
    init(params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'draft-position-cell';
        this.eGui.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            font-weight: bold;
            background-color: #2a2a2a;
        `;

        const draftPosition = params.data ? params.data.draftPosition : params.node.rowIndex;
        this.eGui.textContent = (draftPosition + 1).toString();
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        const draftPosition = params.data ? params.data.draftPosition : params.node.rowIndex;
        this.eGui.textContent = (draftPosition + 1).toString();
        return true;
    }

    destroy() {}
}

/**
 * Round Cell Renderer - shows round number or UFA
 */
class RoundCellRenderer {
    init(params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            background-color: #2a2a2a;
        `;

        this.updateValue(params.value);
    }

    updateValue(value) {
        if (value === 8) {
            this.eGui.textContent = 'UFA';
            this.eGui.style.color = '#888';
        } else if (value) {
            this.eGui.textContent = value.toString();
            this.eGui.style.color = '#e0e0e0';
        } else {
            this.eGui.textContent = '';
        }
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        this.updateValue(params.value);
        return true;
    }

    destroy() {}
}

/**
 * OVR Cell Renderer - styled OVR display
 */
class OVRCellRenderer {
    init(params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            font-weight: bold;
            font-size: 14px;
        `;

        this.updateValue(params.value);
    }

    updateValue(value) {
        const ovr = value || 0;
        this.eGui.textContent = ovr.toString();

        // Color based on OVR tier
        if (ovr >= 90) {
            this.eGui.style.color = '#4CAF50'; // Elite - green
        } else if (ovr >= 80) {
            this.eGui.style.color = '#8BC34A'; // Star - light green
        } else if (ovr >= 70) {
            this.eGui.style.color = '#FFC107'; // Starter - yellow
        } else if (ovr >= 60) {
            this.eGui.style.color = '#FF9800'; // Backup - orange
        } else {
            this.eGui.style.color = '#F44336'; // Below - red
        }
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        this.updateValue(params.value);
        return true;
    }

    destroy() {}
}

/**
 * Create column definitions for draft class grid
 * @param app - App reference
 * @param archetypeData - Pre-loaded archetype data { byPosition, idToName, nameToId }
 */
export function createDraftColumnDefs(app, archetypeData = null) {
    const columnDefs = [];

    // Get lookup options
    const positionOptions = getLookupOptions('positions').map(opt => opt.label);
    const collegeOptions = getLookupOptions('colleges').map(opt => opt.label);
    const stateOptions = getLookupOptions('states').map(opt => opt.label);
    const devTraitOptions = ['Normal', 'Star', 'Superstar', 'X-Factor'];
    // Body type options match roster BTYP values: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Lean
    const bodyTypeOptions = ['Standard', 'Thin', 'Muscular', 'Heavy', 'Lean'];
    const playerPicOptions = window.lookupData?.pidsCapitalized
        ? Array.from(window.lookupData.pidsCapitalized.values()).concat(['Generic Face'])
        : ['Generic Face'];

    // Use passed archetype data or empty defaults
    const archetypesByPosition = archetypeData?.byPosition || {};
    const archetypeIdToName = archetypeData?.idToName || {};
    const archetypeNameToId = archetypeData?.nameToId || {};

    // Build position lookup maps
    const positionValueToDisplay = {};
    const positionDisplayToValue = {};
    getLookupOptions('positions').forEach(opt => {
        positionValueToDisplay[opt.value] = opt.label;
        positionDisplayToValue[opt.label] = opt.value;
    });

    // Build college lookup maps
    const collegeValueToDisplay = {};
    const collegeDisplayToValue = {};
    getLookupOptions('colleges').forEach(opt => {
        collegeValueToDisplay[opt.value] = opt.label;
        collegeDisplayToValue[opt.label] = opt.value;
    });

    // Build state lookup maps
    const stateValueToDisplay = {};
    const stateDisplayToValue = {};
    getLookupOptions('states').forEach(opt => {
        stateValueToDisplay[opt.value] = opt.label;
        stateDisplayToValue[opt.label] = opt.value;
    });

    // Dev trait mappings
    const devTraitValueToDisplay = { 0: 'Normal', 1: 'Star', 2: 'Superstar', 3: 'X-Factor' };
    const devTraitDisplayToValue = { 'Normal': 0, 'Star': 1, 'Superstar': 2, 'X-Factor': 3 };

    // Body type mappings - matches roster BTYP values: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Lean
    const bodyTypeValueToDisplay = { 0: 'Standard', 1: 'Thin', 2: 'Muscular', 3: 'Heavy', 4: 'Lean' };
    const bodyTypeDisplayToValue = { 'Standard': 0, 'Thin': 1, 'Muscular': 2, 'Heavy': 3, 'Lean': 4 };

    // Draft Position column (1st)
    columnDefs.push({
        headerName: 'Pick',
        field: 'draftPosition',
        width: 70,
        pinned: 'left',
        lockPosition: true,
        cellRenderer: DraftPositionCellRenderer,
        editable: true,
        valueSetter: (params) => {
            // Convert 1-indexed input to 0-indexed storage
            const newPos = parseInt(params.newValue) - 1;
            if (isNaN(newPos) || newPos < 0) return false;
            params.data.draftPosition = newPos;
            return true;
        },
        valueGetter: (params) => {
            return (params.data?.draftPosition ?? params.node?.rowIndex ?? 0) + 1;
        },
        cellStyle: { textAlign: 'center', fontWeight: 'bold' }
    });

    // Round column (2nd)
    columnDefs.push({
        headerName: 'Rd',
        field: 'round',
        width: 60,
        pinned: 'left',
        lockPosition: true,
        cellRenderer: RoundCellRenderer,
        editable: false,
        cellStyle: { textAlign: 'center' },
        comparator: (valueA, valueB) => {
            // Sort by round number (8 = UFA should be last)
            const a = valueA || 0;
            const b = valueB || 0;
            return a - b;
        }
    });

    // Portrait column (3rd)
    columnDefs.push({
        headerName: '📷',
        field: '_portrait',
        width: 80,
        pinned: 'left',
        lockPosition: true,
        cellRenderer: DraftPortraitCellRenderer,
        cellRendererParams: { app },
        sortable: false,
        filter: false,
        editable: false,
        suppressHeaderMenuButton: true,
        cellStyle: { padding: '2px' }
    });

    // Name columns (4th, 5th - pinned)
    columnDefs.push({
        headerName: 'Last Name',
        field: 'lastName',
        width: 120,
        pinned: 'left',
        lockPosition: true,
        editable: true,
        filter: 'agTextColumnFilter'
    });

    columnDefs.push({
        headerName: 'First Name',
        field: 'firstName',
        width: 100,
        pinned: 'left',
        lockPosition: true,
        editable: true,
        filter: 'agTextColumnFilter'
    });

    // Position column (6th - pinned)
    columnDefs.push({
        headerName: 'Pos',
        field: 'position',
        width: 80,
        pinned: 'left',
        lockPosition: true,
        editable: true,
        cellEditor: FastSelectEditor,
        cellEditorParams: { values: positionOptions },
        valueGetter: (params) => {
            const val = params.data?.position;
            if (typeof val === 'number') {
                return positionValueToDisplay[val] || val;
            }
            return val || '';
        },
        valueSetter: (params) => {
            const id = positionDisplayToValue[params.newValue];
            if (id !== undefined) {
                params.data.position = params.newValue; // Store display name
                params.data.positionId = id; // Store ID for save
                return true;
            }
            params.data.position = params.newValue;
            return true;
        },
        cellRenderer: (params) => {
            const value = params.value || '';
            return `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 8px;">
                <span>${value}</span>
                <span style="color: #999; font-size: 12px;">▼</span>
            </div>`;
        },
        comparator: (valueA, valueB) => {
            // Sort alphabetically by position name
            const a = String(valueA || '').toLowerCase();
            const b = String(valueB || '').toLowerCase();
            return a.localeCompare(b);
        }
    });

    // Archetype column (position-dependent dropdown)
    columnDefs.push({
        headerName: 'Archetype',
        field: 'archetype',
        width: 180,
        editable: true,
        valueGetter: (params) => {
            const val = params.data?.archetype;
            // If numeric ID, convert to name
            if (typeof val === 'number') {
                return archetypeIdToName[val] || `Unknown (${val})`;
            }
            return val || '';
        },
        cellEditorSelector: (params) => {
            let posName = params.data.position;
            if (typeof posName === 'number') {
                posName = POSITION_MAPPINGS[posName] || 'QB';
            }
            // Convert M26 position names to archetype lookup names
            const archetypePosName = POSITION_TO_ARCHETYPE_POS[posName] || posName;
            const archetypes = archetypesByPosition[archetypePosName] || [];
            const values = archetypes.map(a => a.name);
            return {
                component: FastSelectEditor,
                params: { values }
            };
        },
        valueSetter: (params) => {
            const archetypeId = archetypeNameToId[params.newValue];
            if (archetypeId !== undefined) {
                params.data.archetype = params.newValue;
                params.data.archetypeId = archetypeId;
                return true;
            }
            params.data.archetype = params.newValue;
            return true;
        },
        cellRenderer: (params) => {
            const value = params.value || '';
            return `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 8px;">
                <span>${value}</span>
                <span style="color: #999; font-size: 12px;">▼</span>
            </div>`;
        }
    });

    // Jersey Number
    columnDefs.push({
        headerName: 'Jersey',
        field: 'jerseyNum',
        width: 70,
        editable: true,
        type: 'numericColumn',
        cellStyle: { textAlign: 'center' }
    });

    // College
    columnDefs.push({
        headerName: 'College',
        field: 'college',
        width: 150,
        editable: true,
        cellEditor: FastSelectEditor,
        cellEditorParams: { values: collegeOptions },
        valueGetter: (params) => {
            const val = params.data?.college;
            if (typeof val === 'number') {
                return collegeValueToDisplay[val] || val;
            }
            return val || '';
        },
        valueSetter: (params) => {
            const id = collegeDisplayToValue[params.newValue];
            if (id !== undefined) {
                params.data.college = params.newValue;
                params.data.collegeId = id;
                return true;
            }
            params.data.college = params.newValue;
            return true;
        },
        cellRenderer: (params) => {
            const value = params.value || '';
            return `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 8px;">
                <span>${value}</span>
                <span style="color: #999; font-size: 12px;">▼</span>
            </div>`;
        }
    });

    // Age
    columnDefs.push({
        headerName: 'Age',
        field: 'age',
        width: 55,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 18, max: 45, precision: 0 },
        cellStyle: { textAlign: 'center' }
    });

    // Height
    columnDefs.push({
        headerName: 'Height',
        field: 'heightInches',
        width: 70,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 60, max: 90, precision: 0 },
        cellStyle: { textAlign: 'center' }
    });

    // Weight (linked to body type)
    columnDefs.push({
        headerName: 'Weight',
        field: 'weight',
        width: 70,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 150, max: 400, precision: 0 },
        valueSetter: (params) => {
            const newWeight = parseInt(params.newValue);
            if (isNaN(newWeight)) return false;

            params.data.weight = newWeight;

            // Only update body type if current body type is NOT valid for the new weight
            const currentBodyTypeId = params.data.bodyTypeId ?? bodyTypeDisplayToValue[params.data.bodyType] ?? 0;

            if (isWeightValidForBodyType(newWeight, currentBodyTypeId)) {
                // Current body type is still valid for new weight - keep it!
                console.log(`[Draft] Weight changed to ${newWeight} lbs, keeping body type ${params.data.bodyType} (still valid)`);
            } else {
                // Current body type is NOT valid for new weight - calculate new one
                const position = params.data.position || params.data.positionId;
                const height = params.data.heightInches || 74;
                const storedWeight = newWeight - 160;
                const newBodyTypeId = onWeightChange(storedWeight, position, height);
                const newBodyTypeName = bodyTypeValueToDisplay[newBodyTypeId] || 'Standard';

                params.data.bodyType = newBodyTypeName;
                params.data.bodyTypeId = newBodyTypeId;
                console.log(`[Draft] Weight changed to ${newWeight} lbs, current body type not valid, updating to ${newBodyTypeName} (${newBodyTypeId})`);

                // Refresh the body type cell to show new value
                if (params.api) {
                    params.api.refreshCells({ rowNodes: [params.node], columns: ['bodyType'] });
                }
            }
            return true;
        },
        cellStyle: { textAlign: 'center' }
    });

    // Home State
    columnDefs.push({
        headerName: 'State',
        field: 'homeState',
        width: 100,
        editable: true,
        cellEditor: FastSelectEditor,
        cellEditorParams: { values: stateOptions },
        valueGetter: (params) => {
            const val = params.data?.homeState;
            if (typeof val === 'number') {
                return stateValueToDisplay[val] || val;
            }
            return val || '';
        },
        valueSetter: (params) => {
            const id = stateDisplayToValue[params.newValue];
            if (id !== undefined) {
                params.data.homeState = params.newValue;
                params.data.homeStateId = id;
                return true;
            }
            params.data.homeState = params.newValue;
            return true;
        },
        cellRenderer: (params) => {
            const value = params.value || '';
            return `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 8px;">
                <span>${value}</span>
                <span style="color: #999; font-size: 12px;">▼</span>
            </div>`;
        }
    });

    // Home Town
    columnDefs.push({
        headerName: 'Town',
        field: 'homeTown',
        width: 120,
        editable: true,
        filter: 'agTextColumnFilter'
    });

    // PID
    columnDefs.push({
        headerName: 'PID',
        field: 'PID',
        width: 70,
        editable: true,
        type: 'numericColumn',
        cellStyle: { textAlign: 'center' },
        valueSetter: (params) => {
            const newPID = parseInt(params.newValue);
            if (isNaN(newPID)) return false;

            params.data.PID = newPID;

            // Update player pic name from PID lookup
            // pidsCapitalized maps PID -> Capitalized Name
            const playerName = window.lookupData?.pidsCapitalized?.get(newPID) || 'Generic Face';
            params.data.playerPic = playerName;

            // Refresh portrait cache and grid
            const cacheKey = `pid_${newPID}`;
            console.log(`[Draft PID] Refreshing portrait for PID ${newPID}`);

            if (app.portraitCache) {
                app.portraitCache.set(cacheKey, 'loading');
            }

            window.electronAPI.portrait.getByPID(newPID).then(imageData => {
                if (app.portraitCache) {
                    app.portraitCache.set(cacheKey, imageData || null);
                }
                // Refresh the portrait column
                if (params.api) {
                    params.api.refreshCells({ rowNodes: [params.node], columns: ['_portrait'], force: true });
                    // Also refresh playerPic column
                    params.api.refreshCells({ rowNodes: [params.node], columns: ['playerPic'], force: true });
                }
            }).catch(err => {
                console.error(`[Draft PID] Error loading portrait:`, err);
                if (app.portraitCache) {
                    app.portraitCache.set(cacheKey, null);
                }
            });

            return true;
        }
    });

    // Player Pic (autocomplete from PID lookup)
    columnDefs.push({
        headerName: 'Player Pic',
        field: 'playerPic',
        width: 150,
        editable: true,
        cellEditor: FastSelectEditor,
        cellEditorParams: { values: playerPicOptions },
        valueSetter: (params) => {
            params.data.playerPic = params.newValue;
            // Update PID when player pic changes (pidsByName uses lowercase keys)
            if (params.newValue && params.newValue !== 'Generic Face') {
                const pid = window.lookupData?.pidsByName?.get(params.newValue.toLowerCase());
                if (pid) {
                    params.data.PID = pid;

                    // Refresh portrait cache and grid
                    const cacheKey = `pid_${pid}`;
                    console.log(`[Draft PlayerPic] Refreshing portrait for PID ${pid}`);

                    if (app.portraitCache) {
                        app.portraitCache.set(cacheKey, 'loading');
                    }

                    window.electronAPI.portrait.getByPID(pid).then(imageData => {
                        if (app.portraitCache) {
                            app.portraitCache.set(cacheKey, imageData || null);
                        }
                        // Refresh the portrait column
                        if (params.api) {
                            params.api.refreshCells({ rowNodes: [params.node], columns: ['_portrait'], force: true });
                        }
                    }).catch(err => {
                        console.error(`[Draft PlayerPic] Error loading portrait:`, err);
                        if (app.portraitCache) {
                            app.portraitCache.set(cacheKey, null);
                        }
                    });
                }
            }
            return true;
        }
    });

    // PEPS (PAM)
    columnDefs.push({
        headerName: 'Asset ID',
        field: 'PEPS',
        width: 180,
        editable: true,
        cellRenderer: DraftPAMCellRenderer,
        cellRendererParams: { app }
    });

    // Commentary ID
    columnDefs.push({
        headerName: 'Commentary',
        field: 'commentaryId',
        width: 80,
        editable: true,
        type: 'numericColumn',
        cellStyle: { textAlign: 'center' }
    });

    // Body Type (linked to weight)
    columnDefs.push({
        headerName: 'Body Type',
        field: 'bodyType',
        width: 110,
        editable: true,
        cellEditor: FastSelectEditor,
        cellEditorParams: { values: bodyTypeOptions },
        valueGetter: (params) => {
            const val = params.data?.bodyType;
            if (typeof val === 'number') {
                return bodyTypeValueToDisplay[val] || 'Standard';
            }
            return val || 'Standard';
        },
        valueSetter: (params) => {
            const id = bodyTypeDisplayToValue[params.newValue];
            if (id !== undefined) {
                params.data.bodyType = params.newValue;
                params.data.bodyTypeId = id;

                // Only update weight if current weight is NOT valid for the new body type
                const currentWeight = params.data.weight || 220;
                if (isWeightValidForBodyType(currentWeight, id)) {
                    // Current weight is valid for new body type - keep it!
                    console.log(`[Draft] Body type changed to ${params.newValue} (${id}), keeping weight ${currentWeight} lbs (valid for this body type)`);
                } else {
                    // Current weight is NOT valid - use default weight for new body type
                    const position = params.data.position || params.data.positionId;
                    const newWeight = getWeightFromBodyType(id, position);
                    params.data.weight = newWeight;
                    console.log(`[Draft] Body type changed to ${params.newValue} (${id}), updating weight from ${currentWeight} to ${newWeight} lbs (current weight not valid)`);

                    // Refresh the weight cell to show new value
                    if (params.api) {
                        params.api.refreshCells({ rowNodes: [params.node], columns: ['weight'] });
                    }
                }
                return true;
            }
            params.data.bodyType = params.newValue;
            return true;
        },
        cellRenderer: (params) => {
            const value = params.value || 'Standard';
            return `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 8px;">
                <span>${value}</span>
                <span style="color: #999; font-size: 12px;">▼</span>
            </div>`;
        }
    });

    // OVR (editable with adjustment dialog)
    columnDefs.push({
        headerName: 'OVR',
        field: 'overall',
        width: 60,
        editable: true,
        cellRenderer: OVRCellRenderer,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, max: 99, precision: 0 },
        cellStyle: { textAlign: 'center' },
        valueSetter: (params) => {
            let val = parseInt(params.newValue);
            if (isNaN(val)) return false;
            if (val < 0) val = 0;
            if (val > 99) val = 99;
            params.data.overall = val;
            return true;
        }
    });

    // Rating columns - all numeric 0-99
    const ratingColumns = [
        { field: 'acceleration', header: 'ACC' },
        { field: 'agility', header: 'AGI' },
        { field: 'awareness', header: 'AWR' },
        { field: 'breakTackle', header: 'BTK' },
        { field: 'ballCarrierVision', header: 'BCV' },
        { field: 'blockShedding', header: 'BSH' },
        { field: 'breakSack', header: 'BSK' },
        { field: 'carrying', header: 'CAR' },
        { field: 'catchInTraffic', header: 'CIT' },
        { field: 'catching', header: 'CTH' },
        { field: 'deepRouteRunning', header: 'DRR' },
        { field: 'changeOfDirection', header: 'COD' },
        { field: 'finesseMoves', header: 'FMV' },
        { field: 'hitPower', header: 'POW' },
        { field: 'impactBlocking', header: 'IBL' },
        { field: 'injury', header: 'INJ' },
        { field: 'jukeMove', header: 'JKM' },
        { field: 'jumping', header: 'JMP' },
        { field: 'kickAccuracy', header: 'KAC' },
        { field: 'kickPower', header: 'KPW' },
        { field: 'kickReturn', header: 'KR' },
        { field: 'longSnap', header: 'LS' },
        { field: 'leadBlock', header: 'LBK' },
        { field: 'manCoverage', header: 'MCV' },
        { field: 'mediumRouteRunning', header: 'MRR' },
        { field: 'passBlock', header: 'PBK' },
        { field: 'passBlockFinesse', header: 'PBF' },
        { field: 'passBlockPower', header: 'PBS' },
        { field: 'playAction', header: 'PAC' },
        { field: 'powerMoves', header: 'PMV' },
        { field: 'pressCoverage', header: 'PRS' },
        { field: 'pursuit', header: 'PUR' },
        { field: 'playRecognition', header: 'PRC' },
        { field: 'release', header: 'RLS' },
        { field: 'runBlock', header: 'RBK' },
        { field: 'runBlockFinesse', header: 'RBF' },
        { field: 'runBlockPower', header: 'RBS' },
        { field: 'shortRouteRunning', header: 'SRR' },
        { field: 'spectacularCatch', header: 'SPC' },
        { field: 'speed', header: 'SPD' },
        { field: 'spinMove', header: 'SPM' },
        { field: 'stamina', header: 'STA' },
        { field: 'stiffArm', header: 'SFA' },
        { field: 'strength', header: 'STR' },
        { field: 'tackle', header: 'TAK' },
        { field: 'throwAccuracyDeep', header: 'TAD' },
        { field: 'throwAccuracyMid', header: 'TAM' },
        { field: 'throwAccuracyShort', header: 'TAS' },
        { field: 'throwOnTheRun', header: 'TOR' },
        { field: 'throwPower', header: 'THP' },
        { field: 'throwUnderPressure', header: 'TUP' },
        { field: 'toughness', header: 'TGH' },
        { field: 'trucking', header: 'TRK' },
        { field: 'zoneCoverage', header: 'ZCV' }
    ];

    ratingColumns.forEach(({ field, header }) => {
        columnDefs.push({
            headerName: header,
            field: field,
            width: 55,
            editable: true,
            type: 'numericColumn',
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { min: 0, max: 99, precision: 0 },
            valueSetter: (params) => {
                let val = parseInt(params.newValue);
                if (isNaN(val)) return false;
                if (val < 0) val = 0;
                if (val > 99) val = 99;
                params.data[field] = val;
                return true;
            },
            cellStyle: { textAlign: 'center' }
        });
    });

    // Dev Trait
    columnDefs.push({
        headerName: 'Dev Trait',
        field: 'devTrait',
        width: 110,
        editable: true,
        cellEditor: FastSelectEditor,
        cellEditorParams: { values: devTraitOptions },
        valueGetter: (params) => {
            const val = params.data?.devTrait;
            if (typeof val === 'number') {
                return devTraitValueToDisplay[val] || 'Normal';
            }
            return val || 'Normal';
        },
        valueSetter: (params) => {
            const id = devTraitDisplayToValue[params.newValue];
            if (id !== undefined) {
                params.data.devTrait = params.newValue;
                params.data.devTraitId = id;
                return true;
            }
            params.data.devTrait = params.newValue;
            return true;
        },
        cellRenderer: (params) => {
            const value = params.value || 'Normal';
            return `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 8px;">
                <span>${value}</span>
                <span style="color: #999; font-size: 12px;">▼</span>
            </div>`;
        }
    });

    return columnDefs;
}

/**
 * Initialize AG-Grid for draft class
 */
export async function initializeDraftAGGrid(app, container, prospects) {
    // CRITICAL: Clean up any orphaned FastSelectEditor dropdowns
    // These can block clicks if not properly removed when the editor is destroyed
    const orphanedDropdowns = document.querySelectorAll('.fast-select-editor__dropdown');
    if (orphanedDropdowns.length > 0) {
        console.log('[Draft AG-Grid] Cleaning up', orphanedDropdowns.length, 'orphaned dropdown(s)');
        orphanedDropdowns.forEach(dropdown => {
            if (dropdown.parentNode) {
                dropdown.parentNode.removeChild(dropdown);
            }
        });
    }

    // Also clean up any orphaned OVR modals that might be blocking
    const orphanedModals = document.querySelectorAll('#draft-ovr-adjustment-modal');
    if (orphanedModals.length > 0) {
        console.log('[Draft AG-Grid] Cleaning up', orphanedModals.length, 'orphaned modal(s)');
        orphanedModals.forEach(modal => modal.remove());
    }

    // Clear container
    container.innerHTML = '';

    // Pre-load archetype mappings - archetypes are GLOBAL IDs (0-67), not position-specific
    // Each ID maps to exactly one archetype across all positions
    // Load both old names (LE, RE, etc.) and M26 names (LEDG, REDG, etc.)
    const archetypeIdToName = {};
    const archetypeNameToId = {};
    const archetypesByPosition = {};
    const positions = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
        'LE', 'RE', 'LEDG', 'REDG', 'DT', 'LOLB', 'MLB', 'ROLB', 'SAM', 'MIKE', 'WILL',
        'CB', 'FS', 'SS', 'K', 'P', 'LS'];

    for (const pos of positions) {
        try {
            const archetypes = await window.electronAPI.rating.getArchetypes(pos);
            archetypesByPosition[pos] = archetypes;
            archetypes.forEach(arch => {
                // Store by GLOBAL ID only - IDs are unique across all positions
                if (!archetypeIdToName[arch.id]) {
                    archetypeIdToName[arch.id] = arch.name;
                    archetypeNameToId[arch.name] = arch.id;
                }
            });
        } catch (e) {
            console.warn(`[Draft AG-Grid] Failed to load archetypes for ${pos}`);
        }
    }
    console.log('[Draft AG-Grid] Pre-loaded archetype mappings:', Object.keys(archetypeIdToName).length, 'total');

    // Bundle archetype data to pass to column definitions
    const archetypeData = {
        byPosition: archetypesByPosition,
        idToName: archetypeIdToName,
        nameToId: archetypeNameToId
    };

    // Transform prospect data
    if (prospects.length > 0) {
        console.log('[Draft AG-Grid] Sample raw prospect data:', {
            firstName: prospects[0].firstName,
            lastName: prospects[0].lastName,
            commentaryId: prospects[0].commentaryId,
            PID: prospects[0].PID,
            PEPS: prospects[0].PEPS,
            position: prospects[0].position,
            archetype: prospects[0].archetype,
            bodyType: prospects[0].bodyType,
            'visuals.bodyType': prospects[0].visuals?.bodyType,
            hasVisuals: !!prospects[0].visuals
        });
    }

    const transformedProspects = prospects.map((prospect, index) => {
        // Calculate round from draft position
        const draftPosition = prospect.draftPosition !== undefined ? prospect.draftPosition : index;
        const pickNum = draftPosition + 1;
        const round = pickNum <= 224 ? Math.floor((pickNum - 1) / 32) + 1 : 8;

        // Get display values for lookups
        const position = typeof prospect.position === 'number'
            ? getLookupValue('positions', prospect.position) || prospect.position
            : prospect.position;

        // Preserve original college ID for logo lookup
        const collegeId = typeof prospect.college === 'number' ? prospect.college : null;
        const college = typeof prospect.college === 'number'
            ? getLookupValue('colleges', prospect.college) || prospect.college
            : prospect.college;

        const homeState = typeof prospect.homeState === 'number'
            ? getLookupValue('states', prospect.homeState) || prospect.homeState
            : prospect.homeState;

        const devTrait = typeof prospect.devTrait === 'number'
            ? ['Normal', 'Star', 'Superstar', 'X-Factor'][prospect.devTrait] || prospect.devTrait
            : prospect.devTrait;

        // bodyType comes from visuals.bodyType (string like "Heavy", "Muscular", "Thin", "Lean")
        // or from prospect.bodyType if already extracted
        let bodyType = prospect.visuals?.bodyType || prospect.bodyType;
        if (typeof bodyType === 'number') {
            // Numeric body type matches roster BTYP: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Lean
            bodyType = ['Standard', 'Thin', 'Muscular', 'Heavy', 'Lean'][bodyType] || 'Standard';
        } else if (!bodyType || bodyType === 0) {
            // Use position-based defaults when no body type specified
            const posNum = typeof prospect.position === 'number' ? prospect.position : -1;
            // OL (5-9), DT (12) = Heavy; DE (10-11), TE (4), FB (2) = Muscular; K/P (19-20) = Thin
            if (posNum >= 5 && posNum <= 9 || posNum === 12) {
                bodyType = 'Heavy';
            } else if (posNum === 10 || posNum === 11 || posNum === 4 || posNum === 2) {
                bodyType = 'Muscular';
            } else if (posNum === 19 || posNum === 20) {
                bodyType = 'Thin';
            } else {
                bodyType = 'Standard';
            }
        }

        // Convert archetype from numeric ID to name
        // Archetype IDs are GLOBAL (0-67), no position prefix needed
        let archetype = prospect.archetype;
        if (typeof archetype === 'number') {
            archetype = archetypeIdToName[archetype] || `Unknown Archetype (ID ${archetype})`;
        }

        // Look up player pic name from PID
        let playerPic = 'Generic Face';
        if (prospect.PID === 0) {
            playerPic = '';
        } else if (prospect.PID && window.lookupData?.pidsCapitalized) {
            const capitalizedName = window.lookupData.pidsCapitalized.get(prospect.PID);
            if (capitalizedName) {
                playerPic = capitalizedName;
            }
        }

        // Ensure PEPS is set (from visuals.genericHeadName or assetName if not already set)
        const peps = prospect.PEPS || prospect.visuals?.genericHeadName || prospect.assetName || null;

        // Extract shoulderPads from visuals.loadouts or use default
        let shoulderPads = prospect.shoulderPads || 'Large_Pads';
        if (prospect.visuals?.loadouts) {
            for (const loadout of prospect.visuals.loadouts) {
                if (loadout.loadoutElements) {
                    const padElement = loadout.loadoutElements.find(e => e.slotType === 'Shoulderpads');
                    if (padElement?.itemAssetName) {
                        shoulderPads = padElement.itemAssetName;
                        break;
                    }
                }
            }
        }

        return {
            ...prospect,
            draftPosition,
            round,
            position,
            college,
            collegeId,
            homeState,
            devTrait,
            bodyType,
            archetype,
            playerPic,
            PEPS: peps,
            shoulderPads,
            index
        };
    });

    // Pre-load portraits for prospects with verified PIDs or generic PAM
    // Developer portraits (11000-11999) are skipped by the backend automatically
    let portraitsToLoad = 0;
    let portraitsLoaded = 0;

    transformedProspects.forEach(prospect => {
        const pid = prospect.PID || 0;

        // Portrait: ALWAYS use PID (PAM only affects in-game face model)
        // PIDs like 731, 2583 map to generic face portraits
        const cacheKey = `pid_${pid}`;

        if (!app.portraitCache.has(cacheKey) && pid > 0) {
            app.portraitCache.set(cacheKey, 'loading');
            portraitsToLoad++;

            window.electronAPI.portrait.getByPID(pid).then(imageData => {
                app.portraitCache.set(cacheKey, imageData || null);
                portraitsLoaded++;
                if (portraitsLoaded === portraitsToLoad && app.draftAgGrid) {
                    app.draftAgGrid.refreshCells({ columns: ['_portrait'], force: true });
                }
            }).catch(() => {
                app.portraitCache.set(cacheKey, null);
                portraitsLoaded++;
            });
        }
    });

    // Create column definitions
    const columnDefs = createDraftColumnDefs(app, archetypeData);

    // Grid options
    const gridOptions = {
        theme: 'legacy',
        columnDefs: columnDefs,
        rowData: transformedProspects,
        defaultColDef: {
            resizable: true,
            sortable: true,
            filter: true,
            editable: false,
            cellStyle: { color: '#FFFFFF' }
        },
        rowHeight: 70,
        headerHeight: 40,
        animateRows: false,
        // Show message when draft class is empty
        overlayNoRowsTemplate: '<div style="padding: 40px; text-align: center; color: #ffa726; font-family: Oswald, sans-serif; font-size: 20px;">No prospects in draft class<br><span style="font-size: 14px; color: #999;">Use Player Database to add prospects</span></div>',
        rowSelection: 'single',
        suppressRowClickSelection: false,
        enableCellTextSelection: true,
        enableBrowserTooltips: true,
        // CRITICAL: Use singleClickEdit: true globally for consistent behavior
        // This prevents the timing issue where clicking cell B while editing cell A
        // causes the edit stop to interfere with the new edit start
        singleClickEdit: true,
        stopEditingWhenCellsLoseFocus: true,

        // Row dragging for reordering
        rowDragManaged: true,
        rowDragEntireRow: true,

        // Handle cell editing stopped - ensure focus returns to grid for seamless editing flow
        onCellEditingStopped: (event) => {
            console.log('[Draft AG-Grid] Cell editing stopped:', event.colDef?.field);
            // Use setTimeout to allow the click event to complete before potentially
            // restoring focus. This prevents the "can't click another cell" issue.
            const gridContainer = document.querySelector('#draft-class-grid .ag-root-wrapper');
            setTimeout(() => {
                const activeEl = document.activeElement;
                // Only log - don't force focus as it can interfere with new edits
                if (activeEl === document.body) {
                    console.log('[Draft AG-Grid] Focus was outside grid, ready for next edit');
                }
            }, 10);
        },

        onCellEditingStarted: (event) => {
            console.log('[Draft AG-Grid] onCellEditingStarted:', event.colDef.field, '- current value:', event.value);
            // Capture OVR before editing so we can detect changes
            if (event.colDef.field === 'overall') {
                event.node.data._previousOVR = parseInt(event.value) || 0;
                console.log('[Draft AG-Grid] Captured _previousOVR:', event.node.data._previousOVR);
            }
        },

        // Track sort state for the draft grid
        onSortChanged: (event) => {
            const sortModel = event.api.getColumnState().filter(c => c.sort);
            console.log('[Draft AG-Grid] onSortChanged:', sortModel);

            // Store sort state on app for potential restoration after data updates
            app.draftSortColumns = sortModel.length > 0
                ? sortModel.map(col => ({ column: col.colId, order: col.sort, sortIndex: col.sortIndex }))
                : [];
        },

        onRowDragEnd: (event) => {
            // Update draft positions after drag
            const allData = [];
            event.api.forEachNode(node => allData.push(node.data));

            allData.forEach((row, index) => {
                row.draftPosition = index;
                const pickNum = index + 1;
                row.round = pickNum <= 224 ? Math.floor((pickNum - 1) / 32) + 1 : 8;
            });

            event.api.refreshCells({ force: true });
            app.hasUnsavedChanges = true;
            app.updateSaveButton();
        },

        onCellValueChanged: (event) => {
            console.log('[Draft AG-Grid] Cell changed:', event.colDef.field, '=', event.newValue);
            app.hasUnsavedChanges = true;
            app.updateSaveButton();

            // Handle PID change - update portrait and player pic
            if (event.colDef.field === 'PID') {
                const pid = parseInt(event.newValue);
                if (pid && pid > 0) {
                    // Update player pic
                    const playerName = window.lookupData?.pidsCapitalized?.get(pid);
                    if (playerName) {
                        event.data.playerPic = playerName;
                    }

                    // Load portrait
                    const cacheKey = `pid_${pid}`;
                    if (!app.portraitCache.has(cacheKey)) {
                        app.portraitCache.set(cacheKey, 'loading');
                        window.electronAPI.portrait.getByPID(pid).then(imageData => {
                            app.portraitCache.set(cacheKey, imageData);
                            event.api.refreshCells({
                                rowNodes: [event.node],
                                columns: ['_portrait', 'playerPic'],
                                force: true
                            });
                        });
                    } else {
                        event.api.refreshCells({
                            rowNodes: [event.node],
                            columns: ['_portrait', 'playerPic'],
                            force: true
                        });
                    }
                }
            }

            // Handle playerPic change - update PID and portrait
            if (event.colDef.field === 'playerPic') {
                const playerName = event.newValue;
                if (playerName && playerName !== 'Generic Face') {
                    // CRITICAL: pidsByName uses lowercase keys
                    const pid = window.lookupData?.pidsByName?.get(playerName.toLowerCase());
                    console.log(`[Draft AG-Grid] playerPic changed to "${playerName}", looked up PID: ${pid}`);
                    if (pid) {
                        event.data.PID = pid;

                        // Load portrait for new PID
                        const cacheKey = `pid_${pid}`;
                        if (!app.portraitCache.has(cacheKey)) {
                            app.portraitCache.set(cacheKey, 'loading');
                            window.electronAPI.portrait.getByPID(pid).then(imageData => {
                                app.portraitCache.set(cacheKey, imageData);
                                event.api.refreshCells({
                                    rowNodes: [event.node],
                                    columns: ['_portrait', 'PID'],
                                    force: true
                                });
                            });
                        } else {
                            event.api.refreshCells({
                                rowNodes: [event.node],
                                columns: ['_portrait', 'PID'],
                                force: true
                            });
                        }
                    }
                }
            }

            // Handle OVR change - offer to adjust ratings
            if (event.colDef.field === 'overall') {
                // Use ?? instead of || to handle OVR of 0 correctly (0 is falsy but valid)
                const oldOVR = parseInt(event.node.data._previousOVR ?? event.oldValue);
                const newOVR = parseInt(event.newValue);

                console.log(`[Draft AG-Grid OVR] onCellValueChanged: oldOVR=${oldOVR}, newOVR=${newOVR}, _previousOVR=${event.node.data._previousOVR}, event.oldValue=${event.oldValue}`);

                if (!isNaN(oldOVR) && !isNaN(newOVR) && oldOVR !== newOVR) {
                    console.log(`[Draft AG-Grid OVR] Changed from ${oldOVR} to ${newOVR} - calling handleDraftOVRChange`);
                    handleDraftOVRChange(event.node, event.data, oldOVR, newOVR, app, event.api);
                } else {
                    console.log(`[Draft AG-Grid OVR] Skipping - isNaN(oldOVR)=${isNaN(oldOVR)}, isNaN(newOVR)=${isNaN(newOVR)}, oldOVR===newOVR=${oldOVR === newOVR}`);
                }
            }

            // Handle position change - re-validate archetype and recalculate OVR
            if (event.colDef.field === 'position') {
                const newPosition = event.newValue;
                const currentArchetype = event.data.archetype;

                // Get valid archetypes for new position
                const archetypePosName = POSITION_TO_ARCHETYPE_POS[newPosition] || newPosition;
                const validArchetypes = archetypesByPosition[archetypePosName] || [];
                const validArchetypeNames = validArchetypes.map(a => a.name);

                console.log(`[Draft AG-Grid] Position changed to ${newPosition}, current archetype: "${currentArchetype}"`);
                console.log(`[Draft AG-Grid] Valid archetypes for ${archetypePosName}:`, validArchetypeNames);

                // Check if current archetype is valid for new position
                let finalArchetype = currentArchetype;
                if (!validArchetypeNames.includes(currentArchetype)) {
                    // Invalid archetype for this position - use default
                    const defaultArchetype = validArchetypes[0];
                    if (defaultArchetype) {
                        console.warn(`[Draft AG-Grid] Archetype "${currentArchetype}" invalid for ${newPosition}, using "${defaultArchetype.name}"`);
                        event.data.archetype = defaultArchetype.name;
                        event.data.archetypeId = defaultArchetype.id;
                        finalArchetype = defaultArchetype.name;
                        event.api.refreshCells({
                            rowNodes: [event.node],
                            columns: ['archetype'],
                            force: true
                        });
                    }
                }

                // Recalculate OVR for new position
                const prospect = event.data;
                const attributes = {
                    PSPD: prospect.speed || prospect.PSPD, PACC: prospect.acceleration || prospect.PACC,
                    PAGI: prospect.agility || prospect.PAGI, PSTR: prospect.strength || prospect.PSTR,
                    PAWR: prospect.awareness || prospect.PAWR, PJMP: prospect.jumping || prospect.PJMP,
                    PSTA: prospect.stamina || prospect.PSTA, PELU: prospect.changeOfDirection || prospect.PELU,
                    PTGH: prospect.toughness || prospect.PTGH, PCAR: prospect.carrying || prospect.PCAR,
                    PBCV: prospect.ballCarrierVision || prospect.PBCV, PBKT: prospect.breakTackle || prospect.PBKT,
                    PLTR: prospect.trucking || prospect.PLTR, PLSA: prospect.stiffArm || prospect.PLSA,
                    PLSM: prospect.spinMove || prospect.PLSM, PLJM: prospect.jukeMove || prospect.PLJM,
                    PCTH: prospect.catching || prospect.PCTH, PLCI: prospect.catchInTraffic || prospect.PLCI,
                    PLSC: prospect.spectacularCatch || prospect.PLSC, SRRN: prospect.shortRouteRunning || prospect.SRRN,
                    PMRR: prospect.mediumRouteRunning || prospect.PMRR, PDRR: prospect.deepRouteRunning || prospect.PDRR,
                    PLRL: prospect.release || prospect.PLRL, PTHP: prospect.throwPower || prospect.PTHP,
                    PTAS: prospect.throwAccuracyShort || prospect.PTAS, PTAM: prospect.throwAccuracyMid || prospect.PTAM,
                    PTAD: prospect.throwAccuracyDeep || prospect.PTAD, PTOR: prospect.throwOnTheRun || prospect.PTOR,
                    PTUP: prospect.throwUnderPressure || prospect.PTUP, PPLA: prospect.playAction || prospect.PPLA,
                    PPBK: prospect.passBlock || prospect.PPBK, PPBS: prospect.passBlockPower || prospect.PPBS,
                    PPBF: prospect.passBlockFinesse || prospect.PPBF, PRBK: prospect.runBlock || prospect.PRBK,
                    PRBS: prospect.runBlockPower || prospect.PRBS, PRBF: prospect.runBlockFinesse || prospect.PRBF,
                    PLBK: prospect.leadBlock || prospect.PLBK, PLIB: prospect.impactBlocking || prospect.PLIB,
                    PTAK: prospect.tackle || prospect.PTAK, PLHT: prospect.hitPower || prospect.PLHT,
                    PLPM: prospect.powerMoves || prospect.PLPM, PFMS: prospect.finesseMoves || prospect.PFMS,
                    PBSG: prospect.blockShedding || prospect.PBSG, PLPU: prospect.pursuit || prospect.PLPU,
                    PLPR: prospect.playRecognition || prospect.PLPR, PLMC: prospect.manCoverage || prospect.PLMC,
                    PLZC: prospect.zoneCoverage || prospect.PLZC, PLPE: prospect.pressCoverage || prospect.PLPE,
                    PKPR: prospect.kickPower || prospect.PKPR, PKAC: prospect.kickAccuracy || prospect.PKAC,
                    PKRT: prospect.kickReturn || prospect.PKRT
                };

                window.electronAPI.rating.calculateOVRMadden(newPosition, attributes, finalArchetype).then(newOVR => {
                    if (newOVR !== undefined && newOVR !== prospect.overall) {
                        console.log(`[Draft AG-Grid] Position changed: OVR recalculated: ${prospect.overall} → ${newOVR}`);
                        prospect.overall = newOVR;
                        prospect.POVR = newOVR;
                        event.api.refreshCells({ rowNodes: [event.node], columns: ['overall'], force: true });
                    }
                }).catch(err => console.error('[Draft AG-Grid] Error recalculating OVR after position change:', err));
            }

            // Handle archetype change - recalculate OVR
            if (event.colDef.field === 'archetype') {
                const prospect = event.data;
                const position = prospect.position;
                const newArchetype = event.newValue;

                if (position) {
                    const attributes = {
                        PSPD: prospect.speed || prospect.PSPD, PACC: prospect.acceleration || prospect.PACC,
                        PAGI: prospect.agility || prospect.PAGI, PSTR: prospect.strength || prospect.PSTR,
                        PAWR: prospect.awareness || prospect.PAWR, PJMP: prospect.jumping || prospect.PJMP,
                        PSTA: prospect.stamina || prospect.PSTA, PELU: prospect.changeOfDirection || prospect.PELU,
                        PTGH: prospect.toughness || prospect.PTGH, PCAR: prospect.carrying || prospect.PCAR,
                        PBCV: prospect.ballCarrierVision || prospect.PBCV, PBKT: prospect.breakTackle || prospect.PBKT,
                        PLTR: prospect.trucking || prospect.PLTR, PLSA: prospect.stiffArm || prospect.PLSA,
                        PLSM: prospect.spinMove || prospect.PLSM, PLJM: prospect.jukeMove || prospect.PLJM,
                        PCTH: prospect.catching || prospect.PCTH, PLCI: prospect.catchInTraffic || prospect.PLCI,
                        PLSC: prospect.spectacularCatch || prospect.PLSC, SRRN: prospect.shortRouteRunning || prospect.SRRN,
                        PMRR: prospect.mediumRouteRunning || prospect.PMRR, PDRR: prospect.deepRouteRunning || prospect.PDRR,
                        PLRL: prospect.release || prospect.PLRL, PTHP: prospect.throwPower || prospect.PTHP,
                        PTAS: prospect.throwAccuracyShort || prospect.PTAS, PTAM: prospect.throwAccuracyMid || prospect.PTAM,
                        PTAD: prospect.throwAccuracyDeep || prospect.PTAD, PTOR: prospect.throwOnTheRun || prospect.PTOR,
                        PTUP: prospect.throwUnderPressure || prospect.PTUP, PPLA: prospect.playAction || prospect.PPLA,
                        PPBK: prospect.passBlock || prospect.PPBK, PPBS: prospect.passBlockPower || prospect.PPBS,
                        PPBF: prospect.passBlockFinesse || prospect.PPBF, PRBK: prospect.runBlock || prospect.PRBK,
                        PRBS: prospect.runBlockPower || prospect.PRBS, PRBF: prospect.runBlockFinesse || prospect.PRBF,
                        PLBK: prospect.leadBlock || prospect.PLBK, PLIB: prospect.impactBlocking || prospect.PLIB,
                        PTAK: prospect.tackle || prospect.PTAK, PLHT: prospect.hitPower || prospect.PLHT,
                        PLPM: prospect.powerMoves || prospect.PLPM, PFMS: prospect.finesseMoves || prospect.PFMS,
                        PBSG: prospect.blockShedding || prospect.PBSG, PLPU: prospect.pursuit || prospect.PLPU,
                        PLPR: prospect.playRecognition || prospect.PLPR, PLMC: prospect.manCoverage || prospect.PLMC,
                        PLZC: prospect.zoneCoverage || prospect.PLZC, PLPE: prospect.pressCoverage || prospect.PLPE,
                        PKPR: prospect.kickPower || prospect.PKPR, PKAC: prospect.kickAccuracy || prospect.PKAC,
                        PKRT: prospect.kickReturn || prospect.PKRT
                    };

                    window.electronAPI.rating.calculateOVRMadden(position, attributes, newArchetype).then(newOVR => {
                        if (newOVR !== undefined && newOVR !== prospect.overall) {
                            console.log(`[Draft AG-Grid] Archetype changed to ${newArchetype}: OVR recalculated: ${prospect.overall} → ${newOVR}`);
                            prospect.overall = newOVR;
                            prospect.POVR = newOVR;
                            event.api.refreshCells({ rowNodes: [event.node], columns: ['overall'], force: true });
                        }
                    }).catch(err => console.error('[Draft AG-Grid] Error recalculating OVR after archetype change:', err));
                }
            }

            // Handle draft position change - reorder
            if (event.colDef.field === 'draftPosition') {
                const allData = [];
                event.api.forEachNode(node => allData.push(node.data));

                // Sort by draft position
                allData.sort((a, b) => a.draftPosition - b.draftPosition);

                // Recalculate all positions and rounds
                allData.forEach((row, index) => {
                    row.draftPosition = index;
                    const pickNum = index + 1;
                    row.round = pickNum <= 224 ? Math.floor((pickNum - 1) / 32) + 1 : 8;
                });

                event.api.setGridOption('rowData', allData);
            }

            // ========== AUTO-RECALCULATE OVR WHEN RATINGS CHANGE ==========
            const ratingFields = ['speed', 'acceleration', 'agility', 'strength', 'jumping', 'awareness',
                'throwPower', 'throwAccuracyShort', 'throwAccuracyMid', 'throwAccuracyDeep',
                'throwOnTheRun', 'throwUnderPressure', 'playAction', 'breakSack',
                'passBlock', 'runBlock', 'leadBlock', 'impactBlocking', 'passBlockFinesse', 'passBlockPower',
                'runBlockFinesse', 'runBlockPower', 'tackle', 'hitPower', 'manCoverage', 'zoneCoverage',
                'press', 'pursuit', 'playRecognition', 'finesseMoves', 'blockShed', 'powerMoves',
                'kickPower', 'kickAccuracy', 'kickReturn', 'carrying', 'catching', 'catchInTraffic',
                'spectacularCatch', 'release', 'routeRunningShort', 'routeRunningMid', 'routeRunningDeep',
                'stamina', 'injury', 'toughness', 'breakTackle', 'trucking', 'elusiveness', 'spinMove',
                'jukeMoves', 'stiffArm', 'bcVision', 'changeOfDirection'];

            const fieldName = event.colDef.field;
            if (ratingFields.includes(fieldName) && event.newValue !== event.oldValue) {
                console.log(`[Draft AG-Grid] Rating field ${fieldName} changed from ${event.oldValue} to ${event.newValue}, recalculating OVR...`);

                // Build attributes from prospect data - ONLY include attributes that exist
                // CRITICAL: The game skips missing attributes entirely, NOT defaults them to 50
                const prospect = event.data;
                const attributes = buildOVRAttributes(prospect);

                // Get position name
                const positionName = prospect.position || 'QB';

                // Calculate OVR using CURRENT archetype - DO NOT auto-switch archetypes
                // Users set archetypes intentionally, we should respect their choice
                // NOTE: M26Parser stores archetype as numeric ID (0-67) in prospect.archetype and prospect.PLTY
                const currentArchetypeId = parseInt(prospect.archetype) || prospect.PLTY || 0;
                console.log(`[Draft AG-Grid] Calculating OVR for current archetype ID ${currentArchetypeId} of ${positionName}...`);

                if (window.electronAPI && window.electronAPI.rating && window.electronAPI.rating.calculateOVRForArchetypes) {
                    window.electronAPI.rating.calculateOVRForArchetypes(attributes, positionName)
                        .then(results => {
                            if (!results || results.length === 0) {
                                console.error('[Draft AG-Grid] No archetypes returned for position:', positionName);
                                return;
                            }

                            // Find the result for the CURRENT archetype by ID - don't auto-switch to "best"
                            const currentArchetypeResult = results.find(a => a.id === currentArchetypeId);
                            const oldOVR = parseInt(prospect.overall) || 50;

                            let newOVR;
                            if (currentArchetypeResult) {
                                // Use OVR for current archetype
                                newOVR = currentArchetypeResult.ovr;
                                console.log(`[Draft AG-Grid] Current archetype ${currentArchetypeId} (${currentArchetypeResult.name}) OVR: ${newOVR}`);
                            } else {
                                // Fallback to best archetype's OVR but DON'T change archetype
                                const bestArchetype = results[0];
                                newOVR = bestArchetype.ovr;
                                console.warn(`[Draft AG-Grid] Archetype ${currentArchetypeId} not found, using best OVR: ${newOVR} (but keeping archetype unchanged)`);
                            }

                            // Update OVR if changed
                            if (newOVR !== oldOVR) {
                                console.log(`[Draft AG-Grid] OVR recalculated: ${oldOVR} → ${newOVR}`);

                                // Update prospect data
                                prospect.overall = newOVR;
                                event.data.overall = newOVR;

                                // Refresh the OVR cell in the grid
                                event.api.refreshCells({
                                    rowNodes: [event.node],
                                    columns: ['overall'],
                                    force: true
                                });

                                // Also update the card view OVR display
                                const cardOvrEl = document.getElementById('draftCardPlayerOVR');
                                if (cardOvrEl) {
                                    cardOvrEl.textContent = newOVR;
                                }
                            }

                            // DO NOT update archetype - respect user's choice
                        })
                        .catch(err => console.warn('[Draft AG-Grid] Could not calculate OVR:', err));
                }
                // ========== END ARCHETYPE SYNC ==========
            }
            // ========== END AUTO-RECALCULATE OVR ==========

            // ========== ARCHETYPE CHANGE → ADJUST RATINGS ==========
            if (fieldName === 'archetype') {
                const positionName = event.data.position || 'QB';
                const newArchetypeName = event.newValue;
                const currentOVR = parseInt(event.data.overall) || 75;

                console.log(`[Draft AG-Grid] Archetype changed to ${newArchetypeName}, adjusting ratings...`);

                // Build current attributes - MATCHES ROSTER EDITOR EXACTLY
                const prospect = event.data;
                const currentAttributes = buildOVRAttributes(prospect);

                if (window.electronAPI && window.electronAPI.rating && window.electronAPI.rating.adjustAttributesForArchetype) {
                    window.electronAPI.rating.adjustAttributesForArchetype(currentAttributes, newArchetypeName, positionName, currentOVR)
                        .then(adjustedPlayer => {
                            if (adjustedPlayer) {
                                // Map field codes back to draft prospect field names
                                const fieldMapping = {
                                    PSPD: 'speed', PACC: 'acceleration', PAGI: 'agility', PSTR: 'strength',
                                    PJMP: 'jumping', PAWR: 'awareness', PTHP: 'throwPower',
                                    PTAS: 'throwAccuracyShort', PTAM: 'throwAccuracyMid', PTAD: 'throwAccuracyDeep',
                                    PPBK: 'passBlock', PRBK: 'runBlock', PTAK: 'tackle', PLHT: 'hitPower',
                                    PLMC: 'manCoverage', PLZC: 'zoneCoverage', PLPR: 'playRecognition', PLPU: 'pursuit',
                                    PFMS: 'finesseMoves', PBSG: 'blockShed', PLPM: 'powerMoves', PLPE: 'pressCoverage',
                                    PKPR: 'kickPower', PKAC: 'kickAccuracy', PCTH: 'catching', PLRL: 'release',
                                    SRRN: 'routeRunningShort', PMRR: 'routeRunningMid', PDRR: 'routeRunningDeep',
                                    PBKT: 'breakTackle', PLTR: 'trucking', PELU: 'elusiveness',
                                    PLSM: 'spinMove', PLJM: 'jukeMoves', PLSA: 'stiffArm', PLIB: 'impactBlocking'
                                };

                                const changedColumns = [];
                                for (const [fieldCode, draftField] of Object.entries(fieldMapping)) {
                                    if (adjustedPlayer[fieldCode] !== undefined && adjustedPlayer[fieldCode] !== prospect[draftField]) {
                                        prospect[draftField] = adjustedPlayer[fieldCode];
                                        event.data[draftField] = adjustedPlayer[fieldCode];
                                        changedColumns.push(draftField);
                                    }
                                }

                                // Update archetype ID
                                if (adjustedPlayer.PLTY !== undefined) {
                                    prospect.archetypeId = adjustedPlayer.PLTY;
                                    event.data.archetypeId = adjustedPlayer.PLTY;
                                }

                                if (changedColumns.length > 0) {
                                    console.log(`[Draft AG-Grid] Updated ${changedColumns.length} fields for archetype ${newArchetypeName}`);
                                    event.api.refreshCells({
                                        rowNodes: [event.node],
                                        columns: changedColumns,
                                        force: true
                                    });
                                }
                            }
                        })
                        .catch(err => console.warn('[Draft AG-Grid] Could not adjust ratings for archetype:', err));
                }
            }
            // ========== END ARCHETYPE CHANGE ==========
        },

        onCellContextMenu: (event) => {
            event.event.preventDefault();

            const contextMenu = document.getElementById('draft-context-menu');
            if (!contextMenu) return;

            contextMenu.dataset.rowIndex = event.rowIndex;

            const mouseEvent = event.event;
            contextMenu.style.left = `${mouseEvent.clientX}px`;
            contextMenu.style.top = `${mouseEvent.clientY}px`;
            contextMenu.style.display = 'block';

            const handleMenuClick = (e) => {
                const action = e.target.closest('.context-menu-item')?.dataset.action;
                if (!action) return;

                const rowIndex = parseInt(contextMenu.dataset.rowIndex);

                if (action === 'delete-player') {
                    const prospect = event.data;
                    const playerName = `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim();

                    if (confirm(`Delete ${playerName}?`)) {
                        const allData = [];
                        event.api.forEachNode(node => {
                            if (node.rowIndex !== rowIndex) {
                                allData.push(node.data);
                            }
                        });

                        // Recalculate positions
                        allData.forEach((row, index) => {
                            row.draftPosition = index;
                            const pickNum = index + 1;
                            row.round = pickNum <= 224 ? Math.floor((pickNum - 1) / 32) + 1 : 8;
                        });

                        event.api.setGridOption('rowData', allData);
                        app.hasUnsavedChanges = true;
                        app.updateSaveButton();
                    }
                } else if (action === 'view-player-card') {
                    app.showDraftPlayerCard(rowIndex);
                } else if (action === 'save-bio-to-db') {
                    const prospect = event.data;
                    const playerName = `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim();

                    const playerData = {
                        firstName: prospect.firstName,
                        lastName: prospect.lastName,
                        pid: prospect.PID,
                        pam: prospect.PEPS,
                        race: prospect.race,
                        bodyType: prospect.bodyType,
                        handedness: prospect.handedness,
                        height: prospect.heightInches,
                        weight: prospect.weight,
                        college: prospect.college,
                        homeState: prospect.homeState
                    };

                    app.showBioSaveModal(playerName, playerData, (selectedData) => {
                        if (!selectedData) return;

                        window.electronAPI.database.savePlayerBio(selectedData)
                            .then(result => {
                                if (result.success) {
                                    app.showToast(`Saved bio for ${playerName}`, 'success');
                                } else {
                                    app.showToast(`Failed: ${result.error}`, 'error');
                                }
                            });
                    });
                } else if (action === 'delete-multiple') {
                    // Enable multi-delete mode for draft class
                    console.log('[Draft AG-Grid] Entering multi-delete mode');
                    enterDraftMultiDeleteMode(app, event.api);
                }

                contextMenu.style.display = 'none';
                contextMenu.removeEventListener('click', handleMenuClick);
            };

            contextMenu.addEventListener('click', handleMenuClick);

            const hideMenu = (e) => {
                if (!contextMenu.contains(e.target)) {
                    contextMenu.style.display = 'none';
                    document.removeEventListener('click', hideMenu);
                    contextMenu.removeEventListener('click', handleMenuClick);
                }
            };
            setTimeout(() => document.addEventListener('click', hideMenu), 0);
        },

        onGridReady: (params) => {
            console.log('[Draft AG-Grid] Grid ready, prospect count:', transformedProspects.length);

            // Restore saved column state
            const savedState = localStorage.getItem('draftGridColumnState');
            if (savedState) {
                try {
                    const columnState = JSON.parse(savedState);
                    params.api.applyColumnState({ state: columnState, applyOrder: true });
                } catch (e) {
                    console.warn('[Draft AG-Grid] Failed to restore column state:', e);
                }
            }

            // Copy/paste handlers for spreadsheet-like functionality
            // Store handler reference so it can be removed on grid destroy
            if (app._draftAgGridKeyHandler) {
                document.removeEventListener('keydown', app._draftAgGridKeyHandler);
            }
            app._draftAgGridKeyHandler = (e) => {
                // Guard against destroyed grid
                if (!params.api || params.api.isDestroyed?.()) return;

                // Check if we have a focused cell in this grid
                const focusedCell = params.api.getFocusedCell();
                if (!focusedCell) return;

                // Only handle if draft tab is active and grid is visible
                const draftTab = document.getElementById('draft-tab-content');
                if (!draftTab || draftTab.style.display === 'none') return;

                // Ctrl+C - Copy current cell value
                if (e.ctrlKey && e.key === 'c' && !e.shiftKey) {
                    e.preventDefault(); // Prevent default browser copy
                    const rowNode = params.api.getDisplayedRowAtIndex(focusedCell.rowIndex);
                    if (rowNode) {
                        const value = params.api.getValue(focusedCell.column, rowNode);
                        if (value !== null && value !== undefined) {
                            navigator.clipboard.writeText(String(value)).then(() => {
                                console.log('[Draft AG-Grid] Copied cell:', value);
                            }).catch(err => console.error('[Draft AG-Grid] Copy failed:', err));
                        }
                    }
                }

                // Ctrl+Shift+C - Copy entire row
                if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                    e.preventDefault();
                    const rowNode = params.api.getDisplayedRowAtIndex(focusedCell.rowIndex);
                    if (rowNode?.data) {
                        app.copiedDraftRowData = JSON.parse(JSON.stringify(rowNode.data));
                        console.log('[Draft AG-Grid] Copied row:', app.copiedDraftRowData.firstName, app.copiedDraftRowData.lastName);

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
                            console.log('[Draft AG-Grid] Column not editable:', colId);
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
                            rowNode.setDataValue(colId, value);
                            pastedCount++;
                        });

                        if (pastedCount > 0) {
                            console.log('[Draft AG-Grid] Pasted', pastedCount, 'values to column', colId);
                            app.hasUnsavedChanges = true;
                            app.updateSaveButton();
                        }
                    }).catch(err => console.error('[Draft AG-Grid] Paste failed:', err));
                }

                // Ctrl+Shift+V - Paste entire row data
                if (e.ctrlKey && e.shiftKey && e.key === 'V') {
                    e.preventDefault();
                    if (!app.copiedDraftRowData) {
                        console.log('[Draft AG-Grid] No row data to paste');
                        return;
                    }

                    const rowNode = params.api.getDisplayedRowAtIndex(focusedCell.rowIndex);
                    if (!rowNode?.data) return;

                    // Exclude fields that shouldn't be copied (position in draft, internal state)
                    const excludeFields = ['index', 'draftPosition', 'round', '_previousOVR'];
                    let pastedFields = 0;

                    for (const key of Object.keys(app.copiedDraftRowData)) {
                        if (!excludeFields.includes(key) && !key.startsWith('_')) {
                            rowNode.data[key] = app.copiedDraftRowData[key];
                            pastedFields++;
                        }
                    }

                    params.api.refreshCells({ rowNodes: [rowNode], force: true });
                    console.log('[Draft AG-Grid] Pasted', pastedFields, 'fields to row');
                    app.hasUnsavedChanges = true;
                    app.updateSaveButton();
                }
            };
            document.addEventListener('keydown', app._draftAgGridKeyHandler);
        },

        onColumnResized: (params) => {
            if (params.finished) {
                const columnState = params.api.getColumnState();
                localStorage.setItem('draftGridColumnState', JSON.stringify(columnState));
            }
        },

        onColumnMoved: (params) => {
            const columnState = params.api.getColumnState();
            localStorage.setItem('draftGridColumnState', JSON.stringify(columnState));
        },

        // Update college logo when prospect is selected
        onSelectionChanged: (params) => {
            const selectedRows = params.api.getSelectedRows();
            if (selectedRows.length > 0) {
                const prospect = selectedRows[0];

                // Use preserved collegeId (numeric) if available, otherwise try string name
                let collegeData;
                if (prospect.collegeId != null) {
                    collegeData = getCollegeById(prospect.collegeId);
                } else if (typeof prospect.college === 'string') {
                    collegeData = getCollegeByName(prospect.college);
                } else if (typeof prospect.college === 'number') {
                    collegeData = getCollegeById(prospect.college);
                }

                const logoEl = document.getElementById('v2CollegeLogo');
                if (logoEl && collegeData) {
                    if (collegeData.logo) {
                        logoEl.innerHTML = `<img src="${collegeData.logo}" alt="${collegeData.name} logo" style="display: block;" onerror="this.style.display='none'">`;
                    } else {
                        // No logo - show college name abbreviation
                        logoEl.innerHTML = `<span style="font-family: 'Oswald', sans-serif; font-size: 36px; font-weight: 700;">${collegeData.abbr || '?'}</span>`;
                    }
                    logoEl.style.background = `linear-gradient(145deg, ${collegeData.secondary || '#666'}, ${(collegeData.secondary || '#666')}99)`;
                } else if (logoEl) {
                    // No college data found - show placeholder with college name abbreviation
                    const collegeName = prospect.college || '';
                    const abbr = typeof collegeName === 'string' && collegeName.length > 0
                        ? collegeName.substring(0, 4).toUpperCase()
                        : '?';
                    logoEl.innerHTML = `<span style="font-family: 'Oswald', sans-serif; font-size: 36px; font-weight: 700;">${abbr}</span>`;
                    logoEl.style.background = 'linear-gradient(145deg, #666, #66699)';
                }
            }
        }
    };

    // Create grid
    const gridApi = createGrid(container, gridOptions);

    // Store references
    app.draftAgGrid = gridApi;
    app.draftProspects = transformedProspects;

    // NOTE: Do NOT recalculate OVR on load!
    // The OVR stored in the file is authoritative. Recalculating overwrites user's manual adjustments.
    // The game reads the stored OVR, it doesn't recalculate it at runtime.
    // Only recalculate when ratings or archetype explicitly change (handled by onCellValueChanged).
    if (false && window.electronAPI && window.electronAPI.rating && window.electronAPI.rating.recalculateOVRBatch) {
        console.log('[Draft AG-Grid] DISABLED: Would have recalculated OVR for all prospects on load...');

        // Build player data array with all necessary attributes for OVR calculation
        // Debug: Log first few prospects to verify archetype mapping
        for (let i = 0; i < Math.min(3, transformedProspects.length); i++) {
            const p = transformedProspects[i];
            const resolvedPLTY = p.archetype !== undefined ? archetypeData.nameToId[p.archetype] || p.PLTY : p.PLTY;
            console.log(`[Draft OVR Debug] ${p.firstName} ${p.lastName}:`, {
                position: p.position,
                archetypeName: p.archetype,
                rawPLTY: p.PLTY,
                resolvedPLTY: resolvedPLTY,
                storedOVR: p.overall,
                throwPower: p.throwPower || p.PTHP,
                awareness: p.awareness || p.PAWR
            });
        }
        const playersForOVR = transformedProspects.map(p => ({
            firstName: p.firstName,
            lastName: p.lastName,
            PPOS: typeof p.position === 'string' ? p.position : p.PPOS,
            PLTY: p.archetype !== undefined ? archetypeData.nameToId[p.archetype] || p.PLTY : p.PLTY,
            // Include all rating field codes
            PSPD: p.speed || p.PSPD,
            PACC: p.acceleration || p.PACC,
            PAGI: p.agility || p.PAGI,
            PSTR: p.strength || p.PSTR,
            PJMP: p.jumping || p.PJMP,
            PAWR: p.awareness || p.PAWR,
            PBCV: p.ballCarrierVision || p.PBCV,
            PCAR: p.carrying || p.PCAR,
            PCTH: p.catching || p.PCTH,
            PTHP: p.throwPower || p.PTHP,
            PTAS: p.throwAccuracyShort || p.PTAS,
            PTAM: p.throwAccuracyMid || p.PTAM,
            PTAD: p.throwAccuracyDeep || p.PTAD,
            PTOR: p.throwOnTheRun || p.PTOR,
            PTUP: p.throwUnderPressure || p.PTUP,
            PPLA: p.playAction || p.PPLA,
            PBSK: p.breakSack || p.PBSK,
            PPBK: p.passBlock || p.PPBK,
            PRBK: p.runBlock || p.PRBK,
            PLBK: p.leadBlock || p.PLBK,
            PLIB: p.impactBlocking || p.PLIB,
            PPBF: p.passBlockFinesse || p.PPBF,
            PPBS: p.passBlockPower || p.PPBS,
            PRBF: p.runBlockFinesse || p.PRBF,
            PRBS: p.runBlockPower || p.PRBS,
            PTAK: p.tackle || p.PTAK,
            PLHT: p.hitPower || p.PLHT,
            PLMC: p.manCoverage || p.PLMC,
            PLZC: p.zoneCoverage || p.PLZC,
            PLPR: p.playRecognition || p.PLPR,
            PLPU: p.pursuit || p.PLPU,
            PLPM: p.powerMoves || p.PLPM,
            PFMS: p.finesseMoves || p.PFMS,
            PBSG: p.blockShedding || p.PBSG,
            PLPE: p.pressCoverage || p.PLPE,
            PBKT: p.breakTackle || p.PBKT,
            PLTR: p.trucking || p.PLTR,
            PELU: p.changeOfDirection || p.PELU,
            PLJM: p.jukeMove || p.PLJM,
            PLSM: p.spinMove || p.PLSM,
            PLSA: p.stiffArm || p.PLSA,
            PLSC: p.spectacularCatch || p.PLSC,
            PLCI: p.catchInTraffic || p.PLCI,
            PLRL: p.release || p.PLRL,
            SRRN: p.shortRouteRunning || p.SRRN,
            PMRR: p.mediumRouteRunning || p.PMRR,
            PDRR: p.deepRouteRunning || p.PDRR,
            PKPR: p.kickPower || p.PKPR,
            PKAC: p.kickAccuracy || p.PKAC,
            PKRT: p.kickReturn || p.PKRT,
            PSTA: p.stamina || p.PSTA,
            PINJ: p.injury || p.PINJ,
            PTGH: p.toughness || p.PTGH
        }));

        window.electronAPI.rating.recalculateOVRBatch(playersForOVR).then(results => {
            if (results && results.length > 0) {
                let updatedCount = 0;
                results.forEach(result => {
                    const prospect = transformedProspects[result.index];
                    if (prospect && result.ovr !== undefined) {
                        const oldOVR = prospect.overall || prospect.POVR || 0;
                        if (oldOVR !== result.ovr) {
                            // Update BOTH overall AND POVR to ensure consistency
                            prospect.overall = result.ovr;
                            prospect.POVR = result.ovr;
                            updatedCount++;
                            if (updatedCount <= 3) {
                                console.log(`[Draft AG-Grid] OVR recalculated: ${prospect.firstName} ${prospect.lastName}: ${oldOVR} → ${result.ovr}`);
                            }
                        }
                    }
                });
                console.log(`[Draft AG-Grid] Recalculated OVR for ${updatedCount} prospects`);

                // Refresh the grid to show updated OVR values
                if (gridApi && updatedCount > 0) {
                    gridApi.refreshCells({ columns: ['overall'], force: true });
                }
            }
        }).catch(err => {
            console.error('[Draft AG-Grid] Error recalculating batch OVR:', err);
        });
    }

    return gridApi;
}

/**
 * Update draft grid data
 */
export function updateDraftAGGridData(app, newProspects) {
    if (app.draftAgGrid) {
        // Get current sort state directly from grid (more reliable than app.draftSortColumns)
        const currentSortState = app.draftAgGrid.getColumnState().filter(c => c.sort);
        console.log('[Draft AG-Grid] Updating data, preserving sort state:', currentSortState);

        app.draftAgGrid.setGridOption('rowData', newProspects);

        // Restore sort state if it was set
        if (currentSortState.length > 0) {
            // Small delay to ensure data is loaded before applying sort
            setTimeout(() => {
                app.draftAgGrid.applyColumnState({
                    state: currentSortState,
                    defaultState: { sort: null }
                });
                console.log('[Draft AG-Grid] Sort state restored after data update');
            }, 0);
        }
    }
}

/**
 * Get draft data from grid for saving
 */
export function getDraftDataFromGrid(app) {
    if (!app.draftAgGrid) return [];

    const data = [];
    app.draftAgGrid.forEachNode(node => {
        data.push(node.data);
    });

    // Sort by draft position
    data.sort((a, b) => a.draftPosition - b.draftPosition);

    // DIAGNOSTIC: Log first prospect's ratings
    if (data.length > 0) {
        const first = data[0];
        console.log('[getDraftDataFromGrid] ======== EXTRACTING DATA FOR SAVE ========');
        console.log('[getDraftDataFromGrid] First prospect:', first.firstName, first.lastName);
        console.log('[getDraftDataFromGrid] overall:', first.overall);
        console.log('[getDraftDataFromGrid] speed:', first.speed, 'PSPD:', first.PSPD);
        console.log('[getDraftDataFromGrid] acceleration:', first.acceleration, 'PACC:', first.PACC);
        console.log('[getDraftDataFromGrid] awareness:', first.awareness, 'PAWR:', first.PAWR);
        console.log('[getDraftDataFromGrid] throwPower:', first.throwPower, 'PTHP:', first.PTHP);
    }

    return data;
}

/**
 * Destroy draft AG-Grid
 */
export function destroyDraftAGGrid(app) {
    // CRITICAL: Remove document-level event listeners to prevent accumulation
    if (app._draftAgGridKeyHandler) {
        document.removeEventListener('keydown', app._draftAgGridKeyHandler);
        app._draftAgGridKeyHandler = null;
    }

    if (app.draftAgGrid) {
        app.draftAgGrid.destroy();
        app.draftAgGrid = null;
        app.draftProspects = null;
    }
}

// Draft field names to roster field names mapping for OVR calculation
// CORRECT field codes from reference/madden-franchise-utils/franchiseToRoster/lookupFiles/directTransferFields.json
const DRAFT_TO_ROSTER_FIELDS = {
    speed: 'PSPD', acceleration: 'PACC', agility: 'PAGI', strength: 'PSTR',
    jumping: 'PJMP', awareness: 'PAWR', ballCarrierVision: 'PBCV', carrying: 'PCAR',
    catching: 'PCTH', throwPower: 'PTHP', throwAccuracyShort: 'PTAS',
    throwAccuracyMid: 'PTAM', throwAccuracyDeep: 'PTAD', throwOnTheRun: 'PTOR',
    throwUnderPressure: 'PTUP', playAction: 'PPLA', breakSack: 'PBSK',
    passBlock: 'PPBK', runBlock: 'PRBK', leadBlock: 'PLBK', impactBlocking: 'PLIB',
    passBlockFinesse: 'PPBF', passBlockPower: 'PPBS', runBlockFinesse: 'PRBF',
    runBlockPower: 'PRBS', tackle: 'PTAK', hitPower: 'PLHT', manCoverage: 'PLMC',
    zoneCoverage: 'PLZC', playRecognition: 'PLPR', pursuit: 'PLPU', powerMoves: 'PLPM',
    finesseMoves: 'PFMS', blockShedding: 'PBSG', pressCoverage: 'PLPE',
    breakTackle: 'PBKT', trucking: 'PLTR',
    // CORRECTED field codes - these were all wrong before:
    changeOfDirection: 'PELU',   // ChangeOfDirectionRating = PELU
    jukeMove: 'PLJM',            // JukeMoveRating = PLJM
    spinMove: 'PLSM',            // SpinMoveRating = PLSM
    stiffArm: 'PLSA',            // StiffArmRating = PLSA
    spectacularCatch: 'PLSC',    // SpectacularCatchRating = PLSC
    catchInTraffic: 'PLCI',      // CatchInTrafficRating = PLCI
    release: 'PLRL',             // ReleaseRating = PLRL
    shortRouteRunning: 'SRRN', mediumRouteRunning: 'PMRR',
    deepRouteRunning: 'PDRR', kickPower: 'PKPR', kickAccuracy: 'PKAC',
    kickReturn: 'PKRT', stamina: 'PSTA', injury: 'PINJ', toughness: 'PTGH',
    longSnap: 'PIMP'  // Fixed: was PLSL, correct field is PIMP
};

const ROSTER_TO_DRAFT_FIELDS = Object.fromEntries(
    Object.entries(DRAFT_TO_ROSTER_FIELDS).map(([k, v]) => [v, k])
);

/**
 * Handle OVR change in Draft AG-Grid - prompt user to adjust ratings
 */
async function handleDraftOVRChange(node, prospect, oldOVR, newOVR, app, gridApi) {
    console.log('[Draft OVR] handleDraftOVRChange called:', oldOVR, '->', newOVR);

    // Get position name
    let position = prospect.position;
    if (typeof position === 'number') {
        position = POSITION_MAPPINGS[position] || 'QB';
    }
    const playerName = `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim() || 'Unknown Player';

    console.log('[Draft OVR] Position:', position, 'Player:', playerName);

    // Build attributes object from prospect - MATCHES ROSTER EDITOR EXACTLY
    const attributes = buildOVRAttributes(prospect);

    // Get current archetype if available
    // NOTE: prospect.archetype is the numeric ID (0-67) from M26Parser
    // prospect.archetypeId may be set by UI edits
    // IMPORTANT: parseInt can return NaN if archetype is a string name like "Field General"
    let currentArchetype = undefined;
    if (prospect.archetypeId !== undefined && !isNaN(prospect.archetypeId)) {
        currentArchetype = prospect.archetypeId;
    } else if (prospect.archetype !== undefined) {
        const parsed = parseInt(prospect.archetype);
        if (!isNaN(parsed)) {
            currentArchetype = parsed;
        }
    } else if (prospect.PLTY !== undefined && !isNaN(prospect.PLTY)) {
        currentArchetype = prospect.PLTY;
    }

    try {
        // Log what we're sending to the backend
        console.log('[Draft OVR] Attributes being sent:', JSON.stringify(attributes));
        console.log('[Draft OVR] Position:', position, 'Archetype:', currentArchetype);

        // Get all archetypes with their calculated OVR for current attributes
        const archetypeOptions = await window.electronAPI.rating.calculateOVRForArchetypes(attributes, position);
        console.log('[Draft OVR] Archetype options:', archetypeOptions);

        // CRITICAL: If no archetype specified, use the best archetype (first in sorted list)
        // This ensures the adjustments calculated match what the dropdown will show
        let archetypeForCalculation = currentArchetype;
        if (archetypeForCalculation === undefined && archetypeOptions && archetypeOptions.length > 0) {
            archetypeForCalculation = archetypeOptions[0].id;
            console.log('[Draft OVR] No archetype specified, using best archetype:', archetypeOptions[0].name, 'id:', archetypeForCalculation);
        }

        // Call the backend to calculate adjustments
        console.log('[Draft OVR] Calling calculateOVRAdjustments with targetOVR:', newOVR, 'archetype:', archetypeForCalculation);
        const result = await window.electronAPI.rating.calculateOVRAdjustments(
            attributes, newOVR, position, archetypeForCalculation
        );
        console.log('[Draft OVR] Result:', JSON.stringify(result));

        if (!result) {
            console.log('[Draft OVR] No result returned from backend');
            return;
        }

        console.log('[Draft OVR] Adjustments count:', Object.keys(result.adjustments || {}).length);
        console.log('[Draft OVR] Achieved OVR:', result.newOVR, 'Target was:', newOVR);

        // If no adjustments but we have a valid result, still show dialog
        // This handles the case where OVR is already at target or needs archetype change
        if (Object.keys(result.adjustments || {}).length === 0) {
            console.log('[Draft OVR] No rating adjustments needed - OVR may already match or require archetype change');
            // Still show dialog if we have archetype options to choose from
            if (archetypeOptions && archetypeOptions.length > 0) {
                console.log('[Draft OVR] Showing dialog with archetype options');
            } else {
                console.log('[Draft OVR] No archetype options available, skipping dialog');
                return;
            }
        }

        // Show the adjustment dialog with archetype options
        // Pass archetypeForCalculation so dropdown shows the same archetype used for calculations
        showDraftOVRAdjustmentDialog(node, prospect, playerName, oldOVR, newOVR, result, app, gridApi, archetypeOptions, archetypeForCalculation, attributes, position);

    } catch (error) {
        console.error('[Draft OVR] Error calculating adjustments:', error);
    }
}

/**
 * Show dialog asking user if they want to apply rating adjustments for draft
 */
function showDraftOVRAdjustmentDialog(node, prospect, playerName, oldOVR, newOVR, result, app, gridApi, archetypeOptions = [], currentArchetype = undefined, attributes = {}, position = 'QB') {
    const { adjustments, newOVR: achievedOVR, archetype } = result;
    const delta = newOVR - oldOVR;
    const direction = delta > 0 ? 'increase' : 'decrease';

    // Store context for archetype change handler
    window._draftOvrDialogContext = {
        node, prospect, newOVR, attributes, position, oldOVR, app, gridApi
    };

    // Build archetype dropdown options
    let archetypeOptionsHTML = '';
    for (const opt of archetypeOptions) {
        const isSelected = currentArchetype !== undefined && opt.id === currentArchetype;
        const isBest = archetypeOptions.indexOf(opt) === 0;
        const label = `${opt.name} (${opt.ovr} OVR)${isBest ? ' ★' : ''}`;
        archetypeOptionsHTML += `<option value="${opt.id}" ${isSelected ? 'selected' : ''}>${label}</option>`;
    }

    // Build the adjustment list HTML - convert roster field codes to friendly names
    let adjustmentHTML = '';
    const sortedAdjustments = Object.entries(adjustments)
        .sort((a, b) => b[1].weight - a[1].weight);

    for (const [rosterFieldCode, adj] of sortedAdjustments) {
        const change = adj.suggested - adj.current;
        const changeStr = change > 0 ? `+${change}` : `${change}`;
        const changeClass = change > 0 ? 'positive-change' : 'negative-change';
        // Get the draft-friendly field name
        const draftField = ROSTER_TO_DRAFT_FIELDS[rosterFieldCode] || rosterFieldCode;
        const displayName = adj.name || draftField;
        adjustmentHTML += `
            <tr>
                <td>${displayName}</td>
                <td class="current-value">${adj.current}</td>
                <td class="arrow">→</td>
                <td class="suggested-value">${adj.suggested}</td>
                <td class="${changeClass}">${changeStr}</td>
            </tr>
        `;
    }

    // Create modal HTML with archetype selector
    const modalHTML = `
        <div id="draft-ovr-adjustment-modal" class="modal-overlay" style="z-index: 100001;">
            <div class="modal-content ovr-adjustment-modal">
                <div class="modal-header">
                    <h2>Adjust Ratings for OVR Change?</h2>
                    <button id="draft-ovr-close-btn" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <p class="player-info">
                        <strong>${playerName}</strong>
                    </p>
                    <div class="archetype-selector" style="margin: 10px 0; display: flex; align-items: center; gap: 10px;">
                        <label for="draft-archetype-select" style="font-weight: bold;">Archetype:</label>
                        <select id="draft-archetype-select" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; min-width: 200px;">
                            ${archetypeOptionsHTML}
                        </select>
                    </div>
                    <p class="ovr-change">
                        OVR: <span class="old-ovr">${oldOVR}</span>
                        <span class="arrow">→</span>
                        <span class="new-ovr">${newOVR}</span>
                        <span class="${direction === 'increase' ? 'positive-change' : 'negative-change'}">
                            (${delta > 0 ? '+' : ''}${delta})
                        </span>
                    </p>
                    <p class="achieved-ovr">Achieved OVR with these adjustments: <strong id="draft-achieved-ovr-value">${achievedOVR}</strong></p>
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
                            <tbody id="draft-adjustment-table-body">
                                ${adjustmentHTML}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="draft-apply-adjustments-btn" class="ovr-dialog-btn ovr-dialog-btn-apply">Apply Adjustments</button>
                    <button id="draft-keep-ovr-only-btn" class="ovr-dialog-btn ovr-dialog-btn-keep">Keep OVR Only</button>
                    <button id="draft-cancel-ovr-btn" class="ovr-dialog-btn ovr-dialog-btn-cancel">Cancel</button>
                </div>
            </div>
        </div>
    `;

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('draft-ovr-adjustment-modal');

    // Store current adjustments and archetype for apply handler
    window._draftCurrentAdjustments = adjustments;
    // CRITICAL: If no archetype was specified, use the first (best) archetype from options
    // This ensures the dropdown selection matches what we store for the Apply button
    if (currentArchetype === undefined && archetypeOptions && archetypeOptions.length > 0) {
        window._draftSelectedArchetypeId = archetypeOptions[0].id;
        console.log('[Draft OVR Dialog] No archetype specified, defaulting to best:', archetypeOptions[0].name, 'id:', archetypeOptions[0].id);
    } else {
        window._draftSelectedArchetypeId = currentArchetype;
    }

    // Helper to restore focus to grid after modal closes
    const restoreFocusToGrid = () => {
        setTimeout(() => {
            const gridContainer = document.querySelector('.ag-root-wrapper');
            if (gridContainer) {
                gridContainer.focus();
                console.log('[AG-Grid Draft] Focus restored to grid after modal close');
            }
        }, 50);
    };

    // Archetype change handler
    const archetypeSelect = document.getElementById('draft-archetype-select');
    archetypeSelect.addEventListener('change', async (e) => {
        const newArchetypeId = parseInt(e.target.value);
        // Only set if valid number - prevent NaN from propagating
        if (!isNaN(newArchetypeId)) {
            window._draftSelectedArchetypeId = newArchetypeId;
        } else {
            console.warn('[Draft OVR] Invalid archetype ID from select:', e.target.value);
            return;
        }

        try {
            // Recalculate adjustments with new archetype
            const newResult = await window.electronAPI.rating.calculateOVRAdjustments(
                window._draftOvrDialogContext.attributes,
                window._draftOvrDialogContext.newOVR,
                window._draftOvrDialogContext.position,
                newArchetypeId
            );

            if (newResult && Object.keys(newResult.adjustments).length > 0) {
                window._draftCurrentAdjustments = newResult.adjustments;

                // Update achieved OVR display
                document.getElementById('draft-achieved-ovr-value').textContent = newResult.newOVR;

                // Rebuild adjustment table
                let newAdjustmentHTML = '';
                const newSortedAdjustments = Object.entries(newResult.adjustments)
                    .sort((a, b) => b[1].weight - a[1].weight);

                for (const [rosterFieldCode, adj] of newSortedAdjustments) {
                    const change = adj.suggested - adj.current;
                    const changeStr = change > 0 ? `+${change}` : `${change}`;
                    const changeClass = change > 0 ? 'positive-change' : 'negative-change';
                    const draftField = ROSTER_TO_DRAFT_FIELDS[rosterFieldCode] || rosterFieldCode;
                    const displayName = adj.name || draftField;
                    newAdjustmentHTML += `
                        <tr>
                            <td>${displayName}</td>
                            <td class="current-value">${adj.current}</td>
                            <td class="arrow">→</td>
                            <td class="suggested-value">${adj.suggested}</td>
                            <td class="${changeClass}">${changeStr}</td>
                        </tr>
                    `;
                }

                document.getElementById('draft-adjustment-table-body').innerHTML = newAdjustmentHTML;
            }
        } catch (error) {
            console.error('[Draft OVR Dialog] Error recalculating for archetype:', error);
        }
    });

    // Close button (X) handler
    document.getElementById('draft-ovr-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        modal.remove();
        restoreFocusToGrid();
    });

    // Apply adjustments handler
    document.getElementById('draft-apply-adjustments-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        applyDraftOVRAdjustments(node, prospect, window._draftCurrentAdjustments, app, gridApi, window._draftSelectedArchetypeId);
        modal.remove();
        restoreFocusToGrid();
    });

    // Keep OVR only handler (just close - OVR already changed)
    document.getElementById('draft-keep-ovr-only-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        modal.remove();
        restoreFocusToGrid();
    });

    // Cancel handler - revert OVR to old value
    document.getElementById('draft-cancel-ovr-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        prospect.overall = oldOVR;
        node.setDataValue('overall', oldOVR);
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
 * Apply the calculated rating adjustments to the prospect in Draft AG-Grid
 */
function applyDraftOVRAdjustments(node, prospect, adjustments, app, gridApi, selectedArchetypeId = undefined) {
    const changes = [];

    console.log('[Draft OVR] ======== APPLYING ADJUSTMENTS ========');
    console.log('[Draft OVR] Prospect name:', prospect.firstName, prospect.lastName);
    console.log('[Draft OVR] Prospect === node.data:', prospect === node.data);
    console.log('[Draft OVR] BEFORE - prospect.speed:', prospect.speed, 'node.data.speed:', node.data.speed);
    console.log('[Draft OVR] BEFORE - prospect.overall:', prospect.overall, 'node.data.overall:', node.data.overall);

    for (const [rosterFieldCode, adj] of Object.entries(adjustments)) {
        // Convert roster field code to draft field name
        const draftField = ROSTER_TO_DRAFT_FIELDS[rosterFieldCode];
        if (!draftField) {
            console.warn('[Draft OVR] Unknown roster field:', rosterFieldCode);
            continue;
        }

        console.log(`[Draft OVR] Setting ${draftField} (${rosterFieldCode}): ${prospect[draftField]} -> ${adj.suggested}`);

        // Update prospect data - BOTH human-readable name AND field code alias
        // This ensures OVR calculator (which reads field codes) sees the new value
        prospect[draftField] = adj.suggested;
        prospect[rosterFieldCode] = adj.suggested;  // Also update field code (PSPD, etc.)

        // Update grid cell
        node.setDataValue(draftField, adj.suggested);

        // Verify the value was set
        console.log(`[Draft OVR] AFTER - prospect.${draftField}:`, prospect[draftField], `node.data.${draftField}:`, node.data[draftField]);

        changes.push(`${adj.name}: ${adj.current} → ${adj.suggested}`);
    }

    // Update archetype if selected - keep both archetypeId and archetype in sync
    // IMPORTANT: Check for both undefined AND NaN to prevent archetype becoming NaN
    if (selectedArchetypeId !== undefined && !isNaN(selectedArchetypeId)) {
        const oldArchetype = prospect.archetypeId || prospect.archetype;
        prospect.archetypeId = selectedArchetypeId;
        prospect.archetype = selectedArchetypeId;  // Keep both in sync for file saving
        prospect.PLTY = selectedArchetypeId;       // Also update PLTY field code
        node.setDataValue('archetypeId', selectedArchetypeId);
        console.log('[Draft OVR] Updated archetype:', oldArchetype, '->', selectedArchetypeId);
    } else if (selectedArchetypeId !== undefined) {
        console.warn('[Draft OVR] Ignoring NaN archetype ID:', selectedArchetypeId);
    }

    console.log('[Draft OVR] Applied adjustments:', changes.join(', '));

    // CRITICAL: Recalculate OVR from the adjusted ratings and update the overall field
    // This ensures the stored OVR matches what the ratings actually produce
    const position = typeof prospect.position === 'number'
        ? (POSITION_MAPPINGS[prospect.position] || 'QB')
        : prospect.position;
    const archetype = selectedArchetypeId !== undefined && !isNaN(selectedArchetypeId)
        ? selectedArchetypeId
        : (prospect.archetypeId || prospect.archetype || prospect.PLTY);

    // Build attributes from the newly adjusted ratings
    const updatedAttributes = buildOVRAttributes(prospect);

    // Recalculate OVR with the new ratings
    if (window.electronAPI && window.electronAPI.rating && window.electronAPI.rating.calculateOVRMadden) {
        console.log('[Draft OVR] Calling calculateOVRMadden with:', { position, archetype });
        console.log('[Draft OVR] updatedAttributes sample:', { PSPD: updatedAttributes.PSPD, PACC: updatedAttributes.PACC, PAWR: updatedAttributes.PAWR });

        window.electronAPI.rating.calculateOVRMadden(position, updatedAttributes, archetype)
            .then(recalculatedOVR => {
                if (recalculatedOVR !== undefined && !isNaN(recalculatedOVR)) {
                    console.log('[Draft OVR] ======== OVR RECALCULATION RESULT ========');
                    console.log('[Draft OVR] Recalculated OVR:', recalculatedOVR);
                    console.log('[Draft OVR] Setting prospect.overall and POVR to:', recalculatedOVR);
                    prospect.overall = recalculatedOVR;
                    prospect.POVR = recalculatedOVR;
                    // Update _previousOVR to prevent the dialog from triggering again
                    node.data._previousOVR = recalculatedOVR;
                    node.setDataValue('overall', recalculatedOVR);
                    console.log('[Draft OVR] FINAL STATE - prospect.overall:', prospect.overall, 'node.data.overall:', node.data.overall);
                    console.log('[Draft OVR] FINAL STATE - prospect.speed:', prospect.speed, 'node.data.speed:', node.data.speed);
                    gridApi.refreshCells({ rowNodes: [node], columns: ['overall'], force: true });
                }
            })
            .catch(err => console.error('[Draft OVR] Error recalculating OVR:', err));
    }

    // Refresh cells to show updated values
    gridApi.refreshCells({ rowNodes: [node], force: true });

    app.hasUnsavedChanges = true;
    app.updateSaveButton();
}

// =============================================
// PUSH TO DATABASE FUNCTIONALITY
// =============================================

/**
 * Open the Push to Database dialog
 * Analyzes draft class prospects and allows pushing to user database
 */
export async function openPushToDatabaseDialog(app) {
    if (!app.draftAgGrid) {
        console.error('[Push to DB] No draft grid available');
        return;
    }

    // Get all prospects from grid
    const prospects = [];
    app.draftAgGrid.forEachNode(node => {
        prospects.push(node.data);
    });

    // Debug: Log first prospect's OVR values
    if (prospects.length > 0) {
        const first = prospects[0];
        console.log('[Push to DB] First prospect from grid:', first.firstName, first.lastName);
        console.log('[Push to DB] Grid data - overall:', first.overall, 'POVR:', first.POVR);
    }

    if (prospects.length === 0) {
        alert('No prospects to push. Load a draft class first.');
        return;
    }

    // Determine draft year from draft class header or fallback to current year
    let draftYear = new Date().getFullYear();
    if (app.currentDraftClass && app.currentDraftClass.header && app.currentDraftClass.header.year) {
        draftYear = app.currentDraftClass.header.year;
    }
    // Also try to extract from file path as backup
    if (app.draftClassFilePath) {
        const yearMatch = app.draftClassFilePath.match(/(\d{4})/);
        if (yearMatch) {
            const extractedYear = parseInt(yearMatch[1]);
            if (extractedYear >= 1936 && extractedYear <= 2100) {
                draftYear = extractedYear;
            }
        }
    }

    console.log(`[Push to DB] Analyzing ${prospects.length} prospects for year ${draftYear}`);

    // Show year selection dialog first
    const yearSelectHTML = `
        <div id="push-db-year-modal" class="modal-overlay" style="z-index: 100001;">
            <div class="modal-content" style="padding: 30px; max-width: 400px;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Push Draft Class to Database</h2>
                    <button id="push-db-year-close-btn" class="close-btn" style="font-size: 24px; background: none; border: none; color: #999; cursor: pointer;">×</button>
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="push-db-year-input" style="display: block; margin-bottom: 8px; font-weight: bold;">
                        Draft Year:
                    </label>
                    <input type="number" id="push-db-year-input" value="${draftYear}" min="1936" max="2100"
                        style="width: 100%; padding: 10px; font-size: 16px; border: 1px solid #555; border-radius: 4px; background: #1a1a1a; color: #fff;">
                    <p style="color: #888; font-size: 12px; margin-top: 8px;">
                        This will be the season year for the player ratings in the database.
                    </p>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="push-db-year-cancel-btn" style="padding: 10px 20px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="push-db-year-continue-btn" style="padding: 10px 20px; background: #2196F3; border: none; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">Continue</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', yearSelectHTML);

    const yearModal = document.getElementById('push-db-year-modal');
    const yearInput = document.getElementById('push-db-year-input');

    // Focus the input
    yearInput.focus();
    yearInput.select();

    // Close handlers
    const closeYearModal = () => yearModal.remove();
    document.getElementById('push-db-year-close-btn').addEventListener('click', closeYearModal);
    document.getElementById('push-db-year-cancel-btn').addEventListener('click', closeYearModal);
    yearModal.addEventListener('click', (e) => {
        if (e.target === yearModal) closeYearModal();
    });

    // Continue handler
    document.getElementById('push-db-year-continue-btn').addEventListener('click', async () => {
        const selectedYear = parseInt(yearInput.value);
        if (isNaN(selectedYear) || selectedYear < 1936 || selectedYear > 2100) {
            alert('Please enter a valid year between 1936 and 2100');
            return;
        }

        closeYearModal();
        await analyzeAndShowPushDialog(app, prospects, selectedYear);
    });

    // Enter key to continue
    yearInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('push-db-year-continue-btn').click();
        }
    });
}

/**
 * Analyze prospects and show the push confirmation dialog
 */
async function analyzeAndShowPushDialog(app, prospects, draftYear) {
    // Show loading indicator
    const loadingHTML = `
        <div id="push-db-loading-modal" class="modal-overlay" style="z-index: 100001;">
            <div class="modal-content" style="padding: 30px; text-align: center; max-width: 400px;">
                <h3>Analyzing Draft Class...</h3>
                <p>Checking for existing players in database for year ${draftYear}...</p>
                <div style="margin-top: 20px;">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHTML);

    try {
        // Call backend to analyze
        const response = await window.electronAPI.database.analyzeDraftClassPush(prospects, draftYear);

        // Remove loading modal
        document.getElementById('push-db-loading-modal')?.remove();

        if (!response.success) {
            alert(`Error analyzing draft class: ${response.error}`);
            return;
        }

        const analysis = response.analysis;
        console.log('[Push to DB] Analysis result:', analysis);

        // Show the analysis/confirmation modal
        showPushConfirmationModal(app, analysis, draftYear);

    } catch (error) {
        document.getElementById('push-db-loading-modal')?.remove();
        console.error('[Push to DB] Error:', error);
        alert(`Error: ${error.message || error}`);
    }
}

/**
 * Show the push confirmation modal with analysis results
 */
function showPushConfirmationModal(app, analysis, draftYear) {
    const { newPlayers, existingBundled, existingCustom, totalConflicts, hasYearConflicts } = analysis;

    const totalNew = newPlayers.length;
    const totalExisting = existingBundled.length + existingCustom.length;
    const totalProspects = totalNew + totalExisting;

    // Build conflicts list HTML - card-based design
    let conflictsHTML = '';
    let conflictIndex = 0;
    const allConflicts = [];
    const playersWithConflicts = [];

    // Gather all conflicts from bundled and custom players
    for (const item of [...existingBundled, ...existingCustom]) {
        if (item.conflicts && item.conflicts.length > 0) {
            const playerName = `${item.prospect.firstName || ''} ${item.prospect.lastName || ''}`.trim();
            const position = item.prospect.position || '?';
            const cardId = `conflict-card-${item.prospectIndex}`;

            playersWithConflicts.push({ cardId, playerName });

            // Build conflict rows for this player
            let conflictRowsHTML = '';
            for (const conflict of item.conflicts) {
                const conflictId = `conflict_${conflictIndex}`;
                allConflicts.push({
                    prospectIndex: item.prospectIndex,
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
                            <button class="conflict-keep-all-btn" data-card="${cardId}" style="padding: 5px 12px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                Keep All Current
                            </button>
                            <button class="conflict-use-all-btn" data-card="${cardId}" style="padding: 5px 12px; background: #1a5a1a; border: 1px solid #2a7a2a; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                Use All New
                            </button>
                            <button class="conflict-done-btn" data-card="${cardId}" style="padding: 5px 12px; background: #2196F3; border: none; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                ✓ Done
                            </button>
                        </div>
                    </div>
                    <div class="conflict-card-body" style="padding: 10px 15px;">
                        <div class="conflict-grid-header" style="display: grid; grid-template-columns: 120px 1fr 1fr 180px; gap: 10px; padding: 8px 0; border-bottom: 2px solid #444; font-size: 12px; color: #888;">
                            <div>Field</div>
                            <div style="text-align: center;">Database Value</div>
                            <div style="text-align: center;">Draft Class Value</div>
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
                <strong style="color: #ffaa00;">Warning:</strong> Some players already have ratings for year ${draftYear}.
                <div style="margin-top: 8px;">
                    <label>
                        <input type="checkbox" id="overwrite-seasons-checkbox" checked>
                        Overwrite existing season ratings for ${draftYear}
                    </label>
                </div>
            </div>
        `;
    }

    // Build modal HTML
    const modalHTML = `
        <div id="push-db-modal" class="modal-overlay" style="z-index: 100001;">
            <div class="modal-content" style="max-width: 900px; width: 90%; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 1px solid #444;">
                    <h2 style="margin: 0;">Push Draft Class to Database</h2>
                    <button id="push-db-close-btn" class="close-btn" style="font-size: 24px; background: none; border: none; color: #999; cursor: pointer;">×</button>
                </div>
                <div class="modal-body" style="overflow-y: auto; flex: 1; padding: 15px 0;">
                    <div class="summary-section" style="margin-bottom: 20px;">
                        <h3 style="margin-top: 0;">Summary for ${draftYear} Draft Class</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div style="background: #1a3a1a; padding: 15px; border-radius: 4px; text-align: center;">
                                <div style="font-size: 28px; font-weight: bold; color: #4CAF50;">${totalNew}</div>
                                <div style="color: #aaa;">New Players</div>
                                <div style="color: #666; font-size: 12px;">Will be created</div>
                            </div>
                            <div style="background: #1a2a3a; padding: 15px; border-radius: 4px; text-align: center;">
                                <div style="font-size: 28px; font-weight: bold; color: #2196F3;">${totalExisting}</div>
                                <div style="color: #aaa;">Existing Players</div>
                                <div style="color: #666; font-size: 12px;">Will add/update ${draftYear} season</div>
                            </div>
                        </div>
                    </div>

                    <!-- Push Options -->
                    <div class="push-options-section" style="margin-top: 20px; margin-bottom: 20px; background: #1a1a1a; padding: 15px; border-radius: 8px; border: 1px solid #333;">
                        <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 16px;">Push Options</h3>

                        <div style="margin-bottom: 15px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
                                <input type="radio" name="draft-push-mode" value="all" checked id="draft-push-mode-all">
                                <span style="font-weight: bold;">All Data</span>
                                <span style="color: #888; font-size: 12px;">- Push ratings, draft info, and selected bio fields</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="radio" name="draft-push-mode" value="ratings" id="draft-push-mode-ratings">
                                <span style="font-weight: bold;">Ratings Only</span>
                                <span style="color: #888; font-size: 12px;">- Only push player ratings for ${draftYear}</span>
                            </label>
                        </div>

                        <!-- Bio Fields Selection (shown when All Data is selected) -->
                        <div id="draft-bio-fields-section" style="padding: 12px; background: #252525; border-radius: 6px; border: 1px solid #404040;">
                            <div style="font-weight: bold; margin-bottom: 10px; color: #aaa;">Include Bio Fields:</div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-draftinfo" checked>
                                    <span>Draft Round/Pick</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-archetype" checked>
                                    <span>Archetype</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-position" checked>
                                    <span>Position</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-college" checked>
                                    <span>College</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-height" checked>
                                    <span>Height</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-weight" checked>
                                    <span>Weight</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-homestate" checked>
                                    <span>Home State</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-race" checked>
                                    <span>Race</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-bodytype" checked>
                                    <span>Body Type</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-handedness" checked>
                                    <span>Handedness</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-pid" checked>
                                    <span>PID (Portrait)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                    <input type="checkbox" id="draft-bio-pam" checked>
                                    <span>PAM (3D Face)</span>
                                </label>
                            </div>
                            <div style="margin-top: 10px; display: flex; gap: 10px;">
                                <button id="draft-bio-select-all" style="padding: 4px 12px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">Select All</button>
                                <button id="draft-bio-select-none" style="padding: 4px 12px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">Select None</button>
                            </div>
                        </div>
                    </div>

                    ${yearConflictHTML}

                    <div style="margin-bottom: 15px;">
                        <label>
                            <input type="checkbox" id="fill-empty-bio-checkbox" checked>
                            Automatically fill empty bio fields (only for fields selected above)
                        </label>
                    </div>

                    ${totalConflicts > 0 ? `
                        <div class="conflicts-section" style="margin-top: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <h3 style="margin: 0; color: #ff9800;">Bio Field Conflicts (${totalConflicts} across ${playersWithConflicts.length} players)</h3>
                                <div style="display: flex; gap: 8px;">
                                    <button id="conflict-keep-all-global" style="padding: 6px 12px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        Keep All Current
                                    </button>
                                    <button id="conflict-use-all-global" style="padding: 6px 12px; background: #1a5a1a; border: 1px solid #2a7a2a; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
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
                                        const name = `${item.prospect.firstName || ''} ${item.prospect.lastName || ''}`.trim();
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
                                    <button id="draft-new-select-all" style="padding: 6px 12px; background: #1a5a1a; border: 1px solid #2a7a2a; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        Select All
                                    </button>
                                    <button id="draft-new-select-none" style="padding: 6px 12px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        Deselect All
                                    </button>
                                </div>
                            </div>
                            <div id="draft-new-players-list" style="max-height: 300px; overflow-y: auto; background: #1a1a1a; padding: 10px; border-radius: 4px; font-size: 13px;">
                                ${newPlayers.map((item, idx) => {
                                    const name = `${item.prospect.firstName || ''} ${item.prospect.lastName || ''}`.trim();
                                    const pos = item.prospect.position || '?';
                                    const ovr = item.prospect.overall || item.prospect.POVR || '?';
                                    return `<label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer;">
                                        <input type="checkbox" class="draft-new-player-checkbox" data-index="${item.prospectIndex}" checked>
                                        <span>${name}</span>
                                        <span style="color: #666;">(${pos}, ${ovr} OVR)</span>
                                    </label>`;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 15px; border-top: 1px solid #444;">
                    <button id="push-db-cancel-btn" style="padding: 10px 20px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="push-db-execute-btn" style="padding: 10px 20px; background: #2196F3; border: none; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Push ${totalProspects} Players to Database
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('push-db-modal');

    // Close handlers
    const closeModal = () => {
        modal.remove();
    };

    document.getElementById('push-db-close-btn').addEventListener('click', closeModal);
    document.getElementById('push-db-cancel-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Conflict card button handlers
    // "Keep All Current" per card
    document.querySelectorAll('.conflict-keep-all-btn').forEach(btn => {
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
    document.querySelectorAll('.conflict-use-all-btn').forEach(btn => {
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
    document.querySelectorAll('.conflict-done-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cardId = btn.dataset.card;
            const card = document.getElementById(cardId);
            if (card) {
                const body = card.querySelector('.conflict-card-body');
                const header = card.querySelector('.conflict-card-header');
                if (body.style.display === 'none') {
                    // Expand
                    body.style.display = 'block';
                    btn.textContent = '✓ Done';
                    card.style.opacity = '1';
                } else {
                    // Collapse
                    body.style.display = 'none';
                    btn.textContent = '↓ Expand';
                    card.style.opacity = '0.7';
                }
            }
        });
    });

    // Global "Keep All Current"
    const globalKeepAllBtn = document.getElementById('conflict-keep-all-global');
    if (globalKeepAllBtn) {
        globalKeepAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.conflicts-list input[type="radio"][value="keep"]').forEach(radio => {
                radio.checked = true;
            });
        });
    }

    // Global "Use All New"
    const globalUseAllBtn = document.getElementById('conflict-use-all-global');
    if (globalUseAllBtn) {
        globalUseAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.conflicts-list input[type="radio"][value="overwrite"]').forEach(radio => {
                radio.checked = true;
            });
        });
    }

    // Push mode radio handlers - show/hide bio fields section
    const draftBioFieldsSection = document.getElementById('draft-bio-fields-section');
    document.querySelectorAll('input[name="draft-push-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'ratings') {
                draftBioFieldsSection.style.display = 'none';
            } else {
                draftBioFieldsSection.style.display = 'block';
            }
        });
    });

    // Bio fields Select All / Select None buttons
    document.getElementById('draft-bio-select-all')?.addEventListener('click', () => {
        document.querySelectorAll('#draft-bio-fields-section input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
    });

    document.getElementById('draft-bio-select-none')?.addEventListener('click', () => {
        document.querySelectorAll('#draft-bio-fields-section input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
    });

    // New players checkbox handlers
    const executeBtn = document.getElementById('push-db-execute-btn');

    function updateDraftPushButtonText() {
        const checkedCount = document.querySelectorAll('.draft-new-player-checkbox:checked').length;
        const total = totalExisting + checkedCount;
        executeBtn.textContent = `Push ${total} Players to Database`;
    }

    document.getElementById('draft-new-select-all')?.addEventListener('click', () => {
        document.querySelectorAll('.draft-new-player-checkbox').forEach(cb => cb.checked = true);
        updateDraftPushButtonText();
    });

    document.getElementById('draft-new-select-none')?.addEventListener('click', () => {
        document.querySelectorAll('.draft-new-player-checkbox').forEach(cb => cb.checked = false);
        updateDraftPushButtonText();
    });

    document.querySelectorAll('.draft-new-player-checkbox').forEach(cb => {
        cb.addEventListener('change', updateDraftPushButtonText);
    });

    // Execute push handler
    document.getElementById('push-db-execute-btn').addEventListener('click', async () => {
        console.log('[Push to DB] EXECUTE BUTTON CLICKED - starting push process');

        // Gather resolutions from radio buttons
        const resolutions = [];
        for (const conflict of allConflicts) {
            const keepCurrent = document.querySelector(`input[name="${conflict.id}"]:checked`)?.value === 'keep';
            resolutions.push({
                prospectIndex: conflict.prospectIndex,
                field: conflict.field,
                keepCurrent
            });
        }

        // Get push mode
        const pushMode = document.querySelector('input[name="draft-push-mode"]:checked')?.value || 'all';

        // Get bio field options (only relevant for "all" mode)
        const bioFieldOptions = {
            draftInfo: document.getElementById('draft-bio-draftinfo')?.checked ?? true,
            archetype: document.getElementById('draft-bio-archetype')?.checked ?? true,
            position: document.getElementById('draft-bio-position')?.checked ?? true,
            college: document.getElementById('draft-bio-college')?.checked ?? true,
            height: document.getElementById('draft-bio-height')?.checked ?? true,
            weight: document.getElementById('draft-bio-weight')?.checked ?? true,
            homeState: document.getElementById('draft-bio-homestate')?.checked ?? true,
            race: document.getElementById('draft-bio-race')?.checked ?? true,
            bodyType: document.getElementById('draft-bio-bodytype')?.checked ?? true,
            handedness: document.getElementById('draft-bio-handedness')?.checked ?? true,
            pid: document.getElementById('draft-bio-pid')?.checked ?? true,
            pam: document.getElementById('draft-bio-pam')?.checked ?? true
        };

        // Get other options
        const overwriteExistingSeasons = document.getElementById('overwrite-seasons-checkbox')?.checked ?? true;
        const fillEmptyBioFields = document.getElementById('fill-empty-bio-checkbox')?.checked ?? true;

        // Get selected new player indices
        const selectedNewIndices = new Set();
        document.querySelectorAll('.draft-new-player-checkbox:checked').forEach(cb => {
            selectedNewIndices.add(parseInt(cb.dataset.index));
        });

        // Filter analysis to only include selected new players
        const filteredAnalysis = {
            ...analysis,
            newPlayers: analysis.newPlayers.filter(item => selectedNewIndices.has(item.prospectIndex))
        };

        // Disable button and show progress
        executeBtn.disabled = true;
        executeBtn.textContent = 'Pushing...';

        console.log('[Push to DB] EXECUTE - pushMode:', pushMode);
        console.log('[Push to DB] EXECUTE - filteredAnalysis.draftYear:', filteredAnalysis.draftYear);
        console.log('[Push to DB] EXECUTE - filteredAnalysis.newPlayers:', filteredAnalysis.newPlayers.length);
        console.log('[Push to DB] EXECUTE - filteredAnalysis.existingBundled:', filteredAnalysis.existingBundled.length);
        console.log('[Push to DB] EXECUTE - filteredAnalysis.existingCustom:', filteredAnalysis.existingCustom.length);

        // Debug: Show prospect rating fields
        const sampleProspect = filteredAnalysis.newPlayers[0]?.prospect || filteredAnalysis.existingBundled[0]?.prospect;
        if (sampleProspect) {
            console.log('[Push to DB] Sample prospect name:', sampleProspect.firstName, sampleProspect.lastName);
            console.log('[Push to DB] Sample prospect RATINGS (camelCase): speed=' + sampleProspect.speed + ', overall=' + sampleProspect.overall + ', tackle=' + sampleProspect.tackle + ', awareness=' + sampleProspect.awareness);
            console.log('[Push to DB] Sample prospect RATINGS (M26): PSPD=' + sampleProspect.PSPD + ', POVR=' + sampleProspect.POVR + ', PTAK=' + sampleProspect.PTAK + ', PAWR=' + sampleProspect.PAWR);
            console.log('[Push to DB] Sample prospect all keys:', Object.keys(sampleProspect).join(', '));
        }

        try {
            const response = await window.electronAPI.database.executeDraftClassPush(
                filteredAnalysis,
                resolutions,
                { pushMode, bioFieldOptions, overwriteExistingSeasons, fillEmptyBioFields }
            );

            console.log('[Push to DB] EXECUTE RESPONSE:', response);
            console.log('[Push to DB] EXECUTE RESULT:', response?.result);

            if (response.success && response.result) {
                const result = response.result;
                closeModal();

                // Show success message
                const successHTML = `
                    <div id="push-db-success-modal" class="modal-overlay" style="z-index: 100001;">
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
                            <button id="push-db-success-close-btn" style="padding: 10px 30px; background: #4CAF50; border: none; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">
                                Done
                            </button>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', successHTML);
                document.getElementById('push-db-success-close-btn').addEventListener('click', () => {
                    document.getElementById('push-db-success-modal').remove();
                });
                document.getElementById('push-db-success-modal').addEventListener('click', (e) => {
                    if (e.target.id === 'push-db-success-modal') {
                        e.target.remove();
                    }
                });
            } else {
                alert(`Push failed: ${response.error || 'Unknown error'}`);
                executeBtn.disabled = false;
                executeBtn.textContent = `Push ${totalProspects} Players to Database`;
            }
        } catch (error) {
            console.error('[Push to DB] Execute error:', error);
            alert(`Push failed: ${error.message || error}`);
            executeBtn.disabled = false;
            executeBtn.textContent = `Push ${totalProspects} Players to Database`;
        }
    });
}

// =============================================
// MULTI-DELETE MODE FOR DRAFT CLASS
// =============================================

/**
 * Track multi-delete state for draft
 */
let _draftMultiDeleteState = {
    active: false,
    gridApi: null,
    originalColumnDefs: null,
    selectionListener: null
};

/**
 * Enter multi-delete mode for draft class - adds checkbox selection column
 */
function enterDraftMultiDeleteMode(app, gridApi) {
    if (_draftMultiDeleteState.active) {
        console.log('[Draft Multi-Delete] Already in multi-delete mode');
        return;
    }

    if (!gridApi) {
        console.error('[Draft Multi-Delete] No grid API available');
        return;
    }

    console.log('[Draft Multi-Delete] Entering multi-delete mode');

    _draftMultiDeleteState.active = true;
    _draftMultiDeleteState.gridApi = gridApi;

    // Store original column state for restoration
    _draftMultiDeleteState.originalColumnDefs = gridApi.getColumnDefs();

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
    const currentColDefs = gridApi.getColumnDefs();
    const newColDefs = [checkboxColumn, ...currentColDefs];
    gridApi.setGridOption('columnDefs', newColDefs);

    // Enable row selection mode
    gridApi.setGridOption('rowSelection', {
        mode: 'multiRow',
        checkboxes: true,
        headerCheckbox: true
    });

    // Show the multi-delete toolbar
    const toolbar = document.getElementById('multi-delete-toolbar');
    if (toolbar) {
        toolbar.style.display = 'flex';
        updateDraftMultiDeleteCount(0);
    }

    // Set up selection changed listener to update count
    const selectionListener = (event) => {
        const selectedRows = event.api.getSelectedRows();
        updateDraftMultiDeleteCount(selectedRows.length);
    };
    gridApi.addEventListener('selectionChanged', selectionListener);
    _draftMultiDeleteState.selectionListener = selectionListener;

    // Wire up toolbar buttons
    const confirmBtn = document.getElementById('multi-delete-confirm');
    const cancelBtn = document.getElementById('multi-delete-cancel');

    if (confirmBtn) {
        confirmBtn.onclick = () => executeDraftMultiDelete(app, gridApi);
    }
    if (cancelBtn) {
        cancelBtn.onclick = () => exitDraftMultiDeleteMode(gridApi);
    }
}

/**
 * Update the selected count in the toolbar for draft
 */
function updateDraftMultiDeleteCount(count) {
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
 * Execute multi-delete for draft class after confirmation
 */
async function executeDraftMultiDelete(app, gridApi) {
    const selectedRows = gridApi.getSelectedRows();
    const count = selectedRows.length;

    if (count === 0) {
        alert('No prospects selected.');
        return;
    }

    // Show confirmation dialog
    const confirmMsg = `Are you sure you want to delete ${count} prospect${count > 1 ? 's' : ''}?\n\nThis action cannot be undone.`;
    if (!confirm(confirmMsg)) {
        return;
    }

    console.log(`[Draft Multi-Delete] Deleting ${count} prospects`);

    // Create a Set of selected prospects for efficient lookup
    const selectedSet = new Set(selectedRows);

    // Get all current data and filter out selected
    const allData = [];
    gridApi.forEachNode(node => {
        if (!selectedSet.has(node.data)) {
            allData.push(node.data);
        }
    });

    // Recalculate draft positions
    allData.forEach((row, index) => {
        row.draftPosition = index;
        const pickNum = index + 1;
        row.round = pickNum <= 224 ? Math.floor((pickNum - 1) / 32) + 1 : 8;
    });

    console.log(`[Draft Multi-Delete] Removed ${count} prospects. Remaining: ${allData.length}`);

    // Update app arrays
    if (app.draftProspects) {
        app.draftProspects = allData;
    }
    if (app.filteredDraftProspects) {
        app.filteredDraftProspects = allData;
    }

    // Mark as modified
    app.hasUnsavedChanges = true;
    if (app.updateSaveButton) {
        app.updateSaveButton();
    }

    // Exit multi-delete mode
    exitDraftMultiDeleteMode(gridApi);

    // Refresh the grid with new data
    gridApi.setGridOption('rowData', [...allData]);

    // Show success message
    app.showToast?.(`Deleted ${count} prospect${count > 1 ? 's' : ''}`, 'success')
        || console.log(`[Draft Multi-Delete] Deleted ${count} prospect(s)`);
}

/**
 * Exit multi-delete mode for draft class - restores original grid state
 */
function exitDraftMultiDeleteMode(gridApi) {
    if (!_draftMultiDeleteState.active) {
        return;
    }

    console.log('[Draft Multi-Delete] Exiting multi-delete mode');

    // Remove selection listener
    if (_draftMultiDeleteState.selectionListener && gridApi) {
        gridApi.removeEventListener('selectionChanged', _draftMultiDeleteState.selectionListener);
    }

    // Deselect all
    if (gridApi) {
        gridApi.deselectAll();
    }

    // Restore original column definitions (without checkbox column)
    if (_draftMultiDeleteState.originalColumnDefs && gridApi) {
        gridApi.setGridOption('columnDefs', _draftMultiDeleteState.originalColumnDefs);
    }

    // Reset row selection to single
    if (gridApi) {
        gridApi.setGridOption('rowSelection', {
            mode: 'singleRow',
            checkboxes: false,
            headerCheckbox: false
        });
    }

    // Hide toolbar
    const toolbar = document.getElementById('multi-delete-toolbar');
    if (toolbar) {
        toolbar.style.display = 'none';
    }

    // Reset state
    _draftMultiDeleteState = {
        active: false,
        gridApi: null,
        originalColumnDefs: null,
        selectionListener: null
    };
}
