/**
 * AG-Grid Roster Table Implementation
 * Replaces Handsontable with AG-Grid Community Edition for better performance
 */

import { createGrid } from 'ag-grid-community';
import {
    getBodyTypeFromWeight,
    getWeightFromBodyType,
    BODY_TYPE_NAMES
} from '../data/field-definitions.js';

/**
 * Create portrait cell renderer for AG-Grid
 */
function createPortraitRenderer(app) {
    return class PortraitCellRenderer {
        init(params) {
            this.eGui = document.createElement('div');
            this.eGui.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 100%; cursor: pointer;';

            const portraitData = params.value;

            if (portraitData && portraitData.portrait) {
                const img = document.createElement('img');
                img.src = portraitData.portrait;
                img.style.cssText = 'width: 48px; height: 48px; object-fit: cover; border-radius: 4px;';
                img.alt = 'Player Portrait';
                this.eGui.appendChild(img);
            } else {
                this.eGui.innerHTML = '<div style="width:48px;height:48px;background:#ddd;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:24px;">👤</div>';
            }

            // Click handler for player card
            this.eGui.addEventListener('click', () => {
                if (params.data) {
                    app.showPlayerCard(params.node.rowIndex);
                }
            });
        }

        getGui() {
            return this.eGui;
        }

        refresh() {
            return false;
        }

        destroy() {
            if (this.eGui) {
                this.eGui.removeEventListener('click', this.clickHandler);
            }
        }
    };
}

/**
 * Create AG-Grid column definitions from field definitions
 */
