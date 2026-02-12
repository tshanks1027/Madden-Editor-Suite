/**
 * Roster Card View - Madden-style card view for roster editor
 * Features: 3-panel layout, portrait loading, editable stats, tab switching
 */

(function() {
    'use strict';

    let currentPlayers = [];
    let selectedPlayerIndex = 0;
    let currentView = 'table'; // Start with table view by default
    let currentTab = 'attributes';
    let portraitCache = {};

    // Stat definitions by tab
    const STAT_TABS = {
        attributes: {
            physical: [
                { key: 'PSPD', label: 'Speed' },
                { key: 'PACC', label: 'Acceleration' },
                { key: 'PSTR', label: 'Strength' },
                { key: 'PAGI', label: 'Agility' },
                { key: 'PJMP', label: 'Jumping' },
                { key: 'PSTA', label: 'Stamina' }
            ],
            passing: [
                { key: 'PTHP', label: 'Throw Power' },
                { key: 'PTAS', label: 'Short Accuracy' },
                { key: 'PTAM', label: 'Medium Accuracy' },
                { key: 'PTAD', label: 'Deep Accuracy' },
                { key: 'PTOR', label: 'Throw on Run' },
                { key: 'PPLA', label: 'Play Action' },
                { key: 'PTUP', label: 'Throw Under Pressure' }
            ],
            ballCarrier: [
                { key: 'PCAR', label: 'Carrying' },
                { key: 'PBCV', label: 'Ball Carrier Vision' },
                { key: 'PBKT', label: 'Break Tackle' },
                { key: 'PLTR', label: 'Trucking' },
                { key: 'PELU', label: 'Elusiveness' },
                { key: 'PLSA', label: 'Spin Move' },
                { key: 'PLJM', label: 'Juke Move' },
                { key: 'PLSM', label: 'Stiff Arm' }
            ],
            receiving: [
                { key: 'PCTH', label: 'Catching' },
                { key: 'PLCI', label: 'Catch in Traffic' },
                { key: 'PLSC', label: 'Spectacular Catch' },
                { key: 'PLRL', label: 'Release' },
                { key: 'PDRR', label: 'Deep Route' },
                { key: 'PMRR', label: 'Medium Route' },
                { key: 'PSRR', label: 'Short Route' }
            ],
            blocking: [
                { key: 'PPBK', label: 'Pass Block' },
                { key: 'PRBK', label: 'Run Block' },
                { key: 'PPBF', label: 'Pass Block Finesse' },
                { key: 'PPBS', label: 'Pass Block Power' },
                { key: 'PRBF', label: 'Run Block Finesse' },
                { key: 'PRBS', label: 'Run Block Power' },
                { key: 'PLIB', label: 'Impact Blocking' },
                { key: 'PLBK', label: 'Lead Block' }
            ],
            defense: [
                { key: 'PTAK', label: 'Tackle' },
                { key: 'PLHT', label: 'Hit Power' },
                { key: 'PBSG', label: 'Block Shed' },
                { key: 'PLPU', label: 'Pursuit' },
                { key: 'PLPR', label: 'Play Recognition' },
                { key: 'PLZC', label: 'Zone Coverage' },
                { key: 'PLMC', label: 'Man Coverage' },
                { key: 'PLPE', label: 'Press' },
                { key: 'PLPM', label: 'Power Moves' },
                { key: 'PLFM', label: 'Finesse Moves' }
            ],
            mental: [
                { key: 'PAWR', label: 'Awareness' }
            ]
        },
        abilities: [], // X-Factor abilities - to be implemented
        appearance: [
            { key: 'PHGT', label: 'Height', type: 'text' },
            { key: 'PWGT', label: 'Weight', type: 'number' },
            { key: 'PBTY', label: 'Body Type', type: 'dropdown' },
            { key: 'PSKI', label: 'Skin Tone', type: 'dropdown' },
            { key: 'PLHA', label: 'Handedness', type: 'dropdown' }
        ],
        bio: [
            { key: 'PFNA', label: 'First Name', type: 'text' },
            { key: 'PLNA', label: 'Last Name', type: 'text' },
            { key: 'PCOL', label: 'College', type: 'dropdown' },
            { key: 'PHTN', label: 'Hometown', type: 'text' },
            { key: 'PGST', label: 'State', type: 'dropdown' },
            { key: 'PAGE', label: 'Age', type: 'number' },
            { key: 'PYEX', label: 'Years Pro', type: 'number' },
            { key: 'PBDA', label: 'Birth Day', type: 'number' },
            { key: 'PBMO', label: 'Birth Month', type: 'number' },
            { key: 'PBYR', label: 'Birth Year', type: 'number' }
        ],
        contract: [
            { key: 'PCON', label: 'Contract Length', type: 'number' },
            { key: 'PCYL', label: 'Contract Year', type: 'number' },
            { key: 'PSBO', label: 'Signing Bonus', type: 'number' },
            { key: 'PTSA', label: 'Total Salary', type: 'number' },
            { key: 'PSA0', label: 'Salary Year 1', type: 'number' },
            { key: 'PSA1', label: 'Salary Year 2', type: 'number' },
            { key: 'PSA2', label: 'Salary Year 3', type: 'number' },
            { key: 'PSA3', label: 'Salary Year 4', type: 'number' },
            { key: 'PSA4', label: 'Salary Year 5', type: 'number' },
            { key: 'PSA5', label: 'Salary Year 6', type: 'number' },
            { key: 'PSA6', label: 'Salary Year 7', type: 'number' }
        ]
    };

    // Position ID to name mapping (M26 codes)
    const POSITION_ID_MAP = {
        0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE',
        5: 'LT', 6: 'LG', 7: 'C', 8: 'RG', 9: 'RT',
        10: 'LEDG', 11: 'REDG', 12: 'DT', 13: 'SAM', 14: 'Mike', 15: 'WILL',
        16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
    };

    /**
     * Get position name from player data (handles both string and numeric PPOS)
     */
    function getPositionName(player) {
        if (typeof player.position === 'string') {
            return player.position;
        }
        if (typeof player.PPOS === 'number') {
            return POSITION_ID_MAP[player.PPOS] || '--';
        }
        if (typeof player.PPOS === 'string') {
            return player.PPOS;
        }
        return '--';
    }

    /**
     * Set the roster view mode
     */
    window.setRosterView = function(view) {
        currentView = view;
        const cardView = document.getElementById('rosterCardView');
        const tableView = document.getElementById('rosterTableView');
        const cardBtn = document.getElementById('cardViewBtn');
        const tableBtn = document.getElementById('tableViewBtn');

        if (view === 'card') {
            cardView.classList.remove('hidden');
            tableView.classList.add('hidden');
            cardBtn.classList.add('active');
            tableBtn.classList.remove('active');
            // Load players immediately when switching to card view
            loadPlayersFromGrid();
        } else {
            cardView.classList.add('hidden');
            tableView.classList.remove('hidden');
            cardBtn.classList.remove('active');
            tableBtn.classList.add('active');
        }
    };

    /**
     * Load players from AG-Grid
     */
    function loadPlayersFromGrid() {
        if (!window.rosterGridApi) {
            console.log('[CardView] No grid API available yet');
            return;
        }

        currentPlayers = [];
        window.rosterGridApi.forEachNodeAfterFilterAndSort(node => {
            if (node.data) {
                currentPlayers.push(node.data);
            }
        });

        console.log('[CardView] Loaded', currentPlayers.length, 'players from grid');
        refreshPlayerList();
    }

    /**
     * Get stat color class based on value
     */
    function getStatClass(value) {
        if (value >= 90) return 'elite';
        if (value >= 80) return 'good';
        if (value >= 70) return 'avg';
        if (value >= 60) return 'below';
        return 'poor';
    }

    /**
     * Load portrait for a player
     */
    async function loadPortrait(player) {
        const pid = player.PSXP || player.pid;
        if (!pid) return null;

        // Check cache first
        if (portraitCache[pid]) {
            return portraitCache[pid];
        }

        try {
            if (window.electronAPI?.portrait?.getByPID) {
                const portrait = await window.electronAPI.portrait.getByPID(pid);
                if (portrait) {
                    portraitCache[pid] = portrait;
                    return portrait;
                }
            }
        } catch (err) {
            console.error('[CardView] Portrait load error:', err);
        }
        return null;
    }

    /**
     * Update the player detail card with player data
     */
    window.updateCardViewPlayer = async function(player, index) {
        if (!player) return;
        selectedPlayerIndex = index !== undefined ? index : selectedPlayerIndex;

        // Update basic info
        const nameEl = document.getElementById('cardPlayerName');
        const numberEl = document.getElementById('cardPlayerNumber');
        const posEl = document.getElementById('cardPlayerPosition');
        const ovrEl = document.getElementById('cardPlayerOVR');
        const photoEl = document.getElementById('cardPlayerPhoto');

        const firstName = player.firstName || player.PFNA || '';
        const lastName = player.lastName || player.PLNA || '';

        if (nameEl) nameEl.textContent = `${firstName} ${lastName}`.trim() || 'Unknown Player';
        if (numberEl) numberEl.textContent = player.jerseyNumber || player.PJEN || '--';
        if (posEl) posEl.textContent = getPositionName(player);
        if (ovrEl) ovrEl.textContent = player.overallRating || player.POVR || '--';

        // Update the logo bubble with the player's team logo and color
        // Only update if this is from a user click (not auto-selection on load)
        if (window._cardViewUserClicked) {
            const teamId = player.teamId || player.TGID;
            const logoEl = document.getElementById('v2TeamLogo');
            if (logoEl && window.app && typeof window.app.getTeamById === 'function') {
                const teamData = window.app.getTeamById(teamId);
                if (teamData && teamData.logo && teamData.secondary) {
                    logoEl.innerHTML = `<img src="${teamData.logo}" alt="${teamData.fullName || 'Team'} logo">`;
                    logoEl.style.background = `linear-gradient(145deg, ${teamData.secondary}, ${teamData.secondary}99)`;
                }
            }
        }

        // Load and display portrait
        if (photoEl) {
            const portrait = await loadPortrait(player);
            if (portrait) {
                photoEl.src = portrait;
                photoEl.style.display = 'block';
            } else {
                // Show placeholder with initials
                photoEl.src = '';
                photoEl.style.display = 'none';
            }
        }

        // Update quick stats
        updateQuickStats(player);

        // Update detailed stats for current tab
        updateTabContent(player);
    };

    /**
     * Update quick stats grid
     */
    function updateQuickStats(player) {
        const quickStatsEl = document.getElementById('cardQuickStats');
        if (!quickStatsEl) return;

        const position = getPositionName(player).toUpperCase();
        let quickStats;

        // Position-specific quick stats
        if (['QB'].includes(position)) {
            quickStats = [
                { key: 'PTHP', label: 'THP' },
                { key: 'PTAS', label: 'SAC' },
                { key: 'PTAM', label: 'MAC' },
                { key: 'PTAD', label: 'DAC' },
                { key: 'PAWR', label: 'AWR' },
                { key: 'PSPD', label: 'SPD' }
            ];
        } else if (['HB', 'FB'].includes(position)) {
            quickStats = [
                { key: 'PSPD', label: 'SPD' },
                { key: 'PACC', label: 'ACC' },
                { key: 'PCAR', label: 'CAR' },
                { key: 'PBCV', label: 'BCV' },
                { key: 'PBKT', label: 'BTK' },
                { key: 'PCTH', label: 'CTH' }
            ];
        } else if (['WR', 'TE'].includes(position)) {
            quickStats = [
                { key: 'PSPD', label: 'SPD' },
                { key: 'PCTH', label: 'CTH' },
                { key: 'PLCI', label: 'CIT' },
                { key: 'PMRR', label: 'MRR' },
                { key: 'PLRL', label: 'RLS' },
                { key: 'PLSC', label: 'SPC' }
            ];
        } else if (['LT', 'LG', 'C', 'RG', 'RT'].includes(position)) {
            quickStats = [
                { key: 'PSTR', label: 'STR' },
                { key: 'PPBK', label: 'PBK' },
                { key: 'PRBK', label: 'RBK' },
                { key: 'PLIB', label: 'IMP' },
                { key: 'PAWR', label: 'AWR' },
                { key: 'PACC', label: 'ACC' }
            ];
        } else if (['LEDG', 'REDG', 'DT'].includes(position)) {
            quickStats = [
                { key: 'PSTR', label: 'STR' },
                { key: 'PBSG', label: 'BSH' },
                { key: 'PLPM', label: 'PWM' },
                { key: 'PLFM', label: 'FNM' },
                { key: 'PTAK', label: 'TAK' },
                { key: 'PSPD', label: 'SPD' }
            ];
        } else if (['MLB', 'LOLB', 'ROLB', 'Mike', 'SAM', 'WILL'].includes(position)) {
            quickStats = [
                { key: 'PSPD', label: 'SPD' },
                { key: 'PTAK', label: 'TAK' },
                { key: 'PLZC', label: 'ZCV' },
                { key: 'PLPU', label: 'PUR' },
                { key: 'PLHT', label: 'POW' },
                { key: 'PAWR', label: 'AWR' }
            ];
        } else if (['CB', 'FS', 'SS'].includes(position)) {
            quickStats = [
                { key: 'PSPD', label: 'SPD' },
                { key: 'PLMC', label: 'MCV' },
                { key: 'PLZC', label: 'ZCV' },
                { key: 'PLPE', label: 'PRS' },
                { key: 'PCTH', label: 'CTH' },
                { key: 'PTAK', label: 'TAK' }
            ];
        } else {
            // Default
            quickStats = [
                { key: 'PSPD', label: 'SPD' },
                { key: 'PACC', label: 'ACC' },
                { key: 'PSTR', label: 'STR' },
                { key: 'PAGI', label: 'AGI' },
                { key: 'PAWR', label: 'AWR' },
                { key: 'PSTA', label: 'STA' }
            ];
        }

        quickStatsEl.innerHTML = quickStats.map(stat => {
            const val = player[stat.key] || '--';
            return `<div class="quick-stat-item"><div class="val">${val}</div><div class="lbl">${stat.label}</div></div>`;
        }).join('');
    }

    /**
     * Update tab content based on current tab
     */
    function updateTabContent(player) {
        const contentEl = document.getElementById('cardStatsContent');
        if (!contentEl) return;

        if (currentTab === 'attributes') {
            contentEl.innerHTML = generateAttributesTab(player);
        } else if (currentTab === 'abilities') {
            contentEl.innerHTML = generateAbilitiesTab(player);
        } else if (currentTab === 'appearance') {
            contentEl.innerHTML = generateAppearanceTab(player);
        } else if (currentTab === 'bio') {
            contentEl.innerHTML = generateBioTab(player);
        } else if (currentTab === 'contract') {
            contentEl.innerHTML = generateContractTab(player);
        }

        // Attach edit handlers
        attachEditHandlers(contentEl);
    }

    /**
     * Generate HTML for attributes tab
     */
    function generateAttributesTab(player) {
        const categories = STAT_TABS.attributes;
        let html = '';

        for (const [catName, stats] of Object.entries(categories)) {
            // Only show categories relevant to position
            const relevantStats = stats.filter(s => player[s.key] !== undefined && player[s.key] !== '');
            if (relevantStats.length === 0) continue;

            const catTitle = catName.charAt(0).toUpperCase() + catName.slice(1).replace(/([A-Z])/g, ' $1');
            html += `<div class="stat-category-section">
                <div class="stat-category-title">${catTitle}</div>`;

            for (const stat of relevantStats) {
                const val = player[stat.key] || 0;
                const statClass = getStatClass(val);
                html += `<div class="stat-row" data-field="${stat.key}">
                    <span class="stat-name">${stat.label}</span>
                    <div class="stat-bar"><div class="stat-fill ${statClass}" style="width: ${val}%;"></div></div>
                    <span class="stat-val editable" data-field="${stat.key}">${val}</span>
                </div>`;
            }
            html += '</div>';
        }
        return html;
    }

    /**
     * Generate HTML for abilities tab
     */
    function generateAbilitiesTab(player) {
        // TODO: Implement X-Factor/Superstar abilities
        return `<div class="stat-category-section">
            <div class="stat-category-title">X-Factor Abilities</div>
            <p style="color: #666;">Ability editing coming soon...</p>
        </div>`;
    }

    /**
     * Generate HTML for appearance tab
     */
    function generateAppearanceTab(player) {
        const fields = STAT_TABS.appearance;
        let html = '<div class="stat-category-section"><div class="stat-category-title">Appearance</div>';

        for (const field of fields) {
            const val = player[field.key] || '--';
            html += `<div class="stat-row" data-field="${field.key}">
                <span class="stat-name">${field.label}</span>
                <span class="stat-val editable wide" data-field="${field.key}" data-type="${field.type}">${val}</span>
            </div>`;
        }
        html += '</div>';
        return html;
    }

    /**
     * Generate HTML for bio tab
     */
    function generateBioTab(player) {
        const fields = STAT_TABS.bio;
        let html = '<div class="stat-category-section"><div class="stat-category-title">Biography</div>';

        for (const field of fields) {
            const val = player[field.key] || '--';
            html += `<div class="stat-row" data-field="${field.key}">
                <span class="stat-name">${field.label}</span>
                <span class="stat-val editable wide" data-field="${field.key}" data-type="${field.type}">${val}</span>
            </div>`;
        }
        html += '</div>';
        return html;
    }

    /**
     * Generate HTML for contract tab
     */
    function generateContractTab(player) {
        const fields = STAT_TABS.contract;
        let html = '<div class="stat-category-section"><div class="stat-category-title">Contract Details</div>';

        for (const field of fields) {
            let val = player[field.key];
            // Format salary values
            if (field.key.startsWith('PSA') || field.key === 'PSBO' || field.key === 'PTSA') {
                val = val ? `$${Number(val).toLocaleString()}` : '--';
            } else {
                val = val || '--';
            }
            html += `<div class="stat-row" data-field="${field.key}">
                <span class="stat-name">${field.label}</span>
                <span class="stat-val editable wide" data-field="${field.key}" data-type="${field.type}">${val}</span>
            </div>`;
        }
        html += '</div>';
        return html;
    }

    /**
     * Attach click-to-edit handlers to stat values
     */
    function attachEditHandlers(container) {
        container.querySelectorAll('.stat-val.editable').forEach(el => {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                const field = this.dataset.field;
                const type = this.dataset.type || 'number';
                const currentVal = currentPlayers[selectedPlayerIndex]?.[field] || '';

                // Create inline input
                const input = document.createElement('input');
                input.type = type === 'number' ? 'number' : 'text';
                input.value = currentVal;
                input.className = 'stat-inline-input';
                input.style.cssText = 'width: 60px; background: #333; border: 1px solid #d4af37; color: #fff; padding: 2px 4px; border-radius: 4px; font-size: 14px; text-align: right;';

                const originalText = this.textContent;
                this.textContent = '';
                this.appendChild(input);
                input.focus();
                input.select();

                const saveValue = () => {
                    const newVal = type === 'number' ? parseInt(input.value) || 0 : input.value;
                    this.textContent = newVal;

                    // Update player data
                    if (currentPlayers[selectedPlayerIndex]) {
                        currentPlayers[selectedPlayerIndex][field] = newVal;
                    }

                    // Sync to AG-Grid
                    syncToGrid(field, newVal);

                    // Update stat bar if applicable
                    const row = this.closest('.stat-row');
                    if (row && type === 'number') {
                        const fill = row.querySelector('.stat-fill');
                        if (fill) {
                            fill.style.width = `${newVal}%`;
                            fill.className = 'stat-fill ' + getStatClass(newVal);
                        }
                    }
                };

                input.addEventListener('blur', saveValue);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    } else if (e.key === 'Escape') {
                        this.textContent = originalText;
                    }
                });
            });
        });
    }

    /**
     * Sync stat change back to AG-Grid
     */
    function syncToGrid(field, value) {
        if (!window.rosterGridApi) return;

        try {
            const rowNode = window.rosterGridApi.getDisplayedRowAtIndex(selectedPlayerIndex);
            if (rowNode) {
                rowNode.setDataValue(field, value);
                console.log('[CardView] Synced', field, '=', value, 'to grid');
            }
        } catch (err) {
            console.error('[CardView] Grid sync error:', err);
        }
    }

    /**
     * Refresh the player list panel
     */
    function refreshPlayerList() {
        const listEl = document.getElementById('cardViewPlayerList');
        if (!listEl) return;

        if (currentPlayers.length === 0) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No players loaded</div>';
            return;
        }

        listEl.innerHTML = currentPlayers.map((player, index) => {
            const firstName = player.firstName || player.PFNA || '';
            const lastName = player.lastName || player.PLNA || '';
            const position = getPositionName(player);
            const number = player.jerseyNumber || player.PJEN || '--';
            const ovr = player.overallRating || player.POVR || '--';
            const initials = `${firstName.charAt(0) || '?'}${lastName.charAt(0) || '?'}`.toUpperCase();
            const isSelected = index === selectedPlayerIndex;

            return `
                <div class="player-list-item${isSelected ? ' selected' : ''}" data-index="${index}">
                    <div class="player-list-avatar" data-pid="${player.PSXP || ''}">${initials}</div>
                    <div class="player-list-info">
                        <div class="player-list-name">${firstName} ${lastName}</div>
                        <div class="player-list-pos">${position} #${number}</div>
                    </div>
                    <span class="player-list-ovr">${ovr}</span>
                </div>
            `;
        }).join('');

        // Add click handlers
        listEl.querySelectorAll('.player-list-item').forEach(item => {
            item.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                window._cardViewUserClicked = true; // Mark as user-initiated click
                selectPlayer(index);
            });
        });

        // Select first player if none selected
        if (currentPlayers.length > 0 && selectedPlayerIndex < currentPlayers.length) {
            window.updateCardViewPlayer(currentPlayers[selectedPlayerIndex], selectedPlayerIndex);
        }

        // Load mini portraits for list items
        loadListPortraits();
    }

    /**
     * Load portraits for player list items
     */
    async function loadListPortraits() {
        const avatars = document.querySelectorAll('.player-list-avatar[data-pid]');
        for (const avatar of avatars) {
            const pid = avatar.dataset.pid;
            if (pid && window.electronAPI?.portrait?.getByPID) {
                try {
                    const portrait = await window.electronAPI.portrait.getByPID(pid);
                    if (portrait) {
                        avatar.innerHTML = `<img src="${portrait}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`;
                    }
                } catch (e) {
                    // Keep initials
                }
            }
        }
    }

    /**
     * Select a player by index
     */
    function selectPlayer(index) {
        selectedPlayerIndex = index;

        // Update selected state in list
        document.querySelectorAll('.player-list-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
        });

        // Update the player card
        if (currentPlayers[index]) {
            window.updateCardViewPlayer(currentPlayers[index], index);
        }
    }

    /**
     * Initialize search functionality
     */
    function initCardViewSearch() {
        const searchInput = document.getElementById('cardViewSearch');
        if (!searchInput) return;

        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            document.querySelectorAll('.player-list-item').forEach(item => {
                const name = item.querySelector('.player-list-name')?.textContent.toLowerCase() || '';
                item.style.display = name.includes(query) ? '' : 'none';
            });
        });
    }

    /**
     * Initialize tab switching
     */
    function initStatTabs() {
        document.querySelectorAll('.stat-tab-btn').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.stat-tab-btn').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                currentTab = this.dataset.tab;

                // Update content for current player
                if (currentPlayers[selectedPlayerIndex]) {
                    updateTabContent(currentPlayers[selectedPlayerIndex]);
                }
            });
        });
    }

    /**
     * Show view toggle (called when roster loads)
     */
    window.showViewToggle = function() {
        const container = document.getElementById('viewToggleContainer');
        if (container) {
            container.style.display = 'flex';
        }
        // Trigger initial load if in card view
        if (currentView === 'card') {
            setTimeout(loadPlayersFromGrid, 100);
        }
    };

    /**
     * Hide view toggle (called when roster closes)
     */
    window.hideViewToggle = function() {
        const container = document.getElementById('viewToggleContainer');
        if (container) {
            container.style.display = 'none';
        }
        currentPlayers = [];
        selectedPlayerIndex = 0;
    };

    /**
     * Notify card view of data changes
     */
    window.notifyCardViewDataChanged = function() {
        console.log('[CardView] Data changed notification received');
        loadPlayersFromGrid();
    };

    /**
     * Allow external selection (e.g., from AG-Grid row click)
     */
    window.selectCardViewPlayer = function(index) {
        if (currentView === 'card') {
            selectPlayer(index);
        }
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        initCardViewSearch();
        initStatTabs();

        // Set initial view state - start with table view (card hidden)
        const cardView = document.getElementById('rosterCardView');
        const tableView = document.getElementById('rosterTableView');
        const cardBtn = document.getElementById('cardViewBtn');
        const tableBtn = document.getElementById('tableViewBtn');

        if (cardView) cardView.classList.add('hidden');
        if (tableView) tableView.classList.remove('hidden');

        // Set button states - table view is active by default
        if (cardBtn) cardBtn.classList.remove('active');
        if (tableBtn) tableBtn.classList.add('active');
    });

})();
