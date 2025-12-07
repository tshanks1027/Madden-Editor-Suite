/**
 * Database Management Module
 *
 * Provides functionality to manage the user database:
 * - View statistics (edited players, custom players)
 * - Reset edits and custom players
 * - Create and restore backups
 */

(function() {
  'use strict';

  /**
   * Initialize the Database Management module
   */
  function initDbManagement() {
    console.log('[DbManagement] Initializing...');
    setupEventListeners();
    console.log('[DbManagement] Initialized');
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Open Database Management button
    var openBtn = document.getElementById('openDbManagement');
    if (openBtn) {
      openBtn.addEventListener('click', openDbManagementModal);
    }

    // Close button
    var closeBtn = document.getElementById('closeDbManagement');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDbManagementModal);
    }

    // Done/Close button (footer)
    var closeFooterBtn = document.getElementById('closeDbManagementBtn');
    if (closeFooterBtn) {
      closeFooterBtn.addEventListener('click', closeDbManagementModal);
    }

    // Reset buttons
    var resetEditedBtn = document.getElementById('resetEditedPlayers');
    if (resetEditedBtn) {
      resetEditedBtn.addEventListener('click', resetEditedPlayers);
    }

    var resetCustomBtn = document.getElementById('resetCustomPlayers');
    if (resetCustomBtn) {
      resetCustomBtn.addEventListener('click', resetCustomPlayers);
    }

    var resetAllBtn = document.getElementById('resetAllDatabase');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', resetAllDatabase);
    }

    // Backup buttons
    var createBackupBtn = document.getElementById('createDbBackup');
    if (createBackupBtn) {
      createBackupBtn.addEventListener('click', createBackup);
    }

    var restoreBackupBtn = document.getElementById('restoreDbBackup');
    if (restoreBackupBtn) {
      restoreBackupBtn.addEventListener('click', showBackupList);
    }

    var confirmRestoreBtn = document.getElementById('confirmRestoreBackup');
    if (confirmRestoreBtn) {
      confirmRestoreBtn.addEventListener('click', restoreSelectedBackup);
    }

    // Modal click outside
    var modal = document.getElementById('dbManagementModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closeDbManagementModal();
        }
      });
    }
  }

  /**
   * Open the Database Management modal
   */
  async function openDbManagementModal() {
    console.log('[DbManagement] Opening modal');

    // Show modal
    var modal = document.getElementById('dbManagementModal');
    if (modal) {
      modal.style.display = 'flex';
    }

    // Hide backup list initially
    var backupListContainer = document.getElementById('backupListContainer');
    if (backupListContainer) {
      backupListContainer.style.display = 'none';
    }

    // Load statistics
    await loadStatistics();
  }

  /**
   * Close the Database Management modal
   */
  async function closeDbManagementModal() {
    console.log('[DbManagement] Closing modal');
    var modal = document.getElementById('dbManagementModal');
    if (modal) {
      modal.style.display = 'none';
    }

    // Let player browser handle focus restoration (it has its own IPC focus call)
    // Don't call forceWindowFocus() here - duplicate IPC focus calls confuse Windows
    if (typeof window.restoreFocusToPlayerBrowser === 'function') {
      window.restoreFocusToPlayerBrowser();
    } else {
      // Fallback if player browser isn't open
      await forceWindowFocus();
    }
  }

  /**
   * Load and display database statistics
   */
  async function loadStatistics() {
    console.log('[DbManagement] Loading statistics...');

    if (!window.electronAPI || !window.electronAPI.database) {
      console.error('[DbManagement] Database API not available');
      return;
    }

    try {
      var stats = await window.electronAPI.database.getStats();
      console.log('[DbManagement] Stats:', stats);

      // Update display
      var editedEl = document.getElementById('dbStatEditedPlayers');
      var customEl = document.getElementById('dbStatCustomPlayers');

      if (editedEl) {
        editedEl.textContent = stats.editedPlayers || 0;
      }
      if (customEl) {
        customEl.textContent = stats.customPlayers || 0;
      }

    } catch (error) {
      console.error('[DbManagement] Error loading stats:', error);
    }
  }

  /**
   * Force window focus via IPC (required after native dialogs on Windows)
   * MUST be awaited to ensure focus is restored before continuing
   */
  async function forceWindowFocus() {
    if (window.electronAPI && window.electronAPI.window && window.electronAPI.window.focus) {
      await window.electronAPI.window.focus();
      console.log('[DbManagement] Window focus restored via IPC');
    }
  }

  /**
   * Reset edited players (remove all edits to original database players)
   */
  async function resetEditedPlayers() {
    var confirmed = confirm(
      'Are you sure you want to reset ALL edited players?\n\n' +
      'This will remove all your edits to original database players.\n' +
      'This action cannot be undone.'
    );
    await forceWindowFocus();

    if (!confirmed) return;

    try {
      console.log('[DbManagement] Resetting edited players...');
      await window.electronAPI.database.resetAllEdits();
      console.log('[DbManagement] Edited players reset');
      alert('All edited players have been reset to their original values.');
      await forceWindowFocus();
      await loadStatistics();

      // Refresh player browser if open
      if (typeof window.refreshPlayerBrowser === 'function') {
        window.refreshPlayerBrowser();
      }

    } catch (error) {
      console.error('[DbManagement] Error resetting edits:', error);
      alert('Error resetting edited players: ' + error.message);
      await forceWindowFocus();
    }
  }

  /**
   * Reset custom players (delete all user-created players)
   */
  async function resetCustomPlayers() {
    var confirmed = confirm(
      'Are you sure you want to DELETE ALL custom players?\n\n' +
      'This will permanently remove all players you imported or created.\n' +
      'This action cannot be undone.'
    );
    await forceWindowFocus();

    if (!confirmed) return;

    try {
      console.log('[DbManagement] Resetting custom players...');
      await window.electronAPI.database.resetAllCustomPlayers();
      console.log('[DbManagement] Custom players reset');
      alert('All custom players have been deleted.');
      await forceWindowFocus();
      await loadStatistics();

      // Refresh player browser if open
      if (typeof window.refreshPlayerBrowser === 'function') {
        window.refreshPlayerBrowser();
      }

    } catch (error) {
      console.error('[DbManagement] Error resetting custom players:', error);
      alert('Error deleting custom players: ' + error.message);
      await forceWindowFocus();
    }
  }

  /**
   * Reset all database (edits and custom players)
   */
  async function resetAllDatabase() {
    var confirmed = confirm(
      '⚠️ WARNING: COMPLETE DATABASE RESET ⚠️\n\n' +
      'This will:\n' +
      '• Remove ALL edits to original players\n' +
      '• DELETE ALL custom/imported players\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Are you absolutely sure?'
    );
    await forceWindowFocus();

    if (!confirmed) return;

    // Double confirmation for complete reset
    var doubleConfirm = confirm(
      'FINAL CONFIRMATION\n\n' +
      'Type "yes" in your mind and click OK to proceed with complete reset.'
    );
    await forceWindowFocus();

    if (!doubleConfirm) return;

    try {
      console.log('[DbManagement] Resetting all database...');
      await window.electronAPI.database.resetAll();
      console.log('[DbManagement] All database reset');
      alert('Database has been completely reset.');
      await forceWindowFocus();
      await loadStatistics();

      // Refresh player browser if open
      if (typeof window.refreshPlayerBrowser === 'function') {
        window.refreshPlayerBrowser();
      }

    } catch (error) {
      console.error('[DbManagement] Error resetting all:', error);
      alert('Error resetting database: ' + error.message);
      await forceWindowFocus();
    }
  }

  /**
   * Create a backup of the user database
   */
  async function createBackup() {
    try {
      console.log('[DbManagement] Creating backup...');
      var result = await window.electronAPI.database.createBackup();

      if (result.success) {
        console.log('[DbManagement] Backup created:', result.backupPath);
        alert('Backup created successfully!\n\nSaved to:\n' + result.backupPath);
        await forceWindowFocus();
      } else {
        throw new Error(result.error || 'Unknown error');
      }

    } catch (error) {
      console.error('[DbManagement] Error creating backup:', error);
      alert('Error creating backup: ' + error.message);
      await forceWindowFocus();
    }
  }

  /**
   * Show the backup list for restoration
   */
  async function showBackupList() {
    var container = document.getElementById('backupListContainer');
    var listEl = document.getElementById('backupList');

    if (!container || !listEl) return;

    try {
      console.log('[DbManagement] Loading backup list...');
      var result = await window.electronAPI.database.getBackupList();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load backups');
      }

      var backups = result.backups || [];
      console.log('[DbManagement] Found', backups.length, 'backups');

      // Clear existing options
      listEl.innerHTML = '';

      if (backups.length === 0) {
        listEl.innerHTML = '<option value="">No backups found</option>';
        container.style.display = 'block';
        return;
      }

      // Build backup list as select options
      backups.forEach(function(backup, index) {
        var date = new Date(backup.timestamp);
        var dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        var option = document.createElement('option');
        option.value = backup.path;
        option.textContent = dateStr + ' (' + formatFileSize(backup.size) + ')';
        if (index === 0) option.selected = true;
        listEl.appendChild(option);
      });

      container.style.display = 'block';

    } catch (error) {
      console.error('[DbManagement] Error loading backups:', error);
      listEl.innerHTML = '<option value="">Error: ' + error.message + '</option>';
      container.style.display = 'block';
    }
  }

  /**
   * Restore the selected backup
   */
  async function restoreSelectedBackup() {
    var selectEl = document.getElementById('backupList');
    if (!selectEl || !selectEl.value) {
      alert('Please select a backup to restore');
      await forceWindowFocus();
      return;
    }

    var backupPath = selectEl.value;

    var confirmed = confirm(
      'Are you sure you want to restore this backup?\n\n' +
      'This will replace your current database with the backup.\n' +
      'Your current data will be lost.'
    );
    await forceWindowFocus();

    if (!confirmed) return;

    try {
      console.log('[DbManagement] Restoring backup:', backupPath);
      var result = await window.electronAPI.database.restoreBackup(backupPath);

      if (result.success) {
        console.log('[DbManagement] Backup restored');
        alert('Backup restored successfully!');
        await forceWindowFocus();

        // Hide backup list
        var container = document.getElementById('backupListContainer');
        if (container) container.style.display = 'none';

        // Reload statistics
        await loadStatistics();

        // Refresh player browser if open
        if (typeof window.refreshPlayerBrowser === 'function') {
          window.refreshPlayerBrowser();
        }

      } else {
        throw new Error(result.error || 'Unknown error');
      }

    } catch (error) {
      console.error('[DbManagement] Error restoring backup:', error);
      alert('Error restoring backup: ' + error.message);
      await forceWindowFocus();
    }
  }

  /**
   * Format file size for display
   */
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Expose public functions
  window.initDbManagement = initDbManagement;
  window.openDbManagementModal = openDbManagementModal;
  window.closeDbManagementModal = closeDbManagementModal;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDbManagement);
  } else {
    initDbManagement();
  }

})();
