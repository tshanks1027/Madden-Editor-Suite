# Portrait Implementation Plan

## Issues to Fix
1. ❌ No portraits showing (handler mismatch)
2. ❌ Portrait not in FIRST column
3. ❌ Not working in roster editor (only draft class)
4. ❌ No two-way sync between PID/Player Pic/Portrait

## Solution

### 1. Fix IPC Handler (DONE)
- Added `portrait:get-image-data-by-plpo` handler

### 2. Add PORTRAIT Field Definition
**File**: `src/renderer/data/field-definitions.js`

Add PORTRAIT as FIRST field in MADDEN_FIELDS:
```javascript
export const MADDEN_FIELDS = {
    'PORTRAIT': {
        display: 'Portrait',
        shortDisplay: '',
        type: 'portrait',
        editable: false,
        width: 80
    },
    'PLNA': { display: 'Last Name', ... },
    // ... rest
};
```

Add PORTRAIT as FIRST field in FIELD_ORDER:
```javascript
export const FIELD_ORDER = [
    ["PORTRAIT", ""],
    ["PLNA", "Last Name"],
    ["PFNA", "First Name"],
    // ... rest
];
```

### 3. Add Portrait Handler in renderRoster()
**File**: `src/renderer/js/app.js` (around line 707-800)

Add special case for PORTRAIT field type:
```javascript
} else if (fieldName === 'PORTRAIT') {
    // Portrait column - shows image based on PID
    columnConfig = {
        ...columnConfig,
        type: 'text',
        width: 80,
        readOnly: true,
        renderer: this.portraitRenderer.bind(this)
    };
}
```

### 4. Update portraitRenderer to Use PID Directly
**File**: `src/renderer/js/app.js` (around line 1501-1579)

Simplify to use PID number:
```javascript
portraitRenderer(instance, td, row, col, prop, value, cellProperties) {
    td.innerHTML = '';
    td.style.padding = '2px';
    td.style.textAlign = 'center';

    const rowData = instance.getSourceDataAtRow(row);
    if (!rowData) {
        td.textContent = '-';
        return td;
    }

    const pid = rowData.PSXP || rowData.PID; // Try both field names

    if (pid && pid > 0 && typeof window.electronAPI !== 'undefined') {
        // Get player name from PID
        const playerName = getPlayerNameFromPID(pid);

        if (playerName && playerName !== 'Generic Face') {
            // Real player - construct PLPO key
            const parts = playerName.trim().split(' ');
            if (parts.length >= 2) {
                const firstName = parts[0];
                const lastName = parts.slice(1).join('');
                const portraitKey = `plpo_${lastName}${firstName}`.toLowerCase();

                window.electronAPI.portrait.getByPLPO(portraitKey)
                    .then(imageData => {
                        if (imageData) {
                            const img = document.createElement('img');
                            img.src = imageData;
                            img.style.width = '64px';
                            img.style.height = '64px';
                            img.style.objectFit = 'cover';
                            img.style.borderRadius = '4px';
                            img.title = playerName;
                            td.innerHTML = '';
                            td.appendChild(img);
                        }
                    });
            }
        } else if (rowData.PEPS) {
            // Generic face - use PAM code
            const portraitKey = rowData.PEPS.replace('gen_', 'plpo_generic_').toLowerCase();
            window.electronAPI.portrait.getByPLPO(portraitKey)
                .then(imageData => {
                    if (imageData) {
                        const img = document.createElement('img');
                        img.src = imageData;
                        img.style.width = '64px';
                        img.style.height = '64px';
                        img.style.objectFit = 'cover';
                        img.style.borderRadius = '4px';
                        td.innerHTML = '';
                        td.appendChild(img);
                    }
                });
        }
    }

    return td;
}
```

### 5. Add Two-Way Sync in afterChange
**File**: `src/renderer/js/app.js` (in Handsontable afterChange handler)

When PID changes → update portrait (already happens via renderer)
When PLAYERPIC changes → update PID → update portrait:

```javascript
afterChange: (changes, source) => {
    if (!changes || source === 'loadData') return;

    changes.forEach(([row, prop, oldValue, newValue]) => {
        if (prop === 'PSXP' || prop === 'PLAYERPIC') {
            // PID or Player Pic changed - portrait will auto-update via renderer
            this.hotTable.render();
        }
    });
}
```

## Testing Checklist
- [ ] Add PORTRAIT field to field-definitions.js
- [ ] Add PORTRAIT handler in renderRoster()
- [ ] Update portraitRenderer to use PID
- [ ] Test in roster editor
- [ ] Test in draft class editor
- [ ] Test PID change updates portrait
- [ ] Test Player Pic change updates PID and portrait
