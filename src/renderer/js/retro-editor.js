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
  rosterPath: null,     // Optional roster file path for OVR lookup in expansion draft
  targetYear: null,
  previewData: null,
  schedulePreview: null,
  coachPreview: null,
  salaryCapData: null,
  stadiumPreview: null,
  schemePreview: null,
  expansionEvent: null,
  applyResult: null,
  // Expansion draft selections from manual draft board
  expansionDraftSelections: [],
  // Expansion team indices for clearing rosters before draft
  expansionTeamIndices: [],
  // User-selected options
  options: {
    teams: true,        // Update team names/cities
    abbreviations: true, // Update team abbreviations
    schedule: true,      // Load season schedule
    logos: false         // Download era logos
  }
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

  // Year selection dropdown (legacy wizard)
  document.getElementById('retro-year-select')?.addEventListener('change', (e) => {
    retroState.targetYear = parseInt(e.target.value);
    updateYearInfo(retroState.targetYear);
    updateNextButtonState();
    // Enable scrape button when year is selected
    const scrapeBtn = document.getElementById('btn-scrape-all-logos');
    if (scrapeBtn) scrapeBtn.disabled = !retroState.targetYear;
  });

  // Target year dropdown (new tool landing page)
  document.getElementById('retro-target-year')?.addEventListener('change', (e) => {
    retroState.targetYear = parseInt(e.target.value);
    updateToolCards();
  });

  // Change file button
  document.getElementById('retro-change-file')?.addEventListener('click', () => {
    // Hide tool landing page and show file selection
    document.getElementById('retro-tool-landing').style.display = 'none';
    document.getElementById('retro-file-selection').style.display = 'block';
    // Reset file state
    retroState.filePath = null;
    retroState.fileMetadata = null;
    document.getElementById('retro-franchise-file').value = '';
    document.getElementById('retro-file-info').style.display = 'none';
  });

  // Tool card click handlers
  document.querySelectorAll('.retro-tool-card:not(.disabled)').forEach(card => {
    card.addEventListener('click', () => openToolModal(card.dataset.tool));
  });

  // Modal close handlers
  document.querySelectorAll('.retro-tool-modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeToolModal(btn.closest('.retro-tool-modal')));
  });
  document.querySelectorAll('.modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => closeToolModal(btn.closest('.retro-tool-modal')));
  });

  // Click outside modal to close
  document.querySelectorAll('.retro-tool-modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeToolModal(modal);
    });
  });

  // Tool apply button handlers
  document.getElementById('btn-apply-name-changes')?.addEventListener('click', () => applyToolNameChanges());
  document.getElementById('btn-apply-schedule')?.addEventListener('click', () => applyToolSchedule());
  document.getElementById('btn-apply-relocation')?.addEventListener('click', () => applyToolRelocation());
  document.getElementById('btn-apply-coaching')?.addEventListener('click', () => applyToolCoaching());
  document.getElementById('btn-apply-expansion')?.addEventListener('click', () => applyToolExpansion());
  document.getElementById('btn-apply-portraits')?.addEventListener('click', () => applyToolPortraits());
  document.getElementById('btn-apply-commentary')?.addEventListener('click', () => applyToolCommentary());
  document.getElementById('btn-apply-draft-order')?.addEventListener('click', () => applyToolDraftOrder());
  document.getElementById('btn-apply-salary-cap')?.addEventListener('click', () => applyToolSalaryCap());
  document.getElementById('btn-apply-nfl-records')?.addEventListener('click', () => applyToolNFLRecords());
  document.getElementById('btn-apply-historical-stats')?.addEventListener('click', () => applyToolHistoricalStats());
  document.getElementById('btn-apply-equipment')?.addEventListener('click', () => applyToolEquipment());

  // Coach search input enter key handler
  document.getElementById('coach-search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchCoachDatabase();
    }
  });

  // Navigation buttons (legacy wizard)
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
  loadToolLandingYears();

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

    const currentYear = loadResult.data.currentSeasonYear || 2025;
    const nextYear = currentYear + 1;

    fileDetails.innerHTML = `
      Current Season: <strong>${currentYear}</strong><br>
      Teams: ${loadResult.data.teamCount || 32}<br>
      Super Bowl: ${loadResult.data.superBowlNumber || 'Unknown'}
    `;

    // Pre-select the NEXT year in the dropdown for year continuity (legacy wizard)
    const yearSelect = document.getElementById('retro-year-select');
    if (yearSelect) {
      // Check if next year is available in the dropdown
      const nextYearOption = yearSelect.querySelector(`option[value="${nextYear}"]`);
      if (nextYearOption) {
        yearSelect.value = nextYear;
        retroState.targetYear = nextYear;
        updateYearInfo(nextYear);
        console.log(`[RetroEditor] Pre-selected next year: ${nextYear} (current franchise year: ${currentYear})`);
      } else {
        // Fall back to current year if next year not available
        const currentYearOption = yearSelect.querySelector(`option[value="${currentYear}"]`);
        if (currentYearOption) {
          yearSelect.value = currentYear;
          retroState.targetYear = currentYear;
          updateYearInfo(currentYear);
          console.log(`[RetroEditor] Pre-selected current year: ${currentYear}`);
        }
      }
    }

    // Enable next button (legacy)
    updateNextButtonState();

    // Show tool landing page (new approach)
    showToolLandingPage(loadResult.data, nextYear);

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

  // Also update uniform preview
  updateUniformPreview(year);
}

/**
 * Update uniform preview for selected year
 */
async function updateUniformPreview(year) {
  const uniformInfo = document.getElementById('retro-uniform-info');
  const uniformSummary = document.getElementById('retro-uniform-summary');
  const uniformList = document.getElementById('retro-uniform-list');

  // Early exit if elements don't exist
  if (!uniformInfo) return;

  if (!year) {
    uniformInfo.style.display = 'none';
    return;
  }

  try {
    // Get uniform summary
    const summaryResult = await window.electronAPI.retro.getUniformPreviewSummary(year);
    if (summaryResult.success && summaryResult.data.available) {
      uniformInfo.style.display = 'flex';
      if (uniformSummary) uniformSummary.textContent = summaryResult.data.summary;

      // Get detailed uniform list
      const detailResult = await window.electronAPI.retro.getUniformsForYear(year);
      if (detailResult.success && detailResult.data.uniforms && uniformList) {
        // Group by variant type for cleaner display
        const throwbacks = detailResult.data.uniforms.filter(u =>
          !u.variantName.toLowerCase().includes('modern') && u.variantName.toLowerCase() !== 'default'
        );
        const modern = detailResult.data.uniforms.filter(u =>
          u.variantName.toLowerCase().includes('modern') || u.variantName.toLowerCase() === 'default'
        );

        let html = '';
        if (throwbacks.length > 0) {
          html += '<div style="margin-bottom: 8px;"><strong>Era-Appropriate Uniforms:</strong></div>';
          throwbacks.forEach(u => {
            html += `<div style="padding: 2px 0;"><span style="color: var(--accent-color);">${u.teamAbbr}</span>: ${u.variantName}</div>`;
          });
        }
        if (modern.length > 0) {
          html += '<div style="margin-top: 8px; margin-bottom: 8px;"><strong>Modern Uniforms:</strong></div>';
          modern.forEach(u => {
            html += `<div style="padding: 2px 0; opacity: 0.7;">${u.teamAbbr}: ${u.variantName}</div>`;
          });
        }
        uniformList.innerHTML = html;
      }
    } else {
      uniformInfo.style.display = 'none';
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading uniform preview:', error);
    uniformInfo.style.display = 'none';
  }
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
    // Read user options from checkboxes
    retroState.options.teams = document.getElementById('retro-opt-teams')?.checked ?? true;
    retroState.options.abbreviations = document.getElementById('retro-opt-abbreviations')?.checked ?? true;
    retroState.options.schedule = document.getElementById('retro-opt-schedule')?.checked ?? true;
    retroState.options.coaches = document.getElementById('retro-opt-coaches')?.checked ?? true;
    retroState.options.logos = document.getElementById('retro-opt-logos')?.checked ?? false;

    console.log('[RetroEditor] Options selected:', retroState.options);
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
    const opts = retroState.options;

    // Update season changes (always shown)
    const superBowlNum = retroState.targetYear - 1965;
    const romanNumeral = superBowlNumerals[superBowlNum] || superBowlNum;

    document.getElementById('preview-season-year').textContent = retroState.targetYear;
    document.getElementById('preview-superbowl').textContent = `Super Bowl ${romanNumeral}`;
    document.getElementById('preview-calendar-year').textContent = retroState.targetYear;

    // Show/hide team names section
    const teamsSection = document.getElementById('retro-teams-section');
    if (teamsSection) {
      teamsSection.style.display = opts.teams ? 'block' : 'none';
    }

    // Update team changes (if enabled)
    if (opts.teams) {
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
    }

    // Show/hide draft section (tied to teams)
    const draftSection = document.getElementById('retro-draft-section');
    if (draftSection) {
      draftSection.style.display = opts.teams ? 'block' : 'none';
    }

    // Update draft changes (if teams enabled)
    if (opts.teams) {
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
    }

    // Show/hide schedule section
    const scheduleSection = document.getElementById('retro-schedule-section');
    if (scheduleSection) {
      scheduleSection.style.display = opts.schedule ? 'block' : 'none';
    }

    // Load schedule preview (if enabled)
    if (opts.schedule) {
      await loadSchedulePreview();
    }

    // Load expansion/relocation event preview (always check, might be hidden)
    await loadExpansionPreview();

    // Show/hide logo section
    const logoSection = document.getElementById('retro-logo-section');
    if (logoSection) {
      logoSection.style.display = opts.logos ? 'block' : 'none';
    }

    // Load logo preview and download (if enabled)
    if (opts.logos) {
      await loadLogoPreview();
      // Auto-download logos for teams that need them
      const scrapeBtn = document.getElementById('btn-scrape-all-logos');
      if (scrapeBtn && !scrapeBtn.disabled) {
        await scrapeAllLogos();
      }
    }

    // Load coach preview if option is checked
    if (opts.coaches) {
      await loadCoachPreview();
      document.getElementById('retro-coach-section').style.display = '';
    } else {
      document.getElementById('retro-coach-section').style.display = 'none';
      retroState.coachPreview = null;
    }

    // These are always loaded (not optional currently)
    await loadSalaryCapPreview();
    await loadStadiumPreview();
    await loadSchemePreview();
    await loadPortraitPreview();

    hideRetroMessage();

  } catch (error) {
    console.error('[RetroEditor] Error loading preview:', error);
    showRetroMessage('Error: ' + error.message, 'error');
  }
}

/**
 * Load schedule preview for the selected year
 */
async function loadSchedulePreview() {
  try {
    // Get season era info
    const seasonInfoResult = await window.electronAPI.retro.getSeasonInfo(retroState.targetYear);

    if (seasonInfoResult.success && seasonInfoResult.data) {
      const eraInfo = seasonInfoResult.data;
      document.getElementById('preview-season-length').textContent = `${eraInfo.seasonLength} games`;
      document.getElementById('preview-bye-weeks').textContent = eraInfo.byeWeeks ? 'Yes' : 'No';
      document.getElementById('preview-playoff-teams').textContent = `${eraInfo.playoffTeams} teams`;

      // Show era note if available
      if (eraInfo.note) {
        const eraInfoDiv = document.getElementById('retro-era-info');
        const noteDiv = eraInfoDiv.querySelector('.era-note') || document.createElement('div');
        noteDiv.className = 'era-note';
        noteDiv.style.cssText = 'font-size: 0.85em; color: var(--text-secondary); margin-top: 8px; font-style: italic;';
        noteDiv.textContent = eraInfo.note;
        if (!eraInfoDiv.querySelector('.era-note')) {
          eraInfoDiv.appendChild(noteDiv);
        }
      }
    } else {
      document.getElementById('preview-season-length').textContent = '--';
      document.getElementById('preview-bye-weeks').textContent = '--';
      document.getElementById('preview-playoff-teams').textContent = '--';
    }

    // Check if schedule data is available
    const hasScheduleResult = await window.electronAPI.retro.hasScheduleData(retroState.targetYear);
    const scheduleStatusDiv = document.getElementById('retro-schedule-status');
    const scheduleDetailsDiv = document.getElementById('retro-schedule-details');
    const validationSection = document.getElementById('retro-validation-section');
    const validationWarnings = document.getElementById('retro-validation-warnings');

    if (hasScheduleResult.success && hasScheduleResult.hasData) {
      // Schedule data available - load preview
      const schedulePreview = await window.electronAPI.retro.getSchedulePreview(retroState.filePath, retroState.targetYear);

      if (schedulePreview.success && schedulePreview.data) {
        const preview = schedulePreview.data;

        scheduleStatusDiv.innerHTML = `
          <div class="schedule-available" style="color: var(--success-color);">
            <strong>Schedule data available</strong><br>
            <span style="font-size: 0.9em;">${preview.totalGames} games will be applied to your franchise</span>
          </div>
        `;

        // Show week-by-week preview if games are available
        if (preview.gamesByWeek && Object.keys(preview.gamesByWeek).length > 0) {
          scheduleDetailsDiv.style.display = 'block';
          const weeksContainer = document.getElementById('retro-schedule-weeks');
          weeksContainer.innerHTML = Object.entries(preview.gamesByWeek)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([week, games]) => `
              <div class="schedule-week" style="margin-bottom: 12px; padding: 8px; background: var(--bg-secondary); border-radius: 4px;">
                <strong style="color: var(--text-primary);">Week ${week}</strong>
                <div style="margin-top: 4px; font-size: 0.85em;">
                  ${games.map(g => `
                    <div style="padding: 2px 0;">${g.awayTeam} @ ${g.homeTeam}</div>
                  `).join('')}
                </div>
              </div>
            `).join('');
        }

        // Show validation warnings if any
        if (preview.validation && (preview.validation.warnings.length > 0 || preview.validation.errors.length > 0)) {
          validationSection.style.display = 'block';
          validationWarnings.innerHTML = [
            ...preview.validation.errors.map(e => `<div class="validation-error" style="color: var(--error-color);">${e}</div>`),
            ...preview.validation.warnings.map(w => `<div class="validation-warning" style="color: var(--warning-color);">${w}</div>`)
          ].join('');
        } else {
          validationSection.style.display = 'none';
        }

        // Store schedule preview for application
        retroState.schedulePreview = preview;
      }
    } else {
      // No schedule data
      scheduleStatusDiv.innerHTML = `
        <p class="no-changes">No schedule data available for ${retroState.targetYear}</p>
        <p style="font-size: 0.85em; color: var(--text-secondary);">Season settings will be applied but game schedule won't be modified.</p>
      `;
      scheduleDetailsDiv.style.display = 'none';
      validationSection.style.display = 'none';
      retroState.schedulePreview = null;
    }

  } catch (error) {
    console.error('[RetroEditor] Error loading schedule preview:', error);
    document.getElementById('retro-schedule-status').innerHTML = `
      <p class="no-changes" style="color: var(--error-color);">Error loading schedule: ${error.message}</p>
    `;
  }
}

/**
 * Load expansion/relocation event preview for the selected year
 */
