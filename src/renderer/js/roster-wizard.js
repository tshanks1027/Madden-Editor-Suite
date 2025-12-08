/**
 * Roster Generator Wizard
 *
 * Multi-step wizard for generating rosters with:
 * - Mode selection (single year / all-time / all-decade)
 * - Year selection
 * - Preview & generation
 * - Results and actions
 */

// Wizard state
let rosterWizardState = {
  currentStep: 1,
  mode: 'single-year',  // 'single-year', 'all-time', or 'all-decade'
  year: null,
  startYear: null,
  endYear: null,
  generatedRoster: null,
  availableYears: []
};

/**
 * Initialize the roster wizard
 */
function initRosterWizard() {
  console.log('[RosterWizard] Initializing...');

  // Step 1: Mode selection cards
  document.querySelectorAll('.roster-mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        rosterWizardState.mode = radio.value;

        // Update card visuals
        document.querySelectorAll('.roster-mode-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      }
    });
  });

  // Navigation buttons
  document.querySelectorAll('.roster-wizard-next').forEach(btn => {
    btn.addEventListener('click', () => rosterNextStep());
  });

  document.querySelectorAll('.roster-wizard-back').forEach(btn => {
    btn.addEventListener('click', () => rosterPrevStep());
  });

  document.querySelector('.roster-wizard-generate')?.addEventListener('click', () => generateRoster());
  document.querySelector('.roster-wizard-restart')?.addEventListener('click', () => restartRosterWizard());

  // Result action buttons
  document.getElementById('roster-wizard-save')?.addEventListener('click', () => saveRosterFile());
  document.getElementById('roster-wizard-load-editor')?.addEventListener('click', () => loadRosterIntoEditor());

  // Load available years on init
  loadAvailableYears();

  console.log('[RosterWizard] Initialized successfully');
}

/**
 * Load available years from backend
 */
async function loadAvailableYears() {
  console.log('[RosterWizard] Loading available years...');

  try {
    const result = await window.electronAPI.rosterGenerator.getAvailableYears();
    console.log('[RosterWizard] 🔍 DIAGNOSTIC: getAvailableYears() returned:', result);

    if (result.success) {
      rosterWizardState.availableYears = result.years;
      console.log('[RosterWizard] Available years count:', result.years.length);
      console.log('[RosterWizard] 🔍 DIAGNOSTIC: First 5 years:', result.years.slice(0, 5));
      console.log('[RosterWizard] 🔍 DIAGNOSTIC: Year types:', result.years.slice(0, 3).map(y => `${y} (${typeof y})`));

      // Populate year dropdowns
      populateYearDropdowns(result.years);
    } else {
      console.error('[RosterWizard] Failed to load years:', result.error);
      showRosterMessage('Failed to load available years: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('[RosterWizard] Error loading years:', error);
    showRosterMessage('Error loading years: ' + error.message, 'error');
  }
}

/**
 * Populate year dropdown elements
 */
function populateYearDropdowns(years) {
  console.log('[RosterWizard] 🔍 DIAGNOSTIC: populateYearDropdowns() called with:', years);

  // Single year dropdown
  const singleYearSelect = document.getElementById('roster-single-year');
  console.log('[RosterWizard] 🔍 DIAGNOSTIC: singleYearSelect element:', singleYearSelect ? 'found' : 'NOT FOUND');

  if (singleYearSelect) {
    singleYearSelect.innerHTML = '';
    years.forEach((year, index) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      singleYearSelect.appendChild(option);

      if (index < 3) {
        console.log(`[RosterWizard] 🔍 DIAGNOSTIC: Created option ${index}: value="${option.value}", text="${option.textContent}"`);
      }
    });

    // Set default to most recent year
    if (years.length > 0) {
      const defaultYear = years[years.length - 1];
      singleYearSelect.value = defaultYear;
      rosterWizardState.year = defaultYear;
      console.log(`[RosterWizard] 🔍 DIAGNOSTIC: Set default year to ${defaultYear}, dropdown.value="${singleYearSelect.value}", state.year=${rosterWizardState.year}`);
    }
  }

  // All-time start year
  const startYearSelect = document.getElementById('roster-start-year');
  if (startYearSelect) {
    startYearSelect.innerHTML = '';
    years.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      startYearSelect.appendChild(option);
    });

    // Set default to 2000
    if (years.includes(2000)) {
      startYearSelect.value = 2000;
    } else if (years.length > 0) {
      startYearSelect.value = years[Math.floor(years.length / 2)];
    }
  }

  // All-time end year
  const endYearSelect = document.getElementById('roster-end-year');
  if (endYearSelect) {
    endYearSelect.innerHTML = '';
    years.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      endYearSelect.appendChild(option);
    });

    // Set default to 2009
    if (years.includes(2009)) {
      endYearSelect.value = 2009;
    } else if (years.length > 0) {
      endYearSelect.value = years[years.length - 1];
    }
  }

  console.log('[RosterWizard] Year dropdowns populated');
}

