/**
 * Fast Select Cell Editor for AG-Grid
 *
 * Replaces agSelectCellEditor with a custom div-based dropdown
 * to fix the slow native <select> rendering issue in Chromium/Electron.
 * Uses virtual scrolling for large option lists.
 */

export class FastSelectEditor {
    constructor() {
        this.eGui = null;
        this.eInput = null;
        this.eDropdown = null;
        this.eOptions = null;
        this.values = [];
        this.filteredValues = [];
        this.selectedValue = null;
        this.highlightedIndex = -1;
        this.isOpen = false;
        this.params = null;

        // Virtual scrolling settings
        this.itemHeight = 28;
        this.visibleItems = 10;
        this.scrollTop = 0;
    }

    init(params) {
        this.params = params;
        this.values = params.values || [];
        this.selectedValue = params.value;
        this.filteredValues = [...this.values];

        // Create container
        this.eGui = document.createElement('div');
        this.eGui.className = 'fast-select-editor';
        this.eGui.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
        `;

        // Create input for search/display
        this.eInput = document.createElement('input');
        this.eInput.type = 'text';
        this.eInput.className = 'fast-select-editor__input';
        this.eInput.value = this.selectedValue || '';
        this.eInput.style.cssText = `
            width: 100%;
            height: 100%;
            padding: 4px 8px;
            border: 2px solid #ffa726;
            background: #1a1a1a;
            color: #e0e0e0;
            font-size: 14px;
            box-sizing: border-box;
            outline: none;
            z-index: 1;
            position: relative;
            pointer-events: auto;
        `;

        // Create dropdown panel
        this.eDropdown = document.createElement('div');
        this.eDropdown.className = 'fast-select-editor__dropdown';
        this.eDropdown.style.cssText = `
            position: fixed;
            background: #1a1a1a;
            border: 1px solid #ffa726;
            border-radius: 4px;
            max-height: ${this.visibleItems * this.itemHeight}px;
            overflow-y: auto;
            z-index: 10000;
            display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;

        // Create options container (for virtual scrolling)
        this.eOptions = document.createElement('div');
        this.eOptions.className = 'fast-select-editor__options';
        this.eDropdown.appendChild(this.eOptions);

        this.eGui.appendChild(this.eInput);
        document.body.appendChild(this.eDropdown);

        // Bind events
        this.eInput.addEventListener('input', this.onInput.bind(this));
        this.eInput.addEventListener('keydown', (e) => {
            console.log('[FastSelectEditor] keydown event:', e.key, 'target:', e.target.tagName);
            this.onKeyDown(e);
        });
        this.eInput.addEventListener('keypress', (e) => {
            console.log('[FastSelectEditor] keypress event:', e.key);
        });
        this.eInput.addEventListener('focus', this.openDropdown.bind(this));
        this.eInput.addEventListener('click', this.openDropdown.bind(this));

        // Ensure input can receive events
        this.eInput.setAttribute('tabindex', '0');
        this.eInput.setAttribute('autocomplete', 'off');
        this.eDropdown.addEventListener('scroll', this.onScroll.bind(this));
        this.eDropdown.addEventListener('click', this.onOptionClick.bind(this));

        // CRITICAL: Prevent mousedown from bubbling to AG-Grid AND prevent focus loss
        // Without this, AG-Grid's stopEditingWhenCellsLoseFocus destroys the editor
        // before the click event fires on dropdown options
        this.eDropdown.addEventListener('mousedown', (e) => {
            e.preventDefault();  // Prevents focus from leaving the input
            e.stopPropagation();
        });

        // Close on outside click
        this.outsideClickHandler = (e) => {
            if (!this.eGui.contains(e.target) && !this.eDropdown.contains(e.target)) {
                this.closeDropdown();
            }
        };
        document.addEventListener('mousedown', this.outsideClickHandler);

        // Initial render
        this.renderOptions();
    }

    getGui() {
        return this.eGui;
    }

    afterGuiAttached() {
        console.log('[FastSelectEditor] afterGuiAttached called');
        // Use requestAnimationFrame to ensure DOM is ready before focusing
        // This prevents timing issues where focus() fails silently
        requestAnimationFrame(() => {
            if (this.eInput) {
                this.eInput.focus();
                this.eInput.select();
                console.log('[FastSelectEditor] Input focused:', document.activeElement === this.eInput);
            }
            this.positionDropdown();
            this.openDropdown();
            console.log('[FastSelectEditor] Values count:', this.values.length);
        });
    }

    getValue() {
        return this.selectedValue;
    }

    isPopup() {
        return false;
    }

    destroy() {
        document.removeEventListener('mousedown', this.outsideClickHandler);
        if (this.eDropdown && this.eDropdown.parentNode) {
            this.eDropdown.parentNode.removeChild(this.eDropdown);
        }
    }

    onInput(e) {
        console.log('[FastSelectEditor] onInput called, value:', e.target.value);
        const searchTerm = e.target.value.toLowerCase();
        this.filteredValues = this.values.filter(v =>
            String(v).toLowerCase().includes(searchTerm)
        );
        console.log('[FastSelectEditor] Filtered to', this.filteredValues.length, 'values');
        this.highlightedIndex = this.filteredValues.length > 0 ? 0 : -1;
        this.renderOptions();
        this.openDropdown();
    }

