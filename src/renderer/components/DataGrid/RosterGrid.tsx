import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GridReadyEvent,
  CellValueChangedEvent,
  GridOptions,
  ICellEditorParams
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  ROSTER_FIELD_DEFINITIONS,
  RosterField,
  getFieldsByPosition,
  getDefaultVisibleFields
} from '@shared/types/roster-fields';

// Custom dropdown cell editor for lookup fields
class LookupCellEditor {
  private eInput!: HTMLSelectElement;
  private value: any;

  init(params: ICellEditorParams): void {
    this.eInput = document.createElement('select');
    this.eInput.className = 'ag-cell-editor-select';
    this.eInput.style.width = '100%';
    this.eInput.style.height = '100%';

    // Load options based on lookup type
    this.loadOptions(params);

    this.value = params.value;
    this.eInput.value = params.value;
  }

  async loadOptions(params: ICellEditorParams): Promise<void> {
    const field = params.colDef.field;
    const fieldDef = ROSTER_FIELD_DEFINITIONS[field!];

    if (fieldDef?.lookupFile) {
      try {
        const options = await window.electronAPI.lookup.getDropdownOptions(fieldDef.lookupFile);

        // Clear existing options
        this.eInput.innerHTML = '';

        // Add options
        options.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option.id.toString();
          optionElement.text = option.name;
          this.eInput.appendChild(optionElement);
        });

        // Set current value
        this.eInput.value = params.value?.toString() || '0';
      } catch (error) {
        console.error('Failed to load lookup options:', error);
      }
    }
  }

  getGui(): HTMLElement {
    return this.eInput;
  }

  getValue(): any {
    return parseInt(this.eInput.value) || 0;
  }

  destroy(): void {
    // Cleanup if needed
  }

  isPopup(): boolean {
    return false;
  }

  isCancelBeforeStart(): boolean {
    return false;
  }

  isCancelAfterEnd(): boolean {
    return false;
  }

  focusIn(): void {
    this.eInput.focus();
  }

  focusOut(): void {
    // No action needed
  }
}

// Custom cell renderer for lookup values
const LookupCellRenderer = (params: any) => {
  const [displayValue, setDisplayValue] = useState<string>('Loading...');

  useEffect(() => {
    const loadDisplayValue = async () => {
      const field = params.colDef.field;
      const fieldDef = ROSTER_FIELD_DEFINITIONS[field];

      if (fieldDef?.lookupFile && params.value !== undefined) {
        try {
          const display = await window.electronAPI.lookup.getDisplayName(
            fieldDef.lookupFile,
            params.value
          );
          setDisplayValue(display);
        } catch (error) {
          console.error('Failed to get display value:', error);
          setDisplayValue(params.value?.toString() || '');
        }
      } else {
        setDisplayValue(params.value?.toString() || '');
      }
    };

    loadDisplayValue();
  }, [params.value, params.colDef.field]);

  return <span>{displayValue}</span>;
};

interface RosterGridProps {
  players: any[];
  onPlayerChange: (player: any) => void;
  selectedPosition?: string;
  showAllColumns?: boolean;
}

export const RosterGrid: React.FC<RosterGridProps> = ({
  players,
  onPlayerChange,
  selectedPosition,
  showAllColumns = false
}) => {
  const [gridApi, setGridApi] = useState<any>(null);

  // Generate column definitions based on field definitions
  const columnDefs = useMemo((): ColDef[] => {
    const fieldsToShow = showAllColumns
      ? Object.values(ROSTER_FIELD_DEFINITIONS)
      : selectedPosition
        ? getFieldsByPosition(selectedPosition)
        : getDefaultVisibleFields();

    // Sort by priority and alphabetically
    const sortedFields = fieldsToShow.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return sortedFields.map((field: RosterField): ColDef => {
      const colDef: ColDef = {
        field: field.key,
        headerName: field.displayName,
        width: field.width || 100,
        sortable: field.sortable,
        filter: field.filterable,
        editable: field.editable,
        resizable: true,
        suppressMenu: false,
        menuTabs: ['filterMenuTab', 'generalMenuTab']
      };

      // Handle pinned columns
      if (field.pinned) {
        colDef.pinned = field.pinned;
        colDef.lockPinned = true;
      }

      // Handle lookup fields
      if (field.dataType === 'lookup' && field.lookupFile) {
        colDef.cellRenderer = LookupCellRenderer;
        colDef.cellEditor = LookupCellEditor;
        colDef.cellEditorPopup = false;
      }

      // Handle numeric fields with validation
      if (field.dataType === 'number') {
        colDef.cellEditor = 'agNumberCellEditor';
        colDef.cellEditorParams = {
          min: field.minValue,
          max: field.maxValue,
          precision: 0
        };

        // Add cell style for out-of-range values
        colDef.cellStyle = (params) => {
          const value = params.value;
          if (value < (field.minValue || 0) || value > (field.maxValue || 99)) {
            return { backgroundColor: '#ffebee', color: '#c62828' };
          }
          return null;
        };
      }

      return colDef;
    });
  }, [selectedPosition, showAllColumns]);

  // Grid options
  const gridOptions = useMemo((): GridOptions => ({
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      editable: true
    },
    suppressRowClickSelection: true,
    rowSelection: 'single',
    animateRows: true,
    enableRangeSelection: true,
    suppressMovableColumns: false,
    suppressFieldDotNotation: true,

    // Enable multi-column sorting with Shift+Click
    alwaysMultiSort: false,
    multiSortKey: 'ctrl',

    // Pagination
    pagination: true,
    paginationPageSize: 100,

    // Theme
    theme: 'ag-theme-alpine'
  }), []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);

    // Auto-size columns on initial load
    params.api.sizeColumnsToFit();

    // Set focus to first editable cell
    setTimeout(() => {
      params.api.setFocusedCell(0, 'PLNA');
    }, 100);
  }, []);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const updatedPlayer = event.data;
    onPlayerChange(updatedPlayer);

    // If position changed, refresh column visibility
    if (event.colDef.field === 'PPOS') {
      // Could trigger a column visibility refresh here
      console.log('Position changed to:', event.newValue);
    }
  }, [onPlayerChange]);

  // Auto-resize columns when container size changes
  useEffect(() => {
    const handleResize = () => {
      if (gridApi) {
        gridApi.sizeColumnsToFit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridApi]);

  // Update grid when players data changes
  useEffect(() => {
    if (gridApi) {
      gridApi.setRowData(players);
    }
  }, [players, gridApi]);

  return (
    <div className="w-full h-full">
      <div className="ag-theme-alpine w-full h-full" style={{ '--ag-background-color': '#1a1a1a', '--ag-foreground-color': '#e0e0e0' } as React.CSSProperties}>
        <AgGridReact
          rowData={players}
          columnDefs={columnDefs}
          gridOptions={gridOptions}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          suppressRowClickSelection={true}
          rowSelection="single"
          animateRows={true}
          enableRangeSelection={true}
          suppressMovableColumns={false}
          alwaysMultiSort={false}
          multiSortKey="ctrl"
          pagination={true}
          paginationPageSize={100}
          domLayout="normal"
          headerHeight={40}
          rowHeight={35}
        />
      </div>
    </div>
  );
};