/**
 * Navigate to next step
 */
function rosterNextStep() {
  if (rosterWizardState.currentStep === 1) {
    // Validate mode selection
    const modeRadio = document.querySelector('input[name="roster-mode"]:checked');
    if (!modeRadio) {
      showRosterMessage('Please select a roster mode', 'error');
      return;
    }

    rosterWizardState.mode = modeRadio.value;

    // Show appropriate year selection panel
    updateYearSelectionPanel();

    // Move to step 2
    showRosterStep(2);

  } else if (rosterWizardState.currentStep === 2) {
    // Capture year selection
    if (rosterWizardState.mode === 'single-year') {
      const yearSelect = document.getElementById('roster-single-year');
      console.log('[RosterWizard] 🔍 DIAGNOSTIC: Capturing year selection...');
      console.log(`[RosterWizard] 🔍 DIAGNOSTIC: yearSelect.value = "${yearSelect.value}" (type: ${typeof yearSelect.value})`);
      console.log(`[RosterWizard] 🔍 DIAGNOSTIC: parseInt(yearSelect.value) = ${parseInt(yearSelect.value)}`);
      rosterWizardState.year = parseInt(yearSelect.value);
      console.log(`[RosterWizard] 🔍 DIAGNOSTIC: rosterWizardState.year = ${rosterWizardState.year}`);
    } else if (rosterWizardState.mode === 'all-time') {
      const startYearSelect = document.getElementById('roster-start-year');
      const endYearSelect = document.getElementById('roster-end-year');
      rosterWizardState.startYear = parseInt(startYearSelect.value);
      rosterWizardState.endYear = parseInt(endYearSelect.value);

      // Validate range
      if (rosterWizardState.startYear >= rosterWizardState.endYear) {
        showRosterMessage('End year must be greater than start year', 'error');
        return;
      }
    }

    // Show review
    updateReviewPanel();

    // Move to step 3
    showRosterStep(3);
  }

  rosterWizardState.currentStep++;
}

/**
 * Navigate to previous step
 */
function rosterPrevStep() {
  if (rosterWizardState.currentStep > 1) {
    rosterWizardState.currentStep--;
    showRosterStep(rosterWizardState.currentStep);
  }
}

/**
 * Show specific wizard step
 */
function showRosterStep(step) {
  console.log('[RosterWizard] Showing step', step);

  // Hide all steps
  for (let i = 1; i <= 4; i++) {
    const stepElement = document.getElementById(`roster-wizard-step-${i}`);
    if (stepElement) {
      stepElement.style.display = 'none';
    }
  }

  // Show target step
  const targetStep = document.getElementById(`roster-wizard-step-${step}`);
  if (targetStep) {
    targetStep.style.display = 'block';
  }

  // Update step indicators
  document.querySelectorAll('.roster-step-indicator').forEach((indicator, idx) => {
    if (idx + 1 === step) {
      indicator.classList.add('active');
    } else {
      indicator.classList.remove('active');
    }
  });
}

/**
 * Update year selection panel based on mode
 */
function updateYearSelectionPanel() {
  const singleYearPanel = document.getElementById('roster-single-year-panel');
  const allTimePanel = document.getElementById('roster-alltime-panel');

  if (rosterWizardState.mode === 'single-year') {
    if (singleYearPanel) singleYearPanel.style.display = 'block';
    if (allTimePanel) allTimePanel.style.display = 'none';
  } else if (rosterWizardState.mode === 'all-time') {
    if (singleYearPanel) singleYearPanel.style.display = 'none';
    if (allTimePanel) allTimePanel.style.display = 'block';
  }
}

