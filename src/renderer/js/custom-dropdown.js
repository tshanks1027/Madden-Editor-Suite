/**
 * Custom Dropdown Component
 *
 * Replaces native <select> elements with custom div-based dropdowns
 * to fix Chromium/Electron slow native select rendering issue.
 */

console.log('[CustomDropdown] Script loaded');

class CustomDropdown {
    constructor(selectElement) {
        this.select = selectElement;
        this.isOpen = false;
        this.selectedIndex = selectElement.selectedIndex;
        this.options = [];
        this.filteredOptions = [];
        this.highlightedIndex = -1;

        this.createDropdown();
        this.bindEvents();
    }

    createDropdown() {
        // Create wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'custom-dropdown';

        // Copy original classes for styling compatibility
        if (this.select.classList.contains('control-select')) {
            this.wrapper.classList.add('custom-dropdown--control');
        }

        // Create trigger button
        this.trigger = document.createElement('button');
        this.trigger.type = 'button';
        this.trigger.className = 'custom-dropdown__trigger';

        // Create display text
        this.displayText = document.createElement('span');
        this.displayText.className = 'custom-dropdown__text';
        this.trigger.appendChild(this.displayText);

        // Create arrow
        const arrow = document.createElement('span');
        arrow.className = 'custom-dropdown__arrow';
        arrow.innerHTML = '&#9662;'; // Down triangle
        this.trigger.appendChild(arrow);

        // Create dropdown panel
        this.panel = document.createElement('div');
        this.panel.className = 'custom-dropdown__panel';

        // Create options container
        this.optionsContainer = document.createElement('div');
        this.optionsContainer.className = 'custom-dropdown__options';
        this.panel.appendChild(this.optionsContainer);

        // Assemble
        this.wrapper.appendChild(this.trigger);
        this.wrapper.appendChild(this.panel);

        // Insert wrapper and hide original select
        this.select.parentNode.insertBefore(this.wrapper, this.select);
        this.select.style.display = 'none';

        // Build options from select
        this.rebuildOptions();
        this.updateDisplay();
    }

    rebuildOptions() {
        this.options = [];
        this.optionsContainer.innerHTML = '';

        Array.from(this.select.options).forEach((opt, index) => {
            const option = {
                value: opt.value,
                text: opt.textContent || opt.text,
                index: index,
                element: null
            };

            const optEl = document.createElement('div');
            optEl.className = 'custom-dropdown__option';
            optEl.textContent = option.text;
            optEl.dataset.index = index;
            optEl.dataset.value = option.value;

            if (index === this.select.selectedIndex) {
                optEl.classList.add('custom-dropdown__option--selected');
            }

            option.element = optEl;
            this.options.push(option);
            this.optionsContainer.appendChild(optEl);
        });

        this.filteredOptions = [...this.options];
    }

    updateDisplay() {
        const selected = this.select.options[this.select.selectedIndex];
        this.displayText.textContent = selected ? (selected.textContent || selected.text) : '';

        // Update selected state in options
        this.options.forEach((opt, idx) => {
            if (opt.element) {
                opt.element.classList.toggle('custom-dropdown__option--selected', idx === this.select.selectedIndex);
            }
        });
    }

