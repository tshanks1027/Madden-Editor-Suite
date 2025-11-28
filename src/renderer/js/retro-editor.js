/**
 * Retro Franchise Editor
 *
 * Multi-step wizard for configuring franchise files for historical NFL seasons.
 * Steps:
 * 1. Load File - Select M26 franchise file
 * 2. Select Year - Choose target season (1966-2025)
 * 3. Preview - Review changes before applying
 * 4. Apply & Save - Apply changes and save file
 */

// Wizard state
let retroState = {
  currentStep: 1,
  filePath: null,
  fileMetadata: null,
  targetYear: null,
  previewData: null,
  applyResult: null
};

// Super Bowl number to Roman numeral mapping
const superBowlNumerals = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
  11: 'XI', 12: 'XII', 13: 'XIII', 14: 'XIV', 15: 'XV',
  16: 'XVI', 17: 'XVII', 18: 'XVIII', 19: 'XIX', 20: 'XX',
  21: 'XXI', 22: 'XXII', 23: 'XXIII', 24: 'XXIV', 25: 'XXV',
  26: 'XXVI', 27: 'XXVII', 28: 'XXVIII', 29: 'XXIX', 30: 'XXX',
  31: 'XXXI', 32: 'XXXII', 33: 'XXXIII', 34: 'XXXIV', 35: 'XXXV',
  36: 'XXXVI', 37: 'XXXVII', 38: 'XXXVIII', 39: 'XXXIX', 40: 'XL',
  41: 'XLI', 42: 'XLII', 43: 'XLIII', 44: 'XLIV', 45: 'XLV',
  46: 'XLVI', 47: 'XLVII', 48: 'XLVIII', 49: 'XLIX', 50: 'L',
  51: 'LI', 52: 'LII', 53: 'LIII', 54: 'LIV', 55: 'LV',
  56: 'LVI', 57: 'LVII', 58: 'LVIII', 59: 'LIX', 60: 'LX'
};

/**
 * Initialize the retro editor wizard
 */
function initRetroEditor() {
  console.log('[RetroEditor] Initializing...');

  // File selection button
  document.getElementById('retro-select-file')?.addEventListener('click', () => selectFranchiseFile());

  // Year selection dropdown
  document.getElementById('retro-year-select')?.addEventListener('change', (e) => {
    retroState.targetYear = parseInt(e.target.value);
    updateYearInfo(retroState.targetYear);
    updateNextButtonState();
  });

  // Navigation buttons
  document.querySelectorAll('.retro-wizard-next').forEach(btn => {
    btn.addEventListener('click', () => retroNextStep());
  });

  document.querySelectorAll('.retro-wizard-back').forEach(btn => {
    btn.addEventListener('click', () => retroPrevStep());
  });

  document.querySelector('.retro-wizard-restart')?.addEventListener('click', () => restartRetroWizard());

  // Save buttons
  document.getElementById('retro-save-file')?.addEventListener('click', () => saveRetroFile());
  document.getElementById('retro-save-file-as')?.addEventListener('click', () => saveRetroFileAs());

  // Load available years
  loadAvailableYears();

  console.log('[RetroEditor] Initialized successfully');
}

/**
 * Load available years from backend
 */