/**
 * Update review panel with selected options
 */
function updateReviewPanel() {
  const reviewContent = document.getElementById('roster-review-content');
  if (!reviewContent) return;

  let html = '<div class="review-summary">';

  if (rosterWizardState.mode === 'single-year') {
    html += `
      <h3>Single Year Roster</h3>
      <p><strong>Year:</strong> ${rosterWizardState.year}</p>
      <p><strong>Description:</strong> Complete roster for ${rosterWizardState.year} season, including all players and free agents.</p>
    `;
  } else if (rosterWizardState.mode === 'all-time') {
    const years = rosterWizardState.endYear - rosterWizardState.startYear + 1;
    html += `
      <h3>All-Time Roster</h3>
      <p><strong>Year Range:</strong> ${rosterWizardState.startYear} - ${rosterWizardState.endYear} (${years} years)</p>
      <p><strong>Description:</strong> Best players from each position across the selected years, combined into one roster.</p>
    `;
  }

  html += '</div>';
  reviewContent.innerHTML = html;
}

/**
 * Generate roster
 */
async function generateRoster() {
  console.log('[RosterWizard] Generating roster...');

  // Show loading state
  const generateBtn = document.querySelector('.roster-wizard-generate');
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
  }

  try {
    // Build options
    const options = {
      mode: rosterWizardState.mode
    };

    if (rosterWizardState.mode === 'single-year') {
      options.year = rosterWizardState.year;
    } else if (rosterWizardState.mode === 'all-time') {
      options.startYear = rosterWizardState.startYear;
      options.endYear = rosterWizardState.endYear;
    }

    console.log('[RosterWizard] Generation options:', options);

    // Call backend
    const result = await window.electronAPI.rosterGenerator.generate(options);

    if (result.success) {
      console.log('[RosterWizard] Generation successful');
      console.log('[RosterWizard] Players:', result.data.players.length);

      rosterWizardState.generatedRoster = result.data;

      // Show results
      displayRosterResults(result.data);

      // Move to step 4
      rosterWizardState.currentStep = 4;
      showRosterStep(4);

    } else {
      console.error('[RosterWizard] Generation failed:', result.error);
      showRosterMessage('Failed to generate roster: ' + result.error, 'error');
    }

  } catch (error) {
    console.error('[RosterWizard] Error generating roster:', error);
    showRosterMessage('Error generating roster: ' + error.message, 'error');

  } finally {
    // Reset button
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Roster';
    }
  }
}

/**
 * Display roster results
 */
function displayRosterResults(rosterData) {
  console.log('[RosterWizard] Displaying results...');

  // Update metadata
  const metadataEl = document.getElementById('roster-result-metadata');
  if (metadataEl) {
    let metadataHtml = `
      <p><strong>Mode:</strong> ${rosterData.metadata.mode}</p>
      <p><strong>Players:</strong> ${rosterData.metadata.playerCount}</p>
    `;

    if (rosterData.metadata.year) {
      metadataHtml += `<p><strong>Year:</strong> ${rosterData.metadata.year}</p>`;
    } else if (rosterData.metadata.startYear && rosterData.metadata.endYear) {
      metadataHtml += `<p><strong>Years:</strong> ${rosterData.metadata.startYear} - ${rosterData.metadata.endYear}</p>`;
    }

    metadataEl.innerHTML = metadataHtml;
  }

  // Get stats
  getAndDisplayStats(rosterData.players);

  // Display preview table (first 10 players sorted by POVR)
  displayRosterPreview(rosterData.players);
}

/**
 * Get and display roster stats
 */
async function getAndDisplayStats(players) {
  try {
    const result = await window.electronAPI.rosterGenerator.getStats(players);

    if (result.success) {
      const stats = result.stats;

      // Display position breakdown
      const posBreakdownEl = document.getElementById('roster-position-breakdown');
      if (posBreakdownEl) {
        let html = '<h4>Position Breakdown</h4><ul>';
        Object.entries(stats.positionBreakdown).forEach(([pos, count]) => {
          html += `<li>${pos}: ${count}</li>`;
        });
        html += '</ul>';
        posBreakdownEl.innerHTML = html;
      }

      // Display rating stats
      const ratingStatsEl = document.getElementById('roster-rating-stats');
      if (ratingStatsEl) {
        ratingStatsEl.innerHTML = `
          <h4>Rating Statistics</h4>
          <p><strong>Average:</strong> ${stats.avgRating}</p>
          <p><strong>Highest:</strong> ${stats.maxRating}</p>
          <p><strong>Lowest:</strong> ${stats.minRating}</p>
        `;
      }
    }
  } catch (error) {
    console.error('[RosterWizard] Error getting stats:', error);
  }
}

