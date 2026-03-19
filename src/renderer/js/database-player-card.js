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
    // Physical - these use DB field names
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
    // Running - DB field names
    { field: 'PBCV', label: 'Ball Carrier Vision', category: 'running' },
    { field: 'PBTK', label: 'Break Tackle', category: 'running' },
    { field: 'PTRK', label: 'Trucking', category: 'running' },
    { field: 'PSFA', label: 'Stiff Arm', category: 'running' },
    { field: 'PSPN', label: 'Spin Move', category: 'running' },
    { field: 'PJKM', label: 'Juke Move', category: 'running' },
    { field: 'PCAR', label: 'Carrying', category: 'running' },
    // Passing - DB field names
    { field: 'PTHA', label: 'Throw Accuracy', category: 'passing' },
    { field: 'PTAS', label: 'Throw Accuracy Short', category: 'passing' },
    { field: 'PTAM', label: 'Throw Accuracy Mid', category: 'passing' },
    { field: 'PTAD', label: 'Throw Accuracy Deep', category: 'passing' },
    { field: 'PTOR', label: 'Throw on the Run', category: 'passing' },
    { field: 'PTUP', label: 'Throw Under Pressure', category: 'passing' },
    { field: 'PPWR', label: 'Throw Power', category: 'passing' },
    { field: 'PPLA', label: 'Play Action', category: 'passing' },
    // Receiving - DB field names
    { field: 'PCTH', label: 'Catching', category: 'receiving' },
    { field: 'PSPC', label: 'Spectacular Catch', category: 'receiving' },
    { field: 'PCIT', label: 'Catch in Traffic', category: 'receiving' },
    { field: 'PSRR', label: 'Short Route Running', category: 'receiving' },
    { field: 'PMRR', label: 'Medium Route Running', category: 'receiving' },
    { field: 'PDRR', label: 'Deep Route Running', category: 'receiving' },
    { field: 'PREL', label: 'Release', category: 'receiving' },
    // Blocking - DB field names
    { field: 'PRBK', label: 'Run Block', category: 'blocking' },
    { field: 'PPBK', label: 'Pass Block', category: 'blocking' },
    { field: 'PIBK', label: 'Impact Blocking', category: 'blocking' },
    { field: 'PLBK', label: 'Lead Block', category: 'blocking' },
    { field: 'PRNS', label: 'Run Block Finesse', category: 'blocking' },
    { field: 'PRBS', label: 'Run Block Power', category: 'blocking' },
    { field: 'PPBF', label: 'Pass Block Finesse', category: 'blocking' },
    { field: 'PPBP', label: 'Pass Block Power', category: 'blocking' },
    // Defense - DB field names
    { field: 'PTAK', label: 'Tackling', category: 'defense' },
    { field: 'PHIT', label: 'Hit Power', category: 'defense' },
    { field: 'PPRS', label: 'Press', category: 'defense' },
    { field: 'PFMV', label: 'Finesse Moves', category: 'defense' },
    { field: 'PPWM', label: 'Power Moves', category: 'defense' },
    { field: 'PBSH', label: 'Block Shedding', category: 'defense' },
    { field: 'PPUR', label: 'Pursuit', category: 'defense' },
    { field: 'PPRC', label: 'Play Recognition', category: 'defense' },
    // Coverage - DB field names
    { field: 'PMCV', label: 'Man Coverage', category: 'coverage' },
    { field: 'PZCV', label: 'Zone Coverage', category: 'coverage' },
    // Kicking - DB field names
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

  // Map database player card field names to OVR calculator field codes
  // CRITICAL: The OVRWeightsCalculator uses official Madden roster field codes
  // The database may store data with different codes, so we map them here
  const DB_TO_OVR_FIELD_MAP = {
    'PSPD': 'PSPD', 'PACC': 'PACC', 'PSTR': 'PSTR', 'PAGI': 'PAGI', 'PJMP': 'PJMP',
    'PSTM': 'PSTA', 'PSTA': 'PSTA', 'PINJ': 'PINJ', 'PTGH': 'PTGH', 'PAWR': 'PAWR',
    'PCOD': 'PELU', 'PELU': 'PELU', 'PBCV': 'PBCV',
    'PBTK': 'PBKT', 'PBKT': 'PBKT', 'PTRK': 'PLTR', 'PLTR': 'PLTR',
    'PSFA': 'PLSA', 'PLSA': 'PLSA', 'PSPN': 'PLSM', 'PLSM': 'PLSM',
    'PJKM': 'PLJM', 'PLJM': 'PLJM', 'PCAR': 'PCAR',
    'PTAS': 'PTAS', 'PTAM': 'PTAM', 'PTAD': 'PTAD',
    'PTOR': 'PTOR', 'PTUP': 'PTUP', 'PPWR': 'PTHP', 'PTHP': 'PTHP',
    'PCTH': 'PCTH', 'PSPC': 'PLSC', 'PLSC': 'PLSC', 'PCIT': 'PLCI', 'PLCI': 'PLCI',
    'PSRR': 'SRRN', 'SRRN': 'SRRN', 'PMRR': 'PMRR', 'PDRR': 'PDRR',
    'PREL': 'PLRL', 'PLRL': 'PLRL',
    'PRBK': 'PRBK', 'PPBK': 'PPBK', 'PIBK': 'PLIB', 'PLIB': 'PLIB', 'PLBK': 'PLBK',
    'PFMS': 'PFMS', 'PRNS': 'PRBF', 'PRBS': 'PRBS', 'PRBF': 'PRBF',  // PRNS in DB = Run Block Finesse (PRBF)
    'PPBF': 'PPBF', 'PPBP': 'PPBS', 'PPBS': 'PPBS',  // PPBP in DB = Pass Block Power (PPBS)
    'PTAK': 'PTAK',
    'PHIT': 'PLHT', 'PLHT': 'PLHT',
    'PFMV': 'PFMS', 'PPWM': 'PLPM', 'PLPM': 'PLPM',
    'PBSH': 'PBSG', 'PBSG': 'PBSG',
    'PPUR': 'PLPU', 'PLPU': 'PLPU',  // PPUR in old CSV = Pursuit, maps to PLPU
    'PPRC': 'PLPR', 'PLPR': 'PLPR',  // PPRC in old CSV = Play Recognition, maps to PLPR
    'PPLA': 'PPLA',  // Play Action stays as Play Action (QB attribute)
    'PMCV': 'PLMC', 'PLMC': 'PLMC', 'PZCV': 'PLZC', 'PLZC': 'PLZC',
    'PPRS': 'PLPE', 'PLPE': 'PLPE', 'PBSK': 'PBSK',
    'PKAC': 'PKAC', 'PKPW': 'PKPR', 'PKPR': 'PKPR', 'PKRT': 'PKRT'  // PKPW in DB = PKPR in roster (kick power)
  };

  // Reverse map: OVR calculator field codes to database field names
  // This converts roster/OVR codes to what's stored in the DB
  const OVR_TO_DB_FIELD_MAP = {
    'PSTA': 'PSTM', 'PELU': 'PCOD', 'PBKT': 'PBTK', 'PLTR': 'PTRK',
    'PLSA': 'PSFA', 'PLSM': 'PSPN', 'PLJM': 'PJKM', 'PTHP': 'PPWR',
    'PLSC': 'PSPC', 'PLCI': 'PCIT', 'SRRN': 'PSRR', 'PLRL': 'PREL',
    'PLIB': 'PIBK', 'PRBF': 'PRNS', 'PRBS': 'PRBS', 'PPBF': 'PPBF', 'PPBS': 'PPBP',
    'PLHT': 'PHIT', 'PLPM': 'PPWM', 'PBSG': 'PBSH', 'PFMS': 'PFMV',
    'PLPU': 'PPUR', 'PLPR': 'PPRC', 'PPLA': 'PPLA',
    'PLMC': 'PMCV', 'PLZC': 'PZCV', 'PLPE': 'PPRS',
    'PKPR': 'PKPW'  // Kick power: roster/OVR uses PKPR, DB uses PKPW
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

    // DEBUG: Track focus issues - log when modal inputs receive/lose focus
    var modal = document.getElementById('dbPlayerCardModal');
    if (modal) {
      modal.addEventListener('focusin', function(e) {
        console.log('[DEBUG] Focus IN:', e.target.tagName, e.target.id || e.target.className);
      });
      modal.addEventListener('focusout', function(e) {
        console.log('[DEBUG] Focus OUT:', e.target.tagName, e.target.id || e.target.className, '-> new focus:', document.activeElement?.tagName, document.activeElement?.id);
      });
      // DEBUG: Track if clicks are being received
      modal.addEventListener('click', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
          console.log('[DEBUG] Click on input:', e.target.tagName, e.target.id, 'disabled:', e.target.disabled, 'readonly:', e.target.readOnly);
        }
      }, true);
    }

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

    // Fill from PFR button
    var fillFromPFRBtn = document.getElementById('fillFromPFRBtn');
    if (fillFromPFRBtn) {
      fillFromPFRBtn.addEventListener('click', fillFromPFR);
    }

    // Delete Player button (only visible for custom players)
    var deleteBtn = document.getElementById('deleteDbPlayerBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', deleteDbPlayer);
    }

    // Assign Custom Portrait button
    var assignPortraitBtn = document.getElementById('assignCustomPortraitBtn');
    if (assignPortraitBtn) {
      assignPortraitBtn.addEventListener('click', openPortraitPicker);
    }

    // Portrait Picker Modal events
    var closePickerBtn = document.getElementById('closePortraitPickerModal');
    var cancelPickerBtn = document.getElementById('cancelPortraitPickerBtn');
    var confirmPickerBtn = document.getElementById('confirmPortraitPickerBtn');
    var importNewPortraitBtn = document.getElementById('importNewPortraitBtn');
    var pickerModal = document.getElementById('portraitPickerModal');

    if (closePickerBtn) closePickerBtn.addEventListener('click', closePortraitPicker);
    if (cancelPickerBtn) cancelPickerBtn.addEventListener('click', closePortraitPicker);
    if (confirmPickerBtn) confirmPickerBtn.addEventListener('click', confirmPortraitPicker);
    if (importNewPortraitBtn) importNewPortraitBtn.addEventListener('click', importNewPortraitFromPicker);
    if (pickerModal) {
      pickerModal.addEventListener('click', function(e) {
        if (e.target === pickerModal) closePortraitPicker();
      });
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

    // Year selector (Ratings tab)
    var yearSelect = document.getElementById('dbPlayerYearSelect');
    if (yearSelect) {
      console.log('[DbPlayerCard] Setting up year selector listener');
      yearSelect.addEventListener('change', onYearChange);
    } else {
      console.warn('[DbPlayerCard] dbPlayerYearSelect not found!');
    }

    // Player-level archetype selector - recalculates all OVR values when changed
    var archetypeSelect = document.getElementById('dbPlayerArchetype');
    if (archetypeSelect) {
      console.log('[DbPlayerCard] Setting up player-level archetype listener');
      archetypeSelect.addEventListener('change', onPlayerArchetypeChange);
    }

    // Career Stats year selector
    var statsYearSelect = document.getElementById('dbStatsYearSelect');
    if (statsYearSelect) {
      statsYearSelect.addEventListener('change', onCareerStatsYearChange);
    }

    // Calculate Rating from Stats button
    var calcRatingBtn = document.getElementById('btnCalculateRatingFromStats');
    if (calcRatingBtn) {
      calcRatingBtn.addEventListener('click', calculateRatingFromStats);
    }

    // Bulk Generate Ratings button
    var bulkRatingBtn = document.getElementById('btnBulkGenerateRatings');
    if (bulkRatingBtn) {
      bulkRatingBtn.addEventListener('click', bulkGenerateRatings);
    }

    // Refresh Career Stats button
    var refreshStatsBtn = document.getElementById('btnRefreshCareerStats');
    if (refreshStatsBtn) {
      refreshStatsBtn.addEventListener('click', refreshCareerStats);
    }

    // Bulk Rating Preview Modal buttons
    var closeBulkPreviewBtn = document.getElementById('closeBulkRatingPreview');
    var cancelBulkPreviewBtn = document.getElementById('cancelBulkRatingPreview');
    var applyBulkRatingsBtn = document.getElementById('applyBulkRatings');
    var bulkPreviewModal = document.getElementById('bulkRatingPreviewModal');

    if (closeBulkPreviewBtn) closeBulkPreviewBtn.addEventListener('click', closeBulkRatingPreviewModal);
    if (cancelBulkPreviewBtn) cancelBulkPreviewBtn.addEventListener('click', closeBulkRatingPreviewModal);
    if (applyBulkRatingsBtn) applyBulkRatingsBtn.addEventListener('click', applyBulkRatings);
    if (bulkPreviewModal) {
      bulkPreviewModal.addEventListener('click', function(e) {
        if (e.target === bulkPreviewModal) closeBulkRatingPreviewModal();
      });
    }

    // Track changes on all inputs - use both 'input' (immediate) and 'change' (on blur) events
    document.querySelectorAll('#dbPlayerCardModal input, #dbPlayerCardModal select').forEach(function(input) {
      // 'change' fires on blur for text inputs, immediately for selects
      input.addEventListener('change', function() {
        hasUnsavedChanges = true;
        updateSaveButtonState();
      });
      // 'input' fires immediately on every keystroke for text inputs
      if (input.type !== 'checkbox' && input.tagName !== 'SELECT') {
        input.addEventListener('input', function() {
          hasUnsavedChanges = true;
          updateSaveButtonState();
        });
      }
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

    // Team change listener - sync to career stats tab and ratings all-years table
    var seasonTeamSelect = document.getElementById('dbPlayerSeasonTeam');
    if (seasonTeamSelect) {
      seasonTeamSelect.addEventListener('change', async function() {
        console.log('[DbPlayerCard] Team changed, syncing to other views');
        // Small delay to allow save to complete
        setTimeout(async function() {
          // Refresh career stats to show updated team
          if (currentDbPlayer && careerStatsData) {
            await renderCareerStatsAllYears(careerStatsData);
          }
          // Refresh ratings all-years table to show updated team
          if (currentDbPlayerId && availableYears && availableYears.length > 0) {
            await renderRatingsAllYears();
          }
        }, 100);
      });
    }

    // Assign Generic Face button - opens the face picker modal
    var assignFaceBtn = document.getElementById('assignGenericFaceBtn');
    if (assignFaceBtn) {
      assignFaceBtn.addEventListener('click', function() {
        console.log('[DbPlayerCard] Assign Generic Face clicked - opening face picker');
        openGenericFacePickerForDbCard();
      });
    }

    // Assign PAM Only button - opens PAM picker (sets PAM only, keeps PID)
    var assignPAMBtn = document.getElementById('assignPAMOnlyBtn');
    if (assignPAMBtn) {
      assignPAMBtn.addEventListener('click', function() {
        console.log('[DbPlayerCard] Assign PAM Only clicked - opening PAM picker');
        openPAMPickerForDbCard();
      });
    }

    // PAM input right-click handler - opens PAM picker (sets PAM only, not PID)
    var pamInput = document.getElementById('dbPlayerPAM');
    if (pamInput) {
      pamInput.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        console.log('[DbPlayerCard] PAM input right-clicked - opening PAM picker');
        openPAMPickerForDbCard();
      });
      pamInput.title = 'Right-click to select generic PAM';
    }

    // OVR change listener - prompt to adjust ratings
    var ovrInput = document.getElementById('dbRating_POVR');
    if (ovrInput) {
      console.log('[DbPlayerCard] OVR input found, setting up listeners');
      // Store previous value to detect actual changes - capture on multiple events
      var captureOldValue = function() {
        // Only capture if previousValue is not set AND current value is not empty
        if (!ovrInput.dataset.previousValue && ovrInput.value && ovrInput.value.trim() !== '') {
          ovrInput.dataset.previousValue = ovrInput.value;
          console.log('[DbPlayerCard] Captured previous OVR:', ovrInput.value);
        }
      };
      ovrInput.addEventListener('focus', captureOldValue);
      ovrInput.addEventListener('mousedown', captureOldValue);
      ovrInput.addEventListener('keydown', captureOldValue);

      ovrInput.addEventListener('change', function() {
        var oldOVR = parseInt(ovrInput.dataset.previousValue, 10);
        var newOVR = parseInt(ovrInput.value, 10);
        console.log('[DbPlayerCard] OVR change event fired!');
        console.log('[DbPlayerCard] previousValue from dataset:', ovrInput.dataset.previousValue);
        console.log('[DbPlayerCard] OVR change detected:', oldOVR, '->', newOVR);
        console.log('[DbPlayerCard] Conditions: isNaN(oldOVR)=', isNaN(oldOVR), 'isNaN(newOVR)=', isNaN(newOVR), 'oldOVR !== newOVR:', oldOVR !== newOVR);

        // Clear the captured value for next change
        ovrInput.dataset.previousValue = '';

        if (!isNaN(oldOVR) && !isNaN(newOVR) && oldOVR !== newOVR && newOVR >= 0 && newOVR <= 99) {
          console.log('[DbPlayerCard] Calling handleDbOVRChange');
          handleDbOVRChange(oldOVR, newOVR);
        } else {
          console.log('[DbPlayerCard] NOT calling handleDbOVRChange - condition failed');
        }
      });
    } else {
      console.warn('[DbPlayerCard] OVR input NOT found during setup');
    }

    // Dynamic OVR recalculation when rating attributes change
    var OVR_AFFECTING_FIELDS = ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PJMP', 'PAWR', 'PBCV', 'PCAR', 'PCTH',
      'PTHP', 'PTAS', 'PTAM', 'PTAD', 'PTOR', 'PTUP', 'PPLA', 'PBSK',
      'PPBK', 'PRBK', 'PLBK', 'PLIB', 'PPBF', 'PPBS', 'PRBF', 'PRBS',
      'PTAK', 'PLHT', 'PLMC', 'PLZC', 'PLPR', 'PLPU', 'PLPM', 'PFMS',
      'PBSG', 'PLPE', 'PBKT', 'PLTR', 'PELU', 'PLJM', 'PLSM', 'PLSA',
      'PLSC', 'PLCI', 'PLRL', 'PDRR', 'PMRR', 'SRRN', 'PKPR', 'PKAC', 'PKRT',
      'PSTA', 'PINJ', 'PTGH'];

    OVR_AFFECTING_FIELDS.forEach(function(fieldCode) {
      var input = document.getElementById('dbRating_' + fieldCode);
      if (input) {
        input.addEventListener('change', function() {
          recalculateDbOVR();
        });
      }
    });

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

        // When position changes, update the player-level archetype dropdown
        positionSelect.addEventListener('change', async function() {
          var newPosition = positionSelect.value;
          console.log('[DbPlayerCard] Position changed to:', newPosition);
          await updatePlayerLevelArchetypeDropdown(newPosition);
        });
      }

      // Player-level Archetype dropdown - populated when position is selected
      var playerArchetypeSelect = document.getElementById('dbPlayerArchetype');
      if (playerArchetypeSelect) {
        // When player-level archetype changes, save it
        playerArchetypeSelect.addEventListener('change', async function() {
          var archetype = playerArchetypeSelect.value;
          if (archetype && currentDbPlayerId && !isCustomPlayer) {
            try {
              var position = document.getElementById('dbPlayerPosition')?.value || 'QB';
              var archetypes = await window.electronAPI.rating.getArchetypes(position);
              var archetypeObj = archetypes.find(function(a) { return a.name === archetype; });
              var archetypeId = archetypeObj ? archetypeObj.id : undefined;

              await window.electronAPI.database.savePlayerArchetype(currentDbPlayerId, archetype, archetypeId);
              console.log('[DbPlayerCard] Saved player-level archetype:', archetype, 'id:', archetypeId);

              // Recalculate OVR with new archetype
              await recalculateDbOVR();
            } catch (e) {
              console.error('[DbPlayerCard] Error saving player archetype:', e);
            }
          }
        });
      }

      // Race dropdown - values match Madden roster PLRC field
      // Based on CSV: 1=White, 5=Hispanic, 7=Black
      var raceSelect = document.getElementById('dbPlayerRace');
      if (raceSelect) {
        raceSelect.innerHTML =
          '<option value="">Select Race</option>' +
          '<option value="1">White</option>' +
          '<option value="2">2</option>' +
          '<option value="3">3</option>' +
          '<option value="4">4</option>' +
          '<option value="5">Hispanic</option>' +
          '<option value="6">6</option>' +
          '<option value="7">Black</option>';
      }

      // State dropdown - API returns {value: id, label: name}
      // Use ID as value so it matches what's stored in database
      var stateSelect = document.getElementById('dbPlayerHomeState');
      if (stateSelect) {
        var states = await window.electronAPI.lookup.getDropdownOptions('state_lookup.csv');
        if (states && states.length > 0) {
          stateSelect.innerHTML = '<option value="">Select State</option>';
          states.forEach(function(s) {
            var stateName = s.label || s.name;
            if (!stateName || stateName.trim() === '') return;
            var opt = document.createElement('option');
            opt.value = s.value;  // Use ID, not name
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

      // Get player data - use different API for custom vs database players
      var result;
      if (custom) {
        // Custom player - get from custom_players table
        console.log('[DatabasePlayerCard] Loading custom player:', playerId);
        result = await window.electronAPI.database.getCustomPlayer(playerId);
        if (result.success && result.data) {
          // Map custom player fields to match database player format
          // Note: Custom player uses different field names (maddenPid, collegeId, etc.)
          result.player = {
            id: result.data.id,
            internalId: result.data.id,
            firstName: result.data.firstName,
            lastName: result.data.lastName,
            position: result.data.position,
            college: result.data.collegeId, // collegeId, not college
            height: result.data.height,
            weight: result.data.weight,
            race: result.data.race,
            bodyType: result.data.bodyType,
            handedness: result.data.handedness,
            hometown: result.data.hometown,
            homeState: result.data.homeState,
            draftClass: result.data.draftClass, // draftClass, not draftYear
            round: result.data.draftRound,
            pick: result.data.draftPick,
            careerFrom: result.data.careerFrom,
            careerTo: result.data.careerTo,
            pid: result.data.maddenPid, // maddenPid, not pid
            pam: result.data.maddenPam, // maddenPam, not pam
            plpo: result.data.maddenPlpo, // maddenPlpo, not plpo
            commID: result.data.maddenCommid, // maddenCommid, not commID
            // PGHE fields for generic face support
            pghe: result.data.maddenPghe,
            pfcg: result.data.maddenPfcg,
            gpan: result.data.maddenGpan,
            gslp: result.data.maddenGslp,
            cpvf: result.data.maddenCpvf,
            skinTone: result.data.maddenSkinTone,
            isCustom: true
          };
        }
      } else {
        // Database player - get merged data (original + edits)
        result = await window.electronAPI.database.getMergedPlayer(playerId);
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to load player');
      }

      currentDbPlayer = result.player;
      console.log('[DatabasePlayerCard] Player data received:', currentDbPlayer);
      console.log('[DatabasePlayerCard] Position value:', currentDbPlayer.position);

      // Restore PGHE data if player has generic face settings
      if (currentDbPlayer.pghe !== undefined || currentDbPlayer.pfcg) {
        currentDbPlayer._pgheData = {
          pghe: currentDbPlayer.pghe,
          pfcg: currentDbPlayer.pfcg,
          gpan: currentDbPlayer.gpan,
          gslp: currentDbPlayer.gslp,
          psxp: currentDbPlayer.pid,
          cpvf: currentDbPlayer.cpvf,
          genr: currentDbPlayer.pam,
          skinTone: currentDbPlayer.skinTone
        };
        console.log('[DatabasePlayerCard] Restored PGHE data:', currentDbPlayer._pgheData);
      }

      // Populate the form (MUST await to ensure archetype dropdown is populated before renderRatingsAllYears)
      await populatePlayerForm(currentDbPlayer);

      // Set up year selector (async - fetches from DB)
      await setupYearSelector(currentDbPlayer);

      // Load career stats from PFR database
      await loadCareerStats(currentDbPlayer);

      // Load player traits
      await loadPlayerTraits();

      // Check if player has edits
      updateEditedIndicator();

      // Show the modal - CRITICAL: Reset visibility and pointer-events that were set on close
      var modal = document.getElementById('dbPlayerCardModal');
      if (modal) {
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.pointerEvents = 'auto';
      }

      // Always show delete button - user has full control over their database
      var deleteBtn = document.getElementById('deleteDbPlayerBtn');
      if (deleteBtn) {
        deleteBtn.style.display = 'inline-block';
        // Update button text based on player type
        deleteBtn.textContent = isCustomPlayer ? 'Delete Player' : 'Hide Player';
        deleteBtn.title = isCustomPlayer
          ? 'Permanently delete this custom player'
          : 'Hide this player from search results (can be restored later)';
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

    // Hide the Delete button in create mode (nothing to delete yet)
    var deleteBtn = document.getElementById('deleteDbPlayerBtn');
    if (deleteBtn) {
      deleteBtn.style.display = 'none';
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

    // Show the modal
    var modal = document.getElementById('dbPlayerCardModal');
    if (modal) {
      modal.style.display = 'flex';
    }

    // Focus on first name field with simple focus (removed aggressive focus)
    var firstNameInput = document.getElementById('dbPlayerFirstName');
    if (firstNameInput) {
      setTimeout(function() {
        firstNameInput.focus();
      }, 100);
    }
  }

  /**
   * Restore focus after save operation.
   * DISABLED: This was causing focus to be stolen from other inputs (search box, etc.)
   * The aggressive focus attempts were preventing users from typing elsewhere.
   */
  function restoreFocusAfterSave() {
    // DISABLED - this function was stealing focus from other inputs
    // If focus needs to be restored, the user can click on the desired input
    return;
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
    setValue('dbPlayerArchetype', '');  // Player-level archetype
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

  // ========================================
  // Trait Management Functions
  // ========================================

  // Trait definitions (imported inline for simplicity)
  const PLAYER_TRAITS = {
    // QB Traits
    AGGRESSIVEQB: { display: 'Aggressive QB', description: 'QB takes more risks and throws into tight coverage', category: 'QB', positions: ['QB'] },
    CANNON: { display: 'Cannon Arm', description: 'QB can make extremely powerful throws', category: 'QB', positions: ['QB'] },
    CONSERVATIVE: { display: 'Conservative', description: 'QB avoids risky throws and checks down more often', category: 'QB', positions: ['QB'] },
    EYESUP: { display: 'Eyes Up', description: 'QB keeps eyes downfield while avoiding pressure', category: 'QB', positions: ['QB'] },
    HAPPYFEET: { display: 'Happy Feet', description: 'QB tends to scramble even when not under pressure', category: 'QB', positions: ['QB'] },
    HEROBALL: { display: 'Hero Ball', description: 'QB tries to make big plays in clutch situations', category: 'QB', positions: ['QB'] },
    LOOKFORSTARS: { display: 'Look for Stars', description: 'QB targets star receivers more often', category: 'QB', positions: ['QB'] },
    OBLIVIOUS: { display: 'Oblivious', description: 'QB is less aware of incoming pressure', category: 'QB', positions: ['QB'] },
    PARANOID: { display: 'Paranoid', description: 'QB panics under pressure more easily', category: 'QB', positions: ['QB'] },
    POCKETPASSER: { display: 'Pocket Passer', description: 'QB prefers to stay in the pocket', category: 'QB', positions: ['QB'] },
    QUICKCLOCK: { display: 'Quick Clock', description: 'QB gets the ball out quickly', category: 'QB', positions: ['QB'] },
    QUICKTRIGGER: { display: 'Quick Trigger', description: 'QB releases the ball very quickly', category: 'QB', positions: ['QB'] },
    RISKTAKER: { display: 'Risk Taker', description: 'QB throws into tight windows more often', category: 'QB', positions: ['QB'] },
    SCRAMBLER: { display: 'Scrambler', description: 'QB likes to run when plays break down', category: 'QB', positions: ['QB'] },
    SEEINGGHOSTS: { display: 'Seeing Ghosts', description: 'QB senses phantom pressure and throws early', category: 'QB', positions: ['QB'] },
    SETUPTIME: { display: 'Setup Time', description: 'QB needs more time to make reads', category: 'QB', positions: ['QB'] },
    SNAPMISCHIEF: { display: 'Snap Mischief', description: 'QB draws defenders offsides with hard counts', category: 'QB', positions: ['QB'] },
    THROWAWAY: { display: 'Throw Away', description: 'QB throws the ball away rather than taking sacks', category: 'QB', positions: ['QB'] },
    TRIGGERHAPPY: { display: 'Trigger Happy', description: 'QB throws to first read without progression', category: 'QB', positions: ['QB'] },
    UPANDOVER: { display: 'Up and Over', description: 'QB uses a high throwing motion', category: 'QB', positions: ['QB'] },

    // Ball Carrier Traits
    AGGRESSIVE: { display: 'Aggressive Receiver', description: 'Receiver fights for the ball in contested catches', category: 'Ball Carrier', positions: ['HB', 'FB', 'WR', 'TE'] },
    COVERBALL: { display: 'Cover Ball', description: 'Ball carrier covers up in traffic to avoid fumbles', category: 'Ball Carrier', positions: ['HB', 'FB', 'WR', 'TE'] },
    ELUSIVEINSTINCT: { display: 'Elusive Instinct', description: 'Ball carrier has natural instincts to avoid tackles', category: 'Ball Carrier', positions: ['HB', 'FB', 'WR', 'TE'] },
    HIGHLIGHTREEL: { display: 'Highlight Reel', description: 'Ball carrier makes spectacular plays', category: 'Ball Carrier', positions: ['HB', 'FB', 'WR', 'TE'] },
    POSSESSION: { display: 'Possession Receiver', description: 'Receiver focuses on securing the catch', category: 'Ball Carrier', positions: ['WR', 'TE'] },
    RAC: { display: 'RAC Receiver', description: 'Receiver excels at gaining yards after the catch', category: 'Ball Carrier', positions: ['HB', 'FB', 'WR', 'TE'] },
    RUNOVER: { display: 'Run Over', description: 'Ball carrier powers through tackles', category: 'Ball Carrier', positions: ['HB', 'FB', 'WR', 'TE'] },
    SPINCYCLE: { display: 'Spin Cycle', description: 'Ball carrier uses spin moves effectively', category: 'Ball Carrier', positions: ['HB', 'FB', 'WR', 'TE'] },
    STEERINGCLEAR: { display: 'Steering Clear', description: 'Receiver avoids contact and runs out of bounds', category: 'Ball Carrier', positions: ['WR', 'TE'] },
    STRONGARM: { display: 'Strong Arm', description: 'Ball carrier uses stiff arm effectively', category: 'Ball Carrier', positions: ['HB', 'FB', 'WR', 'TE'] },
    WHIRLWIND: { display: 'Whirlwind', description: 'Ball carrier spins through contact effectively', category: 'Ball Carrier', positions: ['HB', 'FB', 'WR', 'TE'] },

    // Defensive Traits - Position-specific (includes both old and M26 position codes)
    BIGHITTER: { display: 'Big Hitter', description: 'Defender delivers powerful hits', category: 'Defense', positions: ['SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },
    BOUNCER: { display: 'Bouncer', description: 'Defender bounces off blocks effectively', category: 'Defense', positions: ['LEDG', 'REDG', 'DT'] },
    BULL: { display: 'Bull Rush', description: 'Pass rusher uses power to push through blockers', category: 'Defense', positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL'] },
    DISCIPLINED: { display: 'Disciplined', description: 'Player rarely commits penalties', category: 'Other', positions: ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },
    FLYSWATTER: { display: 'Fly Swatter', description: 'Defender swats down passes at the line', category: 'Defense', positions: ['LEDG', 'REDG', 'DT'] },
    HAMMERHEAD: { display: 'Hammerhead', description: 'Defender uses head-first tackling style', category: 'Defense', positions: ['SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },
    HEADHUNTER: { display: 'Head Hunter', description: 'Defender targets ball carriers aggressively', category: 'Defense', positions: ['SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },
    KNEECAPBITER: { display: 'Kneecap Biter', description: 'Defender goes low for tackles', category: 'Defense', positions: ['SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },
    PLAYBALL: { display: 'Play Ball', description: 'Defender goes for interceptions', category: 'Defense', positions: ['SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },
    PLAYBALLAGGRESSIVE: { display: 'Play Ball Aggressive', description: 'Defender aggressively attacks the ball', category: 'Defense', positions: ['CB', 'FS', 'SS'] },
    PLAYBALLCONSERVATIVE: { display: 'Play Ball Conservative', description: 'Defender plays it safe and goes for swats', category: 'Defense', positions: ['CB', 'FS', 'SS'] },
    PLAYRECEIVER: { display: 'Play Receiver', description: 'Defender focuses on the receiver, not the ball', category: 'Defense', positions: ['CB', 'FS', 'SS'] },
    PLAYDEFENDER: { display: 'Play Defender', description: 'Defender focuses on the offensive player', category: 'Defense', positions: ['LEDG', 'REDG', 'DT'] },
    PUNCHITOUT: { display: 'Punch It Out', description: 'Defender goes for forced fumbles', category: 'Defense', positions: ['LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },
    SAFETACKLER: { display: 'Safe Tackler', description: 'Defender wraps up for secure tackles', category: 'Defense', positions: ['LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },
    SEDENTARY: { display: 'Sedentary', description: 'Defender is slow to react', category: 'Defense', positions: ['LEDG', 'REDG', 'DT'] },
    STRIPSBALL: { display: 'Strips Ball', description: 'Defender actively tries to strip the ball', category: 'Defense', positions: ['LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },
    UNDISCIPLINED: { display: 'Undisciplined', description: 'Player commits penalties more often', category: 'Other', positions: ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },

    // Pass Rusher Traits - DL/Edge and edge-rushing LBs only
    FINESSERUSHER: { display: 'Finesse Rusher', description: 'Pass rusher uses speed and agility moves', category: 'Pass Rush', positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL'] },
    POWERRUSHER: { display: 'Power Rusher', description: 'Pass rusher uses strength-based moves', category: 'Pass Rush', positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL'] },
    SPINRUSHER: { display: 'Spin Rusher', description: 'Pass rusher uses spin moves', category: 'Pass Rush', positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL'] },
    UNDERCUT: { display: 'Undercut', description: 'Pass rusher dips under blockers effectively', category: 'Pass Rush', positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL'] },
    FREESTYLER: { display: 'Freestyler', description: 'Pass rusher uses creative moves', category: 'Pass Rush', positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL'] },
    TWISTER: { display: 'Twister', description: 'Pass rusher uses twist/stunt moves effectively', category: 'Pass Rush', positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL'] },
    BULLISH: { display: 'Bullish', description: 'Pass rusher has a powerful bull rush', category: 'Pass Rush', positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL'] },

    // Blocking Traits
    OLE: { display: 'Ole', description: 'Blocker whiffs on blocks occasionally', category: 'Blocking', positions: ['LT', 'LG', 'C', 'RG', 'RT', 'TE', 'FB'] },

    // Other Traits
    DIVECELEBRATION: { display: 'Dive Celebration', description: 'Player dives into the end zone', category: 'Other', positions: ['QB', 'HB', 'FB', 'WR', 'TE'] },
    DOUBLEBACK: { display: 'Double Back', description: 'Ball carrier reverses field', category: 'Other', positions: ['HB', 'FB', 'WR', 'TE'] },
    EARLYCELEBRATION: { display: 'Early Celebration', description: 'Player celebrates before crossing goal line', category: 'Other', positions: ['QB', 'HB', 'FB', 'WR', 'TE'] },
    GASGUZZLER: { display: 'Gas Guzzler', description: 'Player tires out faster', category: 'Other', positions: ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'] },
    JAMMER: { display: 'Red Zone Jammer', description: 'Defender excels in red zone coverage', category: 'Other', positions: ['CB', 'FS', 'SS'] }
  };

  const POSITION_ALIASES = {
    'MLB': 'MIKE', 'Mike': 'MIKE', 'LOLB': 'WILL', 'ROLB': 'SAM', 'LE': 'LEDG', 'RE': 'REDG'
  };

  const TRAIT_CATEGORIES = {
    QB: { display: 'Quarterback', color: '#4CAF50', order: 1 },
    'Ball Carrier': { display: 'Ball Carrier', color: '#2196F3', order: 2 },
    Defense: { display: 'Defense', color: '#f44336', order: 3 },
    'Pass Rush': { display: 'Pass Rush', color: '#FF9800', order: 4 },
    Blocking: { display: 'Blocking', color: '#9C27B0', order: 5 },
    Other: { display: 'Other', color: '#607D8B', order: 6 }
  };

  /**
   * Get traits applicable to a specific position
   * @param {string} position - Position code
   * @returns {Array} Array of trait objects
   */
  function getTraitsForPosition(position) {
    const normalizedPosition = POSITION_ALIASES[position] || position;
    const traits = [];

    for (const [name, def] of Object.entries(PLAYER_TRAITS)) {
      if (def.positions && def.positions.includes(normalizedPosition)) {
        traits.push({ name, ...def });
      }
    }

    return traits;
  }

  /**
   * Get traits grouped by category for a position
   * @param {string} position - Position code
   * @returns {Object} Traits grouped by category
   */
  function getTraitsGroupedByCategory(position) {
    const traits = getTraitsForPosition(position);
    const grouped = {};

    traits.forEach(trait => {
      const category = trait.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(trait);
    });

    // Sort by category order
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      const orderA = TRAIT_CATEGORIES[a]?.order || 99;
      const orderB = TRAIT_CATEGORIES[b]?.order || 99;
      return orderA - orderB;
    });

    const result = {};
    sortedCategories.forEach(cat => {
      result[cat] = grouped[cat];
    });

    return result;
  }

  // Store current trait values for saving
  let currentTraitValues = {};

  /**
   * Render trait toggles for a player based on their position
   * @param {string} position - Player's position
   * @param {Object} traitData - Current trait values (PT_* fields from franchise)
   */
  function renderTraitsForPosition(position, traitData = {}) {
    const container = document.getElementById('dbTraitsContainer');
    if (!container) {
      console.warn('[DatabasePlayerCard] Traits container not found');
      return;
    }

    const groupedTraits = getTraitsGroupedByCategory(position);

    if (Object.keys(groupedTraits).length === 0) {
      container.innerHTML = '<p class="trait-empty-message">No traits available for this position.</p>';
      return;
    }

    currentTraitValues = { ...traitData };
    let html = '';

    for (const [category, traits] of Object.entries(groupedTraits)) {
      const catInfo = TRAIT_CATEGORIES[category] || { display: category, color: '#607D8B' };

      html += `
        <div class="trait-category" data-category="${category}">
          <div class="trait-category-header">
            <span class="trait-category-badge" style="background: ${catInfo.color};">${traits.length}</span>
            <h5 class="trait-category-title">${catInfo.display}</h5>
          </div>
          <div class="trait-grid">
      `;

      traits.forEach(trait => {
        const fieldName = 'PT_' + trait.name;
        const isActive = traitData[fieldName] === true || traitData[fieldName] === 'true' || traitData[fieldName] === 1;
        const activeClass = isActive ? 'active' : '';
        const checkedAttr = isActive ? 'checked' : '';

        html += `
          <div class="trait-item ${activeClass}" title="${trait.description}" data-trait="${trait.name}">
            <label class="trait-label" for="trait_${trait.name}">${trait.display}</label>
            <label class="trait-toggle">
              <input type="checkbox" id="trait_${trait.name}" data-field="${fieldName}" ${checkedAttr}>
              <span class="trait-toggle-slider"></span>
            </label>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    // Add event listeners for trait toggles
    container.querySelectorAll('.trait-toggle input').forEach(input => {
      input.addEventListener('change', function() {
        const fieldName = this.dataset.field;
        const isChecked = this.checked;
        currentTraitValues[fieldName] = isChecked;

        // Update visual state
        const traitItem = this.closest('.trait-item');
        if (traitItem) {
          traitItem.classList.toggle('active', isChecked);
        }

        hasUnsavedChanges = true;
        console.log('[DatabasePlayerCard] Trait changed:', fieldName, isChecked);
      });
    });
  }

  /**
   * Load trait data for the current player
   * This fetches trait values from the franchise file via IPC
   */
  async function loadPlayerTraits() {
    if (!currentDbPlayer || !currentDbPlayer.position) {
      console.log('[DatabasePlayerCard] No player or position, skipping trait load');
      return;
    }

    const position = currentDbPlayer.position;
    console.log('[DatabasePlayerCard] Loading traits for position:', position);

    // For now, render with empty trait data since franchise traits require IPC
    // In Phase 2, we'll implement the franchise file trait loading
    // Placeholder: load from player object if traits are included
    let traitData = {};

    // Check if trait data is available in the player object
    for (const key of Object.keys(currentDbPlayer)) {
      if (key.startsWith('PT_')) {
        traitData[key] = currentDbPlayer[key];
      }
    }

    console.log('[DatabasePlayerCard] Trait data found:', Object.keys(traitData).length, 'traits');

    // Set development trait dropdown
    const devTraitSelect = document.getElementById('dbTraitDevelopment');
    if (devTraitSelect) {
      const devTrait = currentDbPlayer.TraitDevelopment || currentDbPlayer.devTrait || 0;
      devTraitSelect.value = devTrait;
    }

    renderTraitsForPosition(position, traitData);
  }

  /**
   * Collect trait edits for saving
   * @returns {Object} Object with PT_* field names and boolean values
   */
  function collectTraitEdits() {
    const edits = {};

    // Collect development trait
    const devTraitSelect = document.getElementById('dbTraitDevelopment');
    if (devTraitSelect && devTraitSelect.value !== '') {
      edits.TraitDevelopment = parseInt(devTraitSelect.value, 10);
    }

    // Collect all trait toggle values
    const container = document.getElementById('dbTraitsContainer');
    if (container) {
      container.querySelectorAll('.trait-toggle input').forEach(input => {
        const fieldName = input.dataset.field;
        if (fieldName) {
          edits[fieldName] = input.checked;
        }
      });
    }

    return edits;
  }

  /**
   * Populate the player form with data
   */
  async function populatePlayerForm(player) {
    console.log('[DatabasePlayerCard] Populating form with player:', player);
    console.log('[DatabasePlayerCard] bodyType:', player.bodyType, 'typeof:', typeof player.bodyType);
    console.log('[DatabasePlayerCard] handedness:', player.handedness, 'typeof:', typeof player.handedness);
    console.log('[DatabasePlayerCard] homeState:', player.homeState, 'typeof:', typeof player.homeState);

    // Check if player has a custom portrait assigned (PID 12000+)
    // This checks the custom_portraits table by database_player_id
    let customPortraitPid = null;
    if (player.id && window.electronAPI?.customPortrait?.getByPlayerId) {
      try {
        customPortraitPid = await window.electronAPI.customPortrait.getByPlayerId(player.id);
        if (customPortraitPid) {
          console.log('[DatabasePlayerCard] Found custom portrait PID for player:', customPortraitPid);
        }
      } catch (e) {
        console.log('[DatabasePlayerCard] No custom portrait found:', e);
      }
    }

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

    // Populate and set player-level archetype (constant across all seasons)
    // This ensures consistent OVR calculations
    await updatePlayerLevelArchetypeDropdown(player.position || '');
    // Load stored player-level archetype from database, or auto-determine if none stored
    if (currentDbPlayerId && !isCustomPlayer) {
      try {
        var storedArchetype = await window.electronAPI.database.getPlayerArchetype(currentDbPlayerId);
        if (storedArchetype && storedArchetype.archetype) {
          setValue('dbPlayerArchetype', storedArchetype.archetype);
          console.log('[DbPlayerCard] Loaded stored player-level archetype:', storedArchetype.archetype);
        } else if (player.position) {
          // No stored archetype - auto-determine based on best fit for position
          // This ensures every player has a consistent archetype
          console.log('[DbPlayerCard] No stored archetype, auto-determining for position:', player.position);

          // Get archetypes available for this position
          var archetypes = await window.electronAPI.rating.getArchetypes(player.position);
          if (archetypes && archetypes.length > 0) {
            // Use the first (default) archetype for the position
            var defaultArchetype = archetypes[0];
            setValue('dbPlayerArchetype', defaultArchetype.name);
            console.log('[DbPlayerCard] Auto-selected default archetype:', defaultArchetype.name);

            // Save it so it persists
            await window.electronAPI.database.savePlayerArchetype(currentDbPlayerId, defaultArchetype.name, defaultArchetype.id);
            console.log('[DbPlayerCard] Saved auto-determined archetype');
          }
        }
      } catch (e) {
        console.warn('[DbPlayerCard] Could not load/determine player archetype:', e);
      }
    }

    setValue('dbPlayerHometown', player.hometown || '');  // Replaced jersey with hometown
    setValue('dbPlayerHeight', player.height || '');
    setValue('dbPlayerWeight', player.weight || '');
    setValue('dbPlayerRace', player.race !== undefined ? player.race : '');
    // homeState can be either a numeric ID or a state name string
    // The dropdown uses numeric IDs as values, so we need to convert name to ID if needed
    var homeStateVal = player.homeState;
    if (homeStateVal !== undefined && homeStateVal !== null && homeStateVal !== '') {
      var stateSelect = document.getElementById('dbPlayerHomeState');
      if (stateSelect) {
        // Check if it's already a valid numeric ID
        var foundById = Array.from(stateSelect.options).find(opt => opt.value === String(homeStateVal));
        if (!foundById) {
          // It's a state name, find the corresponding ID
          var homeStateLower = String(homeStateVal).toLowerCase();
          var foundByName = Array.from(stateSelect.options).find(opt =>
            opt.textContent.toLowerCase() === homeStateLower
          );
          if (foundByName) {
            homeStateVal = foundByName.value;
          }
        }
      }
    }
    setValue('dbPlayerHomeState', homeStateVal || '');
    // bodyType comes as "0.0" string from DB, need to convert to int for dropdown match
    var bodyTypeVal = player.bodyType !== undefined ? Math.floor(parseFloat(player.bodyType)) : '';
    setValue('dbPlayerBodyType', bodyTypeVal);
    setValue('dbPlayerHandedness', player.handedness !== undefined ? player.handedness : '');
    setChecked('dbPlayerHas3DModel', player.has3DModel || false);

    // Draft info - API uses 'round' and 'pick', not 'draftRound' and 'draftPick'
    setValue('dbPlayerDraftClass', player.draftClass || '');
    setValue('dbPlayerDraftRound', player.round || '');
    setValue('dbPlayerDraftPick', player.pick || '');

    // Career info
    setValue('dbPlayerCareerFrom', player.careerFrom || '');
    setValue('dbPlayerCareerTo', player.careerTo || '');

    // Madden IDs - API uses 'pid', 'pam', 'plpo', 'commID'
    // Priority: player.pid (from appearance edits/merged data) > customPortraitPid > empty
    // The player.pid already includes appearance edit PID via getEffectivePid in getMergedPlayer
    // Only fall back to customPortraitPid if player.pid is not set
    var effectivePid = player.pid || customPortraitPid || '';
    setValue('dbPlayerPID', effectivePid);
    setValue('dbPlayerPAM', player.pam || '');
    setValue('dbPlayerPLPO', player.plpo || '');
    setValue('dbPlayerCommID', player.commID || '');

    // Log which PID source was used for debugging
    if (player.pid) {
      console.log('[DatabasePlayerCard] Using player.pid from merged data:', player.pid);
    } else if (customPortraitPid) {
      console.log('[DatabasePlayerCard] Using fallback custom portrait PID:', customPortraitPid);
    }

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

    // Portrait (if PID exists) - use effectivePid which includes custom portraits
    loadPlayerPortrait(effectivePid);
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
      // Custom portraits (PID >= 12000) use getImageDataByPid
      var CUSTOM_PORTRAIT_PID_START = 12000;
      var isCustomPortrait = parseInt(pid) >= CUSTOM_PORTRAIT_PID_START;
      var imageData;

      if (isCustomPortrait) {
        console.log('[DbPlayerCard] Loading custom portrait for PID:', pid);
        imageData = await window.electronAPI.portrait.getImageDataByPid(pid);
      } else {
        // Try getByPID first - returns full data URL already
        imageData = await window.electronAPI.portrait.getByPID(pid);
      }

      if (imageData) {
        // imageData is already a full data URL (data:image/png;base64,...)
        portraitEl.src = imageData;
        portraitEl.style.display = 'block';
        console.log('[DbPlayerCard] Portrait loaded successfully for PID:', pid, isCustomPortrait ? '(custom)' : '(standard)');
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
   * Set up the year selector based on player's career stats
   * FIXED: Now uses career stats database (PFR scraped data) as the source of truth
   */
  async function setupYearSelector(player) {
    var yearSelect = document.getElementById('dbPlayerYearSelect');
    if (!yearSelect) return;

    availableYears = [];
    yearSelect.innerHTML = '<option value="">Select Year for Ratings</option>';

    // Add "All Years" option for table overview
    var allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All Years (Table View)';
    yearSelect.appendChild(allOpt);

    // Initialize view states - show BOTH all-years table (always visible) and single year editor
    var allYearsView = document.getElementById('ratingsAllYearsView');
    var singleYearView = document.getElementById('ratingsSingleYearView');
    if (allYearsView) allYearsView.style.display = 'block';  // Always show all-years table
    if (singleYearView) singleYearView.style.display = 'block';  // Always show detail editor

    var draftYear = parseInt(player.draftClass);
    var playerPosition = player.position || player.pos || null;

    // PRIORITY 1: Get years from career stats database (PFR scraped data)
    // This is the source of truth for what years a player actually played
    var careerStatsYears = [];
    var careerStatsTeams = {}; // Map year -> team
    try {
      var careerResult = await window.electronAPI.database.getCareerStats(
        player.firstName || player.first_name,
        player.lastName || player.last_name,
        draftYear || null,
        playerPosition
      );
      if (careerResult.success && careerResult.stats && careerResult.stats.length > 0) {
        careerResult.stats.forEach(function(s) {
          careerStatsYears.push(s.year);
          careerStatsTeams[s.year] = s.team; // Store team for each year
        });
        console.log('[DbPlayerCard] Career stats from PFR:', careerStatsYears.length, 'seasons');
        // Store for later use in ratings population
        window._careerStatsTeams = careerStatsTeams;
      }
    } catch (error) {
      console.warn('[DbPlayerCard] Could not fetch career stats:', error);
    }

    // PRIORITY 2: Get years with existing season/rating edits
    var yearsWithData = [];
    try {
      var result = await window.electronAPI.database.getPlayerSeasonYears(player.internalId);
      if (result.success && result.years && result.years.length > 0) {
        yearsWithData = result.years;
        console.log('[DbPlayerCard] Found', yearsWithData.length, 'seasons with existing ratings');
      }
    } catch (error) {
      console.error('[DbPlayerCard] Error fetching season years:', error);
    }

    // COMBINE: Use career stats years as primary source, merge with existing edits
    // Only show years where player actually played (from career stats)
    var allYearsSet = {};
    careerStatsYears.forEach(function(y) { allYearsSet[y] = true; });
    yearsWithData.forEach(function(y) { allYearsSet[y] = true; });

    availableYears = Object.keys(allYearsSet).map(function(y) { return parseInt(y); }).sort(function(a, b) { return a - b; });

    // FALLBACK: Only if NO career stats AND no existing data
    if (availableYears.length === 0) {
      var careerFrom = parseInt(player.careerFrom);
      var careerTo = parseInt(player.careerTo);

      if (careerFrom && careerTo && !isNaN(careerFrom) && !isNaN(careerTo)) {
        for (var year = careerFrom; year <= careerTo; year++) {
          availableYears.push(year);
        }
        console.log('[DbPlayerCard] Fallback to career span:', careerFrom, '-', careerTo);
      } else if (careerFrom && !isNaN(careerFrom)) {
        // Only start year - use reasonable 15 year max career
        var maxEnd = Math.min(careerFrom + 15, new Date().getFullYear());
        for (var year = careerFrom; year <= maxEnd; year++) {
          availableYears.push(year);
        }
        console.log('[DbPlayerCard] Fallback with start only:', careerFrom, '-', maxEnd);
      }
    }

    console.log('[DbPlayerCard] Final years:', availableYears.length,
      availableYears.length > 0 ? '(' + availableYears[0] + '-' + availableYears[availableYears.length - 1] + ')' : '');

    // Populate dropdown
    availableYears.forEach(function(year) {
      var opt = document.createElement('option');
      opt.value = year;
      var label = year.toString();
      if (year === draftYear) label += ' (Draft)';
      if (careerStatsYears.indexOf(year) !== -1) label += ' *'; // Has career stats
      if (yearsWithData.indexOf(year) !== -1) label += ' ✓'; // Has rating edits
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

    // Render the all-years table immediately
    await renderRatingsAllYears();
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
    console.log('[DbPlayerCard] onYearChange called with value:', year);

    var allYearsView = document.getElementById('ratingsAllYearsView');
    var singleYearView = document.getElementById('ratingsSingleYearView');

    console.log('[DbPlayerCard] allYearsView found:', !!allYearsView);
    console.log('[DbPlayerCard] singleYearView found:', !!singleYearView);

    // Handle "All Years" selection - just refresh the table, both views stay visible
    if (year === 'all') {
      console.log('[DbPlayerCard] All Years selected, refreshing table');
      await renderRatingsAllYears();
      // Clear the year selector since we're not editing a specific year
      document.getElementById('dbPlayerYearSelect').value = '';
      selectedYear = null;
      clearRatingsForm();
      return;
    }

    // Both views always stay visible - all-years table at top, detail editor below
    // (Don't hide either view)

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
   * Handle player-level archetype change
   * Saves to database and recalculates all OVR values in the table
   */
  async function onPlayerArchetypeChange(e) {
    var newArchetype = e.target.value;
    console.log('[DbPlayerCard] Player archetype changed to:', newArchetype);

    // Save to database if we have a valid player
    if (currentDbPlayerId && !isCustomPlayer && newArchetype) {
      try {
        // Get archetype ID for the position
        var position = currentDbPlayer ? currentDbPlayer.position : '';
        var archetypeId = null;

        // Try to get archetype ID from the archetypes list
        if (position) {
          var archetypes = await window.electronAPI.rating.getArchetypes(position);
          if (archetypes) {
            var found = archetypes.find(function(a) { return a.name === newArchetype; });
            if (found) archetypeId = found.id;
          }
        }

        await window.electronAPI.database.savePlayerArchetype(currentDbPlayerId, newArchetype, archetypeId);
        console.log('[DbPlayerCard] Saved player archetype:', newArchetype, 'id:', archetypeId);
      } catch (err) {
        console.error('[DbPlayerCard] Failed to save archetype:', err);
      }
    }

    // Recalculate all OVR values in the all-years table with new archetype
    await renderRatingsAllYears();

    // Also recalculate the single-year OVR if one is selected
    if (selectedYear) {
      await recalculateDbOVR();
    }

    hasUnsavedChanges = true;
    updateSaveButtonState();
  }

  /**
   * Render all years ratings overview table with editable inputs
   * FIXED: Now uses career stats teams as source of truth
   */
  async function renderRatingsAllYears() {
    console.log('[DbPlayerCard] renderRatingsAllYears called');
    console.log('[DbPlayerCard] currentDbPlayerId:', currentDbPlayerId);
    console.log('[DbPlayerCard] availableYears:', availableYears);

    var container = document.getElementById('ratingsAllYearsTable');
    console.log('[DbPlayerCard] ratingsAllYearsTable container found:', !!container);
    if (!container) return;

    // Set container styles for horizontal AND vertical scrolling
    container.style.position = 'relative';
    container.style.maxHeight = '350px';
    container.style.overflowY = 'auto';
    container.style.overflowX = 'auto';

    if (!currentDbPlayerId || availableYears.length === 0) {
      console.log('[DbPlayerCard] No player or years - showing no data message');
      container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No rating data available</p>';
      return;
    }

    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Loading all years...</p>';

    // Get career stats teams (stored from setupYearSelector)
    var careerStatsTeams = window._careerStatsTeams || {};

    // Get team options for dropdown from team_lookup.csv
    var teamOptions = [];
    try {
      var teams = await window.electronAPI.lookup.getDropdownOptions('team_lookup.csv');
      if (teams && teams.length > 0) {
        teamOptions = teams.map(function(t) {
          var name = (t.label || t.name || '').trim();
          return { abbr: name, name: name };
        }).filter(function(t) { return t.name !== ''; });
      }
    } catch (e) {
      console.warn('[DbPlayerCard] Could not load team options:', e);
    }

    try {
      // Fetch all years data
      var allSeasonsData = [];
      for (var i = 0; i < availableYears.length; i++) {
        var year = availableYears[i];
        var result;
        if (isCustomPlayer) {
          result = await window.electronAPI.database.getCustomPlayerSeason(currentDbPlayerId, year);
          if (result.success && result.data) result = { success: true, season: result.data };
        } else {
          result = await window.electronAPI.database.getMergedPlayerSeason(currentDbPlayerId, year);
        }

        // Get team from career stats if not in season data
        var season = result.success && result.season ? result.season : {};
        if (!season.team && careerStatsTeams[year]) {
          season.team = pfrToMaddenTeam(careerStatsTeams[year]);
        } else if (season.team) {
          // Convert existing team if it's a PFR code
          season.team = pfrToMaddenTeam(season.team) || season.team;
        }

        allSeasonsData.push({ year: year, season: season });
      }

      // Define all rating columns - grouped by category
      // CRITICAL: Use DB field names (PCOD, PPUR, etc.) NOT roster field names (PELU, PLPU)
      var ratingColumns = [
        // Core
        { field: 'POVR', label: 'OVR', highlight: true },
        { field: 'PSPD', label: 'SPD' },
        { field: 'PACC', label: 'ACC' },
        { field: 'PSTR', label: 'STR' },
        { field: 'PAGI', label: 'AGI' },
        { field: 'PAWR', label: 'AWR' },
        { field: 'PJMP', label: 'JMP' },
        { field: 'PSTM', label: 'STA' },  // DB uses PSTM, roster uses PSTA
        { field: 'PINJ', label: 'INJ' },
        { field: 'PTGH', label: 'TGH' },
        { field: 'PCOD', label: 'COD' },  // DB uses PCOD, roster uses PELU
        // Passing
        { field: 'PPWR', label: 'THP', category: 'pass' },  // DB uses PPWR, roster uses PTHP
        { field: 'PTAS', label: 'TAS', category: 'pass' },
        { field: 'PTAM', label: 'TAM', category: 'pass' },
        { field: 'PTAD', label: 'TAD', category: 'pass' },
        { field: 'PTOR', label: 'TOR', category: 'pass' },
        { field: 'PTUP', label: 'TUP', category: 'pass' },
        { field: 'PPLA', label: 'PAC', category: 'pass' },
        // Running
        { field: 'PCAR', label: 'CAR', category: 'run' },
        { field: 'PBCV', label: 'BCV', category: 'run' },
        { field: 'PBTK', label: 'BTK', category: 'run' },  // DB uses PBTK, roster uses PBKT
        { field: 'PTRK', label: 'TRK', category: 'run' },  // DB uses PTRK, roster uses PLTR
        { field: 'PSFA', label: 'SFA', category: 'run' },  // DB uses PSFA, roster uses PLSA
        { field: 'PSPN', label: 'SPN', category: 'run' },  // DB uses PSPN, roster uses PLSM
        { field: 'PJKM', label: 'JKM', category: 'run' },  // DB uses PJKM, roster uses PLJM
        // Receiving
        { field: 'PCTH', label: 'CTH', category: 'rec' },
        { field: 'PSPC', label: 'SPC', category: 'rec' },  // DB uses PSPC, roster uses PLSC
        { field: 'PCIT', label: 'CIT', category: 'rec' },  // DB uses PCIT, roster uses PLCI
        { field: 'PSRR', label: 'SRR', category: 'rec' },  // DB uses PSRR, roster uses SRRN
        { field: 'PMRR', label: 'MRR', category: 'rec' },
        { field: 'PDRR', label: 'DRR', category: 'rec' },
        { field: 'PREL', label: 'RLS', category: 'rec' },  // DB uses PREL, roster uses PLRL
        // Blocking
        { field: 'PRBK', label: 'RBK', category: 'blk' },
        { field: 'PPBK', label: 'PBK', category: 'blk' },
        { field: 'PIBK', label: 'IBL', category: 'blk' },  // DB uses PIBK, roster uses PLIB
        { field: 'PLBK', label: 'LBK', category: 'blk' },
        { field: 'PRNS', label: 'RBF', category: 'blk' },  // Run Block Finesse - DB uses PRNS, roster uses PRBF
        { field: 'PRBS', label: 'RBS', category: 'blk' },  // Run Block Strength/Power
        { field: 'PPBF', label: 'PBF', category: 'blk' },  // Pass Block Finesse
        { field: 'PPBP', label: 'PBS', category: 'blk' },  // Pass Block Power - DB uses PPBP, roster uses PPBS
        // Defense
        { field: 'PTAK', label: 'TAK', category: 'def' },
        { field: 'PHIT', label: 'POW', category: 'def' },  // DB uses PHIT, roster uses PLHT
        { field: 'PPWM', label: 'PMV', category: 'def' },  // DB uses PPWM, roster uses PLPM
        { field: 'PFMV', label: 'FMV', category: 'def' },  // DB uses PFMV, roster uses PFMS
        { field: 'PBSH', label: 'BSH', category: 'def' },  // DB uses PBSH, roster uses PBSG
        { field: 'PPUR', label: 'PUR', category: 'def' },  // DB uses PPUR, roster uses PLPU
        { field: 'PPRC', label: 'PRC', category: 'def' },  // DB uses PPRC, roster uses PLPR
        // Coverage
        { field: 'PMCV', label: 'MCV', category: 'cov' },  // DB uses PMCV, roster uses PLMC
        { field: 'PZCV', label: 'ZCV', category: 'cov' },  // DB uses PZCV, roster uses PLZC
        { field: 'PPRS', label: 'PRS', category: 'cov' },  // DB uses PPRS, roster uses PLPE
        // Kicking - DB uses PKPW, roster uses PKPR for kick power
        { field: 'PKPW', label: 'KPW', category: 'kick' },
        { field: 'PKAC', label: 'KAC', category: 'kick' },
        { field: 'PKRT', label: 'KRT', category: 'kick' }
      ];

      // Build team dropdown options HTML
      var teamOptionsHtml = '<option value="">-</option>';
      teamOptions.forEach(function(team) {
        teamOptionsHtml += '<option value="' + (team.abbr || team.name) + '">' + (team.abbr || team.name) + '</option>';
      });

      // Styles - wider inputs for easier typing, hide spin buttons
      var stickyThStyle = 'position: sticky; top: 0; z-index: 10; padding: 6px 4px; border-bottom: 2px solid var(--border-color); background: #1a1a1a; color: #fff; font-weight: 600; font-size: 11px; white-space: nowrap;';
      var inputStyle = 'width: 42px; text-align: center; background: #252525; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 2px; font-size: 12px; -moz-appearance: textfield;';
      var selectStyle = 'width: 70px; background: #252525; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 2px; font-size: 11px;';

      // Add CSS to hide number input spinners (WebKit/Blink browsers)
      var styleEl = document.getElementById('ratings-table-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'ratings-table-style';
        styleEl.textContent = '.ratings-table input[type=number]::-webkit-outer-spin-button, .ratings-table input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } .ratings-table input[type=number] { -moz-appearance: textfield; } .ratings-table input:focus { outline: 2px solid #4caf50; border-color: #4caf50; }';
        document.head.appendChild(styleEl);
      }

      // Build table
      var deleteButtonStyle = 'background: transparent; border: none; color: #f44336; cursor: pointer; font-size: 14px; padding: 2px 6px; opacity: 0.7; transition: opacity 0.2s;';
      var html = '<table class="ratings-table" style="border-collapse: collapse; font-size: 11px; min-width: max-content;">';
      html += '<thead>';
      html += '<tr>';
      // Fixed columns: Delete, Year, Team, Age
      html += '<th style="text-align: center; ' + stickyThStyle + ' width: 30px;"></th>'; // Delete column header (empty)
      html += '<th style="text-align: left; ' + stickyThStyle + ' position: sticky; left: 0; z-index: 20; background: #1a1a1a;">Year</th>';
      html += '<th style="text-align: left; ' + stickyThStyle + '">Team</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">Age</th>';
      // All rating columns
      ratingColumns.forEach(function(col) {
        var bgStyle = col.highlight ? ' background: #2a4a2a; color: #4caf50;' : '';
        html += '<th style="text-align: center; ' + stickyThStyle + bgStyle + '">' + col.label + '</th>';
      });
      html += '</tr></thead><tbody>';

      allSeasonsData.forEach(function(data) {
        var s = data.season || {};
        var r = s.ratings || {};
        var yr = data.year;
        var currentTeam = s.team || '';

        html += '<tr style="border-bottom: 1px solid #333;" data-year="' + yr + '">';
        // Delete button
        html += '<td style="padding: 2px; text-align: center;"><button style="' + deleteButtonStyle + '" onclick="window.deletePlayerSeasonYear(' + yr + ')" title="Delete ' + yr + ' season" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">&#x2715;</button></td>';
        // Year - sticky left, clickable
        html += '<td style="padding: 4px; color: #64b5f6; cursor: pointer; font-weight: 500; position: sticky; left: 0; background: #1a1a1a; z-index: 5;" onclick="document.getElementById(\'dbPlayerYearSelect\').value=\'' + yr + '\'; document.getElementById(\'dbPlayerYearSelect\').dispatchEvent(new Event(\'change\'));" title="Click to edit full ratings">' + yr + '</td>';
        // Team - editable dropdown
        html += '<td style="padding: 2px;"><select style="' + selectStyle + '" data-year="' + yr + '" data-field="team" onchange="window.saveAllYearsRatingEdit(this)">';
        teamOptions.forEach(function(team) {
          var abbr = team.abbr || team.name;
          var selected = (abbr === currentTeam) ? ' selected' : '';
          html += '<option value="' + abbr + '"' + selected + '>' + abbr + '</option>';
        });
        html += '</select></td>';
        // Age - editable input, saves after short delay on blur to not interfere with focus
        html += '<td style="padding: 2px; text-align: center;"><input type="number" min="18" max="50" style="' + inputStyle + '" data-year="' + yr + '" data-field="age" value="' + (s.age || '') + '" onblur="var el=this;setTimeout(function(){window.saveAllYearsRatingEdit(el)},50)" onkeydown="if(event.key===\'Enter\'){this.blur();}"></td>';
        // All rating columns - editable inputs
        ratingColumns.forEach(function(col) {
          var val = r[col.field] || '';
          var style = inputStyle;
          if (col.highlight) {
            style += ' font-weight: bold; color: #4caf50; background: #1a2a1a;';
          }
          html += '<td style="padding: 2px; text-align: center;"><input type="number" min="0" max="99" style="' + style + '" data-year="' + yr + '" data-field="' + col.field + '" value="' + val + '" onblur="var el=this;setTimeout(function(){window.saveAllYearsRatingEdit(el)},50)" onkeydown="if(event.key===\'Enter\'){this.blur();}"></td>';
        });
        html += '</tr>';
      });

      html += '</tbody></table>';
      html += '<p style="color: #888; font-size: 10px; margin-top: 6px;">Type directly in cells to edit. Press Enter or click away to save. Click year to view full form.</p>';

      container.innerHTML = html;

      // CRITICAL: Recalculate OVR for all rows after table is rendered
      // This ensures displayed OVR matches what the calculation produces
      // Uses the player-level archetype for CONSISTENT calculation everywhere
      var position = currentDbPlayer ? currentDbPlayer.position : null;
      var playerArchetypeSelect = document.getElementById('dbPlayerArchetype');
      var playerLevelArchetype = playerArchetypeSelect ? playerArchetypeSelect.value : '';

      if (position) {
        var rows = container.querySelectorAll('tbody tr');
        for (var rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          var row = rows[rowIdx];
          var ovrInput = row.querySelector('input[data-field="POVR"]');
          if (!ovrInput) continue;

          // Collect all rating values from this row
          var attributes = {};
          var inputs = row.querySelectorAll('input[data-field]');
          inputs.forEach(function(inp) {
            var field = inp.dataset.field;
            var val = inp.value ? parseInt(inp.value, 10) : 0;
            if (field && field !== 'age' && field !== 'POVR' && !isNaN(val) && val > 0) {
              // Map to the OVR calculator's expected field code
              var ovrFieldCode = DB_TO_OVR_FIELD_MAP[field] || field;
              attributes[ovrFieldCode] = val;
            }
          });

          // Only recalculate if we have enough attributes
          if (Object.keys(attributes).length >= 5) {
            try {
              var newOVR;

              if (playerLevelArchetype) {
                // Use player-level archetype for consistent OVR calculation
                newOVR = await window.electronAPI.rating.calculateOVRMadden(position, attributes, playerLevelArchetype);
              } else {
                // No player archetype set - use best archetype as fallback
                var archetypeResults = await window.electronAPI.rating.calculateOVRForArchetypes(attributes, position);
                if (archetypeResults && archetypeResults.length > 0) {
                  newOVR = archetypeResults[0].ovr;
                }
              }

              if (newOVR !== undefined) {
                var storedOVR = parseInt(ovrInput.value) || 0;
                if (newOVR !== storedOVR) {
                  console.log('[DbPlayerCard] Row', rowIdx, 'OVR mismatch: stored=' + storedOVR + ', calculated=' + newOVR + ' (archetype: ' + (playerLevelArchetype || 'best') + ') - updating display');
                  ovrInput.value = newOVR;
                }
              }
            } catch (e) {
              console.warn('[DbPlayerCard] Could not recalculate OVR for row', rowIdx, ':', e.message);
            }
          }
        }
      }

      // Setup right-click context menu for fill operations
      setupRatingsTableContextMenu(container);

    } catch (error) {
      console.error('[DbPlayerCard] Error loading all years ratings:', error);
      container.innerHTML = '<p style="color: #f44336; text-align: center; padding: 20px;">Error loading ratings: ' + error.message + '</p>';
    }
  }

  /**
   * Setup right-click context menu for ratings table fill operations
   */
  function setupRatingsTableContextMenu(tableContainer) {

    // Create context menu if it doesn't exist
    var menuId = 'ratings-fill-context-menu';
    var menu = document.getElementById(menuId);
    if (!menu) {
      menu = document.createElement('div');
      menu.id = menuId;
      menu.style.cssText = 'position: fixed; display: none; background: #2a2a2a; border: 1px solid #555; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 999999; min-width: 180px; padding: 4px 0;';
      var menuItemStyle = 'padding: 8px 16px; cursor: pointer; color: #e0e0e0; font-size: 13px; transition: background 0.15s;';
      menu.innerHTML = '<div id="fill-down-option" style="' + menuItemStyle + '">' +
        '<span style="margin-right: 8px;">&#x2193;</span> Fill Empty Below</div>' +
        '<div id="fill-down-increment-option" style="' + menuItemStyle + ' display: none;">' +
        '<span style="margin-right: 8px;">&#x2193;</span> Fill Below (+1 each)</div>' +
        '<div style="border-top: 1px solid #444; margin: 4px 0;"></div>' +
        '<div id="fill-all-option" style="' + menuItemStyle + '">' +
        '<span style="margin-right: 8px;">&#x2195;</span> Fill All Empty</div>' +
        '<div id="fill-all-increment-option" style="' + menuItemStyle + ' display: none;">' +
        '<span style="margin-right: 8px;">&#x2195;</span> Fill All (+1 each)</div>';
      document.body.appendChild(menu);

      // Add hover effects
      menu.querySelectorAll('div[id]').forEach(function(item) {
        item.addEventListener('mouseenter', function() { this.style.background = '#3a3a3a'; });
        item.addEventListener('mouseleave', function() { this.style.background = ''; });
      });

      // Hide menu on click elsewhere (but not on right-click)
      // Use mousedown instead of click to avoid race with contextmenu
      document.addEventListener('mousedown', function(e) {
        // Don't hide on right-click (button 2)
        if (e.button === 2) return;
        // Don't hide if clicking inside the menu
        if (menu.contains(e.target)) return;
        menu.style.display = 'none';
      });

      // Setup click handlers once (store tableContainer reference on menu)
      document.getElementById('fill-down-option').onclick = async function() {
        var ctx = menu._contextData;
        if (!ctx) return;
        menu.style.display = 'none';
        await fillColumnValues(ctx.tableContainer, ctx.input, 'down', false);
      };

      document.getElementById('fill-down-increment-option').onclick = async function() {
        var ctx = menu._contextData;
        if (!ctx) return;
        menu.style.display = 'none';
        await fillColumnValues(ctx.tableContainer, ctx.input, 'down', true);
      };

      document.getElementById('fill-all-option').onclick = async function() {
        var ctx = menu._contextData;
        if (!ctx) return;
        menu.style.display = 'none';
        await fillColumnValues(ctx.tableContainer, ctx.input, 'all', false);
      };

      document.getElementById('fill-all-increment-option').onclick = async function() {
        var ctx = menu._contextData;
        if (!ctx) return;
        menu.style.display = 'none';
        await fillColumnValues(ctx.tableContainer, ctx.input, 'all', true);
      };
    }

    // Add context menu to all inputs in the table
    var inputs = tableContainer.querySelectorAll('input[data-field]');
    inputs.forEach(function(input) {
      input.addEventListener('contextmenu', function(e) {
        var value = input.value ? parseInt(input.value, 10) : null;

        // Only show menu if cell has a value
        if (value === null || isNaN(value)) {
          return; // Let default context menu show
        }

        e.preventDefault();
        e.stopPropagation();

        // Get menu element
        var menuEl = document.getElementById('ratings-fill-context-menu');
        if (!menuEl) return;

        // Store context data on the menu element
        menuEl._contextData = {
          input: input,
          tableContainer: tableContainer
        };

        var field = input.dataset.field;
        var isAge = (field === 'age');

        // Show/hide increment options based on field type
        document.getElementById('fill-down-increment-option').style.display = isAge ? 'block' : 'none';
        document.getElementById('fill-all-increment-option').style.display = isAge ? 'block' : 'none';

        // Position and show menu
        menuEl.style.left = e.clientX + 'px';
        menuEl.style.top = e.clientY + 'px';
        menuEl.style.display = 'block';

        // Ensure menu stays in viewport
        var rect = menuEl.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          menuEl.style.left = (window.innerWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
          menuEl.style.top = (window.innerHeight - rect.height - 10) + 'px';
        }
      });
    });
  }

  /**
   * Fill column values from a source cell
   * @param {HTMLElement} tableContainer - The table container
   * @param {HTMLInputElement} sourceInput - The source input with the value
   * @param {string} direction - 'down' for below only, 'all' for entire column
   * @param {boolean} increment - If true, add 1 per row (for age)
   */
  async function fillColumnValues(tableContainer, sourceInput, direction, increment) {
    var field = sourceInput.dataset.field;
    var sourceYear = parseInt(sourceInput.dataset.year, 10);
    var sourceValue = parseInt(sourceInput.value, 10);

    if (isNaN(sourceValue)) {
      console.warn('[DbPlayerCard] Cannot fill - source value is not a number');
      return;
    }

    // Get all inputs for this field
    var allInputs = tableContainer.querySelectorAll('input[data-field="' + field + '"]');
    var inputsArray = Array.from(allInputs);

    // Find source index
    var sourceIndex = -1;
    for (var i = 0; i < inputsArray.length; i++) {
      if (parseInt(inputsArray[i].dataset.year, 10) === sourceYear) {
        sourceIndex = i;
        break;
      }
    }

    if (sourceIndex === -1) {
      console.error('[DbPlayerCard] Could not find source cell');
      return;
    }

    // Determine which cells to fill
    var startIndex = (direction === 'all') ? 0 : sourceIndex + 1;
    var endIndex = inputsArray.length;

    var filledCount = 0;
    var errors = [];

    for (var idx = startIndex; idx < endIndex; idx++) {
      var input = inputsArray[idx];
      var currentValue = input.value ? parseInt(input.value, 10) : null;

      // Skip if cell already has a value (only fill empty)
      if (currentValue !== null && !isNaN(currentValue)) {
        continue;
      }

      // Skip the source cell itself
      if (idx === sourceIndex) {
        continue;
      }

      // Calculate value (with increment if requested)
      var newValue;
      if (increment) {
        // Calculate offset from source
        var offset = idx - sourceIndex;
        newValue = sourceValue + offset;
        // Clamp age to valid range
        if (field === 'age') {
          newValue = Math.max(18, Math.min(50, newValue));
        }
      } else {
        newValue = sourceValue;
      }

      // Clamp rating values
      if (field !== 'age') {
        newValue = Math.max(0, Math.min(99, newValue));
      }

      // Set value in UI
      input.value = newValue;

      // Save to database
      try {
        await saveAllYearsRatingEdit(input);
        filledCount++;

        // Visual feedback
        input.style.backgroundColor = 'rgba(33, 150, 243, 0.3)';
        setTimeout(function(el) {
          return function() { el.style.backgroundColor = ''; };
        }(input), 800);
      } catch (e) {
        errors.push(e.message);
        console.error('[DbPlayerCard] Error filling cell:', e);
      }
    }

    // Show result
    var message = 'Filled ' + filledCount + ' cell(s)';
    if (increment) {
      message += ' with increment';
    }
    if (errors.length > 0) {
      message += ' (' + errors.length + ' errors)';
    }
    if (typeof window.showToast === 'function') {
      window.showToast(message, errors.length > 0 ? 'warning' : 'success');
    }

    console.log('[DbPlayerCard] ' + message);
  }

  /**
   * Save rating edit from all-years table
   */
  async function saveAllYearsRatingEdit(input) {
    var year = parseInt(input.dataset.year, 10);
    var field = input.dataset.field;
    var isSelect = input.tagName === 'SELECT';
    var value;

    if (field === 'team') {
      // Team is a string value
      value = input.value || null;
    } else {
      // Numeric fields
      value = input.value ? parseInt(input.value, 10) : null;
    }

    if (!currentDbPlayerId || isNaN(year)) {
      console.error('[DbPlayerCard] Invalid player or year for rating edit');
      return;
    }

    console.log('[DbPlayerCard] Saving all-years rating edit:', year, field, value);

    try {
      if (field === 'age' || field === 'team') {
        var seasonData = {};
        seasonData[field] = value;
        if (isCustomPlayer) {
          await window.electronAPI.database.saveCustomPlayerSeason(currentDbPlayerId, year, seasonData);
        } else {
          await window.electronAPI.database.saveSeasonEdit(currentDbPlayerId, year, seasonData);
        }

        if (field === 'team' && currentDbPlayer && careerStatsData) {
          setTimeout(async function() {
            await renderCareerStatsAllYears(careerStatsData);
          }, 100);
        }
      } else {
        var ratings = {};
        ratings[field] = value;
        if (isCustomPlayer) {
          await window.electronAPI.database.saveCustomPlayerSeason(currentDbPlayerId, year, { ratings: ratings });
        } else {
          await window.electronAPI.database.saveSeasonEdit(currentDbPlayerId, year, { ratings: ratings });
        }

        if (field === 'POVR') {
          await distributeOVRToRatingsForRow(input, year, value);
        } else {
          await recalculateOVRForRow(input, year);
        }
      }

      // Visual feedback
      if (isSelect) {
        input.style.outline = '2px solid rgba(76, 175, 80, 0.6)';
        setTimeout(function() { input.style.outline = ''; }, 500);
      } else {
        input.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
        setTimeout(function() { input.style.backgroundColor = ''; }, 500);
      }

      hasUnsavedChanges = true;
      updateSaveButtonState();

    } catch (error) {
      console.error('[DbPlayerCard] Error saving all-years rating edit:', error);
      if (isSelect) {
        input.style.outline = '2px solid rgba(244, 67, 54, 0.6)';
        setTimeout(function() {
          input.style.outline = '';
        }, 1000);
      } else {
        input.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
        setTimeout(function() {
          input.style.backgroundColor = '';
        }, 1000);
      }
    }
  }

  /**
   * Recalculate OVR for a row in the all-years table when a rating changes
   * Also syncs archetype to match what Madden will assign based on ratings
   */
  async function recalculateOVRForRow(changedInput, year) {
    // Find the row containing this input
    var row = changedInput.closest('tr');
    if (!row) return;

    // Get position from the player
    var position = currentDbPlayer ? currentDbPlayer.position : null;
    if (!position) {
      console.log('[DbPlayerCard] No position for OVR calculation');
      return;
    }

    // CRITICAL: Use player-level archetype (constant across all seasons)
    var playerArchetypeSelect = document.getElementById('dbPlayerArchetype');
    var playerLevelArchetype = playerArchetypeSelect ? playerArchetypeSelect.value : '';

    // Collect all rating values from the row, mapping to OVR calculator field codes
    var attributes = {};
    var inputs = row.querySelectorAll('input[data-field]');
    inputs.forEach(function(inp) {
      var field = inp.dataset.field;
      var val = inp.value ? parseInt(inp.value, 10) : 0;
      if (field && field !== 'age' && !isNaN(val)) {
        // Map to the OVR calculator's expected field code
        var ovrFieldCode = DB_TO_OVR_FIELD_MAP[field] || field;
        attributes[ovrFieldCode] = val;
      }
    });

    try {
      var newOVR;

      if (playerLevelArchetype) {
        // Use the PLAYER-LEVEL archetype for OVR calculation (consistent everywhere)
        newOVR = await window.electronAPI.rating.calculateOVRMadden(position, attributes, playerLevelArchetype);
        console.log('[DbPlayerCard] Row OVR calculated using player archetype:', playerLevelArchetype, '=', newOVR, 'for year', year);
      } else {
        // No player-level archetype set - find best archetype
        var archetypeResults = await window.electronAPI.rating.calculateOVRForArchetypes(attributes, position);
        if (archetypeResults && archetypeResults.length > 0) {
          newOVR = archetypeResults[0].ovr;
          console.log('[DbPlayerCard] Row OVR calculated using best archetype:', archetypeResults[0].name, '=', newOVR, 'for year', year);
        } else {
          newOVR = 50;
        }
      }

      // Find and update the OVR input in this row
      var ovrInput = row.querySelector('input[data-field="POVR"]');
      if (ovrInput && newOVR !== undefined) {
        ovrInput.value = newOVR;

        // Flash the OVR cell to show it updated
        ovrInput.style.backgroundColor = 'rgba(76, 175, 80, 0.4)';
        setTimeout(function() {
          ovrInput.style.backgroundColor = '';
        }, 800);

        // Save the new OVR
        var ratings = { POVR: newOVR };
        if (isCustomPlayer) {
          await window.electronAPI.database.saveCustomPlayerSeason(currentDbPlayerId, year, { ratings: ratings });
        } else {
          await window.electronAPI.database.saveSeasonEdit(currentDbPlayerId, year, { ratings: ratings });
        }
      }
    } catch (error) {
      console.error('[DbPlayerCard] Error calculating OVR:', error);
    }
  }

  /**
   * Distribute OVR to ratings for a row in the all-years table
   * When user sets an OVR directly, generate appropriate ratings
   * Also determines and saves the archetype from the generated ratings
   */
  async function distributeOVRToRatingsForRow(ovrInput, year, targetOVR) {
    if (!targetOVR || targetOVR < 40 || targetOVR > 99) {
      console.log('[DbPlayerCard] Invalid OVR for distribution:', targetOVR);
      return;
    }

    var row = ovrInput.closest('tr');
    if (!row) return;

    var position = currentDbPlayer ? currentDbPlayer.position : null;
    if (!position) {
      console.log('[DbPlayerCard] No position for OVR distribution');
      return;
    }

    console.log('[DbPlayerCard] Distributing OVR', targetOVR, 'to ratings for position', position);

    try {
      // Call the backend to generate ratings from OVR (also returns archetype)
      var result = await window.electronAPI.database.distributeOVRToRatings({
        ovr: targetOVR,
        position: position
      });

      if (!result.success || !result.ratings) {
        console.error('[DbPlayerCard] Failed to distribute OVR:', result.error);
        return;
      }

      var ratings = result.ratings;
      ratings.POVR = targetOVR; // Ensure OVR is set

      // Update all rating inputs in this row
      var inputs = row.querySelectorAll('input[data-field]');
      inputs.forEach(function(inp) {
        var field = inp.dataset.field;
        if (field && field !== 'age' && ratings[field] !== undefined) {
          inp.value = ratings[field];
          // Flash to show it updated
          inp.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
          setTimeout(function() {
            inp.style.backgroundColor = '';
          }, 600);
        }
      });

      // Build save data with ratings only
      // CRITICAL: Do NOT save archetype from distribution result - this would overwrite
      // the user's player-level archetype selection. The archetype is managed separately
      // via the player-level dropdown.
      var saveData = { ratings: ratings };
      // Note: result.archetype is intentionally NOT saved here

      // Save ratings to database
      if (isCustomPlayer) {
        await window.electronAPI.database.saveCustomPlayerSeason(currentDbPlayerId, year, saveData);
      } else {
        await window.electronAPI.database.saveSeasonEdit(currentDbPlayerId, year, saveData);
      }

      console.log('[DbPlayerCard] Distributed OVR to', Object.keys(ratings).length, 'rating fields with archetype:', result.archetype);

    } catch (error) {
      console.error('[DbPlayerCard] Error distributing OVR:', error);
    }
  }

  // Expose save function globally for inline onchange handlers
  window.saveAllYearsRatingEdit = saveAllYearsRatingEdit;

  /**
   * Delete a specific season/year for the current player
   * @param {number} year - The year to delete
   */
  async function deletePlayerSeasonYear(year) {
    if (!currentDbPlayerId) {
      console.error('[DbPlayerCard] No player loaded');
      return;
    }

    var playerName = currentDbPlayer ? ((currentDbPlayer.firstName || '') + ' ' + (currentDbPlayer.lastName || '')).trim() : 'this player';

    var confirmed = confirm(
      'Delete ' + year + ' season for ' + playerName + '?\n\n' +
      'This will remove the rating data for this year.\n' +
      'This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      var result;
      if (isCustomPlayer) {
        result = await window.electronAPI.database.deleteCustomPlayerSeason(currentDbPlayerId, year);
      } else {
        result = await window.electronAPI.database.deletePlayerSeason(currentDbPlayerId, year);
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete season');
      }

      console.log('[DbPlayerCard] Deleted season ' + year + ' for player ' + currentDbPlayerId);

      // Remove year from available years
      var idx = availableYears.indexOf(year);
      if (idx !== -1) {
        availableYears.splice(idx, 1);
      }

      // Refresh the all-years table
      await renderRatingsAllYears();

      // If the deleted year was selected, clear the form
      if (selectedYear === year) {
        selectedYear = null;
        clearRatingsForm();
        var yearSelect = document.getElementById('dbPlayerYearSelect');
        if (yearSelect) yearSelect.value = '';
      }

      // Also refresh career stats if shown
      if (typeof renderCareerStatsAllYears === 'function' && careerStatsData) {
        await renderCareerStatsAllYears(careerStatsData);
      }

    } catch (error) {
      console.error('[DbPlayerCard] Failed to delete season:', error);
      alert('Failed to delete season: ' + error.message);
    }
  }

  // Expose delete function globally for inline onclick handlers
  window.deletePlayerSeasonYear = deletePlayerSeasonYear;

  /**
   * Load ratings for a specific year
   */
  async function loadRatingsForYear(year) {
    if (!year || !currentDbPlayerId) return;

    try {
      console.log('[DbPlayerCard] Loading ratings for year:', year, 'player:', currentDbPlayerId, 'isCustomPlayer:', isCustomPlayer);

      var result;
      if (isCustomPlayer) {
        // Custom players use custom_player_seasons table
        result = await window.electronAPI.database.getCustomPlayerSeason(currentDbPlayerId, year);
        // Transform result to match expected format
        if (result.success && result.data) {
          result = { success: true, season: result.data };
        }
      } else {
        // Original players use merged season data
        result = await window.electronAPI.database.getMergedPlayerSeason(currentDbPlayerId, year);
      }

      if (result.success && result.season) {
        console.log('[DbPlayerCard] Season data loaded:', {
          team: result.season.team,
          position: result.season.position,
          archetype: result.season.archetype,
          age: result.season.age,
          jersey: result.season.jersey,
          ratings: result.season.ratings
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

      // Restore OS-level window focus after IPC call (critical for Windows keyboard input)
      if (window.electronAPI && window.electronAPI.window && window.electronAPI.window.focus) {
        window.electronAPI.window.focus().catch(function() {});
      }
    } catch (error) {
      console.error('[DatabasePlayerCard] Failed to load ratings:', error);
      clearRatingsForm();
    }
  }

  /**
   * Update the PLAYER-LEVEL archetype dropdown based on the selected position
   * This is the constant archetype used for all seasons (unlike season archetype)
   * @param {string} position - The position to get archetypes for
   * @param {string} selectedValue - Optional value to select after populating
   */
  async function updatePlayerLevelArchetypeDropdown(position, selectedValue) {
    var archetypeSelect = document.getElementById('dbPlayerArchetype');
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
      console.log('[DbPlayerCard] Player-level archetypes for', position, ':', archetypes);

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
              console.log('[DbPlayerCard] Player-level archetype set to:', selectedValue);
              break;
            }
          }
          // If not found, try partial match
          if (!found && selectedValue) {
            for (var j = 0; j < archetypeSelect.options.length; j++) {
              if (archetypeSelect.options[j].value.indexOf(selectedValue) !== -1 ||
                  selectedValue.indexOf(archetypeSelect.options[j].value) !== -1) {
                archetypeSelect.value = archetypeSelect.options[j].value;
                console.log('[DbPlayerCard] Player-level archetype partial match:', archetypeSelect.options[j].value);
                break;
              }
            }
          }
        }
      } else {
        archetypeSelect.innerHTML = '<option value="">No archetypes for ' + position + '</option>';
      }
    } catch (error) {
      console.error('[DbPlayerCard] Failed to load player-level archetypes:', error);
      archetypeSelect.innerHTML = '<option value="">Error loading archetypes</option>';
    }
  }

  /**
   * Populate the ratings form
   */
  function populateRatingsForm(season) {
    // Clear OVR previousValue so it captures fresh value on next focus
    var ovrInput = document.getElementById('dbRating_POVR');
    if (ovrInput) {
      ovrInput.dataset.previousValue = '';
    }

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

    // All rating fields - ratings are in nested 'ratings' object
    // Database uses different field names than display (e.g., PKPW in DB = PKPR for display)
    var ratings = season.ratings || {};

    // DEBUG: Log kick power fields to trace the issue
    console.log('[DbPlayerCard] KICK DEBUG - season.ratings keys:', Object.keys(ratings));
    console.log('[DbPlayerCard] KICK DEBUG - ratings.PKPR:', ratings.PKPR);
    console.log('[DbPlayerCard] KICK DEBUG - ratings.PKPW:', ratings.PKPW);
    console.log('[DbPlayerCard] KICK DEBUG - ratings.PKAC:', ratings.PKAC);

    // Map from display field names to database field names for loading
    var DISPLAY_TO_DB_FIELD = {
      'PKPR': 'PKPW',  // Kick power: display=PKPR, db=PKPW
      'PSTA': 'PSTM',  // Stamina: display=PSTA, db=PSTM
      'PBKT': 'PBTK',  // Break tackle: display=PBKT, db=PBTK
      'PLTR': 'PTRK',  // Trucking: display=PLTR, db=PTRK
      'PELU': 'PCOD',  // Change of direction: display=PELU, db=PCOD
      'PLSA': 'PSFA',  // Stiff arm: display=PLSA, db=PSFA
      'PLSM': 'PSPN',  // Spin move: display=PLSM, db=PSPN
      'PLJM': 'PJKM',  // Juke move: display=PLJM, db=PJKM
      'PTHP': 'PPWR',  // Throw power: display=PTHP, db=PPWR
      'PLSC': 'PSPC',  // Spectacular catch: display=PLSC, db=PSPC
      'PLCI': 'PCIT',  // Catch in traffic: display=PLCI, db=PCIT
      'SRRN': 'PSRR',  // Short route running: display=SRRN, db=PSRR
      'PLRL': 'PREL',  // Release: display=PLRL, db=PREL
      'PLIB': 'PIBK',  // Impact blocking: display=PLIB, db=PIBK
      'PRBF': 'PRNS',  // Run block finesse: display=PRBF, db=PRNS
      'PPBS': 'PPBP',  // Pass block power: display=PPBS, db=PPBP
      'PLHT': 'PHIT',  // Hit power: display=PLHT, db=PHIT
      'PLPE': 'PPRS',  // Press: display=PLPE, db=PPRS
      'PFMS': 'PFMV',  // Finesse moves: display=PFMS, db=PFMV
      'PLPM': 'PPWM',  // Power moves: display=PLPM, db=PPWM
      'PBSG': 'PBSH',  // Block shedding: display=PBSG, db=PBSH
      'PLPR': 'PPRC',  // Play recognition: display=PLPR, db=PPRC
      'PLPU': 'PPUR',  // Pursuit: display=PLPU, db=PPUR
      'PLMC': 'PMCV',  // Man coverage: display=PLMC, db=PMCV
      'PLZC': 'PZCV',  // Zone coverage: display=PLZC, db=PZCV
    };

    RATING_FIELDS.forEach(function(item) {
      var inputId = 'dbRating_' + item.field;
      // Try display field name first, then mapped database field name
      var dbField = DISPLAY_TO_DB_FIELD[item.field];
      var value = ratings[item.field];
      if (value === undefined && dbField) {
        value = ratings[dbField];
      }
      // Debug kick power specifically
      if (item.field === 'PKPR') {
        console.log('[DbPlayerCard] PKPR MAPPING: field=' + item.field + ', dbField=' + dbField +
          ', ratings[field]=' + ratings[item.field] + ', ratings[dbField]=' + ratings[dbField] +
          ', finalValue=' + value);
      }
      setValue(inputId, value !== undefined ? value : '');
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
          maddenCommid: getValue('dbPlayerCommID'),
          bodyType: getIntValue('dbPlayerBodyType'),
          handedness: getIntValue('dbPlayerHandedness'),
          has3DModel: document.getElementById('dbPlayerHas3DModel')?.checked || false
        };

        // Include PGHE matched set data if a generic face was assigned
        if (currentDbPlayer && currentDbPlayer._pgheData) {
          var pghe = currentDbPlayer._pgheData;
          playerData.maddenPghe = pghe.pghe;
          playerData.maddenPfcg = pghe.pfcg;
          playerData.maddenGpan = pghe.gpan;
          playerData.maddenGslp = pghe.gslp;
          playerData.maddenCpvf = pghe.cpvf;
          playerData.maddenSkinTone = pghe.skinTone;
          console.log('[DatabasePlayerCard] Including PGHE data in custom player:', pghe);
        }

        console.log('[DatabasePlayerCard] Creating new custom player:', playerData);
        var result = await window.electronAPI.database.createCustomPlayer(playerData);

        if (!result.success) {
          throw new Error(result.error || 'Failed to create player');
        }

        console.log('[DatabasePlayerCard] Player created with ID:', result.id);

        // Save initial season data (ratings, position, archetype) if any ratings were entered
        var initialYear = playerData.draftClass || playerData.careerFrom || new Date().getFullYear();
        var seasonData = collectSeasonEdits(false); // Get all season data

        if (seasonData && Object.keys(seasonData).length > 0) {
          console.log('[DatabasePlayerCard] Saving initial season data for year:', initialYear, seasonData);
          try {
            // Check if "Apply to all years" is checked
            var applyToAllYears = document.getElementById('dbApplyToAllYears');
            var incrementAge = document.getElementById('dbIncrementAgeEachYear');

            if (applyToAllYears && applyToAllYears.checked && playerData.careerFrom && playerData.careerTo) {
              // Save to all years in career span
              var options = {};
              if (incrementAge && incrementAge.checked && seasonData.age !== undefined) {
                options.incrementAge = true;
              }
              var allYearsResult = await window.electronAPI.database.saveCustomPlayerSeasonAllYears(
                result.id, seasonData, options
              );
              console.log('[DatabasePlayerCard] Saved initial season to all years:', allYearsResult);
            } else {
              // Save to just the initial year
              await window.electronAPI.database.saveCustomPlayerSeason(result.id, initialYear, seasonData);
              console.log('[DatabasePlayerCard] Saved initial season for year:', initialYear);
            }
          } catch (seasonError) {
            console.error('[DatabasePlayerCard] Failed to save initial season:', seasonError);
            // Don't block player creation for season save failure
          }
        }

        // Check if this was created from Portrait Manager with a pending portrait
        var pendingPortraitPid = window.portraitManager && window.portraitManager.getPendingPortraitPid
          ? window.portraitManager.getPendingPortraitPid()
          : null;

        if (pendingPortraitPid) {
          console.log('[DatabasePlayerCard] Updating portrait metadata for PID:', pendingPortraitPid);
          try {
            await window.electronAPI.customPortrait.updateMetadata(pendingPortraitPid, {
              playerName: firstName + ' ' + lastName,
              databasePlayerId: result.id
            });
            console.log('[DatabasePlayerCard] Portrait metadata updated successfully');

            // Clear the pending PID
            if (window.portraitManager && window.portraitManager.clearPendingPortraitPid) {
              window.portraitManager.clearPendingPortraitPid();
            }

            // Refresh portrait manager grid
            if (window.portraitManager && window.portraitManager.refresh) {
              window.portraitManager.refresh();
            }
          } catch (portraitError) {
            console.error('[DatabasePlayerCard] Failed to update portrait metadata:', portraitError);
            // Don't block player creation for portrait metadata failure
          }
        }

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

    if (currentDbPlayerId === null || currentDbPlayerId === undefined) {
      console.error('[DatabasePlayerCard] Cannot save: no player loaded');
      return;
    }

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
        bodyType: getIntValue('dbPlayerBodyType'),
        handedness: getIntValue('dbPlayerHandedness'),
        has3DModel: document.getElementById('dbPlayerHas3DModel')?.checked || false,
        draftClass: getIntValue('dbPlayerDraftClass'),
        draftRound: getValue('dbPlayerDraftRound'),
        draftPick: getIntValue('dbPlayerDraftPick'),
        careerFrom: getIntValue('dbPlayerCareerFrom'),
        careerTo: getIntValue('dbPlayerCareerTo'),
        isHof: document.getElementById('dbPlayerHOF')?.checked || false
      };
      console.log('[DatabasePlayerCard] Saving playerEdits:', playerEdits);

      // Collect appearance edits (including PGHE matched set if assigned)
      var pidInputEl = document.getElementById('dbPlayerPID');
      var pidInputValue = pidInputEl ? pidInputEl.value : 'NO_ELEMENT';
      console.log('[DatabasePlayerCard] DEBUG - PID input element:', pidInputEl);
      console.log('[DatabasePlayerCard] DEBUG - PID input raw value:', pidInputValue);
      console.log('[DatabasePlayerCard] DEBUG - PID parsed value:', getIntValue('dbPlayerPID'));

      var appearanceEdits = {
        maddenPid: getIntValue('dbPlayerPID'),
        maddenPam: getValue('dbPlayerPAM'),
        maddenPlpo: getValue('dbPlayerPLPO'),
        maddenCommid: getValue('dbPlayerCommID')
      };

      // Include PGHE matched set data if a generic face was assigned
      if (currentDbPlayer && currentDbPlayer._pgheData) {
        var pghe = currentDbPlayer._pgheData;
        appearanceEdits.maddenPghe = pghe.pghe;
        appearanceEdits.maddenPfcg = pghe.pfcg;
        appearanceEdits.maddenGpan = pghe.gpan;
        appearanceEdits.maddenGslp = pghe.gslp;
        appearanceEdits.maddenCpvf = pghe.cpvf;
        appearanceEdits.maddenSkinTone = pghe.skinTone;
        appearanceEdits.isGenericFace = true;  // EXPLICIT FLAG: this is a generic face
        console.log('[DatabasePlayerCard] Including PGHE data in appearance save:', pghe, 'isGenericFace=true');
      }

      // Collect trait edits
      var traitEdits = collectTraitEdits();
      if (Object.keys(traitEdits).length > 0) {
        console.log('[DatabasePlayerCard] Trait edits collected:', traitEdits);
        // Merge trait edits into player edits (for custom players)
        // or handle separately for franchise files
        Object.assign(playerEdits, traitEdits);
      }

      // Save player edits - use different API for custom vs original players
      if (isCustomPlayer) {
        // Custom players: combine all edits into single updateCustomPlayer call
        // Include PGHE fields for generic face support
        var customUpdates = Object.assign({}, playerEdits, {
          maddenPid: appearanceEdits.maddenPid,
          maddenPam: appearanceEdits.maddenPam,
          maddenPlpo: appearanceEdits.maddenPlpo,
          maddenCommid: appearanceEdits.maddenCommid,
          maddenPghe: appearanceEdits.maddenPghe,
          maddenPfcg: appearanceEdits.maddenPfcg,
          maddenGpan: appearanceEdits.maddenGpan,
          maddenGslp: appearanceEdits.maddenGslp,
          maddenCpvf: appearanceEdits.maddenCpvf,
          maddenSkinTone: appearanceEdits.maddenSkinTone,
          isGenericFace: appearanceEdits.isGenericFace,
          has3DModel: playerEdits.has3DModel
        });
        console.log('[DatabasePlayerCard] Saving custom player updates:', customUpdates);
        var playerResult = await window.electronAPI.database.updateCustomPlayer(currentDbPlayerId, customUpdates);
        if (!playerResult.success) {
          throw new Error(playerResult.error || 'Failed to save custom player');
        }
      } else {
        // Original database players: use separate edit tables
        console.log('[DatabasePlayerCard] Saving player edit for ID:', currentDbPlayerId);
        var playerResult = await window.electronAPI.database.savePlayerEdit(currentDbPlayerId, playerEdits);
        console.log('[DatabasePlayerCard] savePlayerEdit result:', playerResult);
        if (!playerResult.success) {
          throw new Error(playerResult.error || 'Failed to save player edits');
        }

        // Save appearance edits
        console.log('[DatabasePlayerCard] Saving appearance edit for ID:', currentDbPlayerId);
        var appearanceResult = await window.electronAPI.database.saveAppearanceEdit(currentDbPlayerId, appearanceEdits);
        console.log('[DatabasePlayerCard] saveAppearanceEdit result:', appearanceResult);
        if (!appearanceResult.success) {
          throw new Error(appearanceResult.error || 'Failed to save appearance edits');
        }
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
        console.log('[DatabasePlayerCard] Applying edits to ALL years. Changed fields:', seasonEdits, 'Options:', options, 'isCustomPlayer:', isCustomPlayer);

        // Use different API for custom vs original players
        var allYearsResult;
        if (isCustomPlayer) {
          allYearsResult = await window.electronAPI.database.saveCustomPlayerSeasonAllYears(
            currentDbPlayerId,
            seasonEdits,
            options
          );
        } else {
          allYearsResult = await window.electronAPI.database.saveSeasonEditAllYears(
            currentDbPlayerId,
            seasonEdits,
            options
          );
        }
        console.log('[DatabasePlayerCard] Save all years result:', allYearsResult);
        if (!allYearsResult.success) {
          throw new Error(allYearsResult.error || 'Failed to save to all years');
        }

        // Check if no years were updated (player has no career range)
        if (allYearsResult.updatedYears && allYearsResult.updatedYears.length === 0) {
          alert('No years updated!\n\nThis player has no career range defined (Draft Class, Career From, or Career To).\n\nPlease fill in the Career Info fields on the Player Info tab first, then try again.');
          return;
        }

        console.log('[DatabasePlayerCard] Updated', allYearsResult.updatedYears?.length || 0, 'seasons');

        // Uncheck the checkboxes after save
        setChecked('dbApplyToAllYears', false);
        setChecked('dbIncrementAgeEachYear', false);
      } else if (selectedYear) {
        // Save to specific year only - save ALL form values (not just changed)
        var seasonEdits = collectSeasonEdits(false); // false = all fields

        // Use different API for custom vs original players
        if (isCustomPlayer) {
          console.log('[DatabasePlayerCard] Saving custom player season for year:', selectedYear);
          var seasonResult = await window.electronAPI.database.saveCustomPlayerSeason(currentDbPlayerId, selectedYear, seasonEdits);
        } else {
          var seasonResult = await window.electronAPI.database.saveSeasonEdit(currentDbPlayerId, selectedYear, seasonEdits);
        }
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
          // Re-enable save button - updateSaveButtonState will handle proper state
          saveBtn.disabled = false;
        }, 1500);
      }

      // Ensure all inputs in the modal are enabled after save (safety check)
      var modal = document.getElementById('dbPlayerCardModal');
      if (modal) {
        modal.querySelectorAll('input:not([type="checkbox"]), select, textarea').forEach(function(el) {
          // Only re-enable if it shouldn't be permanently disabled
          if (!el.classList.contains('permanently-disabled')) {
            el.disabled = false;
          }
        });
        // Also ensure modal doesn't block pointer events if hidden
        if (modal.style.display === 'none') {
          modal.style.pointerEvents = 'none';
        }
      }

      // Ensure no element is stealing focus
      console.log('[DatabasePlayerCard] Save complete. Active element:', document.activeElement?.tagName, document.activeElement?.id);

      // NOTE: Removed restoreFocusAfterSave() - it was stealing focus from other inputs
      // and preventing users from typing in the search box after save

      // Refresh player browser search results to reflect changes (e.g., college updates)
      if (typeof window.refreshPlayerBrowser === 'function') {
        console.log('[DatabasePlayerCard] Refreshing player browser to show updated data');
        window.refreshPlayerBrowser();
      }

      // Also refresh database browser search if available
      if (typeof window.refreshDatabaseBrowser === 'function') {
        console.log('[DatabasePlayerCard] Refreshing database browser to show updated data');
        window.refreshDatabaseBrowser();
      }

      // Restore OS-level window focus (critical for Windows keyboard input)
      // After browser refreshes, keyboard focus can be lost at the OS level
      var focusModalElement = function() {
        // Focus the modal itself or an input within it to restore keyboard input
        var modal = document.getElementById('dbPlayerCardModal');
        if (modal && modal.style.display !== 'none') {
          // Try to focus a visible input, or fall back to the modal itself
          var visibleInput = modal.querySelector('.db-player-tab-content.active input:not([type="hidden"]):not([disabled])');
          if (visibleInput) {
            visibleInput.focus();
            console.log('[DatabasePlayerCard] Focused input after save:', visibleInput.id || visibleInput.className);
          } else {
            modal.focus();
            console.log('[DatabasePlayerCard] Focused modal after save');
          }
        }
      };
      if (window.electronAPI && window.electronAPI.window && window.electronAPI.window.focus) {
        window.electronAPI.window.focus().then(function() {
          console.log('[DatabasePlayerCard] OS-level window focus restored after save');
          setTimeout(focusModalElement, 50);
        }).catch(function(err) {
          console.warn('[DatabasePlayerCard] Failed to restore window focus:', err);
          setTimeout(focusModalElement, 50);
        });
      } else {
        setTimeout(focusModalElement, 100);
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

    console.log('[collectSeasonEdits] onlyChangedFields:', onlyChangedFields);
    console.log('[collectSeasonEdits] originalSeasonData:', originalSeasonData);
    console.log('[collectSeasonEdits] originalSeasonData.ratings:', originalSeasonData ? originalSeasonData.ratings : null);

    // Map from display field names to database field names for change detection
    var DISPLAY_TO_DB_FIELD_CHECK = {
      'PKPR': 'PKPW', 'PSTA': 'PSTM', 'PBKT': 'PBTK', 'PLTR': 'PTRK',
      'PELU': 'PCOD', 'PLSA': 'PSFA', 'PLSM': 'PSPN', 'PLJM': 'PJKM',
      'PTHP': 'PPWR', 'PLSC': 'PSPC', 'PLCI': 'PCIT', 'SRRN': 'PSRR',
      'PLRL': 'PREL', 'PLIB': 'PIBK', 'PRBF': 'PRNS', 'PPBS': 'PPBP',
      'PLHT': 'PHIT', 'PLPE': 'PPRS', 'PFMS': 'PFMV', 'PLPM': 'PPWM',
      'PBSG': 'PBSH', 'PLPR': 'PPRC', 'PLPU': 'PPUR', 'PLMC': 'PMCV', 'PLZC': 'PZCV'
    };

    // Helper to check if value changed from original
    function hasChanged(field, currentValue) {
      if (!onlyChangedFields || !originalSeasonData) {
        return true; // Include all fields if not filtering or no original data
      }
      // Check both flat and nested (ratings) structures
      // Also check mapped database field name (e.g., PKPW for PKPR)
      var originalValue = originalSeasonData[field];
      if (originalValue === undefined && originalSeasonData.ratings) {
        originalValue = originalSeasonData.ratings[field];
      }
      // If still undefined, try the database field name
      if (originalValue === undefined) {
        var dbField = DISPLAY_TO_DB_FIELD_CHECK[field];
        if (dbField) {
          originalValue = originalSeasonData[dbField];
          if (originalValue === undefined && originalSeasonData.ratings) {
            originalValue = originalSeasonData.ratings[dbField];
          }
        }
      }
      // Compare as strings to handle type differences (e.g., "85" vs 85)
      var changed = String(currentValue) !== String(originalValue);
      if (changed && field.startsWith('P')) {
        console.log('[collectSeasonEdits] Rating changed:', field, 'from', originalValue, 'to', currentValue);
      }
      return changed;
    }

    // Season info fields
    // When using "Apply to all years" (onlyChangedFields=true), skip empty values
    // to avoid overwriting existing data with blanks
    var team = getValue('dbPlayerSeasonTeam');
    if (team && hasChanged('team', team)) {
      edits.team = team;
    } else if (!onlyChangedFields && team !== null && team !== undefined) {
      // For single year saves, include even empty values
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
    if (position && hasChanged('position', position)) {
      edits.position = position;
    } else if (!onlyChangedFields && position !== null && position !== undefined) {
      edits.position = position;
    }

    // Archetype is now at player level, not per-season
    var archetype = getValue('dbPlayerArchetype');
    if (archetype && hasChanged('archetype', archetype)) {
      edits.archetype = archetype;
    } else if (!onlyChangedFields && archetype !== null && archetype !== undefined) {
      edits.archetype = archetype;
    }

    // Map from display field names to database field names for saving
    // (reverse of the loading mapping in populateRatingsForm)
    var DISPLAY_TO_DB_FIELD = {
      'PKPR': 'PKPW',  // Kick power: display=PKPR, db=PKPW
      'PSTA': 'PSTM',  // Stamina: display=PSTA, db=PSTM
      'PBKT': 'PBTK',  // Break tackle: display=PBKT, db=PBTK
      'PLTR': 'PTRK',  // Trucking: display=PLTR, db=PTRK
      'PELU': 'PCOD',  // Change of direction: display=PELU, db=PCOD
      'PLSA': 'PSFA',  // Stiff arm: display=PLSA, db=PSFA
      'PLSM': 'PSPN',  // Spin move: display=PLSM, db=PSPN
      'PLJM': 'PJKM',  // Juke move: display=PLJM, db=PJKM
      'PTHP': 'PPWR',  // Throw power: display=PTHP, db=PPWR
      'PLSC': 'PSPC',  // Spectacular catch: display=PLSC, db=PSPC
      'PLCI': 'PCIT',  // Catch in traffic: display=PLCI, db=PCIT
      'SRRN': 'PSRR',  // Short route running: display=SRRN, db=PSRR
      'PLRL': 'PREL',  // Release: display=PLRL, db=PREL
      'PLIB': 'PIBK',  // Impact blocking: display=PLIB, db=PIBK
      'PRBF': 'PRNS',  // Run block finesse: display=PRBF, db=PRNS
      'PPBS': 'PPBP',  // Pass block power: display=PPBS, db=PPBP
      'PLHT': 'PHIT',  // Hit power: display=PLHT, db=PHIT
      'PLPE': 'PPRS',  // Press: display=PLPE, db=PPRS
      'PFMS': 'PFMV',  // Finesse moves: display=PFMS, db=PFMV
      'PLPM': 'PPWM',  // Power moves: display=PLPM, db=PPWM
      'PBSG': 'PBSH',  // Block shedding: display=PBSG, db=PBSH
      'PLPR': 'PPRC',  // Play recognition: display=PLPR, db=PPRC
      'PLPU': 'PPUR',  // Pursuit: display=PLPU, db=PPUR
      'PLMC': 'PMCV',  // Man coverage: display=PLMC, db=PMCV
      'PLZC': 'PZCV',  // Zone coverage: display=PLZC, db=PZCV
    };

    // Collect rating values - only include changed ones if filtering
    // Convert display field names to database field names when saving
    RATING_FIELDS.forEach(function(item) {
      var val = getIntValue('dbRating_' + item.field);
      if (val !== null && val !== undefined && hasChanged(item.field, val)) {
        // Use database field name if mapped, otherwise use display field name
        var dbField = DISPLAY_TO_DB_FIELD[item.field] || item.field;
        edits[dbField] = val;
      }
    });

    console.log('[collectSeasonEdits] Final edits object:', edits);
    console.log('[collectSeasonEdits] Edits keys:', Object.keys(edits));
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
   * Delete/hide a player from the database
   * Custom players: permanently delete
   * Original database players: hide from search results
   */
  async function deleteDbPlayer() {
    if (!currentDbPlayerId) {
      alert('No player selected');
      return;
    }

    var playerName = currentDbPlayer ? ((currentDbPlayer.firstName || '') + ' ' + (currentDbPlayer.lastName || '')).trim() : 'this player';

    if (isCustomPlayer) {
      // Custom player - permanently delete
      var confirmed = confirm('Are you sure you want to permanently delete ' + playerName + '?\n\nThis cannot be undone.');
      if (!confirmed) return;

      try {
        console.log('[DatabasePlayerCard] Deleting custom player:', currentDbPlayerId);
        var result = await window.electronAPI.database.deleteCustomPlayer(currentDbPlayerId);

        if (!result.success) {
          throw new Error(result.error || 'Failed to delete player');
        }

        console.log('[DatabasePlayerCard] Player deleted successfully');
        try {
          closeAndRefresh(playerName + ' deleted');
        } catch (refreshError) {
          console.error('[DatabasePlayerCard] closeAndRefresh failed:', refreshError);
          // Force close modal and restore focus even if refresh fails
          var modal = document.getElementById('dbPlayerCardModal');
          if (modal) modal.style.display = 'none';
          var searchInput = document.getElementById('playerBrowserSearch');
          if (searchInput) searchInput.focus();
        }

      } catch (error) {
        console.error('[DatabasePlayerCard] Failed to delete player:', error);
        alert('Failed to delete player: ' + error.message);
      }
    } else {
      // Original database player - hide from search results
      var confirmed = confirm('Hide ' + playerName + ' from search results?\n\nThis player will no longer appear in searches. You can restore hidden players from the Database Settings.');
      if (!confirmed) return;

      try {
        console.log('[DatabasePlayerCard] Hiding database player:', currentDbPlayerId);
        var result = await window.electronAPI.database.hidePlayer(currentDbPlayerId);

        if (!result.success) {
          throw new Error(result.error || 'Failed to hide player');
        }

        console.log('[DatabasePlayerCard] Player hidden successfully');
        try {
          closeAndRefresh(playerName + ' hidden');
        } catch (refreshError) {
          console.error('[DatabasePlayerCard] closeAndRefresh failed:', refreshError);
          // Force close modal and restore focus even if refresh fails
          var modal = document.getElementById('dbPlayerCardModal');
          if (modal) modal.style.display = 'none';
          var searchInput = document.getElementById('playerBrowserSearch');
          if (searchInput) searchInput.focus();
        }

      } catch (error) {
        console.error('[DatabasePlayerCard] Failed to hide player:', error);
        alert('Failed to hide player: ' + error.message);
      }
    }
  }

  /**
   * Close modal and refresh browser after delete/hide
   */
  function closeAndRefresh(message) {
    // 1. Force blur everything and hide modal completely
    if (document.activeElement) {
      document.activeElement.blur();
    }

    var modal = document.getElementById('dbPlayerCardModal');
    if (modal) {
      modal.style.display = 'none';
    }

    // 2. Clear state
    currentDbPlayer = null;
    currentDbPlayerId = null;
    hasUnsavedChanges = false;
    isCreateMode = false;

    // 3. Toast
    if (window.showToast) {
      window.showToast(message, 'success');
    }

    // 4. Refresh BOTH browsers (player browser in main window, database browser in database window)
    if (window.refreshPlayerBrowser) {
      window.refreshPlayerBrowser();
    }
    if (window.refreshDatabaseBrowser) {
      console.log('[DatabasePlayerCard] Refreshing database browser after delete');
      window.refreshDatabaseBrowser();
    }

    // 5. Force focus to search box after refresh completes
    var focusSearch = function() {
      // Try database browser search first (quickSearchInput), then player browser
      var search = document.getElementById('quickSearchInput') || document.getElementById('playerBrowserSearch');
      if (search) {
        search.focus();
      }
    };

    // Wait for refresh to complete, then focus
    setTimeout(focusSearch, 200);
    setTimeout(focusSearch, 400);
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
   * Fill missing player data from Pro-Football-Reference
   * Scrapes hometown, state, height, weight, college, and team/jersey per year
   */
  async function fillFromPFR() {
    if (!currentDbPlayerId) return;

    // Get player info from the form (works for any player, including custom ones)
    var firstName = getValue('dbPlayerFirstName') || '';
    var lastName = getValue('dbPlayerLastName') || '';
    var playerName = (firstName + ' ' + lastName).trim() || 'Unknown';

    var btn = document.getElementById('fillFromPFRBtn');
    var btnText = document.getElementById('fillFromPFRBtnText');
    var spinner = document.getElementById('fillFromPFRSpinner');

    // Show loading state
    if (btn) btn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (spinner) spinner.style.display = 'inline';

    try {
      console.log('[DatabasePlayerCard] Previewing PFR fill for:', playerName);

      // Build player info from current form values to pass to backend
      var playerInfo = {
        firstName: firstName,
        lastName: lastName,
        hometown: getValue('dbPlayerHometown') || undefined,
        homeState: getValue('dbPlayerHomeState') || undefined,
        height: getIntValue('dbPlayerHeight') || undefined,
        weight: getIntValue('dbPlayerWeight') || undefined,
        college: getValue('dbPlayerCollege') || undefined,
        draftYear: getIntValue('dbPlayerDraftClass') || undefined,
        draftRound: getValue('dbPlayerDraftRound') || undefined,
        draftPick: getIntValue('dbPlayerDraftPick') || undefined,
        careerFrom: getIntValue('dbPlayerCareerFrom') || undefined,
        careerTo: getIntValue('dbPlayerCareerTo') || undefined
      };

      // First preview what data we'll find
      var preview = await window.electronAPI.playerFill.preview(currentDbPlayerId, playerInfo);

      // Debug: log what we received
      console.log('[DatabasePlayerCard] Preview result:', JSON.stringify(preview, null, 2));

      if (!preview.found) {
        alert('Could not find "' + playerName + '" on Pro-Football-Reference.\n\n' +
              (preview.error || 'Try searching with a different name spelling.'));
        return;
      }

      // Build preview message
      var changes = [];
      var currentData = preview.currentData || {};
      var scrapedData = preview.scrapedData || {};

      console.log('[DatabasePlayerCard] Scraped data:', scrapedData);
      console.log('[DatabasePlayerCard] homeState value:', scrapedData.homeState, 'type:', typeof scrapedData.homeState);

      if (!currentData.hometown && scrapedData.hometown) {
        changes.push('Hometown: ' + scrapedData.hometown);
      }
      if (!currentData.homeState && scrapedData.homeState) {
        changes.push('Home State: ' + scrapedData.homeState);
      }
      if (!currentData.height && scrapedData.height) {
        changes.push('Height: ' + scrapedData.height);
      }
      if (!currentData.weight && scrapedData.weight) {
        changes.push('Weight: ' + scrapedData.weight + ' lbs');
      }
      if (!currentData.college && scrapedData.college) {
        changes.push('College: ' + scrapedData.college);
      }

      // Draft info
      if (scrapedData.draftYear && !currentData.draftYear) {
        changes.push('Draft: Round ' + scrapedData.draftRound + ', Pick ' + scrapedData.draftPick + ' (' + scrapedData.draftYear + ')');
      } else if (scrapedData.draftRound === 'UDFA' && !currentData.draftRound) {
        changes.push('Draft: Undrafted Free Agent');
      }

      // Career span
      if (scrapedData.careerFrom && !currentData.careerFrom) {
        changes.push('Career: ' + scrapedData.careerFrom + '-' + scrapedData.careerTo);
      }

      // Career history (teams by year)
      var careerYears = preview.careerData ? preview.careerData.length : 0;
      if (careerYears > 0) {
        changes.push('Career History: ' + careerYears + ' seasons (team/jersey data)');
      }

      if (changes.length === 0) {
        alert('No missing data to fill for ' + playerName + '.\n\n' +
              'All bio fields already have values.');
        return;
      }

      // Ask user to confirm
      var message = 'Found data for ' + playerName + ':\n\n' +
                    changes.join('\n') +
                    '\n\nFill this data?';
      if (!confirm(message)) {
        return;
      }

      // Now do the actual fill (pass playerInfo so backend doesn't need database lookup)
      var result = await window.electronAPI.playerFill.fillSingle(currentDbPlayerId, playerInfo);

      if (!result.success) {
        alert('Failed to fill data: ' + (result.error || 'Unknown error'));
        return;
      }

      // Update the form with new data - ONLY if field is currently empty
      console.log('[DatabasePlayerCard] Updating form with scraped data:', scrapedData);

      if (scrapedData.hometown) {
        var hometownInput = document.getElementById('dbPlayerHometown');
        if (hometownInput && !hometownInput.value) {
          hometownInput.value = scrapedData.hometown;
          console.log('[DatabasePlayerCard] Set hometown to:', scrapedData.hometown);
        }
      }
      if (scrapedData.homeState) {
        var stateSelect = document.getElementById('dbPlayerHomeState');
        console.log('[DatabasePlayerCard] Trying to set state. homeState=', scrapedData.homeState, 'current select value=', stateSelect ? stateSelect.value : 'N/A');
        if (stateSelect && !stateSelect.value) {
          var stateToFind = scrapedData.homeState.toLowerCase();
          var foundMatch = false;
          // Find option with EXACT matching text (case-insensitive)
          // Don't use includes() because "arkansas".includes("kansas") = true!
          for (var i = 0; i < stateSelect.options.length; i++) {
            var optionText = stateSelect.options[i].text.toLowerCase();
            if (optionText === stateToFind) {
              stateSelect.selectedIndex = i;
              // Dispatch change event to update custom dropdown display
              stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('[DatabasePlayerCard] State matched and set to:', stateSelect.options[i].text);
              foundMatch = true;
              break;
            }
          }
          if (!foundMatch) {
            console.log('[DatabasePlayerCard] No exact state match found for:', scrapedData.homeState);
          }
        } else if (stateSelect && stateSelect.value) {
          console.log('[DatabasePlayerCard] State already has value, not overwriting:', stateSelect.value);
        }
      } else {
        console.log('[DatabasePlayerCard] No homeState in scraped data');
      }
      if (scrapedData.height) {
        var heightInput = document.getElementById('dbPlayerHeight');
        if (heightInput && !heightInput.value) {
          // Convert "6-2" to inches (74)
          var heightMatch = scrapedData.height.match(/(\d+)-(\d+)/);
          if (heightMatch) {
            var heightInches = parseInt(heightMatch[1]) * 12 + parseInt(heightMatch[2]);
            heightInput.value = heightInches;
            console.log('[DatabasePlayerCard] Set height to:', heightInches, 'from', scrapedData.height);
          }
        } else if (heightInput && heightInput.value) {
          console.log('[DatabasePlayerCard] Height already has value, not overwriting:', heightInput.value);
        }
      }
      if (scrapedData.weight) {
        var weightInput = document.getElementById('dbPlayerWeight');
        if (weightInput && !weightInput.value) {
          weightInput.value = scrapedData.weight;
          console.log('[DatabasePlayerCard] Set weight to:', scrapedData.weight);
        }
      }
      if (scrapedData.college) {
        var collegeSelect = document.getElementById('dbPlayerCollege');
        if (collegeSelect && !collegeSelect.value) {
          // Normalize college name for matching (handle "St." vs "State" differences)
          var normalizeCollege = function(name) {
            return name.toLowerCase()
              .replace(/\bst\.?\b/g, 'state')  // "St." or "St" -> "state"
              .replace(/\s+/g, ' ')             // normalize whitespace
              .trim();
          };

          var scrapedNorm = normalizeCollege(scrapedData.college);
          var foundMatch = false;
          var bestMatchIndex = -1;
          var bestMatchType = 0; // 0=none, 1=partial, 2=exact
          console.log('[DatabasePlayerCard] Looking for college:', scrapedData.college, '-> normalized:', scrapedNorm);

          // Find best matching option - prefer exact matches over partial
          for (var j = 0; j < collegeSelect.options.length; j++) {
            var optionText = collegeSelect.options[j].text;
            var optionNorm = normalizeCollege(optionText);

            // Exact normalized match is best
            if (optionNorm === scrapedNorm) {
              bestMatchIndex = j;
              bestMatchType = 2;
              break; // Can't do better than exact
            }
            // Partial match (only if no exact match found yet)
            if (bestMatchType < 1 && (optionNorm.includes(scrapedNorm) || scrapedNorm.includes(optionNorm))) {
              bestMatchIndex = j;
              bestMatchType = 1;
              // Don't break - keep looking for exact match
            }
          }

          if (bestMatchIndex >= 0) {
            collegeSelect.selectedIndex = bestMatchIndex;
            collegeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[DatabasePlayerCard] College matched:', scrapedData.college, '->', collegeSelect.options[bestMatchIndex].text, '(type:', bestMatchType === 2 ? 'exact' : 'partial', ')');
            foundMatch = true;
          }
          if (!foundMatch) {
            console.log('[DatabasePlayerCard] No college match found for:', scrapedData.college);
          }
        } else if (collegeSelect && collegeSelect.value) {
          console.log('[DatabasePlayerCard] College already has value, not overwriting:', collegeSelect.value);
        }
      }

      // Fill draft info
      if (scrapedData.draftYear) {
        var draftClassInput = document.getElementById('dbPlayerDraftClass');
        if (draftClassInput && !draftClassInput.value) {
          draftClassInput.value = scrapedData.draftYear;
          console.log('[DatabasePlayerCard] Set draft year to:', scrapedData.draftYear);
        }
        var draftRoundInput = document.getElementById('dbPlayerDraftRound');
        if (draftRoundInput && !draftRoundInput.value) {
          draftRoundInput.value = scrapedData.draftRound;
          console.log('[DatabasePlayerCard] Set draft round to:', scrapedData.draftRound);
        }
        var draftPickInput = document.getElementById('dbPlayerDraftPick');
        if (draftPickInput && !draftPickInput.value) {
          draftPickInput.value = scrapedData.draftPick;
          console.log('[DatabasePlayerCard] Set draft pick to:', scrapedData.draftPick);
        }
      } else if (scrapedData.draftRound === 'UDFA') {
        var draftRoundInput = document.getElementById('dbPlayerDraftRound');
        if (draftRoundInput && !draftRoundInput.value) {
          draftRoundInput.value = 'UDFA';
          console.log('[DatabasePlayerCard] Set draft round to: UDFA');
        }
      }

      // Fill career span
      console.log('[DatabasePlayerCard] Career span data - careerFrom:', scrapedData.careerFrom, 'careerTo:', scrapedData.careerTo);
      console.log('[DatabasePlayerCard] careerHistory length:', scrapedData.careerHistory ? scrapedData.careerHistory.length : 'undefined');
      if (scrapedData.careerFrom) {
        var careerFromInput = document.getElementById('dbPlayerCareerFrom');
        console.log('[DatabasePlayerCard] careerFromInput element:', careerFromInput, 'current value:', careerFromInput ? careerFromInput.value : 'N/A');
        if (careerFromInput && !careerFromInput.value) {
          careerFromInput.value = scrapedData.careerFrom;
          console.log('[DatabasePlayerCard] Set career from to:', scrapedData.careerFrom);
        }
      } else {
        console.log('[DatabasePlayerCard] No careerFrom in scraped data');
      }
      if (scrapedData.careerTo) {
        var careerToInput = document.getElementById('dbPlayerCareerTo');
        console.log('[DatabasePlayerCard] careerToInput element:', careerToInput, 'current value:', careerToInput ? careerToInput.value : 'N/A');
        if (careerToInput && !careerToInput.value) {
          careerToInput.value = scrapedData.careerTo;
          console.log('[DatabasePlayerCard] Set career to:', scrapedData.careerTo);
        }
      } else {
        console.log('[DatabasePlayerCard] No careerTo in scraped data');
      }

      // Mark as having changes
      hasUnsavedChanges = true;
      updateSaveButtonState();

      // Show success
      var successMsg = 'Updated ' + result.fieldsUpdated.length + ' field(s)';
      if (result.seasonsUpdated > 0) {
        successMsg += ' and ' + result.seasonsUpdated + ' season(s)';
      }
      successMsg += ' for ' + playerName + '.';
      alert(successMsg);

      // Reload year selector if seasons were updated
      if (result.seasonsUpdated > 0) {
        await loadSeasonYearOptions();
      }

    } catch (error) {
      console.error('[DatabasePlayerCard] PFR fill error:', error);
      alert('Error filling from PFR: ' + error.message);
    } finally {
      // Reset button state
      if (btn) btn.disabled = false;
      if (btnText) btnText.style.display = 'inline';
      if (spinner) spinner.style.display = 'none';
    }
  }

  /**
   * Add player to roster editor
   */
  async function addPlayerToRoster() {
    if (!currentDbPlayerId) return;

    try {
      if (window.electronAPI?.database?.sendPlayerToMainWindow) {
        const result = await window.electronAPI.database.sendPlayerToMainWindow(currentDbPlayerId, 'roster');
        if (result.success) {
          console.log('[DbPlayerCard] Player sent to roster, ID:', currentDbPlayerId);
        } else {
          console.error('[DbPlayerCard] Failed to send player to roster:', result.error);
          alert(result.error || 'Failed to add player to roster');
        }
      } else {
        console.error('[DbPlayerCard] sendPlayerToMainWindow API not available');
        alert('Failed to add player to roster - API not available');
      }
    } catch (e) {
      console.error('[DbPlayerCard] Failed to add player to roster:', e);
      alert('Failed to add player to roster: ' + e.message);
    }
  }

  /**
   * Add player to draft class editor
   */
  async function addPlayerToDraft() {
    if (!currentDbPlayerId) return;

    try {
      if (window.electronAPI?.database?.sendPlayerToMainWindow) {
        const result = await window.electronAPI.database.sendPlayerToMainWindow(currentDbPlayerId, 'draft');
        if (result.success) {
          console.log('[DbPlayerCard] Player sent to draft, ID:', currentDbPlayerId);
        } else {
          console.error('[DbPlayerCard] Failed to send player to draft:', result.error);
          alert(result.error || 'Failed to add player to draft');
        }
      } else {
        console.error('[DbPlayerCard] sendPlayerToMainWindow API not available');
        alert('Failed to add player to draft - API not available');
      }
    } catch (e) {
      console.error('[DbPlayerCard] Failed to add player to draft:', e);
      alert('Failed to add player to draft: ' + e.message);
    }
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
      // Note: visibility and pointerEvents are reset in openDbPlayerCard when modal is shown again

      // Use centralized focus restoration for player browser
      // Use requestAnimationFrame + setTimeout to ensure the modal display change has been processed
      // This fixes Windows issue where focus doesn't properly transfer after modal close
      requestAnimationFrame(function() {
        setTimeout(function() {
          // Try centralized function first, fall back to direct focus
          if (typeof window.restoreFocusToPlayerBrowser === 'function') {
            window.restoreFocusToPlayerBrowser();
          } else {
            var searchInput = document.getElementById('playerBrowserSearch');
            if (searchInput) searchInput.focus();
          }
        }, 50);
      });
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

  /**
   * Recalculate OVR dynamically when rating attributes change
   * Also finds the best archetype and shows notification if different
   */
  async function recalculateDbOVR() {
    try {
      // Skip if we're programmatically updating
      if (window._skipOvrRecalc) return;

      // Get current position from player-level (primary) or season position (fallback)
      var mainPositionSelect = document.getElementById('dbPlayerPosition');
      var position = mainPositionSelect ? mainPositionSelect.value : '';
      if (!position) {
        var positionSelect = document.getElementById('dbPlayerSeasonPosition');
        position = positionSelect ? positionSelect.value : 'QB';
      }

      // CRITICAL: Use PLAYER-LEVEL archetype (constant across all seasons)
      // This ensures consistent OVR calculation everywhere
      var playerArchetypeSelect = document.getElementById('dbPlayerArchetype');
      var playerLevelArchetype = playerArchetypeSelect ? playerArchetypeSelect.value : '';

      // Build attributes object from the rating inputs, mapping to OVR calculator field codes
      var attributes = {};
      RATING_FIELDS.forEach(function(item) {
        var val = getIntValue('dbRating_' + item.field);
        if (val !== null) {
          // Map to the OVR calculator's expected field code
          var ovrFieldCode = DB_TO_OVR_FIELD_MAP[item.field] || item.field;
          attributes[ovrFieldCode] = val;
        }
      });

      console.log('[DbPlayerCard] Recalculating OVR with attributes:', Object.keys(attributes).length, 'playerArchetype:', playerLevelArchetype);

      var ovrInput = document.getElementById('dbRating_POVR');
      var oldOVR = ovrInput ? parseInt(ovrInput.value) || 50 : 50;
      var newOVR;
      var usedArchetype;

      // Set flag to skip recursive recalculation
      window._skipOvrRecalc = true;

      if (playerLevelArchetype) {
        // Use the PLAYER-LEVEL archetype for OVR calculation (consistent with roster generator)
        newOVR = await window.electronAPI.rating.calculateOVRMadden(position, attributes, playerLevelArchetype);
        usedArchetype = playerLevelArchetype;
        console.log('[DbPlayerCard] OVR calculated using player archetype:', playerLevelArchetype, '=', newOVR);
      } else {
        // No player-level archetype set - find best archetype
        var archetypeResults = await window.electronAPI.rating.calculateOVRForArchetypes(attributes, position);
        if (archetypeResults && archetypeResults.length > 0) {
          var bestArchetype = archetypeResults[0];
          newOVR = bestArchetype.ovr;
          usedArchetype = bestArchetype.name;
          console.log('[DbPlayerCard] OVR calculated using best archetype:', usedArchetype, '=', newOVR);
        } else {
          newOVR = 50;
          usedArchetype = '';
        }
      }

      // Update OVR if changed
      if (newOVR !== oldOVR) {
        setValue('dbRating_POVR', newOVR);
        console.log('[DbPlayerCard] OVR recalculated: ' + oldOVR + ' → ' + newOVR + ' (archetype: ' + usedArchetype + ')');
      }

      window._skipOvrRecalc = false;
    } catch (error) {
      window._skipOvrRecalc = false;
      console.error('[DbPlayerCard] Error recalculating OVR:', error);
    }
  }

  /**
   * Show notification when a better archetype is available
   */
  function showArchetypeChangeNotification(currentArchetype, bestArchetype, currentOVR, bestOVR) {
    // Debounce notifications - don't spam during rapid edits
    if (window._archetypeNotificationTimeout) {
      clearTimeout(window._archetypeNotificationTimeout);
    }

    window._archetypeNotificationTimeout = setTimeout(function() {
      // Remove any existing notification
      var existingNotification = document.getElementById('archetype-change-notification');
      if (existingNotification) {
        existingNotification.remove();
      }

      var ovrDiff = bestOVR - currentOVR;
      var notification = document.createElement('div');
      notification.id = 'archetype-change-notification';
      notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: linear-gradient(135deg, #1a3a1a 0%, #2a4a2a 100%); border: 1px solid #4caf50; border-radius: 8px; padding: 12px 16px; color: #e0e0e0; font-size: 13px; z-index: 100002; box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 320px; animation: slideIn 0.3s ease;';

      notification.innerHTML =
        '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">' +
          '<strong style="color: #4caf50;">Better Archetype Available</strong>' +
          '<button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #888; cursor: pointer; font-size: 16px; line-height: 1; padding: 0;">&times;</button>' +
        '</div>' +
        '<div style="margin-bottom: 10px; line-height: 1.4;">' +
          '<span style="color: #888;">Current:</span> ' + currentArchetype + ' <span style="color: #f0ad4e;">(' + currentOVR + ' OVR)</span><br>' +
          '<span style="color: #888;">Better:</span> ' + bestArchetype + ' <span style="color: #4caf50;">(' + bestOVR + ' OVR, +' + ovrDiff + ')</span>' +
        '</div>' +
        '<div style="display: flex; gap: 8px;">' +
          '<button id="apply-archetype-change" style="flex: 1; padding: 6px 12px; background: #4caf50; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Switch to ' + bestArchetype.split(' ').pop() + '</button>' +
          '<button onclick="this.parentElement.parentElement.remove()" style="padding: 6px 12px; background: #333; color: #aaa; border: 1px solid #444; border-radius: 4px; cursor: pointer; font-size: 12px;">Keep Current</button>' +
        '</div>';

      document.body.appendChild(notification);

      // Add click handler for apply button
      var applyBtn = document.getElementById('apply-archetype-change');
      if (applyBtn) {
        applyBtn.onclick = function() {
          var archetypeSelect = document.getElementById('dbPlayerArchetype');
          if (archetypeSelect) {
            archetypeSelect.value = bestArchetype;
            archetypeSelect.dispatchEvent(new Event('change'));
            // Update OVR to match new archetype
            window._skipOvrRecalc = true;
            setValue('dbRating_POVR', bestOVR);
            window._skipOvrRecalc = false;
            hasUnsavedChanges = true;
            updateSaveButtonState();
          }
          notification.remove();
        };
      }

      // Auto-dismiss after 10 seconds
      setTimeout(function() {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 10000);
    }, 500); // Debounce delay
  }

  /**
   * Handle OVR change in database player card - AUTOMATICALLY adjust ratings
   * This ensures the OVR will translate correctly in-game
   * @param {number} oldOVR - Previous OVR value
   * @param {number} newOVR - New target OVR
   */
  async function handleDbOVRChange(oldOVR, newOVR) {
    console.log('[DbPlayerCard] handleDbOVRChange called:', oldOVR, '->', newOVR);

    // Get current position
    var positionSelect = document.getElementById('dbPlayerSeasonPosition');
    var position = positionSelect ? positionSelect.value : '';
    if (!position) {
      // Try main position if season position not set
      var mainPositionSelect = document.getElementById('dbPlayerPosition');
      position = mainPositionSelect ? mainPositionSelect.value : 'QB';
    }
    console.log('[DbPlayerCard] Position:', position);

    // Get player name for logging
    var firstName = getValue('dbPlayerFirstName') || '';
    var lastName = getValue('dbPlayerLastName') || '';
    var playerName = (firstName + ' ' + lastName).trim() || 'Unknown Player';
    console.log('[DbPlayerCard] Player:', playerName);

    // Build attributes object from the rating inputs, mapping to OVR calculator field codes
    var attributes = {};
    RATING_FIELDS.forEach(function(item) {
      var val = getIntValue('dbRating_' + item.field);
      if (val !== null) {
        // Map to the OVR calculator's expected field code
        var ovrFieldCode = DB_TO_OVR_FIELD_MAP[item.field] || item.field;
        attributes[ovrFieldCode] = val;
      }
    });
    console.log('[DbPlayerCard] Attributes count:', Object.keys(attributes).length);

    // Get current archetype if available
    var archetypeSelect = document.getElementById('dbPlayerArchetype');
    var currentArchetype = archetypeSelect ? archetypeSelect.value : undefined;
    console.log('[DbPlayerCard] Current Archetype:', currentArchetype);

    try {
      // Call the backend to calculate adjustments
      console.log('[DbPlayerCard] Auto-adjusting ratings for target OVR:', newOVR);
      var result = await window.electronAPI.rating.calculateOVRAdjustments(
        attributes, newOVR, position, currentArchetype
      );
      console.log('[DbPlayerCard] Result:', result);

      if (!result || Object.keys(result.adjustments).length === 0) {
        console.log('[DbPlayerCard] No adjustments needed - target already achieved');
        return;
      }

      // AUTOMATIC: Apply adjustments immediately without dialog
      console.log('[DbPlayerCard] Applying ' + Object.keys(result.adjustments).length + ' rating adjustments');
      applyDbOVRAdjustments(result.adjustments, currentArchetype);

      console.log('[DbPlayerCard] ' + playerName + ': Ratings auto-adjusted to achieve OVR ' + result.newOVR);

    } catch (error) {
      console.error('[DbPlayerCard] Error calculating adjustments:', error);
    }
  }

  /**
   * Show dialog asking user if they want to apply rating adjustments in database player card
   */
  function showDbOVRAdjustmentDialog(playerName, oldOVR, newOVR, result, archetypeOptions, currentArchetype, attributes, position) {
    var adjustments = result.adjustments;
    var achievedOVR = result.newOVR;
    var archetype = result.archetype;
    var delta = newOVR - oldOVR;
    var direction = delta > 0 ? 'increase' : 'decrease';

    // Store context for archetype change handler
    window._dbOvrDialogContext = {
      newOVR: newOVR,
      attributes: attributes,
      position: position,
      oldOVR: oldOVR
    };

    // Build archetype dropdown options
    var archetypeOptionsHTML = '';
    archetypeOptions = archetypeOptions || [];
    archetypeOptions.forEach(function(opt, idx) {
      var isSelected = currentArchetype !== undefined && opt.id == currentArchetype;
      var isBest = idx === 0;
      var label = opt.name + ' (' + opt.ovr + ' OVR)' + (isBest ? ' ★' : '');
      archetypeOptionsHTML += '<option value="' + opt.id + '"' + (isSelected ? ' selected' : '') + '>' + label + '</option>';
    });

    // Build the adjustment list HTML
    var adjustmentHTML = '';
    var sortedAdjustments = Object.entries(adjustments)
      .sort(function(a, b) { return b[1].weight - a[1].weight; }); // Sort by weight

    sortedAdjustments.forEach(function(entry) {
      var fieldCode = entry[0];
      var adj = entry[1];
      var change = adj.suggested - adj.current;
      var changeStr = change > 0 ? '+' + change : '' + change;
      var changeClass = change > 0 ? 'positive-change' : 'negative-change';
      adjustmentHTML +=
        '<tr>' +
          '<td>' + adj.name + '</td>' +
          '<td class="current-value">' + adj.current + '</td>' +
          '<td class="arrow">→</td>' +
          '<td class="suggested-value">' + adj.suggested + '</td>' +
          '<td class="' + changeClass + '">' + changeStr + '</td>' +
        '</tr>';
    });

    // Create modal HTML with archetype selector - use z-index 100001 to be above player browser (which is 10000)
    var modalHTML =
      '<div id="db-ovr-adjustment-modal" class="modal-overlay" style="z-index: 100001;">' +
        '<div class="modal-content ovr-adjustment-modal">' +
          '<div class="modal-header">' +
            '<h2>Adjust Ratings for OVR Change?</h2>' +
            '<button class="close-btn" onclick="document.getElementById(\'db-ovr-adjustment-modal\').remove()">×</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<p class="player-info">' +
              '<strong>' + playerName + '</strong>' +
            '</p>' +
            '<div class="archetype-selector" style="margin: 10px 0; display: flex; align-items: center; gap: 10px;">' +
              '<label for="db-archetype-select" style="font-weight: bold;">Archetype:</label>' +
              '<select id="db-archetype-select" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; min-width: 200px;">' +
                archetypeOptionsHTML +
              '</select>' +
            '</div>' +
            '<p class="ovr-change">' +
              'OVR: <span class="old-ovr">' + oldOVR + '</span>' +
              '<span class="arrow">→</span>' +
              '<span class="new-ovr">' + newOVR + '</span>' +
              '<span class="' + (direction === 'increase' ? 'positive-change' : 'negative-change') + '">' +
                '(' + (delta > 0 ? '+' : '') + delta + ')' +
              '</span>' +
            '</p>' +
            '<p class="achieved-ovr">Achieved OVR with these adjustments: <strong id="db-achieved-ovr-value">' + achievedOVR + '</strong></p>' +
            '<div class="adjustment-table-container">' +
              '<table class="adjustment-table">' +
                '<thead>' +
                  '<tr>' +
                    '<th>Attribute</th>' +
                    '<th>Current</th>' +
                    '<th></th>' +
                    '<th>New</th>' +
                    '<th>Change</th>' +
                  '</tr>' +
                '</thead>' +
                '<tbody id="db-adjustment-table-body">' +
                  adjustmentHTML +
                '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button id="db-apply-adjustments-btn" class="ovr-dialog-btn ovr-dialog-btn-apply">Apply Adjustments</button>' +
            '<button id="db-keep-ovr-only-btn" class="ovr-dialog-btn ovr-dialog-btn-keep">Keep OVR Only</button>' +
            '<button id="db-cancel-ovr-btn" class="ovr-dialog-btn ovr-dialog-btn-cancel">Cancel</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    var modal = document.getElementById('db-ovr-adjustment-modal');

    // Store current adjustments and archetype for apply handler
    window._dbCurrentAdjustments = adjustments;
    window._dbSelectedArchetypeId = currentArchetype;

    // Archetype change handler
    var archetypeSelect = document.getElementById('db-archetype-select');
    archetypeSelect.addEventListener('change', async function(e) {
      var newArchetypeId = parseInt(e.target.value);
      window._dbSelectedArchetypeId = newArchetypeId;

      try {
        // Recalculate adjustments with new archetype
        var newResult = await window.electronAPI.rating.calculateOVRAdjustments(
          window._dbOvrDialogContext.attributes,
          window._dbOvrDialogContext.newOVR,
          window._dbOvrDialogContext.position,
          newArchetypeId
        );

        if (newResult && Object.keys(newResult.adjustments).length > 0) {
          window._dbCurrentAdjustments = newResult.adjustments;

          // Update achieved OVR display
          document.getElementById('db-achieved-ovr-value').textContent = newResult.newOVR;

          // Rebuild adjustment table
          var newAdjustmentHTML = '';
          var newSortedAdjustments = Object.entries(newResult.adjustments)
            .sort(function(a, b) { return b[1].weight - a[1].weight; });

          newSortedAdjustments.forEach(function(entry) {
            var fieldCode = entry[0];
            var adj = entry[1];
            var change = adj.suggested - adj.current;
            var changeStr = change > 0 ? '+' + change : '' + change;
            var changeClass = change > 0 ? 'positive-change' : 'negative-change';
            newAdjustmentHTML +=
              '<tr>' +
                '<td>' + adj.name + '</td>' +
                '<td class="current-value">' + adj.current + '</td>' +
                '<td class="arrow">→</td>' +
                '<td class="suggested-value">' + adj.suggested + '</td>' +
                '<td class="' + changeClass + '">' + changeStr + '</td>' +
              '</tr>';
          });

          document.getElementById('db-adjustment-table-body').innerHTML = newAdjustmentHTML;
        }
      } catch (error) {
        console.error('[DbPlayerCard] Error recalculating for archetype:', error);
      }
    });

    // Apply adjustments handler
    document.getElementById('db-apply-adjustments-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      applyDbOVRAdjustments(window._dbCurrentAdjustments, window._dbSelectedArchetypeId);
      modal.remove();
      // Note: ratings are now set in the form, user needs to click Save to persist
    });

    // Keep OVR only handler (just close - OVR already changed)
    document.getElementById('db-keep-ovr-only-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      modal.remove();
    });

    // Cancel handler - revert OVR to old value
    document.getElementById('db-cancel-ovr-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      setValue('dbRating_POVR', oldOVR);
      modal.remove();
    });

    // Close on overlay click
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Apply the calculated rating adjustments to the database player card inputs
   */
  function applyDbOVRAdjustments(adjustments, selectedArchetypeId) {
    var changes = [];

    Object.entries(adjustments).forEach(function(entry) {
      var ovrFieldCode = entry[0];
      var adj = entry[1];

      // Map OVR calculator field code back to database player card field code
      var dbFieldCode = OVR_TO_DB_FIELD_MAP[ovrFieldCode] || ovrFieldCode;

      // Update the input field
      setValue('dbRating_' + dbFieldCode, adj.suggested);

      changes.push(adj.name + ': ' + adj.current + ' → ' + adj.suggested);
    });

    // Update archetype if selected
    if (selectedArchetypeId !== undefined) {
      var archetypeSelect = document.getElementById('dbPlayerArchetype');
      if (archetypeSelect) {
        var oldArchetype = archetypeSelect.value;
        archetypeSelect.value = selectedArchetypeId;
        console.log('[DbPlayerCard] Updated archetype:', oldArchetype, '->', selectedArchetypeId);
      }
    }

    console.log('[DbPlayerCard] Applied ' + changes.length + ' rating changes:', changes);

    // Mark as having unsaved changes
    hasUnsavedChanges = true;
    updateSaveButtonState();
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

  // ========================================
  // Generic Face Picker for Database Card
  // ========================================

  // Cache for generic faces
  var cachedGenericFaces = null;
  var facePickerInitialized = false;

  /**
   * Open the generic face picker modal for database player card
   */
  async function openGenericFacePickerForDbCard() {
    var modal = document.getElementById('genericFacePickerModal');
    var grid = document.getElementById('genericFaceGrid');

    if (!modal || !grid) {
      console.error('[DbPlayerCard] Generic face picker modal or grid not found');
      alert('Face picker not available');
      return;
    }

    // Reset the "3D Model Only" checkbox
    var modelOnlyCheckbox = document.getElementById('modelOnlyCheckbox');
    if (modelOnlyCheckbox) {
      modelOnlyCheckbox.checked = false;
    }

    // Show modal
    modal.style.display = 'flex';

    // Show loading state
    grid.innerHTML = '<div class="loading-spinner">Loading generic faces...</div>';

    // Initialize close button handler for database mode
    if (!facePickerInitialized) {
      var closeBtn = document.getElementById('closeGenericFacePicker');
      if (closeBtn) {
        // Remove any existing listeners by cloning
        var newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', function() {
          modal.style.display = 'none';
        });
      }

      // Close on background click
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });

      facePickerInitialized = true;
    }

    try {
      // Load generic faces (use cache if available)
      var genericFaces = await loadGenericFacesForDbCard();

      if (genericFaces.length === 0) {
        grid.innerHTML = '<div class="loading-spinner">No generic faces found</div>';
        return;
      }

      // Clear grid and populate with faces
      grid.innerHTML = '';

      // Create placeholder image for loading state
      var placeholderSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj4uLi48L3RleHQ+PC9zdmc+';

      // Load faces in batches to prevent UI freeze
      var BATCH_SIZE = 10;
      var currentIndex = 0;

      var loadBatch = function() {
        var endIndex = Math.min(currentIndex + BATCH_SIZE, genericFaces.length);

        for (var i = currentIndex; i < endIndex; i++) {
          var face = genericFaces[i];
          var faceItem = document.createElement('div');
          faceItem.className = 'generic-face-item';
          faceItem.dataset.pid = face.pid;

          // Create image with placeholder
          var img = document.createElement('img');
          img.alt = 'Generic Face ' + face.pid;
          img.src = placeholderSvg;

          var pidLabel = document.createElement('div');
          pidLabel.className = 'generic-face-pid';
          pidLabel.textContent = 'PID ' + face.pid;

          faceItem.appendChild(img);
          faceItem.appendChild(pidLabel);

          // Click handler to select this face for database card
          (function(f) {
            faceItem.addEventListener('click', function() {
              selectGenericFaceForDbCard(f.pid, f.portrait, f._verifiedGenr, f._verifiedSknt);
            });
          })(face);

          grid.appendChild(faceItem);

          // Load portrait asynchronously without blocking UI
          (function(f, imgEl, itemEl) {
            window.electronAPI.portrait.getByPID(f.pid).then(function(imageData) {
              if (imageData && imageData.length > 0) {
                imgEl.src = imageData;
              } else {
                // No portrait available - hide this face from picker
                itemEl.style.display = 'none';
              }
            }).catch(function(error) {
              console.error('[DbPlayerCard] Failed to load portrait for PID ' + f.pid + ':', error);
              itemEl.style.display = 'none';
            });
          })(face, img, faceItem);
        }

        currentIndex = endIndex;

        // Schedule next batch if there are more faces
        if (currentIndex < genericFaces.length) {
          requestAnimationFrame(loadBatch);
        }
      };

      // Start loading batches
      loadBatch();

    } catch (error) {
      console.error('[DbPlayerCard] Error loading generic faces:', error);
      grid.innerHTML = '<div class="loading-spinner">Error loading generic faces</div>';
    }
  }

  /**
   * Load generic faces from the verified mapping
   */
  async function loadGenericFacesForDbCard() {
    // Use cache if available
    if (cachedGenericFaces) {
      return cachedGenericFaces;
    }

    try {
      // Get the VERIFIED portrait->GENR mapping
      var verifiedMapping = {};
      try {
        verifiedMapping = await window.electronAPI.lookup.getVerifiedPortraitGenrMapping();
        console.log('[DbPlayerCard] Loaded ' + Object.keys(verifiedMapping).length + ' verified portrait->GENR mappings');
      } catch (e) {
        console.error('[DbPlayerCard] Could not load verified mapping:', e);
      }

      // Get PID_Portrait_Mapping.csv data for portrait images
      var mapping = await window.electronAPI.lookup.getPIDPortraitMapping();

      // Filter to only type='generic' entries
      var allGenericFaces = mapping.filter(function(entry) {
        return entry.type === 'generic';
      });

      // Only include portraits that exist in our verified mapping
      var verifiedPortraits = new Set(Object.keys(verifiedMapping));
      var validGenericFaces = allGenericFaces.filter(function(face) {
        return verifiedPortraits.has(face.portrait);
      });

      console.log('[DbPlayerCard] Filtered from ' + allGenericFaces.length + ' to ' + validGenericFaces.length + ' faces with verified GENR mappings');

      // Deduplicate by portrait
      var seenPortraits = new Set();
      var uniqueFaces = [];

      for (var i = 0; i < validGenericFaces.length; i++) {
        var face = validGenericFaces[i];
        if (!seenPortraits.has(face.portrait)) {
          seenPortraits.add(face.portrait);
          // Attach the verified GENR/SKNT directly to the face object
          var verifiedData = verifiedMapping[face.portrait];
          face._verifiedGenr = verifiedData ? verifiedData.genr : null;
          face._verifiedSknt = verifiedData ? verifiedData.sknt : null;
          uniqueFaces.push(face);
        }
      }

      // Sort by skin tone category (1-7) for better organization
      uniqueFaces.sort(function(a, b) {
        var matchA = a.portrait.match(/plpo_generic_(\d+)_/);
        var matchB = b.portrait.match(/plpo_generic_(\d+)_/);
        var toneA = matchA ? parseInt(matchA[1]) : 0;
        var toneB = matchB ? parseInt(matchB[1]) : 0;
        return toneA - toneB;
      });

      console.log('[DbPlayerCard] Loaded ' + uniqueFaces.length + ' unique verified faces');

      // Cache for future use
      cachedGenericFaces = uniqueFaces;

      return uniqueFaces;
    } catch (error) {
      console.error('[DbPlayerCard] Error loading generic faces from CSV:', error);
      return [];
    }
  }

  /**
   * Select a generic face and apply it to the database player card
   */
  async function selectGenericFaceForDbCard(pid, portrait, verifiedGenr, verifiedSknt) {
    console.log('[DbPlayerCard] Selected face: PID=' + pid + ', portrait=' + portrait + ', genr=' + verifiedGenr + ', sknt=' + verifiedSknt);

    // Check if "3D Model Only" checkbox is checked
    var modelOnlyCheckbox = document.getElementById('modelOnlyCheckbox');
    var modelOnly = modelOnlyCheckbox && modelOnlyCheckbox.checked;

    if (modelOnly) {
      console.log('[DbPlayerCard] Model Only mode - setting PAM without changing PID');
    }

    try {
      // Get PGHE entry for this face to get full matched set
      var pgheEntry = null;
      try {
        pgheEntry = await window.electronAPI.pghe.getByPID(pid);
      } catch (e) {
        console.log('[DbPlayerCard] Could not get PGHE by PID, will use verified data:', e);
      }

      // Set PID (only if NOT model-only mode)
      var pidInput = document.getElementById('dbPlayerPID');
      if (pidInput && !modelOnly) {
        pidInput.value = pid;
      }

      // Set PAM/PEPS (use verified GENR if available, else derive from portrait)
      var pamInput = document.getElementById('dbPlayerPAM');
      if (pamInput) {
        var genrValue = verifiedGenr || (pgheEntry ? pgheEntry.genr : '');
        if (!genrValue && portrait) {
          // Derive from portrait name: plpo_generic_1_B_B_005 -> gen_1_B_B_005
          var match = portrait.match(/plpo_generic_(.+)/);
          if (match) {
            genrValue = 'gen_' + match[1];
          }
        }
        pamInput.value = genrValue;
      }

      // Set PLPO (portrait key) - only if NOT model-only mode
      var plpoInput = document.getElementById('dbPlayerPLPO');
      if (plpoInput && !modelOnly) {
        plpoInput.value = portrait || ('plpo_generic_' + (verifiedGenr ? verifiedGenr.replace('gen_', '') : ''));
      }

      // Store the FULL PGHE matched set in currentDbPlayer for saving
      // Prioritize verified data from the face picker over PGHE lookup
      if (currentDbPlayer) {
        // Derive PFCG from GENR (gen_1_B_B_005 -> 1_B_B_005)
        var pfcgValue = verifiedGenr ? verifiedGenr.replace(/^gen_/, '') : '';
        if (!pfcgValue && pgheEntry && pgheEntry.pfcg) {
          pfcgValue = pgheEntry.pfcg;
        }

        // In model-only mode, keep the existing PID (psxp)
        var currentPid = modelOnly ? (document.getElementById('dbPlayerPID')?.value || pid) : pid;

        currentDbPlayer._pgheData = {
          pghe: pgheEntry ? pgheEntry.pghe : 0,
          pfcg: pfcgValue,
          gpan: modelOnly ? (currentDbPlayer._pgheData?.gpan || portrait) : (portrait || (pgheEntry ? pgheEntry.gpan : '')),
          gslp: pgheEntry ? pgheEntry.gslp : 0,
          psxp: parseInt(currentPid) || pid,
          cpvf: pgheEntry ? pgheEntry.cpvf : 0,
          genr: verifiedGenr || (pgheEntry ? pgheEntry.genr : ''),
          skinTone: verifiedSknt || (pgheEntry ? pgheEntry.skinTone : 4)
        };
        console.log('[DbPlayerCard] Stored PGHE data:', currentDbPlayer._pgheData, modelOnly ? '(model-only mode)' : '');
      }

      // Mark as changed
      hasUnsavedChanges = true;
      updateSaveButtonState();

      // Load portrait - in model-only mode, refresh the current portrait (keep existing PID)
      if (modelOnly) {
        // Refresh current portrait (don't change it)
        var currentPidValue = document.getElementById('dbPlayerPID')?.value;
        if (currentPidValue) {
          loadPlayerPortrait(currentPidValue);
        }
      } else {
        // Load the new portrait
        loadPlayerPortrait(pid);
      }

      if (modelOnly) {
        console.log('[DbPlayerCard] Applied 3D model only: GENR=' + (verifiedGenr || (pgheEntry ? pgheEntry.genr : 'N/A')) + ' (PID unchanged)');
      } else {
        console.log('[DbPlayerCard] Applied face: PID=' + pid + ', GENR=' + (verifiedGenr || (pgheEntry ? pgheEntry.genr : 'N/A')));
      }

      // Close the modal
      var modal = document.getElementById('genericFacePickerModal');
      if (modal) {
        modal.style.display = 'none';
      }

    } catch (error) {
      console.error('[DbPlayerCard] Error selecting generic face:', error);
      alert('Failed to apply face: ' + error.message);
    }
  }

  // ========================================
  // PAM Picker for Database Card (sets PAM only, not PID)
  // ========================================

  var pamPickerInitialized = false;

  /**
   * Open the PAM picker modal for database player card
   * Sets PAM value only, does not change PID
   */
  async function openPAMPickerForDbCard() {
    var modal = document.getElementById('pamPickerModal');
    var grid = document.getElementById('pamPickerGrid');

    if (!modal || !grid) {
      console.error('[DbPlayerCard] PAM picker modal or grid not found');
      alert('PAM picker not available');
      return;
    }

    // Show modal
    modal.style.display = 'flex';

    // Show loading state
    grid.innerHTML = '<div class="loading-spinner">Loading generic faces...</div>';

    // Initialize close button handler
    if (!pamPickerInitialized) {
      var closeBtn = document.getElementById('closePAMPicker');
      if (closeBtn) {
        // Remove any existing listeners by cloning
        var newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', function() {
          modal.style.display = 'none';
        });
      }

      var cancelBtn = document.getElementById('cancelPAMPicker');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
          modal.style.display = 'none';
        });
      }

      // Close on background click
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });

      pamPickerInitialized = true;
    }

    try {
      // Use cached generic faces or load them
      if (!cachedGenericFaces) {
        // Get verified portrait->GENR mapping
        var verifiedMapping = {};
        try {
          verifiedMapping = await window.electronAPI.lookup.getVerifiedPortraitGenrMapping();
        } catch (e) {
          console.error('[DbPlayerCard] Could not load verified mapping:', e);
        }

        // Get PID_Portrait_Mapping.csv data
        var mapping = await window.electronAPI.lookup.getPIDPortraitMapping();
        var allGenericFaces = mapping.filter(function(entry) { return entry.type === 'generic'; });

        // Filter to verified portraits only
        var verifiedPortraits = new Set(Object.keys(verifiedMapping));
        var validGenericFaces = allGenericFaces.filter(function(face) { return verifiedPortraits.has(face.portrait); });

        // Deduplicate by portrait
        var seenPortraits = new Set();
        cachedGenericFaces = [];

        validGenericFaces.forEach(function(face) {
          if (!seenPortraits.has(face.portrait)) {
            seenPortraits.add(face.portrait);
            var verifiedData = verifiedMapping[face.portrait];
            face._verifiedGenr = verifiedData ? verifiedData.genr : null;
            face._verifiedSknt = verifiedData ? verifiedData.sknt : null;
            cachedGenericFaces.push(face);
          }
        });

        // Sort by skin tone category
        cachedGenericFaces.sort(function(a, b) {
          var matchA = a.portrait.match(/plpo_generic_(\d+)_/);
          var matchB = b.portrait.match(/plpo_generic_(\d+)_/);
          var toneA = matchA ? parseInt(matchA[1]) : 0;
          var toneB = matchB ? parseInt(matchB[1]) : 0;
          return toneA - toneB;
        });
      }

      if (!cachedGenericFaces || cachedGenericFaces.length === 0) {
        grid.innerHTML = '<div class="loading-spinner">No generic faces found</div>';
        return;
      }

      // Clear grid and populate
      grid.innerHTML = '';

      cachedGenericFaces.forEach(function(face) {
        var faceItem = document.createElement('div');
        faceItem.className = 'generic-face-item';
        faceItem.style.cssText = 'display: flex; flex-direction: column; align-items: center; cursor: pointer; padding: 8px; background: #2a2a2a; border-radius: 6px; transition: all 0.2s;';

        var img = document.createElement('img');
        img.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 4px; background: #333;';
        img.alt = 'Generic Face';

        var pamLabel = document.createElement('div');
        pamLabel.style.cssText = 'margin-top: 6px; font-size: 10px; color: #aaa; text-align: center; word-break: break-all;';
        pamLabel.textContent = face._verifiedGenr || face.portrait.replace('plpo_generic_', 'gen_') || 'Unknown';

        faceItem.appendChild(img);
        faceItem.appendChild(pamLabel);

        // Hover effect
        faceItem.addEventListener('mouseenter', function() {
          faceItem.style.background = '#3a3a3a';
          faceItem.style.transform = 'scale(1.05)';
        });
        faceItem.addEventListener('mouseleave', function() {
          faceItem.style.background = '#2a2a2a';
          faceItem.style.transform = 'scale(1)';
        });

        // Click handler to select PAM
        faceItem.addEventListener('click', function() {
          selectPAMForDbCard(face._verifiedGenr, face.portrait);
        });

        grid.appendChild(faceItem);

        // Load portrait asynchronously
        window.electronAPI.portrait.getByPID(face.pid).then(function(imageData) {
          if (imageData && imageData.length > 0) {
            img.src = imageData;
          } else {
            faceItem.style.display = 'none';
          }
        }).catch(function() {
          faceItem.style.display = 'none';
        });
      });

    } catch (error) {
      console.error('[DbPlayerCard] Error loading PAM picker:', error);
      grid.innerHTML = '<div class="loading-spinner">Error loading generic faces</div>';
    }
  }

  /**
   * Select a PAM value for the current player (does NOT change PID)
   */
  async function selectPAMForDbCard(genrValue, portrait) {
    console.log('[DbPlayerCard] Selecting PAM only:', genrValue, 'portrait:', portrait);

    // Set the PAM value
    var pamValue = genrValue || (portrait ? portrait.replace('plpo_generic_', 'gen_') : null);

    if (!pamValue) {
      console.error('[DbPlayerCard] No PAM value to set');
      return;
    }

    // Update the PAM input field
    var pamInput = document.getElementById('dbPlayerPAM');
    if (pamInput) {
      pamInput.value = pamValue;
    }

    // Mark as changed
    hasUnsavedChanges = true;
    updateSaveButtonState();

    console.log('[DbPlayerCard] Set PAM to:', pamValue, '(PID unchanged)');

    // Close the modal
    var modal = document.getElementById('pamPickerModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // =============================================
  // PORTRAIT PICKER FUNCTIONS
  // =============================================

  var selectedPickerPid = null;

  /**
   * Open the portrait picker modal
   */
  async function openPortraitPicker() {
    if (!currentDbPlayerId) {
      console.warn('[DatabasePlayerCard] No player loaded');
      return;
    }

    console.log('[DatabasePlayerCard] Opening portrait picker for player:', currentDbPlayerId);

    // Reset state
    selectedPickerPid = null;
    var confirmBtn = document.getElementById('confirmPortraitPickerBtn');
    if (confirmBtn) confirmBtn.disabled = true;

    // Set player name
    var firstName = getValue('dbPlayerFirstName') || '';
    var lastName = getValue('dbPlayerLastName') || '';
    var playerName = (firstName + ' ' + lastName).trim() || 'Unknown Player';
    var pickerPlayerName = document.getElementById('pickerPlayerName');
    if (pickerPlayerName) {
      pickerPlayerName.textContent = 'Assigning portrait to: ' + playerName;
    }

    // Load custom portraits
    var grid = document.getElementById('portraitPickerGrid');
    if (grid) {
      grid.innerHTML = '<div class="picker-loading">Loading portraits...</div>';
    }

    try {
      var portraits = await window.electronAPI.customPortrait.list();
      renderPortraitPickerGrid(portraits);
    } catch (error) {
      console.error('[DatabasePlayerCard] Error loading portraits:', error);
      if (grid) {
        grid.innerHTML = '<div class="picker-empty">Error loading portraits</div>';
      }
    }

    // Show modal
    var modal = document.getElementById('portraitPickerModal');
    if (modal) modal.style.display = 'flex';
  }

  /**
   * Render the portrait picker grid
   */
  async function renderPortraitPickerGrid(portraits) {
    var grid = document.getElementById('portraitPickerGrid');
    if (!grid) return;

    if (!portraits || portraits.length === 0) {
      grid.innerHTML = '<div class="picker-empty">No custom portraits available. Import portraits in Portrait Manager.</div>';
      return;
    }

    grid.innerHTML = '';

    for (var i = 0; i < portraits.length; i++) {
      var portrait = portraits[i];
      var card = document.createElement('div');
      card.className = 'picker-portrait-card';
      card.dataset.pid = portrait.pid;

      var img = document.createElement('img');
      img.alt = portrait.playerName || 'PID ' + portrait.pid;

      // Load image
      try {
        var imageData = await window.electronAPI.customPortrait.get(portrait.pid);
        if (imageData) {
          img.src = imageData;
        } else {
          img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
        }
      } catch (err) {
        console.error('[DatabasePlayerCard] Error loading portrait image:', err);
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
      }

      card.appendChild(img);

      var pidBadge = document.createElement('div');
      pidBadge.className = 'picker-portrait-pid';
      pidBadge.textContent = 'PID: ' + portrait.pid + (portrait.playerName ? ' (' + portrait.playerName + ')' : '');
      card.appendChild(pidBadge);

      // Click handler
      (function(pid) {
        card.addEventListener('click', function() {
          selectPortraitInPicker(pid);
        });
      })(portrait.pid);

      grid.appendChild(card);
    }
  }

  /**
   * Select a portrait in the picker
   */
  function selectPortraitInPicker(pid) {
    selectedPickerPid = pid;

    // Update visual selection
    var grid = document.getElementById('portraitPickerGrid');
    if (grid) {
      grid.querySelectorAll('.picker-portrait-card').forEach(function(card) {
        card.classList.toggle('selected', parseInt(card.dataset.pid) === pid);
      });
    }

    // Enable confirm button
    var confirmBtn = document.getElementById('confirmPortraitPickerBtn');
    if (confirmBtn) confirmBtn.disabled = false;
  }

  /**
   * Close the portrait picker modal
   */
  function closePortraitPicker() {
    var modal = document.getElementById('portraitPickerModal');
    if (modal) modal.style.display = 'none';
    selectedPickerPid = null;
  }

  /**
   * Import a new portrait from the picker modal
   */
  async function importNewPortraitFromPicker() {
    try {
      // Use the same import flow as Portrait Manager
      var result = await window.electronAPI.customPortrait.import();

      if (!result || result.canceled) {
        console.log('[DatabasePlayerCard] Portrait import cancelled');
        return;
      }

      if (!result.success) {
        alert('Failed to import portrait: ' + (result.error || 'Unknown error'));
        return;
      }

      console.log('[DatabasePlayerCard] Portrait imported with PID:', result.pid);

      // Update player name metadata if we know the player
      if (currentDbPlayer && result.pid) {
        var playerName = (currentDbPlayer.firstName || '') + ' ' + (currentDbPlayer.lastName || '');
        if (playerName.trim()) {
          try {
            await window.electronAPI.customPortrait.updateMetadata(result.pid, {
              playerName: playerName.trim(),
              databasePlayerId: currentDbPlayerId
            });
          } catch (err) {
            console.warn('[DatabasePlayerCard] Could not update portrait metadata:', err);
          }
        }
      }

      // Refresh the portrait picker grid
      var portraits = await window.electronAPI.customPortrait.list();
      renderPortraitPickerGrid(portraits);

      // Auto-select the newly imported portrait
      if (result.pid) {
        selectPortraitInPicker(result.pid);
      }

    } catch (error) {
      console.error('[DatabasePlayerCard] Error importing portrait:', error);
      alert('Failed to import portrait: ' + error.message);
    }
  }

  /**
   * Confirm portrait selection and assign to player
   */
  async function confirmPortraitPicker() {
    if (!selectedPickerPid || !currentDbPlayerId) {
      console.warn('[DatabasePlayerCard] No portrait or player selected');
      return;
    }

    var firstName = getValue('dbPlayerFirstName') || '';
    var lastName = getValue('dbPlayerLastName') || '';
    var playerName = (firstName + ' ' + lastName).trim() || 'Unknown';

    console.log('[DatabasePlayerCard] Assigning PID', selectedPickerPid, 'to player:', playerName);

    try {
      // Update player's PID based on type
      if (currentPlayerSource === 'custom') {
        // Custom player - update custom_players table (must use maddenPid field name)
        await window.electronAPI.database.updateCustomPlayer(currentDbPlayerId, { maddenPid: selectedPickerPid });
      } else {
        // Database player - save appearance edit
        await window.electronAPI.database.saveAppearanceEdit(currentDbPlayerId, { maddenPid: selectedPickerPid });
      }

      // Update portrait metadata with player name AND database player ID (for list view lookup)
      await window.electronAPI.customPortrait.updateMetadata(selectedPickerPid, {
        playerName: playerName,
        databasePlayerId: currentDbPlayerId
      });

      // Update the PID field in the form
      setValue('dbPlayerPID', selectedPickerPid);
      hasUnsavedChanges = true;
      updateSaveButtonState();

      // Reload the portrait display with new PID
      await loadPlayerPortrait(selectedPickerPid);

      // Close modal and show success
      closePortraitPicker();

      // Refresh the main grid/list to show updated portrait
      if (typeof window.refreshDatabaseBrowser === 'function') {
        window.refreshDatabaseBrowser();
      }
      if (typeof window.refreshPlayerBrowser === 'function') {
        window.refreshPlayerBrowser();
      }

      if (typeof window.showToast === 'function') {
        window.showToast('Portrait assigned! PID: ' + selectedPickerPid, 'success');
      } else {
        console.log('[DatabasePlayerCard] Portrait assigned! PID:', selectedPickerPid);
      }

    } catch (error) {
      console.error('[DatabasePlayerCard] Error assigning portrait:', error);
      if (typeof window.showToast === 'function') {
        window.showToast('Error assigning portrait: ' + error.message, 'error');
      }
    }
  }

  // =============================================
  // CAREER STATS TAB FUNCTIONALITY
  // =============================================

  // Career stats state
  var careerStatsData = null;
  var careerStatsPlayer = null;

  /**
   * Load career stats for the current player
   */
  async function loadCareerStats(player) {
    if (!player) {
      console.log('[DbPlayerCard] No player for career stats');
      return;
    }

    var firstName = player.firstName || '';
    var lastName = player.lastName || '';

    if (!firstName || !lastName) {
      console.log('[DbPlayerCard] Missing name for career stats lookup');
      renderNoCareerStats('Player name required for stats lookup');
      return;
    }

    // Get draft year and position to help disambiguate players with the same name
    // (e.g., Eric Allen WR 1972 vs Eric Allen CB 1988)
    var draftYear = player.draftClass ? parseInt(player.draftClass, 10) : null;
    if (isNaN(draftYear)) draftYear = null;
    var playerPosition = player.position || player.pos || null;

    console.log('[DbPlayerCard] Loading career stats for:', firstName, lastName, draftYear ? '(draft ' + draftYear + ')' : '', playerPosition ? '(pos ' + playerPosition + ')' : '');

    try {
      var result = await window.electronAPI.database.getCareerStats(firstName, lastName, draftYear, playerPosition);

      if (!result.success) {
        console.error('[DbPlayerCard] Career stats error:', result.error);
        renderNoCareerStats('Error loading stats: ' + result.error);
        return;
      }

      careerStatsData = result.stats || [];
      careerStatsPlayer = result.player;

      console.log('[DbPlayerCard] Loaded', careerStatsData.length, 'seasons of career stats');

      // Set up the career stats year selector
      setupCareerStatsYearSelector(careerStatsData);

      // Render all years table by default
      renderCareerStatsAllYears(careerStatsData);

    } catch (error) {
      console.error('[DbPlayerCard] Error loading career stats:', error);
      renderNoCareerStats('Failed to load stats: ' + error.message);
    }
  }

  /**
   * Set up the career stats year selector dropdown
   */
  function setupCareerStatsYearSelector(stats) {
    var yearSelect = document.getElementById('dbStatsYearSelect');
    if (!yearSelect) return;

    yearSelect.innerHTML = '<option value="all">All Years (Table View)</option>';

    if (!stats || stats.length === 0) {
      return;
    }

    // Add each year as an option
    stats.forEach(function(season) {
      var opt = document.createElement('option');
      opt.value = season.year;
      var teamDisplay = pfrToMaddenTeam(season.team) || 'Unknown';
      opt.textContent = season.year + ' (' + teamDisplay + ')';
      yearSelect.appendChild(opt);
    });
  }

  /**
   * Handle career stats year selector change
   */
  async function onCareerStatsYearChange() {
    var yearSelect = document.getElementById('dbStatsYearSelect');
    if (!yearSelect) return;

    var value = yearSelect.value;
    var allYearsView = document.getElementById('statsAllYearsView');
    var singleYearView = document.getElementById('statsSingleYearView');

    if (value === 'all') {
      // Show all years table
      if (allYearsView) allYearsView.style.display = 'block';
      if (singleYearView) singleYearView.style.display = 'none';
      await renderCareerStatsAllYears(careerStatsData);
    } else {
      // Show single year detail
      var year = parseInt(value, 10);
      if (allYearsView) allYearsView.style.display = 'none';
      if (singleYearView) singleYearView.style.display = 'block';
      renderCareerStatsSingleYear(year);
    }
  }

  /**
   * Render all years career stats table
   */
  async function renderCareerStatsAllYears(stats) {
    var container = document.getElementById('statsAllYearsTable');
    if (!container) return;

    // Set container styles for proper sticky header behavior
    container.style.position = 'relative';
    container.style.maxHeight = '300px';
    container.style.overflowY = 'auto';

    if (!stats || stats.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No career stats found in database</p>';
      return;
    }

    // Fetch team data from database for each year to fill in missing teams
    var dbTeamsByYear = {};
    if (currentDbPlayerId && availableYears.length > 0) {
      for (var i = 0; i < availableYears.length; i++) {
        var yr = availableYears[i];
        try {
          var result;
          if (isCustomPlayer) {
            result = await window.electronAPI.database.getCustomPlayerSeason(currentDbPlayerId, yr);
            if (result.success && result.data) result = { success: true, season: result.data };
          } else {
            result = await window.electronAPI.database.getMergedPlayerSeason(currentDbPlayerId, yr);
          }
          if (result.success && result.season && result.season.team) {
            dbTeamsByYear[yr] = result.season.team;
          }
        } catch (e) {
          // Ignore errors for individual years
        }
      }
    }

    // Determine what type of stats to show based on position
    var hasPassingStats = stats.some(function(s) { return s.pass_att > 0; });
    var hasRushingStats = stats.some(function(s) { return s.rush_att > 0; });
    var hasReceivingStats = stats.some(function(s) { return s.rec > 0; });
    var hasDefensiveStats = stats.some(function(s) { return s.tackles > 0 || s.sacks > 0 || s.def_int > 0; });

    var stickyThStyle = 'position: sticky; top: 0; z-index: 10; padding: 8px 6px; border-bottom: 2px solid #444; background: #1a1a1a; color: #fff; font-weight: 600;';
    var html = '<table class="stats-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="text-align: left; ' + stickyThStyle + '">Year</th>';
    html += '<th style="text-align: left; ' + stickyThStyle + '">Team</th>';
    html += '<th style="text-align: center; ' + stickyThStyle + '">G</th>';

    if (hasPassingStats) {
      html += '<th style="text-align: center; ' + stickyThStyle + '">Cmp</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">Att</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">Yds</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">TD</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">INT</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">Rtg</th>';
    }

    if (hasRushingStats) {
      html += '<th style="text-align: center; ' + stickyThStyle + '">Rush</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">RuYds</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">RuTD</th>';
    }

    if (hasReceivingStats) {
      html += '<th style="text-align: center; ' + stickyThStyle + '">Rec</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">RecYds</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">RecTD</th>';
    }

    if (hasDefensiveStats) {
      html += '<th style="text-align: center; ' + stickyThStyle + '">Tkl</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">Sck</th>';
      html += '<th style="text-align: center; ' + stickyThStyle + '">INT</th>';
    }

    html += '</tr></thead><tbody>';

    // Career totals
    var totals = {
      games: 0, pass_cmp: 0, pass_att: 0, pass_yds: 0, pass_td: 0, pass_int: 0,
      rush_att: 0, rush_yds: 0, rush_td: 0, rec: 0, rec_yds: 0, rec_td: 0,
      tackles: 0, sacks: 0, def_int: 0
    };

    stats.forEach(function(s) {
      // Use database team if available, otherwise convert PFR team to Madden format
      var pfrTeamMapped = pfrToMaddenTeam(s.team);
      var displayTeam = dbTeamsByYear[s.year] || pfrTeamMapped || '-';
      html += '<tr style="border-bottom: 1px solid #333;">';
      html += '<td style="padding: 6px; color: #64b5f6; font-weight: 500;">' + s.year + '</td>';
      html += '<td style="padding: 6px; color: #aaa;">' + displayTeam + '</td>';
      html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.games || 0) + '</td>';

      if (hasPassingStats) {
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.pass_cmp || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.pass_att || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.pass_yds || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.pass_td || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.pass_int || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.pass_rating || 0).toFixed(1) + '</td>';
      }

      if (hasRushingStats) {
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.rush_att || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.rush_yds || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.rush_td || 0) + '</td>';
      }

      if (hasReceivingStats) {
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.rec || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.rec_yds || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.rec_td || 0) + '</td>';
      }

      if (hasDefensiveStats) {
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.tackles || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.sacks || 0) + '</td>';
        html += '<td style="padding: 6px; text-align: center; color: #e0e0e0;">' + (s.def_int || 0) + '</td>';
      }

      html += '</tr>';

      // Accumulate totals
      totals.games += s.games || 0;
      totals.pass_cmp += s.pass_cmp || 0;
      totals.pass_att += s.pass_att || 0;
      totals.pass_yds += s.pass_yds || 0;
      totals.pass_td += s.pass_td || 0;
      totals.pass_int += s.pass_int || 0;
      totals.rush_att += s.rush_att || 0;
      totals.rush_yds += s.rush_yds || 0;
      totals.rush_td += s.rush_td || 0;
      totals.rec += s.rec || 0;
      totals.rec_yds += s.rec_yds || 0;
      totals.rec_td += s.rec_td || 0;
      totals.tackles += s.tackles || 0;
      totals.sacks += s.sacks || 0;
      totals.def_int += s.def_int || 0;
    });

    // Career totals row
    html += '<tr style="font-weight: bold; background: #252525; border-top: 2px solid #4caf50;">';
    html += '<td style="padding: 8px 6px; color: #fff;" colspan="2">Career</td>';
    html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.games + '</td>';

    if (hasPassingStats) {
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.pass_cmp + '</td>';
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.pass_att + '</td>';
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.pass_yds + '</td>';
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.pass_td + '</td>';
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.pass_int + '</td>';
      // Calculate career passer rating
      var careerRating = totals.pass_att > 0 ? calculatePasserRating(totals) : 0;
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + careerRating.toFixed(1) + '</td>';
    }

    if (hasRushingStats) {
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.rush_att + '</td>';
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.rush_yds + '</td>';
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.rush_td + '</td>';
    }

    if (hasReceivingStats) {
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.rec + '</td>';
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.rec_yds + '</td>';
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.rec_td + '</td>';
    }

    if (hasDefensiveStats) {
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.tackles + '</td>';
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.sacks + '</td>';
      html += '<td style="padding: 8px 6px; text-align: center; color: #fff;">' + totals.def_int + '</td>';
    }

    html += '</tr>';
    html += '</tbody></table>';

    container.innerHTML = html;
  }

  /**
   * Calculate NFL passer rating
   */
  function calculatePasserRating(stats) {
    if (!stats.pass_att || stats.pass_att === 0) return 0;

    var a = ((stats.pass_cmp / stats.pass_att) - 0.3) * 5;
    var b = ((stats.pass_yds / stats.pass_att) - 3) * 0.25;
    var c = (stats.pass_td / stats.pass_att) * 20;
    var d = 2.375 - ((stats.pass_int / stats.pass_att) * 25);

    a = Math.max(0, Math.min(2.375, a));
    b = Math.max(0, Math.min(2.375, b));
    c = Math.max(0, Math.min(2.375, c));
    d = Math.max(0, Math.min(2.375, d));

    return ((a + b + c + d) / 6) * 100;
  }

  /**
   * Render single year career stats detail
   */
  function renderCareerStatsSingleYear(year) {
    if (!careerStatsData) return;

    var season = careerStatsData.find(function(s) { return s.year === year; });
    if (!season) {
      console.log('[DbPlayerCard] No stats found for year:', year);
      return;
    }

    // Update year label
    var yearLabel = document.getElementById('statsSelectedYear');
    if (yearLabel) {
      var teamDisplay = pfrToMaddenTeam(season.team) || 'Unknown';
      yearLabel.textContent = year + ' (' + teamDisplay + ')';
    }

    // Populate single year fields
    setValue('statsGames', season.games || 0);
    setValue('statsPassCmp', season.pass_cmp || 0);
    setValue('statsPassAtt', season.pass_att || 0);
    setValue('statsPassYds', season.pass_yds || 0);
    setValue('statsPassTd', season.pass_td || 0);
    setValue('statsPassInt', season.pass_int || 0);
    setValue('statsPassRating', (season.pass_rating || 0).toFixed(1));
    setValue('statsRushAtt', season.rush_att || 0);
    setValue('statsRushYds', season.rush_yds || 0);
    setValue('statsRushTd', season.rush_td || 0);
    setValue('statsRec', season.rec || 0);
    setValue('statsRecYds', season.rec_yds || 0);
    setValue('statsRecTd', season.rec_td || 0);
    setValue('statsTackles', season.tackles || 0);
    setValue('statsSacks', season.sacks || 0);
    setValue('statsDefInt', season.def_int || 0);
    setValue('statsFf', season.ff || 0);
    setValue('statsFr', season.fr || 0);

    // Show/hide stat sections based on what data exists
    var passingSection = document.getElementById('statsPassingSection');
    var rushingSection = document.getElementById('statsRushingSection');
    var receivingSection = document.getElementById('statsReceivingSection');
    var defenseSection = document.getElementById('statsDefenseSection');

    if (passingSection) passingSection.style.display = season.pass_att > 0 ? 'block' : 'none';
    if (rushingSection) rushingSection.style.display = season.rush_att > 0 ? 'block' : 'none';
    if (receivingSection) receivingSection.style.display = season.rec > 0 ? 'block' : 'none';
    if (defenseSection) defenseSection.style.display = (season.tackles > 0 || season.sacks > 0 || season.def_int > 0) ? 'block' : 'none';
  }

  /**
   * Render no career stats message
   */
  function renderNoCareerStats(message) {
    var container = document.getElementById('statsAllYearsTable');
    if (container) {
      container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">' + (message || 'No career stats available') + '</p>';
    }

    // Clear year selector
    var yearSelect = document.getElementById('dbStatsYearSelect');
    if (yearSelect) {
      yearSelect.innerHTML = '<option value="all">All Years (Table View)</option>';
    }
  }

  /**
   * Calculate Madden ratings from stats and push to ratings tab
   * Uses the Stats-Based OVR formula from docs/STATS_BASED_OVR_FORMULA.md
   */
  async function calculateRatingFromStats() {
    var yearSelect = document.getElementById('dbStatsYearSelect');
    if (!yearSelect || yearSelect.value === 'all') {
      alert('Please select a specific year to calculate ratings from');
      return;
    }

    var year = parseInt(yearSelect.value, 10);
    var season = careerStatsData ? careerStatsData.find(function(s) { return s.year === year; }) : null;

    if (!season) {
      alert('No stats found for year ' + year);
      return;
    }

    var position = currentDbPlayer ? (currentDbPlayer.position || '') : '';

    // Calculate player age for the target year
    // Try to get birth year from draft class (assume drafted at ~22 years old)
    var playerAge = 25; // Default
    if (currentDbPlayer && currentDbPlayer.draftClass) {
      var draftYear = parseInt(currentDbPlayer.draftClass, 10);
      if (!isNaN(draftYear)) {
        // Estimate birth year (drafted at age 22 typically)
        var birthYear = draftYear - 22;
        playerAge = (year + 1) - birthYear; // Age at start of next season (ratings apply to)
      }
    } else if (careerStatsPlayer && careerStatsPlayer.from_year) {
      // Use first year in league as proxy (assume age 22)
      var birthYear = careerStatsPlayer.from_year - 22;
      playerAge = (year + 1) - birthYear;
    }

    // Build achievements object from career stats player data
    // rookieYear is critical for career progression (rookies capped at 82, etc.)
    var rookieYear = null;
    if (careerStatsPlayer && careerStatsPlayer.from_year) {
      rookieYear = careerStatsPlayer.from_year;
    } else if (currentDbPlayer && currentDbPlayer.draftClass) {
      rookieYear = parseInt(currentDbPlayer.draftClass, 10);
    }

    var achievements = {
      isHOF: careerStatsPlayer ? !!careerStatsPlayer.is_hof : false,
      proBowlYears: [], // Could be populated from ALL_PLAYER_LOOKUP if available
      allPro1stYears: [],
      allPro2ndYears: [],
      rookieYear: rookieYear
    };

    var yearsInLeague = rookieYear ? (year - rookieYear + 1) : 4;

    console.log('[DbPlayerCard] Calculating ratings from stats for year', year, 'position', position);
    console.log('[DbPlayerCard] Player age:', playerAge, 'HOF:', achievements.isHOF, 'Years in league:', yearsInLeague);

    try {
      var result = await window.electronAPI.database.calculateRatingFromStats({
        stats: season,
        position: position,
        year: year,
        targetYear: year + 1, // Ratings apply to the next year (Madden approach)
        playerAge: playerAge,
        achievements: achievements
      });

      if (!result.success) {
        alert('Error calculating ratings: ' + result.error);
        return;
      }

      var ratings = result.ratings;
      console.log('[DbPlayerCard] Calculated ratings:', ratings);

      // Check if there are existing ratings for this year
      var existingRatingsYearSelect = document.getElementById('dbPlayerYearSelect');
      var hasExistingRatings = false;

      if (existingRatingsYearSelect) {
        // Check if this year exists in ratings
        for (var i = 0; i < existingRatingsYearSelect.options.length; i++) {
          if (parseInt(existingRatingsYearSelect.options[i].value, 10) === year) {
            hasExistingRatings = true;
            break;
          }
        }
      }

      if (hasExistingRatings) {
        var confirmed = confirm(
          'Warning: This player already has ratings for ' + year + '.\n\n' +
          'Do you want to overwrite the existing ratings with stats-based calculations?\n\n' +
          'Calculated OVR: ' + (ratings.POVR || 'N/A')
        );
        if (!confirmed) return;
      }

      // Switch to ratings tab
      var ratingsTab = document.querySelector('.db-player-tab[data-tab="ratings"]');
      if (ratingsTab) ratingsTab.click();

      // Select the year in ratings tab
      if (existingRatingsYearSelect) {
        existingRatingsYearSelect.value = year.toString();
        // Trigger change event to load existing data (if any)
        existingRatingsYearSelect.dispatchEvent(new Event('change'));
      }

      // Populate the calculated ratings after a brief delay to ensure form is ready
      setTimeout(function() {
        Object.keys(ratings).forEach(function(key) {
          var inputId = 'dbRating_' + key;
          var input = document.getElementById(inputId);
          if (input) {
            input.value = ratings[key];
            input.dispatchEvent(new Event('change'));
          }
        });

        hasUnsavedChanges = true;
        updateSaveButtonState();

        if (typeof window.showToast === 'function') {
          window.showToast('Ratings calculated from ' + year + ' stats (OVR: ' + ratings.POVR + ')', 'success');
        }

        // Restore OS-level window focus after IPC and DOM updates (critical for Windows)
        if (window.electronAPI && window.electronAPI.window && window.electronAPI.window.focus) {
          window.electronAPI.window.focus().then(function() {
            // Focus the OVR input so user can continue editing
            setTimeout(function() {
              var ovrInput = document.getElementById('dbRating_POVR');
              if (ovrInput) ovrInput.focus();
            }, 50);
          }).catch(function() {});
        }
      }, 100);

    } catch (error) {
      console.error('[DbPlayerCard] Error calculating ratings:', error);
      alert('Failed to calculate ratings: ' + error.message);
    }
  }

  /**
   * Refresh career stats data
   */
  async function refreshCareerStats() {
    if (currentDbPlayer) {
      await loadCareerStats(currentDbPlayer);
      if (typeof window.showToast === 'function') {
        window.showToast('Career stats refreshed', 'info');
      }
    }
  }

  /**
   * Map PFR team abbreviations to Madden team names
   * PFR uses abbreviations like "CHI", Madden uses names like "Bears"
   */
  var PFR_TO_MADDEN_TEAM = {
    // Current teams
    'ARI': 'Cards', 'ATL': 'Falcons', 'BAL': 'Ravens', 'BUF': 'Bills',
    'CAR': 'Panthers', 'CHI': 'Bears', 'CIN': 'Bengals', 'CLE': 'Browns',
    'DAL': 'Cowboys', 'DEN': 'Broncos', 'DET': 'Lions', 'GB': 'Packers',
    'GNB': 'Packers', 'HOU': 'Texans', 'IND': 'Colts', 'JAC': 'Jags',
    'JAX': 'Jags', 'KC': 'Chiefs', 'KAN': 'Chiefs', 'LA': 'Rams',
    'LAC': 'Chargers', 'LAR': 'Rams', 'LV': 'Raiders', 'LVR': 'Raiders',
    'MIA': 'Dolphins', 'MIN': 'Vikings', 'NE': 'Pats', 'NWE': 'Pats',
    'NO': 'Saints', 'NOR': 'Saints', 'NYG': 'Giants', 'NYJ': 'Jets',
    'OAK': 'Raiders', 'PHI': 'Eagles', 'PIT': 'Steelers', 'SD': 'Chargers',
    'SDG': 'Chargers', 'SEA': 'Seahawks', 'SF': 'Niners', 'SFO': '49ers',
    'STL': 'Rams', 'TB': 'Buccs', 'TAM': 'Buccs', 'TEN': 'Titans',
    'WAS': 'Commanders', 'WSH': 'Commanders',
    // Historical teams - map to closest modern equivalent or keep as-is
    'PHO': 'Cards', 'STL': 'Cards', // Phoenix/St. Louis Cardinals -> Cards
    'BOS': 'Pats', // Boston Patriots -> Pats
    'HOU': 'Titans', // Houston Oilers -> Titans (for historical purposes)
    'CRD': 'Cards', // Chicago Cardinals
    'RAM': 'Rams', // L.A. Rams historical
    'RAI': 'Raiders', // Raiders historical
    'CLT': 'Colts', // Baltimore Colts -> Colts
    // Alternative formats
    '49ers': '49ers', 'Bears': 'Bears', 'Bengals': 'Bengals', 'Bills': 'Bills',
    'Broncos': 'Broncos', 'Browns': 'Browns', 'Buccs': 'Buccs', 'Cards': 'Cards',
    'Chargers': 'Chargers', 'Chiefs': 'Chiefs', 'Colts': 'Colts', 'Cowboys': 'Cowboys',
    'Dolphins': 'Dolphins', 'Eagles': 'Eagles', 'Falcons': 'Falcons', 'Giants': 'Giants',
    'Jags': 'Jags', 'Jets': 'Jets', 'Lions': 'Lions', 'Packers': 'Packers',
    'Panthers': 'Panthers', 'Pats': 'Pats', 'Raiders': 'Raiders', 'Rams': 'Rams',
    'Ravens': 'Ravens', 'Commanders': 'Commanders', 'Saints': 'Saints', 'Seahawks': 'Seahawks',
    'Steelers': 'Steelers', 'Texans': 'Texans', 'Titans': 'Titans', 'Vikings': 'Vikings', 'Niners': '49ers'
  };

  /**
   * Convert PFR team abbreviation to Madden team name
   */
  function pfrToMaddenTeam(pfrTeam) {
    if (!pfrTeam) return '';
    var team = pfrTeam.trim().toUpperCase();
    // Check direct mapping first
    if (PFR_TO_MADDEN_TEAM[team]) return PFR_TO_MADDEN_TEAM[team];
    // Check case-insensitive
    var lowerTeam = pfrTeam.trim();
    if (PFR_TO_MADDEN_TEAM[lowerTeam]) return PFR_TO_MADDEN_TEAM[lowerTeam];
    // If already a team name, return as-is
    var teamNames = ['Bears', 'Bengals', 'Bills', 'Broncos', 'Browns', 'Buccs', 'Cards', 'Chargers',
                     'Chiefs', 'Colts', 'Cowboys', 'Dolphins', 'Eagles', 'Falcons', '49ers', 'Giants',
                     'Jags', 'Jets', 'Lions', 'Packers', 'Panthers', 'Pats', 'Raiders', 'Rams',
                     'Ravens', 'Commanders', 'Saints', 'Seahawks', 'Steelers', 'Texans', 'Titans', 'Vikings'];
    for (var i = 0; i < teamNames.length; i++) {
      if (teamNames[i].toLowerCase() === lowerTeam.toLowerCase()) return teamNames[i];
    }
    console.warn('[DbPlayerCard] Unknown team abbreviation:', pfrTeam);
    return pfrTeam; // Return as-is if no mapping found
  }

  /**
   * Bulk generate ratings for all years with stats
   * Shows preview modal before applying
   * Uses the Stats-Based OVR formula from docs/STATS_BASED_OVR_FORMULA.md
   */
  async function bulkGenerateRatings() {
    if (!currentDbPlayerId || !currentDbPlayer) {
      alert('Please select a player first');
      return;
    }

    if (!careerStatsData || careerStatsData.length === 0) {
      alert('No career stats available for this player.\n\nThis feature generates ratings from Pro-Football-Reference stats.');
      return;
    }

    var position = currentDbPlayer.position || '';
    if (!position) {
      alert('Player position is required to generate ratings.\n\nPlease set the position on the Player Info tab first.');
      return;
    }

    // Calculate base birth year for age calculations
    var birthYear = null;
    if (currentDbPlayer && currentDbPlayer.draftClass) {
      var draftYear = parseInt(currentDbPlayer.draftClass, 10);
      if (!isNaN(draftYear)) {
        birthYear = draftYear - 22; // Assume drafted at age 22
      }
    } else if (careerStatsPlayer && careerStatsPlayer.from_year) {
      birthYear = careerStatsPlayer.from_year - 22; // Assume first year at age 22
    }

    // Build base achievements object
    // rookieYear is critical for career progression (rookies capped at 82, etc.)
    var rookieYear = null;
    if (careerStatsPlayer && careerStatsPlayer.from_year) {
      rookieYear = careerStatsPlayer.from_year;
    } else if (currentDbPlayer && currentDbPlayer.draftClass) {
      rookieYear = parseInt(currentDbPlayer.draftClass, 10);
    }

    var achievements = {
      isHOF: careerStatsPlayer ? !!careerStatsPlayer.is_hof : false,
      proBowlYears: [], // Could be populated from ALL_PLAYER_LOOKUP if available
      allPro1stYears: [],
      allPro2ndYears: [],
      rookieYear: rookieYear
    };

    console.log('[DbPlayerCard] Bulk generating ratings for', careerStatsData.length, 'years');
    console.log('[DbPlayerCard] Rookie year:', rookieYear, 'Birth year estimate:', birthYear, 'HOF:', achievements.isHOF);

    // Calculate ratings for all years with stats
    var previewData = [];
    var errors = [];

    for (var i = 0; i < careerStatsData.length; i++) {
      var season = careerStatsData[i];
      var year = season.year;

      // Calculate age for this specific year
      var playerAge = birthYear ? ((year + 1) - birthYear) : 25;

      try {
        var result = await window.electronAPI.database.calculateRatingFromStats({
          stats: season,
          position: position,
          year: year,
          targetYear: year + 1, // Ratings apply to next year (Madden approach)
          playerAge: playerAge,
          achievements: achievements
        });
        if (result.success && result.ratings) {
          // Convert PFR team abbreviation to Madden team name
          var maddenTeam = pfrToMaddenTeam(season.team);
          previewData.push({
            year: season.year,
            team: maddenTeam || '-',
            stats: season,
            ratings: result.ratings,
            ovr: result.ratings.POVR || 50,
            breakdown: result.breakdown || '',
            selected: true // Default to selected
          });
        } else {
          errors.push(season.year + ': ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        errors.push(season.year + ': ' + error.message);
      }
    }

    if (previewData.length === 0) {
      alert('Could not generate ratings for any year.\n\nErrors:\n' + errors.join('\n'));
      return;
    }

    // Sort by year
    previewData.sort(function(a, b) { return a.year - b.year; });

    // Store for apply function
    window._bulkRatingPreviewData = previewData;

    // Show preview modal
    showBulkRatingPreviewModal(previewData, errors);
  }

  /**
   * Show the bulk rating preview modal
   */
  function showBulkRatingPreviewModal(previewData, errors) {
    var modal = document.getElementById('bulkRatingPreviewModal');
    var content = document.getElementById('bulkRatingPreviewContent');
    var stats = document.getElementById('bulkRatingPreviewStats');

    if (!modal || !content) {
      console.error('[DbPlayerCard] Bulk rating preview modal not found');
      return;
    }

    // Build preview table
    var html = '<div style="margin-bottom: 16px;">' +
      '<p style="color: #e0e0e0; margin: 0 0 8px 0;"><strong>' + (currentDbPlayer.firstName || '') + ' ' + (currentDbPlayer.lastName || '') + '</strong> - ' + (currentDbPlayer.position || '') + '</p>' +
      '<p style="color: #888; font-size: 12px; margin: 0;">Select which years to apply ratings for:</p>' +
    '</div>';

    html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    html += '<thead><tr style="background: #252535; border-bottom: 2px solid #444;">' +
      '<th style="padding: 8px; text-align: center; width: 30px;"><input type="checkbox" id="bulkSelectAllYears" checked title="Select/Deselect All"></th>' +
      '<th style="padding: 8px; text-align: left;">Year</th>' +
      '<th style="padding: 8px; text-align: left;">Team</th>' +
      '<th style="padding: 8px; text-align: center; color: #4caf50;">OVR</th>' +
      '<th style="padding: 8px; text-align: center;">Key Stats</th>' +
      '</tr></thead><tbody>';

    previewData.forEach(function(item, idx) {
      var keyStats = getKeyStatsDisplay(item.stats, currentDbPlayer.position);

      html += '<tr style="border-bottom: 1px solid #333;">' +
        '<td style="padding: 8px; text-align: center;"><input type="checkbox" class="bulk-year-checkbox" data-index="' + idx + '" checked></td>' +
        '<td style="padding: 8px; color: #64b5f6;">' + item.year + '</td>' +
        '<td style="padding: 8px;">' + item.team + '</td>' +
        '<td style="padding: 8px; text-align: center; font-weight: bold; color: #4caf50;">' + item.ovr + '</td>' +
        '<td style="padding: 8px; font-size: 11px; color: #aaa;">' + keyStats + '</td>' +
      '</tr>';
    });

    html += '</tbody></table>';

    if (errors.length > 0) {
      html += '<div style="margin-top: 16px; padding: 12px; background: rgba(244, 67, 54, 0.1); border: 1px solid rgba(244, 67, 54, 0.3); border-radius: 4px;">' +
        '<p style="color: #f44336; margin: 0 0 8px 0; font-weight: bold;">Warnings:</p>' +
        '<ul style="margin: 0; padding-left: 20px; color: #ff8a80; font-size: 12px;">';
      errors.forEach(function(err) {
        html += '<li>' + err + '</li>';
      });
      html += '</ul></div>';
    }

    content.innerHTML = html;

    // Update stats summary
    var avgOvr = Math.round(previewData.reduce(function(sum, item) { return sum + item.ovr; }, 0) / previewData.length);
    stats.innerHTML = previewData.length + ' years with ratings | Average OVR: ' + avgOvr;

    // Set up select all checkbox
    var selectAllCheckbox = document.getElementById('bulkSelectAllYears');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', function() {
        var checked = this.checked;
        document.querySelectorAll('.bulk-year-checkbox').forEach(function(cb) {
          cb.checked = checked;
        });
      });
    }

    // Show modal
    modal.style.display = 'flex';
  }

  /**
   * Get key stats display for a position
   */
  function getKeyStatsDisplay(stats, position) {
    if (!stats) return '-';

    var parts = [];

    if (position === 'QB') {
      if (stats.pass_att > 0) {
        parts.push(stats.pass_cmp + '/' + stats.pass_att + ' Pass');
        if (stats.pass_yds) parts.push(stats.pass_yds + ' Yds');
        if (stats.pass_td) parts.push(stats.pass_td + ' TD');
        if (stats.pass_int) parts.push(stats.pass_int + ' INT');
      }
    } else if (position === 'HB' || position === 'FB') {
      if (stats.rush_att > 0) {
        parts.push(stats.rush_att + ' Rush');
        if (stats.rush_yds) parts.push(stats.rush_yds + ' Yds');
        if (stats.rush_td) parts.push(stats.rush_td + ' TD');
      }
      if (stats.rec > 0) {
        parts.push(stats.rec + ' Rec');
      }
    } else if (position === 'WR' || position === 'TE') {
      if (stats.rec > 0) {
        parts.push(stats.rec + ' Rec');
        if (stats.rec_yds) parts.push(stats.rec_yds + ' Yds');
        if (stats.rec_td) parts.push(stats.rec_td + ' TD');
      }
    } else if (['LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'].indexOf(position) !== -1) {
      // Defensive positions
      if (stats.tackles > 0) parts.push(stats.tackles + ' Tkl');
      if (stats.sacks > 0) parts.push(stats.sacks + ' Sck');
      if (stats.def_int > 0) parts.push(stats.def_int + ' INT');
      if (stats.ff > 0) parts.push(stats.ff + ' FF');
    } else if (['LT', 'LG', 'C', 'RG', 'RT'].indexOf(position) !== -1) {
      parts.push('OL Stats');
    }

    return parts.length > 0 ? parts.join(', ') : '-';
  }

  /**
   * Apply bulk ratings from preview
   */
  async function applyBulkRatings() {
    var previewData = window._bulkRatingPreviewData;
    if (!previewData || previewData.length === 0) {
      alert('No ratings data to apply');
      return;
    }

    // Get selected years
    var selectedYears = [];
    document.querySelectorAll('.bulk-year-checkbox:checked').forEach(function(cb) {
      var idx = parseInt(cb.dataset.index, 10);
      if (!isNaN(idx) && previewData[idx]) {
        selectedYears.push(previewData[idx]);
      }
    });

    if (selectedYears.length === 0) {
      alert('Please select at least one year to apply ratings');
      return;
    }

    console.log('[DbPlayerCard] Applying bulk ratings for', selectedYears.length, 'years');

    var applied = 0;
    var errors = [];

    for (var i = 0; i < selectedYears.length; i++) {
      var item = selectedYears[i];
      try {
        // Use the team from career stats (already mapped to Madden format via pfrToMaddenTeam)
        // This ensures correct team is always used from PFR data
        var teamToUse = item.team || '';

        // Build season data with ratings
        var seasonData = {
          team: teamToUse,
          position: currentDbPlayer.position,
          ratings: item.ratings
        };

        // Save to database
        var result;
        if (isCustomPlayer) {
          result = await window.electronAPI.database.saveCustomPlayerSeason(currentDbPlayerId, item.year, seasonData);
        } else {
          result = await window.electronAPI.database.saveSeasonEdit(currentDbPlayerId, item.year, seasonData);
        }

        if (result.success) {
          applied++;
        } else {
          errors.push(item.year + ': ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        errors.push(item.year + ': ' + error.message);
      }
    }

    // Close modal
    var modal = document.getElementById('bulkRatingPreviewModal');
    if (modal) modal.style.display = 'none';

    // Cleanup
    window._bulkRatingPreviewData = null;

    // Refresh the year selector and ratings table
    await setupYearSelector(currentDbPlayer);
    await renderRatingsAllYears();

    // Show result using toast instead of alert (alert breaks focus on Windows)
    var message = 'Applied ratings to ' + applied + ' of ' + selectedYears.length + ' years.';
    if (errors.length > 0) {
      message += ' (' + errors.length + ' errors)';
      console.error('[DbPlayerCard] Bulk rating errors:', errors);
    }
    if (typeof window.showToast === 'function') {
      window.showToast(message, errors.length > 0 ? 'warning' : 'success');
    } else {
      console.log('[DbPlayerCard] ' + message);
    }

    hasUnsavedChanges = true;
    updateSaveButtonState();

    // Switch to ratings tab to see results
    var ratingsTab = document.querySelector('.db-player-tab[data-tab="ratings"]');
    if (ratingsTab) ratingsTab.click();

    // Force focus on first input in table after a delay
    setTimeout(function() {
      var firstInput = document.querySelector('#ratingsAllYearsTable input');
      if (firstInput) {
        firstInput.focus();
        firstInput.click();
        console.log('[DbPlayerCard] Forced focus on first input');
      }
    }, 200);
  }

  /**
   * Close the bulk rating preview modal
   */
  function closeBulkRatingPreviewModal() {
    var modal = document.getElementById('bulkRatingPreviewModal');
    if (modal) modal.style.display = 'none';
    window._bulkRatingPreviewData = null;
  }

  // Make functions available globally
  window.openDbPlayerCard = openDbPlayerCard;
  window.closeDbPlayerCard = closeDbPlayerCard;
  window.createNewDbPlayer = createNewDbPlayer;
  window.initDatabasePlayerCard = initDatabasePlayerCard;
  window.openPortraitPicker = openPortraitPicker;
  window.loadPlayerPortrait = loadPlayerPortrait;
  window.loadPlayerTraits = loadPlayerTraits;
  window.renderTraitsForPosition = renderTraitsForPosition;
  window.loadCareerStats = loadCareerStats;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDatabasePlayerCard);
  } else {
    initDatabasePlayerCard();
  }

})();