async function loadAvailableYears() {
  try {
    const result = await window.electronAPI.retro.getAvailableYears();
    if (result.success) {
      const select = document.getElementById('retro-year-select');
      select.innerHTML = '<option value="">Select a year...</option>';

      // Add years in descending order (newest first)
      result.years.sort((a, b) => b - a).forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading years:', error);
  }
}

/**
 * Select franchise file
 */
async function selectFranchiseFile() {
  try {
    const result = await window.electronAPI.retro.selectFile();

    if (result.cancelled) {
      console.log('[RetroEditor] File selection cancelled');
      return;
    }

    if (!result.success) {
      showRetroMessage('Error selecting file: ' + result.error, 'error');
      return;
    }

    // Load the file
    const loadResult = await window.electronAPI.retro.loadFile(result.filePath);

    if (!loadResult.success) {
      showRetroMessage('Error loading file: ' + loadResult.error, 'error');
      return;
    }

    // Update state
    retroState.filePath = result.filePath;
    retroState.fileMetadata = loadResult.data;

    // Debug: Dump team table structure to console
    try {
      const debugResult = await window.electronAPI.retro.debugTeamTable(result.filePath);
      if (debugResult.success) {
        console.log('[RetroEditor] Total tables in file:', debugResult.data.totalTables);
        console.log('[RetroEditor] Tables with team data (LongName/DisplayName):', JSON.stringify(debugResult.data.tablesWithTeamData, null, 2));
        console.log('[RetroEditor] First 50 table names:', debugResult.data.allTableNames?.slice(0, 50));
      } else {
        console.error('[RetroEditor] Failed to debug team table:', debugResult.error);
      }
    } catch (e) {
      console.error('[RetroEditor] Debug error:', e);
    }

    // Update UI
    const fileInput = document.getElementById('retro-franchise-file');
    fileInput.value = result.filePath;

    // Show file info
    const fileInfo = document.getElementById('retro-file-info');
    const fileDetails = document.getElementById('retro-file-details');
    fileInfo.style.display = 'flex';
    fileDetails.innerHTML = `
      Season: ${loadResult.data.currentSeasonYear || 'Unknown'}<br>
      Teams: ${loadResult.data.teamCount || 32}<br>
      Super Bowl: ${loadResult.data.superBowlNumber || 'Unknown'}
    `;

    // Enable next button
    updateNextButtonState();

    console.log('[RetroEditor] File loaded:', retroState.filePath);

  } catch (error) {
    console.error('[RetroEditor] Error selecting file:', error);
    showRetroMessage('Error: ' + error.message, 'error');
  }
}

/**
 * Update year info display
 */
function updateYearInfo(year) {
  if (!year) return;

  const superBowlNum = year - 1965; // Super Bowl I was after 1966 season
  const romanNumeral = superBowlNumerals[superBowlNum] || superBowlNum;

  const yearInfo = document.getElementById('retro-year-info');
  const sbLabel = document.getElementById('retro-superbowl-label');
  const sbDetails = document.getElementById('retro-superbowl-details');

  yearInfo.style.display = 'flex';
  sbLabel.textContent = `Super Bowl ${romanNumeral}`;
  sbDetails.textContent = `The ${year} NFL season culminating in Super Bowl ${romanNumeral} (played in January ${year + 1})`;
}

/**
 * Update next button state based on current step
 */
function updateNextButtonState() {
  const step1NextBtn = document.querySelector('#retro-wizard-step-1 .retro-wizard-next');
  const step2NextBtn = document.querySelector('#retro-wizard-step-2 .retro-wizard-next');

  // Step 1: Enable if file is loaded
  if (step1NextBtn) {
    step1NextBtn.disabled = !retroState.filePath;
  }

  // Step 2: Enable if year is selected
  if (step2NextBtn) {
    step2NextBtn.disabled = !retroState.targetYear;
  }
}

/**
 * Go to next step
 */
async function retroNextStep() {
  const currentStep = retroState.currentStep;

  // Validate before proceeding
  if (currentStep === 1 && !retroState.filePath) {
    showRetroMessage('Please select a franchise file first', 'error');
    return;
  }

  if (currentStep === 2 && !retroState.targetYear) {
    showRetroMessage('Please select a target year', 'error');
    return;
  }

  // Special handling for step 2 -> 3 (preview)
  if (currentStep === 2) {
    await loadPreview();
  }

  // Special handling for step 3 -> 4 (apply)
  if (currentStep === 3) {
    await applyChanges();
    return; // applyChanges handles the step transition
  }

  // Move to next step
  if (currentStep < 4) {
    goToRetroStep(currentStep + 1);
  }
}

/**
 * Go to previous step
 */
function retroPrevStep() {
  if (retroState.currentStep > 1) {
    goToRetroStep(retroState.currentStep - 1);
  }
}

/**
 * Go to specific step
 */
function goToRetroStep(stepNum) {
  // Hide all steps
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`retro-wizard-step-${i}`);
    if (step) {
      step.style.display = 'none';
      step.classList.remove('active');
    }
  }

  // Show target step
  const targetStep = document.getElementById(`retro-wizard-step-${stepNum}`);
  if (targetStep) {
    targetStep.style.display = 'block';
    targetStep.classList.add('active');
  }

  // Update step indicators
  document.querySelectorAll('.retro-step-indicator').forEach((indicator, index) => {
    indicator.classList.remove('active', 'completed');
    if (index + 1 < stepNum) {
      indicator.classList.add('completed');
    } else if (index + 1 === stepNum) {
      indicator.classList.add('active');
    }
  });

  retroState.currentStep = stepNum;
  console.log('[RetroEditor] Now on step', stepNum);
}