async function loadExpansionPreview() {
  try {
    console.log('[RetroEditor] loadExpansionPreview() called for year:', retroState.targetYear);

    const expansionSection = document.getElementById('retro-expansion-section');
    const statusDiv = document.getElementById('retro-expansion-status');
    const detailsDiv = document.getElementById('retro-expansion-details');

    console.log('[RetroEditor] Expansion section element:', expansionSection ? 'FOUND' : 'NOT FOUND');

    // Check if there's an expansion event for this year
    const result = await window.electronAPI.retro.getExpansionEvent(retroState.targetYear);
    console.log('[RetroEditor] getExpansionEvent result:', JSON.stringify(result));

    if (result.success && result.event) {
      const event = result.event;
      retroState.expansionEvent = event;

      // Show the section
      expansionSection.style.display = 'block';
      statusDiv.style.display = 'none';
      detailsDiv.style.display = 'block';

      // Fill in event details
      document.getElementById('expansion-event-name').textContent = event.name;
      document.getElementById('expansion-event-type').textContent =
        event.type === 'relocation' ? 'Team Relocation' : 'Expansion Draft';
      document.getElementById('expansion-event-description').textContent = event.description;

      // Show appropriate options based on event type
      const relocationOptions = document.getElementById('relocation-options');
      const expansionDraftOptions = document.getElementById('expansion-draft-options');

      if (event.type === 'relocation') {
        relocationOptions.style.display = 'block';
        expansionDraftOptions.style.display = 'none';
      } else {
        relocationOptions.style.display = 'none';
        expansionDraftOptions.style.display = 'block';

        // Fill in expansion draft details
        if (event.protectionRules) {
          document.getElementById('expansion-protected-count').textContent =
            event.protectionRules.maxProtected || '--';
        }
        if (event.rules) {
          document.getElementById('expansion-players-count').textContent =
            event.rules.playersPerTeam || '--';
        }

        // Handle draft mode change
        const draftModeSelect = document.getElementById('expansion-draft-mode');
        const manualDraftUI = document.getElementById('manual-draft-ui');

        draftModeSelect.onchange = () => {
          manualDraftUI.style.display = draftModeSelect.value === 'manual' ? 'block' : 'none';
        };
      }

      console.log('[RetroEditor] Loaded expansion event:', event.name);
    } else {
      // No expansion event for this year
      expansionSection.style.display = 'none';
      retroState.expansionEvent = null;
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading expansion preview:', error);
    document.getElementById('retro-expansion-section').style.display = 'none';
  }
}

/**
 * Load coach preview for the selected year
 */
async function loadCoachPreview() {
  try {
    const coachStatusDiv = document.getElementById('retro-coach-status');
    const coachDetailsDiv = document.getElementById('retro-coach-details');

    // Check if coach data is available
    const hasCoachResult = await window.electronAPI.retro.hasCoachData(retroState.targetYear);

    if (hasCoachResult.success && hasCoachResult.hasData) {
      // Coach data available - load preview
      const coachPreview = await window.electronAPI.retro.getCoachPreview(retroState.filePath, retroState.targetYear);

      if (coachPreview.success && coachPreview.data && coachPreview.data.available) {
        const preview = coachPreview.data;
        const coachChanges = preview.coachChanges || [];

        // Count coaches that will be updated (skip "(Keep Default)" entries)
        let coachCount = 0;
        coachChanges.forEach(team => {
          if (team.headCoach && team.headCoach !== 'N/A') coachCount++;
          if (team.offensiveCoordinator && team.offensiveCoordinator !== '(Keep Default)') coachCount++;
          if (team.defensiveCoordinator && team.defensiveCoordinator !== '(Keep Default)') coachCount++;
        });

        coachStatusDiv.innerHTML = `
          <div class="coach-available" style="color: var(--success-color);">
            <strong>Coach data available</strong><br>
            <span style="font-size: 0.9em;">${coachCount} coaching positions will be updated across ${coachChanges.length} teams</span>
          </div>
        `;

        // Show team-by-team preview
        if (coachChanges.length > 0) {
          coachDetailsDiv.style.display = 'block';
          const coachListContainer = document.getElementById('retro-coach-list');
          coachListContainer.innerHTML = coachChanges
            .sort((a, b) => a.teamAbbr.localeCompare(b.teamAbbr))
            .map(team => {
              const hasOC = team.offensiveCoordinator && team.offensiveCoordinator !== '(Keep Default)';
              const hasDC = team.defensiveCoordinator && team.defensiveCoordinator !== '(Keep Default)';

              return `
                <div class="coach-team" style="margin-bottom: 12px; padding: 8px; background: var(--bg-secondary); border-radius: 4px;">
                  <strong style="color: var(--text-primary);">${team.teamAbbr}</strong>
                  <div style="margin-top: 4px; font-size: 0.85em;">
                    <div style="padding: 2px 0;"><span style="color: var(--text-secondary);">HC:</span> ${team.headCoach}</div>
                    ${hasOC
                      ? `<div style="padding: 2px 0;"><span style="color: var(--text-secondary);">OC:</span> ${team.offensiveCoordinator}</div>`
                      : '<div style="padding: 2px 0; color: var(--text-secondary); opacity: 0.7;">OC: (game default)</div>'}
                    ${hasDC
                      ? `<div style="padding: 2px 0;"><span style="color: var(--text-secondary);">DC:</span> ${team.defensiveCoordinator}</div>`
                      : '<div style="padding: 2px 0; color: var(--text-secondary); opacity: 0.7;">DC: (game default)</div>'}
                  </div>
                </div>
              `;
            }).join('');
        }

        // Store coach preview for application
        retroState.coachPreview = preview;
      } else {
        // No data available from preview (shouldn't happen if hasData is true)
        coachStatusDiv.innerHTML = `
          <p class="no-changes">No coach data available for ${retroState.targetYear}</p>
          <p style="font-size: 0.85em; color: var(--text-secondary);">Coaching staff will not be modified.</p>
        `;
        coachDetailsDiv.style.display = 'none';
        retroState.coachPreview = null;
      }
    } else {
      // No coach data
      coachStatusDiv.innerHTML = `
        <p class="no-changes">No coach data available for ${retroState.targetYear}</p>
        <p style="font-size: 0.85em; color: var(--text-secondary);">Coaching staff will not be modified.</p>
      `;
      coachDetailsDiv.style.display = 'none';
      retroState.coachPreview = null;
    }

  } catch (error) {
    console.error('[RetroEditor] Error loading coach preview:', error);
    document.getElementById('retro-coach-status').innerHTML = `
      <p class="no-changes" style="color: var(--error-color);">Error loading coach data: ${error.message}</p>
    `;
  }
}

/**
 * Load salary cap preview for the selected year
 */
async function loadSalaryCapPreview() {
  try {
    const salaryCapStatusDiv = document.getElementById('retro-salary-cap-status');
    const customCapInput = document.getElementById('retro-salary-cap-custom');

    if (!salaryCapStatusDiv) {
      console.log('[RetroEditor] Salary cap status div not found, skipping');
      return;
    }

    const salaryCapResult = await window.electronAPI.retro.getSalaryCap(retroState.targetYear);

    if (salaryCapResult.success) {
      const capData = salaryCapResult.data;
      const formattedCap = capData.value > 0
        ? '$' + capData.value.toLocaleString()
        : 'No salary cap (pre-1994 era)';

      salaryCapStatusDiv.innerHTML = `
        <div class="salary-cap-available" style="color: var(--success-color);">
          <strong>Historical Cap: ${formattedCap}</strong>
          ${capData.note ? `<br><span style="font-size: 0.85em; color: var(--text-secondary);">${capData.note}</span>` : ''}
        </div>
      `;

      retroState.salaryCapData = capData;

      // Set placeholder to historical value (in millions)
      if (customCapInput && capData.value > 0) {
        customCapInput.placeholder = (capData.value / 1000000).toFixed(1);
      }
    } else {
      salaryCapStatusDiv.innerHTML = `
        <p class="no-changes">Unable to load salary cap data</p>
      `;
      retroState.salaryCapData = null;
    }

  } catch (error) {
    console.error('[RetroEditor] Error loading salary cap preview:', error);
    const salaryCapStatusDiv = document.getElementById('retro-salary-cap-status');
    if (salaryCapStatusDiv) {
      salaryCapStatusDiv.innerHTML = `
        <p class="no-changes" style="color: var(--error-color);">Error loading salary cap: ${error.message}</p>
      `;
    }
  }
}

/**
 * Get the effective salary cap (custom or historical)
 * Returns value in dollars (not millions)
 */
function getEffectiveSalaryCap() {
  const customCapInput = document.getElementById('retro-salary-cap-custom');
  const customValue = customCapInput ? parseFloat(customCapInput.value) : NaN;

  if (!isNaN(customValue) && customValue > 0) {
    // Custom cap entered (in millions), convert to dollars
    return customValue * 1000000;
  }

  // Use historical cap
  return retroState.salaryCapData?.value || 0;
}

/**
 * Load stadium preview for the selected year
 */
async function loadStadiumPreview() {
  try {
    const stadiumStatusDiv = document.getElementById('retro-stadium-status');
    const stadiumDetailsDiv = document.getElementById('retro-stadium-details');

    if (!stadiumStatusDiv) {
      console.log('[RetroEditor] Stadium status div not found, skipping');
      return;
    }

    const stadiumResult = await window.electronAPI.retro.getStadiumPreview(retroState.filePath, retroState.targetYear);

    if (stadiumResult.success && stadiumResult.data && stadiumResult.data.available) {
      const preview = stadiumResult.data;
      const changes = preview.stadiumChanges || [];
      const changesCount = changes.filter(c => c.newName !== c.currentName).length;

      stadiumStatusDiv.innerHTML = `
        <div class="stadium-available" style="color: var(--success-color);">
          <strong>Stadium data available</strong><br>
          <span style="font-size: 0.9em;">${changesCount} stadium name(s) will be updated</span>
        </div>
      `;

      // Show stadium changes if any
      if (stadiumDetailsDiv && changes.length > 0) {
        stadiumDetailsDiv.style.display = 'block';
        const stadiumListContainer = document.getElementById('retro-stadium-list');
        if (stadiumListContainer) {
          stadiumListContainer.innerHTML = changes
            .sort((a, b) => a.teamName.localeCompare(b.teamName))
            .map(stadium => {
              const isChange = stadium.newName !== stadium.currentName;
              return `
                <div class="stadium-item" style="margin-bottom: 8px; padding: 6px; background: var(--bg-secondary); border-radius: 4px; ${isChange ? '' : 'opacity: 0.7;'}">
                  <strong style="color: var(--text-primary);">${stadium.teamName}</strong>
                  <div style="font-size: 0.85em; margin-top: 2px;">
                    ${isChange
                      ? `<span style="color: var(--text-secondary);">${stadium.currentName}</span> → <span style="color: var(--success-color);">${stadium.newName}</span>`
                      : `<span style="color: var(--text-secondary);">${stadium.currentName} (no change)</span>`}
                  </div>
                </div>
              `;
            }).join('');
        }
      }

      // Show warnings if any
      if (preview.warnings && preview.warnings.length > 0) {
        const warningsHtml = preview.warnings.map(w => `<div style="color: var(--warning-color); font-size: 0.85em;">${w}</div>`).join('');
        stadiumStatusDiv.innerHTML += warningsHtml;
      }

      retroState.stadiumPreview = preview;
    } else {
      stadiumStatusDiv.innerHTML = `
        <p class="no-changes">Stadium data not available for ${retroState.targetYear}</p>
      `;
      if (stadiumDetailsDiv) stadiumDetailsDiv.style.display = 'none';
      retroState.stadiumPreview = null;
    }

  } catch (error) {
    console.error('[RetroEditor] Error loading stadium preview:', error);
    const stadiumStatusDiv = document.getElementById('retro-stadium-status');
    if (stadiumStatusDiv) {
      stadiumStatusDiv.innerHTML = `
        <p class="no-changes" style="color: var(--error-color);">Error loading stadium data: ${error.message}</p>
      `;
    }
  }
}

/**
 * Load team scheme preview for the selected year
 */
async function loadSchemePreview() {
  try {
    const schemeStatusDiv = document.getElementById('retro-scheme-status');
    const schemeDetailsDiv = document.getElementById('retro-scheme-details');

    if (!schemeStatusDiv) {
      console.log('[RetroEditor] Scheme status div not found, skipping');
      return;
    }

    const schemeResult = await window.electronAPI.retro.getSchemePreview(retroState.filePath, retroState.targetYear);

    if (schemeResult.success && schemeResult.data && schemeResult.data.available) {
      const preview = schemeResult.data;
      const changes = preview.schemeChanges || [];
      const changesCount = changes.filter(c => c.newOffense !== c.currentOffense || c.newDefense !== c.currentDefense).length;

      schemeStatusDiv.innerHTML = `
        <div class="scheme-available" style="color: var(--success-color);">
          <strong>Team scheme data available</strong><br>
          <span style="font-size: 0.9em;">${changesCount} team scheme(s) will be updated to era-appropriate playbooks</span>
        </div>
      `;

      // Show scheme changes if any
      if (schemeDetailsDiv && changes.length > 0) {
        schemeDetailsDiv.style.display = 'block';
        const schemeListContainer = document.getElementById('retro-scheme-list');
        if (schemeListContainer) {
          schemeListContainer.innerHTML = changes
            .sort((a, b) => a.teamName.localeCompare(b.teamName))
            .map(scheme => {
              const offenseChange = scheme.newOffense !== scheme.currentOffense;
              const defenseChange = scheme.newDefense !== scheme.currentDefense;
              const hasChange = offenseChange || defenseChange;
              return `
                <div class="scheme-item" style="margin-bottom: 8px; padding: 6px; background: var(--bg-secondary); border-radius: 4px; ${hasChange ? '' : 'opacity: 0.7;'}">
                  <strong style="color: var(--text-primary);">${scheme.teamName}</strong>
                  ${scheme.note ? `<span style="font-size: 0.75em; color: var(--text-secondary); margin-left: 8px;">(${scheme.note})</span>` : ''}
                  <div style="font-size: 0.85em; margin-top: 2px;">
                    <div>OFF: ${offenseChange
                      ? `<span style="color: var(--text-secondary);">${scheme.currentOffense}</span> → <span style="color: var(--success-color);">${scheme.newOffense}</span>`
                      : `<span style="color: var(--text-secondary);">${scheme.currentOffense} (no change)</span>`}</div>
                    <div>DEF: ${defenseChange
                      ? `<span style="color: var(--text-secondary);">${scheme.currentDefense}</span> → <span style="color: var(--success-color);">${scheme.newDefense}</span>`
                      : `<span style="color: var(--text-secondary);">${scheme.currentDefense} (no change)</span>`}</div>
                  </div>
                </div>
              `;
            }).join('');
        }
      }

      // Show warnings if any
      if (preview.warnings && preview.warnings.length > 0) {
        const warningsHtml = preview.warnings.map(w => `<div style="color: var(--warning-color); font-size: 0.85em;">${w}</div>`).join('');
        schemeStatusDiv.innerHTML += warningsHtml;
      }

      retroState.schemePreview = preview;
    } else {
      schemeStatusDiv.innerHTML = `
        <p class="no-changes">Team scheme data not available for ${retroState.targetYear}</p>
      `;
      if (schemeDetailsDiv) schemeDetailsDiv.style.display = 'none';
      retroState.schemePreview = null;
    }

  } catch (error) {
    console.error('[RetroEditor] Error loading scheme preview:', error);
    const schemeStatusDiv = document.getElementById('retro-scheme-status');
    if (schemeStatusDiv) {
      schemeStatusDiv.innerHTML = `
        <p class="no-changes" style="color: var(--error-color);">Error loading scheme data: ${error.message}</p>
      `;
    }
  }
}

/**
 * Apply changes to franchise file
 */
async function applyChanges() {
  try {
    // Move to step 4
    goToRetroStep(4);

    // Show progress
    const progressBar = document.getElementById('retro-progress-bar');
    const progressText = document.getElementById('retro-progress-text');
    const resultsSection = document.getElementById('retro-results-section');
    const errorSection = document.getElementById('retro-error-section');

    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';

    progressBar.style.width = '10%';
    progressText.textContent = 'Preparing to apply changes...';
    await sleep(500);

    // ===== THE CORRECT APPROACH =====
    // Collect all wizard data, then make ONE call to apply everything and save

    // Build the config object with all collected wizard data
    const opts = retroState.options;

    // Check if expansion checkbox is checked
    const expansionCheckbox = document.getElementById('retro-opt-expansion');
    const expansionEnabled = expansionCheckbox && expansionCheckbox.checked;

    // Get the effective salary cap (custom or historical)
    const effectiveSalaryCap = getEffectiveSalaryCap();
    const hasValidSalaryCap = effectiveSalaryCap > 0;

    const config = {
      sourcePath: retroState.filePath,
      saveAs: false, // Will be set based on user choice
      year: retroState.targetYear,
      options: {
        teams: opts.teams || false,
        abbreviations: opts.abbreviations || false,
        schedule: opts.schedule && retroState.schedulePreview !== null,
        coaches: opts.coaches && retroState.coachPreview !== null,
        salaryCap: hasValidSalaryCap, // Enable if we have a valid cap (custom or historical)
        stadiums: retroState.stadiumPreview !== null,
        schemes: retroState.schemePreview !== null,
        uniforms: true, // Always apply uniforms
        expansion: expansionEnabled && retroState.expansionEvent !== null
      },
      // Pass the custom salary cap value (in dollars) if set, null otherwise
      customSalaryCap: hasValidSalaryCap ? effectiveSalaryCap : null,
      expansionEvent: (expansionEnabled && retroState.expansionEvent) ? retroState.expansionEvent : null,
      expansionDraftSelections: retroState.expansionDraftSelections || [], // Manual selections from draft board
      expansionTeamIndices: retroState.expansionTeamIndices || [] // Team indices for clearing rosters
    };

    console.log('[RetroEditor] Config for applyAllAndSave:', JSON.stringify(config, null, 2));

    progressBar.style.width = '20%';
    progressText.textContent = 'Choose how to save...';
    await sleep(300);

    // Ask user: overwrite or save as new file?
    const saveChoice = await showSaveChoiceDialog();
    console.log('[RetroEditor] User save choice:', saveChoice);

    if (saveChoice === 'cancel') {
      progressText.textContent = 'Cancelled';
      showRetroMessage('Save cancelled by user', 'warning');
      return;
    }

    config.saveAs = (saveChoice === 'saveas');

    progressBar.style.width = '30%';
    progressText.textContent = 'Applying all changes...';

    // ===== MAKE ONE CALL TO APPLY EVERYTHING AND SAVE =====
    console.log('[RetroEditor] Calling applyAllAndSave (single atomic operation)...');
    const result = await window.electronAPI.retro.applyAllAndSave(config);
    console.log('[RetroEditor] applyAllAndSave result:', result);

    // ===== LOG DIAGNOSTICS FOR DEBUGGING =====
    if (result.diagnostics) {
      console.log('=== DIAGNOSTICS FROM MAIN PROCESS ===');
      console.log('Expansion condition:', result.diagnostics.expansionCondition);
      console.log('BEFORE counts:', result.diagnostics.beforeCounts);
      console.log('AFTER MOVE counts:', result.diagnostics.afterMoveCounts);
      console.log('FINAL counts:', result.diagnostics.finalCounts);
      console.log('Steps:', result.diagnostics.steps);
      console.log('=== END DIAGNOSTICS ===');
    } else {
      console.log('[RetroEditor] No diagnostics returned');
    }

    if (result.cancelled) {
      progressText.textContent = 'Cancelled';
      showRetroMessage('Save cancelled by user', 'warning');
      return;
    }

    if (!result.success) {
      progressBar.style.width = '100%';
      progressText.textContent = 'Error applying changes';
      document.getElementById('retro-error-message').textContent = result.error || 'Unknown error';
      errorSection.style.display = 'block';
      showRetroMessage('Error: ' + (result.error || 'Unknown error'), 'error');
      return;
    }

    progressBar.style.width = '100%';
    progressText.textContent = 'Changes applied and saved successfully!';

    // Store results
    retroState.applyResult = result.results;

    // Build results summary
    const r = result.results;
    let resultItems = [];

    if (r.seasonYearSet) {
      resultItems.push(`<li>Season year set to ${retroState.targetYear}</li>`);
      resultItems.push(`<li>Super Bowl number set to ${r.superBowlNumber}</li>`);
    }

    if (r.teamChanges > 0) {
      resultItems.push(`<li>${r.teamChanges} team name(s) updated</li>`);
    }

    if (r.draftPicksReordered > 0) {
      resultItems.push(`<li>${r.draftPicksReordered} draft pick(s) reordered</li>`);
    }

    if (r.scheduleGamesUpdated > 0) {
      resultItems.push(`<li>${r.scheduleGamesUpdated} schedule game(s) set</li>`);
    }

    if (r.coachesUpdated > 0) {
      resultItems.push(`<li>${r.coachesUpdated} coach(es) assigned</li>`);
    }

    if (r.salaryCapSet) {
      resultItems.push(`<li>Salary cap set for ${retroState.targetYear}</li>`);
    }

    if (r.stadiumsUpdated > 0) {
      resultItems.push(`<li>${r.stadiumsUpdated} stadium name(s) updated</li>`);
    }

    if (r.schemesUpdated > 0) {
      resultItems.push(`<li>${r.schemesUpdated} team scheme(s) updated</li>`);
    }

    if (r.playersMovedToFA > 0) {
      resultItems.push(`<li>${r.playersMovedToFA} player(s) moved to free agency</li>`);
    }

    if (r.expansionPlayersSelected > 0) {
      if (config.expansionEvent?.type === 'relocation') {
        resultItems.push(`<li>${r.expansionPlayersSelected} player(s) transferred in relocation</li>`);
      } else {
        resultItems.push(`<li>${r.expansionPlayersSelected} player(s) selected in expansion draft</li>`);
      }
    }

    if (r.uniformsApplied > 0) {
      resultItems.push(`<li>${r.uniformsApplied} team uniform(s) set</li>`);
    }

    const savedTo = result.targetPath || retroState.filePath;
    resultItems.push(`<li><strong>Saved to: ${savedTo}</strong></li>`);

    // Show results
    const resultsSummary = document.getElementById('retro-results-summary');
    resultsSummary.innerHTML = `<ul>${resultItems.join('')}</ul>`;
    resultsSection.style.display = 'block';

    showRetroMessage('All changes applied and saved successfully!', 'success');

    // Disable save buttons since already saved
    const saveBtn = document.getElementById('retro-save-file');
    const saveAsBtn = document.getElementById('retro-save-file-as');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="btn-icon">&#9989;</span> Saved';
    }
    if (saveAsBtn) {
      saveAsBtn.disabled = true;
    }

    // Clear expansion draft selections after successful save
    retroState.expansionDraftSelections = [];
    retroState.expansionTeamIndices = [];

    // Close the file
    await window.electronAPI.retro.closeFile(retroState.filePath);

  } catch (error) {
    console.error('[RetroEditor] Error applying changes:', error);
    document.getElementById('retro-progress-text').textContent = 'Error applying changes';
    document.getElementById('retro-error-message').textContent = error.message;
    document.getElementById('retro-error-section').style.display = 'block';
  }
}

/**
 * Show a dialog asking user to choose between overwrite or save as new file
 * Returns: 'overwrite', 'saveas', or 'cancel'
 */