/**
 * Display roster preview table
 */
function displayRosterPreview(players) {
  console.log('[RosterWizard] Displaying preview table...');

  const previewEl = document.getElementById('roster-preview-table');
  if (!previewEl) return;

  // Sort by POVR descending and take top 10
  const topPlayers = [...players]
    .sort((a, b) => b.POVR - a.POVR)
    .slice(0, 10);

  let html = `
    <h4>Top 10 Players (by Overall Rating)</h4>
    <table class="preview-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Pos</th>
          <th>OVR</th>
          <th>Team</th>
          <th>Age</th>
        </tr>
      </thead>
      <tbody>
  `;

  topPlayers.forEach(player => {
    html += `
      <tr>
        <td>${player.PFNA || ''} ${player.PLNA || ''}</td>
        <td>${player._position || 'Unknown'}</td>
        <td>${player.POVR || 0}</td>
        <td>${player._sourceTeam || 'Unknown'}</td>
        <td>${player.PAGE || 0}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  previewEl.innerHTML = html;
}

/**
 * Save roster to file
 */
async function saveRosterFile() {
  console.log('[RosterWizard] Saving roster to file...');

  if (!rosterWizardState.generatedRoster) {
    showRosterMessage('No roster to save', 'error');
    return;
  }

  try {
    // Open save dialog
    const savePath = await window.electronAPI.file.saveDialog();
    if (!savePath) {
      console.log('[RosterWizard] Save cancelled');
      return;
    }

    console.log('[RosterWizard] Save path:', savePath);

    // Save roster using the roster-generator save method (copy template, edit, save)
    const result = await window.electronAPI.rosterGenerator.save(
      rosterWizardState.generatedRoster.players,
      'ROSTER-Official', // Template path - will be resolved to full path in backend
      savePath
    );

    if (result.success) {
      showRosterMessage('Roster saved successfully!', 'success');
    } else {
      showRosterMessage('Failed to save roster: ' + result.error, 'error');
    }

  } catch (error) {
    console.error('[RosterWizard] Error saving roster:', error);
    showRosterMessage('Error saving roster: ' + error.message, 'error');
  }
}

/**
 * Load roster into editor
 * Pre-converts archetype IDs to names to avoid [object Promise] in grid
 */
async function loadRosterIntoEditor() {
  console.log('[RosterWizard] Loading roster into editor...');

  if (!rosterWizardState.generatedRoster) {
    showRosterMessage('No roster to load', 'error');
    return;
  }

  // Get the app instance (assumes app.js exports window.app)
  const app = window.app;
  if (!app) {
    showRosterMessage('Error: App not initialized', 'error');
    return;
  }

  console.log('[RosterWizard] Loading', rosterWizardState.generatedRoster.players.length, 'players into roster editor');
  console.log('[RosterWizard] Sample player fields:', Object.keys(rosterWizardState.generatedRoster.players[0] || {}));

  // Pre-process calculated fields (Archetype) to avoid [object Promise] in grid
  // This matches what app.js does when loading roster files (lines 587-600)
  console.log('[RosterWizard] Pre-converting archetypes...');
  const POSITION_MAPPINGS = {
    0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE',
    5: 'LT', 6: 'LG', 7: 'C', 8: 'RG', 9: 'RT',
    10: 'LEDG', 11: 'REDG', 12: 'DT',
    13: 'WILL', 14: 'Mike', 15: 'SAM',
    16: 'CB', 17: 'FS', 18: 'SS',
    19: 'K', 20: 'P'
  };

  const processedPlayers = await Promise.all(rosterWizardState.generatedRoster.players.map(async player => {
    // Convert Archetype (async IPC call) - PLTY field contains archetype ID
    if (player.PLTY !== undefined && player.PLTY !== null && player.PPOS !== undefined) {
      try {
        const position = POSITION_MAPPINGS[player.PPOS] || player.PPOS;
        player.ARCHETYPE = await window.electronAPI.rating.getArchetypeName(player.PLTY, position);
      } catch (e) {
        console.warn('[RosterWizard] Failed to convert archetype for player:', player.PFNA, player.PLNA, e);
        player.ARCHETYPE = `Archetype #${player.PLTY}`;
      }
    } else {
      player.ARCHETYPE = '';
    }
    return player;
  }));

  // Switch to roster editor tab
  app.switchTool('roster');

  // Store the processed players as the current roster data
  app.players = processedPlayers;

  // DEBUG: Log first 5 players to see TGID values
  console.log('[RosterWizard] DEBUG: First 5 players TGID values:');
  processedPlayers.slice(0, 5).forEach((p, i) => {
    console.log(`  Player ${i + 1}: ${p.PFNA} ${p.PLNA} - TGID=${p.TGID} (type: ${typeof p.TGID})`);
  });

  // Store metadata for compatibility with file loading
  app.originalData = {
    version: 2026, // M26
    playerCount: app.players.length,
    players: app.players,
    teams: [],
    filePath: null,
    _version: 'M26',
    _originalBuffer: rosterWizardState.generatedRoster._originalBuffer || null
  };

  // Set currentFile to null to trigger "generated roster" save path
  // The save function will use originalData._originalBuffer as the template
  app.currentFile = null;

  // Reset pagination
  app.currentPage = 1;

  // Render the roster in the editor grid
  app.renderRoster();

  // Update stats
  app.updateStats();

  // Update UI
  const filenameDisplay = document.getElementById('currentFilename');
  if (filenameDisplay) {
    filenameDisplay.textContent = `Generated Roster (${rosterWizardState.generatedRoster.metadata.year || 'All-Time'}) - Unsaved`;
  }

  // Show all roster editor buttons
  const fileNameEl = document.getElementById('fileName');
  const currentFileEl = document.getElementById('currentFile');
  const exportBtn = document.getElementById('exportCsvBtn');
  const importBtn = document.getElementById('importCsvBtn');
  const fillDbBtn = document.getElementById('fillFromDbRosterBtn');
  const saveButton = document.getElementById('saveRosterBtn');

  if (fileNameEl) fileNameEl.textContent = `Generated Roster (${rosterWizardState.generatedRoster.metadata.year || 'All-Time'})`;
  if (currentFileEl) currentFileEl.style.display = 'flex';
  if (exportBtn) exportBtn.style.display = 'inline-flex';
  if (importBtn) importBtn.style.display = 'inline-flex';
  if (fillDbBtn) fillDbBtn.style.display = 'inline-flex';
  if (saveButton) saveButton.style.display = 'inline-flex';

  console.log('[RosterWizard] Buttons shown:', { exportBtn: !!exportBtn, importBtn: !!importBtn, fillDbBtn: !!fillDbBtn, saveButton: !!saveButton });

  // Mark as having unsaved changes
  app.hasUnsavedChanges = true;

  showRosterMessage(`Loaded ${app.players.length} players into editor`, 'success');
}

/**
 * Restart wizard
 */
function restartRosterWizard() {
  console.log('[RosterWizard] Restarting wizard...');

  // Reset state
  rosterWizardState.currentStep = 1;
  rosterWizardState.mode = 'single-year';
  rosterWizardState.year = null;
  rosterWizardState.startYear = null;
  rosterWizardState.endYear = null;
  rosterWizardState.generatedRoster = null;

  // Reset UI
  document.querySelectorAll('.roster-mode-card').forEach(c => c.classList.remove('selected'));

  // Show step 1
  showRosterStep(1);
}

/**
 * Show message to user
 */
function showRosterMessage(message, type = 'info') {
  console.log(`[RosterWizard] ${type.toUpperCase()}:`, message);

  const messageEl = document.getElementById('roster-wizard-message');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.className = `wizard-message ${type}`;
    messageEl.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 5000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if roster wizard section exists
  const rosterWizardSection = document.getElementById('roster-wizard-section');
  if (rosterWizardSection) {
    initRosterWizard();
  }
});

// Export for use in main app.js
window.rosterWizard = {
  init: initRosterWizard,
  restart: restartRosterWizard,
  getState: () => rosterWizardState
};