/**
 * Load preview of changes
 */
async function loadPreview() {
  try {
    showRetroMessage('Loading preview...', 'info');

    const result = await window.electronAPI.retro.previewChanges(retroState.filePath, retroState.targetYear);

    if (!result.success) {
      showRetroMessage('Error loading preview: ' + result.error, 'error');
      return;
    }

    retroState.previewData = result.data;

    // Update season changes
    const superBowlNum = retroState.targetYear - 1965;
    const romanNumeral = superBowlNumerals[superBowlNum] || superBowlNum;

    document.getElementById('preview-season-year').textContent = retroState.targetYear;
    document.getElementById('preview-superbowl').textContent = `Super Bowl ${romanNumeral}`;
    document.getElementById('preview-calendar-year').textContent = retroState.targetYear;

    // Update team changes
    const teamChangesContainer = document.getElementById('retro-team-changes');
    if (result.data.teamChanges && result.data.teamChanges.length > 0) {
      teamChangesContainer.innerHTML = result.data.teamChanges.map(change => `
        <div class="retro-change-item">
          <span class="change-label">${change.originalCity} ${change.originalName}</span>
          <span class="change-arrow">&rarr;</span>
          <span class="change-value">${change.newCity} ${change.newName}</span>
        </div>
      `).join('');
    } else {
      teamChangesContainer.innerHTML = '<p class="no-changes">No team name changes needed for this year</p>';
    }

    // Update draft changes
    const draftChangesContainer = document.getElementById('retro-draft-changes');
    if (result.data.draftChanges && result.data.draftChanges.inactiveTeams && result.data.draftChanges.inactiveTeams.length > 0) {
      draftChangesContainer.innerHTML = `
        <p>Draft picks for expansion teams will be moved to the end of each round:</p>
        <ul class="inactive-teams-list">
          ${result.data.draftChanges.inactiveTeams.map(team => `<li>${team}</li>`).join('')}
        </ul>
      `;
    } else {
      draftChangesContainer.innerHTML = '<p class="no-changes">No draft pick reordering needed (all 32 teams active)</p>';
    }

    hideRetroMessage();

  } catch (error) {
    console.error('[RetroEditor] Error loading preview:', error);
    showRetroMessage('Error: ' + error.message, 'error');
  }
}

/**
 * Apply changes to franchise file
 */
async function applyChanges() {
  try {
    // Move to step 4 first
    goToRetroStep(4);

    // Show progress
    const progressBar = document.getElementById('retro-progress-bar');
    const progressText = document.getElementById('retro-progress-text');
    const resultsSection = document.getElementById('retro-results-section');
    const errorSection = document.getElementById('retro-error-section');

    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';

    // Animate progress
    progressBar.style.width = '20%';
    progressText.textContent = 'Applying season settings...';
    await sleep(500);

    progressBar.style.width = '50%';
    progressText.textContent = 'Updating team names...';
    await sleep(500);

    progressBar.style.width = '80%';
    progressText.textContent = 'Reordering draft picks...';

    // Apply all changes
    const result = await window.electronAPI.retro.applyAllChanges(retroState.filePath, retroState.targetYear);

    progressBar.style.width = '100%';
    await sleep(300);

    if (result.success) {
      retroState.applyResult = result.data;
      progressText.textContent = 'Changes applied successfully!';

      // Show results
      const resultsSummary = document.getElementById('retro-results-summary');
      resultsSummary.innerHTML = `
        <ul>
          <li>Season year set to ${retroState.targetYear}</li>
          <li>Super Bowl number updated</li>
          <li>${result.data.teamChanges || 0} team name(s) updated</li>
          <li>${result.data.draftPicksReordered || 0} draft pick(s) reordered</li>
        </ul>
      `;

      resultsSection.style.display = 'block';

    } else {
      progressText.textContent = 'Error applying changes';
      document.getElementById('retro-error-message').textContent = result.error;
      errorSection.style.display = 'block';
    }

  } catch (error) {
    console.error('[RetroEditor] Error applying changes:', error);
    document.getElementById('retro-progress-text').textContent = 'Error applying changes';
    document.getElementById('retro-error-message').textContent = error.message;
    document.getElementById('retro-error-section').style.display = 'block';
  }
}