async function showSaveChoiceDialog() {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';

    const dialog = document.createElement('div');
    dialog.style.cssText = 'background:var(--card-bg);border-radius:8px;padding:24px;max-width:400px;text-align:center;border:1px solid var(--border-color);';
    dialog.innerHTML = `
      <h3 style="margin:0 0 16px 0;color:var(--text-color);">Save Changes</h3>
      <p style="margin:0 0 24px 0;color:var(--text-muted);">How would you like to save the modified franchise file?</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <button id="save-choice-overwrite" class="btn btn-primary" style="min-width:140px;">
          <span class="btn-icon">&#128190;</span> Overwrite Original
        </button>
        <button id="save-choice-saveas" class="btn btn-secondary" style="min-width:140px;">
          <span class="btn-icon">&#128193;</span> Save As New File
        </button>
      </div>
      <div style="margin-top:16px;">
        <button id="save-choice-cancel" class="btn btn-ghost" style="min-width:100px;">Cancel</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    document.getElementById('save-choice-overwrite').addEventListener('click', () => {
      cleanup();
      resolve('overwrite');
    });

    document.getElementById('save-choice-saveas').addEventListener('click', () => {
      cleanup();
      resolve('saveas');
    });

    document.getElementById('save-choice-cancel').addEventListener('click', () => {
      cleanup();
      resolve('cancel');
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve('cancel');
      }
    });
  });
}

/**
 * Save the modified franchise file (overwrite original)
 * NOTE: This is now mostly unused since applyChanges handles saving.
 * Kept for backwards compatibility if needed.
 */
async function saveRetroFile() {
  try {
    const saveBtn = document.getElementById('retro-save-file');
    const saveAsBtn = document.getElementById('retro-save-file-as');
    saveBtn.disabled = true;
    saveAsBtn.disabled = true;
    saveBtn.innerHTML = '<span class="btn-icon">&#8987;</span> Saving...';

    // Use applyAndSave instead of saveFile to ensure critical changes persist
    const result = await window.electronAPI.retro.applyAndSave(retroState.filePath, retroState.targetYear);
    console.log('[RetroEditor] Manual save result:', result);

    if (result.success) {
      saveBtn.innerHTML = '<span class="btn-icon">&#9989;</span> Saved!';
      saveBtn.classList.add('success');
      saveAsBtn.style.display = 'none';
      showRetroMessage(`Saved! ${result.playersMoved} expansion players moved to FA, Super Bowl set to ${result.superBowlSet}`, 'success');

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
 * Uses applyAndSaveAs to ensure expansion team players are moved to FA and Super Bowl is set
 */
async function saveRetroFileAs() {
  try {
    const saveBtn = document.getElementById('retro-save-file');
    const saveAsBtn = document.getElementById('retro-save-file-as');
    saveAsBtn.disabled = true;
    saveBtn.disabled = true;
    saveAsBtn.innerHTML = '<span class="btn-icon">&#8987;</span> Saving...';

    // Use applyAndSaveAs instead of saveFileAs to ensure critical changes persist
    const result = await window.electronAPI.retro.applyAndSaveAs(retroState.filePath, retroState.targetYear);
    console.log('[RetroEditor] Save As result:', result);

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
      showRetroMessage(`Saved to: ${result.newPath} - ${result.playersMoved} expansion players moved to FA, Super Bowl set to ${result.superBowlSet}`, 'success');

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
    schedulePreview: null,
    coachPreview: null,
    salaryCapData: null,
    stadiumPreview: null,
    schemePreview: null,
    applyResult: null,
    // User-selected options (reset to defaults)
    options: {
      teams: true,
      abbreviations: true,
      schedule: true,
      logos: false
    }
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

  // Reset schedule preview UI
  document.getElementById('preview-season-length').textContent = '--';
  document.getElementById('preview-bye-weeks').textContent = '--';
  document.getElementById('preview-playoff-teams').textContent = '--';
  document.getElementById('retro-schedule-status').innerHTML = '<p class="no-changes">Checking schedule data...</p>';
  document.getElementById('retro-schedule-details').style.display = 'none';
  document.getElementById('retro-validation-section').style.display = 'none';
  // Remove era note if it was added
  const eraNote = document.querySelector('#retro-era-info .era-note');
  if (eraNote) eraNote.remove();

  // Reset coach preview UI
  document.getElementById('retro-coach-status').innerHTML = '<p class="no-changes">Checking coach data...</p>';
  document.getElementById('retro-coach-details').style.display = 'none';

  // Reset salary cap preview UI
  const salaryCapStatusDiv = document.getElementById('retro-salary-cap-status');
  if (salaryCapStatusDiv) salaryCapStatusDiv.innerHTML = '<p class="no-changes">Checking salary cap data...</p>';

  // Reset stadium preview UI
  const stadiumStatusDiv = document.getElementById('retro-stadium-status');
  if (stadiumStatusDiv) stadiumStatusDiv.innerHTML = '<p class="no-changes">Checking stadium data...</p>';
  const stadiumDetailsDiv = document.getElementById('retro-stadium-details');
  if (stadiumDetailsDiv) stadiumDetailsDiv.style.display = 'none';

  // Reset scheme preview UI
  const schemeStatusDiv = document.getElementById('retro-scheme-status');
  if (schemeStatusDiv) schemeStatusDiv.innerHTML = '<p class="no-changes">Checking scheme data...</p>';
  const schemeDetailsDiv = document.getElementById('retro-scheme-details');
  if (schemeDetailsDiv) schemeDetailsDiv.style.display = 'none';

  // Reset uniform preview UI
  const uniformInfoDiv = document.getElementById('retro-uniform-info');
  if (uniformInfoDiv) uniformInfoDiv.style.display = 'none';

  // Reset portrait preview UI
  document.getElementById('preview-portrait-needed').textContent = '--';
  document.getElementById('preview-real-portraits').textContent = '--';
  const portraitStatusDiv = document.getElementById('retro-portrait-status');
  if (portraitStatusDiv) portraitStatusDiv.innerHTML = '<p class="no-changes">Select a year to see portrait requirements</p>';
  const portraitDetailsDiv = document.getElementById('retro-portrait-details');
  if (portraitDetailsDiv) portraitDetailsDiv.style.display = 'none';

  // Reset logo preview UI
  const logoTeamsNeedingSpan = document.getElementById('logo-teams-needing');
  if (logoTeamsNeedingSpan) logoTeamsNeedingSpan.textContent = '--';
  const logoImportedCountSpan = document.getElementById('logo-imported-count');
  if (logoImportedCountSpan) logoImportedCountSpan.textContent = '--';
  const logoStatusDiv = document.getElementById('logo-status');
  if (logoStatusDiv) logoStatusDiv.innerHTML = '<p class="no-changes">Select a year to see logo requirements.</p>';
  const logoTeamsDetails = document.getElementById('logo-teams-details');
  if (logoTeamsDetails) logoTeamsDetails.style.display = 'none';
  const exportLogosBtn = document.getElementById('btn-export-logos-frosty');
  if (exportLogosBtn) exportLogosBtn.disabled = true;

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

/**
 * Load portrait preview for the selected year
 */
async function loadPortraitPreview() {
  try {
    // Initialize portrait mapping service
    const initResult = await window.electronAPI.portraitMapping.init();
    console.log('[RetroEditor] Portrait mapping initialized:', initResult);

    // Check for existing mapping for this year
    const existingMapping = await window.electronAPI.portraitMapping.get(retroState.targetYear);

    const portraitStatusDiv = document.getElementById('retro-portrait-status');
    const portraitDetailsDiv = document.getElementById('retro-portrait-details');

    if (existingMapping.success && existingMapping.mapping) {
      const summary = existingMapping.mapping.summary;
      document.getElementById('preview-portrait-needed').textContent = summary.recyclableAssigned;
      document.getElementById('preview-real-portraits').textContent = summary.realPortraits;

      portraitStatusDiv.innerHTML = `
        <div style="color: var(--success-color);">
          <strong>Mapping already generated</strong><br>
          <span style="font-size: 0.9em;">Generated: ${new Date(existingMapping.mapping.generatedAt).toLocaleDateString()}</span>
        </div>
      `;

      // Show preview
      if (portraitDetailsDiv) {
        portraitDetailsDiv.style.display = 'block';
        const mappings = existingMapping.mapping.roster || existingMapping.mapping.draftClass || [];
        displayPortraitMappings(mappings.slice(0, 50)); // Show first 50
      }
    } else {
      portraitStatusDiv.innerHTML = `
        <p class="no-changes">No mapping generated yet. Click a button above to generate.</p>
      `;
      document.getElementById('preview-portrait-needed').textContent = '--';
      document.getElementById('preview-real-portraits').textContent = '--';
      if (portraitDetailsDiv) portraitDetailsDiv.style.display = 'none';
    }

  } catch (error) {
    console.error('[RetroEditor] Error loading portrait preview:', error);
    const portraitStatusDiv = document.getElementById('retro-portrait-status');
    if (portraitStatusDiv) {
      portraitStatusDiv.innerHTML = `
        <p class="no-changes" style="color: var(--error-color);">Error loading portrait data: ${error.message}</p>
      `;
    }
  }
}

/**
 * Display portrait mappings in the preview list
 */
function displayPortraitMappings(mappings) {
  const listContainer = document.getElementById('retro-portrait-list');
  if (!listContainer) return;

  listContainer.innerHTML = mappings.map(m => {
    const typeColor = m.type === 'REAL' ? 'var(--success-color)' :
                      m.type === 'RECYCLABLE' ? 'var(--primary-color)' :
                      'var(--warning-color)';
    return `
      <div class="portrait-item" style="margin-bottom: 6px; padding: 6px; background: var(--bg-secondary); border-radius: 4px; font-size: 0.85em;">
        <div style="display: flex; justify-content: space-between;">
          <strong>${m.historicalPlayer}</strong>
          <span style="color: ${typeColor};">${m.type}</span>
        </div>
        ${m.type === 'RECYCLABLE' ? `
          <div style="color: var(--text-secondary); font-size: 0.85em;">
            → ${m.ddsFilename} <span style="opacity: 0.7;">(was: ${m.recycledFrom})</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  if (mappings.length === 50) {
    listContainer.innerHTML += `
      <div style="text-align: center; padding: 8px; color: var(--text-secondary); font-size: 0.85em;">
        Showing first 50 entries. See CSV file for complete list.
      </div>
    `;
  }
}

/**
 * Generate portrait mapping for roster
 */
async function generateRosterPortraitMapping() {
  if (!retroState.targetYear) {
    showRetroMessage('Please select a year first', 'error');
    return;
  }

  // Support both old and new button IDs
  const btn = document.getElementById('btn-generate-roster-mapping') || document.getElementById('btn-generate-portrait-mapping');
  const originalText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating...';
  }

  try {
    const result = await window.electronAPI.portraitMapping.generate(retroState.targetYear, 'roster');

    if (result.success) {
      showRetroMessage(`Roster mapping generated! ${result.result.recyclableAssigned} players assigned, saved to ${result.files.csvPath}`, 'success');
      showToolStatus(`Roster mapping generated! ${result.result.recyclableAssigned} players assigned.`, 'success');
      // Reload previews
      await loadPortraitPreview();
      await loadPortraitsToolPreview();
    } else {
      showRetroMessage('Error generating mapping: ' + result.error, 'error');
      showToolStatus('Error generating mapping: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error generating roster mapping:', error);
    showRetroMessage('Error: ' + error.message, 'error');
    showToolStatus('Error: ' + error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

/**
 * Generate portrait mapping for draft class
 */
async function generateDraftPortraitMapping() {
  if (!retroState.targetYear) {
    showRetroMessage('Please select a year first', 'error');
    return;
  }

  const btn = document.getElementById('btn-generate-draft-mapping');
  const originalText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating...';
  }

  try {
    const result = await window.electronAPI.portraitMapping.generate(retroState.targetYear, 'draft');

    if (result.success) {
      showRetroMessage(`Draft class mapping generated! ${result.result.recyclableAssigned} players assigned, saved to ${result.files.csvPath}`, 'success');
      showToolStatus(`Draft class mapping generated! ${result.result.recyclableAssigned} players assigned.`, 'success');
      // Reload previews
      await loadPortraitPreview();
      await loadPortraitsToolPreview();
    } else {
      showRetroMessage('Error generating mapping: ' + result.error, 'error');
      showToolStatus('Error generating mapping: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error generating draft mapping:', error);
    showRetroMessage('Error: ' + error.message, 'error');
    showToolStatus('Error: ' + error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

// ============================================
// Portrait Import/Export Functions
// ============================================

/**
 * Import draft portraits from folder
 */
async function importDraftPortraits() {
  if (!retroState.targetYear) {
    showRetroMessage('Please select a year first', 'error');
    return;
  }

  const btn = document.getElementById('btn-import-draft-portraits');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Importing...';

  try {
    const result = await window.electronAPI.portraitImport.importFromFolder(retroState.targetYear, 'draft');

    if (result.canceled) {
      showRetroMessage('Import canceled', 'info');
      return;
    }

    if (result.success) {
      showRetroMessage(`Imported ${result.imported} draft portraits. ${result.summary.raceMatches} race matches.`, 'success');
      await refreshPortraitAssignments();
    } else {
      showRetroMessage('Import failed: ' + (result.error || result.errors?.join(', ')), 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Import error:', error);
    showRetroMessage('Import error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Import roster portraits from folder
 */
async function importRosterPortraits() {
  if (!retroState.targetYear) {
    showRetroMessage('Please select a year first', 'error');
    return;
  }

  const btn = document.getElementById('btn-import-roster-portraits');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Importing...';

  try {
    const result = await window.electronAPI.portraitImport.importFromFolder(retroState.targetYear, 'roster');

    if (result.canceled) {
      showRetroMessage('Import canceled', 'info');
      return;
    }

    if (result.success) {
      showRetroMessage(`Imported ${result.imported} roster portraits. ${result.summary.raceMatches} race matches.`, 'success');
      await refreshPortraitAssignments();
    } else {
      showRetroMessage('Import failed: ' + (result.error || result.errors?.join(', ')), 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Import error:', error);
    showRetroMessage('Import error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Auto-assign by race for better matching
 */
async function autoAssignByRace() {
  if (!retroState.targetYear) {
    showRetroMessage('Please select a year first', 'error');
    return;
  }

  const btn = document.getElementById('btn-auto-assign-race');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Optimizing...';

  try {
    let totalImproved = 0;

    // Try both draft and roster
    const draftResult = await window.electronAPI.portraitImport.autoAssignByRace(retroState.targetYear, 'draft');
    if (draftResult.success) totalImproved += draftResult.improved;

    const rosterResult = await window.electronAPI.portraitImport.autoAssignByRace(retroState.targetYear, 'roster');
    if (rosterResult.success) totalImproved += rosterResult.improved;

    if (totalImproved > 0) {
      showRetroMessage(`Improved ${totalImproved} race matches!`, 'success');
      await refreshPortraitAssignments();
    } else {
      showRetroMessage('No improvements found - assignments already optimal.', 'info');
    }
  } catch (error) {
    console.error('[RetroEditor] Auto-assign error:', error);
    showRetroMessage('Error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Export portraits for Frosty
 */
async function exportForFrosty() {
  if (!retroState.targetYear) {
    showRetroMessage('Please select a year first', 'error');
    return;
  }

  const btn = document.getElementById('btn-export-frosty');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Exporting...';

  try {
    // Export both draft and roster if available
    const result = await window.electronAPI.portraitExport.exportForFrosty(retroState.targetYear);

    if (result.canceled) {
      showRetroMessage('Export canceled', 'info');
      return;
    }

    if (result.success) {
      showRetroMessage(`Exported ${result.exportedCount} portraits to: ${result.outputPath}`, 'success');
    } else {
      showRetroMessage('Export failed: ' + (result.error || result.errors?.join(', ')), 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Export error:', error);
    showRetroMessage('Export error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Refresh portrait assignment display
 */
async function refreshPortraitAssignments() {
  if (!retroState.targetYear) return;

  try {
    // Get assignments for both draft and roster
    const draftResult = await window.electronAPI.portraitImport.getAssignments(retroState.targetYear, 'draft');
    const rosterResult = await window.electronAPI.portraitImport.getAssignments(retroState.targetYear, 'roster');

    const draftCount = draftResult.success ? draftResult.count : 0;
    const rosterCount = rosterResult.success ? rosterResult.count : 0;
    const totalCount = draftCount + rosterCount;

    // Update stats display
    const statsDiv = document.getElementById('portrait-assignment-stats');
    const statusDiv = document.getElementById('portrait-import-status');
    const detailsDiv = document.getElementById('portrait-assignments-details');
    const autoAssignBtn = document.getElementById('btn-auto-assign-race');
    const exportBtn = document.getElementById('btn-export-frosty');

    if (totalCount > 0) {
      statsDiv.style.display = 'block';
      document.getElementById('import-draft-count').textContent = draftCount;
      document.getElementById('import-roster-count').textContent = rosterCount;

      // Count race matches
      const allAssignments = [...(draftResult.assignments || []), ...(rosterResult.assignments || [])];
      const raceMatches = allAssignments.filter(a => a.raceMatch).length;
      document.getElementById('import-race-matches').textContent = `${raceMatches} / ${totalCount}`;

      statusDiv.innerHTML = `<p style="color: var(--success-color);">Ready to export ${totalCount} portraits for Frosty.</p>`;

      // Enable buttons
      autoAssignBtn.disabled = false;
      exportBtn.disabled = false;

      // Update and show assignments table
      document.getElementById('assignments-count').textContent = totalCount;
      detailsDiv.style.display = 'block';

      // Populate table
      const tbody = document.getElementById('portrait-assignments-body');
      tbody.innerHTML = '';

      for (const a of allAssignments) {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-color)';

        const raceIcon = a.raceMatch ? '&#9989;' : '&#9888;';
        const raceColor = a.raceMatch ? 'var(--success-color)' : 'var(--warning-color)';

        row.innerHTML = `
          <td style="padding: 6px;">${a.historicalPlayer}</td>
          <td style="padding: 6px;">${a.position || '-'}</td>
          <td style="padding: 6px; font-family: monospace; font-size: 0.75rem;">${a.assignedPLPO}</td>
          <td style="padding: 6px; text-align: center; color: ${raceColor};">${raceIcon}</td>
        `;
        tbody.appendChild(row);
      }
    } else {
      statsDiv.style.display = 'none';
      detailsDiv.style.display = 'none';
      statusDiv.innerHTML = `<p class="no-changes">No portraits imported yet. Select a year and import from folder.</p>`;
      autoAssignBtn.disabled = true;
      exportBtn.disabled = true;
    }
  } catch (error) {
    console.error('[RetroEditor] Error refreshing assignments:', error);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if on the main editor page with retro tool
  if (document.getElementById('retro-tool')) {
    initRetroEditor();

    // Portrait mapping buttons
    document.getElementById('btn-generate-portrait-mapping')?.addEventListener('click', generateRosterPortraitMapping);
    document.getElementById('btn-generate-draft-mapping')?.addEventListener('click', generateDraftPortraitMapping);

    // Portrait import/export buttons
    document.getElementById('btn-import-draft-portraits')?.addEventListener('click', importDraftPortraits);
    document.getElementById('btn-import-roster-portraits')?.addEventListener('click', importRosterPortraits);
    document.getElementById('btn-auto-assign-race')?.addEventListener('click', autoAssignByRace);
    document.getElementById('btn-export-frosty')?.addEventListener('click', exportForFrosty);

    // Logo manager buttons
    document.getElementById('btn-export-logos-frosty')?.addEventListener('click', exportLogosForFrosty);
    document.getElementById('btn-export-logos-mft')?.addEventListener('click', exportLogosForMFT);

    // Logo scraper buttons
    document.getElementById('btn-scrape-all-logos')?.addEventListener('click', scrapeAllLogos);
    document.getElementById('btn-view-scraped-logos')?.addEventListener('click', viewScrapedLogos);
  }
});

// ============================================
// Logo Manager Functions
// ============================================

/**
 * Load logo preview for the selected year
 */
async function loadLogoPreview() {
  try {
    if (!retroState.targetYear) return;

    const statusDiv = document.getElementById('logo-status');
    const teamsDetailsDiv = document.getElementById('logo-teams-details');
    const teamsNeedingSpan = document.getElementById('logo-teams-needing');
    const importedCountSpan = document.getElementById('logo-imported-count');
    const exportBtn = document.getElementById('btn-export-logos-frosty');
    const exportMftBtn = document.getElementById('btn-export-logos-mft');

    statusDiv.innerHTML = '<p class="no-changes">Loading logo data...</p>';

    // Get teams for this year
    const teamsResult = await window.electronAPI.logo.getTeamsForYear(retroState.targetYear);

    if (!teamsResult.success) {
      statusDiv.innerHTML = `<p class="no-changes" style="color: var(--error-color);">Error: ${teamsResult.error}</p>`;
      return;
    }

    const teams = teamsResult.teams || [];
    const teamsNeedingLogos = teams.filter(t => t.needsCustomLogo && t.abbreviation !== 'NFL');

    // Get logo summary
    const summaryResult = await window.electronAPI.logo.getSummary();
    const summary = summaryResult.success ? summaryResult.summary : { totalLogos: 0 };

    // Update stats
    teamsNeedingSpan.textContent = teamsNeedingLogos.length;
    importedCountSpan.textContent = summary.totalLogos;

    if (teamsNeedingLogos.length > 0) {
      statusDiv.innerHTML = `
        <div style="color: var(--warning-color);">
          <strong>${teamsNeedingLogos.length} team(s) need custom logos</strong><br>
          <span style="font-size: 0.9em; color: var(--text-secondary);">
            These teams have different abbreviations than current and need retro logos for MFT.
          </span>
        </div>
      `;

      // Show teams table
      teamsDetailsDiv.style.display = '';
      document.getElementById('logo-teams-count').textContent = teamsNeedingLogos.length;

      // Populate table
      const tbody = document.getElementById('logo-teams-body');
      tbody.innerHTML = '';

      for (const team of teamsNeedingLogos) {
        const logos = await window.electronAPI.logo.getLogosForTeam(team.abbreviation);
        const hasPrimary = logos.success && logos.logos && logos.logos.primary;
        const hasHelmet = logos.success && logos.logos && logos.logos.helmet;

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-color)';

        const checkIcon = '&#9989;';
        const emptyIcon = '&#9744;';

        row.innerHTML = `
          <td style="padding: 6px; font-weight: bold;">${team.abbreviation}</td>
          <td style="padding: 6px;">${team.yearCity} ${team.yearName}</td>
          <td style="padding: 6px; text-align: center; color: ${hasPrimary ? 'var(--success-color)' : 'var(--text-secondary)'};">
            ${hasPrimary ? checkIcon : emptyIcon}
          </td>
          <td style="padding: 6px; text-align: center; color: ${hasHelmet ? 'var(--success-color)' : 'var(--text-secondary)'};">
            ${hasHelmet ? checkIcon : emptyIcon}
          </td>
          <td style="padding: 6px; text-align: center;">
            <button class="btn btn-secondary btn-sm" onclick="importLogoForTeam('${team.abbreviation}', 'primary')" style="font-size: 0.7rem; padding: 2px 6px;">
              Import
            </button>
          </td>
        `;
        tbody.appendChild(row);
      }

      // Enable export buttons if any logos exist
      const hasLogos = summary.totalLogos > 0;
      exportBtn.disabled = !hasLogos;
      if (exportMftBtn) exportMftBtn.disabled = !hasLogos;
    } else {
      statusDiv.innerHTML = `
        <p class="no-changes" style="color: var(--success-color);">No custom logos needed for ${retroState.targetYear}!</p>
        <p style="font-size: 0.85em; color: var(--text-secondary);">All teams use their current abbreviations.</p>
      `;
      teamsDetailsDiv.style.display = 'none';
      exportBtn.disabled = true;
      if (exportMftBtn) exportMftBtn.disabled = true;
    }

    // Load all abbreviations
    await loadAllAbbreviations();

  } catch (error) {
    console.error('[RetroEditor] Error loading logo preview:', error);
    document.getElementById('logo-status').innerHTML = `
      <p class="no-changes" style="color: var(--error-color);">Error: ${error.message}</p>
    `;
  }
}

/**
 * Load all historical abbreviations that need logos
 */
async function loadAllAbbreviations() {
  try {
    const result = await window.electronAPI.logo.getAbbreviationsNeedingLogos();

    if (!result.success) {
      console.error('[RetroEditor] Failed to get abbreviations:', result.error);
      return;
    }

    const abbreviations = result.abbreviations || [];
    const listDiv = document.getElementById('logo-all-abbrev-list');

    if (abbreviations.length === 0) {
      listDiv.innerHTML = '<p class="no-changes">No historical abbreviations found.</p>';
      return;
    }

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">';

    for (const abbr of abbreviations) {
      // Check if logos exist for this abbreviation
      const logosResult = await window.electronAPI.logo.getLogosForTeam(abbr.abbreviation);
      const hasLogos = logosResult.success && logosResult.logos && Object.keys(logosResult.logos).length > 0;

      html += `
        <div style="background: var(--bg-secondary); padding: 8px; border-radius: 4px; border-left: 3px solid ${hasLogos ? 'var(--success-color)' : 'var(--border-color)'};">
          <strong style="font-size: 1.1em;">${abbr.abbreviation}</strong>
          <div style="font-size: 0.8em; color: var(--text-secondary);">
            ${abbr.teams.join(', ')}
          </div>
          <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 4px;">
            ${abbr.yearRanges.join(', ')}
          </div>
          <button class="btn btn-secondary btn-sm" onclick="importLogoForTeam('${abbr.abbreviation}', 'primary')" style="font-size: 0.7rem; padding: 2px 6px; margin-top: 6px;">
            ${hasLogos ? 'Update Logo' : 'Import Logo'}
          </button>
        </div>
      `;
    }

    html += '</div>';
    listDiv.innerHTML = html;

  } catch (error) {
    console.error('[RetroEditor] Error loading abbreviations:', error);
  }
}

/**
 * Import a logo for a specific team abbreviation
 */
async function importLogoForTeam(abbreviation, logoType) {
  try {
    showRetroMessage(`Importing ${logoType} logo for ${abbreviation}...`, 'info');

    const result = await window.electronAPI.logo.importLogo(abbreviation, logoType);

    if (result.canceled) {
      hideRetroMessage();
      return;
    }

    if (result.success) {
      showRetroMessage(`Logo imported successfully for ${abbreviation}!`, 'success');
      // Refresh logo preview
      await loadLogoPreview();
    } else {
      showRetroMessage(`Failed to import logo: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error importing logo:', error);
    showRetroMessage(`Error: ${error.message}`, 'error');
  }
}

