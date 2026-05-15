/**
 * Portrait Manager - UI for managing custom player portraits
 *
 * Features:
 * - Import single or multiple portrait images
 * - Display portrait grid with thumbnails
 * - Select portraits for batch operations
 * - Export portraits as DDS files (PID.dds format)
 * - Filter portraits by year
 * - Assign portraits to players in the database
 */

(function() {
  'use strict';

  // State
  let portraits = [];
  let selectedPids = new Set();
  let selectedPlayerForAssignment = null;
  let searchTimeout = null;
  let savedScrollPosition = 0; // For preserving scroll when modal opens
  let viewMode = 'unassigned'; // 'all' or 'unassigned' (workspace mode)
  let sortBy = 'pid'; // 'pid', 'year', or 'name'

  // DOM Elements
  let grid = null;
  let yearFilter = null;
  let sortBySelect = null;
  let countDisplay = null;
  let importBtn = null;
  let importAndAssignBtn = null;
  let importMultipleBtn = null;
  let exportSelectedBtn = null;
  let exportAllBtn = null;
  let assignBtn = null;
  let viewModeToggle = null;

  // Assignment Modal Elements
  let assignModal = null;
  let assignPortraitPreview = null;
  let assignPortraitPid = null;
  let assignPlayerSearch = null;
  let assignPlayerResults = null;
  let assignSelectedPlayer = null;
  let assignPlayerName = null;
  let assignPlayerDetails = null;
  let assignPlayerSource = null;
  let confirmAssignBtn = null;

  /**
   * Initialize the Portrait Manager
   */
  async function initialize() {
    console.log('[PortraitManager] Initializing...');

    // Get DOM elements
    grid = document.getElementById('portraitGrid');
    yearFilter = document.getElementById('portraitYearFilter');
    countDisplay = document.getElementById('portraitCount');
    importBtn = document.getElementById('importPortraitBtn');
    importMultipleBtn = document.getElementById('importMultiplePortraitsBtn');
    exportSelectedBtn = document.getElementById('exportSelectedPortraitsBtn');
    exportAllBtn = document.getElementById('exportAllPortraitsBtn');
    assignBtn = document.getElementById('assignPortraitBtn');
    importAndAssignBtn = document.getElementById('importAndAssignBtn');
    viewModeToggle = document.getElementById('portraitViewModeToggle');
    sortBySelect = document.getElementById('portraitSortBy');

    // Get assignment modal elements
    assignModal = document.getElementById('portraitAssignModal');
    assignPortraitPreview = document.getElementById('assignPortraitPreview');
    assignPortraitPid = document.getElementById('assignPortraitPid');
    assignPlayerSearch = document.getElementById('assignPlayerSearch');
    assignPlayerResults = document.getElementById('assignPlayerResults');
    assignSelectedPlayer = document.getElementById('assignSelectedPlayer');
    assignPlayerName = document.getElementById('assignPlayerName');
    assignPlayerDetails = document.getElementById('assignPlayerDetails');
    assignPlayerSource = document.getElementById('assignPlayerSource');
    confirmAssignBtn = document.getElementById('confirmAssignBtn');

    if (!grid) {
      console.log('[PortraitManager] Portrait grid not found, skipping initialization');
      return;
    }

    // Bind event handlers
    bindEvents();

    // Load initial data
    await refreshPortraits();

    console.log('[PortraitManager] Initialized');
  }

  /**
   * Bind event handlers to buttons
   */
  function bindEvents() {
    if (importBtn) {
      importBtn.addEventListener('click', handleImportSingle);
    }

    if (importMultipleBtn) {
      importMultipleBtn.addEventListener('click', handleImportMultiple);
    }

    if (importAndAssignBtn) {
      importAndAssignBtn.addEventListener('click', handleImportAndAssign);
    }

    if (exportSelectedBtn) {
      exportSelectedBtn.addEventListener('click', handleExportSelected);
    }

    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', handleExportAll);
    }

    // Generate Sprite Sheets button
    const spriteSheetsBtn = document.getElementById('generateSpriteSheetsBtn');
    if (spriteSheetsBtn) {
      spriteSheetsBtn.addEventListener('click', handleGenerateSpriteSheets);
    }

    if (yearFilter) {
      yearFilter.addEventListener('change', handleYearFilterChange);
    }

    if (sortBySelect) {
      sortBySelect.addEventListener('change', handleSortByChange);
    }

    // View mode toggle (workspace vs all)
    if (viewModeToggle) {
      viewModeToggle.addEventListener('click', handleViewModeToggle);
      updateViewModeButton();
    }

    // Assign to Player button
    if (assignBtn) {
      assignBtn.addEventListener('click', handleOpenAssignModal);
    }

    // Assignment modal events
    const closeAssignModal = document.getElementById('closeAssignModal');
    const cancelAssignBtn = document.getElementById('cancelAssignBtn');

    if (closeAssignModal) {
      closeAssignModal.addEventListener('click', handleCloseAssignModal);
    }

    if (cancelAssignBtn) {
      cancelAssignBtn.addEventListener('click', handleCloseAssignModal);
    }

    if (confirmAssignBtn) {
      confirmAssignBtn.addEventListener('click', handleConfirmAssign);
    }

    // Quick confirm button (in the match box)
    const quickConfirmBtn = document.getElementById('quickConfirmBtn');
    if (quickConfirmBtn) {
      quickConfirmBtn.addEventListener('click', handleConfirmAssign);
    }

    // Player search input
    if (assignPlayerSearch) {
      assignPlayerSearch.addEventListener('input', handlePlayerSearchInput);
    }

    // Close modal on overlay click
    if (assignModal) {
      assignModal.addEventListener('click', (e) => {
        if (e.target === assignModal) {
          handleCloseAssignModal();
        }
      });
    }
  }

  /**
   * Refresh the portraits list from the database
   */
  async function refreshPortraits() {
    try {
      portraits = await window.electronAPI.customPortrait.list();
      console.log('[PortraitManager] Loaded portraits:', portraits.length);

      // Update year filter options (now async to fetch player draft years)
      await updateYearFilterOptions();

      // Render the grid
      await renderGrid();

      // Update count
      updateCount();
    } catch (error) {
      console.error('[PortraitManager] Error loading portraits:', error);
    }
  }

  /**
   * Update the year filter dropdown with available years
   */
  async function updateYearFilterOptions() {
    if (!yearFilter) return;

    const years = new Set();

    // If we have assigned portraits, fetch all players at once to get draft years
    const playerIds = portraits
      .filter(p => p.databasePlayerId)
      .map(p => p.databasePlayerId);

    // Build a map of playerId -> draftYear
    const playerYearMap = new Map();
    if (playerIds.length > 0) {
      try {
        // Search for all assigned players to get their draft years
        const response = await window.electronAPI.database.searchPlayers('', { limit: 5000 });
        const allPlayers = response?.players || response || [];
        allPlayers.forEach(player => {
          const id = player.internalId || player.id;
          if (player.draftClass) {
            const year = parseInt(player.draftClass, 10);
            if (year >= 1920 && year <= 2030) {
              playerYearMap.set(id, year);
            }
          }
        });
      } catch (e) {
        console.error('[PortraitManager] Error fetching player data for years:', e);
      }
    }

    // Now collect years from all sources
    for (const p of portraits) {
      // Use stored year if available
      if (p.year) {
        years.add(p.year);
        continue;
      }

      // Check filename for year
      if (p.originalFilename) {
        const yearMatch = p.originalFilename.match(/\b(19[2-9]\d|20[0-2]\d)\b/);
        if (yearMatch) {
          years.add(parseInt(yearMatch[1], 10));
          p._draftYear = parseInt(yearMatch[1], 10);
          continue;
        }
      }

      // Use assigned player's draft year
      if (p.databasePlayerId && playerYearMap.has(p.databasePlayerId)) {
        const draftYear = playerYearMap.get(p.databasePlayerId);
        years.add(draftYear);
        p._draftYear = draftYear;
      }
    }

    console.log('[PortraitManager] Year filter - found years:', Array.from(years));

    // Keep the current value
    const currentValue = yearFilter.value;

    // Clear and repopulate
    yearFilter.innerHTML = '<option value="">All Years</option>';

    Array.from(years).sort((a, b) => b - a).forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearFilter.appendChild(option);
    });

    // Restore value if still valid
    if (currentValue && Array.from(yearFilter.options).some(o => o.value === currentValue)) {
      yearFilter.value = currentValue;
    }
  }

  /**
   * Sort portraits based on current sort option
   */
  function sortPortraits(portraitArray) {
    const sorted = [...portraitArray]; // Don't mutate original

    switch (sortBy) {
      case 'year':
        // Sort by year (descending - newest first), then by PID
        sorted.sort((a, b) => {
          const yearA = a.year || 0;
          const yearB = b.year || 0;
          if (yearB !== yearA) return yearB - yearA; // Descending
          return a.pid - b.pid; // Secondary sort by PID
        });
        break;

      case 'name':
        // Sort by player name alphabetically (unassigned last)
        sorted.sort((a, b) => {
          const nameA = a.playerName || '';
          const nameB = b.playerName || '';
          // Unassigned (empty names) go last
          if (!nameA && nameB) return 1;
          if (nameA && !nameB) return -1;
          if (!nameA && !nameB) return a.pid - b.pid; // Both unassigned, sort by PID
          return nameA.localeCompare(nameB);
        });
        break;

      case 'pid':
      default:
        // Sort by PID (ascending)
        sorted.sort((a, b) => a.pid - b.pid);
        break;
    }

    return sorted;
  }

  /**
   * Render the portrait grid
   */
  async function renderGrid() {
    if (!grid) return;

    // Filter by year if selected
    const filterYear = yearFilter?.value ? parseInt(yearFilter.value) : null;
    let filtered = filterYear
      ? portraits.filter(p => {
          // Check stored year first
          if (p.year === filterYear) return true;
          // Check cached draft year from player
          if (p._draftYear === filterYear) return true;
          // Also check filename for year
          if (p.originalFilename) {
            const yearMatch = p.originalFilename.match(/\b(19[2-9]\d|20[0-2]\d)\b/);
            if (yearMatch && parseInt(yearMatch[1], 10) === filterYear) return true;
          }
          return false;
        })
      : portraits;

    // Filter by view mode (workspace shows only unassigned)
    if (viewMode === 'unassigned') {
      filtered = filtered.filter(p => !p.playerName);
    }

    // Sort portraits based on selected sort option
    filtered = sortPortraits(filtered);

    // Clear grid
    grid.innerHTML = '';

    // Different empty states for workspace vs all
    if (filtered.length === 0) {
      if (viewMode === 'unassigned') {
        const totalCount = portraits.length;
        const assignedCount = portraits.filter(p => p.playerName).length;
        grid.innerHTML = `
          <div class="portrait-empty-state">
            <span class="empty-icon">✅</span>
            <h3>Workspace Clear!</h3>
            <p>All ${assignedCount} portrait${assignedCount !== 1 ? 's' : ''} have been assigned.</p>
            <p class="empty-hint">Import more portraits or switch to "Show All" to see assigned ones.</p>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <div class="portrait-empty-state">
            <span class="empty-icon">🖼️</span>
            <h3>No Portraits${filterYear ? ` for ${filterYear}` : ''}</h3>
            <p>Click "Import Portrait" to add custom player portraits.</p>
            <p class="empty-hint">Portraits will be assigned PIDs starting at 12000.</p>
          </div>
        `;
      }
      return;
    }

    // Create cards for each portrait
    for (const portrait of filtered) {
      const card = await createPortraitCard(portrait);
      grid.appendChild(card);
    }
  }

  /**
   * Create a portrait card element
   */
  async function createPortraitCard(portrait) {
    const card = document.createElement('div');
    card.className = 'portrait-card';
    card.dataset.pid = portrait.pid;

    if (selectedPids.has(portrait.pid)) {
      card.classList.add('selected');
    }

    // Create image placeholder
    const img = document.createElement('img');
    img.alt = portrait.playerName || `PID ${portrait.pid}`;

    // Load image asynchronously
    try {
      const imageData = await window.electronAPI.customPortrait.get(portrait.pid);
      if (imageData) {
        img.src = imageData;
      } else {
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
      }
    } catch (error) {
      console.error('[PortraitManager] Error loading image for PID', portrait.pid, error);
      img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
    }

    card.appendChild(img);

    // PID badge
    const pidBadge = document.createElement('div');
    pidBadge.className = 'portrait-pid';
    pidBadge.textContent = `PID: ${portrait.pid}`;
    card.appendChild(pidBadge);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'portrait-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete portrait';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeletePortrait(portrait.pid);
    });
    card.appendChild(deleteBtn);

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'portrait-edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit portrait';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleOpenEditModal(portrait);
    });
    card.appendChild(editBtn);

    // Quick Assign button (on each card)
    const assignCardBtn = document.createElement('button');
    assignCardBtn.className = 'portrait-assign-btn';
    assignCardBtn.innerHTML = '👤';
    assignCardBtn.title = 'Assign to player';
    assignCardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleQuickAssign(portrait.pid);
    });
    card.appendChild(assignCardBtn);

    // Name (either assigned player name or parsed from filename)
    const displayName = portrait.playerName || parsePlayerNameFromFilename(portrait.originalFilename);
    if (displayName) {
      const nameRow = document.createElement('div');
      nameRow.className = 'portrait-name-row';

      const name = document.createElement('span');
      name.className = 'portrait-name';
      if (portrait.playerName) {
        name.textContent = portrait.playerName;
        name.title = 'Assigned to: ' + portrait.playerName;
      } else {
        name.textContent = '? ' + displayName;
        name.classList.add('portrait-name-suggested');
        name.title = 'Suggested from filename: ' + portrait.originalFilename;

        // Add quick confirm button for suggested names
        const quickConfirm = document.createElement('button');
        quickConfirm.className = 'portrait-quick-confirm';
        quickConfirm.textContent = '✓';
        quickConfirm.title = 'Confirm this match';
        quickConfirm.addEventListener('click', async (e) => {
          e.stopPropagation();
          await handleQuickConfirmFromCard(portrait.pid, displayName);
        });
        nameRow.appendChild(quickConfirm);
      }
      nameRow.insertBefore(name, nameRow.firstChild);
      card.appendChild(nameRow);
    }

    // Year
    if (portrait.year) {
      const year = document.createElement('div');
      year.className = 'portrait-year';
      year.textContent = portrait.year;
      card.appendChild(year);
    }

    // Click to select
    card.addEventListener('click', () => handleCardClick(portrait.pid));

    return card;
  }

  /**
   * Handle clicking on a portrait card (toggle selection)
   */
  function handleCardClick(pid) {
    if (selectedPids.has(pid)) {
      selectedPids.delete(pid);
    } else {
      selectedPids.add(pid);
    }

    // Update card visual
    const card = grid.querySelector(`[data-pid="${pid}"]`);
    if (card) {
      card.classList.toggle('selected', selectedPids.has(pid));
    }

    // Update export button state
    updateExportButtonState();
  }

  /**
   * Update export selected button enabled state
   */
  function updateExportButtonState() {
    if (exportSelectedBtn) {
      exportSelectedBtn.disabled = selectedPids.size === 0;
    }
    // Also update assign button (only enabled when exactly 1 portrait selected)
    if (assignBtn) {
      assignBtn.disabled = selectedPids.size !== 1;
    }
  }

  /**
   * Update the portrait count display
   */
  function updateCount() {
    if (countDisplay) {
      const total = portraits.length;
      const unassigned = portraits.filter(p => !p.playerName).length;
      const assigned = total - unassigned;

      if (viewMode === 'unassigned') {
        countDisplay.textContent = `${unassigned} to assign (${assigned}/${total} done)`;
      } else {
        countDisplay.textContent = `${total} portrait${total !== 1 ? 's' : ''} (${assigned} assigned)`;
      }
    }
  }

  /**
   * Handle import single portrait
   */
  async function handleImportSingle() {
    try {
      const year = yearFilter?.value ? parseInt(yearFilter.value) : null;
      const result = await window.electronAPI.customPortrait.importDialog();

      if (result.canceled) {
        return;
      }

      if (result.success) {
        showToast(`Portrait imported! PID: ${result.pid}`, 'success');
        await refreshPortraits();
      } else {
        showToast(`Import failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[PortraitManager] Import error:', error);
      showToast(`Import failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle import multiple portraits
   */
  async function handleImportMultiple() {
    try {
      const year = yearFilter?.value ? parseInt(yearFilter.value) : null;
      const result = await window.electronAPI.customPortrait.importMultipleDialog({ year });

      if (result.canceled) {
        return;
      }

      if (result.imported > 0) {
        showToast(`Imported ${result.imported} portrait${result.imported !== 1 ? 's' : ''}! Click 👤 on each to assign.`, 'success');
        await refreshPortraits();
      }

      if (result.errors && result.errors.length > 0) {
        console.error('[PortraitManager] Import errors:', result.errors);
        showToast(`${result.errors.length} file(s) failed to import`, 'warning');
      }
    } catch (error) {
      console.error('[PortraitManager] Import error:', error);
      showToast(`Import failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle import and assign (imports portrait then opens assignment modal)
   */
  async function handleImportAndAssign() {
    try {
      const result = await window.electronAPI.customPortrait.importDialog();

      if (result.canceled) {
        return;
      }

      if (result.success && result.pid) {
        showToast(`Portrait imported! PID: ${result.pid}`, 'success');
        await refreshPortraits();

        // Select the newly imported portrait
        selectedPids.clear();
        selectedPids.add(result.pid);
        updateExportButtonState();

        // Update visual selection
        await renderGrid();

        // Open the assignment modal for this portrait
        await handleOpenAssignModal();
      } else {
        showToast(`Import failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[PortraitManager] Import & Assign error:', error);
      showToast(`Import failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle export selected portraits
   */
  async function handleExportSelected() {
    if (selectedPids.size === 0) {
      showToast('No portraits selected', 'warning');
      return;
    }

    try {
      const pids = Array.from(selectedPids);
      console.log('[PortraitManager] Exporting selected PIDs:', pids);
      const result = await window.electronAPI.customPortrait.exportBatch(pids);
      console.log('[PortraitManager] Export result:', result);

      if (result.canceled) {
        return;
      }

      if (result.success) {
        showToast(`Exported ${result.exported} portrait${result.exported !== 1 ? 's' : ''} as DDS!`, 'success');
      } else {
        console.error('[PortraitManager] Export errors:', result.errors);
        showToast(`Export completed with ${result.failed} failure(s): ${result.errors?.[0] || 'Unknown error'}`, 'warning');
      }
    } catch (error) {
      console.error('[PortraitManager] Export error:', error);
      showToast(`Export failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle export all portraits
   */
  async function handleExportAll() {
    if (portraits.length === 0) {
      showToast('No portraits to export', 'warning');
      return;
    }

    try {
      console.log('[PortraitManager] Exporting all portraits...');
      const result = await window.electronAPI.customPortrait.exportAll();
      console.log('[PortraitManager] Export all result:', result);

      if (result.canceled) {
        return;
      }

      if (result.success) {
        showToast(`Exported ${result.exported} portrait${result.exported !== 1 ? 's' : ''} as DDS!`, 'success');
      } else {
        console.error('[PortraitManager] Export errors:', result.errors);
        showToast(`Export completed with ${result.failed} failure(s): ${result.errors?.[0] || 'Unknown error'}`, 'warning');
      }
    } catch (error) {
      console.error('[PortraitManager] Export error:', error);
      showToast(`Export failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle sprite sheet generation
   * Creates PNG sprite sheets (10x10 grid, 256x256 each) and atlas JSON
   */
  async function handleGenerateSpriteSheets() {
    if (portraits.length === 0) {
      showToast('No portraits to generate sprite sheets from', 'warning');
      return;
    }

    try {
      console.log('[PortraitManager] Generating sprite sheets...');
      showToast('Generating sprite sheets... Please wait.', 'info');

      // Get current year filter if set
      const yearFilterEl = document.getElementById('portraitYearFilter');
      const year = yearFilterEl?.value ? parseInt(yearFilterEl.value) : undefined;

      const options = {
        year,
        prefix: year ? `portraits-${year}` : 'custom-portraits'
      };

      const result = await window.electronAPI.customPortrait.generateSpriteSheets(options);
      console.log('[PortraitManager] Sprite sheet generation result:', result);

      if (result.canceled) {
        return;
      }

      if (result.success) {
        if (result.sheetsGenerated === 0) {
          showToast('No portraits to generate (check year filter)', 'warning');
        } else {
          showToast(
            `Generated ${result.sheetsGenerated} sprite sheet${result.sheetsGenerated !== 1 ? 's' : ''} with atlas!`,
            'success'
          );
        }
      } else {
        console.error('[PortraitManager] Sprite sheet generation error:', result.error);
        showToast(`Generation failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[PortraitManager] Sprite sheet generation error:', error);
      showToast(`Generation failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle year filter change
   */
  async function handleYearFilterChange() {
    await renderGrid();
  }

  /**
   * Handle sort by change
   */
  async function handleSortByChange() {
    sortBy = sortBySelect?.value || 'pid';
    console.log('[PortraitManager] Sort changed to:', sortBy);
    await renderGrid();
  }

  /**
   * Handle view mode toggle (workspace vs all)
   */
  async function handleViewModeToggle() {
    viewMode = viewMode === 'unassigned' ? 'all' : 'unassigned';
    updateViewModeButton();
    await renderGrid();
    updateCount();
  }

  /**
   * Update view mode button text
   */
  function updateViewModeButton() {
    if (viewModeToggle) {
      if (viewMode === 'unassigned') {
        viewModeToggle.innerHTML = '<i class="bi bi-eye"></i> Show All';
        viewModeToggle.title = 'Show all portraits (including assigned)';
      } else {
        viewModeToggle.innerHTML = '<i class="bi bi-inbox"></i> Workspace';
        viewModeToggle.title = 'Show only unassigned portraits';
      }
    }
  }

  /**
   * Handle delete portrait
   */
  async function handleDeletePortrait(pid) {
    if (!confirm(`Delete portrait PID ${pid}?`)) {
      return;
    }

    try {
      await window.electronAPI.customPortrait.delete(pid);
      selectedPids.delete(pid);
      showToast(`Deleted portrait PID ${pid}`, 'success');
      await refreshPortraits();
    } catch (error) {
      console.error('[PortraitManager] Delete error:', error);
      showToast(`Delete failed: ${error.message}`, 'error');
    }
  }

  /**
   * Show a toast notification
   */
  function showToast(message, type = 'info') {
    // Use existing toast system if available
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }

    // Fallback toast
    console.log(`[Toast ${type}] ${message}`);

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // =============================================
  // PORTRAIT ASSIGNMENT FUNCTIONS
  // =============================================

  /**
   * Parse player name from filename
   * Handles formats like:
   * - "Tom Brady.png" → "Tom Brady"
   * - "Brady_Tom.jpg" → "Brady Tom"
   * - "tom-brady.png" → "tom brady"
   * - "12345_John_Smith.png" → "John Smith" (strips leading numbers)
   */
  function parsePlayerNameFromFilename(filename) {
    if (!filename) return '';

    // Remove file extension
    let name = filename.replace(/\.[^.]+$/, '');

    // Remove leading numbers/underscores (like "12345_")
    name = name.replace(/^\d+[_-]?/, '');

    // Replace underscores and dashes with spaces
    name = name.replace(/[_-]/g, ' ');

    // Clean up extra spaces
    name = name.replace(/\s+/g, ' ').trim();

    // If name looks like "LastName FirstName", try to flip it
    const parts = name.split(' ');
    if (parts.length === 2) {
      // Check if first part looks like last name (all caps or first letter caps)
      // Keep as is - user can adjust if needed
    }

    return name;
  }

  /**
   * Get portrait info including filename for a PID
   */
  function getPortraitInfo(pid) {
    return portraits.find(p => p.pid === pid);
  }

  /**
   * Quick assign - directly open assign modal for a specific portrait
   */
  async function handleQuickAssign(pid) {
    console.log('[PortraitManager] Quick assign for PID:', pid);

    // Select this portrait
    selectedPids.clear();
    selectedPids.add(pid);
    updateExportButtonState();

    // Update visual selection
    if (grid) {
      grid.querySelectorAll('.portrait-card').forEach(card => {
        card.classList.toggle('selected', parseInt(card.dataset.pid) === pid);
      });
    }

    // Open the assignment modal
    await openAssignModalForPid(pid);
  }

  /**
   * Open the portrait assignment modal for a specific PID
   */
  async function openAssignModalForPid(pid) {
    console.log('[PortraitManager] Opening assign modal for PID:', pid);

    // Reset state
    selectedPlayerForAssignment = null;
    if (assignPlayerSearch) assignPlayerSearch.value = '';
    if (assignPlayerResults) assignPlayerResults.innerHTML = '';
    if (assignSelectedPlayer) assignSelectedPlayer.style.display = 'none';
    if (confirmAssignBtn) confirmAssignBtn.disabled = true;

    // Set portrait preview
    if (assignPortraitPid) {
      assignPortraitPid.textContent = `PID: ${pid}`;
    }

    // Load portrait image
    if (assignPortraitPreview) {
      try {
        const imageData = await window.electronAPI.customPortrait.get(pid);
        assignPortraitPreview.src = imageData || '';
      } catch (error) {
        console.error('[PortraitManager] Error loading preview:', error);
      }
    }

    // Show modal
    if (assignModal) {
      assignModal.style.display = 'flex';
    }

    // Try to auto-search based on filename
    const portraitInfo = getPortraitInfo(pid);
    if (portraitInfo && portraitInfo.originalFilename) {
      const suggestedName = parsePlayerNameFromFilename(portraitInfo.originalFilename);
      console.log('[PortraitManager] Auto-search from filename:', portraitInfo.originalFilename, '->', suggestedName);

      if (suggestedName && suggestedName.length >= 2) {
        // Pre-fill the search input
        if (assignPlayerSearch) {
          assignPlayerSearch.value = suggestedName;
        }

        // Auto-search and pre-select best match
        await searchPlayersAndAutoSelect(suggestedName);
      }
    }

    // Focus search input (after auto-search so user can modify)
    if (assignPlayerSearch) {
      setTimeout(() => {
        assignPlayerSearch.focus();
        assignPlayerSearch.select(); // Select text so user can easily type over it
      }, 100);
    }
  }

  /**
   * Search for players and auto-select the best match
   */
  async function searchPlayersAndAutoSelect(query) {
    if (!assignPlayerResults) return;

    assignPlayerResults.innerHTML = '<div class="search-loading">Searching...</div>';

    try {
      // Search both database players and custom players
      const [dbResult, customResult] = await Promise.all([
        window.electronAPI.database.searchPlayers(query, { limit: 20 }),
        window.electronAPI.database.searchCustomPlayers(query, 20)
      ]);

      const results = [];

      // Add database players
      if (dbResult.success && dbResult.players) {
        dbResult.players.forEach(p => {
          results.push({
            id: p.internalId,
            name: `${p.firstName} ${p.lastName}`,
            position: p.position,
            team: p.team || '-',
            years: p.draftClass ? `${p.draftClass}-${p.careerTo || 'present'}` : '-',
            source: 'database',
            currentPid: p.pid
          });
        });
      }

      // Add custom players
      if (customResult.success && customResult.data) {
        customResult.data.forEach(p => {
          results.push({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            position: p.position,
            team: p.team || '-',
            years: p.draftYear ? `${p.draftYear}` : '-',
            source: 'custom',
            currentPid: p.pid
          });
        });
      }

      renderPlayerResults(results);

      // Auto-select the first result if it's a good match
      if (results.length > 0) {
        const firstResult = assignPlayerResults.querySelector('.assign-player-result');
        if (firstResult) {
          // Check if the name is a close match (case-insensitive)
          const resultName = results[0].name.toLowerCase();
          const searchName = query.toLowerCase();

          // Auto-select if:
          // 1. Names match exactly, OR
          // 2. Search query is contained in result name, OR
          // 3. Result name is contained in search query
          if (resultName === searchName ||
              resultName.includes(searchName) ||
              searchName.includes(resultName.split(' ')[1] || '')) { // Last name match
            handleSelectPlayer(firstResult);
            console.log('[PortraitManager] Auto-selected:', results[0].name);
          }
        }
      }
    } catch (error) {
      console.error('[PortraitManager] Auto-search error:', error);
      assignPlayerResults.innerHTML = '<div class="search-error">Search failed</div>';
    }
  }

  /**
   * Open the portrait assignment modal (from toolbar button)
   */
  async function handleOpenAssignModal() {
    if (selectedPids.size !== 1) {
      showToast('Please select exactly one portrait to assign', 'warning');
      return;
    }

    const pid = Array.from(selectedPids)[0];
    await openAssignModalForPid(pid);
  }

  /**
   * Save grid scroll position before opening modal
   */
  function saveScrollPosition() {
    const container = grid?.closest('.portrait-grid-container') || grid?.parentElement;
    if (container) {
      savedScrollPosition = container.scrollTop;
    }
  }

  /**
   * Restore grid scroll position after closing modal
   */
  function restoreScrollPosition() {
    const container = grid?.closest('.portrait-grid-container') || grid?.parentElement;
    if (container && savedScrollPosition > 0) {
      container.scrollTop = savedScrollPosition;
    }
  }

  /**
   * Close the portrait assignment modal
   */
  function handleCloseAssignModal() {
    if (assignModal) {
      assignModal.style.display = 'none';
    }
    selectedPlayerForAssignment = null;
    // Restore scroll position when closing without assignment
    restoreScrollPosition();
  }

  /**
   * Handle player search input with debounce
   */
  function handlePlayerSearchInput(e) {
    // Get the raw value (don't trim while typing - user might be adding space before next word)
    const rawValue = e.target.value;
    const query = rawValue.trim();

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Clear results if query is too short
    if (query.length < 2) {
      if (assignPlayerResults) assignPlayerResults.innerHTML = '';
      return;
    }

    // Shorter debounce for more responsive typing (150ms instead of 300ms)
    searchTimeout = setTimeout(() => {
      searchPlayers(query);
    }, 150);
  }

  /**
   * Search for players by name
   */
  async function searchPlayers(query) {
    if (!assignPlayerResults) return;

    assignPlayerResults.innerHTML = '<div class="search-loading">Searching...</div>';

    try {
      // Search both database players and custom players
      const [dbResult, customResult] = await Promise.all([
        window.electronAPI.database.searchPlayers(query, { limit: 20 }),
        window.electronAPI.database.searchCustomPlayers(query, 20)
      ]);

      const results = [];

      // Add database players
      if (dbResult.success && dbResult.players) {
        dbResult.players.forEach(p => {
          results.push({
            id: p.internalId,
            name: `${p.firstName} ${p.lastName}`,
            position: p.position,
            team: p.team || '-',
            years: p.draftClass ? `${p.draftClass}-${p.careerTo || 'present'}` : '-',
            source: 'database',
            currentPid: p.pid
          });
        });
      }

      // Add custom players
      if (customResult.success && customResult.data) {
        customResult.data.forEach(p => {
          results.push({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            position: p.position,
            team: p.team || '-',
            years: p.draftYear ? `${p.draftYear}` : '-',
            source: 'custom',
            currentPid: p.pid
          });
        });
      }

      renderPlayerResults(results);
    } catch (error) {
      console.error('[PortraitManager] Search error:', error);
      assignPlayerResults.innerHTML = '<div class="search-error">Search failed</div>';
    }
  }

  /**
   * Render player search results
   */
  function renderPlayerResults(players) {
    if (!assignPlayerResults) return;

    if (players.length === 0) {
      // Show "No players found" with option to create new player
      const searchQuery = assignPlayerSearch?.value || '';
      assignPlayerResults.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #888;">
          <p style="margin: 0 0 12px 0;">No players found</p>
          <button onclick="window.portraitManager.createNewPlayer('${searchQuery.replace(/'/g, "\\'")}')"
                  style="padding: 10px 20px; background: #4a9eff; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 14px; display: inline-flex; align-items: center; gap: 6px;">
            <span style="font-size: 18px;">+</span> Create New Player
          </button>
        </div>
      `;
      return;
    }

    assignPlayerResults.innerHTML = players.map(p => {
      const hasRealPortrait = p.currentPid && p.currentPid > 0 && p.currentPid < 12000;
      const portraitWarning = hasRealPortrait ? `<span class="has-portrait-badge" title="Has in-game portrait (PID: ${p.currentPid})">📸</span>` : '';
      return `
      <div class="assign-player-result ${hasRealPortrait ? 'has-real-portrait' : ''}" data-id="${p.id}" data-source="${p.source}" data-name="${p.name}" data-position="${p.position}" data-team="${p.team}" data-current-pid="${p.currentPid || ''}">
        <div class="result-player-info">
          <span class="player-name">${p.name} ${portraitWarning}</span>
          <span class="player-info">${p.position} | ${p.team} | ${p.years}</span>
        </div>
        <div class="result-actions">
          <span class="player-source-badge ${p.source}">${p.source === 'custom' ? 'Custom' : 'DB'}</span>
          <button class="result-confirm-btn" title="Assign to this player">✓</button>
        </div>
      </div>
    `}).join('');

    // Add click handlers to results - clicking the row selects, clicking confirm button assigns immediately
    assignPlayerResults.querySelectorAll('.assign-player-result').forEach(el => {
      // Click row to select
      el.addEventListener('click', (e) => {
        if (!e.target.classList.contains('result-confirm-btn')) {
          handleSelectPlayer(el);
        }
      });
      // Click confirm button to assign immediately
      el.querySelector('.result-confirm-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleSelectPlayer(el);
        handleConfirmAssign();
      });
    });
  }

  /**
   * Handle selecting a player from search results
   */
  function handleSelectPlayer(el) {
    const id = parseInt(el.dataset.id);
    const source = el.dataset.source;
    const name = el.dataset.name;
    const position = el.dataset.position;
    const team = el.dataset.team;
    const currentPid = el.dataset.currentPid ? parseInt(el.dataset.currentPid) : null;

    console.log('[PortraitManager] Selected player:', { id, source, name, currentPid });

    // Store selected player (including existing PID for warning check)
    selectedPlayerForAssignment = { id, source, name, existingPid: currentPid };

    // Update selected player display
    if (assignPlayerName) assignPlayerName.textContent = name;
    if (assignPlayerDetails) assignPlayerDetails.textContent = `${position} | ${team}`;
    if (assignPlayerSource) {
      assignPlayerSource.textContent = source === 'custom' ? 'Custom Player' : 'Database Player';
      if (currentPid) {
        assignPlayerSource.textContent += ` (Current PID: ${currentPid})`;
      }
    }

    // Show selected player section
    if (assignSelectedPlayer) assignSelectedPlayer.style.display = 'block';

    // Enable confirm button
    if (confirmAssignBtn) confirmAssignBtn.disabled = false;

    // Highlight selected result
    assignPlayerResults.querySelectorAll('.assign-player-result').forEach(r => {
      r.classList.toggle('selected', r === el);
    });
  }

  /**
   * Handle quick confirm from portrait card (one-click assign for suggested names)
   * @param {number} pid - Portrait PID
   * @param {string} suggestedName - Name parsed from filename
   */
  async function handleQuickConfirmFromCard(pid, suggestedName) {
    console.log('[PortraitManager] Quick confirm from card:', pid, suggestedName);

    if (!suggestedName || suggestedName.length < 2) {
      showToast('No suggested name to confirm', 'warning');
      return;
    }

    try {
      // Search for players matching the suggested name
      const [dbResult, customResult] = await Promise.all([
        window.electronAPI.database.searchPlayers(suggestedName, { limit: 10 }),
        window.electronAPI.database.searchCustomPlayers(suggestedName, 10)
      ]);

      const results = [];

      // Add database players
      if (dbResult.success && dbResult.players) {
        dbResult.players.forEach(p => {
          results.push({
            id: p.internalId,
            name: `${p.firstName} ${p.lastName}`,
            source: 'database',
            existingPid: p.pid || null
          });
        });
      }

      // Add custom players
      if (customResult.success && customResult.data) {
        customResult.data.forEach(p => {
          results.push({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            source: 'custom',
            existingPid: p.pid || null
          });
        });
      }

      // Check for exact match first
      const exactMatch = results.find(r =>
        r.name.toLowerCase() === suggestedName.toLowerCase()
      );

      if (exactMatch) {
        // Exact match found - assign directly (with warning check)
        await assignPortraitToPlayer(pid, exactMatch.id, exactMatch.source, exactMatch.name, exactMatch.existingPid);
        return;
      }

      if (results.length === 1) {
        // Only one result - assign directly (with warning check)
        await assignPortraitToPlayer(pid, results[0].id, results[0].source, results[0].name, results[0].existingPid);
      } else if (results.length === 0) {
        // No results - save scroll position and open modal for manual search
        saveScrollPosition();
        showToast(`No player found for "${suggestedName}". Opening search...`, 'warning');
        await handleQuickAssign(pid);
      } else {
        // Multiple results - save scroll position and open modal to select
        saveScrollPosition();
        showToast(`Multiple players match "${suggestedName}". Please select one.`, 'info');
        await handleQuickAssign(pid);
      }
    } catch (error) {
      console.error('[PortraitManager] Quick confirm error:', error);
      showToast(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Assign a portrait to a player (helper for quick confirm)
   * @param {number} pid - Custom portrait PID to assign
   * @param {number} playerId - Player ID
   * @param {string} source - 'database' or 'custom'
   * @param {string} playerName - Player name for display
   * @param {number|null} existingPid - Player's current PID (if known)
   * @param {boolean} skipWarning - Skip the existing PID warning
   */
  async function assignPortraitToPlayer(pid, playerId, source, playerName, existingPid = null, skipWarning = false) {
    console.log('[PortraitManager] Assigning PID', pid, 'to', playerName, '(source:', source, ', existingPid:', existingPid, ')');

    // Check if player already has a portrait assigned
    if (!skipWarning && existingPid && existingPid > 0) {
      const isInGamePortrait = existingPid < 12000;
      const warningMessage = isInGamePortrait
        ? `${playerName} already has an in-game portrait (PID: ${existingPid}).\n\nAssigning this custom portrait will replace their official portrait.\n\nContinue?`
        : `${playerName} already has a custom portrait assigned (PID: ${existingPid}).\n\nAssigning this new portrait will replace the existing one.\n\nContinue?`;

      if (!confirm(`⚠️ Warning: ${warningMessage}`)) {
        showToast('Assignment cancelled', 'info');
        return false;
      }
    }

    try {
      if (source === 'custom') {
        // Update custom player's PID (field name is maddenPid, not pid)
        await window.electronAPI.database.updateCustomPlayer(playerId, { maddenPid: pid });
        // Update portrait metadata with player name only (custom players don't have database IDs)
        await window.electronAPI.customPortrait.updateMetadata(pid, { playerName: playerName });
      } else {
        // Update database player's appearance (PID)
        await window.electronAPI.database.saveAppearanceEdit(playerId, { maddenPid: pid });
        // Update portrait metadata with player name AND database player ID (for generator lookup)
        await window.electronAPI.customPortrait.updateMetadata(pid, {
          playerName: playerName,
          databasePlayerId: playerId
        });
      }

      showToast(`Portrait assigned to ${playerName}!`, 'success');

      // Update just this card instead of full refresh (preserves scroll position)
      await updateSingleCard(pid, playerName);
      return true;
    } catch (error) {
      console.error('[PortraitManager] Assignment error:', error);
      showToast(`Assignment failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Update a single portrait card without full refresh (preserves scroll position)
   */
  async function updateSingleCard(pid, playerName) {
    // Update the local portraits data
    const portrait = portraits.find(p => p.pid === pid);
    if (portrait) {
      portrait.playerName = playerName;
    }

    // Find the card in the DOM
    const card = grid?.querySelector(`[data-pid="${pid}"]`);
    if (!card) return;

    // In workspace mode, remove the card with animation (it's now assigned)
    if (viewMode === 'unassigned') {
      card.style.transition = 'all 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.8)';
      setTimeout(() => {
        card.remove();
        updateCount();
        // Check if grid is now empty
        const remaining = grid.querySelectorAll('.portrait-card');
        if (remaining.length === 0) {
          renderGrid(); // Show empty state
        }
      }, 300);
      return;
    }

    // In "all" mode, just update the card in place
    const existingNameRow = card.querySelector('.portrait-name-row');
    const existingName = card.querySelector('.portrait-name');

    if (existingNameRow) {
      // Remove the quick confirm button (no longer needed)
      const quickConfirm = existingNameRow.querySelector('.portrait-quick-confirm');
      if (quickConfirm) {
        quickConfirm.remove();
      }

      // Update the name display
      const nameSpan = existingNameRow.querySelector('.portrait-name');
      if (nameSpan) {
        nameSpan.textContent = playerName;
        nameSpan.classList.remove('portrait-name-suggested');
        nameSpan.title = 'Assigned to: ' + playerName;
      }
    } else if (existingName) {
      // Name exists but not in row format
      existingName.textContent = playerName;
      existingName.classList.remove('portrait-name-suggested');
      existingName.title = 'Assigned to: ' + playerName;
    }
  }

  /**
   * Handle confirming the portrait assignment (from modal)
   */
  async function handleConfirmAssign() {
    if (!selectedPlayerForAssignment || selectedPids.size !== 1) {
      showToast('Please select a portrait and player', 'warning');
      return;
    }

    const pid = Array.from(selectedPids)[0];
    const { id, source, name, existingPid } = selectedPlayerForAssignment;

    // Use common assignment function (includes warning for existing PIDs)
    const success = await assignPortraitToPlayer(pid, id, source, name, existingPid);

    if (success) {
      handleCloseAssignModal();
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // =============================================
  // CREATE NEW PLAYER FROM PORTRAIT MANAGER
  // =============================================

  let pendingPortraitPid = null; // PID waiting to be assigned to new player

  /**
   * Open the full Database Player Card in create mode, pre-filled with portrait name and PID
   */
  async function createNewPlayer(searchQuery) {
    console.log('[PortraitManager] Create new player from search:', searchQuery);

    // Store the current portrait PID we want to assign (from selectedPids)
    if (selectedPids.size !== 1) {
      showToast('No portrait selected', 'warning');
      return;
    }
    pendingPortraitPid = Array.from(selectedPids)[0];

    // Get the portrait's existing name or parse from filename
    const portraitInfo = getPortraitInfo(pendingPortraitPid);
    let playerName = searchQuery.trim();

    // Prefer portrait's assigned name, then filename, then search query
    if (portraitInfo) {
      if (portraitInfo.playerName) {
        playerName = portraitInfo.playerName;
      } else if (portraitInfo.originalFilename) {
        const parsedName = parsePlayerNameFromFilename(portraitInfo.originalFilename);
        if (parsedName) playerName = parsedName;
      }
    }

    // Try to parse name into first/last
    const nameParts = playerName.split(/\s+/);
    const suggestedFirst = nameParts[0] || '';
    const suggestedLast = nameParts.slice(1).join(' ') || '';

    // Close the assignment modal first
    handleCloseAssignModal();

    // Check if the full Database Player Card creator is available
    if (typeof window.createNewDbPlayer !== 'function') {
      showToast('Player editor not available. Please open the Database Browser tab first.', 'error');
      return;
    }

    // Open the full Database Player Card in create mode
    await window.createNewDbPlayer();

    // Wait a moment for the form to render, then pre-fill the fields
    setTimeout(() => {
      // Pre-fill first name
      const firstNameInput = document.getElementById('dbPlayerFirstName');
      if (firstNameInput && suggestedFirst) {
        firstNameInput.value = suggestedFirst;
      }

      // Pre-fill last name
      const lastNameInput = document.getElementById('dbPlayerLastName');
      if (lastNameInput && suggestedLast) {
        lastNameInput.value = suggestedLast;
      }

      // Pre-fill the PID with the portrait's PID
      const pidInput = document.getElementById('dbPlayerPID');
      if (pidInput && pendingPortraitPid) {
        pidInput.value = pendingPortraitPid;
      }

      // Update the header to show we're creating from portrait
      const nameEl = document.getElementById('dbPlayerCardName');
      if (nameEl) {
        nameEl.textContent = 'New Custom Player (from Portrait)';
      }

      // Load the portrait preview
      if (pendingPortraitPid && typeof window.loadPlayerPortrait === 'function') {
        window.loadPlayerPortrait(pendingPortraitPid);
      }

      // Focus on first name field
      if (firstNameInput) {
        firstNameInput.focus();
        if (!suggestedFirst) {
          // If no name suggested, keep focus on first name
        } else if (!suggestedLast) {
          // If first name filled but no last name, focus last name
          if (lastNameInput) lastNameInput.focus();
        }
      }

      console.log('[PortraitManager] Pre-filled form with:', {
        firstName: suggestedFirst,
        lastName: suggestedLast,
        pid: pendingPortraitPid
      });
    }, 200);

    // Keep the pending PID so Database Player Card can update portrait metadata after save
    // It will be cleared after successful save
    console.log('[PortraitManager] Pending portrait PID for assignment:', pendingPortraitPid);
  }

  /**
   * Close create player modal (legacy - kept for compatibility)
   */
  function closeCreateModal() {
    const modal = document.getElementById('createPlayerModal');
    if (modal) modal.remove();
    pendingPortraitPid = null;
  }

  /**
   * Confirm and create the new player (legacy - kept for compatibility)
   */
  async function confirmCreatePlayer() {
    // This is now handled by the Database Player Card's save function
    showToast('Use the Save button in the Player Editor', 'info');
  }

  // =============================================
  // BUNDLED PORTRAITS EXPORT SECTION
  // =============================================

  let bundledSelectedPids = new Map(); // name -> pid

  /**
   * Initialize bundled portraits section
   */
  function initBundledPortraitsSection() {
    // Toggle section collapse
    const header = document.getElementById('bundledPortraitsHeader');
    if (header) {
      header.addEventListener('click', () => {
        const section = header.closest('.bundled-portraits-section');
        if (section) {
          section.classList.toggle('collapsed');
        }
      });
    }

    // Search button
    const searchBtn = document.getElementById('bundledSearchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', handleBundledSearch);
    }

    // Search input - enter key
    const searchInput = document.getElementById('bundledPortraitSearch');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleBundledSearch();
        }
      });
    }

    // Export selected button
    const exportBtn = document.getElementById('exportBundledSelectedBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', handleExportBundledSelected);
    }
  }

  /**
   * Search bundled portraits by name
   */
  async function handleBundledSearch() {
    const searchInput = document.getElementById('bundledPortraitSearch');
    const resultsGrid = document.getElementById('bundledPortraitResults');
    const query = searchInput?.value?.trim();

    if (!query || query.length < 2) {
      showToast('Please enter at least 2 characters to search', 'warning');
      return;
    }

    if (!resultsGrid) return;

    resultsGrid.innerHTML = '<div class="bundled-empty-state"><p>Searching...</p></div>';
    bundledSelectedPids.clear();
    updateBundledExportButton();

    try {
      const result = await window.electronAPI.portrait.searchWithImages(query, 100);

      if (!result.success || !result.portraits || result.portraits.length === 0) {
        resultsGrid.innerHTML = '<div class="bundled-empty-state"><p>No portraits found matching "' + query + '"</p></div>';
        return;
      }

      // Render results
      resultsGrid.innerHTML = '';
      for (const portrait of result.portraits) {
        const card = document.createElement('div');
        card.className = 'bundled-portrait-card';
        card.dataset.name = portrait.name;
        card.dataset.pid = portrait.pid || '';

        const img = document.createElement('img');
        img.src = portrait.imageData;
        img.alt = portrait.name;
        card.appendChild(img);

        const name = document.createElement('div');
        name.className = 'portrait-name';
        name.textContent = portrait.pid ? `${portrait.name} (${portrait.pid})` : portrait.name;
        name.title = portrait.pid ? `PID: ${portrait.pid}` : portrait.name;
        card.appendChild(name);

        // Only allow selection if portrait has a PID
        if (portrait.pid) {
          card.addEventListener('click', () => {
            if (bundledSelectedPids.has(portrait.name)) {
              bundledSelectedPids.delete(portrait.name);
              card.classList.remove('selected');
            } else {
              bundledSelectedPids.set(portrait.name, portrait.pid);
              card.classList.add('selected');
            }
            updateBundledExportButton();
          });
        } else {
          card.style.opacity = '0.5';
          card.title = 'No PID mapping available for this portrait';
        }

        resultsGrid.appendChild(card);
      }

      const exportableCount = result.portraits.filter(p => p.pid).length;
      showToast(`Found ${result.portraits.length} portrait(s), ${exportableCount} exportable`, 'success');
    } catch (error) {
      console.error('[PortraitManager] Bundled search error:', error);
      resultsGrid.innerHTML = '<div class="bundled-empty-state"><p>Search failed: ' + error.message + '</p></div>';
    }
  }

  /**
   * Update bundled export button state
   */
  function updateBundledExportButton() {
    const exportBtn = document.getElementById('exportBundledSelectedBtn');
    if (exportBtn) {
      exportBtn.disabled = bundledSelectedPids.size === 0;
      if (bundledSelectedPids.size > 0) {
        exportBtn.textContent = `Export ${bundledSelectedPids.size} Selected as DDS`;
      } else {
        exportBtn.innerHTML = '<span class="btn-icon">💾</span> Export Selected as DDS';
      }
    }
  }

  /**
   * Export selected bundled portraits as DDS
   */
  async function handleExportBundledSelected() {
    if (bundledSelectedPids.size === 0) {
      showToast('No portraits selected', 'warning');
      return;
    }

    try {
      // Get PIDs from our selection map
      const pidsToExport = Array.from(bundledSelectedPids.values());

      console.log('[PortraitManager] Exporting bundled PIDs:', pidsToExport);
      showToast(`Exporting ${pidsToExport.length} portrait(s)... Please select a folder.`, 'info');

      // Use batch export
      const result = await window.electronAPI.portrait.exportBatchDds(pidsToExport);

      if (result.canceled) {
        return;
      }

      if (result.success) {
        showToast(`Exported ${result.exported} portrait${result.exported !== 1 ? 's' : ''} as DDS!`, 'success');

        // Clear selection after successful export
        bundledSelectedPids.clear();
        const grid = document.getElementById('bundledPortraitResults');
        if (grid) {
          grid.querySelectorAll('.bundled-portrait-card.selected').forEach(card => {
            card.classList.remove('selected');
          });
        }
        updateBundledExportButton();
      } else {
        console.error('[PortraitManager] Export errors:', result.errors);
        showToast(`Export completed with ${result.failed} failure(s): ${result.errors?.[0] || 'Unknown error'}`, 'warning');
      }
    } catch (error) {
      console.error('[PortraitManager] Export bundled error:', error);
      showToast(`Export failed: ${error.message}`, 'error');
    }
  }

  // Initialize bundled section when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBundledPortraitsSection);
  } else {
    initBundledPortraitsSection();
  }

  // =============================================
  // PORTRAIT MANAGER TAB SWITCHING
  // =============================================

  /**
   * Initialize portrait manager tabs (Players/Coaches)
   */
  function initPortraitManagerTabs() {
    const playerTabBtn = document.getElementById('playerPortraitTabBtn');
    const coachTabBtn = document.getElementById('coachPortraitTabBtn');
    const playerContent = document.getElementById('playerPortraitTabContent');
    const coachContent = document.getElementById('coachPortraitTabContent');

    if (playerTabBtn && coachTabBtn) {
      playerTabBtn.addEventListener('click', () => {
        playerTabBtn.classList.add('active');
        coachTabBtn.classList.remove('active');
        if (playerContent) playerContent.classList.add('active');
        if (coachContent) coachContent.classList.remove('active');
      });

      coachTabBtn.addEventListener('click', () => {
        coachTabBtn.classList.add('active');
        playerTabBtn.classList.remove('active');
        if (coachContent) coachContent.classList.add('active');
        if (playerContent) playerContent.classList.remove('active');
        // Initialize coach section if not already done
        initCoachPortraitSection();
      });
    }
  }

  // =============================================
  // COACH PORTRAIT SECTION
  // =============================================

  let coachBundledSelectedPids = new Map(); // name -> pid
  let coachSectionInitialized = false;

  /**
   * Initialize coach portrait section
   */
  function initCoachPortraitSection() {
    if (coachSectionInitialized) return;
    coachSectionInitialized = true;

    console.log('[PortraitManager] Initializing coach portrait section...');

    // Toggle section collapse
    const header = document.getElementById('coachBundledPortraitsHeader');
    if (header) {
      header.addEventListener('click', () => {
        const section = header.closest('.bundled-portraits-section');
        if (section) {
          section.classList.toggle('collapsed');
        }
      });
    }

    // Search button
    const searchBtn = document.getElementById('coachBundledSearchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', handleCoachBundledSearch);
    }

    // Search input - enter key
    const searchInput = document.getElementById('coachBundledPortraitSearch');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleCoachBundledSearch();
        }
      });
    }

    // Export selected button
    const exportBtn = document.getElementById('exportCoachBundledSelectedBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', handleExportCoachBundledSelected);
    }

    console.log('[PortraitManager] Coach portrait section initialized');
  }

  /**
   * Search coach portraits by name
   */
  async function handleCoachBundledSearch() {
    const searchInput = document.getElementById('coachBundledPortraitSearch');
    const resultsGrid = document.getElementById('coachBundledPortraitResults');
    const query = searchInput?.value?.trim();

    if (!query || query.length < 2) {
      showToast('Please enter at least 2 characters to search', 'warning');
      return;
    }

    if (!resultsGrid) return;

    resultsGrid.innerHTML = '<div class="bundled-empty-state" style="grid-column: 1 / -1;"><p>Loading coach portraits...</p></div>';
    coachBundledSelectedPids.clear();
    updateCoachBundledExportButton();

    try {
      // Get all coach portraits with images from the sprite sheets
      const portraitsResult = await window.electronAPI.coachPortrait.getAllWithImages(500);

      if (!portraitsResult.success || !portraitsResult.portraits || portraitsResult.portraits.length === 0) {
        resultsGrid.innerHTML = '<div class="bundled-empty-state" style="grid-column: 1 / -1;"><p>No coach portraits found in sprite sheets</p></div>';
        return;
      }

      // Get coach names from database
      const coachResult = await window.electronAPI.coachDatabase.getAllCoaches();
      const coachNameMap = new Map();

      if (coachResult.success && coachResult.data) {
        for (const coach of coachResult.data) {
          if (coach.pid) {
            coachNameMap.set(coach.pid, coach.displayName || `${coach.firstName || ''} ${coach.lastName || ''}`.trim());
          }
        }
      }

      // Add names to portraits and filter by query
      const queryLower = query.toLowerCase();
      const matchingPortraits = portraitsResult.portraits
        .map(p => ({
          ...p,
          name: coachNameMap.get(p.pid) || `Coach PID ${p.pid}`
        }))
        .filter(p => p.name.toLowerCase().includes(queryLower));

      if (matchingPortraits.length === 0) {
        resultsGrid.innerHTML = '<div class="bundled-empty-state" style="grid-column: 1 / -1;"><p>No coaches found matching "' + query + '"</p></div>';
        return;
      }

      // Render results
      resultsGrid.innerHTML = '';

      for (const portrait of matchingPortraits.slice(0, 100)) {
        const card = document.createElement('div');
        card.className = 'bundled-portrait-card';
        card.dataset.name = portrait.name;
        card.dataset.pid = portrait.pid;

        const img = document.createElement('img');
        img.src = portrait.imageData;
        img.alt = portrait.name;
        card.appendChild(img);

        const name = document.createElement('div');
        name.className = 'portrait-name';
        name.textContent = `${portrait.name} (${portrait.pid})`;
        name.title = `PID: ${portrait.pid}`;
        card.appendChild(name);

        card.addEventListener('click', () => {
          if (coachBundledSelectedPids.has(portrait.name)) {
            coachBundledSelectedPids.delete(portrait.name);
            card.classList.remove('selected');
          } else {
            coachBundledSelectedPids.set(portrait.name, portrait.pid);
            card.classList.add('selected');
          }
          updateCoachBundledExportButton();
        });

        resultsGrid.appendChild(card);
      }

      showToast(`Found ${matchingPortraits.length} coach portrait(s) matching "${query}"`, 'success');
    } catch (error) {
      console.error('[PortraitManager] Coach search error:', error);
      resultsGrid.innerHTML = '<div class="bundled-empty-state" style="grid-column: 1 / -1;"><p>Search failed: ' + error.message + '</p></div>';
    }
  }

  /**
   * Update coach bundled export button state
   */
  function updateCoachBundledExportButton() {
    const exportBtn = document.getElementById('exportCoachBundledSelectedBtn');
    if (exportBtn) {
      exportBtn.disabled = coachBundledSelectedPids.size === 0;
      if (coachBundledSelectedPids.size > 0) {
        exportBtn.textContent = `Export ${coachBundledSelectedPids.size} Selected as DDS`;
      } else {
        exportBtn.innerHTML = '<span class="btn-icon">💾</span> Export Selected as DDS';
      }
    }
  }

  /**
   * Export selected coach portraits as DDS
   */
  async function handleExportCoachBundledSelected() {
    if (coachBundledSelectedPids.size === 0) {
      showToast('No coach portraits selected', 'warning');
      return;
    }

    try {
      const pidsToExport = Array.from(coachBundledSelectedPids.values());

      console.log('[PortraitManager] Exporting coach PIDs:', pidsToExport);
      showToast(`Exporting ${pidsToExport.length} coach portrait(s)... Please select a folder.`, 'info');

      // Use coach portrait export (we need to add this handler)
      const result = await window.electronAPI.coachPortrait.exportBatchDds(pidsToExport);

      if (result.canceled) {
        return;
      }

      if (result.success) {
        showToast(`Exported ${result.exported} coach portrait${result.exported !== 1 ? 's' : ''} as DDS!`, 'success');

        // Clear selection after successful export
        coachBundledSelectedPids.clear();
        const grid = document.getElementById('coachBundledPortraitResults');
        if (grid) {
          grid.querySelectorAll('.bundled-portrait-card.selected').forEach(card => {
            card.classList.remove('selected');
          });
        }
        updateCoachBundledExportButton();
      } else {
        console.error('[PortraitManager] Coach export errors:', result.errors);
        showToast(`Export completed with ${result.failed} failure(s): ${result.errors?.[0] || 'Unknown error'}`, 'warning');
      }
    } catch (error) {
      console.error('[PortraitManager] Coach export error:', error);
      showToast(`Export failed: ${error.message}`, 'error');
    }
  }

  // =============================================
  // CUSTOM COACH PORTRAIT MANAGEMENT (Workspace Style)
  // =============================================

  let coachSelectedPids = new Set();
  let coachViewMode = 'workspace'; // 'workspace' or 'all'
  let selectedCoachForAssignment = null;
  let coachWorkspaceSelectedPid = null;
  let coachWorkspaceSelectedCoachId = null;
  let coachPortraits = [];

  /**
   * Parse coach name from filename
   */
  function parseCoachNameFromFilename(filename) {
    if (!filename) return '';

    // Remove file extension
    let name = filename.replace(/\.[^.]+$/, '');

    // Remove leading numbers/underscores (like "12345_")
    name = name.replace(/^\d+[_-]?/, '');

    // Replace underscores and dashes with spaces
    name = name.replace(/[_-]/g, ' ');

    // Clean up extra spaces
    name = name.replace(/\s+/g, ' ').trim();

    return name;
  }

  /**
   * Initialize custom coach portrait section
   */
  function initCustomCoachPortraitSection() {
    console.log('[PortraitManager] Initializing custom coach portrait section...');

    // Import buttons
    document.getElementById('importCoachPortraitBtn')?.addEventListener('click', handleImportCoachPortrait);
    document.getElementById('importAndAssignCoachBtn')?.addEventListener('click', handleImportAndAssignCoach);
    document.getElementById('importMultipleCoachPortraitsBtn')?.addEventListener('click', handleImportMultipleCoachPortraits);

    // Export buttons
    document.getElementById('exportSelectedCoachPortraitsBtn')?.addEventListener('click', handleExportSelectedCoachPortraits);
    document.getElementById('exportAllCoachPortraitsBtn')?.addEventListener('click', handleExportAllCoachPortraits);

    // Assign button
    document.getElementById('assignCoachPortraitBtn')?.addEventListener('click', openCoachAssignModal);

    // Year filter
    document.getElementById('coachPortraitYearFilter')?.addEventListener('change', refreshCoachPortraits);

    // View mode toggle
    document.getElementById('coachPortraitViewModeToggle')?.addEventListener('click', toggleCoachViewMode);

    // Coach assignment modal
    document.getElementById('closeCoachAssignModal')?.addEventListener('click', closeCoachAssignModal);
    document.getElementById('cancelCoachAssignBtn')?.addEventListener('click', closeCoachAssignModal);
    document.getElementById('confirmCoachAssignBtn')?.addEventListener('click', confirmCoachAssignment);
    document.getElementById('quickConfirmCoachBtn')?.addEventListener('click', confirmCoachAssignment);

    // Coach search in assignment modal
    document.getElementById('assignCoachSearch')?.addEventListener('input', debounce(handleCoachSearchForAssignment, 300));

    // Load year filter options
    loadCoachYearFilterOptions();

    // Initial load
    refreshCoachPortraits();
  }

  /**
   * Load year filter options for coaches
   */
  async function loadCoachYearFilterOptions() {
    try {
      const years = await window.electronAPI.customCoachPortrait.getAvailableYears();
      const select = document.getElementById('coachPortraitYearFilter');
      if (select && years.length > 0) {
        select.innerHTML = '<option value="">All Years</option>' +
          years.map(y => `<option value="${y}">${y}</option>`).join('');
      }
    } catch (error) {
      console.error('[PortraitManager] Error loading coach year filter:', error);
    }
  }

  /**
   * Refresh custom coach portraits grid (Workspace Style)
   */
  async function refreshCoachPortraits() {
    const grid = document.getElementById('coachPortraitsGrid');
    if (!grid) return;

    console.log('[PortraitManager] Rendering coach workspace grid...');

    try {
      // Load all coach portraits
      coachPortraits = await window.electronAPI.customCoachPortrait.list();
      console.log('[PortraitManager] Loaded coach portraits:', coachPortraits?.length || 0);

      // Filter to unassigned only (workspace mode)
      let unassigned = coachPortraits.filter(p => !p.coachName && !p.databaseCoachId);
      console.log('[PortraitManager] Unassigned coach portraits:', unassigned.length);

      // Populate year filter dropdown
      const yearFilter = document.getElementById('coachWorkspaceYearFilter');
      if (yearFilter) {
        const years = new Set();
        unassigned.forEach(p => {
          if (p.originalFilename) {
            const yearMatch = p.originalFilename.match(/\b(19[2-9]\d|20[0-2]\d)\b/);
            if (yearMatch) years.add(yearMatch[1]);
          }
        });

        const currentValue = yearFilter.value;
        const sortedYears = Array.from(years).sort();

        if (!yearFilter.dataset.yearsLoaded || yearFilter.dataset.years !== sortedYears.join(',')) {
          yearFilter.innerHTML = '<option value="">All Years</option>';
          sortedYears.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearFilter.appendChild(opt);
          });
          yearFilter.dataset.yearsLoaded = 'true';
          yearFilter.dataset.years = sortedYears.join(',');

          if (currentValue && sortedYears.includes(currentValue)) {
            yearFilter.value = currentValue;
          }
        }

        if (!yearFilter.dataset.bound) {
          yearFilter.dataset.bound = 'true';
          yearFilter.addEventListener('change', () => refreshCoachPortraits());
        }

        // Apply year filter
        const selectedYear = yearFilter.value;
        if (selectedYear) {
          unassigned = unassigned.filter(p => p.originalFilename && p.originalFilename.includes(selectedYear));
        }
      }

      // Update count
      updateCoachPortraitCount(coachPortraits.length, unassigned.length);

      // No portraits at all
      if (!coachPortraits || coachPortraits.length === 0) {
        grid.innerHTML = `
          <div class="portrait-empty-state" style="padding: 40px; text-align: center; grid-column: 1 / -1;">
            <span style="font-size: 2rem;">👔</span>
            <h3 style="color: var(--text-primary);">No Coach Portraits Imported</h3>
            <p style="color: var(--text-secondary);">Use "Import Coach Portrait" to add custom portraits first.</p>
          </div>
        `;
        return;
      }

      // All portraits assigned
      if (unassigned.length === 0) {
        grid.innerHTML = `
          <div class="portrait-empty-state" style="padding: 40px; text-align: center; grid-column: 1 / -1;">
            <span style="font-size: 2rem;">✅</span>
            <h3 style="color: var(--text-primary);">All Done!</h3>
            <p style="color: var(--text-secondary);">All ${coachPortraits.length} coach portraits have been assigned.</p>
          </div>
        `;
        return;
      }

      // Render unassigned portraits with name matching
      grid.innerHTML = '';
      for (const p of unassigned) {
        const card = document.createElement('div');
        card.className = 'portrait-card' + (coachWorkspaceSelectedPid === p.pid ? ' selected' : '');
        card.dataset.pid = p.pid;
        card.style.cssText = 'cursor: pointer; position: relative;';

        const img = document.createElement('img');
        img.alt = `Coach Portrait ${p.pid}`;
        try {
          const imageData = await window.electronAPI.customCoachPortrait.get(p.pid);
          img.src = imageData || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/></svg>';
        } catch (e) {
          img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/></svg>';
        }
        card.appendChild(img);

        // PID badge
        const pidEl = document.createElement('div');
        pidEl.className = 'portrait-pid';
        pidEl.textContent = `PID: ${p.pid}`;
        card.appendChild(pidEl);

        // Red X button to delete
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Delete portrait';
        removeBtn.style.cssText = 'position: absolute; top: 4px; right: 4px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 14px; line-height: 1; font-weight: bold; z-index: 10;';
        removeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await handleDeleteCoachPortraitFromWorkspace(p.pid);
        });
        card.appendChild(removeBtn);

        // Show suggested name from filename with quick confirm button
        const suggestedName = parseCoachNameFromFilename(p.originalFilename);
        if (suggestedName) {
          const nameRow = document.createElement('div');
          nameRow.style.cssText = 'display: flex; align-items: center; gap: 4px; justify-content: center; margin-top: 4px;';

          const nameEl = document.createElement('span');
          nameEl.className = 'portrait-name';
          nameEl.textContent = '? ' + suggestedName;
          nameEl.title = 'Suggested from filename';
          nameEl.style.cssText = 'color: #f59e0b; font-size: 0.8rem;';
          nameRow.appendChild(nameEl);

          // Quick confirm checkmark button
          const quickConfirm = document.createElement('button');
          quickConfirm.innerHTML = '✓';
          quickConfirm.title = 'Quick confirm this match';
          quickConfirm.style.cssText = 'background: #4caf50; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; line-height: 1;';
          quickConfirm.addEventListener('click', async (e) => {
            e.stopPropagation();
            await handleCoachWorkspaceQuickConfirm(p.pid, suggestedName);
          });
          nameRow.appendChild(quickConfirm);

          card.appendChild(nameRow);
        } else {
          const nameEl = document.createElement('div');
          nameEl.className = 'portrait-name';
          nameEl.textContent = 'Unassigned';
          nameEl.style.cssText = 'color: var(--text-secondary); font-size: 0.8rem; margin-top: 4px;';
          card.appendChild(nameEl);
        }

        card.addEventListener('click', () => handleCoachWorkspacePortraitSelect(p.pid, suggestedName));
        grid.appendChild(card);
      }

      // Setup search handler
      const searchInput = document.getElementById('coachWorkspaceSearch');
      if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        searchInput.addEventListener('input', handleCoachWorkspaceSearch);
      }

      // Setup assign button
      const assignBtn = document.getElementById('btn-coach-workspace-assign');
      if (assignBtn && !assignBtn.dataset.bound) {
        assignBtn.dataset.bound = 'true';
        assignBtn.addEventListener('click', handleCoachWorkspaceAssign);
      }

    } catch (error) {
      console.error('[PortraitManager] Error refreshing coach portraits:', error);
      grid.innerHTML = '<div class="portrait-empty-state"><p>Error loading portraits</p></div>';
    }
  }

  /**
   * Handle coach portrait selection in workspace
   */
  function handleCoachWorkspacePortraitSelect(pid, suggestedName) {
    coachWorkspaceSelectedPid = pid;

    // Update visual selection
    const grid = document.getElementById('coachPortraitsGrid');
    grid.querySelectorAll('.portrait-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.pid == pid);
    });

    // Auto-search if we have a suggested name
    if (suggestedName) {
      const searchInput = document.getElementById('coachWorkspaceSearch');
      if (searchInput) {
        searchInput.value = suggestedName;
        handleCoachWorkspaceSearch();
      }
    }
  }

  /**
   * Handle coach search in workspace
   */
  async function handleCoachWorkspaceSearch() {
    const searchInput = document.getElementById('coachWorkspaceSearch');
    const resultsDiv = document.getElementById('coachWorkspaceSearchResults');
    if (!searchInput || !resultsDiv) return;

    const query = searchInput.value.trim();
    if (!query || query.length < 2) {
      resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Type at least 2 characters to search...</div>';
      return;
    }

    resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Searching...</div>';

    try {
      const result = await window.electronAPI.coachDatabase.searchCoaches({ query, limit: 20 });
      const coaches = result.success && result.data?.coaches ? result.data.coaches : [];

      if (coaches.length === 0) {
        resultsDiv.innerHTML = `
          <div style="padding: 20px; text-align: center;">
            <p style="color: var(--text-secondary); margin-bottom: 12px;">No coaches found for "${query}"</p>
            <button onclick="window.coachPortraitManager.createNewCoach('${query.replace(/'/g, "\\'")}')"
                    style="padding: 10px 20px; background: #4a9eff; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 14px;">
              + Create New Coach
            </button>
          </div>
        `;
        return;
      }

      resultsDiv.innerHTML = coaches.map(coach => {
        const hasPid = coach.maddenPid && coach.maddenPid >= 50000;
        return `
          <div class="workspace-search-result" data-coach-id="${coach.id}" data-coach-name="${coach.displayName}" data-is-custom="${coach.isCustom}"
               style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
               onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
            <div>
              <div style="font-weight: 500; color: var(--text-primary);">${coach.displayName}</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">${coach.position || ''} ${coach.isCustom ? '(Custom)' : ''}</div>
            </div>
            ${hasPid ? '<span style="color: #4caf50; font-size: 0.8rem;">Has Portrait</span>' : ''}
          </div>
        `;
      }).join('');

      // Add click handlers
      resultsDiv.querySelectorAll('.workspace-search-result').forEach(item => {
        item.addEventListener('click', () => {
          selectCoachForWorkspaceAssign(
            parseInt(item.dataset.coachId),
            item.dataset.coachName,
            item.dataset.isCustom === 'true'
          );
        });
      });
    } catch (error) {
      console.error('[PortraitManager] Coach search error:', error);
      resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Search error</div>';
    }
  }

  /**
   * Select coach for workspace assignment
   */
  function selectCoachForWorkspaceAssign(coachId, coachName, isCustom) {
    coachWorkspaceSelectedCoachId = { id: coachId, name: coachName, isCustom };

    // Show selected coach panel
    const selectedDiv = document.getElementById('coachWorkspaceSelectedCoach');
    const nameEl = document.getElementById('coachWorkspaceCoachName');
    const detailsEl = document.getElementById('coachWorkspaceCoachDetails');

    if (selectedDiv) selectedDiv.style.display = 'block';
    if (nameEl) nameEl.textContent = coachName;
    if (detailsEl) detailsEl.textContent = isCustom ? 'Custom Coach' : 'Database Coach';

    // Clear search results
    document.getElementById('coachWorkspaceSearchResults').innerHTML = '';
  }

  /**
   * Handle workspace assign button click
   */
  async function handleCoachWorkspaceAssign() {
    if (!coachWorkspaceSelectedPid || !coachWorkspaceSelectedCoachId) {
      showToast('Select a portrait and a coach first', 'warning');
      return;
    }

    const pid = coachWorkspaceSelectedPid;
    const { id, name, isCustom } = coachWorkspaceSelectedCoachId;

    try {
      // Update portrait metadata
      await window.electronAPI.customCoachPortrait.updateMetadata(pid, {
        coachName: name,
        databaseCoachId: id
      });

      // Update coach's appearance with the new PID
      // Use different method for custom vs original coaches
      if (isCustom) {
        // Custom coaches: update the custom_coaches table directly
        await window.electronAPI.coachDatabase.updateCustomCoach(id, {
          maddenPid: pid
        });
      } else {
        // Original coaches: use appearance edits overlay
        await window.electronAPI.coachDatabase.saveAppearanceEdit(id, {
          maddenPid: pid
        });
      }

      showToast(`Assigned portrait to ${name}`, 'success');

      // Reset selection and refresh
      coachWorkspaceSelectedPid = null;
      coachWorkspaceSelectedCoachId = null;
      document.getElementById('coachWorkspaceSelectedCoach').style.display = 'none';
      document.getElementById('coachWorkspaceSearch').value = '';

      refreshCoachPortraits();
    } catch (error) {
      console.error('[PortraitManager] Coach workspace assign error:', error);
      showToast(`Assignment failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle quick confirm for coach workspace
   */
  async function handleCoachWorkspaceQuickConfirm(pid, suggestedName) {
    console.log('[PortraitManager] Quick confirm coach:', pid, suggestedName);

    try {
      // Search for the coach by the suggested name
      const result = await window.electronAPI.coachDatabase.searchCoaches({ query: suggestedName, limit: 5 });
      const coaches = result.success && result.data?.coaches ? result.data.coaches : [];

      if (coaches.length === 0) {
        showToast(`No coach found for "${suggestedName}"`, 'warning');
        return;
      }

      // Find best match (exact name match preferred)
      let bestMatch = coaches.find(c => c.displayName.toLowerCase() === suggestedName.toLowerCase());
      if (!bestMatch) {
        bestMatch = coaches[0]; // Use first result
      }

      // Assign the portrait
      await window.electronAPI.customCoachPortrait.updateMetadata(pid, {
        coachName: bestMatch.displayName,
        databaseCoachId: bestMatch.id
      });

      // Use different method for custom vs original coaches
      if (bestMatch.isCustom) {
        await window.electronAPI.coachDatabase.updateCustomCoach(bestMatch.id, {
          maddenPid: pid
        });
      } else {
        await window.electronAPI.coachDatabase.saveAppearanceEdit(bestMatch.id, {
          maddenPid: pid
        });
      }

      showToast(`Assigned to ${bestMatch.displayName}`, 'success');
      refreshCoachPortraits();
    } catch (error) {
      console.error('[PortraitManager] Quick confirm error:', error);
      showToast(`Quick confirm failed: ${error.message}`, 'error');
    }
  }

  /**
   * Delete coach portrait from workspace
   */
  async function handleDeleteCoachPortraitFromWorkspace(pid) {
    if (!confirm(`Delete coach portrait PID ${pid}?`)) return;

    try {
      await window.electronAPI.customCoachPortrait.delete(pid);
      showToast(`Deleted coach portrait PID ${pid}`, 'success');
      refreshCoachPortraits();
    } catch (error) {
      console.error('[PortraitManager] Delete error:', error);
      showToast(`Delete failed: ${error.message}`, 'error');
    }
  }

  /**
   * Toggle coach portrait selection
   */
  function toggleCoachPortraitSelection(pid, card) {
    if (coachSelectedPids.has(pid)) {
      coachSelectedPids.delete(pid);
      card.classList.remove('selected');
    } else {
      coachSelectedPids.add(pid);
      card.classList.add('selected');
    }
    updateCoachSelectionButtons();
  }

  /**
   * Update coach selection buttons state
   */
  function updateCoachSelectionButtons() {
    const exportBtn = document.getElementById('exportSelectedCoachPortraitsBtn');
    const assignBtn = document.getElementById('assignCoachPortraitBtn');
    const deleteBtn = document.getElementById('deleteCoachPortraitBtn');

    if (exportBtn) {
      exportBtn.disabled = coachSelectedPids.size === 0;
    }
    if (assignBtn) {
      assignBtn.disabled = coachSelectedPids.size !== 1;
    }
    if (deleteBtn) {
      deleteBtn.disabled = coachSelectedPids.size === 0;
    }
  }

  /**
   * Update coach portrait count display
   */
  function updateCoachPortraitCount(total, unassigned) {
    const countEl = document.getElementById('coachPortraitsCount');
    if (countEl) {
      countEl.textContent = `${unassigned} to assign (${total} total)`;
    }
  }

  /**
   * Toggle coach view mode
   */
  function toggleCoachViewMode() {
    const btn = document.getElementById('coachPortraitViewModeToggle');
    if (coachViewMode === 'workspace') {
      coachViewMode = 'all';
      if (btn) btn.innerHTML = '<i class="bi bi-eye-slash"></i> Workspace';
    } else {
      coachViewMode = 'workspace';
      if (btn) btn.innerHTML = '<i class="bi bi-eye"></i> Show All';
    }
    refreshCoachPortraits();
  }

  /**
   * Handle import coach portrait
   */
  async function handleImportCoachPortrait() {
    try {
      const result = await window.electronAPI.customCoachPortrait.importDialog();
      if (result.canceled) return;

      if (result.success) {
        showToast(`Imported coach portrait: PID ${result.pid}`, 'success');
        refreshCoachPortraits();
        loadCoachYearFilterOptions();
      } else {
        showToast(`Import failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[PortraitManager] Coach import error:', error);
      showToast(`Import failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle import and assign coach portrait
   */
  async function handleImportAndAssignCoach() {
    try {
      const result = await window.electronAPI.customCoachPortrait.importDialog();
      if (result.canceled) return;

      if (result.success) {
        showToast(`Imported coach portrait: PID ${result.pid}`, 'success');
        refreshCoachPortraits();
        // Select and open assignment modal
        coachSelectedPids.clear();
        coachSelectedPids.add(result.pid);
        openCoachAssignModal();
      } else {
        showToast(`Import failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[PortraitManager] Coach import and assign error:', error);
      showToast(`Import failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle import multiple coach portraits
   */
  async function handleImportMultipleCoachPortraits() {
    try {
      const yearFilter = document.getElementById('coachPortraitYearFilter')?.value;
      const metadata = yearFilter ? { year: parseInt(yearFilter) } : undefined;

      const result = await window.electronAPI.customCoachPortrait.importMultipleDialog(metadata);
      if (result.canceled) return;

      if (result.imported > 0) {
        showToast(`Imported ${result.imported} coach portrait(s)`, 'success');
        refreshCoachPortraits();
        loadCoachYearFilterOptions();
      }

      if (result.errors?.length > 0) {
        console.error('[PortraitManager] Some coach imports failed:', result.errors);
      }
    } catch (error) {
      console.error('[PortraitManager] Multiple coach import error:', error);
      showToast(`Import failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle export selected coach portraits
   */
  async function handleExportSelectedCoachPortraits() {
    if (coachSelectedPids.size === 0) {
      showToast('No coach portraits selected', 'warning');
      return;
    }

    try {
      const pids = Array.from(coachSelectedPids);
      const result = await window.electronAPI.customCoachPortrait.exportBatch(pids);

      if (result.canceled) return;

      if (result.success) {
        showToast(`Exported ${result.exported} coach portrait(s) as DDS`, 'success');
      } else {
        showToast(`Export completed with ${result.failed} failure(s)`, 'warning');
      }
    } catch (error) {
      console.error('[PortraitManager] Coach export error:', error);
      showToast(`Export failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle export all coach portraits
   */
  async function handleExportAllCoachPortraits() {
    try {
      const result = await window.electronAPI.customCoachPortrait.exportAll();

      if (result.canceled) return;

      if (result.success) {
        showToast(`Exported ${result.exported} coach portrait(s) as DDS`, 'success');
      } else {
        showToast(`Export completed with ${result.failed} failure(s)`, 'warning');
      }
    } catch (error) {
      console.error('[PortraitManager] Coach export all error:', error);
      showToast(`Export failed: ${error.message}`, 'error');
    }
  }

  /**
   * Delete coach portrait
   */
  async function deleteCoachPortrait(pid) {
    if (!confirm(`Delete coach portrait PID ${pid}?`)) return;

    try {
      await window.electronAPI.customCoachPortrait.delete(pid);
      showToast(`Deleted coach portrait PID ${pid}`, 'success');
      coachSelectedPids.delete(pid);
      refreshCoachPortraits();
    } catch (error) {
      console.error('[PortraitManager] Coach delete error:', error);
      showToast(`Delete failed: ${error.message}`, 'error');
    }
  }

  /**
   * Delete selected coach portraits
   */
  async function handleDeleteSelectedCoachPortraits() {
    if (coachSelectedPids.size === 0) {
      showToast('No portraits selected', 'warning');
      return;
    }

    const count = coachSelectedPids.size;
    if (!confirm(`Delete ${count} selected coach portrait(s)?`)) return;

    let deleted = 0;
    let errors = 0;

    for (const pid of coachSelectedPids) {
      try {
        await window.electronAPI.customCoachPortrait.delete(pid);
        deleted++;
      } catch (error) {
        console.error(`[PortraitManager] Error deleting coach portrait ${pid}:`, error);
        errors++;
      }
    }

    coachSelectedPids.clear();
    updateCoachSelectionButtons();
    refreshCoachPortraits();

    if (errors > 0) {
      showToast(`Deleted ${deleted} portrait(s), ${errors} failed`, 'warning');
    } else {
      showToast(`Deleted ${deleted} coach portrait(s)`, 'success');
    }
  }

  /**
   * Open coach assignment modal
   */
  async function openCoachAssignModal() {
    if (coachSelectedPids.size !== 1) {
      showToast('Select exactly one portrait to assign', 'warning');
      return;
    }

    const pid = Array.from(coachSelectedPids)[0];
    const modal = document.getElementById('coachPortraitAssignModal');
    const preview = document.getElementById('assignCoachPortraitPreview');
    const pidLabel = document.getElementById('assignCoachPortraitPid');

    if (!modal) return;

    // Load portrait preview
    try {
      const imageData = await window.electronAPI.customCoachPortrait.get(pid);
      if (preview) preview.src = imageData || '';
      if (pidLabel) pidLabel.textContent = `PID: ${pid}`;
    } catch (error) {
      console.error('[PortraitManager] Error loading coach portrait preview:', error);
    }

    // Clear previous selection
    selectedCoachForAssignment = null;
    document.getElementById('assignCoachSearch').value = '';
    document.getElementById('assignCoachResults').innerHTML = '';
    document.getElementById('assignSelectedCoach').style.display = 'none';
    document.getElementById('confirmCoachAssignBtn').disabled = true;

    modal.style.display = 'flex';
  }

  /**
   * Close coach assignment modal
   */
  function closeCoachAssignModal() {
    const modal = document.getElementById('coachPortraitAssignModal');
    if (modal) modal.style.display = 'none';
    selectedCoachForAssignment = null;
  }

  /**
   * Handle coach search for assignment
   */
  async function handleCoachSearchForAssignment() {
    const searchInput = document.getElementById('assignCoachSearch');
    const resultsDiv = document.getElementById('assignCoachResults');
    const query = searchInput?.value?.trim();

    if (!query || query.length < 2) {
      if (resultsDiv) resultsDiv.innerHTML = '';
      return;
    }

    try {
      const result = await window.electronAPI.coachDatabase.searchCoaches({ query, limit: 20 });
      const coaches = result.success && result.data?.coaches ? result.data.coaches : [];

      if (coaches.length === 0) {
        // No results - show "Create New Coach" option
        if (resultsDiv) {
          resultsDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #888;">
              <p style="margin: 0 0 12px 0;">No coaches found</p>
              <button onclick="window.coachPortraitManager.createNewCoach('${query.replace(/'/g, "\\'")}')"
                      style="padding: 10px 20px; background: #4a9eff; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 14px; display: inline-flex; align-items: center; gap: 6px;">
                <span style="font-size: 18px;">+</span> Create New Coach
              </button>
            </div>
          `;
        }
        return;
      }

      resultsDiv.innerHTML = coaches.slice(0, 10).map(coach => {
        const hasExistingPid = coach.pam && coach.pam.length > 0;
        const pidWarning = hasExistingPid ? `<span class="has-portrait-badge" title="Has PAM: ${coach.pam}">📸</span>` : '';
        return `
        <div class="assign-result-item ${hasExistingPid ? 'has-portrait' : ''}" data-coach-id="${coach.id}" data-coach-name="${coach.displayName}" data-existing-pid="${coach.pam || ''}" data-is-custom="${coach.isCustom ? 'true' : 'false'}">
          <span class="result-name">${coach.displayName} ${pidWarning}</span>
          <span class="result-info">${coach.position || ''}</span>
        </div>
      `}).join('');

      // Add click handlers
      resultsDiv.querySelectorAll('.assign-result-item').forEach(item => {
        item.addEventListener('click', () => {
          selectCoachForAssignment(
            item.dataset.coachId,
            item.dataset.coachName,
            item.dataset.existingPid ? parseInt(item.dataset.existingPid) : null,
            item.dataset.isCustom === 'true'
          );
        });
      });
    } catch (error) {
      console.error('[PortraitManager] Coach search error:', error);
      if (resultsDiv) resultsDiv.innerHTML = '<div class="no-results">Search error</div>';
    }
  }

  /**
   * Select coach for assignment
   */
  function selectCoachForAssignment(coachId, coachName, existingPid = null, isCustom = false) {
    selectedCoachForAssignment = { id: parseInt(coachId), name: coachName, existingPid, isCustom };

    // Show selected coach info
    const selectedDiv = document.getElementById('assignSelectedCoach');
    const nameEl = document.getElementById('assignCoachName');
    const detailsEl = document.getElementById('assignCoachDetails');

    if (selectedDiv) selectedDiv.style.display = 'block';
    if (nameEl) nameEl.textContent = coachName;
    if (detailsEl) {
      if (existingPid && existingPid > 0) {
        detailsEl.textContent = `Current PID: ${existingPid}`;
        detailsEl.style.color = '#ff9800';
      } else {
        detailsEl.textContent = 'No portrait assigned';
        detailsEl.style.color = '#888';
      }
    }

    // Enable confirm button
    document.getElementById('confirmCoachAssignBtn').disabled = false;

    // Clear search results
    document.getElementById('assignCoachResults').innerHTML = '';
  }

  /**
   * Confirm coach assignment
   */
  async function confirmCoachAssignment() {
    if (!selectedCoachForAssignment || coachSelectedPids.size !== 1) {
      showToast('Please select a coach to assign', 'warning');
      return;
    }

    const pid = Array.from(coachSelectedPids)[0];
    const { id, name, existingPid, isCustom } = selectedCoachForAssignment;

    // Check if "Model Only" checkbox is checked
    const modelOnlyCheckbox = document.getElementById('coachAssignModelOnlyCheckbox');
    const modelOnly = modelOnlyCheckbox && modelOnlyCheckbox.checked;

    if (modelOnly) {
      // Model Only mode: only update PAM, keep existing portrait
      console.log('[PortraitManager] Model Only mode - setting PAM without changing PID');

      try {
        // Get the PAM from the selected portrait's associated coach
        // For custom portraits, we get the PAM from Coach_lookup using the original coach if available
        // For now, we just update the coach's appearance with only PAM (derived from portrait)

        // We need to get the PAM value for this portrait
        // The PAM might be stored in portrait metadata or derived from the coach it was originally from
        const portraitData = await window.electronAPI.customCoachPortrait.getMetadata(pid);
        const pamValue = portraitData?.pam || `_C_PRO`; // Default to generic coach PAM if none set

        // Update only the PAM in the coach database
        if (isCustom) {
          // Custom coaches: update the custom_coaches table directly
          await window.electronAPI.coachDatabase.updateCustomCoach(id, {
            maddenPam: pamValue
            // Note: maddenPid is NOT set, keeping current portrait
          });
        } else {
          // Original coaches: use appearance edits overlay
          await window.electronAPI.coachDatabase.saveAppearanceEdit(id, {
            maddenPam: pamValue
            // Note: maddenPid is NOT set, keeping current portrait
          });
        }

        showToast(`Applied 3D model only to ${name} (portrait unchanged)`, 'success');
        closeCoachAssignModal();
        refreshCoachPortraits();
      } catch (error) {
        console.error('[PortraitManager] Model Only assignment error:', error);
        showToast(`Assignment failed: ${error.message}`, 'error');
      }
    } else {
      // Full assignment: update both PID and PAM
      // Check if coach already has a portrait assigned
      if (existingPid && existingPid > 0) {
        const isInGamePortrait = existingPid < 50000;
        const warningMessage = isInGamePortrait
          ? `${name} already has an in-game portrait (PID: ${existingPid}).\n\nAssigning this custom portrait will replace their official portrait.\n\nContinue?`
          : `${name} already has a custom portrait assigned (PID: ${existingPid}).\n\nAssigning this new portrait will replace the existing one.\n\nContinue?`;

        if (!confirm(`⚠️ Warning: ${warningMessage}`)) {
          showToast('Assignment cancelled', 'info');
          return;
        }
      }

      try {
        // Update portrait metadata
        await window.electronAPI.customCoachPortrait.updateMetadata(pid, {
          coachName: name,
          databaseCoachId: id
        });

        // Also update the coach's appearance with the new PID
        if (isCustom) {
          // Custom coaches: update the custom_coaches table directly
          await window.electronAPI.coachDatabase.updateCustomCoach(id, {
            maddenPid: pid
          });
        } else {
          // Original coaches: use appearance edits overlay
          await window.electronAPI.coachDatabase.saveAppearanceEdit(id, {
            maddenPid: pid
          });
        }

        showToast(`Assigned portrait to ${name}`, 'success');
        closeCoachAssignModal();
        refreshCoachPortraits();
      } catch (error) {
        console.error('[PortraitManager] Coach assignment error:', error);
        showToast(`Assignment failed: ${error.message}`, 'error');
      }
    }
  }

  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // =============================================
  // CREATE NEW COACH FROM PORTRAIT MANAGER
  // =============================================

  let pendingCoachPortraitPid = null; // PID waiting to be assigned to new coach

  /**
   * Open the full Database Coach Card in create mode, pre-filled with portrait name and PID
   */
  async function createNewCoach(searchQuery) {
    console.log('[PortraitManager] Create new coach from search:', searchQuery);

    // Store the current portrait PID we want to assign (from workspace selection)
    if (!coachWorkspaceSelectedPid) {
      showToast('No portrait selected', 'warning');
      return;
    }
    pendingCoachPortraitPid = coachWorkspaceSelectedPid;

    // Parse name from search query
    let coachName = searchQuery.trim();
    const nameParts = coachName.split(/\s+/);
    const suggestedFirst = nameParts[0] || '';
    const suggestedLast = nameParts.slice(1).join(' ') || '';

    // Close the coach portraits workspace modal
    const coachModal = document.getElementById('modal-coach-portraits');
    if (coachModal) coachModal.style.display = 'none';

    // Check if the full Database Coach Card creator is available
    if (typeof window.createNewDbCoach !== 'function') {
      showToast('Coach editor not available. Please open the Database Browser > Coaches tab first.', 'error');
      return;
    }

    // Open the full Database Coach Card in create mode
    await window.createNewDbCoach();

    // Wait a moment for the form to render, then pre-fill the fields
    setTimeout(async () => {
      // Pre-fill first name
      const firstNameInput = document.getElementById('dbCoachFirstName');
      if (firstNameInput && suggestedFirst) {
        firstNameInput.value = suggestedFirst;
      }

      // Pre-fill last name
      const lastNameInput = document.getElementById('dbCoachLastName');
      if (lastNameInput && suggestedLast) {
        lastNameInput.value = suggestedLast;
      }

      // Pre-fill the PID with the portrait's PID
      const pidInput = document.getElementById('dbCoachPid');
      if (pidInput && pendingCoachPortraitPid) {
        pidInput.value = pendingCoachPortraitPid;
      }

      // Update the header to show we're creating from portrait
      const nameEl = document.getElementById('dbCoachCardName');
      if (nameEl) {
        nameEl.textContent = 'New Custom Coach (from Portrait)';
      }

      // Load the portrait preview
      if (pendingCoachPortraitPid && typeof window.loadCoachPortrait === 'function') {
        await window.loadCoachPortrait(pendingCoachPortraitPid);
      }

      // Focus on first name field
      if (firstNameInput) {
        firstNameInput.focus();
        if (!suggestedFirst) {
          // If no name suggested, keep focus on first name
        } else if (!suggestedLast) {
          // If first name filled but no last name, focus last name
          if (lastNameInput) lastNameInput.focus();
        }
      }

      console.log('[PortraitManager] Pre-filled coach form with:', {
        firstName: suggestedFirst,
        lastName: suggestedLast,
        pid: pendingCoachPortraitPid
      });
    }, 200);

    // Keep the pending PID so Database Coach Card can update portrait metadata after save
    console.log('[PortraitManager] Pending coach portrait PID for assignment:', pendingCoachPortraitPid);
  }

  // Initialize tabs when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initPortraitManagerTabs();
      initCustomCoachPortraitSection();
    });
  } else {
    initPortraitManagerTabs();
    initCustomCoachPortraitSection();
  }

  // ============================================
  // TOOL CARD MODAL HANDLERS (New Landing Page UI)
  // ============================================

  /**
   * Initialize the new tool card landing page
   */
  function initToolCardLandingPage() {
    console.log('[PortraitManager] Initializing tool card landing page...');

    // Tool card click handlers
    document.querySelectorAll('.portrait-tool-card').forEach(card => {
      card.addEventListener('click', () => {
        const tool = card.dataset.portraitTool;
        console.log('[PortraitManager] Tool card clicked:', tool);
        openPortraitToolModal(tool);
      });
    });

    // Modal close handlers
    document.querySelectorAll('.portrait-modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.portrait-modal-overlay');
        if (modal) modal.style.display = 'none';
      });
    });

    // Close modal on overlay click
    document.querySelectorAll('.portrait-modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });

    // Import modal buttons
    document.getElementById('btn-import-single')?.addEventListener('click', () => {
      document.getElementById('modal-portrait-import').style.display = 'none';
      handleImportSingle();
    });

    document.getElementById('btn-import-multiple')?.addEventListener('click', () => {
      document.getElementById('modal-portrait-import').style.display = 'none';
      handleImportMultiple();
    });

    document.getElementById('btn-import-and-assign')?.addEventListener('click', () => {
      document.getElementById('modal-portrait-import').style.display = 'none';
      handleImportAndAssign();
    });

    // Export modal buttons
    document.getElementById('btn-export-all')?.addEventListener('click', () => {
      document.getElementById('modal-portrait-export').style.display = 'none';
      handleExportAll();
    });

    document.getElementById('btn-generate-sprites')?.addEventListener('click', () => {
      document.getElementById('modal-portrait-export').style.display = 'none';
      handleGenerateSpriteSheets();
    });

    // My Portraits modal filters
    document.getElementById('myPortraitsFilter')?.addEventListener('change', renderMyPortraitsGrid);
    document.getElementById('myPortraitsSort')?.addEventListener('change', renderMyPortraitsGrid);
    // Search input - debounce to avoid too many renders while typing
    let searchTimeout = null;
    document.getElementById('myPortraitsSearch')?.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(renderMyPortraitsGrid, 300);
    });

    // Bundled search
    document.getElementById('btn-bundled-search')?.addEventListener('click', handleBundledSearchNew);
    document.getElementById('bundledSearchInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleBundledSearchNew();
    });

    // Coach modal buttons - use the actual function names
    document.getElementById('btn-import-coach')?.addEventListener('click', () => {
      handleImportCoachPortrait();
    });

    document.getElementById('btn-import-coach-multiple')?.addEventListener('click', () => {
      handleImportMultipleCoachPortraits();
    });

    document.getElementById('btn-export-coach-all')?.addEventListener('click', () => {
      handleExportAllCoachPortraits();
    });

    document.getElementById('assignCoachPortraitBtn')?.addEventListener('click', openCoachAssignModal);

    document.getElementById('deleteCoachPortraitBtn')?.addEventListener('click', handleDeleteSelectedCoachPortraits);

    document.getElementById('btn-coach-bundled-search')?.addEventListener('click', handleCoachBundledSearchNew);
    document.getElementById('coachBundledSearchInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleCoachBundledSearchNew();
    });

    // Update portrait count badge
    updatePortraitCountBadge();
  }

  /**
   * Open a portrait tool modal
   */
  function openPortraitToolModal(tool) {
    switch (tool) {
      case 'import':
        document.getElementById('modal-portrait-import').style.display = 'flex';
        break;
      case 'my-portraits':
        document.getElementById('modal-my-portraits').style.display = 'flex';
        renderMyPortraitsGrid();
        break;
      case 'workspace':
        document.getElementById('modal-workspace').style.display = 'flex';
        renderWorkspaceGrid();
        break;
      case 'export':
        document.getElementById('modal-portrait-export').style.display = 'flex';
        break;
      case 'bundled':
        document.getElementById('modal-bundled-portraits').style.display = 'flex';
        break;
      case 'coaches':
        document.getElementById('modal-coach-portraits').style.display = 'flex';
        initCoachPortraitSection();
        refreshCoachPortraits();
        break;
    }
  }

  // Track render state to prevent concurrent renders
  let renderInProgress = false;
  let pendingRender = false;

  /**
   * Render the My Portraits grid in the modal
   */
  async function renderMyPortraitsGrid() {
    const grid = document.getElementById('myPortraitsGrid');
    const countEl = document.getElementById('myPortraitsCount');
    const filterEl = document.getElementById('myPortraitsFilter');
    const sortEl = document.getElementById('myPortraitsSort');

    if (!grid) return;

    // Prevent concurrent renders - queue if already rendering
    if (renderInProgress) {
      pendingRender = true;
      return;
    }
    renderInProgress = true;

    // Refresh portraits data
    portraits = await window.electronAPI.customPortrait.list();

    // Get player draft years for assigned portraits
    const playerYearMap = new Map();
    try {
      const response = await window.electronAPI.database.searchPlayers('', { limit: 10000 });
      const allPlayers = response?.players || response || [];
      allPlayers.forEach(player => {
        const id = player.internalId || player.id;
        if (player.draftClass) {
          const year = parseInt(player.draftClass, 10);
          if (year >= 1920 && year <= 2030) {
            playerYearMap.set(id, year);
          }
        }
      });
    } catch (e) {
      console.error('[PortraitManager] Error loading player years:', e);
    }

    // Collect all available years and assign _year to portraits
    // Priority: 1) Attached player's draft year, 2) stored year, 3) filename year
    // Cascade through all sources until we find a year
    const years = new Set();
    portraits.forEach(p => {
      p._year = null; // Reset

      // First priority: Use attached player's draft year
      if (p.databasePlayerId && playerYearMap.has(p.databasePlayerId)) {
        const y = playerYearMap.get(p.databasePlayerId);
        years.add(y);
        p._year = y;
      }

      // Second priority: stored year (if no year found yet)
      if (!p._year && p.year) {
        years.add(p.year);
        p._year = p.year;
      }

      // Third priority: filename year (if still no year found)
      if (!p._year && p.originalFilename) {
        const match = p.originalFilename.match(/\b(19[2-9]\d|20[0-2]\d)\b/);
        if (match) {
          const y = parseInt(match[1], 10);
          years.add(y);
          p._year = y;
        }
      }
    });

    // Populate year filter dropdown
    if (filterEl) {
      const currentVal = filterEl.value;
      filterEl.innerHTML = '<option value="">All Years</option>';
      Array.from(years).sort((a, b) => a - b).forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        filterEl.appendChild(opt);
      });
      if (currentVal) filterEl.value = currentVal;
    }

    // Filter by year
    let filtered = [...portraits];
    const yearFilter = filterEl?.value;
    if (yearFilter) {
      const yf = parseInt(yearFilter, 10);
      filtered = filtered.filter(p => p._year === yf);
    }

    // Filter by search term (name)
    const searchEl = document.getElementById('myPortraitsSearch');
    const searchTerm = (searchEl?.value || '').toLowerCase().trim();
    if (searchTerm) {
      filtered = filtered.filter(p => {
        const name = (p.playerName || '').toLowerCase();
        return name.includes(searchTerm);
      });
    }

    // Sort
    const sortBy = sortEl?.value || 'pid';

    // Force sort by PID first to test
    filtered = filtered.slice().sort((a, b) => {
      const pidA = Number(a.pid) || 0;
      const pidB = Number(b.pid) || 0;

      if (sortBy === 'pid') {
        return pidA - pidB;
      }
      if (sortBy === 'year') {
        const yearA = Number(a._year) || Number(a.year) || 0;
        const yearB = Number(b._year) || Number(b.year) || 0;
        return yearA - yearB || pidA - pidB;
      }
      if (sortBy === 'name') {
        const nameA = (a.playerName || '').toLowerCase();
        const nameB = (b.playerName || '').toLowerCase();
        if (!nameA && !nameB) return pidA - pidB;
        if (!nameA) return 1;
        if (!nameB) return -1;
        const lastA = nameA.split(' ').pop();
        const lastB = nameB.split(' ').pop();
        return lastA.localeCompare(lastB) || nameA.localeCompare(nameB);
      }
      return pidA - pidB;
    });

    console.log('[SORT] sortBy:', sortBy, 'First 10 PIDs after sort:', filtered.slice(0, 10).map(p => p.pid));

    // Update count
    if (countEl) countEl.textContent = `${filtered.length} portraits`;

    // Render grid
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="portrait-empty-state">
          <span class="empty-icon">🖼️</span>
          <h3>No Portraits Yet</h3>
          <p>Use "Import Portraits" to add custom portraits.</p>
        </div>
      `;
      return;
    }

    // Create all cards SYNCHRONOUSLY first to preserve sort order
    // Then load images asynchronously
    grid.innerHTML = '';
    const placeholderSvg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/></svg>';

    // Create all DOM elements in correct order (synchronously)
    const imageLoadPromises = [];
    for (const p of filtered) {
      const card = document.createElement('div');
      card.className = 'portrait-card';
      card.dataset.pid = p.pid;

      const img = document.createElement('img');
      img.alt = `Portrait ${p.pid}`;
      img.src = placeholderSvg; // Start with placeholder
      card.appendChild(img);

      const pidEl = document.createElement('div');
      pidEl.className = 'portrait-pid';
      pidEl.textContent = `PID: ${p.pid}`;
      card.appendChild(pidEl);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'portrait-delete';
      deleteBtn.innerHTML = '×';
      deleteBtn.title = 'Delete portrait';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeletePortrait(p.pid);
      });
      card.appendChild(deleteBtn);

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'portrait-edit-btn';
      editBtn.innerHTML = '✏️';
      editBtn.title = 'Edit portrait';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleOpenEditModal(p);
      });
      card.appendChild(editBtn);

      // Assign button
      const assignBtn = document.createElement('button');
      assignBtn.className = 'portrait-assign-btn';
      assignBtn.innerHTML = '👤';
      assignBtn.title = 'Assign to player';
      assignBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleQuickAssign(p.pid);
      });
      card.appendChild(assignBtn);

      const nameEl = document.createElement('div');
      nameEl.className = 'portrait-name';
      nameEl.textContent = p.playerName || 'Unassigned';
      card.appendChild(nameEl);

      if (p._year || p.year) {
        const yearEl = document.createElement('div');
        yearEl.className = 'portrait-year';
        yearEl.textContent = p._year || p.year;
        card.appendChild(yearEl);
      }

      grid.appendChild(card);

      // Queue image loading (async, but DOM order already set)
      const pid = p.pid;
      imageLoadPromises.push(
        window.electronAPI.customPortrait.get(pid)
          .then(imageData => {
            if (imageData) img.src = imageData;
          })
          .catch(() => {
            // Keep placeholder on error
          })
      );
    }

    // Update badge
    updatePortraitCountBadge();

    // Load all images in parallel (won't affect DOM order)
    await Promise.all(imageLoadPromises);

    // Mark render complete and check for pending renders
    renderInProgress = false;
    if (pendingRender) {
      pendingRender = false;
      renderMyPortraitsGrid();
    }
  }

  /**
   * Render the Coach Portraits grid in the modal
   */
  async function renderCoachPortraitsGrid() {
    const grid = document.getElementById('coachPortraitsGrid');
    const countEl = document.getElementById('coachPortraitsCount');

    if (!grid) return;

    // Refresh coach portraits - use customCoachPortrait API
    let coachPortraits = [];
    try {
      coachPortraits = await window.electronAPI.customCoachPortrait.list();
    } catch (err) {
      console.error('[PortraitManager] Error loading coach portraits:', err);
    }

    if (countEl) countEl.textContent = `${coachPortraits.length} coach portraits`;

    if (!coachPortraits || coachPortraits.length === 0) {
      grid.innerHTML = `
        <div class="portrait-empty-state">
          <span class="empty-icon">👔</span>
          <h3>No Coach Portraits Yet</h3>
          <p>Click "Import Coach Portrait" to add custom coach portraits.</p>
        </div>
      `;
      return;
    }

    // Create cards and load images async
    grid.innerHTML = '';
    for (const p of coachPortraits) {
      const card = document.createElement('div');
      card.className = 'portrait-card';
      card.dataset.pid = p.pid;

      const img = document.createElement('img');
      img.alt = `Coach ${p.pid}`;

      // Load image async
      try {
        const imageData = await window.electronAPI.customCoachPortrait.get(p.pid);
        if (imageData) {
          img.src = imageData;
        } else {
          img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/></svg>';
        }
      } catch (e) {
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/></svg>';
      }
      card.appendChild(img);

      const pidEl = document.createElement('div');
      pidEl.className = 'portrait-pid';
      pidEl.textContent = `PID: ${p.pid}`;
      card.appendChild(pidEl);

      const nameEl = document.createElement('div');
      nameEl.className = 'portrait-name';
      nameEl.textContent = p.coachName || 'Unassigned';
      card.appendChild(nameEl);

      grid.appendChild(card);
    }
  }

  /**
   * Handle bundled search from new modal
   */
  async function handleBundledSearchNew() {
    const input = document.getElementById('bundledSearchInput');
    const resultsEl = document.getElementById('bundledSearchResults');
    if (!input || !resultsEl) return;

    const query = input.value.trim();
    if (!query) {
      resultsEl.innerHTML = '<div class="bundled-empty-state"><p>Enter a player name to search.</p></div>';
      return;
    }

    resultsEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Searching...</div>';

    try {
      const results = await window.electronAPI.portrait.searchWithImages(query, 50);
      if (!results || results.length === 0) {
        resultsEl.innerHTML = '<div class="bundled-empty-state"><p>No portraits found for "' + query + '"</p></div>';
        return;
      }

      resultsEl.innerHTML = results.map(p => `
        <div class="bundled-portrait-card" data-pid="${p.pid}" data-plpo="${p.plpo || ''}">
          <input type="checkbox" class="bundled-checkbox">
          <img src="${p.imageData || p.dataUrl || ''}" alt="${p.name || p.playerName || 'Unknown'}">
          <div class="bundled-info">
            <div class="bundled-name">${p.name || p.playerName || 'Unknown'}</div>
            <div class="bundled-pid">PID: ${p.pid}</div>
          </div>
        </div>
      `).join('');

      // Enable export button when items selected
      resultsEl.querySelectorAll('.bundled-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
          const anySelected = resultsEl.querySelector('.bundled-checkbox:checked');
          document.getElementById('btn-bundled-export').disabled = !anySelected;
        });
      });
    } catch (err) {
      console.error('[PortraitManager] Bundled search error:', err);
      resultsEl.innerHTML = '<div class="bundled-empty-state"><p>Error searching portraits.</p></div>';
    }
  }

  /**
   * Handle coach bundled search from new modal
   */
  async function handleCoachBundledSearchNew() {
    const input = document.getElementById('coachBundledSearchInput');
    const resultsEl = document.getElementById('coachBundledSearchResults');
    if (!input || !resultsEl) return;

    const query = input.value.trim();
    if (!query) {
      resultsEl.innerHTML = '<div class="bundled-empty-state"><p>Enter a coach name to search.</p></div>';
      return;
    }

    resultsEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Searching...</div>';

    try {
      // Use coach database search API
      const results = await window.electronAPI.coachDatabase.searchCoaches({ query, limit: 30 });
      if (!results || results.length === 0) {
        resultsEl.innerHTML = '<div class="bundled-empty-state"><p>No coaches found for "' + query + '"</p></div>';
        return;
      }

      // Build HTML and load images for each coach
      resultsEl.innerHTML = '';
      for (const coach of results.slice(0, 30)) {
        const card = document.createElement('div');
        card.className = 'bundled-portrait-card';
        card.dataset.pid = coach.id || coach.pid;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'bundled-checkbox';
        card.appendChild(checkbox);

        const img = document.createElement('img');
        img.alt = coach.displayName || `${coach.firstName} ${coach.lastName}`;
        try {
          const pid = coach.id || coach.pid;
          const imageData = await window.electronAPI.coachPortrait.getImageDataByPID(pid);
          if (imageData) {
            img.src = imageData;
          } else {
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/></svg>';
          }
        } catch (e) {
          img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/></svg>';
        }
        card.appendChild(img);

        const info = document.createElement('div');
        info.className = 'bundled-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'bundled-name';
        nameEl.textContent = coach.displayName || `${coach.firstName} ${coach.lastName}`;
        info.appendChild(nameEl);

        const pidEl = document.createElement('div');
        pidEl.className = 'bundled-pid';
        pidEl.textContent = `PID: ${coach.id || coach.pid}`;
        info.appendChild(pidEl);

        card.appendChild(info);
        resultsEl.appendChild(card);
      }

      // Enable export button when items selected
      resultsEl.querySelectorAll('.bundled-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
          const anySelected = resultsEl.querySelector('.bundled-checkbox:checked');
          document.getElementById('btn-coach-bundled-export').disabled = !anySelected;
        });
      });
    } catch (err) {
      console.error('[PortraitManager] Coach bundled search error:', err);
      resultsEl.innerHTML = '<div class="bundled-empty-state"><p>Error searching coach portraits.</p></div>';
    }
  }

  // =====================================
  // WORKSPACE FUNCTIONS
  // =====================================

  let workspaceSelectedPid = null;
  let workspaceSelectedPlayerId = null;
  let workspaceSearchTimeout = null;

  /**
   * Render the workspace grid with unassigned portraits
   */
  async function renderWorkspaceGrid() {
    const grid = document.getElementById('workspaceUnassignedGrid');
    if (!grid) {
      console.error('[PortraitManager] Workspace grid not found');
      return;
    }

    console.log('[PortraitManager] Rendering workspace grid...');

    // Refresh portraits
    try {
      portraits = await window.electronAPI.customPortrait.list();
      console.log('[PortraitManager] Loaded portraits:', portraits?.length || 0);
    } catch (err) {
      console.error('[PortraitManager] Error loading portraits:', err);
      grid.innerHTML = `
        <div class="portrait-empty-state" style="padding: 40px; text-align: center;">
          <span style="font-size: 2rem;">❌</span>
          <h3 style="color: var(--text-primary);">Error Loading Portraits</h3>
          <p style="color: var(--text-secondary);">${err.message}</p>
        </div>
      `;
      return;
    }

    let unassigned = portraits.filter(p => !p.playerName && !p.databasePlayerId);
    console.log('[PortraitManager] Unassigned portraits:', unassigned.length);

    // Populate year filter dropdown
    const yearFilter = document.getElementById('workspaceYearFilter');
    if (yearFilter) {
      // Extract years from filenames (look for 4-digit years like 1976, 2024)
      const years = new Set();
      unassigned.forEach(p => {
        if (p.originalFilename) {
          const yearMatch = p.originalFilename.match(/\b(19[2-9]\d|20[0-2]\d)\b/);
          if (yearMatch) {
            years.add(yearMatch[1]);
          }
        }
      });

      // Update dropdown if years have changed
      const currentValue = yearFilter.value;
      const sortedYears = Array.from(years).sort();

      // Only rebuild if needed
      if (!yearFilter.dataset.yearsLoaded || yearFilter.dataset.years !== sortedYears.join(',')) {
        yearFilter.innerHTML = '<option value="">All Years</option>';
        sortedYears.forEach(y => {
          const opt = document.createElement('option');
          opt.value = y;
          opt.textContent = y;
          yearFilter.appendChild(opt);
        });
        yearFilter.dataset.yearsLoaded = 'true';
        yearFilter.dataset.years = sortedYears.join(',');

        // Restore previous selection if still valid
        if (currentValue && sortedYears.includes(currentValue)) {
          yearFilter.value = currentValue;
        }
      }

      // Bind filter change handler
      if (!yearFilter.dataset.bound) {
        yearFilter.dataset.bound = 'true';
        yearFilter.addEventListener('change', () => renderWorkspaceGrid());
      }

      // Apply year filter
      const selectedYear = yearFilter.value;
      if (selectedYear) {
        unassigned = unassigned.filter(p => {
          if (!p.originalFilename) return false;
          return p.originalFilename.includes(selectedYear);
        });
      }
    }

    // Update unassigned count badge
    const badge = document.getElementById('workspace-unassigned-count');
    if (badge) {
      badge.textContent = `${unassigned.length} to assign`;
    }

    // No portraits at all
    if (!portraits || portraits.length === 0) {
      grid.innerHTML = `
        <div class="portrait-empty-state" style="padding: 40px; text-align: center;">
          <span style="font-size: 2rem;">🖼️</span>
          <h3 style="color: var(--text-primary);">No Portraits Imported</h3>
          <p style="color: var(--text-secondary);">Use "Import Portraits" to add custom portraits first.</p>
        </div>
      `;
      return;
    }

    // All portraits assigned
    if (unassigned.length === 0) {
      grid.innerHTML = `
        <div class="portrait-empty-state" style="padding: 40px; text-align: center;">
          <span style="font-size: 2rem;">✅</span>
          <h3 style="color: var(--text-primary);">All Done!</h3>
          <p style="color: var(--text-secondary);">All ${portraits.length} portraits have been assigned to players.</p>
        </div>
      `;
      return;
    }

    // Render unassigned portraits
    grid.innerHTML = '';
    for (const p of unassigned) {
      const card = document.createElement('div');
      card.className = 'portrait-card' + (workspaceSelectedPid === p.pid ? ' selected' : '');
      card.dataset.pid = p.pid;
      card.style.cursor = 'pointer';

      const img = document.createElement('img');
      img.alt = `Portrait ${p.pid}`;
      try {
        const imageData = await window.electronAPI.customPortrait.get(p.pid);
        img.src = imageData || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/></svg>';
      } catch (e) {
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/></svg>';
      }
      card.appendChild(img);

      const pidEl = document.createElement('div');
      pidEl.className = 'portrait-pid';
      pidEl.textContent = `PID: ${p.pid}`;
      card.appendChild(pidEl);

      // Red X button to remove photo from workspace
      const removeBtn = document.createElement('button');
      removeBtn.className = 'portrait-remove-btn';
      removeBtn.innerHTML = '×';
      removeBtn.title = 'Remove from workspace';
      removeBtn.style.cssText = 'position: absolute; top: 4px; right: 4px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 14px; line-height: 1; font-weight: bold; z-index: 10;';
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleRemoveFromWorkspace(p.pid);
      });
      card.style.position = 'relative';
      card.appendChild(removeBtn);

      // Show suggested name from filename with quick confirm button
      const suggestedName = parsePlayerNameFromFilename(p.originalFilename);
      if (suggestedName) {
        const nameRow = document.createElement('div');
        nameRow.className = 'portrait-name-row';
        nameRow.style.cssText = 'display: flex; align-items: center; gap: 4px; justify-content: center;';

        const nameEl = document.createElement('span');
        nameEl.className = 'portrait-name portrait-name-suggested';
        nameEl.textContent = '? ' + suggestedName;
        nameEl.title = 'Suggested from filename';
        nameRow.appendChild(nameEl);

        // Quick confirm checkmark button
        const quickConfirm = document.createElement('button');
        quickConfirm.className = 'portrait-quick-confirm';
        quickConfirm.innerHTML = '✓';
        quickConfirm.title = 'Quick confirm this match';
        quickConfirm.style.cssText = 'background: #4caf50; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; line-height: 1;';
        quickConfirm.addEventListener('click', async (e) => {
          e.stopPropagation();
          await handleWorkspaceQuickConfirm(p.pid, suggestedName);
        });
        nameRow.appendChild(quickConfirm);

        card.appendChild(nameRow);
      }

      card.addEventListener('click', () => handleWorkspacePortraitSelect(p.pid, suggestedName));
      grid.appendChild(card);
    }

    // Setup search handler
    const searchInput = document.getElementById('workspacePlayerSearch');
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('input', handleWorkspacePlayerSearch);
    }

    // Setup assign button
    const assignBtn = document.getElementById('btn-workspace-assign');
    if (assignBtn && !assignBtn.dataset.bound) {
      assignBtn.dataset.bound = 'true';
      assignBtn.addEventListener('click', handleWorkspaceAssign);
    }
  }

  /**
   * Handle portrait selection in workspace
   */
  function handleWorkspacePortraitSelect(pid, suggestedName) {
    workspaceSelectedPid = pid;

    // Update visual selection
    const grid = document.getElementById('workspaceUnassignedGrid');
    grid.querySelectorAll('.portrait-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.pid == pid);
    });

    // Auto-search if we have a suggested name
    if (suggestedName) {
      const searchInput = document.getElementById('workspacePlayerSearch');
      if (searchInput) {
        searchInput.value = suggestedName;
        handleWorkspacePlayerSearch();
      }
    }
  }

  /**
   * Handle player search in workspace
   */
  async function handleWorkspacePlayerSearch() {
    const input = document.getElementById('workspacePlayerSearch');
    const resultsEl = document.getElementById('workspacePlayerResults');
    if (!input || !resultsEl) return;

    clearTimeout(workspaceSearchTimeout);

    const query = input.value.trim();
    if (query.length < 2) {
      resultsEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Type at least 2 characters to search...</div>';
      return;
    }

    workspaceSearchTimeout = setTimeout(async () => {
      resultsEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Searching...</div>';

      try {
        // Search player database
        console.log('[PortraitManager] Searching players for:', query);
        const response = await window.electronAPI.database.searchPlayers(query, { limit: 20 });
        console.log('[PortraitManager] Search response:', response);
        const results = response?.players || response || [];

        if (!results || results.length === 0) {
          resultsEl.innerHTML = `
            <div style="padding: 20px; text-align: center;">
              <p style="color: var(--text-secondary); margin-bottom: 12px;">No players found for "${query}"</p>
              <button id="btn-workspace-create-player" class="btn btn-secondary" style="padding: 8px 16px;">
                + Create New Player
              </button>
            </div>
          `;
          // Add create player handler
          document.getElementById('btn-workspace-create-player')?.addEventListener('click', () => {
            handleWorkspaceCreatePlayer(query);
          });
          return;
        }

        console.log('[PortraitManager] Found players:', results.length);

        resultsEl.innerHTML = results.map(p => {
          // Handle both field name formats
          const playerId = p.internalId || p.id;
          const firstName = p.firstName || p.first_name || '';
          const lastName = p.lastName || p.last_name || '';
          const position = p.position || '';
          const college = p.college || '';
          const draftYear = p.draftYear || p.draftClass || '';
          const photoId = p.photoId || p.photo_id || '';
          return `
          <div class="workspace-player-item" data-id="${playerId}" data-firstname="${firstName}" data-lastname="${lastName}"
               style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 500; color: var(--text-primary);">${firstName} ${lastName}</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">${position} - ${college} ${draftYear ? '(' + draftYear + ')' : ''}</div>
            </div>
            <div style="font-size: 0.75rem; color: ${photoId ? 'var(--accent-color)' : 'var(--text-secondary)'};">
              ${photoId ? 'PID: ' + photoId : 'No PID'}
            </div>
          </div>
        `}).join('');

        // Add click handlers
        resultsEl.querySelectorAll('.workspace-player-item').forEach(item => {
          item.addEventListener('click', () => {
            workspaceSelectedPlayerId = item.dataset.id;
            const name = `${item.dataset.firstname} ${item.dataset.lastname}`.trim();
            console.log('[PortraitManager] Selected player:', workspaceSelectedPlayerId, name);

            // Show selected player
            const selectedEl = document.getElementById('workspaceSelectedPlayer');
            const nameEl = document.getElementById('workspacePlayerName');
            const detailsEl = document.getElementById('workspacePlayerDetails');

            if (selectedEl && nameEl) {
              nameEl.textContent = name;
              detailsEl.textContent = `ID: ${item.dataset.id}`;
              selectedEl.style.display = 'block';
            }

            // Highlight selected item
            resultsEl.querySelectorAll('.workspace-player-item').forEach(i => {
              i.style.background = i === item ? 'var(--accent-color-20)' : '';
            });
          });
        });
      } catch (err) {
        console.error('[PortraitManager] Workspace search error:', err);
        resultsEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Error searching players</div>';
      }
    }, 300);
  }

  /**
   * Handle portrait assignment in workspace
   */
  async function handleWorkspaceAssign() {
    if (!workspaceSelectedPid || !workspaceSelectedPlayerId) {
      alert('Please select both a portrait and a player.');
      return;
    }

    // Save PID before clearing selection
    const assignedPid = workspaceSelectedPid;

    try {
      // Get player name
      const nameEl = document.getElementById('workspacePlayerName');
      const playerName = nameEl?.textContent || 'Unknown';

      // Update portrait metadata
      await window.electronAPI.customPortrait.updateMetadata(assignedPid, {
        playerName: playerName,
        databasePlayerId: parseInt(workspaceSelectedPlayerId)
      });

      console.log(`[PortraitManager] Assigned PID ${assignedPid} to ${playerName}`);

      // Clear selection
      workspaceSelectedPid = null;
      workspaceSelectedPlayerId = null;
      document.getElementById('workspaceSelectedPlayer').style.display = 'none';
      document.getElementById('workspacePlayerSearch').value = '';
      document.getElementById('workspacePlayerResults').innerHTML = '';

      // Remove just the assigned card from DOM instead of re-rendering entire grid
      const grid = document.getElementById('workspaceUnassignedGrid');
      const card = grid?.querySelector(`.portrait-card[data-pid="${assignedPid}"]`);
      if (card) {
        card.remove();
        console.log(`[PortraitManager] Removed card for PID ${assignedPid} from grid`);

        // Update the unassigned count badge
        const badge = document.getElementById('workspace-unassigned-count');
        if (badge) {
          const remaining = grid.querySelectorAll('.portrait-card').length;
          badge.textContent = `${remaining} to assign`;

          // Show "All Done" message if no more unassigned
          if (remaining === 0) {
            grid.innerHTML = `
              <div class="portrait-empty-state" style="padding: 40px; text-align: center;">
                <span style="font-size: 2rem;">✅</span>
                <h3 style="color: var(--text-primary);">All Done!</h3>
                <p style="color: var(--text-secondary);">All portraits have been assigned to players.</p>
              </div>
            `;
          }
        }
      } else {
        // Fallback to full refresh if card not found
        await renderWorkspaceGrid();
      }

    } catch (err) {
      console.error('[PortraitManager] Error assigning portrait:', err);
      alert('Error assigning portrait: ' + err.message);
    }
  }

  /**
   * Quick confirm a suggested name match in workspace
   */
  async function handleWorkspaceQuickConfirm(pid, suggestedName) {
    if (!suggestedName) {
      alert('No suggested name to confirm');
      return;
    }

    console.log('[PortraitManager] Quick confirming PID', pid, 'as', suggestedName);

    try {
      // Try to find a matching player in the database
      const response = await window.electronAPI.database.searchPlayers(suggestedName, { limit: 5 });
      const results = response?.players || response || [];

      if (results.length > 0) {
        // Use the first match
        const player = results[0];
        const playerId = player.internalId || player.id;
        const playerName = `${player.firstName || ''} ${player.lastName || ''}`.trim();

        await window.electronAPI.customPortrait.updateMetadata(pid, {
          playerName: playerName,
          databasePlayerId: playerId
        });

        console.log(`[PortraitManager] Quick assigned PID ${pid} to ${playerName} (ID: ${playerId})`);
      } else {
        // No database match, just assign the name
        await window.electronAPI.customPortrait.updateMetadata(pid, {
          playerName: suggestedName
        });

        console.log(`[PortraitManager] Quick assigned PID ${pid} to ${suggestedName} (no database match)`);
      }

      // Remove just the confirmed card from DOM instead of re-rendering entire grid
      const grid = document.getElementById('workspaceUnassignedGrid');
      const card = grid?.querySelector(`.portrait-card[data-pid="${pid}"]`);
      if (card) {
        card.remove();
        console.log(`[PortraitManager] Removed card for PID ${pid} from grid`);

        // Update the unassigned count badge
        const badge = document.getElementById('workspace-unassigned-count');
        if (badge) {
          const remaining = grid.querySelectorAll('.portrait-card').length;
          badge.textContent = `${remaining} to assign`;

          // Show "All Done" message if no more unassigned
          if (remaining === 0) {
            grid.innerHTML = `
              <div class="portrait-empty-state" style="padding: 40px; text-align: center;">
                <span style="font-size: 2rem;">✅</span>
                <h3 style="color: var(--text-primary);">All Done!</h3>
                <p style="color: var(--text-secondary);">All portraits have been assigned to players.</p>
              </div>
            `;
          }
        }
      } else {
        // Fallback to full refresh if card not found
        await renderWorkspaceGrid();
      }

    } catch (err) {
      console.error('[PortraitManager] Error quick confirming:', err);
      alert('Error confirming match: ' + err.message);
    }
  }

  /**
   * Remove a photo from the workspace (delete from custom portraits)
   */
  async function handleRemoveFromWorkspace(pid) {
    if (!confirm('Remove this photo from the workspace? This will delete it permanently.')) {
      return;
    }

    try {
      await window.electronAPI.customPortrait.delete(pid);
      console.log('[PortraitManager] Removed portrait PID', pid, 'from workspace');

      // Remove the card from DOM
      const grid = document.getElementById('workspaceUnassignedGrid');
      const card = grid?.querySelector(`.portrait-card[data-pid="${pid}"]`);
      if (card) {
        card.remove();

        // Update the unassigned count badge
        const badge = document.getElementById('workspace-unassigned-count');
        if (badge) {
          const remaining = grid.querySelectorAll('.portrait-card').length;
          badge.textContent = `${remaining} to assign`;

          // Show empty message if no more photos
          if (remaining === 0) {
            grid.innerHTML = `
              <div class="portrait-empty-state" style="padding: 40px; text-align: center;">
                <span style="font-size: 2rem;">🖼️</span>
                <h3 style="color: var(--text-primary);">No Portraits</h3>
                <p style="color: var(--text-secondary);">All photos have been removed or assigned.</p>
              </div>
            `;
          }
        }
      }

      // Clear selection if the removed photo was selected
      if (workspaceSelectedPid === pid) {
        workspaceSelectedPid = null;
      }
    } catch (err) {
      console.error('[PortraitManager] Error removing portrait:', err);
      alert('Error removing photo: ' + err.message);
    }
  }

  /**
   * Create a new player from workspace when no match found
   */
  async function handleWorkspaceCreatePlayer(suggestedName) {
    // Check if a photo is selected
    if (!workspaceSelectedPid) {
      alert('Please select a photo first before creating a player.');
      return;
    }

    // Parse suggested name into first/last
    const parts = suggestedName.trim().split(/\s+/);
    let firstName = '';
    let lastName = '';

    if (parts.length === 1) {
      lastName = parts[0];
    } else if (parts.length >= 2) {
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }

    console.log('[PortraitManager] Creating new player:', firstName, lastName, 'with PID:', workspaceSelectedPid);

    // Set pending portrait for database player card
    pendingPortraitPid = workspaceSelectedPid;

    // Check if Database Player Card creator is available
    if (typeof window.createNewDbPlayer === 'function') {
      // Open the full Database Player Card in create mode
      await window.createNewDbPlayer();

      // Wait a moment for the form to render, then pre-fill the fields
      setTimeout(() => {
        // Pre-fill first name
        const firstNameInput = document.getElementById('dbPlayerFirstName');
        if (firstNameInput && firstName) {
          firstNameInput.value = firstName;
        }

        // Pre-fill last name
        const lastNameInput = document.getElementById('dbPlayerLastName');
        if (lastNameInput && lastName) {
          lastNameInput.value = lastName;
        }

        // Pre-fill the PID with the portrait's PID
        const pidInput = document.getElementById('dbPlayerPID');
        if (pidInput && workspaceSelectedPid) {
          pidInput.value = workspaceSelectedPid;
        }

        // Update the header to show we're creating from portrait
        const nameEl = document.getElementById('dbPlayerCardName');
        if (nameEl) {
          nameEl.textContent = 'New Custom Player (from Portrait)';
        }

        // Load the portrait preview
        if (workspaceSelectedPid && typeof window.loadPlayerPortrait === 'function') {
          window.loadPlayerPortrait(workspaceSelectedPid);
        }

        // Focus on first name field
        if (firstNameInput) firstNameInput.focus();

        console.log('[PortraitManager] Pre-filled form with:', { firstName, lastName, pid: workspaceSelectedPid });
      }, 200);
    } else {
      // Fallback: Create directly via API
      try {
        const result = await window.electronAPI.database.createCustomPlayer({
          firstName: firstName,
          lastName: lastName,
          position: '',
          photoId: workspaceSelectedPid
        });

        if (result.success && result.playerId) {
          // Assign portrait to new player
          await window.electronAPI.customPortrait.updateMetadata(workspaceSelectedPid, {
            playerName: suggestedName,
            databasePlayerId: result.playerId
          });

          alert(`Created player: ${firstName} ${lastName}`);
          await renderWorkspaceGrid();
        } else {
          alert('Error creating player: ' + (result.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('[PortraitManager] Error creating player:', err);
        alert('Error creating player: ' + err.message);
      }
    }
  }

  /**
   * Update the portrait count badge on the landing page
   */
  async function updatePortraitCountBadge() {
    const badge = document.getElementById('my-portraits-count');
    if (badge) {
      badge.textContent = portraits.length.toString();
    }

    // Also update workspace unassigned count
    const unassignedBadge = document.getElementById('workspace-unassigned-count');
    if (unassignedBadge) {
      const unassigned = portraits.filter(p => !p.playerName && !p.databasePlayerId).length;
      unassignedBadge.textContent = `${unassigned} to assign`;
    }
  }

  // Initialize tool card landing page when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToolCardLandingPage);
  } else {
    initToolCardLandingPage();
  }

  // =============================================
  // EDIT PORTRAIT MODAL FUNCTIONS
  // =============================================

  let editingPortrait = null; // Currently editing portrait data

  /**
   * Open the edit modal for a portrait
   */
  async function handleOpenEditModal(portrait) {
    editingPortrait = portrait;

    const modal = document.getElementById('portraitEditModal');
    const preview = document.getElementById('editPortraitPreview');
    const pidLabel = document.getElementById('editPortraitPid');
    const nameInput = document.getElementById('editPlayerName');
    const yearInput = document.getElementById('editYear');
    const connectionDiv = document.getElementById('editPlayerConnection');
    const clearConnectionBtn = document.getElementById('clearPlayerConnectionBtn');

    if (!modal) {
      console.error('[PortraitManager] Edit modal not found');
      return;
    }

    // Load portrait preview
    try {
      const imageData = await window.electronAPI.customPortrait.get(portrait.pid);
      if (preview) preview.src = imageData || '';
      if (pidLabel) pidLabel.textContent = `PID: ${portrait.pid}`;
    } catch (error) {
      console.error('[PortraitManager] Error loading portrait preview:', error);
    }

    // Fill form with current values
    if (nameInput) nameInput.value = portrait.playerName || '';
    if (yearInput) yearInput.value = portrait.year || '';

    // Show database connection info
    if (connectionDiv) {
      if (portrait.databasePlayerId) {
        connectionDiv.innerHTML = `<span class="connected-player">Connected to Player ID: ${portrait.databasePlayerId}</span>`;
        if (clearConnectionBtn) clearConnectionBtn.style.display = 'inline-block';
      } else {
        connectionDiv.innerHTML = '<span class="no-connection">Not connected to database</span>';
        if (clearConnectionBtn) clearConnectionBtn.style.display = 'none';
      }
    }

    // Bind modal event handlers (only once)
    if (!modal.dataset.bound) {
      modal.dataset.bound = 'true';

      document.getElementById('closeEditModal')?.addEventListener('click', handleCloseEditModal);
      document.getElementById('cancelEditBtn')?.addEventListener('click', handleCloseEditModal);
      document.getElementById('saveEditBtn')?.addEventListener('click', handleSaveEdit);
      document.getElementById('deleteFromEditBtn')?.addEventListener('click', handleDeleteFromEditModal);
      document.getElementById('clearPlayerConnectionBtn')?.addEventListener('click', handleClearPlayerConnection);

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          handleCloseEditModal();
        }
      });
    }

    modal.style.display = 'flex';
  }

  /**
   * Close the edit modal
   */
  function handleCloseEditModal() {
    const modal = document.getElementById('portraitEditModal');
    if (modal) modal.style.display = 'none';
    editingPortrait = null;
  }

  /**
   * Save changes from the edit modal
   */
  async function handleSaveEdit() {
    if (!editingPortrait) return;

    const nameInput = document.getElementById('editPlayerName');
    const yearInput = document.getElementById('editYear');

    const newName = nameInput?.value?.trim() || null;
    const newYear = yearInput?.value ? parseInt(yearInput.value, 10) : null;

    try {
      await window.electronAPI.customPortrait.updateMetadata(editingPortrait.pid, {
        playerName: newName,
        year: newYear
      });

      showToast(`Portrait PID ${editingPortrait.pid} updated`, 'success');
      handleCloseEditModal();
      await refreshPortraits();
    } catch (error) {
      console.error('[PortraitManager] Save error:', error);
      showToast(`Save failed: ${error.message}`, 'error');
    }
  }

  /**
   * Delete portrait from the edit modal
   */
  async function handleDeleteFromEditModal() {
    if (!editingPortrait) return;

    const pid = editingPortrait.pid;
    if (!confirm(`Delete portrait PID ${pid}?\n\nThis will free up this PID for reuse.`)) {
      return;
    }

    try {
      await window.electronAPI.customPortrait.delete(pid);
      showToast(`Deleted portrait PID ${pid}`, 'success');
      handleCloseEditModal();
      await refreshPortraits();
    } catch (error) {
      console.error('[PortraitManager] Delete error:', error);
      showToast(`Delete failed: ${error.message}`, 'error');
    }
  }

  /**
   * Clear the database player connection
   */
  async function handleClearPlayerConnection() {
    if (!editingPortrait) return;

    if (!confirm('Disconnect this portrait from the database player?')) {
      return;
    }

    try {
      await window.electronAPI.customPortrait.updateMetadata(editingPortrait.pid, {
        playerName: editingPortrait.playerName,
        databasePlayerId: null
      });

      // Update local state
      editingPortrait.databasePlayerId = null;

      // Update UI
      const connectionDiv = document.getElementById('editPlayerConnection');
      const clearConnectionBtn = document.getElementById('clearPlayerConnectionBtn');
      if (connectionDiv) {
        connectionDiv.innerHTML = '<span class="no-connection">Not connected to database</span>';
      }
      if (clearConnectionBtn) {
        clearConnectionBtn.style.display = 'none';
      }

      showToast('Disconnected from database player', 'success');
    } catch (error) {
      console.error('[PortraitManager] Clear connection error:', error);
      showToast(`Failed: ${error.message}`, 'error');
    }
  }

  // Export for potential external use
  window.portraitManager = {
    refresh: refreshPortraits,
    getSelectedPids: () => Array.from(selectedPids),
    createNewPlayer: createNewPlayer,
    closeCreateModal: closeCreateModal,
    confirmCreatePlayer: confirmCreatePlayer,
    // Get/clear pending portrait PID (used by Database Player Card after save)
    getPendingPortraitPid: () => pendingPortraitPid,
    clearPendingPortraitPid: () => { pendingPortraitPid = null; },
    // Coach portrait functions
    searchCoachPortraits: handleCoachBundledSearch,
    // New modal functions
    openToolModal: openPortraitToolModal,
    updateCountBadge: updatePortraitCountBadge
  };

  // Coach portrait manager export
  window.coachPortraitManager = {
    refresh: refreshCoachPortraits,
    deletePortrait: deleteCoachPortrait,
    getSelectedPids: () => Array.from(coachSelectedPids),
    createNewCoach: createNewCoach,
    // Get/clear pending portrait PID (used by Database Coach Card after save)
    getPendingPortraitPid: () => pendingCoachPortraitPid,
    clearPendingPortraitPid: () => { pendingCoachPortraitPid = null; }
  };
})();