/**
 * Save the modified franchise file (overwrite original)
 */
async function saveRetroFile() {
  try {
    const saveBtn = document.getElementById('retro-save-file');
    const saveAsBtn = document.getElementById('retro-save-file-as');
    saveBtn.disabled = true;
    saveAsBtn.disabled = true;
    saveBtn.innerHTML = '<span class="btn-icon">&#8987;</span> Saving...';

    const result = await window.electronAPI.retro.saveFile(retroState.filePath);

    if (result.success) {
      saveBtn.innerHTML = '<span class="btn-icon">&#9989;</span> Saved!';
      saveBtn.classList.add('success');
      saveAsBtn.style.display = 'none';
      showRetroMessage('Franchise file saved successfully!', 'success');

      // Close the file
      await window.electronAPI.retro.closeFile(retroState.filePath);

    } else {
      saveBtn.disabled = false;
      saveAsBtn.disabled = false;
      saveBtn.innerHTML = '<span class="btn-icon">&#128190;</span> Overwrite Original';
      showRetroMessage('Error saving file: ' + result.error, 'error');
    }

  } catch (error) {
    console.error('[RetroEditor] Error saving file:', error);
    const saveBtn = document.getElementById('retro-save-file');
    const saveAsBtn = document.getElementById('retro-save-file-as');
    saveBtn.disabled = false;
    saveAsBtn.disabled = false;
    saveBtn.innerHTML = '<span class="btn-icon">&#128190;</span> Overwrite Original';
    showRetroMessage('Error: ' + error.message, 'error');
  }
}

/**
 * Save the modified franchise file to a new location
 */
async function saveRetroFileAs() {
  try {
    const saveBtn = document.getElementById('retro-save-file');
    const saveAsBtn = document.getElementById('retro-save-file-as');
    saveAsBtn.disabled = true;
    saveBtn.disabled = true;
    saveAsBtn.innerHTML = '<span class="btn-icon">&#8987;</span> Saving...';

    const result = await window.electronAPI.retro.saveFileAs(retroState.filePath);

    if (result.cancelled) {
      // User cancelled the save dialog
      saveAsBtn.disabled = false;
      saveBtn.disabled = false;
      saveAsBtn.innerHTML = '<span class="btn-icon">&#128190;</span> Save As New File';
      return;
    }

    if (result.success) {
      saveAsBtn.innerHTML = '<span class="btn-icon">&#9989;</span> Saved!';
      saveAsBtn.classList.add('success');
      saveBtn.style.display = 'none';
      showRetroMessage(`Franchise file saved to: ${result.newPath}`, 'success');

      // Update the file path in state to the new location
      retroState.filePath = result.newPath;

      // Close the file
      await window.electronAPI.retro.closeFile(retroState.filePath);

    } else {
      saveAsBtn.disabled = false;
      saveBtn.disabled = false;
      saveAsBtn.innerHTML = '<span class="btn-icon">&#128190;</span> Save As New File';
      showRetroMessage('Error saving file: ' + result.error, 'error');
    }

  } catch (error) {
    console.error('[RetroEditor] Error saving file as:', error);
    const saveAsBtn = document.getElementById('retro-save-file-as');
    const saveBtn = document.getElementById('retro-save-file');
    saveAsBtn.disabled = false;
    saveBtn.disabled = false;
    saveAsBtn.innerHTML = '<span class="btn-icon">&#128190;</span> Save As New File';
    showRetroMessage('Error: ' + error.message, 'error');
  }
}

