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
    const emptyFilterSelect = document.getElementById('playerBrowserEmptyFilter');

    const position = positionFilter ? positionFilter.value : '';
    const draftYearFrom = draftYearFromInput && draftYearFromInput.value ? parseInt(draftYearFromInput.value) : undefined;
    const draftYearTo = draftYearToInput && draftYearToInput.value ? parseInt(draftYearToInput.value) : undefined;
    const collegeFilter = collegeFilterInput ? collegeFilterInput.value : '';
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
          draftYearTo: draftYearTo
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
          draftYearTo: draftYearTo
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

  window.addToRoster = async function(internalId) {
    console.log('[PlayerBrowser] Add to roster:', internalId);

    try {
      // Check if roster is loaded
      if (!window.app || !window.app.agGrid) {
        alert('Please load a roster file first before adding players.');
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

      // If player has multiple years, let user choose
      let selectedYear = defaultYear;
      if (years.length > 1) {
        const yearOptions = years.slice(0, 20).join(', '); // Show first 20 years
        const userInput = prompt(
          'Add ' + playerName + ' to roster\n\nAvailable years: ' + yearOptions + '\n\nEnter the year for player ratings:',
          String(defaultYear)
        );
        if (!userInput) {
          restoreFocusToSearch();
          return; // User cancelled
        }
        selectedYear = parseInt(userInput, 10);
        if (isNaN(selectedYear) || years.indexOf(selectedYear) === -1) {
          alert('Invalid year selected. Please choose from the available years.');
          restoreFocusToSearch();
          return;
        }
      }

      // Get player data formatted for roster
      const result = await window.electronAPI.database.getPlayerForRoster(internalId, selectedYear);
      if (!result.success) {
        alert('Failed to get player data: ' + result.error);
        restoreFocusToSearch();
        return;
      }

      const playerData = result.player;

      // Get current roster data
      const allRows = [];
      window.app.agGrid.forEachNode(function(node) { allRows.push(node.data); });

      // Check roster limit
      const MAX_ROSTER_SIZE = 3000;
      if (allRows.length >= MAX_ROSTER_SIZE) {
        alert('Roster is at maximum capacity (' + MAX_ROSTER_SIZE + ' players). Remove players before adding new ones.');
        restoreFocusToSearch();
        return;
      }

      // Ask user if they want to add to end or overwrite
      const action = confirm(
        'Add ' + playerName + ' (' + selectedYear + ') to roster?\n\nCurrent roster size: ' + allRows.length + '/' + MAX_ROSTER_SIZE + '\n\nClick OK to add to end of roster.\nClick Cancel to abort.'
      );

      if (!action) {
        restoreFocusToSearch();
        return;
      }

      // Add player to the roster grid
      window.app.agGrid.applyTransaction({
        add: [playerData]
      });

      // Mark roster as modified
      if (window.app.rosterModified !== undefined) {
        window.app.rosterModified = true;
      }

      // Update status
      console.log('[PlayerBrowser] Added player to roster:', playerName, selectedYear);
      alert('Successfully added ' + playerName + ' (' + selectedYear + ') to roster!');

      // Close the player browser
      closePlayerBrowser();

    } catch (error) {
      console.error('[PlayerBrowser] Error adding to roster:', error);
      alert('Failed to add player to roster: ' + error.message);
      restoreFocusToSearch();
    }
  };

  window.addToDraft = async function(internalId) {
    console.log('[PlayerBrowser] Add to draft:', internalId);
    alert('Add to Draft Class functionality coming soon!\n\nFor now, use the Database Player Card to view player details and manually add to draft class.');
    restoreFocusToSearch();
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
