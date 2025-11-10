/**
 * Draft Class Generator V2.0 Wizard
 *
 * Multi-step wizard for generating draft classes with:
 * - Source selection (year/decade)
 * - Rating mode selection (random/variance/madden)
 * - Options & review
 * - Results preview
 */

// Wizard state
let wizardState = {
  currentStep: 1,
  sourceType: 'year',  // 'year' or 'decade'
  year: 2024,
  decade: null,
  ratingMode: 'variance',
  generatedPlayers: null
};

/**
 * Initialize the draft wizard
 */
function initDraftWizard() {
  console.log('[DraftWizard] Initializing...');

  // Step 1: Source type toggle
  document.querySelectorAll('input[name="source-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      wizardState.sourceType = e.target.value;
      toggleSourcePanels(e.target.value);
    });
  });

  // Step 2: Rating mode cards
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        wizardState.ratingMode = radio.value;

        // Update card visuals
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      }
    });
  });

  // Navigation buttons
  document.querySelectorAll('.wizard-next').forEach(btn => {
    btn.addEventListener('click', () => nextStep());
  });

  document.querySelectorAll('.wizard-back').forEach(btn => {
    btn.addEventListener('click', () => prevStep());
  });

  document.querySelector('.wizard-generate')?.addEventListener('click', () => generateDraftClass());
  document.querySelector('.wizard-restart')?.addEventListener('click', () => restartWizard());

  // Result action buttons
  document.getElementById('wizard-save-draft')?.addEventListener('click', () => saveDraftClassFile());
  document.getElementById('wizard-load-editor')?.addEventListener('click', () => loadIntoEditor());

  console.log('[DraftWizard] Initialized successfully');
}

/**
 * Toggle between year and decade selection panels
 */
function toggleSourcePanels(sourceType) {
  const yearPanel = document.getElementById('year-selection');
  const decadePanel = document.getElementById('decade-selection');

  if (sourceType === 'year') {
    yearPanel.style.display = 'block';
    decadePanel.style.display = 'none';
  } else {
    yearPanel.style.display = 'none';
    decadePanel.style.display = 'block';
  }
}

/**
 * Navigate to next step
 */
function nextStep() {
  if (wizardState.currentStep === 1) {
    // Capture source selection
    if (wizardState.sourceType === 'year') {
      wizardState.year = parseInt(document.getElementById('draft-year').value);
      wizardState.decade = null;
    } else {
      wizardState.decade = parseInt(document.getElementById('draft-decade').value);
      wizardState.year = null;
    }
  } else if (wizardState.currentStep === 2) {
    // Capture rating mode
    const selectedMode = document.querySelector('input[name="rating-mode"]:checked');
    wizardState.ratingMode = selectedMode ? selectedMode.value : 'variance';

    // Update summary in step 3
    updateReviewSummary();
  }

  // Move to next step
  if (wizardState.currentStep < 4) {
    showStep(wizardState.currentStep + 1);
  }
}

/**
 * Navigate to previous step
 */
function prevStep() {
  if (wizardState.currentStep > 1) {
    showStep(wizardState.currentStep - 1);
  }
}

/**
 * Show specific wizard step
 */
function showStep(stepNumber) {
  // Hide all steps
  document.querySelectorAll('.wizard-step').forEach(step => {
    step.style.display = 'none';
    step.classList.remove('active');
  });

  // Show target step
  const targetStep = document.getElementById(`wizard-step-${stepNumber}`);
  if (targetStep) {
    targetStep.style.display = 'block';
    targetStep.classList.add('active');
    wizardState.currentStep = stepNumber;
  }
}

/**
 * Update review summary in step 3
 */
function updateReviewSummary() {
  const sourceEl = document.getElementById('summary-source');
  const modeEl = document.getElementById('summary-mode');
  const countEl = document.getElementById('summary-count');

  if (sourceEl) {
    sourceEl.textContent = wizardState.decade
      ? `${wizardState.decade}s Decade Class`
      : `Year ${wizardState.year}`;
  }

  if (modeEl) {
    const modeNames = {
      'random': 'Random (Shuffled Order)',
      'variance': 'Variance (Formula-Based)',
      'madden': 'Madden Rating (Real Stats)'
    };
    modeEl.textContent = modeNames[wizardState.ratingMode] || wizardState.ratingMode;
  }

  if (countEl) {
    // Estimate player count based on year
    let estimatedCount = 402; // Default modern
    if (wizardState.year && wizardState.year < 2011) {
      if (wizardState.year < 1960) {
        estimatedCount = '220-360';
      } else if (wizardState.year < 1994) {
        estimatedCount = '280-330';
      } else {
        estimatedCount = '255';
      }
    }
    countEl.textContent = wizardState.decade ? '402' : estimatedCount;
  }
}