    onKeyDown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                e.stopPropagation();
                if (!this.isOpen) {
                    this.openDropdown();
                } else {
                    this.highlightNext();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                this.highlightPrev();
                break;
            case 'Enter':
                e.preventDefault();
                e.stopPropagation();
                if (this.highlightedIndex >= 0 && this.filteredValues[this.highlightedIndex] !== undefined) {
                    this.selectValue(this.filteredValues[this.highlightedIndex]);
                } else if (this.eInput.value) {
                    // If typed value matches an option exactly, select it
                    const exactMatch = this.values.find(v =>
                        String(v).toLowerCase() === this.eInput.value.toLowerCase()
                    );
                    if (exactMatch !== undefined) {
                        this.selectValue(exactMatch);
                    }
                }
                this.params.stopEditing();
                break;
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                this.closeDropdown();
                this.params.stopEditing(true);
                break;
            case 'Tab':
                if (this.highlightedIndex >= 0 && this.filteredValues[this.highlightedIndex] !== undefined) {
                    this.selectValue(this.filteredValues[this.highlightedIndex]);
                }
                break;
        }
    }

    onScroll() {
        this.scrollTop = this.eDropdown.scrollTop;
        this.renderOptions();
    }

    onOptionClick(e) {
        console.log('[FastSelectEditor] onOptionClick fired, target:', e.target);
        const optionEl = e.target.closest('.fast-select-editor__option');
        console.log('[FastSelectEditor] optionEl:', optionEl);
        if (optionEl) {
            const index = parseInt(optionEl.dataset.index, 10);
            console.log('[FastSelectEditor] index:', index, 'filteredValues[index]:', this.filteredValues[index]);
            if (this.filteredValues[index] !== undefined) {
                this.selectValue(this.filteredValues[index]);
                console.log('[FastSelectEditor] selectedValue is now:', this.selectedValue);
                this.params.stopEditing();
            }
        } else {
            console.log('[FastSelectEditor] No optionEl found!');
        }
    }

    highlightNext() {
        if (this.filteredValues.length === 0) return;
        this.highlightedIndex = (this.highlightedIndex + 1) % this.filteredValues.length;
        this.scrollToHighlighted();
        this.renderOptions();
    }

    highlightPrev() {
        if (this.filteredValues.length === 0) return;
        this.highlightedIndex = this.highlightedIndex <= 0
            ? this.filteredValues.length - 1
            : this.highlightedIndex - 1;
        this.scrollToHighlighted();
        this.renderOptions();
    }

    scrollToHighlighted() {
        const itemTop = this.highlightedIndex * this.itemHeight;
        const itemBottom = itemTop + this.itemHeight;
        const viewportTop = this.eDropdown.scrollTop;
        const viewportBottom = viewportTop + this.eDropdown.clientHeight;

        if (itemTop < viewportTop) {
            this.eDropdown.scrollTop = itemTop;
        } else if (itemBottom > viewportBottom) {
            this.eDropdown.scrollTop = itemBottom - this.eDropdown.clientHeight;
        }
    }

    selectValue(value) {
        this.selectedValue = value;
        this.eInput.value = value;
        this.closeDropdown();
    }

    openDropdown() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.positionDropdown();
        this.eDropdown.style.display = 'block';
        this.renderOptions();
    }

    closeDropdown() {
        this.isOpen = false;
        this.eDropdown.style.display = 'none';
    }

    positionDropdown() {
        const rect = this.eInput.getBoundingClientRect();
        const dropdownHeight = Math.min(this.filteredValues.length, this.visibleItems) * this.itemHeight;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Set width to match input
        this.eDropdown.style.width = `${rect.width}px`;
        this.eDropdown.style.left = `${rect.left}px`;

        // Position above or below based on space
        if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
            this.eDropdown.style.top = `${rect.bottom}px`;
            this.eDropdown.style.bottom = 'auto';
        } else {
            this.eDropdown.style.bottom = `${window.innerHeight - rect.top}px`;
            this.eDropdown.style.top = 'auto';
        }
    }

    renderOptions() {
        // Use virtual scrolling for large lists
        const totalHeight = this.filteredValues.length * this.itemHeight;
        const startIndex = Math.floor(this.scrollTop / this.itemHeight);
        const endIndex = Math.min(startIndex + this.visibleItems + 2, this.filteredValues.length);

        // Set total height for scrolling
        this.eOptions.style.height = `${totalHeight}px`;
        this.eOptions.style.position = 'relative';

        // Clear and render visible items
        this.eOptions.innerHTML = '';

        for (let i = startIndex; i < endIndex; i++) {
            const value = this.filteredValues[i];
            const option = document.createElement('div');
            option.className = 'fast-select-editor__option';
            if (i === this.highlightedIndex) {
                option.classList.add('fast-select-editor__option--highlighted');
            }
            if (value === this.selectedValue) {
                option.classList.add('fast-select-editor__option--selected');
            }
            option.dataset.index = i;
            option.textContent = value;
            option.style.cssText = `
                position: absolute;
                top: ${i * this.itemHeight}px;
                left: 0;
                right: 0;
                height: ${this.itemHeight}px;
                padding: 4px 8px;
                cursor: pointer;
                color: #e0e0e0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: flex;
                align-items: center;
                box-sizing: border-box;
            `;

            if (i === this.highlightedIndex) {
                option.style.background = '#333';
            }
            if (value === this.selectedValue) {
                option.style.background = '#ffa726';
                option.style.color = '#000';
            }

            this.eOptions.appendChild(option);
        }
    }
}

// Register the editor globally for AG-Grid
window.FastSelectEditor = FastSelectEditor;
