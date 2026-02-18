/**
 * Database Optimization Wizard
 * Each operation has its own preview screen with accept/decline checkboxes.
 */

(function() {
  'use strict';

  var selectedOptions = { betterRatings: false, assignPAM: false, findDuplicates: false };
  var previewData = { betterRatings: [], assignPAM: [], duplicates: [] };
  var approvedItems = { betterRatings: [], assignPAM: [], duplicates: [] };
  var executionResults = {
    betterRatings: { success: 0, errors: [] },
    assignPAM: { success: 0, errors: [] },
    duplicates: { success: 0, errors: [] }
  };

  var steps = [];
  var currentStepIndex = 0;

  // Generic PAM codes in game format
  var GENERIC_PAMS = {
    light: ['5_B_N_01', '5_B_N_02', '5_B_N_03', '4_B_N_01', '4_B_N_02'],
    dark: ['1_B_N_01', '1_B_N_02', '1_B_N_03', '2_B_N_01', '2_B_N_02'],
    hispanic: ['3_H_N_01', '3_H_N_02', '4_H_N_01', '2_H_N_01']
  };

  // PFR to Madden team mapping (comprehensive)
  // Covers: current teams, historical relocations, AFL teams, PFR special codes
  var PFR_TO_MADDEN = {
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
    'SDG': 'Chargers', 'SEA': 'Seahawks', 'SF': '49ers', 'SFO': '49ers',
    'STL': 'Rams', 'TB': 'Buccs', 'TAM': 'Buccs', 'TEN': 'Titans',
    'WAS': 'Commanders', 'WSH': 'Commanders',
    // Historical/relocated teams
    'PHO': 'Cards', 'CRD': 'Cards',  // Phoenix/St. Louis Cardinals
    'BOS': 'Pats',   // Boston Patriots
    'RAM': 'Rams',   // Various Rams locations
    'RAI': 'Raiders', // LA Raiders
    'CLT': 'Colts',  // Baltimore Colts
    'HTX': 'Texans', // Houston Texans alternate
    // Historical franchises that became current teams
    'OTI': 'Titans', // Houston Oilers -> Tennessee Oilers -> Titans
    // PFR special codes
    '2TM': '',  // Played for 2 teams - skip this
    '3TM': '',  // Played for 3 teams - skip this
    '4TM': '',  // Played for 4 teams - skip this
  };

  function convertTeam(team) {
    if (!team) return '';
    var upper = team.toUpperCase().trim();
    // Check for multi-team codes (2TM, 3TM, etc.) and return empty
    if (/^\d+TM$/i.test(upper)) return '';
    return PFR_TO_MADDEN[upper] || PFR_TO_MADDEN[team] || team;
  }

  function initDatabaseWizard() {
    console.log('[Wizard] Initializing');

    var openBtn = document.getElementById('openDatabaseWizard');
    var closeBtn = document.getElementById('closeDatabaseWizard');
    var prevBtn = document.getElementById('wizardPrevBtn');
    var nextBtn = document.getElementById('wizardNextBtn');
    var finishBtn = document.getElementById('wizardFinishBtn');
    var modal = document.getElementById('databaseWizardModal');
    var modalContent = modal ? modal.querySelector('.wizard-modal-content') : null;

    if (openBtn) openBtn.addEventListener('click', openWizard);
    if (closeBtn) closeBtn.addEventListener('click', function() { console.log('[Wizard] Close button clicked'); closeWizard(); });
    if (prevBtn) prevBtn.addEventListener('click', prevStep);
    if (nextBtn) nextBtn.addEventListener('click', nextStep);
    if (finishBtn) finishBtn.addEventListener('click', function() { console.log('[Wizard] Finish button clicked'); closeWizard(); });

    if (modalContent) {
      modalContent.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }

    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          console.log('[Wizard] Backdrop clicked');
          closeWizard();
        }
      });
    }
  }

  function openWizard() {
    console.log('[Wizard] Opening');
    selectedOptions = { betterRatings: false, assignPAM: false, findDuplicates: false };
    previewData = { betterRatings: [], assignPAM: [], duplicates: [] };
    approvedItems = { betterRatings: [], assignPAM: [], duplicates: [] };
    executionResults = {
      betterRatings: { success: 0, errors: [] },
      assignPAM: { success: 0, errors: [] },
      duplicates: { success: 0, errors: [] }
    };
    steps = ['welcome', 'options'];
    currentStepIndex = 0;

    document.getElementById('databaseWizardModal').style.display = 'flex';
    renderCurrentStep();
  }

  function closeWizard() {
    console.log('[Wizard] Closing');
    document.getElementById('databaseWizardModal').style.display = 'none';
    if (executionResults.betterRatings.success > 0 || executionResults.assignPAM.success > 0 || executionResults.duplicates.success > 0) {
      if (typeof window.refreshPlayerBrowser === 'function') window.refreshPlayerBrowser();
    }
  }

  function buildSteps() {
    steps = ['welcome', 'options'];
    if (selectedOptions.betterRatings) steps.push('preview_ratings', 'results_ratings');
    if (selectedOptions.assignPAM) steps.push('preview_pam', 'results_pam');
    if (selectedOptions.findDuplicates) steps.push('preview_duplicates', 'results_duplicates');
    steps.push('summary');
    console.log('[Wizard] Built steps:', steps);
  }

  function prevStep() {
    console.log('[Wizard] Prev step');
    if (currentStepIndex > 0) {
      currentStepIndex--;
      renderCurrentStep();
    }
  }

  function nextStep() {
    console.log('[Wizard] Next step from:', steps[currentStepIndex]);
    var step = steps[currentStepIndex];

    if (step === 'options') {
      if (!selectedOptions.betterRatings && !selectedOptions.assignPAM && !selectedOptions.findDuplicates) {
        alert('Please select at least one option.');
        return;
      }
      buildSteps();
      currentStepIndex++;
      var nextStepName = steps[currentStepIndex];

      if (nextStepName === 'preview_ratings') {
        showLoading('Loading players with career stats...');
        loadRatingsData().then(function() { renderCurrentStep(); });
      } else if (nextStepName === 'preview_pam') {
        showLoading('Finding players needing PAM...');
        loadPAMData().then(function() { renderCurrentStep(); });
      } else if (nextStepName === 'preview_duplicates') {
        showLoading('Finding duplicate players...');
        loadDuplicatesData().then(function() { renderCurrentStep(); });
      } else {
        renderCurrentStep();
      }
      return;
    }

    if (step === 'preview_ratings') {
      collectApprovedRatings();
      showLoading('Generating ratings...');
      executeRatings().then(function() {
        currentStepIndex++;
        renderCurrentStep();
      });
      return;
    }

    if (step === 'results_ratings') {
      currentStepIndex++;
      var nextStepName = steps[currentStepIndex];
      if (nextStepName === 'preview_pam') {
        showLoading('Finding players needing PAM...');
        loadPAMData().then(function() { renderCurrentStep(); });
      } else if (nextStepName === 'preview_duplicates') {
        showLoading('Finding duplicate players...');
        loadDuplicatesData().then(function() { renderCurrentStep(); });
      } else {
        renderCurrentStep();
      }
      return;
    }

    if (step === 'preview_pam') {
      collectApprovedPAM();
      showLoading('Assigning PAM values...');
      executePAM().then(function() {
        currentStepIndex++;
        renderCurrentStep();
      });
      return;
    }

    if (step === 'results_pam') {
      currentStepIndex++;
      var nextStepName = steps[currentStepIndex];
      if (nextStepName === 'preview_duplicates') {
        showLoading('Finding duplicate players...');
        loadDuplicatesData().then(function() { renderCurrentStep(); });
      } else {
        renderCurrentStep();
      }
      return;
    }

    if (step === 'preview_duplicates') {
      collectApprovedDuplicates();
      showLoading('Hiding duplicates...');
      executeDuplicates().then(function() {
        currentStepIndex++;
        renderCurrentStep();
      });
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      currentStepIndex++;
      renderCurrentStep();
    }
  }

  function showLoading(message) {
    var body = document.querySelector('.wizard-body');
    body.innerHTML = '<div class="wizard-loading"><div class="wizard-spinner"></div><p style="color:#888;margin-top:16px">' + (message || 'Loading...') + '</p></div>';
  }

  function renderCurrentStep() {
    var step = steps[currentStepIndex];
    var body = document.querySelector('.wizard-body');
    var prevBtn = document.getElementById('wizardPrevBtn');
    var nextBtn = document.getElementById('wizardNextBtn');
    var finishBtn = document.getElementById('wizardFinishBtn');

    console.log('[Wizard] Rendering step:', step, 'index:', currentStepIndex, 'total steps:', steps.length);

    updateProgress();

    prevBtn.style.display = currentStepIndex > 0 ? 'inline-block' : 'none';
    var isLast = (step === 'summary');
    nextBtn.style.display = isLast ? 'none' : 'inline-block';
    finishBtn.style.display = isLast ? 'inline-block' : 'none';
    console.log('[Wizard] Buttons - Next:', nextBtn.style.display, 'Finish:', finishBtn.style.display);

    if (step === 'options') nextBtn.textContent = 'Start';
    else if (step.indexOf('preview_') === 0) nextBtn.textContent = 'Apply Selected';
    else if (step.indexOf('results_') === 0) nextBtn.textContent = 'Continue';
    else nextBtn.textContent = 'Next';

    var html = '';
    switch (step) {
      case 'welcome': html = renderWelcome(); break;
      case 'options': html = renderOptions(); break;
      case 'preview_ratings': html = renderRatingsPreview(); break;
      case 'results_ratings': html = renderRatingsResults(); break;
      case 'preview_pam': html = renderPAMPreview(); break;
      case 'results_pam': html = renderPAMResults(); break;
      case 'preview_duplicates': html = renderDuplicatesPreview(); break;
      case 'results_duplicates': html = renderDuplicatesResults(); break;
      case 'summary': html = renderSummary(); break;
    }
    body.innerHTML = html;

    if (step === 'options') setupOptionListeners();
  }

  function updateProgress() {
    var container = document.querySelector('.wizard-progress');
    if (!container) return;

    var labels = ['Welcome', 'Options'];
    if (selectedOptions.betterRatings) labels.push('Ratings');
    if (selectedOptions.assignPAM) labels.push('PAM');
    if (selectedOptions.findDuplicates) labels.push('Duplicates');
    labels.push('Done');

    var majorIndex = 0;
    var html = '';
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].indexOf('results_') === 0) continue;
      var isActive = (i === currentStepIndex) || (steps[currentStepIndex].indexOf('results_') === 0 && steps[i] === steps[currentStepIndex].replace('results_', 'preview_'));
      var isComplete = i < currentStepIndex;
      html += '<div class="wizard-step' + (isActive ? ' active' : '') + (isComplete ? ' completed' : '') + '">';
      html += '<div class="wizard-step-number">' + (majorIndex + 1) + '</div>';
      html += '<div class="wizard-step-label">' + (labels[majorIndex] || '') + '</div></div>';
      majorIndex++;
    }
    container.innerHTML = html;
  }

  function renderWelcome() {
    return '<div class="wizard-welcome"><h2>Database Optimization Wizard</h2><p>Enhance your player database with better ratings, face assignments, and duplicate cleanup.</p><div class="wizard-features"><div class="wizard-feature"><div class="wizard-feature-icon">📊</div><h3>Better Ratings</h3><p>Generate from career stats</p></div><div class="wizard-feature"><div class="wizard-feature-icon">👤</div><h3>Assign PAM</h3><p>Add generic faces</p></div><div class="wizard-feature"><div class="wizard-feature-icon">🔍</div><h3>Duplicates</h3><p>Find and hide duplicates</p></div></div></div>';
  }

  function renderOptions() {
    return '<h3 style="color:#e0e0e0;margin:0 0 16px">Select Options</h3><div class="wizard-options"><div class="wizard-option' + (selectedOptions.betterRatings ? ' selected' : '') + '" data-option="betterRatings"><div class="wizard-option-header"><input type="checkbox" class="wizard-option-checkbox" data-option="betterRatings"' + (selectedOptions.betterRatings ? ' checked' : '') + '><h4 class="wizard-option-title">Generate Better Ratings</h4></div><p class="wizard-option-description">Find players with stats but no ratings.</p></div><div class="wizard-option' + (selectedOptions.assignPAM ? ' selected' : '') + '" data-option="assignPAM"><div class="wizard-option-header"><input type="checkbox" class="wizard-option-checkbox" data-option="assignPAM"' + (selectedOptions.assignPAM ? ' checked' : '') + '><h4 class="wizard-option-title">Assign Generic PAM</h4></div><p class="wizard-option-description">Assign face codes like 1_B_N_03 to players with portraits.</p></div><div class="wizard-option' + (selectedOptions.findDuplicates ? ' selected' : '') + '" data-option="findDuplicates"><div class="wizard-option-header"><input type="checkbox" class="wizard-option-checkbox" data-option="findDuplicates"' + (selectedOptions.findDuplicates ? ' checked' : '') + '><h4 class="wizard-option-title">Find Duplicates</h4></div><p class="wizard-option-description">Find and hide duplicate entries.</p></div></div>';
  }

  function setupOptionListeners() {
    var checkboxes = document.querySelectorAll('.wizard-option-checkbox');
    for (var i = 0; i < checkboxes.length; i++) {
      checkboxes[i].addEventListener('change', function(e) {
        e.stopPropagation();
        var opt = this.getAttribute('data-option');
        selectedOptions[opt] = this.checked;
        var card = this.closest('.wizard-option');
        if (card) {
          if (this.checked) card.classList.add('selected');
          else card.classList.remove('selected');
        }
        console.log('[Wizard] Option changed:', opt, this.checked);
      });
      checkboxes[i].addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }
    var cards = document.querySelectorAll('.wizard-option');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', function(e) {
        e.stopPropagation();
        if (e.target.type !== 'checkbox') {
          var cb = this.querySelector('.wizard-option-checkbox');
          if (cb) {
            cb.checked = !cb.checked;
            var evt = new Event('change', { bubbles: false });
            cb.dispatchEvent(evt);
          }
        }
      });
    }
  }

  // ========== RATINGS ==========
  function loadRatingsData() {
    console.log('[Wizard] Loading ratings data');
    previewData.betterRatings = [];
    if (!window.electronAPI || !window.electronAPI.database) {
      console.error('[Wizard] No database API');
      return Promise.resolve();
    }

    return window.electronAPI.database.getAllPlayers({ limit: 50000 }).then(function(result) {
      console.log('[Wizard] Got players:', result);
      if (!result || !result.success || !result.players) return [];

      var validPlayers = result.players.filter(function(p) {
        return p.firstName && p.lastName && p.position;
      });

      console.log('[Wizard] Checking', validPlayers.length, 'players for career stats');

      // Process in batches to avoid memory issues and show progress
      var batchSize = 100;
      var batches = [];
      for (var i = 0; i < validPlayers.length; i += batchSize) {
        batches.push(validPlayers.slice(i, i + batchSize));
      }

      return batches.reduce(function(promise, batch, batchIndex) {
        return promise.then(function() {
          console.log('[Wizard] Processing ratings batch', batchIndex + 1, 'of', batches.length);
          var promises = batch.map(function(p) {
            return checkPlayerForRatings(p);
          });
          return Promise.all(promises);
        });
      }, Promise.resolve());
    }).then(function() {
      console.log('[Wizard] Found', previewData.betterRatings.length, 'players needing ratings');
    }).catch(function(e) {
      console.error('[Wizard] Error loading ratings:', e);
    });
  }

  function checkPlayerForRatings(p) {
    return window.electronAPI.database.getCareerStats(p.firstName, p.lastName, p.draftClass ? parseInt(p.draftClass) : undefined)
      .then(function(stats) {
        if (stats && stats.success && stats.stats && stats.stats.length > 0) {
          return window.electronAPI.database.getSeasonEditsForPlayer(p.internalId).then(function(seasons) {
            var hasSeasons = seasons && seasons.seasons && seasons.seasons.length > 0;
            if (!hasSeasons) {
              previewData.betterRatings.push({
                player: p,
                stats: stats.stats,
                years: stats.stats.length,
                checked: true
              });
            }
          });
        }
      }).catch(function(e) {
        // Silently skip players without stats
      });
  }

  function renderRatingsPreview() {
    var items = previewData.betterRatings;
    var html = '<h3 style="color:#e0e0e0;margin:0 0 8px">Better Ratings Preview</h3><p style="color:#888;margin:0 0 16px">Select players to generate ratings for (' + items.length + ' found):</p>';
    if (items.length === 0) {
      html += '<p style="color:#888;text-align:center;padding:40px">No players found needing ratings.<br><small>Players must have career stats in the database but no season edits.</small></p>';
    } else {
      html += '<div style="margin-bottom:12px"><button onclick="window.wizardSelectAll(\'ratings\',true)" class="wizard-btn-small">Select All</button> <button onclick="window.wizardSelectAll(\'ratings\',false)" class="wizard-btn-small">Select None</button></div>';
      html += '<div class="wizard-item-list">';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        html += '<label class="wizard-item"><input type="checkbox" data-type="ratings" data-index="' + i + '"' + (item.checked ? ' checked' : '') + '><span>' + item.player.firstName + ' ' + item.player.lastName + '</span><span class="wizard-item-detail">' + item.player.position + ' - ' + item.years + ' seasons</span></label>';
      }
      html += '</div>';
    }
    return html;
  }

  function collectApprovedRatings() {
    approvedItems.betterRatings = [];
    var checked = document.querySelectorAll('input[data-type="ratings"]:checked');
    for (var i = 0; i < checked.length; i++) {
      var idx = parseInt(checked[i].getAttribute('data-index'));
      approvedItems.betterRatings.push(previewData.betterRatings[idx]);
    }
    console.log('[Wizard] Approved ratings:', approvedItems.betterRatings.length);
  }

  function executeRatings() {
    console.log('[Wizard] Executing ratings for', approvedItems.betterRatings.length, 'players');

    var chain = Promise.resolve();

    approvedItems.betterRatings.forEach(function(item) {
      chain = chain.then(function() {
        return generateRatingsForPlayer(item);
      });
    });

    return chain.then(function() {
      console.log('[Wizard] Ratings done:', executionResults.betterRatings.success, 'success');
    });
  }

  function generateRatingsForPlayer(item) {
    console.log('[Wizard] Generating ratings for', item.player.firstName, item.player.lastName);

    var stats = item.stats;
    if (!stats || stats.length === 0) {
      return Promise.resolve();
    }

    var chain = Promise.resolve();

    stats.forEach(function(season) {
      chain = chain.then(function() {
        return generateSeasonRating(item.player, season);
      });
    });

    return chain.then(function() {
      executionResults.betterRatings.success++;
      console.log('[Wizard] Successfully generated ratings for', item.player.lastName);
    }).catch(function(e) {
      console.error('[Wizard] Error generating ratings for', item.player.lastName, e);
      executionResults.betterRatings.errors.push(item.player.lastName + ': ' + (e.message || e));
    });
  }

  function generateSeasonRating(player, season) {
    console.log('[Wizard] Generating season rating for', player.lastName, 'year', season.year, 'raw team from stats:', season.team);

    return window.electronAPI.database.calculateRatingFromStats({
      stats: season,
      position: player.position,
      year: season.year,
      targetYear: season.year + 1
    }).then(function(rating) {
      console.log('[Wizard] Got rating result:', rating);
      if (rating && rating.success && rating.ratings) {
        var rawTeam = season.team || '';
        var team = convertTeam(rawTeam);
        console.log('[Wizard] Team conversion:', rawTeam, '->', team, 'for', player.lastName, 'year', season.year);

        if (!team || team === '') {
          console.warn('[Wizard] WARNING: Empty team for', player.lastName, 'year', season.year);
        }

        return window.electronAPI.database.saveSeasonEdit(player.internalId, season.year, {
          team: team,
          position: player.position,
          ratings: rating.ratings
        }).then(function(saveResult) {
          console.log('[Wizard] Save result:', saveResult);
        });
      }
    });
  }

  function renderRatingsResults() {
    var r = executionResults.betterRatings;
    return '<div class="wizard-results"><div class="wizard-results-icon">✓</div><h3>Ratings Generated</h3><p class="wizard-results-stat"><strong>' + r.success + '</strong> players updated</p>' + (r.errors.length ? '<p class="wizard-results-errors">Errors: ' + r.errors.slice(0,3).join(', ') + '</p>' : '') + '</div>';
  }

  // ========== PAM ==========
  function loadPAMData() {
    console.log('[Wizard] Loading PAM data');
    previewData.assignPAM = [];
    if (!window.electronAPI || !window.electronAPI.database) {
      console.error('[Wizard] No database API');
      return Promise.resolve();
    }

    return window.electronAPI.database.getAllPlayers({ limit: 50000 }).then(function(result) {
      console.log('[Wizard] Got players for PAM check:', result);
      if (!result || !result.success || !result.players) return [];

      var playersWithPid = result.players.filter(function(p) {
        return p.pid && p.pid > 0;
      });

      console.log('[Wizard] Found', playersWithPid.length, 'players with PIDs');

      // Process in batches to avoid memory issues
      var batchSize = 100;
      var batches = [];
      for (var i = 0; i < playersWithPid.length; i += batchSize) {
        batches.push(playersWithPid.slice(i, i + batchSize));
      }

      return batches.reduce(function(promise, batch, batchIndex) {
        return promise.then(function() {
          console.log('[Wizard] Processing PAM batch', batchIndex + 1, 'of', batches.length);
          var promises = batch.map(function(p) {
            return checkPlayerForPAM(p);
          });
          return Promise.all(promises);
        });
      }, Promise.resolve());
    }).then(function() {
      console.log('[Wizard] Found', previewData.assignPAM.length, 'players needing PAM');
    }).catch(function(e) {
      console.error('[Wizard] Error loading PAM:', e);
    });
  }

  function checkPlayerForPAM(p) {
    // Get the full merged player data to check for existing PAM
    return window.electronAPI.database.getMergedPlayer(p.internalId).then(function(merged) {
      if (!merged || !merged.success || !merged.player) return;

      var player = merged.player;
      var hasPam = player.maddenPam && player.maddenPam !== '' && player.maddenPam !== '0';

      if (!hasPam) {
        // Check if they have a portrait
        return window.electronAPI.portrait.getByPID(p.pid).then(function(portrait) {
          if (portrait) {
            var suggestedPam = suggestPAM(player.race, player.skinTone);
            previewData.assignPAM.push({
              player: p,
              fullPlayer: player,
              suggestedPAM: suggestedPam,
              checked: true
            });
          }
        }).catch(function() {});
      }
    }).catch(function() {});
  }

  function suggestPAM(race, skinTone) {
    var opts = GENERIC_PAMS.light;

    // Race codes: 1=White, 5=Hispanic, 7=Black
    if (race === 7 || race === '7') {
      opts = GENERIC_PAMS.dark;
    } else if (race === 5 || race === '5') {
      opts = GENERIC_PAMS.hispanic;
    } else if (race === 1 || race === '1') {
      opts = GENERIC_PAMS.light;
    }

    // Override by skin tone if available (1-2 = dark, 4-5 = light)
    if (skinTone !== undefined && skinTone !== null) {
      var tone = parseInt(skinTone);
      if (tone <= 2) opts = GENERIC_PAMS.dark;
      else if (tone >= 4) opts = GENERIC_PAMS.light;
    }

    return opts[Math.floor(Math.random() * opts.length)];
  }

  function renderPAMPreview() {
    var items = previewData.assignPAM;
    var html = '<h3 style="color:#e0e0e0;margin:0 0 8px">PAM Assignment Preview</h3><p style="color:#888;margin:0 0 16px">Select players to assign generic face codes (' + items.length + ' found):</p>';
    if (items.length === 0) {
      html += '<p style="color:#888;text-align:center;padding:40px">No players found needing PAM.<br><small>Players must have a PID portrait but no PAM value.</small></p>';
    } else {
      html += '<div style="margin-bottom:12px"><button onclick="window.wizardSelectAll(\'pam\',true)" class="wizard-btn-small">Select All</button> <button onclick="window.wizardSelectAll(\'pam\',false)" class="wizard-btn-small">Select None</button></div>';
      html += '<div class="wizard-item-list">';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        html += '<label class="wizard-item"><input type="checkbox" data-type="pam" data-index="' + i + '"' + (item.checked ? ' checked' : '') + '><span>' + item.player.firstName + ' ' + item.player.lastName + '</span><span class="wizard-item-detail">PID: ' + item.player.pid + ' → ' + item.suggestedPAM + '</span></label>';
      }
      html += '</div>';
    }
    return html;
  }

  function collectApprovedPAM() {
    approvedItems.assignPAM = [];
    var checked = document.querySelectorAll('input[data-type="pam"]:checked');
    for (var i = 0; i < checked.length; i++) {
      var idx = parseInt(checked[i].getAttribute('data-index'));
      approvedItems.assignPAM.push(previewData.assignPAM[idx]);
    }
    console.log('[Wizard] Approved PAM:', approvedItems.assignPAM.length);
  }

  function executePAM() {
    console.log('[Wizard] Executing PAM for', approvedItems.assignPAM.length, 'players');

    var chain = Promise.resolve();

    approvedItems.assignPAM.forEach(function(item) {
      chain = chain.then(function() {
        return assignPAMToPlayer(item);
      });
    });

    return chain.then(function() {
      console.log('[Wizard] PAM done:', executionResults.assignPAM.success, 'success');
    });
  }

  function assignPAMToPlayer(item) {
    console.log('[Wizard] Assigning PAM', item.suggestedPAM, 'to', item.player.firstName, item.player.lastName);

    return window.electronAPI.database.saveAppearanceEdit(item.player.internalId, {
      maddenPam: item.suggestedPAM
    }).then(function(result) {
      console.log('[Wizard] PAM save result:', result);
      executionResults.assignPAM.success++;
    }).catch(function(e) {
      console.error('[Wizard] Error saving PAM for', item.player.lastName, e);
      executionResults.assignPAM.errors.push(item.player.lastName + ': ' + (e.message || e));
    });
  }

  function renderPAMResults() {
    var r = executionResults.assignPAM;
    return '<div class="wizard-results"><div class="wizard-results-icon">✓</div><h3>PAM Values Assigned</h3><p class="wizard-results-stat"><strong>' + r.success + '</strong> players updated</p>' + (r.errors.length ? '<p class="wizard-results-errors">Errors: ' + r.errors.slice(0,3).join(', ') + '</p>' : '') + '</div>';
  }

  // ========== DUPLICATES ==========
  // Position groups for duplicate matching - only same group = potential duplicate
  var POSITION_GROUPS = {
    'QB': 'QB',
    'HB': 'RB', 'RB': 'RB', 'FB': 'RB',
    'WR': 'WR', 'FL': 'WR', 'SE': 'WR',
    'TE': 'TE',
    'LT': 'OL', 'LG': 'OL', 'C': 'OL', 'RG': 'OL', 'RT': 'OL', 'OT': 'OL', 'OG': 'OL', 'T': 'OL', 'G': 'OL',
    'DE': 'DL', 'DT': 'DL', 'LE': 'DL', 'RE': 'DL', 'NT': 'DL', 'DL': 'DL',
    'MLB': 'LB', 'OLB': 'LB', 'ILB': 'LB', 'LOLB': 'LB', 'ROLB': 'LB', 'LB': 'LB',
    'CB': 'DB', 'FS': 'DB', 'SS': 'DB', 'S': 'DB', 'DB': 'DB', 'RCB': 'DB', 'LCB': 'DB',
    'K': 'K', 'P': 'K', 'PK': 'K'
  };

  function getPositionGroup(pos) {
    if (!pos) return null;
    return POSITION_GROUPS[pos.toUpperCase()] || null;
  }

  function getPlayerYear(p) {
    // Try to get a representative year for the player
    if (p.draftClass) return parseInt(p.draftClass, 10);
    if (p.careerFrom) return parseInt(p.careerFrom, 10);
    return null;
  }

  function arePlayersSimilarEra(p1, p2) {
    var year1 = getPlayerYear(p1);
    var year2 = getPlayerYear(p2);
    if (!year1 || !year2) return true; // If we don't have year data, can't exclude
    // Players must be within 5 years to be considered potential duplicates
    return Math.abs(year1 - year2) <= 5;
  }

  function areTrueDuplicates(p1, p2) {
    // STRICT duplicate matching:
    // 1. Must be in same position group (WR != CB)
    // 2. Must be in similar era (within 5 years)
    var group1 = getPositionGroup(p1.position);
    var group2 = getPositionGroup(p2.position);

    // If both have positions and they're different groups, NOT duplicates
    if (group1 && group2 && group1 !== group2) {
      return false;
    }

    // If careers are more than 5 years apart, NOT duplicates
    if (!arePlayersSimilarEra(p1, p2)) {
      return false;
    }

    return true;
  }

  function loadDuplicatesData() {
    console.log('[Wizard] Loading duplicates data');
    previewData.duplicates = [];
    if (!window.electronAPI || !window.electronAPI.database) {
      console.error('[Wizard] No database API');
      return Promise.resolve();
    }

    return window.electronAPI.database.getAllPlayers({ limit: 50000 }).then(function(result) {
      console.log('[Wizard] Got players for duplicate check:', result.players ? result.players.length : 0, 'players');
      if (!result || !result.success || !result.players) return;

      var nameGroups = {};

      result.players.forEach(function(p) {
        if (!p.firstName || !p.lastName) return;

        // Normalize name for grouping
        var key = (p.firstName + ' ' + p.lastName)
          .toLowerCase()
          .replace(/ jr\.?$| sr\.?$| iii$| ii$| iv$/gi, '')
          .replace(/[.']/g, '')
          .trim();

        if (!nameGroups[key]) nameGroups[key] = [];
        nameGroups[key].push(p);
      });

      // Find TRUE duplicates - same name AND same position group AND similar era
      Object.keys(nameGroups).forEach(function(key) {
        var players = nameGroups[key];
        if (players.length <= 1) return;

        // Find clusters of TRUE duplicates within this name group
        var processed = [];

        for (var i = 0; i < players.length; i++) {
          if (processed.indexOf(i) >= 0) continue;

          var cluster = [players[i]];
          processed.push(i);

          for (var j = i + 1; j < players.length; j++) {
            if (processed.indexOf(j) >= 0) continue;

            // Check if this player is a TRUE duplicate of any in the cluster
            var isDuplicate = false;
            for (var k = 0; k < cluster.length; k++) {
              if (areTrueDuplicates(cluster[k], players[j])) {
                isDuplicate = true;
                break;
              }
            }

            if (isDuplicate) {
              cluster.push(players[j]);
              processed.push(j);
            }
          }

          // Only add if there are actual duplicates (more than 1 in cluster)
          if (cluster.length > 1) {
            // Score and sort - higher score = better data (keep this one)
            cluster.sort(function(a, b) {
              return scorePlayer(b) - scorePlayer(a);
            });

            var keepPlayer = cluster[0];
            var year = getPlayerYear(keepPlayer);
            var displayName = key + (year ? ' (' + year + ')' : '') + (keepPlayer.position ? ' - ' + keepPlayer.position : '');

            previewData.duplicates.push({
              name: displayName,
              players: cluster,
              keepPlayer: keepPlayer,
              hideCount: cluster.length - 1,
              checked: true
            });
          }
        }
      });

      // No limit - process all duplicate groups
      console.log('[Wizard] Found', previewData.duplicates.length, 'TRUE duplicate groups (same position + era)');
    }).catch(function(e) {
      console.error('[Wizard] Error loading duplicates:', e);
    });
  }

  function scorePlayer(p) {
    var s = 0;
    if (p.position && p.position !== '') s += 10;
    if (p.draftClass && p.draftClass !== '') s += 10;
    if (p.pid && p.pid > 0) s += 15;
    if (p.college && p.college !== '') s += 5;
    if (p.isCustom) s += 20; // Prefer custom players
    return s;
  }

  function renderDuplicatesPreview() {
    var items = previewData.duplicates;
    var html = '<h3 style="color:#e0e0e0;margin:0 0 8px">Duplicate Players Preview</h3>';
    html += '<p style="color:#888;margin:0 0 16px">Only showing TRUE duplicates (same name + same position group + same era). ' + items.length + ' groups found:</p>';
    if (items.length === 0) {
      html += '<p style="color:#4caf50;text-align:center;padding:40px">No duplicate players found! Players with same name but different positions or eras are correctly kept separate.</p>';
    } else {
      html += '<div style="margin-bottom:12px"><button onclick="window.wizardSelectAll(\'duplicates\',true)" class="wizard-btn-small">Select All</button> <button onclick="window.wizardSelectAll(\'duplicates\',false)" class="wizard-btn-small">Select None</button></div>';
      html += '<div class="wizard-item-list">';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var keep = item.keepPlayer;
        var keepYear = getPlayerYear(keep);
        var hideList = item.players.slice(1).map(function(p) {
          return p.firstName + ' ' + p.lastName + (p.position ? ' ' + p.position : '') + (getPlayerYear(p) ? ' ' + getPlayerYear(p) : '');
        }).join(', ');
        html += '<label class="wizard-item" style="flex-direction:column;align-items:flex-start;gap:4px">';
        html += '<div style="display:flex;align-items:center;gap:8px;width:100%">';
        html += '<input type="checkbox" data-type="duplicates" data-index="' + i + '"' + (item.checked ? ' checked' : '') + '>';
        html += '<span style="color:#4caf50;font-weight:500">KEEP: ' + keep.firstName + ' ' + keep.lastName + '</span>';
        html += '<span style="color:#888">' + (keep.position || '?') + ' ' + (keepYear || '?') + '</span>';
        html += '</div>';
        html += '<div style="margin-left:26px;color:#f44336;font-size:11px">HIDE: ' + hideList + '</div>';
        html += '</label>';
      }
      html += '</div>';
    }
    return html;
  }

  function collectApprovedDuplicates() {
    approvedItems.duplicates = [];
    var checked = document.querySelectorAll('input[data-type="duplicates"]:checked');
    for (var i = 0; i < checked.length; i++) {
      var idx = parseInt(checked[i].getAttribute('data-index'));
      approvedItems.duplicates.push(previewData.duplicates[idx]);
    }
    console.log('[Wizard] Approved duplicates:', approvedItems.duplicates.length);
  }

  function executeDuplicates() {
    console.log('[Wizard] Executing duplicates for', approvedItems.duplicates.length, 'groups');

    var chain = Promise.resolve();

    approvedItems.duplicates.forEach(function(item) {
      chain = chain.then(function() {
        return resolveDuplicateGroup(item);
      });
    });

    return chain.then(function() {
      console.log('[Wizard] Duplicates done:', executionResults.duplicates.success, 'success');
    });
  }

  function resolveDuplicateGroup(item) {
    console.log('[Wizard] Resolving duplicate group:', item.name, '- keeping', item.keepPlayer.firstName, item.keepPlayer.lastName);

    // Hide all players except the first (best scored) one
    var chain = Promise.resolve();

    for (var i = 1; i < item.players.length; i++) {
      (function(player) {
        chain = chain.then(function() {
          console.log('[Wizard] Hiding duplicate:', player.firstName, player.lastName, 'id:', player.internalId);
          return window.electronAPI.database.hidePlayer(player.internalId).then(function(result) {
            console.log('[Wizard] Hide result:', result);
          });
        });
      })(item.players[i]);
    }

    return chain.then(function() {
      executionResults.duplicates.success++;
    }).catch(function(e) {
      console.error('[Wizard] Error resolving duplicates for', item.name, e);
      executionResults.duplicates.errors.push(item.name + ': ' + (e.message || e));
    });
  }

  function renderDuplicatesResults() {
    var r = executionResults.duplicates;
    return '<div class="wizard-results"><div class="wizard-results-icon">✓</div><h3>Duplicates Resolved</h3><p class="wizard-results-stat"><strong>' + r.success + '</strong> groups cleaned up</p>' + (r.errors.length ? '<p class="wizard-results-errors">Errors: ' + r.errors.slice(0,3).join(', ') + '</p>' : '') + '</div>';
  }

  // ========== SUMMARY ==========
  function renderSummary() {
    var html = '<div class="wizard-summary"><div class="wizard-summary-icon success">✓</div><h2>All Done!</h2><div class="wizard-summary-stats">';
    if (selectedOptions.betterRatings) html += '<div class="wizard-stat"><div class="wizard-stat-value">' + executionResults.betterRatings.success + '</div><div class="wizard-stat-label">Ratings Generated</div></div>';
    if (selectedOptions.assignPAM) html += '<div class="wizard-stat"><div class="wizard-stat-value">' + executionResults.assignPAM.success + '</div><div class="wizard-stat-label">PAM Assigned</div></div>';
    if (selectedOptions.findDuplicates) html += '<div class="wizard-stat"><div class="wizard-stat-value">' + executionResults.duplicates.success + '</div><div class="wizard-stat-label">Duplicates Resolved</div></div>';
    html += '</div></div>';
    return html;
  }

  // Global helper
  window.wizardSelectAll = function(type, checked) {
    var inputs = document.querySelectorAll('input[data-type="' + type + '"]');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].checked = checked;
    }
  };

  window.initDatabaseWizard = initDatabaseWizard;
  window.openDatabaseWizard = openWizard;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDatabaseWizard);
  } else {
    initDatabaseWizard();
  }
})();
