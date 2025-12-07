/**
 * CSV Import Module
 *
 * Provides functionality to import custom players from CSV files.
 * Follows the ALL_PLAYER_LOOKUP.csv format.
 */

(function() {
  'use strict';

  // Module state
  let currentCsvContent = null;
  let currentFileName = null;
  let currentStep = 1;
  let validationResult = null;

  /**
   * Initialize the CSV Import module
   */
  function initCsvImport() {
    console.log('[CsvImport] Initializing...');
    setupEventListeners();
    console.log('[CsvImport] Initialized');
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Open CSV Import button (in Player Browser)
    var openBtn = document.getElementById('openCsvImport');
    if (openBtn) {
      openBtn.addEventListener('click', openCsvImportModal);
    }

    // Close button
    var closeBtn = document.getElementById('closeCsvImport');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeCsvImportModal);
    }

    // Cancel button
    var cancelBtn = document.getElementById('csvImportCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeCsvImportModal);
    }

    // Download template button
    var templateBtn = document.getElementById('csvDownloadTemplate');
    if (templateBtn) {
      templateBtn.addEventListener('click', downloadTemplate);
    }

    // Select file button
    var selectFileBtn = document.getElementById('csvImportSelectFile');
    if (selectFileBtn) {
      selectFileBtn.addEventListener('click', selectCsvFile);
    }

    // Back button
    var backBtn = document.getElementById('csvImportBack');
    if (backBtn) {
      backBtn.addEventListener('click', goBack);
    }

    // Submit/Import button
    var submitBtn = document.getElementById('csvImportSubmit');
    if (submitBtn) {
      submitBtn.addEventListener('click', importPlayers);
    }

    // Modal click outside
    var modal = document.getElementById('csvImportModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closeCsvImportModal();
        }
      });
    }
  }

  /**
   * Download a CSV template file
   */
  function downloadTemplate() {
    console.log('[CsvImport] Downloading template...');

    // Template header matching expected format
    var headers = [
      'Last Name',      // 0 - Required
      'First Name',     // 1 - Required
      'College',        // 2 - College name (e.g., "Ohio State")
      'Round',          // 3 - Draft round (e.g., "1" or "1st")
      'Pick',           // 4 - Draft pick number
      'Draft Class',    // 5 - Year drafted (e.g., 2024)
      'Position',       // 6 - Position (e.g., "QB", "WR")
      'Jersey',         // 7 - Jersey number
      'PhotoID',        // 8 - Madden PhotoID (optional)
      'PAM',            // 9 - Madden PAM (optional)
      'CommID',         // 10 - Madden CommID (optional)
      'PLPO',           // 11 - Madden PLPO (optional)
      'Height',         // 12 - Height in inches (e.g., 74 = 6'2")
      'Weight',         // 13 - Weight in lbs
      'Career From',    // 14 - First season year
      'Career To',      // 15 - Last season year
      'Pro Bowls',      // 16
      'All Pros',       // 17
      'HOF',            // 18 - "Y" or empty
      'Retired',        // 19 - "Y" or empty
      'Seasons',        // 20
      'Race'            // 21 - White, Black, Asian, Hispanic, Other
    ];

    // Example rows to help users understand format
    var exampleRows = [
      ['Smith', 'John', 'Ohio State', '1', '15', '2024', 'QB', '12', '', '', '', '', '75', '220', '2024', '', '', '', '', '', '', 'White'],
      ['Johnson', 'Mike', 'Alabama', '2', '45', '2024', 'WR', '81', '', '', '', '', '72', '195', '2024', '', '', '', '', '', '', 'Black'],
      ['Williams', 'Chris', 'Georgia', '3', '88', '2024', 'LT', '77', '', '', '', '', '78', '315', '2024', '', '', '', '', '', '', '']
    ];

    // Build CSV content
    var csvContent = headers.join(',') + '\n';
    exampleRows.forEach(function(row) {
      csvContent += row.join(',') + '\n';
    });

    // Create and trigger download
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'created_players_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('[CsvImport] Template downloaded');
  }

  /**
   * Open the CSV Import modal
   */
  function openCsvImportModal() {
    console.log('[CsvImport] Opening modal');

    // Reset state
    currentCsvContent = null;
    currentFileName = null;
    currentStep = 1;
    validationResult = null;

    // Reset UI
    showStep(1);
    document.getElementById('csvImportFileName').textContent = '';

    // Show modal
    var modal = document.getElementById('csvImportModal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  /**
   * Close the CSV Import modal
   */
  function closeCsvImportModal() {
    console.log('[CsvImport] Closing modal');
    var modal = document.getElementById('csvImportModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Show a specific step in the wizard
   */
  function showStep(step) {
    currentStep = step;

    // Hide all steps
    for (var i = 1; i <= 4; i++) {
      var stepEl = document.getElementById('csvImportStep' + i);
      if (stepEl) {
        stepEl.style.display = 'none';
      }
    }

    // Show current step
    var currentStepEl = document.getElementById('csvImportStep' + step);
    if (currentStepEl) {
      currentStepEl.style.display = 'block';
    }

    // Update buttons
    var backBtn = document.getElementById('csvImportBack');
    var cancelBtn = document.getElementById('csvImportCancel');
    var submitBtn = document.getElementById('csvImportSubmit');

    if (backBtn) backBtn.style.display = step === 2 ? 'inline-block' : 'none';
    if (cancelBtn) cancelBtn.style.display = step < 4 ? 'inline-block' : 'none';
    if (submitBtn) {
      submitBtn.style.display = step === 2 ? 'inline-block' : 'none';
      if (step === 4) {
        submitBtn.textContent = 'Close';
        submitBtn.style.display = 'inline-block';
        submitBtn.onclick = closeCsvImportModal;
      } else {
        submitBtn.textContent = 'Import Players';
        submitBtn.onclick = importPlayers;
      }
    }
  }

  /**
   * Go back to previous step
   */
  function goBack() {
    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  }

  /**
   * Select a CSV file
   */
  async function selectCsvFile() {
    console.log('[CsvImport] Selecting file...');

    if (!window.electronAPI || !window.electronAPI.database) {
      alert('Database API not available. Please reload the application.');
      return;
    }

    try {
      console.log('[CsvImport] Calling selectCsvFile IPC...');
      var result = await window.electronAPI.database.selectCsvFile();
      console.log('[CsvImport] selectCsvFile result:', result);

      if (result.canceled) {
        console.log('[CsvImport] File selection canceled');
        return;
      }

      if (!result.success) {
        alert('Error selecting file: ' + (result.error || 'Unknown error'));
        return;
      }

      currentCsvContent = result.content;
      currentFileName = result.filePath.split(/[/\\]/).pop();

      console.log('[CsvImport] File selected:', currentFileName);
      console.log('[CsvImport] Content length:', currentCsvContent ? currentCsvContent.length : 0);
      console.log('[CsvImport] First 200 chars:', currentCsvContent ? currentCsvContent.substring(0, 200) : 'null');
      document.getElementById('csvImportFileName').textContent = 'Selected: ' + currentFileName;

      // Validate the CSV
      await validateCsv();

    } catch (error) {
      console.error('[CsvImport] Error selecting file:', error);
      alert('Error selecting file: ' + error.message);
    }
  }

  /**
   * Validate the selected CSV file
   */
  async function validateCsv() {
    console.log('[CsvImport] Validating CSV...');

    if (!currentCsvContent) {
      alert('No file selected');
      return;
    }

    try {
      console.log('[CsvImport] Calling validateCsv IPC...');
      var result = await window.electronAPI.database.validateCsv(currentCsvContent);
      console.log('[CsvImport] validateCsv result:', result);

      if (!result.success) {
        alert('Validation failed: ' + (result.error || 'Unknown error'));
        return;
      }

      validationResult = result;

      // Update stats
      document.getElementById('csvTotalRows').textContent = result.totalRows;
      document.getElementById('csvValidCount').textContent = result.validCount;
      document.getElementById('csvErrorCount').textContent = result.errorCount;

      // Show preview
      var previewEl = document.getElementById('csvImportPreview');
      if (previewEl && result.preview) {
        previewEl.innerHTML = result.preview.map(function(p) {
          return '<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #333;">' +
            '<span style="flex: 2;">' + p.name + '</span>' +
            '<span style="flex: 1; text-align: center;">' + p.position + '</span>' +
            '<span style="flex: 2;">' + p.college + '</span>' +
            '<span style="flex: 1; text-align: center;">' + p.draftClass + '</span>' +
          '</div>';
        }).join('');
      }

      // Show errors if any
      var errorsContainer = document.getElementById('csvImportErrors');
      var errorsList = document.getElementById('csvImportErrorList');
      if (errorsContainer && errorsList) {
        if (result.errors && result.errors.length > 0) {
          errorsContainer.style.display = 'block';
          errorsList.innerHTML = result.errors.map(function(e) {
            return '<div>' + e + '</div>';
          }).join('');
        } else {
          errorsContainer.style.display = 'none';
        }
      }

      // Move to step 2
      showStep(2);

    } catch (error) {
      console.error('[CsvImport] Validation error:', error);
      alert('Validation error: ' + error.message);
    }
  }

  /**
   * Import players from the CSV
   */
  async function importPlayers() {
    console.log('[CsvImport] Starting import...');

    if (!currentCsvContent || !validationResult) {
      alert('No file to import');
      return;
    }

    // Show progress step
    showStep(3);

    var progressEl = document.getElementById('csvImportProgress');
    var progressBar = document.getElementById('csvImportProgressBar');

    if (progressEl) progressEl.textContent = 'Importing ' + validationResult.validCount + ' players...';
    if (progressBar) progressBar.style.width = '50%';

    try {
      var result = await window.electronAPI.database.importCsv(currentCsvContent);

      if (progressBar) progressBar.style.width = '100%';

      // Short delay to show completed progress
      setTimeout(function() {
        // Show result step
        showStep(4);

        var resultEl = document.getElementById('csvImportResult');
        if (resultEl) {
          resultEl.innerHTML =
            '<p><strong>' + result.imported + '</strong> players imported successfully</p>' +
            (result.skipped > 0 ? '<p>' + result.skipped + ' players skipped</p>' : '');

          if (result.errors && result.errors.length > 0) {
            resultEl.innerHTML +=
              '<div style="margin-top: 15px; text-align: left; max-height: 100px; overflow-y: auto; font-size: 11px; color: #ff6b6b;">' +
              result.errors.slice(0, 5).map(function(e) { return '<div>' + e + '</div>'; }).join('') +
              (result.errors.length > 5 ? '<div>... and ' + (result.errors.length - 5) + ' more errors</div>' : '') +
              '</div>';
          }
        }

        // Refresh the player browser if open
        if (typeof window.refreshPlayerBrowser === 'function') {
          window.refreshPlayerBrowser();
        }

      }, 500);

    } catch (error) {
      console.error('[CsvImport] Import error:', error);
      showStep(4);

      var resultEl = document.getElementById('csvImportResult');
      if (resultEl) {
        resultEl.innerHTML =
          '<div style="color: #f44336;">' +
          '<div style="font-size: 48px;">&#10007;</div>' +
          '<h3>Import Failed</h3>' +
          '<p>' + error.message + '</p>' +
          '</div>';
      }
    }
  }

  // Expose public functions
  window.initCsvImport = initCsvImport;
  window.openCsvImportModal = openCsvImportModal;
  window.closeCsvImportModal = closeCsvImportModal;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCsvImport);
  } else {
    initCsvImport();
  }

})();