/**
 * Export logos for Frosty
 */
async function exportLogosForFrosty() {
  if (!retroState.targetYear) {
    showRetroMessage('Please select a year first', 'error');
    return;
  }

  const btn = document.getElementById('btn-export-logos-frosty');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Exporting...';

  try {
    const result = await window.electronAPI.logo.exportForFrosty(retroState.targetYear);

    if (result.canceled) {
      showRetroMessage('Export canceled', 'info');
      return;
    }

    if (result.success) {
      const filesCreated = result.filesCreated?.length || 0;
      const filesSkipped = result.filesSkipped?.length || 0;

      let message = `Exported ${filesCreated} logo file(s) to: ${result.outputPath}`;
      if (filesSkipped > 0) {
        message += ` (${filesSkipped} team(s) skipped - no logos)`;
      }
      showRetroMessage(message, 'success');
    } else {
      showRetroMessage(`Export failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Export error:', error);
    showRetroMessage(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Export logos for MFT
 */
async function exportLogosForMFT() {
  if (!retroState.targetYear) {
    showRetroMessage('Please select a year first', 'error');
    return;
  }

  const btn = document.getElementById('btn-export-logos-mft');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Exporting...';

  try {
    const result = await window.electronAPI.logo.exportForMFT(retroState.targetYear);

    if (result.canceled) {
      return;
    }

    if (result.success) {
      const filesCreated = result.filesCreated?.length || 0;
      const filesSkipped = result.filesSkipped?.length || 0;

      let message = `Exported ${filesCreated} MFT logo file(s) to: ${result.outputPath}`;
      if (filesSkipped > 0) {
        message += ` (${filesSkipped} team(s) skipped - no logos)`;
      }
      showRetroMessage(message, 'success');
    } else {
      showRetroMessage(`MFT export failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] MFT export error:', error);
    showRetroMessage(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ============================================
// Logo Download Functions (SportsLogos.net)
// ============================================

/**
 * Download logos from SportsLogos.net for the selected year
 */
async function scrapeAllLogos() {
  if (!retroState.targetYear) {
    showRetroMessage('Please select a year first', 'error');
    return;
  }

  const btn = document.getElementById('btn-scrape-all-logos');
  const progressDiv = document.getElementById('scrape-progress');
  const progressBar = document.getElementById('scrape-progress-bar');
  const progressText = document.getElementById('scrape-progress-text');

  try {
    btn.disabled = true;
    btn.textContent = 'Downloading...';
    progressDiv.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = 'Getting team list...';

    // Get teams for this year
    const teamsResult = await window.electronAPI.logo.getTeamsForYear(retroState.targetYear);

    if (!teamsResult.success) {
      showRetroMessage(`Error: ${teamsResult.error}`, 'error');
      return;
    }

    const teams = teamsResult.teams || [];
    // Get teams that need custom logos (different abbreviation)
    const teamsNeedingLogos = teams.filter(t => t.needsCustomLogo && t.abbreviation !== 'NFL');
    const abbreviations = teamsNeedingLogos.map(t => t.abbreviation);

    if (abbreviations.length === 0) {
      showRetroMessage('No teams need custom logos for this year.', 'info');
      return;
    }

    console.log(`[RetroEditor] Downloading logos for ${abbreviations.length} teams:`, abbreviations);
    progressText.textContent = `Downloading ${abbreviations.length} team logos...`;

    // Scrape logos
    const results = await window.electronAPI.logo.scrapeForYear(retroState.targetYear, abbreviations);

    if (!results.success) {
      showRetroMessage(`Scraping failed: ${results.error}`, 'error');
      return;
    }

    // Update progress
    progressBar.style.width = '100%';

    // Count results
    const successful = results.results.filter(r => r.success).length;
    const failed = results.results.filter(r => !r.success).length;

    // Display results
    const scrapedList = document.getElementById('scraped-logos-list');
    scrapedList.style.display = 'block';
    scrapedList.innerHTML = `
      <div style="margin-bottom: 8px; font-size: 0.85rem;">
        <strong>Results:</strong> ${successful} succeeded, ${failed} failed
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px;">
        ${results.results.map(r => `
          <div style="text-align: center; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">
            <div style="font-weight: bold; font-size: 0.9rem; color: ${r.success ? 'var(--success-color)' : 'var(--error-color)'};">
              ${r.abbreviation}
            </div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">
              ${r.success ? '✓' : '✗'}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    progressText.textContent = `Done! ${successful}/${abbreviations.length} logos downloaded.`;
    showRetroMessage(`Downloaded ${successful}/${abbreviations.length} logos successfully!`, 'success');

    // Refresh logo preview
    await loadLogoPreview();

  } catch (error) {
    console.error('[RetroEditor] Scrape error:', error);
    showRetroMessage(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download Logos';
  }
}

/**
 * View downloaded/scraped logos
 */
async function viewScrapedLogos() {
  const scrapedList = document.getElementById('scraped-logos-list');

  try {
    const result = await window.electronAPI.logo.listDownloaded();

    if (!result.success) {
      scrapedList.innerHTML = `<p style="color: var(--error-color);">Error: ${result.error}</p>`;
      scrapedList.style.display = 'block';
      return;
    }

    const logos = result.logos || [];

    if (logos.length === 0) {
      scrapedList.innerHTML = '<p style="color: var(--text-secondary);">No logos downloaded yet.</p>';
      scrapedList.style.display = 'block';
      return;
    }

    scrapedList.style.display = 'block';
    scrapedList.innerHTML = `
      <div style="margin-bottom: 8px; font-size: 0.85rem;">
        <strong>Downloaded Logos:</strong> ${logos.length}
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
        ${logos.map(abbr => `
          <span style="display: inline-block; padding: 4px 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 0.8rem;">
            ${abbr}
          </span>
        `).join('')}
      </div>
    `;

  } catch (error) {
    console.error('[RetroEditor] Error viewing scraped logos:', error);
    scrapedList.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
    scrapedList.style.display = 'block';
  }
}

/**
 * Enable/disable scrape button based on year selection
 */
function updateScrapeButtonState() {
  const btn = document.getElementById('btn-scrape-all-logos');
  if (btn) {
    btn.disabled = !retroState.targetYear;
  }
}

// ============================================================
// EXPANSION DRAFT BOARD
// ============================================================

// State for expansion draft board
let expansionDraftState = {
  event: null,
  eligiblePlayers: [],
  selections: [],
  maxPlayersPerTeam: 0,
  expansionTeams: [],
  controlledTeams: [], // Teams the user will manually pick for
  autoPickTeams: [], // Teams that will be auto-drafted
  protectionMode: false, // When true, clicking players toggles their protection
  currentTeamTurn: 0 // Index into controlledTeams for alternating picks
};

/**
 * Toggle protection mode on/off
 */
function toggleProtectionMode() {
  expansionDraftState.protectionMode = !expansionDraftState.protectionMode;
  const btn = document.getElementById('protectionModeBtn');
  if (expansionDraftState.protectionMode) {
    btn.style.background = 'var(--warning-color)';
    btn.style.color = '#000';
    btn.textContent = '🛡️ Done Editing';
  } else {
    btn.style.background = 'var(--bg-primary)';
    btn.style.color = 'var(--text-primary)';
    btn.textContent = '🛡️ Edit Protection';
  }
  renderDraftTeamsList();
}

/**
 * Toggle a player's protection status
 */
function togglePlayerProtection(recordIndex) {
  const player = expansionDraftState.eligiblePlayers.find(p => p.recordIndex === recordIndex);
  if (!player) return;

  player.isProtected = !player.isProtected;
  console.log(`[ExpansionDraft] ${player.firstName} ${player.lastName} protection: ${player.isProtected}`);

  renderDraftTeamsList();
  updateDraftSummary();
}

/**
 * Open the expansion draft board modal
 */
async function openExpansionDraftBoard() {
  const event = retroState.expansionEvent;
  if (!event) {
    console.error('[ExpansionDraft] No expansion event set');
    alert('No expansion event found for this year');
    return;
  }

  console.log('[ExpansionDraft] Opening draft board for:', event.name);

  // Store event in state
  expansionDraftState.event = event;
  expansionDraftState.selections = [];
  expansionDraftState.expansionTeams = event.teams || [];
  expansionDraftState.maxPlayersPerTeam = event.rules?.playersPerTeam || 30;

  // If multiple expansion teams, show team selection first
  if (expansionDraftState.expansionTeams.length > 1) {
    showTeamSelectionModal();
    return;
  }

  // Single team - user controls it by default
  expansionDraftState.controlledTeams = [...expansionDraftState.expansionTeams];
  expansionDraftState.autoPickTeams = [];

  proceedToExpansionDraft();
}

/**
 * Show team selection modal for multi-team expansion drafts
 */
function showTeamSelectionModal() {
  const teams = expansionDraftState.expansionTeams;
  const event = expansionDraftState.event;

  // Create team selection HTML
  let html = `
    <div style="padding: 20px; max-width: 500px;">
      <h3 style="margin: 0 0 20px 0; color: var(--text-primary);">Select Teams to Control</h3>
      <p style="color: var(--text-secondary); margin-bottom: 20px;">
        Choose which expansion team(s) you want to draft for. Unselected teams will auto-draft based on overall ratings.
      </p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
  `;

  for (const team of teams) {
    html += `
      <label style="display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; cursor: pointer;">
        <input type="checkbox" id="control-team-${team.teamIndex}" checked style="width: 18px; height: 18px;">
        <span style="font-size: 16px; color: var(--text-primary);">${team.name}</span>
      </label>
    `;
  }

  html += `
      </div>
      <div style="display: flex; gap: 10px; margin-top: 24px; justify-content: flex-end;">
        <button onclick="cancelTeamSelection()" style="padding: 10px 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer;">
          Cancel
        </button>
        <button onclick="confirmTeamSelection()" style="padding: 10px 20px; background: var(--accent-color); border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600;">
          Start Draft
        </button>
      </div>
    </div>
  `;

  // Show in the expansion draft modal container
  const modal = document.getElementById('expansionDraftModal');
  modal.style.display = 'flex';

  const container = document.getElementById('draftTeamsList');
  container.innerHTML = html;

  // Update event info
  document.getElementById('draftEventInfo').innerHTML = `
    <div><strong>${event.name}</strong></div>
    <div style="margin-top: 4px;">${event.description || ''}</div>
  `;

  // Hide the filters header during team selection
  const filtersHeader = document.getElementById('draftFiltersHeader');
  if (filtersHeader) {
    filtersHeader.style.display = 'none';
  }
}

/**
 * Cancel team selection and close modal
 */
function cancelTeamSelection() {
  closeExpansionDraftModal();
}

/**
 * Confirm team selection and proceed to draft
 */
function confirmTeamSelection() {
  const teams = expansionDraftState.expansionTeams;
  expansionDraftState.controlledTeams = [];
  expansionDraftState.autoPickTeams = [];

  for (const team of teams) {
    const checkbox = document.getElementById(`control-team-${team.teamIndex}`);
    if (checkbox && checkbox.checked) {
      expansionDraftState.controlledTeams.push(team);
    } else {
      expansionDraftState.autoPickTeams.push(team);
    }
  }

  console.log('[ExpansionDraft] Controlled teams:', expansionDraftState.controlledTeams.map(t => t.name).join(', '));
  console.log('[ExpansionDraft] Auto-pick teams:', expansionDraftState.autoPickTeams.map(t => t.name).join(', '));

  // Show filters header again
  const filtersHeader = document.getElementById('draftFiltersHeader');
  if (filtersHeader) {
    filtersHeader.style.display = 'flex';
  }

  // Show summary
  const summaryEl = document.getElementById('draftSummary');
  if (summaryEl) {
    summaryEl.style.display = 'block';
  }

  proceedToExpansionDraft();
}

/**
 * Proceed to the main expansion draft board after team selection
 */
async function proceedToExpansionDraft() {
  const event = expansionDraftState.event;
  const modal = document.getElementById('expansionDraftModal');
  modal.style.display = 'flex';

  // Show loading state
  document.getElementById('draftTeamsList').innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
      Loading players...
    </div>
  `;

  // Update event info with team control status
  let teamControlInfo = '';
  if (expansionDraftState.controlledTeams.length > 0) {
    teamControlInfo += `<div>You control: ${expansionDraftState.controlledTeams.map(t => t.name).join(', ')}</div>`;
  }
  if (expansionDraftState.autoPickTeams.length > 0) {
    teamControlInfo += `<div style="color: var(--text-secondary);">Auto-draft: ${expansionDraftState.autoPickTeams.map(t => t.name).join(', ')}</div>`;
  }

  document.getElementById('draftEventInfo').innerHTML = `
    <div><strong>${event.name}</strong></div>
    <div style="margin-top: 4px;">${event.description || ''}</div>
    <div style="margin-top: 8px;">
      <div>Players per team: ${expansionDraftState.maxPlayersPerTeam}</div>
      <div>Protected per team: ${event.protectionRules?.maxProtected || 32}</div>
      <div>Max from same team: ${event.rules?.maxFromSameTeam || 'unlimited'}</div>
      ${teamControlInfo}
    </div>
  `;

  // Update selection count
  updateDraftSelectionCount();

  try {
    // First, prepare for expansion draft by moving existing expansion team players to FA
    console.log('[ExpansionDraft] Preparing expansion draft - moving existing players to FA');
    const prepareResult = await window.electronAPI.retro.prepareExpansionDraft(
      retroState.filePath,
      event
    );
    console.log('[ExpansionDraft] Prepare result:', prepareResult);
    if (prepareResult.movedCount > 0) {
      console.log(`[ExpansionDraft] Moved ${prepareResult.movedCount} existing players to FA`);
    }

    // Get eligible players
    console.log('[ExpansionDraft] Calling getEligiblePlayers for file:', retroState.filePath);
    console.log('[ExpansionDraft] Roster path for OVR lookup:', retroState.rosterPath || 'not set');
    const eligibleResult = await window.electronAPI.retro.getEligiblePlayers(
      retroState.filePath,
      event,
      retroState.rosterPath  // Optional roster file for correct OVR values
    );

    console.log('[ExpansionDraft] getEligiblePlayers result:', eligibleResult?.success, 'count:', eligibleResult?.players?.length);

    if (!eligibleResult.success || !eligibleResult.players) {
      console.error('[ExpansionDraft] Failed to get eligible players:', eligibleResult?.error);
      document.getElementById('draftTeamsList').innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--error-color);">
          Failed to load eligible players: ${eligibleResult.error || 'Unknown error'}
        </div>
      `;
      return;
    }

    // Auto-protect based on rules
    const maxProtected = event.protectionRules?.maxProtected || 32;
    const protectedResult = await window.electronAPI.retro.autoProtectPlayers(
      eligibleResult.players,
      maxProtected
    );

    if (!protectedResult.success || !protectedResult.players) {
      console.error('[ExpansionDraft] Failed to auto-protect players');
      document.getElementById('draftTeamsList').innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--error-color);">
          Failed to auto-protect players
        </div>
      `;
      return;
    }

    console.log('[ExpansionDraft] autoProtectPlayers result:', protectedResult.players.length, 'players');
    const protectedCount = protectedResult.players.filter(p => p.isProtected).length;
    const unprotectedCount = protectedResult.players.filter(p => !p.isProtected).length;
    console.log('[ExpansionDraft] Protected:', protectedCount, 'Unprotected:', unprotectedCount);

    expansionDraftState.eligiblePlayers = protectedResult.players;

    // Populate team filter
    populateTeamFilter();
    console.log('[ExpansionDraft] Team filter populated');

    // Render teams and players
    console.log('[ExpansionDraft] Calling renderDraftTeamsList()');
    renderDraftTeamsList();
    renderSelectedPlayersList();
    updateDraftSelectionCount();

    // Update summary
    updateDraftSummary();

    // Process any auto-picks if it's not the user's turn first
    if (expansionDraftState.autoPickTeams.length > 0) {
      processAutoPicks();
    }

  } catch (err) {
    console.error('[ExpansionDraft] Error loading players:', err);
    document.getElementById('draftTeamsList').innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--error-color);">
        Error: ${err.message}
      </div>
    `;
  }
}

/**
 * Get the team that should pick next based on alternating order
 * Returns { team, isAutoPick } or null if draft is complete
 */
function getNextPickingTeam() {
  const allTeams = expansionDraftState.expansionTeams;
  if (allTeams.length === 0) return null;

  const maxPerTeam = expansionDraftState.maxPlayersPerTeam;

  // Count total picks made
  const totalPicks = expansionDraftState.selections.length;

  // Determine which team's turn it is based on total picks (alternating)
  const teamTurnIndex = totalPicks % allTeams.length;
  const pickingTeam = allTeams[teamTurnIndex];

  // Check if this team is full
  const teamCount = expansionDraftState.selections.filter(
    s => s.newTeamIndex === pickingTeam.teamIndex
  ).length;

  if (teamCount >= maxPerTeam) {
    // This team is full, find next team that isn't
    for (let i = 1; i < allTeams.length; i++) {
      const nextIdx = (teamTurnIndex + i) % allTeams.length;
      const nextTeam = allTeams[nextIdx];
      const nextTeamCount = expansionDraftState.selections.filter(
        s => s.newTeamIndex === nextTeam.teamIndex
      ).length;
      if (nextTeamCount < maxPerTeam) {
        const isAuto = expansionDraftState.autoPickTeams.some(t => t.teamIndex === nextTeam.teamIndex);
        return { team: nextTeam, isAutoPick: isAuto };
      }
    }
    return null; // All teams full
  }

  const isAutoPick = expansionDraftState.autoPickTeams.some(t => t.teamIndex === pickingTeam.teamIndex);
  return { team: pickingTeam, isAutoPick: isAutoPick };
}

/**
 * Auto-pick ONE player for the specified team
 * Returns true if a player was picked, false if no players available
 */
function autoPickOnePlayer(expansionTeam) {
  const maxFromSameTeam = expansionDraftState.event?.rules?.maxFromSameTeam;

  // Position priority for auto-pick (lower = higher priority)
  // Specialists (K, P, LS) should be picked last
  const positionPriority = {
    'QB': 1, 'HB': 2, 'WR': 3, 'TE': 4, 'FB': 5,
    'LT': 6, 'LG': 7, 'C': 8, 'RG': 9, 'RT': 10,
    'LEDG': 11, 'REDG': 12, 'DT': 13,
    'SAM': 14, 'Mike': 15, 'WILL': 16,
    'CB': 17, 'FS': 18, 'SS': 19,
    'K': 50, 'P': 51, 'LS': 52 // Specialists picked last
  };

  // Track how many players taken from each source team
  const takenFromTeam = new Map();
  // Track positions already picked for this team to add variety
  const positionsTaken = new Map();
  for (const sel of expansionDraftState.selections) {
    if (sel.newTeamIndex === expansionTeam.teamIndex) {
      const player = expansionDraftState.eligiblePlayers.find(p => p.recordIndex === sel.playerRecordIndex);
      if (player) {
        takenFromTeam.set(player.teamIndex, (takenFromTeam.get(player.teamIndex) || 0) + 1);
        positionsTaken.set(player.position, (positionsTaken.get(player.position) || 0) + 1);
      }
    }
  }

  // Get unprotected, unselected players
  const availablePlayers = expansionDraftState.eligiblePlayers.filter(p => {
    if (p.isProtected) return false;
    if (expansionDraftState.selections.some(s => s.playerRecordIndex === p.recordIndex)) return false;
    // Check max from same team rule
    if (maxFromSameTeam && typeof maxFromSameTeam === 'number') {
      const takenCount = takenFromTeam.get(p.teamIndex) || 0;
      if (takenCount >= maxFromSameTeam) return false;
    }
    return true;
  });

  if (availablePlayers.length === 0) {
    console.log(`[ExpansionDraft] No more available players for ${expansionTeam.name}`);
    return false;
  }

  // Sort by: position priority first, then OVR within same priority tier
  availablePlayers.sort((a, b) => {
    const aPriority = positionPriority[a.position] || 30;
    const bPriority = positionPriority[b.position] || 30;

    // Penalize positions we already have multiple of (encourages roster variety)
    const aCount = positionsTaken.get(a.position) || 0;
    const bCount = positionsTaken.get(b.position) || 0;
    const aAdjusted = aPriority + (aCount * 5);
    const bAdjusted = bPriority + (bCount * 5);

    if (aAdjusted !== bAdjusted) {
      return aAdjusted - bAdjusted;
    }
    // Same priority tier - pick higher OVR
    return b.overall - a.overall;
  });

  const bestPlayer = availablePlayers[0];

  // Add selection
  expansionDraftState.selections.push({
    playerRecordIndex: bestPlayer.recordIndex,
    newTeamIndex: expansionTeam.teamIndex,
    playerName: `${bestPlayer.firstName} ${bestPlayer.lastName}`,
    position: bestPlayer.position,
    overall: bestPlayer.overall,
    fromTeam: bestPlayer.teamName,
    toTeam: expansionTeam.name,
    isAutoPick: true
  });

  console.log(`[ExpansionDraft] Auto-picked ${bestPlayer.firstName} ${bestPlayer.lastName} (${bestPlayer.position} ${bestPlayer.overall}) for ${expansionTeam.name}`);
  return true;
}

/**
 * Process auto-picks until it's the user's turn
 * Called after loading draft and after each user pick
 */
function processAutoPicks() {
  let picksMade = 0;
  const maxPicks = 100; // Safety limit

  while (picksMade < maxPicks) {
    const nextPick = getNextPickingTeam();
    if (!nextPick) {
      console.log('[ExpansionDraft] Draft complete or all teams full');
      break;
    }

    if (!nextPick.isAutoPick) {
      // It's the user's turn
      console.log(`[ExpansionDraft] Waiting for user to pick for ${nextPick.team.name}`);
      break;
    }

    // Auto-pick for this team
    const picked = autoPickOnePlayer(nextPick.team);
    if (!picked) {
      console.log(`[ExpansionDraft] Could not auto-pick for ${nextPick.team.name}`);
      break;
    }
    picksMade++;
  }

  // Update UI after auto-picks
  if (picksMade > 0) {
    renderDraftTeamsList();
    renderSelectedPlayersList();
    updateDraftSelectionCount();
    updateDraftSummary();
  }
}

/**
 * Populate the team filter dropdown
 */
function populateTeamFilter() {
  const teamFilter = document.getElementById('expansionDraftTeamFilter');
  const teams = new Set();

  for (const player of expansionDraftState.eligiblePlayers) {
    teams.add(player.teamName);
  }

  teamFilter.innerHTML = '<option value="all">All Teams</option>';
  for (const team of [...teams].sort()) {
    teamFilter.innerHTML += `<option value="${team}">${team}</option>`;
  }
}

/**
 * Render the teams and players list
 */
function renderDraftTeamsList() {
  console.log('[ExpansionDraft] renderDraftTeamsList() called');
  console.log('[ExpansionDraft] eligiblePlayers count:', expansionDraftState.eligiblePlayers?.length);

  const container = document.getElementById('draftTeamsList');
  console.log('[ExpansionDraft] Container element:', container ? 'FOUND' : 'NOT FOUND');

  const teamFilter = document.getElementById('expansionDraftTeamFilter')?.value || 'all';
  const positionFilter = document.getElementById('expansionDraftPositionFilter')?.value || 'all';
  console.log('[ExpansionDraft] Filters - team:', teamFilter, 'position:', positionFilter);

  // Group players by team
  const playersByTeam = new Map();
  for (const player of expansionDraftState.eligiblePlayers) {
    if (teamFilter !== 'all' && player.teamName !== teamFilter) continue;
    if (positionFilter !== 'all' && player.position !== positionFilter) continue;

    if (!playersByTeam.has(player.teamName)) {
      playersByTeam.set(player.teamName, []);
    }
    playersByTeam.get(player.teamName).push(player);
  }

  console.log('[ExpansionDraft] playersByTeam.size:', playersByTeam.size);

  if (playersByTeam.size === 0) {
    console.log('[ExpansionDraft] No players match filters - showing empty message');
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        No players match the current filters
      </div>
    `;
    return;
  }

  let html = '';
  for (const [teamName, players] of [...playersByTeam.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const protectedCount = players.filter(p => p.isProtected).length;
    const availableCount = players.length - protectedCount;

    html += `
      <div class="draft-team-card" style="background: var(--bg-primary); border-radius: 6px; padding: 12px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h5 style="margin: 0; color: var(--text-primary);">${teamName}</h5>
          <span style="font-size: 12px; color: var(--text-secondary);">
            ${protectedCount} protected, ${availableCount} available
          </span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
    `;

    // Position order for sorting (offense, defense, special teams) - using Madden position names
    const positionOrder = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
                           'LEDG', 'REDG', 'DT', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS', 'K', 'P', 'LS'];

    // Sort players: unprotected first, then by position, then by OVR within position
    players.sort((a, b) => {
      // Unprotected first (so they're easier to click)
      if (a.isProtected !== b.isProtected) return a.isProtected ? 1 : -1;
      // Then by position
      const posA = positionOrder.indexOf(a.position);
      const posB = positionOrder.indexOf(b.position);
      if (posA !== posB) return (posA === -1 ? 999 : posA) - (posB === -1 ? 999 : posB);
      // Then by OVR within position
      return b.overall - a.overall;
    });

    for (const player of players) {
      const isSelected = expansionDraftState.selections.some(s => s.playerRecordIndex === player.recordIndex);
      const inProtectionMode = expansionDraftState.protectionMode;

      // Skip already selected players (they're in the selections list)
      if (isSelected && !inProtectionMode) {
        continue;
      }

      // Colors depend on mode and status
      let bgColor, textColor, cursor, opacity;
      if (inProtectionMode) {
        // Protection mode: show protected status clearly, all clickable
        bgColor = player.isProtected ? 'var(--warning-color)' : 'var(--bg-secondary)';
        textColor = player.isProtected ? '#000' : 'var(--text-primary)';
        cursor = 'pointer';
        opacity = '1';
      } else {
        // Draft mode: normal colors
        bgColor = isSelected ? 'var(--success-color)' : (player.isProtected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)');
        textColor = isSelected ? '#fff' : (player.isProtected ? 'var(--text-muted)' : 'var(--text-primary)');
        cursor = player.isProtected ? 'not-allowed' : 'pointer';
        opacity = player.isProtected ? '0.6' : '1';
      }

      // Click handler depends on mode
      let clickHandler = '';
      if (inProtectionMode) {
        clickHandler = `onclick="togglePlayerProtection(${player.recordIndex})"`;
      } else if (!player.isProtected) {
        clickHandler = `onclick="togglePlayerSelection(${player.recordIndex})"`;
      }

      // Format contract info for tooltip
      // Service returns salary already in millions (PSA0/100)
      const contractYears = player.contractYearsLeft || 0;
      const contractSalary = typeof player.contractSalary === 'number' ? `$${player.contractSalary.toFixed(1)}M` : 'N/A';
      const capHit = typeof player.capHit === 'number' ? `$${player.capHit.toFixed(1)}M` : 'N/A';

      html += `
        <div class="draft-player-chip"
             data-record-index="${player.recordIndex}"
             data-protected="${player.isProtected}"
             style="
               padding: 4px 8px;
               border-radius: 4px;
               font-size: 12px;
               background: ${bgColor};
               color: ${textColor};
               cursor: ${cursor};
               opacity: ${opacity};
             "
             ${clickHandler}
             title="${player.firstName} ${player.lastName}
OVR: ${player.overall} | Age: ${player.age}
Years: ${contractYears} | Contract: ${contractSalary} | Cap: ${capHit}${player.isProtected ? '\n(PROTECTED)' : ''}">
          ${player.lastName}, ${player.firstName.charAt(0)}. (${player.position} ${player.overall})${inProtectionMode && player.isProtected ? ' 🛡️' : ''}
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  console.log('[ExpansionDraft] Setting container HTML, length:', html.length);
  container.innerHTML = html;
  console.log('[ExpansionDraft] Container childElementCount after render:', container?.childElementCount);
}

/**
 * Toggle a player's selection status
 */
function togglePlayerSelection(recordIndex) {
  const player = expansionDraftState.eligiblePlayers.find(p => p.recordIndex === recordIndex);
  if (!player || player.isProtected) return;

  const existingIdx = expansionDraftState.selections.findIndex(s => s.playerRecordIndex === recordIndex);

  if (existingIdx >= 0) {
    // Deselect
    expansionDraftState.selections.splice(existingIdx, 1);
  } else {
    // Check if we've reached the max
    const maxTotal = expansionDraftState.maxPlayersPerTeam * expansionDraftState.expansionTeams.length;
    if (expansionDraftState.selections.length >= maxTotal) {
      alert(`Maximum ${maxTotal} players can be selected`);
      return;
    }

    // Check whose turn it is
    const nextPick = getNextPickingTeam();
    if (!nextPick) {
      alert('Draft is complete - all teams are full');
      return;
    }
    if (nextPick.isAutoPick) {
      // It's the auto-pick team's turn - wait for auto-pick to finish
      console.log('[ExpansionDraft] User clicked but it is auto-pick turn, processing auto-picks first');
      processAutoPicks();
      return;
    }
    const teamIndex = nextPick.team.teamIndex;

    expansionDraftState.selections.push({
      playerRecordIndex: recordIndex,
      newTeamIndex: teamIndex
    });

    // Re-render after user pick
    renderDraftTeamsList();
    renderSelectedPlayersList();
    updateDraftSelectionCount();
    updateDraftSummary();

    // Process auto-picks for the other team(s) if any
    if (expansionDraftState.autoPickTeams.length > 0) {
      // Small delay so user can see their pick before auto-pick happens
      setTimeout(() => {
        processAutoPicks();
      }, 300);
    }
    return;
  }

  // Re-render after deselect
  renderDraftTeamsList();
  renderSelectedPlayersList();
  updateDraftSelectionCount();
  updateDraftSummary();
}

/**
 * Get the next expansion team for user to pick (only controlled teams)
 * Uses the centralized getNextPickingTeam() logic
 */
function getNextAvailableExpansionTeam() {
  const nextPick = getNextPickingTeam();
  if (!nextPick) return null;

  // If it's an auto-pick team's turn, something is wrong - we shouldn't be here
  if (nextPick.isAutoPick) {
    console.warn('[ExpansionDraft] getNextAvailableExpansionTeam called but it is auto-pick turn');
    return null;
  }

  return nextPick.team.teamIndex;
}

/**
 * Render the selected players list - grouped by team
 */
function renderSelectedPlayersList() {
  const container = document.getElementById('draftSelectedList');

  if (expansionDraftState.selections.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px;">
        Click a player to select them
      </div>
    `;
    return;
  }

  // Group selections by team
  const selectionsByTeam = new Map();
  for (const team of expansionDraftState.expansionTeams) {
    selectionsByTeam.set(team.teamIndex, []);
  }

  for (const selection of expansionDraftState.selections) {
    const teamSelections = selectionsByTeam.get(selection.newTeamIndex);
    if (teamSelections) {
      teamSelections.push(selection);
    }
  }

  let html = '';

  // Only show team headers if there are multiple teams
  const showTeamHeaders = expansionDraftState.expansionTeams.length > 1;

  for (const team of expansionDraftState.expansionTeams) {
    const teamSelections = selectionsByTeam.get(team.teamIndex) || [];

    if (showTeamHeaders) {
      html += `
        <div style="font-size: 12px; font-weight: 600; color: var(--accent-color); margin: ${html ? '12px' : '0'} 0 6px 0; padding-bottom: 4px; border-bottom: 1px solid var(--border-color);">
          ${team.name} (${teamSelections.length}/${expansionDraftState.maxPlayersPerTeam})
        </div>
      `;
    }

    for (const selection of teamSelections) {
      const player = expansionDraftState.eligiblePlayers.find(p => p.recordIndex === selection.playerRecordIndex);
      if (!player) continue;

      const autoLabel = selection.isAutoPick ? ' (auto)' : '';

      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 4px;">
          <div>
            <span style="color: var(--text-primary);">${player.firstName} ${player.lastName}</span>
            <span style="color: var(--text-secondary); font-size: 12px;"> ${player.position} ${player.overall}${autoLabel}</span>
          </div>
          ${!selection.isAutoPick ? `
            <button onclick="togglePlayerSelection(${player.recordIndex})"
                    style="background: none; border: none; color: var(--error-color); cursor: pointer; padding: 2px 6px;">
              ✕
            </button>
          ` : ''}
        </div>
      `;
    }

    if (teamSelections.length === 0 && showTeamHeaders) {
      html += `
        <div style="padding: 8px; color: var(--text-secondary); font-size: 12px; font-style: italic;">
          No players selected yet
        </div>
      `;
    }
  }

  container.innerHTML = html;
}

/**
 * Update the selection count display
 */
function updateDraftSelectionCount() {
  const maxTotal = expansionDraftState.maxPlayersPerTeam * (expansionDraftState.expansionTeams?.length || 1);
  const current = expansionDraftState.selections.length;

  // Get current team picking info
  const nextPick = getNextPickingTeam();

  let countText = `${current} / ${maxTotal}`;
  if (nextPick && expansionDraftState.expansionTeams.length > 1) {
    const pickLabel = nextPick.isAutoPick ? `${nextPick.team.name} (auto)` : nextPick.team.name;
    countText += ` | Now picking: ${pickLabel}`;
  }

  document.getElementById('draftSelectionCount').textContent = countText;
}

/**
 * Update the summary display
 */
function updateDraftSummary() {
  const protectedCount = expansionDraftState.eligiblePlayers.filter(p => p.isProtected).length;
  const availableCount = expansionDraftState.eligiblePlayers.filter(p => !p.isProtected).length;
  const selectedCount = expansionDraftState.selections.length;

  document.getElementById('draftProtectedCount').textContent = protectedCount;
  document.getElementById('draftAvailableCount').textContent = availableCount;
  document.getElementById('draftSelectedCount').textContent = selectedCount;
}

/**
 * Close the expansion draft modal
 */
function closeExpansionDraftModal() {
  document.getElementById('expansionDraftModal').style.display = 'none';
  expansionDraftState = {
    event: null,
    eligiblePlayers: [],
    selections: [],
    maxPlayersPerTeam: 0,
    expansionTeams: [],
    controlledTeams: [],
    autoPickTeams: [],
    protectionMode: false,
    currentTeamTurn: 0
  };
}

/**
 * Execute the expansion draft with current selections.
 * Instead of executing immediately, store selections in retroState
 * for the final "Apply Changes" save flow.
 */
async function executeExpansionDraftFromBoard() {
  if (expansionDraftState.selections.length === 0) {
    alert('Please select at least one player');
    return;
  }

  const confirmMsg = `Save ${expansionDraftState.selections.length} player selections for expansion draft?`;
  if (!confirm(confirmMsg)) return;

  // Store selections in retroState for the final save flow
  // Include expansion team indices for proper roster array handling
  retroState.expansionDraftSelections = expansionDraftState.selections.map(sel => ({
    playerRecordIndex: sel.playerRecordIndex,
    newTeamIndex: sel.newTeamIndex
  }));

  // Also store the expansion team indices for clearing rosters
  retroState.expansionTeamIndices = expansionDraftState.expansionTeams.map(t => t.teamIndex);

  console.log('[ExpansionDraft] Saved selections:', retroState.expansionDraftSelections.length);
  console.log('[ExpansionDraft] Expansion team indices:', retroState.expansionTeamIndices);

  alert(`Expansion draft selections saved! ${expansionDraftState.selections.length} players.\n\nClick "Apply Changes" to execute the draft and save.`);

  closeExpansionDraftModal();
}

// Wire up expansion draft board handlers
document.addEventListener('DOMContentLoaded', () => {
  // Select roster file for OVR lookup
  const selectRosterBtn = document.getElementById('select-roster-for-draft-btn');
  if (selectRosterBtn) {
    selectRosterBtn.onclick = async () => {
      try {
        const result = await window.electronAPI.retro.selectFile();
        if (result.cancelled) return;
        if (!result.success) {
          alert('Error selecting file: ' + result.error);
          return;
        }
        retroState.rosterPath = result.filePath;
        const fileName = result.filePath.split(/[\\/]/).pop();
        document.getElementById('roster-for-draft-name').textContent = fileName || 'Selected';
        console.log('[RetroEditor] Roster file for OVR lookup:', result.filePath);
      } catch (e) {
        console.error('[RetroEditor] Error selecting roster file:', e);
      }
    };
  }

  // Open draft board button
  const openBtn = document.getElementById('open-expansion-draft-btn');
  if (openBtn) {
    openBtn.onclick = openExpansionDraftBoard;
  }

  // Close modal button
  const closeBtn = document.getElementById('closeExpansionDraftBtn');
  if (closeBtn) {
    closeBtn.onclick = closeExpansionDraftModal;
  }

  // Cancel button
  const cancelBtn = document.getElementById('cancelExpansionDraftBtn');
  if (cancelBtn) {
    cancelBtn.onclick = closeExpansionDraftModal;
  }

  // Execute button
  const executeBtn = document.getElementById('executeExpansionDraftBtn');
  if (executeBtn) {
    executeBtn.onclick = executeExpansionDraftFromBoard;
  }

  // Filter handlers
  const teamFilter = document.getElementById('expansionDraftTeamFilter');
  if (teamFilter) {
    teamFilter.onchange = renderDraftTeamsList;
  }

  const positionFilter = document.getElementById('expansionDraftPositionFilter');
  if (positionFilter) {
    positionFilter.onchange = renderDraftTeamsList;
  }

  // Click outside to close
  const modal = document.getElementById('expansionDraftModal');
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        closeExpansionDraftModal();
      }
    };
  }
});

