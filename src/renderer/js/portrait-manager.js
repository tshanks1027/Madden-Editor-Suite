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

  // DOM Elements
  let grid = null;
  let yearFilter = null;
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

      // Update year filter options
      updateYearFilterOptions();

      // Render the grid
      renderGrid();

      // Update count
      updateCount();
    } catch (error) {
      console.error('[PortraitManager] Error loading portraits:', error);
    }
  }

  /**
   * Update the year filter dropdown with available years
   */
  function updateYearFilterOptions() {
    if (!yearFilter) return;

    const years = new Set();
    portraits.forEach(p => {
      if (p.year) years.add(p.year);
    });

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
   * Render the portrait grid
   */
  async function renderGrid() {
    if (!grid) return;

    // Filter by year if selected
    const filterYear = yearFilter?.value ? parseInt(yearFilter.value) : null;
    let filtered = filterYear
      ? portraits.filter(p => p.year === filterYear)
      : portraits;

    // Filter by view mode (workspace shows only unassigned)
    if (viewMode === 'unassigned') {
      filtered = filtered.filter(p => !p.playerName);
    }

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
        // Update custom player's PID
        await window.electronAPI.database.updateCustomPlayer(playerId, { pid: pid });
        // Update portrait metadata with player name only (custom players don't have database IDs)
        await window.electronAPI.customPortrait.updateMetadata(pid, { playerName: playerName });
      } else {
        // Update database player's appearance (PID)
        await window.electronAPI.database.saveAppearanceEdit(playerId, { pid: pid });
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

    resultsGrid.innerHTML = '<div class="bundled-empty-state"><p>Searching coaches...</p></div>';
    coachBundledSelectedPids.clear();
    updateCoachBundledExportButton();

    try {
      // Search coach portraits using the coach database
      const result = await window.electronAPI.coachDatabase.getAllCoaches();

      if (!result.success || !result.data || result.data.length === 0) {
        resultsGrid.innerHTML = '<div class="bundled-empty-state"><p>No coaches found</p></div>';
        return;
      }

      // Filter coaches by search query
      const queryLower = query.toLowerCase();
      const matchingCoaches = result.data.filter(coach => {
        const fullName = `${coach.firstName || ''} ${coach.lastName || ''}`.toLowerCase();
        const displayName = (coach.displayName || '').toLowerCase();
        return fullName.includes(queryLower) || displayName.includes(queryLower);
      });

      if (matchingCoaches.length === 0) {
        resultsGrid.innerHTML = '<div class="bundled-empty-state"><p>No coaches found matching "' + query + '"</p></div>';
        return;
      }

      // Render results with portraits
      resultsGrid.innerHTML = '';
      let loadedCount = 0;

      for (const coach of matchingCoaches.slice(0, 100)) {
        const card = document.createElement('div');
        card.className = 'bundled-portrait-card';
        card.dataset.name = coach.displayName || `${coach.firstName} ${coach.lastName}`;
        card.dataset.pid = coach.pid || '';

        const img = document.createElement('img');
        img.alt = coach.displayName || `${coach.firstName} ${coach.lastName}`;

        // Load coach portrait
        if (coach.pid && window.electronAPI?.coachPortrait) {
          try {
            const hasPortrait = await window.electronAPI.coachPortrait.hasPortrait(coach.pid);
            if (hasPortrait) {
              const imageData = await window.electronAPI.coachPortrait.getImageDataByPID(coach.pid);
              if (imageData) {
                img.src = imageData;
                loadedCount++;
              } else {
                img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="#333" width="64" height="64"/><text x="32" y="36" text-anchor="middle" fill="#666" font-size="10">No Img</text></svg>');
              }
            } else {
              img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="#333" width="64" height="64"/><text x="32" y="36" text-anchor="middle" fill="#666" font-size="10">No Img</text></svg>');
            }
          } catch (e) {
            img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="#333" width="64" height="64"/></svg>');
          }
        } else {
          img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="#333" width="64" height="64"/></svg>');
        }

        card.appendChild(img);

        const name = document.createElement('div');
        name.className = 'portrait-name';
        name.textContent = coach.pid ? `${coach.displayName || coach.firstName + ' ' + coach.lastName} (${coach.pid})` : (coach.displayName || coach.firstName + ' ' + coach.lastName);
        name.title = coach.pid ? `PID: ${coach.pid}` : 'No PID';
        card.appendChild(name);

        // Only allow selection if coach has a PID
        if (coach.pid) {
          card.addEventListener('click', () => {
            const coachName = coach.displayName || `${coach.firstName} ${coach.lastName}`;
            if (coachBundledSelectedPids.has(coachName)) {
              coachBundledSelectedPids.delete(coachName);
              card.classList.remove('selected');
            } else {
              coachBundledSelectedPids.set(coachName, coach.pid);
              card.classList.add('selected');
            }
            updateCoachBundledExportButton();
          });
        } else {
          card.style.opacity = '0.5';
          card.title = 'No PID mapping available for this coach';
        }

        resultsGrid.appendChild(card);
      }

      const exportableCount = matchingCoaches.filter(c => c.pid).length;
      showToast(`Found ${matchingCoaches.length} coach(es), ${loadedCount} with portraits`, 'success');
    } catch (error) {
      console.error('[PortraitManager] Coach search error:', error);
      resultsGrid.innerHTML = '<div class="bundled-empty-state"><p>Search failed: ' + error.message + '</p></div>';
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
  // CUSTOM COACH PORTRAIT MANAGEMENT
  // =============================================

  let coachSelectedPids = new Set();
  let coachViewMode = 'workspace'; // 'workspace' or 'all'
  let selectedCoachForAssignment = null;

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
   * Refresh custom coach portraits grid
   */
  async function refreshCoachPortraits() {
    const grid = document.getElementById('coachPortraitGrid');
    if (!grid) return;

    try {
      const yearFilter = document.getElementById('coachPortraitYearFilter')?.value;
      let portraits;

      if (yearFilter) {
        portraits = await window.electronAPI.customCoachPortrait.listByYear(parseInt(yearFilter));
      } else {
        portraits = await window.electronAPI.customCoachPortrait.list();
      }

      // Filter by view mode
      if (coachViewMode === 'workspace') {
        portraits = portraits.filter(p => !p.databaseCoachId);
      }

      // Clear selection
      coachSelectedPids.clear();
      updateCoachSelectionButtons();

      if (!portraits || portraits.length === 0) {
        grid.innerHTML = `
          <div class="portrait-empty-state">
            <span class="empty-icon">🖼️</span>
            <h3>No Coach Portraits Yet</h3>
            <p>Click "Import Portrait" to add custom coach portraits.</p>
            <p class="empty-hint">Coach portraits will be assigned PIDs starting at 50000.</p>
          </div>
        `;
        updateCoachPortraitCount(0, 0);
        return;
      }

      grid.innerHTML = '';

      for (const portrait of portraits) {
        const card = document.createElement('div');
        card.className = 'portrait-card';
        card.dataset.pid = portrait.pid;

        if (portrait.databaseCoachId) {
          card.classList.add('assigned');
        }

        // Load image
        const imageData = await window.electronAPI.customCoachPortrait.get(portrait.pid);

        card.innerHTML = `
          <img src="${imageData || ''}" alt="Coach Portrait ${portrait.pid}">
          <div class="portrait-info">
            <span class="portrait-pid">PID: ${portrait.pid}</span>
            ${portrait.coachName ? `<span class="portrait-name">${portrait.coachName}</span>` : ''}
            ${portrait.databaseCoachId ? '<span class="assigned-badge">Assigned</span>' : ''}
          </div>
          <div class="portrait-actions">
            <button class="btn-icon-small" onclick="window.coachPortraitManager.deletePortrait(${portrait.pid})" title="Delete">🗑️</button>
          </div>
        `;

        card.addEventListener('click', (e) => {
          if (e.target.closest('.portrait-actions')) return;
          toggleCoachPortraitSelection(portrait.pid, card);
        });

        grid.appendChild(card);
      }

      const unassignedCount = portraits.filter(p => !p.databaseCoachId).length;
      updateCoachPortraitCount(portraits.length, unassignedCount);

    } catch (error) {
      console.error('[PortraitManager] Error refreshing coach portraits:', error);
      grid.innerHTML = '<div class="portrait-empty-state"><p>Error loading portraits</p></div>';
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

    if (exportBtn) {
      exportBtn.disabled = coachSelectedPids.size === 0;
    }
    if (assignBtn) {
      assignBtn.disabled = coachSelectedPids.size !== 1;
    }
  }

  /**
   * Update coach portrait count display
   */
  function updateCoachPortraitCount(total, unassigned) {
    const countEl = document.getElementById('coachPortraitCount');
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
        <div class="assign-result-item ${hasExistingPid ? 'has-portrait' : ''}" data-coach-id="${coach.id}" data-coach-name="${coach.displayName}" data-existing-pid="${coach.pam || ''}">
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
            item.dataset.existingPid ? parseInt(item.dataset.existingPid) : null
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
  function selectCoachForAssignment(coachId, coachName, existingPid = null) {
    selectedCoachForAssignment = { id: parseInt(coachId), name: coachName, existingPid };

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
    const { id, name, existingPid } = selectedCoachForAssignment;

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
        await window.electronAPI.coachDatabase.saveAppearanceEdit(id, {
          maddenPam: pamValue
          // Note: maddenPid is NOT set, keeping current portrait
        });

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
        await window.electronAPI.coachDatabase.saveAppearanceEdit(id, {
          maddenPid: pid
        });

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

    // Store the current portrait PID we want to assign (from coachSelectedPids)
    if (coachSelectedPids.size !== 1) {
      showToast('No portrait selected', 'warning');
      return;
    }
    pendingCoachPortraitPid = Array.from(coachSelectedPids)[0];

    // Parse name from search query
    let coachName = searchQuery.trim();
    const nameParts = coachName.split(/\s+/);
    const suggestedFirst = nameParts[0] || '';
    const suggestedLast = nameParts.slice(1).join(' ') || '';

    // Close the assignment modal first
    closeCoachAssignModal();

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
    searchCoachPortraits: handleCoachBundledSearch
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