/**
 * Restart the wizard
 */
async function restartRetroWizard() {
  // Close current file if open
  if (retroState.filePath) {
    try {
      await window.electronAPI.retro.closeFile(retroState.filePath);
    } catch (e) {
      console.log('[RetroEditor] Error closing file:', e);
    }
  }

  // Reset state
  retroState = {
    currentStep: 1,
    filePath: null,
    fileMetadata: null,
    targetYear: null,
    previewData: null,
    applyResult: null
  };

  // Reset UI
  document.getElementById('retro-franchise-file').value = '';
  document.getElementById('retro-file-info').style.display = 'none';
  document.getElementById('retro-year-select').value = '';
  document.getElementById('retro-year-info').style.display = 'none';
  document.getElementById('retro-progress-bar').style.width = '0%';
  document.getElementById('retro-progress-text').textContent = 'Ready to apply changes...';
  document.getElementById('retro-results-section').style.display = 'none';
  document.getElementById('retro-error-section').style.display = 'none';

  const saveBtn = document.getElementById('retro-save-file');
  saveBtn.disabled = false;
  saveBtn.innerHTML = '<span class="btn-icon">&#128190;</span> Overwrite Original';
  saveBtn.classList.remove('success');
  saveBtn.style.display = '';

  const saveAsBtn = document.getElementById('retro-save-file-as');
  saveAsBtn.disabled = false;
  saveAsBtn.innerHTML = '<span class="btn-icon">&#128190;</span> Save As New File';
  saveAsBtn.classList.remove('success');
  saveAsBtn.style.display = '';

  hideRetroMessage();
  updateNextButtonState();
  goToRetroStep(1);

  console.log('[RetroEditor] Wizard reset');
}

/**
 * Show message to user
 */
function showRetroMessage(message, type = 'info') {
  const messageEl = document.getElementById('retro-wizard-message');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.className = `wizard-message ${type}`;
    messageEl.style.display = 'block';
  }
}

/**
 * Hide message
 */
function hideRetroMessage() {
  const messageEl = document.getElementById('retro-wizard-message');
  if (messageEl) {
    messageEl.style.display = 'none';
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * DEBUG: Analyze team table structure to find correct unique ID
 * Call from browser console: debugTeamTable()
 */
async function debugTeamTable() {
  if (!retroState.filePath) {
    console.error('[RetroEditor] No file loaded. Load a franchise file first.');
    return;
  }

  console.log('[RetroEditor] Debugging team table for:', retroState.filePath);
  showRetroMessage('Analyzing team tables...', 'info');

  try {
    const result = await window.electronAPI.retro.debugTeamTable(retroState.filePath);
    console.log('[RetroEditor] Debug result:', result);

    if (result.success) {
      console.log('=== TEAM TABLE ANALYSIS ===');
      console.log('Total tables in file:', result.data.totalTables);
      console.log('Tables with NFL teams:', result.data.tablesWithNFLTeams);
      console.log('Best match:', result.data.bestTeamTable);
      console.log('Recommended unique ID:', result.data.bestTeamTableId);
      console.log('getTableByName("Team") result:', result.data.teamByNameInfo);
      console.log('Recommendation:', result.data.recommendation);

      // Show in UI
      showRetroMessage(result.data.recommendation, 'info');
    } else {
      console.error('[RetroEditor] Debug failed:', result.error);
      showRetroMessage('Debug failed: ' + result.error, 'error');
    }

    return result;
  } catch (error) {
    console.error('[RetroEditor] Error debugging team table:', error);
    showRetroMessage('Error: ' + error.message, 'error');
    return null;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if on the main editor page with retro tool
  if (document.getElementById('retro-tool')) {
    initRetroEditor();
  }
});

// Export for use by other modules
window.initRetroEditor = initRetroEditor;
window.debugTeamTable = debugTeamTable;
