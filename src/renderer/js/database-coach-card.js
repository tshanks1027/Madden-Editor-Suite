/**
 * Database Coach Card Module
 *
 * Provides functionality to view, edit, and manage coaches in the user database.
 * Supports editing original database coaches (overlay) and custom coaches.
 */

(function() {
  'use strict';

  // Module state
  let currentDbCoach = null;
  let currentDbCoachId = null;
  let isCustomCoach = false;
  let isCreateMode = false;
  let hasUnsavedChanges = false;
  let selectedYear = null;
  let coachPortraitOptions = [];

  /**
   * Initialize the database coach card module
   */
  async function initDatabaseCoachCard() {
    console.log('[DatabaseCoachCard] Initializing...');

    // Set up event listeners
    setupEventListeners();

    // Load dropdown options
    await loadTeamDropdown();
    await loadHeadAssetDropdown();

    console.log('[DatabaseCoachCard] Initialized');
  }

  /**
   * Load head asset dropdown options from coachAppearance.json
   */
  async function loadHeadAssetDropdown() {
    try {
      const headAssetSelect = document.getElementById('dbCoachHeadAsset');
      if (!headAssetSelect || !window.electronAPI?.coachDatabase) return;

      const result = await window.electronAPI.coachDatabase.getHeadAssetOptions();
      if (!result.success || !result.data) {
        console.warn('[DatabaseCoachCard] Failed to load head asset options');
        return;
      }

      // Group options by category
      const namedOptions = result.data.filter(o => o.category === 'Named');
      const genericOptions = result.data.filter(o => o.category === 'Generic');
      const otherOptions = result.data.filter(o => o.category !== 'Named' && o.category !== 'Generic');

      // Clear and rebuild
      headAssetSelect.innerHTML = '<option value="">Select Head Model...</option>';

      // Add named coaches
      if (namedOptions.length > 0) {
        const namedGroup = document.createElement('optgroup');
        namedGroup.label = 'Named Coaches';
        namedOptions.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.name;
          option.textContent = opt.name + ' (' + opt.id + ')';
          namedGroup.appendChild(option);
        });
        headAssetSelect.appendChild(namedGroup);
      }

      // Add generic heads
      if (genericOptions.length > 0) {
        const genericGroup = document.createElement('optgroup');
        genericGroup.label = 'Generic Heads';
        genericOptions.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.name;
          option.textContent = opt.name + ' (' + opt.id + ')';
          genericGroup.appendChild(option);
        });
        headAssetSelect.appendChild(genericGroup);
      }

      // Add other options
      if (otherOptions.length > 0) {
        const otherGroup = document.createElement('optgroup');
        otherGroup.label = 'Other';
        otherOptions.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.name;
          option.textContent = opt.name + ' (' + opt.id + ')';
          otherGroup.appendChild(option);
        });
        headAssetSelect.appendChild(otherGroup);
      }

      console.log('[DatabaseCoachCard] Loaded', result.data.length, 'head asset options');
    } catch (e) {
      console.error('[DatabaseCoachCard] Failed to load head asset options:', e);
    }
  }

  /**
   * Set up event listeners for the modal
   */
  function setupEventListeners() {
    // Close button
    var closeBtn = document.getElementById('closeDbCoachCard');
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeDbCoachCard();
      });
    }

    // Modal background click
    var modal = document.getElementById('dbCoachCardModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        e.stopPropagation();
        if (e.target === modal) {
          closeDbCoachCard();
        }
      });
    }

    // Tab switching
    document.querySelectorAll('.db-coach-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var tabId = tab.dataset.tab;

        // Update active tab button
        document.querySelectorAll('.db-coach-tab').forEach(function(t) {
          t.classList.remove('active');
        });
        tab.classList.add('active');

        // Update active tab content
        document.querySelectorAll('.db-coach-tab-content').forEach(function(content) {
          content.classList.remove('active');
        });

        // Map tab IDs to content IDs
        var tabContentMap = {
          'info': 'dbCoachTabInfo',
          'traits': 'dbCoachTabTraits',
          'seasons': 'dbCoachTabSeasons'
        };
        var tabContentId = tabContentMap[tabId];
        if (tabContentId) {
          var tabContent = document.getElementById(tabContentId);
          if (tabContent) {
            tabContent.classList.add('active');
          }
        }
      });
    });

    // Save button
    var saveBtn = document.getElementById('dbCoachSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveDbCoachChanges);
    }

    // Cancel button
    var cancelBtn = document.getElementById('dbCoachCancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeDbCoachCard);
    }

    // Reset button
    var resetBtn = document.getElementById('dbCoachResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetDbCoach);
    }

    // Hide button
    var hideBtn = document.getElementById('dbCoachHideBtn');
    if (hideBtn) {
      hideBtn.addEventListener('click', hideDbCoach);
    }

    // Delete button (only for custom coaches)
    var deleteBtn = document.getElementById('dbCoachDeleteBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', deleteDbCoach);
    }

    // Load from Retro Data button
    var loadRetroBtn = document.getElementById('dbCoachLoadRetroBtn');
    if (loadRetroBtn) {
      loadRetroBtn.addEventListener('click', loadFromRetroData);
    }

    // Year selector change
    var yearSelect = document.getElementById('dbCoachSeasonYear');
    if (yearSelect) {
      yearSelect.addEventListener('change', loadSeasonData);
    }

    // Save Year button
    var saveYearBtn = document.getElementById('dbCoachSaveYearBtn');
    if (saveYearBtn) {
      saveYearBtn.addEventListener('click', saveCurrentYearData);
    }

    // Career From/To change - update year selector
    var careerFromInput = document.getElementById('dbCoachCareerFrom');
    var careerToInput = document.getElementById('dbCoachCareerTo');
    if (careerFromInput) {
      careerFromInput.addEventListener('change', setupYearSelector);
    }
    if (careerToInput) {
      careerToInput.addEventListener('change', setupYearSelector);
    }
  }

  /**
   * Load career data from historical retro files
   */
  async function loadFromRetroData() {
    const firstName = getValue('dbCoachFirstName');
    const lastName = getValue('dbCoachLastName');

    if (!firstName || !lastName) {
      alert('Please enter coach name first (First Name and Last Name)');
      return;
    }

    console.log('[DatabaseCoachCard] Loading retro data for', firstName, lastName);

    try {
      // Get available retro years
      const yearsResult = await window.electronAPI.coachDatabase.getAvailableRetroYears();
      if (!yearsResult.success || !yearsResult.years || yearsResult.years.length === 0) {
        alert('No retro coach data files available');
        return;
      }

      // Search through all years for this coach
      let foundSeasons = [];
      const nameLower = (firstName + ' ' + lastName).toLowerCase();
      const lastNameLower = lastName.toLowerCase();

      for (const year of yearsResult.years) {
        const dataResult = await window.electronAPI.coachDatabase.getRetroCoachData(year);
        if (!dataResult.success || !dataResult.data || !dataResult.data.teams) continue;

        for (const team of dataResult.data.teams) {
          // Check HC, OC, DC for this coach
          const positions = [
            { data: team.headCoach, pos: 'HC', posName: 'Head Coach' },
            { data: team.offensiveCoordinator, pos: 'OC', posName: 'Offensive Coordinator' },
            { data: team.defensiveCoordinator, pos: 'DC', posName: 'Defensive Coordinator' }
          ];

          for (const { data, pos, posName } of positions) {
            if (!data || !data.lastName) continue;

            const coachName = ((data.firstName || '') + ' ' + data.lastName).toLowerCase();
            if (coachName.includes(lastNameLower) ||
                data.lastName.toLowerCase() === lastNameLower) {
              foundSeasons.push({
                year: year,
                team: team.teamAbbr,
                position: pos,
                positionFull: posName,
                wins: data.careerWins || 0,
                losses: data.careerLosses || 0,
                ties: data.careerTies || 0,
                playoffWins: data.playoffWins || 0,
                superBowlWins: data.superBowlWins || 0,
                yearsAsHC: data.yearsAsHC || 0
              });
            }
          }
        }
      }

      if (foundSeasons.length === 0) {
        alert('No historical data found for ' + firstName + ' ' + lastName + ' in retro files (1966-2024)');
        return;
      }

      // Sort by year
      foundSeasons.sort((a, b) => a.year - b.year);

      // Show summary and offer to populate
      if (!confirm('Found ' + foundSeasons.length + ' seasons for ' + firstName + ' ' + lastName + ':\\n\\n' +
                   (foundSeasons.length > 10 ? foundSeasons.slice(0, 10).map(s => s.year + ': ' + s.team + ' ' + s.position).join('\\n') + '\\n...' :
                    foundSeasons.map(s => s.year + ': ' + s.team + ' ' + s.position).join('\\n')) +
                   '\\n\\nPopulate career stats from most recent data?')) {
        return;
      }

      // Get most recent season data (has cumulative career stats)
      const latestSeason = foundSeasons[foundSeasons.length - 1];

      // Calculate years coaching
      setValue('dbCoachYearsCoaching', foundSeasons.length);

      // Set career stats from most recent data
      setValue('dbCoachCareerWins', latestSeason.wins || 0);
      setValue('dbCoachCareerLosses', latestSeason.losses || 0);
      setValue('dbCoachCareerTies', latestSeason.ties || 0);
      setValue('dbCoachCareerPlayoffWins', latestSeason.playoffWins || 0);
      setValue('dbCoachCareerSBWins', latestSeason.superBowlWins || 0);

      // Calculate winning seasons (seasons where wins > losses)
      let winningSeasons = 0;
      // Note: We'd need per-season win/loss data to calculate this accurately
      // For now, estimate based on career win percentage
      if (latestSeason.wins > 0) {
        const totalGames = (latestSeason.wins || 0) + (latestSeason.losses || 0);
        if (totalGames > 0) {
          const yearsAsHC = latestSeason.yearsAsHC || foundSeasons.filter(s => s.position === 'HC').length;
          const avgWinPct = latestSeason.wins / totalGames;
          winningSeasons = Math.round(yearsAsHC * Math.min(avgWinPct * 1.5, 1));
        }
      }
      setValue('dbCoachCareerWinningSeasons', winningSeasons);

      // Playoffs made approximation based on playoff wins
      const playoffsMade = Math.max(latestSeason.playoffWins || 0, latestSeason.superBowlWins || 0);
      setValue('dbCoachCareerPlayoffsMade', playoffsMade > 0 ? Math.ceil(playoffsMade / 2) + playoffsMade : 0);

      hasUnsavedChanges = true;
      console.log('[DatabaseCoachCard] Loaded retro data:', foundSeasons.length, 'seasons');

    } catch (error) {
      console.error('[DatabaseCoachCard] Error loading retro data:', error);
      alert('Error loading retro data: ' + error.message);
    }
  }

  /**
   * Load team dropdown options
   */
  async function loadTeamDropdown() {
    try {
      const teamSelect = document.getElementById('dbCoachTeam');
      if (!teamSelect || !window.electronAPI?.lookup) return;

      const teams = await window.electronAPI.lookup.getDropdownOptions('team_lookup.csv');
      if (teams && teams.length > 0) {
        teams.forEach(team => {
          const opt = document.createElement('option');
          opt.value = team.id;
          opt.textContent = team.label || team.name;
          teamSelect.appendChild(opt);
        });
      }
    } catch (e) {
      console.error('[DatabaseCoachCard] Failed to load teams:', e);
    }
  }

  /**
   * Open coach card for viewing/editing
   */
  async function openDbCoachCard(coachId, isCustom) {
    console.log('[DatabaseCoachCard] Opening coach card:', coachId, 'isCustom:', isCustom);

    currentDbCoachId = coachId;
    isCustomCoach = isCustom;
    isCreateMode = false;
    hasUnsavedChanges = false;

    // Show modal
    const modal = document.getElementById('dbCoachCardModal');
    if (modal) {
      modal.style.display = 'flex';
    }

    // Show/hide delete button based on custom status
    const deleteBtn = document.getElementById('dbCoachDeleteBtn');
    if (deleteBtn) {
      deleteBtn.style.display = isCustom ? 'inline-block' : 'none';
    }

    // Load coach data
    try {
      if (isCustom) {
        const result = await window.electronAPI.coachDatabase.getCustomCoach(coachId);
        if (result.success && result.data) {
          currentDbCoach = result.data;
          populateCoachForm(currentDbCoach);
        } else {
          alert('Failed to load custom coach');
          closeDbCoachCard();
        }
      } else {
        const result = await window.electronAPI.coachDatabase.getMergedCoach(coachId);
        if (result.success && result.coach) {
          currentDbCoach = result.coach;
          populateCoachForm(currentDbCoach);
        } else {
          alert('Failed to load coach: ' + (result.error || 'Unknown error'));
          closeDbCoachCard();
        }
      }

      // Load portrait options
      await loadCoachPortraitOptions();

      // Setup year selector for seasons
      setupYearSelector();

    } catch (error) {
      console.error('[DatabaseCoachCard] Error opening coach card:', error);
      alert('Error opening coach card: ' + error.message);
      closeDbCoachCard();
    }
  }

  /**
   * Create new custom coach
   */
  function createNewDbCoach() {
    console.log('[DatabaseCoachCard] Creating new custom coach');

    currentDbCoachId = null;
    currentDbCoach = {
      firstName: '',
      lastName: '',
      position: 'HC',
      teamIndex: null,
      experience: 0,
      age: 45,
      careerFrom: new Date().getFullYear(),
      careerTo: new Date().getFullYear(),
      maddenPid: null,
      maddenPam: ''
    };
    isCustomCoach = true;
    isCreateMode = true;
    hasUnsavedChanges = false;

    // Show modal
    const modal = document.getElementById('dbCoachCardModal');
    if (modal) {
      modal.style.display = 'flex';
    }

    // Show delete button (hidden for new coach)
    const deleteBtn = document.getElementById('dbCoachDeleteBtn');
    if (deleteBtn) {
      deleteBtn.style.display = 'none';
    }

    // Populate form with defaults
    populateCoachForm(currentDbCoach);

    // Update header
    const nameEl = document.getElementById('dbCoachCardName');
    if (nameEl) nameEl.textContent = 'New Coach';

    // Load portrait options
    loadCoachPortraitOptions();
  }

  /**
   * Populate the form with coach data
   */
  function populateCoachForm(coach) {
    // Header
    const nameEl = document.getElementById('dbCoachCardName');
    if (nameEl) {
      nameEl.textContent = coach.firstName && coach.lastName
        ? `${coach.firstName} ${coach.lastName}`
        : coach.displayName || 'Coach';
    }

    // Edited indicator
    const editedIndicator = document.getElementById('dbCoachEditedIndicator');
    if (editedIndicator) {
      editedIndicator.style.display = coach.hasEdits ? 'inline-block' : 'none';
    }

    // Coach Info tab - Basic info
    setValue('dbCoachFirstName', coach.firstName || '');
    setValue('dbCoachLastName', coach.lastName || '');
    setValue('dbCoachAge', coach.age || '');
    setValue('dbCoachLevel', coach.level || '');
    setValue('dbCoachYearsCoaching', coach.yearsCoaching || coach.experience || '');
    setValue('dbCoachYearsWithTeam', coach.yearsWithTeam || '');
    setValue('dbCoachPositionWhenFired', coach.positionWhenFired || '');
    setValue('dbCoachLegacyScore', coach.legacyScore || '');
    setValue('dbCoachCareerFrom', coach.careerFrom || '');
    setValue('dbCoachCareerTo', coach.careerTo || '');

    // Coach Info tab - Portrait/Asset
    setValue('dbCoachPid', coach.maddenPid !== undefined ? coach.maddenPid : (coach.pid || ''));
    setValue('dbCoachPam', coach.maddenPam || coach.pam || '');

    // Coach Traits tab
    setValue('dbCoachTradingTendency', coach.tradingTendency || '');
    setValue('dbCoachTeamBuilding', coach.teamBuilding || '');
    setValue('dbCoachSpecialty', coach.specialty || '');
    setValue('dbCoachOffPlaybook', coach.offPlaybook || '');
    setValue('dbCoachDefPlaybook', coach.defPlaybook || '');
    setValue('dbCoachOffScheme', coach.offScheme || '');
    setValue('dbCoachDefScheme', coach.defScheme || '');
    setValue('dbCoachIsCreated', coach.isCreated ? 'true' : 'false');

    // Career Stats tab
    setValue('dbCoachCareerWins', coach.careerWins || '');
    setValue('dbCoachCareerLosses', coach.careerLosses || '');
    setValue('dbCoachCareerTies', coach.careerTies || '');
    setValue('dbCoachCareerWinningSeasons', coach.careerWinningSeasons || '');
    setValue('dbCoachCareerPlayoffWins', coach.careerPlayoffWins || '');
    setValue('dbCoachCareerPlayoffLosses', coach.careerPlayoffLosses || '');
    setValue('dbCoachCareerSBWins', coach.careerSBWins || '');
    setValue('dbCoachCareerSBLosses', coach.careerSBLosses || '');
    setValue('dbCoachCareerPlayoffsMade', coach.careerPlayoffsMade || '');

    // Load portrait
    loadCoachPortrait(coach.maddenPid || coach.pid);

    // Reset to first tab
    document.querySelectorAll('.db-coach-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.db-coach-tab-content').forEach(c => c.classList.remove('active'));
    const firstTab = document.querySelector('.db-coach-tab[data-tab="info"]');
    const firstContent = document.getElementById('dbCoachTabInfo');
    if (firstTab) firstTab.classList.add('active');
    if (firstContent) firstContent.classList.add('active');
  }

  // Placeholder SVG for missing portraits (coach silhouette)
  const COACH_PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <rect width="128" height="128" fill="#2a2a2a"/>
      <circle cx="64" cy="40" r="24" fill="#444"/>
      <ellipse cx="64" cy="100" rx="36" ry="28" fill="#444"/>
      <text x="64" y="120" text-anchor="middle" fill="#666" font-size="10" font-family="sans-serif">No Portrait</text>
    </svg>
  `)}`;

  /**
   * Load coach portrait
   */
  async function loadCoachPortrait(pid) {
    const portraitEl = document.getElementById('dbCoachCardPortrait');
    if (!portraitEl) return;

    try {
      // Check for custom coach portrait first (PID >= 50000)
      if (pid && pid >= 50000 && window.electronAPI?.customCoachPortrait) {
        const hasCustom = await window.electronAPI.customCoachPortrait.has(pid);
        if (hasCustom) {
          const imageData = await window.electronAPI.customCoachPortrait.get(pid);
          if (imageData) {
            portraitEl.src = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
            return;
          }
        }
      }

      // Check bundled coach portraits
      if (pid && window.electronAPI?.coachPortrait) {
        const hasPortrait = await window.electronAPI.coachPortrait.hasPortrait(pid);
        if (hasPortrait) {
          const imageData = await window.electronAPI.coachPortrait.getImageDataByPID(pid);
          if (imageData) {
            portraitEl.src = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
            return;
          }
        }
      }
      // Fallback to placeholder
      portraitEl.src = COACH_PLACEHOLDER_SVG;
    } catch (error) {
      console.error('[DatabaseCoachCard] Error loading portrait:', error);
      portraitEl.src = COACH_PLACEHOLDER_SVG;
    }
  }

  // Expose loadCoachPortrait globally for portrait manager integration
  window.loadCoachPortrait = loadCoachPortrait;

  /**
   * Load coach portrait options for picker
   * Order: Real coaches with portraits -> PAM-only coaches -> Generics
   * Hide: Owners (PID only, no PAM)
   */
  async function loadCoachPortraitOptions() {
    const grid = document.getElementById('dbCoachPortraitGrid');
    if (!grid) return;

    try {
      const coaches = await window.electronAPI.coachDatabase.getAllCoaches();
      if (!coaches.success || !coaches.data) {
        grid.innerHTML = '<div style="color:#888;">No portraits available</div>';
        return;
      }

      // Categorize coaches:
      // 1. Real coaches with PID + PAM (has portrait)
      // 2. PAM-only coaches (no PID yet - need to add later)
      // 3. Hide owners (PID only, no PAM)
      const realCoachesWithPortrait = [];
      const pamOnlyCoaches = [];

      for (const coach of coaches.data) {
        const hasPam = coach.pam && coach.pam.trim() !== '';
        const hasPid = coach.pid !== undefined && coach.pid !== null && coach.pid !== '';

        if (hasPam && hasPid) {
          // Real coach with both - check if portrait exists
          if (window.electronAPI?.coachPortrait) {
            const hasPortrait = await window.electronAPI.coachPortrait.hasPortrait(coach.pid);
            if (hasPortrait) {
              realCoachesWithPortrait.push(coach);
            }
          }
        } else if (hasPam && !hasPid) {
          // PAM-only coach - needs PID assigned
          pamOnlyCoaches.push(coach);
        }
        // Owners (hasPid && !hasPam) are hidden
      }

      // Sort by name
      realCoachesWithPortrait.sort((a, b) => {
        const nameA = (a.lastName || '') + (a.firstName || '');
        const nameB = (b.lastName || '') + (b.firstName || '');
        return nameA.localeCompare(nameB);
      });
      pamOnlyCoaches.sort((a, b) => {
        const nameA = (a.lastName || '') + (a.firstName || '');
        const nameB = (b.lastName || '') + (b.firstName || '');
        return nameA.localeCompare(nameB);
      });

      // Store for later use
      coachPortraitOptions = [...realCoachesWithPortrait, ...pamOnlyCoaches];

      let html = '';

      // Section 1: Real coaches with portraits
      if (realCoachesWithPortrait.length > 0) {
        html += '<div class="portrait-section-header">Real Coaches</div>';
        for (const coach of realCoachesWithPortrait) {
          const pam = coach.pam || '';
          const displayName = coach.displayName || (coach.firstName + ' ' + coach.lastName);
          html += `
            <div class="coach-portrait-option" data-pid="${coach.pid}" data-pam="${pam}"
                 onclick="window.selectCoachPortrait(${coach.pid}, '${pam}')"
                 title="${displayName}">
              <img src="${COACH_PLACEHOLDER_SVG}" data-coach-pid="${coach.pid}" alt="${displayName}">
              <div class="portrait-name">${coach.lastName || ''}</div>
            </div>
          `;
        }
      }

      // Section 2: PAM-only coaches (need PID assigned)
      if (pamOnlyCoaches.length > 0) {
        html += '<div class="portrait-section-header" style="margin-top:12px;">PAM Only (Need PID)</div>';
        for (const coach of pamOnlyCoaches) {
          const pam = coach.pam || '';
          const displayName = coach.displayName || (coach.firstName + ' ' + coach.lastName);
          // Use a special "no-pid" class for styling
          html += `
            <div class="coach-portrait-option pam-only" data-pam="${pam}"
                 onclick="window.selectCoachPamOnly('${pam}', '${displayName}')"
                 title="${displayName} (PAM: ${pam})">
              <div class="pam-only-placeholder">
                <span class="pam-initials">${(coach.firstName || '').charAt(0)}${(coach.lastName || '').charAt(0)}</span>
              </div>
              <div class="portrait-name">${coach.lastName || ''}</div>
            </div>
          `;
        }
      }

      // Section 3: Generic portraits (all together, sorted by PID)
      try {
        const genericsResult = await window.electronAPI.coachDatabase.getGenericPortraits();
        if (genericsResult.success && genericsResult.data) {
          // Collect all generics from all race categories
          const allGenerics = [];
          for (const [race, portraits] of Object.entries(genericsResult.data)) {
            if (portraits && portraits.length > 0) {
              for (const portrait of portraits) {
                const pid = portrait.pid || portrait.PID;
                if (pid) {
                  allGenerics.push({ pid, race });
                }
              }
            }
          }

          // Sort by PID
          allGenerics.sort((a, b) => a.pid - b.pid);

          if (allGenerics.length > 0) {
            html += `<div class="portrait-section-header generic-race" style="margin-top:12px;">Generic Coaches (${allGenerics.length})</div>`;
            for (const { pid, race } of allGenerics) {
              html += `
                <div class="coach-portrait-option generic-portrait" data-pid="${pid}"
                     onclick="window.selectCoachPortrait(${pid}, '')"
                     title="Generic (PID: ${pid})">
                  <img src="${COACH_PLACEHOLDER_SVG}" data-generic-pid="${pid}" alt="Generic">
                  <div class="portrait-name">${pid}</div>
                </div>
              `;
            }
          }
        }
      } catch (genErr) {
        console.warn('[DatabaseCoachCard] Error loading generic portraits:', genErr);
      }

      grid.innerHTML = html || '<div style="color:#888;">No portraits available</div>';

      // Load portrait images asynchronously for real coaches
      for (const coach of realCoachesWithPortrait) {
        const img = grid.querySelector(`img[data-coach-pid="${coach.pid}"]`);
        if (img && window.electronAPI?.coachPortrait) {
          window.electronAPI.coachPortrait.getImageDataByPID(coach.pid).then(imageData => {
            if (imageData) {
              img.src = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
            }
          }).catch(e => console.warn('Failed to load coach portrait:', coach.pid));
        }
      }

      // Load generic portrait images asynchronously
      const genericImgs = grid.querySelectorAll('img[data-generic-pid]');
      for (const img of genericImgs) {
        const pid = parseInt(img.dataset.genericPid);
        if (pid && window.electronAPI?.coachPortrait) {
          window.electronAPI.coachPortrait.getImageDataByPID(pid).then(imageData => {
            if (imageData) {
              img.src = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
            }
          }).catch(e => console.warn('Failed to load generic portrait:', pid));
        }
      }

      console.log('[DatabaseCoachCard] Loaded', realCoachesWithPortrait.length, 'real coaches,', pamOnlyCoaches.length, 'PAM-only coaches,', genericImgs.length, 'generics');
    } catch (error) {
      console.error('[DatabaseCoachCard] Error loading portrait options:', error);
      grid.innerHTML = '<div style="color:#888;">Error loading portraits</div>';
    }
  }

  /**
   * Select a PAM-only coach (no portrait PID yet)
   */
  window.selectCoachPamOnly = function(pam, displayName) {
    // Set just the PAM, leave PID empty for user to fill in
    setValue('dbCoachPam', pam);

    // Clear PID or prompt user
    var currentPid = getValue('dbCoachPid');
    if (!currentPid || currentPid === '') {
      // Optionally prompt user to enter PID
      console.log('[DatabaseCoachCard] Selected PAM-only coach:', displayName, 'PAM:', pam);
    }

    // Highlight selected
    document.querySelectorAll('.coach-portrait-option').forEach(function(opt) {
      opt.classList.remove('selected');
      if (opt.dataset.pam === pam && opt.classList.contains('pam-only')) {
        opt.classList.add('selected');
      }
    });

    hasUnsavedChanges = true;
    console.log('[DatabaseCoachCard] Set PAM to:', pam, '(PID needs to be assigned)');
  };

  /**
   * Select a coach portrait from the picker
   */
  window.selectCoachPortrait = function(pid, pam) {
    // Check if "Model Only" checkbox is checked
    var modelOnlyCheckbox = document.getElementById('coachModelOnlyCheckbox');
    var modelOnly = modelOnlyCheckbox && modelOnlyCheckbox.checked;

    // If PAM is empty, try to derive from coach data or use generic
    var pamValue = pam;
    if (!pamValue || pamValue.trim() === '') {
      // Look up the coach from our cached options to get their name for PAM derivation
      var coachOption = coachPortraitOptions.find(function(c) { return c.pid === pid; });
      if (coachOption && coachOption.lastName && coachOption.firstName) {
        // Generate PAM from name: LastNameFirstName_C_PRO
        pamValue = coachOption.lastName + coachOption.firstName + '_C_PRO';
        console.log('[DatabaseCoachCard] Generated PAM from name:', pamValue);
      } else {
        // Use generic coach PAM
        pamValue = '_C_PRO';
        console.log('[DatabaseCoachCard] Using generic PAM: _C_PRO');
      }
    }

    if (modelOnly) {
      console.log('[DatabaseCoachCard] Model Only mode - setting PAM without changing PID');
      // Only update PAM, keep current PID
      setValue('dbCoachPam', pamValue);
      // Don't update portrait or PID
    } else {
      // Update both PID and PAM
      setValue('dbCoachPid', pid);
      setValue('dbCoachPam', pamValue);

      // Update portrait preview with the new PID
      loadCoachPortrait(pid);
    }

    // Highlight selected
    document.querySelectorAll('.coach-portrait-option').forEach(opt => {
      opt.classList.remove('selected');
      if (opt.dataset.pid == pid) {
        opt.classList.add('selected');
      }
    });

    hasUnsavedChanges = true;

    if (modelOnly) {
      console.log('[DatabaseCoachCard] Set PAM to:', pamValue, '(PID unchanged)');
    } else {
      console.log('[DatabaseCoachCard] Set PID to:', pid, ', PAM to:', pamValue);
    }
  };

  /**
   * Setup year selector for seasons tab
   */
  function setupYearSelector() {
    const yearSelect = document.getElementById('dbCoachSeasonYear');
    if (!yearSelect) return;

    yearSelect.innerHTML = '';

    const careerFrom = parseInt(getValue('dbCoachCareerFrom')) || new Date().getFullYear();
    const careerTo = parseInt(getValue('dbCoachCareerTo')) || new Date().getFullYear();

    for (let year = careerFrom; year <= careerTo; year++) {
      const opt = document.createElement('option');
      opt.value = year;
      opt.textContent = year;
      yearSelect.appendChild(opt);
    }

    if (yearSelect.options.length > 0) {
      selectedYear = parseInt(yearSelect.value);
      loadSeasonData();
    }
  }

  /**
   * Load season data for selected year
   */
  async function loadSeasonData() {
    const yearSelect = document.getElementById('dbCoachSeasonYear');
    if (!yearSelect) return;

    selectedYear = parseInt(yearSelect.value);
    if (!selectedYear) return;

    try {
      if (isCustomCoach && currentDbCoachId) {
        const result = await window.electronAPI.coachDatabase.getCustomCoachSeason(currentDbCoachId, selectedYear);
        if (result.success && result.data) {
          populateSeasonForm(result.data);
        } else {
          clearSeasonForm();
        }
      } else if (currentDbCoachId) {
        const result = await window.electronAPI.coachDatabase.getMergedCoachSeason(currentDbCoachId, selectedYear);
        if (result.success && result.season) {
          populateSeasonForm(result.season);
        } else {
          clearSeasonForm();
        }
      }
    } catch (error) {
      console.error('[DatabaseCoachCard] Error loading season data:', error);
      clearSeasonForm();
    }
  }

  /**
   * Populate season form
   */
  function populateSeasonForm(season) {
    setValue('dbCoachSeasonTeam', season.team || '');
    setValue('dbCoachSeasonPosition', season.position || '');
    setValue('dbCoachSeasonWins', season.wins || '');
    setValue('dbCoachSeasonLosses', season.losses || '');
    setValue('dbCoachSeasonTies', season.ties || '');
    setValue('dbCoachSeasonPlayoffWins', season.playoffWins || '');
    setValue('dbCoachSeasonSBWin', season.superBowlWins ? '1' : '0');
  }

  /**
   * Clear season form
   */
  function clearSeasonForm() {
    setValue('dbCoachSeasonTeam', '');
    setValue('dbCoachSeasonPosition', '');
    setValue('dbCoachSeasonWins', '');
    setValue('dbCoachSeasonLosses', '');
    setValue('dbCoachSeasonTies', '');
    setValue('dbCoachSeasonPlayoffWins', '');
    setValue('dbCoachSeasonSBWin', '0');
  }

  /**
   * Save current year's season data
   */
  async function saveCurrentYearData() {
    if (!selectedYear) {
      console.warn('[DatabaseCoachCard] No year selected');
      return;
    }

    const seasonData = {
      year: selectedYear,
      team: getValue('dbCoachSeasonTeam') || null,
      position: getValue('dbCoachSeasonPosition') || null,
      wins: getValue('dbCoachSeasonWins') ? parseInt(getValue('dbCoachSeasonWins')) : null,
      losses: getValue('dbCoachSeasonLosses') ? parseInt(getValue('dbCoachSeasonLosses')) : null,
      ties: getValue('dbCoachSeasonTies') ? parseInt(getValue('dbCoachSeasonTies')) : null,
      playoffWins: getValue('dbCoachSeasonPlayoffWins') ? parseInt(getValue('dbCoachSeasonPlayoffWins')) : null,
      superBowlWins: getValue('dbCoachSeasonSBWin') === '1' ? 1 : 0
    };

    try {
      if (isCustomCoach && currentDbCoachId) {
        await window.electronAPI.coachDatabase.saveCustomCoachSeason(currentDbCoachId, selectedYear, seasonData);
        console.log('[DatabaseCoachCard] Saved custom coach season for year', selectedYear);
      } else if (currentDbCoachId) {
        await window.electronAPI.coachDatabase.saveSeasonEdit(currentDbCoachId, selectedYear, seasonData);
        console.log('[DatabaseCoachCard] Saved coach season edit for year', selectedYear);
      }
      alert(`Season ${selectedYear} saved!`);
    } catch (error) {
      console.error('[DatabaseCoachCard] Error saving season:', error);
      alert('Failed to save season: ' + error.message);
    }
  }

  /**
   * Save coach changes
   */
  async function saveDbCoachChanges() {
    console.log('[DatabaseCoachCard] Saving changes...');

    try {
      // Collect Coach Info data
      const coachData = {
        firstName: getValue('dbCoachFirstName'),
        lastName: getValue('dbCoachLastName'),
        age: getValue('dbCoachAge') ? parseInt(getValue('dbCoachAge')) : null,
        level: getValue('dbCoachLevel') ? parseInt(getValue('dbCoachLevel')) : null,
        yearsCoaching: getValue('dbCoachYearsCoaching') ? parseInt(getValue('dbCoachYearsCoaching')) : null,
        yearsWithTeam: getValue('dbCoachYearsWithTeam') ? parseInt(getValue('dbCoachYearsWithTeam')) : null,
        positionWhenFired: getValue('dbCoachPositionWhenFired') || null,
        legacyScore: getValue('dbCoachLegacyScore') ? parseInt(getValue('dbCoachLegacyScore')) : null,
        careerFrom: getValue('dbCoachCareerFrom') ? parseInt(getValue('dbCoachCareerFrom')) : null,
        careerTo: getValue('dbCoachCareerTo') ? parseInt(getValue('dbCoachCareerTo')) : null
      };

      // Collect appearance data
      const appearanceData = {
        maddenPid: getValue('dbCoachPid') ? parseInt(getValue('dbCoachPid')) : null,
        maddenPam: getValue('dbCoachPam') || null
      };

      // Collect Coach Traits data
      const traitsData = {
        tradingTendency: getValue('dbCoachTradingTendency') || null,
        teamBuilding: getValue('dbCoachTeamBuilding') || null,
        specialty: getValue('dbCoachSpecialty') || null,
        offPlaybook: getValue('dbCoachOffPlaybook') || null,
        defPlaybook: getValue('dbCoachDefPlaybook') || null,
        offScheme: getValue('dbCoachOffScheme') || null,
        defScheme: getValue('dbCoachDefScheme') || null,
        isCreated: getValue('dbCoachIsCreated') === 'true'
      };

      // Collect Career Stats data
      const careerData = {
        careerWins: getValue('dbCoachCareerWins') ? parseInt(getValue('dbCoachCareerWins')) : null,
        careerLosses: getValue('dbCoachCareerLosses') ? parseInt(getValue('dbCoachCareerLosses')) : null,
        careerTies: getValue('dbCoachCareerTies') ? parseInt(getValue('dbCoachCareerTies')) : null,
        careerWinningSeasons: getValue('dbCoachCareerWinningSeasons') ? parseInt(getValue('dbCoachCareerWinningSeasons')) : null,
        careerPlayoffWins: getValue('dbCoachCareerPlayoffWins') ? parseInt(getValue('dbCoachCareerPlayoffWins')) : null,
        careerPlayoffLosses: getValue('dbCoachCareerPlayoffLosses') ? parseInt(getValue('dbCoachCareerPlayoffLosses')) : null,
        careerSBWins: getValue('dbCoachCareerSBWins') ? parseInt(getValue('dbCoachCareerSBWins')) : null,
        careerSBLosses: getValue('dbCoachCareerSBLosses') ? parseInt(getValue('dbCoachCareerSBLosses')) : null,
        careerPlayoffsMade: getValue('dbCoachCareerPlayoffsMade') ? parseInt(getValue('dbCoachCareerPlayoffsMade')) : null
      };

      // Combine all data
      const fullCoachData = { ...coachData, ...traitsData, ...careerData };

      if (isCreateMode) {
        // Create new custom coach
        const result = await window.electronAPI.coachDatabase.createCustomCoach({
          ...fullCoachData,
          maddenPid: appearanceData.maddenPid,
          maddenPam: appearanceData.maddenPam
        });

        if (result.success) {
          currentDbCoachId = result.id;
          isCreateMode = false;
          console.log('[DatabaseCoachCard] Created custom coach:', currentDbCoachId);

          // Check if there's a pending portrait from Portrait Manager
          const pendingPortraitPid = window.coachPortraitManager?.getPendingPortraitPid?.();
          if (pendingPortraitPid && appearanceData.maddenPid === pendingPortraitPid) {
            try {
              // Update the custom portrait metadata to link to this coach
              await window.electronAPI.customCoachPortrait.updateMetadata(pendingPortraitPid, {
                coachName: `${coachData.firstName} ${coachData.lastName}`,
                databaseCoachId: currentDbCoachId
              });
              console.log('[DatabaseCoachCard] Linked portrait PID', pendingPortraitPid, 'to coach', currentDbCoachId);

              // Clear the pending portrait PID
              window.coachPortraitManager?.clearPendingPortraitPid?.();

              // Refresh portrait manager if available
              window.coachPortraitManager?.refresh?.();
            } catch (err) {
              console.error('[DatabaseCoachCard] Error linking portrait:', err);
            }
          }

          alert('Coach created successfully!');
        } else {
          alert('Failed to create coach: ' + result.error);
          return;
        }
      } else if (isCustomCoach) {
        // Update custom coach
        const result = await window.electronAPI.coachDatabase.updateCustomCoach(currentDbCoachId, {
          ...fullCoachData,
          maddenPid: appearanceData.maddenPid,
          maddenPam: appearanceData.maddenPam
        });

        if (!result.success) {
          alert('Failed to update coach: ' + result.error);
          return;
        }
      } else {
        // Save edits to original coach
        await window.electronAPI.coachDatabase.saveCoachEdit(currentDbCoachId, fullCoachData);
        await window.electronAPI.coachDatabase.saveAppearanceEdit(currentDbCoachId, appearanceData);
      }

      hasUnsavedChanges = false;
      console.log('[DatabaseCoachCard] Changes saved successfully');

      // Refresh coach browser
      if (window.refreshCoachBrowser) {
        window.refreshCoachBrowser();
      }

      // Close modal
      closeDbCoachCard();

    } catch (error) {
      console.error('[DatabaseCoachCard] Error saving changes:', error);
      alert('Error saving changes: ' + error.message);
    }
  }

  /**
   * Reset coach to original data
   */
  async function resetDbCoach() {
    if (isCustomCoach) {
      alert('Cannot reset a custom coach. Use Delete to remove it.');
      return;
    }

    if (!confirm('Reset this coach to original database values? All edits will be lost.')) {
      return;
    }

    try {
      await window.electronAPI.coachDatabase.resetCoach(currentDbCoachId);
      alert('Coach reset to original values');

      // Reload the coach
      openDbCoachCard(currentDbCoachId, false);

      // Refresh browser
      if (window.refreshCoachBrowser) {
        window.refreshCoachBrowser();
      }
    } catch (error) {
      console.error('[DatabaseCoachCard] Error resetting coach:', error);
      alert('Error resetting coach: ' + error.message);
    }
  }

  /**
   * Hide coach from browser
   */
  async function hideDbCoach() {
    if (isCustomCoach) {
      alert('Cannot hide a custom coach. Use Delete to remove it.');
      return;
    }

    if (!confirm('Hide this coach from the browser? You can restore it from Database Management.')) {
      return;
    }

    try {
      await window.electronAPI.coachDatabase.hideCoach(currentDbCoachId);

      // Refresh browser
      if (window.refreshCoachBrowser) {
        window.refreshCoachBrowser();
      }

      closeDbCoachCard();
    } catch (error) {
      console.error('[DatabaseCoachCard] Error hiding coach:', error);
      alert('Error hiding coach: ' + error.message);
    }
  }

  /**
   * Delete custom coach
   */
  async function deleteDbCoach() {
    if (!isCustomCoach) {
      alert('Cannot delete an original database coach. Use Hide instead.');
      return;
    }

    if (!confirm('Delete this custom coach? This cannot be undone.')) {
      return;
    }

    try {
      await window.electronAPI.coachDatabase.deleteCustomCoach(currentDbCoachId);

      // Refresh browser
      if (window.refreshCoachBrowser) {
        window.refreshCoachBrowser();
      }

      closeDbCoachCard();
    } catch (error) {
      console.error('[DatabaseCoachCard] Error deleting coach:', error);
      alert('Error deleting coach: ' + error.message);
    }
  }

  /**
   * Close the coach card modal
   */
  function closeDbCoachCard() {
    const modal = document.getElementById('dbCoachCardModal');
    if (modal) {
      modal.style.display = 'none';
    }

    currentDbCoach = null;
    currentDbCoachId = null;
    isCustomCoach = false;
    isCreateMode = false;
    hasUnsavedChanges = false;
    selectedYear = null;
  }

  // Helper functions
  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.value = value;
    }
  }

  // Expose functions globally
  window.openDbCoachCard = openDbCoachCard;
  window.createNewDbCoach = createNewDbCoach;
  window.closeDbCoachCard = closeDbCoachCard;

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDatabaseCoachCard);
  } else {
    initDatabaseCoachCard();
  }

  console.log('[DatabaseCoachCard] Module loaded');
})();