    bindEvents() {
        // Toggle on trigger click
        this.trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });

        // Option selection
        this.optionsContainer.addEventListener('click', (e) => {
            const optionEl = e.target.closest('.custom-dropdown__option');
            if (optionEl) {
                const index = parseInt(optionEl.dataset.index, 10);
                this.selectOption(index);
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.close();
            }
        });

        // Keyboard navigation
        this.trigger.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.wrapper.addEventListener('keydown', (e) => {
            if (this.isOpen) {
                this.handleKeyDown(e);
            }
        });

        // Watch for programmatic changes to select
        const observer = new MutationObserver(() => {
            this.rebuildOptions();
            this.updateDisplay();
        });
        observer.observe(this.select, { childList: true, subtree: true });

        // Watch for value changes
        this.select.addEventListener('change', () => {
            this.updateDisplay();
        });
    }

    handleKeyDown(e) {
        switch (e.key) {
            case 'Enter':
            case ' ':
                if (!this.isOpen) {
                    this.open();
                } else if (this.highlightedIndex >= 0) {
                    this.selectOption(this.highlightedIndex);
                }
                e.preventDefault();
                break;
            case 'Escape':
                this.close();
                e.preventDefault();
                break;
            case 'ArrowDown':
                if (this.isOpen) {
                    this.highlightNext();
                } else {
                    this.open();
                }
                e.preventDefault();
                break;
            case 'ArrowUp':
                if (this.isOpen) {
                    this.highlightPrev();
                }
                e.preventDefault();
                break;
            case 'Home':
                if (this.isOpen) {
                    this.highlightIndex(0);
                }
                e.preventDefault();
                break;
            case 'End':
                if (this.isOpen) {
                    this.highlightIndex(this.options.length - 1);
                }
                e.preventDefault();
                break;
        }
    }

    highlightNext() {
        const nextIndex = this.highlightedIndex < this.options.length - 1
            ? this.highlightedIndex + 1
            : 0;
        this.highlightIndex(nextIndex);
    }

    highlightPrev() {
        const prevIndex = this.highlightedIndex > 0
            ? this.highlightedIndex - 1
            : this.options.length - 1;
        this.highlightIndex(prevIndex);
    }

    highlightIndex(index) {
        // Remove previous highlight
        this.options.forEach(opt => {
            if (opt.element) {
                opt.element.classList.remove('custom-dropdown__option--highlighted');
            }
        });

        this.highlightedIndex = index;

        if (index >= 0 && index < this.options.length) {
            const opt = this.options[index];
            if (opt.element) {
                opt.element.classList.add('custom-dropdown__option--highlighted');
                opt.element.scrollIntoView({ block: 'nearest' });
            }
        }
    }

    selectOption(index) {
        if (index >= 0 && index < this.options.length) {
            this.select.selectedIndex = index;
            this.select.dispatchEvent(new Event('change', { bubbles: true }));
            this.updateDisplay();
            this.close();
        }
    }

    open() {
        if (this.isOpen) return;

        this.isOpen = true;
        this.wrapper.classList.add('custom-dropdown--open');
        this.highlightIndex(this.select.selectedIndex);

        // Position panel
        this.positionPanel();

        // Scroll selected into view
        const selectedOpt = this.options[this.select.selectedIndex];
        if (selectedOpt && selectedOpt.element) {
            selectedOpt.element.scrollIntoView({ block: 'nearest' });
        }
    }

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.wrapper.classList.remove('custom-dropdown--open');
        this.highlightedIndex = -1;

        // Remove highlights
        this.options.forEach(opt => {
            if (opt.element) {
                opt.element.classList.remove('custom-dropdown__option--highlighted');
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    positionPanel() {
        const triggerRect = this.trigger.getBoundingClientRect();
        const panelHeight = Math.min(300, this.options.length * 36);
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        // Open upward if not enough space below
        if (spaceBelow < panelHeight && spaceAbove > spaceBelow) {
            this.panel.classList.add('custom-dropdown__panel--above');
        } else {
            this.panel.classList.remove('custom-dropdown__panel--above');
        }
    }

    // Public API to update options (for dynamic dropdowns)
    refresh() {
        this.rebuildOptions();
        this.updateDisplay();
    }

    // Get/set value
    get value() {
        return this.select.value;
    }

    set value(val) {
        this.select.value = val;
        this.updateDisplay();
    }
}

// Initialize all control-select dropdowns
function initCustomDropdowns() {
    const selects = document.querySelectorAll('.control-select');
    const dropdowns = new Map();

    selects.forEach(select => {
        // Skip if already converted or explicitly marked to skip
        if (!select.dataset.customDropdown) {
            select.dataset.customDropdown = 'true';
            const dropdown = new CustomDropdown(select);
            dropdowns.set(select.id, dropdown);
        }
    });

    return dropdowns;
}

// Export for use in app.js
window.CustomDropdown = CustomDropdown;
window.initCustomDropdowns = initCustomDropdowns;
