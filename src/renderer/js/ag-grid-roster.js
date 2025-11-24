/**
 * AG-Grid Roster Table Implementation
 * Replaces Handsontable with AG-Grid Community Edition for better performance
 */

import { createGrid } from 'ag-grid-community';

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

            console.log(`[AG-Grid] Cell value changed: ${event.colDef.field} = ${event.newValue}`);
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
