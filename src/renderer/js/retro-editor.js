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
  schedulePreview: null,
  coachPreview: null,
  salaryCapData: null,
  stadiumPreview: null,
  schemePreview: null,
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

    // Load schedule preview
    await loadSchedulePreview();

    // Load coach preview
    await loadCoachPreview();

    // Load salary cap preview
    await loadSalaryCapPreview();

    // Load stadium preview
    await loadStadiumPreview();

    // Load scheme preview
    await loadSchemePreview();

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
          <strong>Salary Cap: ${formattedCap}</strong>
          ${capData.note ? `<br><span style="font-size: 0.85em; color: var(--text-secondary);">${capData.note}</span>` : ''}
        </div>
      `;

      retroState.salaryCapData = capData;
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
    // Move to step 4 first
    goToRetroStep(4);

    // Show progress
    const progressBar = document.getElementById('retro-progress-bar');
    const progressText = document.getElementById('retro-progress-text');
    const resultsSection = document.getElementById('retro-results-section');
    const errorSection = document.getElementById('retro-error-section');

    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';

    // Determine total steps based on what's available
    const hasSchedule = retroState.schedulePreview !== null;
    const hasCoaches = retroState.coachPreview !== null;
    const hasSalaryCap = retroState.salaryCapData !== null;
    const hasStadiums = retroState.stadiumPreview !== null;
    const hasSchemes = retroState.schemePreview !== null;
    let totalSteps = 3; // Base: season, teams, draft
    if (hasSchedule) totalSteps++;
    if (hasCoaches) totalSteps++;
    if (hasSalaryCap) totalSteps++;
    if (hasStadiums) totalSteps++;
    if (hasSchemes) totalSteps++;

    let currentStep = 0;

    // Animate progress
    currentStep++;
    progressBar.style.width = `${(currentStep * 100) / totalSteps}%`;
    progressText.textContent = 'Applying season settings...';
    await sleep(500);

    currentStep++;
    progressBar.style.width = `${(currentStep * 100) / totalSteps}%`;
    progressText.textContent = 'Updating team names...';
    await sleep(500);

    currentStep++;
    progressBar.style.width = `${(currentStep * 100) / totalSteps}%`;
    progressText.textContent = 'Reordering draft picks...';

    // Apply all changes
    const result = await window.electronAPI.retro.applyAllChanges(retroState.filePath, retroState.targetYear);

    if (!result.success) {
      progressText.textContent = 'Error applying changes';
      document.getElementById('retro-error-message').textContent = result.error;
      errorSection.style.display = 'block';
      return;
    }

    // Apply schedule if available
    let scheduleResult = null;
    if (hasSchedule) {
      currentStep++;
      progressBar.style.width = `${(currentStep * 100) / totalSteps}%`;
      progressText.textContent = 'Applying historical schedule...';
      await sleep(300);

      try {
        scheduleResult = await window.electronAPI.retro.applySchedule(retroState.filePath, retroState.targetYear);
      } catch (scheduleError) {
        console.warn('[RetroEditor] Schedule application failed:', scheduleError);
        // Continue - schedule is optional
      }
    }

    // Apply coaches if available
    let coachResult = null;
    if (hasCoaches) {
      currentStep++;
      progressBar.style.width = `${(currentStep * 100) / totalSteps}%`;
      progressText.textContent = 'Assigning historical coaches...';
      await sleep(300);

      try {
        coachResult = await window.electronAPI.retro.applyCoaches(retroState.filePath, retroState.targetYear);
      } catch (coachError) {
        console.warn('[RetroEditor] Coach assignment failed:', coachError);
        // Continue - coaches are optional
      }
    }

    // Apply salary cap if available
    let salaryCapResult = null;
    if (hasSalaryCap) {
      currentStep++;
      progressBar.style.width = `${(currentStep * 100) / totalSteps}%`;
      progressText.textContent = 'Setting salary cap...';
      await sleep(300);

      try {
        salaryCapResult = await window.electronAPI.retro.applySalaryCap(retroState.filePath, retroState.targetYear);
      } catch (salaryCapError) {
        console.warn('[RetroEditor] Salary cap application failed:', salaryCapError);
        // Continue - salary cap is optional
      }
    }

    // Apply stadium names if available
    let stadiumResult = null;
    if (hasStadiums) {
      currentStep++;
      progressBar.style.width = `${(currentStep * 100) / totalSteps}%`;
      progressText.textContent = 'Setting historical stadium names...';
      await sleep(300);

      try {
        stadiumResult = await window.electronAPI.retro.applyStadiumNames(retroState.filePath, retroState.targetYear);
      } catch (stadiumError) {
        console.warn('[RetroEditor] Stadium names application failed:', stadiumError);
        // Continue - stadiums are optional
      }
    }

    // Apply team schemes if available
    let schemeResult = null;
    if (hasSchemes) {
      currentStep++;
      progressBar.style.width = `${(currentStep * 100) / totalSteps}%`;
      progressText.textContent = 'Setting era-appropriate team schemes...';
      await sleep(300);

      try {
        schemeResult = await window.electronAPI.retro.applyTeamSchemes(retroState.filePath, retroState.targetYear);
      } catch (schemeError) {
        console.warn('[RetroEditor] Team schemes application failed:', schemeError);
        // Continue - schemes are optional
      }
    }

    progressBar.style.width = '100%';
    await sleep(300);

    retroState.applyResult = result.data;
    progressText.textContent = 'Changes applied successfully!';

    // Show results
    const resultsSummary = document.getElementById('retro-results-summary');
    let resultItems = [
      `<li>Season year set to ${retroState.targetYear}</li>`,
      `<li>Super Bowl number updated</li>`,
      `<li>${result.data.teamChanges || 0} team name(s) updated</li>`,
      `<li>${result.data.draftPicksReordered || 0} draft pick(s) reordered</li>`
    ];

    // Add schedule result if attempted
    if (scheduleResult && scheduleResult.success) {
      resultItems.push(`<li>${scheduleResult.data.gamesModified || 0} schedule game(s) set</li>`);
    } else if (hasSchedule && (!scheduleResult || !scheduleResult.success)) {
      resultItems.push(`<li style="color: var(--warning-color);">Schedule could not be applied (optional)</li>`);
    }

    // Add coach result if attempted
    if (coachResult && coachResult.success) {
      resultItems.push(`<li>${coachResult.data.coachesUpdated || 0} coach(es) assigned</li>`);
      // Show warnings if any
      if (coachResult.data.warnings && coachResult.data.warnings.length > 0) {
        resultItems.push(`<li style="color: var(--warning-color);">${coachResult.data.warnings.length} coach warning(s)</li>`);
      }
    } else if (hasCoaches && (!coachResult || !coachResult.success)) {
      resultItems.push(`<li style="color: var(--warning-color);">Coaches could not be assigned (optional)</li>`);
    }

    // Add salary cap result if attempted
    if (salaryCapResult && salaryCapResult.success) {
      const capValue = salaryCapResult.data.newCap;
      const formattedCap = capValue > 0 ? '$' + capValue.toLocaleString() : 'No cap (pre-1994)';
      resultItems.push(`<li>Salary cap set to ${formattedCap}</li>`);
    } else if (hasSalaryCap && (!salaryCapResult || !salaryCapResult.success)) {
      resultItems.push(`<li style="color: var(--warning-color);">Salary cap could not be set (optional)</li>`);
    }

    // Add stadium result if attempted
    if (stadiumResult && stadiumResult.success) {
      resultItems.push(`<li>${stadiumResult.data.stadiumsUpdated || 0} stadium name(s) updated</li>`);
    } else if (hasStadiums && (!stadiumResult || !stadiumResult.success)) {
      resultItems.push(`<li style="color: var(--warning-color);">Stadium names could not be updated (optional)</li>`);
    }

    // Add scheme result if attempted
    if (schemeResult && schemeResult.success) {
      resultItems.push(`<li>${schemeResult.data.schemesUpdated || 0} team scheme(s) updated</li>`);
    } else if (hasSchemes && (!schemeResult || !schemeResult.success)) {
      resultItems.push(`<li style="color: var(--warning-color);">Team schemes could not be updated (optional)</li>`);
    }

    resultsSummary.innerHTML = `<ul>${resultItems.join('')}</ul>`;
    resultsSection.style.display = 'block';

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
    schedulePreview: null,
    coachPreview: null,
    salaryCapData: null,
    stadiumPreview: null,
    schemePreview: null,
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