/**
 * Generate draft class using V2 API
 */
async function generateDraftClass() {
  console.log('[DraftWizard] Generating draft class...', wizardState);

  // Show progress
  const progressEl = document.getElementById('wizard-progress');
  const progressBar = document.getElementById('wizard-progress-bar');
  const progressText = document.getElementById('wizard-progress-text');
  const generateBtn = document.querySelector('.wizard-generate');

  if (progressEl) progressEl.style.display = 'block';
  if (generateBtn) generateBtn.disabled = true;
  if (progressText) progressText.textContent = 'Loading player data...';
  if (progressBar) progressBar.style.width = '10%';

  try {
    // Build options for V2 API
    const options = {
      ratingMode: wizardState.ratingMode,
      testingMode: false
    };

    if (wizardState.decade) {
      options.decade = wizardState.decade;
    } else {
      options.year = wizardState.year;
    }

    // Call V2 IPC handler
    if (progressText) progressText.textContent = 'Generating ratings...';
    if (progressBar) progressBar.style.width = '50%';

    const result = await window.electronAPI.creator.generateDraftClassV2(options);

    if (progressBar) progressBar.style.width = '90%';
    if (progressText) progressText.textContent = 'Preparing preview...';

    if (result.success) {
      console.log(`[DraftWizard] Generated ${result.count} players`);
      wizardState.generatedPlayers = result.players;

      // Update result stats
      document.getElementById('result-count').textContent = `${result.count} players generated`;
      document.getElementById('result-source').textContent = `Source: ${result.source}`;
      document.getElementById('result-mode').textContent = `Mode: ${result.mode}`;

      // Render preview grid
      renderResultGrid(result.players);

      // Complete progress
      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.textContent = 'Complete!';

      // Move to results step
      setTimeout(() => {
        showStep(4);
        if (progressEl) progressEl.style.display = 'none';
        if (generateBtn) generateBtn.disabled = false;
      }, 500);

    } else {
      throw new Error(result.error || 'Unknown error');
    }

  } catch (error) {
    console.error('[DraftWizard] Generation failed:', error);
    alert(`Failed to generate draft class: ${error.message}`);

    if (progressEl) progressEl.style.display = 'none';
    if (generateBtn) generateBtn.disabled = false;
  }
}

/**
 * Render result grid with Handsontable
 */
function renderResultGrid(players) {
  const container = document.getElementById('wizard-result-grid');
  if (!container) return;

  // Clear existing grid
  container.innerHTML = '';

  // Prepare data for Handsontable
  const data = players.map(p => ({
    firstName: p.firstName,
    lastName: p.lastName,
    position: p.position,
    overall: p.ratings.POVR,
    college: p.college,
    heightInches: p.heightInches,
    weight: p.weight,
    age: p.age
  }));

  // Initialize Handsontable
  const hot = new Handsontable(container, {
    data: data,
    columns: [
      { data: 'firstName', title: 'First Name', width: 120 },
      { data: 'lastName', title: 'Last Name', width: 120 },
      { data: 'position', title: 'Pos', width: 60 },
      { data: 'overall', title: 'OVR', width: 60, type: 'numeric' },
      { data: 'college', title: 'College', width: 80 },
      { data: 'heightInches', title: 'Height', width: 70 },
      { data: 'weight', title: 'Weight', width: 70 },
      { data: 'age', title: 'Age', width: 60 }
    ],
    colHeaders: true,
    rowHeaders: true,
    height: 500,
    licenseKey: 'non-commercial-and-evaluation',
    stretchH: 'all',
    columnSorting: true,
    filters: true,
    dropdownMenu: true
  });

  console.log('[DraftWizard] Preview grid rendered with', data.length, 'players');
}

/**
 * Save draft class file
 */
async function saveDraftClassFile() {
  if (!wizardState.generatedPlayers) {
    alert('No draft class to save');
    return;
  }

  try {
    const savePath = await window.electronAPI.file.saveDialog();
    if (!savePath) return; // User cancelled

    // TODO: Need to add IPC handler for saving draft class from generated players
    console.log('[DraftWizard] Would save to:', savePath);
    alert('Direct save functionality coming soon. Use "Load into Editor" then save from there.');

  } catch (error) {
    console.error('[DraftWizard] Save failed:', error);
    alert(`Failed to save: ${error.message}`);
  }
}

