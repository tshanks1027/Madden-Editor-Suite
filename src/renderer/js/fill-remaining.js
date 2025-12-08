/**
 * Fill Remaining Module
 *
 * Handles bulk filling of roster or draft class from the player database.
 * Enforces position limits, deduplicates players, and uses historical draft slots.
 */

(function() {
  'use strict';

  // Position limits for roster (per team)
  const ROSTER_POSITION_LIMITS_PER_TEAM = {
    QB: 3, HB: 4, FB: 1, WR: 5, TE: 3,
    LT: 2, LG: 2, C: 2, RG: 2, RT: 2,
    LEDG: 2, REDG: 3, DT: 3,
    SAM: 2, MIKE: 3, WILL: 2,
    CB: 5, FS: 2, SS: 2, K: 1, P: 1
  };

  // Position limits for full roster (all 32 teams)
  const ROSTER_POSITION_LIMITS = {};
  for (const [pos, limit] of Object.entries(ROSTER_POSITION_LIMITS_PER_TEAM)) {
    ROSTER_POSITION_LIMITS[pos] = limit * 32; // 32 teams
  }

  // All 32 NFL team IDs
  const TEAM_IDS = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
  ];

  // Draft class typically has more players per position
  const DRAFT_POSITION_LIMITS = {
    QB: 12, HB: 20, FB: 4, WR: 30, TE: 15,
    LT: 12, LG: 12, C: 12, RG: 12, RT: 12,
    LEDG: 15, REDG: 15, DT: 20,
    SAM: 10, MIKE: 15, WILL: 10,
    CB: 25, FS: 10, SS: 10, K: 4, P: 4
  };

  // State
  let previewData = null;

  /**
   * Initialize the fill remaining module
   */
  function initFillRemaining() {
    console.log('[FillRemaining] Initializing...');

    // Button to open modal
    const fillBtn = document.getElementById('fillRemainingBtn');
    if (fillBtn) {
      fillBtn.addEventListener('click', openFillModal);
    }

    // Close button
    const closeBtn = document.getElementById('closeFillRemaining');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeFillModal);
    }

    // Cancel button
    const cancelBtn = document.getElementById('fillCancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeFillModal);
    }

    // Preview button
    const previewBtn = document.getElementById('fillPreviewBtn');
    if (previewBtn) {
      previewBtn.addEventListener('click', previewFill);
    }

    // Execute button
    const executeBtn = document.getElementById('fillExecuteBtn');
    if (executeBtn) {
      executeBtn.addEventListener('click', executeFill);
    }

    // Target radio buttons
    const targetRadios = document.querySelectorAll('input[name="fillTarget"]');
    targetRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        previewData = null;
        updatePositionNeeds('Click "Preview" to see position needs');
        document.getElementById('fillPreviewSummary').textContent = '';
      });
    });

    // Modal background click to close
    const modal = document.getElementById('fillRemainingModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeFillModal();
        }
      });
    }

    console.log('[FillRemaining] Initialized');
  }

  /**
   * Open the fill modal
   */
  function openFillModal() {
    console.log('[FillRemaining] Opening modal');

    const modal = document.getElementById('fillRemainingModal');
    if (modal) {
      modal.style.display = 'flex';
    }

    // Reset state
    previewData = null;
    document.getElementById('fillPreviewSummary').textContent = '';

    // Check which target is available
    const hasRoster = window.app && window.app.agGrid;
    const hasDraft = window.app && window.app.draftGrid;

    const rosterRadio = document.getElementById('fillTargetRoster');
    const draftRadio = document.getElementById('fillTargetDraft');

    if (rosterRadio && draftRadio) {
      // Disable unavailable targets
      rosterRadio.disabled = !hasRoster;
      draftRadio.disabled = !hasDraft;

      // Select available target
      if (hasRoster) {
        rosterRadio.checked = true;
      } else if (hasDraft) {
        draftRadio.checked = true;
      }

      // Update labels
      rosterRadio.parentElement.style.opacity = hasRoster ? '1' : '0.5';
      draftRadio.parentElement.style.opacity = hasDraft ? '1' : '0.5';
    }

    updatePositionNeeds('Click "Preview" to see position needs');
  }

  /**
   * Close the fill modal
   */
  function closeFillModal() {
    const modal = document.getElementById('fillRemainingModal');
    if (modal) {
      modal.style.display = 'none';
    }
    previewData = null;
  }

  /**
   * Get the selected target
   */
  function getSelectedTarget() {
    const selected = document.querySelector('input[name="fillTarget"]:checked');
    return selected ? selected.value : 'roster';
  }

  /**
   * Get current position counts from the grid
   */
  function getCurrentPositionCounts(target) {
    const counts = {};

    if (target === 'roster' && window.app && window.app.agGrid) {
      window.app.agGrid.forEachNode(node => {
        const pos = (node.data.position || node.data.PPOS || '').toUpperCase().trim();
        if (pos) {
          counts[pos] = (counts[pos] || 0) + 1;
        }
      });
    } else if (target === 'draft' && window.app && window.app.draftGrid) {
      const data = window.app.draftGrid.getSourceData();
      data.forEach(row => {
        const pos = (row.position || '').toUpperCase().trim();
        if (pos) {
          counts[pos] = (counts[pos] || 0) + 1;
        }
      });
    }

    return counts;
  }

  /**
   * Calculate position needs (limit - current)
   */
  function calculatePositionNeeds(target) {
    const limits = target === 'draft' ? DRAFT_POSITION_LIMITS : ROSTER_POSITION_LIMITS;
    const current = getCurrentPositionCounts(target);
    const needs = {};

    for (const [pos, limit] of Object.entries(limits)) {
      const have = current[pos] || 0;
      if (have < limit) {
        needs[pos] = limit - have;
      }
    }

    return { needs, current, limits };
  }

  /**
   * Update the position needs display
   */
  function updatePositionNeeds(content) {
    const container = document.getElementById('fillPositionNeeds');
    if (!container) return;

    if (typeof content === 'string') {
      container.innerHTML = `<p style="color: #888; text-align: center;">${content}</p>`;
      return;
    }

    // Build position needs grid
    const { needs, current, limits } = content;
    const positions = Object.keys(limits).sort();

    let html = '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">';

    for (const pos of positions) {
      const have = current[pos] || 0;
      const limit = limits[pos];
      const need = needs[pos] || 0;
      const isFull = need === 0;

      html += `
        <div style="padding: 8px; background: ${isFull ? '#1a3a1a' : '#2a2a2a'}; border-radius: 4px; text-align: center;">
          <div style="font-weight: 600; color: ${isFull ? '#4caf50' : '#eee'};">${pos}</div>
          <div style="font-size: 11px; color: ${isFull ? '#4caf50' : '#888'};">
            ${have}/${limit} ${isFull ? '&#10003;' : `(need ${need})`}
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Preview the fill operation
   */
  async function previewFill() {
    const target = getSelectedTarget();
    const yearFrom = parseInt(document.getElementById('fillYearFrom').value) || 2000;
    const yearTo = parseInt(document.getElementById('fillYearTo').value) || 2024;

    console.log(`[FillRemaining] Previewing fill for ${target}, years ${yearFrom}-${yearTo}`);

    // Calculate position needs
    const { needs, current, limits } = calculatePositionNeeds(target);
    updatePositionNeeds({ needs, current, limits });

    // Check if anything is needed
    const totalNeeded = Object.values(needs).reduce((a, b) => a + b, 0);
    if (totalNeeded === 0) {
      document.getElementById('fillPreviewSummary').textContent =
        'All positions are full! Nothing to fill.';
      previewData = null;
      return;
    }

    // Get already tracked players
    let excludeKeys = [];
    if (window.electronAPI.editorTracking) {
      const keysResult = await window.electronAPI.editorTracking.getTrackedKeys(target);
      if (keysResult.success) {
        excludeKeys = keysResult.keys;
      }
    }

    // Also get current players from grid as exclude keys
    if (target === 'roster' && window.app && window.app.agGrid) {
      window.app.agGrid.forEachNode(node => {
        const fn = (node.data.firstName || node.data.PFNA || '').toLowerCase().trim();
        const ln = (node.data.lastName || node.data.PLNA || '').toLowerCase().trim();
        const pos = (node.data.position || node.data.PPOS || '').toUpperCase().trim();
        if (fn && ln && pos) {
          excludeKeys.push(`${fn}|${ln}|${pos}`);
        }
      });
    } else if (target === 'draft' && window.app && window.app.draftGrid) {
      const data = window.app.draftGrid.getSourceData();
      data.forEach(row => {
        const fn = (row.firstName || '').toLowerCase().trim();
        const ln = (row.lastName || '').toLowerCase().trim();
        const pos = (row.position || '').toUpperCase().trim();
        if (fn && ln && pos) {
          excludeKeys.push(`${fn}|${ln}|${pos}`);
        }
      });
    }

    // Make unique
    excludeKeys = [...new Set(excludeKeys)];

    // Update summary
    document.getElementById('fillPreviewSummary').textContent = 'Loading preview...';

    try {
      // Call backend to get players for fill
      const result = await window.electronAPI.database.getPlayersForFill({
        target,
        yearFrom,
        yearTo,
        excludeKeys,
        positionNeeds: needs
      });

      if (!result.success) {
        document.getElementById('fillPreviewSummary').textContent = 'Error: ' + result.error;
        return;
      }

      previewData = {
        target,
        yearFrom,
        yearTo,
        players: result.players,
        positionCounts: result.positionCounts,
        stillNeeded: result.stillNeeded
      };

      // Update summary
      const filled = result.players.length;
      const stillTotal = Object.values(result.stillNeeded || {}).reduce((a, b) => a + b, 0);

      let summaryText = `Found ${filled} players to add.`;
      if (stillTotal > 0) {
        summaryText += ` ${stillTotal} slots will remain empty.`;
      }

      document.getElementById('fillPreviewSummary').innerHTML =
        `<span style="color: #4caf50;">${summaryText}</span>`;

      console.log('[FillRemaining] Preview result:', result);

    } catch (error) {
      console.error('[FillRemaining] Preview error:', error);
      document.getElementById('fillPreviewSummary').textContent = 'Error: ' + error.message;
    }
  }

  /**
   * Get current team position counts from roster
   */
  function getTeamPositionCounts() {
    const counts = {}; // { teamId: { position: count } }

    // Initialize all teams
    for (const teamId of TEAM_IDS) {
      counts[teamId] = {};
      for (const pos of Object.keys(ROSTER_POSITION_LIMITS_PER_TEAM)) {
        counts[teamId][pos] = 0;
      }
    }

    if (window.app && window.app.agGrid) {
      window.app.agGrid.forEachNode(node => {
        const teamId = node.data.TGID || node.data.teamId || 1009;
        const pos = (node.data.position || node.data.PPOS || '').toUpperCase().trim();

        if (teamId >= 1 && teamId <= 32 && pos && counts[teamId]) {
          counts[teamId][pos] = (counts[teamId][pos] || 0) + 1;
        }
      });
    }

    return counts;
  }

  /**
   * Find next team that needs a player at this position
   */
  function findTeamNeedingPosition(position, teamCounts) {
    // Find team with lowest count for this position that's under limit
    const limit = ROSTER_POSITION_LIMITS_PER_TEAM[position] || 2;
    let bestTeam = null;
    let bestCount = Infinity;

    for (const teamId of TEAM_IDS) {
      const count = teamCounts[teamId]?.[position] || 0;
      if (count < limit && count < bestCount) {
        bestCount = count;
        bestTeam = teamId;
      }
    }

    return bestTeam;
  }

  /**
   * Execute the fill operation
   */
  async function executeFill() {
    if (!previewData || !previewData.players || previewData.players.length === 0) {
      alert('Please click "Preview" first to see what will be filled.');
      return;
    }

    const { target, players, yearFrom, yearTo } = previewData;

    console.log(`[FillRemaining] Executing fill: ${players.length} players to ${target}`);

    const confirmed = confirm(
      `Add ${players.length} players to ${target}?\n\n` +
      `Years: ${yearFrom} - ${yearTo}\n\n` +
      'This operation cannot be undone.'
    );

    if (!confirmed) return;

    // Update button state
    const executeBtn = document.getElementById('fillExecuteBtn');
    executeBtn.disabled = true;
    executeBtn.textContent = 'Filling...';

    try {
      let addedCount = 0;

      // For roster, track team position counts to distribute evenly
      let teamCounts = null;
      if (target === 'roster') {
        teamCounts = getTeamPositionCounts();
      }

      for (const player of players) {
        try {
          if (target === 'roster') {
            // Find which team needs this position
            const teamId = findTeamNeedingPosition(player.position, teamCounts);
            if (teamId) {
              await addPlayerToRoster(player, teamId);
              // Update our tracking
              teamCounts[teamId][player.position] = (teamCounts[teamId][player.position] || 0) + 1;
            } else {
              // All teams full for this position, add as Free Agent
              await addPlayerToRoster(player, 1009);
            }
          } else {
            await addPlayerToDraft(player);
          }
          addedCount++;
        } catch (err) {
          console.error(`[FillRemaining] Error adding ${player.firstName} ${player.lastName}:`, err);
        }
      }

      console.log(`[FillRemaining] Added ${addedCount} players`);

      // Update UI after filling
      if (target === 'roster') {
        // Update filteredPlayers to match players array
        if (window.app.players && window.app.filteredPlayers) {
          window.app.filteredPlayers = window.app.players.slice();
        }
        // Update stats
        if (window.app.updateStats) {
          window.app.updateStats();
        }
      } else if (target === 'draft') {
        // Update draft stats
        if (window.app.currentDraftClass) {
          const statsEl = document.getElementById('draft-file-stats');
          if (statsEl) {
            const count = window.app.draftGrid.getSourceData().length;
            statsEl.textContent = `${count} prospects | Year: ${window.app.currentDraftClass.header.year}`;
          }
        }
      }

      alert(`Successfully added ${addedCount} of ${players.length} players to ${target}!\n\n` +
        (target === 'roster' ? 'Players distributed across all 32 teams.' : ''));

      closeFillModal();

    } catch (error) {
      console.error('[FillRemaining] Execute error:', error);
      alert('Error filling: ' + error.message);
    } finally {
      executeBtn.disabled = false;
      executeBtn.textContent = 'Fill Now';
    }
  }

  /**
   * Add a player to the roster grid
   * @param player - Player data from database
   * @param teamId - Team ID to assign (1-32 for teams, 1009 for Free Agent)
   */
  async function addPlayerToRoster(player, teamId = 1009) {
    if (!window.app || !window.app.agGrid) {
      throw new Error('Roster grid not available');
    }

    // Get player data for roster
    const result = await window.electronAPI.database.getPlayerForRoster(player.internalId, player.year);
    if (!result.success) {
      throw new Error(result.error);
    }

    const playerData = result.player;

    // Set the team ID
    playerData.TGID = teamId;

    // Add to grid
    window.app.agGrid.applyTransaction({
      add: [playerData]
    });

    // Also add to app.players array for consistency
    if (window.app.players) {
      window.app.players.push(playerData);
    }

    // Mark as modified
    if (window.app.rosterModified !== undefined) {
      window.app.rosterModified = true;
    }

    // Track the player
    if (window.electronAPI.editorTracking) {
      await window.electronAPI.editorTracking.trackPlayer({
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
        internalId: player.internalId,
        year: player.year,
        povr: player.povr || 70
      }, 'roster');
    }
  }

  /**
   * Add a player to the draft grid
   */
  async function addPlayerToDraft(player) {
    if (!window.app || !window.app.draftGrid) {
      throw new Error('Draft grid not available');
    }

    // Get player data for draft
    const result = await window.electronAPI.database.getPlayerForDraft(player.internalId, player.year);
    if (!result.success) {
      throw new Error(result.error);
    }

    const prospectData = result.prospect;
    const suggestedSlot = result.suggestedSlot;

    // Get current draft data
    const draftData = window.app.draftGrid.getSourceData();

    // Calculate target slot
    let targetSlot = suggestedSlot;
    if (targetSlot >= draftData.length) {
      targetSlot = draftData.length;
    }

    // Round calculation
    const roundNum = targetSlot < 224 ? Math.floor(targetSlot / 32) + 1 : 8;

    // Build the row object
    const newRow = {
      draftPosition: targetSlot,
      round: roundNum,
      playerPic: '',
      lastName: prospectData.lastName,
      firstName: prospectData.firstName,
      position: player.position,
      archetype: prospectData.archetype || 0,
      college: prospectData.college,
      homeState: prospectData.homeState,
      age: prospectData.age,
      PID: prospectData.PID,
      PEPS: prospectData.PEPS,
      devTrait: prospectData.devTrait || 0,
      overall: prospectData.overall || 70,
      speed: prospectData.speed || 70,
      acceleration: prospectData.acceleration || 70,
      strength: prospectData.strength || 70,
      agility: prospectData.agility || 70,
      awareness: prospectData.awareness || 70,
      jumping: prospectData.jumping || 70,
      stamina: prospectData.stamina || 70,
      changeOfDirection: prospectData.changeOfDirection || 70,
      injury: prospectData.injury || 70,
      carrying: prospectData.carrying || 70,
      ballCarrierVision: prospectData.ballCarrierVision || 70,
      breakTackle: prospectData.breakTackle || 70,
      trucking: prospectData.trucking || 70,
      stiffArm: prospectData.stiffArm || 70,
      spinMove: prospectData.spinMove || 70,
      jukeMove: prospectData.jukeMove || 70,
      catching: prospectData.catching || 70,
      catchInTraffic: prospectData.catchInTraffic || 70,
      spectacularCatch: prospectData.spectacularCatch || 70,
      shortRouteRunning: prospectData.shortRouteRunning || 70,
      mediumRouteRunning: prospectData.mediumRouteRunning || 70,
      deepRouteRunning: prospectData.deepRouteRunning || 70,
      release: prospectData.release || 70,
      throwPower: prospectData.throwPower || 70,
      throwAccuracyShort: prospectData.throwAccuracyShort || 70,
      throwAccuracyMid: prospectData.throwAccuracyMid || 70,
      throwAccuracyDeep: prospectData.throwAccuracyDeep || 70,
      throwOnTheRun: prospectData.throwOnTheRun || 70,
      throwUnderPressure: prospectData.throwUnderPressure || 70,
      playAction: prospectData.playAction || 70,
      breakSack: prospectData.breakSack || 70,
      passBlock: prospectData.passBlock || 70,
      passBlockPower: prospectData.passBlockPower || 70,
      passBlockFinesse: prospectData.passBlockFinesse || 70,
      runBlock: prospectData.runBlock || 70,
      runBlockPower: prospectData.runBlockPower || 70,
      runBlockFinesse: prospectData.runBlockFinesse || 70,
      leadBlock: prospectData.leadBlock || 70,
      impactBlocking: prospectData.impactBlocking || 70,
      tackle: prospectData.tackle || 70,
      hitPower: prospectData.hitPower || 70,
      powerMoves: prospectData.powerMoves || 70,
      finesseMoves: prospectData.finesseMoves || 70,
      blockShedding: prospectData.blockShedding || 70,
      pursuit: prospectData.pursuit || 70,
      playRecognition: prospectData.playRecognition || 70,
      manCoverage: prospectData.manCoverage || 70,
      zoneCoverage: prospectData.zoneCoverage || 70,
      pressCoverage: prospectData.pressCoverage || 70,
      kickPower: prospectData.kickPower || 70,
      kickAccuracy: prospectData.kickAccuracy || 70,
      kickReturn: prospectData.kickReturn || 70,
      heightInches: prospectData.heightInches || 72,
      weight: prospectData.weight || 200,
      toughness: prospectData.toughness || 70,
      visuals: prospectData.visuals
    };

    // Insert at target position
    draftData.splice(targetSlot, 0, newRow);

    // Renumber draft positions
    for (let i = 0; i < draftData.length; i++) {
      draftData[i].draftPosition = i;
      draftData[i].round = i < 224 ? Math.floor(i / 32) + 1 : 8;
    }

    // Reload grid
    window.app.draftGrid.loadData(draftData);

    // Update prospects reference
    if (window.app.currentDraftClass && window.app.currentDraftClass.prospects) {
      window.app.currentDraftClass.prospects = draftData;
    }

    // Track the player
    if (window.electronAPI.editorTracking) {
      await window.electronAPI.editorTracking.trackPlayer({
        firstName: prospectData.firstName,
        lastName: prospectData.lastName,
        position: player.position,
        internalId: player.internalId,
        year: player.year,
        povr: prospectData.overall || 70
      }, 'draft');
    }
  }

  // Make functions available globally
  window.initFillRemaining = initFillRemaining;
  window.openFillModal = openFillModal;
  window.closeFillModal = closeFillModal;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFillRemaining);
  } else {
    initFillRemaining();
  }

})();