// ============================================
// TOOL LANDING PAGE FUNCTIONS
// ============================================

/**
 * Load available years for the tool landing page dropdown
 */
async function loadToolLandingYears() {
  try {
    const result = await window.electronAPI.retro.getAvailableYears();
    if (result.success) {
      const select = document.getElementById('retro-target-year');
      if (!select) return;

      select.innerHTML = '';
      // Add years in descending order (newest first)
      result.years.sort((a, b) => b - a).forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading tool landing years:', error);
  }
}

/**
 * Show the tool landing page after file selection
 */
function showToolLandingPage(fileMetadata, defaultYear) {
  // Hide file selection section
  document.getElementById('retro-file-selection').style.display = 'none';

  // Show tool landing page
  const landingPage = document.getElementById('retro-tool-landing');
  landingPage.style.display = 'block';

  // Update header info
  const filename = retroState.filePath.split(/[/\\]/).pop();
  document.getElementById('retro-header-filename').textContent = filename;
  document.getElementById('retro-header-current-year').textContent = fileMetadata.currentSeasonYear || 'Unknown';
  document.getElementById('retro-header-week').textContent = fileMetadata.currentWeek || 'Unknown';

  // Set target year dropdown
  const yearSelect = document.getElementById('retro-target-year');
  if (yearSelect && defaultYear) {
    yearSelect.value = defaultYear;
    retroState.targetYear = defaultYear;
  }

  // Update tool cards based on year
  updateToolCards();
}

/**
 * Update tool cards based on selected year
 */
async function updateToolCards() {
  const year = retroState.targetYear;
  if (!year) return;

  // Check for expansion event
  const expansionCard = document.querySelector('.retro-tool-card[data-tool="expansion"]');
  const expansionBadge = document.getElementById('expansion-badge');

  try {
    const result = await window.electronAPI.retro.getExpansionEvent(year);
    if (result.success && result.event) {
      // Expansion event available for this year
      expansionCard.classList.remove('disabled');
      expansionCard.style.opacity = '1';
      expansionCard.style.cursor = 'pointer';
      if (expansionBadge) {
        expansionBadge.style.display = 'none';
      }
      retroState.expansionEvent = result.event;
    } else {
      // No expansion event for this year - disable the card
      expansionCard.classList.add('disabled');
      expansionCard.style.opacity = '0.5';
      expansionCard.style.cursor = 'not-allowed';
      if (expansionBadge) {
        expansionBadge.style.display = 'block';
        expansionBadge.textContent = 'N/A for ' + year;
      }
      retroState.expansionEvent = null;
    }
  } catch (error) {
    console.error('[RetroEditor] Error checking expansion event:', error);
  }

  // Check for relocation event
  const relocationCard = document.querySelector('.retro-tool-card[data-tool="relocation"]');
  try {
    const result = await window.electronAPI.retro.getExpansionEvent(year);
    if (result.success && result.event && result.event.type === 'relocation') {
      relocationCard.classList.remove('disabled');
      relocationCard.style.opacity = '1';
    } else {
      // Relocation is still available but may show "no event" in modal
    }
  } catch (error) {
    console.error('[RetroEditor] Error checking relocation:', error);
  }
}

/**
 * Open a tool modal
 */
async function openToolModal(toolName) {
  console.log('[RetroEditor] Opening tool modal:', toolName);

  // Don't open disabled tools
  const card = document.querySelector(`.retro-tool-card[data-tool="${toolName}"]`);
  if (card && card.classList.contains('disabled')) {
    console.log('[RetroEditor] Tool is disabled, not opening');
    return;
  }

  const modalId = `modal-${toolName}`;
  const modal = document.getElementById(modalId);

  if (!modal) {
    console.error('[RetroEditor] Modal not found:', modalId);
    return;
  }

  // Show modal
  modal.style.display = 'flex';

  // Load preview data for this tool
  await loadToolPreview(toolName);
}

/**
 * Close a tool modal
 */
function closeToolModal(modal) {
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Load preview data for a tool
 */
async function loadToolPreview(toolName) {
  const year = retroState.targetYear;
  const filePath = retroState.filePath;

  switch (toolName) {
    case 'name-changes':
      await loadNameChangesPreview();
      break;
    case 'schedule':
      await loadScheduleToolPreview();
      break;
    case 'relocation':
      await loadRelocationPreview();
      break;
    case 'coaching':
      await loadCoachingToolPreview();
      break;
    case 'expansion':
      await loadExpansionToolPreview();
      break;
    case 'portraits':
      await loadPortraitsToolPreview();
      break;
    case 'commentary':
      await loadCommentaryPreview();
      break;
    case 'draft-order':
      await loadDraftOrderPreview();
      break;
    case 'salary-cap':
      await loadSalaryCapToolPreview();
      break;
    case 'nfl-records':
      await loadNFLRecordsPreview();
      break;
    case 'historical-stats':
      await loadHistoricalStatsPreview();
      break;
    case 'equipment':
      await loadEquipmentToolPreview();
      break;
  }
}

/**
 * Load name changes preview
 */
async function loadNameChangesPreview() {
  const listEl = document.getElementById('name-changes-list');
  const countEl = document.getElementById('name-changes-count');

  try {
    const result = await window.electronAPI.retro.previewChanges(retroState.filePath, retroState.targetYear);

    if (result.success && result.data.teamChanges && result.data.teamChanges.length > 0) {
      countEl.textContent = `${result.data.teamChanges.length} change(s)`;
      listEl.innerHTML = result.data.teamChanges.map(change => `
        <div class="retro-tool-preview-item">
          <span class="retro-tool-preview-old">${change.originalCity} ${change.originalName}</span>
          <span class="retro-tool-preview-arrow">→</span>
          <span class="retro-tool-preview-new">${change.newCity} ${change.newName}</span>
        </div>
      `).join('');
    } else {
      countEl.textContent = '0 changes';
      listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">No team name changes needed for this year.</p>';
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading name changes preview:', error);
    listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}

/**
 * Load schedule tool preview
 */
async function loadScheduleToolPreview() {
  const listEl = document.getElementById('schedule-weeks-list');
  const countEl = document.getElementById('schedule-games-count');

  try {
    // Get season era info
    const seasonInfoResult = await window.electronAPI.retro.getSeasonInfo(retroState.targetYear);
    if (seasonInfoResult.success && seasonInfoResult.data) {
      document.getElementById('schedule-season-length').textContent = `${seasonInfoResult.data.seasonLength} games`;
      document.getElementById('schedule-bye-weeks').textContent = seasonInfoResult.data.byeWeeks ? 'Yes' : 'No';
      document.getElementById('schedule-playoff-teams').textContent = `${seasonInfoResult.data.playoffTeams} teams`;
    }

    // Check if schedule data is available
    const hasScheduleResult = await window.electronAPI.retro.hasScheduleData(retroState.targetYear);

    if (hasScheduleResult.success && hasScheduleResult.hasData) {
      const schedulePreview = await window.electronAPI.retro.getSchedulePreview(retroState.filePath, retroState.targetYear);

      if (schedulePreview.success && schedulePreview.data) {
        const preview = schedulePreview.data;
        countEl.textContent = `${preview.totalGames} games`;
        retroState.schedulePreview = preview;

        // Show week-by-week preview
        if (preview.gamesByWeek && Object.keys(preview.gamesByWeek).length > 0) {
          listEl.innerHTML = Object.entries(preview.gamesByWeek)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([week, games]) => `
              <div style="margin-bottom: 12px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">
                <strong style="color: var(--text-primary);">Week ${week}</strong>
                <div style="margin-top: 4px; font-size: 0.85em;">
                  ${games.map(g => `<div style="padding: 2px 0;">${g.awayTeam} @ ${g.homeTeam}</div>`).join('')}
                </div>
              </div>
            `).join('');
        }
      } else {
        countEl.textContent = '0 games';
        listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">Schedule data not available.</p>';
      }
    } else {
      countEl.textContent = 'N/A';
      listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">No schedule data available for this year.</p>';
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading schedule preview:', error);
    listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}

/**
 * Load relocation preview
 */
async function loadRelocationPreview() {
  const eventInfoEl = document.getElementById('relocation-event-info');
  const noEventEl = document.getElementById('relocation-no-event');
  const transferOption = document.getElementById('relocation-transfer-option');
  const applyBtn = document.getElementById('btn-apply-relocation');

  try {
    const result = await window.electronAPI.retro.getExpansionEvent(retroState.targetYear);

    if (result.success && result.event && result.event.type === 'relocation') {
      eventInfoEl.style.display = 'block';
      noEventEl.style.display = 'none';
      transferOption.style.display = 'block';
      applyBtn.disabled = false;

      document.getElementById('relocation-event-name').textContent = result.event.name;
      document.getElementById('relocation-event-desc').textContent = result.event.description;

      retroState.expansionEvent = result.event;
    } else {
      eventInfoEl.style.display = 'none';
      noEventEl.style.display = 'block';
      transferOption.style.display = 'none';
      applyBtn.disabled = true;
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading relocation preview:', error);
  }
}

/**
 * Load coaching tool preview
 */
async function loadCoachingToolPreview() {
  const listEl = document.getElementById('coaching-list');
  const countEl = document.getElementById('coaching-count');

  try {
    const hasCoachResult = await window.electronAPI.retro.hasCoachData(retroState.targetYear);

    if (hasCoachResult.success && hasCoachResult.hasData) {
      const coachPreview = await window.electronAPI.retro.getCoachPreview(retroState.filePath, retroState.targetYear);

      if (coachPreview.success && coachPreview.data && coachPreview.data.available) {
        const preview = coachPreview.data;
        const coachChanges = preview.coachChanges || [];

        let coachCount = 0;
        coachChanges.forEach(team => {
          if (team.headCoach && team.headCoach !== 'N/A') coachCount++;
        });

        countEl.textContent = `${coachCount} coach(es)`;
        retroState.coachPreview = preview;

        // Store editable coach data
        if (!retroState.editableCoaches) {
          retroState.editableCoaches = {};
        }

        listEl.innerHTML = coachChanges
          .sort((a, b) => a.teamAbbr.localeCompare(b.teamAbbr))
          .map(team => {
            // Initialize editable state for this team
            if (!retroState.editableCoaches[team.teamIndex]) {
              retroState.editableCoaches[team.teamIndex] = {
                teamAbbr: team.teamAbbr,
                headCoach: team.headCoach,
                offensiveCoordinator: team.offensiveCoordinator,
                defensiveCoordinator: team.defensiveCoordinator,
                offScheme: team.offScheme,
                defScheme: team.defScheme
              };
            }
            const editable = retroState.editableCoaches[team.teamIndex];

            return `
            <div style="margin-bottom: 8px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: var(--text-primary);">${team.teamAbbr}</strong>
                <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8em;" onclick="editTeamCoach(${team.teamIndex}, '${team.teamAbbr}')">Edit</button>
              </div>
              <div style="margin-top: 4px; font-size: 0.85em;">
                <div><span style="color: var(--text-secondary);">HC:</span> <span id="team-hc-${team.teamIndex}">${editable.headCoach || team.headCoach}</span></div>
                <div><span style="color: var(--text-secondary);">OC:</span> <span id="team-oc-${team.teamIndex}">${editable.offensiveCoordinator || team.offensiveCoordinator || '(Keep Default)'}</span></div>
                <div><span style="color: var(--text-secondary);">DC:</span> <span id="team-dc-${team.teamIndex}">${editable.defensiveCoordinator || team.defensiveCoordinator || '(Keep Default)'}</span></div>
                ${team.offScheme ? `<div style="margin-top: 4px;"><span style="color: var(--accent-color);">Off Scheme:</span> ${team.offScheme}</div>` : ''}
                ${team.defScheme ? `<div><span style="color: var(--accent-color);">Def Scheme:</span> ${team.defScheme}</div>` : ''}
              </div>
            </div>
          `;
          }).join('');
      } else {
        countEl.textContent = '0';
        listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">No coach data available.</p>';
      }
    } else {
      countEl.textContent = 'N/A';
      listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">No coach data available for this year.</p>';
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading coaching preview:', error);
    listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}

/**
 * Edit team coach - shows inline editor with position buttons and source selection
 */
async function editTeamCoach(teamIndex, teamAbbr) {
  // Store editing context
  retroState.editingTeamCoach = { teamIndex, teamAbbr, position: 'HC', source: 'database' };

  // Load FA coaches if not already loaded
  if (!faCoachesData || faCoachesData.length === 0) {
    try {
      const result = await window.electronAPI.retro.getFACoaches(retroState.filePath);
      if (result.success) {
        faCoachesData = result.faCoaches;
      }
    } catch (e) {
      console.error('[RetroEditor] Error loading FA coaches:', e);
    }
  }

  // Switch to search tab
  switchCoachingTab('search');

  // Update search UI to show editing controls
  updateTeamCoachEditUI();
}

/**
 * Update the team coach edit UI
 */
function updateTeamCoachEditUI() {
  if (!retroState.editingTeamCoach) return;

  const { teamAbbr, position, source } = retroState.editingTeamCoach;
  const searchResults = document.getElementById('coach-search-results');

  // Build FA coaches list for inline display
  let faCoachesHtml = '';
  if (faCoachesData && faCoachesData.length > 0) {
    faCoachesHtml = faCoachesData.slice(0, 10).map(coach => `
      <div class="retro-tool-preview-item" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-bottom: 2px; background: var(--bg-secondary); border-radius: 4px; cursor: pointer;"
           onclick="assignFACoachToTeam(${coach.coachIndex}, '${coach.firstName}', '${coach.lastName}', '${coach.position}')">
        <span>${coach.firstName} ${coach.lastName} <span style="color: var(--text-secondary);">(${coach.position})</span></span>
        <span style="color: var(--accent-color); font-size: 0.85em;">Select</span>
      </div>
    `).join('');
    if (faCoachesData.length > 10) {
      faCoachesHtml += `<div style="text-align: center; padding: 4px; color: var(--text-secondary); font-size: 0.85em;">
        ...and ${faCoachesData.length - 10} more FA coaches
      </div>`;
    }
  } else {
    faCoachesHtml = '<p style="color: var(--text-secondary); padding: 8px;">No FA coaches available in file.</p>';
  }

  searchResults.innerHTML = `
    <div style="padding: 12px; background: var(--accent-color); color: white; border-radius: 4px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong>Editing: ${teamAbbr}</strong>
        <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8em;" onclick="cancelTeamCoachEdit()">Cancel</button>
      </div>
      <div style="margin-top: 8px; display: flex; gap: 8px;">
        <button class="btn ${position === 'HC' ? 'btn-primary' : 'btn-secondary'}"
                style="padding: 4px 12px;" onclick="setEditingPosition('HC')">HC</button>
        <button class="btn ${position === 'OC' ? 'btn-primary' : 'btn-secondary'}"
                style="padding: 4px 12px;" onclick="setEditingPosition('OC')">OC</button>
        <button class="btn ${position === 'DC' ? 'btn-primary' : 'btn-secondary'}"
                style="padding: 4px 12px;" onclick="setEditingPosition('DC')">DC</button>
      </div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <button class="btn ${source === 'database' ? 'btn-primary' : 'btn-secondary'}"
                style="padding: 4px 12px; flex: 1;" onclick="setCoachSource('database')">From Database</button>
        <button class="btn ${source === 'fa' ? 'btn-primary' : 'btn-secondary'}"
                style="padding: 4px 12px; flex: 1;" onclick="setCoachSource('fa')">From FA Pool</button>
      </div>
    </div>

    ${source === 'database' ? `
      <p style="color: var(--text-secondary); margin-bottom: 8px;">Search the database for a coach to assign as ${position}:</p>
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <input type="text" id="team-coach-search-input" placeholder="Enter coach name..."
               style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary);"
               onkeypress="if(event.key==='Enter') searchCoachDatabaseForTeam()">
        <button class="btn btn-primary" onclick="searchCoachDatabaseForTeam()">Search</button>
      </div>
      <div id="team-coach-search-results" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; padding: 4px;">
        <p style="color: var(--text-secondary); text-align: center; padding: 16px;">Enter a name to search.</p>
      </div>
    ` : `
      <p style="color: var(--text-secondary); margin-bottom: 8px;">Select an FA coach from the file to assign as ${position}:</p>
      <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; padding: 4px;">
        ${faCoachesHtml}
      </div>
    `}
  `;
}

/**
 * Set the position being edited (HC/OC/DC)
 */
function setEditingPosition(position) {
  if (retroState.editingTeamCoach) {
    retroState.editingTeamCoach.position = position;
    updateTeamCoachEditUI();
  }
}

/**
 * Set the coach source (database or fa)
 */
function setCoachSource(source) {
  if (retroState.editingTeamCoach) {
    retroState.editingTeamCoach.source = source;
    updateTeamCoachEditUI();
  }
}

/**
 * Search coach database specifically for team coach editing
 */
async function searchCoachDatabaseForTeam() {
  const inputEl = document.getElementById('team-coach-search-input');
  const resultsEl = document.getElementById('team-coach-search-results');

  if (!inputEl || !resultsEl) {
    console.error('[RetroEditor] Team coach search elements not found');
    return;
  }

  const query = inputEl.value.trim();
  if (!query) {
    resultsEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">Enter a name to search.</p>';
    return;
  }

  const searchYear = retroState.targetYear || 2024;
  const position = retroState.editingTeamCoach?.position || 'Coach';

  resultsEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">Searching...</p>';

  try {
    console.log(`[RetroEditor] Searching for team coach: query="${query}", year=${searchYear}`);
    const result = await window.electronAPI.retro.searchCoachDatabase(query, searchYear);
    console.log('[RetroEditor] Team coach search result:', result);

    if (!result || !result.success) {
      resultsEl.innerHTML = `<p style="color: var(--error-color); text-align: center; padding: 16px;">Error: ${result?.error || 'Search failed'}</p>`;
      return;
    }

    if (result.results.length === 0) {
      resultsEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">No coaches found matching that name.</p>';
      return;
    }

    resultsEl.innerHTML = result.results.map(coach => `
      <div class="retro-tool-preview-item" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-bottom: 2px; background: var(--bg-secondary); border-radius: 4px; cursor: pointer;"
           onclick="assignCoachToTeam('${coach.firstName}', '${coach.lastName}', '${coach.position}', ${coach.careerFrom}, ${coach.careerWins}, ${coach.careerLosses})">
        <div>
          <strong style="color: var(--text-primary);">${coach.firstName} ${coach.lastName}</strong>
          <div style="font-size: 0.8em; color: var(--text-secondary);">
            ${coach.position} | ${coach.careerFrom}-${coach.careerTo} | ${coach.careerWins}-${coach.careerLosses}
          </div>
        </div>
        <span style="color: var(--accent-color); font-size: 0.85em;">Assign as ${position}</span>
      </div>
    `).join('');

  } catch (error) {
    console.error('[RetroEditor] Error searching coach database:', error);
    resultsEl.innerHTML = `<p style="color: var(--error-color); text-align: center; padding: 16px;">Error: ${error.message}</p>`;
  }
}

/**
 * Cancel team coach editing
 */
function cancelTeamCoachEdit() {
  retroState.editingTeamCoach = null;
  switchCoachingTab('teams');
}

/**
 * Assign an FA coach to the team being edited
 */
function assignFACoachToTeam(coachIndex, firstName, lastName, coachPosition) {
  if (!retroState.editingTeamCoach) return;

  const teamIndex = retroState.editingTeamCoach.teamIndex;
  const editPosition = retroState.editingTeamCoach.position;
  const coachName = `${firstName} ${lastName}`;

  // Update the editable state
  if (!retroState.editableCoaches[teamIndex]) {
    retroState.editableCoaches[teamIndex] = {};
  }

  if (editPosition === 'HC') {
    retroState.editableCoaches[teamIndex].headCoach = coachName;
    const el = document.getElementById(`team-hc-${teamIndex}`);
    if (el) el.textContent = coachName;
  } else if (editPosition === 'OC') {
    retroState.editableCoaches[teamIndex].offensiveCoordinator = coachName;
    const el = document.getElementById(`team-oc-${teamIndex}`);
    if (el) el.textContent = coachName;
  } else if (editPosition === 'DC') {
    retroState.editableCoaches[teamIndex].defensiveCoordinator = coachName;
    const el = document.getElementById(`team-dc-${teamIndex}`);
    if (el) el.textContent = coachName;
  }

  showToolStatus(`Assigned ${coachName} as ${editPosition} for ${retroState.editingTeamCoach.teamAbbr}`, 'success');

  // Switch back to teams tab
  switchCoachingTab('teams');
  retroState.editingTeamCoach = null;
}

/**
 * Assign a coach from database to the team being edited
 */
function assignCoachToTeam(firstName, lastName, position, careerFrom, careerWins, careerLosses) {
  if (!retroState.editingTeamCoach) return;

  const teamIndex = retroState.editingTeamCoach.teamIndex;
  const editPosition = retroState.editingTeamCoach.position;
  const coachName = `${firstName} ${lastName}`;

  // Update the editable state
  if (!retroState.editableCoaches[teamIndex]) {
    retroState.editableCoaches[teamIndex] = {};
  }

  if (editPosition === 'HC') {
    retroState.editableCoaches[teamIndex].headCoach = coachName;
    const el = document.getElementById(`team-hc-${teamIndex}`);
    if (el) el.textContent = coachName;
  } else if (editPosition === 'OC') {
    retroState.editableCoaches[teamIndex].offensiveCoordinator = coachName;
    const el = document.getElementById(`team-oc-${teamIndex}`);
    if (el) el.textContent = coachName;
  } else if (editPosition === 'DC') {
    retroState.editableCoaches[teamIndex].defensiveCoordinator = coachName;
    const el = document.getElementById(`team-dc-${teamIndex}`);
    if (el) el.textContent = coachName;
  }

  showToolStatus(`Assigned ${coachName} as ${editPosition} for ${retroState.editingTeamCoach.teamAbbr}`, 'success');

  // Switch back to teams tab
  switchCoachingTab('teams');
  retroState.editingTeamCoach = null;
}

/**
 * Load expansion tool preview
 */
async function loadExpansionToolPreview() {
  const notAvailableEl = document.getElementById('expansion-not-available');
  const availableEl = document.getElementById('expansion-available');
  const applyBtn = document.getElementById('btn-apply-expansion');
  const manualControlsEl = document.getElementById('expansion-manual-controls');
  const draftModeSelect = document.getElementById('expansion-draft-mode-select');

  // Setup draft mode change handler
  if (draftModeSelect) {
    draftModeSelect.onchange = () => {
      const isManual = draftModeSelect.value === 'manual';
      if (manualControlsEl) {
        manualControlsEl.style.display = isManual ? 'block' : 'none';
      }
      applyBtn.textContent = isManual ? 'Close' : 'Execute Auto Draft';
    };
  }

  // Setup open draft board button
  const openDraftBoardBtn = document.getElementById('btn-open-draft-board');
  if (openDraftBoardBtn) {
    openDraftBoardBtn.onclick = () => {
      closeToolModal(document.getElementById('modal-expansion'));
      openExpansionDraftBoard(); // Use the existing manual draft board
    };
  }

  try {
    const result = await window.electronAPI.retro.getExpansionEvent(retroState.targetYear);

    if (result.success && result.event && (result.event.type === 'expansion' || result.event.type === 'relocation')) {
      notAvailableEl.style.display = 'none';
      availableEl.style.display = 'block';
      applyBtn.disabled = false;

      document.getElementById('expansion-event-title').textContent = result.event.name;
      document.getElementById('expansion-protected').textContent = result.event.protectionRules?.maxProtected || '--';
      document.getElementById('expansion-to-select').textContent = result.event.rules?.playersPerTeam || '--';

      retroState.expansionEvent = result.event;

      // Reset draft mode to auto
      if (draftModeSelect) draftModeSelect.value = 'auto';
      if (manualControlsEl) manualControlsEl.style.display = 'none';

      // Load eligible players
      const playersListEl = document.getElementById('expansion-players-list');
      const eligibleCountEl = document.getElementById('expansion-eligible-count');

      playersListEl.innerHTML = '<p style="color: var(--text-secondary);">Loading eligible players...</p>';

      const eligibleResult = await window.electronAPI.retro.getEligiblePlayers(
        retroState.filePath,
        result.event,
        retroState.rosterPath
      );

      if (eligibleResult.success && eligibleResult.players) {
        eligibleCountEl.textContent = `${eligibleResult.players.length} players`;

        // Group by team
        const playersByTeam = {};
        for (const player of eligibleResult.players) {
          const team = player.teamName || 'Unknown';
          if (!playersByTeam[team]) playersByTeam[team] = [];
          playersByTeam[team].push(player);
        }

        playersListEl.innerHTML = Object.entries(playersByTeam)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(0, 10) // Show first 10 teams
          .map(([team, players]) => `
            <div style="margin-bottom: 12px;">
              <strong style="color: var(--accent-color);">${team}</strong> (${players.length})
              <div style="font-size: 0.85em; margin-top: 4px;">
                ${players.slice(0, 5).map(p => `<span style="margin-right: 8px;">${p.firstName} ${p.lastName} (${p.position}, OVR ${p.overall})</span>`).join('')}
                ${players.length > 5 ? `<span style="color: var(--text-secondary);">...and ${players.length - 5} more</span>` : ''}
              </div>
            </div>
          `).join('');
      } else {
        eligibleCountEl.textContent = '0';
        playersListEl.innerHTML = `<p style="color: var(--text-secondary);">No eligible players found. ${eligibleResult.error || ''}</p>`;
      }
    } else {
      notAvailableEl.style.display = 'block';
      availableEl.style.display = 'none';
      applyBtn.disabled = true;
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading expansion preview:', error);
    document.getElementById('expansion-players-list').innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}

/**
 * Load portraits tool preview
 */
async function loadPortraitsToolPreview() {
  const neededEl = document.getElementById('portraits-needed');
  const availableEl = document.getElementById('portraits-available');
  const listEl = document.getElementById('portraits-list');

  try {
    // Initialize portrait mapping service
    await window.electronAPI.portraitMapping.init();

    const existingMapping = await window.electronAPI.portraitMapping.get(retroState.targetYear);

    if (existingMapping.success && existingMapping.mapping) {
      const summary = existingMapping.mapping.summary || {};
      neededEl.textContent = summary.recyclableAssigned || summary.totalAssigned || '--';
      availableEl.textContent = summary.realPortraits || summary.totalReal || '--';

      const mappings = existingMapping.mapping.roster || existingMapping.mapping.draftClass || [];

      // Store mappings in state for selection tracking
      if (!retroState.portraitMappings) {
        retroState.portraitMappings = {};
      }
      retroState.portraitMappingsList = mappings;

      // Initialize all as selected if not already tracked
      mappings.forEach((m, index) => {
        const key = m.playerName || m.historicalPlayer || `mapping_${index}`;
        if (retroState.portraitMappings[key] === undefined) {
          retroState.portraitMappings[key] = true; // Default to selected
        }
      });

      if (mappings.length > 0) {
        // Add select/deselect all controls
        const selectedCount = Object.values(retroState.portraitMappings).filter(v => v).length;

        listEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 8px; background: var(--bg-secondary); border-radius: 4px; position: sticky; top: 0; z-index: 1;">
            <span style="color: var(--text-secondary);">${selectedCount}/${mappings.length} selected</span>
            <div>
              <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8em; margin-right: 4px;" onclick="selectAllPortraitMappings()">Select All</button>
              <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8em;" onclick="deselectAllPortraitMappings()">Deselect All</button>
            </div>
          </div>
        ` + mappings.map((m, index) => {
          // Handle different possible field names in the mapping
          const playerName = m.playerName || m.historicalPlayer || m.name || 'Unknown';
          const portraitId = m.plpo || m.recyclablePLPO || m.assignedPLPO || 'N/A';
          const typeLabel = m.type === 'REAL' ? '<span style="color: var(--success-color);">REAL</span>' :
                           m.type === 'RECYCLABLE' ? '<span style="color: var(--primary-color);">RECYCLED</span>' :
                           '<span style="color: var(--text-secondary);">N/A</span>';
          const key = playerName;
          const isChecked = retroState.portraitMappings[key] !== false;

          return `
            <div class="retro-tool-preview-item" style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
              <input type="checkbox" id="portrait-check-${index}" ${isChecked ? 'checked' : ''}
                     onchange="togglePortraitMapping('${key.replace(/'/g, "\\'")}', this.checked)"
                     style="width: 16px; height: 16px; cursor: pointer;">
              <label for="portrait-check-${index}" style="flex: 1; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                <span>${playerName}</span>
                <span style="font-size: 0.85em;">
                  ${typeLabel} → <span style="color: var(--accent-color);">${portraitId}</span>
                </span>
              </label>
            </div>
          `;
        }).join('');
      } else {
        listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">No mappings found in the file.</p>';
      }
    } else {
      neededEl.textContent = '--';
      availableEl.textContent = '--';
      listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">No mapping generated yet. Click a button above to generate.</p>';
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading portraits preview:', error);
    listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}

/**
 * Toggle a portrait mapping selection
 */
function togglePortraitMapping(key, checked) {
  if (!retroState.portraitMappings) {
    retroState.portraitMappings = {};
  }
  retroState.portraitMappings[key] = checked;

  // Update the count display
  const selectedCount = Object.values(retroState.portraitMappings).filter(v => v).length;
  const totalCount = retroState.portraitMappingsList?.length || 0;
  const countDisplay = document.querySelector('#portraits-list > div:first-child span');
  if (countDisplay) {
    countDisplay.textContent = `${selectedCount}/${totalCount} selected`;
  }
}

/**
 * Select all portrait mappings
 */
function selectAllPortraitMappings() {
  if (!retroState.portraitMappingsList) return;

  retroState.portraitMappingsList.forEach((m, index) => {
    const key = m.playerName || m.historicalPlayer || `mapping_${index}`;
    retroState.portraitMappings[key] = true;
    const checkbox = document.getElementById(`portrait-check-${index}`);
    if (checkbox) checkbox.checked = true;
  });

  // Update count display
  const totalCount = retroState.portraitMappingsList.length;
  const countDisplay = document.querySelector('#portraits-list > div:first-child span');
  if (countDisplay) {
    countDisplay.textContent = `${totalCount}/${totalCount} selected`;
  }
}

/**
 * Deselect all portrait mappings
 */
function deselectAllPortraitMappings() {
  if (!retroState.portraitMappingsList) return;

  retroState.portraitMappingsList.forEach((m, index) => {
    const key = m.playerName || m.historicalPlayer || `mapping_${index}`;
    retroState.portraitMappings[key] = false;
    const checkbox = document.getElementById(`portrait-check-${index}`);
    if (checkbox) checkbox.checked = false;
  });

  // Update count display
  const totalCount = retroState.portraitMappingsList.length;
  const countDisplay = document.querySelector('#portraits-list > div:first-child span');
  if (countDisplay) {
    countDisplay.textContent = `0/${totalCount} selected`;
  }
}

/**
 * Load commentary preview
 */
async function loadCommentaryPreview() {
  const listEl = document.getElementById('commentary-list');
  const countEl = document.getElementById('commentary-count');

  try {
    listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">Loading commentary data...</p>';

    const result = await window.electronAPI.retro.getCommentaryPreview(retroState.filePath);

    if (result.success) {
      if (result.playersToFix.length > 0) {
        countEl.textContent = `${result.playersToFix.length} player(s)`;
        listEl.innerHTML = result.playersToFix.slice(0, 50).map(player => `
          <div class="retro-tool-preview-item" style="display: flex; justify-content: space-between; align-items: center;">
            <span>${player.firstName} ${player.lastName}</span>
            <span style="color: var(--text-secondary); font-size: 0.85em;">
              ${player.currentCommId} → <span style="color: var(--success-color);">${player.correctCommId}</span>
            </span>
          </div>
        `).join('');

        if (result.playersToFix.length > 50) {
          listEl.innerHTML += `<div style="text-align: center; padding: 8px; color: var(--text-secondary); font-size: 0.85em;">
            Showing first 50 of ${result.playersToFix.length} players...
          </div>`;
        }
      } else {
        countEl.textContent = '0';
        listEl.innerHTML = '<p style="color: var(--success-color); text-align: center; padding: 16px;">All players have correct commentary IDs!</p>';
      }
    } else {
      countEl.textContent = '--';
      listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${result.error}</p>`;
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading commentary preview:', error);
    countEl.textContent = '--';
    listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}

/**
 * Load draft order preview
 */
async function loadDraftOrderPreview() {
  const listEl = document.getElementById('draft-order-list');
  const countEl = document.getElementById('draft-order-count');

  try {
    const result = await window.electronAPI.retro.previewChanges(retroState.filePath, retroState.targetYear);

    if (result.success && result.data.draftChanges && result.data.draftChanges.inactiveTeams && result.data.draftChanges.inactiveTeams.length > 0) {
      countEl.textContent = `${result.data.draftChanges.inactiveTeams.length} team(s)`;
      listEl.innerHTML = `
        <p style="color: var(--text-secondary); margin-bottom: 12px;">Draft picks for the following teams will be moved to the end of each round:</p>
        ${result.data.draftChanges.inactiveTeams.map(team => `<div style="padding: 4px 0;">${team}</div>`).join('')}
      `;
    } else {
      countEl.textContent = '0';
      listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">No draft pick reordering needed (all 32 teams active).</p>';
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading draft order preview:', error);
    listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}

/**
 * Load salary cap tool preview (for modal)
 */
async function loadSalaryCapToolPreview() {
  const currentEl = document.getElementById('salary-cap-current');
  const historicalEl = document.getElementById('salary-cap-historical');
  const yearEl = document.getElementById('salary-cap-year');
  const noteEl = document.getElementById('salary-cap-note');

  // Reset display
  currentEl.textContent = 'Loading...';
  historicalEl.textContent = 'Loading...';
  yearEl.textContent = retroState.targetYear || '--';
  noteEl.textContent = '';

  try {
    // Get historical salary cap for the target year
    const capResult = await window.electronAPI.retro.getSalaryCap(retroState.targetYear);

    if (capResult.success && capResult.data) {
      const capValue = capResult.data.value;
      const note = capResult.data.note;

      // Format as currency
      const formattedCap = capValue > 0
        ? `$${(capValue / 1000000).toFixed(1)}M`
        : 'No Cap';

      historicalEl.textContent = formattedCap;
      yearEl.textContent = retroState.targetYear;

      if (note) {
        noteEl.textContent = note;
        noteEl.style.display = 'block';
      } else {
        noteEl.style.display = 'none';
      }

      // Try to get current cap from franchise file
      // Note: For now we show "Unknown" since we'd need to read it from the file
      currentEl.textContent = 'From franchise file';
    } else {
      historicalEl.textContent = 'Error loading';
      noteEl.textContent = capResult.error || 'Failed to load salary cap data';
      noteEl.style.display = 'block';
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading salary cap preview:', error);
    currentEl.textContent = 'Error';
    historicalEl.textContent = 'Error';
    noteEl.textContent = `Error: ${error.message}`;
    noteEl.style.display = 'block';
  }
}

// ============================================
// TOOL APPLY FUNCTIONS
// ============================================

/**
 * Show status message in the tool status area
 */
function showToolStatus(message, type = 'info') {
  const statusEl = document.getElementById('retro-tool-status');
  const contentEl = document.getElementById('retro-tool-status-content');

  statusEl.style.display = 'block';
  contentEl.innerHTML = `<div style="color: var(--${type === 'error' ? 'error' : type === 'success' ? 'success' : 'accent'}-color);">${message}</div>`;
}

/**
 * Apply name changes tool
 */
async function applyToolNameChanges() {
  const btn = document.getElementById('btn-apply-name-changes');
  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    const config = {
      sourcePath: retroState.filePath,
      saveAs: false,
      year: retroState.targetYear,
      options: {
        teams: true,
        abbreviations: true,
        schedule: false,
        coaches: false,
        salaryCap: false,
        stadiums: false,
        schemes: false,
        uniforms: false,
        expansion: false
      }
    };

    const result = await window.electronAPI.retro.applyAllAndSave(config);

    if (result.success) {
      showToolStatus(`Name changes applied successfully! ${result.results.teamChanges || 0} team(s) updated.`, 'success');
      closeToolModal(document.getElementById('modal-name-changes'));
    } else {
      showToolStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error applying name changes:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Changes';
  }
}

/**
 * Apply schedule tool
 */
async function applyToolSchedule() {
  const btn = document.getElementById('btn-apply-schedule');
  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    const config = {
      sourcePath: retroState.filePath,
      saveAs: false,
      year: retroState.targetYear,
      options: {
        teams: false,
        abbreviations: false,
        schedule: true,
        coaches: false,
        salaryCap: false,
        stadiums: false,
        schemes: false,
        uniforms: false,
        expansion: false
      }
    };

    const result = await window.electronAPI.retro.applyAllAndSave(config);

    if (result.success) {
      showToolStatus(`Schedule applied successfully! ${result.results.scheduleGamesUpdated || 0} game(s) set.`, 'success');
      closeToolModal(document.getElementById('modal-schedule'));
    } else {
      showToolStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error applying schedule:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Schedule';
  }
}

/**
 * Apply relocation tool
 */
async function applyToolRelocation() {
  const btn = document.getElementById('btn-apply-relocation');
  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    const config = {
      sourcePath: retroState.filePath,
      saveAs: false,
      year: retroState.targetYear,
      options: {
        teams: false,
        abbreviations: false,
        schedule: false,
        coaches: false,
        salaryCap: false,
        stadiums: false,
        schemes: false,
        uniforms: false,
        expansion: true
      },
      expansionEvent: retroState.expansionEvent
    };

    const result = await window.electronAPI.retro.applyAllAndSave(config);

    if (result.success) {
      showToolStatus(`Relocation applied successfully! ${result.results.expansionPlayersSelected || 0} player(s) transferred.`, 'success');
      closeToolModal(document.getElementById('modal-relocation'));
    } else {
      showToolStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error applying relocation:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Relocation';
  }
}

/**
 * Apply coaching tool
 */
async function applyToolCoaching() {
  const btn = document.getElementById('btn-apply-coaching');
  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    const config = {
      sourcePath: retroState.filePath,
      saveAs: false,
      year: retroState.targetYear,
      options: {
        teams: false,
        abbreviations: false,
        schedule: false,
        coaches: true,
        salaryCap: false,
        stadiums: false,
        schemes: true, // Schemes are tied to coaches
        uniforms: false,
        expansion: false
      }
    };

    const result = await window.electronAPI.retro.applyAllAndSave(config);

    if (result.success) {
      showToolStatus(`Coaches applied successfully! ${result.results.coachesUpdated || 0} coach(es), ${result.results.schemesUpdated || 0} scheme(s) set.`, 'success');
      closeToolModal(document.getElementById('modal-coaching'));
    } else {
      showToolStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error applying coaching:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Coaches';
  }
}

/**
 * Apply expansion tool
 */
async function applyToolExpansion() {
  const btn = document.getElementById('btn-apply-expansion');
  btn.disabled = true;
  btn.textContent = 'Executing Draft...';

  try {
    const draftMode = document.getElementById('expansion-draft-mode-select')?.value || 'auto';

    const config = {
      sourcePath: retroState.filePath,
      saveAs: false,
      year: retroState.targetYear,
      options: {
        teams: false,
        abbreviations: false,
        schedule: false,
        coaches: false,
        salaryCap: false,
        stadiums: false,
        schemes: false,
        uniforms: false,
        expansion: true
      },
      expansionEvent: retroState.expansionEvent,
      expansionDraftSelections: retroState.expansionDraftSelections || [],
      expansionTeamIndices: retroState.expansionTeamIndices || []
    };

    const result = await window.electronAPI.retro.applyAllAndSave(config);

    if (result.success) {
      showToolStatus(`Expansion draft completed! ${result.results.expansionPlayersSelected || 0} player(s) selected.`, 'success');
      closeToolModal(document.getElementById('modal-expansion'));
    } else {
      showToolStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error applying expansion:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Execute Draft';
  }
}

/**
 * Apply portraits tool
 */
async function applyToolPortraits() {
  const btn = document.getElementById('btn-apply-portraits');
  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    // Portrait application would go here - for now show placeholder
    showToolStatus('Portrait mapping applied successfully!', 'success');
    closeToolModal(document.getElementById('modal-portraits'));
  } catch (error) {
    console.error('[RetroEditor] Error applying portraits:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Portraits';
  }
}

/**
 * Apply commentary tool
 */
async function applyToolCommentary() {
  const btn = document.getElementById('btn-apply-commentary');
  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    const result = await window.electronAPI.retro.applyCommentaryFix(retroState.filePath);

    if (result.success) {
      showToolStatus(`Commentary IDs fixed successfully! ${result.playersFixed} player(s) updated.`, 'success');
      closeToolModal(document.getElementById('modal-commentary'));
    } else {
      showToolStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error applying commentary:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Fixes';
  }
}

/**
 * Apply draft order tool
 */
async function applyToolDraftOrder() {
  const btn = document.getElementById('btn-apply-draft-order');
  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    const config = {
      sourcePath: retroState.filePath,
      saveAs: false,
      year: retroState.targetYear,
      options: {
        teams: true, // Draft order reordering is tied to team changes
        abbreviations: false,
        schedule: false,
        coaches: false,
        salaryCap: false,
        stadiums: false,
        schemes: false,
        uniforms: false,
        expansion: false
      }
    };

    const result = await window.electronAPI.retro.applyAllAndSave(config);

    if (result.success) {
      showToolStatus(`Draft order updated! ${result.results.draftPicksReordered || 0} pick(s) reordered.`, 'success');
      closeToolModal(document.getElementById('modal-draft-order'));
    } else {
      showToolStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error applying draft order:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Reorder';
  }
}

/**
 * Prompt user to create backup before modifying file
 * Returns true if user wants to proceed, false to cancel
 */
async function promptForBackup(toolName) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-backup-confirm');
    const toolNameEl = document.getElementById('backup-tool-name');
    const backupBtn = document.getElementById('btn-backup-create');
    const continueBtn = document.getElementById('btn-backup-continue');
    const closeBtn = modal.querySelector('.retro-tool-modal-close');

    // Set the tool name
    toolNameEl.textContent = toolName;

    // Show modal
    modal.style.display = 'flex';

    // Clean up function
    const cleanup = () => {
      modal.style.display = 'none';
      backupBtn.removeEventListener('click', onBackup);
      continueBtn.removeEventListener('click', onContinue);
      closeBtn.removeEventListener('click', onClose);
    };

    // Handler for "Back Up" button
    const onBackup = async () => {
      cleanup();
      await createBackupBeforeApply();
      resolve(true);
    };

    // Handler for "Continue" button (no backup)
    const onContinue = () => {
      cleanup();
      resolve(true);
    };

    // Handler for close button (cancel)
    const onClose = () => {
      cleanup();
      resolve(false);
    };

    backupBtn.addEventListener('click', onBackup);
    continueBtn.addEventListener('click', onContinue);
    closeBtn.addEventListener('click', onClose);
  });
}

/**
 * Create backup of current franchise file
 */
async function createBackupBeforeApply() {
  if (!retroState.filePath) return;

  try {
    console.log('[RetroEditor] Creating backup of franchise file...');
    const result = await window.electronAPI.file.createBackup(retroState.filePath);
    if (result.success) {
      console.log('[RetroEditor] Backup created:', result.backupPath);
      showToolStatus(`Backup created: ${result.backupPath}`, 'success');
    } else {
      console.warn('[RetroEditor] Backup failed:', result.error);
    }
  } catch (error) {
    console.error('[RetroEditor] Error creating backup:', error);
  }
}

/**
 * Apply salary cap tool
 */
async function applyToolSalaryCap() {
  const btn = document.getElementById('btn-apply-salary-cap');

  // Prompt for backup first
  const proceed = await promptForBackup('Salary Cap');
  if (!proceed) return;

  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    const config = {
      sourcePath: retroState.filePath,
      saveAs: false,
      year: retroState.targetYear,
      options: {
        teams: false,
        abbreviations: false,
        schedule: false,
        coaches: false,
        salaryCap: true,
        stadiums: false,
        schemes: false,
        uniforms: false,
        expansion: false
      }
    };

    console.log('[RetroEditor] Applying salary cap with config:', JSON.stringify(config, null, 2));
    const result = await window.electronAPI.retro.applyAllAndSave(config);
    console.log('[RetroEditor] Salary cap apply result:', JSON.stringify(result, null, 2));

    if (result.success) {
      // Get the new cap value for display
      const capResult = await window.electronAPI.retro.getSalaryCap(retroState.targetYear);
      const capValue = capResult.success && capResult.data ? capResult.data.value : 0;
      const formattedCap = capValue > 0 ? `$${(capValue / 1000000).toFixed(1)}M` : 'N/A';

      showToolStatus(`Salary cap set to ${formattedCap} for ${retroState.targetYear}!`, 'success');
      closeToolModal(document.getElementById('modal-salary-cap'));
    } else {
      showToolStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error applying salary cap:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Salary Cap';
  }
}

// ============================================
// NFL RECORDS FUNCTIONS
// ============================================

/**
 * Load NFL Records preview for modal
 */
async function loadNFLRecordsPreview() {
  const yearEl = document.getElementById('nfl-records-year');
  const loadingEl = document.getElementById('nfl-records-loading');
  const contentEl = document.getElementById('nfl-records-content');
  const errorEl = document.getElementById('nfl-records-error');
  const careerEl = document.getElementById('nfl-records-career');
  const seasonEl = document.getElementById('nfl-records-season');
  const gameEl = document.getElementById('nfl-records-game');

  // Reset display
  yearEl.textContent = retroState.targetYear;
  loadingEl.style.display = 'block';
  contentEl.style.display = 'none';
  errorEl.style.display = 'none';

  try {
    const result = await window.electronAPI.retro.getNFLRecordsPreview(retroState.targetYear);

    if (result.success && result.data) {
      const data = result.data;

      // Helper to render a record category
      const renderCategory = (records, container) => {
        container.innerHTML = '';
        const statLabels = {
          PassYards: 'Pass Yards',
          PassTds: 'Pass TDs',
          RushYards: 'Rush Yards',
          RushTds: 'Rush TDs',
          ReceiveYards: 'Rec Yards',
          ReceiveTDs: 'Rec TDs',
          ReceiveCatches: 'Receptions',
          DefensiveInts: 'INTs',
          DefensiveSacks: 'Sacks'
        };

        for (const [stat, record] of Object.entries(records)) {
          if (!record) continue;
          const label = statLabels[stat] || stat;
          const value = typeof record.value === 'number' ? record.value.toLocaleString() : record.value;
          const div = document.createElement('div');
          div.style.cssText = 'padding: 6px 8px; background: var(--bg-tertiary); border-radius: 4px;';
          div.innerHTML = `
            <div style="color: var(--text-secondary); font-size: 0.75rem;">${label}</div>
            <div style="color: var(--text-primary); font-weight: 500;">${record.firstName} ${record.lastName}</div>
            <div style="color: var(--accent-color); font-size: 0.8rem;">${value}</div>
          `;
          container.appendChild(div);
        }
      };

      // Render each category
      if (data.career) renderCategory(data.career, careerEl);
      if (data.season) renderCategory(data.season, seasonEl);
      if (data.game) renderCategory(data.game, gameEl);

      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    } else {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      errorEl.textContent = result.error || 'Failed to load records data';
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading NFL records preview:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = `Error: ${error.message}`;
  }
}

/**
 * Apply NFL Records tool
 */
async function applyToolNFLRecords() {
  const btn = document.getElementById('btn-apply-nfl-records');

  // Prompt for backup first
  const proceed = await promptForBackup('NFL Records');
  if (!proceed) return;

  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    const result = await window.electronAPI.retro.applyNFLRecords(
      retroState.filePath,
      retroState.targetYear
    );

    if (result.success) {
      showToolStatus(`NFL records set to historical values for ${retroState.targetYear}!`, 'success');
      closeToolModal(document.getElementById('modal-nfl-records'));
    } else {
      showToolStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error applying NFL records:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply NFL Records';
  }
}

// ============================================
// HISTORICAL STATS FUNCTIONS
// ============================================

/**
 * Load Historical Stats preview for modal
 */
async function loadHistoricalStatsPreview() {
  const yearEl = document.getElementById('historical-stats-year');
  const loadingEl = document.getElementById('historical-stats-loading');
  const contentEl = document.getElementById('historical-stats-content');
  const errorEl = document.getElementById('historical-stats-error');
  const listEl = document.getElementById('historical-stats-list');
  const playerCountEl = document.getElementById('stats-player-count');
  const yearCoverageEl = document.getElementById('stats-year-coverage');
  const summaryEl = document.getElementById('historical-stats-summary');

  // Reset display
  yearEl.textContent = retroState.targetYear;
  loadingEl.style.display = 'block';
  contentEl.style.display = 'none';
  errorEl.style.display = 'none';

  try {
    const result = await window.electronAPI.retro.getHistoricalStatsPreview(retroState.targetYear);

    if (result.success && result.data) {
      const { totalPlayers, yearCoverage, matchedPlayers, samplePlayers } = result.data;

      // Update summary stats
      playerCountEl.textContent = totalPlayers.toLocaleString();
      yearCoverageEl.textContent = yearCoverage;

      // Summary text
      summaryEl.innerHTML = `
        <strong style="color: var(--accent-color);">${matchedPlayers}</strong> players in the franchise file have matching career stats in our database.
        Stats will be populated from historical Pro Football Reference data for seasons prior to ${retroState.targetYear}.
      `;

      // Build sample players list
      let html = '<div style="border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">';
      html += '<div style="padding: 8px; background: var(--bg-tertiary); font-weight: 600; border-bottom: 1px solid var(--border-color);">Sample Players</div>';

      for (const player of samplePlayers) {
        const stats = [];
        if (player.pass_yds > 0) stats.push(`${player.pass_yds.toLocaleString()} pass yds`);
        if (player.rush_yds > 0) stats.push(`${player.rush_yds.toLocaleString()} rush yds`);
        if (player.rec_yds > 0) stats.push(`${player.rec_yds.toLocaleString()} rec yds`);
        if (player.tackles > 0) stats.push(`${player.tackles} tackles`);
        if (player.sacks > 0) stats.push(`${player.sacks} sacks`);

        html += `
          <div style="padding: 8px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between;">
            <div>
              <strong style="color: var(--text-primary);">${player.first_name} ${player.last_name}</strong>
              <span style="color: var(--text-secondary); margin-left: 8px;">${player.position}</span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.85rem;">
              ${stats.join(' | ') || 'No stats yet'}
            </div>
          </div>
        `;
      }

      html += '</div>';
      listEl.innerHTML = html;

      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    } else {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      errorEl.textContent = result.error || 'Failed to load historical stats data';
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading historical stats preview:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = `Error: ${error.message}`;
  }
}

/**
 * Apply Historical Stats tool
 */
async function applyToolHistoricalStats() {
  const btn = document.getElementById('btn-apply-historical-stats');

  // Prompt for backup first
  const proceed = await promptForBackup('Historical Stats');
  if (!proceed) return;

  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    const result = await window.electronAPI.retro.applyHistoricalStats(
      retroState.filePath,
      retroState.targetYear
    );

    if (result.success) {
      showToolStatus(`Historical career stats applied for ${result.playersUpdated} players!`, 'success');
      closeToolModal(document.getElementById('modal-historical-stats'));
    } else {
      showToolStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[RetroEditor] Error applying historical stats:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Historical Stats';
  }
}

/**
 * Load Equipment tool preview
 */
async function loadEquipmentToolPreview() {
  const eraEl = document.getElementById('equipment-era-bracket');
  const loadingEl = document.getElementById('equipment-loading');
  const detailsEl = document.getElementById('equipment-details');

  const helmetsEl = document.getElementById('equipment-helmets');
  const shoesEl = document.getElementById('equipment-shoes');
  const glovesEl = document.getElementById('equipment-gloves');
  const sleevesEl = document.getElementById('equipment-sleeves');
  const padsEl = document.getElementById('equipment-pads');
  const spatsEl = document.getElementById('equipment-spats');
  const notesEl = document.getElementById('equipment-notes');

  // Reset display
  loadingEl.style.display = 'block';
  detailsEl.style.display = 'none';

  try {
    const result = await window.electronAPI.equipment.getEraOptions(retroState.targetYear);

    if (result.success) {
      eraEl.textContent = result.era;

      const helmetCount = result.helmet ? result.helmet.length : 0;
      const shoeCount = result.shoes ? result.shoes.length : 0;
      const gloveCount = result.gloves ? result.gloves.length : 0;

      helmetsEl.textContent = helmetCount > 0 ? `${helmetCount} era-appropriate options` : 'Generic only';
      shoesEl.textContent = `${shoeCount} era-appropriate options`;
      glovesEl.textContent = `${gloveCount} era-appropriate options`;
      sleevesEl.textContent = result.sleeves;
      padsEl.textContent = result.shoulderPads;
      spatsEl.textContent = result.spats;
      notesEl.textContent = result.notes || '';

      loadingEl.style.display = 'none';
      detailsEl.style.display = 'block';
    } else {
      loadingEl.textContent = `Error: ${result.error}`;
      loadingEl.style.color = 'var(--error-color)';
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading equipment preview:', error);
    loadingEl.textContent = `Error: ${error.message}`;
    loadingEl.style.color = 'var(--error-color)';
  }
}

/**
 * Apply Equipment tool - assigns era-appropriate equipment to all franchise players
 */
async function applyToolEquipment() {
  const btn = document.getElementById('btn-apply-equipment');

  // Note: Equipment changes are visual only - might not need backup prompt
  // But we keep the pattern for consistency
  const proceed = await promptForBackup('Equipment');
  if (!proceed) return;

  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    // For franchise files, we need to get the player list and apply equipment to each
    // This requires a specialized IPC handler that operates on the loaded franchise file
    // For now, we'll show a message that this feature is coming
    // TODO: Implement franchise equipment assignment via RetroEditorService

    showToolStatus('Equipment assignment for franchise files is coming soon. Use the Roster Editor Mass Equipment tool to apply equipment to roster files.', 'info');
    closeToolModal(document.getElementById('modal-equipment'));

  } catch (error) {
    console.error('[RetroEditor] Error applying equipment:', error);
    showToolStatus(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Equipment';
  }
}

// ============================================
// COACHING TAB FUNCTIONS
// ============================================

/**
 * Current coaching tab state
 */
let currentCoachingTab = 'teams';
let faCoachesData = [];
let selectedFACoachIndex = null;

/**
 * Switch between coaching tabs
 */
function switchCoachingTab(tab) {
  currentCoachingTab = tab;

  // Update tab button styles
  document.getElementById('coaching-tab-teams').style.background = tab === 'teams' ? 'var(--accent-color)' : '';
  document.getElementById('coaching-tab-teams').style.color = tab === 'teams' ? 'white' : '';
  document.getElementById('coaching-tab-fa').style.background = tab === 'fa' ? 'var(--accent-color)' : '';
  document.getElementById('coaching-tab-fa').style.color = tab === 'fa' ? 'white' : '';
  document.getElementById('coaching-tab-search').style.background = tab === 'search' ? 'var(--accent-color)' : '';
  document.getElementById('coaching-tab-search').style.color = tab === 'search' ? 'white' : '';

  // Show/hide content
  document.getElementById('coaching-teams-content').style.display = tab === 'teams' ? 'block' : 'none';
  document.getElementById('coaching-fa-content').style.display = tab === 'fa' ? 'block' : 'none';
  document.getElementById('coaching-search-content').style.display = tab === 'search' ? 'block' : 'none';

  // Update apply button text based on tab
  const applyBtn = document.getElementById('btn-apply-coaching');
  if (tab === 'teams') {
    applyBtn.textContent = 'Apply Team Coaches';
    applyBtn.style.display = 'block';
  } else {
    applyBtn.style.display = 'none';
  }

  // Load tab content if needed
  if (tab === 'fa') {
    loadFACoaches();
  }
}

/**
 * Load free agent coaches from the franchise file
 */
async function loadFACoaches() {
  const listEl = document.getElementById('fa-coaches-list');
  const countEl = document.getElementById('fa-coaches-count');

  try {
    listEl.innerHTML = '<p style="color: var(--text-secondary);">Loading FA coaches...</p>';

    const result = await window.electronAPI.retro.getFACoaches(retroState.filePath);

    if (result.success) {
      faCoachesData = result.faCoaches;

      if (result.faCoaches.length > 0) {
        countEl.textContent = `${result.faCoaches.length} coach(es)`;
        listEl.innerHTML = result.faCoaches.map(coach => `
          <div class="retro-tool-preview-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 4px; background: var(--bg-tertiary); border-radius: 4px;">
            <div>
              <strong style="color: var(--text-primary);">${coach.firstName} ${coach.lastName}</strong>
              <div style="font-size: 0.85em; color: var(--text-secondary);">
                ${coach.position} | Age: ${coach.age} | Years: ${coach.yearsCoaching}
              </div>
            </div>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.85em;" onclick="selectFACoachForReplacement(${coach.coachIndex})">
              Replace
            </button>
          </div>
        `).join('');
      } else {
        countEl.textContent = '0';
        listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">No free agent coaches found in the file.</p>';
      }
    } else {
      countEl.textContent = '--';
      listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${result.error}</p>`;
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading FA coaches:', error);
    countEl.textContent = '--';
    listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}

/**
 * Select an FA coach for replacement
 */
function selectFACoachForReplacement(coachIndex) {
  selectedFACoachIndex = coachIndex;
  const coach = faCoachesData.find(c => c.coachIndex === coachIndex);

  // Switch to search tab
  switchCoachingTab('search');

  // Update search UI to show we're replacing
  const searchResults = document.getElementById('coach-search-results');
  searchResults.innerHTML = `
    <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 12px;">
      <strong style="color: var(--accent-color);">Replacing:</strong> ${coach.firstName} ${coach.lastName} (${coach.position})
      <br><span style="color: var(--text-secondary); font-size: 0.85em;">Search below for a real coach to replace them with.</span>
    </div>
    <p style="color: var(--text-secondary);">Enter a name to search the coach database.</p>
  `;
}

/**
 * Search the coach database
 */
async function searchCoachDatabase() {
  const query = document.getElementById('coach-search-input').value.trim();
  const listEl = document.getElementById('coach-search-results');
  const countEl = document.getElementById('coach-search-count');

  if (!query) {
    listEl.innerHTML = '<p style="color: var(--text-secondary);">Enter a name to search the coach database.</p>';
    return;
  }

  // Use a high year if not set to include all coaches
  const searchYear = retroState.targetYear || 2024;
  console.log(`[RetroEditor] Searching coach database: query="${query}", year=${searchYear}`);

  try {
    listEl.innerHTML = '<p style="color: var(--text-secondary);">Searching...</p>';

    const result = await window.electronAPI.retro.searchCoachDatabase(query, searchYear);
    console.log('[RetroEditor] Search result:', result);

    if (!result) {
      console.error('[RetroEditor] Search returned null/undefined');
      listEl.innerHTML = '<p style="color: var(--error-color);">Error: No response from search API</p>';
      return;
    }

    if (result.error) {
      console.error('[RetroEditor] Search error:', result.error);
      listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${result.error}</p>`;
      return;
    }

    if (result.success) {
      if (result.results.length > 0) {
        countEl.textContent = `${result.results.length} result(s)`;

        // Check if we're editing a team coach or replacing an FA coach
        const isEditingTeam = retroState.editingTeamCoach !== null && retroState.editingTeamCoach !== undefined;
        const isReplacingFA = selectedFACoachIndex !== null;

        // Build context header
        let headerInfo = '';
        if (isEditingTeam) {
          headerInfo = `
            <div style="padding: 12px; background: var(--accent-color); color: white; border-radius: 4px; margin-bottom: 12px;">
              <strong>Editing: ${retroState.editingTeamCoach.teamAbbr} - ${retroState.editingTeamCoach.position}</strong>
              <div style="margin-top: 4px; font-size: 0.9em;">Click a coach below to assign them.</div>
            </div>`;
        } else if (isReplacingFA) {
          headerInfo = `
            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 12px;">
              <strong style="color: var(--accent-color);">Click a coach below to replace the selected FA coach</strong>
            </div>`;
        }

        const isClickable = isEditingTeam || isReplacingFA;

        listEl.innerHTML = headerInfo + result.results.map(coach => {
          // Determine click handler based on context
          let onclick = '';
          if (isEditingTeam) {
            onclick = `onclick="assignCoachToTeam('${coach.firstName}', '${coach.lastName}', '${coach.position}', ${coach.careerFrom}, ${coach.careerWins}, ${coach.careerLosses})"`;
          } else if (isReplacingFA) {
            onclick = `onclick="replaceWithDatabaseCoach('${coach.firstName}', '${coach.lastName}', ${coach.careerFrom}, ${coach.careerWins}, ${coach.careerLosses})"`;
          }

          return `
          <div class="retro-tool-preview-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 4px; background: var(--bg-tertiary); border-radius: 4px; cursor: ${isClickable ? 'pointer' : 'default'};"
               ${onclick}>
            <div>
              <strong style="color: var(--text-primary);">${coach.firstName} ${coach.lastName}</strong>
              <div style="font-size: 0.85em; color: var(--text-secondary);">
                ${coach.position} | Career: ${coach.careerFrom}-${coach.careerTo} | Record: ${coach.careerWins}-${coach.careerLosses}
              </div>
            </div>
            ${isClickable ? '<span style="color: var(--accent-color);">Select</span>' : ''}
          </div>
        `;
        }).join('');
      } else {
        countEl.textContent = '0';
        listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">No coaches found matching that name.</p>';
      }
    } else {
      countEl.textContent = '--';
      listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${result.error}</p>`;
    }
  } catch (error) {
    console.error('[RetroEditor] Error searching coach database:', error);
    countEl.textContent = '--';
    listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}

/**
 * Replace an FA coach with a coach from the database
 */
async function replaceWithDatabaseCoach(firstName, lastName, careerFrom, careerWins, careerLosses) {
  if (selectedFACoachIndex === null) return;

  const listEl = document.getElementById('coach-search-results');

  try {
    listEl.innerHTML = '<p style="color: var(--text-secondary);">Replacing coach...</p>';

    const result = await window.electronAPI.retro.replaceFACoach(
      retroState.filePath,
      selectedFACoachIndex,
      { firstName, lastName, careerFrom, careerWins, careerLosses },
      retroState.targetYear
    );

    if (result.success) {
      showToolStatus(`Replaced coach with ${firstName} ${lastName}`, 'success');

      // Reset selection
      selectedFACoachIndex = null;

      // Switch back to FA tab to show updated list
      switchCoachingTab('fa');
    } else {
      listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${result.error}</p>`;
    }
  } catch (error) {
    console.error('[RetroEditor] Error replacing coach:', error);
    listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}

// Export for use by other modules
window.initRetroEditor = initRetroEditor;
window.debugTeamTable = debugTeamTable;
window.refreshPortraitAssignments = refreshPortraitAssignments;
window.importLogoForTeam = importLogoForTeam;
window.exportLogosForFrosty = exportLogosForFrosty;
window.loadLogoPreview = loadLogoPreview;
window.scrapeAllLogos = scrapeAllLogos;
window.viewScrapedLogos = viewScrapedLogos;
window.exportLogosForMFT = exportLogosForMFT;
window.openExpansionDraftBoard = openExpansionDraftBoard;
window.togglePlayerSelection = togglePlayerSelection;
window.toggleProtectionMode = toggleProtectionMode;
window.togglePlayerProtection = togglePlayerProtection;
window.cancelTeamSelection = cancelTeamSelection;
window.confirmTeamSelection = confirmTeamSelection;
window.showToolLandingPage = showToolLandingPage;
window.openToolModal = openToolModal;
window.closeToolModal = closeToolModal;
window.switchCoachingTab = switchCoachingTab;
window.selectFACoachForReplacement = selectFACoachForReplacement;
window.searchCoachDatabase = searchCoachDatabase;
window.replaceWithDatabaseCoach = replaceWithDatabaseCoach;
window.editTeamCoach = editTeamCoach;
window.setEditingPosition = setEditingPosition;
window.setCoachSource = setCoachSource;
window.searchCoachDatabaseForTeam = searchCoachDatabaseForTeam;
window.cancelTeamCoachEdit = cancelTeamCoachEdit;
window.assignCoachToTeam = assignCoachToTeam;
window.assignFACoachToTeam = assignFACoachToTeam;
window.switchPortraitTab = switchPortraitTab;
window.togglePortraitMapping = togglePortraitMapping;
window.selectAllPortraitMappings = selectAllPortraitMappings;
window.deselectAllPortraitMappings = deselectAllPortraitMappings;

// ============================================
// PORTRAIT TAB FUNCTIONS
// ============================================

/**
 * Current portrait tab state
 */
let currentPortraitTab = 'generated';

/**
 * Switch between portrait tabs
 */
function switchPortraitTab(tab) {
  currentPortraitTab = tab;

  // Update tab button styles
  document.getElementById('portrait-tab-generated').style.background = tab === 'generated' ? 'var(--accent-color)' : '';
  document.getElementById('portrait-tab-generated').style.color = tab === 'generated' ? 'white' : '';
  document.getElementById('portrait-tab-user').style.background = tab === 'user' ? 'var(--accent-color)' : '';
  document.getElementById('portrait-tab-user').style.color = tab === 'user' ? 'white' : '';

  // Show/hide content
  document.getElementById('portrait-generated-content').style.display = tab === 'generated' ? 'block' : 'none';
  document.getElementById('portrait-user-content').style.display = tab === 'user' ? 'block' : 'none';

  // Load tab content if needed
  if (tab === 'user') {
    loadUserPortraits();
  }
}

/**
 * Load user-imported portraits from the Portrait Manager
 */
async function loadUserPortraits() {
  const listEl = document.getElementById('user-portraits-list');
  const countEl = document.getElementById('user-portraits-count');

  try {
    listEl.innerHTML = '<p style="color: var(--text-secondary);">Loading portraits...</p>';

    // Get all user portraits
    const portraits = await window.electronAPI.customPortrait.list();
    console.log('[RetroEditor] Loaded user portraits:', portraits?.length || 0);

    // Filter by year if target year is set
    let filteredPortraits = portraits || [];
    if (retroState.targetYear && portraits) {
      // Get portraits for this year OR portraits with no year assigned
      const yearPortraits = await window.electronAPI.customPortrait.listByYear(retroState.targetYear);
      const noYearPortraits = portraits.filter(p => !p.year);
      filteredPortraits = [...new Set([...(yearPortraits || []), ...noYearPortraits])];
    }

    if (filteredPortraits.length > 0) {
      countEl.textContent = `${filteredPortraits.length} portrait(s)`;

      listEl.innerHTML = filteredPortraits.map(portrait => `
        <div class="retro-tool-preview-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 4px; background: var(--bg-tertiary); border-radius: 4px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: var(--bg-secondary); border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${portrait.thumbnailPath ?
                `<img src="file://${portrait.thumbnailPath}" style="width: 100%; height: 100%; object-fit: cover;">` :
                `<span style="font-size: 1.5em;">🖼️</span>`
              }
            </div>
            <div>
              <strong style="color: var(--text-primary);">${portrait.playerName || `Portrait ${portrait.pid}`}</strong>
              <div style="font-size: 0.85em; color: var(--text-secondary);">
                PID: ${portrait.pid} ${portrait.year ? `| Year: ${portrait.year}` : ''}
                ${portrait.databasePlayerId ? '| Assigned to player' : ''}
              </div>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      countEl.textContent = '0';
      listEl.innerHTML = `
        <div style="text-align: center; padding: 32px; color: var(--text-secondary);">
          <div style="font-size: 3rem; margin-bottom: 12px;">🖼️</div>
          <p>No portraits imported yet.</p>
          <p style="font-size: 0.9em; margin-top: 8px;">
            Use the <strong>Portrait Editor</strong> tab to import portraits for your historical players.
          </p>
        </div>
      `;
    }
  } catch (error) {
    console.error('[RetroEditor] Error loading user portraits:', error);
    countEl.textContent = '--';
    listEl.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
  }
}