export function createColumnDefs(visibleFields, displayNames, fieldCodes, getFieldDefinition, app) {
    const columnDefs = [];

    // Portrait column (frozen)
    columnDefs.push({
        headerName: '',
        field: '_portrait',
        width: 64,
        pinned: 'left',
        lockPosition: true,
        cellRenderer: createPortraitRenderer(app),
        sortable: false,
        filter: false,
        editable: false,
        suppressMenu: true
    });

    // Data columns
    visibleFields.forEach((fieldName, index) => {
        const fieldDef = getFieldDefinition(fieldName);
        const displayName = displayNames[index];

        const colDef = {
            headerName: displayName,
            field: fieldName,
            width: 100,
            editable: !fieldDef.readOnly,
            sortable: true,
            filter: true,
            resizable: true
        };

        // Handle different field types
        if (fieldDef.type === 'select') {
            colDef.cellEditor = 'agSelectCellEditor';
            colDef.cellEditorParams = {
                values: fieldDef.options?.map(opt => opt.value) || []
            };
            // Value formatter to show display names
            colDef.valueFormatter = (params) => {
                const option = fieldDef.options?.find(opt => opt.value === params.value);
                return option ? option.display : params.value;
            };
        } else if (fieldDef.type === 'number') {
            colDef.filter = 'agNumberColumnFilter';
            colDef.type = 'numericColumn';
            colDef.cellEditor = 'agNumberCellEditor';
            colDef.cellEditorParams = {
                min: fieldDef.min,
                max: fieldDef.max,
                precision: 0
            };
            // Validate number range
            colDef.valueSetter = (params) => {
                const newValue = parseInt(params.newValue);
                if (isNaN(newValue)) return false;
                if (fieldDef.min !== undefined && newValue < fieldDef.min) return false;
                if (fieldDef.max !== undefined && newValue > fieldDef.max) return false;
                params.data[params.colDef.field] = newValue;
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
 * Create AG-Grid roster table
 */
export function createRosterGrid(container, players, columnDefs, app) {
    // Clear container
    container.innerHTML = '';

    const gridOptions = {
        columnDefs: columnDefs,
        rowData: players,
        defaultColDef: {
            resizable: true,
            sortable: true,
            filter: true,
            editable: false
        },
        enableCellTextSelection: true,
        ensureDomOrder: true,
        suppressCellFocus: false,
        rowHeight: 64,
        headerHeight: 40,
        animateRows: true,
        rowSelection: 'single',

        // Enable editing
        editType: 'fullRow',
        suppressClickEdit: false,
        singleClickEdit: false,
        stopEditingWhenCellsLoseFocus: true,

        // Callbacks
        onCellEditingStarted: (event) => {
            // Capture OVR before editing so we can detect changes
            if (event.colDef.field === 'POVR') {
                event.node.data._previousOVR = event.value;
                console.log('[AG-Grid] Started editing OVR, captured previous:', event.value);
            }
        },

        onCellValueChanged: (event) => {
            // Mark file as modified
            app.hasUnsavedChanges = true;
            app.updateSaveButton();

            // Update the player data in app
            const player = event.data;
            const rowIndex = event.node.rowIndex;
            if (app.players[rowIndex]) {
                app.players[rowIndex] = { ...player };
            }

            const fieldName = event.colDef.field || event.column?.colId;
            console.log(`[AG-Grid] Cell value changed: field=${fieldName}, newValue=${event.newValue}, oldValue=${event.oldValue}`);

            // ========== BODY TYPE / WEIGHT LINKING ==========
            // NOTE: This grid does NOT use the weight transform, so PWGT is actual weight directly

            // When body type changes, update weight to match
            if (fieldName === 'PCBT') {
                const newBodyType = event.data.PCBT;
                const position = player.PPOS;
                // Get actual weight for body type (no transform in this grid)
                const newActualWeight = getWeightFromBodyType(newBodyType, position);

                console.log(`[AG-Grid] Body type changed to ${BODY_TYPE_NAMES[newBodyType]} (${newBodyType}), auto-updating weight to ${newActualWeight} lbs`);

                // Update weight in player data (actual weight, no transform)
                player.PWGT = newActualWeight;
                if (app.players[rowIndex]) {
                    app.players[rowIndex].PWGT = newActualWeight;
                }

                // Refresh the weight cell
                event.api.refreshCells({
                    rowNodes: [event.node],
                    columns: ['PWGT'],
                    force: true
                });
            }

            // When weight changes, update body type to match
            if (fieldName === 'PWGT') {
                // In this grid, PWGT is actual weight (no transform)
                const actualWeight = event.data.PWGT;
                const position = player.PPOS;
                const newBodyType = getBodyTypeFromWeight(actualWeight, position);
                const oldBodyType = player.PCBT;

                if (newBodyType !== oldBodyType) {
                    console.log(`[AG-Grid] Weight changed to ${actualWeight} lbs, auto-updating body type from ${BODY_TYPE_NAMES[oldBodyType] || oldBodyType} to ${BODY_TYPE_NAMES[newBodyType]}`);

                    // Update body type in player data
                    player.PCBT = newBodyType;
                    if (app.players[rowIndex]) {
                        app.players[rowIndex].PCBT = newBodyType;
                    }

                    // Refresh the body type cell
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
                console.log('[AG-Grid] POVR field detected, processing OVR change...');
                const newOVR = parseInt(event.newValue);
                // If source is 'ovrAdjustment', skip (we're applying adjustments)
                if (event.source === 'ovrAdjustment') {
                    console.log('[AG-Grid] Skipping OVR dialog - source is ovrAdjustment');
                    return;
                }
                // Get old value - try event.oldValue first, fallback to stored value
                let oldOVR = parseInt(event.oldValue);
                console.log('[AG-Grid] Parsed oldOVR:', oldOVR, 'from event.oldValue:', event.oldValue);
                if (isNaN(oldOVR) && event.node.data._previousOVR !== undefined) {
                    oldOVR = event.node.data._previousOVR;
                    console.log('[AG-Grid] Using _previousOVR fallback:', oldOVR);
                }
                console.log('[AG-Grid] OVR change - old:', oldOVR, 'new:', newOVR);
                if (!isNaN(newOVR) && newOVR >= 0 && newOVR <= 99) {
                    if (isNaN(oldOVR) || oldOVR !== newOVR) {
                        console.log('[AG-Grid] Calling handleAGGridOVRChange');
                        handleAGGridOVRChange(event.node, event.data, oldOVR || 0, newOVR, app);
                    } else {
                        console.log('[AG-Grid] OVR unchanged (old === new), skipping');
                    }
                } else {
                    console.log('[AG-Grid] Invalid newOVR:', newOVR, '- must be 0-99');
                }
            }
        },

        onRowSelected: (event) => {
            if (event.node.isSelected()) {
                // Add visual highlighting to the selected row
                event.node.setSelected(true);
            }
        },

        onGridReady: (params) => {
            console.log('[AG-Grid] Grid ready');
            // Auto-size columns on load
            params.api.sizeColumnsToFit();
        }
    };

    // Create the grid
    const gridApi = createGrid(container, gridOptions);

    return {
        gridApi: gridApi,
        gridOptions: gridOptions,

        // Helper methods to match Handsontable API
        loadData: (newPlayers) => {
            gridApi.setGridOption('rowData', newPlayers);
        },

        getData: () => {
            const rowData = [];
            gridApi.forEachNode(node => rowData.push(node.data));
            return rowData;
        },

        render: () => {
            gridApi.refreshCells({ force: true });
        },

        destroy: () => {
            gridApi.destroy();
        },

        selectRow: (rowIndex) => {
            gridApi.forEachNode((node) => {
                if (node.rowIndex === rowIndex) {
                    node.setSelected(true);
                    gridApi.ensureIndexVisible(rowIndex);
                }
            });
        },

        deselectAll: () => {
            gridApi.deselectAll();
        }
    };
}

/**
 * Handle OVR change in AG-Grid - prompt user to adjust ratings
 * @param {Object} node - AG-Grid row node
 * @param {Object} player - Player data object
 * @param {number} oldOVR - Previous OVR value
 * @param {number} newOVR - New target OVR
 * @param {Object} app - App reference for updating data
 */
async function handleAGGridOVRChange(node, player, oldOVR, newOVR, app) {
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
        showAGGridOVRAdjustmentDialog(node, player, playerName, oldOVR, newOVR, result, app);

    } catch (error) {
        console.error('[AG-Grid OVR] Error calculating adjustments:', error);
    }
}

/**
 * Show dialog asking user if they want to apply rating adjustments
 */
function showAGGridOVRAdjustmentDialog(node, player, playerName, oldOVR, newOVR, result, app) {
    const { adjustments, newOVR: achievedOVR, archetype } = result;
    const delta = newOVR - oldOVR;
    const direction = delta > 0 ? 'increase' : 'decrease';

    // Build the adjustment list HTML
    let adjustmentHTML = '';
    const sortedAdjustments = Object.entries(adjustments)
        .sort((a, b) => b[1].weight - a[1].weight); // Sort by weight

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
        <div id="ag-ovr-adjustment-modal" class="modal-overlay">
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
        applyAGGridOVRAdjustments(node, player, adjustments, app);
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
        // Update app.players as well
        const rowIndex = node.rowIndex;
        if (app.players[rowIndex]) {
            app.players[rowIndex].POVR = oldOVR;
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
function applyAGGridOVRAdjustments(node, player, adjustments, app) {
    const changes = [];
    const rowIndex = node.rowIndex;

    for (const [fieldCode, adj] of Object.entries(adjustments)) {
        // Update player data
        player[fieldCode] = adj.suggested;

        // Update grid cell
        node.setDataValue(fieldCode, adj.suggested);

        // Update app.players
        if (app.players[rowIndex]) {
            app.players[rowIndex][fieldCode] = adj.suggested;
        }

        changes.push(`${adj.name}: ${adj.current} → ${adj.suggested}`);
    }

    console.log(`[AG-Grid OVR] Applied ${changes.length} rating changes:`, changes);

    // Mark as having unsaved changes
    app.hasUnsavedChanges = true;
    app.updateSaveButton();
}
