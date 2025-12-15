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
   * Open the player browser modal
   */
  function openPlayerBrowser() {
    console.log('[PlayerBrowser] Opening browser');

    const modal = document.getElementById('playerBrowserModal');
    if (modal) {
      modal.style.display = 'flex';
    }

    // Reset state when opening
    isLoading = false; // Reset loading state in case it got stuck
    currentResults = [];
    totalResults = 0;

    // Ensure dropdowns are populated (may not have loaded at init time)
    ensureFiltersPopulated();

    // Clear previous search and do initial load
    const searchInput = document.getElementById('playerBrowserSearch');
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }

    // Reset filters
    const positionFilter = document.getElementById('playerBrowserPositionFilter');
    if (positionFilter) positionFilter.value = '';
    const draftYearFrom = document.getElementById('playerBrowserDraftYearFrom');
    if (draftYearFrom) draftYearFrom.value = '';
    const draftYearTo = document.getElementById('playerBrowserDraftYearTo');
    if (draftYearTo) draftYearTo.value = '';
    const collegeFilter = document.getElementById('playerBrowserCollegeFilter');
    if (collegeFilter) collegeFilter.value = '';
    const emptyFilter = document.getElementById('playerBrowserEmptyFilter');
    if (emptyFilter) emptyFilter.value = '';

    currentPage = 1;
    performSearch();
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
   * Restore focus to the player browser search input.
   * This should be called after any operation that steals focus (dialogs, modals, etc.)
   * IMPORTANT: This is the centralized focus restoration function for the player browser.
   * Uses Electron IPC to restore OS-level window focus before focusing the DOM element.
   */
  function restoreFocusToSearch() {
    // Only restore focus if player browser is visible AND no overlay modals are visible
    const browserModal = document.getElementById('playerBrowserModal');
    const playerCardModal = document.getElementById('dbPlayerCardModal');
    const dbManagementModal = document.getElementById('dbManagementModal');

    if (!browserModal || browserModal.style.display === 'none' || browserModal.style.display === '') {
      return; // Browser not open
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
   * Focus the search input element after window focus is restored.
   * Uses click simulation and multiple attempts to combat Windows focus issues.
   * IMPORTANT: On Windows, document.activeElement can report correct focus but keyboard
   * input doesn't work. We now always run the aggressive focus simulation.
   */
  function focusSearchInput() {
    var attempts = 0;
    var maxAttempts = 3;
    var delays = [100, 200, 400]; // Delays between attempts

    function shouldStop() {
      // Double-check conditions are still valid
      const browserModal = document.getElementById('playerBrowserModal');
      const playerCardModal = document.getElementById('dbPlayerCardModal');
      const dbManagementModal = document.getElementById('dbManagementModal');

      // If browser is closed, stop trying
      if (!browserModal || browserModal.style.display === 'none' || browserModal.style.display === '') {
        return true;
      }
      // If player card is open, stop (it should handle its own focus)
      if (playerCardModal && playerCardModal.style.display !== 'none' && playerCardModal.style.display !== '') {
        return true;
      }
      // If db management is open, stop (it should handle its own focus)
      if (dbManagementModal && dbManagementModal.style.display !== 'none' && dbManagementModal.style.display !== '') {
        return true;
      }
      return false;
    }

    function aggressiveFocus(input) {
      // Use aggressive focus techniques that work better on Windows
      // 1. Blur any currently focused element
      if (document.activeElement && document.activeElement !== input) {
        document.activeElement.blur();
      }

      // 2. Dispatch real mouse events (more effective than .click())
      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

      // 3. Focus the input
      input.focus();

      // 4. Use select() to activate the text cursor
      if (typeof input.select === 'function') {
        input.select();
      }

      // 5. Dispatch a focus event explicitly
      input.dispatchEvent(new FocusEvent('focus', { bubbles: false, cancelable: false }));
    }

    function attemptFocus() {
      if (shouldStop()) {
        console.log('[PlayerBrowser] Focus restoration stopped - modal state changed');
        return;
      }

      if (attempts >= maxAttempts) {
        console.log('[PlayerBrowser] Focus restoration completed after', maxAttempts, 'attempts');
        return;
      }

      var delay = delays[attempts] || 400;
      attempts++;

      setTimeout(function() {
        if (shouldStop()) return;

        const input = document.getElementById('playerBrowserSearch');
        if (input) {
          aggressiveFocus(input);
          var focusWorked = document.activeElement === input;
          console.log('[PlayerBrowser] Focus attempt', attempts, '- activeElement:',
            document.activeElement?.id || document.activeElement?.tagName,
            focusWorked ? '(matched)' : '(mismatch)');

          // Always continue attempts even if it appears to work
          // because Windows can lie about focus state
          if (attempts < maxAttempts) {
            attemptFocus();
          }
        }
      }, delay);
    }

    // Start focus attempts after a short delay to let IPC focus settle
    setTimeout(function() {
      requestAnimationFrame(function() {
        attemptFocus();
      });
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
    pageResults.forEach(player => {
      const fullName = (player.firstName || '') + ' ' + (player.lastName || '');
      const draftInfo = player.draftClass ? player.draftClass + ' Rd ' + (player.draftRound || '?') : 'N/A';
      const careerSpan = player.careerFrom && player.careerTo ? player.careerFrom + '-' + player.careerTo : (player.careerFrom || 'N/A');
      const hofBadge = player.isHof ? '<span class="player-hof-badge">HOF</span>' : '';

      html +=
        '<div class="player-browser-row" data-internal-id="' + player.internalId + '">' +
        '<div class="player-browser-name">' + fullName + ' ' + hofBadge + '</div>' +
        '<div class="player-browser-position">' + (player.position || '-') + '</div>' +
        '<div class="player-browser-college">' + (player.college || '-') + '</div>' +
        '<div class="player-browser-draft">' + draftInfo + '</div>' +
        '<div class="player-browser-career">' + careerSpan + '</div>' +
        '<div class="player-browser-actions">' +
        '<button class="pb-btn pb-btn-view" onclick="window.viewDbPlayer(' + player.internalId + ')" title="View/Edit">View</button>' +
        '<button class="pb-btn pb-btn-add" onclick="window.addToRoster(' + player.internalId + ')" title="Add to Roster">+Roster</button>' +
        '<button class="pb-btn pb-btn-add" onclick="window.addToDraft(' + player.internalId + ')" title="Add to Draft Class">+Draft</button>' +
        '</div>' +
        '</div>';
    });

    container.innerHTML = html;
    updatePagination(startIdx + 1, endIdx, totalResults);
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
  window.viewDbPlayer = function(internalId) {
    console.log('[PlayerBrowser] View player:', internalId);
    if (window.openDbPlayerCard) {
      window.openDbPlayerCard(internalId, false);
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
    restoreFocusToSearch();
  }

  async function confirmAddToRoster() {
    if (!pendingRosterAdd) return;

    const { internalId, firstName, lastName, position, playerName } = pendingRosterAdd;
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
        // Normal add (roster wasn't full) - just push to the end
        if (window.app.agGrid) {
          window.app.agGrid.applyTransaction({
            add: [playerData]
          });
        }

        if (window.app.players) {
          // Generate a unique PGID for the new player
          const maxPGID = window.app.players.reduce((max, p) => Math.max(max, p.PGID || 0), 0);
          playerData.PGID = maxPGID + 1;
          // Only set POID if not already provided from database lookup
          if (!playerData.POID) {
            playerData.POID = playerData.PGID; // Fallback: POID matches PGID if not in database
          }
          console.log('[PlayerBrowser] Assigned new PGID:', playerData.PGID, 'POID:', playerData.POID);

          window.app.players.push(playerData);
          window.app.filteredPlayers = window.app.players.slice();
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

      console.log('[PlayerBrowser] Added player to roster:', playerName, selectedYear, 'Team:', selectedTeamName);

      // Close modal and show success
      closeAddToRosterModal();
      alert('Successfully added ' + playerName + ' (' + selectedYear + ') to ' + selectedTeamName + '!');

    } catch (error) {
      console.error('[PlayerBrowser] Error adding to roster:', error);
      alert('Failed to add player to roster: ' + error.message);
      closeAddToRosterModal();
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
    restoreFocusToSearch();
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

      // Get current draft data
      const draftData = window.app.draftGrid.getSourceData();

      // Calculate target slot - use historical draft position or find first empty
      let targetSlot = suggestedSlot;

      // If target slot is beyond current array, add at end
      if (targetSlot >= draftData.length) {
        targetSlot = draftData.length;
      }

      // Round display for logging
      const roundNum = draftInfo.round || Math.floor(targetSlot / 32) + 1;
      const pickInRound = (targetSlot % 32) + 1;
      const roundDisplay = roundNum <= 7 ? 'Round ' + roundNum + ' Pick ' + pickInRound : 'UDFA';

      // Build the row object matching draft grid columns
      const newRow = {
        draftPosition: targetSlot,
        round: roundNum <= 7 ? roundNum : 8,
        playerPic: '',
        lastName: prospectData.lastName,
        firstName: prospectData.firstName,
        position: position,
        archetype: prospectData.archetype || 0,
        college: prospectData.college,
        homeState: prospectData.homeState,
        age: prospectData.age,
        PID: prospectData.PID,
        PEPS: prospectData.PEPS,
        devTrait: prospectData.devTrait || 0,

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
        visuals: prospectData.visuals
      };

      // Insert at target position
      draftData.splice(targetSlot, 0, newRow);

      // Renumber draft positions for all rows
      for (let i = 0; i < draftData.length; i++) {
        draftData[i].draftPosition = i;
        if (i < 224) {
          draftData[i].round = Math.floor(i / 32) + 1;
        } else {
          draftData[i].round = 8;
        }
      }

      // Reload grid with new data
      window.app.draftGrid.loadData(draftData);

      // Update currentDraftClass.prospects if it exists
      if (window.app.currentDraftClass && window.app.currentDraftClass.prospects) {
        window.app.currentDraftClass.prospects = draftData;
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
          const count = window.app.draftGrid.getSourceData().length;
          statsEl.textContent = `${count} prospects | Year: ${window.app.currentDraftClass.header.year}`;
        }
      }

      console.log('[PlayerBrowser] Added player to draft class:', playerName, selectedYear, 'at slot', targetSlot);

      // Close modal and show success
      closeAddToDraftModal();
      alert('Successfully added ' + playerName + ' (' + selectedYear + ') to draft class at ' + roundDisplay + '!');

    } catch (error) {
      console.error('[PlayerBrowser] Error adding to draft:', error);
      alert('Failed to add player to draft class: ' + error.message);
      closeAddToDraftModal();
    }
  }

  window.addToRoster = async function(internalId) {
    console.log('[PlayerBrowser] Add to roster:', internalId);

    try {
      // Check if roster is loaded or created
      if (!window.app || !window.app.agGrid) {
        alert('Please load or create a roster first.\n\nUse "Open Roster" to load an existing file, or "New Roster" to start fresh.');
        restoreFocusToSearch();
        return;
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

      // Store pending data
      pendingRosterAdd = {
        internalId,
        firstName,
        lastName,
        position,
        playerName,
        years,
        defaultYear
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

  window.addToDraft = async function(internalId) {
    console.log('[PlayerBrowser] Add to draft:', internalId);

    try {
      // Check if draft class is loaded or created
      if (!window.app || !window.app.draftGrid) {
        alert('Please load or create a draft class first.\n\nUse "Open Draft Class" to load an existing file, or "New Draft Class" to start fresh.');
        restoreFocusToSearch();
        return;
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

      // Check draft class limit (M26 supports max 402 prospects)
      const draftData = window.app.draftGrid.getSourceData();
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
