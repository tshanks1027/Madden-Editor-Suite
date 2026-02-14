/**
 * Coach Browser Module
 *
 * Provides a searchable, filterable browser for the coach database.
 * Allows users to search, view, edit, and create custom coaches.
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
   * Initialize the coach browser module
   */
  function initCoachBrowser() {
    console.log('[CoachBrowser] Initializing...');

    setupEventListeners();
    performSearch();

    console.log('[CoachBrowser] Initialized');
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Search input with debounce
    const searchInput = document.getElementById('coachBrowserSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        searchTimeout = setTimeout(() => {
          currentPage = 1;
          performSearch();
        }, 400);
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

    // Position filter
    const positionFilter = document.getElementById('coachBrowserPositionFilter');
    if (positionFilter) {
      positionFilter.addEventListener('change', () => {
        currentPage = 1;
        performSearch();
      });
    }

    // Pagination
    const prevBtn = document.getElementById('coachBrowserPrevPage');
    const nextBtn = document.getElementById('coachBrowserNextPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          performSearch();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        currentPage++;
        performSearch();
      });
    }

    // Add New Coach button
    const addNewCoachBtn = document.getElementById('addNewCoachBtn');
    if (addNewCoachBtn) {
      addNewCoachBtn.addEventListener('click', () => {
        console.log('[CoachBrowser] Add New Coach clicked');
        if (typeof window.createNewDbCoach === 'function') {
          window.createNewDbCoach();
        } else {
          alert('Create coach functionality not available. Please reload the application.');
        }
      });
    }

    // Import Retro Coaches button
    const importRetroCoachesBtn = document.getElementById('importRetroCoachesBtn');
    if (importRetroCoachesBtn) {
      importRetroCoachesBtn.addEventListener('click', importRetroCoaches);
      // Check import status on load
      checkRetroImportStatus();
    }

    // Clear Coach DB button
    const clearCoachDbBtn = document.getElementById('clearCoachDbBtn');
    if (clearCoachDbBtn) {
      clearCoachDbBtn.addEventListener('click', clearCoachDatabase);
    }
  }

  /**
   * Clear all custom coaches from database
   */
  async function clearCoachDatabase() {
    if (!window.electronAPI?.coachDatabase?.clearAllCoaches) {
      alert('Clear functionality not available.');
      return;
    }

    if (!confirm('Clear ALL custom coaches from the database?\n\nThis cannot be undone!')) {
      return;
    }

    try {
      const result = await window.electronAPI.coachDatabase.clearAllCoaches();
      if (result.success) {
        alert(`Cleared ${result.cleared} coaches from database.`);
        const statusSpan = document.getElementById('retroCoachStatus');
        if (statusSpan) statusSpan.textContent = '';
        const importBtn = document.getElementById('importRetroCoachesBtn');
        if (importBtn) importBtn.textContent = 'Import Retro Coaches';
        performSearch(); // Refresh
      } else {
        alert('Clear failed: ' + (result.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  /**
   * Check if retro coaches have been imported
   */
  async function checkRetroImportStatus() {
    try {
      const statusSpan = document.getElementById('retroCoachStatus');
      const importBtn = document.getElementById('importRetroCoachesBtn');

      if (!window.electronAPI?.coachDatabase?.getRetroImportStatus) return;

      const result = await window.electronAPI.coachDatabase.getRetroImportStatus();
      if (result.success && result.imported) {
        if (statusSpan) statusSpan.textContent = `(${result.count} retro coaches imported)`;
        if (importBtn) importBtn.textContent = 'Re-import Retro Coaches';
      }
    } catch (e) {
      console.error('[CoachBrowser] Error checking retro import status:', e);
    }
  }

  /**
   * Import retro coaches from historical data
   */
  async function importRetroCoaches() {
    const importBtn = document.getElementById('importRetroCoachesBtn');
    const statusSpan = document.getElementById('retroCoachStatus');

    if (!window.electronAPI?.coachDatabase?.importRetroCoaches) {
      alert('Import functionality not available.');
      return;
    }

    if (!confirm('Import 235 historical head coaches (1966-2024) with their year-by-year stats?\n\n(Excludes in-game coaches and OC/DC records)')) {
      return;
    }

    try {
      if (importBtn) {
        importBtn.disabled = true;
        importBtn.textContent = 'Importing...';
      }
      if (statusSpan) statusSpan.textContent = 'Importing...';

      const result = await window.electronAPI.coachDatabase.importRetroCoaches();

      if (result.success) {
        if (statusSpan) statusSpan.textContent = `Imported ${result.imported} coaches, ${result.seasons} seasons`;
        if (importBtn) importBtn.textContent = 'Re-import Retro Coaches';
        alert(`Import complete!\n\n${result.imported} coaches imported\n${result.seasons} season records\n${result.skipped} coaches already existed`);
        performSearch(); // Refresh the list
      } else {
        alert('Import failed: ' + (result.error || 'Unknown error'));
        if (statusSpan) statusSpan.textContent = 'Import failed';
      }
    } catch (e) {
      console.error('[CoachBrowser] Error importing retro coaches:', e);
      alert('Error importing: ' + e.message);
      if (statusSpan) statusSpan.textContent = 'Error';
    } finally {
      if (importBtn) importBtn.disabled = false;
    }
  }

  /**
   * Perform search with current filters
   */
  async function performSearch() {
    if (isLoading) {
      console.warn('[CoachBrowser] Search already in progress');
      return;
    }
    isLoading = true;

    const resultsDiv = document.getElementById('coachBrowserResults');
    if (resultsDiv) {
      resultsDiv.innerHTML = '<div class="player-browser-loading">Searching...</div>';
    }

    try {
      const searchQuery = document.getElementById('coachBrowserSearch')?.value || '';
      const position = document.getElementById('coachBrowserPositionFilter')?.value || '';

      const options = {
        query: searchQuery.trim(),
        position: position || undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
      };

      console.log('[CoachBrowser] Searching with options:', options);

      const result = await window.electronAPI.coachDatabase.searchCoaches(options);

      if (result.success) {
        currentResults = result.data.coaches || [];
        totalResults = result.data.totalCount || 0;
        console.log('[CoachBrowser] Found', totalResults, 'coaches');
        displayResults();
      } else {
        console.error('[CoachBrowser] Search failed:', result.error);
        if (resultsDiv) {
          resultsDiv.innerHTML = '<div class="player-browser-error">Search failed: ' + result.error + '</div>';
        }
      }
    } catch (error) {
      console.error('[CoachBrowser] Search error:', error);
      if (resultsDiv) {
        resultsDiv.innerHTML = '<div class="player-browser-error">Search error: ' + error.message + '</div>';
      }
    } finally {
      isLoading = false;
    }
  }

  /**
   * Display search results
   */
  function displayResults() {
    const resultsDiv = document.getElementById('coachBrowserResults');
    if (!resultsDiv) return;

    if (currentResults.length === 0) {
      resultsDiv.innerHTML = '<div class="player-browser-empty"><p>No coaches found</p><p class="player-browser-empty-hint">Try adjusting your search or filters</p></div>';
      updatePagination();
      return;
    }

    let html = '';
    currentResults.forEach(coach => {
      const positionBadge = coach.position ? getPositionBadge(coach.position) : '';
      const customBadge = coach.isCustom ? '<span class="coach-type-badge custom">Custom</span>' : '';
      const editedBadge = coach.hasEdits ? '<span class="coach-type-badge" style="background:#f59e0b;">Edited</span>' : '';
      const teamName = coach.teamIndex !== undefined ? `Team ${coach.teamIndex}` : '-';

      html += `
        <div class="player-browser-row" data-coach-id="${coach.id}" data-is-custom="${coach.isCustom}">
          <div class="player-browser-name">${coach.displayName} ${customBadge} ${editedBadge}</div>
          <div class="player-browser-position">${positionBadge || '-'}</div>
          <div class="player-browser-college">${teamName}</div>
          <div class="player-browser-draft">${coach.isCustom ? 'Custom' : 'Original'}</div>
          <div class="player-browser-actions">
            <button class="pb-btn pb-btn-view" onclick="window.viewDbCoach(${coach.id}, ${coach.isCustom})">Edit</button>
          </div>
        </div>
      `;
    });

    resultsDiv.innerHTML = html;
    updatePagination();

    // Add row click handlers for preview
    const rows = resultsDiv.querySelectorAll('.player-browser-row');
    rows.forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger on button clicks
        if (e.target.tagName === 'BUTTON') return;

        const coachId = parseInt(row.dataset.coachId, 10);
        const isCustom = row.dataset.isCustom === 'true';
        const coach = currentResults.find(c => c.id === coachId && c.isCustom === isCustom);
        if (coach) {
          updatePreview(coach);
          // Highlight selected row
          rows.forEach(r => r.classList.remove('selected'));
          row.classList.add('selected');
        }
      });
    });
  }

  /**
   * Update the coach preview panel
   */
  async function updatePreview(coach) {
    const previewContent = document.getElementById('coachPreviewContent');
    if (!previewContent) return;

    const positionBadge = coach.position ? getPositionBadge(coach.position) : '';
    const teamName = coach.teamIndex !== undefined ? `Team ${coach.teamIndex}` : '-';

    // Try to get coach portrait
    let portraitHtml = '<div class="preview-portrait-placeholder">👔</div>';
    try {
      // For original coaches, use the PID (coach.id). For custom, check if there's a maddenPid
      const pid = coach.id;
      if (pid && window.electronAPI?.coachPortrait) {
        const hasPortrait = await window.electronAPI.coachPortrait.hasPortrait(pid);
        if (hasPortrait) {
          const imageData = await window.electronAPI.coachPortrait.getImageDataByPID(pid);
          if (imageData) {
            portraitHtml = `<img src="${imageData}" alt="${coach.displayName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
          }
        }
      }
    } catch (e) {
      console.warn('[CoachBrowser] Failed to load portrait:', e);
    }

    previewContent.innerHTML = `
      <div class="preview-portrait">
        ${portraitHtml}
      </div>
      <div class="preview-name">${coach.displayName}</div>
      <div class="preview-subtitle">${positionBadge} ${coach.isCustom ? '(Custom)' : ''}</div>
      <div class="preview-stats">
        <div class="preview-stat">
          <div class="preview-stat-label">Team</div>
          <div class="preview-stat-value">${teamName}</div>
        </div>
        <div class="preview-stat">
          <div class="preview-stat-label">Type</div>
          <div class="preview-stat-value">${coach.isCustom ? 'Custom' : 'Original'}</div>
        </div>
      </div>
      <div class="preview-actions">
        <button class="preview-btn preview-btn-primary" onclick="window.viewDbCoach(${coach.id}, ${coach.isCustom})">Edit Coach</button>
      </div>
    `;
  }

  /**
   * Get position badge HTML
   */
  function getPositionBadge(position) {
    const positionClasses = {
      'HC': 'hc',
      'OC': 'oc',
      'DC': 'dc'
    };
    const positionNames = {
      'HC': 'Head Coach',
      'OC': 'Off. Coord.',
      'DC': 'Def. Coord.'
    };
    const cls = positionClasses[position] || '';
    const name = positionNames[position] || position;
    return `<span class="coach-type-badge ${cls}">${name}</span>`;
  }

  /**
   * Update pagination controls
   */
  function updatePagination() {
    const prevBtn = document.getElementById('coachBrowserPrevPage');
    const nextBtn = document.getElementById('coachBrowserNextPage');
    const pageInfo = document.getElementById('coachBrowserPageInfo');

    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentResults.length < pageSize;
    if (pageInfo) pageInfo.textContent = `Page ${currentPage}`;
  }

  // Global function to view/edit a coach
  window.viewDbCoach = function(coachId, isCustom) {
    console.log('[CoachBrowser] View coach:', coachId, 'isCustom:', isCustom);
    if (window.openDbCoachCard) {
      window.openDbCoachCard(coachId, isCustom === true);
    } else {
      alert('Coach card not available');
    }
  };

  // Global function to refresh coach browser
  window.refreshCoachBrowser = function() {
    console.log('[CoachBrowser] Refreshing...');
    return performSearch();
  };

  // Expose init function globally
  window.initCoachBrowser = initCoachBrowser;

  // Initialize on DOMContentLoaded if not already done
  // Note: Actual initialization is triggered when coach tab is clicked
  console.log('[CoachBrowser] Module loaded');
})();