/**
 * Load generated players into draft class editor
 */
async function loadIntoEditor() {
  if (!wizardState.generatedPlayers) {
    alert('No draft class to load');
    return;
  }

  console.log('[DraftWizard] Loading', wizardState.generatedPlayers.length, 'players into editor');

  // DEBUG: Log first player to verify data structure
  if (wizardState.generatedPlayers.length > 0) {
    console.log('[DraftWizard] Sample player data:', wizardState.generatedPlayers[0]);

    // Find and log Joe Burrow if present
    const joeBurrow = wizardState.generatedPlayers.find(p => p.firstName === 'Joe' && p.lastName === 'Burrow');
    if (joeBurrow) {
      console.log('[DraftWizard] ✓ Joe Burrow BEFORE conversion to prospect:');
      console.log('  position:', joeBurrow.position);
      console.log('  jerseyNum:', joeBurrow.jerseyNum);
      console.log('  archetype:', joeBurrow.archetype);
      console.log('  PID:', joeBurrow.PID);
      console.log('  PAM:', joeBurrow.PAM);
      console.log('  homeState:', joeBurrow.homeState);
    }
  }

  // Convert generated players to draft class prospect format
  // IMPORTANT: Draft editor expects NUMERIC IDs for position, college, homeState, archetype
  const prospects = wizardState.generatedPlayers.map((player, index) => ({
    // Player identity
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.positionCode,  // Use numeric code, NOT string name
    positionCode: player.positionCode,

    // Physical attributes
    heightInches: player.heightInches,
    weight: player.weight,
    age: player.age,

    // IDs
    PID: player.PID || null,
    PAM: player.PAM || null,
    PEPS: player.PEPS || null,
    college: player.college,  // Already numeric ID from CreatorService
    homeState: player.homeState,  // Already numeric ID from CreatorService
    jerseyNum: player.jerseyNum,

    // Draft info
    pick: player.pick !== undefined ? player.pick : index + 1,
    round: player.round || Math.floor(index / 32) + 1,

    // Dev Trait
    devTrait: player.devTrait,

    // Ratings (all individual ratings)
    ...player.ratings,

    // Body type and archetype
    bodyType: player.bodyType,
    archetype: player.archetype || 0,  // Already a NUMERIC archetype ID from backend
    yearsPro: player.yearsPro || 0
  }));

  // Create draft class data structure
  const draftClassData = {
    header: {
      year: wizardState.year || new Date().getFullYear(),
      version: 'V2_Generated'
    },
    prospects: prospects
  };

  // Switch to draft class editor tab
  const editorTab = document.querySelector('button[data-tool="draft"]');
  if (editorTab) {
    editorTab.click();
  } else {
    console.error('[DraftWizard] Could not find draft class editor tab button');
  }

  // Load data into app
  if (window.app) {
    // Set current draft class data
    window.app.currentDraftClass = draftClassData;
    window.app.currentDraftFilePath = null; // No file path since generated

    // Update UI
    const sourceName = wizardState.decade
      ? `${wizardState.decade}s Decade Class`
      : `Year ${wizardState.year}`;
    const fileName = `Generated_${sourceName.replace(/\s+/g, '_')}`;

    document.getElementById('draft-file-name').textContent = fileName;
    document.getElementById('draft-file-stats').textContent =
      `${prospects.length} prospects | ${sourceName} | Mode: ${wizardState.ratingMode}`;

    // Enable buttons
    document.getElementById('save-draft-btn').disabled = false;
    document.getElementById('export-draft-json-btn').disabled = false;

    // Create grid
    window.app.createDraftGrid(prospects);

    console.log('[DraftWizard] Successfully loaded into editor');
  } else {
    console.error('[DraftWizard] window.app not available');
    alert('Failed to load into editor: App not initialized');
  }
}

/**
 * Restart wizard
 */
function restartWizard() {
  wizardState = {
    currentStep: 1,
    sourceType: 'year',
    year: 2024,
    decade: null,
    ratingMode: 'variance',
    generatedPlayers: null
  };

  // Reset form inputs
  document.getElementById('draft-year').value = 2024;
  document.querySelector('input[name="source-type"][value="year"]').checked = true;
  document.querySelector('input[name="rating-mode"][value="variance"]').checked = true;

  // Clear result grid
  const container = document.getElementById('wizard-result-grid');
  if (container) container.innerHTML = '';

  // Show step 1
  showStep(1);
}

// Export for use in main app.js
window.draftWizard = {
  init: initDraftWizard,
  getState: () => wizardState
};
