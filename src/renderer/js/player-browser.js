/**
 * Player Browser Module
 *
 * Provides a searchable, filterable browser for the player database.
 * Allows users to search, view, edit, and add players to editors.
 */

(function() {
  'use strict';

  // Module state
  let searchTimeout = null;
  let currentResults = [];
  let currentPage = 1;
  let pageSize = 50;
  let totalResults = 0;
  let isLoading = false;
  let selectedPlayerIds = new Set(); // Track selected players for batch operations

  /**
   * Initialize the player browser module
   */
  function initPlayerBrowser() {
    console.log('[PlayerBrowser] Initializing...');

    setupEventListeners();
    loadPositionFilter();
    loadCollegeFilter();
    loadTeamFilter();
    initAddToRosterModal();
    initAddToDraftModal();

    console.log('[PlayerBrowser] Initialized');
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Close button
    const closeBtn = document.getElementById('closePlayerBrowser');
    if (closeBtn) {
      closeBtn.addEventListener('click', closePlayerBrowser);
    }

    // Add New Player button
    const addNewPlayerBtn = document.getElementById('addNewPlayerBtn');
    if (addNewPlayerBtn) {
      addNewPlayerBtn.addEventListener('click', function() {
        console.log('[PlayerBrowser] Add New Player clicked');
        if (typeof window.createNewDbPlayer === 'function') {
          window.createNewDbPlayer();
        } else {
          alert('Create player functionality not available. Please reload the application.');
        }
      });
    }

    // Modal background click
    const modal = document.getElementById('playerBrowserModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        // Don't close if player card modal is open
        const playerCardModal = document.getElementById('dbPlayerCardModal');
        if (playerCardModal && playerCardModal.style.display !== 'none' && playerCardModal.style.display !== '') {
          return; // Player card is open, don't close browser
        }
        if (e.target === modal) {
          closePlayerBrowser();
        }
      });

      // Restore focus when clicking anywhere in the modal content (not on interactive elements)
      // This helps recover focus after native dialogs dismiss
      const modalContent = modal.querySelector('.player-browser-content');
      if (modalContent) {
        modalContent.addEventListener('click', (e) => {
          // Don't interfere with interactive elements
          const target = e.target;
          const interactiveTags = ['INPUT', 'SELECT', 'BUTTON', 'A', 'TEXTAREA'];
          if (interactiveTags.includes(target.tagName) || target.closest('button, a, input, select, textarea')) {
            return;
          }
          // Restore focus to search after clicking on non-interactive areas
          restoreFocusToSearch();
        });
      }
    }

    // Search input with debounce
    const searchInput = document.getElementById('playerBrowserSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        searchTimeout = setTimeout(() => {
          currentPage = 1;
          performSearch();
        }, 300);
      });

      // Enter key for immediate search
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          if (searchTimeout) {
            clearTimeout(searchTimeout);
          }
          currentPage = 1;
          performSearch();
        }
      });
    }

    // Filter change handlers
    const positionFilter = document.getElementById('playerBrowserPositionFilter');
    if (positionFilter) {
      positionFilter.addEventListener('change', () => {
        currentPage = 1;
        performSearch();
      });
    }

    const draftYearFrom = document.getElementById('playerBrowserDraftYearFrom');
    if (draftYearFrom) {
      draftYearFrom.addEventListener('change', () => {
        currentPage = 1;
        performSearch();
      });
    }

    const draftYearTo = document.getElementById('playerBrowserDraftYearTo');
    if (draftYearTo) {
      draftYearTo.addEventListener('change', () => {
        currentPage = 1;
        performSearch();
      });
    }

    // College filter (dropdown)
    const collegeFilter = document.getElementById('playerBrowserCollegeFilter');
    if (collegeFilter) {
      collegeFilter.addEventListener('change', () => {
        currentPage = 1;
        performSearch();
      });
    }

    // Team filter
    const teamFilter = document.getElementById('playerBrowserTeamFilter');
    if (teamFilter) {
      teamFilter.addEventListener('change', () => {
        currentPage = 1;
        performSearch();
      });
    }

    // HOF filter
    const hofFilter = document.getElementById('playerBrowserHofFilter');
    if (hofFilter) {
      hofFilter.addEventListener('change', () => {
        currentPage = 1;
        performSearch();
      });
    }

    // Empty filter
    const emptyFilter = document.getElementById('playerBrowserEmptyFilter');
    if (emptyFilter) {
      emptyFilter.addEventListener('change', () => {
        currentPage = 1;
        performSearch();
      });
    }

    // Pagination buttons
    const prevBtn = document.getElementById('playerBrowserPrevPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          displayResults();
        }
      });
    }

    const nextBtn = document.getElementById('playerBrowserNextPage');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const maxPage = Math.ceil(totalResults / pageSize);
        if (currentPage < maxPage) {
          currentPage++;
          displayResults();
        }
      });
    }

    // Escape key to close - but only if player card modal is not open
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Don't close player browser if player card modal is open (it has priority)
        const playerCardModal = document.getElementById('dbPlayerCardModal');
        if (playerCardModal && playerCardModal.style.display !== 'none' && playerCardModal.style.display !== '') {
          return; // Let player card handle the escape
        }
        const modal = document.getElementById('playerBrowserModal');
        if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
          closePlayerBrowser();
        }
      }
    });

    // Selection handlers - "Select All" checkbox
    const selectAllCheckbox = document.getElementById('selectAllPlayers');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        handleSelectAllChange(e.target.checked);
      });
    }

    // Selection handlers - individual checkboxes (using event delegation)
    const resultsContainer = document.getElementById('playerBrowserResults');
    if (resultsContainer) {
      resultsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('player-select-checkbox')) {
          handleCheckboxChange(e.target);
        }
      });
    }

    // Batch add buttons
    const addSelectedToRosterBtn = document.getElementById('addSelectedToRosterBtn');
    if (addSelectedToRosterBtn) {
      addSelectedToRosterBtn.addEventListener('click', addSelectedToRoster);
    }

    const addSelectedToDraftBtn = document.getElementById('addSelectedToDraftBtn');
    if (addSelectedToDraftBtn) {
      addSelectedToDraftBtn.addEventListener('click', addSelectedToDraft);
    }
  }

  /**
   * Load position filter options
   */
  async function loadPositionFilter() {
    var select = document.getElementById('playerBrowserPositionFilter');
    if (!select) return;

    // Madden 26 positions
    var maddenPositions = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
      'LEDG', 'REDG', 'DT', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS', 'K', 'P', 'LS'];

    console.log('[PlayerBrowser] Loading Madden 26 positions');
    select.innerHTML = '<option value="">All Positions</option>';
    maddenPositions.forEach(function(pos) {
      var opt = document.createElement('option');
      opt.value = pos;
      opt.textContent = pos;
      select.appendChild(opt);
    });
  }

  /**
   * Load college filter options
   */
  async function loadCollegeFilter() {
    var select = document.getElementById('playerBrowserCollegeFilter');
    if (!select) return;

    try {
      if (window.electronAPI && window.electronAPI.lookup) {
        var colleges = await window.electronAPI.lookup.getDropdownOptions('college_lookup.csv');
        if (colleges && colleges.length > 0) {
          select.innerHTML = '<option value="">All Colleges</option>';
          colleges.forEach(function(c) {
            // API returns {value: id, label: name} - only use label (college name)
            var collegeName = c.label;
            // Skip entries without a valid name or with "Blank"
            if (!collegeName || collegeName.trim() === '' || collegeName === 'Blank') {
              return;
            }
            var opt = document.createElement('option');
            opt.value = collegeName.trim();
            opt.textContent = collegeName.trim();
            select.appendChild(opt);
          });
          console.log('[PlayerBrowser] Loaded colleges from API');
          return;
        }
      }
    } catch (error) {
      console.error('[PlayerBrowser] Failed to load colleges from API:', error);
    }

    // Keep default option if API fails
    console.log('[PlayerBrowser] Could not load colleges - keeping default');
  }

  /**
   * Load team filter options
   */
  async function loadTeamFilter() {
    var select = document.getElementById('playerBrowserTeamFilter');
    if (!select) return;

    try {
      if (window.electronAPI && window.electronAPI.lookup) {
        var teams = await window.electronAPI.lookup.getDropdownOptions('team_lookup.csv');
        if (teams && teams.length > 0) {
          select.innerHTML = '<option value="">All Teams</option>';
          teams.forEach(function(t) {
            var teamName = t.label;
            // Skip Free Agent and invalid entries
            if (!teamName || teamName.trim() === '' || teamName === 'Free Agent') {
              return;
            }
            var opt = document.createElement('option');
            opt.value = teamName.trim();
            opt.textContent = teamName.trim();
            select.appendChild(opt);
          });
          console.log('[PlayerBrowser] Loaded teams from API');
          return;
        }
      }
    } catch (error) {
      console.error('[PlayerBrowser] Failed to load teams from API:', error);
    }

    // Keep default option if API fails
    console.log('[PlayerBrowser] Could not load teams - keeping default');
  }

  /**
   * Open the player browser in a separate window
   * @param {string} mode - Optional mode: 'roster' or 'draft' (default: 'roster')
   */
  async function openPlayerBrowser(mode) {
    console.log('[PlayerBrowser] Opening browser in separate window, mode:', mode || 'roster');

    try {
      if (window.electronAPI && window.electronAPI.window && window.electronAPI.window.openDatabase) {
        const result = await window.electronAPI.window.openDatabase(mode || 'roster');
        console.log('[PlayerBrowser] Open database window result:', result);
      } else {
        console.error('[PlayerBrowser] window.openDatabase API not available');
        alert('Database browser window not available. Please reload the application.');
      }
    } catch (error) {
      console.error('[PlayerBrowser] Failed to open database window:', error);
      alert('Failed to open database window: ' + error.message);
    }
  }

  /**
   * Ensure filter dropdowns are populated
   */
  function ensureFiltersPopulated() {
    // Check if position filter needs population
    var positionSelect = document.getElementById('playerBrowserPositionFilter');
    if (positionSelect && positionSelect.options.length <= 1) {
      console.log('[PlayerBrowser] Position filter empty, populating...');
      loadPositionFilter();
    }

    // Check if college filter needs population
    var collegeSelect = document.getElementById('playerBrowserCollegeFilter');
    if (collegeSelect && collegeSelect.options.length <= 1) {
      console.log('[PlayerBrowser] College filter empty, populating...');
      loadCollegeFilter();
    }
  }

  /**
   * Close the player browser modal
   */
  function closePlayerBrowser() {
    const modal = document.getElementById('playerBrowserModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Restore focus to the active editor panel (grid or input).
   * This is a universal fallback for when player browser is not open.
   * Uses the global restoreEditorFocus function when available.
   */
  function restoreFocusToActivePanel() {
    // Use global function if available (set up by app.js)
    if (window.restoreEditorFocus) {
      window.restoreEditorFocus();
      return;
    }

    // Fallback implementation
    const focusElement = () => {
      const activePanel = document.querySelector('.tab-content.active, .editor-panel:not([style*="display: none"])');
      if (activePanel) {
        const focusTarget = activePanel.querySelector('.ag-root-wrapper, input:not([type="hidden"]):not([disabled])');
        if (focusTarget) {
          // Ensure AG-Grid wrapper is focusable
          if (focusTarget.classList.contains('ag-root-wrapper')) {
            focusTarget.setAttribute('tabindex', '0');
          }
          focusTarget.focus();
          console.log('[PlayerBrowser] Restored focus to active panel element');
        }
      }
    };

    // Use Electron IPC to focus the window at OS level (critical for Windows)
    if (window.electronAPI && window.electronAPI.window && window.electronAPI.window.focus) {
      window.electronAPI.window.focus().then(() => {
        setTimeout(focusElement, 50);
      }).catch(err => {
        console.error('[PlayerBrowser] IPC window focus failed:', err);
        setTimeout(focusElement, 50);
      });
    } else {
      window.focus();
      setTimeout(focusElement, 50);
    }
  }

  /**
   * Restore focus to the player browser search input.
   * This should be called after any operation that steals focus (dialogs, modals, etc.)
   * IMPORTANT: This is the centralized focus restoration function for the player browser.
   * Uses Electron IPC to restore OS-level window focus before focusing the DOM element.
   * Falls back to restoring focus to the active editor panel if player browser is not open.
   */
  function restoreFocusToSearch() {
    // Only restore focus if player browser is visible AND no overlay modals are visible
    const browserModal = document.getElementById('playerBrowserModal');
    const playerCardModal = document.getElementById('dbPlayerCardModal');
    const dbManagementModal = document.getElementById('dbManagementModal');

    if (!browserModal || browserModal.style.display === 'none' || browserModal.style.display === '') {
      // Browser not open - restore focus to active editor panel instead
      restoreFocusToActivePanel();
      return;
    }

    if (playerCardModal && playerCardModal.style.display !== 'none' && playerCardModal.style.display !== '') {
      return; // Player card is open, don't steal focus from it
    }

    if (dbManagementModal && dbManagementModal.style.display !== 'none' && dbManagementModal.style.display !== '') {
      return; // Database management modal is open, don't steal focus from it
    }

    // Use IPC to restore OS-level window focus (required after native dialogs on Windows)
    // This calls BrowserWindow.focus() and webContents.focus() from main process
    if (window.electronAPI && window.electronAPI.window && window.electronAPI.window.focus) {
      window.electronAPI.window.focus().then(function() {
        focusSearchInput();
      }).catch(function(err) {
        console.error('[PlayerBrowser] IPC window focus failed:', err);
        focusSearchInput();
      });
    } else {
      focusSearchInput();
    }
  }

  /**
   * Focus the search input element.
   * SIMPLIFIED: Removed aggressive focus with multiple attempts as it was causing
   * focus to be stolen from other inputs when user clicked elsewhere.
   */
  function focusSearchInput() {
    // Check if we should even try to focus
    const browserModal = document.getElementById('playerBrowserModal');
    const playerCardModal = document.getElementById('dbPlayerCardModal');
    const dbManagementModal = document.getElementById('dbManagementModal');

    // If browser is closed, don't focus
    if (!browserModal || browserModal.style.display === 'none' || browserModal.style.display === '') {
      return;
    }
    // If player card is open, don't steal focus
    if (playerCardModal && playerCardModal.style.display !== 'none' && playerCardModal.style.display !== '') {
      return;
    }
    // If db management is open, don't steal focus
    if (dbManagementModal && dbManagementModal.style.display !== 'none' && dbManagementModal.style.display !== '') {
      return;
    }

    // Simple focus with single attempt
    setTimeout(function() {
      const input = document.getElementById('playerBrowserSearch');
      if (input) {
        input.focus();
      }
    }, 50);
  }

  /**
   * Perform search with current filters
   */
  async function performSearch() {
    if (isLoading) return;

    const searchInput = document.getElementById('playerBrowserSearch');
    const query = searchInput ? searchInput.value.trim() : '';

    // Get filter values
    const positionFilter = document.getElementById('playerBrowserPositionFilter');
    const draftYearFromInput = document.getElementById('playerBrowserDraftYearFrom');
    const draftYearToInput = document.getElementById('playerBrowserDraftYearTo');
    const collegeFilterInput = document.getElementById('playerBrowserCollegeFilter');
    const teamFilterInput = document.getElementById('playerBrowserTeamFilter');
    const hofFilterInput = document.getElementById('playerBrowserHofFilter');
    const emptyFilterSelect = document.getElementById('playerBrowserEmptyFilter');

    const position = positionFilter ? positionFilter.value : '';
    const draftYearFrom = draftYearFromInput && draftYearFromInput.value ? parseInt(draftYearFromInput.value) : undefined;
    const draftYearTo = draftYearToInput && draftYearToInput.value ? parseInt(draftYearToInput.value) : undefined;
    const collegeFilter = collegeFilterInput ? collegeFilterInput.value : '';
    const teamFilter = teamFilterInput ? teamFilterInput.value : '';
    const hofFilter = hofFilterInput ? hofFilterInput.value : '';
    const emptyFilter = emptyFilterSelect ? emptyFilterSelect.value : '';

    isLoading = true;
    showLoading(true);

    try {
      let result;

      if (query.length > 0) {
        // Search by name
        result = await window.electronAPI.database.searchPlayers(query, {
          limit: 500,
          position: position || undefined,
          draftYearFrom: draftYearFrom,
          draftYearTo: draftYearTo,
          team: teamFilter || undefined
        });

        if (result.success) {
          currentResults = result.players;
        } else {
          throw new Error(result.error);
        }
      } else {
        // Get all players with server-side filtering
        result = await window.electronAPI.database.getAllPlayers({
          offset: 0,
          limit: 30000, // High limit to get all filtered results
          position: position || undefined,
          draftYearFrom: draftYearFrom,
          draftYearTo: draftYearTo,
          team: teamFilter || undefined
        });

        if (result.success) {
          currentResults = result.players;
        } else {
          throw new Error(result.error);
        }
      }

      // Filter out placeholder entries (blank names, position+jersey patterns like "FS #26")
      const positionAbbreviations = new Set([
        'QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
        'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P', 'LS',
        'OL', 'DL', 'LB', 'DB', 'EDGE', 'LEDG', 'REDG', 'SAM', 'MIKE', 'WILL'
      ]);
      currentResults = currentResults.filter(player => {
        const fn = (player.firstName || '').trim().toUpperCase();
        const ln = (player.lastName || '').trim();
        // Both empty = placeholder
        if (!fn && !ln) return false;
        // Last name is just a number or starts with # = placeholder
        if (/^#?\d+$/.test(ln)) return false;
        // First name is a position abbreviation AND last name is empty or number = placeholder
        if (positionAbbreviations.has(fn) && (!ln || /^#?\d+$/.test(ln))) return false;
        return true;
      });

      // Apply client-side college filter (exact match from dropdown)
      if (collegeFilter) {
        currentResults = currentResults.filter(player => {
          return player.college === collegeFilter;
        });
      }

      // Apply client-side HOF filter
      if (hofFilter === 'hof') {
        currentResults = currentResults.filter(player => {
          return player.isHof === true;
        });
      } else if (hofFilter === 'non-hof') {
        currentResults = currentResults.filter(player => {
          return player.isHof !== true;
        });
      }

      // Apply client-side empty field filter
      if (emptyFilter === 'position') {
        currentResults = currentResults.filter(player => {
          return !player.position || player.position === '' || player.position === '-';
        });
      } else if (emptyFilter === 'college') {
        currentResults = currentResults.filter(player => {
          return !player.college || player.college === '' || player.college === '-';
        });
      } else if (emptyFilter === 'height') {
        currentResults = currentResults.filter(player => {
          return !player.height || player.height === 0 || player.height === '';
        });
      } else if (emptyFilter === 'weight') {
        currentResults = currentResults.filter(player => {
          return !player.weight || player.weight === 0 || player.weight === '';
        });
      } else if (emptyFilter === 'draftClass') {
        currentResults = currentResults.filter(player => {
          return !player.draftClass || player.draftClass === 0 || player.draftClass === '';
        });
      }

      totalResults = currentResults.length;
      displayResults();

    } catch (error) {
      console.error('[PlayerBrowser] Search failed:', error);
      showError('Failed to search players: ' + error.message);
    } finally {
      isLoading = false;
      showLoading(false);
    }
  }

  /**
   * Display search results
   */
  function displayResults() {
    const container = document.getElementById('playerBrowserResults');
    if (!container) return;

    // Calculate pagination
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalResults);
    const pageResults = currentResults.slice(startIdx, endIdx);

    if (pageResults.length === 0) {
      container.innerHTML =
        '<div class="player-browser-empty">' +
        '<p>No players found</p>' +
        '<p class="player-browser-empty-hint">Try a different search or adjust filters</p>' +
        '</div>';
      updatePagination(0, 0, 0);
      return;
    }

    // Build results HTML
    let html = '';
    let playersWithMissingId = 0;
    pageResults.forEach((player, index) => {
      // Validate internalId at render time
      const playerId = player.internalId;
      if (playerId === undefined || playerId === null || isNaN(Number(playerId))) {
        console.error('[PlayerBrowser] WARNING: Player at index', index, 'has invalid internalId:', playerId, 'Name:', player.firstName, player.lastName);
        playersWithMissingId++;
      }

      const fullName = (player.firstName || '') + ' ' + (player.lastName || '');
      const draftInfo = player.draftClass ? player.draftClass + ' Rd ' + (player.draftRound || '?') : 'N/A';
      const careerSpan = player.careerFrom && player.careerTo ? player.careerFrom + '-' + player.careerTo : (player.careerFrom || 'N/A');
      const hofBadge = player.isHof ? '<span class="player-hof-badge">HOF</span>' : '';

      const isCustom = player.isCustom ? 'true' : 'false';
      const isSelected = selectedPlayerIds.has(playerId);
      html +=
        '<div class="player-browser-row" data-internal-id="' + playerId + '" data-is-custom="' + isCustom + '">' +
        '<div class="player-browser-select"><input type="checkbox" class="player-select-checkbox" data-id="' + playerId + '"' + (isSelected ? ' checked' : '') + '></div>' +
        '<div class="player-browser-name">' + fullName + ' ' + hofBadge + '</div>' +
        '<div class="player-browser-position">' + (player.position || '-') + '</div>' +
        '<div class="player-browser-college">' + (player.college || '-') + '</div>' +
        '<div class="player-browser-draft">' + draftInfo + '</div>' +
        '<div class="player-browser-career">' + careerSpan + '</div>' +
        '<div class="player-browser-actions">' +
        '<button class="pb-btn pb-btn-view" onclick="window.viewDbPlayer(' + playerId + ', ' + isCustom + ')" title="View/Edit">View</button>' +
        '<button class="pb-btn pb-btn-add" onclick="window.addToRoster(' + playerId + ', ' + isCustom + ')" title="Add to Roster">+Roster</button>' +
        '<button class="pb-btn pb-btn-add" onclick="window.addToDraft(' + playerId + ', ' + isCustom + ')" title="Add to Draft Class">+Draft</button>' +
        '</div>' +
        '</div>';
    });

    if (playersWithMissingId > 0) {
      console.error('[PlayerBrowser] CRITICAL:', playersWithMissingId, 'players have missing/invalid internalId values!');
    }

    container.innerHTML = html;
    updatePagination(startIdx + 1, endIdx, totalResults);
    updateSelectAllCheckbox();
    updateSelectionUI();
  }

  /**
   * Update the "select all" checkbox state based on current page selection
   */
  function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllPlayers');
    if (!selectAllCheckbox) return;

    const checkboxes = document.querySelectorAll('.player-select-checkbox');
    if (checkboxes.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      return;
    }

    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    if (checkedCount === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === checkboxes.length) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }
  }

  /**
   * Update the selection UI (count display and batch buttons visibility)
   */
  function updateSelectionUI() {
    const countSpan = document.getElementById('selectedPlayerCount');
    const rosterBtn = document.getElementById('addSelectedToRosterBtn');
    const draftBtn = document.getElementById('addSelectedToDraftBtn');

    const count = selectedPlayerIds.size;

    if (countSpan) {
      if (count > 0) {
        countSpan.textContent = count + ' selected';
        countSpan.style.display = 'inline';
      } else {
        countSpan.style.display = 'none';
      }
    }

    if (rosterBtn) {
      rosterBtn.style.display = count > 0 ? 'inline-block' : 'none';
    }

    if (draftBtn) {
      draftBtn.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }

  /**
   * Handle individual checkbox change
   */
  function handleCheckboxChange(checkbox) {
    const playerId = parseInt(checkbox.dataset.id, 10);
    if (checkbox.checked) {
      selectedPlayerIds.add(playerId);
    } else {
      selectedPlayerIds.delete(playerId);
    }
    updateSelectAllCheckbox();
    updateSelectionUI();
  }

  /**
   * Handle "select all" checkbox change
   */
  function handleSelectAllChange(checked) {
    const checkboxes = document.querySelectorAll('.player-select-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = checked;
      const playerId = parseInt(cb.dataset.id, 10);
      if (checked) {
        selectedPlayerIds.add(playerId);
      } else {
        selectedPlayerIds.delete(playerId);
      }
    });
    updateSelectionUI();
  }

  /**
   * Clear all selections
   */
  function clearSelection() {
    selectedPlayerIds.clear();
    const checkboxes = document.querySelectorAll('.player-select-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    updateSelectAllCheckbox();
    updateSelectionUI();
  }

  /**
   * Add selected players to roster (batch operation)
   */
  async function addSelectedToRoster() {
    if (selectedPlayerIds.size === 0) {
      alert('No players selected');
      return;
    }

    // Check if roster is loaded
    if (!window.app || !window.app.agGrid) {
      alert('Please load or create a roster first.\n\nUse "Open Roster" to load an existing file, or "New Roster" to start fresh.');
      return;
    }

    const count = selectedPlayerIds.size;
    const confirmed = confirm('Add ' + count + ' selected player(s) to roster as Free Agents?\n\n(Uses each player\'s default/best year)');
    if (!confirmed) return;

    // Default to Free Agent team
    const teamId = 1009;

    const playerIds = Array.from(selectedPlayerIds);
    let successCount = 0;
    let errorCount = 0;

    // Pre-collect available GENERIC Free Agent slot indices (from bottom of list)
    // Only collect slots with low PID (generic template players, not real players just added)
    const availableSlots = [];
    for (let i = window.app.players.length - 1; i >= 0; i--) {
      const p = window.app.players[i];
      const pid = p.PSXP || 0;
      // Generic Free Agent: team 1009 AND low PID (template filler)
      if (p.TGID === 1009 && pid < 100) {
        availableSlots.push(i);
      }
    }

    // Fallback: if not enough generic slots, also include low-OVR Free Agents
    if (availableSlots.length < playerIds.length) {
      for (let i = window.app.players.length - 1; i >= 0; i--) {
        const p = window.app.players[i];
        if (p.TGID === 1009 && (p.POVR || 99) < 50 && !availableSlots.includes(i)) {
          availableSlots.push(i);
        }
      }
    }

    if (availableSlots.length < playerIds.length) {
      alert(`Not enough generic Free Agent slots available.\nNeed: ${playerIds.length}, Available: ${availableSlots.length}\n\nPlease remove some Free Agents first.`);
      return;
    }

    // Show progress
    console.log('[PlayerBrowser] Adding', playerIds.length, 'players to roster, replacing', playerIds.length, 'bottom Free Agents...');

    for (const internalId of playerIds) {
      try {
        // Get available years for the player
        const yearsResult = await window.electronAPI.database.getPlayerAvailableYears(internalId);
        if (!yearsResult.success) {
          console.error('[PlayerBrowser] Failed to get years for player', internalId);
          errorCount++;
          continue;
        }

        const year = yearsResult.defaultYear;

        // Get player data formatted for roster
        const result = await window.electronAPI.database.getPlayerForRoster(internalId, year);
        if (!result.success) {
          console.error('[PlayerBrowser] Failed to get player data:', internalId, result.error);
          errorCount++;
          continue;
        }

        const playerData = result.player;
        playerData.TGID = teamId;

        // Get the next available Free Agent slot (bottom-most first)
        const replaceIndex = availableSlots.shift();
        const replacePlayer = window.app.players[replaceIndex];

        // Keep the slot PGID
        playerData.PGID = replacePlayer.PGID;
        playerData.POID = replacePlayer.POID || replacePlayer.PGID;

        console.log('[PlayerBrowser] Batch: Replacing slot', replaceIndex, 'PGID:', playerData.PGID, 'with', playerData.PFNA, playerData.PLNA);

        // Replace in array
        window.app.players[replaceIndex] = playerData;

        // Update grid
        if (window.app.agGrid) {
          window.app.agGrid.applyTransaction({
            remove: [replacePlayer],
            add: [playerData]
          });
        }

        successCount++;
      } catch (error) {
        console.error('[PlayerBrowser] Error adding player', internalId, ':', error);
        errorCount++;
      }
    }

    // Update filtered players
    if (window.app.filteredPlayers) {
      window.app.filteredPlayers = window.app.players.slice();
    }

    // Mark roster as modified
    if (window.app.rosterModified !== undefined) {
      window.app.rosterModified = true;
    }

    // Update stats
    if (window.app.updateStats) {
      window.app.updateStats();
    }

    // Clear selection
    clearSelection();

    // Show result using non-blocking toast for success, alert for errors
    if (errorCount > 0) {
      alert('Added ' + successCount + ' player(s) to roster.\n' + errorCount + ' player(s) failed to add.');
    } else if (window.showToast) {
      window.showToast('Added ' + successCount + ' player(s) to roster', 'success');
    }

    // Restore focus to editor
    if (window.restoreEditorFocus) {
      window.restoreEditorFocus();
    } else {
      restoreFocusToSearch();
    }
  }

  /**
   * Add selected players to draft class (batch operation)
   */
  async function addSelectedToDraft() {
    if (selectedPlayerIds.size === 0) {
      alert('No players selected');
      return;
    }

    // Check if draft class is loaded
    if (!window.app || (!window.app.draftAgGrid && !window.app.draftGrid)) {
      alert('Please load or create a draft class first.\n\nUse "Open Draft Class" to load an existing file, or "New Draft Class" to start fresh.');
      return;
    }

    const count = selectedPlayerIds.size;
    const confirmed = confirm('Add ' + count + ' selected player(s) to draft class?\n\n(Uses each player\'s default/draft year)');
    if (!confirmed) return;

    const playerIds = Array.from(selectedPlayerIds);
    let successCount = 0;
    let errorCount = 0;

    // Get current draft data
    let draftData = [];
    const isAgGrid = !!window.app.draftAgGrid;

    if (isAgGrid) {
      window.app.draftAgGrid.forEachNode(node => {
        if (node.data) draftData.push({ ...node.data });
      });
    } else if (window.app.draftGrid && window.app.draftGrid.getSourceData) {
      draftData = window.app.draftGrid.getSourceData().slice();
    }

    console.log('[PlayerBrowser] Adding', playerIds.length, 'players to draft class...');

    for (const internalId of playerIds) {
      try {
        // Get available years for the player
        const yearsResult = await window.electronAPI.database.getPlayerAvailableYears(internalId);
        if (!yearsResult.success) {
          console.error('[PlayerBrowser] Failed to get years for player', internalId);
          errorCount++;
          continue;
        }

        const year = yearsResult.defaultYear;

        // Get player data formatted for draft
        const result = await window.electronAPI.database.getPlayerForDraft(internalId, year);
        if (!result.success) {
          console.error('[PlayerBrowser] Failed to get player data:', internalId, result.error);
          errorCount++;
          continue;
        }

        const prospectData = result.prospect;

        // Add at end of draft class
        const targetSlot = draftData.length;
        const roundNum = Math.floor(targetSlot / 32) + 1;

        const newRow = {
          draftPosition: targetSlot,
          round: roundNum <= 7 ? roundNum : 8,
          playerPic: prospectData.playerPic || 'Generic Face',
          lastName: prospectData.lastName,
          firstName: prospectData.firstName,
          position: prospectData.positionName || prospectData.position,
          archetype: prospectData.archetypeName || prospectData.archetype || 0,
          college: prospectData.collegeName || prospectData.college || 0,
          homeState: prospectData.homeStateName || prospectData.homeState || '',
          homeTown: prospectData.homeTown || '',
          age: prospectData.age,
          PID: prospectData.PID,
          PEPS: prospectData.PEPS,
          race: prospectData.race,
          skinTone: prospectData.skinTone,
          devTrait: prospectData.devTrait !== undefined ? prospectData.devTrait : 0,
          overall: prospectData.overall || 70,
          speed: prospectData.speed || 70,
          acceleration: prospectData.acceleration || 70,
          strength: prospectData.strength || 70,
          agility: prospectData.agility || 70,
          awareness: prospectData.awareness || 70,
          jumping: prospectData.jumping || 70,
          stamina: prospectData.stamina || 70,
          changeOfDirection: prospectData.changeOfDirection || 70,
          injury: prospectData.injury || 70,
          carrying: prospectData.carrying || 70,
          catching: prospectData.catching || 70,
          throwPower: prospectData.throwPower || 70,
          throwAccuracyShort: prospectData.throwAccuracyShort || 70,
          throwAccuracyMid: prospectData.throwAccuracyMid || 70,
          throwAccuracyDeep: prospectData.throwAccuracyDeep || 70,
          tackle: prospectData.tackle || 70,
          hitPower: prospectData.hitPower || 70,
          blockShedding: prospectData.blockShedding || 70,
          manCoverage: prospectData.manCoverage || 70,
          zoneCoverage: prospectData.zoneCoverage || 70,
          kickPower: prospectData.kickPower || 70,
          kickAccuracy: prospectData.kickAccuracy || 70,
          heightInches: prospectData.heightInches || 72,
          weight: prospectData.weight || 200,
          PGHE: prospectData.PGHE,
          visuals: prospectData.visuals,
          commentaryId: prospectData.commentaryId || 0
        };

        draftData.push(newRow);
        successCount++;
      } catch (error) {
        console.error('[PlayerBrowser] Error adding player to draft', internalId, ':', error);
        errorCount++;
      }
    }

    // Renumber draft positions
    for (let i = 0; i < draftData.length; i++) {
      draftData[i].draftPosition = i;
      draftData[i].round = i < 224 ? Math.floor(i / 32) + 1 : 8;
    }

    // Reload grid with new data
    if (isAgGrid) {
      window.app.draftAgGrid.setGridOption('rowData', draftData);
    } else if (window.app.draftGrid && window.app.draftGrid.loadData) {
      window.app.draftGrid.loadData(draftData);
    }

    // Update currentDraftClass.prospects if it exists
    if (window.app.currentDraftClass && window.app.currentDraftClass.prospects) {
      window.app.currentDraftClass.prospects = draftData;
    }

    // Update draft file stats
    if (window.app.currentDraftClass) {
      const statsEl = document.getElementById('draft-file-stats');
      if (statsEl) {
        const count = draftData.length;
        statsEl.textContent = count + ' prospects | Year: ' + window.app.currentDraftClass.header.year;
      }
    }

    // Clear selection
    clearSelection();

    // Show result using non-blocking toast for success, alert for errors
    if (errorCount > 0) {
      alert('Added ' + successCount + ' player(s) to draft class.\n' + errorCount + ' player(s) failed to add.');
    } else if (window.showToast) {
      window.showToast('Added ' + successCount + ' player(s) to draft class', 'success');
    }

    // Restore focus to editor
    if (window.restoreEditorFocus) {
      window.restoreEditorFocus();
    } else {
      restoreFocusToSearch();
    }
  }

  /**
   * Update pagination display
   */
  function updatePagination(start, end, total) {
    const pageInfo = document.getElementById('playerBrowserPageInfo');
    if (pageInfo) {
      if (total === 0) {
        pageInfo.textContent = 'No results';
      } else {
        pageInfo.textContent = 'Showing ' + start + '-' + end + ' of ' + total;
      }
    }

    const prevBtn = document.getElementById('playerBrowserPrevPage');
    const nextBtn = document.getElementById('playerBrowserNextPage');

    if (prevBtn) {
      prevBtn.disabled = currentPage <= 1;
    }

    if (nextBtn) {
      const maxPage = Math.ceil(total / pageSize);
      nextBtn.disabled = currentPage >= maxPage;
    }
  }

  /**
   * Show/hide loading indicator
   */
  function showLoading(show) {
    const container = document.getElementById('playerBrowserResults');
    if (!container) return;

    if (show) {
      container.innerHTML = '<div class="player-browser-loading">Searching...</div>';
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    const container = document.getElementById('playerBrowserResults');
    if (!container) return;

    container.innerHTML =
      '<div class="player-browser-error">' +
      '<p>Error</p>' +
      '<p class="player-browser-error-msg">' + message + '</p>' +
      '</div>';
  }

  // Global action handlers
  window.viewDbPlayer = function(internalId, isCustom) {
    console.log('[PlayerBrowser] View player:', internalId, 'isCustom:', isCustom);
    if (window.openDbPlayerCard) {
      window.openDbPlayerCard(internalId, isCustom === true);
    } else {
      alert('Player card not available');
      restoreFocusToSearch();
    }
  };

  // Pending add data (used by modals)
  let pendingRosterAdd = null;
  let pendingDraftAdd = null;
  let pendingReplaceInfo = null; // Info about player being replaced (for in-place replacement)

  // Initialize Add to Roster modal handlers
  function initAddToRosterModal() {
    const modal = document.getElementById('addToRosterModal');
    const closeBtn = document.getElementById('closeAddToRoster');
    const cancelBtn = document.getElementById('addToRosterCancelBtn');
    const confirmBtn = document.getElementById('addToRosterConfirmBtn');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeAddToRosterModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeAddToRosterModal);
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', confirmAddToRoster);
    }
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) closeAddToRosterModal();
      });
    }
  }

  function closeAddToRosterModal() {
    const modal = document.getElementById('addToRosterModal');
    if (modal) modal.style.display = 'none';
    pendingRosterAdd = null;
    pendingReplaceInfo = null; // Clear replacement info too
    restoreFocusToSearch(); // This now handles both player browser and active panel fallback
  }

  async function confirmAddToRoster() {
    if (!pendingRosterAdd) return;

    const { internalId, firstName, lastName, position, playerName, displayedPid, isCustomPlayer } = pendingRosterAdd;
    const teamSelect = document.getElementById('addToRosterTeam');
    const yearSelect = document.getElementById('addToRosterYear');

    const selectedTeamId = parseInt(teamSelect.value, 10);
    const selectedYear = parseInt(yearSelect.value, 10);
    const selectedTeamName = teamSelect.options[teamSelect.selectedIndex].text;

    try {
      // Get player data formatted for roster
      const result = await window.electronAPI.database.getPlayerForRoster(internalId, selectedYear);
      if (!result.success) {
        alert('Failed to get player data: ' + result.error);
        closeAddToRosterModal();
        return;
      }

      const playerData = result.player;

      // CRITICAL: If a PID was passed from the database browser, use it directly
      // This ensures the PID shown in the browser is the one that ends up on the roster
      if (displayedPid && displayedPid > 0) {
        console.log(`[PlayerBrowser] Using PID from database browser: ${displayedPid} (overriding ${playerData.PSXP})`);
        playerData.PSXP = displayedPid;
      }

      // DEBUG: Check ALL ratings in received player data
      const allKeys = Object.keys(playerData);
      const ratingKeys = allKeys.filter(k => k.length === 4 && (k.startsWith('P') || k.startsWith('S')));
      console.log(`[PlayerBrowser] RECEIVED playerData - ${playerData.PFNA} ${playerData.PLNA}`);
      console.log(`[PlayerBrowser] RECEIVED playerData - Total keys: ${allKeys.length}, Rating keys (${ratingKeys.length})`);
      console.log(`[PlayerBrowser] RECEIVED playerData - PPBK=${playerData.PPBK}, PRBK=${playerData.PRBK}, POVR=${playerData.POVR}`);

      // CRITICAL: Recalculate POVR from ratings using calculateOVRForArchetypes
      // This is the SAME method used by roster editor - tests ALL archetypes, picks BEST
      // Without this, stored POVR might be stale/incorrect, causing OVR adjustment to fail
      try {
        const positionMap = {
          0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
          8: 'RG', 9: 'RT', 10: 'LEDG', 11: 'REDG', 12: 'DT', 13: 'SAM', 14: 'MIKE',
          15: 'WILL', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
        };
        const posName = positionMap[playerData.PPOS] || 'QB';

        // Use calculateOVRForArchetypes - SAME as roster editor
        const archetypeResults = await window.electronAPI.rating.calculateOVRForArchetypes(playerData, posName);

        if (archetypeResults && archetypeResults.length > 0) {
          // First result is the BEST archetype (sorted by OVR descending)
          const bestArchetype = archetypeResults[0];
          const calculatedOVR = bestArchetype.ovr;

          if (calculatedOVR && calculatedOVR !== playerData.POVR) {
            console.log(`[PlayerBrowser] Recalculated POVR: stored=${playerData.POVR}, calculated=${calculatedOVR} (best archetype: ${bestArchetype.name}) - UPDATING`);
            playerData.POVR = calculatedOVR;
            // Also update archetype to the best one
            playerData.PLTY = bestArchetype.id;
          }
        }
      } catch (err) {
        console.warn('[PlayerBrowser] Could not recalculate POVR:', err.message);
      }

      // Set the selected team
      playerData.TGID = selectedTeamId;

      // CRITICAL: Handle replacement vs normal add differently
      // If we're replacing a player (roster was full), do IN-PLACE replacement
      // to avoid index shifting which causes wrong data to be written to wrong slots
      if (pendingReplaceInfo) {
        const { index, oldPlayer } = pendingReplaceInfo;

        // CRITICAL: Copy PGID from old player - this identifies the slot to Madden
        // Without this, the new player gets the old player's portrait/data
        if (oldPlayer.PGID !== undefined) {
          playerData.PGID = oldPlayer.PGID;
          console.log('[PlayerBrowser] Copied PGID from replaced player:', oldPlayer.PGID);
        }
        if (oldPlayer.POID !== undefined) {
          playerData.POID = oldPlayer.POID;
        }

        // Replace in app.players array AT THE SAME INDEX (no splice, no push)
        if (window.app.players && index >= 0 && index < window.app.players.length) {
          window.app.players[index] = playerData;
          window.app.filteredPlayers = window.app.players.slice();
          console.log('[PlayerBrowser] Replaced player at index', index);
        }

        // Update grid - remove old player and add new one
        if (window.app.agGrid) {
          window.app.agGrid.applyTransaction({
            remove: [oldPlayer],
            add: [playerData]
          });
        }

        // Clear replacement info
        pendingReplaceInfo = null;
      } else {
        // Normal add - ALWAYS replace a bottom Free Agent slot (roster has fixed capacity)
        if (window.app.players) {
          // Find bottom-most GENERIC Free Agent to replace (low PID = template filler)
          let replaceIndex = -1;
          let replacePlayer = null;

          // First pass: look for generic Free Agents (low PID)
          for (let i = window.app.players.length - 1; i >= 0; i--) {
            const p = window.app.players[i];
            const pid = p.PSXP || 0;
            if (p.TGID === 1009 && pid < 100) {
              replaceIndex = i;
              replacePlayer = p;
              break;
            }
          }

          // Fallback: if no generic Free Agents, find any Free Agent with low overall
          if (replaceIndex === -1) {
            for (let i = window.app.players.length - 1; i >= 0; i--) {
              const p = window.app.players[i];
              if (p.TGID === 1009 && (p.POVR || 99) < 50) {
                replaceIndex = i;
                replacePlayer = p;
                break;
              }
            }
          }

          if (replaceIndex === -1) {
            console.error('[PlayerBrowser] No generic Free Agent slot available!');
            alert('No generic Free Agent slot available. Remove a Free Agent first.');
            document.getElementById('addToRosterModal').style.display = 'none';
            return;
          }

          // Keep the slot PGID
          playerData.PGID = replacePlayer.PGID;
          playerData.POID = replacePlayer.POID || replacePlayer.PGID;
          console.log('[PlayerBrowser] Replacing bottom FA at index:', replaceIndex, 'PGID:', playerData.PGID);

          // Replace in array at same index
          window.app.players[replaceIndex] = playerData;
          window.app.filteredPlayers = window.app.players.slice();

          // Update grid
          if (window.app.agGrid) {
            window.app.agGrid.applyTransaction({
              remove: [replacePlayer],
              add: [playerData]
            });
          }
        }
      }

      // Mark roster as modified
      if (window.app.rosterModified !== undefined) {
        window.app.rosterModified = true;
      }

      // Track the player to prevent duplicates
      if (window.electronAPI.editorTracking) {
        await window.electronAPI.editorTracking.trackPlayer({
          firstName: playerData.PFNA || firstName,
          lastName: playerData.PLNA || lastName,
          position: playerData.position || position,
          internalId: internalId,
          year: selectedYear,
          povr: playerData.POVR || 0
        }, 'roster');
      }

      // Update stats display
      if (window.app.updateStats) {
        window.app.updateStats();
      }

      // Pre-load portrait for the new player so it displays immediately
      // Portrait: ALWAYS use PID (PAM only affects in-game face model)
      const pid = playerData.PSXP;
      const hasValidPid = pid && pid > 0;
      const cacheKey = hasValidPid ? `pid_${pid}` : null;

      console.log('[PlayerBrowser] Portrait pre-load: PID=' + pid + ', cacheKey=' + cacheKey);

      if (cacheKey && !window.app.portraitCache.has(cacheKey)) {
        // Custom portraits (PID >= 12000) use getImageDataByPid directly
        const CUSTOM_PORTRAIT_PID_START = 12000;
        const isCustomPortrait = parseInt(pid) >= CUSTOM_PORTRAIT_PID_START;
        console.log('[PlayerBrowser] Pre-loading portrait for PID:', pid, isCustomPortrait ? '(custom)' : '(standard)');

        if (isCustomPortrait && window.electronAPI?.portrait?.getImageDataByPid) {
          // Custom portrait - use getImageDataByPid to get the actual image
          window.electronAPI.portrait.getImageDataByPid(pid).then(imageData => {
            if (imageData && imageData.length > 0) {
              window.app.portraitCache.set(cacheKey, imageData);
              console.log('[PlayerBrowser] Custom portrait cached:', cacheKey, 'data length:', imageData.length);
              if (window.app.agGrid) {
                window.app.agGrid.redrawRows();
              }
            }
          }).catch(err => console.error('[PlayerBrowser] Error loading custom portrait:', err));
        } else if (window.electronAPI?.portrait?.getByPID) {
          // Standard portrait - use getByPID (works for real players and generic faces)
          window.electronAPI.portrait.getByPID(pid).then(imageData => {
            if (imageData && imageData.length > 0) {
              window.app.portraitCache.set(cacheKey, imageData);
              console.log('[PlayerBrowser] Portrait cached:', cacheKey, 'data length:', imageData.length);
              if (window.app.agGrid) {
                window.app.agGrid.redrawRows();
              }
            }
          }).catch(err => console.error('[PlayerBrowser] Error loading portrait:', err));
        }
      }

      console.log('[PlayerBrowser] Added player to roster:', playerName, selectedYear, 'Team:', selectedTeamName);

      // Close modal and show success using non-blocking toast
      closeAddToRosterModal();

      // Use non-blocking toast notification instead of alert() to prevent focus loss
      if (window.showToast) {
        window.showToast('Added ' + playerName + ' (' + selectedYear + ') to ' + selectedTeamName, 'success');
      }

      // Restore focus to editor using the global focus restoration
      if (window.restoreEditorFocus) {
        window.restoreEditorFocus();
      } else {
        restoreFocusToSearch();
      }

    } catch (error) {
      console.error('[PlayerBrowser] Error adding to roster:', error);
      // Keep alert for errors - user needs to see these
      alert('Failed to add player to roster: ' + error.message);
      closeAddToRosterModal();
      if (window.restoreEditorFocus) {
        window.restoreEditorFocus();
      } else {
        restoreFocusToSearch();
      }
    }
  }

  // Initialize Add to Draft modal handlers
  function initAddToDraftModal() {
    const modal = document.getElementById('addToDraftModal');
    const closeBtn = document.getElementById('closeAddToDraft');
    const cancelBtn = document.getElementById('addToDraftCancelBtn');
    const confirmBtn = document.getElementById('addToDraftConfirmBtn');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeAddToDraftModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeAddToDraftModal);
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', confirmAddToDraft);
    }
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) closeAddToDraftModal();
      });
    }
  }

  function closeAddToDraftModal() {
    const modal = document.getElementById('addToDraftModal');
    if (modal) modal.style.display = 'none';
    pendingDraftAdd = null;
    restoreFocusToSearch(); // This now handles both player browser and active panel fallback
  }

  async function confirmAddToDraft() {
    if (!pendingDraftAdd) return;

    const { internalId, firstName, lastName, position, playerName } = pendingDraftAdd;
    const yearSelect = document.getElementById('addToDraftYear');
    const selectedYear = parseInt(yearSelect.value, 10);

    try {
      // Get player data formatted for draft class
      const result = await window.electronAPI.database.getPlayerForDraft(internalId, selectedYear);
      if (!result.success) {
        alert('Failed to get player data: ' + result.error);
        closeAddToDraftModal();
        return;
      }

      const prospectData = result.prospect;
      const suggestedSlot = result.suggestedSlot;
      const draftInfo = result.draftInfo;

      // Get current draft data - support both AG-Grid and Handsontable

      let draftData = [];

      const isAgGrid = !!window.app.draftAgGrid;

      

      if (isAgGrid) {

        // AG-Grid: collect data from all nodes

        window.app.draftAgGrid.forEachNode(node => {

          if (node.data) draftData.push({ ...node.data });

        });

      } else if (window.app.draftGrid && window.app.draftGrid.getSourceData) {

        // Handsontable fallback

        draftData = window.app.draftGrid.getSourceData();

      } else {

        alert('No draft class loaded. Please load or create a draft class first.');

        closeAddToDraftModal();

        return;

      }

      // ALWAYS add players at the END of the draft class
      // Don't use suggested slot - just append at the end
      let targetSlot = draftData.length;

      // Round display for logging (based on new position at end)
      const roundNum = Math.floor(targetSlot / 32) + 1;
      const pickInRound = (targetSlot % 32) + 1;
      const roundDisplay = roundNum <= 7 ? 'Round ' + roundNum + ' Pick ' + pickInRound : 'UDFA';

      // Debug log the incoming prospect data - use explicit strings so values are visible
      console.log(`[PlayerBrowser] prospectData from backend:`);
      console.log(`  Name: ${prospectData.firstName} ${prospectData.lastName}`);
      console.log(`  Position: ID=${prospectData.position}, Name="${prospectData.positionName}"`);
      console.log(`  Archetype: ID=${prospectData.archetype}, Name="${prospectData.archetypeName}"`);
      console.log(`  College: ID=${prospectData.college}, Name="${prospectData.collegeName}"`);
      console.log(`  HomeState: ID=${prospectData.homeState}, Name="${prospectData.homeStateName}"`);
      console.log(`  PID=${prospectData.PID}, PEPS="${prospectData.PEPS}"`);
      console.log(`  Race=${prospectData.race}, SkinTone=${prospectData.skinTone}, PlayerPic="${prospectData.playerPic}"`);
      console.log(`  Visuals:`, prospectData.visuals);

      // Build the row object matching draft grid columns
      // Use names from backend (fallback to IDs if names not available)
      // IMPORTANT: Use explicit empty string checks because '' is falsy but valid
      const getValueOrFallback = (name, id, defaultVal = '') => {
        // If we have a non-empty name string, use it
        if (name !== undefined && name !== null && name !== '') return name;
        // Otherwise use the ID (grid valueGetter will convert to display name)
        return id !== undefined && id !== null ? id : defaultVal;
      };

      const newRow = {
        draftPosition: targetSlot,
        round: roundNum <= 7 ? roundNum : 8,
        playerPic: prospectData.playerPic || 'Generic Face',
        lastName: prospectData.lastName,
        firstName: prospectData.firstName,
        position: getValueOrFallback(prospectData.positionName, prospectData.position, position),
        archetype: getValueOrFallback(prospectData.archetypeName, prospectData.archetype, 0),
        college: getValueOrFallback(prospectData.collegeName, prospectData.college, 0),
        homeState: getValueOrFallback(prospectData.homeStateName, prospectData.homeState, ''),
        homeTown: prospectData.homeTown || '',
        age: prospectData.age,
        PID: prospectData.PID,
        PEPS: prospectData.PEPS,
        // Race and skin tone for generic face assignment
        race: prospectData.race,
        skinTone: prospectData.skinTone,
        // devTrait: 0=Normal, 1=Star, 2=Superstar, 3=X-Factor (never use falsy check for 0)
        devTrait: prospectData.devTrait !== undefined && prospectData.devTrait !== null ? prospectData.devTrait : 0,

        // Ratings
        overall: prospectData.overall || 70,
        speed: prospectData.speed || 70,
        acceleration: prospectData.acceleration || 70,
        strength: prospectData.strength || 70,
        agility: prospectData.agility || 70,
        awareness: prospectData.awareness || 70,
        jumping: prospectData.jumping || 70,
        stamina: prospectData.stamina || 70,
        changeOfDirection: prospectData.changeOfDirection || 70,
        injury: prospectData.injury || 70,

        carrying: prospectData.carrying || 70,
        ballCarrierVision: prospectData.ballCarrierVision || 70,
        breakTackle: prospectData.breakTackle || 70,
        trucking: prospectData.trucking || 70,
        stiffArm: prospectData.stiffArm || 70,
        spinMove: prospectData.spinMove || 70,
        jukeMove: prospectData.jukeMove || 70,

        catching: prospectData.catching || 70,
        catchInTraffic: prospectData.catchInTraffic || 70,
        spectacularCatch: prospectData.spectacularCatch || 70,
        shortRouteRunning: prospectData.shortRouteRunning || 70,
        mediumRouteRunning: prospectData.mediumRouteRunning || 70,
        deepRouteRunning: prospectData.deepRouteRunning || 70,
        release: prospectData.release || 70,

        throwPower: prospectData.throwPower || 70,
        throwAccuracyShort: prospectData.throwAccuracyShort || 70,
        throwAccuracyMid: prospectData.throwAccuracyMid || 70,
        throwAccuracyDeep: prospectData.throwAccuracyDeep || 70,
        throwOnTheRun: prospectData.throwOnTheRun || 70,
        throwUnderPressure: prospectData.throwUnderPressure || 70,
        playAction: prospectData.playAction || 70,
        breakSack: prospectData.breakSack || 70,

        passBlock: prospectData.passBlock || 70,
        passBlockPower: prospectData.passBlockPower || 70,
        passBlockFinesse: prospectData.passBlockFinesse || 70,
        runBlock: prospectData.runBlock || 70,
        runBlockPower: prospectData.runBlockPower || 70,
        runBlockFinesse: prospectData.runBlockFinesse || 70,
        leadBlock: prospectData.leadBlock || 70,
        impactBlocking: prospectData.impactBlocking || 70,

        tackle: prospectData.tackle || 70,
        hitPower: prospectData.hitPower || 70,
        powerMoves: prospectData.powerMoves || 70,
        finesseMoves: prospectData.finesseMoves || 70,
        blockShedding: prospectData.blockShedding || 70,
        pursuit: prospectData.pursuit || 70,
        playRecognition: prospectData.playRecognition || 70,
        manCoverage: prospectData.manCoverage || 70,
        zoneCoverage: prospectData.zoneCoverage || 70,
        pressCoverage: prospectData.pressCoverage || 70,

        kickPower: prospectData.kickPower || 70,
        kickAccuracy: prospectData.kickAccuracy || 70,
        kickReturn: prospectData.kickReturn || 70,

        heightInches: prospectData.heightInches || 72,
        weight: prospectData.weight || 200,
        toughness: prospectData.toughness || 70,

        // Face data from database
        PGHE: prospectData.PGHE,
        visuals: prospectData.visuals,

        // Commentary ID for in-game announcer
        commentaryId: prospectData.commentaryId || 0
      };

      // Add to end of draft class (push instead of splice)
      draftData.push(newRow);

      // Renumber draft positions for all rows
      for (let i = 0; i < draftData.length; i++) {
        draftData[i].draftPosition = i;
        if (i < 224) {
          draftData[i].round = Math.floor(i / 32) + 1;
        } else {
          draftData[i].round = 8;
        }
      }

      // Reload grid with new data - support both AG-Grid and Handsontable

      if (isAgGrid) {

        window.app.draftAgGrid.setGridOption('rowData', draftData);

      } else if (window.app.draftGrid && window.app.draftGrid.loadData) {

        window.app.draftGrid.loadData(draftData);

      }

      // Update currentDraftClass.prospects if it exists
      if (window.app.currentDraftClass && window.app.currentDraftClass.prospects) {
        window.app.currentDraftClass.prospects = draftData;
      }

      // Preload the portrait for the new player so it shows immediately
      const newPid = prospectData.PID || 0;
      const newPeps = prospectData.PEPS || '';
      console.log(`[PlayerBrowser] Portrait preload: PID=${newPid}, PEPS="${newPeps}"`);
      if (newPid > 0) {
        const cacheKey = `pid_${newPid}`;
        if (!window.app.portraitCache.has(cacheKey)) {
          try {
            // Custom portraits (PID >= 12000) use getImageDataByPid directly
            const CUSTOM_PORTRAIT_PID_START = 12000;
            const isCustomPortrait = parseInt(newPid) >= CUSTOM_PORTRAIT_PID_START;
            let imageData;

            if (isCustomPortrait) {
              // Custom portrait - use getImageDataByPid to get the actual image
              console.log(`[PlayerBrowser] Loading custom portrait for PID ${newPid}`);
              imageData = await window.electronAPI.portrait.getImageDataByPid(newPid);
            } else {
              // Standard portrait - use getByPID
              imageData = await window.electronAPI.portrait.getByPID(newPid);
            }

            if (imageData) {
              window.app.portraitCache.set(cacheKey, imageData);
              console.log(`[PlayerBrowser] Loaded portrait for ${prospectData.firstName} ${prospectData.lastName}: ${cacheKey}`);
              // Refresh the grid to show the portrait
              if (isAgGrid && window.app.draftAgGrid) {
                window.app.draftAgGrid.refreshCells({ force: true });
              }
            } else {
              console.log(`[PlayerBrowser] No portrait found for PID ${newPid}`);
            }
          } catch (err) {
            console.warn(`[PlayerBrowser] Portrait load error for PID ${newPid}:`, err);
          }
        }
      } else if (newPeps) {
        // Fallback for PEPS-only (shouldn't happen with generic PIDs)
        const cacheKey = `pam_${newPeps}`;
        if (!window.app.portraitCache.has(cacheKey)) {
          try {
            const imageData = await window.electronAPI.portrait.getByPLPO(newPeps);
            if (imageData) {
              window.app.portraitCache.set(cacheKey, imageData);
              console.log(`[PlayerBrowser] Loaded portrait for ${prospectData.firstName} ${prospectData.lastName}: ${cacheKey}`);
              if (isAgGrid && window.app.draftAgGrid) {
                window.app.draftAgGrid.refreshCells({ force: true });
              }
            }
          } catch (err) {
            console.warn(`[PlayerBrowser] Portrait load error for PEPS ${newPeps}:`, err);
          }
        }
      }

      // Track the player to prevent duplicates
      if (window.electronAPI.editorTracking) {
        await window.electronAPI.editorTracking.trackPlayer({
          firstName: prospectData.firstName,
          lastName: prospectData.lastName,
          position: position,
          internalId: internalId,
          year: selectedYear,
          povr: prospectData.overall || 70
        }, 'draft');
      }

      // Update draft file stats
      if (window.app.currentDraftClass) {
        const statsEl = document.getElementById('draft-file-stats');
        if (statsEl) {
          const count = draftData.length;
          statsEl.textContent = `${count} prospects | Year: ${window.app.currentDraftClass.header.year}`;
        }
      }

      console.log('[PlayerBrowser] Added player to draft class:', playerName, selectedYear, 'at slot', targetSlot);

      // Close modal and show success using non-blocking toast
      closeAddToDraftModal();

      // Use non-blocking toast notification instead of alert() to prevent focus loss
      if (window.showToast) {
        window.showToast('Added ' + playerName + ' (' + selectedYear + ') to draft at ' + roundDisplay, 'success');
      }

      // Restore focus to editor using the global focus restoration
      if (window.restoreEditorFocus) {
        window.restoreEditorFocus();
      } else {
        restoreFocusToSearch();
      }

    } catch (error) {
      console.error('[PlayerBrowser] Error adding to draft:', error);
      // Keep alert for errors - user needs to see these
      alert('Failed to add player to draft class: ' + error.message);
      closeAddToDraftModal();
      if (window.restoreEditorFocus) {
        window.restoreEditorFocus();
      } else {
        restoreFocusToSearch();
      }
    }
  }

  // options.pid = PID from database browser display (so we don't lose it in re-lookups)
  // options.isCustom = whether this is a custom player
  window.addToRoster = async function(internalId, options) {
    console.log('[PlayerBrowser] Add to roster called with:', internalId, 'type:', typeof internalId, 'options:', options);

    // Validate internalId
    if (internalId === undefined || internalId === null) {
      console.error('[PlayerBrowser] ERROR: internalId is undefined/null!');
      alert('Error: Player ID is missing. Please try selecting the player again.');
      restoreFocusToSearch();
      return;
    }

    // Convert to number and validate
    const numericId = Number(internalId);
    if (isNaN(numericId) || numericId <= 0) {
      console.error('[PlayerBrowser] ERROR: Invalid internalId:', internalId, '-> numericId:', numericId);
      alert('Error: Invalid player ID (' + internalId + '). Please try selecting the player again.');
      restoreFocusToSearch();
      return;
    }

    try {
      // Check if roster is loaded or created
      if (!window.app || !window.app.agGrid) {
        alert('Please load or create a roster first.\n\nUse "Open Roster" to load an existing file, or "New Roster" to start fresh.');
        restoreFocusToSearch();
        return;
      }

      // Get available years for the player
      console.log('[PlayerBrowser] Fetching available years for player ID:', numericId);
      const yearsResult = await window.electronAPI.database.getPlayerAvailableYears(numericId);
      if (!yearsResult.success) {
        alert('Failed to get player data: ' + yearsResult.error);
        restoreFocusToSearch();
        return;
      }

      const years = yearsResult.years;
      const defaultYear = yearsResult.defaultYear;
      const playerName = yearsResult.playerName;
      console.log('[PlayerBrowser] Player:', playerName, 'Years:', years.length > 3 ? years.slice(0, 3).join(', ') + '...' : years.join(', '));

      // Get player basic info for duplicate check
      const playerInfo = currentResults.find(p => p.internalId === numericId);
      const firstName = playerInfo ? playerInfo.firstName : '';
      const lastName = playerInfo ? playerInfo.lastName : '';
      const position = playerInfo ? playerInfo.position : '';

      // Check for duplicate using tracking service
      if (window.electronAPI.editorTracking) {
        const trackResult = await window.electronAPI.editorTracking.isTracked(firstName, lastName, position, 'roster');
        if (trackResult.success && trackResult.isTracked) {
          const existingPlayer = trackResult.player;
          const msg = playerName + ' (' + position + ') is already in the roster' +
            (existingPlayer && existingPlayer.povr ? ' with OVR ' + existingPlayer.povr : '') + '.\n\n' +
            'Do you want to add another copy anyway?';
          if (!confirm(msg)) {
            restoreFocusToSearch();
            return;
          }
        }
      }

      // Check roster limit and offer replacement if full
      // IMPORTANT: Use app.players.length, NOT grid.forEachNode because the grid is paginated
      // and only contains the visible page (50-100 rows), not all 3000 players
      const MAX_ROSTER_SIZE = 3000;
      const allPlayers = window.app.players || [];
      if (allPlayers.length >= MAX_ROSTER_SIZE) {
        // Find lowest OVR player on Free Agent team (TGID = 1009) from FULL player list
        const freeAgents = allPlayers.filter(p => p.TGID === 1009);
        if (freeAgents.length === 0) {
          alert('Roster is at maximum capacity (' + MAX_ROSTER_SIZE + ' players) and no Free Agents to replace. Remove players before adding new ones.');
          restoreFocusToSearch();
          return;
        }

        // Sort by OVR ascending to find lowest
        freeAgents.sort((a, b) => (a.POVR || 0) - (b.POVR || 0));
        const lowestPlayer = freeAgents[0];
        const lowestName = (lowestPlayer.PFNA || '') + ' ' + (lowestPlayer.PLNA || '');
        const lowestOVR = lowestPlayer.POVR || 0;

        const replaceMsg = 'Roster is at maximum capacity (' + MAX_ROSTER_SIZE + ' players).\n\n' +
          'Would you like to replace the lowest-rated Free Agent?\n\n' +
          'Player to remove: ' + lowestName.trim() + ' (OVR ' + lowestOVR + ')\n' +
          'Player to add: ' + playerName;

        if (!confirm(replaceMsg)) {
          restoreFocusToSearch();
          return;
        }

        // CRITICAL FIX: Instead of splice+push which shifts indices and breaks save,
        // we store the replacement info and do an in-place replace in confirmAddToRoster
        const idx = allPlayers.indexOf(lowestPlayer);
        if (idx === -1) {
          alert('Failed to find player to replace');
          restoreFocusToSearch();
          return;
        }

        // Store replacement info for use in confirmAddToRoster
        pendingReplaceInfo = {
          index: idx,
          oldPlayer: lowestPlayer,
          oldName: lowestName.trim(),
          oldOVR: lowestOVR
        };

        console.log('[PlayerBrowser] Will replace player at index', idx, ':', lowestName.trim(), 'OVR:', lowestOVR);
      }

      // Store pending data (including PID from database browser if passed)
      pendingRosterAdd = {
        internalId,
        firstName,
        lastName,
        position,
        playerName,
        years,
        defaultYear,
        displayedPid: options?.pid,  // PID shown in database browser - use this!
        isCustomPlayer: options?.isCustom
      };

      // Populate and show modal
      document.getElementById('addToRosterPlayerName').textContent = playerName;
      document.getElementById('addToRosterPlayerInfo').textContent = position + ' | ' + years.length + ' season(s) available';

      // Populate year dropdown
      const yearSelect = document.getElementById('addToRosterYear');
      yearSelect.innerHTML = '';
      years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === defaultYear) option.selected = true;
        yearSelect.appendChild(option);
      });

      // Show modal
      document.getElementById('addToRosterModal').style.display = 'flex';

    } catch (error) {
      console.error('[PlayerBrowser] Error adding to roster:', error);
      alert('Failed to add player to roster: ' + error.message);
      restoreFocusToSearch();
    }
  };

  // Direct add to roster without modal (for batch operations from database browser)
  // options.pid = PID from database browser display (so we don't lose it in re-lookups)
  // options.isCustom = whether this is a custom player
  window.directAddToRoster = async function(internalId, teamId, year, options) {
    console.log('[PlayerBrowser] Direct add to roster:', internalId, 'teamId:', teamId, 'year:', year, 'options:', options);

    try {
      // Check if roster is loaded or created
      if (!window.app || !window.app.agGrid) {
        console.error('[PlayerBrowser] Roster not loaded');
        return { success: false, error: 'Roster not loaded' };
      }

      // Get available years for the player (to get default year if not specified)
      const yearsResult = await window.electronAPI.database.getPlayerAvailableYears(internalId);
      if (!yearsResult.success) {
        console.error('[PlayerBrowser] Failed to get player years:', yearsResult.error);
        return { success: false, error: yearsResult.error };
      }

      const selectedYear = year || yearsResult.defaultYear;
      const selectedTeamId = teamId || 1009; // Default to Free Agent

      // Get player data formatted for roster
      const result = await window.electronAPI.database.getPlayerForRoster(internalId, selectedYear);
      if (!result.success) {
        console.error('[PlayerBrowser] Failed to get player data:', result.error);
        return { success: false, error: result.error };
      }

      const playerData = result.player;

      // DEBUG: Check ratings in received player data (directAddToRoster)
      const directRatingKeys = Object.keys(playerData).filter(k => ['POVR', 'PSPD', 'PACC', 'PSTR', 'PAGI', 'PJMP', 'PSTA', 'PAWR'].includes(k));
      console.log(`[PlayerBrowser] directAddToRoster RECEIVED - ${playerData.PFNA} ${playerData.PLNA}`);
      console.log(`[PlayerBrowser] directAddToRoster RECEIVED - Rating keys: ${directRatingKeys.join(', ') || 'NONE'}`);
      console.log(`[PlayerBrowser] directAddToRoster RECEIVED - POVR=${playerData.POVR}, PSPD=${playerData.PSPD}, PACC=${playerData.PACC}`);
      console.log(`[PlayerBrowser] directAddToRoster RECEIVED - PSXP (PID)=${playerData.PSXP}, options.pid=${options?.pid}`);

      // CRITICAL: If a PID was passed from the database browser, use it directly
      // This ensures the PID shown in the browser is the one that ends up on the roster
      if (options?.pid && options.pid > 0) {
        console.log(`[PlayerBrowser] Using PID from database browser: ${options.pid} (overriding ${playerData.PSXP})`);
        playerData.PSXP = options.pid;
      }

      // Set the selected team
      playerData.TGID = selectedTeamId;

      // CRITICAL FIX: Replace an existing Free Agent slot instead of pushing beyond template capacity
      // The roster template has fixed slots (3124), pushing to the end puts players beyond save capacity
      // User requirement: Replace bottom Free Agents (search from end of array backwards)
      // IMPORTANT: Only replace GENERIC Free Agents (low PID) - not real players just added
      if (window.app.players) {
        // Find a replaceable Free Agent slot (TGID=1009 with low PID) - search from bottom of list
        let replaceIndex = -1;
        let replacePlayer = null;

        // Search backwards from the end of the array to find bottom Free Agents
        // Only consider generic players (PID < 100 or PID = 0) - real players have PIDs like 2000+
        for (let i = window.app.players.length - 1; i >= 0; i--) {
          const p = window.app.players[i];
          const pid = p.PSXP || 0;
          // Free Agent team AND generic player (low PID means template filler, not real player)
          if (p.TGID === 1009 && pid < 100) {
            replaceIndex = i;
            replacePlayer = p;
            break; // Take the first (bottom-most) generic Free Agent we find
          }
        }

        // Fallback: if no generic Free Agents, find any Free Agent with low overall
        if (replaceIndex === -1) {
          for (let i = window.app.players.length - 1; i >= 0; i--) {
            const p = window.app.players[i];
            if (p.TGID === 1009 && (p.POVR || 99) < 50) {
              replaceIndex = i;
              replacePlayer = p;
              break;
            }
          }
        }

        if (replaceIndex === -1) {
          console.error('[PlayerBrowser] No Free Agent slot available to replace!');
          return { success: false, error: 'No Free Agent slot available. Remove a Free Agent first.' };
        }

        // Keep the PGID from the replaced slot - this is the record slot identity
        playerData.PGID = replacePlayer.PGID;
        playerData.POID = replacePlayer.POID || replacePlayer.PGID;
        console.log('[PlayerBrowser] Replacing slot at index:', replaceIndex, 'PGID:', playerData.PGID, 'was:', replacePlayer.PFNA, replacePlayer.PLNA);

        // Replace in the array at the same index (keeps within template capacity)
        window.app.players[replaceIndex] = playerData;
        window.app.filteredPlayers = window.app.players.slice();

        // Update grid - remove old row and add new one (AG-Grid needs row identity change)
        if (window.app.agGrid) {
          window.app.agGrid.applyTransaction({
            remove: [replacePlayer],
            add: [playerData]
          });
        }
      }

      // Mark roster as modified
      if (window.app.rosterModified !== undefined) {
        window.app.rosterModified = true;
      }

      // Track the player
      if (window.electronAPI.editorTracking) {
        await window.electronAPI.editorTracking.trackPlayer({
          firstName: playerData.PFNA || '',
          lastName: playerData.PLNA || '',
          position: playerData.position || '',
          internalId: internalId,
          year: selectedYear,
          povr: playerData.POVR || 0
        }, 'roster');
      }

      // Pre-load portrait - ALWAYS use PID (PAM only affects in-game face model)
      const pid = playerData.PSXP;
      const hasValidPid = pid && pid > 0;
      const cacheKey = hasValidPid ? `pid_${pid}` : null;

      console.log('[PlayerBrowser] Portrait pre-load: PID=' + pid + ', cacheKey=' + cacheKey);

      if (cacheKey && !window.app.portraitCache.has(cacheKey)) {
        if (window.electronAPI?.portrait?.getByPID) {
          window.electronAPI.portrait.getByPID(pid).then(imageData => {
            if (imageData && imageData.length > 0) {
              window.app.portraitCache.set(cacheKey, imageData);
              console.log('[PlayerBrowser] Portrait cached:', cacheKey, 'data length:', imageData.length);
              if (window.app.agGrid) {
                window.app.agGrid.redrawRows();
              }
            }
          }).catch(err => console.error('[PlayerBrowser] Error loading portrait:', err));
        }
      }

      // Update stats display
      if (window.app.updateStats) {
        window.app.updateStats();
      }

      const playerName = (playerData.PFNA || '') + ' ' + (playerData.PLNA || '');
      console.log('[PlayerBrowser] Added player to roster:', playerName.trim(), 'Team:', selectedTeamId);

      return { success: true };

    } catch (error) {
      console.error('[PlayerBrowser] Error in directAddToRoster:', error);
      return { success: false, error: error.message };
    }
  };

  window.addToDraft = async function(internalId) {
    console.log('[PlayerBrowser] Add to draft:', internalId);

    try {
      // Check if draft class is loaded or created (supports AG-Grid or Handsontable)
      // If not, auto-create an empty draft class for convenience

      if (!window.app || (!window.app.draftAgGrid && !window.app.draftGrid)) {
        console.log('[PlayerBrowser] No draft class loaded, auto-creating new one');
        if (window.app && typeof window.app.createNewDraftClass === 'function') {
          await window.app.createNewDraftClass();
          // Wait a moment for grid to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Re-check after auto-create
        if (!window.app || (!window.app.draftAgGrid && !window.app.draftGrid)) {
          alert('Could not create draft class. Please try using "New Draft Class" from the Draft Class Editor.');
          restoreFocusToSearch();
          return;
        }
      }

      // Get available years for the player
      const yearsResult = await window.electronAPI.database.getPlayerAvailableYears(internalId);
      if (!yearsResult.success) {
        alert('Failed to get player data: ' + yearsResult.error);
        restoreFocusToSearch();
        return;
      }

      const years = yearsResult.years;
      const defaultYear = yearsResult.defaultYear;
      const playerName = yearsResult.playerName;

      // Get player basic info for duplicate check
      const playerInfo = currentResults.find(p => p.internalId === internalId);
      const firstName = playerInfo ? playerInfo.firstName : '';
      const lastName = playerInfo ? playerInfo.lastName : '';
      const position = playerInfo ? playerInfo.position : '';

      // Check for duplicate using tracking service
      if (window.electronAPI.editorTracking) {
        const trackResult = await window.electronAPI.editorTracking.isTracked(firstName, lastName, position, 'draft');
        if (trackResult.success && trackResult.isTracked) {
          const existingPlayer = trackResult.player;
          const msg = playerName + ' (' + position + ') is already in the draft class' +
            (existingPlayer && existingPlayer.povr ? ' with OVR ' + existingPlayer.povr : '') + '.\n\n' +
            'Do you want to add another copy anyway?';
          if (!confirm(msg)) {
            restoreFocusToSearch();
            return;
          }
        }
      }

      // Check draft class limit (M26 supports max 402 prospects) - support AG-Grid and Handsontable

      let draftDataForCount = [];

      if (window.app.draftAgGrid) {

        window.app.draftAgGrid.forEachNode(node => {

          if (node.data) draftDataForCount.push(node.data);

        });

      } else if (window.app.draftGrid && window.app.draftGrid.getSourceData) {

        draftDataForCount = window.app.draftGrid.getSourceData();

      }

      const draftData = draftDataForCount;
      const MAX_DRAFT_SIZE = 402;
      if (draftData.length >= MAX_DRAFT_SIZE) {
        alert('Draft class is at maximum capacity (' + MAX_DRAFT_SIZE + ' prospects). Remove prospects before adding new ones.');
        restoreFocusToSearch();
        return;
      }

      // Store pending data
      pendingDraftAdd = {
        internalId,
        firstName,
        lastName,
        position,
        playerName,
        years,
        defaultYear
      };

      // Populate and show modal
      document.getElementById('addToDraftPlayerName').textContent = playerName;
      document.getElementById('addToDraftPlayerInfo').textContent = position + ' | ' + years.length + ' season(s) available';

      // Populate year dropdown
      const yearSelect = document.getElementById('addToDraftYear');
      yearSelect.innerHTML = '';
      years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === defaultYear) option.selected = true;
        yearSelect.appendChild(option);
      });

      // Show draft position info based on default year
      const draftInfoEl = document.getElementById('addToDraftPositionInfo');
      if (draftInfoEl) {
        // Get draft info for display
        const result = await window.electronAPI.database.getPlayerForDraft(internalId, defaultYear);
        if (result.success) {
          const suggestedSlot = result.suggestedSlot;
          const draftInfo = result.draftInfo;
          const roundNum = draftInfo.round || Math.floor(suggestedSlot / 32) + 1;
          const pickInRound = (suggestedSlot % 32) + 1;
          const roundDisplay = roundNum <= 7 ? 'Round ' + roundNum + ', Pick ' + pickInRound : 'UDFA';
          draftInfoEl.innerHTML = 'Historical draft position: <strong>' + roundDisplay + '</strong><br>Will be placed at slot ' + (suggestedSlot + 1);
        } else {
          draftInfoEl.innerHTML = 'Draft position will be calculated';
        }
      }

      // Show modal
      document.getElementById('addToDraftModal').style.display = 'flex';

    } catch (error) {
      console.error('[PlayerBrowser] Error adding to draft:', error);
      alert('Failed to add player to draft class: ' + error.message);
      restoreFocusToSearch();
    }
  };

  // Direct add to draft without modal (for batch operations from database browser)
  window.directAddToDraft = async function(internalId, year) {
    console.log('[PlayerBrowser] Direct add to draft:', internalId, 'year:', year);

    try {
      // Check if draft class is loaded or created
      const isAgGrid = !!window.app.draftAgGrid;
      if (!window.app || (!isAgGrid && !window.app.draftGrid)) {
        console.error('[PlayerBrowser] Draft class not loaded');
        return { success: false, error: 'Draft class not loaded' };
      }

      // Get available years if year not specified
      let selectedYear = year;
      if (!selectedYear) {
        const yearsResult = await window.electronAPI.database.getPlayerAvailableYears(internalId);
        if (!yearsResult.success) {
          console.error('[PlayerBrowser] Failed to get player years:', yearsResult.error);
          return { success: false, error: yearsResult.error };
        }
        selectedYear = yearsResult.defaultYear;
      }

      // Get player data formatted for draft class
      const result = await window.electronAPI.database.getPlayerForDraft(internalId, selectedYear);
      if (!result.success) {
        console.error('[PlayerBrowser] Failed to get player data:', result.error);
        return { success: false, error: result.error };
      }

      const prospectData = result.prospect;

      // Get current draft data
      let draftData = [];
      if (isAgGrid) {
        window.app.draftAgGrid.forEachNode(node => {
          if (node.data) draftData.push({ ...node.data });
        });
      } else if (window.app.draftGrid && window.app.draftGrid.getSourceData) {
        draftData = window.app.draftGrid.getSourceData();
      }

      // Add at end of draft class
      let targetSlot = draftData.length;
      const roundNum = Math.floor(targetSlot / 32) + 1;
      const pickInRound = (targetSlot % 32) + 1;

      // Helper function for value/fallback
      const getValueOrFallback = (name, id, defaultVal = '') => {
        if (name !== undefined && name !== null && name !== '') return name;
        return id !== undefined && id !== null ? id : defaultVal;
      };

      // Build the row object
      const newRow = {
        draftPosition: targetSlot,
        round: roundNum <= 7 ? roundNum : 8,
        playerPic: prospectData.playerPic || 'Generic Face',
        lastName: prospectData.lastName,
        firstName: prospectData.firstName,
        position: getValueOrFallback(prospectData.positionName, prospectData.position, ''),
        archetype: getValueOrFallback(prospectData.archetypeName, prospectData.archetype, 0),
        college: getValueOrFallback(prospectData.collegeName, prospectData.college, 0),
        homeState: getValueOrFallback(prospectData.homeStateName, prospectData.homeState, ''),
        homeTown: prospectData.homeTown || '',
        age: prospectData.age,
        PID: prospectData.PID,
        PEPS: prospectData.PEPS,
        race: prospectData.race,
        skinTone: prospectData.skinTone,
        devTrait: prospectData.devTrait !== undefined && prospectData.devTrait !== null ? prospectData.devTrait : 0,
        overall: prospectData.overall || 70,
        speed: prospectData.speed || 70,
        acceleration: prospectData.acceleration || 70,
        strength: prospectData.strength || 70,
        agility: prospectData.agility || 70,
        awareness: prospectData.awareness || 70,
        jumping: prospectData.jumping || 70,
        stamina: prospectData.stamina || 70,
        changeOfDirection: prospectData.changeOfDirection || 70,
        injury: prospectData.injury || 70,
        carrying: prospectData.carrying || 70,
        ballCarrierVision: prospectData.ballCarrierVision || 70,
        stiffArm: prospectData.stiffArm || 70,
        trucking: prospectData.trucking || 70,
        jukeMove: prospectData.jukeMove || 70,
        spinMove: prospectData.spinMove || 70,
        breakTackle: prospectData.breakTackle || 70,
        catching: prospectData.catching || 70,
        catchInTraffic: prospectData.catchInTraffic || 70,
        spectacularCatch: prospectData.spectacularCatch || 70,
        shortRouteRunning: prospectData.shortRouteRunning || 70,
        mediumRouteRunning: prospectData.mediumRouteRunning || 70,
        deepRouteRunning: prospectData.deepRouteRunning || 70,
        release: prospectData.release || 70,
        passBlock: prospectData.passBlock || 70,
        runBlock: prospectData.runBlock || 70,
        leadBlock: prospectData.leadBlock || 70,
        impactBlocking: prospectData.impactBlocking || 70,
        passBlockPower: prospectData.passBlockPower || 70,
        passBlockFinesse: prospectData.passBlockFinesse || 70,
        runBlockPower: prospectData.runBlockPower || 70,
        runBlockFinesse: prospectData.runBlockFinesse || 70,
        throwPower: prospectData.throwPower || 70,
        throwAccuracyShort: prospectData.throwAccuracyShort || 70,
        throwAccuracyMedium: prospectData.throwAccuracyMedium || 70,
        throwAccuracyDeep: prospectData.throwAccuracyDeep || 70,
        throwOnTheRun: prospectData.throwOnTheRun || 70,
        throwUnderPressure: prospectData.throwUnderPressure || 70,
        playAction: prospectData.playAction || 70,
        tackle: prospectData.tackle || 70,
        hitPower: prospectData.hitPower || 70,
        pursuit: prospectData.pursuit || 70,
        playRecognition: prospectData.playRecognition || 70,
        finesseMoves: prospectData.finesseMoves || 70,
        powerMoves: prospectData.powerMoves || 70,
        blockShedding: prospectData.blockShedding || 70,
        manCoverage: prospectData.manCoverage || 70,
        zoneCoverage: prospectData.zoneCoverage || 70,
        press: prospectData.press || 70,
        kickPower: prospectData.kickPower || 70,
        kickAccuracy: prospectData.kickAccuracy || 70,
        kickReturn: prospectData.kickReturn || 70,
        height: prospectData.height,
        weight: prospectData.weight
      };

      // Add to grid
      if (isAgGrid && window.app.draftAgGrid) {
        window.app.draftAgGrid.applyTransaction({ add: [newRow] });
        draftData.push(newRow);
      } else if (window.app.draftGrid) {
        draftData.push(newRow);
        window.app.draftGrid.loadData(draftData);
      }

      // Update draft class data structure
      if (window.app.currentDraftClass && window.app.currentDraftClass.prospects) {
        window.app.currentDraftClass.prospects.push(newRow);
      }

      // Mark draft class as modified
      if (window.app.draftClassModified !== undefined) {
        window.app.draftClassModified = true;
      }

      // Track the player
      if (window.electronAPI.editorTracking) {
        await window.electronAPI.editorTracking.trackPlayer({
          firstName: prospectData.firstName,
          lastName: prospectData.lastName,
          position: prospectData.positionName || '',
          internalId: internalId,
          year: selectedYear,
          povr: prospectData.overall || 70
        }, 'draft');
      }

      const playerName = prospectData.firstName + ' ' + prospectData.lastName;
      console.log('[PlayerBrowser] Added player to draft class:', playerName, selectedYear, 'at slot', targetSlot);

      return { success: true };

    } catch (error) {
      console.error('[PlayerBrowser] Error in directAddToDraft:', error);
      return { success: false, error: error.message };
    }
  };

  // Make functions available globally
  window.openPlayerBrowser = openPlayerBrowser;
  window.closePlayerBrowser = closePlayerBrowser;
  window.initPlayerBrowser = initPlayerBrowser;
  window.playerBrowserPerformSearch = performSearch;
  window.refreshPlayerBrowser = performSearch; // Alias for refreshing results after edits
  window.restoreFocusToPlayerBrowser = restoreFocusToSearch; // Centralized focus restoration

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayerBrowser);
  } else {
    initPlayerBrowser();
  }

})();
