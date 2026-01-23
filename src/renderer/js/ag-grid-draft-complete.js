/**
 * Complete AG-Grid Draft Class Table Implementation
 * Full replacement for Handsontable with all features from roster editor
 */

import { createGrid, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { getLookupValue, getLookupOptions, BODY_TYPE_NAMES } from '../data/field-definitions.js';
import { FastSelectEditor } from './FastSelectEditor.js';

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
        const peps = prospect ? (prospect.PEPS || prospect.visuals?.genericHeadName) : null;

        // Real players (PID > 0): use PID cache key
        // Generic players (PID == 0): use PEPS/PAM cache key
        const cacheKey = pid > 0 ? `pid_${pid}` : (peps ? `pam_${peps}` : 'pam_none');

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
    const bodyTypeOptions = ['Standard', 'Thin', 'Muscular', 'Heavy'];
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

    // Body type mappings
    const bodyTypeValueToDisplay = { 0: 'Standard', 1: 'Thin', 2: 'Muscular', 3: 'Heavy' };
    const bodyTypeDisplayToValue = { 'Standard': 0, 'Thin': 1, 'Muscular': 2, 'Heavy': 3 };

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

    // Age (read-only)
    columnDefs.push({
        headerName: 'Age',
        field: 'age',
        width: 55,
        editable: false,
        type: 'numericColumn',
        cellStyle: { textAlign: 'center', backgroundColor: '#2a2a2a' }
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
        cellStyle: { textAlign: 'center' }
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

    // Body Type
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

    // Physical columns
    columnDefs.push({
        headerName: 'Height',
        field: 'heightInches',
        width: 70,
        editable: true,
        type: 'numericColumn',
        cellStyle: { textAlign: 'center' }
    });

    columnDefs.push({
        headerName: 'Weight',
        field: 'weight',
        width: 70,
        editable: true,
        type: 'numericColumn',
        cellStyle: { textAlign: 'center' }
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

        const college = typeof prospect.college === 'number'
            ? getLookupValue('colleges', prospect.college) || prospect.college
            : prospect.college;

        const homeState = typeof prospect.homeState === 'number'
            ? getLookupValue('states', prospect.homeState) || prospect.homeState
            : prospect.homeState;

        const devTrait = typeof prospect.devTrait === 'number'
            ? ['Normal', 'Star', 'Superstar', 'X-Factor'][prospect.devTrait] || prospect.devTrait
            : prospect.devTrait;

        // bodyType comes from visuals.bodyType (string like "Heavy", "Muscular", "Thin")
        // or from prospect.bodyType if already extracted
        let bodyType = prospect.visuals?.bodyType || prospect.bodyType;
        if (typeof bodyType === 'number') {
            bodyType = ['Standard', 'Thin', 'Muscular', 'Heavy'][bodyType] || 'Standard';
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

        return {
            ...prospect,
            draftPosition,
            round,
            position,
            college,
            homeState,
            devTrait,
            bodyType,
            archetype,
            playerPic,
            PEPS: peps,
            index
        };
    });

    // Pre-load portraits for prospects with verified PIDs or generic PAM
    // Developer portraits (11000-11999) are skipped by the backend automatically
    let portraitsToLoad = 0;
    let portraitsLoaded = 0;

    transformedProspects.forEach(prospect => {
        const pid = prospect.PID || 0;
        const peps = prospect.PEPS || prospect.visuals?.genericHeadName || prospect.assetName;

        if (pid > 0) {
            // Real player PID - backend will skip developer portraits automatically
            const cacheKey = `pid_${pid}`;
            if (!app.portraitCache.has(cacheKey)) {
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
        } else if (peps && typeof peps === 'string') {
            // Generic face - load by PAM
            const cacheKey = `pam_${peps}`;
            if (!app.portraitCache.has(cacheKey)) {
                app.portraitCache.set(cacheKey, 'loading');
                portraitsToLoad++;

                window.electronAPI.portrait.getImageDataByPam(peps).then(imageData => {
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
            // Capture OVR before editing so we can detect changes
            if (event.colDef.field === 'overall') {
                event.node.data._previousOVR = event.value;
                console.log('[Draft AG-Grid] Started editing OVR, captured previous:', event.value);
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
                const oldOVR = event.node.data._previousOVR || event.oldValue;
                const newOVR = parseInt(event.newValue);

                if (oldOVR !== undefined && oldOVR !== newOVR && !isNaN(newOVR)) {
                    console.log(`[Draft AG-Grid OVR] Changed from ${oldOVR} to ${newOVR}`);
                    handleDraftOVRChange(event.node, event.data, oldOVR, newOVR, app, event.api);
                }
            }

            // Handle position change - re-validate archetype
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
                if (!validArchetypeNames.includes(currentArchetype)) {
                    // Invalid archetype for this position - use default
                    const defaultArchetype = validArchetypes[0];
                    if (defaultArchetype) {
                        console.warn(`[Draft AG-Grid] Archetype "${currentArchetype}" invalid for ${newPosition}, using "${defaultArchetype.name}"`);
                        event.data.archetype = defaultArchetype.name;
                        event.data.archetypeId = defaultArchetype.id;
                        event.api.refreshCells({
                            rowNodes: [event.node],
                            columns: ['archetype'],
                            force: true
                        });
                    }
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
        }
    };

    // Create grid
    const gridApi = createGrid(container, gridOptions);

    // Store references
    app.draftAgGrid = gridApi;
    app.draftProspects = transformedProspects;

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
    breakTackle: 'PBKT', trucking: 'PLTR', jukeMove: 'PELU', spinMove: 'PLJM',
    stiffArm: 'PLSM', spectacularCatch: 'PLSA', catchInTraffic: 'PLSC',
    release: 'PLCI', shortRouteRunning: 'SRRN', mediumRouteRunning: 'PMRR',
    deepRouteRunning: 'PDRR', kickPower: 'PKPR', kickAccuracy: 'PKAC',
    kickReturn: 'PKRT', stamina: 'PSTA', injury: 'PINJ', toughness: 'PTGH',
    changeOfDirection: 'PCOD', longSnap: 'PLSL'
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

    // Build attributes object from prospect using roster field names
    const attributes = {};
    for (const [draftField, rosterField] of Object.entries(DRAFT_TO_ROSTER_FIELDS)) {
        if (prospect[draftField] !== undefined) {
            attributes[rosterField] = parseInt(prospect[draftField]) || 50;
        }
    }

    // Get current archetype if available
    const currentArchetype = prospect.archetypeId !== undefined ? prospect.archetypeId : undefined;

    try {
        // Get all archetypes with their calculated OVR for current attributes
        const archetypeOptions = await window.electronAPI.rating.calculateOVRForArchetypes(attributes, position);

        // Call the backend to calculate adjustments
        console.log('[Draft OVR] Calling calculateOVRAdjustments...');
        const result = await window.electronAPI.rating.calculateOVRAdjustments(
            attributes, newOVR, position, currentArchetype
        );
        console.log('[Draft OVR] Result:', result);

        if (!result || Object.keys(result.adjustments).length === 0) {
            console.log('[Draft OVR] No adjustments calculated');
            return;
        }

        // Show the adjustment dialog with archetype options
        showDraftOVRAdjustmentDialog(node, prospect, playerName, oldOVR, newOVR, result, app, gridApi, archetypeOptions, currentArchetype, attributes, position);

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
    window._draftSelectedArchetypeId = currentArchetype;

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
        window._draftSelectedArchetypeId = newArchetypeId;

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

    for (const [rosterFieldCode, adj] of Object.entries(adjustments)) {
        // Convert roster field code to draft field name
        const draftField = ROSTER_TO_DRAFT_FIELDS[rosterFieldCode];
        if (!draftField) {
            console.warn('[Draft OVR] Unknown roster field:', rosterFieldCode);
            continue;
        }

        // Update prospect data
        prospect[draftField] = adj.suggested;

        // Update grid cell
        node.setDataValue(draftField, adj.suggested);

        changes.push(`${adj.name}: ${adj.current} → ${adj.suggested}`);
    }

    // Update archetype if selected
    if (selectedArchetypeId !== undefined) {
        const oldArchetype = prospect.archetypeId;
        prospect.archetypeId = selectedArchetypeId;
        node.setDataValue('archetypeId', selectedArchetypeId);
        console.log('[Draft OVR] Updated archetype:', oldArchetype, '->', selectedArchetypeId);
    }

    console.log('[Draft OVR] Applied adjustments:', changes.join(', '));

    // Refresh cells to show updated values
    gridApi.refreshCells({ rowNodes: [node], force: true });

    app.hasUnsavedChanges = true;
    app.updateSaveButton();
}
