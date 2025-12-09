/**
 * Database Player Card Module
 *
 * Provides functionality to view, edit, and manage players in the user database.
 * Supports editing original database players (overlay) and custom players.
 */

(function() {
  'use strict';

  // Module state
  let currentDbPlayer = null;
  let currentDbPlayerId = null;
  let isCustomPlayer = false;
  let isCreateMode = false;  // NEW: true when creating a new player
  let hasUnsavedChanges = false;
  let selectedYear = null;
  let availableYears = [];
  let originalSeasonData = null; // Stores original values when a year is loaded, for change detection

  // Rating fields (all 77 Madden attributes)
  const RATING_FIELDS = [
    // Core ratings
    { field: 'POVR', label: 'Overall', category: 'core' },
    { field: 'PSPD', label: 'Speed', category: 'physical' },
    { field: 'PACC', label: 'Acceleration', category: 'physical' },
    { field: 'PSTR', label: 'Strength', category: 'physical' },
    { field: 'PAGI', label: 'Agility', category: 'physical' },
    { field: 'PJMP', label: 'Jumping', category: 'physical' },
    { field: 'PSTM', label: 'Stamina', category: 'physical' },
    { field: 'PINJ', label: 'Injury', category: 'physical' },
    { field: 'PTGH', label: 'Toughness', category: 'physical' },
    { field: 'PAWR', label: 'Awareness', category: 'mental' },
    { field: 'PCOD', label: 'Change of Direction', category: 'physical' },
    { field: 'PBCV', label: 'Ball Carrier Vision', category: 'running' },
    { field: 'PBTK', label: 'Break Tackle', category: 'running' },
    { field: 'PTRK', label: 'Trucking', category: 'running' },
    { field: 'PELU', label: 'Elusiveness', category: 'running' },
    { field: 'PSFA', label: 'Stiff Arm', category: 'running' },
    { field: 'PSPN', label: 'Spin Move', category: 'running' },
    { field: 'PJKM', label: 'Juke Move', category: 'running' },
    { field: 'PCAR', label: 'Carrying', category: 'running' },
    { field: 'PTHA', label: 'Throw Accuracy', category: 'passing' },
    { field: 'PTAS', label: 'Throw Accuracy Short', category: 'passing' },
    { field: 'PTAM', label: 'Throw Accuracy Mid', category: 'passing' },
    { field: 'PTAD', label: 'Throw Accuracy Deep', category: 'passing' },
    { field: 'PTOR', label: 'Throw on the Run', category: 'passing' },
    { field: 'PTUP', label: 'Throw Under Pressure', category: 'passing' },
    { field: 'PPWR', label: 'Throw Power', category: 'passing' },
    { field: 'PPBK', label: 'Play Action', category: 'passing' },
    { field: 'PCTH', label: 'Catching', category: 'receiving' },
    { field: 'PSPC', label: 'Spectacular Catch', category: 'receiving' },
    { field: 'PCIT', label: 'Catch in Traffic', category: 'receiving' },
    { field: 'PSRR', label: 'Short Route Running', category: 'receiving' },
    { field: 'PMRR', label: 'Medium Route Running', category: 'receiving' },
    { field: 'PDRR', label: 'Deep Route Running', category: 'receiving' },
    { field: 'PREL', label: 'Release', category: 'receiving' },
    { field: 'PRBK', label: 'Run Block', category: 'blocking' },
    { field: 'PPBK', label: 'Pass Block', category: 'blocking' },
    { field: 'PIBK', label: 'Impact Blocking', category: 'blocking' },
    { field: 'PLBK', label: 'Lead Block', category: 'blocking' },
    { field: 'PFMS', label: 'Run Block Finesse', category: 'blocking' },
    { field: 'PRNS', label: 'Run Block Power', category: 'blocking' },
    { field: 'PPBS', label: 'Pass Block Finesse', category: 'blocking' },
    { field: 'PPBP', label: 'Pass Block Power', category: 'blocking' },
    { field: 'PTAK', label: 'Tackling', category: 'defense' },
    { field: 'PHIT', label: 'Hit Power', category: 'defense' },
    { field: 'PPRS', label: 'Pass Rush', category: 'defense' },
    { field: 'PFMV', label: 'Finesse Moves', category: 'defense' },
    { field: 'PPWM', label: 'Power Moves', category: 'defense' },
    { field: 'PBSH', label: 'Block Shedding', category: 'defense' },
    { field: 'PPRC', label: 'Pursuit', category: 'defense' },
    { field: 'PPLA', label: 'Play Recognition', category: 'defense' },
    { field: 'PMCV', label: 'Man Coverage', category: 'coverage' },
    { field: 'PZCV', label: 'Zone Coverage', category: 'coverage' },
    { field: 'PPRS', label: 'Press', category: 'coverage' },
    { field: 'PKAC', label: 'Kick Accuracy', category: 'kicking' },
    { field: 'PKPR', label: 'Kick Power', category: 'kicking' },
    { field: 'PKRT', label: 'Kick Return', category: 'special' }
  ];

  // Category display names
  const CATEGORY_NAMES = {
    core: 'Core',
    physical: 'Physical',
    mental: 'Mental',
    running: 'Running',
    passing: 'Passing',
    receiving: 'Receiving',
    blocking: 'Blocking',
    defense: 'Defense',
    coverage: 'Coverage',
    kicking: 'Kicking',
    special: 'Special Teams'
  };

  /**
   * Initialize the database player card module
   */
  async function initDatabasePlayerCard() {
    console.log('[DatabasePlayerCard] Initializing...');

    // Set up event listeners
    setupEventListeners();

    // Load dropdown options
    await loadDropdownOptions();

    console.log('[DatabasePlayerCard] Initialized');
  }

  /**
   * Set up event listeners for the modal
   */
  function setupEventListeners() {
    // Close button
    var closeBtn = document.getElementById('closeDbPlayerCard');
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent click from bubbling to parent modals
        closeDbPlayerCard();
      });
    }

    // Modal background click - stop propagation to prevent closing player browser
    var modal = document.getElementById('dbPlayerCardModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent click from reaching player browser modal
        if (e.target === modal) {
          closeDbPlayerCard();
        }
      });
    }

    // Tab switching
    document.querySelectorAll('.db-player-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var tabId = tab.dataset.tab;

        // Update active tab button
        document.querySelectorAll('.db-player-tab').forEach(function(t) {
          t.classList.remove('active');
        });
        tab.classList.add('active');

        // Update active tab content
        document.querySelectorAll('.db-player-tab-content').forEach(function(content) {
          content.classList.remove('active');
        });
        var tabContent = document.getElementById('tab-' + tabId);
        if (tabContent) {
          tabContent.classList.add('active');
        }
      });
    });

    // Save button
    var saveBtn = document.getElementById('saveDbPlayerCardBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveDbPlayerChanges);
    }

    // Reset button
    var resetBtn = document.getElementById('resetDbPlayerBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetDbPlayer);
    }

    // Clear Seasons button
    var clearSeasonsBtn = document.getElementById('clearSeasonsBtn');
    if (clearSeasonsBtn) {
      clearSeasonsBtn.addEventListener('click', clearPlayerSeasons);
    }

    // Add to Roster button
    var addToRosterBtn = document.getElementById('addDbPlayerToRoster');
    if (addToRosterBtn) {
      addToRosterBtn.addEventListener('click', addPlayerToRoster);
    }

    // Add to Draft button
    var addToDraftBtn = document.getElementById('addDbPlayerToDraft');
    if (addToDraftBtn) {
      addToDraftBtn.addEventListener('click', addPlayerToDraft);
    }

    // Year selector
    var yearSelect = document.getElementById('dbPlayerYearSelect');
    if (yearSelect) {
      yearSelect.addEventListener('change', onYearChange);
    }

    // Track changes on all inputs
    document.querySelectorAll('#dbPlayerCardModal input, #dbPlayerCardModal select').forEach(function(input) {
      input.addEventListener('change', function() {
        hasUnsavedChanges = true;
        updateSaveButtonState();
      });
    });

    // PID change listener - update portrait when PID changes
    var pidInput = document.getElementById('dbPlayerPID');
    if (pidInput) {
      pidInput.addEventListener('change', function() {
        var newPid = parseInt(pidInput.value, 10);
        if (!isNaN(newPid) && newPid > 0) {
          loadPlayerPortrait(newPid);
        } else {
          // Clear portrait if invalid PID
          var portraitEl = document.getElementById('dbPlayerCardPortrait');
          if (portraitEl) {
            portraitEl.src = '';
            portraitEl.style.display = 'none';
          }
        }
      });
    }

    // Career date change listeners - refresh year selector when career dates change
    var careerFromInput = document.getElementById('dbPlayerCareerFrom');
    var careerToInput = document.getElementById('dbPlayerCareerTo');
    if (careerFromInput) {
      careerFromInput.addEventListener('change', refreshYearSelectorFromForm);
    }
    if (careerToInput) {
      careerToInput.addEventListener('change', refreshYearSelectorFromForm);
    }

    // Escape key to close - stop propagation to prevent player browser from also closing
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var modal = document.getElementById('dbPlayerCardModal');
        if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
          e.stopPropagation();
          e.preventDefault();
          closeDbPlayerCard();
        }
      }
    }, true); // Use capture phase to run before player browser's handler
  }

  // Madden 26 positions
  var MADDEN_POSITIONS = [
    'QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
    'LEDG', 'REDG', 'DT', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS', 'K', 'P', 'LS'
  ];

  /**
   * Load dropdown options from lookup service
   */
  async function loadDropdownOptions() {
    try {
      if (!window.electronAPI || !window.electronAPI.lookup) {
        console.warn('[DatabasePlayerCard] electronAPI.lookup not available');
        return;
      }

      // College dropdown - API returns {value: id, label: name}
      // Store mapping for later use when populating form
      var collegeSelect = document.getElementById('dbPlayerCollege');
      if (collegeSelect) {
        var colleges = await window.electronAPI.lookup.getDropdownOptions('college_lookup.csv');
        if (colleges && colleges.length > 0) {
          collegeSelect.innerHTML = '<option value="">Select College</option>';
          // Store the name->id mapping globally for use in populatePlayerForm
          window._collegeNameToId = {};
          colleges.forEach(function(c) {
            var collegeName = c.label || c.name;
            var collegeId = c.value || c.id;
            // Skip empty or "Blank" entries
            if (!collegeName || collegeName.trim() === '' || collegeName === 'Blank') {
              return;
            }
            var opt = document.createElement('option');
            opt.value = collegeId;  // Use ID as value for getIntValue to work
            opt.textContent = collegeName.trim();
            collegeSelect.appendChild(opt);
            // Store mapping for name lookup
            window._collegeNameToId[collegeName.trim().toLowerCase()] = collegeId;
          });
          console.log('[DatabasePlayerCard] College options loaded with ID values');
        } else {
          console.warn('[DatabasePlayerCard] No colleges loaded from lookup');
        }
      }

      // Position dropdown - use Madden 26 positions
      var positionSelect = document.getElementById('dbPlayerPosition');
      if (positionSelect) {
        positionSelect.innerHTML = '<option value="">Select Position</option>';
        MADDEN_POSITIONS.forEach(function(pos) {
          var opt = document.createElement('option');
          opt.value = pos;
          opt.textContent = pos;
          positionSelect.appendChild(opt);
        });
        console.log('[DatabasePlayerCard] Position options loaded:', MADDEN_POSITIONS.length);
      }

      // Race dropdown
      var raceSelect = document.getElementById('dbPlayerRace');
      if (raceSelect) {
        raceSelect.innerHTML =
          '<option value="">Select Race</option>' +
          '<option value="0">White</option>' +
          '<option value="1">Black</option>' +
          '<option value="2">Asian</option>' +
          '<option value="3">Hispanic</option>' +
          '<option value="4">Other</option>';
      }

      // State dropdown - API returns {value: id, label: name}
      var stateSelect = document.getElementById('dbPlayerHomeState');
      if (stateSelect) {
        var states = await window.electronAPI.lookup.getDropdownOptions('state_lookup.csv');
        if (states && states.length > 0) {
          stateSelect.innerHTML = '<option value="">Select State</option>';
          states.forEach(function(s) {
            var stateName = s.label || s.name;
            if (!stateName || stateName.trim() === '') return;
            var opt = document.createElement('option');
            opt.value = stateName.trim();
            opt.textContent = stateName.trim();
            stateSelect.appendChild(opt);
          });
          console.log('[DatabasePlayerCard] State options loaded');
        }
      }

      // Season Position dropdown (in ratings tab) - use shared MADDEN_POSITIONS
      var seasonPositionSelect = document.getElementById('dbPlayerSeasonPosition');
      if (seasonPositionSelect) {
        seasonPositionSelect.innerHTML = '<option value="">Select Position</option>';
        MADDEN_POSITIONS.forEach(function(pos) {
          var opt = document.createElement('option');
          opt.value = pos;
          opt.textContent = pos;
          seasonPositionSelect.appendChild(opt);
        });
        console.log('[DatabasePlayerCard] Season Position options loaded:', MADDEN_POSITIONS.length);
      }

      // Season Team dropdown - load from team_lookup.csv
      var seasonTeamSelect = document.getElementById('dbPlayerSeasonTeam');
      if (seasonTeamSelect) {
        var teams = await window.electronAPI.lookup.getDropdownOptions('team_lookup.csv');
        if (teams && teams.length > 0) {
          seasonTeamSelect.innerHTML = '<option value="">Select Team</option>';
          teams.forEach(function(t) {
            var teamName = t.label || t.name;
            if (!teamName || teamName.trim() === '') return;
            var opt = document.createElement('option');
            opt.value = teamName.trim();
            opt.textContent = teamName.trim();
            seasonTeamSelect.appendChild(opt);
          });
          console.log('[DatabasePlayerCard] Season Team options loaded');
        }
      }

      // Add position change listener to update archetype dropdown
      if (seasonPositionSelect) {
        seasonPositionSelect.addEventListener('change', function() {
          var selectedPosition = this.value;
          updateArchetypeDropdown(selectedPosition);
        });
      }
    } catch (error) {
      console.error('[DatabasePlayerCard] Failed to load dropdown options:', error);
    }
  }

  /**
   * Open the database player card for a given player
   * @param {number} playerId - The internal database ID
   * @param {boolean} custom - Whether this is a custom player
   */
  async function openDbPlayerCard(playerId, custom) {
    if (custom === undefined) custom = false;
    console.log('[DatabasePlayerCard] Opening card for player ' + playerId + ', custom: ' + custom);

    currentDbPlayerId = playerId;
    isCustomPlayer = custom;
    hasUnsavedChanges = false;

    try {
      // Check if database API is available
      if (!window.electronAPI || !window.electronAPI.database) {
        console.error('[DatabasePlayerCard] electronAPI.database not available');
        alert('Database API not available. Please reload the application.');
        return;
      }

      // Ensure dropdowns are populated before loading player data
      var positionSelect = document.getElementById('dbPlayerPosition');
      if (!positionSelect || positionSelect.options.length <= 1) {
        console.log('[DatabasePlayerCard] Dropdowns not ready, loading...');
        await loadDropdownOptions();
      }

      // Get merged player data (original + edits)
      // Note: The backend handler waits for the database service to be ready
      var result = await window.electronAPI.database.getMergedPlayer(playerId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to load player');
      }

      currentDbPlayer = result.player;
      console.log('[DatabasePlayerCard] Player data received:', currentDbPlayer);
      console.log('[DatabasePlayerCard] Position value:', currentDbPlayer.position);

      // Populate the form
      populatePlayerForm(currentDbPlayer);

      // Set up year selector (async - fetches from DB)
      await setupYearSelector(currentDbPlayer);

      // Check if player has edits
      updateEditedIndicator();

      // Show the modal - reset all style properties that may have been set when closing
      var modal = document.getElementById('dbPlayerCardModal');
      if (modal) {
        modal.style.display = 'flex';
      }

      updateSaveButtonState();

    } catch (error) {
      console.error('[DatabasePlayerCard] Failed to open player card:', error);
      alert('Failed to load player: ' + error.message);
    }
  }

  /**
   * Create a new custom player (opens modal in create mode)
   */
  async function createNewDbPlayer() {
    console.log('[DatabasePlayerCard] Opening create new player mode');

    // Reset state for create mode
    currentDbPlayer = null;
    currentDbPlayerId = null;
    isCustomPlayer = true;  // New players are custom players
    isCreateMode = true;
    hasUnsavedChanges = false;
    selectedYear = null;
    availableYears = [];
    originalSeasonData = null;

    // Ensure dropdowns are populated
    var positionSelect = document.getElementById('dbPlayerPosition');
    if (!positionSelect || positionSelect.options.length <= 1) {
      console.log('[DatabasePlayerCard] Dropdowns not ready, loading...');
      await loadDropdownOptions();
    }

    // Clear all form fields
    clearPlayerForm();

    // Update UI for create mode
    var nameEl = document.getElementById('dbPlayerCardName');
    if (nameEl) {
      nameEl.textContent = 'New Custom Player';
    }

    // Hide the "Edited" indicator
    var indicator = document.getElementById('dbPlayerEditedIndicator');
    if (indicator) {
      indicator.style.display = 'none';
    }

    // Hide the Reset button in create mode
    var resetBtn = document.getElementById('resetDbPlayerBtn');
    if (resetBtn) {
      resetBtn.style.display = 'none';
    }

    // Change save button text
    var saveBtn = document.getElementById('saveDbPlayerCardBtn');
    if (saveBtn) {
      saveBtn.textContent = 'Create Player';
      saveBtn.disabled = false;  // Enable button for new player
    }

    // Clear portrait
    var portraitEl = document.getElementById('dbPlayerCardPortrait');
    if (portraitEl) {
      portraitEl.src = '';
      portraitEl.style.display = 'none';
    }

    // Clear year selector
    var yearSelect = document.getElementById('dbPlayerYearSelect');
    if (yearSelect) {
      yearSelect.innerHTML = '<option value="">Select Year for Ratings</option>';
    }

    // Clear ratings form
    clearRatingsForm();

    // Show the modal - reset all style properties that may have been set when closing
    var modal = document.getElementById('dbPlayerCardModal');
    if (modal) {
      modal.style.display = 'flex';
    }

    // Focus on first name field
    var firstNameInput = document.getElementById('dbPlayerFirstName');
    if (firstNameInput) {
      setTimeout(function() {
        firstNameInput.focus();
      }, 100);
    }
  }

  /**
   * Clear all player form fields
   */
  function clearPlayerForm() {
    // Basic info
    setValue('dbPlayerFirstName', '');
    setValue('dbPlayerLastName', '');
    setValue('dbPlayerCollege', '');
    setValue('dbPlayerPosition', '');
    setValue('dbPlayerHometown', '');
    setValue('dbPlayerHeight', '');
    setValue('dbPlayerWeight', '');
    setValue('dbPlayerRace', '');
    setValue('dbPlayerHomeState', '');

    // Draft info
    setValue('dbPlayerDraftClass', '');
    setValue('dbPlayerDraftRound', '');
    setValue('dbPlayerDraftPick', '');

    // Career info
    setValue('dbPlayerCareerFrom', '');
    setValue('dbPlayerCareerTo', '');

    // Madden IDs
    setValue('dbPlayerPID', '');
    setValue('dbPlayerPAM', '');
    setValue('dbPlayerPLPO', '');
    setValue('dbPlayerCommID', '');

    // Stats
    setValue('dbPlayerAP1', '');
    setValue('dbPlayerPB', '');
    setValue('dbPlayerSt', '');
    setValue('dbPlayerWAV', '');
    setChecked('dbPlayerHOF', false);
  }

  /**
   * Populate the player form with data
   */
  function populatePlayerForm(player) {
    console.log('[DatabasePlayerCard] Populating form with player:', player);

    // Basic info - use actual API field names
    setValue('dbPlayerFirstName', player.firstName || '');
    setValue('dbPlayerLastName', player.lastName || '');
    // College: convert name to ID using the stored mapping
    var collegeId = '';
    if (player.college) {
      // Try to find the ID from the name->id mapping
      var collegeName = String(player.college).toLowerCase().trim();
      if (window._collegeNameToId && window._collegeNameToId[collegeName]) {
        collegeId = window._collegeNameToId[collegeName];
      } else {
        // If it's already a number (ID), use it directly
        var numVal = parseInt(player.college, 10);
        if (!isNaN(numVal)) {
          collegeId = numVal;
        }
      }
    }
    setValue('dbPlayerCollege', collegeId);
    setValue('dbPlayerPosition', player.position || '');
    setValue('dbPlayerHometown', player.hometown || '');  // Replaced jersey with hometown
    setValue('dbPlayerHeight', player.height || '');
    setValue('dbPlayerWeight', player.weight || '');
    setValue('dbPlayerRace', player.race !== undefined ? player.race : '');
    setValue('dbPlayerHomeState', player.homeState || '');

    // Draft info - API uses 'round' and 'pick', not 'draftRound' and 'draftPick'
    setValue('dbPlayerDraftClass', player.draftClass || '');
    setValue('dbPlayerDraftRound', player.round || '');
    setValue('dbPlayerDraftPick', player.pick || '');

    // Career info
    setValue('dbPlayerCareerFrom', player.careerFrom || '');
    setValue('dbPlayerCareerTo', player.careerTo || '');

    // Madden IDs - API uses 'pid', 'pam', 'plpo', 'commID'
    setValue('dbPlayerPID', player.pid || '');
    setValue('dbPlayerPAM', player.pam || '');
    setValue('dbPlayerPLPO', player.plpo || '');
    setValue('dbPlayerCommID', player.commID || '');

    // Stats
    setValue('dbPlayerAP1', player.ap1 || 0);
    setValue('dbPlayerPB', player.pb || 0);
    setValue('dbPlayerSt', player.st || 0);
    setValue('dbPlayerWAV', player.wav || 0);
    setChecked('dbPlayerHOF', player.isHOF || false);  // API uses 'isHOF' not 'isHof'

    // Display name in header
    var nameEl = document.getElementById('dbPlayerCardName');
    if (nameEl) {
      nameEl.textContent = ((player.firstName || '') + ' ' + (player.lastName || '')).trim() || 'Unknown Player';
    }

    // Portrait (if PID exists)
    loadPlayerPortrait(player.pid);
  }

  /**
   * Load player portrait by PID
   */
  async function loadPlayerPortrait(pid) {
    var portraitEl = document.getElementById('dbPlayerCardPortrait');
    if (!portraitEl) {
      console.warn('[DbPlayerCard] Portrait element not found');
      return;
    }

    if (!pid) {
      console.log('[DbPlayerCard] No PID provided for portrait');
      portraitEl.src = '';
      portraitEl.style.display = 'none';
      return;
    }

    console.log('[DbPlayerCard] Loading portrait for PID:', pid);

    try {
      // Try getByPID first - returns full data URL already
      var imageData = await window.electronAPI.portrait.getByPID(pid);
      if (imageData) {
        // imageData is already a full data URL (data:image/png;base64,...)
        portraitEl.src = imageData;
        portraitEl.style.display = 'block';
        console.log('[DbPlayerCard] Portrait loaded successfully for PID:', pid);
        return;
      }

      // If no image found, try with PLPO if available
      console.log('[DbPlayerCard] No portrait found for PID:', pid, '- checking if player has PLPO');
      if (currentDbPlayer && currentDbPlayer.plpo) {
        console.log('[DbPlayerCard] Trying PLPO:', currentDbPlayer.plpo);
        var plpoData = await window.electronAPI.portrait.getByPLPO(currentDbPlayer.plpo);
        if (plpoData) {
          // plpoData is already a full data URL
          portraitEl.src = plpoData;
          portraitEl.style.display = 'block';
          console.log('[DbPlayerCard] Portrait loaded via PLPO');
          return;
        }
      }

      // No portrait found
      console.log('[DbPlayerCard] No portrait available for player');
      portraitEl.src = '';
      portraitEl.style.display = 'none';
    } catch (error) {
      console.error('[DatabasePlayerCard] Failed to load portrait:', error);
      portraitEl.src = '';
      portraitEl.style.display = 'none';
    }
  }

  /**
   * Set up the year selector based on player's career span
   */
  async function setupYearSelector(player) {
    var yearSelect = document.getElementById('dbPlayerYearSelect');
    if (!yearSelect) return;

    availableYears = [];
    yearSelect.innerHTML = '<option value="">Select Year for Ratings</option>';

    // Get career span info
    var draftYear = parseInt(player.draftClass);
    var careerFrom = parseInt(player.careerFrom);
    var careerTo = parseInt(player.careerTo);

    // Determine the start year (earliest of draft year or career from)
    var startYear = draftYear;
    if (!startYear || isNaN(startYear)) {
      startYear = careerFrom;
    } else if (careerFrom && !isNaN(careerFrom) && careerFrom < startYear) {
      startYear = careerFrom;
    }

    // Determine end year
    var endYear = careerTo;
    if (!endYear || isNaN(endYear)) {
      endYear = new Date().getFullYear();
    }

    // Fetch actual years with season data from database (to mark which have data)
    var yearsWithData = [];
    try {
      var result = await window.electronAPI.database.getPlayerSeasonYears(player.internalId);
      if (result.success && result.years && result.years.length > 0) {
        yearsWithData = result.years;
        console.log('[DbPlayerCard] Found', yearsWithData.length, 'seasons with data');
      }
    } catch (error) {
      console.error('[DbPlayerCard] Error fetching season years:', error);
    }

    // Build full year range from start to end
    if (startYear && endYear && !isNaN(startYear) && !isNaN(endYear)) {
      for (var year = startYear; year <= endYear; year++) {
        availableYears.push(year);
      }
      console.log('[DbPlayerCard] Career span:', startYear, '-', endYear, '(' + availableYears.length + ' years)');
    } else {
      // Fallback - just use years with data
      availableYears = yearsWithData.slice();
      console.log('[DbPlayerCard] Using only years with data:', availableYears.length);
    }

    // Populate dropdown
    availableYears.forEach(function(year) {
      var opt = document.createElement('option');
      opt.value = year;
      // Mark special years
      var label = year.toString();
      if (year === draftYear) {
        label += ' (Draft)';
      }
      // Mark if has data
      if (yearsWithData.indexOf(year) !== -1) {
        label += ' *'; // Asterisk indicates year has season data
      }
      opt.textContent = label;
      yearSelect.appendChild(opt);
    });

    // Add option for custom years
    var customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = '+ Add Custom Year';
    yearSelect.appendChild(customOpt);

    selectedYear = null;
    originalSeasonData = null;
    clearRatingsForm();
  }

  /**
   * Refresh year selector based on current form values
   * Called when careerFrom or careerTo inputs change
   */
  async function refreshYearSelectorFromForm() {
    if (!currentDbPlayer) return;

    // Read current form values
    var draftYear = parseInt(getValue('dbPlayerDraftClass'));
    var careerFrom = parseInt(getValue('dbPlayerCareerFrom'));
    var careerTo = parseInt(getValue('dbPlayerCareerTo'));

    console.log('[DbPlayerCard] Refreshing year selector with form values:',
      'draftYear:', draftYear, 'from:', careerFrom, 'to:', careerTo);

    // Create a temporary player object with the updated values
    var updatedPlayer = Object.assign({}, currentDbPlayer, {
      draftClass: isNaN(draftYear) ? currentDbPlayer.draftClass : draftYear,
      careerFrom: isNaN(careerFrom) ? currentDbPlayer.careerFrom : careerFrom,
      careerTo: isNaN(careerTo) ? currentDbPlayer.careerTo : careerTo
    });

    // Rebuild the year selector with updated dates
    await setupYearSelector(updatedPlayer);
  }

  /**
   * Handle year selection change
   */
  async function onYearChange(e) {
    var year = e.target.value;

    if (year === 'custom') {
      var customYear = prompt('Enter year (e.g., 2024):');
      if (customYear && /^\d{4}$/.test(customYear)) {
        selectedYear = parseInt(customYear);
        // Add to dropdown if not exists
        var yearSelect = document.getElementById('dbPlayerYearSelect');
        if (availableYears.indexOf(selectedYear) === -1) {
          var opt = document.createElement('option');
          opt.value = selectedYear;
          opt.textContent = selectedYear;
          // Insert before "Add Custom Year"
          yearSelect.insertBefore(opt, yearSelect.lastElementChild);
          availableYears.push(selectedYear);
        }
        yearSelect.value = selectedYear;
      } else {
        e.target.value = '';
        return;
      }
    } else if (year) {
      selectedYear = parseInt(year);
    } else {
      selectedYear = null;
      originalSeasonData = null;
      clearRatingsForm();
      return;
    }

    await loadRatingsForYear(selectedYear);
  }

  /**
   * Load ratings for a specific year
   */
  async function loadRatingsForYear(year) {
    if (!year || !currentDbPlayerId) return;

    try {
      console.log('[DbPlayerCard] Loading ratings for year:', year, 'player:', currentDbPlayerId);
      var result = await window.electronAPI.database.getMergedPlayerSeason(currentDbPlayerId, year);

      if (result.success && result.season) {
        console.log('[DbPlayerCard] Season data loaded:', {
          team: result.season.team,
          position: result.season.position,
          archetype: result.season.archetype,
          age: result.season.age,
          jersey: result.season.jersey
        });
        // Store original values for change detection
        originalSeasonData = JSON.parse(JSON.stringify(result.season));
        populateRatingsForm(result.season);
      } else {
        // No ratings for this year - show empty form
        console.log('[DbPlayerCard] No season data found for year:', year);
        originalSeasonData = null;
        clearRatingsForm();
      }
    } catch (error) {
      console.error('[DatabasePlayerCard] Failed to load ratings:', error);
      clearRatingsForm();
    }
  }

  /**
   * Update the archetype dropdown based on the selected position
   * @param {string} position - The position to get archetypes for
   * @param {string} selectedValue - Optional value to select after populating
   */
  async function updateArchetypeDropdown(position, selectedValue) {
    var archetypeSelect = document.getElementById('dbPlayerSeasonArchetype');
    if (!archetypeSelect) return;

    // Clear existing options
    archetypeSelect.innerHTML = '';

    if (!position) {
      archetypeSelect.innerHTML = '<option value="">Select Position First</option>';
      return;
    }

    try {
      // Get archetypes for this position from the rating API
      var archetypes = await window.electronAPI.rating.getArchetypes(position);
      console.log('[DbPlayerCard] Archetypes for', position, ':', archetypes);

      if (archetypes && archetypes.length > 0) {
        archetypeSelect.innerHTML = '<option value="">Select Archetype</option>';
        archetypes.forEach(function(arch) {
          var opt = document.createElement('option');
          opt.value = arch.name;  // Use full name like "QB Field General"
          opt.textContent = arch.name;
          archetypeSelect.appendChild(opt);
        });

        // If a value was provided, try to select it
        if (selectedValue) {
          // First try exact match
          var found = false;
          for (var i = 0; i < archetypeSelect.options.length; i++) {
            if (archetypeSelect.options[i].value === selectedValue) {
              archetypeSelect.value = selectedValue;
              found = true;
              console.log('[DbPlayerCard] Archetype set to:', selectedValue);
              break;
            }
          }
          // If not found, try partial match (e.g., "Strong Arm" matches "QB Strong Arm")
          if (!found && selectedValue) {
            for (var j = 0; j < archetypeSelect.options.length; j++) {
              if (archetypeSelect.options[j].value.indexOf(selectedValue) !== -1 ||
                  selectedValue.indexOf(archetypeSelect.options[j].value) !== -1) {
                archetypeSelect.value = archetypeSelect.options[j].value;
                console.log('[DbPlayerCard] Archetype partial match:', archetypeSelect.options[j].value);
                break;
              }
            }
          }
        }
      } else {
        archetypeSelect.innerHTML = '<option value="">No archetypes for ' + position + '</option>';
      }
    } catch (error) {
      console.error('[DbPlayerCard] Failed to load archetypes:', error);
      archetypeSelect.innerHTML = '<option value="">Error loading archetypes</option>';
    }
  }

  /**
   * Populate the ratings form
   */
  function populateRatingsForm(season) {
    // Season-specific info
    setValue('dbPlayerSeasonTeam', season.team || '');
    setValue('dbPlayerSeasonJersey', season.jersey || '');
    setValue('dbPlayerSeasonAge', season.age || '');

    // For position dropdown, need to ensure the value matches an option
    var positionSelect = document.getElementById('dbPlayerSeasonPosition');
    var positionValue = season.position || '';
    var archetypeValue = season.archetype || '';
    if (positionSelect) {
      // Check if value exists in dropdown options
      var found = false;
      for (var i = 0; i < positionSelect.options.length; i++) {
        if (positionSelect.options[i].value === positionValue) {
          found = true;
          break;
        }
      }
      if (found) {
        positionSelect.value = positionValue;
        console.log('[DbPlayerCard] Position set to:', positionValue);
      } else {
        console.log('[DbPlayerCard] Position value not found in dropdown:', positionValue);
        // Set to empty if not found
        positionSelect.value = '';
      }
    }

    // Update archetype dropdown based on position, then select the value
    updateArchetypeDropdown(positionValue, archetypeValue);

    // All rating fields - ratings are in nested 'ratings' object
    var ratings = season.ratings || {};
    RATING_FIELDS.forEach(function(item) {
      var inputId = 'dbRating_' + item.field;
      setValue(inputId, ratings[item.field] !== undefined ? ratings[item.field] : '');
    });
  }

  /**
   * Clear the ratings form
   */
  function clearRatingsForm() {
    setValue('dbPlayerSeasonTeam', '');
    setValue('dbPlayerSeasonJersey', '');
    setValue('dbPlayerSeasonAge', '');
    setValue('dbPlayerSeasonPosition', '');

    // Reset archetype dropdown
    var archetypeSelect = document.getElementById('dbPlayerSeasonArchetype');
    if (archetypeSelect) {
      archetypeSelect.innerHTML = '<option value="">Select Position First</option>';
    }

    // Reset "Apply to all years" checkboxes
    setChecked('dbApplyToAllYears', false);
    setChecked('dbIncrementAgeEachYear', false);

    RATING_FIELDS.forEach(function(item) {
      setValue('dbRating_' + item.field, '');
    });
  }

  /**
   * Save changes to the player
   */
  async function saveDbPlayerChanges() {
    // Handle create mode - create a new custom player
    if (isCreateMode) {
      try {
        var firstName = getValue('dbPlayerFirstName');
        var lastName = getValue('dbPlayerLastName');

        if (!firstName.trim() || !lastName.trim()) {
          alert('First Name and Last Name are required.');
          return;
        }

        var playerData = {
          firstName: firstName,
          lastName: lastName,
          collegeId: getIntValue('dbPlayerCollege'),
          position: getValue('dbPlayerPosition'),
          hometown: getValue('dbPlayerHometown'),
          height: getIntValue('dbPlayerHeight'),
          weight: getIntValue('dbPlayerWeight'),
          race: getIntValue('dbPlayerRace'),
          homeState: getValue('dbPlayerHomeState'),
          draftClass: getIntValue('dbPlayerDraftClass'),
          draftRound: getValue('dbPlayerDraftRound'),
          draftPick: getIntValue('dbPlayerDraftPick'),
          careerFrom: getIntValue('dbPlayerCareerFrom'),
          careerTo: getIntValue('dbPlayerCareerTo'),
          maddenPid: getIntValue('dbPlayerPID'),
          maddenPam: getValue('dbPlayerPAM'),
          maddenPlpo: getValue('dbPlayerPLPO'),
          maddenCommid: getValue('dbPlayerCommID')
        };

        console.log('[DatabasePlayerCard] Creating new custom player:', playerData);
        var result = await window.electronAPI.database.createCustomPlayer(playerData);

        if (!result.success) {
          throw new Error(result.error || 'Failed to create player');
        }

        console.log('[DatabasePlayerCard] Player created with ID:', result.playerId);

        // Reset create mode state
        isCreateMode = false;
        hasUnsavedChanges = false;

        // Reset UI for next time
        var saveBtn = document.getElementById('saveDbPlayerCardBtn');
        if (saveBtn) saveBtn.textContent = 'Save Changes';
        var resetBtn = document.getElementById('resetDbPlayerBtn');
        if (resetBtn) resetBtn.style.display = 'inline-block';

        // Close the modal
        var modal = document.getElementById('dbPlayerCardModal');
        if (modal) {
          modal.style.display = 'none';
        }

        // Clear module state
        currentDbPlayer = null;
        currentDbPlayerId = null;

        // Refresh player browser if open
        if (typeof window.refreshPlayerBrowser === 'function') {
          window.refreshPlayerBrowser();
        }

        // Use centralized focus restoration
        if (typeof window.restoreFocusToPlayerBrowser === 'function') {
          window.restoreFocusToPlayerBrowser();
        }

        return;
      } catch (error) {
        console.error('[DatabasePlayerCard] Failed to create player:', error);
        alert('Failed to create player: ' + error.message);
        return;
      }
    }

    if (!currentDbPlayerId) return;

    try {
      // Collect player edits
      var playerEdits = {
        firstName: getValue('dbPlayerFirstName'),
        lastName: getValue('dbPlayerLastName'),
        collegeId: getIntValue('dbPlayerCollege'),
        position: getValue('dbPlayerPosition'),
        hometown: getValue('dbPlayerHometown'),
        height: getIntValue('dbPlayerHeight'),
        weight: getIntValue('dbPlayerWeight'),
        race: getIntValue('dbPlayerRace'),
        homeState: getValue('dbPlayerHomeState'),
        draftClass: getIntValue('dbPlayerDraftClass'),
        draftRound: getValue('dbPlayerDraftRound'),
        draftPick: getIntValue('dbPlayerDraftPick'),
        careerFrom: getIntValue('dbPlayerCareerFrom'),
        careerTo: getIntValue('dbPlayerCareerTo')
      };
      console.log('[DatabasePlayerCard] Saving playerEdits:', playerEdits);

      // Collect appearance edits
      var appearanceEdits = {
        maddenPid: getIntValue('dbPlayerPID'),
        maddenPam: getValue('dbPlayerPAM'),
        maddenPlpo: getValue('dbPlayerPLPO'),
        maddenCommid: getValue('dbPlayerCommID')
      };

      // Save player edits
      var playerResult = await window.electronAPI.database.savePlayerEdit(currentDbPlayerId, playerEdits);
      if (!playerResult.success) {
        throw new Error(playerResult.error || 'Failed to save player edits');
      }

      // Save appearance edits
      var appearanceResult = await window.electronAPI.database.saveAppearanceEdit(currentDbPlayerId, appearanceEdits);
      if (!appearanceResult.success) {
        throw new Error(appearanceResult.error || 'Failed to save appearance edits');
      }

      // Check "Apply to ALL years" checkbox FIRST - it works even without a year selected
      var applyToAllYears = getChecked('dbApplyToAllYears');
      console.log('[DatabasePlayerCard] selectedYear:', selectedYear, 'applyToAllYears:', applyToAllYears);

      if (applyToAllYears) {
        // User checked "Apply to all years" - collect ONLY CHANGED fields
        var seasonEdits = collectSeasonEdits(true); // true = only changed fields
        var changedFieldCount = Object.keys(seasonEdits).length;
        var incrementAgeEachYear = getChecked('dbIncrementAgeEachYear');

        if (changedFieldCount === 0) {
          alert('No changes detected. Edit some fields first, then try again.');
          return;
        }

        // Build confirmation message
        var changedFieldNames = Object.keys(seasonEdits).join(', ');
        var confirmMsg = 'Apply changes to ALL years for this player?\n\n' +
          'Changed fields (' + changedFieldCount + '): ' + changedFieldNames + '\n\n';

        if (incrementAgeEachYear && seasonEdits.age !== undefined) {
          confirmMsg += 'Age will INCREMENT by 1 for each subsequent year (starting at ' + seasonEdits.age + ').\n\n';
        }

        confirmMsg += 'Only these fields will be updated. Other ratings will remain unchanged in each year.\n\nContinue?';

        var confirmed = confirm(confirmMsg);
        if (!confirmed) {
          return; // User cancelled
        }

        // Apply to all years with options
        var options = {
          incrementAge: incrementAgeEachYear && seasonEdits.age !== undefined
        };
        console.log('[DatabasePlayerCard] Applying edits to ALL years. Changed fields:', seasonEdits, 'Options:', options);
        var allYearsResult = await window.electronAPI.database.saveSeasonEditAllYears(
          currentDbPlayerId,
          seasonEdits,
          options
        );
        if (!allYearsResult.success) {
          throw new Error(allYearsResult.error || 'Failed to save to all years');
        }
        console.log('[DatabasePlayerCard] Updated', allYearsResult.updatedYears?.length || 0, 'seasons');

        // Uncheck the checkboxes after save
        setChecked('dbApplyToAllYears', false);
        setChecked('dbIncrementAgeEachYear', false);
      } else if (selectedYear) {
        // Save to specific year only - save ALL form values (not just changed)
        var seasonEdits = collectSeasonEdits(false); // false = all fields
        var seasonResult = await window.electronAPI.database.saveSeasonEdit(currentDbPlayerId, selectedYear, seasonEdits);
        if (!seasonResult.success) {
          throw new Error(seasonResult.error || 'Failed to save season edits');
        }
      } else {
        // No year selected and no "apply to all" - we're on Player Info tab
        // Check if position changed and warn user
        var position = getValue('dbPlayerPosition');
        if (position && position !== currentDbPlayer.position) {
          var confirmed = confirm(
            'WARNING: You changed the position on the Player Info tab.\n\n' +
            'This will update the base player position but NOT the per-year ratings.\n\n' +
            'To update position in all season ratings, go to the Ratings tab, select a year, ' +
            'and check "Apply changes to ALL years".\n\n' +
            'Do you want to save just the base player info?'
          );
          if (!confirmed) {
            return; // User cancelled
          }
        }
      }

      hasUnsavedChanges = false;
      updateSaveButtonState();
      updateEditedIndicator();

      console.log('[DatabasePlayerCard] Changes saved successfully');

      // Show brief success indication
      var saveBtn = document.getElementById('saveDbPlayerCardBtn');
      if (saveBtn) {
        var originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.disabled = true;
        setTimeout(function() {
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        }, 1500);
      }

    } catch (error) {
      console.error('[DatabasePlayerCard] Failed to save changes:', error);
      alert('Failed to save changes: ' + error.message);
    }
  }

  /**
   * Collect season/rating edits from form
   * @param {boolean} onlyChangedFields - If true, only include fields that differ from original
   */
  function collectSeasonEdits(onlyChangedFields) {
    var edits = {};

    // Helper to check if value changed from original
    function hasChanged(field, currentValue) {
      if (!onlyChangedFields || !originalSeasonData) {
        return true; // Include all fields if not filtering or no original data
      }
      var originalValue = originalSeasonData[field];
      // Compare as strings to handle type differences (e.g., "85" vs 85)
      return String(currentValue) !== String(originalValue);
    }

    // Season info fields
    var team = getValue('dbPlayerSeasonTeam');
    if (team !== null && team !== undefined && hasChanged('team', team)) {
      edits.team = team;
    }

    var jersey = getIntValue('dbPlayerSeasonJersey');
    if (jersey !== null && jersey !== undefined && hasChanged('jersey', jersey)) {
      edits.jersey = jersey;
    }

    var age = getIntValue('dbPlayerSeasonAge');
    if (age !== null && age !== undefined && hasChanged('age', age)) {
      edits.age = age;
    }

    var position = getValue('dbPlayerSeasonPosition');
    if (position !== null && position !== undefined && hasChanged('position', position)) {
      edits.position = position;
    }

    var archetype = getValue('dbPlayerSeasonArchetype');
    if (archetype !== null && archetype !== undefined && hasChanged('archetype', archetype)) {
      edits.archetype = archetype;
    }

    // Collect rating values - only include changed ones if filtering
    RATING_FIELDS.forEach(function(item) {
      var val = getIntValue('dbRating_' + item.field);
      if (val !== null && val !== undefined && hasChanged(item.field, val)) {
        edits[item.field] = val;
      }
    });

    return edits;
  }

  /**
   * Reset player to original state
   */
  async function resetDbPlayer() {
    if (!currentDbPlayerId) return;

    var confirmed = confirm('Are you sure you want to reset this player to original values? All your edits will be lost.');
    if (!confirmed) return;

    try {
      var result = await window.electronAPI.database.resetPlayer(currentDbPlayerId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to reset player');
      }

      // Reload the player data
      await openDbPlayerCard(currentDbPlayerId, isCustomPlayer);

      console.log('[DatabasePlayerCard] Player reset successfully');

    } catch (error) {
      console.error('[DatabasePlayerCard] Failed to reset player:', error);
      alert('Failed to reset player: ' + error.message);
    }
  }

  /**
   * Clear all season data for this player
   * This fixes wrongly-assigned seasons (e.g., when two players with same name had their seasons mixed up)
   */
  async function clearPlayerSeasons() {
    if (!currentDbPlayerId) return;

    var playerName = currentDbPlayer ? ((currentDbPlayer.firstName || '') + ' ' + (currentDbPlayer.lastName || '')).trim() : 'this player';

    var confirmed = confirm(
      'Clear ALL season/ratings data for ' + playerName + '?\n\n' +
      'This is useful if this player has incorrectly-assigned seasons from another player with the same name.\n\n' +
      'After clearing, you can manually add correct season data using the Ratings tab.\n\n' +
      'This action cannot be undone. Continue?'
    );
    if (!confirmed) return;

    try {
      var result = await window.electronAPI.database.clearPlayerSeasons(currentDbPlayerId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to clear seasons');
      }

      // Clear the ratings form since seasons are now gone
      clearRatingsForm();
      selectedYear = null;
      originalSeasonData = null;

      // Reset year selector
      var yearSelect = document.getElementById('dbPlayerYearSelect');
      if (yearSelect) {
        yearSelect.innerHTML = '<option value="">No season data - select year to add</option>';
        // Add option to add custom year
        var customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = '+ Add Custom Year';
        yearSelect.appendChild(customOpt);
      }

      console.log('[DatabasePlayerCard] Seasons cleared successfully. Deleted:', result.deletedCount);
      alert('Cleared ' + (result.deletedCount || 0) + ' season records.\n\nYou can now add correct season data using the Ratings tab.');

    } catch (error) {
      console.error('[DatabasePlayerCard] Failed to clear seasons:', error);
      alert('Failed to clear seasons: ' + error.message);
    }
  }

  /**
   * Add player to roster editor
   */
  async function addPlayerToRoster() {
    if (!currentDbPlayerId) return;

    // This will be implemented in Phase 4
    alert('Add to Roster functionality will be available soon!');
  }

  /**
   * Add player to draft class editor
   */
  async function addPlayerToDraft() {
    if (!currentDbPlayerId) return;

    // This will be implemented in Phase 4
    alert('Add to Draft Class functionality will be available soon!');
  }

  /**
   * Close the modal
   */
  function closeDbPlayerCard() {
    if (hasUnsavedChanges) {
      var confirmed = confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) {
        // Focus was lost due to confirm dialog - no action needed, user stays in card
        return;
      }
    }

    var modal = document.getElementById('dbPlayerCardModal');
    if (modal) {
      // Blur any focused element inside the modal to clean up focus state
      var focusedElement = modal.querySelector(':focus');
      if (focusedElement) {
        focusedElement.blur();
      }

      // Also blur document.activeElement if it's inside the modal
      if (document.activeElement && modal.contains(document.activeElement)) {
        document.activeElement.blur();
      }

      modal.style.display = 'none';

      // Use centralized focus restoration for player browser
      if (typeof window.restoreFocusToPlayerBrowser === 'function') {
        window.restoreFocusToPlayerBrowser();
      }
    }

    currentDbPlayer = null;
    currentDbPlayerId = null;
    hasUnsavedChanges = false;

    // Reset create mode and restore UI if needed
    if (isCreateMode) {
      isCreateMode = false;
      // Restore button text
      var saveBtn = document.getElementById('saveDbPlayerCardBtn');
      if (saveBtn) saveBtn.textContent = 'Save Changes';
      // Show Reset button
      var resetBtn = document.getElementById('resetDbPlayerBtn');
      if (resetBtn) resetBtn.style.display = 'inline-block';
    }
  }

  /**
   * Update the "Edited" indicator
   */
  async function updateEditedIndicator() {
    var indicator = document.getElementById('dbPlayerEditedIndicator');
    if (!indicator) return;

    try {
      var result = await window.electronAPI.database.hasPlayerEdit(currentDbPlayerId);
      indicator.style.display = result.hasEdit ? 'inline-block' : 'none';
    } catch (error) {
      indicator.style.display = 'none';
    }
  }

  /**
   * Update save button state
   */
  function updateSaveButtonState() {
    var saveBtn = document.getElementById('saveDbPlayerCardBtn');
    if (saveBtn) {
      saveBtn.disabled = !hasUnsavedChanges;
    }
  }

  // Helper functions
  function setValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value;
  }

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function getIntValue(id) {
    var val = getValue(id);
    var num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  }

  function setChecked(id, checked) {
    var el = document.getElementById(id);
    if (el) el.checked = checked;
  }

  function getChecked(id) {
    var el = document.getElementById(id);
    return el ? el.checked : false;
  }

  // Make functions available globally
  window.openDbPlayerCard = openDbPlayerCard;
  window.closeDbPlayerCard = closeDbPlayerCard;
  window.createNewDbPlayer = createNewDbPlayer;
  window.initDatabasePlayerCard = initDatabasePlayerCard;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDatabasePlayerCard);
  } else {
    initDatabasePlayerCard();
  }

})();
